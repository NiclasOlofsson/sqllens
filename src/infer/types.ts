// ---------------------------------------------------------------------------
// Type — a small structured type for inference. SQL/Databricks type strings
// (`int`, `decimal(10,2)`, `array<string>`, `struct<a:int,b:string>`) parse into
// this ADT so coercion and the function registry can compare and combine types.
// `unknown` is the bottom: anything we can't type yet (no schema, no rule).
//
// Struct FIELD NAMES are stored FOLDED (foldIdentifier, per the parsing dialect) — they are
// identity keys. Comparisons against a raw reference fold only the reference side; re-folding a
// stored name would corrupt a preserved-case (quoted snowflake/postgres) field.
// ---------------------------------------------------------------------------

import { foldIdentifier } from "../ident/fold.js";

export type Type =
	| { kind: "scalar"; name: string }
	| { kind: "array"; element: Type }
	| { kind: "map"; key: Type; value: Type }
	| { kind: "struct"; fields: StructField[] }
	| { kind: "unknown" };

export interface StructField {
	name: string;
	type: Type;
}

export const UNKNOWN: Type = { kind: "unknown" };

/** A scalar type by canonical name (after alias normalisation). */
export function scalar(name: string): Type {
	return { kind: "scalar", name: normalizeScalar(name) };
}

/** Parse a SQL type string into a `Type`; `unknown` if it's empty/unparseable. `aliases` maps a
 *  dialect's scalar names onto the shared canonical names (Spark by default; pass TSQL_ALIASES for
 *  T-SQL, e.g. bit→boolean, datetime→timestamp, nvarchar→string). `dialect` folds struct field
 *  names with that dialect's identifier rules (fields are stored folded — identity keys); absent,
 *  the default fold (backtick-strip + lower) reproduces the legacy behavior. */
export function parseType(text: string, aliases: Record<string, string> = SCALAR_ALIASES, dialect?: string): Type {
	const s = text.trim();
	if (s === "") return UNKNOWN;

	const array = /^array\s*<(.*)>$/is.exec(s);
	if (array) return { kind: "array", element: parseType(array[1], undefined, dialect) };

	const map = /^map\s*<(.*)>$/is.exec(s);
	if (map) {
		const [key, value] = splitTopLevel(map[1]);
		return {
			kind: "map",
			key: parseType(key ?? "", undefined, dialect),
			value: parseType(value ?? "", undefined, dialect),
		};
	}

	const struct = /^struct\s*<(.*)>$/is.exec(s);
	if (struct) {
		const fields: StructField[] = [];
		for (const part of splitTopLevel(struct[1])) {
			const colon = topLevelColon(part);
			if (colon < 0) continue;
			const name = foldIdentifier(part.slice(0, colon).trim(), dialect);
			if (name) {
				fields.push({ name, type: parseType(stripComment(part.slice(colon + 1).trim()), undefined, dialect) });
			}
		}
		return { kind: "struct", fields };
	}

	// Scalar: drop precision/params (decimal(10,2), varchar(255)) and normalise the name.
	const base = s
		.replace(/\(.*\)$/s, "")
		.trim()
		.toLowerCase();
	return base === "" ? UNKNOWN : { kind: "scalar", name: normalizeScalar(base, aliases) };
}

/** Spark/Databricks scalar type aliases → the shared canonical names (also the default table for
 *  `parseType` below). Exported so `src/dialect-symbols.ts` can build the databricks `types` set from
 *  it without duplicating the table. */
export const SCALAR_ALIASES: Record<string, string> = {
	integer: "int",
	long: "bigint",
	short: "smallint",
	byte: "tinyint",
	real: "float",
	numeric: "decimal",
	dec: "decimal",
	bool: "boolean",
	varchar: "string",
	char: "string",
	text: "string",
	timestamp_ntz: "timestamp",
	timestamp_ltz: "timestamp",
};

/** T-SQL scalar type names → the shared canonical names. T-SQL has no array/map/struct types, so
 *  only scalar normalisation differs from Spark. float is double-precision in T-SQL; real is single. */
export const TSQL_ALIASES: Record<string, string> = {
	bit: "boolean",
	integer: "int",
	numeric: "decimal",
	dec: "decimal",
	money: "decimal",
	smallmoney: "decimal",
	float: "double",
	real: "float",
	char: "string",
	varchar: "string",
	nchar: "string",
	nvarchar: "string",
	text: "string",
	ntext: "string",
	sysname: "string",
	uniqueidentifier: "string",
	datetime: "timestamp",
	datetime2: "timestamp",
	smalldatetime: "timestamp",
	datetimeoffset: "timestamp",
	binary: "binary",
	varbinary: "binary",
	image: "binary",
};

function normalizeScalar(name: string, aliases: Record<string, string> = SCALAR_ALIASES): string {
	const n = name.toLowerCase();
	return aliases[n] ?? n;
}

/** Split on commas not nested inside `<…>` or `(…)`. */
function splitTopLevel(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "<" || ch === "(") depth++;
		else if (ch === ">" || ch === ")") depth--;
		else if (ch === "," && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	out.push(s.slice(start));
	return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Index of the first `:` not nested inside `<…>` or `(…)`, or -1. */
function topLevelColon(s: string): number {
	let depth = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "<" || ch === "(") depth++;
		else if (ch === ">" || ch === ")") depth--;
		else if (ch === ":" && depth === 0) return i;
	}
	return -1;
}

function stripComment(type: string): string {
	const c = type.search(/\s+comment\s+'/i);
	return c >= 0 ? type.slice(0, c).trim() : type;
}

/** Render a Type as a display string (scalar name, array<…>, map<…,…>, struct<f:…>, unknown).
 *  Pure formatting — used by the LSP hover feature so the adapter never walks the Type union. */
export function formatType(t: Type): string {
	switch (t.kind) {
		case "scalar":
			return t.name;
		case "array":
			return `array<${formatType(t.element)}>`;
		case "map":
			return `map<${formatType(t.key)},${formatType(t.value)}>`;
		case "struct":
			return `struct<${t.fields.map((f) => `${f.name}:${formatType(f.type)}`).join(",")}>`;
		case "unknown":
			return "unknown";
	}
}
