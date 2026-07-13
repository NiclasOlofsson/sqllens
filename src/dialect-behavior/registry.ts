// The one place downstream of lower() that maps a dialect to its behavior. Each behavior delegates to
// the existing per-dialect knowledge (fold rules, InferDialect, signature tables), so parity —
// including every unknown-dialect fallback (fold -> DEFAULT_RULE, infer -> databricks) — is by
// construction. Colocating the knowledge into per-dialect modules is a later, separate step; this
// module is the seam that lets the semantic layer stop importing any of it.
//
// NOT re-exported from src/api.ts or src/index.ts — internal only.
import type { Dialect } from "../dialect.js";
import { displayName, foldIdentifier, foldTableName, matchesSourceKey } from "../ident/fold.js";
import { inferDialect } from "../infer/dialect.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES, HARVESTED_SIGNATURES } from "../signature/signatures.js";
import type { DialectBehavior } from "./behavior.js";
import { acceptsFor, IMPLICIT_BOOL_NUM, IMPLICIT_STR_TO_NUM } from "./coerce-rules.js";
import { snowflakeBehavior } from "../snowflake/behavior.js";

// Risk-flag: harvested signatures don't encode optional/variadic reliably, so an arity check over them
// fires on valid SQL. All false today; flip per dialect once its harvested table earns it. (Mirrors the
// table check-calls.ts currently owns; that copy is removed when check-calls is cut over — plan 3.2.)
const ARITY_USES_HARVESTED: Record<string, boolean> = {
	databricks: false,
	tsql: false,
	snowflake: false,
	bigquery: false,
	redshift: false,
	postgres: false,
	duckdb: false,
	trino: false,
	sqlite: false,
	mysql: false,
};

/** Build a behavior that delegates to the existing string-keyed knowledge, so parity (including every
 *  unknown-dialect fallback) is by construction. */
export function makeBehavior(name: string): DialectBehavior {
	const infer = inferDialect(name);
	return {
		fold: (raw, kind) => foldIdentifier(raw, name, kind),
		displayName: (raw) => displayName(raw, name),
		foldTableName: (parts) => foldTableName(parts, name),
		matchesSourceKey: (key, rawPart) => matchesSourceKey(key, rawPart, name),
		likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
		literal: (t) => infer.literal(t),
		parseType: (t) => infer.parseType(t),
		functions: infer.functions,
		division: infer.division,
		special: infer.special,
		curatedSignatures: FUNCTION_SIGNATURES[name as Dialect] ?? {},
		harvestedSignatures: HARVESTED_SIGNATURES[name as Dialect] ?? {},
		arityUsesHarvested: ARITY_USES_HARVESTED[name] ?? false,
		accepts: (argType, paramText) =>
			acceptsFor(infer.parseType, IMPLICIT_STR_TO_NUM.has(name), IMPLICIT_BOOL_NUM.has(name), argType, paramText),
	};
}

const DIALECT_NAMES: Dialect[] = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
];

// Dialects whose knowledge has been colocated into src/<dialect>/ provide their behavior directly;
// the rest are still assembled centrally by makeBehavior. As each dialect moves, add it here.
const COLOCATED: Partial<Record<Dialect, DialectBehavior>> = {
	snowflake: snowflakeBehavior,
};

export const BEHAVIORS: Record<Dialect, DialectBehavior> = Object.fromEntries(
	DIALECT_NAMES.map((d) => [d, COLOCATED[d] ?? makeBehavior(d)]),
) as Record<Dialect, DialectBehavior>;

/** Resolve a dialect string (the IR/Scope tag) to its behavior. Throws on an unregistered/absent
 *  dialect — sqllens applies NO default; the consumer must supply a supported Dialect. */
export function resolveBehavior(name: string | undefined): DialectBehavior {
	const b = name !== undefined ? (BEHAVIORS as Record<string, DialectBehavior>)[name] : undefined;
	if (!b) throw new Error(`sqllens: no behavior for dialect "${name}" — supply a supported Dialect.`);
	return b;
}
