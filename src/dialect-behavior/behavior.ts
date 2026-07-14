// The internal per-dialect decision surface the semantic layer (everything downstream of lower())
// depends on. Bound once at resolveScopes and carried on the Scope via the carrier. NOT part of the
// public API — never re-exported from src/api.ts or src/index.ts.
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
	/** The dialect's merged function-signature table (curated overrides folded over the harvested
	 *  long tail at generation time — src/<dialect>/signatures.generated.ts). The arity checker trusts
	 *  every entry regardless of origin; operand-type checking trusts "curated"-origin entries only. */
	signatures: Record<string, FnSignature>;
	/** Whether an argument type is acceptable for a declared param (dialect implicit-coercion rules). */
	accepts(argType: Type, paramText: string | undefined): boolean;
}
