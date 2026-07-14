// src/parse-diagnostics.ts
import type { ANTLRErrorListener, Token } from "antlr4ng";

// ---------------------------------------------------------------------------
// Shared syntax-diagnostic capture for the per-dialect parse wrappers. The antlr
// error listener already receives message/line/column/offending-token — this
// collects them into a positioned SyntaxDiagnostic instead of discarding all but
// a count (issue #6). One collector is attached to both the lexer and parser; its
// diagnostics survive the two-stage SLL→LL parse via reset() (the SLL attempt's
// diagnostics are cleared before the LL retry, mirroring the old `errors = 0`).
//
// Positions are antlr-native and match the rest of the library: line is 1-based,
// column is 0-based; offset/length are 0-based inclusive char indices from the
// offending token. An editor presentation layer converts these to 0-based LSP positions.
// ---------------------------------------------------------------------------

export interface SyntaxDiagnostic {
	/** The parser's human-readable message (e.g. "mismatched input 'WHERE'"). */
	message: string;
	/** 1-based line of the offending token. */
	line: number;
	/** 0-based column of the offending token. */
	column: number;
	/** 0-based char offset of the offending token start; absent for lexer errors. */
	offset?: number;
	/** Offending token text length; 1 when unknown (lexer error / no token). */
	length: number;
}

export interface ErrorCollector {
	/** Attach to both the lexer and the parser via addErrorListener. */
	listener: ANTLRErrorListener;
	/** Captured diagnostics, in report order. */
	readonly diagnostics: SyntaxDiagnostic[];
	/** Clear captured diagnostics — called before the LL retry to discount the SLL attempt. */
	reset(): void;
}

/** Max expected-token candidates rendered in a diagnostic message (issue #31): a parser
 *  mid-statement can expect hundreds of tokens, and the full enumeration is unusable in an
 *  editor tooltip. The candidates are ANTLR's set order (token-type order), not relevance. */
const MAX_EXPECTED_TOKENS = 5;

/** Rewrite a trailing `expecting {a, b, …}` set to the first MAX_EXPECTED_TOKENS candidates
 *  plus a remainder count. Braceless single-token forms and small sets pass through. */
function capExpectedSet(msg: string): string {
	const open = msg.lastIndexOf(" expecting {");
	if (open === -1 || !msg.endsWith("}")) return msg;
	const set = msg.slice(open + " expecting {".length, -1);
	// Split on ", " outside quotes; literal display names like ',' contain the separator.
	const parts: string[] = [];
	let start = 0;
	let inQuote = false;
	for (let i = 0; i < set.length; i++) {
		const ch = set[i];
		if (ch === "'") inQuote = !inQuote;
		else if (!inQuote && ch === "," && set[i + 1] === " ") {
			parts.push(set.slice(start, i));
			start = i + 2;
			i++;
		}
	}
	parts.push(set.slice(start));
	if (parts.length <= MAX_EXPECTED_TOKENS) return msg;
	const kept = parts.slice(0, MAX_EXPECTED_TOKENS).join(", ");
	const rest = parts.length - MAX_EXPECTED_TOKENS;
	return `${msg.slice(0, open)} expecting {${kept}, … ${rest} more}`;
}

export function makeErrorCollector(): ErrorCollector {
	const diagnostics: SyntaxDiagnostic[] = [];
	const listener = {
		syntaxError(
			_recognizer: unknown,
			offendingSymbol: Token | null,
			line: number,
			charPositionInLine: number,
			msg: string,
		): void {
			diagnostics.push({
				message: capExpectedSet(msg),
				line,
				column: charPositionInLine,
				offset: offendingSymbol?.start,
				length: offendingSymbol?.text?.length ?? 1,
			});
		},
		reportAmbiguity(): void {},
		reportAttemptingFullContext(): void {},
		reportContextSensitivity(): void {},
	};
	return {
		listener,
		diagnostics,
		reset(): void {
			diagnostics.length = 0;
		},
	};
}
