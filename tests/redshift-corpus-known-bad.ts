// Scraped Redshift docs examples that fail to parse for reasons other than the three GAP fixes
// (r_object_transform_function/1.sql, super-configurations/2.sql, nested-data-use-cases/7.sql are
// NOT listed here; those are real grammar gaps and now parse clean). Two categories:
//
// 1. Docs bugs: the scraped example is not valid SQL, a typo/truncation in the vendor's own page,
//    curly/smart quotes the scraper carried through literally, BNF metasyntax (`[ OR REPLACE ]`,
//    `argname`, `procedure_body`) captured as if it were a SQL literal, or a stray response/heading
//    line interleaved with the example. Each reason cites the specific defect, RTFM'd against the
//    live AWS page (or, where noted, a search-snippet quote when the live page could not be
//    re-fetched reliably).
//
// 2. Out-of-scope wrappers: the example is syntactically coherent Redshift SQL, but wraps or IS
//    object DDL / a procedure-or-function body, which is out of scope per CLAUDE.md ("object DDL:
//    CREATE/ALTER/DROP-style object management ... UDF bodies"). The CREATE PROCEDURE/FUNCTION `$$
//    ... $$` group is additionally truncated by the scraper (every one has exactly one `$$`, an odd
//    count; the closing delimiter and trailing LANGUAGE clause were cut at the doc-page boundary).
//    A complete, well-formed `CREATE PROCEDURE ... AS $$ ... $$ LANGUAGE plpgsql;` parses fine today
//    (the body is consumed as one opaque token, verified via temp_auto/redshift-dollarquote-probe.mjs),
//    so the truncation is the proximate parse failure, and the body-out-of-scope framing is why fixing
//    the scraper wouldn't move these into the query bucket anyway.
//
// Each key is a path relative to harness/local/redshift-docs (forward slashes, matching the existing
// KNOWN_BAD in tests/corpus/redshift.test.ts).

export const KNOWN_BAD: Record<string, string> = {
	// --- Docs bugs -------------------------------------------------------------------------------
	"r_CREATE_PROCEDURE/1.sql":
		"BNF metasyntax scraped as SQL: `CREATE [ OR REPLACE ] PROCEDURE ... ( [ [ argname ] ... ] )` " +
		"with literal bracket notation and placeholder words (procedure_body), same defect class as " +
		"iceberg-writes-sql-syntax/5.sql.",
	"iceberg-writes-sql-syntax/5.sql":
		"BNF metasyntax scraped as SQL: `MERGE INTO ... USING source_table [ [ AS ] alias ] ... " +
		"[ WHEN MATCHED THEN ... ]` with literal bracket notation, not an executable statement.",
	"r_GROUP_BY_clause/3.sql":
		"AWS doc typo, missing comma between col2 and sum(col3): `SELECT col1, col2 sum(col3) ... " +
		"GROUP BY ALL`. (GROUP BY ALL itself parses; see redshift.test.ts.) Verified live.",
	"r_SET_CONFIG/2.sql":
		"AWS doc uses typographic smart quotes ('...') around the SET_CONFIG arguments, not valid SQL " +
		"string delimiters.",
	"r_CREATE_EXTERNAL_TABLE_examples/16.sql":
		"AWS doc uses a typographic smart closing quote (not a straight quote) to close the LOCATION " +
		"string literal, behind a CREATE EXTERNAL TABLE DDL wrapper.",
	"r_query_group/1.sql":
		"scraper interleaved a psql response line ('SET') between two real statements. Verified live.",
	"r_CREATE_VIEW/8.sql":
		"scraper captured the trailing 'Show View DDL statement' heading text as part of the example, " +
		"after a genuine CREATE VIEW ... SHOW VIEW pair.",
	"r_Serializable_isolation_example/3.sql":
		"deliberate pseudocode inside a BEGIN...END block ('delete one row from USERS table;'), not " + "real SQL.",
	"tutorial_multi-class_classification/7.sql":
		"AWS doc has unbalanced parentheses, the first SELECT closes with ) but has no opening ( " + "before UNION.",
	"r_COPY_command_examples/34.sql":
		"AWS doc Oracle-export example REPLACE(c2, \\n',\\\\n') is malformed: a stray \\n sits outside " +
		"the string and the quotes are mismatched.",
	"SYS_DATASHARE_USAGE_PRODUCER/1.sql":
		"AWS doc typo, SELECT DISTINCT with an empty select list before FROM. The live page fetch was " +
		"unreliable; classified from a search snippet quoting the same broken text.",

	// --- Out-of-scope wrappers: CREATE PROCEDURE / FUNCTION `$$ ... $$` bodies -------------------
	// 44 files (full enumeration of positive/unparsed containing `$$`, minus r_CREATE_PROCEDURE/1.sql
	// above; the scout's "12" was an undercount). Each is a scraped PL/pgSQL procedure or function
	// example truncated at the doc-page boundary (odd `$$` count; the closing delimiter is missing).
	"c_PLpgSQL-statements/2.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-statements/5.sql":
		"fragment of a dynamic-SQL EXECUTE string from within a truncated procedure body (the lone $$ is " +
		"part of a string literal being concatenated, not a real dollar-quote delimiter).",
	"c_PLpgSQL-statements/6.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-statements/7.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-statements/8.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-structure/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-structure/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-structure/4.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-structure/5.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"c_PLpgSQL-structure/6.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"declare/1.sql": "truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"H3_ToChildren-function/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"materialized-view-UDFs/3.sql": "truncated CREATE FUNCTION $$ body (missing closing $$); out-of-scope UDF body.",
	"r_CALL_procedure/2.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"r_CHANGE_SESSION_PRIORITY/4.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"r_CREATE_PROCEDURE/2.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"r_CREATE_PROCEDURE/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"r_CREATE_PROCEDURE/4.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"r_CREATE_PROCEDURE/5.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-create/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-create/2.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-create/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-result-set/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-result-set/5.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-security-and-privileges/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/10.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/12.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/14.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/15.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/4.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/5.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/6.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/7.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/8.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-transaction-management/9.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/1.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/3.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/4.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/5.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/7.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"stored-procedure-trapping-errors/9.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",
	"tutorial_regression/6.sql":
		"truncated CREATE PROCEDURE $$ body (missing closing $$/LANGUAGE); out-of-scope UDF body.",

	// --- Out-of-scope wrappers: other object DDL --------------------------------------------------
	"r_CREATE_EXTERNAL_TABLE_examples/2.sql":
		"CREATE EXTERNAL TABLE ... ROW FORMAT SERDE ... WITH SERDEPROPERTIES (...); object DDL, out of scope.",
	"querying-s3Tables/1.sql":
		"CREATE EXTERNAL SCHEMA ... FROM DATA CATALOG DATABASE ... (S3 Tables integration) wrapping a " +
		"trailing query; object DDL, out of scope.",
	"querying-s3Tables/2.sql":
		"CREATE DATABASE ... FROM ARN ... WITH DATA CATALOG SCHEMA ... (S3 Tables integration) wrapping a " +
		"trailing query; object DDL, out of scope.",
	"tutorial_multi-class_classification/3.sql":
		"CREATE MODEL ... FUNCTION ... SETTINGS (...); object DDL, out of scope.",
	"r_CTAS_examples/3.sql":
		"CREATE TABLE ... AS with DISTKEY(1) SORTKEY(1,3): ordinal (1-based positional) DISTKEY/SORTKEY " +
		"instead of a column name, a CTAS-only DDL extension, out of scope.",
	"c_Examples_of_INSERT_30/8.sql":
		"CREATE TABLE with a bare IDENTITY column attribute (no seed/step parens); the grammar's " +
		"rs_colattribute requires IDENTITY(seed, step); object DDL, out of scope.",
};
