// ---------------------------------------------------------------------------
// completeAt() — scope-aware completion over a SqlDocument.
//
// The interactive editor feature that lives in the BROKEN-input world: the user
// is mid-keystroke, so this drives an ATN candidate walk over the DOCUMENT'S OWN
// already-lexed token stream (cell.tokens, reused not re-parsed; the document's
// error-tolerant parse already ran, and for a templated document over the jinja
// placeholder), positions it at the caret, and turns the raw {tokens, rules} the
// walk reports into editor completion items:
//   - keywords  — candidate token types whose grammar literal is a word (FROM, …)
//   - tables    — schema table names, when the caret is at a relation-name slot
//   - columns   — the scope's visible columns, when at a value/column slot
//   - functions — the dialect's inference-registry function names, at a value slot
//
// Dialect-neutral core: antlr4ng + generated code + our own modules only. It never
// throws — broken input still yields at least the keyword candidates.
// ---------------------------------------------------------------------------

import { Token, type Vocabulary } from "antlr4ng";
import { debugRethrow } from "../debug.js";
import type { SqlDocument } from "../document/document.js";
import { nodeAt } from "../document/node-at.js";
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { IdentKind } from "../ident/fold.js";
import type { QueryExpr } from "../ir/ir.js";
import { partSpanOf, type PartSpan } from "../ir/part-span.js";
import type { Column } from "../qualify/schema.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { DefaultTemplateProvider, type TemplateCall } from "../qualify/template-provider.js";
import { callOf } from "../minijinja/apply-tags.js";
import type { TagNode } from "../minijinja/tag-ast.js";
import { sourcesMatchingQualifier, type ResolvedSource, type Scope, type ScopeTree } from "../scope/scope.js";
import { collectCandidates } from "./atn-walk.js";
import { jinjaSlotAt, type JinjaSlot } from "./jinja-slot.js";
import { COMPLETION_CONFIG, type CompletionConfig } from "./config.js";
import { completionMeta } from "./parser-factory.js";

/** The token fields the ATN walk and the FROM-relation fallback read. The document's neutral
 *  `cell.tokens` satisfy it directly; the appended EOF sentinel is built to it. */
interface WalkTok {
	type: number;
	channel: number;
	start: number;
	text: string;
}

/** One completion candidate, already pruned to the typed prefix (2026-07-12 ruling) and applied at
 *  the caret / `CompletionResult.replaceRange`. The `"template"` kind is a host candidate for a
 *  jinja call slot (a dbt model for a ref's arg) — its own, separately-decided contract (the
 *  consumer still filters those by the typed prefix; see complete.jinja-candidates.test.ts). */
export interface Completion {
	label: string;
	kind: "keyword" | "column" | "table" | "cte" | "namespace" | "function" | "template";
	/** Extra display info, e.g. a column's type when the schema knows it. */
	detail?: string;
	/** Long-form documentation for the candidate. completeAt's own resolution never fills this in —
	 *  it is set ONLY by a `decorate` hook (CompleteOptions.decorate) answering one. Absent when no
	 *  hook ran, or the hook answered nothing for this candidate. */
	documentation?: string;
}

/** The caret-anchored span of the partial identifier/keyword the candidates were pruned against —
 *  `text.slice(start, end)` is what's already typed. `start` includes an opening delimiter when the
 *  caret sits inside a quoted/bracketed/backtick-quoted identifier (`"my_t`, `` `my_t ``, `[my_t`),
 *  so an editor that replaces this span never leaves a stray leading quote. `end` never extends past
 *  the caret (`offset`) — even where a dialect's lexer greedily swallows an unterminated quoted
 *  identifier past the caret, only the already-typed portion is ever reported or matched. */
export interface ReplaceRange {
	start: number;
	end: number;
}

/** completeAt()'s result: an ordinary `Completion[]` (`.map`/`.filter`/iteration/`.length` all work
 *  exactly as before — every existing consumer sees no change) carrying one optional extra
 *  property, the same "array with named extras" shape TypeScript's own `RegExpMatchArray` uses for
 *  `String.prototype.match`. `replaceRange` is present only when the caret sits inside a partially
 *  typed word; an empty-prefix caret (a token boundary — nothing typed yet) returns a plain array
 *  with no `replaceRange`, byte-identical to the pre-pruning contract. */
export interface CompletionResult extends Array<Completion> {
	replaceRange?: ReplaceRange;
}

/** The decoration hook's answer for ONE candidate — display text supplied from real structure,
 *  merged onto the Completion completeAt is about to return. Every field optional: an absent field
 *  leaves that part of the candidate as completeAt itself produced it (a schema-fed column's own
 *  `detail` survives unless the hook overrides it); returning nothing at all leaves the candidate
 *  wholly undecorated. */
export interface CandidateDecoration {
	detail?: string;
	documentation?: string;
}

/**
 * The STRUCTURAL identity of a candidate completeAt is about to return — anvil's decoration-hook ask
 * (channel, 2026-07-20): "hand back STRUCTURAL identity, not just the label string". Discriminated by
 * the candidate's own `kind`. Every extra field is present ONLY when completeAt's own resolution
 * already produced it (never-wrong: nothing here is synthesized or re-derived) — e.g. a "column"
 * candidate from the broken-input FROM/JOIN token-stream fallback (fromRelationColumns /
 * qualifiedFallbackColumns) carries no `source`, because no ResolvedSource exists on that path.
 *
 * `"template"` covers the jinja call-slot candidates (a dbt model name for a `ref('|` arg, a source
 * name for `source('|`) — the "table candidate that resolves through a templated call" from the
 * ask: its `call` is the SAME TemplateCall (`JinjaSlot.call`) `templateCandidates` was already asked
 * with, so a consumer names the model/source without re-parsing the call text.
 */
export type CandidateIdentity =
	| { kind: "keyword" }
	| { kind: "function" }
	| { kind: "namespace" }
	| { kind: "table" }
	| {
			kind: "cte";
			/** The CTE name's own declaration span (`CteDef.nameCst`, falling back to the whole
			 *  `CteDef.cst` when the name has no real token) — pins the RIGHT declaration even when
			 *  another CTE of the same name shadows it in a nested scope. Absent only when the CTE
			 *  itself has no real token to key on (a broken/nameless mid-edit CTE). */
			declarationSpan?: PartSpan;
	  }
	| {
			kind: "column";
			/** The resolved scope source this column came from (the same ResolvedSource
			 *  scope/qualify already produced — a table/CTE/subquery/lateral/relation/graphtable/pivot).
			 *  Absent when the column came from the broken-input token-stream fallback, which has no
			 *  ResolvedSource to carry. */
			source?: ResolvedSource;
	  }
	| { kind: "template"; call: TemplateCall };

/** Per-candidate decoration hook (`CompleteOptions.decorate`): completeAt calls this once for each
 *  candidate it is about to return, with the candidate as built so far and its structural identity,
 *  and merges the answer's `detail`/`documentation` onto it. The candidate SET is unaffected — this
 *  only supplies display text, never adds/removes/reorders a candidate. Total-safe: a throwing hook
 *  degrades to the undecorated candidate (never breaks completeAt), the same total-by-contract
 *  posture every other completeAt internal failure gets (SQLLENS_DEBUG=1 rethrows — src/debug.ts). */
export type DecorateCandidate = (
	candidate: Completion,
	identity: CandidateIdentity,
) => CandidateDecoration | undefined | void;

/** completeAt's options — currently just the decoration hook. Additive: every existing 3-arg call
 *  site keeps compiling and behaving byte-identically (no `opts`, no decoration). */
export interface CompleteOptions {
	decorate?: DecorateCandidate;
}

/**
 * Completion candidates for the caret at `offset` in `doc`, pruned to the identifier/keyword
 * fragment already typed there (case-insensitive, dialect-fold-aware; plain prefix match — never
 * fuzzy). Schema-aware when a `Schema` is given (table names + column types). NEVER throws: on
 * broken / mid-edit input it still returns the keyword candidates the walk can reach.
 */
export function completeAt(
	doc: SqlDocument,
	offset: number,
	schema?: SchemaProvider,
	opts?: CompleteOptions,
): CompletionResult {
	try {
		return collect(doc, offset, schema, opts?.decorate);
	} catch (e) {
		// Total by contract: a walk/parse hiccup must not surface to the editor.
		debugRethrow(e);
		return [];
	}
}

/** @deprecated Use completeAt — same function, uniform cursor-verb naming. */
export const complete = completeAt;

function collect(
	doc: SqlDocument,
	offset: number,
	schema?: SchemaProvider,
	decorate?: DecorateCandidate,
): CompletionResult {
	const dialect = doc.dialect;

	// Inside a jinja tag ({{ ref('| }}, {% if | %}, {{ a ~ | }}) the caret is not in SQL at all, so SQL
	// completion is wrong: the tag was blanked to a placeholder sitting in some SQL slot, so the walk
	// would otherwise offer keywords/tables/columns inside the jinja. A recognized call slot answers the
	// host's candidates through the template provider (the neutral provider offers none); any other
	// position strictly inside a tag answers nothing. Only a caret outside every tag falls through to
	// ordinary SQL completion below. Tags are reused from the document, never re-parsed.
	const tags = doc.templated?.tags;
	if (tags) {
		const slot = jinjaSlotAt(tags, doc.text, offset);
		if (slot) return templateCompletions(slot, schema, decorate);
		if (tags.some((t) => offset > t.tagSpan.start && offset < t.tagSpan.end)) return [];
	}

	const cfg = COMPLETION_CONFIG[dialect];

	// Route to the statement CELL owning the caret: the visible-column lookup runs over that cell's
	// own scope tree (cell-relative caret) and the ATN walk over that cell's own tokens, so a caret
	// in statement 2 of a multi-statement document completes through its real scope, not the compound
	// facade. Single-cell: the cell IS the document, so this is identical to a whole-doc walk.
	const cell = doc.cellAt(offset);
	const cellScopes = cell ? cell.scopes : doc.scopes;
	const cellAst = cell ? cell.ast : doc.ast;
	// Two coordinate spaces: the scope/column lookup is CELL-relative (cell.scopes/cell.ast carry
	// cell-relative spans), the token walk is DOCUMENT-relative (cell.tokens are shifted to doc
	// coordinates), so `offset` drives the walk and `cellOffset` the scope lookup.
	const cellOffset = cell ? offset - cell.span.start : offset;

	// The ATN walk reuses the DOCUMENT'S OWN already-lexed token stream instead of re-parsing the
	// text. For a TEMPLATED document those tokens are the SQL-over-placeholder stream (the jinja tags
	// are channel-2 tokens the walk skips), so completion sees real SQL at document-true offsets and
	// never has to re-derive the placeholder; the raw `{{ }}` text that made a fresh lexer die from
	// char 0 is never handed to a lexer again. A synthetic EOF closes the stream (mapTokens drops
	// antlr's EOF sentinel), matching the entry rule's EOF anchor; its `start` past every real token
	// keeps it the caret-index fallback for an end-of-input caret.
	const meta = completionMeta(dialect);
	const end = cell ? cell.span.end : doc.text.length;
	const walkTokens: WalkTok[] = [
		...(cell ? cell.tokens : doc.tokens),
		{ type: Token.EOF, channel: Token.DEFAULT_CHANNEL, start: end, text: "" },
	];
	const caretIdx = caretTokenIndex(walkTokens, offset, cfg);
	const cand = collectCandidates(
		meta.atn,
		meta.entryRuleIndex,
		walkTokens,
		caretIdx,
		cfg.preferredRules,
		cfg.ignoredTokens,
	);

	const out: Completion[] = [];
	const seen = new Set<string>(); // dedup by `${kind}\0${label}`
	// Per-candidate structural identity (CandidateIdentity), keyed by the Completion object itself —
	// consulted only when `decorate` is set (decorateResult, at the end of this function).
	const identities = new Map<Completion, CandidateIdentity>();
	const add = (c: Completion, identity: CandidateIdentity): void => {
		const key = `${c.kind}\0${c.label}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(c);
		identities.set(c, identity);
	};

	// keywords — from candidate token types whose grammar literal is a word.
	for (const type of cand.tokens) {
		const label = keywordLabel(meta.vocabulary, type);
		if (label) add({ label, kind: "keyword" }, { kind: "keyword" });
	}

	// A RELATION PATH position (#38 stage 6): a dotted chain right before the caret whose anchor
	// token is FROM/JOIN-family (cfg.relationKeywordTokens — the same per-dialect set the
	// broken-input fallback uses). Mid-path the ATN reports a generic identifier slot, so the
	// anchor, not the rule set, is the discriminator. The candidates are the typed prefix's NEXT
	// SEGMENTS (segment labels only — a client replaces the caret token, so a full path would
	// double-insert), never CTEs, and never the column/function noise the identifier slot would
	// otherwise pour in.
	const path = dottedPrefixAt(walkTokens, caretIdx);
	const atRelationPath =
		path.parts.length > 0 && path.anchorIdx >= 0 && cfg.relationKeywordTokens.has(walkTokens[path.anchorIdx]!.type);
	const atTable = intersects(cand.rules, cfg.tableRules);
	const atColumn = intersects(cand.rules, cfg.columnRules);

	if (atRelationPath) {
		if (schema?.childrenOf) {
			for (const child of schema.childrenOf(path.parts, dialect))
				add({ label: child.name, kind: child.kind }, { kind: child.kind } as CandidateIdentity);
		}
	} else if (path.parts.length > 0) {
		// A qualified MEMBER position (`o.|`, `gold.orders.|`) — anvil item 2: only the columns of
		// the source the qualifier matches (the same validated any-depth primitive binding uses),
		// no function/keyword noise. Deliberately NOT gated on the walk's rules: at a dangling dot
		// mid-edit the walk often reports nothing, but the dot chain itself is the member-position
		// evidence (it is the completion trigger character), and an unmatched qualifier answers [].
		const scoped = qualifiedSourceColumns(cellScopes, cellAst, cellOffset, path.parts, dialect, schema);
		for (const c of scoped.items) add(c, { kind: "column", source: scoped.source });
		// Mid-edit the dangling dot often breaks the FROM parse and the scope is EMPTY — the same
		// failure the bare-slot fallback covers. Its member twin: read `FROM/JOIN name [alias]`
		// pairs off the token stream and answer the matching relation's schema columns.
		if (scoped.items.length === 0 && schema) {
			const fallback = qualifiedFallbackColumns(
				walkTokens,
				cfg,
				path.parts,
				schema,
				dialect,
				doc.templated?.tags,
				doc.text,
			);
			for (const c of fallback) add(c, { kind: "column" });
		}
	} else {
		if (atTable) {
			// Bare relation slot: in-scope CTE names FIRST (they shadow same-named catalog tables),
			// then the catalog's tables.
			for (const cte of visibleCteNames(cellScopes, cellAst, cellOffset))
				add({ label: cte.name, kind: "cte" }, { kind: "cte", declarationSpan: cte.declarationSpan });
			if (schema) for (const t of schema.tables(dialect)) add({ label: t, kind: "table" }, { kind: "table" });
		}
		// columns — value/column slot: the columns visible from the enclosing scope, plus a
		// broken-input fallback reading FROM/JOIN relation names straight off the token stream.
		if (atColumn) {
			for (const { completion, source } of visibleColumns(cellScopes, cellAst, dialect, cellOffset, schema))
				add(completion, { kind: "column", source });
			if (schema)
				for (const c of fromRelationColumns(walkTokens, cfg, schema, dialect, doc.templated?.tags, doc.text))
					add(c, { kind: "column" });
			// functions — value/column slot: the dialect's inference-registry function names.
			for (const fn of Object.keys(resolveBehavior(dialect).functions))
				add({ label: fn, kind: "function" }, { kind: "function" });
		}
	}

	const result = pruneByPrefix(out, walkTokens, offset, cfg, doc.text, dialect);
	return decorate ? decorateResult(result, identities, decorate) : result;
}

/** Apply `decorate` to one candidate, merging its `detail`/`documentation` onto a COPY (the input is
 *  never mutated). Total-safe: a throwing hook degrades to the undecorated candidate unchanged;
 *  SQLLENS_DEBUG=1 rethrows (src/debug.ts), the same posture every other completeAt internal failure
 *  gets. */
function applyDecoration(candidate: Completion, identity: CandidateIdentity, decorate: DecorateCandidate): Completion {
	try {
		const d = decorate(candidate, identity);
		if (!d) return candidate;
		return {
			...candidate,
			...(d.detail !== undefined ? { detail: d.detail } : {}),
			...(d.documentation !== undefined ? { documentation: d.documentation } : {}),
		};
	} catch (e) {
		debugRethrow(e);
		return candidate;
	}
}

/** Decorate every candidate in the assembled SQL-slot result (post prefix-pruning — a pruned-out
 *  candidate never reaches the consumer's hook), preserving `replaceRange` (Array.prototype.map
 *  drops it — it is not an own array index). `identities` was populated by `add()` during collect();
 *  a candidate somehow missing an entry (never happens in practice — every `add()` call site provides
 *  one) falls back to its bare kind rather than crashing. */
function decorateResult(
	result: CompletionResult,
	identities: Map<Completion, CandidateIdentity>,
	decorate: DecorateCandidate,
): CompletionResult {
	const decorated: CompletionResult = result.map((c) =>
		applyDecoration(c, identities.get(c) ?? ({ kind: c.kind } as CandidateIdentity), decorate),
	);
	if (result.replaceRange) decorated.replaceRange = result.replaceRange;
	return decorated;
}

/** SQL identifier-quoting delimiters recognized across all ten dialects
 *  (docs/identifier-delimiter-contract.md) — used only to recognize a PARTIAL, possibly
 *  unterminated quoted identifier under the caret; a dialect's own quoting/case rules stay put in
 *  src/<dialect>/fold.ts. */
const CLOSE_FOR_OPEN: Readonly<Record<string, string>> = { '"': '"', "`": "`", "[": "]" };

/** The identifier/keyword fragment under (or immediately preceding) the caret, read off the
 *  document's OWN token stream — never re-lexed. Two shapes recognized:
 *   - a bare word (keyword or identifier) the caret sits inside/at the end of (`SEL|`, `ifn|`) —
 *     word-START only (`[A-Za-z_]`), so a numeric literal (`… WHERE x > 10|`) is never mistaken
 *     for an identifier prefix;
 *   - a delimited identifier: either ONE token spanning both delimiters (`cfg.nameTokens` — a
 *     complete `"a"`/`` `a` ``/`[a]`, or an unterminated one some dialects lex greedily to EOF), or
 *     a lone opening-delimiter character immediately followed by a bare identifier token (the
 *     lexer error-recovery split other dialects produce for an unterminated `` `a `` / `"a` — the
 *     delimiter alone fails to match any token and is skipped, the identifier body then lexes
 *     cleanly on its own).
 *  Returns undefined at a token boundary — nothing partially typed (the empty-prefix case, left
 *  completely unpruned). The returned span never extends past `offset`: even where a dialect's
 *  lexer greedily swallows an unterminated quoted identifier to EOF, only the already-typed portion
 *  is ever reported. */
function identifierPrefixAt(
	toks: readonly WalkTok[],
	offset: number,
	cfg: CompletionConfig,
	text: string,
): { start: number; raw: string } | undefined {
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (!t || t.channel !== Token.DEFAULT_CHANNEL) continue;
		const nameLike = /^[A-Za-z_]/.test(t.text) || cfg.nameTokens.has(t.type);
		if (nameLike && t.start < offset && offset <= t.start + t.text.length) {
			let start = t.start;
			// A lone opening-delimiter token immediately before this one (the split-recovery case) —
			// fold it into the same partial identifier so the replace range covers it too.
			for (let j = i - 1; j >= 0; j--) {
				const p = toks[j];
				if (!p || p.channel !== Token.DEFAULT_CHANNEL) continue;
				if (p.start + p.text.length === start && Object.hasOwn(CLOSE_FOR_OPEN, p.text)) start = p.start;
				break;
			}
			return { start, raw: text.slice(start, offset) };
		}
		if (t.start >= offset) return undefined; // moved past the caret — nothing partially typed here
	}
	return undefined;
}

/** Fold a (possibly partial/unterminated) identifier fragment to the same identity space
 *  `behavior.fold` gives a COMPLETE identifier. A partial `"a`/`` `a `` /`[a` has no closing
 *  delimiter yet — `fold()`'s own unwrap requires one to recognize it as quoted — so this
 *  synthesizes the matching close for the fold call only; the raw text / replace range reported
 *  elsewhere are untouched. Folding an already-complete candidate label through this is a no-op. */
function foldForPrefixMatch(behavior: DialectBehavior, raw: string, kind: IdentKind): string {
	const open = raw[0];
	const close = open ? CLOSE_FOR_OPEN[open] : undefined;
	const closed = close && !raw.endsWith(close) ? raw + close : raw;
	return behavior.fold(closed, kind);
}

/** Post-filters the assembled SQL-slot candidates by the identifier/keyword fragment under the
 *  caret (2026-07-12 ruling: "completeAt must return only candidates that validly complete at the
 *  caret right now, pruned by the word already typed" — the library holds the token stream, CST,
 *  and dialect fold rules, so it prunes here instead of handing the consumer the whole per-slot
 *  set). An empty-prefix caret (a token boundary — nothing partially typed) returns `out`
 *  completely unchanged: byte-identical to the pre-pruning contract, no `replaceRange`. Keywords
 *  fold plain ASCII-case-insensitive (every dialect's keywords are case-insensitive, unlike
 *  identifiers); identifier-kind candidates (column/table/cte/namespace/function) fold through the
 *  dialect's own identity-key rule, `"table"` kind for `table` candidates (only BigQuery's table
 *  case rule differs from the rest). Plain-prefix `startsWith` only — never fuzzy (never-wrong: no
 *  guessed matches). Jinja template/call-slot candidates (returned earlier in `collect`, from
 *  `templateCompletions`) are OUT of this — that path has its own, separately-decided "editor
 *  filters" contract (tests/completion/complete.jinja-candidates.test.ts). */
function pruneByPrefix(
	out: Completion[],
	toks: readonly WalkTok[],
	offset: number,
	cfg: CompletionConfig,
	text: string,
	dialect: string,
): CompletionResult {
	const prefix = identifierPrefixAt(toks, offset, cfg, text);
	if (!prefix) return out;

	const behavior = resolveBehavior(dialect);
	const keywordPrefix = prefix.raw.toLowerCase();
	const otherPrefix = foldForPrefixMatch(behavior, prefix.raw, "other");
	const tablePrefix = foldForPrefixMatch(behavior, prefix.raw, "table");
	const pruned: CompletionResult = out.filter((c) => {
		if (c.kind === "keyword") return c.label.toLowerCase().startsWith(keywordPrefix);
		const kind: IdentKind = c.kind === "table" ? "table" : "other";
		return foldForPrefixMatch(behavior, c.label, kind).startsWith(kind === "table" ? tablePrefix : otherPrefix);
	});
	pruned.replaceRange = { start: prefix.start, end: offset };
	return pruned;
}

/** The host's candidates for a jinja call slot, as completions. The template provider carries them,
 *  so this reads the `schema` when it is one (a DbtTemplateProvider IS a SchemaProvider, and the host
 *  already passes it here for column/table completion); the neutral provider offers none. A jinja slot
 *  with no candidates still returns [], never SQL keywords, so a caret inside a tag never leaks SQL
 *  completion. Every item's structural identity is `{ kind: "template", call: slot.call }` — the SAME
 *  TemplateCall `templateCandidates` was asked with (a dbt model/source candidate resolves through
 *  this call, so a `decorate` hook names it without re-parsing the call text). */
function templateCompletions(
	slot: JinjaSlot,
	schema?: SchemaProvider,
	decorate?: DecorateCandidate,
): CompletionResult {
	if (!(schema instanceof DefaultTemplateProvider)) return [];
	const items = schema.templateCandidates(slot.call, slot.argIndex).map((c) => ({
		label: c.label,
		kind: "template" as const,
		...(c.detail !== undefined ? { detail: c.detail } : {}),
	}));
	if (!decorate) return items;
	const identity: CandidateIdentity = { kind: "template", call: slot.call };
	return items.map((c) => applyDecoration(c, identity, decorate));
}

/** The dotted qualifier immediately before the caret (#38): `analytics.` → ["analytics"],
 *  `analytics.sales.` → ["analytics","sales"], `analytics.sa|` (typing a segment) → ["analytics"].
 *  Reads the walk's own token stream backwards from the caret token: an optional partial segment,
 *  then (DOT ident)+ chains. `anchorIdx` is the default-channel token BEFORE the whole chain
 *  (-1 at document start) — its type says what the chain qualifies (FROM/JOIN → a relation path).
 *  parts: [] when no dot chain precedes the caret. Raw texts, delimiters intact — the schema
 *  folds. */
function dottedPrefixAt(toks: readonly WalkTok[], caretIdx: number): { parts: string[]; anchorIdx: number } {
	const prev = (i: number): number => {
		for (let j = i - 1; j >= 0; j--) if (toks[j]!.channel === Token.DEFAULT_CHANNEL) return j;
		return -1;
	};
	let i = caretIdx;
	// A word-like caret token is the partial segment being typed — the chain sits before it.
	if (toks[i] && /^\w/.test(toks[i]!.text)) i = prev(i);
	// `i` is now the DOT itself (partial-segment case) or the caret slot (then look back one).
	let d = toks[i]?.text === "." ? i : prev(i);
	const parts: string[] = [];
	let anchorIdx = d;
	while (d >= 0 && toks[d]?.text === ".") {
		const ident = prev(d);
		if (ident < 0 || !/^[\w"`[\]]/.test(toks[ident]!.text)) break;
		parts.unshift(toks[ident]!.text);
		anchorIdx = prev(ident);
		d = anchorIdx;
	}
	return { parts, anchorIdx };
}

/** The CTE names visible from the caret's enclosing scope, as declared (display text), each with its
 *  declaration span (`CteDef.nameCst`, falling back to the whole `CteDef.cst`) — the same span
 *  `SqlDocument.unionCtes` keys its own per-CTE aggregation on, so a `decorate` hook can pin "12
 *  columns" to the right declaration even when a nested scope shadows the name. */
function visibleCteNames(
	scopes: ScopeTree,
	ast: QueryExpr,
	offset: number,
): { name: string; declarationSpan?: PartSpan }[] {
	const scope = enclosingScope(scopes, ast, offset);
	const out: { name: string; declarationSpan?: PartSpan }[] = [];
	for (let s = scope; s; s = s.parent) {
		for (const cte of s.ctes.values()) {
			out.push({ name: cte.def.name, declarationSpan: partSpanOf(cte.def.nameCst ?? cte.def.cst) });
		}
	}
	return out;
}

/** The walk's caret token index. Two rules, in order (anvil 2026-07-15; antlr4-c3's own caret
 *  convention):
 *   1. the token being TYPED — a word-like token whose span CONTAINS the caret (start < offset <=
 *      end). A caret at the end of `ifn` completes `ifn`; it does not mean the slot is filled.
 *      Word-like OR a delimited identifier token (cfg.nameTokens: `` `a` ``/`"a"`/`[a]`) counts too —
 *      without it, a caret inside a quoted identifier fell through to rule 2 and reported the
 *      position of whatever token happened to follow it. Punctuation is never partially typed,
 *      so `abs(|` keeps rule 2.
 *   2. between tokens — the first default-channel token whose `.start >= offset`; for an
 *      end-of-input caret that is the EOF sentinel's index (last entry).
 *  `toks` is the document's own token stream (doc coordinates) with the EOF sentinel appended.
 *  Source order makes one pass sufficient: a containing token starts before any `.start >= offset`
 *  token, so rule 1 fires first whenever it applies. */
function caretTokenIndex(toks: readonly WalkTok[], offset: number, cfg: CompletionConfig): number {
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (!t || t.channel !== Token.DEFAULT_CHANNEL) continue;
		const wordLike = /^\w/.test(t.text) || cfg.nameTokens.has(t.type);
		if (wordLike && t.start < offset && offset <= t.start + t.text.length) return i;
		if (t.start >= offset) return i;
	}
	return toks.length - 1; // EOF
}

/** A candidate token type → a keyword label, or undefined if it is punctuation/operator or has no
 *  literal name. The grammar literal is single-quoted (`"'FROM'"`); strip the quotes and keep it
 *  only when it starts with a letter/underscore. */
function keywordLabel(vocabulary: Vocabulary, type: number): string | undefined {
	const literal = vocabulary.getLiteralName(type);
	if (!literal) return undefined;
	const unquoted = literal.startsWith("'") && literal.endsWith("'") ? literal.slice(1, -1) : literal;
	return /^[A-Za-z_]/.test(unquoted) ? unquoted : undefined;
}

function intersects(a: Set<number>, b: Set<number>): boolean {
	if (b.size === 0) return false;
	for (const x of a) if (b.has(x)) return true;
	return false;
}

/**
 * Broken-input FROM-relation fallback. The grammar reads a mid-edit `SELECT <caret> FROM t` as
 * `SELECT FROM AS t` (FROM is a non-reserved identifier in Spark), so the document's scope has no
 * `t` source and scope-based columns come back empty. To still offer the FROM relation's columns,
 * scan the token stream for `<relationKeyword> <name>` (FROM/JOIN followed by an identifier) and
 * surface those tables' schema columns. Token-driven, so it survives the mis-parse; gated by config
 * token sets, so the core stays dialect-neutral. A `{{ ref('orders') }}` FROM source blanks to a
 * placeholder identifier, so that name token is resolved through the template provider first (see
 * `columnsForName`), then the same schema lookup a plain table gets.
 */
function fromRelationColumns(
	walkTokens: readonly WalkTok[],
	cfg: CompletionConfig,
	schema: SchemaProvider,
	dialect: string | undefined,
	tags: readonly TagNode[] | undefined,
	text: string,
): Completion[] {
	if (cfg.relationKeywordTokens.size === 0) return [];
	// Default-channel tokens only: hidden whitespace/comments sit between FROM and the name.
	const toks = walkTokens.filter((t) => t.channel === Token.DEFAULT_CHANNEL);
	const out: Completion[] = [];
	const emit = (cols: Column[] | undefined): void => {
		if (cols) for (const c of cols) out.push({ label: c.name, kind: "column", detail: c.type });
	};
	for (let i = 0; i + 1 < toks.length; i++) {
		const kw = toks[i];
		const next = toks[i + 1];
		if (!kw || !next) continue;
		if (!cfg.relationKeywordTokens.has(kw.type)) continue;
		// A templated source ({{ ref('orders') }}) blanks to a channel-2 tag the walk skips, so it sits
		// in the gap between the relation keyword and the next SQL token (the alias, or the next clause).
		// Resolve it through the provider: relationOf(call) -> name, then its columns come from the
		// relation answer or the same schema.columnsFor a plain table gets. A plain schema / the neutral
		// provider resolves nothing for it, so it contributes no fabricated columns.
		const tag = tags?.find(
			(t): t is Extract<TagNode, { kind: "call" }> =>
				t.kind === "call" && t.tagSpan.start >= kw.start && t.tagSpan.start < next.start,
		);
		if (tag && schema instanceof DefaultTemplateProvider) {
			const rel = schema.relationOf(callOf(tag, text));
			emit(rel ? (rel.columns ?? schema.columnsFor(rel.nameParts, dialect)) : undefined);
			continue;
		}
		// Plain table: the next SQL token is the relation name.
		if (cfg.nameTokens.has(next.type)) emit(schema.columnsFor([next.text ?? ""], dialect));
	}
	return out;
}

/** The columns of the ONE source a dotted qualifier matches from the caret's scope (anvil item 2):
 *  `o.|` answers o's columns only. Matching is sourcesMatchingQualifier — the same validated,
 *  any-depth primitive column BINDING uses — walking enclosing scopes nearest-first. Ambiguous or
 *  unmatched qualifiers answer nothing (never a fabricated union). `source` rides along (the matched
 *  ResolvedSource, when exactly one matched) so the caller can attach it as the column candidates'
 *  structural identity. */
function qualifiedSourceColumns(
	scopes: ScopeTree,
	ast: QueryExpr,
	offset: number,
	qualParts: string[],
	dialect: string,
	schema?: SchemaProvider,
): { items: Completion[]; source?: ResolvedSource } {
	const scope = enclosingScope(scopes, ast, offset);
	if (!scope) return { items: [] };
	const behavior = resolveBehavior(dialect);
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const matches = sourcesMatchingQualifier(s, qualParts);
		if (matches.length > 1) return { items: [] };
		if (matches.length === 1) {
			const source = matches[0]!;
			return {
				items: columnsOf(source, dialect, schema).map((c) => ({ ...c, label: behavior.displayName(c.label) })),
				source,
			};
		}
	}
	return { items: [] };
}

/** The member-position twin of `fromRelationColumns` (#38): when the scope is empty (the dangling
 *  dot broke the FROM parse), read `FROM/JOIN name(.name)* [AS] [alias]` off the token stream and
 *  answer the columns of the ONE relation the qualifier matches — the alias when present, else the
 *  name's own trailing parts. A templated source ({{ ref() }} c) is resolved through the provider
 *  (relationOf), matching the qualifier to its alias — the same seam `fromRelationColumns` uses. No
 *  match (or several) answers [] — never a fabricated union. */
function qualifiedFallbackColumns(
	walkTokens: readonly WalkTok[],
	cfg: CompletionConfig,
	qualParts: string[],
	schema: SchemaProvider,
	dialect: string | undefined,
	tags: readonly TagNode[] | undefined,
	text: string,
): Completion[] {
	if (cfg.relationKeywordTokens.size === 0) return [];
	const b = resolveBehavior(dialect);
	const toks = walkTokens.filter((t) => t.channel === Token.DEFAULT_CHANNEL);
	const hits: Completion[][] = [];
	const colHits = (cols: Column[] | undefined): void => {
		if (cols) hits.push(cols.map((c) => ({ label: c.name, kind: "column" as const, detail: c.type })));
	};
	for (let i = 0; i + 1 < toks.length; i++) {
		if (!cfg.relationKeywordTokens.has(toks[i]!.type)) continue;
		// A templated source ({{ ref('customers') }} c) blanks to a channel-2 tag the filter drops, so
		// the next SQL token is the ALIAS, not a relation name. Resolve the relation through the provider
		// (relationOf) — the same seam fromRelationColumns uses — and match the qualifier to that alias;
		// without this, the alias got read AS the relation name and columnsFor answered nothing.
		const kw = toks[i]!;
		const next = toks[i + 1]!;
		const tag = tags?.find(
			(t): t is Extract<TagNode, { kind: "call" }> =>
				t.kind === "call" && t.tagSpan.start >= kw.start && t.tagSpan.start < next.start,
		);
		if (tag) {
			if (schema instanceof DefaultTemplateProvider) {
				let a = i + 1;
				if (toks[a] && b.fold(toks[a]!.text) === "as") a++;
				const alias = toks[a];
				if (
					alias &&
					cfg.nameTokens.has(alias.type) &&
					qualParts.length === 1 &&
					b.fold(qualParts[0]!) === b.fold(alias.text)
				) {
					const rel = schema.relationOf(callOf(tag, text));
					colHits(rel ? (rel.columns ?? schema.columnsFor(rel.nameParts, dialect)) : undefined);
				}
			}
			continue; // templated source handled (or unresolvable) — never treat the alias as a relation name
		}
		let j = i + 1;
		if (!toks[j] || !cfg.nameTokens.has(toks[j]!.type)) continue;
		const parts = [toks[j]!.text];
		j++;
		while (toks[j]?.text === "." && toks[j + 1] && cfg.nameTokens.has(toks[j + 1]!.type)) {
			parts.push(toks[j + 1]!.text);
			j += 2;
		}
		let alias: string | undefined;
		if (toks[j] && b.fold(toks[j]!.text) === "as" && toks[j + 1] && cfg.nameTokens.has(toks[j + 1]!.type)) j++;
		if (toks[j] && cfg.nameTokens.has(toks[j]!.type)) alias = toks[j]!.text;
		const matches = alias
			? qualParts.length === 1 && b.fold(qualParts[0]!) === b.fold(alias)
			: qualParts.length <= parts.length &&
				qualParts.every(
					(p, k) => b.fold(p, "table") === b.fold(parts[parts.length - qualParts.length + k]!, "table"),
				);
		if (!matches) continue;
		colHits(schema.columnsFor(parts, dialect));
	}
	return hits.length === 1 ? hits[0]! : [];
}

/** The columns visible from the scope enclosing `offset` (a CELL-relative offset into `scopes`).
 *  Derived sources / CTEs expose their own output column names; base-table sources get their columns
 *  (and types) from the schema. Each item rides alongside the ResolvedSource it came from — the
 *  column candidate's structural identity (a `decorate` hook's "source relation"). */
function visibleColumns(
	scopes: ScopeTree,
	ast: QueryExpr,
	dialect: string,
	offset: number,
	schema?: SchemaProvider,
): { completion: Completion; source: ResolvedSource }[] {
	const scope = enclosingScope(scopes, ast, offset);
	if (!scope) return [];
	const behavior = resolveBehavior(dialect);
	const out: { completion: Completion; source: ResolvedSource }[] = [];
	const seen = new Set<string>();
	for (const src of scope.sources.values()) {
		for (const col of columnsOf(src, dialect, schema)) {
			// Dedup by folded IDENTITY (quoted/unquoted twins collapse); labels render via displayName.
			const key = behavior.fold(col.label);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ completion: { ...col, label: behavior.displayName(col.label) }, source: src });
		}
	}
	return out;
}

/** The scope owning `offset`: the IR node's scope if one covers it, else the deepest scope whose
 *  body CST span covers the offset, else the root. `offset` is relative to `scopes`/`ast`. */
function enclosingScope(scopes: ScopeTree, ast: QueryExpr, offset: number): Scope | undefined {
	const hit = nodeAt(scopes, offset, ast)?.scope;
	if (hit) return hit;
	return deepestScopeAt(scopes, offset) ?? scopes.root;
}

/** The deepest scope whose `body.cst` source span covers `offset`. */
function deepestScopeAt(tree: ScopeTree, offset: number): Scope | undefined {
	let best: Scope | undefined;
	let bestSpan = Number.MAX_SAFE_INTEGER;
	const visit = (scope: Scope): void => {
		const cst = scope.body.cst;
		const start = cst?.start;
		const stop = cst?.stop ?? cst?.start;
		if (start && stop && start.start <= offset && offset <= stop.stop) {
			const span = stop.stop - start.start;
			if (span <= bestSpan) {
				best = scope;
				bestSpan = span;
			}
		}
		for (const child of scope.children) visit(child);
	};
	visit(tree.root);
	return best;
}

/** The completion items for one visible source's columns. Derived sources (CTE / subquery / pipe
 *  relation / lateral) carry their output column names directly; a base table's columns come from
 *  the schema (with types as `detail`). A source whose columns aren't determinable contributes none. */
function columnsOf(src: ResolvedSource, dialect: string, schema?: SchemaProvider): Completion[] {
	if (src.kind === "table") {
		// Declared column aliases win; otherwise look the table up in the schema (names + types).
		const declared = src.source.columnAliases;
		if (declared) return declared.map((name) => ({ label: name, kind: "column" as const }));
		const cols = schema?.columnsFor(src.name, dialect);
		return (cols ?? []).map((c) => ({ label: c.name, kind: "column" as const, detail: c.type }));
	}
	const names = derivedOutputs(src);
	return names === "unknown" ? [] : names.map((name) => ({ label: name, kind: "column" as const }));
}

/** Output column names of a non-table source, or "unknown" when they need a schema we lack. */
function derivedOutputs(src: Exclude<ResolvedSource, { kind: "table" }>): string[] | "unknown" {
	switch (src.kind) {
		case "cte":
			return src.ref.scope.outputs;
		case "subquery":
		case "relation":
		case "graphtable":
			return src.scope.outputs;
		case "lateral":
			return src.source.columns;
		case "pivot":
			// Schema-fed reshape — without a column resolver here it stays unknown for completion.
			return "unknown";
	}
}
