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
//   4. signatures: one rendered entry per overload from the merged per-dialect
//      SIGNATURES table (a name maps to an overload SET, not a single shape), plus
//      which one is active, an unknown name degrades to a one-entry name-only hint
//      with the active-arg index still resolved.
//
// Total: never throws. Anything that isn't a clean call → null.
//
// Core module: pure TS over doc.tokens + the merged signature table + the inference
// registry (function-name membership). No antlr, no LSP deps.
// ---------------------------------------------------------------------------

import { debugRethrow } from "../debug.js";
import type { SqlDocument } from "../document/document.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import type { Token } from "../token/token.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import { hasSignature, lookupSignature, type FnSignature, type ParamSig } from "./signatures.js";
import { renderSignature } from "./render.js";

/** One rendered overload: e.g. "date_add(start_date: date, num_days: int)". */
export interface SignatureLabel {
	label: string;
	/** One per param; [] for the name-only fallback entry. */
	parameters: { label: string }[];
}

/** What the editor shows while typing inside a call's parens: every overload of the called name,
 *  which one is active, and which of ITS params the caret is in. */
export interface SignatureHelpInfo {
	/** Every overload of the called name, in harvested/authored order; a single one-element array for
	 *  an uncurated name (the name-only fallback) or a name with one documented shape. */
	signatures: SignatureLabel[];
	/** Index into `signatures` of the overload the editor should highlight. */
	activeSignature: number;
	/** 0-based arg index the caret is in, within the active signature. */
	activeParameter: number;
}

/**
 * Signature help for the caret at `offset` in `doc`, or null when the caret isn't inside a
 * recognizable call. `schema` is accepted for parity with the other features (and future
 * overload selection) but the curated tables don't need it today. NEVER throws.
 */
export function signatureAt(doc: SqlDocument, offset: number, _schema?: SchemaProvider): SignatureHelpInfo | null {
	try {
		return compute(doc, offset);
	} catch (e) {
		// Total by contract: a scan hiccup must never surface to the editor.
		debugRethrow(e);
		return null;
	}
}

function compute(doc: SqlDocument, offset: number): SignatureHelpInfo | null {
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

	// Step 4: render every overload from the merged table (harvested long tail behind it), else
	// degrade to a one-entry name-only hint.
	const overloads = lookupSignature(doc.dialect, name.toLowerCase());
	if (!overloads) {
		return { signatures: [{ label: name, parameters: [] }], activeSignature: 0, activeParameter: active };
	}
	return renderOverloads(overloads, active);
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
		if (lower in resolveBehavior(dialect).functions) return text;
		return null;
	}
	return null; // punctuation / operator / string / number / comment / whitespace → not a call
}

/** Render every overload, then pick which one is active and clamp the active-param index to it.
 *  activeSignature is the FIRST overload that can still accept `active` as a real param index
 *  (`active < params.length`, or the overload is variadic: it always can), else the last overload
 *  (an over-count on every fixed overload has nowhere better to land than the longest one). */
function renderOverloads(overloads: readonly FnSignature[], active: number): SignatureHelpInfo {
	const signatures = overloads.map(renderOne);
	let activeSignature = overloads.findIndex((sig) => sig.variadic || active < sig.params.length);
	if (activeSignature === -1) activeSignature = overloads.length - 1;
	const sig = overloads[activeSignature];
	const lastIdx = sig.params.length - 1;
	// A variadic signature's last param repeats: clamp so args past the fixed list keep highlighting
	// it rather than running off the end. A fixed signature leaves `active` as-is (an over-count
	// simply lands past the last param — the editor renders nothing active, which is correct).
	const activeParameter = sig.variadic && lastIdx >= 0 ? Math.min(active, lastIdx) : active;
	return { signatures, activeSignature, activeParameter };
}

/** One overload rendered through the canonical renderer (issue #33) plus its parameter labels.
 *  Each parameter label is the same `name: type` string the rendered label contains, so an
 *  editor's substring-based active-parameter highlighting still lands. */
function renderOne(sig: FnSignature): SignatureLabel {
	const parameters = sig.params.map((p) => ({ label: paramLabel(p) }));
	return { label: renderSignature(sig), parameters };
}

/** One param's display string: `name: type` when typed, else just `name`. */
function paramLabel(p: ParamSig): string {
	return p.type ? `${p.name}: ${p.type}` : p.name;
}
