// Scraped DuckDB docs examples that are not runnable SQL, or are printed as deliberately invalid
// (tools/extract-duckdb-docs.mjs). The corpus is the docs verbatim, so a non-SQL or broken example
// becomes a broken `.sql` file that the parser correctly rejects. These are excluded from the
// in-scope query gate and asserted to STILL fail: if a re-scrape ever makes one parse, the gate
// flags it as stale so the entry gets removed (self-policing).
//
// Each key is a path relative to duckdb/docs (forward slashes). Each value cites the specific
// defect, verified against the live docs page.

export const KNOWN_BAD: Record<string, string> = {
	"core_extensions_httpfs_s3api_legacy_authentication/5.sql":
		"S3 legacy-auth page elides the join condition — `INNER JOIN 's3://…' t2;` with no ON/USING; DuckDB rejects a conditionless INNER JOIN.",
	"dev_benchmark/2.sql":
		"a benchmark-framework DSL fragment (a bare `load` section header, `${errors}`/`${sf}` template placeholders), not literal runnable SQL.",
	"guides_python_marimo/2.sql":
		"a Python f-string with `{digits.value}` interpolation embedded in the SQL text, not literal SQL.",
	"sql_functions_overview/6.sql":
		"functions/overview.md shows `FROM ('file').read_parquet()` explicitly annotated `-- does not work` (chaining does not apply to table functions).",
	"data_json_loading_json/9.sql":
		"data/json/loading_json.md's `SELECT\\nFROM read_json('birds.json')` example is missing the `*` (live-page-verified 2026-07-20); the real DuckDB engine also rejects an empty selection list, so the empty-select tightening now correctly surfaces this doc typo.",
};
