import type { DocumentDiagnosticReport } from "vscode-languageserver-protocol";
import type { SchemaProvider, SqlSession } from "../../index.js";
import { computeDiagnostics } from "./diagnostics.js";

// ---------------------------------------------------------------------------
// Pull diagnostics (textDocument/diagnostic): the client requests diagnostics
// on demand. The items are exactly the push path's — computeDiagnostics over the
// cached document — wrapped in a FullDocumentDiagnosticReport. Push and pull
// coexist; this is a thin adapter, no analysis of its own. Never throws.
// ---------------------------------------------------------------------------

export function computeDocumentDiagnostics(session: SqlSession, schema?: SchemaProvider): DocumentDiagnosticReport {
	return { kind: "full", items: computeDiagnostics(session, schema) };
}
