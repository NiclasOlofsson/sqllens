import { SemanticTokensBuilder } from "vscode-languageserver";
import type { Range, SemanticTokens, SemanticTokensDelta, SemanticTokensLegend } from "vscode-languageserver-types";
import type { SqlDocument, Token, TokenRole } from "../../index.js";

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

// The shared per-token push loop — full and range share it so multi-line splitting
// stays in one place. Tokens must already be in source order (doc.tokens is).
function pushTokens(builder: SemanticTokensBuilder, tokens: readonly Token[]): void {
	for (const token of tokens) {
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
}

// Per-uri retention of the LAST full-build builder, so its `id` is stable for the
// next delta request. A delta only succeeds when previousResultId === that builder's
// id; otherwise we fall back to a fresh full build. Bounded by the number of open docs.
const fullBuilders = new Map<string, SemanticTokensBuilder>();

export function computeSemanticTokens(doc: SqlDocument, uri?: string): SemanticTokens {
	const builder = new SemanticTokensBuilder();
	pushTokens(builder, doc.tokens);
	const result = builder.build();
	if (uri !== undefined) fullBuilders.set(uri, builder);
	return result;
}

export function computeSemanticTokensRange(doc: SqlDocument, range: Range): SemanticTokens {
	// Offset window for the requested range; keep any token that overlaps it (a token
	// straddling the start/end edge is still in view). Range results don't feed delta.
	const startOff = doc.lines.offsetAt(range.start.line, range.start.character);
	const endOff = doc.lines.offsetAt(range.end.line, range.end.character);
	const inRange = doc.tokens.filter((t) => t.start <= endOff && t.stop >= startOff);
	const builder = new SemanticTokensBuilder();
	pushTokens(builder, inRange);
	return builder.build();
}

// Drop the retained builder for `uri` on document close, so this map stays bounded
// by the open-doc set (the server calls this from documents.onDidClose).
export function forgetSemanticTokens(uri: string): void {
	fullBuilders.delete(uri);
}

export function computeSemanticTokensDelta(
	doc: SqlDocument,
	uri: string,
	previousResultId: string,
): SemanticTokens | SemanticTokensDelta {
	const prev = fullBuilders.get(uri);
	// Stale / unknown id (or no retained builder): fall back to a fresh full build.
	if (!prev || prev.id !== previousResultId) return computeSemanticTokens(doc, uri);
	// Reuse the retained builder: previousResult() captures the prior data (since the id
	// matches) and re-initializes it with a NEW id, then we re-push and diff.
	prev.previousResult(previousResultId);
	pushTokens(prev, doc.tokens);
	const result = prev.buildEdits();
	fullBuilders.set(uri, prev); // keep it for the next delta (its id changed after previousResult)
	return result;
}
