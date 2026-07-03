import type { Position, SignatureHelp } from "vscode-languageserver-types";
import { signatureAt, type SchemaSource, type SqlDocument } from "../../index.js";

// ---------------------------------------------------------------------------
// Signature help: the interactive editor feature that shows parameter hints
// while typing inside a call's parentheses. It maps the cached document's caret
// offset to the public `signatureAt()` result and turns it into an LSP
// SignatureHelp (one signature, the active parameter highlighted). Pure
// translation: position in, SignatureHelp out. signatureAt() never throws and
// returns null when the caret isn't inside a call, so neither does this.
// ---------------------------------------------------------------------------

export function computeSignatureHelp(
	doc: SqlDocument,
	position: Position,
	schema?: SchemaSource,
): SignatureHelp | null {
	const off = doc.lines.offsetAt(position.line, position.character);
	const info = signatureAt(doc, off, schema);
	if (!info) return null;
	return {
		signatures: [
			{
				label: info.label,
				parameters: info.parameters.map((p) => ({ label: p.label })),
			},
		],
		activeSignature: 0,
		activeParameter: info.activeParameter,
	};
}
