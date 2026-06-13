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
};

// (2) Valid, documented Databricks SQL the forked Spark grammar doesn't accept yet — tracked in
// https://github.com/NiclasOlofsson/sqllens/issues/4. Excluded with the same self-policing
// assertion: when the grammar grows to accept one, the gate flags it so the entry (and the issue
// item) is closed out.
export const DEFERRED_GRAMMAR: Record<string, string> = {
	// WITH (CREDENTIAL <name>) path table-reference option
	"sql-ref-storage-credentials/2.sql": "issue #4: FROM `delta`.`path` WITH (CREDENTIAL c)",
	"sql-ref-storage-credentials/3.sql": "issue #4: FROM `delta`.`path` WITH (CREDENTIAL c)",
	"sql-ref-names/20.sql": "issue #4: FROM `csv`.`path` WITH (CREDENTIAL c)",
	"sql-ref-syntax-qry-select-table-reference/5.sql": "issue #4: WITH(CREDENTIAL c) table option",
	// SQL pipe operators |>
	"sql-ref-syntax-qry-select-pipeop/6.sql": "issue #4: `|>` pipe operators (AS, SELECT)",
	"sql-ref-syntax-qry-select-pipeop/21.sql": "issue #4: `|>` pipe operators (UNPIVOT)",
	// ?:: try-cast operator
	"functions/questiondoublecolonsign/3.sql": "issue #4: `?::` try-cast operator",
	"functions/try_variant_get/4.sql": "issue #4: `?::` try-cast operator",
	// expr : <TYPE> type ascription
	"functions/from_avro/1.sql": "issue #4: `NULL:MAP<…>` type ascription",
	"functions/from_avro/2.sql": "issue #4: `NULL:MAP<…>` type ascription",
	"functions/from_avro/3.sql": "issue #4: `NULL:MAP<…>` type ascription",
	// named-argument invocation name => value
	"functions/http_request/2.sql": "issue #4: named-argument invocation `name => value`",
	"sql-ref-syntax-ddl-create-sql-function/16.sql": "issue #4: named-argument invocation `name => value`",
	// COLLATION FOR(expr)
	"data-types/string-type/14.sql": "issue #4: `COLLATION FOR(expr)` (SQL-standard collation accessor)",
};
