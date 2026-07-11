// ---------------------------------------------------------------------------
// Derived-dialect → dialect map. The grammars parse more than their own named
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
	sqlite: "sqlite",
	mysql: "mysql",
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
	// MariaDB — forked from MySQL 5.1 and still a near-superset for ordinary DQL/DML, so mapped to
	// the mysql grammar as a PARTIAL derived alias (Open Gap, not full coverage — MariaDB's own
	// extensions are unmodeled). B-R5.5 spot-checked four MariaDB-specific statements against the
	// mysql/Positive-Technologies grammar (grammars/mysql/) by actually parsing them
	// (temp_auto/mariadb-probe.mts, parseMysql()): all four FAIL —
	//   `SELECT NEXT VALUE FOR seq_name` (mariadb.com/docs/.../sequences/next-value) — "no viable
	//     alternative" (no NEXT/VALUE/FOR sequence-expression production);
	//   `DELETE FROM t WHERE id = 1 RETURNING *` (mariadb.com/docs/.../delete) — "mismatched input
	//     'RETURNING'" (no RETURNING clause on DELETE; MySQL itself has none either);
	//   `INSERT INTO t (a) VALUES (1) RETURNING *` (mariadb.com/docs/.../insert) — "extraneous input
	//     '*'", same missing-RETURNING gap;
	//   `CREATE SEQUENCE seq_name START WITH 1 INCREMENT BY 1` (mariadb.com/docs/.../sequences/
	//     create-sequence) — "no viable alternative" (no CREATE SEQUENCE DDL in this grammar).
	// A plain `SELECT a, b FROM t WHERE a = 1` control probe parses with 0 errors, confirming
	// ordinary DQL still works — the alias covers that surface, not MariaDB's own additions.
	mariadb: "mysql",
	// Alternate spelling of the engine name (alias class, same as our own dialect
	// names above). Admitted 2026-07-10 on the anvil channel's request; caveat noted
	// there: no dbt adapter is attested to emit `postgresql` as its adapter_type —
	// it is inherited consumer vocabulary, admitted as a cheap, honest alias.
	postgresql: "postgres",
};

/**
 * Resolve an engine / product name (or a dialect name) to the dialect that
 * parses its SQL. Case-insensitive. Returns undefined for anything not
 * genuinely served by a gated grammar — never guesses.
 */
export function resolveDialect(engineOrDialect: string): Dialect | undefined {
	return DERIVED_DIALECTS[engineOrDialect.trim().toLowerCase()];
}
