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
import type { SqlDocument } from "../document/document.js";
import { nodeAt } from "../document/node-at.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { QueryExpr } from "../ir/ir.js";
import type { Column } from "../qualify/schema.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { DefaultTemplateProvider } from "../qualify/template-provider.js";
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

/** One completion candidate. The editor filters this list by the typed prefix and applies the
 *  chosen label at the caret; we only produce the labels, anchored at the caret offset. The
 *  `"template"` kind is a host candidate for a jinja call slot (a dbt model for a ref's arg). */
export interface Completion {
	label: string;
	kind: "keyword" | "column" | "table" | "cte" | "namespace" | "function" | "template";
	/** Extra display info, e.g. a column's type when the schema knows it. */
	detail?: string;
}

/**
 * Completion candidates for the caret at `offset` in `doc`. Schema-aware when a `Schema` is given
 * (table names + column types). NEVER throws: on broken / mid-edit input it still returns the
 * keyword candidates the walk can reach.
 */
export function completeAt(doc: SqlDocument, offset: number, schema?: SchemaProvider): Completion[] {
	try {
		return collect(doc, offset, schema);
	} catch (e) {
		// Total by contract: a walk/parse hiccup must not surface to the editor.
		if (process.env.SQLLENS_DEBUG_COMPLETE) throw e;
		return [];
	}
}

/** @deprecated Use completeAt — same function, uniform cursor-verb naming. */
export const complete = completeAt;

function collect(doc: SqlDocument, offset: number, schema?: SchemaProvider): Completion[] {
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
		if (slot) return templateCompletions(slot, schema);
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
	const caretIdx = caretTokenIndex(walkTokens, offset);
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
	const add = (c: Completion): void => {
		const key = `${c.kind}\0${c.label}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(c);
	};

	// keywords — from candidate token types whose grammar literal is a word.
	for (const type of cand.tokens) {
		const label = keywordLabel(meta.vocabulary, type);
		if (label) add({ label, kind: "keyword" });
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
			for (const child of schema.childrenOf(path.parts, dialect)) add({ label: child.name, kind: child.kind });
		}
	} else if (path.parts.length > 0) {
		// A qualified MEMBER position (`o.|`, `gold.orders.|`) — anvil item 2: only the columns of
		// the source the qualifier matches (the same validated any-depth primitive binding uses),
		// no function/keyword noise. Deliberately NOT gated on the walk's rules: at a dangling dot
		// mid-edit the walk often reports nothing, but the dot chain itself is the member-position
		// evidence (it is the completion trigger character), and an unmatched qualifier answers [].
		const scoped = qualifiedSourceColumns(cellScopes, cellAst, cellOffset, path.parts, dialect, schema);
		for (const c of scoped) add(c);
		// Mid-edit the dangling dot often breaks the FROM parse and the scope is EMPTY — the same
		// failure the bare-slot fallback covers. Its member twin: read `FROM/JOIN name [alias]`
		// pairs off the token stream and answer the matching relation's schema columns.
		if (scoped.length === 0 && schema) {
			const fallback = qualifiedFallbackColumns(
				walkTokens,
				cfg,
				path.parts,
				schema,
				dialect,
				doc.templated?.tags,
				doc.text,
			);
			for (const c of fallback) add(c);
		}
	} else {
		if (atTable) {
			// Bare relation slot: in-scope CTE names FIRST (they shadow same-named catalog tables),
			// then the catalog's tables.
			for (const name of visibleCteNames(cellScopes, cellAst, cellOffset)) add({ label: name, kind: "cte" });
			if (schema) for (const t of schema.tables(dialect)) add({ label: t, kind: "table" });
		}
		// columns — value/column slot: the columns visible from the enclosing scope, plus a
		// broken-input fallback reading FROM/JOIN relation names straight off the token stream.
		if (atColumn) {
			for (const c of visibleColumns(cellScopes, cellAst, dialect, cellOffset, schema)) add(c);
			if (schema)
				for (const c of fromRelationColumns(walkTokens, cfg, schema, dialect, doc.templated?.tags, doc.text))
					add(c);
			// functions — value/column slot: the dialect's inference-registry function names.
			for (const fn of Object.keys(resolveBehavior(dialect).functions)) add({ label: fn, kind: "function" });
		}
	}

	return out;
}

/** The host's candidates for a jinja call slot, as completions. The template provider carries them,
 *  so this reads the `schema` when it is one (a DbtTemplateProvider IS a SchemaProvider, and the host
 *  already passes it here for column/table completion); the neutral provider offers none. A jinja slot
 *  with no candidates still returns [], never SQL keywords, so a caret inside a tag never leaks SQL
 *  completion. */
function templateCompletions(slot: JinjaSlot, schema?: SchemaProvider): Completion[] {
	if (!(schema instanceof DefaultTemplateProvider)) return [];
	return schema.templateCandidates(slot.call, slot.argIndex).map((c) => ({
		label: c.label,
		kind: "template" as const,
		...(c.detail !== undefined ? { detail: c.detail } : {}),
	}));
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

/** The CTE names visible from the caret's enclosing scope, as declared (display text). */
function visibleCteNames(scopes: ScopeTree, ast: QueryExpr, offset: number): string[] {
	const scope = enclosingScope(scopes, ast, offset);
	const out: string[] = [];
	for (let s = scope; s; s = s.parent) for (const cte of s.ctes.values()) out.push(cte.def.name);
	return out;
}

/** The walk's caret token index. Two rules, in order (anvil 2026-07-15; antlr4-c3's own caret
 *  convention):
 *   1. the token being TYPED — a word-like token whose span CONTAINS the caret (start < offset <=
 *      end). A caret at the end of `ifn` completes `ifn`; it does not mean the slot is filled.
 *      Word-like only: punctuation is never partially typed, so `abs(|` keeps rule 2.
 *   2. between tokens — the first default-channel token whose `.start >= offset`; for an
 *      end-of-input caret that is the EOF sentinel's index (last entry).
 *  `toks` is the document's own token stream (doc coordinates) with the EOF sentinel appended.
 *  Source order makes one pass sufficient: a containing token starts before any `.start >= offset`
 *  token, so rule 1 fires first whenever it applies. */
function caretTokenIndex(toks: readonly WalkTok[], offset: number): number {
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (!t || t.channel !== Token.DEFAULT_CHANNEL) continue;
		if (/^\w/.test(t.text) && t.start < offset && offset <= t.start + t.text.length) return i;
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
 *  unmatched qualifiers answer nothing (never a fabricated union). */
function qualifiedSourceColumns(
	scopes: ScopeTree,
	ast: QueryExpr,
	offset: number,
	qualParts: string[],
	dialect: string,
	schema?: SchemaProvider,
): Completion[] {
	const scope = enclosingScope(scopes, ast, offset);
	if (!scope) return [];
	const behavior = resolveBehavior(dialect);
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const matches = sourcesMatchingQualifier(s, qualParts);
		if (matches.length > 1) return [];
		if (matches.length === 1) {
			return columnsOf(matches[0]!, dialect, schema).map((c) => ({ ...c, label: behavior.displayName(c.label) }));
		}
	}
	return [];
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
 *  (and types) from the schema. */
function visibleColumns(
	scopes: ScopeTree,
	ast: QueryExpr,
	dialect: string,
	offset: number,
	schema?: SchemaProvider,
): Completion[] {
	const scope = enclosingScope(scopes, ast, offset);
	if (!scope) return [];
	const behavior = resolveBehavior(dialect);
	const out: Completion[] = [];
	const seen = new Set<string>();
	for (const src of scope.sources.values()) {
		for (const col of columnsOf(src, dialect, schema)) {
			// Dedup by folded IDENTITY (quoted/unquoted twins collapse); labels render via displayName.
			const key = behavior.fold(col.label);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...col, label: behavior.displayName(col.label) });
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
