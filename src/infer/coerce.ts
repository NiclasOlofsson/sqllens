import { intervalSpan, intervalTypeOf, isIntervalName, UNKNOWN, type Type } from "./types.js";

// Type coercion — the algebra for combining types (operator operands, CASE branches,
// coalesce/greatest args). Numeric types widen along a precedence chain; unlike types
// don't coerce (→ unknown). `unknown` is contagious for operators but filtered for
// "common type of a list" (see commonType).

// Approximate types dominate exact ones: DECIMAL widens past the integers but LOSES to
// FLOAT/DOUBLE (Spark, Postgres, T-SQL, Snowflake all promote decimal-with-approximate to
// the approximate side). The old order had decimal on top, so `2.35E10 * 1.0` claimed
// decimal where every engine answers double — caught by the Spark-goldens gate.
const NUMERIC_RANK: Record<string, number> = {
	tinyint: 1,
	smallint: 2,
	int: 3,
	bigint: 4,
	decimal: 5,
	float: 6,
	double: 7,
};

/** The wider of two types, or `unknown` when they don't coerce. */
export function coerce(a: Type, b: Type): Type {
	if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
	if (typeEq(a, b)) return a;
	if (a.kind === "scalar" && b.kind === "scalar") {
		const ra = NUMERIC_RANK[a.name];
		const rb = NUMERIC_RANK[b.name];
		if (ra && rb) return ra >= rb ? a : b;
		// Two ANSI intervals combine to the UNION of their unit ranges (interval ± interval);
		// see coerceIntervals. Only reached when the names differ (typeEq handled equals).
		if (isIntervalName(a.name) && isIntervalName(b.name)) return coerceIntervals(a.name, b.name);
	}
	return UNKNOWN;
}

// --- ANSI interval combination (Spark/Databricks) --------------------------------------------
// The interval-family vocabulary (isIntervalName / intervalSpan / intervalTypeOf / fullInterval)
// lives in types.ts; here are only the two combining rules the coercion algebra needs.

/** Whether a Type is any interval-family scalar (bare or qualified). */
export function isIntervalType(t: Type): boolean {
	return t.kind === "scalar" && isIntervalName(t.name);
}

/** The family's DEFAULT full-range interval type (Spark Multiply/DivideInterval always return
 *  year-to-month / day-to-second). Bare "interval" and non-intervals are returned unchanged. */
export function fullInterval(t: Type): Type {
	if (t.kind !== "scalar") return t;
	const s = intervalSpan(t.name);
	return s ? intervalTypeOf(s.fields, 0, s.fields.length - 1) : t;
}

/** Combine two interval-family names (interval ± interval): the UNION of their unit ranges within
 *  one family. Different families do not combine (Spark errors) → unknown; a bare operand has no
 *  family → bare interval (honest coarse). */
function coerceIntervals(a: string, b: string): Type {
	const sa = intervalSpan(a);
	const sb = intervalSpan(b);
	if (!sa || !sb) return { kind: "scalar", name: "interval" };
	if (sa.fields[0] !== sb.fields[0]) return UNKNOWN; // different families (year-month vs day-time)
	return intervalTypeOf(sa.fields, Math.min(sa.lo, sb.lo), Math.max(sa.hi, sb.hi));
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
