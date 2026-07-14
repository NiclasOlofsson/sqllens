// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// No offline docs-syntax source in the corpus repo yet for mysql - curated overrides only.
// Overrides source: tools/signature-overrides/mysql.mjs
// Built 2026-07-14. 46 names (46 curated, 0 harvested), 0 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for mysql: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const MYSQL_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "ABS", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: ABS(X)
	cast: [{ name: "CAST", params: [{ name: "expr" }, { name: "type" }], origin: "curated" }], // curated: CAST(expr AS type)
	ceil: [{ name: "CEIL", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: CEIL(X) - documented synonym of CEILING
	ceiling: [{ name: "CEILING", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: CEILING(X)
	coalesce: [{ name: "COALESCE", params: [{ name: "value" }], variadic: true, origin: "curated" }], // curated: COALESCE(value,...)
	concat: [{ name: "CONCAT", params: [{ name: "str", type: "string" }], variadic: true, origin: "curated" }], // curated: CONCAT(str1,str2,...)
	concat_ws: [
		{
			name: "CONCAT_WS",
			params: [
				{ name: "separator", type: "string" },
				{ name: "str", type: "string" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: CONCAT_WS(separator,str1,str2,...)
	convert: [{ name: "CONVERT", params: [{ name: "expr" }, { name: "type" }], origin: "curated" }], // curated: CONVERT(expr,type)
	date_add: [
		{
			name: "DATE_ADD",
			params: [
				{ name: "date", type: "date" },
				{ name: "expr", type: "interval" },
			],
			origin: "curated",
		},
	], // curated: DATE_ADD(date, INTERVAL expr unit)
	date_format: [
		{
			name: "DATE_FORMAT",
			params: [
				{ name: "date", type: "date" },
				{ name: "format", type: "string" },
			],
			origin: "curated",
		},
	], // curated: DATE_FORMAT(date,format)
	date_sub: [
		{
			name: "DATE_SUB",
			params: [
				{ name: "date", type: "date" },
				{ name: "expr", type: "interval" },
			],
			origin: "curated",
		},
	], // curated: DATE_SUB(date, INTERVAL expr unit)
	datediff: [
		{
			name: "DATEDIFF",
			params: [
				{ name: "expr1", type: "date" },
				{ name: "expr2", type: "date" },
			],
			origin: "curated",
		},
	], // curated: DATEDIFF(expr1,expr2)
	field: [
		{
			name: "FIELD",
			params: [
				{ name: "str", type: "string" },
				{ name: "str1", type: "string" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: FIELD(str,str1,str2,str3,...)
	floor: [{ name: "FLOOR", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: FLOOR(X)
	format: [
		{
			name: "FORMAT",
			params: [
				{ name: "X", type: "numeric" },
				{ name: "D", type: "int" },
				{ name: "locale", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: FORMAT(X,D[,locale])
	greatest: [
		{ name: "GREATEST", params: [{ name: "value1" }, { name: "value2" }], variadic: true, origin: "curated" },
	], // curated: GREATEST(value1,value2,...)
	hex: [{ name: "HEX", params: [{ name: "N_or_str" }], origin: "curated" }], // curated: HEX(N) numeric form / HEX(str) string form - polymorphic
	if: [
		{
			name: "IF",
			params: [{ name: "expr1", type: "boolean" }, { name: "expr2" }, { name: "expr3" }],
			origin: "curated",
		},
	], // curated: IF(expr1,expr2,expr3)
	ifnull: [{ name: "IFNULL", params: [{ name: "expr1" }, { name: "expr2" }], origin: "curated" }], // curated: IFNULL(expr1,expr2)
	insert: [
		{
			name: "INSERT",
			params: [
				{ name: "str", type: "string" },
				{ name: "pos", type: "int" },
				{ name: "len", type: "int" },
				{ name: "newstr", type: "string" },
			],
			origin: "curated",
		},
	], // curated: INSERT(str,pos,len,newstr)
	instr: [
		{
			name: "INSTR",
			params: [
				{ name: "str", type: "string" },
				{ name: "substr", type: "string" },
			],
			origin: "curated",
		},
	], // curated: INSTR(str,substr)
	json_contains: [
		{
			name: "JSON_CONTAINS",
			params: [
				{ name: "target", type: "json" },
				{ name: "candidate", type: "json" },
				{ name: "path", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: JSON_CONTAINS(target,candidate[,path])
	json_extract: [
		{
			name: "JSON_EXTRACT",
			params: [
				{ name: "json_doc", type: "json" },
				{ name: "path", type: "string" },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: JSON_EXTRACT(json_doc,path[,path]...)
	json_keys: [
		{
			name: "JSON_KEYS",
			params: [
				{ name: "json_doc", type: "json" },
				{ name: "path", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: JSON_KEYS(json_doc[,path])
	least: [{ name: "LEAST", params: [{ name: "value1" }, { name: "value2" }], variadic: true, origin: "curated" }], // curated: LEAST(value1,value2,...)
	left: [
		{
			name: "LEFT",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
			],
			origin: "curated",
		},
	], // curated: LEFT(str,len)
	locate: [
		{
			name: "LOCATE",
			params: [
				{ name: "substr", type: "string" },
				{ name: "str", type: "string" },
				{ name: "pos", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: LOCATE(substr,str[,pos])
	lpad: [
		{
			name: "LPAD",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
				{ name: "padstr", type: "string" },
			],
			origin: "curated",
		},
	], // curated: LPAD(str,len,padstr)
	mod: [
		{
			name: "MOD",
			params: [
				{ name: "N", type: "numeric" },
				{ name: "M", type: "numeric" },
			],
			origin: "curated",
		},
	], // curated: MOD(N,M)
	nullif: [{ name: "NULLIF", params: [{ name: "expr1" }, { name: "expr2" }], origin: "curated" }], // curated: NULLIF(expr1,expr2)
	pow: [
		{
			name: "POW",
			params: [
				{ name: "X", type: "double" },
				{ name: "Y", type: "double" },
			],
			origin: "curated",
		},
	], // curated: POW(X,Y)
	power: [
		{
			name: "POWER",
			params: [
				{ name: "X", type: "double" },
				{ name: "Y", type: "double" },
			],
			origin: "curated",
		},
	], // curated: POWER(X,Y) - documented synonym of POW
	rand: [{ name: "RAND", params: [{ name: "N", type: "int", optional: true }], origin: "curated" }], // curated: RAND([N])
	repeat: [
		{
			name: "REPEAT",
			params: [
				{ name: "str", type: "string" },
				{ name: "count", type: "int" },
			],
			origin: "curated",
		},
	], // curated: REPEAT(str,count)
	replace: [
		{
			name: "REPLACE",
			params: [
				{ name: "str", type: "string" },
				{ name: "from_str", type: "string" },
				{ name: "to_str", type: "string" },
			],
			origin: "curated",
		},
	], // curated: REPLACE(str,from_str,to_str)
	right: [
		{
			name: "RIGHT",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
			],
			origin: "curated",
		},
	], // curated: RIGHT(str,len)
	round: [
		{
			name: "ROUND",
			params: [
				{ name: "X", type: "numeric" },
				{ name: "D", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: ROUND(X) / ROUND(X,D)
	rpad: [
		{
			name: "RPAD",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
				{ name: "padstr", type: "string" },
			],
			origin: "curated",
		},
	], // curated: RPAD(str,len,padstr)
	sign: [{ name: "SIGN", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: SIGN(X)
	sqrt: [{ name: "SQRT", params: [{ name: "X", type: "numeric" }], origin: "curated" }], // curated: SQRT(X)
	str_to_date: [
		{
			name: "STR_TO_DATE",
			params: [
				{ name: "str", type: "string" },
				{ name: "format", type: "string" },
			],
			origin: "curated",
		},
	], // curated: STR_TO_DATE(str,format)
	strcmp: [
		{
			name: "STRCMP",
			params: [
				{ name: "str1", type: "string" },
				{ name: "str2", type: "string" },
			],
			origin: "curated",
		},
	], // curated: STRCMP(str1,str2)
	substr: [
		{
			name: "SUBSTR",
			params: [
				{ name: "str", type: "string" },
				{ name: "pos", type: "int" },
				{ name: "len", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: SUBSTR(str,pos[,len]) - documented synonym of SUBSTRING
	substring: [
		{
			name: "SUBSTRING",
			params: [
				{ name: "str", type: "string" },
				{ name: "pos", type: "int" },
				{ name: "len", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: SUBSTRING(str,pos[,len])
	substring_index: [
		{
			name: "SUBSTRING_INDEX",
			params: [
				{ name: "str", type: "string" },
				{ name: "delim", type: "string" },
				{ name: "count", type: "int" },
			],
			origin: "curated",
		},
	], // curated: SUBSTRING_INDEX(str,delim,count)
	truncate: [
		{
			name: "TRUNCATE",
			params: [
				{ name: "X", type: "numeric" },
				{ name: "D", type: "int" },
			],
			origin: "curated",
		},
	], // curated: TRUNCATE(X,D)
};
