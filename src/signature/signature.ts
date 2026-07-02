// ---------------------------------------------------------------------------
// signatureAt() — parameter hints while typing inside a call's parentheses.
//
// The third interactive editor feature (after completion + semantic tokens). It
// lives in the BROKEN-input world — the call is half-typed, the closing paren is
// usually missing — so it is a pure TOKEN SCAN over the document's neutral token
// stream (doc.tokens), never a parse: an ANTLR tree can't be relied on mid-edit.
//
// Steps, anchored at the caret offset:
//   1. enclosing call — scan left over default-channel tokens tracking paren depth;
//      the first `(` that drops depth below zero is the open paren of the call;
//   2. function name — the word-like token immediately before that `(`;
//   3. active parameter — top-level commas between that `(` and the caret (commas
//      at the call's own depth only; nested call/paren commas don't count);
//   4. label — from the curated FUNCTION_SIGNATURES table; the long tail degrades
//      to a name-only hint with the active-arg index still resolved.
//
// Total: never throws. Anything that isn't a clean call → null.
//
// Core module: pure TS over doc.tokens + the curated table + the inference
// registry (function-name membership). No antlr, no LSP deps.
// ---------------------------------------------------------------------------

import type { SqlDocument } from "../document/document.js";
import type { Schema } from "../qualify/schema.js";
import type { Token } from "../token/token.js";
import { inferDialect } from "../infer/dialect.js";
import { hasSignature, lookupSignature, type FnSignature, type ParamSig } from "./signatures.js";

/** What the editor shows while typing inside a call's parens. */
export interface SignatureInfo {
	/** e.g. "date_add(start_date: date, num_days: int)" — or just "myfunc" when uncurated. */
	label: string;
	/** One per param; [] when uncurated. */
	parameters: { label: string }[];
	/** 0-based arg index the caret is in. */
	activeParameter: number;
}

/**
 * Signature help for the caret at `offset` in `doc`, or null when the caret isn't inside a
 * recognizable call. `schema` is accepted for parity with the other features (and future
 * overload selection) but the curated tables don't need it today. NEVER throws.
 */
export function signatureAt(doc: SqlDocument, offset: number, _schema?: Schema): SignatureInfo | null {
	try {
		return compute(doc, offset);
	} catch {
		// Total by contract: a scan hiccup must never surface to the editor.
		return null;
	}
}

function compute(doc: SqlDocument, offset: number): SignatureInfo | null {
	// Default-channel tokens only, in source order — trivia (whitespace/comments) is skipped so a
	// caret with spaces before it still resolves. EOF carries no text/role and is harmless to keep.
	const toks = doc.tokens.filter((t) => t.channel === 0);

	// The index of the first token that STARTS at or after the caret: everything before it is to the
	// left of the caret. (A token straddling the caret — caret mid-token — is treated as "before".)
	let caretIdx = toks.length;
	for (let i = 0; i < toks.length; i++) {
		if (toks[i].start >= offset) {
			caretIdx = i;
			break;
		}
	}

	// Step 1 — walk left from the caret tracking paren depth. A `)` to our left opens a balanced
	// nested group (depth++); a `(` closes one (depth--). The first `(` that takes depth below zero
	// is the open paren of the call that ENCLOSES the caret.
	let depth = 0;
	let openIdx = -1;
	for (let i = caretIdx - 1; i >= 0; i--) {
		const text = toks[i].text;
		if (text === ")") {
			depth++;
		} else if (text === "(") {
			if (depth === 0) {
				openIdx = i;
				break;
			}
			depth--;
		}
	}
	if (openIdx === -1) return null; // caret not inside any parentheses

	// Step 2 — the function name is the word-like token immediately before the open paren.
	const nameTok = openIdx > 0 ? toks[openIdx - 1] : undefined;
	const name = functionName(nameTok, doc.dialect);
	if (name === null) return null; // a subquery / parenthesized-expression `(`, not a call

	// Step 3 — count top-level commas between the open paren and the caret (commas at this call's
	// own depth only; commas inside nested calls/parens don't advance the active parameter).
	let active = 0;
	let inner = 0;
	for (let i = openIdx + 1; i < caretIdx; i++) {
		const text = toks[i].text;
		if (text === "(") inner++;
		else if (text === ")") {
			if (inner > 0) inner--;
		} else if (text === "," && inner === 0) {
			active++;
		}
	}

	// Step 4 — render from the curated table (harvested long tail behind it), else degrade to a
	// name-only hint.
	const sig = lookupSignature(doc.dialect, name.toLowerCase());
	if (!sig) {
		return { label: name, parameters: [], activeParameter: active };
	}
	return curated(sig, active);
}

/**
 * The function name for the token before the open paren, or null if it isn't a call.
 * An `identifier`-role token is always a name (covers user functions → uncurated fallback). A
 * `keyword`-role token is a name only when it's a KNOWN function — curated, or in the dialect's
 * inference registry — so a parenthesized subquery/expression after a clause keyword (FROM (…),
 * SELECT (a+b)) or a bare `(` correctly returns null instead of a bogus "FROM(" hint. Many SQL
 * functions (DATE_ADD, CONCAT, DATEADD) lex as keywords, so role alone can't decide.
 */
function functionName(tok: Token | undefined, dialect: SqlDocument["dialect"]): string | null {
	if (!tok) return null;
	const text = tok.text;
	if (!text) return null;
	if (tok.role === "identifier") return text;
	if (tok.role === "keyword") {
		const lower = text.toLowerCase();
		if (hasSignature(dialect, lower)) return text; // curated or harvested
		if (lower in inferDialect(dialect).functions) return text;
		return null;
	}
	return null; // punctuation / operator / string / number / comment / whitespace → not a call
}

/** Build the curated SignatureInfo: a `name(p1: t1, …)` label, one parameter label per param, and
 *  the active index clamped to the last param for a variadic signature (extra args stay on the
 *  repeating param). */
function curated(sig: FnSignature, active: number): SignatureInfo {
	const parameters = sig.params.map((p) => ({ label: paramLabel(p) }));
	const lastIdx = parameters.length - 1;
	// A variadic signature's last param repeats: clamp so args past the fixed list keep highlighting
	// it rather than running off the end. A fixed signature leaves `active` as-is (an over-count
	// simply lands past the last param — the editor renders nothing active, which is correct).
	const activeParameter = sig.variadic && lastIdx >= 0 ? Math.min(active, lastIdx) : active;
	const inner = sig.params.map(paramLabel);
	// Variadic: render the repeating param with a trailing "…" so the popup shows it repeats.
	const rendered =
		sig.variadic && inner.length > 0 ? [...inner.slice(0, -1), `${inner[inner.length - 1]}, …`] : inner;
	return {
		label: `${sig.name}(${rendered.join(", ")})`,
		parameters,
		activeParameter,
	};
}

/** One param's display string: `name: type` when typed, else just `name`. */
function paramLabel(p: ParamSig): string {
	return p.type ? `${p.name}: ${p.type}` : p.name;
}
