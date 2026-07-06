import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferNullability, type Nullability } from "../src/infer/nullability.js";
import { Schema } from "../src/qualify/schema.js";
import type { SchemaProvider } from "../src/qualify/schema-provider.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// ---------------------------------------------------------------------------
// Nullability inference (Task 10) — a parallel walk beside type inference that
// computes "notnull" | "nullable" | "unknown" from expression shape + schema +
// join shape. NEVER-WRONG: a definite verdict only when provable; "unknown" on
// any doubt. No flow narrowing (WHERE x IS NOT NULL does not upgrade x) — an
// inherent boundary of this stage (a tracked open gap).
// ---------------------------------------------------------------------------

// A physical catalog with per-column NOT NULL-ness declared via the Task-9 leaf form.
const SCHEMA = new Schema({
	t: { nn: { type: "int", nullable: false }, nl: { type: "int", nullable: true }, plain: "int" },
	t1: { a: { type: "int", nullable: false } },
	t2: { b: { type: "int", nullable: false } },
});
const EMPTY = new Schema({});

/** Nullability of each projection of a single-SELECT statement. */
function proj(sql: string, schema: SchemaProvider = SCHEMA): Nullability[] {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree), "databricks");
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected a select");
	return body.projections.map((p) => inferNullability(p.expr, tree.root, schema));
}

const one = (sql: string, schema: SchemaProvider = SCHEMA): Nullability => proj(sql, schema)[0];

/** Same as `one` but through the T-SQL pipeline — for the dialect-polymorphic cases (2-arg ISNULL). */
function oneTSql(sql: string, schema: SchemaProvider = SCHEMA): Nullability {
	const tree = resolveScopes(lowerTSql(parseTSql(sql).tree), "tsql");
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected a select");
	return inferNullability(body.projections[0].expr, tree.root, schema);
}

describe("nullability — literals", () => {
	it("NULL literal is nullable; every other literal is notnull", () => {
		expect(one("SELECT NULL")).toBe("nullable");
		expect(one("SELECT 5")).toBe("notnull");
		expect(one("SELECT 'x'")).toBe("notnull");
		expect(one("SELECT 3.14")).toBe("notnull");
		expect(one("SELECT true")).toBe("notnull");
	});
});

describe("nullability — column refs against the schema", () => {
	it("NOT NULL column → notnull; nullable column → nullable; undeclared → unknown", () => {
		expect(one("SELECT nn FROM t")).toBe("notnull");
		expect(one("SELECT nl FROM t")).toBe("nullable");
		expect(one("SELECT plain FROM t")).toBe("unknown"); // nullable absent = unknown, never guessed
	});

	it("unknown table / unknown column → unknown", () => {
		expect(one("SELECT nn FROM unknown_tbl")).toBe("unknown");
		expect(one("SELECT nope FROM t")).toBe("unknown");
	});

	it("no schema → unknown everywhere", () => {
		expect(one("SELECT nn FROM t", EMPTY)).toBe("unknown");
		expect(one("SELECT nl FROM t", EMPTY)).toBe("unknown");
	});

	it("struct-field navigation on a column → unknown (nested nullability unknown)", () => {
		expect(one("SELECT nn.field FROM t")).toBe("unknown");
	});
});

describe("nullability — cast passes through its operand", () => {
	it("cast keeps the operand's nullability", () => {
		expect(one("SELECT CAST(nn AS bigint) FROM t")).toBe("notnull");
		expect(one("SELECT CAST(nl AS bigint) FROM t")).toBe("nullable");
		expect(one("SELECT CAST(NULL AS int)")).toBe("nullable");
		expect(one("SELECT CAST(plain AS int) FROM t")).toBe("unknown");
	});
});

describe("nullability — arithmetic & comparison fold (SQL null propagation)", () => {
	it("notnull if ALL operands notnull, nullable if ANY nullable, else unknown", () => {
		expect(one("SELECT nn + 1 FROM t")).toBe("notnull");
		expect(one("SELECT nn + nl FROM t")).toBe("nullable");
		expect(one("SELECT nn + plain FROM t")).toBe("unknown");
		expect(one("SELECT nl + plain FROM t")).toBe("nullable"); // any nullable wins
	});

	it("comparison folds the same way", () => {
		expect(one("SELECT nn = 1 FROM t")).toBe("notnull");
		expect(one("SELECT nn = nl FROM t")).toBe("nullable");
		expect(one("SELECT nn = plain FROM t")).toBe("unknown");
	});

	it("null-safe equality <=> never returns NULL — notnull regardless of operands", () => {
		expect(one("SELECT nl <=> 1 FROM t")).toBe("notnull");
		expect(one("SELECT nl <=> plain FROM t")).toBe("notnull");
	});

	it("boolean AND/OR: notnull only when BOTH sides are notnull (three-valued otherwise)", () => {
		expect(one("SELECT (nn = 1) AND (nn = 2) FROM t")).toBe("notnull");
		expect(one("SELECT (nn = 1) OR (nn = 2) FROM t")).toBe("notnull");
		// A nullable side does NOT make the result nullable (NULL AND FALSE → FALSE) — unknown.
		expect(one("SELECT (nl = 1) AND (nn = 2) FROM t")).toBe("unknown");
	});

	it("unary passes through the operand", () => {
		expect(one("SELECT -nn FROM t")).toBe("notnull");
		expect(one("SELECT -nl FROM t")).toBe("nullable");
		expect(one("SELECT NOT (nl = 1) FROM t")).toBe("nullable");
	});
});

describe("nullability — CASE", () => {
	it("no ELSE → nullable (unmatched rows produce NULL)", () => {
		expect(one("SELECT CASE WHEN nn = 1 THEN nn END FROM t")).toBe("nullable");
	});

	it("with ELSE → fold the branch results", () => {
		expect(one("SELECT CASE WHEN nn = 1 THEN nn ELSE 0 END FROM t")).toBe("notnull");
		expect(one("SELECT CASE WHEN nn = 1 THEN nl ELSE 0 END FROM t")).toBe("nullable");
		expect(one("SELECT CASE WHEN nn = 1 THEN nn ELSE plain END FROM t")).toBe("unknown");
	});
});

describe("nullability — the function table (doc-cited)", () => {
	it("coalesce/ifnull/nvl → notnull if any arg notnull, nullable if all args nullable, else unknown", () => {
		expect(one("SELECT coalesce(nl, nn) FROM t")).toBe("notnull");
		expect(one("SELECT coalesce(nl, NULL) FROM t")).toBe("nullable");
		expect(one("SELECT coalesce(nl, plain) FROM t")).toBe("unknown"); // an unknown arg might be notnull
		expect(one("SELECT ifnull(nl, nn) FROM t")).toBe("notnull");
		expect(one("SELECT nvl(nl, nn) FROM t")).toBe("notnull");
	});

	it("isnull is arity-gated: the 1-arg predicate form (Spark isnull(expr)) is NEVER NULL", () => {
		// spark.apache.org/docs/latest/api/sql/#isnull — returns true/false, even for a NULL input.
		expect(one("SELECT isnull(nl) FROM t")).toBe("notnull");
		expect(one("SELECT isnull(plain) FROM t")).toBe("notnull"); // input nullability is irrelevant
	});

	it("isnull 2-arg (T-SQL replacement form) folds coalesce-like", () => {
		// learn.microsoft.com/sql/t-sql/functions/isnull-transact-sql — ISNULL(check, replacement).
		// The T-SQL IR delivers it as a plain 2-arg function node (pinned by the probe: name ISNULL,
		// args.length 2), so the table's arity gate routes it to coalesceLike.
		expect(oneTSql("SELECT ISNULL(nl, 0) FROM t")).toBe("notnull"); // replacement literal is notnull
		expect(oneTSql("SELECT ISNULL(nl, NULL) FROM t")).toBe("nullable"); // both args nullable
	});

	it("nullif is always nullable", () => {
		expect(one("SELECT nullif(nn, 1) FROM t")).toBe("nullable");
	});

	it("count / count_if are notnull", () => {
		expect(one("SELECT count(*) FROM t")).toBe("notnull");
		expect(one("SELECT count(nl) FROM t")).toBe("notnull");
		expect(one("SELECT count_if(nn = 1) FROM t")).toBe("notnull");
	});

	it("sum/avg/min/max and other aggregates are nullable (empty / all-NULL groups)", () => {
		expect(one("SELECT sum(nn) FROM t")).toBe("nullable");
		expect(one("SELECT avg(nn) FROM t")).toBe("nullable");
		expect(one("SELECT min(nn) FROM t")).toBe("nullable");
		expect(one("SELECT max(nn) FROM t")).toBe("nullable");
		expect(one("SELECT stddev(nn) FROM t")).toBe("nullable"); // an "other aggregate"
	});

	it("current_date / current_timestamp / now are notnull", () => {
		expect(one("SELECT current_timestamp() FROM t")).toBe("notnull");
		expect(one("SELECT now() FROM t")).toBe("notnull");
	});

	it("an unregistered scalar function → unknown (never guessed)", () => {
		expect(one("SELECT some_udf(nn) FROM t")).toBe("unknown");
	});
});

describe("nullability — outer-join null extension", () => {
	it("LEFT JOIN: the right source's NOT NULL column becomes nullable; the left stays notnull", () => {
		const [a, b] = proj("SELECT t1.a, t2.b FROM t1 LEFT JOIN t2 ON t1.a = t2.b");
		expect(a).toBe("notnull"); // t1 is the preserved side
		expect(b).toBe("nullable"); // t2 is null-extended
	});

	it("RIGHT JOIN: the left source's NOT NULL column becomes nullable; the right stays notnull", () => {
		const [a, b] = proj("SELECT t1.a, t2.b FROM t1 RIGHT JOIN t2 ON t1.a = t2.b");
		expect(a).toBe("nullable");
		expect(b).toBe("notnull");
	});

	it("FULL JOIN: both sides become nullable", () => {
		const [a, b] = proj("SELECT t1.a, t2.b FROM t1 FULL JOIN t2 ON t1.a = t2.b");
		expect(a).toBe("nullable");
		expect(b).toBe("nullable");
	});

	it("INNER JOIN: neither side is null-extended", () => {
		const [a, b] = proj("SELECT t1.a, t2.b FROM t1 JOIN t2 ON t1.a = t2.b");
		expect(a).toBe("notnull");
		expect(b).toBe("notnull");
	});
});

describe("nullability — through a CTE", () => {
	it("the same NOT NULL column keeps its verdict through a CTE", () => {
		expect(one("WITH c AS (SELECT nn FROM t) SELECT nn FROM c")).toBe("notnull");
		expect(one("WITH c AS (SELECT nl AS x FROM t) SELECT x FROM c")).toBe("nullable");
	});

	it("a NOT NULL column through a CTE that is then LEFT-joined becomes nullable", () => {
		const sql = "WITH c AS (SELECT nn FROM t) SELECT t1.a, c.nn FROM t1 LEFT JOIN c ON t1.a = c.nn";
		const [a, cnn] = proj(sql);
		expect(a).toBe("notnull");
		expect(cnn).toBe("nullable"); // c sits on the null-extended side
	});

	it("recursion is cycle-guarded (a self-referential CTE does not hang)", () => {
		const sql = "WITH RECURSIVE c AS (SELECT nn FROM t UNION ALL SELECT nn FROM c) SELECT nn FROM c";
		expect(() => one(sql)).not.toThrow();
	});
});
