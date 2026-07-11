// Genuinely-invalid entries in the MySQL grammars-v4 example corpus — upstream examples that are
// not valid MySQL and that the parser therefore correctly rejects. These examples are the grammar's
// OWN positive corpus (they ship to exercise `sql/mysql/Positive-Technologies/MySqlParser.g4`), so
// this is expected to stay EMPTY: a fork that regresses on one of these broke something the upstream
// grammar handled.
//
// An entry is warranted only when an upstream example is genuinely not valid MySQL (RTFM'd against
// https://dev.mysql.com/doc/refman/8.4/en/sql-statements.html). Never add an entry to route around a
// real grammar gap — fix the `.g4` instead. Each key is a path relative to `mysql/grammars-v4`
// (forward slashes); each value cites the specific defect.

export const KNOWN_BAD: Record<string, string> = {};

// Genuinely-not-MySQL examples printed in the official MySQL 8.4 Reference Manual (the scraped
// mysql/docs tier, tools/scrape-mysql-docs.mjs). The manual shows each of these deliberately — as a
// parse-error illustration, an "Incorrect:"/"illegal:" contrast, or a metasyntactic template — so the
// parser correctly rejects them. Each is excluded from the docs gate's zero-error assertion and
// asserted to STILL fail (self-policing: if a re-scrape or grammar change makes one parse, the entry
// is stale and gets removed). Keys are paths relative to `mysql/docs` (forward slashes; the scraper
// buckets output as parser/positive/<kind>/<page-slug>/<n>.sql, and a snippet the parser rejects
// lands under unparsed/ — where these, by construction, all live); each value cites the defect,
// RTFM'd against the named manual page.
export const KNOWN_BAD_DOCS: Record<string, string> = {
	// select.html prints this under "Use of an unqualified * with other items in the select list may
	// produce a parse error. For example:" — a deliberate parse-error illustration (the fix the manual
	// gives is the qualified `tbl_name.*`). https://dev.mysql.com/doc/refman/8.4/en/select.html
	"parser/positive/unparsed/select/3.sql":
		"`SELECT id, * FROM t1` — the manual's own parse-error example for unqualified * mixed with items",
	// delete.html prints these two under "Incorrect:" — alias DECLARATIONS belong only in the
	// table_references part of a multiple-table DELETE; declaring them in the target list is the
	// error being illustrated. https://dev.mysql.com/doc/refman/8.4/en/delete.html
	"parser/positive/unparsed/delete/8.sql":
		"multi-table DELETE with alias declarations in the target list — the manual's 'Incorrect:' pair",
	// cast-functions.html prints these three under "But these are illegal:" — COLLATE must apply to
	// the CONVERT/CAST result, not ride inside the conversion.
	// https://dev.mysql.com/doc/refman/8.4/en/cast-functions.html
	"parser/positive/unparsed/cast-functions/21.sql":
		"CONVERT/CAST with an inner COLLATE — the manual's 'But these are illegal:' triplet",
	// miscellaneous-functions.html writes the VALUES() illustration against a table literally named
	// `table` — TABLE is a reserved word (dev.mysql.com/doc/refman/8.4/en/keywords.html), so the
	// printed statement is not runnable without backticks; a metasyntactic name, not real SQL.
	"parser/positive/unparsed/miscellaneous-functions/52.sql":
		"`INSERT INTO table (a,b,c) ...` — TABLE is reserved; the manual's placeholder table name",
	// json-search-functions.html prints the general extraction pattern with `type` as a metavariable
	// (`CAST(JSON_UNQUOTE(JSON_EXTRACT(json_doc, path)) AS type)`) — a template, not a runnable cast.
	// https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html
	"parser/positive/unparsed/json-search-functions/65.sql":
		"CAST(... AS type) — `type` is the manual's metavariable for a real cast target",
};
