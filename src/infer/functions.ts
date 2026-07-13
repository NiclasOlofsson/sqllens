import { commonType } from "./coerce.js";
import { scalar, UNKNOWN, type Type } from "./types.js";

// Shared FnRule vocabulary: the `FnRule` type plus the dialect-agnostic builders used to assemble the
// per-dialect function return-type tables. A rule is `(argTypes) => Type`. The tables themselves are
// colocated (src/<dialect>/infer.ts); this file holds only the common building blocks they share.
//
// Why a rule is a *function* and not a fixed type string — and what each dialect calls a
// return-type-follows-input ("templated"/"polymorphic"/generic) function: docs/type-polymorphism.md.

export type FnRule = (args: Type[]) => Type;

// These FnRule builders are dialect-agnostic type-construction vocabulary (like scalar/commonType),
// shared by the colocated databricks + tsql inference modules. Exported for src/databricks/infer.ts
// and src/tsql/infer.ts; the dialect-specific tables that use them live in those folders.
export const S = scalar("string");
export const I = scalar("int");
export const BIG = scalar("bigint");
export const D = scalar("double");
export const B = scalar("boolean");
export const DATE = scalar("date");
export const TS = scalar("timestamp");
export const BIN = scalar("binary");
export const INTERVAL = scalar("interval");

export const fixed =
	(t: Type): FnRule =>
	() =>
		t;
export const firstArg: FnRule = (args) => args[0] ?? UNKNOWN; // "same type as input"
export const common: FnRule = (args) => commonType(args);
export const restCommon: FnRule = (args) => commonType(args.slice(1)); // if(cond,a,b) / nvl2(x,a,b)
export const arrayOfFirst: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });
export const arrayOfCommon: FnRule = (args) => ({ kind: "array", element: commonType(args) });
export const elementOf: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "array") return a.element;
	if (a?.kind === "map") return a.value;
	return UNKNOWN;
};
export const mapKeys: FnRule = (args) => (args[0]?.kind === "map" ? { kind: "array", element: args[0].key } : UNKNOWN);
export const mapValues: FnRule = (args) =>
	args[0]?.kind === "map" ? { kind: "array", element: args[0].value } : UNKNOWN;
export const concatRule: FnRule = (args) => (args[0]?.kind === "array" ? args[0] : S); // string|array overload
/** date_add(unit, n, ts) / dateadd / timestampadd → the date/timestamp argument's type. */
export const dateArg: FnRule = (args) => {
	const last = args[args.length - 1];
	return last?.kind === "scalar" && (last.name === "date" || last.name === "timestamp") ? last : TS;
};

export function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}
