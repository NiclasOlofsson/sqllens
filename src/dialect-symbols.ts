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
//   (src/infer/dialect.ts `inferDialect(dialect).functions`), (b) the dialect's
//   merged function-signature table (src/signature/signatures.ts SIGNATURES,
//   built by tools/harvest-signatures.mjs from curated overrides folded over the
//   harvested long tail), and (c) for databricks only, the Spark higher-order function names
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
import { BQ_ALIASES } from "./bigquery/infer.js";
import { REDSHIFT_ALIASES } from "./redshift/infer.js";
import { POSTGRES_ALIASES } from "./postgres/infer.js";
import { DUCKDB_ALIASES } from "./duckdb/infer.js";
import { TRINO_ALIASES } from "./trino/infer.js";
import { SQLITE_ALIASES } from "./sqlite/infer.js";
import { MYSQL_ALIASES } from "./mysql/infer.js";
import { SIGNATURES } from "./signature/signatures.js";
import { DATABRICKS_RESERVED } from "./databricks/reserved.generated.js";
import { TSQL_RESERVED } from "./tsql/reserved.generated.js";
import { SNOWFLAKE_RESERVED } from "./snowflake/reserved.generated.js";
import { BIGQUERY_RESERVED } from "./bigquery/reserved.generated.js";
import { REDSHIFT_RESERVED } from "./redshift/reserved.generated.js";
import { POSTGRES_RESERVED } from "./postgres/reserved.generated.js";
import { DUCKDB_RESERVED } from "./duckdb/reserved.generated.js";
import { TRINO_RESERVED } from "./trino/reserved.generated.js";
import { SQLITE_RESERVED } from "./sqlite/reserved.generated.js";
import { MYSQL_RESERVED } from "./mysql/reserved.generated.js";

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
	for (const name of Object.keys(SIGNATURES[dialect])) out.add(name.toUpperCase());
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

// ---------------------------------------------------------------------------
// dialectVocabulary(dialect) — the dialect's full token catalog as data, so a
// consumer's token classifier reads OUR lexer's vocabulary instead of hand-
// maintaining a parallel table (the anvil token-mapper ask, 2026-07-19).
// Dialect-safe by construction: the source is the dialect's GENERATED lexer
// (every `AS: 'AS';` rule), so a keyword added to a .g4 appears here after
// regen with zero sync anywhere. Names are the lexer RULE names — stable as
// long as the grammar's rule names are (renaming a lexer rule is a visible,
// reviewable grammar change).
//
// Split: `keywords` carries bare-word literals (text canonical UPPERCASE);
// `operators` carries the punctuation/operator literals (exact spelling,
// `'::'`, `'<=>'`). Tokens recognized by pattern rather than exact string
// (identifiers, numbers) have no literal spelling and are absent by
// construction — they aren't vocabulary. Compound units (GROUP BY) are parser-
// level sequences, not lexer tokens, and are deliberately NOT invented here.
//
// Each keyword entry also carries its RESERVED/soft split (the anvil channel ask, 2026-07-22:
// "expose the reserved/soft split... your grammars already encode it"). Source: the per-dialect
// src/<dialect>/reserved.generated.ts tables, probe-derived by tools/gen-reserved.ts (three
// identifier-position probes — alias/column/table — through the dialect's own real parser; see
// that tool's header for the full method and the verified honesty notes, including why the AS-
// alias position is excluded from the `reserved` bit but still recorded). `reserved` is the
// operative truth of THIS grammar, not the SQL standard's or the vendor's own reserved-word list —
// a keyword can be standard-reserved and still parse as a plain identifier in a lenient fork (all
// 424 Databricks keywords, including SELECT/FROM, score soft — verified real: the fork's
// `SQL_standard_keyword_behavior` defaults to `false`, Spark SQL's documented Hive-compatible
// default), or vice versa.
// ---------------------------------------------------------------------------

/** Per-position identifier-admission record for one keyword in one dialect, probe-derived (see
 *  tools/gen-reserved.ts). `reserved` is true iff the grammar admits the keyword as neither a bare
 *  column reference nor a bare table name; `alias` (the AS-labeled projection-alias slot) is
 *  recorded but deliberately excluded from `reserved` — verified genuinely maximally permissive by
 *  grammar design in several of these dialects (Postgres's own keyword-appendix docs: any keyword
 *  is a valid column label after AS), so folding it in would score classic reserved words like
 *  FROM as soft purely on that slot's leniency. */
export interface KeywordReservation {
	/** True iff admitted in NEITHER the column NOR the table position. */
	reserved: boolean;
	/** Parses clean as a SELECT-list alias: `SELECT 1 AS <kw>`. */
	alias: boolean;
	/** Parses clean as a bare column reference: `SELECT <kw> FROM t`. */
	column: boolean;
	/** Parses clean as a bare table name: `SELECT a FROM <kw>`. */
	table: boolean;
}

/** One vocabulary keyword's symbolic lexer name plus its reserved/soft split. */
export interface KeywordEntry extends KeywordReservation {
	/** Symbolic lexer rule name (e.g. "SELECT", bigquery's "SELECT_SYMBOL"). */
	symbol: string;
}

/** A dialect's token catalog: literal spelling → the lexer rule's symbolic name (+ reserved split
 *  for keywords). */
export interface DialectVocabulary {
	/** Keyword literal text (canonical UPPERCASE) → symbol name + reserved/soft split. */
	keywords: ReadonlyMap<string, KeywordEntry>;
	/** Operator/punctuation literal text (exact spelling) → symbolic token name (e.g. "::" → its rule name). */
	operators: ReadonlyMap<string, string>;
}

// Per-dialect probe-derived reservation table (src/<dialect>/reserved.generated.ts, built by
// tools/gen-reserved.ts). Keyed the same canonical-uppercase way as `keywords` above.
const RESERVED: Record<Dialect, Record<string, KeywordReservation>> = {
	databricks: DATABRICKS_RESERVED,
	tsql: TSQL_RESERVED,
	snowflake: SNOWFLAKE_RESERVED,
	bigquery: BIGQUERY_RESERVED,
	redshift: REDSHIFT_RESERVED,
	postgres: POSTGRES_RESERVED,
	duckdb: DUCKDB_RESERVED,
	trino: TRINO_RESERVED,
	sqlite: SQLITE_RESERVED,
	mysql: MYSQL_RESERVED,
};

function vocabularyFor(dialect: Dialect): DialectVocabulary {
	const vocab = LEXERS[dialect]().vocabulary;
	const reservation = RESERVED[dialect];
	const keywords = new Map<string, KeywordEntry>();
	const operators = new Map<string, string>();
	for (let type = 1; type <= vocab.maxTokenType; type++) {
		const literal = vocab.getLiteralName(type);
		if (!literal) continue;
		const text = literal.replace(/^'/, "").replace(/'$/, "");
		if (text.includes("'")) continue; // quoted-string literal tokens are not vocabulary
		const name = vocab.getSymbolicName(type) ?? text.toUpperCase();
		if (BARE_WORD.test(text)) {
			const key = text.toUpperCase();
			const r = reservation[key];
			if (!r) {
				throw new Error(
					`reserved.generated.ts is stale for ${dialect}: keyword "${key}" has no reservation entry — ` +
						`run "node --import tsx tools/gen-reserved.ts" to regenerate`,
				);
			}
			keywords.set(key, { symbol: name, ...r });
		} else operators.set(text, name);
	}
	return { keywords, operators };
}

const VOCAB_CACHE = new Map<Dialect, DialectVocabulary>();

/**
 * The dialect's token catalog (keywords + operators, spelling → symbolic name), derived from
 * the generated lexer, computed once and cached. See the module block comment for the
 * derivation, stability guarantees, and what is deliberately absent (pattern tokens,
 * parser-level compounds).
 */
export function dialectVocabulary(dialect: Dialect): DialectVocabulary {
	const cached = VOCAB_CACHE.get(dialect);
	if (cached) return cached;
	const vocabulary = vocabularyFor(dialect);
	VOCAB_CACHE.set(dialect, vocabulary);
	return vocabulary;
}

const RESERVED_CACHE = new Map<Dialect, ReadonlySet<string>>();

/**
 * The dialect's hard-reserved keyword spellings (canonical UPPERCASE) — every keyword whose
 * `KeywordEntry.reserved` is true, i.e. the grammar admits it as neither a bare column reference
 * nor a bare table name (the AS-alias slot is excluded from this determination; see
 * `KeywordReservation`'s doc comment). A convenience over `dialectVocabulary(dialect).keywords`
 * for the common "is this identifier a reserved word?" membership check. Computed once per
 * dialect and cached.
 */
export function reservedKeywords(dialect: Dialect): ReadonlySet<string> {
	const cached = RESERVED_CACHE.get(dialect);
	if (cached) return cached;
	const out = new Set<string>();
	for (const [kw, entry] of dialectVocabulary(dialect).keywords) if (entry.reserved) out.add(kw);
	RESERVED_CACHE.set(dialect, out);
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
