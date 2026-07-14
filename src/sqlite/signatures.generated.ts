// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: sqlite.org  sqlite/docs/syntax/<page-slug>/N.txt (one call phrase per file, captured by tools/capture-sqlite-syntax.mjs)
// Overrides source: tools/signature-overrides/sqlite.mjs
// Built 2026-07-14. 123 names (11 curated, 112 harvested), 1 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for sqlite: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const SQLITE_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "abs", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/1.txt
	acos: [{ name: "acos", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/1.txt
	acosh: [{ name: "acosh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/2.txt
	asin: [{ name: "asin", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/3.txt
	asinh: [{ name: "asinh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/4.txt
	atan: [{ name: "atan", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/5.txt
	atan2: [{ name: "atan2", params: [{ name: "Y" }, { name: "X" }], origin: "harvested" }], // lang_mathfunc/6.txt
	atanh: [{ name: "atanh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/7.txt
	avg: [{ name: "avg", params: [{ name: "X" }], origin: "harvested" }], // lang_aggfunc/1.txt
	ceil: [{ name: "ceil", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/8.txt
	ceiling: [{ name: "ceiling", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/9.txt
	changes: [{ name: "changes", params: [], origin: "harvested" }], // lang_corefunc/2.txt
	coalesce: [{ name: "coalesce", params: [{ name: "X" }, { name: "Y" }], variadic: true, origin: "harvested" }], // lang_corefunc/4.txt
	concat: [{ name: "concat", params: [{ name: "X" }], variadic: true, origin: "harvested" }], // lang_corefunc/5.txt
	concat_ws: [{ name: "concat_ws", params: [{ name: "SEP" }, { name: "X" }], variadic: true, origin: "harvested" }], // lang_corefunc/6.txt
	cos: [{ name: "cos", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/10.txt
	cosh: [{ name: "cosh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/11.txt
	count: [{ name: "count", params: [{ name: "X" }], origin: "harvested" }], // lang_aggfunc/3.txt
	cume_dist: [{ name: "cume_dist", params: [], origin: "harvested" }], // windowfunctions/5.txt
	date: [
		{
			name: "date",
			params: [
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: date(time-value, modifier, ...)
	datetime: [
		{
			name: "datetime",
			params: [
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: datetime(time-value, modifier, ...)
	degrees: [{ name: "degrees", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/12.txt
	dense_rank: [{ name: "dense_rank", params: [], origin: "harvested" }], // windowfunctions/3.txt
	exp: [{ name: "exp", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/13.txt
	first_value: [{ name: "first_value", params: [{ name: "expr" }], origin: "harvested" }], // windowfunctions/13.txt
	floor: [{ name: "floor", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/14.txt
	format: [{ name: "format", params: [{ name: "FORMAT" }], variadic: true, origin: "harvested" }], // lang_corefunc/7.txt
	glob: [
		{
			name: "glob",
			params: [
				{ name: "pattern", type: "text" },
				{ name: "string", type: "text" },
			],
			origin: "curated",
		},
	], // curated: glob(X,Y) ("Y GLOB X")
	group_concat: [
		{ name: "group_concat", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" },
	], // lang_aggfunc/5.txt
	hex: [{ name: "hex", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/9.txt
	if: [{ name: "if", params: [{ name: "B1" }, { name: "V1" }], variadic: true, origin: "harvested" }], // lang_corefunc/10.txt
	ifnull: [{ name: "ifnull", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_corefunc/11.txt
	iif: [
		{
			name: "iif",
			params: [{ name: "condition", type: "boolean" }, { name: "true_value" }, { name: "false_value" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: iif(B1,V1,B2,V2,...,else)
	instr: [{ name: "instr", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_corefunc/13.txt
	json: [{ name: "json", params: [{ name: "X" }], origin: "harvested" }], // json1/1.txt
	json_array_length: [
		{ name: "json_array_length", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" },
	], // json1/4.txt
	json_each: [{ name: "json_each", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" }], // json1/20.txt
	json_error_position: [{ name: "json_error_position", params: [{ name: "X" }], origin: "harvested" }], // json1/5.txt
	json_extract: [
		{
			name: "json_extract",
			params: [{ name: "X" }, { name: "P1" }, { name: "P2" }],
			variadic: true,
			origin: "harvested",
		},
	], // json1/6.txt
	json_group_array: [{ name: "json_group_array", params: [{ name: "X" }], origin: "harvested" }], // json1/14.txt
	json_group_object: [
		{ name: "json_group_object", params: [{ name: "NAME" }, { name: "VALUE" }], origin: "harvested" },
	], // json1/15.txt
	json_patch: [{ name: "json_patch", params: [{ name: "T" }, { name: "P" }], origin: "harvested" }], // json1/7.txt
	json_quote: [{ name: "json_quote", params: [{ name: "X" }], origin: "harvested" }], // json1/13.txt
	json_remove: [
		{
			name: "json_remove",
			params: [{ name: "X" }, { name: "P", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // json1/8.txt
	json_tree: [{ name: "json_tree", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" }], // json1/22.txt
	json_type: [{ name: "json_type", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" }], // json1/11.txt
	json_valid: [{ name: "json_valid", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // json1/12.txt
	jsonb: [{ name: "jsonb", params: [{ name: "X" }], origin: "harvested" }], // json1/2.txt
	jsonb_each: [{ name: "jsonb_each", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" }], // json1/21.txt
	jsonb_tree: [{ name: "jsonb_tree", params: [{ name: "X" }, { name: "P", optional: true }], origin: "harvested" }], // json1/23.txt
	julianday: [
		{
			name: "julianday",
			params: [
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: julianday(time-value, modifier, ...)
	lag: [
		{
			name: "lag",
			params: [{ name: "expr" }, { name: "offset", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // windowfunctions/9.txt
	last_insert_rowid: [{ name: "last_insert_rowid", params: [], origin: "harvested" }], // lang_corefunc/14.txt
	last_value: [{ name: "last_value", params: [{ name: "expr" }], origin: "harvested" }], // windowfunctions/14.txt
	lead: [
		{
			name: "lead",
			params: [{ name: "expr" }, { name: "offset", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // windowfunctions/12.txt
	length: [{ name: "length", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/15.txt
	like: [
		{
			name: "like",
			params: [
				{ name: "pattern", type: "text" },
				{ name: "string", type: "text" },
				{ name: "escape", type: "text", optional: true },
			],
			origin: "curated",
		},
	], // curated: like(X,Y[,Z]) ("Y LIKE X [ESCAPE Z]")
	likelihood: [{ name: "likelihood", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_corefunc/18.txt
	likely: [{ name: "likely", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/19.txt
	ln: [{ name: "ln", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/15.txt
	load_extension: [
		{ name: "load_extension", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" },
	], // lang_corefunc/21.txt
	log: [
		{ name: "log", params: [{ name: "B" }, { name: "X" }], origin: "harvested" },
		{ name: "log", params: [{ name: "X" }], origin: "harvested" },
	], // lang_mathfunc/16.txt, lang_mathfunc/17.txt
	log10: [{ name: "log10", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/18.txt
	log2: [{ name: "log2", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/19.txt
	lower: [{ name: "lower", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/22.txt
	ltrim: [{ name: "ltrim", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" }], // lang_corefunc/24.txt
	max: [{ name: "max", params: [{ name: "X" }, { name: "Y", optional: true }], variadic: true, origin: "harvested" }], // lang_corefunc/25.txt
	median: [{ name: "median", params: [{ name: "X" }], origin: "harvested" }], // lang_aggfunc/7.txt
	min: [{ name: "min", params: [{ name: "X" }, { name: "Y", optional: true }], variadic: true, origin: "harvested" }], // lang_corefunc/26.txt
	mod: [{ name: "mod", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_mathfunc/20.txt
	nth_value: [{ name: "nth_value", params: [{ name: "expr" }, { name: "N" }], origin: "harvested" }], // windowfunctions/15.txt
	ntile: [{ name: "ntile", params: [{ name: "N" }], origin: "harvested" }], // windowfunctions/6.txt
	nullif: [{ name: "nullif", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_corefunc/27.txt
	octet_length: [{ name: "octet_length", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/28.txt
	percent_rank: [{ name: "percent_rank", params: [], origin: "harvested" }], // windowfunctions/4.txt
	percentile: [{ name: "percentile", params: [{ name: "Y" }, { name: "P" }], origin: "harvested" }], // lang_aggfunc/9.txt
	percentile_cont: [{ name: "percentile_cont", params: [{ name: "Y" }, { name: "P" }], origin: "harvested" }], // lang_aggfunc/10.txt
	percentile_disc: [{ name: "percentile_disc", params: [{ name: "Y" }, { name: "P" }], origin: "harvested" }], // lang_aggfunc/11.txt
	pi: [{ name: "pi", params: [], origin: "harvested" }], // lang_mathfunc/21.txt
	pow: [{ name: "pow", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_mathfunc/22.txt
	power: [{ name: "power", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_mathfunc/23.txt
	printf: [
		{
			name: "printf",
			params: [{ name: "format", type: "text" }, { name: "args" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: printf(FORMAT,...) - alias for format()
	quote: [{ name: "quote", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/30.txt
	radians: [{ name: "radians", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/24.txt
	random: [{ name: "random", params: [], origin: "harvested" }], // lang_corefunc/31.txt
	randomblob: [{ name: "randomblob", params: [{ name: "N" }], origin: "harvested" }], // lang_corefunc/32.txt
	rank: [{ name: "rank", params: [], origin: "harvested" }], // windowfunctions/2.txt
	replace: [{ name: "replace", params: [{ name: "X" }, { name: "Y" }, { name: "Z" }], origin: "harvested" }], // lang_corefunc/33.txt
	round: [{ name: "round", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" }], // lang_corefunc/35.txt
	row_number: [{ name: "row_number", params: [], origin: "harvested" }], // windowfunctions/1.txt
	rtrim: [{ name: "rtrim", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" }], // lang_corefunc/37.txt
	sign: [{ name: "sign", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/38.txt
	sin: [{ name: "sin", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/25.txt
	sinh: [{ name: "sinh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/26.txt
	soundex: [{ name: "soundex", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/39.txt
	sqlite_compileoption_get: [{ name: "sqlite_compileoption_get", params: [{ name: "N" }], origin: "harvested" }], // lang_corefunc/40.txt
	sqlite_compileoption_used: [{ name: "sqlite_compileoption_used", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/41.txt
	sqlite_offset: [{ name: "sqlite_offset", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/42.txt
	sqlite_source_id: [{ name: "sqlite_source_id", params: [], origin: "harvested" }], // lang_corefunc/43.txt
	sqlite_version: [{ name: "sqlite_version", params: [], origin: "harvested" }], // lang_corefunc/44.txt
	sqrt: [{ name: "sqrt", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/27.txt
	strftime: [
		{
			name: "strftime",
			params: [
				{ name: "format", type: "text" },
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: strftime(format, time-value, modifier, ...)
	string_agg: [{ name: "string_agg", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // lang_aggfunc/12.txt
	substr: [
		{ name: "substr", params: [{ name: "X" }, { name: "Y" }, { name: "Z", optional: true }], origin: "harvested" },
	], // lang_corefunc/46.txt
	substring: [
		{
			name: "substring",
			params: [{ name: "X" }, { name: "Y" }, { name: "Z", optional: true }],
			origin: "harvested",
		},
	], // lang_corefunc/48.txt
	sum: [{ name: "sum", params: [{ name: "X" }], origin: "harvested" }], // lang_aggfunc/13.txt
	tan: [{ name: "tan", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/28.txt
	tanh: [{ name: "tanh", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/29.txt
	time: [
		{
			name: "time",
			params: [
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: time(time-value, modifier, ...)
	timediff: [
		{
			name: "timediff",
			params: [
				{ name: "time_value_1", type: "text" },
				{ name: "time_value_2", type: "text" },
			],
			origin: "curated",
		},
	], // curated: timediff(time-value-1, time-value-2)
	total: [{ name: "total", params: [{ name: "X" }], origin: "harvested" }], // lang_aggfunc/14.txt
	total_changes: [{ name: "total_changes", params: [], origin: "harvested" }], // lang_corefunc/49.txt
	trim: [{ name: "trim", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" }], // lang_corefunc/51.txt
	trunc: [{ name: "trunc", params: [{ name: "X" }], origin: "harvested" }], // lang_mathfunc/30.txt
	typeof: [{ name: "typeof", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/52.txt
	unhex: [{ name: "unhex", params: [{ name: "X" }, { name: "Y", optional: true }], origin: "harvested" }], // lang_corefunc/54.txt
	unicode: [{ name: "unicode", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/55.txt
	unistr: [{ name: "unistr", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/56.txt
	unistr_quote: [{ name: "unistr_quote", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/57.txt
	unixepoch: [
		{
			name: "unixepoch",
			params: [
				{ name: "time_value", type: "text" },
				{ name: "modifier", type: "text" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: unixepoch(time-value, modifier, ...)
	unlikely: [{ name: "unlikely", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/58.txt
	upper: [{ name: "upper", params: [{ name: "X" }], origin: "harvested" }], // lang_corefunc/59.txt
	zeroblob: [{ name: "zeroblob", params: [{ name: "N" }], origin: "harvested" }], // lang_corefunc/60.txt
};
