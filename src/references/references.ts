import type { ParserRuleContext } from "antlr4ng";
import { nodeAt } from "../document/node-at.js";
import { displayName, foldIdentifier, foldTableName } from "../ident/fold.js";
import { endPosition } from "../ir/span.js";
import type { ColumnRef, Expr, QueryExpr } from "../ir/ir.js";
import { originsOf, type Origin } from "../lineage/lineage.js";
import { Schema } from "../qualify/schema.js";
import type { SchemaSource } from "../qualify/schema-source.js";
import { type ResolvedSource, type Scope, type ScopeTree } from "../scope/scope.js";
import { resolveColumnRef, resolveColumnSource } from "../sema/resolve.js";
import type { Span, SymbolKind } from "../symbols/symbols.js";

// ---------------------------------------------------------------------------
// References / occurrence engine — the one new CORE primitive the LSP needs:
// given a cursor offset, find the declaration of the symbol under it and every
// occurrence (reference + declaration) of that SAME symbol across the query.
// Backs LSP references, documentHighlight, codeLens, and (later) rename.
//
// The scope tree has only a FORWARD model (a column resolves to its source); there
// is no reverse index. This builds one on demand: locate the symbol, synthesize a
// STABLE IDENTITY for it (object-identity-based within one tree, or a base-table
// Origin when a schema unifies columns across CTE/subquery boundaries), then walk
// the whole tree binding every column reference and source/CTE name and collecting
// those whose identity matches. Total: never throws; returns null off-symbol.
// ---------------------------------------------------------------------------

export interface Occurrence {
	span: Span;
	role: "declaration" | "reference";
}

export interface Occurrences {
	/** The resolved symbol's name (the column / CTE / alias / table name). */
	symbol: string;
	kind: SymbolKind;
	/** The in-query declaration span, when one exists (a CTE name, an output projection). */
	declaration?: Span;
	/** Every occurrence (references + the declaration), deduped by span. */
	occurrences: Occurrence[];
}

// --- the identity a located symbol keys on ---------------------------------
// Two columns are "the same" when they key the same. We key three ways, in order of
// strength: (1) a base-table Origin (schema-fed — unifies a column across CTE/subquery
// boundaries by its physical t.col); (2) a (ResolvedSource object, column) pair (object
// identity is stable within one tree — the schema-free column key); (3) a (declaring
// Scope, name) pair for a CTE/alias/source NAME.

type Identity =
	| { tag: "origins"; keys: Set<string>; column: string }
	| { tag: "source"; source: ResolvedSource; column: string }
	| { tag: "name"; scope: Scope; name: string };

const originKey = (o: Origin, dialect: string | undefined): string =>
	`${foldTableName(o.table, dialect).join(".")}.${foldIdentifier(o.column, dialect)}`;

/**
 * Find the declaration + every occurrence of the symbol under `offset`. Schema-free works for
 * in-query columns and CTE/alias/source names; a base-table column's cross-boundary identity
 * needs the schema (without it, only the in-query occurrences are returned). Returns null when
 * the cursor is not on a resolvable symbol. Never throws.
 */
export function referencesAt(
	scopes: ScopeTree,
	offset: number,
	schema?: SchemaSource,
	ast?: QueryExpr,
): Occurrences | null {
	try {
		return compute(scopes, offset, schema ?? new Schema({}), ast);
	} catch {
		return null; // total: any internal failure degrades to "no result", never a throw
	}
}

function compute(scopes: ScopeTree, offset: number, schema: SchemaSource, ast?: QueryExpr): Occurrences | null {
	// 1. Prefer a column Expr under the cursor (an actual reference node).
	const hit = nodeAt(scopes, offset, ast);
	if (hit && hit.expr.kind === "column") {
		const ref: ColumnRef = { parts: hit.expr.parts, clause: "projection", cst: hit.expr.cst };
		const id = columnIdentity(hit.scope, ref, schema);
		const raw = hit.expr.parts[hit.expr.parts.length - 1] ?? "";
		if (id) return collectColumn(scopes, id, schema, displayName(raw, scopes.root.dialect));
	}

	// 2. Else: a NAME under the cursor (a CTE name, a source/table name, a source alias). Find the
	//    smallest declaring cst that covers the offset, keyed by its declaring scope.
	const name = nameUnderCursor(scopes, offset);
	if (name) return collectName(scopes, name);

	return null;
}

// --- column identity -------------------------------------------------------

function columnIdentity(scope: Scope, ref: ColumnRef, schema: SchemaSource): Identity | undefined {
	const d = scope.dialect;
	// Schema-fed: a base-table Origin unifies the column across CTE/subquery boundaries.
	const origins = originsOf({ kind: "column", parts: ref.parts, cst: ref.cst }, scope, schema);
	if (origins.length > 0) {
		const last = ref.parts[ref.parts.length - 1];
		return {
			tag: "origins",
			keys: new Set(origins.map((o) => originKey(o, d))),
			column: foldIdentifier(last ?? "", d),
		};
	}
	// Schema-free / no origin: bind to the in-query source and key on (source object, column).
	const bySource = resolveColumnSource(scope, ref.parts, schema) ?? boundColumn(scope, ref);
	if (bySource) return { tag: "source", source: bySource.source, column: foldIdentifier(bySource.column, d) };
	return undefined;
}

/** Schema-free bind via the unified binder, normalized to the (source, column) shape. */
function boundColumn(scope: Scope, ref: ColumnRef): { source: ResolvedSource; column: string } | undefined {
	const r = resolveColumnRef(scope, ref);
	return r.kind === "bound" ? { source: r.source, column: r.column } : undefined;
}

/** True if two column refs (resolved from possibly different scopes) share the target identity. */
function columnMatches(id: Identity, scope: Scope, ref: ColumnRef, schema: SchemaSource): boolean {
	if (id.tag === "name") return false;
	if (id.tag === "origins") {
		const origins = originsOf({ kind: "column", parts: ref.parts, cst: ref.cst }, scope, schema);
		if (origins.length === 0) return false;
		return origins.some((o) => id.keys.has(originKey(o, scope.dialect)));
	}
	// source identity: same ResolvedSource object + same column name
	const b = resolveColumnSource(scope, ref.parts, schema) ?? boundColumn(scope, ref);
	return b !== undefined && b.source === id.source && foldIdentifier(b.column, scope.dialect) === id.column;
}

function collectColumn(scopes: ScopeTree, id: Identity, schema: SchemaSource, symbol: string): Occurrences {
	const occ: Occurrence[] = [];
	const seen = new Set<string>();
	const add = (cst: ParserRuleContext, role: Occurrence["role"]): void => {
		const span = spanOf(cst);
		const key = spanKey(span) + role;
		if (seen.has(key)) return;
		seen.add(key);
		occ.push({ span, role });
	};

	forEachColumnRef(scopes.root, (scope, ref) => {
		if (columnMatches(id, scope, ref, schema)) add(ref.cst, "reference");
	});

	// Declaration: the producing projection in the CTE/subquery whose output column this is.
	const decl = columnDeclaration(scopes.root, id, schema);
	if (decl) add(decl, "declaration");

	return {
		symbol,
		kind: "column",
		declaration: decl ? spanOf(decl) : undefined,
		occurrences: occ,
	};
}

/** The span of the projection (in some scope) that PRODUCES the target column — its declaration. */
function columnDeclaration(root: Scope, id: Identity, schema: SchemaSource): ParserRuleContext | undefined {
	if (id.tag === "name") return undefined;
	const want = id.column;
	let best: ParserRuleContext | undefined;
	const visit = (scope: Scope): void => {
		if (scope.body.kind === "select") {
			for (const p of scope.body.projections) {
				if (p.isStar) continue;
				if (p.name === undefined) continue;
				if (foldIdentifier(p.name, scope.dialect) !== want) continue;
				// This projection produces a column of the target name. Confirm it shares the identity
				// by resolving the projection's own column refs — for `origins` identity check overlap,
				// for `source` identity require the projection to be a bare ref into that source.
				if (projectionMatches(id, scope, p.expr, schema)) {
					best = best ?? p.cst;
				}
			}
		}
		for (const c of scope.children) visit(c);
	};
	visit(root);
	return best;
}

function projectionMatches(id: Identity, scope: Scope, expr: Expr, schema: SchemaSource): boolean {
	if (id.tag === "name") return false;
	if (expr.kind !== "column") {
		// A computed projection of the right NAME still declares the output column for a source-identity
		// match (its source is the CTE/subquery itself), but cannot carry a base-table origin link here.
		return id.tag === "source";
	}
	const ref: ColumnRef = { parts: expr.parts, clause: "projection", cst: expr.cst };
	return columnMatches(id, scope, ref, schema);
}

// --- name (CTE / source / alias) identity ----------------------------------

interface NameHit {
	scope: Scope;
	name: string;
	kind: SymbolKind;
	/** The declaration cst (CTE def, or a source/alias node) covering the cursor. */
	declCst?: ParserRuleContext;
}

/** Find the smallest CTE/source/alias name node whose offset range covers the cursor. */
function nameUnderCursor(scopes: ScopeTree, offset: number): NameHit | undefined {
	let best: NameHit | undefined;
	let bestLen = Number.MAX_SAFE_INTEGER;
	const consider = (
		cst: ParserRuleContext | undefined,
		hit: Omit<NameHit, "declCst"> & { declCst?: ParserRuleContext },
	) => {
		if (!cst) return;
		const r = range(cst);
		if (!r || offset < r.from || offset > r.to) return;
		const len = r.to - r.from;
		if (len < bestLen) {
			bestLen = len;
			best = hit;
		}
	};
	const visit = (scope: Scope): void => {
		// CTE declarations of this scope.
		for (const [, cteRef] of scope.ctes) {
			consider(cteRef.def.cst, { scope, name: cteRef.def.name, kind: "cte", declCst: cteRef.def.cst });
		}
		// Sources visible at this scope (references + their alias declarations).
		for (const src of scope.sources.values()) {
			if (src.kind === "relation" || src.kind === "pivot") continue;
			const sname = sourceName(src);
			if (sname === undefined) continue;
			const skind = sourceKind(src);
			consider(sourceCst(src), { scope, name: sname, kind: skind, declCst: declCstFor(scope, src) });
			const aliasCst = sourceAliasCst(src);
			if (aliasCst)
				consider(aliasCst, { scope, name: aliasName(src) ?? sname, kind: "alias", declCst: aliasCst });
		}
		for (const c of scope.children) visit(c);
	};
	visit(scopes.root);
	return best;
}

/** The declaration cst for a source: a CTE reference declares at the CTE def; others at the source. */
function declCstFor(scope: Scope, src: ResolvedSource): ParserRuleContext | undefined {
	if (src.kind === "cte") return src.ref.def.cst;
	return sourceCst(src);
}

function collectName(scopes: ScopeTree, hit: NameHit): Occurrences {
	const dialect = scopes.root.dialect;
	const target = foldIdentifier(hit.name, dialect);
	const occ: Occurrence[] = [];
	const seen = new Set<string>();
	const add = (cst: ParserRuleContext | undefined, role: Occurrence["role"]): void => {
		if (!cst) return;
		const span = spanOf(cst);
		const key = spanKey(span) + role;
		if (seen.has(key)) return;
		seen.add(key);
		occ.push({ span, role });
	};

	// Declaration: the CTE def, when the symbol is a CTE.
	let declCst: ParserRuleContext | undefined;
	if (hit.kind === "cte" || (hit.declCst && isCteName(scopes.root, target))) {
		declCst = cteDefCst(scopes.root, target);
	} else {
		declCst = hit.declCst; // alias / table — its own declaration site
	}
	if (declCst) add(declCst, "declaration");

	// References: every source whose key matches the target name, across the tree.
	const visit = (scope: Scope): void => {
		for (const src of scope.sources.values()) {
			if (src.kind === "relation" || src.kind === "pivot") continue;
			const n = sourceName(src);
			if (n !== undefined && foldIdentifier(n, dialect) === target) {
				const cst = sourceCst(src);
				// Don't double-count the declaration cst as a reference.
				if (cst && cst !== declCst) add(cst, "reference");
			}
			// An alias use also references the name when the symbol IS the alias.
			if (hit.kind === "alias") {
				const a = aliasName(src);
				if (a !== undefined && foldIdentifier(a, dialect) === target) add(sourceAliasCst(src), "reference");
			}
		}
		for (const c of scope.children) visit(c);
	};
	visit(scopes.root);

	return {
		symbol: displayName(hit.name, dialect),
		kind: hit.kind,
		declaration: declCst ? spanOf(declCst) : undefined,
		occurrences: occ,
	};
}

function isCteName(root: Scope, target: string): boolean {
	return cteDefCst(root, target) !== undefined;
}

function cteDefCst(root: Scope, target: string): ParserRuleContext | undefined {
	let found: ParserRuleContext | undefined;
	const visit = (scope: Scope): void => {
		for (const [name, cteRef] of scope.ctes) {
			// Map keys are already folded; the def name is raw and folds here.
			if (name === target || foldIdentifier(cteRef.def.name, scope.dialect) === target) {
				found = found ?? cteRef.def.cst;
			}
		}
		for (const c of scope.children) visit(c);
	};
	visit(root);
	return found;
}

// --- source-shape helpers (read the ResolvedSource union) -------------------

function sourceName(src: ResolvedSource): string | undefined {
	switch (src.kind) {
		case "table":
			return src.name[src.name.length - 1];
		case "cte":
			return src.ref.def.name;
		case "subquery":
			return src.source.alias;
		case "lateral":
			return src.source.alias;
		case "graphtable":
			return src.source.alias ?? src.source.graph[src.source.graph.length - 1];
		default:
			return undefined;
	}
}

function aliasName(src: ResolvedSource): string | undefined {
	switch (src.kind) {
		case "table":
		case "subquery":
			return src.source.alias;
		case "lateral":
		case "graphtable":
			return src.source.alias;
		default:
			return undefined;
	}
}

function sourceKind(src: ResolvedSource): SymbolKind {
	switch (src.kind) {
		case "table":
			return "table";
		case "cte":
			return "cte";
		case "subquery":
			return "subquery";
		case "lateral":
			return "lateral";
		case "graphtable":
			return "table";
		default:
			return "table";
	}
}

function sourceCst(src: ResolvedSource): ParserRuleContext | undefined {
	switch (src.kind) {
		case "table":
		case "cte":
		case "subquery":
		case "lateral":
		case "graphtable":
			return src.source.cst;
		default:
			return undefined;
	}
}

function sourceAliasCst(src: ResolvedSource): ParserRuleContext | undefined {
	switch (src.kind) {
		case "table":
		case "subquery":
			return src.source.aliasCst;
		case "lateral":
		case "graphtable":
			return src.source.aliasCst;
		default:
			return undefined;
	}
}

// --- walk: every column reference in the tree, with its owning scope --------

function forEachColumnRef(root: Scope, fn: (scope: Scope, ref: ColumnRef) => void): void {
	const visit = (scope: Scope): void => {
		const body = scope.body;
		if (body.kind === "select") {
			for (const ref of body.columns) fn(scope, ref);
		} else if (body.kind === "setop") {
			for (const ref of body.columns) fn(scope, ref);
		}
		// A pipe stage scope carries its stage's columns on the synthetic select body's `columns`
		// (set in scope.ts stageBody), so the select branch above already covers pipe stages.
		for (const c of scope.children) visit(c);
	};
	visit(root);
}

// --- span / offset helpers --------------------------------------------------

function range(cst: ParserRuleContext): { from: number; to: number } | undefined {
	const start = cst.start;
	const stop = cst.stop ?? cst.start;
	if (!start || !stop) return undefined;
	return { from: start.start, to: stop.stop };
}

/** Span (1-based line, 0-based column; end exclusive) of a cst node — same math as symbols.ts. */
function spanOf(cst: ParserRuleContext): Span {
	const s = cst.start;
	const e = cst.stop;
	const end = endPosition(e?.line ?? 0, e?.column ?? 0, e?.text ?? "");
	return {
		line: s?.line ?? 0,
		column: s?.column ?? 0,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

function spanKey(s: Span): string {
	return `${s.line}:${s.column}-${s.endLine}:${s.endColumn}`;
}
