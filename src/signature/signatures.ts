// ---------------------------------------------------------------------------
// Function-signature runtime — one generated table per dialect, each folding a curated override
// layer over the harvested doc-derived long tail at BUILD time (tools/harvest-signatures.mjs). There
// is no separate curated/harvested split left at runtime: SIGNATURES[dialect] is already the merged
// table, and each entry's `origin` field says which layer produced it.
//
// A name maps to an ORDERED overload SET (readonly FnSignature[]), not a single shape: it is common
// for a builtin to be overloaded on argument type or arity (postgres lower(text) vs lower(anyrange),
// trino length(binary) vs length(string)), and the model represents that directly. A name with one
// documented shape is simply a one-element array; origin is uniform across one name's whole set (an
// override always replaces the entire set, never blends origins entry by entry).
//
// The ten generated tables are committed at src/<dialect>/signatures.generated.ts, rebuilt by
// `node tools/harvest-signatures.mjs`, never hand-edited. The curated inputs that feed the merge
// live as plain data at tools/signature-overrides/<dialect>.mjs.
//
// Core module: pure data + types, no antlr, no LSP deps.
// ---------------------------------------------------------------------------

import type { Dialect } from "../dialect.js";
import { DATABRICKS_SIGNATURES } from "../databricks/signatures.generated.js";
import { TSQL_SIGNATURES } from "../tsql/signatures.generated.js";
import { SNOWFLAKE_SIGNATURES } from "../snowflake/signatures.generated.js";
import { BIGQUERY_SIGNATURES } from "../bigquery/signatures.generated.js";
import { REDSHIFT_SIGNATURES } from "../redshift/signatures.generated.js";
import { POSTGRES_SIGNATURES } from "../postgres/signatures.generated.js";
import { DUCKDB_SIGNATURES } from "../duckdb/signatures.generated.js";
import { TRINO_SIGNATURES } from "../trino/signatures.generated.js";
import { SQLITE_SIGNATURES } from "../sqlite/signatures.generated.js";
import { MYSQL_SIGNATURES } from "../mysql/signatures.generated.js";

/** One formal parameter of a signature. `type` is the dialect's documented type name.
 *  `optional` marks a trailing param the caller may omit — it is consulted by the arity checker
 *  (src/qualify/check-calls.ts) to compute the minimum arg count; optional params must be trailing. */
export interface ParamSig {
	name: string;
	type?: string;
	optional?: boolean;
}

/** A function signature. `variadic` means the LAST param repeats (e.g. concat/coalesce). `origin`
 *  says which layer produced this entry: "curated" (a hand-authored, doc-cited override) or
 *  "harvested" (mined from a vendor doc's syntax notation by tools/harvest-signatures.mjs). The
 *  arity checker trusts both origins; operand-TYPE checking trusts "curated" only. */
export interface FnSignature {
	name: string;
	params: ParamSig[];
	variadic?: boolean;
	readonly origin?: "curated" | "harvested";
}

/** The merged function-signature table, per dialect, keyed by lowercased function name. Each name maps
 *  to an ordered overload SET, not a single shape. Each table is generated (curated overrides folded
 *  over the harvested long tail); see the module header. */
export const SIGNATURES: Record<Dialect, Record<string, readonly FnSignature[]>> = {
	databricks: DATABRICKS_SIGNATURES,
	tsql: TSQL_SIGNATURES,
	snowflake: SNOWFLAKE_SIGNATURES,
	bigquery: BIGQUERY_SIGNATURES,
	redshift: REDSHIFT_SIGNATURES,
	postgres: POSTGRES_SIGNATURES,
	duckdb: DUCKDB_SIGNATURES,
	trino: TRINO_SIGNATURES,
	sqlite: SQLITE_SIGNATURES,
	mysql: MYSQL_SIGNATURES,
};

/** The overload set for a lowercased function name, or undefined when neither layer knows it: the
 *  caller then degrades to a name-only hint. */
export function lookupSignature(dialect: Dialect, lowerName: string): readonly FnSignature[] | undefined {
	return SIGNATURES[dialect][lowerName];
}

/** Whether the merged table knows this lowercased name (membership check for functionName()). */
export function hasSignature(dialect: Dialect, lowerName: string): boolean {
	return lowerName in SIGNATURES[dialect];
}
