// Scraped trinodb docs examples that are not valid Trino SQL as extracted: docs typos, foreign-
// dialect passthrough blocks, and scraper concatenation errors, each verified against the pinned
// trinodb docs source page. The corpus is the docs verbatim (tools/extract-trino-docs.mjs), so a
// broken example becomes a broken `.sql` file that the parser correctly rejects. These are
// excluded from the in-scope query gate and asserted to STILL fail: if the docs get fixed or the
// grammar grows, a re-run moves the file into query/ and the gate flags the entry as stale so it
// gets removed (self-policing). Same mechanism as the Snowflake corpus
// (tests/snowflake-corpus-known-bad.ts).
//
// Each key is a path relative to the docs page root (forward slashes).

export const KNOWN_BAD: Record<string, string> = {
	"connector_hive/14.sql":
		"intentionally partial CREATE TABLE properties illustration, no column list and no AS SELECT",
	"connector_lakehouse/1.sql":
		"missing comma between \"type = 'ICEBERG'\" and \"format = 'PARQUET'\" (typo live in current docs)",
	"connector_oracle/7.sql":
		"scrape corrupted the doubled-quote escaping (page has sales[''Bounce'', 2001]; file has undoubled quotes)",
	"connector_pinot/5.sql":
		"the block is the page's translated Pinot PQL (TOP 30000), not Trino SQL, scraper grabbed the wrong block",
	"connector_sqlserver/8.sql":
		"sqlserver.md CREATE STATISTICS is a SQL Server command, documented to run on the remote database, not Trino syntax",
	"connector_sqlserver/9.sql":
		"sqlserver.md UPDATE STATISTICS is a SQL Server command, documented to run on the remote database, not Trino syntax",
	"functions_table/5.sql": "two independent one-line examples concatenated without a separator by the scraper",
	"sql_execute-immediate/3.sql":
		"execute-immediate.md shows the PREPARE/EXECUTE/DEALLOCATE sequence as three unterminated statements, an illustration of the flow, not a batch",
	"sql_explain/6.sql":
		"explain.md (TYPE VALIDATE) example is deliberately invalid ('SELET'), it demonstrates the validation error output",
};
