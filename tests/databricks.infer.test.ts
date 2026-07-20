import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferType } from "../src/infer/infer.js";
import { formatType } from "../src/infer/types.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// Exact unit pins for the 2026-07-19 Spark-goldens fix wave (issue #40): every corrected
// rule class gets a qualitative expectation here, in tier 1, with no corpus dependency.
// Each type is engine-verified (apache/spark sql-tests goldens at v4.2.0) and doc-cited at
// the rule site in src/databricks/infer.ts / src/infer/infer.ts. The tier-2 goldens gate
// (tests/corpus/databricks.sqltests.test.ts) is the volume backstop; THESE are the contract.

const SCHEMA = new Schema({ t: { a: "int", big: "bigint", s: "string", f: "float", dec: "decimal" } });

/** formatType of every projection of `sql` (databricks), joined for compact assertions. */
function types(sql: string): string[] {
	const scopes = resolveScopes(lower(parseDatabricks(sql).tree), "databricks");
	const body = scopes.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return body.projections.map((p) => formatType(inferType(p.expr, scopes.root, SCHEMA)));
}

describe("databricks literals", () => {
	it("sizes integral literals by magnitude (int / bigint / decimal)", () => {
		expect(types("select 5, 2147483648, 9223372036854775808")).toEqual(["int", "bigint", "decimal"]);
	});
	it("types decimal-point literals DECIMAL, exponents DOUBLE, suffixes by suffix", () => {
		expect(types("select 2.5, 6.8e0, 2.5D, 2.5F, 10L, 5S, 5Y, 1.5BD")).toEqual([
			"decimal",
			"double",
			"double",
			"float",
			"bigint",
			"smallint",
			"tinyint",
			"decimal",
		]);
	});
	it("types unquoted-form interval (qualified) and ntz/ltz timestamp literals", () => {
		expect(types("select interval 2 year, timestamp_ntz'2021-01-01 00:00:00'")).toEqual([
			"interval year",
			"timestamp",
		]);
	});
	it("derives the qualified interval family and unit range from the literal", () => {
		expect(
			types(
				"select interval '2-1' year to month, interval 2 years 4 months, interval '20 15:40' day to minute, interval 3 week 8 millisecond 9 microsecond, interval '1 day'",
			),
		).toEqual([
			"interval year to month",
			"interval year to month",
			"interval day to minute",
			"interval day to second",
			"interval day",
		]);
	});
});

describe("databricks arithmetic operators", () => {
	it("div is integral division returning BIGINT", () => {
		expect(types("select 5 div 2, cast(51 as decimal(10,0)) div cast(2 as decimal(2,0))")).toEqual([
			"bigint",
			"bigint",
		]);
	});
	it("float division: decimal-with-exact stays decimal, approximate wins, int/int is double", () => {
		expect(types("select 1/2, 1/0.5, 2.5/0.5, cast(1 as double)/0.5")).toEqual([
			"double",
			"decimal",
			"decimal",
			"double",
		]);
	});
	it("float-with-decimal promotes to DOUBLE (approximate dominates)", () => {
		expect(types("select f + 100.0, 2.35E10 * 1.0 from t")).toEqual(["double", "double"]);
	});
	it("interval arithmetic carries the qualified type; ×/÷ widen to the full family range", () => {
		// × / ÷ numeric → the family's default full range (Spark Multiply/DivideInterval); + / - →
		// the union of the operands' unit ranges; date-date → interval day, timestamp-timestamp →
		// interval day to second.
		expect(
			types(
				"select interval 2 year * 2, interval '2' second / 2, interval '1' day + interval '1' hour, date '2001-10-01' - date '2001-09-28', timestamp'2011-11-11 11:11:11' - timestamp'2011-11-11 11:11:10'",
			),
		).toEqual([
			"interval year to month",
			"interval day to second",
			"interval day to hour",
			"interval day",
			"interval day to second",
		]);
	});
	it("timestamp ± interval keeps timestamp; date ± interval is flavor-dependent → unknown", () => {
		expect(types("select timestamp'2011-11-11' + interval '1' hour, date'2011-11-11' + interval '1' hour")).toEqual(
			["timestamp", "unknown"],
		);
	});
	it("unary functions crosscast a string argument to DOUBLE", () => {
		expect(types("select positive('25.5'), abs('-2.19'), abs(a), negative(a) from t")).toEqual([
			"double",
			"double",
			"int",
			"int",
		]);
	});
});

describe("databricks function registry (Spark-goldens fix wave)", () => {
	it("ceil/floor: scale-arg form and DECIMAL input are DECIMAL, else BIGINT", () => {
		expect(
			types("select ceil(2.5), ceil(2.5, 0), ceil(cast(1.5 as double)), floor(a), floor(a, -1) from t"),
		).toEqual(["decimal", "decimal", "bigint", "bigint", "decimal"]);
	});
	it("date_add family: 2-arg forms return DATE, unit forms return TIMESTAMP", () => {
		expect(
			types(
				"select date_add(date'2011-11-11', 1), date_sub(date'2011-11-11', 1), add_months(date'2011-11-11', 1), dateadd(MINUTE, -100, date'2022-02-25'), timestampadd(HOUR, 1, timestamp'2022-02-25 00:00:00')",
			),
		).toEqual(["date", "date", "date", "timestamp", "timestamp"]);
	});
	it("datediff: 2-arg is INT, unit form is BIGINT", () => {
		expect(
			types(
				"select datediff(date'2011-11-12', date'2011-11-11'), datediff(MICROSECOND, timestamp'2022-02-25 01:02:03', timestamp'2022-02-25 01:02:04')",
			),
		).toEqual(["int", "bigint"]);
	});
	it("bit functions: getbit/bit_get TINYINT, bit_count INT; array_position BIGINT", () => {
		expect(
			types("select getbit(11L, 3), bit_get(11L, 3), bit_count(big), array_position(array(1,2), 2) from t"),
		).toEqual(["tinyint", "tinyint", "int", "bigint"]);
	});
	it("type-named converters return their type", () => {
		expect(types("select smallint(a), tinyint(a), float(s) from t")).toEqual(["smallint", "tinyint", "float"]);
	});
	it("sign/signum are DOUBLE whatever the input", () => {
		expect(types("select sign(-8), signum(interval '-10' year)")).toEqual(["double", "double"]);
	});
	it("avg/mean keep DECIMAL and interval inputs, else DOUBLE", () => {
		expect(types("select avg(a), avg(dec), mean(a) from t")).toEqual(["double", "decimal", "double"]);
	});
	it("zeroifnull widens with the INT zero", () => {
		expect(types("select zeroifnull(cast(1 as tinyint)), zeroifnull(big) from t")).toEqual(["int", "bigint"]);
	});
	it("uniform follows min/max; a NULL bound abstains", () => {
		expect(types("select uniform(10, 20), uniform(10, 20.0F, 0), uniform(NULL, 1, 0)")).toEqual([
			"int",
			"float",
			"unknown",
		]);
	});
	it("percentile_disc abstains (its result follows the WITHIN GROUP operand)", () => {
		expect(types("select percentile_disc(0.5) within group (order by a) from t")).toEqual(["unknown"]);
	});
	it("try_* arithmetic: interval-aware (×/÷ widen), date±interval abstains, try_divide mirrors /", () => {
		expect(
			types(
				"select try_add(a, 1), try_multiply(interval 2 year, 2), try_add(date'2021-01-01', interval 2 second), try_divide(1, 0.5), try_divide(interval 2 second, 2) from t",
			),
		).toEqual(["int", "interval year to month", "unknown", "decimal", "interval day to second"]);
	});
	it("try_add/try_subtract of two intervals is the union of their unit ranges", () => {
		expect(
			types(
				"select try_add(interval 2 year, interval 2 year), try_subtract(interval 2 year, interval 3 year), make_ym_interval(1, 2), make_dt_interval(1, 2, 3), make_interval(1, 2, 3)",
			),
		).toEqual(["interval year", "interval year", "interval year to month", "interval day to second", "interval"]);
	});
});

describe("databricks date_part / datepart (field-value + source-type keyed)", () => {
	it("date/timestamp sources: second family DECIMAL, other fields INT, NULL field DOUBLE", () => {
		expect(
			types(
				"select date_part('YEAR', date'2011-11-11'), date_part('SECOND', timestamp'2011-11-11 11:11:11'), date_part(NULL, date'2011-11-11')",
			),
		).toEqual(["int", "decimal", "double"]);
	});
	it("interval sources: month family TINYINT, second family DECIMAL, others abstain", () => {
		expect(
			types(
				"select date_part('MONTH', interval '2-1' YEAR TO MONTH), date_part('SECOND', interval '1 2:3:4' DAY TO SECOND), date_part('YEAR', interval '2-1' YEAR TO MONTH)",
			),
		).toEqual(["tinyint", "decimal", "unknown"]);
	});
	it("a non-literal field or a non-datetime source abstains", () => {
		expect(types("select date_part(s, date'2011-11-11'), date_part('YEAR', a) from t")).toEqual([
			"unknown",
			"unknown",
		]);
	});
});

describe("databricks cast chains and type texts", () => {
	it("a chained/nested cast types by ITS OWN target, not the inner one", () => {
		expect(types("select '2147483648' :: long :: int, cast(cast('inf' as double) as timestamp)")).toEqual([
			"int",
			"timestamp",
		]);
	});
	it("time without time zone folds to time; time subtraction yields interval hour to second", () => {
		expect(
			types("select cast('12:34:56' as time without time zone), cast('23:59' as time) - cast('00:00' as time)"),
		).toEqual(["time", "interval hour to second"]);
	});
	it("a cast to a qualified interval canonicalizes the whitespace-stripped type text", () => {
		expect(
			types(
				"select cast(1Y as interval year), cast(-122S as interval year to month), -10L :: interval second, cast('x' as interval day to second)",
			),
		).toEqual(["interval year", "interval year to month", "interval second", "interval day to second"]);
	});
});

describe("databricks from_json / from_csv schema strings", () => {
	it("a DDL field list is an implicit struct; a bare type string stays a type", () => {
		expect(
			types(
				"select from_json(s, 'd date, t timestamp'), from_json(s, 'time TIME(0)'), from_json(s, 'array<int>'), from_csv(s, 'a INT, b string') from t",
			),
		).toEqual(["struct<d:date,t:timestamp>", "struct<time:time>", "array<int>", "struct<a:int,b:string>"]);
	});
});

describe("databricks type vocabulary is CLOSED", () => {
	// The dialect can only ever produce these scalar names. A rule (or an alias gap in
	// parseType, which fabricates scalar(name) for an unrecognized name) emitting anything
	// else is a defect — the class the Spark-goldens gate caught as `timetime`/
	// `timewithouttimezone` mushed scalars.
	const VOCAB = new Set([
		"string",
		"int",
		"bigint",
		"smallint",
		"tinyint",
		"double",
		"float",
		"decimal",
		"boolean",
		"date",
		"timestamp",
		"time",
		"interval",
		"binary",
		"variant",
		"geometry",
		"geography",
		// Qualified ANSI intervals (year-month + day-time families); the registry emits the
		// full-range names, the literal/cast/coerce paths any of the rest.
		"interval year",
		"interval month",
		"interval year to month",
		"interval day",
		"interval hour",
		"interval minute",
		"interval second",
		"interval day to hour",
		"interval day to minute",
		"interval day to second",
		"interval hour to minute",
		"interval hour to second",
		"interval minute to second",
	]);
	const scalarNames = (t: ReturnType<typeof inferType>): string[] => {
		if (t.kind === "scalar") return [t.name];
		if (t.kind === "array") return scalarNames(t.element);
		if (t.kind === "map") return [...scalarNames(t.key), ...scalarNames(t.value)];
		if (t.kind === "struct") return t.fields.flatMap((f) => scalarNames(f.type));
		return [];
	};

	it("every registry rule emits only vocabulary types for representative inputs", async () => {
		const { DATABRICKS_FUNCTION_RETURNS } = await import("../src/databricks/infer.js");
		const { scalar: sc, UNKNOWN } = await import("../src/infer/types.js");
		const probes = [
			[],
			[UNKNOWN],
			[sc("int")],
			[sc("string")],
			[sc("decimal")],
			[sc("double")],
			[sc("interval"), sc("int")],
			[sc("string"), sc("string"), sc("string")],
		];
		for (const [name, rule] of Object.entries(DATABRICKS_FUNCTION_RETURNS)) {
			for (const args of probes) {
				for (const n of scalarNames(rule(args))) {
					expect(VOCAB.has(n), `${name}(${args.map((a) => formatType(a)).join(",")}) emitted '${n}'`).toBe(
						true,
					);
				}
			}
		}
	});
});

describe("IDENTIFIER('literal') resolves like a plain column end-to-end", () => {
	it("qualifies and types IDENTIFIER('a') against the schema, same as a plain `a`", () => {
		expect(types("select IDENTIFIER('a') from t")).toEqual(types("select a from t"));
		expect(types("select IDENTIFIER('a') from t")).toEqual(["int"]);
	});
});

describe("databricks multi-row VALUES (SelectExpr.moreRows)", () => {
	it("a column's type is the COMMON type across all rows, not row 1's", () => {
		expect(types("select x, y from (VALUES (1, 2), (3, 4+4), (7, 77.7)) as v(x, y)")).toEqual(["int", "decimal"]);
	});
	it("single-row VALUES types exactly", () => {
		expect(types("select x, y from (VALUES (1, 'a')) as v(x, y)")).toEqual(["int", "string"]);
	});
});
