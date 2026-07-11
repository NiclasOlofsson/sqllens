// ---------------------------------------------------------------------------
// tokenize() — the always-available, lexer-only token stream.
//
// The editor front end needs every token (with span + role) even on broken,
// mid-edit input, before any parse. This builds the dialect's lexer, lexes the
// whole input (trivia included), and maps to neutral `Token`s. It is total: the
// antlr lexer recovers from bad input by emitting error/skip tokens rather than
// throwing, so we attach no throwing error listener and never propagate one.
// ---------------------------------------------------------------------------

import { CharStream, type Lexer } from "antlr4ng";
import type { Dialect } from "../dialect.js";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { SnowflakeLexer } from "../generated/snowflake/SnowflakeLexer.js";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { RedshiftLexer } from "../generated/redshift/RedshiftLexer.js";
import { PostgresLexer } from "../generated/postgres/PostgresLexer.js";
import { DuckdbLexer } from "../generated/duckdb/DuckdbLexer.js";
import { TrinoLexer } from "../generated/trino/TrinoLexer.js";
import { SqliteLexer } from "../generated/sqlite/SqliteLexer.js";
import { MysqlLexer } from "../generated/mysql/MysqlLexer.js";
import { mapTokens } from "./map.js";
import type { Token } from "./token.js";

// bigquery's generated lexer class is GoogleSQLLexer (the fork is Bytebase's
// GoogleSQL grammar).
const LEXERS: Record<Dialect, (cs: CharStream) => Lexer> = {
	databricks: (cs) => new DatabricksLexer(cs),
	tsql: (cs) => new TSqlLexer(cs),
	snowflake: (cs) => new SnowflakeLexer(cs),
	bigquery: (cs) => new GoogleSQLLexer(cs),
	redshift: (cs) => new RedshiftLexer(cs),
	postgres: (cs) => new PostgresLexer(cs),
	duckdb: (cs) => new DuckdbLexer(cs),
	trino: (cs) => new TrinoLexer(cs),
	sqlite: (cs) => new SqliteLexer(cs),
	mysql: (cs) => new MysqlLexer(cs),
};

/**
 * Lex `sql` with the dialect's lexer and return every token (trivia included,
 * EOF excluded) as neutral `Token`s. Total — never throws on bad input.
 */
export function tokenize(sql: string, dialect: Dialect): Token[] {
	const lexer = LEXERS[dialect](CharStream.fromString(sql));
	// getAllTokens lexes to EOF, returning default + hidden-channel tokens and
	// excluding the EOF sentinel. antlr lexers recover (error/skip tokens) rather
	// than throw, and we add no throwing listener, so this is total.
	const tokens = lexer.getAllTokens();
	return mapTokens(lexer, tokens, dialect);
}
