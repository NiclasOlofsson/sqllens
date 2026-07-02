// Failing query-bucket examples from the scraped Databricks SQL language manual
// (harness/local/databricks-docs, via tools/scrape-databricks-docs.mjs). Two kinds, both excluded
// from the 100% query gate and asserted to STILL fail (self-policing: if a re-scrape or a grammar
// change makes one parse, the gate flags it as stale so the entry is removed). Triaged file-by-file
// against docs.databricks.com on 2026-06-13.

// (1) Genuinely-not-parseable: invalid SQL in the docs themselves (typos, fragments, illustrative
// error examples), metasyntax templates, or extraction the scraper can't cleanly separate.
export const KNOWN_BAD: Record<string, string> = {
	// Illustrative / deliberately-wrong examples (the page is demonstrating the error).
	"sql-ref-reserved-words/5.sql": "AS ANTI — demonstrates ANTI is reserved and cannot be an alias",
	"sql-ref-syntax-comment/6.sql": "a `--` comment containing an EOL — the page's bad-comment example",
	"sql-ref-lambda-functions/1.sql": "a bare `(p1, p2) -> …` lambda fragment, not a standalone statement",
	"functions/ai_query/4.sql": "`* EXCEPT text` — star EXCEPT needs a parenthesized column list (Spark grammar)",

	// Malformed in the source (unbalanced parens, stray tokens, smart quotes, undocumented syntax).
	"data-types/struct-type/4.sql": "unbalanced parens — cast(struct('hello')) … ).name)",
	"data-types/timestamp-ntz-type/8.sql": "stray trailing ')' after ::TIMESTAMP WITHOUT TIME ZONE",
	"functions/stack/2.sql": "stray `'world'` after `AS (third)` — malformed",
	"functions/ai_query/6.sql": "curly smart-quotes ‘ ’ around the responseFormat JSON, not ASCII '",
	"functions/ai_extract/7.sql": "uses a `//` line comment — not valid Databricks SQL (only -- and /* */)",

	// Incomplete / template blocks (truncated in the docs, or syntax notation rather than an example).
	"how-to-use/1.sql": "just `SELECT` — an incomplete snippet",
	"functions/vector_search/1.sql": "syntax template with { a | b } / [ optional ] metasyntax, not a query",
	"sql-ref-syntax-comment/8.sql":
		"a multi-line /* … */ block comment — the scraper's output-stripping doesn't track block comments across lines (niche comment-syntax page)",

	// Documentation errors uncovered closing out issue #4 — the docs example itself is invalid SQL that
	// real Databricks would reject, so it is not a grammar gap (verified against the live docs 2026-07-02).
	"sql-ref-syntax-qry-select-pipeop/6.sql":
		"docs bug: `|> SELECT col1 + col2 FROM new_tab` — the pipe `|> SELECT` operator takes no FROM clause (the columns come from the piped input); the example's FROM is a documentation error",
	"functions/http_request/2.sql":
		"docs bug: the named-arg example is missing the comma between the `json =>` and `headers =>` arguments (and has a trailing comma inside map(…)) — unbalanced/invalid as written",
	"sql-ref-syntax-ddl-create-sql-function/16.sql":
		"docs bug: `roll_dice(10 => num_sides, num_dice => 3)` writes the first named-arg pair reversed — the name is the identifier LHS (`num_sides => 10`), so `10 =>` is not a valid named argument",
};

// (2) Valid, documented Databricks SQL the forked Spark grammar didn't accept yet — tracked in
// https://github.com/NiclasOlofsson/sqllens/issues/4. CLOSED OUT 2026-07-02: the six constructs
// (WITH (CREDENTIAL); piping an inline aliased VALUES relation; `?::` try-cast; `:` complex-type
// ascription; `name =>` named args; `COLLATION FOR`) now parse, so those files graduated to query/
// via the organizer. Three files that were on this list turned out to be documentation errors, not
// grammar gaps — they moved to KNOWN_BAD above (pipe SELECT with a FROM, a missing comma in the
// http_request example, a reversed named-arg pair). The list is intentionally empty; the docs gate
// still merges it, and the self-policing residency assertion keeps it that way.
export const DEFERRED_GRAMMAR: Record<string, string> = {};
