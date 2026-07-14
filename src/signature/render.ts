// ---------------------------------------------------------------------------
// The canonical signature renderer (issue #33): ONE exported function emitting the vendor
// syntax notation the harvest originally mined, so signature help, completion detail and
// hover show identical notation everywhere (downstream consumers delete their own renderers).
//
//   round(v: NUMERIC [, s: INTEGER])
//   aes_decrypt(expr, key [, mode [, padding [, aad]]])
//   concat(value, ...)
//
// Optional params are the TRAILING run (the ParamSig contract; the arity checker relies on
// the same invariant) and render as nested brackets, one level per omissible param. A
// non-trailing `optional` flag (contract violation in the data) renders as required rather
// than producing a bracket a required param would sit inside. `variadic` means the last
// param repeats: a trailing ", ..." inside the innermost bracket when that param is
// optional, after it otherwise.
// ---------------------------------------------------------------------------

import type { FnSignature, ParamSig } from "./signatures.js";

export interface RenderSignatureOptions {
	/** false → compact form for narrow UI slots: param names only, no `: type` annotations. */
	types?: boolean;
}

/** Render one overload in vendor syntax notation. */
export function renderSignature(sig: FnSignature, opts?: RenderSignatureOptions): string {
	const withTypes = opts?.types !== false;
	const label = (p: ParamSig) => (withTypes && p.type ? `${p.name}: ${p.type}` : p.name);

	let lastRequired = -1;
	sig.params.forEach((p, i) => {
		if (!p.optional) lastRequired = i;
	});
	const required = sig.params.slice(0, lastRequired + 1).map(label);
	const optional = sig.params.slice(lastRequired + 1).map(label);

	if (sig.variadic && sig.params.length > 0) {
		if (optional.length > 0) optional[optional.length - 1] += ", ...";
		else required[required.length - 1] += ", ...";
	}

	let out = required.join(", ");
	for (let i = 0; i < optional.length; i++) {
		out += out.length === 0 ? `[${optional[i]}` : ` [, ${optional[i]}`;
	}
	out += "]".repeat(optional.length);
	return `${sig.name}(${out})`;
}
