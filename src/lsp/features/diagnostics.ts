import { type Diagnostic as LspDiagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { parse, analyze, type Dialect } from "../../api.js";
import type { Schema } from "../../qualify/schema.js";
import { rangeFromSpan, rangeFromSyntaxDiagnostic } from "../ranges.js";

// ---------------------------------------------------------------------------
// Diagnostics: syntax errors (from parse().diagnostics — issue #6) plus, when a
// schema is configured, semantic errors (from analyze().diagnostics — unknown
// table/column/field, ambiguous column). Pure translation: the positions come
// from the library; this only maps them to LSP ranges and severities.
// ---------------------------------------------------------------------------

export function computeDiagnostics(text: string, dialect: Dialect, schema?: Schema): LspDiagnostic[] {
	const out: LspDiagnostic[] = [];

	for (const d of parse(text, dialect).diagnostics) {
		out.push({
			range: rangeFromSyntaxDiagnostic(d),
			severity: DiagnosticSeverity.Error,
			source: "sqllens",
			message: d.message,
		});
	}

	if (schema) {
		for (const d of analyze(text, dialect, { schema }).diagnostics) {
			out.push({
				range: rangeFromSpan(d), // full span from qualify (Task A8) — squiggles the whole identifier
				severity: d.kind === "ambiguous-column" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
				source: "sqllens",
				message: d.message,
			});
		}
	}

	return out;
}
