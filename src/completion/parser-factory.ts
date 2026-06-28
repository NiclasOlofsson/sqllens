import {
	CharStream,
	CommonTokenStream,
	DefaultErrorStrategy,
	type Lexer,
	type Parser,
	type ParserRuleContext,
} from "antlr4ng";
import type { Dialect } from "../api.js";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";

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
		entryRuleIndex: DatabricksParser.RULE_compoundOrSingleStatement,
		runEntry: () => parser.compoundOrSingleStatement(),
	};
}

function notConfigured(dialect: Dialect): Factory {
	return () => {
		throw new Error(`completion: ${dialect} not configured yet`);
	};
}

const FACTORIES: Record<Dialect, Factory> = {
	databricks: databricksFactory,
	// Task 12 wires these; the type stays complete.
	tsql: notConfigured("tsql"),
	snowflake: notConfigured("snowflake"),
	bigquery: notConfigured("bigquery"),
	redshift: notConfigured("redshift"),
};

/** Build a fresh error-tolerant parser for `dialect`, lexing `sql`. */
export function makeParser(sql: string, dialect: Dialect): MadeParser {
	return FACTORIES[dialect](sql);
}
