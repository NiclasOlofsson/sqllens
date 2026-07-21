import { debugRethrow } from "../debug.js";
import { partSpanOf, type PartSpan } from "../ir/part-span.js";
import type { Scope } from "./scope.js";

// ---------------------------------------------------------------------------
// setOpArmsOf: set-op arm geometry for a frame whose body is a set operation
// (UNION/EXCEPT/INTERSECT), for the SQL debugger's marker planting. Nested set
// ops fold LEFT (`a UNION b UNION c` parses as `(a UNION b) UNION c`), matching
// src/lineage/hops.ts's own `setopLegScopes` flattening (same left-fold rule,
// reimplemented locally rather than imported: a tiny, stable, four-line
// algorithm, not worth a cross-module dependency for it.
// ---------------------------------------------------------------------------

export interface SetOpArm {
	/** The arm's own (select-shaped, or itself a nested set-op) scope. */
	scope: Scope;
	span: PartSpan;
}

export interface SetOpArms {
	/** The whole set-op construct's span. */
	span: PartSpan;
	/** Each arm, flattened left-to-right in source order (nested set-ops folded left). */
	arms: SetOpArm[];
}

/** `undefined` for a non-setop frame, or when a span can't be honestly derived (never fabricate a
 *  partial arm list). Total: never throws. */
export function setOpArmsOf(scope: Scope): SetOpArms | undefined {
	try {
		if (scope.body.kind !== "setop") return undefined;
		const bodySpan = partSpanOf(scope.body.cst);
		if (!bodySpan) return undefined;
		const arms: SetOpArm[] = [];
		for (const leg of flattenArms(scope)) {
			const span = partSpanOf(leg.body.cst);
			if (!span) return undefined; // never fabricate a partial arm list
			arms.push({ scope: leg, span });
		}
		return { span: bodySpan, arms };
	} catch (e) {
		debugRethrow(e);
		return undefined;
	}
}

/** Flatten a set-op scope into its leaf branch scopes, left-to-right. */
function flattenArms(scope: Scope): Scope[] {
	if (scope.body.kind === "setop" && scope.branches) {
		return [...flattenArms(scope.branches.left), ...flattenArms(scope.branches.right)];
	}
	return [scope];
}
