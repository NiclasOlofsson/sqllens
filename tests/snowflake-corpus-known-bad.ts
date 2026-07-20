// Scraped Snowflake docs examples that stay under harness/local/snowflake-docs/parser/positive/unparsed/
// and are asserted to STAY there (self-policing): if a rebuild moves one out (the docs got fixed, or
// the grammar grew to cover it), the assertion in tests/helpers/docs-ratchet.ts fails and the entry is
// removed. Each key is a path relative to harness/local/snowflake-docs (forward slashes).
//
// Three categories:
//
// 1. Docs bugs (scout-verified) — the vendor's own example is not valid SQL (typo, truncation, an
//    explicit "-- Not allowed" counter-example). The corpus is the docs verbatim
//    (tools/scrape-snowflake-docs.mjs), so a broken example becomes a broken `.sql` file that the
//    parser correctly rejects.
// 2. Deferred to the DML wave — real, documented syntax this project has ruled to defer, not a defect.
// 3. Out-of-scope wrappers — object DDL / platform statements (CREATE DYNAMIC TABLE, CREATE TASK,
//    CREATE PIPE, policies, …) that wrap an otherwise-fine query; object DDL is out of scope
//    (see CLAUDE.md § Scope), so the wrapper stays unparsed even though the query inside it is fine.

export const KNOWN_BAD: Record<string, string> = {
	// ---------------------------------------------------------------------------------------------
	// 1. Docs bugs (scout-verified)
	// ---------------------------------------------------------------------------------------------

	// Unbalanced parentheses / malformed literals — structurally not parseable.
	"functions/ai_translate/3.sql": "extra '(' before the text argument leaves AI_TRANSLATE's outer paren unclosed",
	"functions/get_job_history/1.sql": "GET_JOB_HISTORY(() — unbalanced parentheses",
	"functions/st_azimuth/3.sql": "inner TO_GEOMETRY(...) is never closed",
	"functions/st_azimuth/4.sql": "TO_GEOMETRY(0.707 0.707') — malformed coordinate/quote",
	"sql/create-semantic-view/5.sql": "missing closing ')' on SEMANTIC VIEW(...) — example truncated",
	"classes/budget/methods/remove_resource/3.sql": "REMOVE_RESOURCE(SELECT ...) — unclosed parens, no trailing semicolon",

	// CTE body must be a query (SELECT/VALUES/…); these bind a CTE name to a bare scalar call.
	"functions/decrypt_raw/7.sql": "WITH … AS (decrypt_raw(...)) — a CTE body must be a query, not a scalar expression",
	"functions/encrypt_raw/5.sql": "WITH … AS (decrypt_raw(...)) — a CTE body must be a query, not a scalar expression",
	"functions/st_distance/1.sql": "WITH d AS (ST_DISTANCE(...)) — a CTE body must be a query, not a scalar expression",
	"functions/st_hausdorffdistance/2.sql":
		"WITH a AS (TO_GEOGRAPHY(...)) — a CTE body must be a query, not a scalar expression",

	// Invalid identifiers / references.
	"organization-usage/copy_history/1.sql":
		"FROM …organization_usage.copy-history — hyphen in an unquoted identifier (typo for copy_history)",
	"organization-usage/lock_wait_history/1.sql":
		"4-part table reference …organization_usage.alert_history.lock_wait_history (a table ref is at most db.schema.object)",

	// Malformed string literals (stray doubled quote).
	"functions/system_validate_storage_integration/2.sql": "stray doubled quote in 's3://…/test_path/''",
	"functions/system_validate_storage_integration/3.sql": "stray doubled quote in 'gcs://…/test_path/''",

	// Unquoted IP literal as an argument.
	"functions/system_block_internal_stages_public_access_with_exception/1.sql":
		"unquoted IP literal 100.0.0.1 as an argument (should be a quoted string)",

	// WITH … AS PROCEDURE definitions with no trailing CALL — the CALL lives in a separate docs
	// block, so the scraped statement is incomplete. docs.snowflake.com/en/sql-reference/sql/call-with
	"sql/call-with/14.sql": "WITH … AS PROCEDURE definition with no trailing CALL — incomplete statement",
	"sql/call-with/15.sql": "WITH … AS PROCEDURE definition with no trailing CALL — incomplete statement",
	"sql/call-with/17.sql": "WITH … AS PROCEDURE definition with no trailing CALL — incomplete statement",
	"sql/call-with/18.sql": "WITH … AS PROCEDURE definition with no trailing CALL — incomplete statement",

	// Typos / missing punctuation in the scraped page text.
	"functions/regr_syy/1.sql": "typo: CREATE OR REPLACE TABLEE (extra E)",
	"functions/task_history/5.sql": "page is missing the semicolon between `DESC TASK my_task` and `SET task_id=...`",

	// The scraper pasted a query-result table (row/value listing) into the code block, not SQL.
	"external-functions-creating-aws-sample-asynchronous/1.sql":
		"scraper pasted the query's RESULT ROWS (a Row/EXT_FUNC_ASYNC(A) table) into the code block, not SQL",

	// docs.snowflake.com/en/sql-reference/sql/call — the page's own "-- Not allowed" counter-examples.
	"sql/call/5.sql": "the page's own '-- Not allowed' counter-example (CALL used as an expression / subquery)",

	// ---------------------------------------------------------------------------------------------
	// 2. Deferred to the DML wave (real, documented syntax; standing ruling, not a defect)
	// ---------------------------------------------------------------------------------------------

	// INSERT ALL / INSERT OVERWRITE ALL multi-table insert: docs.snowflake.com/en/sql-reference/sql/insert-multi-table
	"sql/insert-multi-table/2.sql": "documented INSERT ALL / INSERT OVERWRITE ALL multi-table insert — deferred to the DML wave",
	"sql/insert-multi-table/5.sql": "documented INSERT ALL multi-table insert — deferred to the DML wave",

	// ---------------------------------------------------------------------------------------------
	// 3. Out-of-scope wrappers (object DDL / platform statements wrapping a query)
	// ---------------------------------------------------------------------------------------------

	// CREATE/ALTER [OR ALTER] DYNAMIC [ICEBERG] TABLE: docs.snowflake.com/en/sql-reference/sql/create-dynamic-table
	// (+ alter-dynamic-table). The base form is modeled; these 14 use a clause/variant that isn't:
	// OR ALTER, ICEBERG, CLONE, COPY GRANTS, COPY TAGS, REQUIRE, FROZEN, WITH STORAGE, EXTERNAL_VOLUME,
	// and ALTER DYNAMIC TABLE ... REFRESH COPY SESSION. Object DDL, out of scope.
	"sql/create-dynamic-table/3.sql": "CREATE ... DYNAMIC TABLE ... CLONE ... — CLONE variant not modeled",
	"sql/create-dynamic-table/4.sql": "CREATE ... DYNAMIC TABLE ... COPY GRANTS — clause not modeled",
	"sql/create-dynamic-table/5.sql": "CREATE ... DYNAMIC TABLE ... COPY TAGS AS SELECT ... — clause not modeled",
	"sql/create-dynamic-table/7.sql": "CREATE DYNAMIC ICEBERG TABLE — ICEBERG variant not modeled",
	"sql/create-dynamic-table/9.sql": "CREATE DYNAMIC TABLE ... CLONE ... AT (...) — CLONE variant not modeled",
	"sql/create-dynamic-table/10.sql": "CREATE DYNAMIC TABLE ... REQUIRE ... — clause not modeled",
	"sql/create-dynamic-table/11.sql": "ALTER DYNAMIC TABLE ... REFRESH COPY SESSION — clause not modeled",
	"sql/create-dynamic-table/12.sql": "CREATE DYNAMIC TABLE ... FROZEN ... — clause not modeled",
	"sql/create-dynamic-table/13.sql": "CREATE OR ALTER DYNAMIC TABLE — OR ALTER variant not modeled",
	"sql/create-dynamic-table/14.sql": "CREATE OR ALTER DYNAMIC TABLE — OR ALTER variant not modeled",
	"sql/create-dynamic-table/15.sql": "CREATE OR ALTER DYNAMIC TABLE — OR ALTER variant not modeled",
	"sql/create-dynamic-table/16.sql": "CREATE OR ALTER DYNAMIC TABLE — OR ALTER variant not modeled",
	"sql/create-dynamic-table/17.sql": "CREATE DYNAMIC ICEBERG TABLE ... EXTERNAL_VOLUME ... — ICEBERG variant + clause not modeled",
	"sql/create-dynamic-table/18.sql": "CREATE DYNAMIC TABLE ... WITH STORAGE ... — clause not modeled",

	// CREATE TABLE / CREATE EXTERNAL TABLE ... USING TEMPLATE (...): infers columns from a query;
	// the USING TEMPLATE clause isn't modeled. docs.snowflake.com/en/sql-reference/sql/create-table
	"functions/infer_schema/5.sql": "CREATE TABLE ... USING TEMPLATE (...) — clause not modeled",
	"sql/create-external-table/21.sql": "CREATE EXTERNAL TABLE ... USING TEMPLATE (...) — clause not modeled",
	"sql/create-external-table/22.sql": "CREATE EXTERNAL TABLE ... USING TEMPLATE (...) — clause not modeled",
	"sql/create-table/13.sql": "CREATE TABLE ... USING TEMPLATE (...) — clause not modeled",

	// CREATE INTERACTIVE TABLE / CREATE INTERACTIVE MATERIALIZED VIEW (Interactive Tables preview
	// feature): docs.snowflake.com/en/sql-reference/sql/create-interactive-table
	"sql/create-interactive-table/1.sql": "CREATE INTERACTIVE TABLE — object kind not modeled",
	"sql/create-interactive-table/2.sql": "CREATE INTERACTIVE TABLE — object kind not modeled",
	"sql/create-interactive-table/3.sql": "CREATE INTERACTIVE TABLE — object kind not modeled",
	"sql/create-interactive-table/4.sql": "CREATE OR REPLACE INTERACTIVE TABLE — object kind not modeled",
	"sql/create-materialized-view/2.sql": "CREATE INTERACTIVE MATERIALIZED VIEW — object kind not modeled",

	// CREATE OR ALTER TASK: docs.snowflake.com/en/sql-reference/sql/create-task (create_task only has
	// or_replace, not or_alter).
	"sql/create-task/20.sql": "CREATE OR ALTER TASK — OR ALTER variant not modeled",
	"sql/create-task/21.sql": "CREATE OR ALTER TASK — OR ALTER variant not modeled",
	"sql/execute-dbt-project/4.sql": "CREATE OR ALTER TASK ... AS EXECUTE DBT PROJECT ... — OR ALTER variant not modeled",

	// CREATE PIPE: docs.snowflake.com/en/sql-reference/sql/create-pipe — object DDL, out of scope.
	"sql/create-pipe/3.sql": "CREATE PIPE ... AS (COPY INTO ...) — object kind not modeled",
	"sql/create-pipe/8.sql": "CREATE OR REPLACE PIPE ... AS COPY INTO ... — object kind not modeled",
	"sql/create-pipe/9.sql": "CREATE OR REPLACE PIPE ... AS COPY INTO ... — object kind not modeled",
	"sql/create-pipe/10.sql": "CREATE OR REPLACE PIPE ... AS COPY INTO ... — object kind not modeled",

	// Row access policies (docs.snowflake.com/en/sql-reference/sql/create-row-access-policy) and the
	// Storage Lifecycle Policies preview feature (docs.snowflake.com/en/sql-reference/sql/create-storage-lifecycle-policy
	// + alter-/desc-/drop-/show- siblings) — object DDL, out of scope.
	"functions/is_role_in_session/9.sql": "CREATE OR REPLACE ROW ACCESS POLICY ... — object kind not modeled",
	"sql/create-row-access-policy/2.sql": "CREATE OR REPLACE ROW ACCESS POLICY — object kind not modeled",
	"sql/alter-view/8.sql": "ALTER VIEW ... DROP/ADD ROW ACCESS POLICY ... — clause not modeled",
	"sql/create-storage-lifecycle-policy/1.sql": "CREATE STORAGE LIFECYCLE POLICY — object kind not modeled",
	"sql/alter-storage-lifecycle-policy/1.sql": "ALTER STORAGE LIFECYCLE POLICY — object kind not modeled",
	"sql/desc-storage-lifecycle-policy/1.sql": "DESCRIBE STORAGE LIFECYCLE POLICY — object kind not modeled",
	"sql/drop-storage-lifecycle-policy/1.sql": "DROP STORAGE LIFECYCLE POLICY — object kind not modeled",
	"sql/show-storage-lifecycle-policies/1.sql": "SHOW STORAGE LIFECYCLE POLICIES — object kind not modeled",

	// CREATE ALERT: docs.snowflake.com/en/sql-reference/sql/create-alert — object DDL, out of scope.
	"functions/system_get_alert_config/1.sql": "CREATE OR REPLACE ALERT ... — object kind not modeled",

	// CREATE VIEW ... WITH DATA METRIC FUNCTION ... EXPECTATION (...): docs.snowflake.com/en/sql-reference/sql/create-view
	"sql/create-view/13.sql": "CREATE VIEW ... WITH DATA METRIC FUNCTION ... EXPECTATION (...) — clause not modeled",

	// Generated column in CREATE TABLE (`j INT AS (i * i)`): docs.snowflake.com/en/sql-reference/data-types-virtual-columns
	"virtual-columns/8.sql": "CREATE TABLE x (i INT, j INT AS (i * i)) — generated-column clause not modeled",

	// CREATE [OR ALTER SECURE] DATA METRIC FUNCTION: docs.snowflake.com/en/sql-reference/sql/create-data-metric-function
	"sql/create-data-metric-function/1.sql": "CREATE OR REPLACE DATA METRIC FUNCTION — object kind not modeled",
	"sql/create-data-metric-function/2.sql": "CREATE OR REPLACE DATA METRIC FUNCTION — object kind not modeled",
	"sql/create-data-metric-function/3.sql": "CREATE OR ALTER SECURE DATA METRIC FUNCTION — object kind not modeled",

	// CREATE DATABASE ... / COPY INTO @stage/manifest.yml preamble (Organization Profile setup):
	// docs.snowflake.com/en/sql-reference/sql/create-organization-profile
	"sql/create-organization-profile/1.sql": "CREATE DATABASE/STAGE + COPY INTO @stage/manifest.yml preamble — object DDL, out of scope",

	// Misc DDL/platform preambles ahead of the actual (in-scope) query.
	"functions/get_stage_location/1.sql": "CREATE STAGE ... URL = '...' preamble — CREATE STAGE URL clause not modeled",
	"functions/system_set_row_timestamp_on_all_supported_tables/1.sql":
		"SHOW PARAMETERS ... IN SCHEMA db.schema (dotted 2-part schema) — clause not modeled",
	"functions/to_file/9.sql":
		"COPY INTO ... FILE_FORMAT = (FORMAT_NAME = parquet_format) MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE — COPY option surface gap",
	"functions/to_file/10.sql": "CREATE OR REPLACE PIPE ... AS COPY INTO ... preamble — CREATE PIPE object kind not modeled",

	// EXECUTE IMMEDIATE FROM '<file>' — a Snowflake Scripting statement:
	// docs.snowflake.com/en/sql-reference/sql/execute-immediate-from
	"sql/execute-immediate-from/6.sql": "EXECUTE IMMEDIATE FROM './insert-inventory.sql' — scripting statement not modeled",

	// SHOW BACKUPS/SNAPSHOTS IN ... SET ... ->> <query> — the ->> result-chaining operator:
	// docs.snowflake.com/en/sql-reference/sql/show-backups-in-backup-set (+ show-snapshots-in-snapshot-set)
	"sql/show-backups-in-backup-set/2.sql": "SHOW BACKUPS IN BACKUP SET ... ->> ... — ->> chaining operator not modeled",
	"sql/show-backups-in-backup-set/3.sql": "SHOW BACKUPS IN BACKUP SET ... ->> ... — ->> chaining operator not modeled",
	"sql/show-snapshots-in-snapshot-set/2.sql": "SHOW SNAPSHOTS IN SNAPSHOT SET ... ->> ... — ->> chaining operator not modeled",
	"sql/show-snapshots-in-snapshot-set/3.sql": "SHOW SNAPSHOTS IN SNAPSHOT SET ... ->> ... — ->> chaining operator not modeled",
};
