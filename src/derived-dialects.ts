// ---------------------------------------------------------------------------
// Derived-dialect → dialect map. The eight grammars parse more than eight
// engines: a *derived dialect* is an engine with no grammar of its own whose
// SQL surface is a subset of — or identical to — one we already parse (Amazon
// Athena's engine is Trino, AWS Glue runs Spark, Microsoft Fabric / Azure
// Synapse / SQL Server speak T-SQL, …). A consumer that only knows an engine
// name should not have to own that knowledge — this table does.
//
// Keys are engine / product names (plus our own dialect names, so both
// vocabularies resolve). Only engines whose SQL surface our corpus gates
// genuinely represent are mapped — an unlisted name resolves to undefined,
// never to a guess.
// ---------------------------------------------------------------------------

import type { Dialect } from "./dialect.js";

export const DERIVED_DIALECTS: Readonly<Record<string, Dialect>> = {
	// identity — the engine name and the dialect name coincide
	databricks: "databricks",
	snowflake: "snowflake",
	bigquery: "bigquery",
	redshift: "redshift",
	postgres: "postgres",
	duckdb: "duckdb",
	trino: "trino",
	// our dialect name (not an engine name) — accepted so both vocabularies work
	tsql: "tsql",
	// Spark SQL family — Databricks SQL = Spark SQL; AWS Glue runs Spark
	spark: "databricks",
	glue: "databricks",
	// T-SQL family — Microsoft Fabric and Azure Synapse (restricted T-SQL subsets)
	// and SQL Server (the reference T-SQL)
	fabric: "tsql",
	synapse: "tsql",
	sqlserver: "tsql",
	// Trino family — Amazon Athena engine v3 routes queries/DML to Trino; Presto
	// is Trino's predecessor
	athena: "trino",
	presto: "trino",
};

/**
 * Resolve an engine / product name (or a dialect name) to the dialect that
 * parses its SQL. Case-insensitive. Returns undefined for anything not
 * genuinely served by a gated grammar — never guesses.
 */
export function resolveDialect(engineOrDialect: string): Dialect | undefined {
	return DERIVED_DIALECTS[engineOrDialect.trim().toLowerCase()];
}
