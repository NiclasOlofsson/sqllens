// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: MicrosoftDocs/sql-docs  docs/t-sql/{functions,language-elements}/**/*.md (```syntaxsql``` blocks)
// Overrides source: tools/signature-overrides/tsql.mjs
// Built 2026-07-14. 205 names (7 curated, 198 harvested), 1 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for tsql: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const TSQL_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "ABS", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/abs-transact-sql.md
	acos: [{ name: "ACOS", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/acos-transact-sql.md
	any_value: [{ name: "ANY_VALUE", params: [{ name: "expression" }], origin: "harvested" }], // functions/any-value-transact-sql.md
	app_name: [{ name: "APP_NAME", params: [], origin: "harvested" }], // functions/app-name-transact-sql.md
	approx_count_distinct: [{ name: "APPROX_COUNT_DISTINCT", params: [{ name: "expression" }], origin: "harvested" }], // functions/approx-count-distinct-transact-sql.md
	approx_percentile_cont: [
		{ name: "APPROX_PERCENTILE_CONT", params: [{ name: "numeric_literal" }], origin: "harvested" },
	], // functions/approx-percentile-cont-transact-sql.md
	approx_percentile_disc: [
		{ name: "APPROX_PERCENTILE_DISC", params: [{ name: "numeric_literal" }], origin: "harvested" },
	], // functions/approx-percentile-disc-transact-sql.md
	ascii: [{ name: "ASCII", params: [{ name: "character_expression" }], origin: "harvested" }], // functions/ascii-transact-sql.md
	asin: [{ name: "ASIN", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/asin-transact-sql.md
	atan: [{ name: "ATAN", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/atan-transact-sql.md
	atn2: [{ name: "ATN2", params: [{ name: "float_expression" }, { name: "float_expression" }], origin: "harvested" }], // functions/atn2-transact-sql.md
	avg: [{ name: "AVG", params: [{ name: "expression" }], origin: "harvested" }], // functions/avg-transact-sql.md
	base64_decode: [{ name: "BASE64_DECODE", params: [{ name: "expression" }], origin: "harvested" }], // functions/base64-decode-transact-sql.md
	base64_encode: [
		{
			name: "BASE64_ENCODE",
			params: [{ name: "expression" }, { name: "url_safe", optional: true }],
			origin: "harvested",
		},
	], // functions/base64-encode-transact-sql.md
	bit_count: [{ name: "BIT_COUNT", params: [{ name: "expression_value" }], origin: "harvested" }], // functions/bit-count-transact-sql.md
	cast: [{ name: "CAST", params: [{ name: "expression" }, { name: "data_type" }], origin: "curated" }], // curated: CAST (Transact-SQL)
	ceiling: [{ name: "CEILING", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/ceiling-transact-sql.md
	certencoded: [{ name: "CERTENCODED", params: [{ name: "cert_id" }], origin: "harvested" }], // functions/certencoded-transact-sql.md
	char: [{ name: "CHAR", params: [{ name: "integer_expression" }], origin: "harvested" }], // functions/char-transact-sql.md
	charindex: [
		{
			name: "CHARINDEX",
			params: [
				{ name: "expressionToFind" },
				{ name: "expressionToSearch" },
				{ name: "start_location", optional: true },
			],
			origin: "harvested",
		},
	], // functions/charindex-transact-sql.md
	checksum_agg: [{ name: "CHECKSUM_AGG", params: [{ name: "expression" }], origin: "harvested" }], // functions/checksum-agg-transact-sql.md
	choose: [
		{
			name: "CHOOSE",
			params: [{ name: "index", type: "int" }, { name: "val_1" }, { name: "val_2" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: CHOOSE (Transact-SQL) - CHOOSE ( index, val_1, val_2 [, val_n ] ): the docs' `val_n` convention is a repeating tail, not one more optional param, which the harvester's dots-only variadic detection missed (the harvest itself now recovers val_n as a fourth, non-variadic optional param, which would wrongly cap the call at 4 args)
	coalesce: [{ name: "COALESCE", params: [{ name: "expression" }], variadic: true, origin: "harvested" }], // language-elements/coalesce-transact-sql.md
	col_name: [{ name: "COL_NAME", params: [{ name: "table_id" }, { name: "column_id" }], origin: "harvested" }], // functions/col-name-transact-sql.md
	collationproperty: [
		{ name: "COLLATIONPROPERTY", params: [{ name: "collation_name" }, { name: "property" }], origin: "harvested" },
	], // functions/collation-functions-collationproperty-transact-sql.md
	columnproperty: [
		{
			name: "COLUMNPROPERTY",
			params: [{ name: "id" }, { name: "column" }, { name: "property" }],
			origin: "harvested",
		},
	], // functions/columnproperty-transact-sql.md
	columns_updated: [{ name: "COLUMNS_UPDATED", params: [], origin: "harvested" }], // functions/columns-updated-transact-sql.md
	compress: [{ name: "COMPRESS", params: [{ name: "expression" }], origin: "harvested" }], // functions/compress-transact-sql.md
	concat: [
		{
			name: "CONCAT",
			params: [{ name: "argument1" }, { name: "argument2" }, { name: "argumentN", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // functions/concat-transact-sql.md
	concat_ws: [
		{
			name: "CONCAT_WS",
			params: [
				{ name: "separator" },
				{ name: "argument1" },
				{ name: "argument2" },
				{ name: "argumentN", optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // functions/concat-ws-transact-sql.md
	connectionproperty: [{ name: "CONNECTIONPROPERTY", params: [{ name: "property" }], origin: "harvested" }], // functions/connectionproperty-transact-sql.md
	context_info: [{ name: "CONTEXT_INFO", params: [], origin: "harvested" }], // functions/context-info-transact-sql.md
	convert: [
		{
			name: "CONVERT",
			params: [{ name: "data_type" }, { name: "expression" }, { name: "style", type: "int", optional: true }],
			origin: "curated",
		},
	], // curated: CONVERT (Transact-SQL) - CONVERT ( data_type [ ( length ) ] , expression [ , style ] ): style is bracketed/optional
	cos: [{ name: "COS", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/cos-transact-sql.md
	cot: [{ name: "COT", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/cot-transact-sql.md
	count: [{ name: "COUNT", params: [{ name: "expression" }], origin: "curated" }], // curated: COUNT (Transact-SQL)
	crypt_gen_random: [
		{
			name: "CRYPT_GEN_RANDOM",
			params: [{ name: "length" }, { name: "seed", optional: true }],
			origin: "harvested",
		},
	], // functions/crypt-gen-random-transact-sql.md
	cume_dist: [{ name: "CUME_DIST", params: [], origin: "harvested" }], // functions/cume-dist-transact-sql.md
	current_request_id: [{ name: "CURRENT_REQUEST_ID", params: [], origin: "harvested" }], // functions/current-request-id-transact-sql.md
	current_timezone: [{ name: "CURRENT_TIMEZONE", params: [], origin: "harvested" }], // functions/current-timezone-transact-sql.md
	current_timezone_id: [{ name: "CURRENT_TIMEZONE_ID", params: [], origin: "harvested" }], // functions/current-timezone-id-transact-sql.md
	current_transaction_id: [{ name: "CURRENT_TRANSACTION_ID", params: [], origin: "harvested" }], // functions/current-transaction-id-transact-sql.md
	databasepropertyex: [
		{ name: "DATABASEPROPERTYEX", params: [{ name: "database" }, { name: "property" }], origin: "harvested" },
	], // functions/databasepropertyex-transact-sql.md
	datalength: [{ name: "DATALENGTH", params: [{ name: "expression" }], origin: "harvested" }], // functions/datalength-transact-sql.md
	date_bucket: [
		{
			name: "DATE_BUCKET",
			params: [{ name: "datepart" }, { name: "number" }, { name: "date" }, { name: "origin", optional: true }],
			origin: "harvested",
		},
	], // functions/date-bucket-transact-sql.md
	dateadd: [
		{ name: "DATEADD", params: [{ name: "datepart" }, { name: "number" }, { name: "date" }], origin: "harvested" },
	], // functions/dateadd-transact-sql.md
	datediff: [
		{
			name: "DATEDIFF",
			params: [{ name: "datepart" }, { name: "startdate" }, { name: "enddate" }],
			origin: "harvested",
		},
	], // functions/datediff-transact-sql.md
	datediff_big: [
		{
			name: "DATEDIFF_BIG",
			params: [{ name: "datepart" }, { name: "startdate" }, { name: "enddate" }],
			origin: "harvested",
		},
	], // functions/datediff-big-transact-sql.md
	datefromparts: [
		{ name: "DATEFROMPARTS", params: [{ name: "year" }, { name: "month" }, { name: "day" }], origin: "harvested" },
	], // functions/datefromparts-transact-sql.md
	datename: [{ name: "DATENAME", params: [{ name: "datepart" }, { name: "date" }], origin: "harvested" }], // functions/datename-transact-sql.md
	datepart: [{ name: "DATEPART", params: [{ name: "datepart" }, { name: "date" }], origin: "harvested" }], // functions/datepart-transact-sql.md
	datetime2fromparts: [
		{
			name: "DATETIME2FROMPARTS",
			params: [
				{ name: "year" },
				{ name: "month" },
				{ name: "day" },
				{ name: "hour" },
				{ name: "minute" },
				{ name: "seconds" },
				{ name: "fractions" },
				{ name: "precision" },
			],
			origin: "harvested",
		},
	], // functions/datetime2fromparts-transact-sql.md
	datetimefromparts: [
		{
			name: "DATETIMEFROMPARTS",
			params: [
				{ name: "year" },
				{ name: "month" },
				{ name: "day" },
				{ name: "hour" },
				{ name: "minute" },
				{ name: "seconds" },
				{ name: "milliseconds" },
			],
			origin: "harvested",
		},
	], // functions/datetimefromparts-transact-sql.md
	datetimeoffsetfromparts: [
		{
			name: "DATETIMEOFFSETFROMPARTS",
			params: [
				{ name: "year" },
				{ name: "month" },
				{ name: "day" },
				{ name: "hour" },
				{ name: "minute" },
				{ name: "seconds" },
				{ name: "fractions" },
				{ name: "hour_offset" },
				{ name: "minute_offset" },
				{ name: "precision" },
			],
			origin: "harvested",
		},
	], // functions/datetimeoffsetfromparts-transact-sql.md
	datetrunc: [{ name: "DATETRUNC", params: [{ name: "datepart" }, { name: "date" }], origin: "harvested" }], // functions/datetrunc-transact-sql.md
	day: [{ name: "DAY", params: [{ name: "date" }], origin: "harvested" }], // functions/day-transact-sql.md
	db_name: [{ name: "DB_NAME", params: [{ name: "database_id", optional: true }], origin: "harvested" }], // functions/db-name-transact-sql.md
	decompress: [{ name: "DECOMPRESS", params: [{ name: "expression" }], origin: "harvested" }], // functions/decompress-transact-sql.md
	degrees: [{ name: "DEGREES", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/degrees-transact-sql.md
	dense_rank: [{ name: "DENSE_RANK", params: [], origin: "harvested" }], // functions/dense-rank-transact-sql.md
	difference: [
		{
			name: "DIFFERENCE",
			params: [{ name: "character_expression" }, { name: "character_expression" }],
			origin: "harvested",
		},
	], // functions/difference-transact-sql.md
	edge_id_from_parts: [
		{ name: "EDGE_ID_FROM_PARTS", params: [{ name: "object_id" }, { name: "graph_id" }], origin: "harvested" },
	], // functions/edge-id-from-parts-transact-sql.md
	eomonth: [
		{
			name: "EOMONTH",
			params: [{ name: "start_date" }, { name: "month_to_add", optional: true }],
			origin: "harvested",
		},
	], // functions/eomonth-transact-sql.md
	error_line: [{ name: "ERROR_LINE", params: [], origin: "harvested" }], // functions/error-line-transact-sql.md
	error_message: [{ name: "ERROR_MESSAGE", params: [], origin: "harvested" }], // functions/error-message-transact-sql.md
	error_number: [{ name: "ERROR_NUMBER", params: [], origin: "harvested" }], // functions/error-number-transact-sql.md
	error_procedure: [{ name: "ERROR_PROCEDURE", params: [], origin: "harvested" }], // functions/error-procedure-transact-sql.md
	error_severity: [{ name: "ERROR_SEVERITY", params: [], origin: "harvested" }], // functions/error-severity-transact-sql.md
	error_state: [{ name: "ERROR_STATE", params: [], origin: "harvested" }], // functions/error-state-transact-sql.md
	eventdata: [{ name: "EVENTDATA", params: [], origin: "harvested" }], // functions/eventdata-transact-sql.md
	exp: [{ name: "EXP", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/exp-transact-sql.md
	file_id: [{ name: "FILE_ID", params: [{ name: "file_name" }], origin: "harvested" }], // functions/file-id-transact-sql.md
	file_idex: [{ name: "FILE_IDEX", params: [{ name: "file_name" }], origin: "harvested" }], // functions/file-idex-transact-sql.md
	file_name: [{ name: "FILE_NAME", params: [{ name: "file_id" }], origin: "harvested" }], // functions/file-name-transact-sql.md
	filegroup_name: [{ name: "FILEGROUP_NAME", params: [{ name: "filegroup_id" }], origin: "harvested" }], // functions/filegroup-name-transact-sql.md
	filegroupproperty: [
		{ name: "FILEGROUPPROPERTY", params: [{ name: "filegroup_name" }, { name: "property" }], origin: "harvested" },
	], // functions/filegroupproperty-transact-sql.md
	fileproperty: [
		{ name: "FILEPROPERTY", params: [{ name: "file_name" }, { name: "property" }], origin: "harvested" },
	], // functions/fileproperty-transact-sql.md
	filepropertyex: [{ name: "FILEPROPERTYEX", params: [{ name: "name" }, { name: "property" }], origin: "harvested" }], // functions/filepropertyex-transact-sql.md
	first_value: [
		{ name: "FIRST_VALUE", params: [{ name: "scalar_expression", optional: true }], origin: "harvested" },
	], // functions/first-value-transact-sql.md
	floor: [{ name: "FLOOR", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/floor-transact-sql.md
	format: [
		{
			name: "FORMAT",
			params: [{ name: "value" }, { name: "format" }, { name: "culture", optional: true }],
			origin: "harvested",
		},
		{
			name: "FORMAT",
			params: [{ name: "value" }, { name: "format_string" }, { name: "culture", optional: true }],
			origin: "harvested",
		},
	], // functions/format-transact-sql.md
	generate_series: [
		{
			name: "GENERATE_SERIES",
			params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }],
			origin: "harvested",
		},
	], // functions/generate-series-transact-sql.md
	get_bit: [{ name: "GET_BIT", params: [{ name: "expression_value" }, { name: "bit_offset" }], origin: "harvested" }], // functions/get-bit-transact-sql.md
	get_filestream_transaction_context: [
		{ name: "GET_FILESTREAM_TRANSACTION_CONTEXT", params: [], origin: "harvested" },
	], // functions/get-filestream-transaction-context-transact-sql.md
	getdate: [{ name: "GETDATE", params: [], origin: "harvested" }], // functions/getdate-transact-sql.md
	getutcdate: [{ name: "GETUTCDATE", params: [], origin: "harvested" }], // functions/getutcdate-transact-sql.md
	graph_id_from_edge_id: [{ name: "GRAPH_ID_FROM_EDGE_ID", params: [{ name: "edge_id" }], origin: "harvested" }], // functions/graph-id-from-edge-id-transact-sql.md
	graph_id_from_node_id: [{ name: "GRAPH_ID_FROM_NODE_ID", params: [{ name: "node_id" }], origin: "harvested" }], // functions/graph-id-from-node-id-transact-sql.md
	greatest: [
		{
			name: "GREATEST",
			params: [{ name: "expression1" }, { name: "expressionN", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // functions/logical-functions-greatest-transact-sql.md
	host_id: [{ name: "HOST_ID", params: [], origin: "harvested" }], // functions/host-id-transact-sql.md
	host_name: [{ name: "HOST_NAME", params: [], origin: "harvested" }], // functions/host-name-transact-sql.md
	iif: [
		{
			name: "IIF",
			params: [{ name: "boolean_expression" }, { name: "true_value" }, { name: "false_value" }],
			origin: "harvested",
		},
	], // functions/logical-functions-iif-transact-sql.md
	indexkey_property: [
		{
			name: "INDEXKEY_PROPERTY",
			params: [{ name: "object_ID" }, { name: "index_ID" }, { name: "key_ID" }, { name: "property" }],
			origin: "harvested",
		},
	], // functions/indexkey-property-transact-sql.md
	indexproperty: [
		{
			name: "INDEXPROPERTY",
			params: [{ name: "object_ID" }, { name: "index_or_statistics_name" }, { name: "property" }],
			origin: "harvested",
		},
	], // functions/indexproperty-transact-sql.md
	isdate: [{ name: "ISDATE", params: [{ name: "expression" }], origin: "harvested" }], // functions/isdate-transact-sql.md
	isjson: [
		{
			name: "ISJSON",
			params: [{ name: "expression" }, { name: "json_type_constraint", optional: true }],
			origin: "harvested",
		},
	], // functions/isjson-transact-sql.md
	isnull: [
		{ name: "ISNULL", params: [{ name: "check_expression" }, { name: "replacement_value" }], origin: "harvested" },
	], // functions/isnull-transact-sql.md
	isnumeric: [{ name: "ISNUMERIC", params: [{ name: "expression" }], origin: "harvested" }], // functions/isnumeric-transact-sql.md
	json_contains: [
		{
			name: "JSON_CONTAINS",
			params: [
				{ name: "target_expression" },
				{ name: "search_value_expression" },
				{ name: "path_expression", optional: true },
				{ name: "search_mode", optional: true },
			],
			origin: "harvested",
		},
	], // functions/json-contains-transact-sql.md
	json_modify: [
		{
			name: "JSON_MODIFY",
			params: [{ name: "expression" }, { name: "path" }, { name: "newValue" }],
			origin: "harvested",
		},
	], // functions/json-modify-transact-sql.md
	json_path_exists: [
		{
			name: "JSON_PATH_EXISTS",
			params: [{ name: "value_expression" }, { name: "sql_json_path" }],
			origin: "harvested",
		},
	], // functions/json-path-exists-transact-sql.md
	json_value: [{ name: "JSON_VALUE", params: [{ name: "expression" }, { name: "path" }], origin: "harvested" }], // functions/json-value-transact-sql.md
	lag: [
		{
			name: "LAG",
			params: [
				{ name: "scalar_expression" },
				{ name: "offset", optional: true },
				{ name: "default", optional: true },
			],
			origin: "harvested",
		},
	], // functions/lag-transact-sql.md
	last_value: [{ name: "LAST_VALUE", params: [{ name: "scalar_expression", optional: true }], origin: "harvested" }], // functions/last-value-transact-sql.md
	lead: [
		{
			name: "LEAD",
			params: [
				{ name: "scalar_expression" },
				{ name: "offset", optional: true },
				{ name: "default", optional: true },
			],
			origin: "harvested",
		},
	], // functions/lead-transact-sql.md
	least: [
		{
			name: "LEAST",
			params: [{ name: "expression1" }, { name: "expressionN", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // functions/logical-functions-least-transact-sql.md
	left: [
		{
			name: "LEFT",
			params: [{ name: "character_expression" }, { name: "integer_expression" }],
			origin: "harvested",
		},
	], // functions/left-transact-sql.md
	left_shift: [
		{ name: "LEFT_SHIFT", params: [{ name: "expression_value" }, { name: "shift_amount" }], origin: "harvested" },
	], // functions/left-shift-transact-sql.md
	len: [{ name: "LEN", params: [{ name: "string_expression" }], origin: "harvested" }], // functions/len-transact-sql.md
	log: [
		{ name: "LOG", params: [{ name: "float_expression" }, { name: "base", optional: true }], origin: "harvested" },
	], // functions/log-transact-sql.md
	log10: [{ name: "LOG10", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/log10-transact-sql.md
	lower: [{ name: "LOWER", params: [{ name: "character_expression" }], origin: "harvested" }], // functions/lower-transact-sql.md
	ltrim: [
		{
			name: "LTRIM",
			params: [{ name: "character_expression" }, { name: "characters", optional: true }],
			origin: "harvested",
		},
	], // functions/ltrim-transact-sql.md
	max: [{ name: "MAX", params: [{ name: "expression" }], origin: "harvested" }], // functions/max-transact-sql.md
	min: [{ name: "MIN", params: [{ name: "expression" }], origin: "harvested" }], // functions/min-transact-sql.md
	min_active_rowversion: [{ name: "MIN_ACTIVE_ROWVERSION", params: [], origin: "harvested" }], // functions/min-active-rowversion-transact-sql.md
	month: [{ name: "MONTH", params: [{ name: "date" }], origin: "harvested" }], // functions/month-transact-sql.md
	nchar: [{ name: "NCHAR", params: [{ name: "integer_expression" }], origin: "harvested" }], // functions/nchar-transact-sql.md
	newid: [{ name: "NEWID", params: [], origin: "harvested" }], // functions/newid-transact-sql.md
	newsequentialid: [{ name: "NEWSEQUENTIALID", params: [], origin: "harvested" }], // functions/newsequentialid-transact-sql.md
	node_id_from_parts: [
		{ name: "NODE_ID_FROM_PARTS", params: [{ name: "object_id" }, { name: "graph_id" }], origin: "harvested" },
	], // functions/node-id-from-parts-transact-sql.md
	ntile: [{ name: "NTILE", params: [{ name: "integer_expression" }], origin: "harvested" }], // functions/ntile-transact-sql.md
	nullif: [{ name: "NULLIF", params: [{ name: "expression1" }, { name: "expression2" }], origin: "curated" }], // curated: NULLIF (Transact-SQL)
	object_definition: [{ name: "OBJECT_DEFINITION", params: [{ name: "object_id" }], origin: "harvested" }], // functions/object-definition-transact-sql.md
	object_id_from_edge_id: [{ name: "OBJECT_ID_FROM_EDGE_ID", params: [{ name: "edge_id" }], origin: "harvested" }], // functions/object-id-from-edge-id-transact-sql.md
	object_id_from_node_id: [{ name: "OBJECT_ID_FROM_NODE_ID", params: [{ name: "node_id" }], origin: "harvested" }], // functions/object-id-from-node-id-transact-sql.md
	object_name: [
		{
			name: "OBJECT_NAME",
			params: [{ name: "object_id" }, { name: "database_id", optional: true }],
			origin: "harvested",
		},
	], // functions/object-name-transact-sql.md
	object_schema_name: [
		{
			name: "OBJECT_SCHEMA_NAME",
			params: [{ name: "object_id" }, { name: "database_id", optional: true }],
			origin: "harvested",
		},
	], // functions/object-schema-name-transact-sql.md
	objectproperty: [{ name: "OBJECTPROPERTY", params: [{ name: "ID" }, { name: "property" }], origin: "harvested" }], // functions/objectproperty-transact-sql.md
	objectpropertyex: [
		{ name: "OBJECTPROPERTYEX", params: [{ name: "id" }, { name: "property" }], origin: "harvested" },
	], // functions/objectpropertyex-transact-sql.md
	openjson: [
		{
			name: "OPENJSON",
			params: [{ name: "jsonExpression" }, { name: "path", optional: true }],
			origin: "harvested",
		},
	], // functions/openjson-transact-sql.md
	original_db_name: [{ name: "ORIGINAL_DB_NAME", params: [], origin: "harvested" }], // functions/original-db-name-transact-sql.md
	original_login: [{ name: "ORIGINAL_LOGIN", params: [], origin: "harvested" }], // functions/original-login-transact-sql.md
	percent_rank: [{ name: "PERCENT_RANK", params: [], origin: "harvested" }], // functions/percent-rank-transact-sql.md
	percentile_cont: [{ name: "PERCENTILE_CONT", params: [{ name: "numeric_literal" }], origin: "harvested" }], // functions/percentile-cont-transact-sql.md
	percentile_disc: [{ name: "PERCENTILE_DISC", params: [{ name: "numeric_literal" }], origin: "harvested" }], // functions/percentile-disc-transact-sql.md
	pi: [{ name: "PI", params: [], origin: "harvested" }], // functions/pi-transact-sql.md
	power: [{ name: "POWER", params: [{ name: "float_expression" }, { name: "y" }], origin: "harvested" }], // functions/power-transact-sql.md
	product: [{ name: "PRODUCT", params: [{ name: "expression" }], origin: "harvested" }], // functions/product-aggregate-transact-sql.md
	publishingservername: [{ name: "PUBLISHINGSERVERNAME", params: [], origin: "harvested" }], // functions/replication-functions-publishingservername.md
	radians: [{ name: "RADIANS", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/radians-transact-sql.md
	rand: [{ name: "RAND", params: [{ name: "seed", optional: true }], origin: "harvested" }], // functions/rand-transact-sql.md
	rank: [{ name: "RANK", params: [], origin: "harvested" }], // functions/rank-transact-sql.md
	replace: [
		{
			name: "REPLACE",
			params: [{ name: "string_expression" }, { name: "string_pattern" }, { name: "string_replacement" }],
			origin: "harvested",
		},
	], // functions/replace-transact-sql.md
	replicate: [
		{
			name: "REPLICATE",
			params: [{ name: "string_expression" }, { name: "integer_expression" }],
			origin: "harvested",
		},
	], // functions/replicate-transact-sql.md
	reverse: [{ name: "REVERSE", params: [{ name: "string_expression" }], origin: "harvested" }], // functions/reverse-transact-sql.md
	right: [
		{
			name: "RIGHT",
			params: [{ name: "character_expression" }, { name: "integer_expression" }],
			origin: "harvested",
		},
	], // functions/right-transact-sql.md
	right_shift: [
		{ name: "RIGHT_SHIFT", params: [{ name: "expression_value" }, { name: "shift_amount" }], origin: "harvested" },
	], // functions/right-shift-transact-sql.md
	round: [
		{
			name: "ROUND",
			params: [{ name: "numeric_expression" }, { name: "length" }, { name: "function", optional: true }],
			origin: "harvested",
		},
	], // functions/round-transact-sql.md
	row_number: [{ name: "ROW_NUMBER", params: [], origin: "harvested" }], // functions/row-number-transact-sql.md
	rowcount_big: [{ name: "ROWCOUNT_BIG", params: [], origin: "harvested" }], // functions/rowcount-big-transact-sql.md
	rtrim: [
		{
			name: "RTRIM",
			params: [{ name: "character_expression" }, { name: "characters", optional: true }],
			origin: "harvested",
		},
	], // functions/rtrim-transact-sql.md
	schema_id: [{ name: "SCHEMA_ID", params: [{ name: "schema_name", optional: true }], origin: "harvested" }], // functions/schema-id-transact-sql.md
	schema_name: [{ name: "SCHEMA_NAME", params: [{ name: "schema_id", optional: true }], origin: "harvested" }], // functions/schema-name-transact-sql.md
	scope_identity: [{ name: "SCOPE_IDENTITY", params: [], origin: "harvested" }], // functions/scope-identity-transact-sql.md
	session_id: [{ name: "SESSION_ID", params: [], origin: "harvested" }], // functions/session-id-transact-sql.md
	sessionproperty: [{ name: "SESSIONPROPERTY", params: [{ name: "option" }], origin: "harvested" }], // functions/sessionproperty-transact-sql.md
	set_bit: [
		{
			name: "SET_BIT",
			params: [{ name: "expression_value" }, { name: "bit_offset" }, { name: "bit_value", optional: true }],
			origin: "harvested",
		},
	], // functions/set-bit-transact-sql.md
	sign: [{ name: "SIGN", params: [{ name: "numeric_expression" }], origin: "harvested" }], // functions/sign-transact-sql.md
	sin: [{ name: "SIN", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/sin-transact-sql.md
	smalldatetimefromparts: [
		{
			name: "SMALLDATETIMEFROMPARTS",
			params: [{ name: "year" }, { name: "month" }, { name: "day" }, { name: "hour" }, { name: "minute" }],
			origin: "harvested",
		},
	], // functions/smalldatetimefromparts-transact-sql.md
	soundex: [{ name: "SOUNDEX", params: [{ name: "character_expression" }], origin: "harvested" }], // functions/soundex-transact-sql.md
	space: [{ name: "SPACE", params: [{ name: "integer_expression" }], origin: "harvested" }], // functions/space-transact-sql.md
	sql_variant_property: [
		{ name: "SQL_VARIANT_PROPERTY", params: [{ name: "expression" }, { name: "property" }], origin: "harvested" },
	], // functions/sql-variant-property-transact-sql.md
	sqrt: [{ name: "SQRT", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/sqrt-transact-sql.md
	square: [{ name: "SQUARE", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/square-transact-sql.md
	stats_date: [{ name: "STATS_DATE", params: [{ name: "object_id" }, { name: "stats_id" }], origin: "harvested" }], // functions/stats-date-transact-sql.md
	stdev: [{ name: "STDEV", params: [{ name: "expression" }], origin: "harvested" }], // functions/stdev-transact-sql.md
	stdevp: [{ name: "STDEVP", params: [{ name: "expression" }], origin: "harvested" }], // functions/stdevp-transact-sql.md
	string_agg: [{ name: "STRING_AGG", params: [{ name: "expression" }, { name: "separator" }], origin: "harvested" }], // functions/string-agg-transact-sql.md
	string_escape: [{ name: "STRING_ESCAPE", params: [{ name: "text" }, { name: "type" }], origin: "harvested" }], // functions/string-escape-transact-sql.md
	string_split: [
		{
			name: "STRING_SPLIT",
			params: [{ name: "string" }, { name: "separator" }, { name: "enable_ordinal", optional: true }],
			origin: "harvested",
		},
	], // functions/string-split-transact-sql.md
	stuff: [
		{
			name: "STUFF",
			params: [
				{ name: "character_expression" },
				{ name: "start" },
				{ name: "length" },
				{ name: "replace_with_expression" },
			],
			origin: "harvested",
		},
	], // functions/stuff-transact-sql.md
	substring: [
		{
			name: "SUBSTRING",
			params: [{ name: "expression" }, { name: "start" }, { name: "length", optional: true }],
			origin: "harvested",
		},
	], // functions/substring-transact-sql.md
	sum: [{ name: "SUM", params: [{ name: "expression" }], origin: "harvested" }], // functions/sum-transact-sql.md
	suser_name: [{ name: "SUSER_NAME", params: [{ name: "server_user_id", optional: true }], origin: "harvested" }], // functions/suser-name-transact-sql.md
	suser_sname: [{ name: "SUSER_SNAME", params: [{ name: "server_user_sid", optional: true }], origin: "harvested" }], // functions/suser-sname-transact-sql.md
	switchoffset: [
		{
			name: "SWITCHOFFSET",
			params: [{ name: "datetimeoffset_expression" }, { name: "timezoneoffset_expression" }],
			origin: "harvested",
		},
	], // functions/switchoffset-transact-sql.md
	sysdatetime: [{ name: "SYSDATETIME", params: [], origin: "harvested" }], // functions/sysdatetime-transact-sql.md
	sysdatetimeoffset: [{ name: "SYSDATETIMEOFFSET", params: [], origin: "harvested" }], // functions/sysdatetimeoffset-transact-sql.md
	sysutcdatetime: [{ name: "SYSUTCDATETIME", params: [], origin: "harvested" }], // functions/sysutcdatetime-transact-sql.md
	tan: [{ name: "TAN", params: [{ name: "float_expression" }], origin: "harvested" }], // functions/tan-transact-sql.md
	tertiary_weights: [
		{
			name: "TERTIARY_WEIGHTS",
			params: [{ name: "non_Unicode_character_string_expression" }],
			origin: "harvested",
		},
	], // functions/collation-functions-tertiary-weights-transact-sql.md
	textptr: [{ name: "TEXTPTR", params: [{ name: "column" }], origin: "harvested" }], // functions/text-and-image-functions-textptr-transact-sql.md
	timefromparts: [
		{
			name: "TIMEFROMPARTS",
			params: [
				{ name: "hour" },
				{ name: "minute" },
				{ name: "seconds" },
				{ name: "fractions" },
				{ name: "precision" },
			],
			origin: "harvested",
		},
	], // functions/timefromparts-transact-sql.md
	todatetimeoffset: [
		{
			name: "TODATETIMEOFFSET",
			params: [{ name: "datetime_expression" }, { name: "timezoneoffset_expression" }],
			origin: "harvested",
		},
	], // functions/todatetimeoffset-transact-sql.md
	translate: [
		{
			name: "TRANSLATE",
			params: [{ name: "inputString" }, { name: "characters" }, { name: "translations" }],
			origin: "harvested",
		},
	], // functions/translate-transact-sql.md
	trim: [{ name: "TRIM", params: [{ name: "string" }, { name: "characters", optional: true }], origin: "curated" }], // curated: TRIM (Transact-SQL) (characters optional)
	try_convert: [
		{
			name: "TRY_CONVERT",
			params: [{ name: "data_type" }, { name: "expression" }, { name: "style", type: "int", optional: true }],
			origin: "curated",
		},
	], // curated: TRY_CONVERT (Transact-SQL) - TRY_CONVERT ( data_type [ ( length ) ] , expression [ , style ] ): style is bracketed/optional
	type_name: [{ name: "TYPE_NAME", params: [{ name: "type_id" }], origin: "harvested" }], // functions/type-name-transact-sql.md
	typeproperty: [{ name: "TYPEPROPERTY", params: [{ name: "type" }, { name: "property" }], origin: "harvested" }], // functions/typeproperty-transact-sql.md
	update: [{ name: "UPDATE", params: [{ name: "column" }], origin: "harvested" }], // functions/update-trigger-functions-transact-sql.md
	upper: [{ name: "UPPER", params: [{ name: "character_expression" }], origin: "harvested" }], // functions/upper-transact-sql.md
	user_name: [{ name: "USER_NAME", params: [{ name: "ID", optional: true }], origin: "harvested" }], // functions/user-name-transact-sql.md
	var: [{ name: "VAR", params: [{ name: "expression" }], origin: "harvested" }], // functions/var-transact-sql.md
	varp: [{ name: "VARP", params: [{ name: "expression" }], origin: "harvested" }], // functions/varp-transact-sql.md
	vector_distance: [
		{
			name: "VECTOR_DISTANCE",
			params: [{ name: "distance_metric" }, { name: "vector1" }, { name: "vector2" }],
			origin: "harvested",
		},
	], // functions/vector-distance-transact-sql.md
	vector_norm: [{ name: "VECTOR_NORM", params: [{ name: "vector" }, { name: "norm_type" }], origin: "harvested" }], // functions/vector-norm-transact-sql.md
	vector_normalize: [
		{ name: "VECTOR_NORMALIZE", params: [{ name: "vector" }, { name: "norm_type" }], origin: "harvested" },
	], // functions/vector-normalize-transact-sql.md
	vectorproperty: [
		{ name: "VECTORPROPERTY", params: [{ name: "vector" }, { name: "property" }], origin: "harvested" },
	], // functions/vectorproperty-transact-sql.md
	verifysignedbyasymkey: [
		{
			name: "VerifySignedByAsymKey",
			params: [{ name: "Asym_Key_ID" }, { name: "clear_text" }, { name: "signature" }],
			origin: "harvested",
		},
	], // functions/verifysignedbyasymkey-transact-sql.md
	verifysignedbycert: [
		{
			name: "VerifySignedByCert",
			params: [{ name: "Cert_ID" }, { name: "signed_data" }, { name: "signature" }],
			origin: "harvested",
		},
	], // functions/verifysignedbycert-transact-sql.md
	version: [{ name: "VERSION", params: [], origin: "harvested" }], // functions/version-transact-sql-metadata-functions.md
	xact_state: [{ name: "XACT_STATE", params: [], origin: "harvested" }], // functions/xact-state-transact-sql.md
	year: [{ name: "YEAR", params: [{ name: "date" }], origin: "harvested" }], // functions/year-transact-sql.md
};
