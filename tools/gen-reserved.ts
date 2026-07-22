// Reserved/soft keyword-split probe tool — the anvil channel ask ("expose the reserved/soft
// split... your grammars already encode it"). The operative truth is OUR grammar's behavior: a
// keyword is SOFT for a dialect iff the grammar admits it as an ordinary identifier; there is no
// separate SQL-standard notion consulted here on purpose (a keyword can be standard-reserved and
// still parse as an identifier in a lax fork, or vice versa — the fork's own parser is ground truth
// for this project, same charter as dialectVocabulary above it).
//
// For every keyword text in dialectSymbols(dialect).keywords (the same canonical-uppercase
// bare-word literal set dialectVocabulary is built from — see dialect-symbols.ts's keywordsFor),
// three identifier POSITIONS are probed through the real parse(sql, dialect) from src/api.ts:
//   alias  - `SELECT 1 AS <kw>`     projection alias (AS-explicit, not the FROM-source bare-alias
//                                    slot some grammars deliberately exclude a word from, e.g.
//                                    Snowflake's PIVOT/UNPIVOT — see SnowflakeParser.g4 non_reserved_words)
//   column - `SELECT <kw> FROM t`   bare column reference
//   table  - `SELECT a FROM <kw>`   bare table name
// Zero syntax errors (and no lower() "unsupported" recovery flag — see admits() below) means the
// grammar ADMITTED the keyword there.
//
// `reserved` is true iff NEITHER `column` NOR `table` admits it — `alias` is recorded but does NOT
// by itself make a keyword soft. Verified reason: the AS-labeled alias slot is a genuinely,
// deliberately maximally-permissive production in several of these grammars (Postgres/Redshift/
// DuckDB/Databricks all cleanly parse `SELECT 1 AS <any keyword at all>`, confirmed via direct AST
// inspection, not a probe artifact — PostgreSQL's own keyword-appendix documentation states its
// ColLabel production accepts every keyword regardless of reserved status, precisely because
// nothing can follow AS but a label). Folding that slot into `reserved` would make almost every
// classic reserved word (SELECT, FROM, WHERE) score "soft" in those dialects purely on the
// alias quirk, which is not what a "can I use this bare, unquoted, as a column/table name" lint
// check wants. The per-position record still survives in full (not collapsed to one bit) — a
// consumer that DOES want the alias fact (or wants column-only vs. table-only granularity, e.g.
// Postgres's own FROM-position quirks) reads it directly off the record; only the single derived
// `reserved` bit narrows to column/table.
//
// HONESTY NOTE: an admitted position may read the keyword under a completely different production
// than its keyword sense (Databricks' `SELECT from FROM t` reads the first `from` as a plain column
// name) — that IS identifier treatment and correctly scores soft. The probe only asks "did this
// parse clean", never "did it parse the way I expected"; matching the never-guess charter, a false
// POSITIVE here would require the grammar to be lenient by construction, which is exactly the fact
// being surfaced.
//
// Committed like the signature harvest (tools/harvest-signatures.mjs) — a probe run costs three
// parses per keyword per dialect, cheap enough to run inline but not worth paying at library
// import time, so the result is frozen into src/<dialect>/reserved.generated.ts and read back by
// dialect-symbols.ts's vocabularyFor(). Rebuild after any .g4 change that touches a dialect's
// non-reserved-word list or adds/removes a keyword:
//   node --import tsx tools/gen-reserved.ts && npm run format
//
// Deliberately depends ONLY on dialectSymbols (not dialectVocabulary/RESERVED) so there is no
// bootstrap cycle: dialect-symbols.ts's KeywordEntry merge reads these generated files, so this
// tool cannot itself depend on that merge existing yet.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "../src/api.js";
import { dialectSymbols } from "../src/dialect-symbols.js";
import type { Dialect } from "../src/api.js";

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TOOLS_DIR, "..");
const outFile = (dialect: Dialect) => resolve(ROOT_DIR, "src", dialect, "reserved.generated.ts");

const DIALECTS: Dialect[] = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
];

const CONST_NAME: Record<Dialect, string> = {
	databricks: "DATABRICKS_RESERVED",
	tsql: "TSQL_RESERVED",
	snowflake: "SNOWFLAKE_RESERVED",
	bigquery: "BIGQUERY_RESERVED",
	redshift: "REDSHIFT_RESERVED",
	postgres: "POSTGRES_RESERVED",
	duckdb: "DUCKDB_RESERVED",
	trino: "TRINO_RESERVED",
	sqlite: "SQLITE_RESERVED",
	mysql: "MYSQL_RESERVED",
};

/** True iff `sql` parses as ONE clean statement under `dialect`: zero syntax errors AND the
 *  lowered body carries no `unsupported` flag. The second check matters as much as the first —
 *  several of these dialects' `root`/`stmtblock` entry rules accept a `;`-optional sequence of
 *  statements with generous recovery (the project's own "Recovery-split exemption" shortcut:
 *  tsql/redshift/postgres/duckdb can read a malformed single statement as two). A keyword that is
 *  itself statement-shaped (SELECT, WITH, INSERT, SET, SHOW, ...) landing in a probe template can
 *  trigger exactly that split — e.g. postgres reads `SELECT SELECT FROM t` as a phantom two-statement
 *  batch (`lower()`'s `nonQuery(..., "multi-statement")` stub, zero errors reported) rather than one
 *  statement with a column named SELECT. errors===0 alone would misread that recovery artifact as
 *  "SELECT admitted as a column identifier" — a false positive verified via the AST, not assumed.
 *  parse() never throws on a valid call (see src/api.ts), but the tool guards defensively anyway
 *  since a probe run is generation-time only and must never abort the whole batch over one
 *  pathological keyword. */
function admits(sql: string, dialect: Dialect): boolean {
	try {
		const r = parse(sql, dialect);
		if (r.errors !== 0) return false;
		const body = r.ast.body as { unsupported?: unknown[] };
		return !(body.unsupported && body.unsupported.length > 0);
	} catch {
		return false;
	}
}

function probe(kw: string, dialect: Dialect) {
	const alias = admits(`SELECT 1 AS ${kw}`, dialect);
	const column = admits(`SELECT ${kw} FROM t`, dialect);
	const table = admits(`SELECT a FROM ${kw}`, dialect);
	// reserved = admitted in NEITHER column NOR table position; alias is excluded from this bit
	// (see module header) but still carried on the record.
	return { reserved: !(column || table), alias, column, table };
}

const TODAY = new Date().toISOString().slice(0, 10);

for (const dialect of DIALECTS) {
	const keywords = [...dialectSymbols(dialect).keywords].sort();
	const rows: string[] = [];
	let reservedCount = 0;
	for (const kw of keywords) {
		const r = probe(kw, dialect);
		if (r.reserved) reservedCount++;
		rows.push(
			`\t${JSON.stringify(kw)}: { reserved: ${r.reserved}, alias: ${r.alias}, column: ${r.column}, table: ${r.table} },`,
		);
	}

	const body = `// GENERATED - do not edit by hand. Rebuild: node --import tsx tools/gen-reserved.ts && npm run format
// Reserved/soft keyword split for ${dialect}, probe-derived from THIS dialect's own generated parser
// (tools/gen-reserved.ts — probe method + honesty notes in its header). Regenerate whenever a .g4
// change touches this dialect's non-reserved-word list or its keyword vocabulary changes; a keyword
// missing here after a regen is caught at runtime by dialect-symbols.ts's totality check against the
// live lexer vocabulary, not silently guessed.
// Built ${TODAY}. ${keywords.length} keywords, ${reservedCount} reserved, ${keywords.length - reservedCount} soft.
import type { KeywordReservation } from "../dialect-symbols.js";

export const ${CONST_NAME[dialect]}: Record<string, KeywordReservation> = {
${rows.join("\n")}
};
`;
	writeFileSync(outFile(dialect), body);
	console.log(
		`${dialect}: ${keywords.length} keywords, ${reservedCount} reserved, ${keywords.length - reservedCount} soft -> ${outFile(dialect)}`,
	);
}
