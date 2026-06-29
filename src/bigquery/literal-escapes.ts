import type { Token } from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";

// Escape validation for string/bytes literals and backquoted identifiers, ported faithfully from
// ZetaSQL's CUnescapeInternal / ParseStringLiteral / ParseBytesLiteral / ParseIdentifier
// (googlesql/public/strings.cc). GoogleSQL's lexer — like ours — accepts ANY `\x` escape (the
// any_escape regex), and defers escape/codepoint validation to the parser, which turns a bad escape
// into a "Syntax error" at the offending offset (googlesql.tm string_literal_component /
// bytes_literal_component actions). We replicate that as a post-lex pass that returns a positioned
// diagnostic per invalid literal; each is folded into the parser's diagnostics (so consumers get a
// squiggle on the offending literal, not just a rejection).

const T_STRING = GoogleSQLLexer.STRING_LITERAL;
const T_BYTES = GoogleSQLLexer.BYTES_LITERAL;
const T_IDENTIFIER = GoogleSQLLexer.IDENTIFIER;

const isOctal = (c: string): boolean => c >= "0" && c <= "7";
const isHex = (c: string): boolean => /[0-9a-fA-F]/.test(c);

/**
 * Validate the escapes in a literal's *content* (the text between the quotes, prefix already removed),
 * per ZetaSQL CUnescapeInternal. Returns true if every escape is legal. Raw literals pass all escapes
 * through and are only invalid when they end with an odd number of backslashes (the trailing `\`
 * escapes the closing quote). Non-raw literals validate the simple set, octal `\ooo` (exactly 3 octal
 * digits, leading digit 0–3 so ≤ \377), hex `\xhh` (2 hex digits), and — strings/identifiers only —
 * `\uhhhh` / `\Uhhhhhhhh` (4 / 8 hex digits, ≤ 0x10FFFF, no surrogates). An escaped newline and any
 * other escape character are illegal.
 */
export function literalEscapesValid(content: string, isRaw: boolean, isBytes: boolean): boolean {
	const n = content.length;
	if (isRaw) {
		let backslashes = 0;
		for (let k = n - 1; k >= 0 && content[k] === "\\"; k--) backslashes++;
		return backslashes % 2 === 0;
	}
	for (let i = 0; i < n; i++) {
		if (content[i] !== "\\") continue;
		if (i + 1 >= n) return false; // literal cannot end with a backslash
		const c = content[i + 1];
		const j = i + 1; // index of the escape character
		if ("abfnrtv\\?'\"`".includes(c)) {
			i = j;
		} else if (c >= "0" && c <= "3") {
			// Octal: exactly 3 octal digits at j, j+1, j+2 (leading 0–3 keeps it ≤ \377).
			if (j + 2 >= n || !isOctal(content[j]) || !isOctal(content[j + 1]) || !isOctal(content[j + 2])) {
				return false;
			}
			i = j + 2;
		} else if (c === "x" || c === "X") {
			// Hex: exactly 2 hex digits at j+1, j+2.
			if (j + 2 >= n || !isHex(content[j + 1]) || !isHex(content[j + 2])) return false;
			i = j + 2;
		} else if (c === "u") {
			if (isBytes || j + 4 >= n) return false;
			let cp = 0;
			for (let k = 1; k <= 4; k++) {
				const h = content[j + k];
				if (!isHex(h)) return false;
				cp = cp * 16 + Number.parseInt(h, 16);
			}
			if (cp >= 0xd800 && cp <= 0xdfff) return false; // surrogate
			i = j + 4;
		} else if (c === "U") {
			if (isBytes || j + 8 >= n) return false;
			let cp = 0;
			for (let k = 1; k <= 8; k++) {
				const h = content[j + k];
				if (!isHex(h)) return false;
				cp = cp * 16 + Number.parseInt(h, 16);
				if (cp > 0x10ffff) return false;
			}
			if (cp >= 0xd800 && cp <= 0xdfff) return false; // surrogate
			i = j + 8;
		} else {
			// Escaped newline (\r, \n) and every other character are illegal escapes.
			return false;
		}
	}
	return true;
}

/** Split a literal token's text into (content, isRaw, isBytes); null if it isn't a quoted literal. */
function literalParts(text: string): { content: string; isRaw: boolean; isBytes: boolean } | null {
	const prefix = /^[rbRB]{0,2}/.exec(text)?.[0] ?? "";
	let isRaw = false;
	let isBytes = false;
	for (const ch of prefix) {
		if (ch === "r" || ch === "R") isRaw = true;
		else if (ch === "b" || ch === "B") isBytes = true;
	}
	const body = text.slice(prefix.length);
	let quote: string;
	if (body.startsWith('"""') || body.startsWith("'''")) quote = body.slice(0, 3);
	else if (body.startsWith('"') || body.startsWith("'")) quote = body.slice(0, 1);
	else return null;
	if (body.length < quote.length * 2) return null;
	return { content: body.slice(quote.length, body.length - quote.length), isRaw, isBytes };
}

/** A positioned escape diagnostic on the offending literal/identifier token. */
function escapeDiagAt(tok: Token): SyntaxDiagnostic {
	return {
		message: "invalid escape sequence in literal",
		line: tok.line,
		column: tok.column,
		offset: tok.start,
		length: tok.text?.length ?? 1,
	};
}

/**
 * Positioned variant of the literal-escape validation: string/bytes literals and backquoted
 * identifiers in `tokens` whose escape sequences are invalid — each is a parse-time syntax error in
 * GoogleSQL. Each `badLiteralEscapes` detection pushes a diagnostic squiggling the whole offending
 * token.
 */
export function badLiteralEscapes(tokens: Token[]): SyntaxDiagnostic[] {
	const out: SyntaxDiagnostic[] = [];
	for (const tok of tokens) {
		const type = tok.type;
		const text = tok.text ?? "";
		if (type === T_STRING || type === T_BYTES) {
			const parts = literalParts(text);
			if (parts && !literalEscapesValid(parts.content, parts.isRaw, parts.isBytes)) out.push(escapeDiagAt(tok));
			// String literals (not bytes) must be well-formed UTF-8 (ZetaSQL SpanWellFormedUTF8). The
			// testdata's invalid-UTF-8 bytes were normalized to U+FFFD on extraction; its presence in a
			// non-bytes string marks the original as structurally invalid. Bytes literals hold arbitrary
			// octets and are exempt.
			else if (parts && !parts.isBytes && parts.content.includes("�")) out.push(escapeDiagAt(tok));
		} else if (type === T_IDENTIFIER && text.startsWith("`") && text.endsWith("`") && text.length >= 2) {
			// Backquoted identifier — must be non-empty, same escape rules as a non-raw, non-bytes string.
			const inner = text.slice(1, -1);
			if (inner === "" || inner.includes("�") || !literalEscapesValid(inner, false, false))
				out.push(escapeDiagAt(tok));
		}
	}
	return out;
}
