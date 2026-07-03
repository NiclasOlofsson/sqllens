import { qualify } from "../../src/qualify/qualify.js";
import { Schema } from "../../src/qualify/schema.js";
import type { ScopeTree } from "../../src/scope/scope.js";

// ---------------------------------------------------------------------------
// The call-signature honesty sweep (Task 12). Over a dialect's valid `query/`
// corpus, the arity + operand-type checker (src/qualify/check-calls.ts) must
// emit ZERO diagnostics — every file is valid vendor-documented SQL, so any
// wrong-arity / wrong-argument-type is a false positive to be fixed in the
// signature table or the checker, never excluded. This proves the never-wrong
// contract for the new diagnostic class at corpus scale.
//
// It rides the SAME single parse each gate already makes: the caller hands the
// already-lowered+scoped ScopeTree; qualify() over an empty schema then runs
// the call checker (column args resolve to `unknown` without a catalog, so
// operand-type stays silent on them — arity and literal-typed args are the
// live surface). No file is re-parsed.
// ---------------------------------------------------------------------------

const EMPTY_SCHEMA = new Schema({});

/** Append any call-signature diagnostics (wrong-arity / wrong-argument-type) this scope tree yields to
 *  `hits`, tagged with `rel`. A clean corpus leaves `hits` empty — the gate asserts that. */
export function sweepCallDiagnostics(scopes: ScopeTree, rel: string, hits: string[]): void {
	for (const d of qualify(scopes, EMPTY_SCHEMA).diagnostics) {
		if (d.kind === "wrong-arity" || d.kind === "wrong-argument-type") {
			hits.push(`${rel}: [${d.kind}] ${d.message}`);
		}
	}
}
