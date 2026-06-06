// ---------------------------------------------------------------------------
// Type — a small structured type for inference. SQL/Databricks type strings
// (`int`, `decimal(10,2)`, `array<string>`, `struct<a:int,b:string>`) parse into
// this ADT so coercion and the function registry can compare and combine types.
// `unknown` is the bottom: anything we can't type yet (no schema, no rule).
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

/** Parse a Databricks/Spark type string into a `Type`; `unknown` if it's empty/unparseable. */
export function parseType(text: string): Type {
  const s = text.trim();
  if (s === "") return UNKNOWN;

  const array = /^array\s*<(.*)>$/is.exec(s);
  if (array) return { kind: "array", element: parseType(array[1]) };

  const map = /^map\s*<(.*)>$/is.exec(s);
  if (map) {
    const [key, value] = splitTopLevel(map[1]);
    return { kind: "map", key: parseType(key ?? ""), value: parseType(value ?? "") };
  }

  const struct = /^struct\s*<(.*)>$/is.exec(s);
  if (struct) {
    const fields: StructField[] = [];
    for (const part of splitTopLevel(struct[1])) {
      const colon = topLevelColon(part);
      if (colon < 0) continue;
      const name = unquote(part.slice(0, colon).trim());
      if (name) fields.push({ name, type: parseType(stripComment(part.slice(colon + 1).trim())) });
    }
    return { kind: "struct", fields };
  }

  // Scalar: drop precision/params (decimal(10,2), varchar(255)) and normalise the name.
  const base = s.replace(/\(.*\)$/s, "").trim().toLowerCase();
  return base === "" ? UNKNOWN : { kind: "scalar", name: normalizeScalar(base) };
}

const SCALAR_ALIASES: Record<string, string> = {
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

function normalizeScalar(name: string): string {
  const n = name.toLowerCase();
  return SCALAR_ALIASES[n] ?? n;
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

function unquote(name: string): string {
  return name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1).toLowerCase() : name.toLowerCase();
}
