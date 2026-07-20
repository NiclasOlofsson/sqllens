// Scraped MS-docs T-SQL examples that a clean grammar correctly does NOT accept — either the
// vendor's own example text is broken (a docs bug), the construct is real but deliberately out of
// this project's scope, or T-SQL's own semantics make it unparseable in an ANTLR lexer. The corpus
// is the docs verbatim (tools/extract-tsql-docs.mjs), so a broken/out-of-scope example becomes a
// broken/rejected `.sql` file that the parser correctly leaves under `unparsed/`. These are excluded
// from the in-scope query gate and asserted to STILL fail there: if Microsoft fixes a doc, or the
// grammar grows to cover a deferred construct, a re-scrape/regen makes the entry stale (it parses and
// leaves unparsed/), the gate flags it, and it gets removed here (self-policing). Same mechanism as
// the Snowflake corpus (tests/snowflake-corpus-known-bad.ts).
//
// Each key is a path relative to harness/local/tsql-docs (forward slashes).

export const KNOWN_BAD: Record<string, string> = {
	// ---------------------------------------------------------------------------------------------
	// DOCS BUG — the vendor's own example text is broken (typo, stray character, truncated
	// fragment). Verified against the verbatim source markdown (vendor/sql-docs) or the live
	// learn.microsoft.com page. Not a grammar gap; a correct parser must reject these as written.
	// ---------------------------------------------------------------------------------------------

	// U+202F NARROW NO-BREAK SPACE inside the example (byte-verified in the source markdown:
	// `) <U+202F> AS <U+202F> GreatestVal`) — not a T-SQL whitespace character.
	"functions_logical-functions-greatest-transact-sql/1.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-greatest-transact-sql/2.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-least-transact-sql/1.sql": "U+202F narrow no-break space between tokens",
	"functions_logical-functions-least-transact-sql/2.sql": "U+202F narrow no-break space between tokens",

	// U+2002 EN SPACE used as indentation inside the `[Previous value for column_b]` / `[Next value
	// for column_b]` bracketed aliases (byte-verified) — same class as the U+202F entries above.
	// learn.microsoft.com/en-us/sql/t-sql/functions/lag-transact-sql (+ lead-transact-sql)
	"functions_lag-transact-sql/4.sql": "U+2002 en space inside a bracketed alias",
	"functions_lag-transact-sql/5.sql": "U+2002 en space inside a bracketed alias",
	"functions_lead-transact-sql/4.sql": "U+2002 en space inside a bracketed alias",
	"functions_lead-transact-sql/5.sql": "U+2002 en space inside a bracketed alias",

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

	// SET @cookie = <value from the SELECT @cookie statement>; — a prose placeholder left inline
	// (the page tells the reader to substitute a real value here), not a statement.
	// learn.microsoft.com/en-us/sql/t-sql/statements/execute-as-transact-sql (+ revert-transact-sql)
	"statements_execute-as-transact-sql/2.sql": "<value from the SELECT @cookie statement> — placeholder outside a string",
	"statements_revert-transact-sql/3.sql": "<value from the SELECT @cookie statement> — placeholder outside a string",

	// Bare WITH (DATA_COMPRESSION/XML_COMPRESSION ... ON PARTITIONS ...) blocks — CREATE TABLE
	// option-clause FRAGMENTS shown alone ("specify the option more than once, for example:").
	"statements_create-table-transact-sql/1.sql": "CREATE TABLE WITH-options fragment, not a statement",
	"statements_create-table-transact-sql/2.sql": "CREATE TABLE WITH-options fragment, not a statement",

	// Reserved keywords used as unbracketed identifiers — the reserved-keywords reference says
	// these need delimited identifiers; the real server rejects them as written.
	"statements_create-external-table-transact-sql/6.sql":
		"FROM user … — USER is reserved (also references a nonexistent cs alias)",
	"statements_create-external-table-transact-sql/7.sql": "FROM External.Orders — EXTERNAL is reserved",

	// IF OBJECT_ID (...) isn't NULL — "isn't" in place of "IS NOT" (verbatim typo in the example).
	// learn.microsoft.com/en-us/sql/t-sql/queries/update-transact-sql
	"queries_update-transact-sql/1.sql": "\"isn't\" typo for \"IS NOT\"",
	"queries_update-transact-sql/2.sql": "\"isn't\" typo for \"IS NOT\"",

	// CREATE FUNCTION dbo.Values(...) — the page's own "Invalid syntax" example: VALUES is a
	// reserved keyword used unbracketed as a function name (the page runs it under SET NOEXEC ON
	// specifically to demonstrate the parse failure). learn.microsoft.com/en-us/sql/t-sql/statements/set-noexec-transact-sql
	"statements_set-noexec-transact-sql/1.sql": "documented-to-fail example — VALUES (reserved) used as an unbracketed function name",

	// The page's own "Name scope of CTE" example ends right after the CTE list, with no trailing
	// query — a documentation fragment, not a runnable statement (a WITH clause always needs a
	// following SELECT/INSERT/UPDATE/DELETE). Verified: appending a trailing `SELECT * FROM cte1;`
	// parses cleanly. learn.microsoft.com/en-us/sql/t-sql/queries/nested-common-table-expression
	"queries_nested-common-table-expression/1.sql": "fragment — CTE list with no trailing query statement",

	// ---------------------------------------------------------------------------------------------
	// DOCUMENTED-TO-FAIL — the vendor page states outright that this exact form is invalid T-SQL
	// (quotes the real server's error message). Not a docs bug; the language itself rejects it.
	// ---------------------------------------------------------------------------------------------

	// The page itself documents this exact derived-table form as FAILING (Msg 156): nested CTEs
	// are supported inside a CTE definition but not in a general subquery.
	// learn.microsoft.com/en-us/sql/t-sql/queries/nested-common-table-expression
	"queries_nested-common-table-expression/3.sql": "documented-to-fail example (Msg 156) — WITH in a derived table",

	// ---------------------------------------------------------------------------------------------
	// CONTEXT-SENSITIVE — real, valid T-SQL whose lexing depends on a runtime session option, not
	// on the token stream alone. Architecturally out of reach for an ANTLR lexer without a mode
	// hack tied to statement execution order; not attempted (see CLAUDE.md § Known shortcuts).
	// ---------------------------------------------------------------------------------------------

	// SET QUOTED_IDENTIFIER OFF flips double-quoted text from a delimited identifier to a string
	// literal for the rest of the session — a lexer decision that depends on a prior statement's
	// runtime effect, not on the grammar. learn.microsoft.com/en-us/sql/t-sql/statements/set-quoted-identifier-transact-sql
	"statements_set-quoted-identifier-transact-sql/3.sql":
		"double-quoted string literals under SET QUOTED_IDENTIFIER OFF — context-sensitive lexing, not reachable from the token stream alone",

	// ---------------------------------------------------------------------------------------------
	// DEFERRED TO THE DML WAVE — real, documented T-SQL that is DML/maintenance-depth (object DDL,
	// legacy LOB text/image access, DBCC console commands) and deliberately out of scope for now
	// (the tracked Open Gap). Self-policing: the DML wave's fixes will flip these back to parsing,
	// flagging the entry stale so it gets removed.
	// ---------------------------------------------------------------------------------------------

	// A second OUTPUT clause on one DELETE — only one OUTPUT clause is modelled.
	// learn.microsoft.com/en-us/sql/t-sql/queries/output-clause-transact-sql
	"queries_output-clause-transact-sql/13.sql": "double OUTPUT clause on one DELETE statement",
	// MERGE used as a derived-table source inside an INSERT ... SELECT FROM (MERGE ...) — MERGE is
	// modelled as a statement, not as a FROM-clause source expression.
	"queries_output-clause-transact-sql/14.sql": "MERGE used as a FROM-clause derived-table source",

	// READTEXT/WRITETEXT/UPDATETEXT and the TEXTPTR() function operate on the legacy TEXT/NTEXT/
	// IMAGE data types and are unmodelled (deprecated LOB access, DML-depth).
	// learn.microsoft.com/en-us/sql/t-sql/queries/readtext-transact-sql (+ writetext-transact-sql,
	// updatetext-transact-sql, functions/text-and-image-functions-textptr-transact-sql)
	"queries_readtext-transact-sql/1.sql": "READTEXT — legacy TEXT/IMAGE access, unmodelled",
	"queries_writetext-transact-sql/1.sql": "WRITETEXT — legacy TEXT/IMAGE access, unmodelled",
	"queries_updatetext-transact-sql/1.sql": "UPDATETEXT — legacy TEXT/IMAGE access, unmodelled",
	"functions_text-and-image-functions-textptr-transact-sql/2.sql": "TEXTPTR() with UPDATETEXT — legacy TEXT/IMAGE access, unmodelled",
	"functions_text-and-image-functions-textptr-transact-sql/5.sql": "TEXTPTR() with WRITETEXT — legacy TEXT/IMAGE access, unmodelled",

	// DBCC console commands entirely unmodelled (maintenance-depth): CHECKIDENT, FREEPROCCACHE,
	// FREESESSIONCACHE, HELP, INPUTBUFFER, PDW_SHOWMATERIALIZEDVIEWOVERHEAD.
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-checkident-transact-sql
	"database-console-commands_dbcc-checkident-transact-sql/1.sql": "DBCC CHECKIDENT — unmodelled",
	"database-console-commands_dbcc-checkident-transact-sql/2.sql": "DBCC CHECKIDENT — unmodelled",
	"database-console-commands_dbcc-checkident-transact-sql/3.sql": "DBCC CHECKIDENT — unmodelled",
	"database-console-commands_dbcc-checkident-transact-sql/4.sql": "DBCC CHECKIDENT — unmodelled",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-freeproccache-transact-sql
	"database-console-commands_dbcc-freeproccache-transact-sql/2.sql": "DBCC FREEPROCCACHE — unmodelled",
	"database-console-commands_dbcc-freeproccache-transact-sql/3.sql": "DBCC FREEPROCCACHE — unmodelled",
	"database-console-commands_dbcc-freeproccache-transact-sql/4.sql": "DBCC FREEPROCCACHE — unmodelled",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-freesessioncache-transact-sql
	"database-console-commands_dbcc-freesessioncache-transact-sql/1.sql": "DBCC FREESESSIONCACHE — unmodelled",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-help-transact-sql
	"database-console-commands_dbcc-help-transact-sql/1.sql": "DBCC HELP — unmodelled",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-inputbuffer-transact-sql
	"database-console-commands_dbcc-inputbuffer-transact-sql/3.sql": "DBCC INPUTBUFFER — unmodelled",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-pdw-showmaterializedviewoverhead-transact-sql
	"database-console-commands_dbcc-pdw-showmaterializedviewoverhead-transact-sql/3.sql":
		"CREATE MATERIALIZED VIEW — object DDL, unmodelled (no DBCC command in this particular example)",
	"database-console-commands_dbcc-pdw-showmaterializedviewoverhead-transact-sql/5.sql":
		"ALTER MATERIALIZED VIEW (unmodelled object DDL) + DBCC PDW_SHOWMATERIALIZEDVIEWOVERHEAD (unmodelled)",
	// learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-shrinkfile-transact-sql
	"database-console-commands_dbcc-shrinkfile-transact-sql/2.sql": "DBCC SHRINKFILE — unmodelled",
	"database-console-commands_dbcc-shrinkfile-transact-sql/3.sql": "DBCC SHRINKFILE — unmodelled",
	"database-console-commands_dbcc-shrinkfile-transact-sql/4.sql": "DBCC SHRINKFILE — unmodelled",
	"database-console-commands_dbcc-shrinkfile-transact-sql/5.sql": "DBCC SHRINKFILE — unmodelled",
	"database-console-commands_dbcc-shrinkfile-transact-sql/6.sql": "DBCC SHRINKFILE — unmodelled",

	// ---------------------------------------------------------------------------------------------
	// OUT-OF-SCOPE WRAPPER — the query embedded in the example parses standalone; what fails is
	// object/platform DDL wrapped around it (OPENROWSET BULK options, EXTERNAL DATA SOURCE/TABLE,
	// scoped-configuration/workload-management DDL, signatures, spatial index filters, …), all
	// cleared Out of scope by this project's DDL boundary (see CLAUDE.md § Scope).
	// ---------------------------------------------------------------------------------------------

	// learn.microsoft.com/en-us/sql/t-sql/functions/openrowset-bulk-transact-sql
	"functions_openrowset-bulk-transact-sql/2.sql": "OPENROWSET BULK option syntax — out-of-scope wrapper",
	"functions_openrowset-bulk-transact-sql/7.sql": "OPENROWSET BULK option syntax — out-of-scope wrapper",
	"functions_openrowset-bulk-transact-sql/15.sql": "OPENROWSET BULK option syntax — out-of-scope wrapper",
	"functions_openrowset-bulk-transact-sql/33.sql": "OPENROWSET BULK option syntax — out-of-scope wrapper",

	// learn.microsoft.com/en-us/sql/t-sql/statements/create-external-data-source-transact-sql
	"statements_create-external-data-source-transact-sql/15.sql": "CREATE EXTERNAL DATA SOURCE — out-of-scope object DDL",
	"statements_create-external-data-source-transact-sql/26.sql": "CREATE EXTERNAL DATA SOURCE — out-of-scope object DDL",
	"statements_create-external-data-source-transact-sql/38.sql": "CREATE EXTERNAL DATA SOURCE — out-of-scope object DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/create-external-table-transact-sql
	"statements_create-external-table-transact-sql/10.sql": "CREATE EXTERNAL TABLE — out-of-scope object DDL",

	// learn.microsoft.com/en-us/sql/t-sql/spatial-geography/filter-geography-data-type (+ geometry sibling)
	"spatial-geography_filter-geography-data-type/1.sql": "CREATE SPATIAL INDEX wrapper — out-of-scope object DDL",
	"spatial-geometry_filter-geometry-data-type/1.sql": "CREATE SPATIAL INDEX wrapper — out-of-scope object DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/alter-database-scoped-configuration-transact-sql
	"statements_alter-database-scoped-configuration-transact-sql/1.sql": "ALTER DATABASE SCOPED CONFIGURATION — out-of-scope platform DDL",
	"statements_alter-database-scoped-configuration-transact-sql/20.sql": "ALTER DATABASE SCOPED CONFIGURATION — out-of-scope platform DDL",
	"statements_alter-database-scoped-configuration-transact-sql/21.sql": "ALTER DATABASE SCOPED CONFIGURATION — out-of-scope platform DDL",

	// ALTER DATABASE ... MODIFY (EDITION = ..., SERVICE_OBJECTIVE = ...) — Azure SQL Database
	// elastic-pool/edition option syntax, out-of-scope platform DDL.
	// learn.microsoft.com/en-us/sql/t-sql/statements/alter-database-transact-sql
	"statements_alter-database-transact-sql/5.sql": "ALTER DATABASE ... MODIFY (EDITION = ...) — out-of-scope platform DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/alter-workload-group-transact-sql
	"statements_alter-workload-group-transact-sql/1.sql": "ALTER WORKLOAD GROUP — out-of-scope platform DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/create-workload-classifier-transact-sql
	"statements_create-workload-classifier-transact-sql/1.sql": "CREATE WORKLOAD CLASSIFIER — out-of-scope platform DDL",
	"statements_create-workload-classifier-transact-sql/2.sql": "CREATE WORKLOAD CLASSIFIER — out-of-scope platform DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/create-json-index-transact-sql
	"statements_create-json-index-transact-sql/9.sql": "CREATE JSON INDEX — out-of-scope object DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/add-signature-transact-sql
	"statements_add-signature-transact-sql/2.sql": "ADD SIGNATURE — out-of-scope object DDL",

	// learn.microsoft.com/en-us/sql/t-sql/statements/create-function-transact-sql
	"statements_create-function-transact-sql/5.sql": "CREATE FUNCTION option syntax — out-of-scope object DDL",

	// dbo.Name is a user-defined CLR type used as a CREATE TABLE column type — out-of-scope object DDL.
	// learn.microsoft.com/en-us/sql/t-sql/queries/table-value-constructor-transact-sql
	"queries_table-value-constructor-transact-sql/6.sql": "CREATE TABLE with a user-defined column type — out-of-scope object DDL",

	// XML DML .modify('replace value of ...') with an embedded XQuery body — out-of-scope XML DML depth.
	// learn.microsoft.com/en-us/sql/xml/replace-value-of-xml-dml
	"xml_replace-value-of-xml-dml/1.sql": "XML DML .modify('replace value of ...') — out-of-scope XML DML depth",
};
