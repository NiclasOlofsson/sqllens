import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import type { SelectExpr } from "../src/ir/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { resolveColumnRef } from "../src/sema/resolve.js";

function scopeOf(sql: string) {
	return resolveScopes(lower(parseDatabricks(sql).tree));
}

function colOf(sql: string, partsJoined: string) {
	const ir = lower(parseDatabricks(sql).tree);
	const sel = ir.body as SelectExpr;
	const ref = sel.columns.find((c) => c.parts.join(".") === partsJoined);
	if (!ref) throw new Error(`no column ${partsJoined}`);
	return { ref, root: resolveScopes(ir).root };
}

// Find the (scope, ref) for a column anywhere in the scope tree — needed for refs that
// live inside a subquery scope rather than the root.
function findCol(sql: string, partsJoined: string) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	const walk = (s: import("../src/scope/scope.js").Scope): { scope: typeof s; ref: ColumnRefT } | undefined => {
		const ref = (s.body.kind === "pipe" ? [] : s.body.columns).find((c) => c.parts.join(".") === partsJoined);
		if (ref) return { scope: s, ref };
		for (const child of s.children) {
			const found = walk(child);
			if (found) return found;
		}
		return undefined;
	};
	const found = walk(tree.root);
	if (!found) throw new Error(`no column ${partsJoined}`);
	return found;
}
type ColumnRefT = SelectExpr["columns"][number];

describe("resolveScopes", () => {
	it("registers a FROM table as a source keyed by its name", () => {
		const { root } = scopeOf("SELECT a FROM t");
		const src = root.sources.get("t");
		expect(src?.kind).toBe("table");
		if (src?.kind !== "table") throw new Error("expected a table source");
		expect(src.name).toEqual(["t"]);
	});

	it("keys a source by its alias when present", () => {
		const { root } = scopeOf("SELECT a FROM cat.sch.t AS x");
		expect(root.sources.has("x")).toBe(true);
		expect(root.sources.has("t")).toBe(false);
	});

	it("resolves a FROM reference to a CTE as a cte source, not a physical table", () => {
		const { root } = scopeOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c");
		expect(root.sources.get("c")?.kind).toBe("cte");
		expect(root.ctes.has("c")).toBe(true);
	});

	it("computes output columns from the projection list", () => {
		const { root } = scopeOf("SELECT a, b FROM t");
		expect(root.outputs).toEqual(["a", "b"]);
	});

	it("marks outputs unknown when a projection is a star (needs schema)", () => {
		const { root } = scopeOf("SELECT * FROM t");
		expect(root.outputs).toBe("unknown");
	});

	it("exposes a CTE's own output columns through its scope", () => {
		const { root } = scopeOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c");
		expect(root.ctes.get("c")?.scope.outputs).toEqual(["a", "b"]);
	});

	it("uses a CTE's declared column aliases as its outputs, overriding inner names", () => {
		const { root } = scopeOf("WITH c (x, y) AS (SELECT a, b FROM t) SELECT a FROM c");
		expect(root.ctes.get("c")?.scope.outputs).toEqual(["x", "y"]);
	});
});

describe("resolveColumn", () => {
	it("binds a qualified column to its source, case-insensitively", () => {
		const { ref, root } = colOf("SELECT T.a FROM tbl AS t", "T.a");
		expect(resolveColumnRef(root, ref).kind).toBe("bound");
	});

	it("reads x.y over a bare table as possible struct access (needs schema, not unresolved)", () => {
		// Schema-free, `nope` could be a struct column of the bare table `t`, so `nope.a` cannot
		// be proven unresolved without the catalog — it is needs-schema, not a bad qualifier.
		const { ref, root } = colOf("SELECT nope.a FROM tbl AS t", "nope.a");
		expect(resolveColumnRef(root, ref).kind).toBe("needs-schema");
	});

	it("leaves a multi-part ref unresolved when its lead is neither a source nor a known column", () => {
		// `p` exposes only `x`; `nope` is neither a visible source nor a column of `p`, so even
		// read as struct access (nope.a) it cannot bind — genuinely unresolved.
		const { ref, root } = colOf("WITH p AS (SELECT x FROM t) SELECT nope.a FROM p", "nope.a");
		expect(resolveColumnRef(root, ref).kind).toBe("unresolved");
	});

	it("binds an unqualified column to the only source that exposes it (a CTE)", () => {
		const { ref, root } = colOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c", "a");
		expect(resolveColumnRef(root, ref).kind).toBe("bound");
	});

	it("needs a schema for an unqualified column over a physical table", () => {
		const { ref, root } = colOf("SELECT a FROM t", "a");
		expect(resolveColumnRef(root, ref).kind).toBe("needs-schema");
	});

	it("flags an ambiguous unqualified column across two CTEs that both expose it", () => {
		const { ref, root } = colOf(
			"WITH c1 AS (SELECT a FROM t), c2 AS (SELECT a FROM u) SELECT a FROM c1 JOIN c2",
			"a",
		);
		expect(resolveColumnRef(root, ref).kind).toBe("ambiguous");
	});

	it("binds a column to a LATERAL VIEW source", () => {
		const { ref, root } = colOf("SELECT v.col FROM t LATERAL VIEW explode(arr) v AS col", "v.col");
		expect(resolveColumnRef(root, ref).kind).toBe("bound");
	});

	it("binds a qualified struct field access (t.addr.city) to the table, not the field", () => {
		// `t` is the source, `addr` the (struct) column, `city` a field of it. The old flat
		// split read `addr` as the qualifier and reported unresolved — this asserts the fix.
		const { ref, root } = colOf("SELECT t.addr.city FROM people AS t", "t.addr.city");
		expect(resolveColumnRef(root, ref).kind).toBe("bound");
	});

	it("models struct navigation: t.addr.city is column `addr` with field path [city]", () => {
		const { ref, root } = colOf("SELECT t.addr.city FROM people AS t", "t.addr.city");
		const r = resolveColumnRef(root, ref);
		if (r.kind !== "bound") throw new Error(`expected bound, got ${r.kind}`);
		expect(r.column).toBe("addr");
		expect(r.fields).toEqual(["city"]);
	});

	it("binds an unqualified struct field access (addr.city) to the column it navigates", () => {
		// CTE `p` exposes column `addr`; `addr.city` reaches into it. `addr` is not a source,
		// so it must be read as the column, with `city` a field — not as a qualifier.
		const { ref, root } = colOf("WITH p AS (SELECT addr FROM t) SELECT addr.city FROM p", "addr.city");
		const r = resolveColumnRef(root, ref);
		if (r.kind !== "bound") throw new Error(`expected bound, got ${r.kind}`);
		expect(r.column).toBe("addr");
		expect(r.fields).toEqual(["city"]);
	});

	it("resolves a correlated qualified column against an enclosing scope", () => {
		const { scope, ref } = findCol(
			"SELECT (SELECT max(x) FROM inner_t WHERE inner_t.k = o.id) AS m FROM outer_t AS o",
			"o.id",
		);
		expect(resolveColumnRef(scope, ref).kind).toBe("bound");
	});

	it("resolves a SELECT alias referenced in ORDER BY", () => {
		const { scope, ref } = findCol("SELECT p + q AS z FROM t ORDER BY z", "z");
		expect(resolveColumnRef(scope, ref).kind).toBe("alias");
	});

	it("resolves a SELECT alias referenced in GROUP BY", () => {
		const { scope, ref } = findCol("SELECT p AS z FROM t GROUP BY z", "z");
		expect(resolveColumnRef(scope, ref).kind).toBe("alias");
	});

	it("does not treat a bare name in WHERE as a SELECT alias", () => {
		const { scope, ref } = findCol("SELECT p AS z FROM t WHERE z > 0", "z");
		// WHERE cannot see SELECT aliases — z must resolve as a (schema-dependent) column, not an alias.
		expect(resolveColumnRef(scope, ref).kind).not.toBe("alias");
	});

	it("resolves an ORDER BY alias after a UNION against the left branch", () => {
		const { scope, ref } = findCol("SELECT a AS x FROM t UNION ALL SELECT b FROM u ORDER BY x", "x");
		expect(resolveColumnRef(scope, ref).kind).toBe("alias");
	});
});

describe("pivot / unpivot outputs", () => {
	it("computes UNPIVOT outputs: pass-through minus IN columns, plus name + value", () => {
		const { root } = scopeOf(
			"WITH t AS (SELECT k, jan, feb FROM x) SELECT * FROM t UNPIVOT (amt FOR mon IN (jan, feb))",
		);
		expect(root.outputs).toEqual(["k", "mon", "amt"]);
	});

	it("computes PIVOT outputs: pass-through (minus FOR/agg cols) plus pivot values", () => {
		const { root } = scopeOf(
			"WITH t AS (SELECT id, seg, val FROM x) SELECT * FROM t PIVOT (max(val) FOR seg IN ('a' AS a, 'b' AS b))",
		);
		expect(root.outputs).toEqual(["id", "a", "b"]);
	});
});
