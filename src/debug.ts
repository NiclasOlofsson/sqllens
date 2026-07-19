// ---------------------------------------------------------------------------
// The one dev escape hatch for the total-by-contract catch blocks.
//
// Public entries that promise "never throws" (completeAt, referencesAt,
// lineageAt, signatureAt, splitStatements, parseTemplated, templateVariants,
// applyTemplateTags, SqlDocument's variant builder) swallow internal exceptions
// and answer their documented empty result, so an editor never crashes on a
// library bug. The cost: a real internal defect is indistinguishable from
// "nothing found". Setting SQLLENS_DEBUG=1 flips every such catch to rethrow.
// Dev-only knob, not public API; tests: tests/debug-rethrow.test.ts.
//
// The typeof guard matters: in a browser bundle there is no `process` global,
// and a bare `process.env` reference INSIDE a catch block would itself throw,
// breaking the totality contract exactly where it is promised.
// ---------------------------------------------------------------------------

/** Rethrow `e` when SQLLENS_DEBUG is set; otherwise return so the catch can degrade. */
export function debugRethrow(e: unknown): void {
	if (typeof process !== "undefined" && process.env?.SQLLENS_DEBUG) throw e;
}
