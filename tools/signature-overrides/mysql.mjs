// ---------------------------------------------------------------------------
// MySQL - dev.mysql.com/doc/refman/8.4/en/, cites the function-reference page per entry. TRIM is
// deliberately NOT curated: MySQL's grammar gives it two structurally different shapes - a bare
// `TRIM(str)` (1 arg, the ordinary function-call path) and the `TRIM([{BOTH|LEADING|TRAILING}]
// [remstr] FROM str)` form (a dedicated grammar production) - the same leading-optional/reordered
// shape SQLite's module note calls out for log() as un-curatable without asserting a wrong arity
// for one form. DATE_ADD/DATE_SUB ARE curated: MySqlParser.g4's grammar folds their whole
// `INTERVAL expr unit` operand into a single expression (a dedicated `intervalExpressionAtom`), so
// the call is a genuine, arity-safe 2-argument form at the functionArgs level despite the multi-
// word SQL surface syntax.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated MYSQL table that used to live
// in src/signature/signatures.ts, into a plain-data override input for
// tools/harvest-signatures.mjs. An override wins by key over the harvest at generation time and
// is tagged origin "curated" in the emitted table; "cite" carries the original entry's doc
// citation forward into the generated table's comment.

/** @typedef {{ name: string, type?: string, optional?: boolean }} ParamSig */
/** @typedef {{ params: ParamSig[], variadic?: boolean }} OverloadSig */
/** An entry expresses either ONE shape (legacy, still the common case) or an explicit multi-overload
 *  set via `overloads` - either way it replaces the WHOLE overload set for its key. `suppress: true`
 *  drops the name entirely: no flat overload set can represent it (never guessed at). */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string } | { name: string, overloads: OverloadSig[], cite: string } | { suppress: true, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	concat: {
		name: "CONCAT",
		params: [{ name: "str", type: "string" }],
		variadic: true,
		cite: "CONCAT(str1,str2,...)",
	},
	concat_ws: {
		name: "CONCAT_WS",
		params: [
			{ name: "separator", type: "string" },
			{ name: "str", type: "string" },
		],
		variadic: true,
		cite: "CONCAT_WS(separator,str1,str2,...)",
	},
	substring: {
		name: "SUBSTRING",
		params: [
			{ name: "str", type: "string" },
			{ name: "pos", type: "int" },
			{ name: "len", type: "int", optional: true },
		],
		cite: "SUBSTRING(str,pos[,len])",
	},
	substr: {
		name: "SUBSTR",
		params: [
			{ name: "str", type: "string" },
			{ name: "pos", type: "int" },
			{ name: "len", type: "int", optional: true },
		],
		cite: "SUBSTR(str,pos[,len]) - documented synonym of SUBSTRING",
	},
	left: {
		name: "LEFT",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
		],
		cite: "LEFT(str,len)",
	},
	right: {
		name: "RIGHT",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
		],
		cite: "RIGHT(str,len)",
	},
	lpad: {
		name: "LPAD",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
			{ name: "padstr", type: "string" },
		],
		cite: "LPAD(str,len,padstr)",
	},
	rpad: {
		name: "RPAD",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
			{ name: "padstr", type: "string" },
		],
		cite: "RPAD(str,len,padstr)",
	},
	replace: {
		name: "REPLACE",
		params: [
			{ name: "str", type: "string" },
			{ name: "from_str", type: "string" },
			{ name: "to_str", type: "string" },
		],
		cite: "REPLACE(str,from_str,to_str)",
	},
	repeat: {
		name: "REPEAT",
		params: [
			{ name: "str", type: "string" },
			{ name: "count", type: "int" },
		],
		cite: "REPEAT(str,count)",
	},
	locate: {
		name: "LOCATE",
		params: [
			{ name: "substr", type: "string" },
			{ name: "str", type: "string" },
			{ name: "pos", type: "int", optional: true },
		],
		cite: "LOCATE(substr,str[,pos])",
	},
	instr: {
		name: "INSTR",
		params: [
			{ name: "str", type: "string" },
			{ name: "substr", type: "string" },
		],
		cite: "INSTR(str,substr)",
	},
	substring_index: {
		name: "SUBSTRING_INDEX",
		params: [
			{ name: "str", type: "string" },
			{ name: "delim", type: "string" },
			{ name: "count", type: "int" },
		],
		cite: "SUBSTRING_INDEX(str,delim,count)",
	},
	insert: {
		name: "INSERT",
		params: [
			{ name: "str", type: "string" },
			{ name: "pos", type: "int" },
			{ name: "len", type: "int" },
			{ name: "newstr", type: "string" },
		],
		cite: "INSERT(str,pos,len,newstr)",
	},
	strcmp: {
		name: "STRCMP",
		params: [
			{ name: "str1", type: "string" },
			{ name: "str2", type: "string" },
		],
		cite: "STRCMP(str1,str2)",
	},
	field: {
		name: "FIELD",
		params: [
			{ name: "str", type: "string" },
			{ name: "str1", type: "string" },
		],
		variadic: true,
		cite: "FIELD(str,str1,str2,str3,...)",
	},
	format: {
		name: "FORMAT",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "D", type: "int" },
			{ name: "locale", type: "string", optional: true },
		],
		cite: "FORMAT(X,D[,locale])",
	},
	hex: {
		name: "HEX",
		params: [{ name: "N_or_str" }],
		cite: "HEX(N) numeric form / HEX(str) string form - polymorphic",
	},
	// numeric - mathematical-functions.html
	round: {
		name: "ROUND",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "D", type: "int", optional: true },
		],
		cite: "ROUND(X) / ROUND(X,D)",
	},
	truncate: {
		name: "TRUNCATE",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "D", type: "int" },
		],
		cite: "TRUNCATE(X,D)",
	},
	mod: {
		name: "MOD",
		params: [
			{ name: "N", type: "numeric" },
			{ name: "M", type: "numeric" },
		],
		cite: "MOD(N,M)",
	},
	pow: {
		name: "POW",
		params: [
			{ name: "X", type: "double" },
			{ name: "Y", type: "double" },
		],
		cite: "POW(X,Y)",
	},
	power: {
		name: "POWER",
		params: [
			{ name: "X", type: "double" },
			{ name: "Y", type: "double" },
		],
		cite: "POWER(X,Y) - documented synonym of POW",
	},
	sqrt: { name: "SQRT", params: [{ name: "X", type: "numeric" }], cite: "SQRT(X)" },
	ceiling: { name: "CEILING", params: [{ name: "X", type: "numeric" }], cite: "CEILING(X)" },
	ceil: { name: "CEIL", params: [{ name: "X", type: "numeric" }], cite: "CEIL(X) - documented synonym of CEILING" },
	floor: { name: "FLOOR", params: [{ name: "X", type: "numeric" }], cite: "FLOOR(X)" },
	rand: { name: "RAND", params: [{ name: "N", type: "int", optional: true }], cite: "RAND([N])" },
	sign: { name: "SIGN", params: [{ name: "X", type: "numeric" }], cite: "SIGN(X)" },
	abs: { name: "ABS", params: [{ name: "X", type: "numeric" }], cite: "ABS(X)" },
	// date/time - date-and-time-functions.html
	date_add: {
		name: "DATE_ADD",
		params: [
			{ name: "date", type: "date" },
			{ name: "expr", type: "interval" },
		],
		cite: "DATE_ADD(date, INTERVAL expr unit)",
	},
	date_sub: {
		name: "DATE_SUB",
		params: [
			{ name: "date", type: "date" },
			{ name: "expr", type: "interval" },
		],
		cite: "DATE_SUB(date, INTERVAL expr unit)",
	},
	datediff: {
		name: "DATEDIFF",
		params: [
			{ name: "expr1", type: "date" },
			{ name: "expr2", type: "date" },
		],
		cite: "DATEDIFF(expr1,expr2)",
	},
	date_format: {
		name: "DATE_FORMAT",
		params: [
			{ name: "date", type: "date" },
			{ name: "format", type: "string" },
		],
		cite: "DATE_FORMAT(date,format)",
	},
	str_to_date: {
		name: "STR_TO_DATE",
		params: [
			{ name: "str", type: "string" },
			{ name: "format", type: "string" },
		],
		cite: "STR_TO_DATE(str,format)",
	},
	// flow control - flow-control-functions.html
	if: {
		name: "IF",
		params: [{ name: "expr1", type: "boolean" }, { name: "expr2" }, { name: "expr3" }],
		cite: "IF(expr1,expr2,expr3)",
	},
	ifnull: { name: "IFNULL", params: [{ name: "expr1" }, { name: "expr2" }], cite: "IFNULL(expr1,expr2)" },
	nullif: { name: "NULLIF", params: [{ name: "expr1" }, { name: "expr2" }], cite: "NULLIF(expr1,expr2)" },
	// comparison - comparison-operators.html
	coalesce: { name: "COALESCE", params: [{ name: "value" }], variadic: true, cite: "COALESCE(value,...)" },
	greatest: {
		name: "GREATEST",
		params: [{ name: "value1" }, { name: "value2" }],
		variadic: true,
		cite: "GREATEST(value1,value2,...)",
	},
	least: {
		name: "LEAST",
		params: [{ name: "value1" }, { name: "value2" }],
		variadic: true,
		cite: "LEAST(value1,value2,...)",
	},
	// conversion - cast-functions.html (both CAST and CONVERT lower to a `cast` IR node, not a
	// `function` call, in src/mysql/lower.ts - these entries exist purely for the signature-help
	// token-scan, never reach the arity checker)
	cast: { name: "CAST", params: [{ name: "expr" }, { name: "type" }], cite: "CAST(expr AS type)" },
	convert: { name: "CONVERT", params: [{ name: "expr" }, { name: "type" }], cite: "CONVERT(expr,type)" },
	// JSON - json-search-functions.html
	json_extract: {
		name: "JSON_EXTRACT",
		params: [
			{ name: "json_doc", type: "json" },
			{ name: "path", type: "string" },
		],
		variadic: true,
		cite: "JSON_EXTRACT(json_doc,path[,path]...)",
	},
	json_contains: {
		name: "JSON_CONTAINS",
		params: [
			{ name: "target", type: "json" },
			{ name: "candidate", type: "json" },
			{ name: "path", type: "string", optional: true },
		],
		cite: "JSON_CONTAINS(target,candidate[,path])",
	},
	json_keys: {
		name: "JSON_KEYS",
		params: [
			{ name: "json_doc", type: "json" },
			{ name: "path", type: "string", optional: true },
		],
		cite: "JSON_KEYS(json_doc[,path])",
	},
};
