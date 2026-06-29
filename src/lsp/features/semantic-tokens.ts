import { SemanticTokensBuilder } from "vscode-languageserver";
import type { SemanticTokens, SemanticTokensLegend } from "vscode-languageserver-types";
import type { SqlDocument, TokenRole } from "../../index.js";

// ---------------------------------------------------------------------------
// Semantic tokens: semantic highlighting from the token artifact. Pure
// translation of the cached document's always-available token stream — every
// token carries its exact span, so this works on broken / mid-edit input. We
// map our coarse TokenRole to a small fixed list of standard LSP token types;
// punctuation/whitespace/other carry no type and are not emitted (whitespace is
// the only trivia we drop — comments keep their role and ARE highlighted).
// ---------------------------------------------------------------------------

// The standard LSP token types our roles map to. tokenModifiers stays empty.
const TOKEN_TYPES = ["keyword", "string", "number", "comment", "operator", "variable"] as const;

export const SEMANTIC_LEGEND: SemanticTokensLegend = {
	tokenTypes: [...TOKEN_TYPES],
	tokenModifiers: [],
};

// role → index into SEMANTIC_LEGEND.tokenTypes. Roles with no entry (punctuation,
// whitespace, other) are skipped, not emitted.
const ROLE_TO_TYPE = new Map<TokenRole, number>([
	["keyword", TOKEN_TYPES.indexOf("keyword")],
	["string", TOKEN_TYPES.indexOf("string")],
	["number", TOKEN_TYPES.indexOf("number")],
	["comment", TOKEN_TYPES.indexOf("comment")],
	["operator", TOKEN_TYPES.indexOf("operator")],
	["identifier", TOKEN_TYPES.indexOf("variable")],
]);

export function computeSemanticTokens(doc: SqlDocument): SemanticTokens {
	const builder = new SemanticTokensBuilder();
	for (const token of doc.tokens) {
		const typeIndex = ROLE_TO_TYPE.get(token.role);
		if (typeIndex === undefined) continue; // punctuation/whitespace/other — not highlighted

		// antlr token.line is 1-based, token.column 0-based; LSP wants 0-based line.
		const startLine = token.line - 1;
		const text = token.text;
		if (!text.includes("\n")) {
			builder.push(startLine, token.column, text.length, typeIndex, 0);
			continue;
		}
		// Multi-line token (e.g. a block comment spanning lines): the builder expects
		// single-line tokens, so emit one push per covered line. The first line runs
		// from the token's column; subsequent lines start at column 0.
		const segments = text.split("\n");
		for (let i = 0; i < segments.length; i++) {
			const length = segments[i].length;
			if (length === 0) continue; // empty trailing segment after a final newline
			const line = startLine + i;
			const column = i === 0 ? token.column : 0;
			builder.push(line, column, length, typeIndex, 0);
		}
	}
	return builder.build();
}
