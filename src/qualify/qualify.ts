import type { ParserRuleContext } from "antlr4ng";
import { foldIdentifier, matchesSourceKey } from "../ident/fold.js";
import type { ColumnRef } from "../ir/ir.js";
import {
	applyPivotCols,
	applyStarModifiers,
	applyUnpivotCols,
	mergeByName,
	pivotSourceOutputs,
	resolveColumn,
	splitColumnRefInScope,
	type ResolvedSource,
	type Scope,
	type ScopeTree,
} from "../scope/scope.js";
import { endPosition } from "../ir/span.js";
import { inferType } from "../infer/infer.js";
import { type SchemaSource } from "./schema-source.js";

// ---------------------------------------------------------------------------
// Qualify — the schema-fed layer over the scope tree. It resolves what scope
// could not without a catalog: it expands `*` into explicit columns and reports
// diagnostics (today: unknown table). Schema-free resolution already happened in
// scope; qualify only fills the schema-dependent gaps. No SQL is rewritten.
// ---------------------------------------------------------------------------

export interface Diagnostic {
	kind: "unknown-table" | "unknown-column" | "ambiguous-column" | "unknown-field";
	message: string;
	/** Start of the offending node: 1-based line, 0-based column. */
	line: number;
	column: number;
	/** End of the offending node (one past the last char): 1-based line, 0-based column.
	 *  Same convention as `Span` in src/symbols/symbols.ts, so rangeFromSpan works on it. */
	endLine: number;
	endColumn: number;
}

export interface Qualification {
	diagnostics: Diagnostic[];
	/** Resolved output columns of a scope (stars expanded), or "unknown". */
	columnsOf(scope: Scope): string[] | "unknown";
}

export function qualify(tree: ScopeTree, schema: SchemaSource): Qualification {
	const diagnostics: Diagnostic[] = [];
	const resolved = new Map<Scope, string[] | "unknown">();

	// Post-order: a scope's columns (and their types) may depend on its CTE/subquery children. A pipe
	// stage depends on the scope of the relation entering it (a sibling), also visited first by order.
	const visit = (scope: Scope): void => {
		for (const child of scope.children) visit(child);
		resolved.set(scope, resolveColumns(scope, schema, resolved, diagnostics));
		for (const ref of bodyColumns(scope)) checkColumn(scope, ref, schema, resolved, diagnostics);
	};
	visit(tree.root);

	return {
		diagnostics,
		columnsOf: (scope) => resolved.get(scope) ?? "unknown",
	};
}

/** Column references this scope checks directly — a select/setop body's own refs. A pipe scope holds
 *  none (its refs live in its per-stage child scopes, each a synthetic select carrying its own refs). */
function bodyColumns(scope: Scope): ColumnRef[] {
	const body = scope.body;
	if (body.kind === "pipe") return [];
	return body.columns;
}

function resolveColumns(
	scope: Scope,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
): string[] | "unknown" {
	if (scope.pipeStage) return resolvePipeStage(scope, schema, resolved, diagnostics);
	const body = scope.body;
	if (body.kind === "pipe") {
		const last = scope.pipe?.stages.at(-1) ?? scope.pipe?.input;
		return last ? (resolved.get(last) ?? "unknown") : "unknown";
	}
	if (body.kind === "setop") {
		if (!scope.branches) return "unknown";
		const left = resolved.get(scope.branches.left) ?? "unknown";
		if (!body.byName) return left;
		return mergeByName(left, resolved.get(scope.branches.right) ?? "unknown", scope.dialect);
	}
	// A PIVOT/UNPIVOT that transforms the select directly (Spark/BigQuery — no result alias) reshapes the
	// FROM relation's columns: expand the sources, then apply the transform. (The T-SQL aliased form is a
	// synthetic source registered in scope; it expands via the normal star path.)
	if (body.pivot && !body.pivot.alias) {
		const base = expandStar(scope, schema, resolved, diagnostics, undefined);
		return base === undefined ? "unknown" : applyPivotCols(base, body.pivot, scope.dialect);
	}
	if (body.unpivot && !body.unpivot.alias) {
		const base = expandStar(scope, schema, resolved, diagnostics, undefined);
		return base === undefined ? "unknown" : applyUnpivotCols(base, body.unpivot, scope.dialect);
	}
	return projectionColumns(scope, body.projections, schema, resolved, diagnostics);
}

/** Resolve a projection list to output names: a star expands against the scope's sources (its modifiers
 *  applied), a named/aliased item keeps its name, an anonymous expression makes the set "unknown". */
function projectionColumns(
	scope: Scope,
	projections: import("../ir/ir.js").Projection[],
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
): string[] | "unknown" {
	const out: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			const star = p.expr.kind === "star" ? p.expr : undefined;
			let cols = expandStar(scope, schema, resolved, diagnostics, star?.qualifier);
			if (cols === undefined) return "unknown";
			if (star) cols = applyStarModifiers(cols, star, scope.dialect);
			out.push(...cols);
		} else if (p.name !== undefined) {
			out.push(p.name);
		} else {
			return "unknown"; // anonymous expression — not nameable without modelling it
		}
	}
	return out;
}

/** Output columns of a pipe stage given the schema-resolved incoming columns. Mirrors the schema-free
 *  flow in scope.ts, but resolves stars / a JOINed table's columns against the catalog. */
function resolvePipeStage(
	scope: Scope,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
): string[] | "unknown" {
	const stage = scope.pipeStage!;
	const incoming = scope.pipeIncoming ? (resolved.get(scope.pipeIncoming) ?? "unknown") : "unknown";
	switch (stage.op) {
		case "select":
			return projectionColumns(scope, stage.projections, schema, resolved, diagnostics);
		case "extend":
		case "window": {
			if (incoming === "unknown") return "unknown";
			const added = projectionColumns(scope, stage.projections, schema, resolved, diagnostics);
			return added === "unknown" ? "unknown" : [...incoming, ...added];
		}
		case "aggregate": {
			const aggs = projectionColumns(scope, stage.aggregates, schema, resolved, diagnostics);
			if (aggs === "unknown") return "unknown";
			const keys: string[] = [];
			for (const g of stage.groupBy) {
				if (g.kind === "column") keys.push(g.parts[g.parts.length - 1]);
				else return "unknown";
			}
			return [...aggs, ...keys];
		}
		case "drop": {
			const fold = (n: string) => foldIdentifier(n, scope.dialect);
			return incoming === "unknown"
				? "unknown"
				: incoming.filter((c) => !stage.drop.some((d) => fold(d) === fold(c)));
		}
		case "rename": {
			if (incoming === "unknown") return "unknown";
			const fold = (n: string) => foldIdentifier(n, scope.dialect);
			const map = new Map(stage.renames.map((r) => [fold(r.from), r.to]));
			return incoming.map((c) => map.get(fold(c)) ?? c);
		}
		case "join": {
			if (incoming === "unknown") return "unknown";
			const joinSrc = [...scope.sources.entries()].find(([k]) => k !== "")?.[1];
			const joinCols = joinSrc
				? columnsOfSource(joinSrc, schema, resolved, diagnostics, scope.dialect)
				: undefined;
			return joinCols === undefined ? "unknown" : [...incoming, ...joinCols];
		}
		case "where":
		case "orderBy":
		case "limit":
		case "distinct":
		case "tablesample":
		case "assert":
		case "log":
		case "staticDescribe":
		case "with":
		case "set":
		case "setop":
		case "recursiveUnion":
			return incoming;
		default:
			// call / pivot / unpivot / matchRecognize / describe / if / fork / tee / export / create /
			// insert / other — needs a catalog or is terminal/branching: unknown.
			return "unknown";
	}
}

function expandStar(
	scope: Scope,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	qualifier?: string[],
): string[] | undefined {
	// A qualified star `t.*` expands only the source keyed by `t` (its last name part); a bare
	// `*` expands every source in order.
	const want = qualifier ? (qualifier[qualifier.length - 1] ?? "") : undefined;
	const cols: string[] = [];
	let matched = false;
	for (const [key, src] of scope.sources) {
		if (want !== undefined && !matchesSourceKey(key, want, scope.dialect)) continue;
		// A pseudo-column source (Snowflake/Oracle CONNECT BY's LEVEL) resolves by name but is
		// excluded from a bare `*` — real pseudo-column semantics. A qualified star can't target
		// it anyway (it has no alias to qualify by), so this only affects the bare-`*` case.
		if (want === undefined && src.kind === "lateral" && src.source.pseudo) continue;
		matched = true;
		const srcCols = columnsOfSource(src, schema, resolved, diagnostics, scope.dialect);
		if (srcCols === undefined) return undefined;
		cols.push(...srcCols);
	}
	if (want !== undefined && !matched) return undefined; // qualified star naming no visible source
	return cols;
}

/** The output column names of a source — schema for a table (reporting unknown-table if absent),
 *  the resolved child names for a CTE/subquery (column aliases rename them), the AS columns for a
 *  lateral view. Types are not threaded here; type inference (src/infer) owns types. */
function columnsOfSource(
	src: ResolvedSource,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		if (src.source.columnAliases) return src.source.columnAliases;
		const cols = schema.columnsFor(src.name, dialect);
		if (!cols) {
			diagnostics.push(unknownTable(src.name, src.source.cst));
			return undefined;
		}
		return cols.map((c) => c.name);
	}
	if (src.kind === "cte") return src.ref.def.columnAliases ?? known(resolved.get(src.ref.scope));
	if (src.kind === "lateral") return src.source.columns;
	if (src.kind === "relation") return known(resolved.get(src.scope));
	if (src.kind === "graphtable") return known(resolved.get(src.scope));
	if (src.kind === "pivot") {
		return known(
			pivotSourceOutputs(src, (s) => columnsOfSource(s, schema, resolved, diagnostics, dialect) ?? "unknown"),
		);
	}
	return src.source.columnAliases ?? known(resolved.get(src.scope));
}

function known(r: string[] | "unknown" | undefined): string[] | undefined {
	return r === undefined || r === "unknown" ? undefined : r;
}

/**
 * Verify a column reference against the schema-resolved sources (walking enclosing scopes
 * for correlation). Conservative: a diagnostic fires only when a source's columns are
 * actually known and the column is missing/ambiguous — never merely because a schema is absent.
 */
function checkColumn(
	scope: Scope,
	ref: ColumnRef,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
): void {
	// A bare name in GROUP BY/HAVING/ORDER BY (incl. after a UNION) may reference a SELECT alias
	// rather than a column — don't flag it. resolveColumn applies the alias + precedence rules.
	if (resolveColumn(scope, ref).kind === "alias") return;

	// Split off struct/field navigation: `t.c.f` checks the column `c`, then walks the field
	// path `f` against `c`'s struct type — resolved from a table schema or threaded through a
	// derived (CTE/subquery) column; see checkFieldPath.
	const split = splitColumnRefInScope(scope, ref.parts);
	const name = foldIdentifier(split.column, scope.dialect);

	if (split.qualifier !== undefined) {
		for (let s: Scope | undefined = scope; s; s = s.parent) {
			const src = s.sources.get(split.qualifier);
			if (!src) continue;
			const cols = sourceColumns(src, schema, resolved, s.dialect);
			if (cols && !cols.some((c) => foldIdentifier(c, s.dialect) === name)) {
				diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${ref.parts.join(".")}`));
				return; // base column missing — don't also walk its (nonexistent) fields
			}
			checkFieldPath(split.fields, scope, schema, ref, diagnostics);
			return; // qualifier resolved (or columns unknown) — done
		}
		return; // qualifier visible but not found in this chain — defensive; don't flag
	}

	// Unqualified: the innermost scope with a known match wins; ambiguous if several here.
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const sources = [...s.sources.values()];
		if (sources.length === 0) continue;
		let matches = 0;
		let unknown = 0;
		for (const src of sources) {
			const cols = sourceColumns(src, schema, resolved, s.dialect);
			if (!cols) unknown++;
			else if (cols.some((c) => foldIdentifier(c, s.dialect) === name)) matches++;
		}
		if (matches > 1) {
			diagnostics.push(columnDiag("ambiguous-column", ref, `Ambiguous column: ${split.column}`));
			return;
		}
		if (matches === 1) {
			checkFieldPath(split.fields, scope, schema, ref, diagnostics);
			return;
		}
		if (unknown > 0) return; // might live in a source whose columns we don't know
		// all sources here known, none has it — try an enclosing scope (correlation)
	}
	// The message shows the reference as WRITTEN (display), never the folded identity key.
	diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${split.column}`));
}

/**
 * Validate a struct/field path (`addr.city`, `a.b.c`) against the base column's *inferred* type.
 * inferType resolves the base column — the schema for a base table, the producing projection for
 * a derived column, the function for a computed one — so field access on a computed column is
 * checked too. Conservative: a field is flagged only when its parent is a known struct that lacks
 * it; an unknown or non-struct (array/map/primitive) type stops the walk without flagging.
 */
function checkFieldPath(
	fields: string[],
	scope: Scope,
	schema: SchemaSource,
	ref: ColumnRef,
	diagnostics: Diagnostic[],
): void {
	if (fields.length === 0) return;
	const baseParts = ref.parts.slice(0, ref.parts.length - fields.length);
	let type = inferType({ kind: "column", parts: baseParts, cst: ref.cst }, scope, schema);
	for (const field of fields) {
		if (type.kind !== "struct") return; // unknown / non-struct — don't flag
		// Struct-field names on a Type are stored FOLDED (parseType folds them at parse time), so
		// only the reference side folds here — re-folding a preserved-case stored name would corrupt it.
		const hit = type.fields.find((f) => f.name === foldIdentifier(field, scope.dialect));
		if (!hit) {
			diagnostics.push(columnDiag("unknown-field", ref, `Unknown field: ${ref.parts.join(".")}`));
			return;
		}
		type = hit.type;
	}
}

/** Schema-resolved column names of a source, or undefined when unknown (needs a catalog). */
function sourceColumns(
	src: ResolvedSource,
	schema: SchemaSource,
	resolved: Map<Scope, string[] | "unknown">,
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		if (src.source.columnAliases) return src.source.columnAliases;
		return schema.columnsFor(src.name, dialect)?.map((c) => c.name);
	}
	if (src.kind === "cte") return src.ref.def.columnAliases ?? known(resolved.get(src.ref.scope));
	if (src.kind === "lateral") return src.source.columns;
	if (src.kind === "relation") return known(resolved.get(src.scope));
	if (src.kind === "graphtable") return known(resolved.get(src.scope));
	if (src.kind === "pivot")
		return known(pivotSourceOutputs(src, (s) => sourceColumns(s, schema, resolved, dialect) ?? "unknown"));
	return src.source.columnAliases ?? known(resolved.get(src.scope));
}

/** Full positioned span of a CST node — 1-based line, 0-based column, endColumn one past the last
 *  char (falls back to the start token when stop is absent). Mirrors symbols.ts `spanOf`, plus a
 *  stop-absent start-fallback (per spec A8); both route the load-bearing end math through the shared
 *  `endPosition` helper (multi-line-stop-token aware), so rangeFromSpan agrees on both. */
function spanOf(cst: ParserRuleContext): { line: number; column: number; endLine: number; endColumn: number } {
	const s = cst.start;
	const e = cst.stop ?? cst.start;
	const end = endPosition(e?.line ?? s?.line ?? 0, e?.column ?? 0, e?.text ?? "");
	return {
		line: s?.line ?? 0,
		column: s?.column ?? 0,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

function columnDiag(kind: Diagnostic["kind"], ref: ColumnRef, message: string): Diagnostic {
	return { kind, message, ...spanOf(ref.cst) };
}

function unknownTable(name: string[], cst: ParserRuleContext): Diagnostic {
	return { kind: "unknown-table", message: `Unknown table: ${name.join(".")}`, ...spanOf(cst) };
}
