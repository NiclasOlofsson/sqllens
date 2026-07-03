import { type Diagnostic as LspDiagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import type { SchemaSource, SqlDocument } from "../../index.js";
import { rangeFromSpan, rangeFromSyntaxDiagnostic } from "../ranges.js";

// ---------------------------------------------------------------------------
// Diagnostics: syntax errors (from the document's cached parse diagnostics —
// issue #6) plus, when a schema is configured, semantic errors (from
// doc.analyze(schema).diagnostics — unknown table/column/field, ambiguous
// column). Pure translation: the positions come from the cached document model;
// this only maps them to LSP ranges and severities. No re-parse here.
// ---------------------------------------------------------------------------

export function computeDiagnostics(doc: SqlDocument, schema?: SchemaSource): LspDiagnostic[] {
	const out: LspDiagnostic[] = [];

	for (const d of doc.diagnostics) {
		out.push({
			range: rangeFromSyntaxDiagnostic(d),
			severity: DiagnosticSeverity.Error,
			source: "sqllens",
			message: d.message,
		});
	}

	// Semantic diagnostics. Call-signature diagnostics (wrong-arity / wrong-argument-type) need NO
	// catalog — they surface even when no schema is configured, as warnings. The catalog-dependent
	// kinds (unknown table/column/field, ambiguous column) only surface when a schema is configured,
	// or every table would read as unknown against the empty default.
	for (const d of doc.analyze(schema).diagnostics) {
		const isCall = d.kind === "wrong-arity" || d.kind === "wrong-argument-type";
		if (!isCall && !schema) continue;
		out.push({
			range: rangeFromSpan(d), // full span from qualify (Task A8) — squiggles the whole identifier
			severity: isCall || d.kind === "ambiguous-column" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
			source: "sqllens",
			message: d.message,
		});
	}

	return out;
}
