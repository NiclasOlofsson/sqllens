import { UNKNOWN, type Type } from "./types.js";

// Type coercion — the algebra for combining types (operator operands, CASE branches,
// coalesce/greatest args). Numeric types widen along a precedence chain; unlike types
// don't coerce (→ unknown). `unknown` is contagious for operators but filtered for
// "common type of a list" (see commonType).

const NUMERIC_RANK: Record<string, number> = {
  tinyint: 1,
  smallint: 2,
  int: 3,
  bigint: 4,
  float: 5,
  double: 6,
  decimal: 7,
};

/** The wider of two types, or `unknown` when they don't coerce. */
export function coerce(a: Type, b: Type): Type {
  if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
  if (typeEq(a, b)) return a;
  if (a.kind === "scalar" && b.kind === "scalar") {
    const ra = NUMERIC_RANK[a.name];
    const rb = NUMERIC_RANK[b.name];
    if (ra && rb) return ra >= rb ? a : b;
  }
  return UNKNOWN;
}

/** The common type of a list (coalesce/greatest/CASE branches). Unknowns are ignored;
 *  if the known members don't coerce, the result is unknown. */
export function commonType(types: Type[]): Type {
  const known: Type[] = types.filter((t) => t.kind !== "unknown");
  if (known.length === 0) return UNKNOWN;
  return known.reduce((acc, t) => coerce(acc, t));
}

/** Aggregate widening for SUM: integers → bigint, floats → double, decimal stays decimal. */
export function widenSum(t: Type): Type {
  if (t.kind !== "scalar") return UNKNOWN;
  const rank = NUMERIC_RANK[t.name];
  if (rank !== undefined && rank <= NUMERIC_RANK.bigint) return { kind: "scalar", name: "bigint" };
  if (t.name === "float" || t.name === "double") return { kind: "scalar", name: "double" };
  if (t.name === "decimal") return { kind: "scalar", name: "decimal" };
  return UNKNOWN;
}

export function typeEq(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "scalar" && b.kind === "scalar") return a.name === b.name;
  if (a.kind === "array" && b.kind === "array") return typeEq(a.element, b.element);
  if (a.kind === "map" && b.kind === "map") return typeEq(a.key, b.key) && typeEq(a.value, b.value);
  if (a.kind === "struct" && b.kind === "struct") {
    return (
      a.fields.length === b.fields.length &&
      a.fields.every((f, i) => f.name === b.fields[i].name && typeEq(f.type, b.fields[i].type))
    );
  }
  return a.kind === "unknown"; // both unknown
}
