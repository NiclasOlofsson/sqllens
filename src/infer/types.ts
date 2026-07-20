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
export function parseType(
	text: string,
	aliases: Record<string, string> = SCALAR_ALIASES,
	foldField?: (name: string) => string,
): Type {
	const s = text.trim();
	if (s === "") return UNKNOWN;

	const array = /^array\s*<(.*)>$/is.exec(s);
	if (array) return { kind: "array", element: parseType(array[1], undefined, foldField) };

	const map = /^map\s*<(.*)>$/is.exec(s);
	if (map) {
		const [key, value] = splitTopLevel(map[1]);
		return {
			kind: "map",
			key: parseType(key ?? "", undefined, foldField),
			value: parseType(value ?? "", undefined, foldField),
		};
	}

	const struct = /^struct\s*<(.*)>$/is.exec(s);
	if (struct) {
		const fields: StructField[] = [];
		for (const part of splitTopLevel(struct[1])) {
			const colon = topLevelColon(part);
			if (colon < 0) continue;
			const raw = part.slice(0, colon).trim();
			const name = foldField ? foldField(raw) : raw;
			if (name) {
				fields.push({
					name,
					type: parseType(stripComment(part.slice(colon + 1).trim()), undefined, foldField),
				});
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
	// Both spellings: DDL schema strings keep their spaces; a CAST's typeText arrives
	// whitespace-stripped (ANTLR getText() concatenates tokens).
	"time without time zone": "time",
	timewithouttimezone: "time",
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
	// Databricks/Spark qualified ANSI intervals: a CAST's typeText arrives whitespace-stripped
	// (`intervaldaytosecond`), a DDL/schema string keeps its spaces (`interval day to second`).
	// Canonicalize both to the one spelling `interval <from>[ to <to>]`, matching the literal path,
	// so the same interval type has one name everywhere. Only for the databricks/default table —
	// other dialects keep their own interval handling untouched.
	if (aliases === SCALAR_ALIASES && (n === "interval" || n.startsWith("interval"))) {
		const iv = canonicalIntervalName(n);
		if (iv) return iv;
	}
	return aliases[n] ?? n;
}

// --- ANSI interval families (Spark/Databricks) -----------------------------------------------
// Spark models two qualified interval types (sql-ref-datatypes.html): YEAR-MONTH (fields
// year < month) and DAY-TIME (day < hour < minute < second). A qualified scalar name is
// "interval <field>" or "interval <from> to <to>"; bare "interval" is the family-less fallback.
const IV_FAMILIES: readonly (readonly string[])[] = [
	["year", "month"],
	["day", "hour", "minute", "second"],
];

/** Whether a scalar name is any interval-family name (bare or qualified). */
export function isIntervalName(name: string): boolean {
	return name === "interval" || name.startsWith("interval ");
}

/** The (family fields, lo, hi) span of a QUALIFIED interval name; undefined for bare "interval"
 *  and non-interval names. */
export function intervalSpan(name: string): { fields: readonly string[]; lo: number; hi: number } | undefined {
	if (!name.startsWith("interval ")) return undefined;
	const [from, to] = name.slice("interval ".length).split(" to ");
	for (const fields of IV_FAMILIES) {
		const lo = fields.indexOf(from);
		const hi = fields.indexOf(to ?? from);
		if (lo >= 0 && hi >= 0) return { fields, lo, hi };
	}
	return undefined;
}

/** Build a qualified-interval scalar Type from a family's field list and a lo..hi field range. */
export function intervalTypeOf(fields: readonly string[], lo: number, hi: number): Type {
	return { kind: "scalar", name: lo === hi ? `interval ${fields[lo]}` : `interval ${fields[lo]} to ${fields[hi]}` };
}

/** Canonicalize an interval TYPE-qualifier spelling (from a CAST typeText or DDL string) to
 *  `interval <from>[ to <to>]`. Type qualifiers use only the six field words (no week/millisecond,
 *  no plural), so scanning for them and taking the field range is exact. `interval` with no field
 *  word stays bare. undefined when the base is not an interval spelling at all. */
function canonicalIntervalName(base: string): string | undefined {
	if (base !== "interval" && !base.startsWith("interval")) return undefined;
	let family: number | undefined;
	let lo = Number.POSITIVE_INFINITY;
	let hi = Number.NEGATIVE_INFINITY;
	for (const m of base.matchAll(/year|month|day|hour|minute|second/g)) {
		for (let f = 0; f < IV_FAMILIES.length; f++) {
			const idx = IV_FAMILIES[f].indexOf(m[0]);
			if (idx < 0) continue;
			if (family === undefined) family = f;
			else if (family !== f) return "interval"; // mixed families — not a valid qualifier
			lo = Math.min(lo, idx);
			hi = Math.max(hi, idx);
		}
	}
	if (family === undefined) return "interval";
	return lo === hi
		? `interval ${IV_FAMILIES[family][lo]}`
		: `interval ${IV_FAMILIES[family][lo]} to ${IV_FAMILIES[family][hi]}`;
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
