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

export const BEHAVIORS: Record<Dialect, DialectBehavior> = Object.fromEntries(
	DIALECT_NAMES.map((d) => [d, makeBehavior(d)]),
) as Record<Dialect, DialectBehavior>;

const CACHE = new Map<string, DialectBehavior>(Object.entries(BEHAVIORS));

/** Resolve a dialect string (or the loose IR/Scope tag) to its behavior; caches unknown names so an
 *  odd tag delegates to the same fallback path each time. Mirrors inferDialect's tolerance of any string. */
export function resolveBehavior(name: string | undefined): DialectBehavior {
	const key = name ?? "databricks";
	let b = CACHE.get(key);
	if (!b) {
		b = makeBehavior(key);
		CACHE.set(key, b);
	}
	return b;
}
