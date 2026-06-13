// Scraped Snowflake docs examples that are not valid SQL — typos and truncations in the
// vendor's own documentation. The corpus is the docs verbatim (tools/scrape-snowflake-docs.mjs),
// so a broken example becomes a broken `.sql` file that the parser correctly rejects. These are
// excluded from the in-scope query gate and asserted to STILL fail: if Snowflake fixes a doc and
// a re-scrape makes one parse, the gate flags it as stale so the entry gets removed (self-policing).
//
// Each key is a path relative to harness/local/snowflake-docs (forward slashes). Each value cites
// the specific defect, RTFM'd against the official reference.

export const KNOWN_BAD: Record<string, string> = {
	// Unbalanced parentheses / malformed literals — structurally not parseable.
	"functions/ai_translate/3.sql": "extra '(' before the text argument leaves AI_TRANSLATE's outer paren unclosed",
	"functions/get_job_history/1.sql": "GET_JOB_HISTORY(() — unbalanced parentheses",
	"functions/st_azimuth/3.sql": "inner TO_GEOMETRY(...) is never closed",
	"functions/st_azimuth/4.sql": "TO_GEOMETRY(0.707 0.707') — malformed coordinate/quote",
	"sql/create-semantic-view/5.sql": "missing closing ')' on SEMANTIC VIEW(...) — example truncated",

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
};
