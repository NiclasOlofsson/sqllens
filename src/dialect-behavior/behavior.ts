// The internal per-dialect decision surface the semantic layer (everything downstream of lower())
// depends on. Bound once at resolveScopes and carried on the Scope via the carrier. NOT part of the
// public API — never re-exported from src/api.ts or src/index.ts.
//
// The `accepts` (implicit-coercion) facet is added in the check-calls cutover (plan Task 3.2), where
// the coercion tables it needs are extracted; the interface grows there.
import type { IdentKind } from "../ident/fold.js";
import type { FnRule } from "../infer/functions.js";
import type { Type } from "../infer/types.js";
import type { Expr } from "../ir/ir.js";
import type { FnSignature } from "../signature/signatures.js";

export interface DialectBehavior {
	// --- identifier concern (was foldIdentifier / displayName / foldTableName / matchesSourceKey) ---
	fold(raw: string, kind?: IdentKind): string;
	displayName(raw: string): string;
	foldTableName(parts: string[]): string[];
	matchesSourceKey(key: string, rawPart: string): boolean;

	// --- name matching (was likePatternToRegExp, inlined at the star-expansion call sites) ---
	likeMatch(pattern: string, name: string): boolean;

	// --- type inference (was inferDialect(...)) ---
	literal(text: string): Type;
	parseType(text: string): Type;
	functions: Record<string, FnRule>;
	division: "float" | "integer" | "decimal";
	special?(fn: Extract<Expr, { kind: "function" }>): Type | undefined;

	// --- call-signature checking (was check-calls.ts' per-dialect signature tables) ---
	curatedSignatures: Record<string, FnSignature>;
	harvestedSignatures: Record<string, FnSignature>;
	arityUsesHarvested: boolean;
}
