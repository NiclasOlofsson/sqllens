// ---------------------------------------------------------------------------
// dialectSymbols(dialect) — per-dialect membership sets for lint-style checks:
// "is this identifier a known function / reserved keyword / type name?"
//
// Built for the dbt Anvil extension's lint rules (capitalization rules, reserved-word
// warnings, completion) — see .superpowers/sdd/anvil-phase0-brief.md item 3.
//
// Each set is canonical UPPERCASE strings, computed once per dialect and cached in a
// module-level map (`CACHE`) — cheap enough to build on demand, but there is no reason
// to rebuild it every call since none of the source tables change at runtime.
//
// Sources, per set:
//
// - functions: the union of (a) the dialect's type-inference registry keys
//   (src/infer/dialect.ts `inferDialect(dialect).functions`), (b) the curated
//   per-dialect signature table (src/signature/signatures.ts FUNCTION_SIGNATURES),
//   (c) its harvested long-tail counterpart (HARVESTED_SIGNATURES — populated for
//   T-SQL only on this branch, the rest map to `{}` per that file's own header), and
//   (d) for databricks only, the Spark higher-order function names
//   (src/infer/infer.ts HOF_LAMBDA_ARG: transform/zip_with/aggregate/reduce/
//   transform_keys/transform_values). Those six are genuine Spark builtins
//   (spark.apache.org/docs/latest/api/sql/#aggregate) that never get a FnRule registry
//   entry because inferType types them via a special higher-order path instead of the
//   registry (see infer.ts) — without folding them in, "aggregate" would be invisible
//   to this membership check despite being a real Databricks function.
//   LIMIT: this is not the dialect's full builtin surface — only what the inference/
//   signature layers know by name. A name's absence is not proof it isn't a real
//   function; the project's "never guess" contract means an unrecognized function
//   just infers as `unknown`, it doesn't get registered here either.
//
// - keywords: derived from the GENERATED lexer's vocabulary (antlr4ng exposes
//   `Lexer.vocabulary.getLiteralName(type)` per token type). Heuristic: for every
//   token type up to `vocabulary.maxTokenType`, take its literal name (only tokens
//   lexed from an exact string carry one — e.g. a rule `AGGREGATE: 'AGGREGATE';`
//   yields `getLiteralName` = `"'AGGREGATE'"`); strip the surrounding quotes, then
//   keep it only if the whole remainder matches `/^[A-Z_][A-Z_0-9]*$/i` (filters
//   punctuation/operator literals like `'('`, `'<>'`, `'$'`, and quoted-string
//   literal tokens like Snowflake's `''AAD_PROVISIONER''` whose stripped form still
//   has quotes in it). Matches are uppercased.
//   LIMIT: a lexer literal is not the same thing as an "officially reserved word" —
//   most of these grammars lex plenty of non-reserved/contextual keywords as exact
//   string literals too (e.g. `QUALIFY`, `PIVOT`), so this set is "words the grammar
//   treats as fixed-spelling keyword tokens," which is broader than the SQL standard's
//   notion of reserved words but is exactly the membership check a capitalization/
//   reserved-word lint rule wants. Tokens recognized by a lexer RULE rather than an
//   exact string (identifiers, numbers, most operators built from character classes)
//   carry no literal name and are invisible here by construction — that's intentional,
//   they aren't "keywords."
//
// - types: the union of a dialect's scalar-type-alias table's keys (the alias
//   spellings, e.g. T-SQL's `nvarchar`) and values (the canonical target names they
//   normalize to, e.g. `string`) — src/infer/types.ts SCALAR_ALIASES (databricks'
//   default table) / TSQL_ALIASES, and each other dialect's own table in
//   src/infer/<dialect>.ts (`*_ALIASES`). Uppercased.
//   LIMIT: compound-type keywords (ARRAY/MAP/STRUCT) are only in this set if they
//   happen to appear in the alias table (they don't, on any dialect here) — they
//   still surface via `keywords` instead, since ARRAY/STRUCT/MAP are reserved lexer
//   literals in these grammars. A canonical type name that's already correctly
//   spelled (e.g. `int`, `boolean`) is still present via the table's *values*, so
//   this is not merely "aliases," despite the source name — but that only covers
//   names some *other* spelling normalizes to. A genuine gap class remains:
//   canonical, non-reserved type names that never appear as an alias target at
//   all — because
//   the grammar lexes them as plain identifiers, not fixed keyword tokens, and no
//   other spelling maps onto them — are absent from `types` entirely (e.g.
//   postgres JSONB/UUID/INET/CIDR/MACADDR/POINT and the equivalent
//   contextually-lexed type names in other dialects).
// ---------------------------------------------------------------------------

import { CharStream, type Lexer } from "antlr4ng";
import type { Dialect } from "./dialect.js";
import { DatabricksLexer } from "./generated/databricks/DatabricksLexer.js";
import { TSqlLexer } from "./generated/tsql/TSqlLexer.js";
import { SnowflakeLexer } from "./generated/snowflake/SnowflakeLexer.js";
import { GoogleSQLLexer } from "./generated/bigquery/GoogleSQLLexer.js";
import { RedshiftLexer } from "./generated/redshift/RedshiftLexer.js";
import { PostgresLexer } from "./generated/postgres/PostgresLexer.js";
import { DuckdbLexer } from "./generated/duckdb/DuckdbLexer.js";
import { TrinoLexer } from "./generated/trino/TrinoLexer.js";
import { SqliteLexer } from "./generated/sqlite/SqliteLexer.js";
import { MysqlLexer } from "./generated/mysql/MysqlLexer.js";
import { resolveBehavior } from "./dialect-behavior/registry.js";
import { HOF_LAMBDA_ARG } from "./infer/infer.js";
import { SCALAR_ALIASES, TSQL_ALIASES } from "./infer/types.js";
import { SNOWFLAKE_ALIASES } from "./snowflake/infer.js";
import { BQ_ALIASES } from "./infer/bigquery.js";
import { REDSHIFT_ALIASES } from "./infer/redshift.js";
import { POSTGRES_ALIASES } from "./infer/postgres.js";
import { DUCKDB_ALIASES } from "./infer/duckdb.js";
import { TRINO_ALIASES } from "./infer/trino.js";
import { SQLITE_ALIASES } from "./infer/sqlite.js";
import { MYSQL_ALIASES } from "./infer/mysql.js";
import { FUNCTION_SIGNATURES, HARVESTED_SIGNATURES } from "./signature/signatures.js";

/** Per-dialect membership sets — canonical UPPERCASE names. See module header for sources
 *  and heuristic limits per set. */
export interface DialectSymbols {
	functions: ReadonlySet<string>;
	keywords: ReadonlySet<string>;
	types: ReadonlySet<string>;
}

// bigquery's generated lexer class is GoogleSQLLexer (the fork is Bytebase's GoogleSQL grammar).
const LEXERS: Record<Dialect, () => Lexer> = {
	databricks: () => new DatabricksLexer(CharStream.fromString("")),
	tsql: () => new TSqlLexer(CharStream.fromString("")),
	snowflake: () => new SnowflakeLexer(CharStream.fromString("")),
	bigquery: () => new GoogleSQLLexer(CharStream.fromString("")),
	redshift: () => new RedshiftLexer(CharStream.fromString("")),
	postgres: () => new PostgresLexer(CharStream.fromString("")),
	duckdb: () => new DuckdbLexer(CharStream.fromString("")),
	trino: () => new TrinoLexer(CharStream.fromString("")),
	sqlite: () => new SqliteLexer(CharStream.fromString("")),
	mysql: () => new MysqlLexer(CharStream.fromString("")),
};

// The scalar-type-alias table per dialect (see module header, `types` set). Databricks has no
// dedicated table — dialect.ts's `parseType` falls back to types.ts's default (SCALAR_ALIASES).
const TYPE_ALIASES: Record<Dialect, Record<string, string>> = {
	databricks: SCALAR_ALIASES,
	tsql: TSQL_ALIASES,
	snowflake: SNOWFLAKE_ALIASES,
	bigquery: BQ_ALIASES,
	redshift: REDSHIFT_ALIASES,
	postgres: POSTGRES_ALIASES,
	duckdb: DUCKDB_ALIASES,
	trino: TRINO_ALIASES,
	sqlite: SQLITE_ALIASES,
	mysql: MYSQL_ALIASES,
};

/** A bare, keyword-shaped literal token text: letters/digits/underscore, starting with a
 *  letter or underscore. Filters out punctuation (`'('`, `','`) and operator (`'<>'`, `'::'`)
 *  literals, plus quoted-string literal tokens whose stripped form still carries a quote. */
const BARE_WORD = /^[A-Z_][A-Z_0-9]*$/i;

function keywordsFor(dialect: Dialect): Set<string> {
	const lexer = LEXERS[dialect]();
	const vocab = lexer.vocabulary;
	const out = new Set<string>();
	for (let type = 1; type <= vocab.maxTokenType; type++) {
		const literal = vocab.getLiteralName(type);
		if (!literal) continue;
		const text = literal.replace(/^'/, "").replace(/'$/, "");
		if (BARE_WORD.test(text)) out.add(text.toUpperCase());
	}
	return out;
}

function functionsFor(dialect: Dialect): Set<string> {
	const out = new Set<string>();
	for (const name of Object.keys(resolveBehavior(dialect).functions)) out.add(name.toUpperCase());
	for (const name of Object.keys(FUNCTION_SIGNATURES[dialect])) out.add(name.toUpperCase());
	for (const name of Object.keys(HARVESTED_SIGNATURES[dialect])) out.add(name.toUpperCase());
	if (dialect === "databricks") {
		for (const name of Object.keys(HOF_LAMBDA_ARG)) out.add(name.toUpperCase());
	}
	return out;
}

function typesFor(dialect: Dialect): Set<string> {
	const out = new Set<string>();
	for (const [alias, canonical] of Object.entries(TYPE_ALIASES[dialect])) {
		out.add(alias.toUpperCase());
		out.add(canonical.toUpperCase());
	}
	return out;
}

const CACHE = new Map<Dialect, DialectSymbols>();

/**
 * The known function / keyword / type-name membership sets for a dialect — canonical UPPERCASE
 * strings, computed once and cached (repeat calls for the same dialect return the identical Set
 * instances). See the module header for exact sources and the heuristic's known limits.
 */
export function dialectSymbols(dialect: Dialect): DialectSymbols {
	const cached = CACHE.get(dialect);
	if (cached) return cached;
	const symbols: DialectSymbols = {
		functions: functionsFor(dialect),
		keywords: keywordsFor(dialect),
		types: typesFor(dialect),
	};
	CACHE.set(dialect, symbols);
	return symbols;
}
