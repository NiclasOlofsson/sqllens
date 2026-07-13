// The one place downstream of lower() that maps a dialect to its behavior. Each dialect's behavior is
// assembled in its own folder (src/<dialect>/behavior.ts); this module is pure wiring — it imports the
// ten behaviors and indexes them by dialect name. Nothing here reaches a central per-dialect table.
//
// NOT re-exported from src/api.ts or src/index.ts — internal only.
import type { Dialect } from "../dialect.js";
import type { DialectBehavior } from "./behavior.js";
import { databricksBehavior } from "../databricks/behavior.js";
import { tsqlBehavior } from "../tsql/behavior.js";
import { snowflakeBehavior } from "../snowflake/behavior.js";
import { bigqueryBehavior } from "../bigquery/behavior.js";
import { redshiftBehavior } from "../redshift/behavior.js";
import { postgresBehavior } from "../postgres/behavior.js";
import { duckdbBehavior } from "../duckdb/behavior.js";
import { trinoBehavior } from "../trino/behavior.js";
import { sqliteBehavior } from "../sqlite/behavior.js";
import { mysqlBehavior } from "../mysql/behavior.js";

export const BEHAVIORS: Record<Dialect, DialectBehavior> = {
	databricks: databricksBehavior,
	tsql: tsqlBehavior,
	snowflake: snowflakeBehavior,
	bigquery: bigqueryBehavior,
	redshift: redshiftBehavior,
	postgres: postgresBehavior,
	duckdb: duckdbBehavior,
	trino: trinoBehavior,
	sqlite: sqliteBehavior,
	mysql: mysqlBehavior,
};

/** Resolve a dialect string (the IR/Scope tag) to its behavior. Throws on an unregistered/absent
 *  dialect — sqllens applies NO default; the consumer must supply a supported Dialect. */
export function resolveBehavior(name: string | undefined): DialectBehavior {
	// Object.hasOwn guards against inherited keys ("constructor", "toString", …) resolving to a
	// prototype member instead of throwing.
	const b =
		name !== undefined && Object.hasOwn(BEHAVIORS, name)
			? (BEHAVIORS as Record<string, DialectBehavior>)[name]
			: undefined;
	if (!b) throw new Error(`sqllens: no behavior for dialect "${name}" — supply a supported Dialect.`);
	return b;
}
