// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: postgresql.org PostgreSQL 18 DocBook SGML  vendor/postgres-sgml/func.sgml (`<para role="func_signature">` and `<synopsis>` blocks)
// Overrides source: tools/signature-overrides/postgres.mjs
// Built 2026-07-14. 596 names (11 curated, 585 harvested), 85 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for postgres: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const POSTGRES_SIGNATURES: Record<string, FnSignature[]> = {
	abbrev: [
		{ name: "abbrev", params: [{ name: "inet" }], origin: "harvested" },
		{ name: "abbrev", params: [{ name: "cidr" }], origin: "harvested" },
	], // functions-net
	abs: [{ name: "abs", params: [{ name: "x", type: "numeric" }], origin: "curated" }], // curated: abs(x)
	acldefault: [
		{
			name: "acldefault",
			params: [
				{ name: "type", type: '"char"' },
				{ name: "ownerId", type: "oid" },
			],
			origin: "harvested",
		},
	], // functions-info
	aclexplode: [{ name: "aclexplode", params: [{ name: "aclitem[]" }], origin: "harvested" }], // functions-info
	acos: [{ name: "acos", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	acosd: [{ name: "acosd", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	acosh: [{ name: "acosh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	age: [
		{ name: "age", params: [{ name: "timestamp" }, { name: "timestamp", optional: true }], origin: "harvested" },
		{ name: "age", params: [{ name: "xid" }], origin: "harvested" },
	], // functions-datetime, functions-info
	any_value: [{ name: "any_value", params: [{ name: "anyelement" }], origin: "harvested" }], // functions-aggregate
	area: [{ name: "area", params: [{ name: "geometric_type" }], origin: "harvested" }], // functions-geometry
	array_agg: [{ name: "array_agg", params: [{ name: "expression" }], origin: "curated" }], // curated: array_agg(expression)
	array_append: [
		{
			name: "array_append",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }],
			origin: "harvested",
		},
	], // functions-array
	array_cat: [
		{
			name: "array_cat",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatiblearray" }],
			origin: "harvested",
		},
	], // functions-array
	array_dims: [{ name: "array_dims", params: [{ name: "anyarray" }], origin: "harvested" }], // functions-array
	array_fill: [
		{
			name: "array_fill",
			params: [{ name: "anyelement" }, { name: "integer[]" }, { name: "integer[]", optional: true }],
			origin: "harvested",
		},
	], // functions-array
	array_length: [{ name: "array_length", params: [{ name: "anyarray" }, { name: "integer" }], origin: "harvested" }], // functions-array
	array_lower: [{ name: "array_lower", params: [{ name: "anyarray" }, { name: "integer" }], origin: "harvested" }], // functions-array
	array_ndims: [{ name: "array_ndims", params: [{ name: "anyarray" }], origin: "harvested" }], // functions-array
	array_position: [
		{
			name: "array_position",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }, { name: "integer", optional: true }],
			origin: "harvested",
		},
	], // functions-array
	array_positions: [
		{
			name: "array_positions",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }],
			origin: "harvested",
		},
	], // functions-array
	array_prepend: [
		{
			name: "array_prepend",
			params: [{ name: "anycompatible" }, { name: "anycompatiblearray" }],
			origin: "harvested",
		},
	], // functions-array
	array_remove: [
		{
			name: "array_remove",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }],
			origin: "harvested",
		},
	], // functions-array
	array_replace: [
		{
			name: "array_replace",
			params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }, { name: "anycompatible" }],
			origin: "harvested",
		},
	], // functions-array
	array_reverse: [{ name: "array_reverse", params: [{ name: "anyarray" }], origin: "harvested" }], // functions-array
	array_sample: [
		{
			name: "array_sample",
			params: [
				{ name: "array", type: "anyarray" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-array
	array_shuffle: [{ name: "array_shuffle", params: [{ name: "anyarray" }], origin: "harvested" }], // functions-array
	array_sort: [
		{
			name: "array_sort",
			params: [
				{ name: "array", type: "anyarray" },
				{ name: "descending", type: "boolean", optional: true },
				{ name: "nulls_first", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-array
	array_to_json: [
		{
			name: "array_to_json",
			params: [{ name: "anyarray" }, { name: "boolean", optional: true }],
			origin: "harvested",
		},
	], // functions-json
	array_to_string: [
		{
			name: "array_to_string",
			params: [
				{ name: "array", type: "anyarray" },
				{ name: "delimiter", type: "text" },
				{ name: "null_string", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-array
	array_to_tsvector: [{ name: "array_to_tsvector", params: [{ name: "text[]" }], origin: "harvested" }], // functions-textsearch
	array_upper: [{ name: "array_upper", params: [{ name: "anyarray" }, { name: "integer" }], origin: "harvested" }], // functions-array
	ascii: [{ name: "ascii", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	asin: [{ name: "asin", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	asind: [{ name: "asind", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	asinh: [{ name: "asinh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	atan: [{ name: "atan", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	atan2: [
		{
			name: "atan2",
			params: [
				{ name: "y", type: "double precision" },
				{ name: "x", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-math
	atan2d: [
		{
			name: "atan2d",
			params: [
				{ name: "y", type: "double precision" },
				{ name: "x", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-math
	atand: [{ name: "atand", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	atanh: [{ name: "atanh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	avg: [
		{ name: "avg", params: [{ name: "smallint" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "real" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "double precision" }], origin: "harvested" },
		{ name: "avg", params: [{ name: "interval" }], origin: "harvested" },
	], // functions-aggregate
	bit_and: [
		{ name: "bit_and", params: [{ name: "smallint" }], origin: "harvested" },
		{ name: "bit_and", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "bit_and", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "bit_and", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-aggregate
	bit_count: [
		{ name: "bit_count", params: [{ name: "bytes", type: "bytea" }], origin: "harvested" },
		{ name: "bit_count", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-binarystring, functions-bitstring
	bit_length: [
		{ name: "bit_length", params: [{ name: "text" }], origin: "harvested" },
		{ name: "bit_length", params: [{ name: "bytea" }], origin: "harvested" },
		{ name: "bit_length", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-string, functions-binarystring, functions-bitstring
	bit_or: [
		{ name: "bit_or", params: [{ name: "smallint" }], origin: "harvested" },
		{ name: "bit_or", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "bit_or", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "bit_or", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-aggregate
	bit_xor: [
		{ name: "bit_xor", params: [{ name: "smallint" }], origin: "harvested" },
		{ name: "bit_xor", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "bit_xor", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "bit_xor", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-aggregate
	bool_and: [{ name: "bool_and", params: [{ name: "boolean" }], origin: "harvested" }], // functions-aggregate
	bool_or: [{ name: "bool_or", params: [{ name: "boolean" }], origin: "harvested" }], // functions-aggregate
	bound_box: [{ name: "bound_box", params: [{ name: "box" }, { name: "box" }], origin: "harvested" }], // functions-geometry
	box: [
		{ name: "box", params: [{ name: "point" }, { name: "point", optional: true }], origin: "harvested" },
		{ name: "box", params: [{ name: "circle" }], origin: "harvested" },
		{ name: "box", params: [{ name: "polygon" }], origin: "harvested" },
	], // functions-geometry
	brin_desummarize_range: [
		{
			name: "brin_desummarize_range",
			params: [
				{ name: "index", type: "regclass" },
				{ name: "blockNumber", type: "bigint" },
			],
			origin: "harvested",
		},
	], // functions-admin
	brin_summarize_new_values: [
		{ name: "brin_summarize_new_values", params: [{ name: "index", type: "regclass" }], origin: "harvested" },
	], // functions-admin
	brin_summarize_range: [
		{
			name: "brin_summarize_range",
			params: [
				{ name: "index", type: "regclass" },
				{ name: "blockNumber", type: "bigint" },
			],
			origin: "harvested",
		},
	], // functions-admin
	broadcast: [{ name: "broadcast", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	btrim: [
		{
			name: "btrim",
			params: [
				{ name: "string", type: "text" },
				{ name: "characters", type: "text", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "btrim",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "bytesremoved", type: "bytea" },
			],
			origin: "harvested",
		},
	], // functions-string, functions-binarystring
	cardinality: [{ name: "cardinality", params: [{ name: "anyarray" }], origin: "harvested" }], // functions-array
	casefold: [{ name: "casefold", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	cbrt: [{ name: "cbrt", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	ceil: [
		{ name: "ceil", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "ceil", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	ceiling: [
		{ name: "ceiling", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "ceiling", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	center: [{ name: "center", params: [{ name: "geometric_type" }], origin: "harvested" }], // functions-geometry
	char_length: [{ name: "char_length", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	character_length: [{ name: "character_length", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	chr: [{ name: "chr", params: [{ name: "integer" }], origin: "harvested" }], // functions-string
	circle: [
		{ name: "circle", params: [{ name: "point" }, { name: "double precision" }], origin: "harvested" },
		{ name: "circle", params: [{ name: "box" }], origin: "harvested" },
		{ name: "circle", params: [{ name: "polygon" }], origin: "harvested" },
	], // functions-geometry
	clock_timestamp: [{ name: "clock_timestamp", params: [], origin: "harvested" }], // functions-datetime
	coalesce: [{ name: "COALESCE", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // functions-conditional
	col_description: [
		{
			name: "col_description",
			params: [
				{ name: "table", type: "oid" },
				{ name: "column", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	concat: [
		{
			name: "concat",
			params: [
				{ name: "val1", type: '"any"' },
				{ name: "val2", type: '"any"', optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-string
	concat_ws: [
		{
			name: "concat_ws",
			params: [
				{ name: "sep", type: "text" },
				{ name: "val1", type: '"any"' },
				{ name: "val2", type: '"any"', optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-string
	convert: [
		{
			name: "convert",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "src_encoding", type: "name" },
				{ name: "dest_encoding", type: "name" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	convert_from: [
		{
			name: "convert_from",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "src_encoding", type: "name" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	convert_to: [
		{
			name: "convert_to",
			params: [
				{ name: "string", type: "text" },
				{ name: "dest_encoding", type: "name" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	corr: [
		{
			name: "corr",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	cos: [{ name: "cos", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	cosd: [{ name: "cosd", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	cosh: [{ name: "cosh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	cot: [{ name: "cot", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	cotd: [{ name: "cotd", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	count: [{ name: "count", params: [{ name: "expression" }], origin: "curated" }], // curated: count(expression)
	covar_pop: [
		{
			name: "covar_pop",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	covar_samp: [
		{
			name: "covar_samp",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	crc32: [{ name: "crc32", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	crc32c: [{ name: "crc32c", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	cume_dist: [{ name: "cume_dist", params: [{ name: "args", optional: true }], origin: "harvested" }], // functions-aggregate
	current_catalog: [{ name: "current_catalog", params: [], origin: "harvested" }], // functions-info
	current_database: [{ name: "current_database", params: [], origin: "harvested" }], // functions-info
	current_date: [{ name: "current_date", params: [], origin: "harvested" }], // functions-datetime
	current_query: [{ name: "current_query", params: [], origin: "harvested" }], // functions-info
	current_role: [{ name: "current_role", params: [], origin: "harvested" }], // functions-info
	current_schema: [{ name: "current_schema", params: [], origin: "harvested" }], // functions-info
	current_schemas: [
		{ name: "current_schemas", params: [{ name: "include_implicit", type: "boolean" }], origin: "harvested" },
	], // functions-info
	current_setting: [
		{
			name: "current_setting",
			params: [
				{ name: "setting_name", type: "text" },
				{ name: "missing_ok", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	current_time: [{ name: "current_time", params: [{ name: "integer", optional: true }], origin: "harvested" }], // functions-datetime
	current_timestamp: [
		{ name: "current_timestamp", params: [{ name: "integer", optional: true }], origin: "harvested" },
	], // functions-datetime
	current_user: [{ name: "current_user", params: [], origin: "harvested" }], // functions-info
	currval: [{ name: "currval", params: [{ name: "regclass" }], origin: "harvested" }], // functions-sequence
	date_add: [
		{
			name: "date_add",
			params: [{ name: "timestamp with time zone" }, { name: "interval" }, { name: "text", optional: true }],
			origin: "harvested",
		},
	], // functions-datetime
	date_bin: [
		{
			name: "date_bin",
			params: [
				{ name: "stride", type: "interval" },
				{ name: "source", type: "timestamp" },
				{ name: "origin", type: "timestamp" },
			],
			origin: "curated",
		},
	], // curated: date_bin(stride, source, origin)
	date_part: [
		{ name: "date_part", params: [{ name: "text" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "date_part", params: [{ name: "text" }, { name: "interval" }], origin: "harvested" },
	], // functions-datetime
	date_subtract: [
		{
			name: "date_subtract",
			params: [{ name: "timestamp with time zone" }, { name: "interval" }, { name: "text", optional: true }],
			origin: "harvested",
		},
	], // functions-datetime
	date_trunc: [
		{
			name: "date_trunc",
			params: [{ name: "text" }, { name: "timestamp with time zone" }, { name: "text" }],
			origin: "harvested",
		},
		{ name: "date_trunc", params: [{ name: "text" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "date_trunc", params: [{ name: "text" }, { name: "interval" }], origin: "harvested" },
	], // functions-datetime
	decode: [
		{
			name: "decode",
			params: [
				{ name: "string", type: "text" },
				{ name: "format", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	degrees: [{ name: "degrees", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	dense_rank: [{ name: "dense_rank", params: [{ name: "args", optional: true }], origin: "harvested" }], // functions-aggregate
	diagonal: [{ name: "diagonal", params: [{ name: "box" }], origin: "harvested" }], // functions-geometry
	diameter: [{ name: "diameter", params: [{ name: "circle" }], origin: "harvested" }], // functions-geometry
	div: [
		{
			name: "div",
			params: [
				{ name: "y", type: "numeric" },
				{ name: "x", type: "numeric" },
			],
			origin: "harvested",
		},
	], // functions-math
	encode: [
		{
			name: "encode",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "format", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	enum_first: [{ name: "enum_first", params: [{ name: "anyenum" }], origin: "harvested" }], // functions-enum
	enum_last: [{ name: "enum_last", params: [{ name: "anyenum" }], origin: "harvested" }], // functions-enum
	enum_range: [
		{ name: "enum_range", params: [{ name: "anyenum" }, { name: "anyenum", optional: true }], origin: "harvested" },
	], // functions-enum
	erf: [{ name: "erf", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	erfc: [{ name: "erfc", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	every: [{ name: "every", params: [{ name: "boolean" }], origin: "harvested" }], // functions-aggregate
	exp: [
		{ name: "exp", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "exp", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	factorial: [{ name: "factorial", params: [{ name: "bigint" }], origin: "harvested" }], // functions-math
	family: [{ name: "family", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	first_value: [{ name: "first_value", params: [{ name: "value", type: "anyelement" }], origin: "harvested" }], // functions-window
	floor: [
		{ name: "floor", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "floor", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	format: [
		{
			name: "format",
			params: [
				{ name: "formatstr", type: "text" },
				{ name: "formatarg", type: '"any"', optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-string
	format_type: [
		{
			name: "format_type",
			params: [
				{ name: "type", type: "oid" },
				{ name: "typemod", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	gamma: [{ name: "gamma", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	gcd: [{ name: "gcd", params: [{ name: "numeric_type" }, { name: "numeric_type" }], origin: "harvested" }], // functions-math
	gen_random_uuid: [{ name: "gen_random_uuid", params: [], origin: "harvested" }], // functions-uuid
	generate_series: [
		{
			name: "generate_series",
			params: [
				{ name: "start", type: "timestamp with time zone" },
				{ name: "stop", type: "timestamp with time zone" },
				{ name: "step", type: "interval" },
				{ name: "timezone", type: "text", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [
				{ name: "start", type: "integer" },
				{ name: "stop", type: "integer" },
				{ name: "step", type: "integer", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [
				{ name: "start", type: "bigint" },
				{ name: "stop", type: "bigint" },
				{ name: "step", type: "bigint", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [
				{ name: "start", type: "numeric" },
				{ name: "stop", type: "numeric" },
				{ name: "step", type: "numeric", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [
				{ name: "start", type: "timestamp" },
				{ name: "stop", type: "timestamp" },
				{ name: "step", type: "interval" },
			],
			origin: "harvested",
		},
	], // functions-srf
	generate_subscripts: [
		{
			name: "generate_subscripts",
			params: [
				{ name: "array", type: "anyarray" },
				{ name: "dim", type: "integer" },
				{ name: "reverse", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-srf
	get_bit: [
		{
			name: "get_bit",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "n", type: "bigint" },
			],
			origin: "harvested",
		},
		{
			name: "get_bit",
			params: [
				{ name: "bits", type: "bit" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-binarystring, functions-bitstring
	get_byte: [
		{
			name: "get_byte",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	get_current_ts_config: [{ name: "get_current_ts_config", params: [], origin: "harvested" }], // functions-textsearch
	gin_clean_pending_list: [
		{ name: "gin_clean_pending_list", params: [{ name: "index", type: "regclass" }], origin: "harvested" },
	], // functions-admin
	greatest: [{ name: "GREATEST", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // functions-conditional
	grouping: [{ name: "GROUPING", params: [{ name: "group_by_expression(s)" }], origin: "harvested" }], // functions-aggregate
	height: [{ name: "height", params: [{ name: "box" }], origin: "harvested" }], // functions-geometry
	host: [{ name: "host", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	hostmask: [{ name: "hostmask", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	icu_unicode_version: [{ name: "icu_unicode_version", params: [], origin: "harvested" }], // functions-info
	inet_client_addr: [{ name: "inet_client_addr", params: [], origin: "harvested" }], // functions-info
	inet_client_port: [{ name: "inet_client_port", params: [], origin: "harvested" }], // functions-info
	inet_merge: [{ name: "inet_merge", params: [{ name: "inet" }, { name: "inet" }], origin: "harvested" }], // functions-net
	inet_same_family: [{ name: "inet_same_family", params: [{ name: "inet" }, { name: "inet" }], origin: "harvested" }], // functions-net
	inet_server_addr: [{ name: "inet_server_addr", params: [], origin: "harvested" }], // functions-info
	inet_server_port: [{ name: "inet_server_port", params: [], origin: "harvested" }], // functions-info
	initcap: [{ name: "initcap", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	isclosed: [{ name: "isclosed", params: [{ name: "path" }], origin: "harvested" }], // functions-geometry
	isempty: [
		{ name: "isempty", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "isempty", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	isfinite: [
		{ name: "isfinite", params: [{ name: "date" }], origin: "harvested" },
		{ name: "isfinite", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "isfinite", params: [{ name: "interval" }], origin: "harvested" },
	], // functions-datetime
	isopen: [{ name: "isopen", params: [{ name: "path" }], origin: "harvested" }], // functions-geometry
	json_agg_strict: [{ name: "json_agg_strict", params: [{ name: "anyelement" }], origin: "harvested" }], // functions-aggregate
	json_array_elements: [{ name: "json_array_elements", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_array_elements_text: [{ name: "json_array_elements_text", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_array_length: [{ name: "json_array_length", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_build_array: [{ name: "json_build_array", params: [{ name: '"any"' }], variadic: true, origin: "harvested" }], // functions-json
	json_build_object: [{ name: "json_build_object", params: [{ name: "arg" }], variadic: true, origin: "curated" }], // curated: json_build_object(VARIADIC args)
	json_each: [{ name: "json_each", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_each_text: [{ name: "json_each_text", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_extract_path: [
		{
			name: "json_extract_path",
			params: [
				{ name: "from_json", type: "json" },
				{ name: "path_elems", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-json
	json_extract_path_text: [
		{
			name: "json_extract_path_text",
			params: [
				{ name: "from_json", type: "json" },
				{ name: "path_elems", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-json
	json_object: [
		{
			name: "json_object",
			params: [
				{ name: "keys", type: "text[]" },
				{ name: "values", type: "text[]" },
			],
			origin: "harvested",
		},
		{ name: "json_object", params: [{ name: "text[]" }], origin: "harvested" },
	], // functions-json
	json_object_agg_strict: [
		{
			name: "json_object_agg_strict",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	json_object_agg_unique: [
		{
			name: "json_object_agg_unique",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	json_object_agg_unique_strict: [
		{
			name: "json_object_agg_unique_strict",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	json_object_keys: [{ name: "json_object_keys", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_populate_record: [
		{
			name: "json_populate_record",
			params: [
				{ name: "base", type: "anyelement" },
				{ name: "from_json", type: "json" },
			],
			origin: "harvested",
		},
	], // functions-json
	json_populate_recordset: [
		{
			name: "json_populate_recordset",
			params: [
				{ name: "base", type: "anyelement" },
				{ name: "from_json", type: "json" },
			],
			origin: "harvested",
		},
	], // functions-json
	json_scalar: [{ name: "json_scalar", params: [{ name: "expression" }], origin: "harvested" }], // functions-json
	json_strip_nulls: [
		{
			name: "json_strip_nulls",
			params: [
				{ name: "target", type: "json" },
				{ name: "strip_in_arrays", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	json_to_record: [{ name: "json_to_record", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_to_recordset: [{ name: "json_to_recordset", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	json_typeof: [{ name: "json_typeof", params: [{ name: "json" }], origin: "harvested" }], // functions-json
	jsonb_agg_strict: [{ name: "jsonb_agg_strict", params: [{ name: "anyelement" }], origin: "harvested" }], // functions-aggregate
	jsonb_array_elements: [{ name: "jsonb_array_elements", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_array_elements_text: [
		{ name: "jsonb_array_elements_text", params: [{ name: "jsonb" }], origin: "harvested" },
	], // functions-json
	jsonb_array_length: [{ name: "jsonb_array_length", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_build_array: [
		{ name: "jsonb_build_array", params: [{ name: '"any"' }], variadic: true, origin: "harvested" },
	], // functions-json
	jsonb_build_object: [
		{ name: "jsonb_build_object", params: [{ name: '"any"' }], variadic: true, origin: "harvested" },
	], // functions-json
	jsonb_each: [{ name: "jsonb_each", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_each_text: [{ name: "jsonb_each_text", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_extract_path: [
		{
			name: "jsonb_extract_path",
			params: [
				{ name: "from_json", type: "jsonb" },
				{ name: "path_elems", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-json
	jsonb_extract_path_text: [
		{
			name: "jsonb_extract_path_text",
			params: [
				{ name: "from_json", type: "jsonb" },
				{ name: "path_elems", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-json
	jsonb_insert: [
		{
			name: "jsonb_insert",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "text[]" },
				{ name: "new_value", type: "jsonb" },
				{ name: "insert_after", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_object: [
		{
			name: "jsonb_object",
			params: [
				{ name: "keys", type: "text[]" },
				{ name: "values", type: "text[]" },
			],
			origin: "harvested",
		},
		{ name: "jsonb_object", params: [{ name: "text[]" }], origin: "harvested" },
	], // functions-json
	jsonb_object_agg_strict: [
		{
			name: "jsonb_object_agg_strict",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	jsonb_object_agg_unique: [
		{
			name: "jsonb_object_agg_unique",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	jsonb_object_agg_unique_strict: [
		{
			name: "jsonb_object_agg_unique_strict",
			params: [
				{ name: "key", type: '"any"' },
				{ name: "value", type: '"any"' },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	jsonb_object_keys: [{ name: "jsonb_object_keys", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_path_exists: [
		{
			name: "jsonb_path_exists",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_exists_tz: [
		{
			name: "jsonb_path_exists_tz",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_match: [
		{
			name: "jsonb_path_match",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_match_tz: [
		{
			name: "jsonb_path_match_tz",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query: [
		{
			name: "jsonb_path_query",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query_array: [
		{
			name: "jsonb_path_query_array",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query_array_tz: [
		{
			name: "jsonb_path_query_array_tz",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query_first: [
		{
			name: "jsonb_path_query_first",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query_first_tz: [
		{
			name: "jsonb_path_query_first_tz",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_path_query_tz: [
		{
			name: "jsonb_path_query_tz",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "jsonpath" },
				{ name: "vars", type: "jsonb", optional: true },
				{ name: "silent", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_populate_record: [
		{
			name: "jsonb_populate_record",
			params: [
				{ name: "base", type: "anyelement" },
				{ name: "from_json", type: "jsonb" },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_populate_record_valid: [
		{
			name: "jsonb_populate_record_valid",
			params: [
				{ name: "base", type: "anyelement" },
				{ name: "from_json", type: "json" },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_populate_recordset: [
		{
			name: "jsonb_populate_recordset",
			params: [
				{ name: "base", type: "anyelement" },
				{ name: "from_json", type: "jsonb" },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_pretty: [{ name: "jsonb_pretty", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_set: [
		{
			name: "jsonb_set",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "text[]" },
				{ name: "new_value", type: "jsonb" },
				{ name: "create_if_missing", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_set_lax: [
		{
			name: "jsonb_set_lax",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "path", type: "text[]" },
				{ name: "new_value", type: "jsonb" },
				{ name: "create_if_missing", type: "boolean", optional: true },
				{ name: "null_value_treatment", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_strip_nulls: [
		{
			name: "jsonb_strip_nulls",
			params: [
				{ name: "target", type: "jsonb" },
				{ name: "strip_in_arrays", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-json
	jsonb_to_record: [{ name: "jsonb_to_record", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_to_recordset: [{ name: "jsonb_to_recordset", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	jsonb_typeof: [{ name: "jsonb_typeof", params: [{ name: "jsonb" }], origin: "harvested" }], // functions-json
	justify_days: [{ name: "justify_days", params: [{ name: "interval" }], origin: "harvested" }], // functions-datetime
	justify_hours: [{ name: "justify_hours", params: [{ name: "interval" }], origin: "harvested" }], // functions-datetime
	justify_interval: [{ name: "justify_interval", params: [{ name: "interval" }], origin: "harvested" }], // functions-datetime
	lag: [
		{
			name: "lag",
			params: [
				{ name: "value", type: "anycompatible" },
				{ name: "offset", type: "integer", optional: true },
				{ name: "default", type: "anycompatible", optional: true },
			],
			origin: "harvested",
		},
	], // functions-window
	last_value: [{ name: "last_value", params: [{ name: "value", type: "anyelement" }], origin: "harvested" }], // functions-window
	lastval: [{ name: "lastval", params: [], origin: "harvested" }], // functions-sequence
	lcm: [{ name: "lcm", params: [{ name: "numeric_type" }, { name: "numeric_type" }], origin: "harvested" }], // functions-math
	lead: [
		{
			name: "lead",
			params: [
				{ name: "value", type: "anycompatible" },
				{ name: "offset", type: "integer", optional: true },
				{ name: "default", type: "anycompatible", optional: true },
			],
			origin: "harvested",
		},
	], // functions-window
	least: [{ name: "LEAST", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // functions-conditional
	left: [
		{
			name: "left",
			params: [
				{ name: "string", type: "text" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-string
	length: [
		{
			name: "length",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "encoding", type: "name" },
			],
			origin: "harvested",
		},
		{ name: "length", params: [{ name: "text" }], origin: "harvested" },
		{ name: "length", params: [{ name: "bytea" }], origin: "harvested" },
		{ name: "length", params: [{ name: "bit" }], origin: "harvested" },
		{ name: "length", params: [{ name: "geometric_type" }], origin: "harvested" },
		{ name: "length", params: [{ name: "tsvector" }], origin: "harvested" },
	], // functions-binarystring, functions-string, functions-bitstring, functions-geometry, functions-textsearch
	lgamma: [{ name: "lgamma", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	line: [{ name: "line", params: [{ name: "point" }, { name: "point" }], origin: "harvested" }], // functions-geometry
	ln: [
		{ name: "ln", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "ln", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	localtime: [{ name: "localtime", params: [{ name: "integer", optional: true }], origin: "harvested" }], // functions-datetime
	localtimestamp: [{ name: "localtimestamp", params: [{ name: "integer", optional: true }], origin: "harvested" }], // functions-datetime
	log: [
		{
			name: "log",
			params: [
				{ name: "b", type: "numeric" },
				{ name: "x", type: "numeric" },
			],
			origin: "harvested",
		},
		{ name: "log", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "log", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	log10: [
		{ name: "log10", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "log10", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	lower: [
		{ name: "lower", params: [{ name: "text" }], origin: "harvested" },
		{ name: "lower", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "lower", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-string, functions-range
	lower_inc: [
		{ name: "lower_inc", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "lower_inc", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	lower_inf: [
		{ name: "lower_inf", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "lower_inf", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	lpad: [
		{
			name: "lpad",
			params: [
				{ name: "string", type: "text" },
				{ name: "length", type: "integer" },
				{ name: "fill", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	lseg: [
		{ name: "lseg", params: [{ name: "point" }, { name: "point" }], origin: "harvested" },
		{ name: "lseg", params: [{ name: "box" }], origin: "harvested" },
	], // functions-geometry
	ltrim: [
		{
			name: "ltrim",
			params: [
				{ name: "string", type: "text" },
				{ name: "characters", type: "text", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "ltrim",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "bytesremoved", type: "bytea" },
			],
			origin: "harvested",
		},
	], // functions-string, functions-binarystring
	macaddr8_set7bit: [{ name: "macaddr8_set7bit", params: [{ name: "macaddr8" }], origin: "harvested" }], // functions-net
	make_date: [
		{
			name: "make_date",
			params: [
				{ name: "year", type: "int" },
				{ name: "month", type: "int" },
				{ name: "day", type: "int" },
			],
			origin: "harvested",
		},
	], // functions-datetime
	make_interval: [
		{
			name: "make_interval",
			params: [
				{ name: "years", type: "int", optional: true },
				{ name: "months", type: "int", optional: true },
				{ name: "weeks", type: "int", optional: true },
				{ name: "days", type: "int", optional: true },
				{ name: "hours", type: "int", optional: true },
				{ name: "mins", type: "int", optional: true },
				{ name: "secs", type: "double precision", optional: true },
			],
			origin: "harvested",
		},
	], // functions-datetime
	make_time: [
		{
			name: "make_time",
			params: [
				{ name: "hour", type: "int" },
				{ name: "min", type: "int" },
				{ name: "sec", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-datetime
	make_timestamp: [
		{
			name: "make_timestamp",
			params: [
				{ name: "year", type: "int" },
				{ name: "month", type: "int" },
				{ name: "day", type: "int" },
				{ name: "hour", type: "int" },
				{ name: "min", type: "int" },
				{ name: "sec", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-datetime
	make_timestamptz: [
		{
			name: "make_timestamptz",
			params: [
				{ name: "year", type: "int" },
				{ name: "month", type: "int" },
				{ name: "day", type: "int" },
				{ name: "hour", type: "int" },
				{ name: "min", type: "int" },
				{ name: "sec", type: "double precision" },
				{ name: "timezone", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-datetime
	makeaclitem: [
		{
			name: "makeaclitem",
			params: [
				{ name: "grantee", type: "oid" },
				{ name: "grantor", type: "oid" },
				{ name: "privileges", type: "text" },
				{ name: "is_grantable", type: "boolean" },
			],
			origin: "harvested",
		},
	], // functions-info
	masklen: [{ name: "masklen", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	max: [{ name: "max", params: [{ name: "expression" }], origin: "curated" }], // curated: max(expression)
	md5: [
		{ name: "md5", params: [{ name: "text" }], origin: "harvested" },
		{ name: "md5", params: [{ name: "bytea" }], origin: "harvested" },
	], // functions-string, functions-binarystring
	merge_action: [{ name: "merge_action", params: [], origin: "harvested" }], // functions-merge-support
	min: [{ name: "min", params: [{ name: "expression" }], origin: "curated" }], // curated: min(expression)
	min_scale: [{ name: "min_scale", params: [{ name: "numeric" }], origin: "harvested" }], // functions-math
	mod: [
		{
			name: "mod",
			params: [
				{ name: "y", type: "numeric_type" },
				{ name: "x", type: "numeric_type" },
			],
			origin: "harvested",
		},
	], // functions-math
	mode: [{ name: "mode", params: [], origin: "harvested" }], // functions-aggregate
	multirange: [{ name: "multirange", params: [{ name: "anyrange" }], origin: "harvested" }], // functions-range
	mxid_age: [{ name: "mxid_age", params: [{ name: "xid" }], origin: "harvested" }], // functions-info
	netmask: [{ name: "netmask", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	network: [{ name: "network", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	nextval: [{ name: "nextval", params: [{ name: "regclass" }], origin: "harvested" }], // functions-sequence
	normalize: [
		{ name: "normalize", params: [{ name: "text" }, { name: "form", optional: true }], origin: "harvested" },
	], // functions-string
	now: [{ name: "now", params: [], origin: "harvested" }], // functions-datetime
	npoints: [{ name: "npoints", params: [{ name: "geometric_type" }], origin: "harvested" }], // functions-geometry
	nth_value: [
		{
			name: "nth_value",
			params: [
				{ name: "value", type: "anyelement" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-window
	ntile: [{ name: "ntile", params: [{ name: "num_buckets", type: "integer" }], origin: "harvested" }], // functions-window
	nullif: [{ name: "NULLIF", params: [{ name: "value1" }, { name: "value2" }], origin: "harvested" }], // functions-conditional
	num_nonnulls: [{ name: "num_nonnulls", params: [{ name: '"any"' }], variadic: true, origin: "harvested" }], // functions-comparison
	num_nulls: [{ name: "num_nulls", params: [{ name: '"any"' }], variadic: true, origin: "harvested" }], // functions-comparison
	numnode: [{ name: "numnode", params: [{ name: "tsquery" }], origin: "harvested" }], // functions-textsearch
	obj_description: [
		{
			name: "obj_description",
			params: [
				{ name: "object", type: "oid" },
				{ name: "catalog", type: "name", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	octet_length: [
		{ name: "octet_length", params: [{ name: "text" }], origin: "harvested" },
		{ name: "octet_length", params: [{ name: "character" }], origin: "harvested" },
		{ name: "octet_length", params: [{ name: "bytea" }], origin: "harvested" },
		{ name: "octet_length", params: [{ name: "bit" }], origin: "harvested" },
	], // functions-string, functions-binarystring, functions-bitstring
	path: [{ name: "path", params: [{ name: "polygon" }], origin: "harvested" }], // functions-geometry
	pclose: [{ name: "pclose", params: [{ name: "path" }], origin: "harvested" }], // functions-geometry
	percent_rank: [{ name: "percent_rank", params: [{ name: "args", optional: true }], origin: "harvested" }], // functions-aggregate
	percentile_cont: [
		{ name: "percentile_cont", params: [{ name: "fraction", type: "double precision" }], origin: "harvested" },
		{ name: "percentile_cont", params: [{ name: "fractions", type: "double precision[]" }], origin: "harvested" },
	], // functions-aggregate
	percentile_disc: [
		{ name: "percentile_disc", params: [{ name: "fraction", type: "double precision" }], origin: "harvested" },
		{ name: "percentile_disc", params: [{ name: "fractions", type: "double precision[]" }], origin: "harvested" },
	], // functions-aggregate
	pg_advisory_lock: [
		{
			name: "pg_advisory_lock",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_lock", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_advisory_lock_shared: [
		{
			name: "pg_advisory_lock_shared",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_lock_shared", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_advisory_unlock: [
		{
			name: "pg_advisory_unlock",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_unlock", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_advisory_unlock_all: [{ name: "pg_advisory_unlock_all", params: [], origin: "harvested" }], // functions-admin
	pg_advisory_unlock_shared: [
		{
			name: "pg_advisory_unlock_shared",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_unlock_shared", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_advisory_xact_lock: [
		{
			name: "pg_advisory_xact_lock",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_xact_lock", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_advisory_xact_lock_shared: [
		{
			name: "pg_advisory_xact_lock_shared",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_advisory_xact_lock_shared", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_available_wal_summaries: [{ name: "pg_available_wal_summaries", params: [], origin: "harvested" }], // functions-info
	pg_backend_pid: [{ name: "pg_backend_pid", params: [], origin: "harvested" }], // functions-info
	pg_backup_start: [
		{
			name: "pg_backup_start",
			params: [
				{ name: "label", type: "text" },
				{ name: "fast", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_backup_stop: [
		{
			name: "pg_backup_stop",
			params: [{ name: "wait_for_archive", type: "boolean", optional: true }],
			origin: "harvested",
		},
	], // functions-admin
	pg_basetype: [{ name: "pg_basetype", params: [{ name: "regtype" }], origin: "harvested" }], // functions-info
	pg_blocking_pids: [{ name: "pg_blocking_pids", params: [{ name: "integer" }], origin: "harvested" }], // functions-info
	pg_cancel_backend: [{ name: "pg_cancel_backend", params: [{ name: "pid", type: "integer" }], origin: "harvested" }], // functions-admin
	pg_char_to_encoding: [
		{ name: "pg_char_to_encoding", params: [{ name: "encoding", type: "name" }], origin: "harvested" },
	], // functions-info
	pg_clear_attribute_stats: [
		{
			name: "pg_clear_attribute_stats",
			params: [
				{ name: "schemaname", type: "text" },
				{ name: "relname", type: "text" },
				{ name: "attname", type: "text" },
				{ name: "inherited", type: "boolean" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_clear_relation_stats: [
		{
			name: "pg_clear_relation_stats",
			params: [
				{ name: "schemaname", type: "text" },
				{ name: "relname", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_client_encoding: [{ name: "pg_client_encoding", params: [], origin: "harvested" }], // functions-string
	pg_collation_actual_version: [
		{ name: "pg_collation_actual_version", params: [{ name: "oid" }], origin: "harvested" },
	], // functions-admin
	pg_collation_is_visible: [
		{ name: "pg_collation_is_visible", params: [{ name: "collation", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_column_compression: [{ name: "pg_column_compression", params: [{ name: '"any"' }], origin: "harvested" }], // functions-admin
	pg_column_size: [{ name: "pg_column_size", params: [{ name: '"any"' }], origin: "harvested" }], // functions-admin
	pg_column_toast_chunk_id: [{ name: "pg_column_toast_chunk_id", params: [{ name: '"any"' }], origin: "harvested" }], // functions-admin
	pg_conf_load_time: [{ name: "pg_conf_load_time", params: [], origin: "harvested" }], // functions-info
	pg_control_checkpoint: [{ name: "pg_control_checkpoint", params: [], origin: "harvested" }], // functions-info
	pg_control_init: [{ name: "pg_control_init", params: [], origin: "harvested" }], // functions-info
	pg_control_recovery: [{ name: "pg_control_recovery", params: [], origin: "harvested" }], // functions-info
	pg_control_system: [{ name: "pg_control_system", params: [], origin: "harvested" }], // functions-info
	pg_conversion_is_visible: [
		{ name: "pg_conversion_is_visible", params: [{ name: "conversion", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_copy_logical_replication_slot: [
		{
			name: "pg_copy_logical_replication_slot",
			params: [
				{ name: "src_slot_name", type: "name" },
				{ name: "dst_slot_name", type: "name" },
				{ name: "temporary", type: "boolean", optional: true },
				{ name: "plugin", type: "name", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_copy_physical_replication_slot: [
		{
			name: "pg_copy_physical_replication_slot",
			params: [
				{ name: "src_slot_name", type: "name" },
				{ name: "dst_slot_name", type: "name" },
				{ name: "temporary", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_create_restore_point: [
		{ name: "pg_create_restore_point", params: [{ name: "name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_current_logfile: [
		{ name: "pg_current_logfile", params: [{ name: "text", optional: true }], origin: "harvested" },
	], // functions-info
	pg_current_snapshot: [{ name: "pg_current_snapshot", params: [], origin: "harvested" }], // functions-info
	pg_current_wal_flush_lsn: [{ name: "pg_current_wal_flush_lsn", params: [], origin: "harvested" }], // functions-admin
	pg_current_wal_insert_lsn: [{ name: "pg_current_wal_insert_lsn", params: [], origin: "harvested" }], // functions-admin
	pg_current_wal_lsn: [{ name: "pg_current_wal_lsn", params: [], origin: "harvested" }], // functions-admin
	pg_current_xact_id: [{ name: "pg_current_xact_id", params: [], origin: "harvested" }], // functions-info
	pg_current_xact_id_if_assigned: [{ name: "pg_current_xact_id_if_assigned", params: [], origin: "harvested" }], // functions-info
	pg_database_collation_actual_version: [
		{ name: "pg_database_collation_actual_version", params: [{ name: "oid" }], origin: "harvested" },
	], // functions-admin
	pg_database_size: [
		{ name: "pg_database_size", params: [{ name: "name" }], origin: "harvested" },
		{ name: "pg_database_size", params: [{ name: "oid" }], origin: "harvested" },
	], // functions-admin
	pg_describe_object: [
		{
			name: "pg_describe_object",
			params: [
				{ name: "classid", type: "oid" },
				{ name: "objid", type: "oid" },
				{ name: "objsubid", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_drop_replication_slot: [
		{ name: "pg_drop_replication_slot", params: [{ name: "slot_name", type: "name" }], origin: "harvested" },
	], // functions-admin
	pg_encoding_to_char: [
		{ name: "pg_encoding_to_char", params: [{ name: "encoding", type: "integer" }], origin: "harvested" },
	], // functions-info
	pg_event_trigger_ddl_commands: [{ name: "pg_event_trigger_ddl_commands", params: [], origin: "harvested" }], // functions-event-triggers
	pg_event_trigger_dropped_objects: [{ name: "pg_event_trigger_dropped_objects", params: [], origin: "harvested" }], // functions-event-triggers
	pg_event_trigger_table_rewrite_oid: [
		{ name: "pg_event_trigger_table_rewrite_oid", params: [], origin: "harvested" },
	], // functions-event-triggers
	pg_event_trigger_table_rewrite_reason: [
		{ name: "pg_event_trigger_table_rewrite_reason", params: [], origin: "harvested" },
	], // functions-event-triggers
	pg_export_snapshot: [{ name: "pg_export_snapshot", params: [], origin: "harvested" }], // functions-admin
	pg_filenode_relation: [
		{
			name: "pg_filenode_relation",
			params: [
				{ name: "tablespace", type: "oid" },
				{ name: "filenode", type: "oid" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_function_is_visible: [
		{ name: "pg_function_is_visible", params: [{ name: "function", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_acl: [
		{
			name: "pg_get_acl",
			params: [
				{ name: "classid", type: "oid" },
				{ name: "objid", type: "oid" },
				{ name: "objsubid", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_catalog_foreign_keys: [{ name: "pg_get_catalog_foreign_keys", params: [], origin: "harvested" }], // functions-info
	pg_get_constraintdef: [
		{
			name: "pg_get_constraintdef",
			params: [
				{ name: "constraint", type: "oid" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_expr: [
		{
			name: "pg_get_expr",
			params: [
				{ name: "expr", type: "pg_node_tree" },
				{ name: "relation", type: "oid" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_function_arguments: [
		{ name: "pg_get_function_arguments", params: [{ name: "func", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_function_identity_arguments: [
		{ name: "pg_get_function_identity_arguments", params: [{ name: "func", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_function_result: [
		{ name: "pg_get_function_result", params: [{ name: "func", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_functiondef: [{ name: "pg_get_functiondef", params: [{ name: "func", type: "oid" }], origin: "harvested" }], // functions-info
	pg_get_keywords: [{ name: "pg_get_keywords", params: [], origin: "harvested" }], // functions-info
	pg_get_loaded_modules: [{ name: "pg_get_loaded_modules", params: [], origin: "harvested" }], // functions-info
	pg_get_multixact_members: [
		{ name: "pg_get_multixact_members", params: [{ name: "multixid", type: "xid" }], origin: "harvested" },
	], // functions-info
	pg_get_object_address: [
		{
			name: "pg_get_object_address",
			params: [
				{ name: "type", type: "text" },
				{ name: "object_names", type: "text[]" },
				{ name: "object_args", type: "text[]" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_partition_constraintdef: [
		{ name: "pg_get_partition_constraintdef", params: [{ name: "table", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_partkeydef: [{ name: "pg_get_partkeydef", params: [{ name: "table", type: "oid" }], origin: "harvested" }], // functions-info
	pg_get_ruledef: [
		{
			name: "pg_get_ruledef",
			params: [
				{ name: "rule", type: "oid" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_serial_sequence: [
		{
			name: "pg_get_serial_sequence",
			params: [
				{ name: "table", type: "text" },
				{ name: "column", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_statisticsobjdef: [
		{ name: "pg_get_statisticsobjdef", params: [{ name: "statobj", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_get_triggerdef: [
		{
			name: "pg_get_triggerdef",
			params: [
				{ name: "trigger", type: "oid" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_userbyid: [{ name: "pg_get_userbyid", params: [{ name: "role", type: "oid" }], origin: "harvested" }], // functions-info
	pg_get_viewdef: [
		{
			name: "pg_get_viewdef",
			params: [
				{ name: "view", type: "oid" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "pg_get_viewdef",
			params: [
				{ name: "view", type: "oid" },
				{ name: "wrap_column", type: "integer" },
			],
			origin: "harvested",
		},
		{
			name: "pg_get_viewdef",
			params: [
				{ name: "view", type: "text" },
				{ name: "pretty", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_get_wal_replay_pause_state: [{ name: "pg_get_wal_replay_pause_state", params: [], origin: "harvested" }], // functions-admin
	pg_get_wal_resource_managers: [{ name: "pg_get_wal_resource_managers", params: [], origin: "harvested" }], // functions-admin
	pg_get_wal_summarizer_state: [{ name: "pg_get_wal_summarizer_state", params: [], origin: "harvested" }], // functions-info
	pg_identify_object: [
		{
			name: "pg_identify_object",
			params: [
				{ name: "classid", type: "oid" },
				{ name: "objid", type: "oid" },
				{ name: "objsubid", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_identify_object_as_address: [
		{
			name: "pg_identify_object_as_address",
			params: [
				{ name: "classid", type: "oid" },
				{ name: "objid", type: "oid" },
				{ name: "objsubid", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_import_system_collations: [
		{
			name: "pg_import_system_collations",
			params: [{ name: "schema", type: "regnamespace" }],
			origin: "harvested",
		},
	], // functions-admin
	pg_index_column_has_property: [
		{
			name: "pg_index_column_has_property",
			params: [
				{ name: "index", type: "regclass" },
				{ name: "column", type: "integer" },
				{ name: "property", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_index_has_property: [
		{
			name: "pg_index_has_property",
			params: [
				{ name: "index", type: "regclass" },
				{ name: "property", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_indexam_has_property: [
		{
			name: "pg_indexam_has_property",
			params: [
				{ name: "am", type: "oid" },
				{ name: "property", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_indexes_size: [{ name: "pg_indexes_size", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_input_error_info: [
		{
			name: "pg_input_error_info",
			params: [
				{ name: "string", type: "text" },
				{ name: "type", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_input_is_valid: [
		{
			name: "pg_input_is_valid",
			params: [
				{ name: "string", type: "text" },
				{ name: "type", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_is_in_recovery: [{ name: "pg_is_in_recovery", params: [], origin: "harvested" }], // functions-admin
	pg_is_other_temp_schema: [{ name: "pg_is_other_temp_schema", params: [{ name: "oid" }], origin: "harvested" }], // functions-info
	pg_is_wal_replay_paused: [{ name: "pg_is_wal_replay_paused", params: [], origin: "harvested" }], // functions-admin
	pg_jit_available: [{ name: "pg_jit_available", params: [], origin: "harvested" }], // functions-info
	pg_last_committed_xact: [{ name: "pg_last_committed_xact", params: [], origin: "harvested" }], // functions-info
	pg_last_wal_receive_lsn: [{ name: "pg_last_wal_receive_lsn", params: [], origin: "harvested" }], // functions-admin
	pg_last_wal_replay_lsn: [{ name: "pg_last_wal_replay_lsn", params: [], origin: "harvested" }], // functions-admin
	pg_last_xact_replay_timestamp: [{ name: "pg_last_xact_replay_timestamp", params: [], origin: "harvested" }], // functions-admin
	pg_listening_channels: [{ name: "pg_listening_channels", params: [], origin: "harvested" }], // functions-info
	pg_log_backend_memory_contexts: [
		{ name: "pg_log_backend_memory_contexts", params: [{ name: "pid", type: "integer" }], origin: "harvested" },
	], // functions-admin
	pg_log_standby_snapshot: [{ name: "pg_log_standby_snapshot", params: [], origin: "harvested" }], // functions-admin
	pg_logical_slot_get_binary_changes: [
		{
			name: "pg_logical_slot_get_binary_changes",
			params: [
				{ name: "slot_name", type: "name" },
				{ name: "upto_lsn", type: "pg_lsn" },
				{ name: "upto_nchanges", type: "integer" },
				{ name: "options", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_logical_slot_get_changes: [
		{
			name: "pg_logical_slot_get_changes",
			params: [
				{ name: "slot_name", type: "name" },
				{ name: "upto_lsn", type: "pg_lsn" },
				{ name: "upto_nchanges", type: "integer" },
				{ name: "options", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_logical_slot_peek_binary_changes: [
		{
			name: "pg_logical_slot_peek_binary_changes",
			params: [
				{ name: "slot_name", type: "name" },
				{ name: "upto_lsn", type: "pg_lsn" },
				{ name: "upto_nchanges", type: "integer" },
				{ name: "options", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_logical_slot_peek_changes: [
		{
			name: "pg_logical_slot_peek_changes",
			params: [
				{ name: "slot_name", type: "name" },
				{ name: "upto_lsn", type: "pg_lsn" },
				{ name: "upto_nchanges", type: "integer" },
				{ name: "options", type: "text[]" },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_ls_archive_statusdir: [{ name: "pg_ls_archive_statusdir", params: [], origin: "harvested" }], // functions-admin
	pg_ls_logdir: [{ name: "pg_ls_logdir", params: [], origin: "harvested" }], // functions-admin
	pg_ls_logicalmapdir: [{ name: "pg_ls_logicalmapdir", params: [], origin: "harvested" }], // functions-admin
	pg_ls_logicalsnapdir: [{ name: "pg_ls_logicalsnapdir", params: [], origin: "harvested" }], // functions-admin
	pg_ls_replslotdir: [
		{ name: "pg_ls_replslotdir", params: [{ name: "slot_name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_ls_summariesdir: [{ name: "pg_ls_summariesdir", params: [], origin: "harvested" }], // functions-admin
	pg_ls_tmpdir: [
		{ name: "pg_ls_tmpdir", params: [{ name: "tablespace", type: "oid", optional: true }], origin: "harvested" },
	], // functions-admin
	pg_ls_waldir: [{ name: "pg_ls_waldir", params: [], origin: "harvested" }], // functions-admin
	pg_mcv_list_items: [{ name: "pg_mcv_list_items", params: [{ name: "pg_mcv_list" }], origin: "harvested" }], // functions-statistics
	pg_my_temp_schema: [{ name: "pg_my_temp_schema", params: [], origin: "harvested" }], // functions-info
	pg_notification_queue_usage: [{ name: "pg_notification_queue_usage", params: [], origin: "harvested" }], // functions-info
	pg_numa_available: [{ name: "pg_numa_available", params: [], origin: "harvested" }], // functions-info
	pg_opclass_is_visible: [
		{ name: "pg_opclass_is_visible", params: [{ name: "opclass", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_operator_is_visible: [
		{ name: "pg_operator_is_visible", params: [{ name: "operator", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_opfamily_is_visible: [
		{ name: "pg_opfamily_is_visible", params: [{ name: "opclass", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_options_to_table: [
		{ name: "pg_options_to_table", params: [{ name: "options_array", type: "text[]" }], origin: "harvested" },
	], // functions-info
	pg_partition_ancestors: [{ name: "pg_partition_ancestors", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_partition_root: [{ name: "pg_partition_root", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_partition_tree: [{ name: "pg_partition_tree", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_postmaster_start_time: [{ name: "pg_postmaster_start_time", params: [], origin: "harvested" }], // functions-info
	pg_relation_filenode: [
		{ name: "pg_relation_filenode", params: [{ name: "relation", type: "regclass" }], origin: "harvested" },
	], // functions-admin
	pg_relation_filepath: [
		{ name: "pg_relation_filepath", params: [{ name: "relation", type: "regclass" }], origin: "harvested" },
	], // functions-admin
	pg_relation_size: [
		{
			name: "pg_relation_size",
			params: [
				{ name: "relation", type: "regclass" },
				{ name: "fork", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_reload_conf: [{ name: "pg_reload_conf", params: [], origin: "harvested" }], // functions-admin
	pg_replication_origin_advance: [
		{
			name: "pg_replication_origin_advance",
			params: [
				{ name: "node_name", type: "text" },
				{ name: "lsn", type: "pg_lsn" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_replication_origin_create: [
		{ name: "pg_replication_origin_create", params: [{ name: "node_name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_replication_origin_drop: [
		{ name: "pg_replication_origin_drop", params: [{ name: "node_name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_replication_origin_oid: [
		{ name: "pg_replication_origin_oid", params: [{ name: "node_name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_replication_origin_progress: [
		{
			name: "pg_replication_origin_progress",
			params: [
				{ name: "node_name", type: "text" },
				{ name: "flush", type: "boolean" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_replication_origin_session_is_setup: [
		{ name: "pg_replication_origin_session_is_setup", params: [], origin: "harvested" },
	], // functions-admin
	pg_replication_origin_session_progress: [
		{
			name: "pg_replication_origin_session_progress",
			params: [{ name: "flush", type: "boolean" }],
			origin: "harvested",
		},
	], // functions-admin
	pg_replication_origin_session_reset: [
		{ name: "pg_replication_origin_session_reset", params: [], origin: "harvested" },
	], // functions-admin
	pg_replication_origin_session_setup: [
		{
			name: "pg_replication_origin_session_setup",
			params: [{ name: "node_name", type: "text" }],
			origin: "harvested",
		},
	], // functions-admin
	pg_replication_origin_xact_reset: [{ name: "pg_replication_origin_xact_reset", params: [], origin: "harvested" }], // functions-admin
	pg_replication_origin_xact_setup: [
		{
			name: "pg_replication_origin_xact_setup",
			params: [
				{ name: "origin_lsn", type: "pg_lsn" },
				{ name: "origin_timestamp", type: "timestamp with time zone" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_replication_slot_advance: [
		{
			name: "pg_replication_slot_advance",
			params: [
				{ name: "slot_name", type: "name" },
				{ name: "upto_lsn", type: "pg_lsn" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_restore_attribute_stats: [
		{
			name: "pg_restore_attribute_stats",
			params: [{ name: "kwargs", type: '"any"' }],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_restore_relation_stats: [
		{
			name: "pg_restore_relation_stats",
			params: [{ name: "kwargs", type: '"any"' }],
			variadic: true,
			origin: "harvested",
		},
	], // functions-admin
	pg_rotate_logfile: [{ name: "pg_rotate_logfile", params: [], origin: "harvested" }], // functions-admin
	pg_safe_snapshot_blocking_pids: [
		{ name: "pg_safe_snapshot_blocking_pids", params: [{ name: "integer" }], origin: "harvested" },
	], // functions-info
	pg_settings_get_flags: [
		{ name: "pg_settings_get_flags", params: [{ name: "guc", type: "text" }], origin: "harvested" },
	], // functions-info
	pg_size_bytes: [{ name: "pg_size_bytes", params: [{ name: "text" }], origin: "harvested" }], // functions-admin
	pg_size_pretty: [
		{ name: "pg_size_pretty", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "pg_size_pretty", params: [{ name: "numeric" }], origin: "harvested" },
	], // functions-admin
	pg_snapshot_xip: [{ name: "pg_snapshot_xip", params: [{ name: "pg_snapshot" }], origin: "harvested" }], // functions-info
	pg_snapshot_xmax: [{ name: "pg_snapshot_xmax", params: [{ name: "pg_snapshot" }], origin: "harvested" }], // functions-info
	pg_snapshot_xmin: [{ name: "pg_snapshot_xmin", params: [{ name: "pg_snapshot" }], origin: "harvested" }], // functions-info
	pg_split_walfile_name: [
		{ name: "pg_split_walfile_name", params: [{ name: "file_name", type: "text" }], origin: "harvested" },
	], // functions-admin
	pg_stat_file: [
		{
			name: "pg_stat_file",
			params: [
				{ name: "filename", type: "text" },
				{ name: "missing_ok", type: "boolean", optional: true },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_statistics_obj_is_visible: [
		{ name: "pg_statistics_obj_is_visible", params: [{ name: "stat", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_switch_wal: [{ name: "pg_switch_wal", params: [], origin: "harvested" }], // functions-admin
	pg_sync_replication_slots: [{ name: "pg_sync_replication_slots", params: [], origin: "harvested" }], // functions-admin
	pg_table_is_visible: [
		{ name: "pg_table_is_visible", params: [{ name: "table", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_table_size: [{ name: "pg_table_size", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_tablespace_databases: [
		{ name: "pg_tablespace_databases", params: [{ name: "tablespace", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_tablespace_location: [
		{ name: "pg_tablespace_location", params: [{ name: "tablespace", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_tablespace_size: [
		{ name: "pg_tablespace_size", params: [{ name: "name" }], origin: "harvested" },
		{ name: "pg_tablespace_size", params: [{ name: "oid" }], origin: "harvested" },
	], // functions-admin
	pg_total_relation_size: [{ name: "pg_total_relation_size", params: [{ name: "regclass" }], origin: "harvested" }], // functions-admin
	pg_trigger_depth: [{ name: "pg_trigger_depth", params: [], origin: "harvested" }], // functions-info
	pg_try_advisory_lock: [
		{
			name: "pg_try_advisory_lock",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_try_advisory_lock", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_try_advisory_lock_shared: [
		{
			name: "pg_try_advisory_lock_shared",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_try_advisory_lock_shared", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_try_advisory_xact_lock: [
		{
			name: "pg_try_advisory_xact_lock",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_try_advisory_xact_lock", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_try_advisory_xact_lock_shared: [
		{
			name: "pg_try_advisory_xact_lock_shared",
			params: [
				{ name: "key1", type: "integer" },
				{ name: "key2", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "pg_try_advisory_xact_lock_shared", params: [{ name: "key", type: "bigint" }], origin: "harvested" },
	], // functions-admin
	pg_ts_config_is_visible: [
		{ name: "pg_ts_config_is_visible", params: [{ name: "config", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_ts_dict_is_visible: [
		{ name: "pg_ts_dict_is_visible", params: [{ name: "dict", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_ts_parser_is_visible: [
		{ name: "pg_ts_parser_is_visible", params: [{ name: "parser", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_ts_template_is_visible: [
		{ name: "pg_ts_template_is_visible", params: [{ name: "template", type: "oid" }], origin: "harvested" },
	], // functions-info
	pg_type_is_visible: [{ name: "pg_type_is_visible", params: [{ name: "type", type: "oid" }], origin: "harvested" }], // functions-info
	pg_typeof: [{ name: "pg_typeof", params: [{ name: '"any"' }], origin: "harvested" }], // functions-info
	pg_visible_in_snapshot: [
		{ name: "pg_visible_in_snapshot", params: [{ name: "xid8" }, { name: "pg_snapshot" }], origin: "harvested" },
	], // functions-info
	pg_wal_lsn_diff: [
		{
			name: "pg_wal_lsn_diff",
			params: [
				{ name: "lsn1", type: "pg_lsn" },
				{ name: "lsn2", type: "pg_lsn" },
			],
			origin: "harvested",
		},
	], // functions-admin
	pg_wal_replay_pause: [{ name: "pg_wal_replay_pause", params: [], origin: "harvested" }], // functions-admin
	pg_wal_replay_resume: [{ name: "pg_wal_replay_resume", params: [], origin: "harvested" }], // functions-admin
	pg_wal_summary_contents: [
		{
			name: "pg_wal_summary_contents",
			params: [
				{ name: "tli", type: "bigint" },
				{ name: "start_lsn", type: "pg_lsn" },
				{ name: "end_lsn", type: "pg_lsn" },
			],
			origin: "harvested",
		},
	], // functions-info
	pg_walfile_name: [{ name: "pg_walfile_name", params: [{ name: "lsn", type: "pg_lsn" }], origin: "harvested" }], // functions-admin
	pg_walfile_name_offset: [
		{ name: "pg_walfile_name_offset", params: [{ name: "lsn", type: "pg_lsn" }], origin: "harvested" },
	], // functions-admin
	pg_xact_commit_timestamp: [{ name: "pg_xact_commit_timestamp", params: [{ name: "xid" }], origin: "harvested" }], // functions-info
	pg_xact_commit_timestamp_origin: [
		{ name: "pg_xact_commit_timestamp_origin", params: [{ name: "xid" }], origin: "harvested" },
	], // functions-info
	pg_xact_status: [{ name: "pg_xact_status", params: [{ name: "xid8" }], origin: "harvested" }], // functions-info
	pi: [{ name: "pi", params: [], origin: "harvested" }], // functions-math
	point: [
		{ name: "point", params: [{ name: "double precision" }, { name: "double precision" }], origin: "harvested" },
		{ name: "point", params: [{ name: "box" }], origin: "harvested" },
		{ name: "point", params: [{ name: "circle" }], origin: "harvested" },
		{ name: "point", params: [{ name: "lseg" }], origin: "harvested" },
		{ name: "point", params: [{ name: "polygon" }], origin: "harvested" },
	], // functions-geometry
	polygon: [
		{ name: "polygon", params: [{ name: "integer" }, { name: "circle" }], origin: "harvested" },
		{ name: "polygon", params: [{ name: "box" }], origin: "harvested" },
		{ name: "polygon", params: [{ name: "circle" }], origin: "harvested" },
		{ name: "polygon", params: [{ name: "path" }], origin: "harvested" },
	], // functions-geometry
	popen: [{ name: "popen", params: [{ name: "path" }], origin: "harvested" }], // functions-geometry
	position: [
		{
			name: "position",
			params: [
				{ name: "substring", type: "text" },
				{ name: "string", type: "text" },
			],
			origin: "curated",
		},
	], // curated: position(substring in string)
	power: [
		{
			name: "power",
			params: [
				{ name: "a", type: "numeric" },
				{ name: "b", type: "numeric" },
			],
			origin: "harvested",
		},
		{
			name: "power",
			params: [
				{ name: "a", type: "double precision" },
				{ name: "b", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-math
	querytree: [{ name: "querytree", params: [{ name: "tsquery" }], origin: "harvested" }], // functions-textsearch
	quote_ident: [{ name: "quote_ident", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	quote_literal: [
		{ name: "quote_literal", params: [{ name: "text" }], origin: "harvested" },
		{ name: "quote_literal", params: [{ name: "anyelement" }], origin: "harvested" },
	], // functions-string
	quote_nullable: [
		{ name: "quote_nullable", params: [{ name: "text" }], origin: "harvested" },
		{ name: "quote_nullable", params: [{ name: "anyelement" }], origin: "harvested" },
	], // functions-string
	radians: [{ name: "radians", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	radius: [{ name: "radius", params: [{ name: "circle" }], origin: "harvested" }], // functions-geometry
	random: [
		{
			name: "random",
			params: [
				{ name: "min", type: "integer", optional: true },
				{ name: "max", type: "integer", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "random",
			params: [
				{ name: "min", type: "bigint" },
				{ name: "max", type: "bigint" },
			],
			origin: "harvested",
		},
		{
			name: "random",
			params: [
				{ name: "min", type: "numeric" },
				{ name: "max", type: "numeric" },
			],
			origin: "harvested",
		},
	], // functions-math
	random_normal: [
		{
			name: "random_normal",
			params: [
				{ name: "mean", type: "double precision", optional: true },
				{ name: "stddev", type: "double precision", optional: true },
			],
			origin: "harvested",
		},
	], // functions-math
	range_agg: [
		{ name: "range_agg", params: [{ name: "value", type: "anyrange" }], origin: "harvested" },
		{ name: "range_agg", params: [{ name: "value", type: "anymultirange" }], origin: "harvested" },
	], // functions-aggregate
	range_intersect_agg: [
		{ name: "range_intersect_agg", params: [{ name: "value", type: "anyrange" }], origin: "harvested" },
		{ name: "range_intersect_agg", params: [{ name: "value", type: "anymultirange" }], origin: "harvested" },
	], // functions-aggregate
	range_merge: [
		{ name: "range_merge", params: [{ name: "anyrange" }, { name: "anyrange" }], origin: "harvested" },
		{ name: "range_merge", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	rank: [{ name: "rank", params: [{ name: "args", optional: true }], origin: "harvested" }], // functions-aggregate
	regexp_count: [
		{
			name: "regexp_count",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "start", type: "integer", optional: true },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_instr: [
		{
			name: "regexp_instr",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "start", type: "integer", optional: true },
				{ name: "N", type: "integer", optional: true },
				{ name: "endoption", type: "integer", optional: true },
				{ name: "flags", type: "text", optional: true },
				{ name: "subexpr", type: "integer", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_like: [
		{
			name: "regexp_like",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_match: [
		{
			name: "regexp_match",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_matches: [
		{
			name: "regexp_matches",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_replace: [
		{
			name: "regexp_replace",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "replacement", type: "text" },
				{ name: "start", type: "integer" },
				{ name: "N", type: "integer", optional: true },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "regexp_replace",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "replacement", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_split_to_array: [
		{
			name: "regexp_split_to_array",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_split_to_table: [
		{
			name: "regexp_split_to_table",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "flags", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regexp_substr: [
		{
			name: "regexp_substr",
			params: [
				{ name: "string", type: "text" },
				{ name: "pattern", type: "text" },
				{ name: "start", type: "integer", optional: true },
				{ name: "N", type: "integer", optional: true },
				{ name: "flags", type: "text", optional: true },
				{ name: "subexpr", type: "integer", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	regr_avgx: [
		{
			name: "regr_avgx",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_avgy: [
		{
			name: "regr_avgy",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_count: [
		{
			name: "regr_count",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_intercept: [
		{
			name: "regr_intercept",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_r2: [
		{
			name: "regr_r2",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_slope: [
		{
			name: "regr_slope",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_sxx: [
		{
			name: "regr_sxx",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_sxy: [
		{
			name: "regr_sxy",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	regr_syy: [
		{
			name: "regr_syy",
			params: [
				{ name: "Y", type: "double precision" },
				{ name: "X", type: "double precision" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	repeat: [
		{
			name: "repeat",
			params: [
				{ name: "string", type: "text" },
				{ name: "number", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-string
	replace: [
		{
			name: "replace",
			params: [
				{ name: "string", type: "text" },
				{ name: "from", type: "text" },
				{ name: "to", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-string
	reverse: [
		{ name: "reverse", params: [{ name: "text" }], origin: "harvested" },
		{ name: "reverse", params: [{ name: "bytea" }], origin: "harvested" },
	], // functions-string, functions-binarystring
	right: [
		{
			name: "right",
			params: [
				{ name: "string", type: "text" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-string
	round: [
		{
			name: "round",
			params: [
				{ name: "v", type: "numeric" },
				{ name: "s", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "round", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "round", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	row_number: [{ name: "row_number", params: [], origin: "harvested" }], // functions-window
	row_to_json: [
		{ name: "row_to_json", params: [{ name: "record" }, { name: "boolean", optional: true }], origin: "harvested" },
	], // functions-json
	rpad: [
		{
			name: "rpad",
			params: [
				{ name: "string", type: "text" },
				{ name: "length", type: "integer" },
				{ name: "fill", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	rtrim: [
		{
			name: "rtrim",
			params: [
				{ name: "string", type: "text" },
				{ name: "characters", type: "text", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "rtrim",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "bytesremoved", type: "bytea" },
			],
			origin: "harvested",
		},
	], // functions-string, functions-binarystring
	scale: [{ name: "scale", params: [{ name: "numeric" }], origin: "harvested" }], // functions-math
	session_user: [{ name: "session_user", params: [], origin: "harvested" }], // functions-info
	set_bit: [
		{
			name: "set_bit",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "n", type: "bigint" },
				{ name: "newvalue", type: "integer" },
			],
			origin: "harvested",
		},
		{
			name: "set_bit",
			params: [
				{ name: "bits", type: "bit" },
				{ name: "n", type: "integer" },
				{ name: "newvalue", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-binarystring, functions-bitstring
	set_byte: [
		{
			name: "set_byte",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "n", type: "integer" },
				{ name: "newvalue", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-binarystring
	set_config: [
		{
			name: "set_config",
			params: [
				{ name: "setting_name", type: "text" },
				{ name: "new_value", type: "text" },
				{ name: "is_local", type: "boolean" },
			],
			origin: "harvested",
		},
	], // functions-admin
	set_masklen: [
		{ name: "set_masklen", params: [{ name: "inet" }, { name: "integer" }], origin: "harvested" },
		{ name: "set_masklen", params: [{ name: "cidr" }, { name: "integer" }], origin: "harvested" },
	], // functions-net
	setseed: [{ name: "setseed", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	setval: [
		{
			name: "setval",
			params: [{ name: "regclass" }, { name: "bigint" }, { name: "boolean", optional: true }],
			origin: "harvested",
		},
	], // functions-sequence
	setweight: [
		{
			name: "setweight",
			params: [
				{ name: "vector", type: "tsvector" },
				{ name: "weight", type: '"char"' },
				{ name: "lexemes", type: "text[]", optional: true },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	sha224: [{ name: "sha224", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	sha256: [{ name: "sha256", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	sha384: [{ name: "sha384", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	sha512: [{ name: "sha512", params: [{ name: "bytea" }], origin: "harvested" }], // functions-binarystring
	shobj_description: [
		{
			name: "shobj_description",
			params: [
				{ name: "object", type: "oid" },
				{ name: "catalog", type: "name" },
			],
			origin: "harvested",
		},
	], // functions-info
	sign: [
		{ name: "sign", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "sign", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	sin: [{ name: "sin", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	sind: [{ name: "sind", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	sinh: [{ name: "sinh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	slope: [{ name: "slope", params: [{ name: "point" }, { name: "point" }], origin: "harvested" }], // functions-geometry
	split_part: [
		{
			name: "split_part",
			params: [
				{ name: "string", type: "text" },
				{ name: "delimiter", type: "text" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-string
	sqrt: [
		{ name: "sqrt", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "sqrt", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-math
	starts_with: [
		{
			name: "starts_with",
			params: [
				{ name: "string", type: "text" },
				{ name: "prefix", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-string
	statement_timestamp: [{ name: "statement_timestamp", params: [], origin: "harvested" }], // functions-datetime
	stddev: [{ name: "stddev", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	stddev_pop: [{ name: "stddev_pop", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	stddev_samp: [{ name: "stddev_samp", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	string_agg: [
		{
			name: "string_agg",
			params: [
				{ name: "value", type: "text" },
				{ name: "delimiter", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-aggregate
	string_to_array: [
		{
			name: "string_to_array",
			params: [
				{ name: "string", type: "text" },
				{ name: "delimiter", type: "text" },
				{ name: "null_string", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	string_to_table: [
		{
			name: "string_to_table",
			params: [
				{ name: "string", type: "text" },
				{ name: "delimiter", type: "text" },
				{ name: "null_string", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string
	strip: [{ name: "strip", params: [{ name: "tsvector" }], origin: "harvested" }], // functions-textsearch
	strpos: [
		{
			name: "strpos",
			params: [
				{ name: "string", type: "text" },
				{ name: "substring", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-string
	substr: [
		{
			name: "substr",
			params: [
				{ name: "string", type: "text" },
				{ name: "start", type: "integer" },
				{ name: "count", type: "integer", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "substr",
			params: [
				{ name: "bytes", type: "bytea" },
				{ name: "start", type: "integer" },
				{ name: "count", type: "integer", optional: true },
			],
			origin: "harvested",
		},
	], // functions-string, functions-binarystring
	substring: [
		{
			name: "substring",
			params: [
				{ name: "string", type: "text" },
				{ name: "start", type: "int" },
				{ name: "count", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: substring(string, start [, count]) - pg_proc oids 936/937
	sum: [
		{ name: "sum", params: [{ name: "smallint" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "bigint" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "real" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "double precision" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "interval" }], origin: "harvested" },
		{ name: "sum", params: [{ name: "money" }], origin: "harvested" },
	], // functions-aggregate
	suppress_redundant_updates_trigger: [
		{ name: "suppress_redundant_updates_trigger", params: [], origin: "harvested" },
	], // functions-trigger
	system_user: [{ name: "system_user", params: [], origin: "harvested" }], // functions-info
	tan: [{ name: "tan", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	tand: [{ name: "tand", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	tanh: [{ name: "tanh", params: [{ name: "double precision" }], origin: "harvested" }], // functions-math
	text: [{ name: "text", params: [{ name: "inet" }], origin: "harvested" }], // functions-net
	timeofday: [{ name: "timeofday", params: [], origin: "harvested" }], // functions-datetime
	to_ascii: [
		{
			name: "to_ascii",
			params: [
				{ name: "string", type: "text" },
				{ name: "encoding", type: "name", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "to_ascii",
			params: [
				{ name: "string", type: "text" },
				{ name: "encoding", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-string
	to_bin: [
		{ name: "to_bin", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "to_bin", params: [{ name: "bigint" }], origin: "harvested" },
	], // functions-string
	to_char: [
		{ name: "to_char", params: [{ name: "timestamp" }, { name: "text" }], origin: "harvested" },
		{ name: "to_char", params: [{ name: "timestamp with time zone" }, { name: "text" }], origin: "harvested" },
		{ name: "to_char", params: [{ name: "interval" }, { name: "text" }], origin: "harvested" },
		{ name: "to_char", params: [{ name: "numeric_type" }, { name: "text" }], origin: "harvested" },
	], // functions-formatting
	to_date: [
		{
			name: "to_date",
			params: [
				{ name: "text", type: "text" },
				{ name: "format", type: "text" },
			],
			origin: "curated",
		},
	], // curated: to_date(text, format)
	to_hex: [
		{ name: "to_hex", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "to_hex", params: [{ name: "bigint" }], origin: "harvested" },
	], // functions-string
	to_json: [{ name: "to_json", params: [{ name: "anyelement" }], origin: "harvested" }], // functions-json
	to_jsonb: [{ name: "to_jsonb", params: [{ name: "anyelement" }], origin: "harvested" }], // functions-json
	to_number: [
		{
			name: "to_number",
			params: [
				{ name: "text", type: "text" },
				{ name: "format", type: "text" },
			],
			origin: "curated",
		},
	], // curated: to_number(text, format)
	to_oct: [
		{ name: "to_oct", params: [{ name: "integer" }], origin: "harvested" },
		{ name: "to_oct", params: [{ name: "bigint" }], origin: "harvested" },
	], // functions-string
	to_regclass: [{ name: "to_regclass", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regcollation: [{ name: "to_regcollation", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regnamespace: [{ name: "to_regnamespace", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regoper: [{ name: "to_regoper", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regoperator: [{ name: "to_regoperator", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regproc: [{ name: "to_regproc", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regprocedure: [{ name: "to_regprocedure", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regrole: [{ name: "to_regrole", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regtype: [{ name: "to_regtype", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_regtypemod: [{ name: "to_regtypemod", params: [{ name: "text" }], origin: "harvested" }], // functions-info
	to_timestamp: [
		{ name: "to_timestamp", params: [{ name: "text" }, { name: "text" }], origin: "harvested" },
		{ name: "to_timestamp", params: [{ name: "double precision" }], origin: "harvested" },
	], // functions-formatting, functions-datetime
	transaction_timestamp: [{ name: "transaction_timestamp", params: [], origin: "harvested" }], // functions-datetime
	translate: [
		{
			name: "translate",
			params: [
				{ name: "string", type: "text" },
				{ name: "from", type: "text" },
				{ name: "to", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-string
	trim_array: [
		{
			name: "trim_array",
			params: [
				{ name: "array", type: "anyarray" },
				{ name: "n", type: "integer" },
			],
			origin: "harvested",
		},
	], // functions-array
	trim_scale: [{ name: "trim_scale", params: [{ name: "numeric" }], origin: "harvested" }], // functions-math
	trunc: [
		{
			name: "trunc",
			params: [
				{ name: "v", type: "numeric" },
				{ name: "s", type: "integer" },
			],
			origin: "harvested",
		},
		{ name: "trunc", params: [{ name: "numeric" }], origin: "harvested" },
		{ name: "trunc", params: [{ name: "double precision" }], origin: "harvested" },
		{ name: "trunc", params: [{ name: "macaddr" }], origin: "harvested" },
		{ name: "trunc", params: [{ name: "macaddr8" }], origin: "harvested" },
	], // functions-math, functions-net
	ts_delete: [
		{
			name: "ts_delete",
			params: [
				{ name: "vector", type: "tsvector" },
				{ name: "lexeme", type: "text" },
			],
			origin: "harvested",
		},
		{
			name: "ts_delete",
			params: [
				{ name: "vector", type: "tsvector" },
				{ name: "lexemes", type: "text[]" },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_filter: [
		{
			name: "ts_filter",
			params: [
				{ name: "vector", type: "tsvector" },
				{ name: "weights", type: '"char"[]' },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_lexize: [
		{
			name: "ts_lexize",
			params: [
				{ name: "dict", type: "regdictionary" },
				{ name: "token", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_parse: [
		{
			name: "ts_parse",
			params: [
				{ name: "parser_name", type: "text" },
				{ name: "document", type: "text" },
			],
			origin: "harvested",
		},
		{
			name: "ts_parse",
			params: [
				{ name: "parser_oid", type: "oid" },
				{ name: "document", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_rewrite: [
		{
			name: "ts_rewrite",
			params: [
				{ name: "query", type: "tsquery" },
				{ name: "target", type: "tsquery" },
				{ name: "substitute", type: "tsquery" },
			],
			origin: "harvested",
		},
		{
			name: "ts_rewrite",
			params: [
				{ name: "query", type: "tsquery" },
				{ name: "select", type: "text" },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_stat: [
		{
			name: "ts_stat",
			params: [
				{ name: "sqlquery", type: "text" },
				{ name: "weights", type: "text", optional: true },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	ts_token_type: [
		{ name: "ts_token_type", params: [{ name: "parser_name", type: "text" }], origin: "harvested" },
		{ name: "ts_token_type", params: [{ name: "parser_oid", type: "oid" }], origin: "harvested" },
	], // functions-textsearch
	tsquery_phrase: [
		{
			name: "tsquery_phrase",
			params: [
				{ name: "query1", type: "tsquery" },
				{ name: "query2", type: "tsquery" },
				{ name: "distance", type: "integer", optional: true },
			],
			origin: "harvested",
		},
	], // functions-textsearch
	tsvector_to_array: [{ name: "tsvector_to_array", params: [{ name: "tsvector" }], origin: "harvested" }], // functions-textsearch
	tsvector_update_trigger: [{ name: "tsvector_update_trigger", params: [], origin: "harvested" }], // functions-trigger
	tsvector_update_trigger_column: [{ name: "tsvector_update_trigger_column", params: [], origin: "harvested" }], // functions-trigger
	txid_current: [{ name: "txid_current", params: [], origin: "harvested" }], // functions-info
	txid_current_if_assigned: [{ name: "txid_current_if_assigned", params: [], origin: "harvested" }], // functions-info
	txid_current_snapshot: [{ name: "txid_current_snapshot", params: [], origin: "harvested" }], // functions-info
	txid_snapshot_xip: [{ name: "txid_snapshot_xip", params: [{ name: "txid_snapshot" }], origin: "harvested" }], // functions-info
	txid_snapshot_xmax: [{ name: "txid_snapshot_xmax", params: [{ name: "txid_snapshot" }], origin: "harvested" }], // functions-info
	txid_snapshot_xmin: [{ name: "txid_snapshot_xmin", params: [{ name: "txid_snapshot" }], origin: "harvested" }], // functions-info
	txid_status: [{ name: "txid_status", params: [{ name: "bigint" }], origin: "harvested" }], // functions-info
	txid_visible_in_snapshot: [
		{
			name: "txid_visible_in_snapshot",
			params: [{ name: "bigint" }, { name: "txid_snapshot" }],
			origin: "harvested",
		},
	], // functions-info
	unicode_assigned: [{ name: "unicode_assigned", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	unicode_version: [{ name: "unicode_version", params: [], origin: "harvested" }], // functions-info
	unistr: [{ name: "unistr", params: [{ name: "text" }], origin: "harvested" }], // functions-string
	unnest: [
		{
			name: "unnest",
			params: [{ name: "anyarray" }, { name: "anyarray", optional: true }],
			variadic: true,
			origin: "harvested",
		},
		{ name: "unnest", params: [{ name: "tsvector" }], origin: "harvested" },
		{ name: "unnest", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-array, functions-textsearch, functions-range
	upper: [
		{ name: "upper", params: [{ name: "text" }], origin: "harvested" },
		{ name: "upper", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "upper", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-string, functions-range
	upper_inc: [
		{ name: "upper_inc", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "upper_inc", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	upper_inf: [
		{ name: "upper_inf", params: [{ name: "anyrange" }], origin: "harvested" },
		{ name: "upper_inf", params: [{ name: "anymultirange" }], origin: "harvested" },
	], // functions-range
	user: [{ name: "user", params: [], origin: "harvested" }], // functions-info
	uuid_extract_timestamp: [{ name: "uuid_extract_timestamp", params: [{ name: "uuid" }], origin: "harvested" }], // functions-uuid
	uuid_extract_version: [{ name: "uuid_extract_version", params: [{ name: "uuid" }], origin: "harvested" }], // functions-uuid
	uuidv4: [{ name: "uuidv4", params: [], origin: "harvested" }], // functions-uuid
	uuidv7: [{ name: "uuidv7", params: [{ name: "shift", type: "interval", optional: true }], origin: "harvested" }], // functions-uuid
	var_pop: [{ name: "var_pop", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	var_samp: [{ name: "var_samp", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	variance: [{ name: "variance", params: [{ name: "numeric_type" }], origin: "harvested" }], // functions-aggregate
	version: [{ name: "version", params: [], origin: "harvested" }], // functions-info
	width: [{ name: "width", params: [{ name: "box" }], origin: "harvested" }], // functions-geometry
	width_bucket: [
		{
			name: "width_bucket",
			params: [
				{ name: "operand", type: "numeric" },
				{ name: "low", type: "numeric" },
				{ name: "high", type: "numeric" },
				{ name: "count", type: "integer" },
			],
			origin: "harvested",
		},
		{
			name: "width_bucket",
			params: [
				{ name: "operand", type: "double precision" },
				{ name: "low", type: "double precision" },
				{ name: "high", type: "double precision" },
				{ name: "count", type: "integer" },
			],
			origin: "harvested",
		},
		{
			name: "width_bucket",
			params: [
				{ name: "operand", type: "anycompatible" },
				{ name: "thresholds", type: "anycompatiblearray" },
			],
			origin: "harvested",
		},
	], // functions-math
	xmlagg: [{ name: "xmlagg", params: [{ name: "xml" }], origin: "harvested" }], // functions-xml
	xmlcomment: [{ name: "xmlcomment", params: [{ name: "text" }], origin: "harvested" }], // functions-xml
	xmlconcat: [{ name: "xmlconcat", params: [{ name: "xml" }], variadic: true, origin: "harvested" }], // functions-xml
	xmltext: [{ name: "xmltext", params: [{ name: "text" }], origin: "harvested" }], // functions-xml
	xpath: [
		{
			name: "xpath",
			params: [
				{ name: "xpath", type: "text" },
				{ name: "xml", type: "xml" },
				{ name: "nsarray", type: "text[]", optional: true },
			],
			origin: "harvested",
		},
	], // functions-xml
	xpath_exists: [
		{
			name: "xpath_exists",
			params: [
				{ name: "xpath", type: "text" },
				{ name: "xml", type: "xml" },
				{ name: "nsarray", type: "text[]", optional: true },
			],
			origin: "harvested",
		},
	], // functions-xml
};
