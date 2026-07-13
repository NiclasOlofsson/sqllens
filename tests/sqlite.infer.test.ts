import { describe, it, expect } from "vitest";
import { parseSqlite } from "../src/sqlite/parse.js";
import { lower } from "../src/sqlite/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { sqliteLiteral, sqliteParseType, SQLITE_FUNCTION_RETURNS } from "../src/sqlite/infer.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

// R5.1 wiring gate: proves inferDialect("sqlite") actually resolves to sqlite's own InferDialect
// (division mode + function registry), not the Databricks fallback every unregistered dialect
// silently gets (src/infer/dialect.ts's inferDialect() default).

describe("sqlite division wiring", () => {
	it("integer / integer truncates toward zero (lang_expr.html), proving the sqlite InferDialect is live", () => {
		const sql = "SELECT a / b AS r FROM t";
		const scopes = resolveScopes(lower(parseSqlite(sql).tree), "sqlite");
		// "int" (not "INTEGER"): SQLITE_ALIASES is deliberately empty (column-type affinity is a
		// distinct, not-yet-built algorithm — see sqliteParseType's doc comment), so a declared
		// "INTEGER" column type would parse to the unmapped scalar name "integer", not "int". Using
		// the already-canonical "int" isolates this probe to the division-mode wiring alone.
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const body = scopes.root.body as any;
		const div = body.projections[0].expr;
		// If this fell through to the Databricks default, int/int division would widen to double
		// instead of staying int — so this assertion only holds when sqlite's own "integer"
		// division mode (not databricks's "float") is actually selected.
		expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "int" });
	});
});

describe("sqlite literal typing", () => {
	it("types a bare integer as int, a decimal-point literal as double (no NUMERIC/DECIMAL storage class)", () => {
		expect(sqliteLiteral("42")).toEqual(scalar("int"));
		expect(sqliteLiteral("1.5")).toEqual(scalar("double"));
	});
	it("types TRUE/FALSE as int (literal aliases for 1/0, not a boolean type)", () => {
		expect(sqliteLiteral("TRUE")).toEqual(scalar("int"));
		expect(sqliteLiteral("FALSE")).toEqual(scalar("int"));
	});
	it("types a blob literal (X'...') as binary", () => {
		expect(sqliteLiteral("X'ABCD'")).toEqual(scalar("binary"));
	});
	it("NULL is unknown, never guessed", () => {
		expect(sqliteLiteral("NULL")).toEqual(UNKNOWN);
	});
});

describe("sqlite scalar type parsing", () => {
	it("passes declared column type text straight through unaliased (no fixed affinity alias table)", () => {
		// SQLite matches a declared type name against a substring pattern to pick a type AFFINITY
		// (datatype3.html §3.1), not a fixed alias table — SQLITE_ALIASES is deliberately empty, so
		// an arbitrary declared type name (e.g. "INTEGER") normalizes only by lower-casing.
		expect(sqliteParseType("INTEGER")).toEqual({ kind: "scalar", name: "integer" });
	});
});

describe("sqlite function registry", () => {
	const rule = (name: string, args: ReturnType<typeof scalar>[] = []) => SQLITE_FUNCTION_RETURNS[name]?.(args);

	it("count/random are bigint (both documented across the full 64-bit signed range)", () => {
		expect(rule("count")).toEqual(scalar("bigint"));
		expect(rule("random")).toEqual(scalar("bigint"));
	});
	it("round/total/avg/julianday are always real, per their own doc pages (not input-typed like other dialects' AVG)", () => {
		expect(rule("round", [scalar("int")])).toEqual(scalar("double"));
		expect(rule("total", [scalar("int")])).toEqual(scalar("double"));
		expect(rule("avg", [scalar("int")])).toEqual(scalar("double"));
		expect(rule("julianday")).toEqual(scalar("double"));
	});
	it("sum widens int->bigint, keeps double as double (lang_aggfunc.html: integer iff all inputs integer)", () => {
		expect(rule("sum", [scalar("int")])).toEqual(scalar("bigint"));
		expect(rule("sum", [scalar("double")])).toEqual(scalar("double"));
	});
	it("abs is a numeric passthrough of its argument's type", () => {
		expect(rule("abs", [scalar("int")])).toEqual(scalar("int"));
		expect(rule("abs", [scalar("double")])).toEqual(scalar("double"));
	});
	it('sign is always int, regardless of a REAL or INTEGER argument ("-1, 0, or +1")', () => {
		expect(rule("sign", [scalar("double")])).toEqual(scalar("int"));
		expect(rule("sign", [scalar("int")])).toEqual(scalar("int"));
	});
	it("upper/lower/typeof/hex are text", () => {
		expect(rule("upper")).toEqual(scalar("string"));
		expect(rule("lower")).toEqual(scalar("string"));
		expect(rule("typeof")).toEqual(scalar("string"));
		expect(rule("hex")).toEqual(scalar("string"));
	});
	it("unhex/zeroblob/randomblob are blob", () => {
		expect(rule("unhex")).toEqual(scalar("binary"));
		expect(rule("zeroblob")).toEqual(scalar("binary"));
		expect(rule("randomblob")).toEqual(scalar("binary"));
	});
	it("coalesce/ifnull take the common type of their arguments", () => {
		expect(rule("coalesce", [scalar("int"), scalar("int")])).toEqual(scalar("int"));
		expect(rule("ifnull", [scalar("string"), scalar("int")])).toEqual(UNKNOWN); // disagreeing families -> unknown, never a guess
	});
	it("absent-by-contract: max/min (dual scalar/aggregate ambiguity) and unixepoch (modifier-dependent) stay unregistered", () => {
		expect(SQLITE_FUNCTION_RETURNS["max"]).toBeUndefined();
		expect(SQLITE_FUNCTION_RETURNS["min"]).toBeUndefined();
		expect(SQLITE_FUNCTION_RETURNS["unixepoch"]).toBeUndefined();
	});
});
