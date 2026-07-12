import {
	type ATN,
	CharStream,
	CommonTokenStream,
	DefaultErrorStrategy,
	type Lexer,
	type Parser,
	type ParserRuleContext,
	type Vocabulary,
} from "antlr4ng";
import type { Dialect } from "../dialect.js";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";
import { SnowflakeLexer } from "../generated/snowflake/SnowflakeLexer.js";
import { SnowflakeParser } from "../generated/snowflake/SnowflakeParser.js";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";
import { RedshiftLexer } from "../generated/redshift/RedshiftLexer.js";
import { RedshiftParser } from "../generated/redshift/RedshiftParser.js";
import { PostgresLexer } from "../generated/postgres/PostgresLexer.js";
import { PostgresParser } from "../generated/postgres/PostgresParser.js";
import { DuckdbLexer } from "../generated/duckdb/DuckdbLexer.js";
import { DuckdbParser } from "../generated/duckdb/DuckdbParser.js";
import { TrinoLexer } from "../generated/trino/TrinoLexer.js";
import { TrinoParser } from "../generated/trino/TrinoParser.js";
import { SqliteLexer } from "../generated/sqlite/SqliteLexer.js";
import { SqliteParser } from "../generated/sqlite/SqliteParser.js";
import { MysqlLexer } from "../generated/mysql/MysqlLexer.js";
import { MysqlParser } from "../generated/mysql/MysqlParser.js";

/**
 * A ready-to-walk parser for the completion engine: the lexer, the token stream, the entry
 * rule's index (for `atn.ruleToStartState[...]`), and a `runEntry()` that drives the parse far
 * enough to fill the token stream and leave the parser ATN-ready.
 *
 * Unlike `src/<dialect>/parse.ts` (two-stage SLL→LL that bails/recovers and produces a CST for
 * the *valid-parse* pipeline), this is the always-available, error-tolerant front end the
 * interactive editor features need: it keeps the default recovering error strategy so a broken /
 * mid-edit statement still yields a usable tree and a complete token stream.
 */
export interface MadeParser {
	parser: Parser;
	lexer: Lexer;
	tokenStream: CommonTokenStream;
	/** The RULE_ index of the entry rule (index into `parser.atn.ruleToStartState`). */
	entryRuleIndex: number;
	/** Invoke the entry rule. Recovers on error (never throws on broken input). */
	runEntry: () => ParserRuleContext;
}

type Factory = (sql: string) => MadeParser;

function databricksFactory(sql: string): MadeParser {
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new DatabricksParser(tokenStream);
	// Error-tolerant: the recovering strategy (the parser's default) keeps the walk usable on
	// broken input. Silence the console error listeners — the completion path reports nothing.
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: DatabricksParser.RULE_multiStatement,
		runEntry: () => parser.multiStatement(),
	};
}

function tsqlFactory(sql: string): MadeParser {
	const lexer = new TSqlLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new TSqlParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: TSqlParser.RULE_tsql_file,
		runEntry: () => parser.tsql_file(),
	};
}

function snowflakeFactory(sql: string): MadeParser {
	const lexer = new SnowflakeLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new SnowflakeParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: SnowflakeParser.RULE_snowflake_file,
		runEntry: () => parser.snowflake_file(),
	};
}

// BigQuery's parse.ts wraps the lexer in a `dotPathTokenSource` (rewrites reserved keywords after a
// dot into DOT_IDENTIFIER) before the parser. That rewrite only matters for resolving dotted paths;
// the completion ATN walk just needs an enumerated token stream and an ATN-ready parser, so a plain
// lexer→CommonTokenStream→parser is sufficient. The dot-path rewrite is intentionally skipped here.
function bigqueryFactory(sql: string): MadeParser {
	const lexer = new GoogleSQLLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new GoogleSQLParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: GoogleSQLParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

function redshiftFactory(sql: string): MadeParser {
	const lexer = new RedshiftLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new RedshiftParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: RedshiftParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

function postgresFactory(sql: string): MadeParser {
	const lexer = new PostgresLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new PostgresParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: PostgresParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

function duckdbFactory(sql: string): MadeParser {
	const lexer = new DuckdbLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new DuckdbParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: DuckdbParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

function trinoFactory(sql: string): MadeParser {
	const lexer = new TrinoLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new TrinoParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: TrinoParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

function sqliteFactory(sql: string): MadeParser {
	const lexer = new SqliteLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new SqliteParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: SqliteParser.RULE_parse,
		runEntry: () => parser.parse(),
	};
}

function mysqlFactory(sql: string): MadeParser {
	const lexer = new MysqlLexer(CharStream.fromString(sql));
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new MysqlParser(tokenStream);
	parser.errorHandler = new DefaultErrorStrategy();
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return {
		parser,
		lexer,
		tokenStream,
		entryRuleIndex: MysqlParser.RULE_root,
		runEntry: () => parser.root(),
	};
}

const FACTORIES: Record<Dialect, Factory> = {
	databricks: databricksFactory,
	tsql: tsqlFactory,
	snowflake: snowflakeFactory,
	bigquery: bigqueryFactory,
	redshift: redshiftFactory,
	postgres: postgresFactory,
	duckdb: duckdbFactory,
	trino: trinoFactory,
	sqlite: sqliteFactory,
	mysql: mysqlFactory,
};

/** Build a fresh error-tolerant parser for `dialect`, lexing `sql`. */
export function makeParser(sql: string, dialect: Dialect): MadeParser {
	return FACTORIES[dialect](sql);
}

/** The input-INDEPENDENT parser facts the ATN candidate walk needs: the dialect's parser ATN, the
 *  lexer vocabulary (for keyword literal labels), and the batch entry rule's index. All three are
 *  per-dialect statics (the ATN and vocabulary are shared across every parser/lexer instance), so
 *  they are grabbed once from a throwaway empty-input factory and reused; no source is re-lexed. */
export interface CompletionMeta {
	atn: ATN;
	vocabulary: Vocabulary;
	entryRuleIndex: number;
}

const META_CACHE = new Map<Dialect, CompletionMeta>();

/** The cached {@link CompletionMeta} for `dialect`, built once. Completion drives the walk over the
 *  document's own token stream plus this meta, instead of re-parsing the source text. */
export function completionMeta(dialect: Dialect): CompletionMeta {
	let meta = META_CACHE.get(dialect);
	if (!meta) {
		const m = makeParser("", dialect);
		meta = { atn: m.parser.atn, vocabulary: m.lexer.vocabulary, entryRuleIndex: m.entryRuleIndex };
		META_CACHE.set(dialect, meta);
	}
	return meta;
}
