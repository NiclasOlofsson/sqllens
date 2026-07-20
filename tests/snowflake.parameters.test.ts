import { describe, expect, it } from "vitest";
import type { Expr } from "../src/ir/ir.js";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { referencesAt } from "../src/references/references.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

// Snowflake bind variables `?` (positional) and `:name` (named) as general scalar value expressions:
// docs.snowflake.com/en/sql-reference/bind-variables. The DELICATE part is the grammar's pre-existing
// infix `expr COLON expr` variant-path access (`v:a`): a PREFIX `:name` primary must not disturb it.
// These tests pin (1) the variant path unchanged, (2) both bind forms lowering to the shared
// `parameter` IR, (3) the two known-bad corpus files' shapes, and (4) the semantic-layer consumers.

function ir(sql: string): { q: ReturnType<typeof lower>; errors: number } {
	const { tree, errors } = parseSnowflake(sql);
	return { q: lower(tree), errors };
}

function firstProjection(sql: string): Expr {
	const { q, errors } = ir(sql);
	expect(errors).toBe(0);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	const p = q.body.projections[0];
	if (!p) throw new Error("no projection");
	return p.expr;
}

/** First `parameter` node anywhere in an expression tree (depth-first), or undefined. */
function findParameter(e: Expr | undefined): Extract<Expr, { kind: "parameter" }> | undefined {
	if (!e) return undefined;
	if (e.kind === "parameter") return e;
	const kids: (Expr | undefined)[] = [];
	const anyE = e as Record<string, unknown>;
	for (const k of ["left", "right", "operand", "expr", "base", "index", "end", "step", "result"]) {
		const v = anyE[k];
		if (v && typeof v === "object" && "kind" in (v as object)) kids.push(v as Expr);
	}
	if (Array.isArray(anyE.args)) kids.push(...(anyE.args as Expr[]));
	if (Array.isArray(anyE.whens))
		for (const w of anyE.whens as { when: Expr; then: Expr }[]) kids.push(w.when, w.then);
	for (const k of kids) {
		const hit = findParameter(k);
		if (hit) return hit;
	}
	return undefined;
}

describe("Snowflake variant-colon path is unchanged by the bind-variable prefix", () => {
	// The infix `expr COLON expr` variant path (docs.snowflake.com/en/sql-reference/querying-semistructured):
	// `v:a` stays a subscript (semi-structured access), NOT a parameter: the prefix `:name` primary
	// only triggers when COLON is at expr-start, never after an expression.
	it("v:a lowers to a variant subscript, not a parameter", () => {
		const e = firstProjection("SELECT v:a FROM t");
		expect(e.kind).toBe("subscript");
	});

	it("v:a.b::string lowers to a cast over a variant subscript (unchanged)", () => {
		const e = firstProjection("SELECT v:a.b::string FROM t");
		expect(e.kind).toBe("cast");
		if (e.kind !== "cast") return;
		expect(e.expr.kind).toBe("subscript");
		expect(e.typeText.toLowerCase()).toBe("string");
	});
});

describe("Snowflake bind variables as scalar expressions", () => {
	it("statement-initial :name is a named parameter", () => {
		expect(firstProjection("SELECT :a FROM t")).toMatchObject({ kind: "parameter", text: ":a", name: "a" });
	});

	it("? is a positional parameter with no name/ordinal", () => {
		const e = firstProjection("SELECT ? FROM t");
		expect(e).toMatchObject({ kind: "parameter", text: "?" });
		if (e.kind !== "parameter") return;
		expect(e.name).toBeUndefined();
		expect(e.ordinal).toBeUndefined();
	});

	it(":name in WHERE lowers to a parameter operand", () => {
		const { q, errors } = ir("SELECT a FROM t WHERE x > :b");
		expect(errors).toBe(0);
		if (q.body.kind !== "select") throw new Error("expected select");
		expect(q.body.where?.kind).toBe("binary");
		expect(findParameter(q.body.where)).toMatchObject({ kind: "parameter", text: ":b", name: "b" });
	});

	// --- the two known-bad corpus files graduate here ---------------------------------------------
	// identifier-literal/15.sql and bind-variables/15.sql each had ONE statement using `?`/`:name` as
	// a general value expression (the IDENTIFIER(?) object-name slots already parsed; these did not).

	it("INSERT ... VALUES (?), (?), (?) parses clean (identifier-literal/15.sql)", () => {
		expect(parseSnowflake("INSERT INTO t VALUES (?), (?), (?)").errors).toBe(0);
	});

	it("WHERE t1.c1 > (?) parses clean and lowers the ? to a positional parameter (identifier-literal/15.sql)", () => {
		const { q, errors } = ir("SELECT t2.c1 FROM t1, t2 WHERE t1.c1 = t2.c1 AND t1.c1 > (?)");
		expect(errors).toBe(0);
		if (q.body.kind !== "select") throw new Error("expected select");
		expect(findParameter(q.body.where)).toMatchObject({ kind: "parameter", text: "?" });
	});

	it("CONCAT('Hello ', :NAME, '!') lowers :NAME to a parameter in the call args (bind-variables/15.sql)", () => {
		const e = firstProjection("SELECT CONCAT('Hello ', :NAME, '!') AS greeting FROM t");
		expect(e.kind).toBe("function");
		if (e.kind !== "function") return;
		expect(e.args.find((a) => a.kind === "parameter")).toMatchObject({
			kind: "parameter",
			text: ":NAME",
			name: "NAME",
		});
	});

	it("the whole identifier-literal/15.sql multi-statement batch parses clean", () => {
		const sql = `USE SCHEMA IDENTIFIER(?);
CREATE OR REPLACE TABLE IDENTIFIER(?) (c1 NUMBER);
INSERT INTO IDENTIFIER(?) values (?), (?), (?);
SELECT t2.c1
  FROM IDENTIFIER(?) AS t1,
       IDENTIFIER(?) AS t2
  WHERE t1.c1 = t2.c1 AND t1.c1 > (?);
DROP TABLE IDENTIFIER(?);`;
		expect(parseSnowflake(sql).errors).toBe(0);
	});

	it("the DECLARE/BEGIN scripting block with :NAME/:TEMPERATURE parses clean (bind-variables/15.sql)", () => {
		const sql = `DECLARE
  name STRING;
  temperature FLOAT;
  res RESULTSET;
BEGIN
  name := 'Snowman';
  temperature := -20.14;
  res := (
    SELECT
      CONCAT('Hello ', :NAME, '!') as greeting,
      CONCAT('It is ', :TEMPERATURE, 'deg C today.') as weather
  );
  RETURN LAST_QUERY_ID();
END;`;
		expect(parseSnowflake(sql).errors).toBe(0);
	});
});

describe("Snowflake bind variables in the semantic layer", () => {
	it("deriveSymbols + referencesAt group two :x occurrences as one parameter", () => {
		const { q, errors } = ir("SELECT :x AS a FROM t WHERE b = :x");
		expect(errors).toBe(0);
		const scopes = resolveScopes(q, "snowflake");

		const paramSyms = deriveSymbols(scopes).filter((s) => s.kind === "parameter");
		expect(paramSyms).toHaveLength(2);
		expect(paramSyms.every((s) => s.name === "x")).toBe(true);
		expect(paramSyms.every((s) => s.modifiers.includes("reference"))).toBe(true);

		// referencesAt on the first :x groups BOTH occurrences (document-wide, by kind + name).
		if (q.body.kind !== "select") throw new Error("expected select");
		const first = q.body.projections[0].expr;
		expect(first.kind).toBe("parameter");
		const offset = first.cst.start!.start;
		const occ = referencesAt(scopes, offset, undefined, q);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.symbol).toBe("x");
		expect(occ!.occurrences).toHaveLength(2);
	});

	it("schema-attached analyze fires no unknown-column on a :x parameter", () => {
		const { q, errors } = ir("SELECT c1 FROM t WHERE c1 > :x");
		expect(errors).toBe(0);
		const scopes = resolveScopes(q, "snowflake");
		const schema = new Schema({ t: { c1: "number" } });
		const kinds = qualify(scopes, schema).diagnostics.map((d) => d.kind);
		expect(kinds).not.toContain("unknown-column");
	});
});
