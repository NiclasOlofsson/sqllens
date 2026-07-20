import { describe, expect, it } from "vitest";
import { deriveSymbols, parse, qualify, referencesAt, resolveScopes, Schema } from "../src/index.js";
import { lower } from "../src/duckdb/lower.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { inferType } from "../src/infer/infer.js";
import type { SelectExpr } from "../src/ir/ir.js";

// The DuckDB surface built onto the Postgres-derived fork, each addition doc-cited at its
// grammar rule (duckdb.org/docs/current) and asserted here — parse AND, where the IR models it,
// the lowered shape.

const ok = (sql: string) => expect(parseDuckdb(sql).errors, sql).toBe(0);

describe("duckdb grammar — fork additions (doc-cited)", () => {
	it("FROM-first queries synthesize a star projection (from.md#from-first-syntax)", () => {
		ok("FROM tbl;");
		ok("FROM tbl SELECT a, b WHERE a > 1;");
		const { ast } = parse("FROM tbl;", "duckdb");
		expect(ast.statement).toBe("query");
		expect(ast.body.kind === "select" && ast.body.projections[0]?.isStar).toBe(true);
		expect(ast.body.kind === "select" && ast.body.from[0]?.kind).toBe("table");
	});

	it("prefix aliases in SELECT and FROM (select.md#prefix-aliases)", () => {
		const { ast } = parse("SELECT total: count(*) FROM t: my_table;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.projections[0]?.name).toBe("total");
		expect(ast.body.kind === "select" && ast.body.from[0]?.alias).toBe("t");
	});

	it("star EXCLUDE rides the star; REPLACE/RENAME/LIKE parse (expressions/star.md)", () => {
		const { ast } = parse("SELECT * EXCLUDE (a, b) FROM t;", "duckdb");
		expect(
			ast.body.kind === "select" &&
				ast.body.projections[0]?.expr.kind === "star" &&
				ast.body.projections[0].expr.exclude,
		).toEqual(["a", "b"]);
		ok("SELECT * REPLACE (a / 100 AS a) FROM t;");
		ok("SELECT * RENAME (a AS b) FROM t;");
		ok("SELECT * LIKE 'col%' FROM t;");
		ok("SELECT * NOT SIMILAR TO 'col.' FROM t;");
		ok("SELECT s.* EXCLUDE ('y') FROM (SELECT {'x': 1, 'y': 2} AS s);");
	});

	it("COLUMNS() incl. unpacking (expressions/star.md#columns-expression)", () => {
		ok("SELECT COLUMNS('valid.*') FROM t;");
		ok("SELECT min(COLUMNS(*)) FROM t;");
		ok("SELECT COLUMNS(c -> c LIKE '%num%') FROM t;");
		ok("SELECT coalesce(*COLUMNS(*)) AS result FROM t;");
		ok("SELECT COLUMNS('(\\w{3}).*') AS '\\1' FROM numbers;");
	});

	it("QUALIFY filters window results (query_syntax/qualify.md)", () => {
		const { ast } = parse("SELECT * FROM t QUALIFY row_number() OVER (ORDER BY x) = 1;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.qualify !== undefined).toBe(true);
	});

	it("GROUP BY ALL / ORDER BY ALL (groupby.md, orderby.md)", () => {
		const { ast } = parse("SELECT city, count(*) FROM t GROUP BY ALL;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.aggregated).toBe(true);
		ok("SELECT * FROM t ORDER BY ALL DESC;");
	});

	it("list/struct/map literals, comprehensions, slicing (data_types/list.md, struct.md, map.md)", () => {
		ok("SELECT [1, 2, 3,] AS l, {'a': 1, 'b': 2} AS s, MAP {1: 'one'} AS m;");
		ok("SELECT [x * 2 FOR x IN [1, 2, 3] IF x > 1];");
		ok("SELECT ([1, 2, 3, 4, 5])[2:4:2], l[-1] FROM t;");
		ok("SELECT ([1, 2, 3, 4, 5])[:-:2];");
	});

	// Empty-bound slices with a step — the `::` in `[::2]` / `[1::2]` / `[::-1]` maximal-munches to
	// one TYPECAST token, so these previously bailed while the colon-separated `[:4:2]` / `[1:4:2]`
	// parsed. Both bounds are optional in `list[begin:end:step]` (functions/list.md#slicing). #13.
	it("empty-bound stepped slices [::2] [1::2] [:4:2] [::-1] parse (functions/list.md#slicing)", () => {
		ok("SELECT ([1, 2, 3, 4])[::2];");
		ok("SELECT ([1, 2, 3, 4])[1::2];");
		ok("SELECT ([1, 2, 3, 4])[:4:2];");
		ok("SELECT ([1, 2, 3, 4])[::-1];");
		// No-regression control: the colon-separated stepped slice is unchanged.
		ok("SELECT ([1, 2, 3, 4])[1:4:2];");
	});

	it("empty-bound slice lowers to a subscript with no fabricated bound (#13)", () => {
		const strip = (o: unknown) =>
			JSON.parse(
				JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)),
			);
		const { ast } = parse("SELECT ([1, 2, 3, 4])[::2];", "duckdb");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		const e = strip(expr);
		expect(e.kind).toBe("subscript");
		// The absent begin/end are NOT fabricated into a 0/-1, and NOT fused into an opaque whole-bracket
		// literal either — each written bound is modelled on its own field; an omitted one is simply
		// absent (functions/list.md#slicing).
		expect(e).toEqual({
			kind: "subscript",
			base: {
				kind: "function",
				name: "list_value",
				args: [1, 2, 3, 4].map((n) => ({ kind: "literal", text: String(n) })),
				aggregate: false,
				distinct: false,
			},
			slice: true,
			step: { kind: "literal", text: "2" },
		});
	});

	it("string-literal method receiver 'abc'.upper() lowers to upper('abc') (#13)", () => {
		const strip = (o: unknown) =>
			JSON.parse(
				JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)),
			);
		ok("SELECT 'abc'.upper();");
		const { ast } = parse("SELECT 'abc'.upper();", "duckdb");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		expect(strip(expr)).toEqual({
			kind: "function",
			name: "upper",
			args: [{ kind: "literal", text: "'abc'" }],
			aggregate: false,
			distinct: false,
		});
		// No-regression control: the parenthesized receiver still lowers to a method call.
		const { ast: paren } = parse("SELECT ('hello').upper();", "duckdb");
		const pe = paren.body.kind === "select" ? paren.body.projections[0]?.expr : undefined;
		expect(strip(pe).name).toBe("upper");
	});

	it("lambda keyword form lowers to an IR lambda (functions/lambda.md)", () => {
		const { ast } = parse("SELECT list_transform([1, 2], lambda x: x + 1);", "duckdb");
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain('"lambda"');
	});

	it("method chaining x.f(y) becomes f(x, y) (functions/overview.md#function-chaining)", () => {
		const { ast } = parse("SELECT ('hello').upper();", "duckdb");
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain('"upper"');
	});

	it("FROM 'file.parquet' is a table source named by the file (data/overview.md)", () => {
		const { ast } = parse("SELECT * FROM 'data/my.parquet';", "duckdb");
		expect(
			ast.body.kind === "select" && ast.body.from[0]?.kind === "table" && ast.body.from[0].relation.parts,
		).toEqual(["data/my.parquet"]);
	});

	it("ASOF / POSITIONAL / SEMI / ANTI joins (query_syntax/from.md)", () => {
		ok("SELECT * FROM a ASOF JOIN b ON a.t >= b.t;");
		ok("SELECT * FROM a ASOF LEFT JOIN b ON a.k = b.k AND a.t >= b.t;");
		ok("SELECT * FROM a POSITIONAL JOIN b;");
		ok("SELECT * FROM a SEMI JOIN b ON a.k = b.k;");
		ok("SELECT * FROM a ANTI JOIN b ON a.k = b.k;");
	});

	// A bare (AS-less) SEMI/ANTI/ASOF/POSITIONAL before JOIN is the JOIN keyword, never the left
	// table's alias. DuckDB categorizes these four as type_func_name keywords (libpg_query
	// type_name_keywords.list), excluded from ColId and thus never a bare alias — so `FROM a SEMI
	// JOIN b` is a SEMI join, not `a AS semi INNER JOIN b`. (duckdb/duckdb
	// third_party/libpg_query grammar/statements/{select.y joined_table, common.y ColId}.)
	it("bare SEMI/ANTI/ASOF/POSITIONAL before JOIN read as the join, no alias on the left table", () => {
		const join0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.joins?.[0] : undefined;
		};
		const from0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.from[0] : undefined;
		};
		expect(join0("SELECT * FROM a SEMI JOIN b ON a.x = b.x")?.kind).toBe("semi");
		expect(join0("SELECT * FROM a ANTI JOIN b ON a.x = b.x")?.kind).toBe("anti");
		expect(join0("SELECT * FROM a ASOF JOIN b ON a.x >= b.x")?.kind).toBe("asof");
		expect(join0("SELECT * FROM a POSITIONAL JOIN b")?.kind).toBe("positional");
		// the left table keeps NO alias — the keyword is no longer swallowed as one
		expect(from0("SELECT * FROM a SEMI JOIN b ON a.x = b.x")?.alias).toBeUndefined();
		expect(from0("SELECT * FROM a ANTI JOIN b ON a.x = b.x")?.alias).toBeUndefined();
		expect(from0("SELECT * FROM a ASOF JOIN b ON a.x >= b.x")?.alias).toBeUndefined();
		// same for function-table and subquery left sources (bare alias via alias_clause/colid)
		expect(join0("SELECT * FROM range(3) SEMI JOIN b ON range = b.x")?.kind).toBe("semi");
		expect(from0("SELECT * FROM range(3) SEMI JOIN b ON range = b.x")?.alias).toBeUndefined();
		expect(join0("SELECT * FROM (SELECT 1) ANTI JOIN b ON true")?.kind).toBe("anti");
		// a func-table WITH an alias + column list is unaffected (alias binds, not swallowed)
		expect(from0("SELECT * FROM generate_series(1, 3) tbl(i)")?.alias).toBe("tbl");
	});

	it("positive controls: explicit AS keeps the keyword as an alias; column and plain-alias use unaffected", () => {
		const from0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.from[0] : undefined;
		};
		// explicit AS is unambiguous — the keyword IS the alias there (kept legal by the fork's
		// permissive superset; the full unreserved set stays reachable via AS)
		expect(from0("SELECT * FROM t AS semi")?.alias).toBe("semi");
		expect(from0("SELECT * FROM t AS anti")?.alias).toBe("anti");
		// keyword in column position is unaffected (still an unreserved_keyword)
		ok("SELECT semi FROM t");
		// a plain non-keyword bare alias still binds
		expect(from0("SELECT * FROM t semi2")?.alias).toBe("semi2");
	});

	it("sampling and LIMIT n% (samples.md, limit.md)", () => {
		ok("SELECT * FROM t USING SAMPLE 10%;");
		ok("SELECT * FROM t USING SAMPLE 10 PERCENT (bernoulli);");
		ok("SELECT * FROM t USING SAMPLE reservoir(50 ROWS) REPEATABLE (100);");
		ok("SELECT * FROM t TABLESAMPLE 10%;");
		ok("SELECT * FROM t LIMIT 10%;");
	});

	it("UNION BY NAME (setops.md#union-all-by-name)", () => {
		ok("SELECT a, b FROM x UNION ALL BY NAME SELECT b, a FROM y;");
	});

	it("UNION BY NAME sets byName on the setop IR node; plain UNION does not", () => {
		const byName = lower(parseDuckdb("SELECT a, b FROM t UNION ALL BY NAME SELECT b, a FROM u;").tree);
		expect(byName.body.kind === "setop" && byName.body.byName).toBe(true);

		const plain = lower(parseDuckdb("SELECT a, b FROM t UNION ALL SELECT b, a FROM u;").tree);
		expect(plain.body.kind === "setop" && plain.body.byName).toBeUndefined();
	});

	it("PIVOT statement models the reshape onto PivotInfo (dynamic output), not flagged unsupported", () => {
		const { ast } = parse("PIVOT cities ON year USING sum(population) GROUP BY country;", "duckdb");
		expect(ast.statement).toBe("query");
		if (ast.body.kind !== "select") throw new Error("expected select body");
		expect(ast.body.unsupported).toBeUndefined();
		expect(ast.body.pivot?.forColumns).toEqual(["year"]);
		expect(ast.body.pivot?.aggColumns).toEqual(["population"]);
		// DuckDB's statement PIVOT produces data-dependent columns (the distinct ON-values become
		// columns) — modelled as dynamic so a schema resolves the output to unknown, never a wrong set.
		expect(ast.body.pivot?.dynamic).toBe(true);
	});

	it("UNPIVOT statement models the reshape onto UnpivotInfo, not flagged unsupported", () => {
		const { ast } = parse("UNPIVOT monthly_sales ON jan, feb INTO NAME month VALUE sales;", "duckdb");
		expect(ast.statement).toBe("query");
		if (ast.body.kind !== "select") throw new Error("expected select body");
		expect(ast.body.unsupported).toBeUndefined();
		expect(ast.body.unpivot?.nameColumn).toBe("month");
		expect(ast.body.unpivot?.valueColumn).toBe("sales");
		expect(ast.body.unpivot?.removed).toEqual(["jan", "feb"]);
	});

	it("PIVOT/UNPIVOT statement output is never-wrong under a schema", () => {
		// PIVOT: data-dependent output → unknown, never the raw base columns.
		const ps = resolveScopes(
			parse("PIVOT cities ON year USING sum(population) GROUP BY country;", "duckdb").ast,
			"duckdb",
		);
		const pCols = qualify(
			ps,
			new Schema({ cities: { country: "string", year: "int", population: "int" } }),
		).columnsOf(ps.root);
		expect(pCols).toBe("unknown");
		// UNPIVOT: static reshape → passthrough (product) + the name/value columns.
		const us = resolveScopes(
			parse("UNPIVOT monthly_sales ON jan, feb INTO NAME month VALUE sales;", "duckdb").ast,
			"duckdb",
		);
		const uCols = qualify(
			us,
			new Schema({ monthly_sales: { product: "string", jan: "int", feb: "int" } }),
		).columnsOf(us.root);
		expect(uCols).toEqual(["product", "month", "sales"]);
	});

	it("PIVOT statement forms still parse (with-CTE + FROM-suffix)", () => {
		ok("WITH p AS (PIVOT cities ON year USING sum(population) GROUP BY country) SELECT * FROM p;");
		ok("SELECT * FROM cities PIVOT (sum(population) FOR year IN (2000, 2010) GROUP BY country);");
		ok(`SELECT * FROM cities PIVOT (sum(population) AS total, count(population) AS count
			FOR year IN (2000, 2010) country IN ('NL', 'US'));`);
	});

	it("recursive CTE USING KEY (with.md#using-key)", () => {
		ok(`WITH RECURSIVE tbl(a, b) USING KEY (a) AS (
			SELECT a, b FROM t UNION ALL SELECT a + 1, b FROM tbl WHERE a < 3) SELECT * FROM tbl;`);
	});

	it("INTERVAL expr units and underscore numerics (interval.md, literal_types.md)", () => {
		ok("SELECT INTERVAL 1 YEAR, INTERVAL (random() * 10) MONTH, INTERVAL 3 DAYS;");
		ok("SELECT 1_000_000, 95_000.5;");
	});

	it("GLOB and same-line string concatenation (pattern_matching.md, literal_types.md)", () => {
		ok("SELECT 'Best.txt' GLOB '*.txt';");
		ok("SELECT 'Hello' ' ' 'World' AS greeting;");
	});

	it("prepared-statement parameters ? and $name (prepared_statements.md)", () => {
		ok("SELECT min(grade) FROM grades WHERE course = ?;");
		ok("SELECT * FROM t WHERE a = $1 AND b = $my_param;");
	});

	it("DuckDB statements classify parse-derived", () => {
		const cases: Array<[string, string]> = [
			["ATTACH 'file.db' AS db1;", "utility"],
			["USE db1;", "utility"],
			["INSTALL httpfs;", "utility"],
			["FORCE INSTALL spatial FROM core_nightly;", "utility"],
			["PRAGMA memory_limit='1GB';", "utility"],
			["SUMMARIZE tbl;", "utility"],
			["DESCRIBE SELECT 1;", "utility"],
			["SET VARIABLE x = MAP {'k': 10};", "utility"],
			["RESET VARIABLE x;", "utility"],
			["EXPORT DATABASE 'dir' (FORMAT parquet);", "utility"],
			["UPDATE EXTENSIONS;", "utility"],
			["CREATE MACRO add(a, b) AS a + b;", "ddl"],
			["CREATE OR REPLACE TEMP MACRO t8(x) AS TABLE FROM tbl WHERE c = x;", "ddl"],
			["CREATE SECRET (TYPE s3, KEY_ID 'k', SECRET 's');", "ddl"],
			["CREATE OR REPLACE TABLE t AS FROM u LIMIT 0;", "ddl"],
			["CREATE TYPE mood AS ENUM ('happy', 'sad');", "ddl"],
			["INSERT OR IGNORE INTO tbl (i) VALUES (1);", "dml"],
			["INSERT INTO tbl BY POSITION (b, a) VALUES (5, 42);", "dml"],
			["MERGE INTO p USING (SELECT 1 AS id) AS u USING (id) WHEN MATCHED THEN UPDATE;", "dml"],
			["COPY tbl TO 't.parquet' (ENCRYPTION_CONFIG {footer_key: 'k'});", "dml"],
			["UNPIVOT t ON a, b INTO NAME k VALUE v;", "query"],
		];
		for (const [sql, want] of cases) {
			const r = parseDuckdb(sql);
			expect(r.errors, sql).toBe(0);
			expect(lower(r.tree).statement, sql).toBe(want);
		}
	});
});

// Position-aware slice lowering (#lossless): applySubscriptBracket used to fuse an entire slice
// bracket into one opaque literal (`e.index = {kind:"literal", text:"[2:4]"}`), dropping every bound
// but the whole-bracket text — a column referenced in a hi/step bound vanished from
// SelectExpr.columns, and an empty-lo slice's END bound was swallowed into the same blob. Fixed by
// walking indirection_el's children in order, splitting on COLON (+1 slot) / TYPECAST (+2 slots, the
// adjacent-colon `::` case) so each written bound lands on its own field; an omitted bound (incl. the
// bare `-` default-bound placeholder) stays absent, never fabricated (functions/list.md#slicing).
describe("duckdb subscript slicing — position-aware begin/end/step (#lossless)", () => {
	const strip = (o: unknown) =>
		JSON.parse(JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)));
	const shapeOf = (sql: string) => {
		const { ast } = parse(sql, "duckdb");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		return strip(expr);
	};
	const num = (n: number) => ({ kind: "literal", text: String(n) });
	const arr = { kind: "column", parts: ["arr"] };

	it("x[2] — plain element access, unchanged shape (no slice flag)", () => {
		expect(shapeOf("SELECT arr[2] FROM t;")).toEqual({ kind: "subscript", base: arr, index: num(2) });
	});

	it("x[2:4] — begin + end, slice flag, no step", () => {
		expect(shapeOf("SELECT arr[2:4] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(2),
			end: num(4),
			slice: true,
		});
	});

	it("x[2:4:2] — begin + end + step", () => {
		expect(shapeOf("SELECT arr[2:4:2] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(2),
			end: num(4),
			step: num(2),
			slice: true,
		});
	});

	it("x[:4] — empty begin stays absent, does NOT get misattributed as index", () => {
		expect(shapeOf("SELECT arr[:4] FROM t;")).toEqual({ kind: "subscript", base: arr, end: num(4), slice: true });
	});

	it("x[2:] — empty end stays absent", () => {
		expect(shapeOf("SELECT arr[2:] FROM t;")).toEqual({ kind: "subscript", base: arr, index: num(2), slice: true });
	});

	it("x[:] — both bounds absent, still a slice", () => {
		expect(shapeOf("SELECT arr[:] FROM t;")).toEqual({ kind: "subscript", base: arr, slice: true });
	});

	it("x[::2] — the adjacent-colon TYPECAST alt: begin/end absent, step only", () => {
		expect(shapeOf("SELECT arr[::2] FROM t;")).toEqual({ kind: "subscript", base: arr, step: num(2), slice: true });
	});

	// A bare colid immediately after a slice COLON used to not parse at all — a genuine LEXER
	// collision, not a parser ambiguity: `:hi` (no gap) maximal-munches as ONE PLSQLVARIABLENAME
	// token (psql/pgbench `:variable` interpolation, docs.postgresql.org/current/app-psql.html
	// #APP-PSQL-INTERPOLATION — real corpus use: postgres/docs/parser/positive/dml/pgbench/1.sql,
	// shared pg-family lexer), so the parser never sees a standalone COLON before "hi". Fixed for a
	// non-empty begin (`arr[1:hi]`) by a new indirection_el alt that accepts the fused token and
	// un-fuses it in lower() (functions/list.md#slicing — array slicing takes any expression as a
	// bound). Parenthesizing still sidesteps the (unrelated) step-slot case below.
	it("a column used in a slice's end bound is not dropped from SelectExpr.columns", () => {
		const { ast } = parse("SELECT arr[1:(hi)] FROM t;", "duckdb");
		if (ast.body.kind !== "select") throw new Error("expected select");
		const cols = ast.body.columns.map((c) => c.parts.join("."));
		expect(cols).toContain("arr");
		expect(cols).toContain("hi"); // the defect's observable: previously dropped
	});

	it("a column used in a slice's step bound is not dropped from SelectExpr.columns", () => {
		const { ast } = parse("SELECT arr[1:2:(step_col)] FROM t;", "duckdb");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toContain("step_col");
	});

	// arr[1:2:hi]: the fused STEP-slot case, a bare-identifier STEP with no parens needed, after two
	// ordinary bounds (`1`, `2`). Engine-verified against DuckDB v1.5.4 directly
	// (temp_auto/duckdb-oracle/probe-slice-fused-step.mjs: `([1,2,3])[1:2:n]` parses and evaluates).
	// Symmetric to x[1:hi] below, but the fused PLSQLVARIABLENAME token lands in the STEP slot
	// instead of the END slot; applySubscriptBracket (src/duckdb/lower.ts) un-fuses it the same way.
	it("x[1:2:hi]: numeric begin+end, bare-identifier step (fused step-slot)", () => {
		expect(shapeOf("SELECT arr[1:2:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(1),
			end: num(2),
			step: { kind: "column", parts: ["hi"] },
			slice: true,
		});
		const { ast } = parse("SELECT arr[1:2:hi] FROM t;", "duckdb");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["arr", "hi"]));
	});

	// arr[1:hi] / arr[lo:hi]: the bare-identifier end bound now parses without parens, and the bound
	// column shows up in SelectExpr.columns — the PLSQLVARIABLENAME token is un-fused back into a
	// plain column end bound in applySubscriptBracket.
	it("x[1:hi] — numeric begin, bare-identifier end (no parens needed)", () => {
		expect(shapeOf("SELECT arr[1:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(1),
			end: { kind: "column", parts: ["hi"] },
			slice: true,
		});
		const { ast } = parse("SELECT arr[1:hi] FROM t;", "duckdb");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["arr", "hi"]));
	});

	it("x[lo:hi] — both bounds bare identifiers", () => {
		expect(shapeOf("SELECT arr[lo:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: { kind: "column", parts: ["lo"] },
			end: { kind: "column", parts: ["hi"] },
			slice: true,
		});
		const { ast } = parse("SELECT arr[lo:hi] FROM t;", "duckdb");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["arr", "lo", "hi"]));
	});

	// arr[:hi] (EMPTY begin, bare-identifier end) IS fixed for duckdb, unlike postgres/redshift where
	// this shape is deliberately left as the pre-existing plsqlvariablename-index reading (a
	// genuinely ambiguous human call there, since either reading is a real feature on those
	// dialects). For duckdb there is no ambiguity to weigh: `:name` is not a real DuckDB expression
	// at all (DuckDB v1.5.4 rejects `SELECT :x FROM t` outright — engine-verified,
	// temp_auto/duckdb-oracle/probe-params.mjs), while `arr[:hi]` (empty-begin slice, bare-identifier
	// end) DOES parse and evaluate on the real engine — engine-verified,
	// temp_auto/duckdb-oracle/probe-slice2.mjs. So the fused PLSQLVARIABLENAME token here can only
	// ever be the slice-bound reading; `indirection_el`'s slice alt makes the begin bound optional to
	// accept it, and it un-fuses into a plain column end bound like `arr[1:hi]` above.
	it("x[:hi] — empty begin, bare-identifier end: now a slice (engine-verified against DuckDB v1.5.4)", () => {
		expect(shapeOf("SELECT arr[:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			end: { kind: "column", parts: ["hi"] },
			slice: true,
		});
	});

	it("a slice's type is the base's own type (array/string), never the element type", () => {
		const typeOf = (sql: string, schema: Schema) => {
			const tree = resolveScopes(lower(parseDuckdb(sql).tree));
			const body = tree.root.body;
			if (body.kind !== "select") throw new Error("expected select");
			return inferType(body.projections[0].expr, tree.root, schema);
		};
		// A slice of array<string> is still array<string> — not the element type "string".
		expect(typeOf("SELECT arr[2:4] FROM t", new Schema({ t: { arr: "array<string>" } }))).toEqual({
			kind: "array",
			element: { kind: "scalar", name: "string" },
		});
		// A slice of a string is still a string (duckdb.org/docs list.md#slicing — string slicing).
		expect(typeOf("SELECT 'hello'[2:4]", new Schema({}))).toEqual({ kind: "scalar", name: "string" });
		// Plain (non-slice) element access is unaffected by the slice-type rule: array<string>[2] → string.
		expect(typeOf("SELECT arr[2] FROM t", new Schema({ t: { arr: "array<string>" } }))).toEqual({
			kind: "scalar",
			name: "string",
		});
	});
});

// DuckDB prepared-statement parameters — auto-increment `?`, positional `$1`, named `$name`
// (duckdb.org/docs/current/sql/query_syntax/prepared_statements). Previously all three lowered as
// a literal (firing a false unknown-column-adjacent miss and keeping them out of the shared
// parameter/variable consumers — qualify, symbols, references; see tests/parameter-ir.test.ts). A
// bare `:name` is NOT a real DuckDB feature (engine-verified against DuckDB v1.5.4:
// `SELECT :x FROM t` -> "Parser Error: syntax error at or near \":\"",
// temp_auto/duckdb-oracle/probe-params.mjs) and no longer parses as a general expression at all —
// unlike postgres/redshift, where the same shape is genuine psql/pgbench client-side interpolation.
describe("duckdb parameter IR — ?, $1, $name", () => {
	function select(sql: string): SelectExpr {
		const body = lower(parseDuckdb(sql).tree).body;
		if (body.kind !== "select") throw new Error("expected select");
		return body;
	}

	it("? lowers to a parameter node with neither name nor ordinal", () => {
		const body = select("SELECT ? FROM t WHERE a > ?");
		expect(body.projections[0]?.expr).toMatchObject({ kind: "parameter", text: "?" });
		expect(body.projections[0]?.expr).not.toHaveProperty("name");
		expect(body.projections[0]?.expr).not.toHaveProperty("ordinal");
		expect(body.where).toMatchObject({ kind: "binary", right: { kind: "parameter", text: "?" } });
	});

	it("$1 lowers to a parameter node with its ordinal", () => {
		const body = select("SELECT $1 FROM t WHERE a > $2");
		expect(body.projections[0]?.expr).toMatchObject({ kind: "parameter", text: "$1", ordinal: 1 });
		expect(body.where).toMatchObject({ kind: "binary", right: { kind: "parameter", text: "$2", ordinal: 2 } });
	});

	it("$name lowers to a parameter node with its name", () => {
		const body = select("SELECT $x FROM t WHERE a > $x");
		expect(body.projections[0]?.expr).toMatchObject({ kind: "parameter", text: "$x", name: "x" });
		expect(body.where).toMatchObject({ kind: "binary", right: { kind: "parameter", text: "$x", name: "x" } });
	});

	it(":x no longer parses as a general expression (engine-verified rejection)", () => {
		expect(parseDuckdb("SELECT :x FROM t").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT * FROM t WHERE a > :x").errors).toBeGreaterThan(0);
	});

	it("a schema-attached qualify fires zero unknown-column diagnostics for $x used twice", () => {
		const scopes = resolveScopes(parse("SELECT $x FROM t WHERE a > $x", "duckdb").ast, "duckdb");
		expect(qualify(scopes, new Schema({ t: { a: "int" } })).diagnostics).toEqual([]);
	});

	it("deriveSymbols emits a parameter symbol, not a phantom column, for $x", () => {
		const scopes = resolveScopes(parse("SELECT $x FROM t WHERE a > $x", "duckdb").ast, "duckdb");
		const syms = deriveSymbols(scopes, new Schema({ t: { a: "int" } }));
		const paramSyms = syms.filter((s) => s.name === "x");
		expect(paramSyms).toHaveLength(2);
		for (const s of paramSyms) expect(s.kind).toBe("parameter");
		expect(syms.some((s) => s.kind === "column" && s.name === "x")).toBe(false);
	});

	it("referencesAt groups the two $x occurrences", () => {
		const sql = "SELECT $x FROM t WHERE a > $x";
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		const occ = referencesAt(scopes, sql.indexOf("$x"));
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.occurrences).toHaveLength(2);
	});
});

// SLL→LL fallback surgery — each probe pins a construct that now predicts under SLL (no LL
// fallback) after a grammar edit, plus the IR/rejection invariants that guard the edit.
describe("duckdb SLL-surgery — no LL fallback on the cured shapes", () => {
	const noFallback = (sql: string) => expect(parseDuckdb(sql).sllFallback, sql).toBe(false);
	const projExpr = (sql: string) => {
		const { ast } = parse(sql, "duckdb");
		return (ast.body as { projections?: Array<{ expr: unknown }> }).projections?.[0]?.expr as {
			kind: string;
			name?: string;
			args?: Array<{ kind: string; parts?: string[] }>;
		};
	};

	it("c_expr — plain function calls f(args) predict under SLL (plain/dotted func_expr split)", () => {
		// Cured STRUCTURALLY, not by ordering: the old func_expr is split into plain_func_expr (undotted
		// name + required parens — disjoint from columnref on a full match by construction, so it sits
		// above it) and dotted_func_expr (below columnref, preserving the method-chain resolution). The
		// earlier func_expr-above-columnref reorder was REVERTED (Task-5 review: it flipped the reading
		// of ALIASED dotted calls — see the method-chain guard below).
		for (const sql of [
			"SELECT f(1)",
			"SELECT f(1, 2)",
			"SELECT concat('value is ', b)",
			"SELECT getenv('HOME') AS home",
			"SELECT a, f(1), g(x, y)",
			"SELECT mod(x, 2) = 0 FROM t",
			"SELECT count(*) FILTER (WHERE x > 1) FROM t",
			"SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY x) FROM t",
			"SELECT LEFT(x, 1), RIGHT(x, 1) FROM t",
		]) {
			ok(sql);
			noFallback(sql);
		}
		expect(projExpr("SELECT f(1)")).toMatchObject({ kind: "function", name: "f" });
		// The name comes from the application's own direct name child, never a nested one — a typed
		// literal argument must not hijack the call name (strftime, not date).
		expect(projExpr("SELECT strftime(DATE '1992-03-02', '%d/%m/%Y')")).toMatchObject({
			kind: "function",
			name: "strftime",
		});
	});

	it("c_expr — the method-chain reading wins in EVERY follow context (MANDATORY guard)", () => {
		// DuckDB's `.attr(args)` method indirection means a dotted call `x.f(a)` is a GENUINE ambiguity:
		// it full-matches both columnref (method chain) and func_expr (qualified call, func_name matching
		// `x.f` non-greedily). The project convention is the method chain — `x.f(a)` → f(x, a), receiver
		// first. A c_expr reorder that puts func_expr above columnref flips the reading for ALIASED
		// dotted calls (`sch.f(a) AS score` lowered to f(a), the receiver silently dropped) while leaving
		// unaliased follows intact — exactly how Task 5's first attempt broke (review REJECT, reverted).
		// These probes pin the reading across every follow context and must stay green forever,
		// regardless of any future c_expr reordering.
		const recv = (parts: string[]) => ({ kind: "column", parts });

		// AS alias — the follow context the broken reorder flipped.
		expect(projExpr("SELECT sch.f(a) AS score")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// Bare-word alias.
		expect(projExpr("SELECT sch.f(a) score")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// Chained method call with alias — the inner chain must survive: g(f(x, a), b).
		expect(projExpr("SELECT x.f(a).g(b) AS r")).toMatchObject({
			kind: "function",
			name: "g",
			args: [{ kind: "function", name: "f", args: [recv(["x"]), recv(["a"])] }, recv(["b"])],
		});
		// Zero-arg chain with alias.
		expect(projExpr("SELECT col.lower() AS l")).toMatchObject({
			kind: "function",
			name: "lower",
			args: [recv(["col"])],
		});
		// Comma follow.
		expect(projExpr("SELECT sch.f(a), b")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// FROM follow.
		expect(projExpr("SELECT sch.f(a) FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// EOF follow.
		expect(projExpr("SELECT sch.f(a)")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		expect(projExpr("SELECT col.lower()")).toMatchObject({
			kind: "function",
			name: "lower",
			args: [recv(["col"])],
		});
		// A plain dotted path stays a column, not a call.
		expect(projExpr("SELECT x.y.z")).toMatchObject({ kind: "column", parts: ["x", "y", "z"] });
	});

	it("c_expr — typed literals predict under SLL (ported postgres aexprconst reorder)", () => {
		// aexprconst ordered above func_expr/columnref: `DATE '…'` / `f(1) '5'` used to bail on the
		// trailing string constant. The identifier-led aexprconst forms REQUIRE that trailing sconst, so
		// they stay disjoint from a bare call / column.
		for (const sql of [
			"SELECT DATE '1992-09-20'",
			"SELECT TIMESTAMP '2001-02-16 20:38:40'",
			"SELECT INTERVAL '1 month 1 day'",
			"SELECT decimal '3.14'",
			"SELECT a FROM t WHERE d > DATE '2000-01-01'",
		]) {
			ok(sql);
			noFallback(sql);
		}
		// The trailing-sconst requirement is real: a bare call with a stray string still rejects.
		expect(parseDuckdb("SELECT count(*) '5'").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT f() '5'").errors).toBeGreaterThan(0);
		// A plain call and a plain column still lower unchanged (aexprconst dropped out for them).
		expect(projExpr("SELECT f(1)")).toMatchObject({ kind: "function", name: "f" });
	});
});

// The VARIADIC argument marker (duckdb.org/docs/current/sql/functions/lambda#variadic-arguments,
// and the generic `func(VARIADIC list)` call form). The grammar carries the VARIADIC-prefixed
// func_arg_expr as a DIRECT child of the application (`VARIADIC func_arg_expr` and the trailing
// `... COMMA VARIADIC func_arg_expr`), NOT inside func_arg_list — so the arg's expr must still land
// in `args`. The VARIADIC marker itself is not modelled (no consumer needs it); dropping the whole
// arg was the bug (conservation blind spot: the corpus/other-ratchet gates can't see an empty arg
// list). These direct-shape tests are the guard.
describe("duckdb VARIADIC — the marked arg keeps its expr in args", () => {
	const projExpr = (sql: string) => {
		const { ast } = parse(sql, "duckdb");
		return (ast.body as { projections?: Array<{ expr: unknown }> }).projections?.[0]?.expr as {
			kind: string;
			name?: string;
			args?: Array<{ kind: string; parts?: string[] }>;
		};
	};

	it("leading VARIADIC arg is present (was dropped → args:[])", () => {
		expect(parseDuckdb("SELECT my_func(VARIADIC my_list)").errors).toBe(0);
		const e = projExpr("SELECT my_func(VARIADIC my_list)");
		expect(e.name).toBe("my_func");
		expect(e.args).toEqual([expect.objectContaining({ kind: "column", parts: ["my_list"] })]);
	});

	it("trailing VARIADIC arg rides after the positional args", () => {
		expect(parseDuckdb("SELECT my_func(a, VARIADIC my_list)").errors).toBe(0);
		const e = projExpr("SELECT my_func(a, VARIADIC my_list)");
		expect(e.name).toBe("my_func");
		expect(e.args).toEqual([
			expect.objectContaining({ kind: "column", parts: ["a"] }),
			expect.objectContaining({ kind: "column", parts: ["my_list"] }),
		]);
	});
});

// applyIndirection's method-call arg path (the CHAINED `x.f(a)` / `'lit'.f(a)` form, distinct from the
// direct call above) used to read only func_arg_list, dropping a VARIADIC arg and degrading a lambda arg
// to `other`. It now shares collectFuncArgs/lowerFuncArgExpr with the direct-call path (lowerFuncExpr),
// so both extract args identically. Two receiver shapes matter here: an identifier-led receiver
// (`x.f(...)`) is a GENUINE grammar ambiguity against a qualified direct call, and DuckDB's ANTLR parser
// resolves a VARIADIC-bearing call to the direct-call reading (dotted_func_expr), since indirection_el's
// own `.attr(args)` parens carry no VARIADIC alternative, so that shape never actually reaches
// applyIndirection. A receiver that CANNOT be a dotted_func_expr qualifier (a string literal, an array
// literal, or the result of a prior call) has no such rescue and is the only way to exercise
// applyIndirection's own arg extraction directly.
describe("duckdb chained method-call args, same fidelity as the direct-call path", () => {
	const projExpr = (sql: string) => {
		const { ast } = parse(sql, "duckdb");
		return (ast.body as { projections?: Array<{ expr: unknown }> }).projections?.[0]?.expr as {
			kind: string;
			name?: string;
			args?: Array<Record<string, unknown>>;
		};
	};

	it("lambda arg on a literal receiver lowers to a real lambda node, not other (functions/overview.md#function-chaining-via-the-dot-operator)", () => {
		expect(parseDuckdb("SELECT 'lit'.my_func(a, lambda x: x + 1) FROM t").errors).toBe(0);
		const e = projExpr("SELECT 'lit'.my_func(a, lambda x: x + 1) FROM t");
		expect(e.name).toBe("my_func");
		expect(e.args?.[0]).toMatchObject({ kind: "literal", text: "'lit'" });
		expect(e.args?.[1]).toMatchObject({ kind: "column", parts: ["a"] });
		expect(e.args?.[2]).toMatchObject({ kind: "lambda", params: ["x"] });
	});

	it("lambda arg on a call-result receiver (double chain) lowers to a real lambda node", () => {
		expect(parseDuckdb("SELECT f(a).g(lambda x: x + 1) FROM t").errors).toBe(0);
		const e = projExpr("SELECT f(a).g(lambda x: x + 1) FROM t");
		expect(e.name).toBe("g");
		expect(e.args?.[0]).toMatchObject({ kind: "function", name: "f" });
		expect(e.args?.[1]).toMatchObject({ kind: "lambda", params: ["x"] });
	});

	it("lambda arg on an array-literal receiver lowers to a real lambda node", () => {
		expect(parseDuckdb("SELECT [1, 2, 3].list_transform(lambda x: x + 1) FROM t").errors).toBe(0);
		const e = projExpr("SELECT [1, 2, 3].list_transform(lambda x: x + 1) FROM t");
		expect(e.name).toBe("list_transform");
		expect(e.args?.[0]).toMatchObject({ kind: "function", name: "list_value" });
		expect(e.args?.[1]).toMatchObject({ kind: "lambda", params: ["x"] });
	});

	// Pins the CURRENT ambiguity resolution, not a claim it's the ideal reading: a VARIADIC arg forces
	// ANTLR off the method-chain alt (columnref+indirection) onto the qualified-call alt
	// (dotted_func_expr), so "x" here is a name qualifier (like schema.func(args)), not a method-chain
	// receiver folded into args the way plain `x.f(a)` folds "x" in (see the c_expr guard test above).
	// That qualifier-vs-receiver split is pre-existing dotted_func_expr/lastName behavior, unrelated to
	// applyIndirection; it just explains why this parses at all instead of hitting the grammar boundary
	// below.
	it("VARIADIC on an identifier-led chained receiver still round-trips (resolved to the direct-call reading)", () => {
		expect(parseDuckdb("SELECT x.f(VARIADIC [1, 2]) FROM t").errors).toBe(0);
		const e = projExpr("SELECT x.f(VARIADIC [1, 2]) FROM t");
		expect(e.name).toBe("f");
		expect(e.args).toEqual([expect.objectContaining({ kind: "function", name: "list_value" })]);
	});

	// GRAMMAR BOUNDARY, not a lowering bug: indirection_el's own `.attr(args)` parens
	// (grammars/duckdb/DuckDBParser.g4) have no VARIADIC alternative, unlike func_application /
	// dotted_func_application / plain_func_application. When the receiver cannot rescue to a
	// dotted_func_expr qualifier, VARIADIC has no CST shape to bind to and the parse is rejected
	// outright (no silent arg loss: there is no successful parse to lose information from). This pins
	// the current boundary so a future grammar change that adds the alternative is caught here, right
	// alongside the lowering fix (collectFuncArgs's second pass) it would need. Verified against real
	// DuckDB (2026-07-20, node bindings): `'lit'.f(VARIADIC [1, 2])` is a Parser Error on the engine
	// too, so this rejection is language-correct, not a gap in our grammar to close.
	it("VARIADIC on a non-rescuable chained receiver is a parse rejection, not a silent drop", () => {
		expect(parseDuckdb("SELECT 'lit'.f(VARIADIC [1, 2]) FROM t").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT f(a).g(VARIADIC b) FROM t").errors).toBeGreaterThan(0);
	});
});

// DuckDB time travel (Delta/Iceberg extensions) — AT (VERSION => …) / AT (TIMESTAMP => …) after a
// table ref, mirroring how databricks.entry.test.ts pins its VERSION AS OF / @-shorthand time
// travel: the clause parses and lowers to the ORDINARY table source, no new IR field (see the
// at_clause grammar comment, grammars/duckdb/DuckdbParser.g4, for the doc citations and the engine
// verification, 2026-07-20 real DuckDB via node bindings, that established the clause's position
// and value-expression shape).
describe("duckdb time travel — AT (VERSION => …) / AT (TIMESTAMP => …)", () => {
	it("VERSION form parses and lowers to the plain table t (core_extensions/delta)", () => {
		expect(parseDuckdb("SELECT * FROM t AT (VERSION => 1)").errors).toBe(0);
		const { ast } = parse("SELECT * FROM t AT (VERSION => 1)", "duckdb");
		if (ast.body.kind !== "select") throw new Error("select");
		expect(ast.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("TIMESTAMP form parses; the value is a general expression, not just a literal (core_extensions/iceberg/overview)", () => {
		expect(parseDuckdb("SELECT * FROM t AT (TIMESTAMP => TIMESTAMP '2025-09-22 12:32:43.217')").errors).toBe(0);
		expect(parseDuckdb("SELECT * FROM t AT (VERSION => version())").errors).toBe(0);
		expect(parseDuckdb("SELECT * FROM t AT (VERSION => 1 + 1)").errors).toBe(0);
	});

	it("composes with an alias (AS and bare), alias before the AT clause", () => {
		expect(parseDuckdb("SELECT * FROM t AS x AT (VERSION => 1)").errors).toBe(0);
		expect(parseDuckdb("SELECT * FROM t x AT (VERSION => 1)").errors).toBe(0);
		const { ast } = parse("SELECT * FROM t AS x AT (VERSION => 1)", "duckdb");
		if (ast.body.kind !== "select") throw new Error("select");
		expect(ast.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] }, alias: "x" });
	});

	// Grammar boundary, verified against real DuckDB (2026-07-20, node bindings): AT only follows a
	// plain relation_expr, a function table or a derived subquery both give a Parser Error, and an
	// alias written AFTER the AT clause (instead of before) is rejected too.
	it("is rejected on a function table, a derived subquery, and alias-after-AT ordering", () => {
		expect(parseDuckdb("SELECT * FROM range(3) AT (VERSION => 1)").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT * FROM (SELECT * FROM t) x AT (VERSION => 1)").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT * FROM t AT (VERSION => 1) AS x").errors).toBeGreaterThan(0);
	});
});

// FROM-first (from.md#from-first-syntax) already synthesizes a star projection (see "FROM-first
// queries synthesize a star projection" above); these pin the remaining composition points: a
// trailing SELECT's output columns resolve through resolveScopes, and FROM-first works as a CTE
// body, inside a subquery, and as a set-op branch.
describe("duckdb FROM-first — composition and output columns", () => {
	it("FROM t SELECT a, b resolves the named columns through resolveScopes", () => {
		const { ast } = parse("FROM t SELECT a, b", "duckdb");
		const scopes = resolveScopes(ast, "duckdb");
		expect(scopes.root.outputs).toEqual(["a", "b"]);
	});

	it("bare FROM t is 'unknown' outputs, same as SELECT * FROM t (the star needs a schema)", () => {
		const bare = resolveScopes(parse("FROM t", "duckdb").ast, "duckdb");
		const star = resolveScopes(parse("SELECT * FROM t", "duckdb").ast, "duckdb");
		expect(bare.root.outputs).toBe("unknown");
		expect(bare.root.outputs).toBe(star.root.outputs);
	});

	it("FROM-first as a CTE body, the VALUES + row-alias corpus shape (query_syntax/values.md)", () => {
		const sql = "WITH cities AS (FROM (VALUES ('se','sto'), ('no','osl')) _(country, city)) SELECT * FROM cities";
		expect(parseDuckdb(sql).errors).toBe(0);
		const { ast } = parse(sql, "duckdb");
		if (ast.body.kind !== "select") throw new Error("select");
		expect(ast.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["cities"] } });
	});

	it("FROM-first inside a subquery and as a set-op branch", () => {
		expect(parseDuckdb("SELECT * FROM (FROM t) x").errors).toBe(0);
		expect(parseDuckdb("FROM t UNION SELECT a FROM t").errors).toBe(0);
		expect(parseDuckdb("FROM t UNION FROM t").errors).toBe(0);
	});
});

// Tightening: an empty selection list is a real DuckDB Parser Error ("SELECT clause without
// selection list"), verified against real DuckDB (2026-07-20, node bindings). Our grammar used to
// accept `SELECT FROM t` (ledgered leniency, CLAUDE.md § Known shortcuts); simple_select_pramary's
// SELECT alternatives now require target_list, matching the engine. FROM-first composition must
// still hold: `FROM t` with no SELECT at all stays legal, only an EMPTY trailing SELECT is rejected.
describe("duckdb — empty selection list is rejected, matching the engine", () => {
	it("SELECT FROM t and bare SELECT are now parse errors", () => {
		expect(parseDuckdb("SELECT FROM t").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT").errors).toBeGreaterThan(0);
	});

	it("SELECT DISTINCT FROM t is a parse error (distinct_clause already required target_list)", () => {
		expect(parseDuckdb("SELECT DISTINCT FROM t").errors).toBeGreaterThan(0);
	});

	it("a real projection is unaffected", () => {
		expect(parseDuckdb("SELECT a FROM t").errors).toBe(0);
		expect(parseDuckdb("SELECT a FROM t WHERE a > 1").errors).toBe(0);
	});

	it("composes with FROM-first: bare FROM t still parses, but an EMPTY trailing SELECT does not", () => {
		expect(parseDuckdb("FROM t").errors).toBe(0);
		expect(parseDuckdb("FROM t SELECT a, b").errors).toBe(0);
		expect(parseDuckdb("FROM t SELECT").errors).toBeGreaterThan(0);
	});
});
