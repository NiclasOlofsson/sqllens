import type { ParserRuleContext } from "antlr4ng";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { ColumnRef, Projection, TemplateSourceInfo } from "../ir/ir.js";
import {
	applyPivotCols,
	applyStarModifiers,
	applyUnpivotCols,
	mergeByName,
	pivotSourceOutputs,
	type ResolvedSource,
	type Scope,
	type ScopeTree,
} from "../scope/scope.js";
import { endPosition } from "../ir/span.js";
import { inferType } from "../infer/infer.js";
import { checkCalls } from "./check-calls.js";
import { relationColumns, tableSourceColumns } from "./relation-columns.js";
import type { Column } from "./schema.js";
import { type SchemaProvider } from "./schema-provider.js";
import { resolveColumnRef, resolveColumnSource, type ResolvedColumn } from "../sema/resolve.js";

// ---------------------------------------------------------------------------
// Qualify — the schema-fed layer over the scope tree. It resolves what scope
// could not without a catalog: it expands `*` into explicit columns and reports
// diagnostics (today: unknown table). Schema-free resolution already happened in
// scope; qualify only fills the schema-dependent gaps. No SQL is rewritten.
// ---------------------------------------------------------------------------

export interface Diagnostic {
	kind:
		| "unknown-table"
		| "ambiguous-table"
		| "unknown-column"
		| "ambiguous-column"
		| "unknown-field"
		| "wrong-arity"
		| "wrong-argument-type";
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
	/** The column→source binding for a reference AS IT APPEARS in `scope` — the read-only equivalent of
	 *  a mutating qualifier rewrite (bare `city` → its `ResolvedSource`, not a rewritten `addr.city`).
	 *  Schema-aware: a bare column binds to whichever visible source exposes it, including columns learned
	 *  by expanding a source's `SELECT *` against the schema. `undefined` when the reference doesn't bind
	 *  to a source (unresolved / bare projection-alias / unknown) — never a fabricated binding. `source`
	 *  carries the source kind + base table (the `resolvedTableRef` a consumer needs); `column` is the
	 *  resolved name; `fields` is struct navigation after it. Wraps the shared binder `resolveColumnSource`
	 *  (src/sema/resolve.ts), so infer / lineage / references and this all agree. */
	bindingOf(scope: Scope, ref: ColumnRef): ColumnBinding | undefined;
	/** The ordered {name, sourceKey} pairs a star projection expands to (star modifiers — EXCLUDE/
	 *  ILIKE/RENAME — already applied), or `undefined` when `projection` isn't a star, or when any
	 *  matched source's columns are unknown (never-wrong: no fabricated partial list). `sourceKey`
	 *  is the same fold-normalized key `scope.sources` is keyed by (matches `bindingOf`'s `source`). */
	expandStarOf(scope: Scope, projection: Projection): { name: string; sourceKey: string }[] | undefined;
	/** The columns a single visible source contributes, schema-resolved — or "unknown".
	 *  Read-only and idempotent: never emits diagnostics (the expandStarOf double-diagnosis
	 *  lesson applies — this rides the same internal `resolved` cache qualify already built).
	 *  It never changes any answer either; a lazy CallbackSchema may record misses for a
	 *  later prime(), same as every read path. */
	columnsOfSource(scope: Scope, src: ResolvedSource): Column[] | "unknown";
}

/** The result of `Qualification.bindingOf` — a column reference's resolved source binding. Structurally
 *  the shared `ResolvedColumn` (src/sema/resolve.ts); re-exported under this public name. */
export type ColumnBinding = ResolvedColumn;

export function qualify(tree: ScopeTree, schema: SchemaProvider): Qualification {
	const diagnostics: Diagnostic[] = [];
	const resolved = new Map<Scope, string[] | "unknown">();
	// Every star projection's RAW (pre-modifier) expansion, captured once during the eager walk below
	// (`projectionColumns` already expands every star to compute `columnsOf`). `expandStarOf` is a
	// PURE read of this map — never a live `expandStarPairs` call — so it can never push a diagnostic
	// after `qualify()` returns (diagnostics is frozen below) and never double-diagnoses a repeat call.
	// A projection this pass never visited (outside the tree `qualify()` was built from) has no entry
	// and `expandStarOf` answers `undefined` for it — never fabricated, same policy as the resolver.
	const starPairs = new Map<Projection, { name: string; sourceKey: string }[] | undefined>();

	// Post-order: a scope's columns (and their types) may depend on its CTE/subquery children. A pipe
	// stage depends on the scope of the relation entering it (a sibling), also visited first by order.
	const visit = (scope: Scope): void => {
		for (const child of scope.children) visit(child);
		// Every table source gets its existence checked, star or no star (#38: a starless
		// `select amount from prod.bronze.orders` must still fire unknown-table in a closed
		// world; the check used to run only through star expansion). checkSourceColumns
		// dedupes by source, so the star path can't double-diagnose.
		for (const { source } of scope.sourceList) {
			if (source.kind === "table") checkSourceColumns(source, schema, resolved, diagnostics, scope.dialect);
		}
		resolved.set(scope, resolveColumns(scope, schema, resolved, diagnostics, starPairs));
		for (const ref of bodyColumns(scope)) checkColumn(scope, ref, schema, resolved, diagnostics);
	};
	visit(tree.root);

	// Call-signature diagnostics (arity + operand types) — a separate walk over the modelled function
	// calls, emitting into the same diagnostics list. Never-wrong; curated-only. See check-calls.ts.
	checkCalls(tree, schema, diagnostics);

	// Finished being built: freeze the array itself (each Diagnostic is already frozen at its own
	// construction site — columnDiag/unknownTable/callDiag). A later live call into `expandStarOf`
	// can only ever read `diagnostics` from here on, never push into it — the exact mutation that
	// caused the double-diagnosis bug this closure used to have is now a thrown TypeError, not a
	// silent duplicate, if it were ever reintroduced.
	Object.freeze(diagnostics);

	return {
		diagnostics,
		columnsOf: (scope) => resolved.get(scope) ?? "unknown",
		bindingOf: (scope, ref) => resolveColumnSource(scope, ref.parts, schema),
		expandStarOf: (scope, projection) => {
			if (!projection.isStar) return undefined;
			const star = projection.expr.kind === "star" ? projection.expr : undefined;
			// A pure cache read — never computes live. See the `starPairs` comment above.
			const pairs = starPairs.get(projection);
			if (pairs === undefined) return undefined;
			return star ? applyStarModifiersToPairs(pairs, star, scope.dialect) : pairs;
		},
		// Side-effect-free reads only (never the diagnostics-pushing `checkSourceColumns` above), so a
		// repeat call can never double-diagnose. A schema-known table answers TYPED columns through the
		// template-aware `tableSourceColumns` — the exact path infer/nullability/sema-resolve already
		// read — with inline column aliases taking precedence (they rename the columns and carry no
		// type, so the catalog's pre-alias names would be wrong). Every derived kind (cte/subquery/
		// relation/lateral/graphtable/pivot) resolves names only via `sourceColumns` — the `resolved`
		// map never carried types — lifted into `Column` shape (`type`/`nullable` absent).
		columnsOfSource: (scope, src) => {
			if (src.kind === "table" && !src.source.columnAliases) {
				const cols = tableSourceColumns(src.name, src.source.template, schema, scope.dialect);
				if (cols) return cols;
			}
			const names = sourceColumns(src, schema, resolved, scope.dialect);
			return names === undefined ? "unknown" : names.map((name): Column => ({ name }));
		},
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
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	starPairs: Map<Projection, { name: string; sourceKey: string }[] | undefined>,
): string[] | "unknown" {
	if (scope.pipeStage) return resolvePipeStage(scope, schema, resolved, diagnostics, starPairs);
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
	// synthetic source registered in scope; it expands via the normal star path.) Neither carries a
	// `Projection` node, so there is nothing to key `starPairs` by here — `expandStarOf` is never called
	// against a headless pivot/unpivot transform.
	if (body.pivot && !body.pivot.alias) {
		const base = expandStar(scope, schema, resolved, diagnostics, undefined);
		return base === undefined ? "unknown" : applyPivotCols(base, body.pivot, scope.dialect);
	}
	if (body.unpivot && !body.unpivot.alias) {
		const base = expandStar(scope, schema, resolved, diagnostics, undefined);
		return base === undefined ? "unknown" : applyUnpivotCols(base, body.unpivot, scope.dialect);
	}
	return projectionColumns(scope, body.projections, schema, resolved, diagnostics, starPairs);
}

/** Resolve a projection list to output names: a star expands against the scope's sources (its modifiers
 *  applied), a named/aliased item keeps its name, an anonymous expression makes the set "unknown".
 *  Every star's RAW pairs are recorded into `starPairs`, keyed by its own `Projection` node, so
 *  `expandStarOf` can reuse this pass's expansion instead of re-diagnosing on a second live call. */
function projectionColumns(
	scope: Scope,
	projections: Projection[],
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	starPairs: Map<Projection, { name: string; sourceKey: string }[] | undefined>,
): string[] | "unknown" {
	const out: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			const star = p.expr.kind === "star" ? p.expr : undefined;
			const pairs = expandStarPairs(scope, schema, resolved, diagnostics, star?.qualifier);
			starPairs.set(p, pairs);
			if (pairs === undefined) return "unknown";
			let cols = pairs.map((pr) => pr.name);
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
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	starPairs: Map<Projection, { name: string; sourceKey: string }[] | undefined>,
): string[] | "unknown" {
	const stage = scope.pipeStage!;
	const incoming = scope.pipeIncoming ? (resolved.get(scope.pipeIncoming) ?? "unknown") : "unknown";
	switch (stage.op) {
		case "select":
			return projectionColumns(scope, stage.projections, schema, resolved, diagnostics, starPairs);
		case "extend":
		case "window": {
			if (incoming === "unknown") return "unknown";
			const added = projectionColumns(scope, stage.projections, schema, resolved, diagnostics, starPairs);
			return added === "unknown" ? "unknown" : [...incoming, ...added];
		}
		case "aggregate": {
			const aggs = projectionColumns(scope, stage.aggregates, schema, resolved, diagnostics, starPairs);
			if (aggs === "unknown") return "unknown";
			const keys: string[] = [];
			for (const g of stage.groupBy) {
				if (g.kind === "column") keys.push(g.parts[g.parts.length - 1]);
				else return "unknown";
			}
			// Grouping columns first, then aggregate columns: GoogleSQL pipe syntax reference, AGGREGATE
			// operator section (see scope.ts's aggregateOutputsFree, this pass's schema-free twin).
			return [...keys, ...aggs];
		}
		case "drop": {
			const fold = (n: string) => behaviorOf(scope).fold(n);
			return incoming === "unknown"
				? "unknown"
				: incoming.filter((c) => !stage.drop.some((d) => fold(d) === fold(c)));
		}
		case "rename": {
			if (incoming === "unknown") return "unknown";
			const fold = (n: string) => behaviorOf(scope).fold(n);
			const map = new Map(stage.renames.map((r) => [fold(r.from), r.to]));
			return incoming.map((c) => map.get(fold(c)) ?? c);
		}
		case "join": {
			if (incoming === "unknown") return "unknown";
			const joinSrc = [...scope.sources.entries()].find(([k]) => k !== "")?.[1];
			const joinCols = joinSrc
				? checkSourceColumns(joinSrc, schema, resolved, diagnostics, scope.dialect)
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

/** Core star expansion: the ordered {name, sourceKey} pairs, keeping which source each column
 *  came from (the public expandStarOf/applyStarModifiersToPairs need that; the plain-names
 *  `expandStar` below is a thin projection over this for the existing internal call sites). */
function expandStarPairs(
	scope: Scope,
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	qualifier?: string[],
): { name: string; sourceKey: string }[] | undefined {
	// A qualified star `t.*` expands only the source keyed by `t` (its last name part); a bare
	// `*` expands every source in order.
	const want = qualifier ? (qualifier[qualifier.length - 1] ?? "") : undefined;
	const cols: { name: string; sourceKey: string }[] = [];
	let matched = false;
	for (const [key, src] of scope.sources) {
		if (want !== undefined && !behaviorOf(scope).matchesSourceKey(key, want)) continue;
		// A pseudo-column source (Snowflake/Oracle CONNECT BY's LEVEL) resolves by name but is
		// excluded from a bare `*` — real pseudo-column semantics. A qualified star can't target
		// it anyway (it has no alias to qualify by), so this only affects the bare-`*` case.
		if (want === undefined && src.kind === "lateral" && src.source.pseudo) continue;
		matched = true;
		const srcCols = checkSourceColumns(src, schema, resolved, diagnostics, scope.dialect);
		if (srcCols === undefined) return undefined;
		cols.push(...srcCols.map((name) => ({ name, sourceKey: key })));
	}
	if (want !== undefined && !matched) return undefined; // qualified star naming no visible source
	return cols;
}

function expandStar(
	scope: Scope,
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	qualifier?: string[],
): string[] | undefined {
	return expandStarPairs(scope, schema, resolved, diagnostics, qualifier)?.map((p) => p.name);
}

/** `applyStarModifiers` (scope.ts) over {name, sourceKey} pairs instead of bare strings — EXCLUDE/
 *  ILIKE/RENAME must not lose which source a surviving/renamed column came from. A small deliberate
 *  duplication of that function's logic rather than a generalization of it: `applyStarModifiers`
 *  has its own established call sites (e.g. projectionColumns below) that don't need sourceKey and
 *  whose signature this task leaves untouched. */
function applyStarModifiersToPairs(
	pairs: { name: string; sourceKey: string }[],
	star: { exclude?: string[]; ilike?: string; rename?: { from: string; to: string }[] },
	dialect?: string,
): { name: string; sourceKey: string }[] {
	const fold = (n: string) => resolveBehavior(dialect).fold(n);
	let out = pairs;
	if (star.exclude) {
		const removed = new Set(star.exclude.map(fold));
		out = out.filter((p) => !removed.has(fold(p.name)));
	}
	if (star.ilike !== undefined) {
		const b = resolveBehavior(dialect);
		const pat = star.ilike;
		out = out.filter((p) => b.likeMatch(pat, fold(p.name)));
	}
	if (star.rename) {
		const renames = new Map(star.rename.map((r) => [fold(r.from), r.to]));
		out = out.map((p) => ({ ...p, name: renames.get(fold(p.name)) ?? p.name }));
	}
	return out;
}

/** The output column names of a source — schema for a table (reporting unknown-table if absent),
 *  the resolved child names for a CTE/subquery (column aliases rename them), the AS columns for a
 *  lateral view. Types are not threaded here; type inference (src/infer) owns types. */
/** Per-qualify-call dedupe of source-level diagnostics, keyed by the call's own diagnostics array
 *  (unique per qualify(), frozen when it returns): the eager per-scope sweep and the star-expansion
 *  path both check the same sources, and a source must diagnose ONCE. Keyed this way instead of a
 *  threaded parameter so the four call chains keep their signatures. */
const diagnosedBy = new WeakMap<Diagnostic[], WeakSet<object>>();

function checkSourceColumns(
	src: ResolvedSource,
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		if (src.source.columnAliases) return src.source.columnAliases;
		// A templated source ({{ ref('x') }} / {{ source(…) }} / a macro call in FROM) resolves its real columns through TemplateProvider.expansion().
		if (src.source.template) return templateColumns(src.source.template, schema, dialect);
		// A library-synthesized relation (a graph element variable) is not a catalog table —
		// closed-world existence semantics don't apply to nodes the user never wrote.
		if (src.source.synthesized) return undefined;
		const cols = schema.columnsFor(src.name, dialect);
		if (!cols) {
			// Miss semantics are the provider's `world`: a CLOSED world declares completeness, so the
			// miss IS "table does not exist"; an OPEN world's miss is unknown — never-wrong, no diagnostic.
			// With a candidates-aware provider (#38) an AMBIGUOUS partial name is its own diagnosis,
			// naming every table the reference could mean — never first-wins. One diagnostic per
			// source node, however many paths re-check it (the eager per-scope sweep + star expansion).
			let diagnosed = diagnosedBy.get(diagnostics);
			if (!diagnosed) {
				diagnosed = new WeakSet();
				diagnosedBy.set(diagnostics, diagnosed);
			}
			if ((schema.world ?? "closed") === "closed" && !diagnosed.has(src.source)) {
				diagnosed.add(src.source);
				const candidates = schema.tableCandidates?.(src.name, dialect);
				if (candidates && candidates.length > 1) {
					diagnostics.push(ambiguousTable(src.source.relation.fqn, candidates, src.source.cst));
				} else {
					diagnostics.push(unknownTable(src.source.relation.fqn, src.source.cst));
				}
			}
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
			pivotSourceOutputs(
				src,
				(s) => checkSourceColumns(s, schema, resolved, diagnostics, dialect) ?? "unknown",
				dialect,
			),
		);
	}
	return src.source.columnAliases ?? known(resolved.get(src.scope));
}

function known(r: string[] | "unknown" | undefined): string[] | undefined {
	return r === undefined || r === "unknown" ? undefined : r;
}

/**
 * Resolve a templated FROM/JOIN source's column NAMES through the TemplateProvider, or `undefined`
 * for the exemption. Never-wrong — `undefined` (no fabricated column, no diagnostic) for: a marker
 * with no provider key (the opaque `"expr"` kind), a schema that is not a provider, a provider with
 * no relation answer (default provider / cold cache — warms on prime()), or a physical-name lookup
 * that itself misses. Only a POSITIVE relation answer with resolvable columns lets the caller's
 * unknown-column path fire against a templated source.
 *
 * PROVIDER-ONLY on purpose (relationColumns, shared with infer/nullability/resolve): the diagnostic
 * exemption must not fire merely because a plain Schema happens to declare the dbt-logical name —
 * the TYPE consumers add that fallback themselves (tableSourceColumns).
 */
function templateColumns(t: TemplateSourceInfo, schema: SchemaProvider, dialect?: string): string[] | undefined {
	return relationColumns(t, schema, dialect)?.map((c) => c.name);
}

/**
 * Verify a column reference against the schema-resolved sources (walking enclosing scopes
 * for correlation). Conservative: a diagnostic fires only when a source's columns are
 * actually known and the column is missing/ambiguous — never merely because a schema is absent.
 */
function checkColumn(
	scope: Scope,
	ref: ColumnRef,
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	diagnostics: Diagnostic[],
): void {
	// A template tag's placeholder fill is not a user-written column — its meaning lives with the
	// TemplateProvider (inference), never with unknown-column checking (a `jjj…` diagnostic would
	// be placeholder leakage, and a provider-typed value is not a column at all).
	if (ref.template) return;

	// ONE binder decides (issue #38): the same qualified/unqualified resolution scope, sema, infer
	// and lineage ride, so the checker can never drift from what binding actually did. Qualified
	// references validate their leading parts against the source relation's key at any depth
	// (4-part refs bind; `wrong.orders.col` does not).
	const r = resolveColumnRef(scope, ref, schema);

	// A bare name in GROUP BY/HAVING/ORDER BY (incl. after a UNION) may reference a SELECT alias.
	if (r.kind === "alias") return;
	if (r.kind === "needs-schema") return;

	if (r.kind === "ambiguous") {
		diagnostics.push(columnDiag("ambiguous-column", ref, `Ambiguous column: ${ref.parts.join(".")}`));
		return;
	}

	if (r.kind === "bound") {
		// A qualified binding fixes the source without consulting its columns — check membership.
		const cols = sourceColumns(r.source, schema, resolved, scope.dialect);
		if (cols && !cols.some((c) => behaviorOf(scope).fold(c) === behaviorOf(scope).fold(r.column))) {
			diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${ref.parts.join(".")}`));
			return; // base column missing — don't also walk its (nonexistent) fields
		}
		checkFieldPath(r.fields, scope, schema, ref, diagnostics);
		return;
	}

	// Unresolved. If ANY visible source's columns are unknown, the reference might live there —
	// never-wrong, stay silent. Otherwise every source is known and none has it.
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		for (const { source: src } of s.sourceList) {
			if (!sourceColumns(src, schema, resolved, s.dialect)) return;
		}
	}
	// The message shows the reference as WRITTEN (display), never the folded identity key.
	diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${ref.parts.join(".")}`));
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
	schema: SchemaProvider,
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
		const hit = type.fields.find((f) => f.name === behaviorOf(scope).fold(field));
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
	schema: SchemaProvider,
	resolved: Map<Scope, string[] | "unknown">,
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		if (src.source.columnAliases) return src.source.columnAliases;
		// Templated source resolves its real columns through TemplateProvider.expansion().
		if (src.source.template) return templateColumns(src.source.template, schema, dialect);
		return schema.columnsFor(src.name, dialect)?.map((c) => c.name);
	}
	if (src.kind === "cte") return src.ref.def.columnAliases ?? known(resolved.get(src.ref.scope));
	if (src.kind === "lateral") return src.source.columns;
	if (src.kind === "relation") return known(resolved.get(src.scope));
	if (src.kind === "graphtable") return known(resolved.get(src.scope));
	if (src.kind === "pivot")
		return known(pivotSourceOutputs(src, (s) => sourceColumns(s, schema, resolved, dialect) ?? "unknown", dialect));
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
	return Object.freeze({ kind, message, ...spanOf(ref.cst) });
}

/** `fqn` is the DISPLAY form (relation.fqn — as written, quoting kept), never the identity key. */
function unknownTable(fqn: string, cst: ParserRuleContext): Diagnostic {
	return Object.freeze({ kind: "unknown-table", message: `Unknown table: ${fqn}`, ...spanOf(cst) });
}

/** A partial name several declared tables could mean (#38) — named so the fix is obvious. */
function ambiguousTable(fqn: string, candidates: string[][], cst: ParserRuleContext): Diagnostic {
	const list = candidates.map((c) => c.join(".")).join(", ");
	return Object.freeze({
		kind: "ambiguous-table",
		message: `Ambiguous table: ${fqn} matches ${list}`,
		...spanOf(cst),
	});
}
