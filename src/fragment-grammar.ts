// ---------------------------------------------------------------------------
// Fragment grammar: the per-dialect entry set for parsing an SQL FRAGMENT — a
// templated macro body that is not a statement (an expression, a FROM-slot
// source, a CTE list pasted after WITH, a select list). Each dialect's parse.ts
// binds its lexer, parser and the five EOF-anchored `*_fragment` rules through
// `defineFragmentGrammar`; src/fragment.ts holds the registry and the driver.
//
// The parse runs over an already-lexed token slice (antlr4ng's ListTokenSource),
// never over a re-lexed substring, so every token, span and diagnostic stays in
// the coordinates of the text the tokens were lexed from.
// ---------------------------------------------------------------------------

import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	ListTokenSource,
	type Parser,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
	Token as AntlrToken,
} from "antlr4ng";
import { makeErrorCollector, type SyntaxDiagnostic } from "./parse-diagnostics.js";

/** What a fragment parses as. `statement` is the dialect's ordinary full-file entry. */
export type FragmentKind = "statement" | "expression" | "tableSource" | "cteList" | "selectList";

/** Every kind, in the order a macro body is tried: the most common reading first. */
export const FRAGMENT_KINDS: readonly FragmentKind[] = [
	"statement",
	"expression",
	"tableSource",
	"cteList",
	"selectList",
];

export interface FragmentLex {
	/** Text-native tokens, trivia included, EOF excluded. */
	tokens: AntlrToken[];
	/** Token-derived diagnostics the dialect's statement entry would also report (bigquery's
	 *  literal-escape validation); positioned in the text's coordinates. */
	diagnostics: SyntaxDiagnostic[];
}

export interface FragmentParse {
	tree: ParserRuleContext;
	/** Empty when the slice parsed clean as this kind (the rule is EOF-anchored). */
	diagnostics: SyntaxDiagnostic[];
}

export interface FragmentGrammar {
	/** Lex a whole text exactly as the dialect's statement entry does (same token rewrites). */
	lex(text: string): FragmentLex;
	/**
	 * Parse an already-lexed slice as `kind`. `bail` = SLL + bail strategy: returns undefined on
	 * the first syntax error (fast clean/not-clean probe); otherwise full LL with recovery and
	 * positioned diagnostics.
	 */
	parse(slice: readonly AntlrToken[], kind: FragmentKind, bail: boolean): FragmentParse | undefined;
}

/** A fragment entry: drives one or more of the grammar's OWN rules over the parser. The grammar
 *  is untouched (no `x EOF` wrapper rules: an extra caller widens a rule's SLL follow set and
 *  flips prediction on unrelated input); the EOF anchor is checked by the driver instead. */
export type FragmentEntry<P extends Parser> = (parser: P) => ParserRuleContext;

export interface FragmentGrammarSpec<P extends Parser> {
	/** Lex a whole text; defaults to the plain lexer with no diagnostics. */
	lex?: (text: string) => FragmentLex;
	newLexer: (input: CharStream) => Lexer;
	newParser: (tokens: CommonTokenStream) => P;
	/** One entry per kind, or several tried in order (tsql's `expression` is its scalar `expression`
	 *  then `search_condition`: the grammar keeps comparisons out of the scalar rule). */
	entries: { readonly [K in FragmentKind]: FragmentEntry<P> | readonly FragmentEntry<P>[] };
	/** The list separator token type (COMMA). A list body (`cteList`/`selectList`) may end with
	 *  one: a macro's CTE list often ends `),` because the caller appends more CTEs. */
	separator: number;
	/** Tree-walking checks the dialect's statement entry runs after the parse (bigquery). */
	postParse?: (tree: ParserRuleContext) => SyntaxDiagnostic[];
}

const LIST_KINDS: ReadonlySet<FragmentKind> = new Set(["cteList", "selectList"]);

/** `item (sep item)*` driven from outside the grammar, for dialects without a list rule
 *  (a CTE list without its WITH, a select list). The tree is the FIRST item's. */
export function separatedList<P extends Parser>(item: FragmentEntry<P>, separator: number): FragmentEntry<P> {
	return (parser) => {
		const first = item(parser);
		// A separator followed by EOF is a trailing one (`run` consumes it), not another item.
		while (parser.inputStream.LA(1) === separator && parser.inputStream.LA(2) !== AntlrToken.EOF) {
			parser.inputStream.consume(); // between rules there is no context to attach the separator to
			item(parser);
		}
		return first;
	};
}

/** The EOF anchor: the entry returned but input remains — the same diagnostic shape ANTLR
 *  emits for an EOF-anchored rule, positioned at the leftover token. */
function trailingInput(parser: Parser): SyntaxDiagnostic | undefined {
	const tok = parser.inputStream.LT(1);
	if (!tok || tok.type === AntlrToken.EOF) return undefined;
	const text = tok.text ?? "";
	return {
		message: `extraneous input '${text}' expecting <EOF>`,
		line: tok.line,
		column: tok.column,
		offset: tok.start,
		length: text.length || 1,
	};
}

/** Bind a dialect's lexer, parser and fragment entry rules into a `FragmentGrammar`. */
export function defineFragmentGrammar<P extends Parser>(spec: FragmentGrammarSpec<P>): FragmentGrammar {
	const { newLexer, newParser, entries, separator, postParse } = spec;
	const alternatives = (kind: FragmentKind): readonly FragmentEntry<P>[] => {
		const e = entries[kind];
		return Array.isArray(e) ? (e as readonly FragmentEntry<P>[]) : [e as FragmentEntry<P>];
	};
	/** The entry, then a trailing separator on a list body is consumed rather than left over. */
	const run = (parser: P, entry: FragmentEntry<P>, kind: FragmentKind): ParserRuleContext => {
		const tree = entry(parser);
		const input = parser.inputStream;
		if (LIST_KINDS.has(kind) && input.LA(1) === separator && input.LA(2) === AntlrToken.EOF) input.consume();
		return tree;
	};
	const lex =
		spec.lex ??
		((text: string): FragmentLex => {
			const lexer = newLexer(CharStream.fromString(text));
			lexer.removeErrorListeners();
			return { tokens: lexer.getAllTokens(), diagnostics: [] };
		});
	return {
		lex,
		parse(slice, kind, bail) {
			// Each alternative gets a fresh parser over the same slice; bail mode returns the first
			// clean one, LL mode the alternative that got furthest before its first error.
			let best: FragmentParse | undefined;
			let bestAt = -1;
			for (const entry of alternatives(kind)) {
				const tokens = new CommonTokenStream(new ListTokenSource([...slice]));
				const parser = newParser(tokens);
				const collector = makeErrorCollector();
				parser.removeErrorListeners();
				parser.addErrorListener(collector.listener);
				const sim = parser.interpreter as ParserATNSimulator;
				if (bail) {
					parser.errorHandler = new BailErrorStrategy();
					sim.predictionMode = PredictionMode.SLL;
					let tree: ParserRuleContext;
					try {
						tree = run(parser, entry, kind);
					} catch {
						continue;
					}
					// A grammar action can report through the listener without throwing (bigquery's
					// join-balance check); that is not a clean parse either. Nor is leftover input.
					if (collector.diagnostics.length > 0 || trailingInput(parser)) continue;
					const post = postParse?.(tree) ?? [];
					if (post.length === 0) return { tree, diagnostics: [] };
					continue;
				}
				sim.predictionMode = PredictionMode.LL;
				const tree = run(parser, entry, kind);
				const trailing = trailingInput(parser);
				const diagnostics = [
					...collector.diagnostics,
					...(trailing ? [trailing] : []),
					...(postParse?.(tree) ?? []),
				];
				if (diagnostics.length === 0) return { tree, diagnostics };
				const at = diagnostics[0].offset ?? Number.MAX_SAFE_INTEGER;
				if (at > bestAt) {
					bestAt = at;
					best = { tree, diagnostics };
				}
			}
			return best;
		},
	};
}
