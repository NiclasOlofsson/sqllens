// ---------------------------------------------------------------------------
// Function docs runtime (issue #34) — the per-NAME companion of the signature tables: one
// generated table per dialect (src/<dialect>/fn-docs.generated.ts, rebuilt by
// tools/harvest-signatures.mjs, never hand-edited), keyed by the same lowercased function
// name as *_SIGNATURES. Docs are per NAME, not per overload — a description or doc link
// describes the function, however many documented shapes it has.
//
// `docUrl` is the vendor's published page for the same source the signature harvest read.
// `description` is one line of prose, present only where its provenance is legally clean;
// `origin` says which layer wrote it:
//   "vendor-docs" — extracted from a permissively licensed vendor source (see
//                    THIRD-PARTY-NOTICES.md for attribution);
//   "spark-docs"  — Apache Spark's @ExpressionDescription usage strings (databricks);
//   "authored"    — original prose written for this project (the license-blocked dialects),
//                    never copied from vendor docs.
// A docUrl-only entry carries origin "vendor-docs" (the URL is the vendor's page).
//
// Core module: pure data + types, no antlr, no LSP deps.
// ---------------------------------------------------------------------------

import type { Dialect } from "../dialect.js";
import { DATABRICKS_FN_DOCS } from "../databricks/fn-docs.generated.js";
import { TSQL_FN_DOCS } from "../tsql/fn-docs.generated.js";
import { SNOWFLAKE_FN_DOCS } from "../snowflake/fn-docs.generated.js";
import { BIGQUERY_FN_DOCS } from "../bigquery/fn-docs.generated.js";
import { REDSHIFT_FN_DOCS } from "../redshift/fn-docs.generated.js";
import { POSTGRES_FN_DOCS } from "../postgres/fn-docs.generated.js";
import { DUCKDB_FN_DOCS } from "../duckdb/fn-docs.generated.js";
import { TRINO_FN_DOCS } from "../trino/fn-docs.generated.js";
import { SQLITE_FN_DOCS } from "../sqlite/fn-docs.generated.js";
import { MYSQL_FN_DOCS } from "../mysql/fn-docs.generated.js";

/** Docs for one function name: the vendor's doc page, and (where provenance permits) a
 *  one-line description. `origin` is the description's provenance; a docUrl-only entry is
 *  "vendor-docs". */
export interface FnDoc {
	/** The vendor's published documentation page for this function. */
	docUrl?: string;
	/** One line of prose describing the function. Absent when no legally clean source exists. */
	description?: string;
	readonly origin: "vendor-docs" | "spark-docs" | "authored";
}

/** The per-dialect function docs tables, keyed by lowercased function name — the same keys as
 *  SIGNATURES. Names with neither a docUrl nor a description have no entry. */
export const FN_DOCS: Record<Dialect, Record<string, FnDoc>> = {
	databricks: DATABRICKS_FN_DOCS,
	tsql: TSQL_FN_DOCS,
	snowflake: SNOWFLAKE_FN_DOCS,
	bigquery: BIGQUERY_FN_DOCS,
	redshift: REDSHIFT_FN_DOCS,
	postgres: POSTGRES_FN_DOCS,
	duckdb: DUCKDB_FN_DOCS,
	trino: TRINO_FN_DOCS,
	sqlite: SQLITE_FN_DOCS,
	mysql: MYSQL_FN_DOCS,
};

/** The docs entry for a lowercased function name, or undefined when nothing is known. */
export function lookupFnDoc(dialect: Dialect, lowerName: string): FnDoc | undefined {
	return FN_DOCS[dialect][lowerName];
}
