// ---------------------------------------------------------------------------
// dbt-adapter → dialect map. The eight grammars serve more than eight dbt
// adapters: several adapters are SQL-compatible front ends over an engine we
// already parse (Athena v3 executes on Trino, Glue is Spark, Fabric/Synapse
// speak T-SQL, …). A consumer reading `type:` from a profiles.yml should not
// have to own that knowledge — this table does.
//
// Keys are real profiles.yml `type:` values (plus our own dialect names, so
// both vocabularies resolve). Only adapters whose SQL surface our corpus gates
// genuinely represent are mapped — an unlisted adapter resolves to undefined,
// never to a guess.
// ---------------------------------------------------------------------------

import type { Dialect } from "./api.js";

export const ADAPTER_DIALECTS: Readonly<Record<string, Dialect>> = {
	// identity — dialect name and adapter type coincide
	databricks: "databricks",
	snowflake: "snowflake",
	bigquery: "bigquery",
	redshift: "redshift",
	postgres: "postgres",
	duckdb: "duckdb",
	trino: "trino",
	// our dialect name (not an adapter type) — accepted so both vocabularies work
	tsql: "tsql",
	// Spark SQL family — Databricks SQL = Spark SQL; dbt-glue runs Spark on AWS Glue
	spark: "databricks",
	glue: "databricks",
	// T-SQL family — dbt-fabric (dbt-synapse depends on it) and dbt-sqlserver
	fabric: "tsql",
	synapse: "tsql",
	sqlserver: "tsql",
	// Trino family — Athena engine v3 routes queries/DML to Trino; dbt-presto is
	// the pre-rename Trino adapter (deprecated); Starburst uses `type: trino`
	athena: "trino",
	presto: "trino",
};

/**
 * Resolve a dbt adapter type (a profiles.yml `type:` value) or a dialect name
 * to the dialect that parses its SQL. Case-insensitive. Returns undefined for
 * anything not genuinely served by a gated grammar — never guesses.
 */
export function adapterDialect(adapterOrDialect: string): Dialect | undefined {
	return ADAPTER_DIALECTS[adapterOrDialect.trim().toLowerCase()];
}
