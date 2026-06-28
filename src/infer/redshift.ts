import { parseType, scalar, UNKNOWN, type Type } from "./types.js";
import type { FnRule } from "./functions.js";

// ---------------------------------------------------------------------------
// Redshift (Postgres-derived) inference knowledge. Scalar-name aliases map the
// Postgres/Redshift type vocabulary onto the shared canonical names; division
// truncates integers (verified: AWS r_numeric_computations201). The function
// registry is a doc-cited starter — a missing entry safely yields `unknown`
// (the inference contract), and it grows over time like the other dialects'.
// ---------------------------------------------------------------------------

export const REDSHIFT_ALIASES: Record<string, string> = {
	int2: "smallint",
	int4: "int",
	integer: "int",
	int8: "bigint",
	numeric: "decimal",
	dec: "decimal",
	float4: "float",
	real: "float",
	float8: "double",
	float: "double", // bare FLOAT is double precision in Redshift
	"double precision": "double",
	bool: "boolean",
	char: "string",
	character: "string",
	bpchar: "string",
	nchar: "string",
	varchar: "string",
	"character varying": "string",
	nvarchar: "string",
	text: "string",
	timestamptz: "timestamp",
	"timestamp without time zone": "timestamp",
	"timestamp with time zone": "timestamp",
	timetz: "time",
	varbyte: "binary",
	varbinary: "binary",
};

export function redshiftParseType(text: string): Type {
	return parseType(text, REDSHIFT_ALIASES);
}

/** Doc-cited starter set of common Redshift scalar/aggregate functions. Grows over time;
 *  anything absent yields `unknown` (never a wrong type). Modeled on FUNCTION_RETURNS. */
export const REDSHIFT_FUNCTION_RETURNS: Record<string, FnRule> = {
	// string
	upper: () => scalar("string"),
	lower: () => scalar("string"),
	trim: () => scalar("string"),
	btrim: () => scalar("string"),
	lpad: () => scalar("string"),
	rpad: () => scalar("string"),
	substring: () => scalar("string"),
	left: () => scalar("string"),
	right: () => scalar("string"),
	replace: () => scalar("string"),
	concat: () => scalar("string"),
	to_char: () => scalar("string"),
	// numeric / position
	length: () => scalar("int"),
	len: () => scalar("int"),
	char_length: () => scalar("int"),
	strpos: () => scalar("int"),
	position: () => scalar("int"),
	// date/time
	to_date: () => scalar("date"),
	to_timestamp: () => scalar("timestamp"),
	current_date: () => scalar("date"),
	sysdate: () => scalar("timestamp"),
	getdate: () => scalar("timestamp"),
	current_timestamp: () => scalar("timestamp"),
	// passthrough / aggregate
	coalesce: (args) => args.find((a) => a.kind !== "unknown") ?? UNKNOWN,
	nvl: (args) => args.find((a) => a.kind !== "unknown") ?? UNKNOWN,
	abs: (args) => args[0] ?? UNKNOWN,
	count: () => scalar("bigint"),
};
