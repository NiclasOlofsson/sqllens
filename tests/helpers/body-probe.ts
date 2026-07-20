import type { QueryBody, QueryExpr, SelectExpr } from "../../src/ir/ir.js";
import { allQueryExprs } from "../../src/ir/walk.js";

// ---------------------------------------------------------------------------
// The body-non-emptiness conservation probe (.claude/PLAN.md, "Corpus gates can't see an empty
// lowered body"). The totality gates (lower/resolveScopes never throw) and the `other`-expression
// ratchet prove no-throw and no-undermodelled-expression, but neither asserts a lowered SelectExpr
// actually carries a body: a lowering bug that silently drops both the projection list and the FROM
// clause (the class a Task-2 drive-by fix once repaired) produces a SelectExpr that parses clean,
// throws nowhere, and tallies zero `other` nodes — invisible to every existing gate. This probe
// closes that gap: a SelectExpr that claims to be a query yet carries NO projections, NO from
// sources, and NO unsupported flag is flagged.
//
// What is deliberately NOT flagged (each verified against the code/corpus, not assumed):
//
//   - `SELECT FROM t` / any select with an empty projection list but a real FROM. Databricks,
//     Redshift, PostgreSQL and DuckDB parse this clean (CLAUDE.md "Known shortcuts" — "genuine
//     precision leniency, not a documented feature"; PostgreSQL's own grammar bracket-documents the
//     select-list as optional, postgresql.org/docs/current/sql-select.html). `from.length > 0` alone
//     keeps it out of this probe's rule — it never reaches the "both empty" flag condition.
//
//   - Any recovered/broken/non-query body. Every dialect's `emptyBody()`/`emptyQuery()`/`flagged()`
//     helper (grep across src/*/lower.ts) stamps a non-empty `unsupported` array on a stub body —
//     "broken" (unparsed statement), "empty" (genuinely empty input), "unparsed" (T-SQL's generic
//     fallback, folding in its own empty-input case), "non-query" (a parsed non-SELECT statement),
//     "non-query-cte" (postgres/redshift/duckdb CTE body with no inner SELECT), "multi-statement"
//     (a `;`-batch stub, incl. src/document/document.ts's cell placeholder). A flagged-broken empty
//     body is empty BY DESIGN — the flag is the signal, not a defect this probe should catch.
//
// A rule this narrow only fires on a genuine lowering bug: a real, unflagged SelectExpr that a
// dialect's lower() built with nothing in it. Any corpus-surfaced finding gets fixed at its source
// (the owning dialect's lower.ts) with a unit pin, never exempted here without a named corpus file.
// ---------------------------------------------------------------------------

/** True when a SelectExpr claims to be a query body yet carries nothing verifiable: no projections,
 *  no FROM sources, and no `unsupported` flag marking it as a known stub/recovered/broken body. */
function isEmptyBody(select: SelectExpr): boolean {
	return select.projections.length === 0 && select.from.length === 0 && !select.unsupported?.length;
}

/** Every SelectExpr reachable in the IR: root, CTE bodies, subquery sources, set-op branches, pipe
 *  bases. Built on src/ir/walk.ts's `allQueryExprs`, which already finds every QueryExpr entry point
 *  (root, CTEs, subquery sources, and the QueryExprs a pipe stage nests: setop operands, the
 *  recursiveUnion operand, WITH ctes, a JOIN subquery). The one thing `allQueryExprs` does not do is
 *  unwrap a QueryExpr's OWN body down to its leaf SelectExpr(s) when that body is a SetOpExpr or
 *  PipeExpr — those are `QueryBody`, not `QueryExpr`, so they are not themselves entries in its
 *  output. `bodySelectExprs` below does exactly that one extra unwrap. */
export function allSelectExprs(root: QueryExpr): SelectExpr[] {
	return allQueryExprs(root).flatMap((qe) => bodySelectExprs(qe.body));
}

function bodySelectExprs(body: QueryBody): SelectExpr[] {
	if (body.kind === "select") return [body];
	if (body.kind === "setop") return [...bodySelectExprs(body.left), ...bodySelectExprs(body.right)];
	return bodySelectExprs(body.input); // pipe: the relation the pipeline starts from
}

/** Runs the probe over one lowered QueryExpr, appending a `"<file>:<line>:<col>"` entry to `hits`
 *  for every flagged (empty, unflagged) SelectExpr body. A clean corpus leaves `hits` empty — the
 *  gate asserts that, riding the same single parse the gate already made (no re-parse). */
export function probeBody(root: QueryExpr, file: string, hits: string[]): void {
	for (const select of allSelectExprs(root)) {
		if (isEmptyBody(select)) {
			const s = select.cst.start;
			hits.push(`${file}:${s?.line ?? "?"}:${s?.column ?? "?"}`);
		}
	}
}
