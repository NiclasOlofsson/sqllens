// The internal per-dialect decision surface the semantic layer (everything downstream of lower())
// depends on. Bound once at resolveScopes and carried on the Scope via the carrier. NOT part of the
// public API — never re-exported from src/api.ts or src/index.ts.
import type { IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";
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
	/** The dialect's namespace shape + fold rule for building QualifiedNames outside lower()
	 *  (shared layers synthesizing sources, apply-tags renaming templated ones). Same object the
	 *  dialect's own lower() uses; declared in src/<dialect>/fold.ts (issue #38). */
	nameConfig: QualifiedNameConfig;

	// --- name matching (was likePatternToRegExp, inlined at the star-expansion call sites) ---
	likeMatch(pattern: string, name: string): boolean;

	// --- type inference (was inferDialect(...)) ---
	literal(text: string): Type;
	parseType(text: string): Type;
	functions: Record<string, FnRule>;
	division: "float" | "integer" | "decimal";
	/** What `date - date` / `timestamp - timestamp` yields. Spark/Databricks: an ANSI interval
	 *  (our single `interval` scalar — the qualified subtype is a tracked coarseness). Absent =
	 *  the plain arithmetic coerce path (a dialect sets this only with an external citation). */
	dateSubtraction?: "interval";
	/** Pre-registry hook for calls no FnRule can type. `typeOf` types an argument Expr in the
	 *  calling scope, for returns that depend on an argument's TYPE as well as a literal's
	 *  value (date_part over an interval source). Implementations may ignore it. */
	special?(fn: Extract<Expr, { kind: "function" }>, typeOf: (e: Expr) => Type): Type | undefined;

	// --- call-signature checking (was check-calls.ts' per-dialect signature tables) ---
	/** The dialect's merged function-signature table (curated overrides folded over the harvested
	 *  long tail at generation time — src/<dialect>/signatures.generated.ts). Each name maps to an
	 *  ordered overload SET, not a single shape. The arity checker trusts every overload regardless of
	 *  origin; operand-type checking trusts a name with exactly one overload of "curated" origin only. */
	signatures: Record<string, readonly FnSignature[]>;
	/** Whether an argument type is acceptable for a declared param (dialect implicit-coercion rules). */
	accepts(argType: Type, paramText: string | undefined): boolean;
}
