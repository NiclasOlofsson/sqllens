import { describe, expect, it } from "vitest";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";

// Snowflake is the third dialect: grammar forked from grammars-v4 sql/snowflake, cleaned
// against the official reference docs. Only parse() and lower() are Snowflake-specific —
// the semantic layer runs unchanged on the shared IR (proven for T-SQL already; the same
// pipeline tests are added here as lower() is built).

function errorsOf(sql: string): number {
	return parseSnowflake(sql).errors;
}

function ir(sql: string) {
	const { tree, errors } = parseSnowflake(sql);
	return { q: lower(tree), errors };
}

function selectBody(sql: string) {
	const { q, errors } = ir(sql);
	expect(errors).toBe(0);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return { q, body: q.body };
}

describe("Snowflake parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});

	// Window frames: docs.snowflake.com/en/sql-reference/functions-analytic
	// (window frame syntax) — upstream grammar had the frame rules commented out.
	it("parses a cumulative ROWS frame", () => {
		expect(
			errorsOf(
				"SELECT SUM(x) OVER (PARTITION BY g ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t",
			),
		).toBe(0);
	});

	it("parses a sliding ROWS frame with numeric bounds", () => {
		expect(errorsOf("SELECT AVG(x) OVER (ORDER BY ts ROWS BETWEEN 3 PRECEDING AND 1 FOLLOWING) FROM t")).toBe(0);
	});

	it("parses a RANGE frame with an interval offset", () => {
		expect(
			errorsOf(
				"SELECT COUNT(*) OVER (ORDER BY ts RANGE BETWEEN INTERVAL '1 day' PRECEDING AND CURRENT ROW) FROM t",
			),
		).toBe(0);
	});

	it("parses a shorthand frame (no BETWEEN)", () => {
		expect(errorsOf("SELECT SUM(x) OVER (ORDER BY ts ROWS UNBOUNDED PRECEDING) FROM t")).toBe(0);
	});

	// SELECT * modifiers: docs.snowflake.com/en/sql-reference/sql/select — upstream
	// grammar only wired EXCLUDE; ILIKE / REPLACE / RENAME are equally official.
	it("parses SELECT * ILIKE", () => {
		expect(errorsOf("SELECT * ILIKE '%amount%' FROM orders")).toBe(0);
	});

	it("parses SELECT * REPLACE", () => {
		expect(errorsOf("SELECT * REPLACE (amount / 100 AS amount, UPPER(name) AS name) FROM orders")).toBe(0);
	});

	it("parses SELECT * RENAME, parenthesized and bare", () => {
		expect(errorsOf("SELECT * RENAME (id AS order_id, ts AS order_ts) FROM orders")).toBe(0);
		expect(errorsOf("SELECT * RENAME id AS order_id FROM orders")).toBe(0);
	});

	it("parses combined star modifiers (EXCLUDE + RENAME)", () => {
		expect(errorsOf("SELECT t.* EXCLUDE (a, b) RENAME (c AS d) FROM t")).toBe(0);
	});

	// $$-quoted strings are ordinary string literals:
	// docs.snowflake.com/en/sql-reference/data-types-text#dollar-quoted-string-constants
	it("parses a dollar-quoted string as an expression", () => {
		expect(errorsOf("SELECT $$some 'raw' text$$ AS s")).toBe(0);
		expect(errorsOf("SELECT a FROM t WHERE b = $$x$$")).toBe(0);
	});

	// WITHIN GROUP belongs to any ordered-set aggregate (PERCENTILE_CONT/DISC, MODE, …),
	// not only LISTAGG/ARRAY_AGG: docs.snowflake.com/en/sql-reference/functions/percentile_cont
	it("parses WITHIN GROUP on percentile_cont", () => {
		expect(errorsOf("SELECT (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY x))/1000 AS p FROM t")).toBe(0);
	});

	it("parses a CTE list whose later CTE uses WITHIN GROUP (LL prediction poisoning)", () => {
		expect(
			errorsOf(`
				WITH a AS (SELECT 1 AS x), b AS (SELECT x FROM a),
				c AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x) AS m FROM b)
				SELECT * FROM c`),
		).toBe(0);
	});

	// Multi-row inserts: docs.snowflake.com/en/sql-reference/sql/insert — upstream
	// values_builder capped the row list at two.
	it("parses INSERT with three or more VALUES rows", () => {
		expect(errorsOf("INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y'), (3, 'z'), (4, 'w')")).toBe(0);
	});

	// Structured types as cast targets: docs.snowflake.com/en/sql-reference/data-types-structured
	it("parses casts to structured OBJECT/ARRAY/MAP types", () => {
		expect(errorsOf("SELECT OBJECT_CONSTRUCT('a', 1)::OBJECT(a VARCHAR, d DATE) FROM t")).toBe(0);
		expect(errorsOf("SELECT col::ARRAY(NUMBER) FROM t")).toBe(0);
		expect(errorsOf("SELECT col::MAP(VARCHAR, NUMBER(10,2)) FROM t")).toBe(0);
	});

	// Keywords usable as identifiers (Snowflake reserves very little:
	// docs.snowflake.com/en/sql-reference/reserved-keywords)
	it("allows BODY, SEARCH, ONE as identifiers", () => {
		expect(errorsOf("SELECT body FROM emails")).toBe(0);
		expect(errorsOf("SELECT SEARCH(body, 'hello') FROM emails")).toBe(0);
		expect(errorsOf("SELECT 1 AS one")).toBe(0);
	});

	// ALTER SESSION SET accepts any documented parameter, space-separated:
	// docs.snowflake.com/en/sql-reference/parameters (the grammar had a closed catalogue)
	it("parses ALTER SESSION SET with arbitrary documented parameters", () => {
		expect(errorsOf("ALTER SESSION SET GEOMETRY_OUTPUT_FORMAT = 'WKT'")).toBe(0);
		expect(errorsOf("ALTER SESSION SET TIMEZONE = 'UTC' QUERY_TAG = 'etl'")).toBe(0);
	});

	// Instance method invocation on class objects:
	// docs.snowflake.com/en/sql-reference/classes — <instance>!<method>(<args>)
	it("parses bang method calls", () => {
		expect(errorsOf("SELECT model_binary!PREDICT(INPUT_DATA => {*}) AS p FROM d")).toBe(0);
		expect(errorsOf("SELECT my_classifier!CLASSIFY(text_col) FROM t")).toBe(0);
	});

	// Iceberg tables: docs.snowflake.com/en/sql-reference/sql/create-iceberg-table
	it("parses CREATE and ALTER ICEBERG TABLE", () => {
		expect(
			errorsOf(
				"CREATE ICEBERG TABLE it (id NUMBER, d DATE) CATALOG = 'SNOWFLAKE' EXTERNAL_VOLUME = 'vol' BASE_LOCATION = 'loc'",
			),
		).toBe(0);
		expect(errorsOf("ALTER ICEBERG TABLE it ADD COLUMN c VARCHAR")).toBe(0);
		expect(errorsOf("CREATE OR REPLACE ICEBERG TABLE it AS SELECT * FROM src")).toBe(0);
	});

	it("parses CALL with a bang method", () => {
		expect(errorsOf("CALL SNOWFLAKE.LOCAL.ANOMALY_INSIGHTS!GET_DATA('2024-01-01', '2024-03-31')")).toBe(0);
	});

	// IDENTIFIER(...) works anywhere an object name does:
	// docs.snowflake.com/en/sql-reference/identifier-literal
	it("parses IDENTIFIER('…') as an object name", () => {
		expect(errorsOf("CREATE OR REPLACE DATABASE IDENTIFIER('my_db')")).toBe(0);
		expect(errorsOf("SELECT * FROM IDENTIFIER('my_table')")).toBe(0);
	});

	// Stage file paths contain dots: docs.snowflake.com/en/sql-reference/sql/copy-into-table
	it("parses COPY INTO from a stage path with dots", () => {
		expect(errorsOf("COPY INTO t FROM @mystage/unload/mydata.csv.gz")).toBe(0);
	});

	// Querying staged files: docs.snowflake.com/en/user-guide/querying-stage
	it("parses SELECT from a stage", () => {
		expect(errorsOf("SELECT $1, $2 FROM @my_stage")).toBe(0);
		expect(errorsOf("SELECT t.$1 FROM @my_stage/data.csv (FILE_FORMAT => 'csv', PATTERN => '.*') t")).toBe(0);
	});

	it("parses CALL with named arguments", () => {
		expect(errorsOf("CALL get_spending_history(budget_name => 'b1', start_ts => '2024-01-01')")).toBe(0);
	});

	// FILE is a first-class data type: docs.snowflake.com/en/sql-reference/data-types-unstructured
	it("parses FILE as a column data type", () => {
		expect(errorsOf("CREATE TABLE file_table (f FILE)")).toBe(0);
	});

	// Database roles: docs.snowflake.com/en/sql-reference/sql/grant-database-role
	it("parses GRANT DATABASE ROLE", () => {
		expect(errorsOf("GRANT DATABASE ROLE r1 TO ROLE r2")).toBe(0);
	});

	// MATCH_RECOGNIZE with real pattern variables (upstream's `symbol` rule was a
	// DUMMY-token stub): docs.snowflake.com/en/sql-reference/constructs/match_recognize
	it("parses MATCH_RECOGNIZE with pattern variables", () => {
		expect(
			errorsOf(`
				SELECT * FROM stock MATCH_RECOGNIZE (
					PARTITION BY symbol ORDER BY ts
					MEASURES MATCH_NUMBER() AS mn
					ONE ROW PER MATCH
					AFTER MATCH SKIP PAST LAST ROW
					PATTERN (up+ down{1,3} (flat | dip)?)
					DEFINE up AS price > 10, down AS price < 10, flat AS price = 10, dip AS price < 5
				)`),
		).toBe(0);
	});
});

describe("Snowflake lower -> IR", () => {
	it("lowers a basic SELECT to a select body with projections and a table source", () => {
		const { body } = selectBody("SELECT a, b FROM t");
		expect(body.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(body.from[0]).toMatchObject({ kind: "table", name: ["t"] });
	});

	it("captures column and table aliases, with and without AS", () => {
		const { body } = selectBody("SELECT t.a AS x, t.b y FROM db.sch.tbl t");
		expect(body.projections[0].name).toBe("x");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(body.projections[1].name).toBe("y");
		expect(body.from[0]).toMatchObject({ kind: "table", name: ["db", "sch", "tbl"], alias: "t" });
	});

	it("models WHERE and tags its column refs with the where clause", () => {
		const { body } = selectBody("SELECT a FROM t WHERE b > 1");
		expect(body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "b")).toBe(true);
	});

	it("lowers CTEs with declared column aliases", () => {
		const { q } = selectBody("WITH c (x, y) AS (SELECT a, b FROM t) SELECT x FROM c");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].columnAliases).toEqual(["x", "y"]);
		expect(q.ctes[0].body.body.kind).toBe("select");
	});

	it("lowers set operators including MINUS as except", () => {
		const { q } = ir("SELECT a FROM t1 UNION ALL SELECT a FROM t2 MINUS SELECT a FROM t3");
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.op).toBe("except");
		if (q.body.left.kind !== "setop") throw new Error("nested setop");
		expect(q.body.left.op).toBe("union");
		expect(q.body.left.all).toBe(true);
	});

	it("records UNION BY NAME (name-matched column alignment)", () => {
		const { q } = ir("SELECT a, b FROM t1 UNION ALL BY NAME SELECT b, a FROM t2");
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.byName).toBe(true);
		expect(q.body.all).toBe(true);
		const plain = ir("SELECT a FROM t1 UNION SELECT a FROM t2").q;
		if (plain.body.kind !== "setop") throw new Error("setop");
		expect(plain.body.byName ?? false).toBe(false);
	});

	it("captures JOIN ON conditions and their column refs", () => {
		const { body } = selectBody("SELECT * FROM a JOIN b ON a.id = b.id");
		expect(body.joinConditions).toHaveLength(1);
		expect(body.columns.some((c) => c.clause === "join" && c.parts.join(".") === "a.id")).toBe(true);
	});

	it("captures the ASOF JOIN match condition as a join condition", () => {
		const { body } = selectBody("SELECT * FROM trades t ASOF JOIN quotes q MATCH_CONDITION (t.ts >= q.ts) ON t.sym = q.sym");
		expect(body.joinConditions).toHaveLength(2);
	});

	it("models GROUP BY and HAVING and sets aggregated", () => {
		const { body } = selectBody("SELECT g, SUM(x) FROM t GROUP BY g HAVING SUM(x) > 0");
		expect(body.groupBy).toHaveLength(1);
		expect(body.having).toMatchObject({ kind: "binary", op: ">" });
		expect(body.aggregated).toBe(true);
	});

	it("sets aggregated for GROUP BY ALL and bare aggregates", () => {
		expect(selectBody("SELECT g, COUNT(*) FROM t GROUP BY ALL").body.aggregated).toBe(true);
		expect(selectBody("SELECT MAX(x) FROM t").body.aggregated).toBe(true);
	});

	it("models ORDER BY and LIMIT/OFFSET", () => {
		const { q } = selectBody("SELECT a FROM t ORDER BY a DESC LIMIT 10 OFFSET 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
	});

	it("models TOP n as the limit", () => {
		const { q } = selectBody("SELECT TOP 3 a FROM t");
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "3" });
	});

	it("models QUALIFY as a predicate with clause-tagged column refs", () => {
		const { body } = selectBody("SELECT a, ROW_NUMBER() OVER (ORDER BY a) rn FROM t QUALIFY rn = 1");
		expect(body.qualify).toMatchObject({ kind: "binary", op: "=" });
		expect(body.columns.some((c) => c.clause === "qualify" && c.parts.join(".") === "rn")).toBe(true);
		expect(body.unsupported ?? []).not.toContain("qualify");
	});

	it("lowers stars and qualified stars", () => {
		const plain = selectBody("SELECT * FROM t").body;
		expect(plain.projections[0]).toMatchObject({ isStar: true, expr: { kind: "star" } });
		const qualified = selectBody("SELECT t.* FROM t").body;
		expect(qualified.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("models the star modifiers EXCLUDE / ILIKE / RENAME / REPLACE", () => {
		const ex = selectBody("SELECT * EXCLUDE (a, b) FROM t").body.projections[0].expr;
		expect(ex).toMatchObject({ kind: "star", exclude: ["a", "b"] });

		const il = selectBody("SELECT * ILIKE '%amount%' FROM t").body.projections[0].expr;
		expect(il).toMatchObject({ kind: "star", ilike: "%amount%" });

		const rn = selectBody("SELECT * RENAME (a AS x, b AS y) FROM t").body.projections[0].expr;
		expect(rn).toMatchObject({
			kind: "star",
			rename: [
				{ from: "a", to: "x" },
				{ from: "b", to: "y" },
			],
		});

		const rp = selectBody("SELECT * REPLACE (amount / 100 AS amount) FROM t").body.projections[0].expr;
		if (rp.kind !== "star") throw new Error("star");
		expect(rp.replace?.[0].column).toBe("amount");
		expect(rp.replace?.[0].expr).toMatchObject({ kind: "binary", op: "/" });

		const combined = selectBody("SELECT t.* EXCLUDE (a) RENAME (c AS d) FROM t").body;
		expect(combined.projections[0].expr).toMatchObject({ kind: "star", exclude: ["a"], rename: [{ from: "c", to: "d" }] });
		expect(combined.unsupported ?? []).not.toContain("star-modifier");
	});

	it("collects scalar/IN/EXISTS subqueries into subqueries and predicate args", () => {
		const { body } = selectBody(
			"SELECT (SELECT MAX(x) FROM m) mx FROM t WHERE a IN (SELECT id FROM ids) AND EXISTS (SELECT 1 FROM e)",
		);
		expect(body.subqueries?.length).toBeGreaterThanOrEqual(3);
	});

	it("lowers FROM subqueries with alias", () => {
		const { body } = selectBody("SELECT * FROM (SELECT a FROM t) s");
		expect(body.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
	});

	it("lowers variant paths and subscripts onto subscript, :: onto cast", () => {
		const { body } = selectBody("SELECT payload:a.b::STRING, arr[0] FROM t");
		const cast = body.projections[0].expr;
		expect(cast.kind).toBe("cast");
		if (cast.kind !== "cast") return;
		expect(cast.expr.kind).toBe("subscript");
		if (cast.expr.kind !== "subscript") return;
		expect(cast.expr.base).toMatchObject({ kind: "column", parts: ["payload"] });
		expect(body.projections[1].expr).toMatchObject({ kind: "subscript", index: { kind: "literal", text: "0" } });
		expect(body.columns.some((c) => c.parts.join(".") === "payload")).toBe(true);
	});

	it("lowers searched and simple CASE (simple desugars to equality)", () => {
		const searched = selectBody("SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t").body;
		expect(searched.projections[0].expr.kind).toBe("case");
		const simple = selectBody("SELECT CASE a WHEN 1 THEN 'x' END FROM t").body;
		const expr = simple.projections[0].expr;
		if (expr.kind !== "case") throw new Error("case");
		expect(expr.whens[0].when).toMatchObject({ kind: "binary", op: "=" });
	});

	it("lowers IFF to a case", () => {
		const { body } = selectBody("SELECT IFF(a > 0, 'p', 'n') FROM t");
		expect(body.projections[0].expr.kind).toBe("case");
	});

	it("lowers lambdas as higher-order function arguments", () => {
		const { body } = selectBody("SELECT FILTER(arr, x -> x > 10) FROM t");
		const fn = body.projections[0].expr;
		if (fn.kind !== "function") throw new Error("function");
		expect(fn.args.some((a) => a.kind === "lambda" && a.params.includes("x"))).toBe(true);
	});

	it("lowers LATERAL FLATTEN to a lateral source exposing the six FLATTEN columns", () => {
		const { body } = selectBody("SELECT f.value FROM t, LATERAL FLATTEN(input => t.payload) f");
		const lateral = body.from.find((s) => s.kind === "lateral");
		expect(lateral).toBeDefined();
		if (lateral?.kind !== "lateral") return;
		expect(lateral.alias).toBe("f");
		expect(lateral.columns).toEqual(["SEQ", "KEY", "PATH", "INDEX", "VALUE", "THIS"]);
	});

	it("lowers PIVOT to PivotInfo", () => {
		const { body } = selectBody(
			"SELECT * FROM monthly_sales PIVOT (SUM(amount) FOR month IN ('JAN', 'FEB')) p",
		);
		expect(body.pivot).toBeDefined();
		expect(body.pivot?.values).toEqual(["JAN", "FEB"]);
		expect(body.pivot?.forColumns).toEqual(["month"]);
		expect(body.pivot?.aggColumns).toEqual(["amount"]);
	});

	it("lowers UNPIVOT to UnpivotInfo", () => {
		const { body } = selectBody("SELECT * FROM p UNPIVOT (sales FOR month IN (jan, feb, mar))");
		expect(body.unpivot).toMatchObject({ valueColumn: "sales", nameColumn: "month" });
		expect(body.unpivot?.removed).toEqual(["jan", "feb", "mar"]);
	});

	it("lowers an inline VALUES source to a modelled subquery select", () => {
		const { body } = selectBody("SELECT * FROM (VALUES (1, 'a'), (2, 'b')) v (id, name)");
		const src = body.from[0];
		expect(src).toMatchObject({ kind: "subquery", alias: "v", columnAliases: ["id", "name"] });
		if (src.kind !== "subquery") return;
		expect(src.query.body.kind).toBe("select");
		if (src.query.body.kind !== "select") return;
		expect(src.query.body.projections).toHaveLength(2);
	});

	it("lowers $n positional references as columns", () => {
		const { body } = selectBody("SELECT $1, $2 FROM @my_stage");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["$1"] });
	});

	it("captures window functions with partition and order keys", () => {
		const { body } = selectBody("SELECT ROW_NUMBER() OVER (PARTITION BY g ORDER BY ts DESC) rn FROM t");
		const fn = body.projections[0].expr;
		if (fn.kind !== "function") throw new Error("function");
		expect(fn.window?.partitionBy).toHaveLength(1);
		expect(fn.window?.orderBy).toHaveLength(1);
		expect(body.columns.some((c) => c.parts.join(".") === "g")).toBe(true);
	});

	it("flags non-query statements instead of throwing", () => {
		const { q } = ir("DELETE FROM t WHERE a = 1");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.unsupported).toContain("non-query");
	});
});
