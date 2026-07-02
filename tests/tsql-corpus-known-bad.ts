// Scraped MS-docs T-SQL examples that are not valid SQL — typos, fragments, and templates in
// the vendor's own documentation, each VERIFIED against the verbatim source markdown in
// vendor/sql-docs (and the reference pages) on 2026-06-13. The corpus is the docs verbatim
// (tools/extract-tsql-docs.mjs), so a broken example becomes a broken `.sql` file that the
// parser correctly rejects. These are excluded from the in-scope query gate and asserted to
// STILL fail: if Microsoft fixes a doc and a re-scrape makes one parse, the gate flags the
// entry as stale so it gets removed (self-policing). Same mechanism as the Snowflake corpus
// (tests/snowflake-corpus-known-bad.ts).
//
// Each key is a path relative to harness/local/tsql-docs (forward slashes).

export const KNOWN_BAD: Record<string, string> = {
	// U+202F NARROW NO-BREAK SPACE inside the example (byte-verified in the source markdown:
	// `) <U+202F> AS <U+202F> GreatestVal`) — not a T-SQL whitespace character.
	"functions_logical-functions-greatest-transact-sql/1.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-greatest-transact-sql/2.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-least-transact-sql/1.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-least-transact-sql/2.sql": "U+202F narrow no-break space between tokens",

	// Missing closing quote: '$.Order.TotalDue RETURNING decimal(20, 4)) — the path string is
	// never terminated (statements/create-json-index-transact-sql.md line 291, verbatim).
	"statements_create-json-index-transact-sql/6.sql": "unterminated string literal — missing ' after $.Order.TotalDue",

	// SELECT 'Adventure' += 'Works' — a string literal is not an assignment target; the page's
	// own prose says the operator needs a variable (@x += 'Works').
	"language-elements_string-concatenation-equal-transact-sql/1.sql":
		"+= with a literal as the assignment target — needs a variable",

	// Placeholder templates that slipped the extractor's <placeholder> filter (non-word
	// placeholder shapes), verbatim in the docs: not statements.
	"functions_openrowset-bulk-transact-sql/19.sql": "OPENROWSET(<...>) — placeholder outside a string",
	"statements_alter-database-transact-sql-set-options/19.sql": "= <'Your_Database_Name'> — placeholder template",
	"statements_alter-database-transact-sql-set-options/20.sql": "= <'Your_Query_Request_ID'> — placeholder template",

	// Bare WITH (DATA_COMPRESSION/XML_COMPRESSION ... ON PARTITIONS ...) blocks — CREATE TABLE
	// option-clause FRAGMENTS shown alone ("specify the option more than once, for example:").
	"statements_create-table-transact-sql/1.sql": "CREATE TABLE WITH-options fragment, not a statement",
	"statements_create-table-transact-sql/2.sql": "CREATE TABLE WITH-options fragment, not a statement",

	// Reserved keywords used as unbracketed identifiers — the reserved-keywords reference says
	// these need delimited identifiers; the real server rejects them as written.
	"statements_create-external-table-transact-sql/6.sql":
		"FROM user … — USER is reserved (also references a nonexistent cs alias)",
	"statements_create-external-table-transact-sql/7.sql": "FROM External.Orders — EXTERNAL is reserved",

	// The page itself documents this exact derived-table form as FAILING (Msg 156): nested CTEs
	// are supported inside a CTE definition but not in a general subquery.
	"queries_nested-common-table-expression/3.sql": "documented-to-fail example (Msg 156) — WITH in a derived table",
};
