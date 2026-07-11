/** The dialects reachable through the unified surface. Each has its own grammar/CST and a
 *  parse+lower pair; everything after lower() runs unchanged on all of them. */
export type Dialect =
	| "databricks"
	| "tsql"
	| "snowflake"
	| "bigquery"
	| "redshift"
	| "postgres"
	| "duckdb"
	| "trino"
	| "sqlite"
	| "mysql";
