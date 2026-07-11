// Genuinely-invalid entries in the SQLite grammars-v4 example corpus — upstream examples that are
// not valid SQLite and that the parser therefore correctly rejects. The grammars-v4 examples are the
// grammar's OWN positive corpus (they ship to exercise `sql/sqlite/SQLiteParser.g4`), so this is
// expected to stay EMPTY: a fork that regresses on one of these broke something upstream handled.
//
// An entry is warranted only when an upstream example is genuinely not valid SQLite (RTFM'd against
// https://sqlite.org/lang.html). Never add an entry to route around a real grammar gap — fix the
// `.g4` instead. Each key is a path relative to `sqlite/grammars-v4` (forward slashes); each value
// cites the specific defect.

export const KNOWN_BAD: Record<string, string> = {};

// Genuinely-not-SQLite examples printed in the official SQLite language docs (the scraped
// sqlite/docs tier, tools/scrape-sqlite-docs.mjs). The docs show these deliberately — as a
// foreign-dialect contrast, not as SQLite — so the parser correctly rejects them. Each is excluded
// from the docs gate's zero-error assertion and asserted to STILL fail (self-policing: if a re-scrape
// makes one parse, the entry is stale and gets removed). Keys are paths relative to `sqlite/docs`
// (forward slashes; the scraper buckets output as parser/positive/<kind>/<page-slug>/<n>.sql, and a
// snippet the parser rejects lands under unparsed/ — where these, by construction, all live); each
// value cites the defect, RTFM'd against https://sqlite.org/lang.html.
export const KNOWN_BAD_DOCS: Record<string, string> = {
	// lang_update.html prints this under "The MySQL UPDATE statement ... The equivalent MySQL
	// statement would be like this:" — MySQL's UPDATE-JOIN form (a JOIN between UPDATE and SET),
	// which SQLite does not accept (SQLite uses UPDATE ... SET ... FROM ...). Foreign-dialect
	// counter-example, not valid SQLite. https://sqlite.org/lang_update.html#update_from
	"parser/positive/unparsed/lang_update/3.sql":
		"MySQL UPDATE-JOIN counter-example (JOIN before SET) shown for contrast — not valid SQLite",
};
