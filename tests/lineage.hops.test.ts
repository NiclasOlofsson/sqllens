import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { lower as lowerDuckdb } from "../src/duckdb/lower.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import type { Expr, Projection } from "../src/ir/ir.js";
import { lineageAt, lineageOf, type LineageHop } from "../src/lineage/hops.js";
import type { Origin } from "../src/lineage/lineage.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes, type ScopeTree } from "../src/scope/scope.js";

// ---------------------------------------------------------------------------
// Per-hop lineage — the reference-spine DAG.
//
// Two suites:
//   1. The SPEC's acceptance set (a)-(g) — the cursor-anchored spine, spans, fan-out,
//      shared hops, schema-free-vs-schema, WHERE routing, recursive cycle guard.
//   2. The 17-case translation of the extension's own walk
//      (dbt-studio-vscode/src/ftl/sqllens/lineage.test.ts) — SEMANTICS not shape. Their
//      output contract (dependencies/via_ctes/transformations) is NOT ours; each case here
//      asserts the same hops/spans/attribution it proves, cited by `// anvil case: <name>`.
// ---------------------------------------------------------------------------

function scopesOf(sql: string): ScopeTree {
	return resolveScopes(lower(parseDatabricks(sql).tree));
}
function snowScopes(sql: string): ScopeTree {
	return resolveScopes(lowerSnowflake(parseSnowflake(sql).tree));
}
function duckScopes(sql: string): ScopeTree {
	return resolveScopes(lowerDuckdb(parseDuckdb(sql).tree));
}

/** The 0-based offset of the nth occurrence (1-based n) of `needle` in `sql`. */
function offsetOf(sql: string, needle: string, n = 1): number {
	let i = -1;
	for (let k = 0; k < n; k++) i = sql.indexOf(needle, i + 1);
	if (i < 0) throw new Error(`needle ${JSON.stringify(needle)} #${n} not found`);
	return i;
}

/** Slice the original SQL at a CST node's char span (inclusive stop → exclusive slice end). */
function sliceCst(sql: string, cst: unknown): string {
	const c = cst as { start?: { start: number }; stop?: { stop: number } } | null | undefined;
	if (!c?.start || !c.stop) return "";
	return sql.slice(c.start.start, c.stop.stop + 1);
}
function exprText(sql: string, hop: LineageHop): string {
	return sliceCst(sql, hop.expr.cst).trim();
}
function aliasText(sql: string, hop: LineageHop): string {
	const p = hop.projection;
	return p?.aliasCst ? sliceCst(sql, p.aliasCst).trim() : "";
}
function originStr(o: Origin): string {
	return `${o.table.join(".")}.${o.column}`;
}
function terminals(hop: LineageHop): string[] {
	return hop.terminal === "unresolved" ? ["unresolved"] : (hop.terminal ?? []).map(originStr).sort();
}

// ============================================================================
// Suite 1 — the SPEC acceptance set (a)-(g).
// ============================================================================

describe("per-hop lineage — spec acceptance", () => {
	// (a) the brief's canonical chain: z ← b.z(`y*2`) ← a.y(`x+1`) ← terminal t.x.
	const canonical = "WITH a AS (SELECT x+1 AS y FROM t), b AS (SELECT y*2 AS z FROM a) SELECT z FROM b";

	it("(a) walks the chained-CTE spine with span-asserted hops down to the base column", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2)); // the outer `z` (2nd occurrence)
		expect(head).toBeDefined();
		// The outer passthrough collapses — the head IS the first producing CTE hop, b.z (`y*2`).
		expect(exprText(canonical, head!)).toBe("y*2");
		expect(aliasText(canonical, head!)).toBe("z");
		expect(head!.downstream).toHaveLength(1);

		const a = head!.downstream[0];
		expect(exprText(canonical, a)).toBe("x+1");
		expect(aliasText(canonical, a)).toBe("y");
		expect(a.downstream).toEqual([]);
		expect(terminals(a)).toEqual(["t.x"]);
	});

	// (b) UNION positional fan-out, legs with DIFFERENT column names.
	it("(b) forks to one hop per union leg, positionally, across differing leg names", () => {
		const sql = "WITH u AS (SELECT a AS x FROM t1 UNION ALL SELECT b FROM t2) SELECT x FROM u";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "x", 2)); // outer `x`
		expect(head).toBeDefined();
		// No hop at the setop node itself — the ref into the union CTE fans out.
		expect(head!.downstream).toHaveLength(2);
		const legTerms = head!.downstream.flatMap(terminals).sort();
		expect(legTerms).toEqual(["t1.a", "t2.b"]);
		// Each leg carries its own expr/name in its own scope.
		expect(head!.downstream.map((h) => exprText(sql, h)).sort()).toEqual(["a", "b"]);
	});

	// (c) UNION BY NAME — legs matched by name, not position. Uses Snowflake: it models the `byName`
	// flag on the set-op IR.
	it("(c) matches union-BY-NAME legs by column name", () => {
		const sql =
			"WITH u AS (SELECT a AS k, z FROM t1 UNION ALL BY NAME SELECT b AS z, c AS k FROM t2) SELECT k FROM u";
		const scopes = snowScopes(sql);
		const head = lineageAt(scopes, offsetOf(sql, "k", 3)); // outer `k`
		expect(head).toBeDefined();
		expect(head!.downstream).toHaveLength(2);
		// k binds to `a AS k` in leg1 (pos 0) and `c AS k` in leg2 (pos 1) — by name, not position.
		expect(head!.downstream.flatMap(terminals).sort()).toEqual(["t1.a", "t2.c"]);
	});

	// (c-duckdb) same UNION BY NAME shape, native DuckDB syntax — proves the fix (`byName` now rides
	// on the duckdb-lowered set-op IR too, not just Snowflake's).
	// duckdb.org/docs/current/sql/query_syntax/setops#union-all-by-name
	it("(c-duckdb) matches DuckDB union-BY-NAME legs by column name", () => {
		const sql =
			"WITH u AS (SELECT a AS k, z FROM t1 UNION ALL BY NAME SELECT b AS z, c AS k FROM t2) SELECT k FROM u";
		const scopes = duckScopes(sql);
		const head = lineageAt(scopes, offsetOf(sql, "k", 3)); // outer `k`
		expect(head).toBeDefined();
		expect(head!.downstream).toHaveLength(2);
		// k binds to `a AS k` in leg1 (pos 0) and `c AS k` in leg2 (pos 1) — by name, not position.
		expect(head!.downstream.flatMap(terminals).sort()).toEqual(["t1.a", "t2.c"]);
	});

	// (c′) Snowflake quoted identifiers preserve case through a hop — dialect-true fold. Snowflake
	// folds UNquoted names to UPPER and preserves quoted ones, so the quoted CTE and column keep their
	// mixed case and the outer quoted `"Col"` binds through `"Mixed"` onto the producer `a+1 AS "Col"`,
	// down to t.a. A wrong (case-lowering / upper-folding) quoted fold would break the match and strand
	// the hop unresolved — pinned by the control below (a wrong-case `"COL"` outer ref → unresolved),
	// so this asserts a real dialect-true fold, not a tautology.
	it("(c′) hops through a Snowflake quoted CTE/column with case-preserving fold", () => {
		const sql = 'WITH "Mixed" AS (SELECT a+1 AS "Col" FROM t) SELECT "Col" FROM "Mixed"';
		const scopes = snowScopes(sql);
		const head = lineageAt(scopes, offsetOf(sql, '"Col"', 2)); // the outer quoted "Col"
		expect(head).toBeDefined();
		// The outer passthrough collapses onto the CTE producer `a+1 AS "Col"`.
		expect(exprText(sql, head!)).toBe("a+1");
		expect(aliasText(sql, head!)).toBe('"Col"'); // quotes + mixed case preserved verbatim
		expect(head!.downstream).toEqual([]);
		expect(terminals(head!)).toEqual(["t.a"]); // resolves ONLY because quoted fold preserved case

		// Control — a wrong-case quoted outer ref does NOT match the preserved-case CTE column,
		// so the hop strands `unresolved`. This is what proves the positive above is load-bearing.
		const bad = 'WITH "Mixed" AS (SELECT a+1 AS "Col" FROM t) SELECT "COL" FROM "Mixed"';
		const badHead = lineageAt(snowScopes(bad), offsetOf(bad, '"COL"'));
		expect(terminals(badHead!)).toEqual(["unresolved"]);
	});

	// (d) self-join / CTE consumed twice → the SAME hop object shared (reference equality).
	it("(d) shares a hop object across two converging paths (DAG, reference equality)", () => {
		const sql = [
			"WITH base AS (SELECT p * 10 AS k FROM t),",
			"     l AS (SELECT k + 1 AS lk FROM base),",
			"     r AS (SELECT k + 2 AS rk FROM base)",
			"SELECT l.lk + r.rk AS s FROM l JOIN r ON l.lk = r.rk",
		].join("\n");
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, sql.indexOf("AS s") + 3);
		// head is the `s` projection hop (l.lk + r.rk), fanning to the l and r hops.
		expect(head).toBeDefined();
		expect(head!.downstream).toHaveLength(2);
		const [d0, d1] = head!.downstream;
		// Both l and r hop downstream to base's `p*10 AS k` — the SAME object.
		expect(d0.downstream).toHaveLength(1);
		expect(d1.downstream).toHaveLength(1);
		expect(d0.downstream[0]).toBe(d1.downstream[0]); // reference equality — shared hop
		expect(terminals(d0.downstream[0])).toEqual(["t.p"]);
	});

	// (e) schema-free unqualified over a 2-table FROM → "unresolved"; with schema → resolved.
	it("(e) is unresolved schema-free over a 2-table FROM, resolved with a schema", () => {
		const sql = "SELECT customer_name FROM orders o JOIN customers c ON c.id = o.customer_id";
		const free = lineageAt(scopesOf(sql), offsetOf(sql, "customer_name"));
		expect(free).toBeDefined();
		expect(free!.terminal).toBe("unresolved");

		const schema = new Schema({
			orders: { order_id: "bigint", customer_id: "bigint" },
			customers: { id: "bigint", customer_name: "string" },
		});
		const bound = lineageAt(scopesOf(sql), offsetOf(sql, "customer_name"), schema);
		expect(terminals(bound!)).toEqual(["customers.customer_name"]);
	});

	// (f) a ref inside WHERE routes to the SAME spine as the projection route; keyword → undefined.
	it("(f) routes a WHERE-clause ref to the same spine as the projection route", () => {
		const sql = "WITH b AS (SELECT p * 2 AS z FROM t) SELECT z FROM b WHERE z > 10";
		const scopes = scopesOf(sql);
		const proj = lineageAt(scopes, offsetOf(sql, "z", 2)); // `z` in SELECT
		const where = lineageAt(scopes, offsetOf(sql, "z", 3)); // `z` in WHERE
		expect(proj).toBeDefined();
		expect(where).toBeDefined();
		// Same head object — both routes follow z into b's `p*2 AS z`.
		expect(where!.expr).toBe(proj!.expr);
		expect(exprText(sql, where!)).toBe("p * 2");
		expect(terminals(where!)).toEqual(["t.p"]);
	});

	it("(f) returns undefined on a keyword offset", () => {
		const sql = "SELECT z FROM b";
		expect(lineageAt(scopesOf(sql), offsetOf(sql, "SELECT"))).toBeUndefined();
		expect(lineageAt(scopesOf(sql), offsetOf(sql, "FROM"))).toBeUndefined();
	});

	// (g) recursive CTE — the anchor leg yields its chain; the recursive leg is cycle-guarded.
	it("(g) yields the anchor chain and stops the recursive leg at the cycle guard (unresolved)", () => {
		const sql = [
			"WITH RECURSIVE r AS (",
			"  SELECT id FROM base",
			"  UNION ALL",
			"  SELECT id FROM r",
			") SELECT id FROM r",
		].join("\n");
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "id", 3)); // outer `id`
		expect(head).toBeDefined();
		expect(head!.downstream).toHaveLength(2);
		const legTerms = head!.downstream.map(terminals).sort();
		// One leg reaches base.id (anchor); the other is cycle-guarded to unresolved.
		expect(legTerms).toEqual([["base.id"], ["unresolved"]]);
	});
});

// ============================================================================
// Suite 2 — translation of the extension's 17 lineage.test.ts cases.
// Their contract (dependencies / via_ctes / transformations) is NOT ours; each case
// below asserts the SAME hops/spans/attribution against lineageAt/lineageOf.
// ============================================================================

describe("per-hop lineage — anvil 17-case contract translation", () => {
	const canonical = "WITH a AS (SELECT x+1 AS y FROM t), b AS (SELECT y*2 AS z FROM a) SELECT z FROM b";

	// anvil case: 'reaches the base-table column through both CTE hops'
	it("reaches the base-table column through both CTE hops", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2))!;
		// dependencies === {x, t}; via_ctes === [b, a] → the b→a→t spine.
		expect(terminals(head.downstream[0])).toEqual(["t.x"]);
		expect(exprText(canonical, head)).toBe("y*2"); // b's producer
		expect(exprText(canonical, head.downstream[0])).toBe("x+1"); // a's producer
	});

	// anvil case: 'records the per-hop expression snippets sliced from the original sql'
	it("records the per-hop expression snippets sliced from the original sql", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2))!;
		expect(exprText(canonical, head)).toBe("y*2");
		expect(aliasText(canonical, head)).toBe("z");
		expect(exprText(canonical, head.downstream[0])).toBe("x+1");
		expect(aliasText(canonical, head.downstream[0])).toBe("y");
	});

	// anvil case: 'links each hop to the source that feeds it (structural, not string-matched)'
	it("links each hop to the source that feeds it (structural, not string-matched)", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2))!;
		// b's hop feeds from a's hop (an object reference, not a string id).
		expect(head.downstream).toHaveLength(1);
		// a's hop feeds from the base table t (a terminal Origin, not a hop).
		expect(head.downstream[0].downstream).toEqual([]);
		expect(terminals(head.downstream[0])).toEqual(["t.x"]);
	});

	// anvil case: 'emits an outer_query step naming the CTE the final select reads'
	// DIVERGENCE (shape): we have NO separate outer_query node — the outer passthrough collapses
	// into the entry follow, so the head IS the CTE producer it reads. Semantically the outer read
	// of `b` is the very edge we traverse to reach the head.
	it("[divergence: outer_query collapsed] the entry follows the outer read into the CTE", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2))!;
		// The head lives in b's CTE scope (the CTE the final select reads).
		expect(head.scope.body.kind).toBe("select");
		expect(exprText(canonical, head)).toBe("y*2");
	});

	// anvil case: 'emits a table leaf transform for the base table'
	// DIVERGENCE (shape): a base table is a `terminal` Origin, never a hop (a base table has no
	// projection to fill {scope, projection, expr}). The leaf is the Origin t.x.
	it("[divergence: base table is a terminal] the base table appears as a terminal Origin", () => {
		const scopes = scopesOf(canonical);
		const head = lineageAt(scopes, offsetOf(canonical, "z", 2))!;
		expect(head.downstream[0].terminal).toEqual([{ table: ["t"], column: "x" }]);
	});

	// anvil case: 'preserves the actual expression text with whitespace as written'
	it("preserves the actual expression text with whitespace as written", () => {
		const sql = "WITH a AS (SELECT sum(x) AS y FROM t) SELECT y FROM a";
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "y", 2))!;
		expect(exprText(sql, head)).toBe("sum(x)");
	});

	// anvil case: 'depends on the source table for a bare projection'
	it("depends on the source table for a bare projection", () => {
		const sql = "SELECT customer_id FROM orders";
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_id"))!;
		expect(terminals(head)).toEqual(["orders.customer_id"]);
		expect(head.downstream).toEqual([]);
	});

	// anvil case: 'carries schema on a schema-qualified base table'
	it("carries schema on a schema-qualified base table", () => {
		const sql = "SELECT customer_id FROM staging.raw_orders";
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_id"))!;
		expect(head.terminal).toEqual([{ table: ["staging", "raw_orders"], column: "customer_id" }]);
	});

	// anvil case: 'returns empty result for a column that is not projected'
	// DIVERGENCE (API shape): the anvil walk is BY NAME; ours is cursor/node-anchored. "not
	// projected" has no offset to point at, so the equivalent is: an offset that is not a resolvable
	// column (a keyword) → undefined.
	it("[divergence: node-anchored] returns undefined off a resolvable column", () => {
		const sql = "SELECT customer_id FROM orders";
		expect(lineageAt(scopesOf(sql), offsetOf(sql, "FROM"))).toBeUndefined();
	});

	// anvil case: 'attributes a joined-table column to the joined table'
	it("attributes a joined-table column to the joined table", () => {
		const sql =
			"SELECT o.order_id, c.customer_name AS name\nFROM orders o\nJOIN customers c ON c.customer_id = o.customer_id";
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "c.customer_name"))!;
		expect(terminals(head)).toEqual(["customers.customer_name"]);
	});

	// anvil case: 'attributes the driver-table column to the driver table'
	it("attributes the driver-table column to the driver table", () => {
		const sql =
			"SELECT o.order_id, c.customer_name AS name\nFROM orders o\nJOIN customers c ON c.customer_id = o.customer_id";
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "o.order_id"))!;
		expect(terminals(head)).toEqual(["orders.order_id"]);
	});

	// anvil case: 'attributes both union legs in the dependencies'
	it("attributes both union legs in the dependencies", () => {
		const sql = [
			"WITH u AS (",
			"    SELECT customer_id FROM orders",
			"    UNION ALL",
			"    SELECT customer_id FROM archive_orders",
			")",
			"SELECT customer_id FROM u",
		].join("\n");
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_id", 3))!;
		expect(head.downstream.flatMap(terminals).sort()).toEqual(["archive_orders.customer_id", "orders.customer_id"]);
	});

	// anvil case: 'emits a union transform with a branch per leg'
	it("emits a union transform with a branch per leg", () => {
		const sql = [
			"WITH u AS (",
			"    SELECT customer_id FROM orders",
			"    UNION ALL",
			"    SELECT customer_id FROM archive_orders",
			")",
			"SELECT customer_id FROM u",
		].join("\n");
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_id", 3))!;
		expect(head.downstream).toHaveLength(2); // one hop per leg
		const legSources = head.downstream.flatMap(terminals).sort();
		expect(legSources).toEqual(["archive_orders.customer_id", "orders.customer_id"]);
	});

	// anvil case: 'walks a top-level union (no CTE) attributing both legs'
	// DIVERGENCE (shape): a top-level set-op has no outer projection to anchor a single fork hop.
	// Cursor-anchored, each leg's `id` resolves to that leg's own table (more precise than the
	// by-name walk). The "both legs in one call" fan-out is exactly the union-sourced-CTE case above.
	it("[divergence: top-level union] each leg's ref resolves to that leg's table", () => {
		const sql = "SELECT id FROM a UNION ALL SELECT id FROM b";
		const legA = lineageAt(scopesOf(sql), offsetOf(sql, "id", 1))!;
		const legB = lineageAt(scopesOf(sql), offsetOf(sql, "id", 2))!;
		expect(terminals(legA)).toEqual(["a.id"]);
		expect(terminals(legB)).toEqual(["b.id"]);
	});

	// anvil case: 'walks a single-source star passthrough to the base table'
	it("walks a single-source star passthrough to the base table", () => {
		const sql = "WITH s AS (SELECT * FROM orders) SELECT customer_id FROM s";
		const schema = new Schema({ orders: { customer_id: "bigint", total: "double" } });
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_id"), schema)!;
		expect(terminals(head)).toEqual(["orders.customer_id"]);
	});

	// anvil case: 'summarizes (does not drop) a multi-source star hop that needs a schema to expand'
	// DIVERGENCE (no `summarized` flag): the leaf is resolved through the schema (never-wrong), so we
	// don't summarize — with the schema the star's underlying column binds to its real base table.
	it("[divergence: no summarized flag] resolves a multi-source star leaf through the schema", () => {
		const sql = [
			"WITH s AS (SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id)",
			"SELECT customer_name FROM s",
		].join("\n");
		const schema = new Schema({
			orders: { order_id: "bigint", customer_id: "bigint" },
			customers: { id: "bigint", customer_name: "string" },
		});
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_name"), schema)!;
		expect(terminals(head)).toEqual(["customers.customer_name"]);
	});

	// anvil case: 'binds an unqualified column across a join using the schema'
	it("binds an unqualified column across a join using the schema", () => {
		const sql = "SELECT customer_name FROM orders o JOIN customers c ON c.id = o.customer_id";
		const schema = new Schema({
			orders: { order_id: "bigint", customer_id: "bigint" },
			customers: { id: "bigint", customer_name: "string" },
		});
		const head = lineageAt(scopesOf(sql), offsetOf(sql, "customer_name"), schema)!;
		expect(terminals(head)).toEqual(["customers.customer_name"]);
	});
});

// ============================================================================
// lineageOf — the programmatic entry (any column-ref Expr / Projection).
// ============================================================================

describe("per-hop lineage — lineageOf programmatic entry", () => {
	it("accepts a Projection node directly", () => {
		const sql = "WITH a AS (SELECT x+1 AS y FROM t) SELECT y FROM a";
		const scopes = scopesOf(sql);
		// The outer `y` projection is a passthrough — lineageOf follows it into a's producer.
		const root = scopes.root;
		const proj: Projection = (root.body as { projections: Projection[] }).projections[0];
		const hop = lineageOf(proj, root);
		expect(exprText(sql, hop)).toBe("x+1");
		expect(terminals(hop)).toEqual(["t.x"]);
	});

	it("accepts a column-ref Expr node directly", () => {
		const sql = "SELECT a + b AS c FROM t";
		const scopes = scopesOf(sql);
		const proj: Projection = (scopes.root.body as { projections: Projection[] }).projections[0];
		const colA = (proj.expr as { left: Expr }).left; // the `a` ref
		const hop = lineageOf(colA, scopes.root);
		expect(terminals(hop)).toEqual(["t.a"]);
	});
});

describe("via trail — ITEM 12 (flow view: collapsed/descended scopes are reportable)", () => {
	// The trail rides the HOP (consumer-side): the ordered scopes the walk collapsed (pure renames)
	// or descended (star/bare-source resolution) through while following that hop's refs. Absent
	// when nothing was collapsed (the via-trail collapse case).

	function cteScope(scopes: ScopeTree, name: string) {
		// CTE keys are stored folded (snowflake UPPER, most others lower) — try both.
		const ref = scopes.root.ctes.get(name) ?? scopes.root.ctes.get(name.toUpperCase());
		if (!ref) throw new Error(`cte ${name} not found`);
		return ref.scope;
	}

	// anvil ITEM 12 red case: bare-rename fold chain (databricks) — via [b, a], terminal t.x
	it("records the rename-collapsed CTE chain on the head hop", () => {
		const sql = "WITH a AS (SELECT x AS y FROM t), b AS (SELECT y AS z FROM a) SELECT z FROM b";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "z", 2));
		expect(head).toBeDefined();
		expect(terminals(head!)).toEqual(["t.x"]);
		expect(head!.via).toBeDefined();
		expect(head!.via![0]).toEqual({ scope: cteScope(scopes, "b"), kind: "rename" }); // consumer-first
		expect(head!.via![1]).toEqual({ scope: cteScope(scopes, "a"), kind: "rename" });
		expect(head!.via!.length).toBe(2);
	});

	// anvil ITEM 12 red case: snowflake qualified-UPPER rename chain — fold-true trail
	it("records the trail through a snowflake qualified-ref rename chain", () => {
		const sql = "WITH a AS (SELECT x AS y FROM t), b AS (SELECT A.Y AS z FROM a) SELECT z FROM b";
		const scopes = snowScopes(sql);
		const head = lineageAt(scopes, offsetOf(sql, "z", 2));
		expect(terminals(head!)).toEqual(["t.x"]);
		expect(head!.via).toEqual([
			{ scope: cteScope(scopes, "b"), kind: "rename" },
			{ scope: cteScope(scopes, "a"), kind: "rename" },
		]);
	});

	// anvil ITEM 12 red case: databricks backtick fold chain — via [a]
	it("records the trail through a backtick-folded rename", () => {
		const sql = "WITH a AS (SELECT x AS `Mixed` FROM t) SELECT `mixed` AS z FROM a";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "`mixed`"));
		expect(terminals(head!)).toEqual(["t.x"]);
		expect(head!.via).toEqual([{ scope: cteScope(scopes, "a"), kind: "rename" }]);
	});

	// anvil ITEM 12 red case: single-source star passthrough — via [s], no schema needed
	it("records the star-descended scope on the trail (single source, schema-free)", () => {
		const sql = "WITH s AS (SELECT * FROM orders) SELECT customer_id FROM s";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "customer_id"));
		expect(terminals(head!)).toEqual(["orders.customer_id"]);
		expect(head!.via).toEqual([{ scope: cteScope(scopes, "s"), kind: "expand" }]);
	});

	// anvil ITEM 12 red case: schema-resolved multi-source star — s reported, terminal via schema.
	// The flow ends in a terminal Origin with NO producer hop — the trail rides the head anchor.
	it("reports the descended scope when a multi-source star resolves through the schema", () => {
		const sql =
			"WITH s AS (SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id)\nSELECT customer_name FROM s";
		const scopes = scopesOf(sql);
		const schema = new Schema({
			orders: { order_id: "bigint", customer_id: "bigint" },
			customers: { id: "bigint", customer_name: "string" },
		});
		const head = lineageAt(scopes, offsetOf(sql, "customer_name"), schema);
		expect(terminals(head!)).toEqual(["customers.customer_name"]);
		expect(head!.via).toEqual([{ scope: cteScope(scopes, "s"), kind: "expand" }]);
	});

	// anvil ITEM 13 acceptance: a rename-collapse step and a star-descent step in ONE trail carry
	// DIFFERENT kinds. `s` is a `SELECT *` (expand); `r` renames s's column (rename). The outer read
	// collapses r (rename) then descends s (expand) → via = [{r, rename}, {s, expand}].
	it("tags a rename step and a star-descent step in the same trail with distinct kinds", () => {
		const sql = "WITH s AS (SELECT * FROM orders), r AS (SELECT customer_id AS cid FROM s) SELECT cid FROM r";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "cid", 2));
		expect(terminals(head!)).toEqual(["orders.customer_id"]);
		expect(head!.via).toEqual([
			{ scope: cteScope(scopes, "r"), kind: "rename" },
			{ scope: cteScope(scopes, "s"), kind: "expand" },
		]);
	});

	// Control: computed chains report hops, not trail — via ABSENT everywhere.
	it("leaves via absent when nothing was collapsed (computed chain)", () => {
		const sql = "WITH a AS (SELECT x+1 AS y FROM t), b AS (SELECT y*2 AS z FROM a) SELECT z FROM b";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "z", 2));
		expect(head!.via).toBeUndefined();
		expect(head!.downstream[0]?.via).toBeUndefined();
	});

	// Mixed: a computed hop reached THROUGH a rename — the trail lands on the consumer side.
	it("attaches the trail of a rename that fronts a computed producer", () => {
		const sql = "WITH a AS (SELECT x*2 AS w FROM t), b AS (SELECT w AS z FROM a) SELECT z FROM b";
		const scopes = scopesOf(sql);
		const head = lineageAt(scopes, offsetOf(sql, "z", 2));
		// head collapses onto a's computed hop; the rename scope b rides its via.
		expect(exprText(sql, head!)).toBe("x*2");
		expect(head!.via).toEqual([{ scope: cteScope(scopes, "b"), kind: "rename" }]);
	});
});
