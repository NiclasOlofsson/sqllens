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
import type { SchemaProvider } from "../qualify/schema-provider.js";
import type { ResolvedSource, Scope, ScopeTree } from "../scope/scope.js";
import { collectCandidates } from "./atn-walk.js";
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
 *  chosen label at the caret; we only produce the labels, anchored at the caret offset. */
export interface Completion {
	label: string;
	kind: "keyword" | "column" | "table" | "function";
	/** Extra display info — e.g. a column's type when the schema knows it. */
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
	} catch {
		// Total by contract: a walk/parse hiccup must not surface to the editor.
		return [];
	}
}

/** @deprecated Use completeAt — same function, uniform cursor-verb naming. */
export const complete = completeAt;

function collect(doc: SqlDocument, offset: number, schema?: SchemaProvider): Completion[] {
	const dialect = doc.dialect;
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

	const atTable = intersects(cand.rules, cfg.tableRules);
	const atColumn = intersects(cand.rules, cfg.columnRules);

	// tables — relation-name slot, and only when a schema lists them.
	if (atTable && schema) {
		for (const t of schema.tables(dialect)) add({ label: t, kind: "table" });
	}

	// columns — value/column slot: the columns visible from the enclosing scope, plus a broken-input
	// fallback that reads FROM/JOIN relation names straight off the token stream (the document's batch
	// parse mis-reads a mid-edit `SELECT  FROM t` — see the fallback's comment).
	if (atColumn) {
		for (const c of visibleColumns(cellScopes, cellAst, dialect, cellOffset, schema)) add(c);
		if (schema) for (const c of fromRelationColumns(walkTokens, cfg, schema, dialect)) add(c);
	}

	// functions — value/column slot: the dialect's inference-registry function names.
	if (atColumn) {
		for (const fn of Object.keys(resolveBehavior(dialect).functions)) add({ label: fn, kind: "function" });
	}

	return out;
}

/** The walk's caret token index: the first default-channel token whose `.start >= offset`; for an
 *  end-of-input caret that is the EOF sentinel's index (last entry). Mirrors Task 10's tests' caret
 *  helper. `toks` is the document's own token stream (doc coordinates) with the EOF sentinel appended. */
function caretTokenIndex(toks: readonly WalkTok[], offset: number): number {
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (!t || t.channel !== Token.DEFAULT_CHANNEL) continue;
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
 * Broken-input FROM-relation fallback. The grammar reads a mid-edit `SELECT ‹caret› FROM t` as
 * `SELECT FROM AS t` (FROM is a non-reserved identifier in Spark), so the document's scope has no
 * `t` source and scope-based columns come back empty. To still offer the FROM relation's columns,
 * scan the token stream for `<relationKeyword> <name>` (FROM/JOIN followed by an identifier) and
 * surface those tables' schema columns. Token-driven, so it survives the mis-parse; gated by config
 * token sets, so the core stays dialect-neutral.
 */
function fromRelationColumns(
	walkTokens: readonly WalkTok[],
	cfg: CompletionConfig,
	schema: SchemaProvider,
	dialect?: string,
): Completion[] {
	if (cfg.relationKeywordTokens.size === 0) return [];
	// Default-channel tokens only — hidden whitespace/comments sit between FROM and the name.
	const toks = walkTokens.filter((t) => t.channel === Token.DEFAULT_CHANNEL);
	const out: Completion[] = [];
	for (let i = 0; i + 1 < toks.length; i++) {
		const t = toks[i];
		const n = toks[i + 1];
		if (!t || !n) continue;
		if (!cfg.relationKeywordTokens.has(t.type)) continue;
		if (!cfg.nameTokens.has(n.type)) continue;
		const cols = schema.columnsFor([n.text ?? ""], dialect);
		if (!cols) continue;
		for (const c of cols) out.push({ label: c.name, kind: "column", detail: c.type });
	}
	return out;
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
