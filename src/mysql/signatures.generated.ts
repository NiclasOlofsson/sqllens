// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: dev.mysql.com/doc/refman/8.4  mysql/docs/syntax/<page-slug>/N.txt (one call form per line, captured by tools/capture-mysql-syntax.mjs)
// Overrides source: tools/signature-overrides/mysql.mjs
// Built 2026-07-14. 246 names (5 curated, 241 harvested), 4 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for mysql: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const MYSQL_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "ABS", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/1.txt
	acos: [{ name: "ACOS", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/2.txt
	adddate: [{ name: "ADDDATE", params: [{ name: "date" }, { name: "days" }], origin: "harvested" }], // date-and-time-functions/1.txt
	addtime: [{ name: "ADDTIME", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // date-and-time-functions/2.txt
	any_value: [{ name: "ANY_VALUE", params: [{ name: "arg" }], origin: "harvested" }], // miscellaneous-functions/1.txt
	ascii: [{ name: "ASCII", params: [{ name: "str" }], origin: "harvested" }], // string-functions/1.txt
	asin: [{ name: "ASIN", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/3.txt
	atan: [
		{ name: "ATAN", params: [{ name: "Y" }, { name: "X" }], origin: "harvested" },
		{ name: "ATAN", params: [{ name: "X" }], origin: "harvested" },
	], // mathematical-functions/5.txt, mathematical-functions/4.txt
	atan2: [{ name: "ATAN2", params: [{ name: "Y" }, { name: "X" }], origin: "harvested" }], // mathematical-functions/5.txt
	avg: [{ name: "AVG", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/1.txt
	benchmark: [{ name: "BENCHMARK", params: [{ name: "count" }, { name: "expr" }], origin: "harvested" }], // information-functions/1.txt
	bin: [{ name: "BIN", params: [{ name: "N" }], origin: "harvested" }], // string-functions/2.txt
	bin_to_uuid: [
		{
			name: "BIN_TO_UUID",
			params: [{ name: "binary_uuid" }, { name: "swap_flag", optional: true }],
			origin: "harvested",
		},
	], // miscellaneous-functions/2.txt
	bit_and: [{ name: "BIT_AND", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/2.txt
	bit_count: [{ name: "BIT_COUNT", params: [{ name: "N" }], origin: "harvested" }], // bit-functions/7.txt
	bit_length: [{ name: "BIT_LENGTH", params: [{ name: "str" }], origin: "harvested" }], // string-functions/3.txt
	bit_or: [{ name: "BIT_OR", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/3.txt
	bit_xor: [{ name: "BIT_XOR", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/4.txt
	cast: [{ name: "CAST", params: [{ name: "expr" }, { name: "type" }], origin: "curated" }], // curated: CAST(expr AS type)
	ceil: [{ name: "CEIL", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/6.txt
	ceiling: [{ name: "CEILING", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/7.txt
	char_length: [{ name: "CHAR_LENGTH", params: [{ name: "str" }], origin: "harvested" }], // string-functions/5.txt
	character_length: [{ name: "CHARACTER_LENGTH", params: [{ name: "str" }], origin: "harvested" }], // string-functions/6.txt
	charset: [{ name: "CHARSET", params: [{ name: "str" }], origin: "harvested" }], // information-functions/2.txt
	coalesce: [{ name: "COALESCE", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // comparison-operators/10.txt
	coercibility: [{ name: "COERCIBILITY", params: [{ name: "str" }], origin: "harvested" }], // information-functions/3.txt
	collation: [{ name: "COLLATION", params: [{ name: "str" }], origin: "harvested" }], // information-functions/4.txt
	compress: [{ name: "COMPRESS", params: [{ name: "string_to_compress" }], origin: "harvested" }], // encryption-functions/3.txt
	concat: [{ name: "CONCAT", params: [{ name: "str1" }, { name: "str2" }], variadic: true, origin: "harvested" }], // string-functions/7.txt
	concat_ws: [
		{
			name: "CONCAT_WS",
			params: [{ name: "separator" }, { name: "str1" }, { name: "str2" }],
			variadic: true,
			origin: "harvested",
		},
	], // string-functions/8.txt
	connection_id: [{ name: "CONNECTION_ID", params: [], origin: "harvested" }], // information-functions/5.txt
	conv: [{ name: "CONV", params: [{ name: "N" }, { name: "from_base" }, { name: "to_base" }], origin: "harvested" }], // mathematical-functions/8.txt
	convert: [{ name: "CONVERT", params: [{ name: "expr" }, { name: "type" }], origin: "harvested" }], // cast-functions/3.txt
	convert_tz: [
		{ name: "CONVERT_TZ", params: [{ name: "dt" }, { name: "from_tz" }, { name: "to_tz" }], origin: "harvested" },
	], // date-and-time-functions/3.txt
	cos: [{ name: "COS", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/9.txt
	cot: [{ name: "COT", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/10.txt
	count: [{ name: "COUNT", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/5.txt
	crc32: [{ name: "CRC32", params: [{ name: "expr" }], origin: "harvested" }], // mathematical-functions/11.txt
	cume_dist: [{ name: "CUME_DIST", params: [], origin: "harvested" }], // window-function-descriptions/1.txt
	curdate: [{ name: "CURDATE", params: [], origin: "harvested" }], // date-and-time-functions/4.txt
	current_date: [{ name: "CURRENT_DATE", params: [], origin: "harvested" }], // date-and-time-functions/5.txt
	current_role: [{ name: "CURRENT_ROLE", params: [], origin: "harvested" }], // information-functions/6.txt
	current_time: [{ name: "CURRENT_TIME", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/6.txt
	current_timestamp: [{ name: "CURRENT_TIMESTAMP", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/7.txt
	current_user: [{ name: "CURRENT_USER", params: [], origin: "harvested" }], // information-functions/7.txt
	curtime: [{ name: "CURTIME", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/8.txt
	database: [{ name: "DATABASE", params: [], origin: "harvested" }], // information-functions/8.txt
	date: [{ name: "DATE", params: [{ name: "expr" }], origin: "harvested" }], // date-and-time-functions/9.txt
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
	date_format: [{ name: "DATE_FORMAT", params: [{ name: "date" }, { name: "format" }], origin: "harvested" }], // date-and-time-functions/12.txt
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
	datediff: [{ name: "DATEDIFF", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // date-and-time-functions/10.txt
	day: [{ name: "DAY", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/14.txt
	dayname: [{ name: "DAYNAME", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/15.txt
	dayofmonth: [{ name: "DAYOFMONTH", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/16.txt
	dayofweek: [{ name: "DAYOFWEEK", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/17.txt
	dayofyear: [{ name: "DAYOFYEAR", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/18.txt
	default: [{ name: "DEFAULT", params: [{ name: "col_name" }], origin: "harvested" }], // miscellaneous-functions/3.txt
	degrees: [{ name: "DEGREES", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/12.txt
	dense_rank: [{ name: "DENSE_RANK", params: [], origin: "harvested" }], // window-function-descriptions/2.txt
	elt: [
		{
			name: "ELT",
			params: [{ name: "N" }, { name: "str1" }, { name: "str2" }, { name: "str3" }],
			variadic: true,
			origin: "harvested",
		},
	], // string-functions/9.txt
	exp: [{ name: "EXP", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/13.txt
	export_set: [
		{
			name: "EXPORT_SET",
			params: [
				{ name: "bits" },
				{ name: "on" },
				{ name: "off" },
				{ name: "separator", optional: true },
				{ name: "number_of_bits", optional: true },
			],
			origin: "harvested",
		},
	], // string-functions/10.txt
	field: [
		{
			name: "FIELD",
			params: [{ name: "str" }, { name: "str1" }, { name: "str2" }, { name: "str3" }],
			variadic: true,
			origin: "harvested",
		},
	], // string-functions/11.txt
	find_in_set: [{ name: "FIND_IN_SET", params: [{ name: "str" }, { name: "strlist" }], origin: "harvested" }], // string-functions/12.txt
	first_value: [{ name: "FIRST_VALUE", params: [{ name: "expr" }], origin: "harvested" }], // window-function-descriptions/3.txt
	floor: [{ name: "FLOOR", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/14.txt
	format: [
		{
			name: "FORMAT",
			params: [{ name: "X" }, { name: "D" }, { name: "locale", optional: true }],
			origin: "harvested",
		},
	], // string-functions/13.txt
	found_rows: [{ name: "FOUND_ROWS", params: [], origin: "harvested" }], // information-functions/9.txt
	from_base64: [{ name: "FROM_BASE64", params: [{ name: "str" }], origin: "harvested" }], // string-functions/14.txt
	from_days: [{ name: "FROM_DAYS", params: [{ name: "N" }], origin: "harvested" }], // date-and-time-functions/20.txt
	from_unixtime: [
		{
			name: "FROM_UNIXTIME",
			params: [{ name: "unix_timestamp" }, { name: "format", optional: true }],
			origin: "harvested",
		},
	], // date-and-time-functions/21.txt
	get_lock: [{ name: "GET_LOCK", params: [{ name: "str" }, { name: "timeout" }], origin: "harvested" }], // locking-functions/1.txt
	greatest: [
		{ name: "GREATEST", params: [{ name: "value1" }, { name: "value2" }], variadic: true, origin: "harvested" },
	], // comparison-operators/13.txt
	group_concat: [{ name: "GROUP_CONCAT", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/7.txt
	hex: [
		{ name: "HEX", params: [{ name: "str" }], origin: "harvested" },
		{ name: "HEX", params: [{ name: "N" }], origin: "harvested" },
	], // string-functions/15.txt
	hour: [{ name: "HOUR", params: [{ name: "time" }], origin: "harvested" }], // date-and-time-functions/23.txt
	icu_version: [{ name: "ICU_VERSION", params: [], origin: "harvested" }], // information-functions/10.txt
	if: [{ name: "IF", params: [{ name: "expr1" }, { name: "expr2" }, { name: "expr3" }], origin: "harvested" }], // flow-control-functions/2.txt
	ifnull: [{ name: "IFNULL", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // flow-control-functions/3.txt
	inet6_aton: [{ name: "INET6_ATON", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/7.txt
	inet6_ntoa: [{ name: "INET6_NTOA", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/8.txt
	inet_aton: [{ name: "INET_ATON", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/5.txt
	inet_ntoa: [{ name: "INET_NTOA", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/6.txt
	insert: [
		{
			name: "INSERT",
			params: [{ name: "str" }, { name: "pos" }, { name: "len" }, { name: "newstr" }],
			origin: "harvested",
		},
	], // string-functions/16.txt
	instr: [{ name: "INSTR", params: [{ name: "str" }, { name: "substr" }], origin: "harvested" }], // string-functions/17.txt
	interval: [
		{
			name: "INTERVAL",
			params: [{ name: "N" }, { name: "N1" }, { name: "N2" }, { name: "N3" }],
			variadic: true,
			origin: "harvested",
		},
	], // comparison-operators/16.txt
	is_free_lock: [{ name: "IS_FREE_LOCK", params: [{ name: "str" }], origin: "harvested" }], // locking-functions/2.txt
	is_ipv4: [{ name: "IS_IPV4", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/9.txt
	is_ipv4_compat: [{ name: "IS_IPV4_COMPAT", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/10.txt
	is_ipv4_mapped: [{ name: "IS_IPV4_MAPPED", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/11.txt
	is_ipv6: [{ name: "IS_IPV6", params: [{ name: "expr" }], origin: "harvested" }], // miscellaneous-functions/12.txt
	is_used_lock: [{ name: "IS_USED_LOCK", params: [{ name: "str" }], origin: "harvested" }], // locking-functions/3.txt
	is_uuid: [{ name: "IS_UUID", params: [{ name: "string_uuid" }], origin: "harvested" }], // miscellaneous-functions/13.txt
	isnull: [{ name: "ISNULL", params: [{ name: "expr" }], origin: "harvested" }], // comparison-operators/21.txt
	json_arrayagg: [{ name: "JSON_ARRAYAGG", params: [{ name: "col_or_expr" }], origin: "harvested" }], // aggregate-functions/8.txt
	json_contains: [
		{
			name: "JSON_CONTAINS",
			params: [{ name: "target" }, { name: "candidate" }, { name: "path", optional: true }],
			origin: "harvested",
		},
	], // json-search-functions/1.txt
	json_depth: [{ name: "JSON_DEPTH", params: [{ name: "json_doc" }], origin: "harvested" }], // json-attribute-functions/1.txt
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
		{ name: "JSON_KEYS", params: [{ name: "json_doc" }, { name: "path", optional: true }], origin: "harvested" },
	], // json-search-functions/6.txt
	json_length: [
		{ name: "JSON_LENGTH", params: [{ name: "json_doc" }, { name: "path", optional: true }], origin: "harvested" },
	], // json-attribute-functions/2.txt
	json_objectagg: [{ name: "JSON_OBJECTAGG", params: [{ name: "key" }, { name: "value" }], origin: "harvested" }], // aggregate-functions/9.txt
	json_overlaps: [
		{ name: "JSON_OVERLAPS", params: [{ name: "json_doc1" }, { name: "json_doc2" }], origin: "harvested" },
	], // json-search-functions/7.txt
	json_pretty: [{ name: "JSON_PRETTY", params: [{ name: "json_val" }], origin: "harvested" }], // json-utility-functions/1.txt
	json_quote: [{ name: "JSON_QUOTE", params: [{ name: "string" }], origin: "harvested" }], // json-creation-functions/3.txt
	json_schema_valid: [
		{ name: "JSON_SCHEMA_VALID", params: [{ name: "schema" }, { name: "document" }], origin: "harvested" },
	], // json-validation-functions/1.txt
	json_schema_validation_report: [
		{
			name: "JSON_SCHEMA_VALIDATION_REPORT",
			params: [{ name: "schema" }, { name: "document" }],
			origin: "harvested",
		},
	], // json-validation-functions/2.txt
	json_storage_free: [{ name: "JSON_STORAGE_FREE", params: [{ name: "json_val" }], origin: "harvested" }], // json-utility-functions/2.txt
	json_storage_size: [{ name: "JSON_STORAGE_SIZE", params: [{ name: "json_val" }], origin: "harvested" }], // json-utility-functions/3.txt
	json_type: [{ name: "JSON_TYPE", params: [{ name: "json_val" }], origin: "harvested" }], // json-attribute-functions/3.txt
	json_unquote: [{ name: "JSON_UNQUOTE", params: [{ name: "json_val" }], origin: "harvested" }], // json-modification-functions/10.txt
	json_valid: [{ name: "JSON_VALID", params: [{ name: "val" }], origin: "harvested" }], // json-attribute-functions/4.txt
	json_value: [{ name: "JSON_VALUE", params: [{ name: "json_doc" }, { name: "path" }], origin: "harvested" }], // json-search-functions/9.txt
	lag: [
		{
			name: "LAG",
			params: [{ name: "expr" }, { name: "N", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // window-function-descriptions/4.txt
	last_day: [{ name: "LAST_DAY", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/24.txt
	last_insert_id: [{ name: "LAST_INSERT_ID", params: [{ name: "expr", optional: true }], origin: "harvested" }], // information-functions/11.txt
	last_value: [{ name: "LAST_VALUE", params: [{ name: "expr" }], origin: "harvested" }], // window-function-descriptions/5.txt
	lcase: [{ name: "LCASE", params: [{ name: "str" }], origin: "harvested" }], // string-functions/18.txt
	lead: [
		{
			name: "LEAD",
			params: [{ name: "expr" }, { name: "N", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // window-function-descriptions/6.txt
	least: [{ name: "LEAST", params: [{ name: "value1" }, { name: "value2" }], variadic: true, origin: "harvested" }], // comparison-operators/22.txt
	left: [{ name: "LEFT", params: [{ name: "str" }, { name: "len" }], origin: "harvested" }], // string-functions/19.txt
	length: [{ name: "LENGTH", params: [{ name: "str" }], origin: "harvested" }], // string-functions/20.txt
	ln: [{ name: "LN", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/15.txt
	load_file: [{ name: "LOAD_FILE", params: [{ name: "file_name" }], origin: "harvested" }], // string-functions/21.txt
	localtime: [{ name: "LOCALTIME", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/25.txt
	localtimestamp: [{ name: "LOCALTIMESTAMP", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/26.txt
	locate: [
		{
			name: "LOCATE",
			params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }],
			origin: "harvested",
		},
	], // string-functions/22.txt
	log: [
		{ name: "LOG", params: [{ name: "B" }, { name: "X" }], origin: "harvested" },
		{ name: "LOG", params: [{ name: "X" }], origin: "harvested" },
	], // mathematical-functions/16.txt
	log10: [{ name: "LOG10", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/18.txt
	log2: [{ name: "LOG2", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/17.txt
	lower: [{ name: "LOWER", params: [{ name: "str" }], origin: "harvested" }], // string-functions/23.txt
	lpad: [{ name: "LPAD", params: [{ name: "str" }, { name: "len" }, { name: "padstr" }], origin: "harvested" }], // string-functions/24.txt
	ltrim: [{ name: "LTRIM", params: [{ name: "str" }], origin: "harvested" }], // string-functions/25.txt
	make_set: [
		{
			name: "MAKE_SET",
			params: [{ name: "bits" }, { name: "str1" }, { name: "str2" }],
			variadic: true,
			origin: "harvested",
		},
	], // string-functions/26.txt
	makedate: [{ name: "MAKEDATE", params: [{ name: "year" }, { name: "dayofyear" }], origin: "harvested" }], // date-and-time-functions/27.txt
	maketime: [
		{ name: "MAKETIME", params: [{ name: "hour" }, { name: "minute" }, { name: "second" }], origin: "harvested" },
	], // date-and-time-functions/28.txt
	max: [{ name: "MAX", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/10.txt
	md5: [{ name: "MD5", params: [{ name: "str" }], origin: "harvested" }], // encryption-functions/4.txt
	microsecond: [{ name: "MICROSECOND", params: [{ name: "expr" }], origin: "harvested" }], // date-and-time-functions/29.txt
	mid: [
		{
			name: "MID",
			params: [{ name: "str" }, { name: "pos" }, { name: "len", optional: true }],
			origin: "harvested",
		},
	], // string-functions/27.txt
	min: [{ name: "MIN", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/11.txt
	minute: [{ name: "MINUTE", params: [{ name: "time" }], origin: "harvested" }], // date-and-time-functions/30.txt
	mod: [{ name: "MOD", params: [{ name: "N" }, { name: "M" }], origin: "harvested" }], // mathematical-functions/19.txt
	month: [{ name: "MONTH", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/31.txt
	monthname: [{ name: "MONTHNAME", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/32.txt
	name_const: [{ name: "NAME_CONST", params: [{ name: "name" }, { name: "value" }], origin: "harvested" }], // miscellaneous-functions/14.txt
	now: [{ name: "NOW", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/33.txt
	nth_value: [{ name: "NTH_VALUE", params: [{ name: "expr" }, { name: "N" }], origin: "harvested" }], // window-function-descriptions/7.txt
	ntile: [{ name: "NTILE", params: [{ name: "N" }], origin: "harvested" }], // window-function-descriptions/8.txt
	nullif: [{ name: "NULLIF", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // flow-control-functions/4.txt
	oct: [{ name: "OCT", params: [{ name: "N" }], origin: "harvested" }], // string-functions/28.txt
	octet_length: [{ name: "OCTET_LENGTH", params: [{ name: "str" }], origin: "harvested" }], // string-functions/29.txt
	ord: [{ name: "ORD", params: [{ name: "str" }], origin: "harvested" }], // string-functions/30.txt
	percent_rank: [{ name: "PERCENT_RANK", params: [], origin: "harvested" }], // window-function-descriptions/9.txt
	period_add: [{ name: "PERIOD_ADD", params: [{ name: "P" }, { name: "N" }], origin: "harvested" }], // date-and-time-functions/34.txt
	period_diff: [{ name: "PERIOD_DIFF", params: [{ name: "P1" }, { name: "P2" }], origin: "harvested" }], // date-and-time-functions/35.txt
	pi: [{ name: "PI", params: [], origin: "harvested" }], // mathematical-functions/20.txt
	pow: [{ name: "POW", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // mathematical-functions/21.txt
	power: [{ name: "POWER", params: [{ name: "X" }, { name: "Y" }], origin: "harvested" }], // mathematical-functions/22.txt
	quarter: [{ name: "QUARTER", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/36.txt
	quote: [{ name: "QUOTE", params: [{ name: "str" }], origin: "harvested" }], // string-functions/32.txt
	radians: [{ name: "RADIANS", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/23.txt
	rand: [{ name: "RAND", params: [{ name: "N", optional: true }], origin: "harvested" }], // mathematical-functions/24.txt
	random_bytes: [{ name: "RANDOM_BYTES", params: [{ name: "len" }], origin: "harvested" }], // encryption-functions/5.txt
	rank: [{ name: "RANK", params: [], origin: "harvested" }], // window-function-descriptions/10.txt
	regexp_instr: [
		{
			name: "REGEXP_INSTR",
			params: [
				{ name: "expr" },
				{ name: "pat" },
				{ name: "pos", optional: true },
				{ name: "occurrence", optional: true },
				{ name: "return_option", optional: true },
				{ name: "match_type", optional: true },
			],
			origin: "harvested",
		},
	], // regexp/3.txt
	regexp_like: [
		{
			name: "REGEXP_LIKE",
			params: [{ name: "expr" }, { name: "pat" }, { name: "match_type", optional: true }],
			origin: "harvested",
		},
	], // regexp/4.txt
	regexp_replace: [
		{
			name: "REGEXP_REPLACE",
			params: [
				{ name: "expr" },
				{ name: "pat" },
				{ name: "repl" },
				{ name: "pos", optional: true },
				{ name: "occurrence", optional: true },
				{ name: "match_type", optional: true },
			],
			origin: "harvested",
		},
	], // regexp/5.txt
	regexp_substr: [
		{
			name: "REGEXP_SUBSTR",
			params: [
				{ name: "expr" },
				{ name: "pat" },
				{ name: "pos", optional: true },
				{ name: "occurrence", optional: true },
				{ name: "match_type", optional: true },
			],
			origin: "harvested",
		},
	], // regexp/6.txt
	release_all_locks: [{ name: "RELEASE_ALL_LOCKS", params: [], origin: "harvested" }], // locking-functions/4.txt
	release_lock: [{ name: "RELEASE_LOCK", params: [{ name: "str" }], origin: "harvested" }], // locking-functions/5.txt
	repeat: [{ name: "REPEAT", params: [{ name: "str" }, { name: "count" }], origin: "harvested" }], // string-functions/33.txt
	replace: [
		{ name: "REPLACE", params: [{ name: "str" }, { name: "from_str" }, { name: "to_str" }], origin: "harvested" },
	], // string-functions/34.txt
	reverse: [{ name: "REVERSE", params: [{ name: "str" }], origin: "harvested" }], // string-functions/35.txt
	right: [{ name: "RIGHT", params: [{ name: "str" }, { name: "len" }], origin: "harvested" }], // string-functions/36.txt
	roles_graphml: [{ name: "ROLES_GRAPHML", params: [], origin: "harvested" }], // information-functions/12.txt
	round: [{ name: "ROUND", params: [{ name: "X" }, { name: "D", optional: true }], origin: "harvested" }], // mathematical-functions/25.txt
	row_count: [{ name: "ROW_COUNT", params: [], origin: "harvested" }], // information-functions/13.txt
	row_number: [{ name: "ROW_NUMBER", params: [], origin: "harvested" }], // window-function-descriptions/11.txt
	rpad: [{ name: "RPAD", params: [{ name: "str" }, { name: "len" }, { name: "padstr" }], origin: "harvested" }], // string-functions/37.txt
	rtrim: [{ name: "RTRIM", params: [{ name: "str" }], origin: "harvested" }], // string-functions/38.txt
	schema: [{ name: "SCHEMA", params: [], origin: "harvested" }], // information-functions/14.txt
	sec_to_time: [{ name: "SEC_TO_TIME", params: [{ name: "seconds" }], origin: "harvested" }], // date-and-time-functions/38.txt
	second: [{ name: "SECOND", params: [{ name: "time" }], origin: "harvested" }], // date-and-time-functions/37.txt
	session_user: [{ name: "SESSION_USER", params: [], origin: "harvested" }], // information-functions/15.txt
	sha: [{ name: "SHA", params: [{ name: "str" }], origin: "harvested" }], // encryption-functions/6.txt
	sha1: [{ name: "SHA1", params: [{ name: "str" }], origin: "harvested" }], // encryption-functions/6.txt
	sha2: [{ name: "SHA2", params: [{ name: "str" }, { name: "hash_length" }], origin: "harvested" }], // encryption-functions/7.txt
	sign: [{ name: "SIGN", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/26.txt
	sin: [{ name: "SIN", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/27.txt
	sleep: [{ name: "SLEEP", params: [{ name: "duration" }], origin: "harvested" }], // miscellaneous-functions/15.txt
	soundex: [{ name: "SOUNDEX", params: [{ name: "str" }], origin: "harvested" }], // string-functions/39.txt
	space: [{ name: "SPACE", params: [{ name: "N" }], origin: "harvested" }], // string-functions/41.txt
	sqrt: [{ name: "SQRT", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/28.txt
	statement_digest: [{ name: "STATEMENT_DIGEST", params: [{ name: "statement" }], origin: "harvested" }], // encryption-functions/8.txt
	statement_digest_text: [{ name: "STATEMENT_DIGEST_TEXT", params: [{ name: "statement" }], origin: "harvested" }], // encryption-functions/9.txt
	std: [{ name: "STD", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/12.txt
	stddev: [{ name: "STDDEV", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/13.txt
	stddev_pop: [{ name: "STDDEV_POP", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/14.txt
	stddev_samp: [{ name: "STDDEV_SAMP", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/15.txt
	str_to_date: [{ name: "STR_TO_DATE", params: [{ name: "str" }, { name: "format" }], origin: "harvested" }], // date-and-time-functions/39.txt
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
	subdate: [{ name: "SUBDATE", params: [{ name: "expr" }, { name: "days" }], origin: "harvested" }], // date-and-time-functions/40.txt
	substr: [
		{
			name: "SUBSTR",
			params: [{ name: "str" }, { name: "pos" }, { name: "len", optional: true }],
			origin: "harvested",
		},
	], // string-functions/42.txt
	substring: [
		{
			name: "SUBSTRING",
			params: [{ name: "str" }, { name: "pos" }, { name: "len", optional: true }],
			origin: "harvested",
		},
	], // string-functions/43.txt
	substring_index: [
		{
			name: "SUBSTRING_INDEX",
			params: [{ name: "str" }, { name: "delim" }, { name: "count" }],
			origin: "harvested",
		},
	], // string-functions/44.txt
	subtime: [{ name: "SUBTIME", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // date-and-time-functions/41.txt
	sum: [{ name: "SUM", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/16.txt
	sysdate: [{ name: "SYSDATE", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/42.txt
	system_user: [{ name: "SYSTEM_USER", params: [], origin: "harvested" }], // information-functions/16.txt
	tan: [{ name: "TAN", params: [{ name: "X" }], origin: "harvested" }], // mathematical-functions/29.txt
	time: [{ name: "TIME", params: [{ name: "expr" }], origin: "harvested" }], // date-and-time-functions/43.txt
	time_format: [{ name: "TIME_FORMAT", params: [{ name: "time" }, { name: "format" }], origin: "harvested" }], // date-and-time-functions/48.txt
	time_to_sec: [{ name: "TIME_TO_SEC", params: [{ name: "time" }], origin: "harvested" }], // date-and-time-functions/49.txt
	timediff: [{ name: "TIMEDIFF", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // date-and-time-functions/44.txt
	timestamp: [
		{ name: "TIMESTAMP", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" },
		{ name: "TIMESTAMP", params: [{ name: "expr" }], origin: "harvested" },
	], // date-and-time-functions/45.txt
	timestampadd: [
		{
			name: "TIMESTAMPADD",
			params: [{ name: "unit" }, { name: "interval" }, { name: "datetime_expr" }],
			origin: "harvested",
		},
	], // date-and-time-functions/46.txt
	timestampdiff: [
		{
			name: "TIMESTAMPDIFF",
			params: [{ name: "unit" }, { name: "datetime_expr1" }, { name: "datetime_expr2" }],
			origin: "harvested",
		},
	], // date-and-time-functions/47.txt
	to_base64: [{ name: "TO_BASE64", params: [{ name: "str" }], origin: "harvested" }], // string-functions/45.txt
	to_days: [{ name: "TO_DAYS", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/50.txt
	to_seconds: [{ name: "TO_SECONDS", params: [{ name: "expr" }], origin: "harvested" }], // date-and-time-functions/51.txt
	truncate: [{ name: "TRUNCATE", params: [{ name: "X" }, { name: "D" }], origin: "harvested" }], // mathematical-functions/30.txt
	ucase: [{ name: "UCASE", params: [{ name: "str" }], origin: "harvested" }], // string-functions/47.txt
	uncompress: [{ name: "UNCOMPRESS", params: [{ name: "string_to_uncompress" }], origin: "harvested" }], // encryption-functions/10.txt
	uncompressed_length: [
		{ name: "UNCOMPRESSED_LENGTH", params: [{ name: "compressed_string" }], origin: "harvested" },
	], // encryption-functions/11.txt
	unhex: [{ name: "UNHEX", params: [{ name: "str" }], origin: "harvested" }], // string-functions/48.txt
	unix_timestamp: [{ name: "UNIX_TIMESTAMP", params: [{ name: "date", optional: true }], origin: "harvested" }], // date-and-time-functions/52.txt
	upper: [{ name: "UPPER", params: [{ name: "str" }], origin: "harvested" }], // string-functions/49.txt
	user: [{ name: "USER", params: [], origin: "harvested" }], // information-functions/17.txt
	utc_date: [{ name: "UTC_DATE", params: [], origin: "harvested" }], // date-and-time-functions/53.txt
	utc_time: [{ name: "UTC_TIME", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/54.txt
	utc_timestamp: [{ name: "UTC_TIMESTAMP", params: [{ name: "fsp", optional: true }], origin: "harvested" }], // date-and-time-functions/55.txt
	uuid: [{ name: "UUID", params: [], origin: "harvested" }], // miscellaneous-functions/16.txt
	uuid_short: [{ name: "UUID_SHORT", params: [], origin: "harvested" }], // miscellaneous-functions/17.txt
	uuid_to_bin: [
		{
			name: "UUID_TO_BIN",
			params: [{ name: "string_uuid" }, { name: "swap_flag", optional: true }],
			origin: "harvested",
		},
	], // miscellaneous-functions/18.txt
	validate_password_strength: [
		{ name: "VALIDATE_PASSWORD_STRENGTH", params: [{ name: "str" }], origin: "harvested" },
	], // encryption-functions/12.txt
	values: [{ name: "VALUES", params: [{ name: "col_name" }], origin: "harvested" }], // miscellaneous-functions/19.txt
	var_pop: [{ name: "VAR_POP", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/17.txt
	var_samp: [{ name: "VAR_SAMP", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/18.txt
	variance: [{ name: "VARIANCE", params: [{ name: "expr" }], origin: "harvested" }], // aggregate-functions/19.txt
	version: [{ name: "VERSION", params: [], origin: "harvested" }], // information-functions/18.txt
	week: [{ name: "WEEK", params: [{ name: "date" }, { name: "mode", optional: true }], origin: "harvested" }], // date-and-time-functions/56.txt
	weekday: [{ name: "WEEKDAY", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/57.txt
	weekofyear: [{ name: "WEEKOFYEAR", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/58.txt
	year: [{ name: "YEAR", params: [{ name: "date" }], origin: "harvested" }], // date-and-time-functions/59.txt
	yearweek: [{ name: "YEARWEEK", params: [{ name: "date" }, { name: "mode", optional: true }], origin: "harvested" }], // date-and-time-functions/60.txt
};
