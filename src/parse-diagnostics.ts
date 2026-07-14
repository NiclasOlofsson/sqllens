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
				message: msg,
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
