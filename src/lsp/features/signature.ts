import type { Position, SignatureHelp } from "vscode-languageserver-types";
import { type SqlSession } from "../../index.js";

// ---------------------------------------------------------------------------
// Signature help: the interactive editor feature that shows parameter hints
// while typing inside a call's parentheses. It maps the cached document's caret
// offset to the session's `signatureAt()` result and turns it into an LSP
// SignatureHelp (one signature, the active parameter highlighted). Pure
// translation: position in, SignatureHelp out. signatureAt() never throws and
// returns null when the caret isn't inside a call, so neither does this.
// ---------------------------------------------------------------------------

export function computeSignatureHelp(session: SqlSession, position: Position): SignatureHelp | null {
	const off = session.doc.lines.offsetAt(position.line, position.character);
	const info = session.signatureAt(off);
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
