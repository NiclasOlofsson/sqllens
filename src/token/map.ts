// ---------------------------------------------------------------------------
// antlr -> neutral Token converter.
//
// One step of the token-stream front end: turn antlr's internal token objects
// into the dialect-independent `Token` (token.ts), copying spans verbatim and
// attaching a coarse role from the classifier. Trivia (hidden-channel
// whitespace/comments) is kept; only the EOF sentinel is dropped.
// ---------------------------------------------------------------------------

import { Token as AntlrToken, type Lexer } from "antlr4ng";
import type { Dialect } from "../dialect.js";
import { endPosition } from "../ir/span.js";
import { classifyToken } from "./classify.js";
import type { ConsumedAs } from "./consumed-as.js";
import type { Token } from "./token.js";

/**
 * Map a list of antlr tokens to neutral `Token`s for the given dialect.
 * Order is preserved, trivia is kept, and the EOF sentinel is skipped. Spans
 * (start/stop/line/column) are copied verbatim so positions round-trip exactly.
 *
 * `consumedAs` is the tokenIndex -> verdict map `deriveConsumedAs` (consumed-as.ts) built from
 * this same parse's CST. Omitted entirely by `tokenize()` (lexer-only, no parse ran, no CST to
 * derive from): every `Token.consumedAs` field stays absent in that case. When present, only
 * KEYWORD-role tokens ever get the field set; every other role is untouched, matching
 * `Token.consumedAs`'s doc.
 */
export function mapTokens(
	lexer: Lexer,
	antlrTokens: AntlrToken[],
	dialect: Dialect,
	consumedAs?: Map<number, ConsumedAs>,
): Token[] {
	const out: Token[] = [];
	for (const tok of antlrTokens) {
		if (tok.type === AntlrToken.EOF) continue;
		// getDisplayName is typed string|null but returns the numeric value as a
		// string when unnamed; the final String(type) guard satisfies the type.
		const name =
			lexer.vocabulary.getSymbolicName(tok.type) ?? lexer.vocabulary.getDisplayName(tok.type) ?? String(tok.type);
		const text = tok.text ?? "";
		const end = endPosition(tok.line, tok.column, text);
		const role = classifyToken(lexer, tok.type, dialect);
		const neutral: Token = {
			type: tok.type,
			name,
			text,
			start: tok.start,
			stop: tok.stop,
			line: tok.line,
			column: tok.column,
			endLine: end.endLine,
			endColumn: end.endColumn,
			channel: tok.channel,
			role,
		};
		if (consumedAs && role === "keyword") {
			const verdict = consumedAs.get(tok.tokenIndex);
			if (verdict) neutral.consumedAs = verdict;
		}
		out.push(neutral);
	}
	return out;
}
