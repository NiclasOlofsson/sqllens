// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: MicrosoftDocs/sql-docs  docs/t-sql/{functions,language-elements}/**/*.md (```syntaxsql``` blocks)
// Harvested 2026-07-14. 199 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for tsql, keyed by lowercased name. */
export const TSQL_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "ABS", params: [{ name: "numeric_expression" }] }, // functions/abs-transact-sql.md
	acos: { name: "ACOS", params: [{ name: "float_expression" }] }, // functions/acos-transact-sql.md
	any_value: { name: "ANY_VALUE", params: [{ name: "expression" }] }, // functions/any-value-transact-sql.md
	app_name: { name: "APP_NAME", params: [] }, // functions/app-name-transact-sql.md
	approx_count_distinct: { name: "APPROX_COUNT_DISTINCT", params: [{ name: "expression" }] }, // functions/approx-count-distinct-transact-sql.md
	approx_percentile_cont: { name: "APPROX_PERCENTILE_CONT", params: [{ name: "numeric_literal" }] }, // functions/approx-percentile-cont-transact-sql.md
	approx_percentile_disc: { name: "APPROX_PERCENTILE_DISC", params: [{ name: "numeric_literal" }] }, // functions/approx-percentile-disc-transact-sql.md
	ascii: { name: "ASCII", params: [{ name: "character_expression" }] }, // functions/ascii-transact-sql.md
	asin: { name: "ASIN", params: [{ name: "float_expression" }] }, // functions/asin-transact-sql.md
	atan: { name: "ATAN", params: [{ name: "float_expression" }] }, // functions/atan-transact-sql.md
	atn2: { name: "ATN2", params: [{ name: "float_expression" }, { name: "float_expression" }] }, // functions/atn2-transact-sql.md
	avg: { name: "AVG", params: [{ name: "expression" }] }, // functions/avg-transact-sql.md
	base64_decode: { name: "BASE64_DECODE", params: [{ name: "expression" }] }, // functions/base64-decode-transact-sql.md
	base64_encode: { name: "BASE64_ENCODE", params: [{ name: "expression" }, { name: "url_safe", optional: true }] }, // functions/base64-encode-transact-sql.md
	bit_count: { name: "BIT_COUNT", params: [{ name: "expression_value" }] }, // functions/bit-count-transact-sql.md
	ceiling: { name: "CEILING", params: [{ name: "numeric_expression" }] }, // functions/ceiling-transact-sql.md
	certencoded: { name: "CERTENCODED", params: [{ name: "cert_id" }] }, // functions/certencoded-transact-sql.md
	char: { name: "CHAR", params: [{ name: "integer_expression" }] }, // functions/char-transact-sql.md
	charindex: {
		name: "CHARINDEX",
		params: [
			{ name: "expressionToFind" },
			{ name: "expressionToSearch" },
			{ name: "start_location", optional: true },
		],
	}, // functions/charindex-transact-sql.md
	checksum_agg: { name: "CHECKSUM_AGG", params: [{ name: "expression" }] }, // functions/checksum-agg-transact-sql.md
	choose: {
		name: "CHOOSE",
		params: [{ name: "index" }, { name: "val_1" }, { name: "val_2" }, { name: "val_n", optional: true }],
	}, // functions/logical-functions-choose-transact-sql.md
	coalesce: { name: "COALESCE", params: [{ name: "expression" }], variadic: true }, // language-elements/coalesce-transact-sql.md
	col_name: { name: "COL_NAME", params: [{ name: "table_id" }, { name: "column_id" }] }, // functions/col-name-transact-sql.md
	collationproperty: { name: "COLLATIONPROPERTY", params: [{ name: "collation_name" }, { name: "property" }] }, // functions/collation-functions-collationproperty-transact-sql.md
	columnproperty: { name: "COLUMNPROPERTY", params: [{ name: "id" }, { name: "column" }, { name: "property" }] }, // functions/columnproperty-transact-sql.md
	columns_updated: { name: "COLUMNS_UPDATED", params: [] }, // functions/columns-updated-transact-sql.md
	compress: { name: "COMPRESS", params: [{ name: "expression" }] }, // functions/compress-transact-sql.md
	concat: {
		name: "CONCAT",
		params: [{ name: "argument1" }, { name: "argument2" }, { name: "argumentN", optional: true }],
		variadic: true,
	}, // functions/concat-transact-sql.md
	concat_ws: {
		name: "CONCAT_WS",
		params: [
			{ name: "separator" },
			{ name: "argument1" },
			{ name: "argument2" },
			{ name: "argumentN", optional: true },
		],
		variadic: true,
	}, // functions/concat-ws-transact-sql.md
	connectionproperty: { name: "CONNECTIONPROPERTY", params: [{ name: "property" }] }, // functions/connectionproperty-transact-sql.md
	context_info: { name: "CONTEXT_INFO", params: [] }, // functions/context-info-transact-sql.md
	cos: { name: "COS", params: [{ name: "float_expression" }] }, // functions/cos-transact-sql.md
	cot: { name: "COT", params: [{ name: "float_expression" }] }, // functions/cot-transact-sql.md
	crypt_gen_random: { name: "CRYPT_GEN_RANDOM", params: [{ name: "length" }, { name: "seed", optional: true }] }, // functions/crypt-gen-random-transact-sql.md
	cume_dist: { name: "CUME_DIST", params: [] }, // functions/cume-dist-transact-sql.md
	current_request_id: { name: "CURRENT_REQUEST_ID", params: [] }, // functions/current-request-id-transact-sql.md
	current_timezone: { name: "CURRENT_TIMEZONE", params: [] }, // functions/current-timezone-transact-sql.md
	current_timezone_id: { name: "CURRENT_TIMEZONE_ID", params: [] }, // functions/current-timezone-id-transact-sql.md
	current_transaction_id: { name: "CURRENT_TRANSACTION_ID", params: [] }, // functions/current-transaction-id-transact-sql.md
	databasepropertyex: { name: "DATABASEPROPERTYEX", params: [{ name: "database" }, { name: "property" }] }, // functions/databasepropertyex-transact-sql.md
	datalength: { name: "DATALENGTH", params: [{ name: "expression" }] }, // functions/datalength-transact-sql.md
	date_bucket: {
		name: "DATE_BUCKET",
		params: [{ name: "datepart" }, { name: "number" }, { name: "date" }, { name: "origin", optional: true }],
	}, // functions/date-bucket-transact-sql.md
	dateadd: { name: "DATEADD", params: [{ name: "datepart" }, { name: "number" }, { name: "date" }] }, // functions/dateadd-transact-sql.md
	datediff: { name: "DATEDIFF", params: [{ name: "datepart" }, { name: "startdate" }, { name: "enddate" }] }, // functions/datediff-transact-sql.md
	datediff_big: { name: "DATEDIFF_BIG", params: [{ name: "datepart" }, { name: "startdate" }, { name: "enddate" }] }, // functions/datediff-big-transact-sql.md
	datefromparts: { name: "DATEFROMPARTS", params: [{ name: "year" }, { name: "month" }, { name: "day" }] }, // functions/datefromparts-transact-sql.md
	datename: { name: "DATENAME", params: [{ name: "datepart" }, { name: "date" }] }, // functions/datename-transact-sql.md
	datepart: { name: "DATEPART", params: [{ name: "datepart" }, { name: "date" }] }, // functions/datepart-transact-sql.md
	datetime2fromparts: {
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
	}, // functions/datetime2fromparts-transact-sql.md
	datetimefromparts: {
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
	}, // functions/datetimefromparts-transact-sql.md
	datetimeoffsetfromparts: {
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
	}, // functions/datetimeoffsetfromparts-transact-sql.md
	datetrunc: { name: "DATETRUNC", params: [{ name: "datepart" }, { name: "date" }] }, // functions/datetrunc-transact-sql.md
	day: { name: "DAY", params: [{ name: "date" }] }, // functions/day-transact-sql.md
	db_name: { name: "DB_NAME", params: [{ name: "database_id", optional: true }] }, // functions/db-name-transact-sql.md
	decompress: { name: "DECOMPRESS", params: [{ name: "expression" }] }, // functions/decompress-transact-sql.md
	degrees: { name: "DEGREES", params: [{ name: "numeric_expression" }] }, // functions/degrees-transact-sql.md
	dense_rank: { name: "DENSE_RANK", params: [] }, // functions/dense-rank-transact-sql.md
	difference: { name: "DIFFERENCE", params: [{ name: "character_expression" }, { name: "character_expression" }] }, // functions/difference-transact-sql.md
	edge_id_from_parts: { name: "EDGE_ID_FROM_PARTS", params: [{ name: "object_id" }, { name: "graph_id" }] }, // functions/edge-id-from-parts-transact-sql.md
	eomonth: { name: "EOMONTH", params: [{ name: "start_date" }, { name: "month_to_add", optional: true }] }, // functions/eomonth-transact-sql.md
	error_line: { name: "ERROR_LINE", params: [] }, // functions/error-line-transact-sql.md
	error_message: { name: "ERROR_MESSAGE", params: [] }, // functions/error-message-transact-sql.md
	error_number: { name: "ERROR_NUMBER", params: [] }, // functions/error-number-transact-sql.md
	error_procedure: { name: "ERROR_PROCEDURE", params: [] }, // functions/error-procedure-transact-sql.md
	error_severity: { name: "ERROR_SEVERITY", params: [] }, // functions/error-severity-transact-sql.md
	error_state: { name: "ERROR_STATE", params: [] }, // functions/error-state-transact-sql.md
	eventdata: { name: "EVENTDATA", params: [] }, // functions/eventdata-transact-sql.md
	exp: { name: "EXP", params: [{ name: "float_expression" }] }, // functions/exp-transact-sql.md
	file_id: { name: "FILE_ID", params: [{ name: "file_name" }] }, // functions/file-id-transact-sql.md
	file_idex: { name: "FILE_IDEX", params: [{ name: "file_name" }] }, // functions/file-idex-transact-sql.md
	file_name: { name: "FILE_NAME", params: [{ name: "file_id" }] }, // functions/file-name-transact-sql.md
	filegroup_name: { name: "FILEGROUP_NAME", params: [{ name: "filegroup_id" }] }, // functions/filegroup-name-transact-sql.md
	filegroupproperty: { name: "FILEGROUPPROPERTY", params: [{ name: "filegroup_name" }, { name: "property" }] }, // functions/filegroupproperty-transact-sql.md
	fileproperty: { name: "FILEPROPERTY", params: [{ name: "file_name" }, { name: "property" }] }, // functions/fileproperty-transact-sql.md
	filepropertyex: { name: "FILEPROPERTYEX", params: [{ name: "name" }, { name: "property" }] }, // functions/filepropertyex-transact-sql.md
	first_value: { name: "FIRST_VALUE", params: [{ name: "scalar_expression", optional: true }] }, // functions/first-value-transact-sql.md
	floor: { name: "FLOOR", params: [{ name: "numeric_expression" }] }, // functions/floor-transact-sql.md
	generate_series: {
		name: "GENERATE_SERIES",
		params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }],
	}, // functions/generate-series-transact-sql.md
	get_bit: { name: "GET_BIT", params: [{ name: "expression_value" }, { name: "bit_offset" }] }, // functions/get-bit-transact-sql.md
	get_filestream_transaction_context: { name: "GET_FILESTREAM_TRANSACTION_CONTEXT", params: [] }, // functions/get-filestream-transaction-context-transact-sql.md
	getdate: { name: "GETDATE", params: [] }, // functions/getdate-transact-sql.md
	getutcdate: { name: "GETUTCDATE", params: [] }, // functions/getutcdate-transact-sql.md
	graph_id_from_edge_id: { name: "GRAPH_ID_FROM_EDGE_ID", params: [{ name: "edge_id" }] }, // functions/graph-id-from-edge-id-transact-sql.md
	graph_id_from_node_id: { name: "GRAPH_ID_FROM_NODE_ID", params: [{ name: "node_id" }] }, // functions/graph-id-from-node-id-transact-sql.md
	greatest: {
		name: "GREATEST",
		params: [{ name: "expression1" }, { name: "expressionN", optional: true }],
		variadic: true,
	}, // functions/logical-functions-greatest-transact-sql.md
	host_id: { name: "HOST_ID", params: [] }, // functions/host-id-transact-sql.md
	host_name: { name: "HOST_NAME", params: [] }, // functions/host-name-transact-sql.md
	iif: { name: "IIF", params: [{ name: "boolean_expression" }, { name: "true_value" }, { name: "false_value" }] }, // functions/logical-functions-iif-transact-sql.md
	indexkey_property: {
		name: "INDEXKEY_PROPERTY",
		params: [{ name: "object_ID" }, { name: "index_ID" }, { name: "key_ID" }, { name: "property" }],
	}, // functions/indexkey-property-transact-sql.md
	indexproperty: {
		name: "INDEXPROPERTY",
		params: [{ name: "object_ID" }, { name: "index_or_statistics_name" }, { name: "property" }],
	}, // functions/indexproperty-transact-sql.md
	isdate: { name: "ISDATE", params: [{ name: "expression" }] }, // functions/isdate-transact-sql.md
	isjson: { name: "ISJSON", params: [{ name: "expression" }, { name: "json_type_constraint", optional: true }] }, // functions/isjson-transact-sql.md
	isnull: { name: "ISNULL", params: [{ name: "check_expression" }, { name: "replacement_value" }] }, // functions/isnull-transact-sql.md
	isnumeric: { name: "ISNUMERIC", params: [{ name: "expression" }] }, // functions/isnumeric-transact-sql.md
	json_contains: {
		name: "JSON_CONTAINS",
		params: [
			{ name: "target_expression" },
			{ name: "search_value_expression" },
			{ name: "path_expression", optional: true },
			{ name: "search_mode", optional: true },
		],
	}, // functions/json-contains-transact-sql.md
	json_modify: { name: "JSON_MODIFY", params: [{ name: "expression" }, { name: "path" }, { name: "newValue" }] }, // functions/json-modify-transact-sql.md
	json_path_exists: { name: "JSON_PATH_EXISTS", params: [{ name: "value_expression" }, { name: "sql_json_path" }] }, // functions/json-path-exists-transact-sql.md
	json_value: { name: "JSON_VALUE", params: [{ name: "expression" }, { name: "path" }] }, // functions/json-value-transact-sql.md
	lag: {
		name: "LAG",
		params: [
			{ name: "scalar_expression" },
			{ name: "offset", optional: true },
			{ name: "default", optional: true },
		],
	}, // functions/lag-transact-sql.md
	last_value: { name: "LAST_VALUE", params: [{ name: "scalar_expression", optional: true }] }, // functions/last-value-transact-sql.md
	lead: {
		name: "LEAD",
		params: [
			{ name: "scalar_expression" },
			{ name: "offset", optional: true },
			{ name: "default", optional: true },
		],
	}, // functions/lead-transact-sql.md
	least: {
		name: "LEAST",
		params: [{ name: "expression1" }, { name: "expressionN", optional: true }],
		variadic: true,
	}, // functions/logical-functions-least-transact-sql.md
	left: { name: "LEFT", params: [{ name: "character_expression" }, { name: "integer_expression" }] }, // functions/left-transact-sql.md
	left_shift: { name: "LEFT_SHIFT", params: [{ name: "expression_value" }, { name: "shift_amount" }] }, // functions/left-shift-transact-sql.md
	len: { name: "LEN", params: [{ name: "string_expression" }] }, // functions/len-transact-sql.md
	log: { name: "LOG", params: [{ name: "float_expression" }, { name: "base", optional: true }] }, // functions/log-transact-sql.md
	log10: { name: "LOG10", params: [{ name: "float_expression" }] }, // functions/log10-transact-sql.md
	lower: { name: "LOWER", params: [{ name: "character_expression" }] }, // functions/lower-transact-sql.md
	ltrim: { name: "LTRIM", params: [{ name: "character_expression" }, { name: "characters", optional: true }] }, // functions/ltrim-transact-sql.md
	max: { name: "MAX", params: [{ name: "expression" }] }, // functions/max-transact-sql.md
	min: { name: "MIN", params: [{ name: "expression" }] }, // functions/min-transact-sql.md
	min_active_rowversion: { name: "MIN_ACTIVE_ROWVERSION", params: [] }, // functions/min-active-rowversion-transact-sql.md
	month: { name: "MONTH", params: [{ name: "date" }] }, // functions/month-transact-sql.md
	nchar: { name: "NCHAR", params: [{ name: "integer_expression" }] }, // functions/nchar-transact-sql.md
	newid: { name: "NEWID", params: [] }, // functions/newid-transact-sql.md
	newsequentialid: { name: "NEWSEQUENTIALID", params: [] }, // functions/newsequentialid-transact-sql.md
	node_id_from_parts: { name: "NODE_ID_FROM_PARTS", params: [{ name: "object_id" }, { name: "graph_id" }] }, // functions/node-id-from-parts-transact-sql.md
	ntile: { name: "NTILE", params: [{ name: "integer_expression" }] }, // functions/ntile-transact-sql.md
	nullif: { name: "NULLIF", params: [{ name: "expression" }, { name: "expression" }] }, // language-elements/nullif-transact-sql.md
	object_definition: { name: "OBJECT_DEFINITION", params: [{ name: "object_id" }] }, // functions/object-definition-transact-sql.md
	object_id_from_edge_id: { name: "OBJECT_ID_FROM_EDGE_ID", params: [{ name: "edge_id" }] }, // functions/object-id-from-edge-id-transact-sql.md
	object_id_from_node_id: { name: "OBJECT_ID_FROM_NODE_ID", params: [{ name: "node_id" }] }, // functions/object-id-from-node-id-transact-sql.md
	object_name: { name: "OBJECT_NAME", params: [{ name: "object_id" }, { name: "database_id", optional: true }] }, // functions/object-name-transact-sql.md
	object_schema_name: {
		name: "OBJECT_SCHEMA_NAME",
		params: [{ name: "object_id" }, { name: "database_id", optional: true }],
	}, // functions/object-schema-name-transact-sql.md
	objectproperty: { name: "OBJECTPROPERTY", params: [{ name: "ID" }, { name: "property" }] }, // functions/objectproperty-transact-sql.md
	objectpropertyex: { name: "OBJECTPROPERTYEX", params: [{ name: "id" }, { name: "property" }] }, // functions/objectpropertyex-transact-sql.md
	openjson: { name: "OPENJSON", params: [{ name: "jsonExpression" }, { name: "path", optional: true }] }, // functions/openjson-transact-sql.md
	original_db_name: { name: "ORIGINAL_DB_NAME", params: [] }, // functions/original-db-name-transact-sql.md
	original_login: { name: "ORIGINAL_LOGIN", params: [] }, // functions/original-login-transact-sql.md
	percent_rank: { name: "PERCENT_RANK", params: [] }, // functions/percent-rank-transact-sql.md
	percentile_cont: { name: "PERCENTILE_CONT", params: [{ name: "numeric_literal" }] }, // functions/percentile-cont-transact-sql.md
	percentile_disc: { name: "PERCENTILE_DISC", params: [{ name: "numeric_literal" }] }, // functions/percentile-disc-transact-sql.md
	pi: { name: "PI", params: [] }, // functions/pi-transact-sql.md
	power: { name: "POWER", params: [{ name: "float_expression" }, { name: "y" }] }, // functions/power-transact-sql.md
	product: { name: "PRODUCT", params: [{ name: "expression" }] }, // functions/product-aggregate-transact-sql.md
	publishingservername: { name: "PUBLISHINGSERVERNAME", params: [] }, // functions/replication-functions-publishingservername.md
	radians: { name: "RADIANS", params: [{ name: "numeric_expression" }] }, // functions/radians-transact-sql.md
	rand: { name: "RAND", params: [{ name: "seed", optional: true }] }, // functions/rand-transact-sql.md
	rank: { name: "RANK", params: [] }, // functions/rank-transact-sql.md
	replace: {
		name: "REPLACE",
		params: [{ name: "string_expression" }, { name: "string_pattern" }, { name: "string_replacement" }],
	}, // functions/replace-transact-sql.md
	replicate: { name: "REPLICATE", params: [{ name: "string_expression" }, { name: "integer_expression" }] }, // functions/replicate-transact-sql.md
	reverse: { name: "REVERSE", params: [{ name: "string_expression" }] }, // functions/reverse-transact-sql.md
	right: { name: "RIGHT", params: [{ name: "character_expression" }, { name: "integer_expression" }] }, // functions/right-transact-sql.md
	right_shift: { name: "RIGHT_SHIFT", params: [{ name: "expression_value" }, { name: "shift_amount" }] }, // functions/right-shift-transact-sql.md
	round: {
		name: "ROUND",
		params: [{ name: "numeric_expression" }, { name: "length" }, { name: "function", optional: true }],
	}, // functions/round-transact-sql.md
	row_number: { name: "ROW_NUMBER", params: [] }, // functions/row-number-transact-sql.md
	rowcount_big: { name: "ROWCOUNT_BIG", params: [] }, // functions/rowcount-big-transact-sql.md
	rtrim: { name: "RTRIM", params: [{ name: "character_expression" }, { name: "characters", optional: true }] }, // functions/rtrim-transact-sql.md
	schema_id: { name: "SCHEMA_ID", params: [{ name: "schema_name", optional: true }] }, // functions/schema-id-transact-sql.md
	schema_name: { name: "SCHEMA_NAME", params: [{ name: "schema_id", optional: true }] }, // functions/schema-name-transact-sql.md
	scope_identity: { name: "SCOPE_IDENTITY", params: [] }, // functions/scope-identity-transact-sql.md
	session_id: { name: "SESSION_ID", params: [] }, // functions/session-id-transact-sql.md
	sessionproperty: { name: "SESSIONPROPERTY", params: [{ name: "option" }] }, // functions/sessionproperty-transact-sql.md
	set_bit: { name: "SET_BIT", params: [{ name: "expression_value" }, { name: "bit_offset" }] }, // functions/set-bit-transact-sql.md
	sign: { name: "SIGN", params: [{ name: "numeric_expression" }] }, // functions/sign-transact-sql.md
	sin: { name: "SIN", params: [{ name: "float_expression" }] }, // functions/sin-transact-sql.md
	smalldatetimefromparts: {
		name: "SMALLDATETIMEFROMPARTS",
		params: [{ name: "year" }, { name: "month" }, { name: "day" }, { name: "hour" }, { name: "minute" }],
	}, // functions/smalldatetimefromparts-transact-sql.md
	soundex: { name: "SOUNDEX", params: [{ name: "character_expression" }] }, // functions/soundex-transact-sql.md
	space: { name: "SPACE", params: [{ name: "integer_expression" }] }, // functions/space-transact-sql.md
	sql_variant_property: { name: "SQL_VARIANT_PROPERTY", params: [{ name: "expression" }, { name: "property" }] }, // functions/sql-variant-property-transact-sql.md
	sqrt: { name: "SQRT", params: [{ name: "float_expression" }] }, // functions/sqrt-transact-sql.md
	square: { name: "SQUARE", params: [{ name: "float_expression" }] }, // functions/square-transact-sql.md
	stats_date: { name: "STATS_DATE", params: [{ name: "object_id" }, { name: "stats_id" }] }, // functions/stats-date-transact-sql.md
	stdev: { name: "STDEV", params: [{ name: "expression" }] }, // functions/stdev-transact-sql.md
	stdevp: { name: "STDEVP", params: [{ name: "expression" }] }, // functions/stdevp-transact-sql.md
	string_agg: { name: "STRING_AGG", params: [{ name: "expression" }, { name: "separator" }] }, // functions/string-agg-transact-sql.md
	string_escape: { name: "STRING_ESCAPE", params: [{ name: "text" }, { name: "type" }] }, // functions/string-escape-transact-sql.md
	string_split: {
		name: "STRING_SPLIT",
		params: [{ name: "string" }, { name: "separator" }, { name: "enable_ordinal", optional: true }],
	}, // functions/string-split-transact-sql.md
	stuff: {
		name: "STUFF",
		params: [
			{ name: "character_expression" },
			{ name: "start" },
			{ name: "length" },
			{ name: "replace_with_expression" },
		],
	}, // functions/stuff-transact-sql.md
	substring: {
		name: "SUBSTRING",
		params: [{ name: "expression" }, { name: "start" }, { name: "length", optional: true }],
	}, // functions/substring-transact-sql.md
	sum: { name: "SUM", params: [{ name: "expression" }] }, // functions/sum-transact-sql.md
	suser_name: { name: "SUSER_NAME", params: [{ name: "server_user_id", optional: true }] }, // functions/suser-name-transact-sql.md
	suser_sname: { name: "SUSER_SNAME", params: [{ name: "server_user_sid", optional: true }] }, // functions/suser-sname-transact-sql.md
	switchoffset: {
		name: "SWITCHOFFSET",
		params: [{ name: "datetimeoffset_expression" }, { name: "timezoneoffset_expression" }],
	}, // functions/switchoffset-transact-sql.md
	sysdatetime: { name: "SYSDATETIME", params: [] }, // functions/sysdatetime-transact-sql.md
	sysdatetimeoffset: { name: "SYSDATETIMEOFFSET", params: [] }, // functions/sysdatetimeoffset-transact-sql.md
	sysutcdatetime: { name: "SYSUTCDATETIME", params: [] }, // functions/sysutcdatetime-transact-sql.md
	tan: { name: "TAN", params: [{ name: "float_expression" }] }, // functions/tan-transact-sql.md
	tertiary_weights: { name: "TERTIARY_WEIGHTS", params: [{ name: "non_Unicode_character_string_expression" }] }, // functions/collation-functions-tertiary-weights-transact-sql.md
	textptr: { name: "TEXTPTR", params: [{ name: "column" }] }, // functions/text-and-image-functions-textptr-transact-sql.md
	timefromparts: {
		name: "TIMEFROMPARTS",
		params: [
			{ name: "hour" },
			{ name: "minute" },
			{ name: "seconds" },
			{ name: "fractions" },
			{ name: "precision" },
		],
	}, // functions/timefromparts-transact-sql.md
	todatetimeoffset: {
		name: "TODATETIMEOFFSET",
		params: [{ name: "datetime_expression" }, { name: "timezoneoffset_expression" }],
	}, // functions/todatetimeoffset-transact-sql.md
	translate: {
		name: "TRANSLATE",
		params: [{ name: "inputString" }, { name: "characters" }, { name: "translations" }],
	}, // functions/translate-transact-sql.md
	type_name: { name: "TYPE_NAME", params: [{ name: "type_id" }] }, // functions/type-name-transact-sql.md
	typeproperty: { name: "TYPEPROPERTY", params: [{ name: "type" }, { name: "property" }] }, // functions/typeproperty-transact-sql.md
	update: { name: "UPDATE", params: [{ name: "column" }] }, // functions/update-trigger-functions-transact-sql.md
	upper: { name: "UPPER", params: [{ name: "character_expression" }] }, // functions/upper-transact-sql.md
	user_name: { name: "USER_NAME", params: [{ name: "ID", optional: true }] }, // functions/user-name-transact-sql.md
	var: { name: "VAR", params: [{ name: "expression" }] }, // functions/var-transact-sql.md
	varp: { name: "VARP", params: [{ name: "expression" }] }, // functions/varp-transact-sql.md
	vector_distance: {
		name: "VECTOR_DISTANCE",
		params: [{ name: "distance_metric" }, { name: "vector1" }, { name: "vector2" }],
	}, // functions/vector-distance-transact-sql.md
	vector_norm: { name: "VECTOR_NORM", params: [{ name: "vector" }, { name: "norm_type" }] }, // functions/vector-norm-transact-sql.md
	vector_normalize: { name: "VECTOR_NORMALIZE", params: [{ name: "vector" }, { name: "norm_type" }] }, // functions/vector-normalize-transact-sql.md
	vectorproperty: { name: "VECTORPROPERTY", params: [{ name: "vector" }, { name: "property" }] }, // functions/vectorproperty-transact-sql.md
	verifysignedbyasymkey: {
		name: "VerifySignedByAsymKey",
		params: [{ name: "Asym_Key_ID" }, { name: "clear_text" }, { name: "signature" }],
	}, // functions/verifysignedbyasymkey-transact-sql.md
	verifysignedbycert: {
		name: "VerifySignedByCert",
		params: [{ name: "Cert_ID" }, { name: "signed_data" }, { name: "signature" }],
	}, // functions/verifysignedbycert-transact-sql.md
	version: { name: "VERSION", params: [] }, // functions/version-transact-sql-metadata-functions.md
	xact_state: { name: "XACT_STATE", params: [] }, // functions/xact-state-transact-sql.md
	year: { name: "YEAR", params: [{ name: "date" }] }, // functions/year-transact-sql.md
};
