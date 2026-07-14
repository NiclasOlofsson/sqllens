// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// No offline docs-syntax source in the corpus repo yet for sqlite - curated overrides only.
// Overrides source: tools/signature-overrides/sqlite.mjs
// Built 2026-07-14. 39 signatures (39 curated, 0 harvested).
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for sqlite: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key), keyed by lowercased name. `origin` says which
 *  layer produced each entry. */
export const SQLITE_SIGNATURES: Record<string, FnSignature> = {
	abs: { name: "abs", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: abs(X)
	avg: { name: "avg", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: avg(X)
	coalesce: { name: "coalesce", params: [{ name: "X" }, { name: "Y" }], variadic: true, origin: "curated" }, // curated: coalesce(X,Y,...) (SQLite requires >= 2 args)
	count: { name: "count", params: [{ name: "X" }], origin: "curated" }, // curated: count(X) / count(*)
	date: { name: "date", params: [{ name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: date(time-value, modifier, ...)
	datetime: { name: "datetime", params: [{ name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: datetime(time-value, modifier, ...)
	exp: { name: "exp", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: exp(X) - lang_mathfunc.html
	glob: { name: "glob", params: [{ name: "pattern", type: "text" }, { name: "string", type: "text" }], origin: "curated" }, // curated: glob(X,Y) ("Y GLOB X")
	group_concat: { name: "group_concat", params: [{ name: "X", type: "text" }, { name: "Y", type: "text", optional: true }], origin: "curated" }, // curated: group_concat(X[,Y])
	hex: { name: "hex", params: [{ name: "X", type: "blob" }], origin: "curated" }, // curated: hex(X)
	ifnull: { name: "ifnull", params: [{ name: "X" }, { name: "Y" }], origin: "curated" }, // curated: ifnull(X,Y)
	iif: { name: "iif", params: [{ name: "condition", type: "boolean" }, { name: "true_value" }, { name: "false_value" }], variadic: true, origin: "curated" }, // curated: iif(B1,V1,B2,V2,...,else)
	instr: { name: "instr", params: [{ name: "X", type: "text" }, { name: "Y", type: "text" }], origin: "curated" }, // curated: instr(X,Y)
	julianday: { name: "julianday", params: [{ name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: julianday(time-value, modifier, ...)
	like: { name: "like", params: [{ name: "pattern", type: "text" }, { name: "string", type: "text" }, { name: "escape", type: "text", optional: true }], origin: "curated" }, // curated: like(X,Y[,Z]) ("Y LIKE X [ESCAPE Z]")
	ln: { name: "ln", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: ln(X) - lang_mathfunc.html
	ltrim: { name: "ltrim", params: [{ name: "X", type: "text" }, { name: "Y", type: "text", optional: true }], origin: "curated" }, // curated: ltrim(X,Y)
	max: { name: "max", params: [{ name: "X" }], variadic: true, origin: "curated" }, // curated: max(X) aggregate / max(X,Y,...) scalar
	min: { name: "min", params: [{ name: "X" }], variadic: true, origin: "curated" }, // curated: min(X) aggregate / min(X,Y,...) scalar
	mod: { name: "mod", params: [{ name: "X", type: "numeric" }, { name: "Y", type: "numeric" }], origin: "curated" }, // curated: mod(X,Y) - lang_mathfunc.html
	nullif: { name: "nullif", params: [{ name: "X" }, { name: "Y" }], origin: "curated" }, // curated: nullif(X,Y)
	pi: { name: "pi", params: [], origin: "curated" }, // curated: pi() - lang_mathfunc.html
	power: { name: "power", params: [{ name: "X", type: "numeric" }, { name: "Y", type: "numeric" }], origin: "curated" }, // curated: power(X,Y) - lang_mathfunc.html
	printf: { name: "printf", params: [{ name: "format", type: "text" }, { name: "args" }], variadic: true, origin: "curated" }, // curated: printf(FORMAT,...) - alias for format()
	quote: { name: "quote", params: [{ name: "X" }], origin: "curated" }, // curated: quote(X)
	replace: { name: "replace", params: [{ name: "X", type: "text" }, { name: "Y", type: "text" }, { name: "Z", type: "text" }], origin: "curated" }, // curated: replace(X,Y,Z)
	round: { name: "round", params: [{ name: "X", type: "numeric" }, { name: "Y", type: "int", optional: true }], origin: "curated" }, // curated: round(X,Y) / round(X)
	rtrim: { name: "rtrim", params: [{ name: "X", type: "text" }, { name: "Y", type: "text", optional: true }], origin: "curated" }, // curated: rtrim(X,Y)
	sign: { name: "sign", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: sign(X)
	soundex: { name: "soundex", params: [{ name: "X", type: "text" }], origin: "curated" }, // curated: soundex(X)
	sqrt: { name: "sqrt", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: sqrt(X) - lang_mathfunc.html
	strftime: { name: "strftime", params: [{ name: "format", type: "text" }, { name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: strftime(format, time-value, modifier, ...)
	substr: { name: "substr", params: [{ name: "X", type: "text" }, { name: "Y", type: "int" }, { name: "Z", type: "int", optional: true }], origin: "curated" }, // curated: substr(X,Y,Z) / substr(X,Y)
	sum: { name: "sum", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: sum(X)
	time: { name: "time", params: [{ name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: time(time-value, modifier, ...)
	timediff: { name: "timediff", params: [{ name: "time_value_1", type: "text" }, { name: "time_value_2", type: "text" }], origin: "curated" }, // curated: timediff(time-value-1, time-value-2)
	total: { name: "total", params: [{ name: "X", type: "numeric" }], origin: "curated" }, // curated: total(X)
	trim: { name: "trim", params: [{ name: "X", type: "text" }, { name: "Y", type: "text", optional: true }], origin: "curated" }, // curated: trim(X,Y)
	unixepoch: { name: "unixepoch", params: [{ name: "time_value", type: "text" }, { name: "modifier", type: "text" }], variadic: true, origin: "curated" }, // curated: unixepoch(time-value, modifier, ...)
};
