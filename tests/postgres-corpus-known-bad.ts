// Scraped PostgreSQL 18 docs examples that stay unparsed for two DIFFERENT reasons. Both are
// excluded from the in-scope query gate and asserted to STILL fail: if PostgreSQL fixes a doc, or
// the scope of this project widens, a re-run moves the file into query/ and the gate flags the
// entry as stale so it gets removed (self-policing). Same mechanism as the Snowflake corpus
// (tests/snowflake-corpus-known-bad.ts).
//
// (1) Docs bugs: the vendor's own page has a defect (a typo, a metavariable stood in for real
// syntax, or a deliberate "this is invalid" illustration) — not a grammar gap, verified against
// the live postgresql.org/docs/18 page.
//
// (2) Out-of-scope wrappers: a CREATE FUNCTION ... AS $$ ... $$ dollar-quoted UDF body wrapping a
// query. Object DDL (CREATE/ALTER/DROP-style object management, including UDF bodies) is out of
// scope per this repo's CLAUDE.md → Scope; the embedded SELECT is not rejected on its own, only
// the enclosing DDL is unparsed.
//
// Each key is a path relative to the docs page root (forward slashes).

export const KNOWN_BAD: Record<string, string> = {
	// --- Docs bugs -----------------------------------------------------------------------------
	"citext/1.sql": "\"(?\" is a JDBC/ODBC-style illustrative parameter placeholder in citext.html, not real syntax",
	"rules-update/28.sql":
		"missing comma between \"shoelace_data new\" and \"shoelace_log shoelace_log\" in the FROM list (typo live in current docs)",
	"sql-createaggregate/2.sql": "\"sortop\" is the page's metavariable for a sort operator name, not literal syntax",
	"sql-syntax-lexical/8.sql":
		"the page's own deliberate negative example: \"SELECT 'foo' 'bar';\" on one line is stated \"is not valid syntax\"",

	// --- Out-of-scope wrappers (object DDL / UDF bodies) ----------------------------------------
	"queries-table-expressions/4.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"sql-createfunction/7.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"sql-select/9.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"sql-syntax-calling-funcs/1.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/3.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/5.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/7.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/8.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/9.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/12.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/13.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/20.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
	"xfunc-sql/23.sql": "CREATE FUNCTION ... AS $$...$$ dollar-quoted UDF-body wrapper, object DDL",
};
