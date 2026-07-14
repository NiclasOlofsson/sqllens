// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for tsql (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-14. 198 names (0 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const TSQL_FN_DOCS: Record<string, FnDoc> = {
	abs: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/abs-transact-sql", origin: "vendor-docs" },
	acos: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/acos-transact-sql", origin: "vendor-docs" },
	any_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/any-value-transact-sql",
		origin: "vendor-docs",
	},
	app_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/app-name-transact-sql",
		origin: "vendor-docs",
	},
	approx_count_distinct: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-count-distinct-transact-sql",
		origin: "vendor-docs",
	},
	approx_percentile_cont: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-percentile-cont-transact-sql",
		origin: "vendor-docs",
	},
	approx_percentile_disc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-percentile-disc-transact-sql",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ascii-transact-sql",
		origin: "vendor-docs",
	},
	asin: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/asin-transact-sql", origin: "vendor-docs" },
	atan: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/atan-transact-sql", origin: "vendor-docs" },
	atn2: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/atn2-transact-sql", origin: "vendor-docs" },
	avg: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/avg-transact-sql", origin: "vendor-docs" },
	base64_decode: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/base64-decode-transact-sql",
		origin: "vendor-docs",
	},
	base64_encode: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/base64-encode-transact-sql",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/bit-count-transact-sql",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ceiling-transact-sql",
		origin: "vendor-docs",
	},
	certencoded: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/certencoded-transact-sql",
		origin: "vendor-docs",
	},
	char: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/char-transact-sql", origin: "vendor-docs" },
	charindex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/charindex-transact-sql",
		origin: "vendor-docs",
	},
	checksum_agg: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/checksum-agg-transact-sql",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/language-elements/coalesce-transact-sql",
		origin: "vendor-docs",
	},
	col_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/col-name-transact-sql",
		origin: "vendor-docs",
	},
	collationproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/collation-functions-collationproperty-transact-sql",
		origin: "vendor-docs",
	},
	columnproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/columnproperty-transact-sql",
		origin: "vendor-docs",
	},
	columns_updated: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/columns-updated-transact-sql",
		origin: "vendor-docs",
	},
	compress: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/compress-transact-sql",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/concat-transact-sql",
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/concat-ws-transact-sql",
		origin: "vendor-docs",
	},
	connectionproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/connectionproperty-transact-sql",
		origin: "vendor-docs",
	},
	context_info: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/context-info-transact-sql",
		origin: "vendor-docs",
	},
	cos: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cos-transact-sql", origin: "vendor-docs" },
	cot: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cot-transact-sql", origin: "vendor-docs" },
	crypt_gen_random: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/crypt-gen-random-transact-sql",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cume-dist-transact-sql",
		origin: "vendor-docs",
	},
	current_request_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-request-id-transact-sql",
		origin: "vendor-docs",
	},
	current_timezone: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-timezone-transact-sql",
		origin: "vendor-docs",
	},
	current_timezone_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-timezone-id-transact-sql",
		origin: "vendor-docs",
	},
	current_transaction_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-transaction-id-transact-sql",
		origin: "vendor-docs",
	},
	databasepropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/databasepropertyex-transact-sql",
		origin: "vendor-docs",
	},
	datalength: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datalength-transact-sql",
		origin: "vendor-docs",
	},
	date_bucket: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/date-bucket-transact-sql",
		origin: "vendor-docs",
	},
	dateadd: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/dateadd-transact-sql",
		origin: "vendor-docs",
	},
	datediff: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datediff-transact-sql",
		origin: "vendor-docs",
	},
	datediff_big: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datediff-big-transact-sql",
		origin: "vendor-docs",
	},
	datefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datefromparts-transact-sql",
		origin: "vendor-docs",
	},
	datename: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datename-transact-sql",
		origin: "vendor-docs",
	},
	datepart: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datepart-transact-sql",
		origin: "vendor-docs",
	},
	datetime2fromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetime2fromparts-transact-sql",
		origin: "vendor-docs",
	},
	datetimefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetimefromparts-transact-sql",
		origin: "vendor-docs",
	},
	datetimeoffsetfromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetimeoffsetfromparts-transact-sql",
		origin: "vendor-docs",
	},
	datetrunc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetrunc-transact-sql",
		origin: "vendor-docs",
	},
	day: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/day-transact-sql", origin: "vendor-docs" },
	db_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/db-name-transact-sql",
		origin: "vendor-docs",
	},
	decompress: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/decompress-transact-sql",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/degrees-transact-sql",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/dense-rank-transact-sql",
		origin: "vendor-docs",
	},
	difference: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/difference-transact-sql",
		origin: "vendor-docs",
	},
	edge_id_from_parts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/edge-id-from-parts-transact-sql",
		origin: "vendor-docs",
	},
	eomonth: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/eomonth-transact-sql",
		origin: "vendor-docs",
	},
	error_line: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-line-transact-sql",
		origin: "vendor-docs",
	},
	error_message: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-message-transact-sql",
		origin: "vendor-docs",
	},
	error_number: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-number-transact-sql",
		origin: "vendor-docs",
	},
	error_procedure: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-procedure-transact-sql",
		origin: "vendor-docs",
	},
	error_severity: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-severity-transact-sql",
		origin: "vendor-docs",
	},
	error_state: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-state-transact-sql",
		origin: "vendor-docs",
	},
	eventdata: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/eventdata-transact-sql",
		origin: "vendor-docs",
	},
	exp: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/exp-transact-sql", origin: "vendor-docs" },
	file_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-id-transact-sql",
		origin: "vendor-docs",
	},
	file_idex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-idex-transact-sql",
		origin: "vendor-docs",
	},
	file_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-name-transact-sql",
		origin: "vendor-docs",
	},
	filegroup_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filegroup-name-transact-sql",
		origin: "vendor-docs",
	},
	filegroupproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filegroupproperty-transact-sql",
		origin: "vendor-docs",
	},
	fileproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/fileproperty-transact-sql",
		origin: "vendor-docs",
	},
	filepropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filepropertyex-transact-sql",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/first-value-transact-sql",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/floor-transact-sql",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/format-transact-sql",
		origin: "vendor-docs",
	},
	generate_series: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/generate-series-transact-sql",
		origin: "vendor-docs",
	},
	get_bit: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/get-bit-transact-sql",
		origin: "vendor-docs",
	},
	get_filestream_transaction_context: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/get-filestream-transaction-context-transact-sql",
		origin: "vendor-docs",
	},
	getdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/getdate-transact-sql",
		origin: "vendor-docs",
	},
	getutcdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/getutcdate-transact-sql",
		origin: "vendor-docs",
	},
	graph_id_from_edge_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/graph-id-from-edge-id-transact-sql",
		origin: "vendor-docs",
	},
	graph_id_from_node_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/graph-id-from-node-id-transact-sql",
		origin: "vendor-docs",
	},
	greatest: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-greatest-transact-sql",
		origin: "vendor-docs",
	},
	host_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/host-id-transact-sql",
		origin: "vendor-docs",
	},
	host_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/host-name-transact-sql",
		origin: "vendor-docs",
	},
	iif: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-iif-transact-sql",
		origin: "vendor-docs",
	},
	indexkey_property: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/indexkey-property-transact-sql",
		origin: "vendor-docs",
	},
	indexproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/indexproperty-transact-sql",
		origin: "vendor-docs",
	},
	isdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isdate-transact-sql",
		origin: "vendor-docs",
	},
	isjson: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isjson-transact-sql",
		origin: "vendor-docs",
	},
	isnull: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isnull-transact-sql",
		origin: "vendor-docs",
	},
	isnumeric: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isnumeric-transact-sql",
		origin: "vendor-docs",
	},
	json_contains: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-contains-transact-sql",
		origin: "vendor-docs",
	},
	json_modify: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-modify-transact-sql",
		origin: "vendor-docs",
	},
	json_path_exists: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-path-exists-transact-sql",
		origin: "vendor-docs",
	},
	json_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-value-transact-sql",
		origin: "vendor-docs",
	},
	lag: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lag-transact-sql", origin: "vendor-docs" },
	last_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/last-value-transact-sql",
		origin: "vendor-docs",
	},
	lead: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lead-transact-sql", origin: "vendor-docs" },
	least: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-least-transact-sql",
		origin: "vendor-docs",
	},
	left: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/left-transact-sql", origin: "vendor-docs" },
	left_shift: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/left-shift-transact-sql",
		origin: "vendor-docs",
	},
	len: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/len-transact-sql", origin: "vendor-docs" },
	log: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/log-transact-sql", origin: "vendor-docs" },
	log10: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/log10-transact-sql",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lower-transact-sql",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ltrim-transact-sql",
		origin: "vendor-docs",
	},
	max: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/max-transact-sql", origin: "vendor-docs" },
	min: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/min-transact-sql", origin: "vendor-docs" },
	min_active_rowversion: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/min-active-rowversion-transact-sql",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/month-transact-sql",
		origin: "vendor-docs",
	},
	nchar: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/nchar-transact-sql",
		origin: "vendor-docs",
	},
	newid: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/newid-transact-sql",
		origin: "vendor-docs",
	},
	newsequentialid: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/newsequentialid-transact-sql",
		origin: "vendor-docs",
	},
	node_id_from_parts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/node-id-from-parts-transact-sql",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ntile-transact-sql",
		origin: "vendor-docs",
	},
	object_definition: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-definition-transact-sql",
		origin: "vendor-docs",
	},
	object_id_from_edge_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-id-from-edge-id-transact-sql",
		origin: "vendor-docs",
	},
	object_id_from_node_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-id-from-node-id-transact-sql",
		origin: "vendor-docs",
	},
	object_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-name-transact-sql",
		origin: "vendor-docs",
	},
	object_schema_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-schema-name-transact-sql",
		origin: "vendor-docs",
	},
	objectproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/objectproperty-transact-sql",
		origin: "vendor-docs",
	},
	objectpropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/objectpropertyex-transact-sql",
		origin: "vendor-docs",
	},
	openjson: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql",
		origin: "vendor-docs",
	},
	original_db_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/original-db-name-transact-sql",
		origin: "vendor-docs",
	},
	original_login: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/original-login-transact-sql",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percent-rank-transact-sql",
		origin: "vendor-docs",
	},
	percentile_cont: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percentile-cont-transact-sql",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percentile-disc-transact-sql",
		origin: "vendor-docs",
	},
	pi: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/pi-transact-sql", origin: "vendor-docs" },
	power: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/power-transact-sql",
		origin: "vendor-docs",
	},
	product: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/product-aggregate-transact-sql",
		origin: "vendor-docs",
	},
	publishingservername: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replication-functions-publishingservername",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/radians-transact-sql",
		origin: "vendor-docs",
	},
	rand: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rand-transact-sql", origin: "vendor-docs" },
	rank: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rank-transact-sql", origin: "vendor-docs" },
	replace: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replace-transact-sql",
		origin: "vendor-docs",
	},
	replicate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replicate-transact-sql",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/reverse-transact-sql",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/right-transact-sql",
		origin: "vendor-docs",
	},
	right_shift: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/right-shift-transact-sql",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/round-transact-sql",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/row-number-transact-sql",
		origin: "vendor-docs",
	},
	rowcount_big: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rowcount-big-transact-sql",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rtrim-transact-sql",
		origin: "vendor-docs",
	},
	schema_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/schema-id-transact-sql",
		origin: "vendor-docs",
	},
	schema_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/schema-name-transact-sql",
		origin: "vendor-docs",
	},
	scope_identity: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/scope-identity-transact-sql",
		origin: "vendor-docs",
	},
	session_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/session-id-transact-sql",
		origin: "vendor-docs",
	},
	sessionproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sessionproperty-transact-sql",
		origin: "vendor-docs",
	},
	set_bit: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/set-bit-transact-sql",
		origin: "vendor-docs",
	},
	sign: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sign-transact-sql", origin: "vendor-docs" },
	sin: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sin-transact-sql", origin: "vendor-docs" },
	smalldatetimefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/smalldatetimefromparts-transact-sql",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/soundex-transact-sql",
		origin: "vendor-docs",
	},
	space: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/space-transact-sql",
		origin: "vendor-docs",
	},
	sql_variant_property: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sql-variant-property-transact-sql",
		origin: "vendor-docs",
	},
	sqrt: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sqrt-transact-sql", origin: "vendor-docs" },
	square: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/square-transact-sql",
		origin: "vendor-docs",
	},
	stats_date: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stats-date-transact-sql",
		origin: "vendor-docs",
	},
	stdev: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stdev-transact-sql",
		origin: "vendor-docs",
	},
	stdevp: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stdevp-transact-sql",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-agg-transact-sql",
		origin: "vendor-docs",
	},
	string_escape: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-escape-transact-sql",
		origin: "vendor-docs",
	},
	string_split: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-split-transact-sql",
		origin: "vendor-docs",
	},
	stuff: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stuff-transact-sql",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/substring-transact-sql",
		origin: "vendor-docs",
	},
	sum: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sum-transact-sql", origin: "vendor-docs" },
	suser_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/suser-name-transact-sql",
		origin: "vendor-docs",
	},
	suser_sname: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/suser-sname-transact-sql",
		origin: "vendor-docs",
	},
	switchoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/switchoffset-transact-sql",
		origin: "vendor-docs",
	},
	sysdatetime: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysdatetime-transact-sql",
		origin: "vendor-docs",
	},
	sysdatetimeoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysdatetimeoffset-transact-sql",
		origin: "vendor-docs",
	},
	sysutcdatetime: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysutcdatetime-transact-sql",
		origin: "vendor-docs",
	},
	tan: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/tan-transact-sql", origin: "vendor-docs" },
	tertiary_weights: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/collation-functions-tertiary-weights-transact-sql",
		origin: "vendor-docs",
	},
	textptr: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/text-and-image-functions-textptr-transact-sql",
		origin: "vendor-docs",
	},
	timefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/timefromparts-transact-sql",
		origin: "vendor-docs",
	},
	todatetimeoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/todatetimeoffset-transact-sql",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/translate-transact-sql",
		origin: "vendor-docs",
	},
	type_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/type-name-transact-sql",
		origin: "vendor-docs",
	},
	typeproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/typeproperty-transact-sql",
		origin: "vendor-docs",
	},
	update: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/update-trigger-functions-transact-sql",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/upper-transact-sql",
		origin: "vendor-docs",
	},
	user_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/user-name-transact-sql",
		origin: "vendor-docs",
	},
	var: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/var-transact-sql", origin: "vendor-docs" },
	varp: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/varp-transact-sql", origin: "vendor-docs" },
	vector_distance: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-distance-transact-sql",
		origin: "vendor-docs",
	},
	vector_norm: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-norm-transact-sql",
		origin: "vendor-docs",
	},
	vector_normalize: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-normalize-transact-sql",
		origin: "vendor-docs",
	},
	vectorproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vectorproperty-transact-sql",
		origin: "vendor-docs",
	},
	verifysignedbyasymkey: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/verifysignedbyasymkey-transact-sql",
		origin: "vendor-docs",
	},
	verifysignedbycert: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/verifysignedbycert-transact-sql",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/version-transact-sql-metadata-functions",
		origin: "vendor-docs",
	},
	xact_state: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/xact-state-transact-sql",
		origin: "vendor-docs",
	},
	year: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/year-transact-sql", origin: "vendor-docs" },
};
