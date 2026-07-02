import { describe, expect, it } from "vitest";
import { lower as lowerBigQuery, statementCategories as bigQueryCategories } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower as lowerDatabricks, statementCategories as databricksCategories } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { coarseKind, type StatementCategory } from "../src/ir/statement.js";
import { lower as lowerRedshift, statementCategories as redshiftCategories } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower as lowerSnowflake, statementCategories as snowflakeCategories } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { lower as lowerTSql, statementCategories as tsqlCategories } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// Statement kind must come from the PARSE — each dialect's lower() reports the category onto the
// IR, derived from the matched top-level rule, not a text heuristic. The hard cases that a leading-
// keyword regex gets wrong (a CTE in front of DML reads as a query; a CTAS reads as a query) must
// land in the right bucket because the grammar already distinguished them.

function databricks(sql: string): StatementCategory {
	const { errors } = parseDatabricks(sql);
	expect(errors, `parse errors for: ${sql}`).toBe(0);
	return lowerDatabricks(parseDatabricks(sql).tree).statement ?? "other";
}

function snowflake(sql: string): StatementCategory {
	const { errors } = parseSnowflake(sql);
	expect(errors, `parse errors for: ${sql}`).toBe(0);
	return lowerSnowflake(parseSnowflake(sql).tree).statement ?? "other";
}

describe("Databricks statement category (from the parse)", () => {
	it("query forms", () => {
		expect(databricks("SELECT a FROM t")).toBe("query");
		expect(databricks("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(databricks("VALUES (1), (2)")).toBe("query");
		expect(databricks("TABLE t")).toBe("query");
	});

	it("DML — including a CTE in front of it (the case a regex gets wrong)", () => {
		expect(databricks("INSERT INTO t SELECT a FROM s")).toBe("dml");
		expect(databricks("WITH c AS (SELECT 1 AS x) INSERT INTO t SELECT x FROM c")).toBe("dml");
		expect(databricks("DELETE FROM t WHERE a = 1")).toBe("dml");
		expect(databricks("UPDATE t SET a = 1")).toBe("dml");
		expect(databricks("MERGE INTO t USING s ON t.a = s.a WHEN MATCHED THEN UPDATE SET t.a = s.a")).toBe("dml");
	});

	it("DDL — including CTAS, which embeds a query but is still DDL", () => {
		expect(databricks("CREATE TABLE t (a INT)")).toBe("ddl");
		expect(databricks("CREATE TABLE t AS SELECT a FROM s")).toBe("ddl");
		expect(databricks("DROP TABLE t")).toBe("ddl");
		expect(databricks("ALTER TABLE t ADD COLUMN b INT")).toBe("ddl");
	});

	it("the finer categories stay visible, not folded into one bucket", () => {
		expect(databricks("GRANT SELECT ON TABLE t TO `u`")).toBe("dcl");
		expect(databricks("USE db")).toBe("utility");
		expect(databricks("SHOW TABLES")).toBe("utility");
		expect(databricks("SET spark.sql.shuffle.partitions = 4")).toBe("utility");
	});

	it("a BEGIN…END script is a compound", () => {
		expect(databricks("BEGIN SELECT 1; END")).toBe("compound");
	});

	it("a multi-statement batch is a compound (issue #1 — batch parse entry)", () => {
		expect(databricks("SELECT 1; SELECT 2")).toBe("compound");
	});
});

describe("Snowflake statement category (from the parse)", () => {
	it("query / dml / ddl by the grammar's grouping rules", () => {
		expect(snowflake("SELECT 1")).toBe("query");
		expect(snowflake("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(snowflake("INSERT INTO t SELECT * FROM s")).toBe("dml");
		expect(snowflake("CREATE TABLE t (a INT)")).toBe("ddl");
		expect(snowflake("DROP TABLE t")).toBe("ddl");
	});

	it("utility and a multi-statement batch", () => {
		expect(snowflake("SHOW TABLES")).toBe("utility");
		expect(snowflake("USE WAREHOUSE wh")).toBe("utility");
		expect(snowflake("SELECT 1; SELECT 2")).toBe("compound");
	});
});

function tsql(sql: string): StatementCategory {
	const { errors } = parseTSql(sql);
	expect(errors, `parse errors for: ${sql}`).toBe(0);
	return lowerTSql(parseTSql(sql).tree).statement ?? "other";
}

describe("T-SQL statement category (one full-range entry, on par with the others)", () => {
	it("reports query / dml / ddl / dcl / utility / compound from the parse", () => {
		expect(tsql("SELECT a FROM t")).toBe("query");
		expect(tsql("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(tsql("INSERT INTO t (a) VALUES (1)")).toBe("dml");
		expect(tsql("UPDATE t SET a = 1")).toBe("dml");
		expect(tsql("CREATE TABLE t (a INT)")).toBe("ddl");
		expect(tsql("ALTER TABLE t ADD b INT")).toBe("ddl");
		expect(tsql("DROP TABLE t")).toBe("ddl");
		expect(tsql("CREATE VIEW v AS SELECT a FROM t")).toBe("ddl");
		expect(tsql("GRANT SELECT ON t TO u")).toBe("dcl");
		expect(tsql("DECLARE @x INT")).toBe("utility");
		expect(tsql("SELECT a FROM t; SELECT b FROM u")).toBe("compound");
	});

	it("reports transaction control as tcl, like the other dialects", () => {
		expect(tsql("BEGIN TRANSACTION")).toBe("tcl");
		expect(tsql("COMMIT")).toBe("tcl");
		expect(tsql("ROLLBACK")).toBe("tcl");
	});

	it("classifies SELECT INTO / variable-assignment SELECT through a CTE prefix", () => {
		// The side-effecting SELECT forms must not flip to "query" just because a WITH
		// clause precedes them — the check targets the OUTER statement's spec, not the
		// first query_specification in document order (which is the CTE body's).
		expect(tsql("SELECT x INTO #t FROM u")).toBe("dml");
		expect(tsql("WITH c AS (SELECT 1 AS x) SELECT x INTO #t FROM c")).toBe("dml");
		expect(tsql("SELECT @v = x FROM u")).toBe("other");
		expect(tsql("WITH c AS (SELECT 1 AS x) SELECT @v = x FROM c")).toBe("other");
		expect(tsql("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
	});

	it("models the query body for the query category", () => {
		const q = lowerTSql(parseTSql("SELECT a, b FROM t").tree);
		expect(q.statement).toBe("query");
		expect(q.body.kind).toBe("select");
		if (q.body.kind !== "pipe") expect(q.body.columns.length).toBeGreaterThan(0);
	});
});

// Per-statement kinds — every dialect exports statementCategories(tree), one entry per top-level
// batch element (the file-level view T-SQL already exposed). Task 3's corpus reclassifier reads
// these instead of re-bucketing each gate. The list must agree with the folded top-level category
// (>1 element → compound) that the existing describe blocks above pin.
describe("statementCategories — per-statement kinds on all five dialects", () => {
	function databricksKinds(sql: string): StatementCategory[] {
		const { tree, errors } = parseDatabricks(sql);
		expect(errors, `parse errors for: ${sql}`).toBe(0);
		return databricksCategories(tree);
	}
	function snowflakeKinds(sql: string): StatementCategory[] {
		const { tree, errors } = parseSnowflake(sql);
		expect(errors, `parse errors for: ${sql}`).toBe(0);
		return snowflakeCategories(tree);
	}
	function bigQueryKinds(sql: string): StatementCategory[] {
		const { tree, errors } = parseBigQuery(sql);
		expect(errors, `parse errors for: ${sql}`).toBe(0);
		return bigQueryCategories(tree);
	}
	function redshiftKinds(sql: string): StatementCategory[] {
		const { tree, errors } = parseRedshift(sql);
		expect(errors, `parse errors for: ${sql}`).toBe(0);
		return redshiftCategories(tree);
	}

	it("per-statement kinds, all five dialects (parity with tsql's statementCategories)", () => {
		expect(tsqlCategories(parseTSql("SELECT 1; INSERT INTO t (a) VALUES (1)").tree)).toEqual(["query", "dml"]);
		expect(databricksKinds("SELECT 1; INSERT INTO t VALUES (1); CREATE TABLE t2 (a INT)")).toEqual([
			"query",
			"dml",
			"ddl",
		]);
		expect(snowflakeKinds("SELECT 1; INSERT INTO t VALUES (1)")).toEqual(["query", "dml"]);
		expect(bigQueryKinds("SELECT 1; INSERT INTO t VALUES (1)")).toEqual(["query", "dml"]);
		expect(redshiftKinds("SELECT 1; INSERT INTO t VALUES (1); GRANT SELECT ON t TO u")).toEqual([
			"query",
			"dml",
			"dcl",
		]);
	});

	it("redshift structural detection replaces the keyword fallback for the core statements", () => {
		expect(redshiftKinds("UPDATE t SET a = 1")).toEqual(["dml"]);
		expect(redshiftKinds("CREATE TABLE t (a INT)")).toEqual(["ddl"]);
		expect(redshiftKinds("BEGIN; COMMIT")).toEqual(["tcl", "tcl"]);
		// ANALYZE / VACUUM are maintenance utilities — structural detection lands them in utility,
		// where the leading-keyword guess (keywordCategory) wrongly said ddl.
		expect(redshiftKinds("VACUUM")).toEqual(["utility"]);
		expect(redshiftKinds("ANALYZE t")).toEqual(["utility"]);
		// ABORT / END are transaction control the keyword guess missed (→ other); structural → tcl.
		expect(redshiftKinds("ABORT")).toEqual(["tcl"]);
	});

	it("redshift counts only top-level stmts — a CREATE FUNCTION with a BEGIN ATOMIC body is ONE ddl", () => {
		// The grammar nests `stmt` inside createfunc_opt_item (`BEGIN ATOMIC <stmt>; END`,
		// RedshiftParser.g4). A deep descendant walk would count the inner SELECT as a second
		// top-level statement (→ ["ddl","query"], which the bucket rule then mis-reads as a query).
		// statementCategories must walk only the stmtmulti's direct stmt children — one entry, ddl.
		expect(redshiftKinds("CREATE FUNCTION f() RETURNS int VOLATILE BEGIN ATOMIC SELECT 1; END")).toEqual(["ddl"]);
	});

	it("empty input yields no statements (no phantom entry)", () => {
		expect(redshiftCategories(parseRedshift("").tree)).toEqual([]);
		expect(databricksCategories(parseDatabricks("").tree)).toEqual([]);
	});

	it("the single-statement list agrees with the folded top-level category", () => {
		// The list's sole entry equals lower().statement for a single statement, every dialect.
		expect(redshiftCategories(parseRedshift("SELECT a FROM t").tree)).toEqual([
			lowerRedshift(parseRedshift("SELECT a FROM t").tree).statement,
		]);
		expect(databricksCategories(parseDatabricks("CREATE TABLE t (a INT)").tree)).toEqual([
			lowerDatabricks(parseDatabricks("CREATE TABLE t (a INT)").tree).statement,
		]);
		expect(snowflakeCategories(parseSnowflake("INSERT INTO t SELECT * FROM s").tree)).toEqual([
			lowerSnowflake(parseSnowflake("INSERT INTO t SELECT * FROM s").tree).statement,
		]);
		expect(bigQueryCategories(parseBigQuery("SELECT 1").tree)).toEqual([
			lowerBigQuery(parseBigQuery("SELECT 1").tree).statement,
		]);
	});
});

describe("coarse rollup and the semantic-layer surface", () => {
	it("coarseKind folds dcl/tcl/utility/compound into other; keeps query/dml/ddl", () => {
		expect(coarseKind("query")).toBe("query");
		expect(coarseKind("dml")).toBe("dml");
		expect(coarseKind("ddl")).toBe("ddl");
		expect(coarseKind("dcl")).toBe("other");
		expect(coarseKind("tcl")).toBe("other");
		expect(coarseKind("utility")).toBe("other");
		expect(coarseKind("compound")).toBe("other");
		expect(coarseKind("other")).toBe("other");
	});

	it("resolveScopes carries the category onto the scope tree", () => {
		const ddl = lowerDatabricks(parseDatabricks("CREATE TABLE t (a INT)").tree);
		expect(resolveScopes(ddl, "databricks").statement).toBe("ddl");
		const q = lowerDatabricks(parseDatabricks("SELECT a FROM t").tree);
		expect(resolveScopes(q, "databricks").statement).toBe("query");
	});
});
