// The seam that hands a scope its behavior. It reads the scope's own `.dialect` tag (the loose string
// the IR / lower() already stamped) through the cached registry, so the semantic passes call
// behaviorOf(scope) and never touch a dialect string or a Record<Dialect, …> table themselves. The tag
// stays a public field on Scope/QueryExpr; only this module (the seam) interprets it. resolveBehavior
// caches, so a caller typically resolves once per pass and reuses the handle.
//
// NOT re-exported from src/api.ts or src/index.ts — internal only.
import type { DialectBehavior } from "./behavior.js";
import { resolveBehavior } from "./registry.js";

/** The dialect behavior for a scope (or anything carrying a `.dialect` tag). */
export function behaviorOf(carrier: { dialect?: string }): DialectBehavior {
	return resolveBehavior(carrier.dialect);
}
