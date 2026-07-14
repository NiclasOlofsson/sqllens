// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for redshift (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-14. 294 names (0 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const REDSHIFT_FN_DOCS: Record<string, FnDoc> = {
	abs: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ABS.html", origin: "vendor-docs" },
	acos: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ACOS.html", origin: "vendor-docs" },
	addbbox: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/AddBBox-function.html", origin: "vendor-docs" },
	any_value: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ANY_VALUE.html", origin: "vendor-docs" },
	array: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_array.html", origin: "vendor-docs" },
	array_concat: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_array_concat.html",
		origin: "vendor-docs",
	},
	array_contains: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_contains.html",
		origin: "vendor-docs",
	},
	array_distinct: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_distinct.html",
		origin: "vendor-docs",
	},
	array_flatten: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_flatten.html",
		origin: "vendor-docs",
	},
	array_position: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_position.html",
		origin: "vendor-docs",
	},
	array_positions: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_positions.html",
		origin: "vendor-docs",
	},
	array_sort: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_sort.html", origin: "vendor-docs" },
	array_union: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_union.html", origin: "vendor-docs" },
	arrays_overlap: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/arrays_overlap.html",
		origin: "vendor-docs",
	},
	ascii: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ASCII.html", origin: "vendor-docs" },
	asin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ASIN.html", origin: "vendor-docs" },
	atan: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ATAN.html", origin: "vendor-docs" },
	atan2: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ATAN2.html", origin: "vendor-docs" },
	avg: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_AVG.html", origin: "vendor-docs" },
	bit_and: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BIT_AND.html", origin: "vendor-docs" },
	bit_or: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BIT_OR.html", origin: "vendor-docs" },
	bool_and: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BOOL_AND.html", origin: "vendor-docs" },
	bool_or: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BOOL_OR.html", origin: "vendor-docs" },
	bpcharcmp: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BPCHARCMP.html", origin: "vendor-docs" },
	btrim: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BTRIM.html", origin: "vendor-docs" },
	cbrt: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CBRT.html", origin: "vendor-docs" },
	change_query_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_QUERY_PRIORITY.html",
		origin: "vendor-docs",
	},
	change_session_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_SESSION_PRIORITY.html",
		origin: "vendor-docs",
	},
	change_user_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_USER_PRIORITY.html",
		origin: "vendor-docs",
	},
	charindex: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHARINDEX.html", origin: "vendor-docs" },
	checksum: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHECKSUM.html", origin: "vendor-docs" },
	chr: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHR.html", origin: "vendor-docs" },
	coalesce: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL_function.html", origin: "vendor-docs" },
	convert: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CONVERT_function.html",
		origin: "vendor-docs",
	},
	cos: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COS.html", origin: "vendor-docs" },
	cot: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COT.html", origin: "vendor-docs" },
	count: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COUNT.html", origin: "vendor-docs" },
	crc32: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/crc32-function.html", origin: "vendor-docs" },
	cume_dist: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_CUME_DIST.html", origin: "vendor-docs" },
	current_database: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_DATABASE.html",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SCHEMA.html",
		origin: "vendor-docs",
	},
	current_schemas: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SCHEMAS.html",
		origin: "vendor-docs",
	},
	current_session_arn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SESSION_ARN.html",
		origin: "vendor-docs",
	},
	current_setting: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SETTING.html",
		origin: "vendor-docs",
	},
	date_cmp: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP.html", origin: "vendor-docs" },
	date_cmp_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP_TIMESTAMP.html",
		origin: "vendor-docs",
	},
	date_cmp_timestamptz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP_TIMESTAMPTZ.html",
		origin: "vendor-docs",
	},
	date_part_year: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_PART_YEAR.html",
		origin: "vendor-docs",
	},
	date_trunc: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_TRUNC.html", origin: "vendor-docs" },
	db_collation: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DB_COLLATION.html",
		origin: "vendor-docs",
	},
	decimal_precision: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_decimal_precision.html",
		origin: "vendor-docs",
	},
	decimal_scale: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_decimal_scale.html",
		origin: "vendor-docs",
	},
	degrees: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DEGREES.html", origin: "vendor-docs" },
	dexp: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DEXP.html", origin: "vendor-docs" },
	difference: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/DIFFERENCE.html", origin: "vendor-docs" },
	dlog10: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DLOG10.html", origin: "vendor-docs" },
	dropbbox: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/DropBBox-function.html",
		origin: "vendor-docs",
	},
	exp: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_EXP.html", origin: "vendor-docs" },
	farmfingerprint64: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FARMFINGERPRINT64.html",
		origin: "vendor-docs",
	},
	floor: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FLOOR.html", origin: "vendor-docs" },
	fnv_hash: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FNV_HASH.html", origin: "vendor-docs" },
	from_hex: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FROM_HEX.html", origin: "vendor-docs" },
	from_varbyte: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FROM_VARBYTE.html",
		origin: "vendor-docs",
	},
	geometrytype: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/GeometryType-function.html",
		origin: "vendor-docs",
	},
	get_array_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/get_array_length.html",
		origin: "vendor-docs",
	},
	get_mounted_role: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/GET_MOUNTED_ROLE.html",
		origin: "vendor-docs",
	},
	get_number_attributes: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/get_number_attributes.html",
		origin: "vendor-docs",
	},
	getbit: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GETBIT.html", origin: "vendor-docs" },
	getdate: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GETDATE.html", origin: "vendor-docs" },
	greatest: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GREATEST_LEAST.html", origin: "vendor-docs" },
	h3_boundary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Boundary-function.html",
		origin: "vendor-docs",
	},
	h3_center: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Center-function.html",
		origin: "vendor-docs",
	},
	h3_fromlonglat: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_FromLongLat-function.html",
		origin: "vendor-docs",
	},
	h3_frompoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_FromPoint-function.html",
		origin: "vendor-docs",
	},
	h3_isvalid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_IsValid-function.html",
		origin: "vendor-docs",
	},
	h3_polyfill: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Polyfill-function.html",
		origin: "vendor-docs",
	},
	h3_resolution: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Resolution-function.html",
		origin: "vendor-docs",
	},
	h3_tochildren: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_ToChildren-function.html",
		origin: "vendor-docs",
	},
	h3_toparent: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_ToParent-function.html",
		origin: "vendor-docs",
	},
	hll: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_function.html", origin: "vendor-docs" },
	hll_cardinality: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_CARDINALITY.html",
		origin: "vendor-docs",
	},
	hll_combine: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_COMBINE.html", origin: "vendor-docs" },
	hll_combine_sketches: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_COMBINE_SKETCHES.html",
		origin: "vendor-docs",
	},
	hll_create_sketch: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_CREATE_SKETCH.html",
		origin: "vendor-docs",
	},
	initcap: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_INITCAP.html", origin: "vendor-docs" },
	interval_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_INTERVAL_CMP.html",
		origin: "vendor-docs",
	},
	is_array: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_array.html", origin: "vendor-docs" },
	is_bigint: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_bigint.html", origin: "vendor-docs" },
	is_boolean: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_boolean.html", origin: "vendor-docs" },
	is_char: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_char.html", origin: "vendor-docs" },
	is_decimal: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_decimal.html", origin: "vendor-docs" },
	is_float: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_float.html", origin: "vendor-docs" },
	is_integer: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_integer.html", origin: "vendor-docs" },
	is_object: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_object.html", origin: "vendor-docs" },
	is_scalar: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_scalar.html", origin: "vendor-docs" },
	is_smallint: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_smallint.html", origin: "vendor-docs" },
	is_valid_json: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/IS_VALID_JSON.html",
		origin: "vendor-docs",
	},
	is_valid_json_array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/IS_VALID_JSON_ARRAY.html",
		origin: "vendor-docs",
	},
	is_varchar: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_varchar.html", origin: "vendor-docs" },
	json_array_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_ARRAY_LENGTH.html",
		origin: "vendor-docs",
	},
	json_extract_path_text: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_EXTRACT_PATH_TEXT.html",
		origin: "vendor-docs",
	},
	json_serialize: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_SERIALIZE.html",
		origin: "vendor-docs",
	},
	json_serialize_to_varbyte: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_SERIALIZE_TO_VARBYTE.html",
		origin: "vendor-docs",
	},
	json_size: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_json_size.html", origin: "vendor-docs" },
	json_typeof: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_json_typeof.html", origin: "vendor-docs" },
	last_user_query_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/LAST_USER_QUERY_ID.html",
		origin: "vendor-docs",
	},
	least: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GREATEST_LEAST.html", origin: "vendor-docs" },
	left: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEFT.html", origin: "vendor-docs" },
	len: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEN.html", origin: "vendor-docs" },
	listagg: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LISTAGG.html", origin: "vendor-docs" },
	ln: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LN.html", origin: "vendor-docs" },
	lower: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LOWER.html", origin: "vendor-docs" },
	lower_attribute_names: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_lower_attribute_names.html",
		origin: "vendor-docs",
	},
	ltrim: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LTRIM.html", origin: "vendor-docs" },
	max: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MAX.html", origin: "vendor-docs" },
	md5: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MD5.html", origin: "vendor-docs" },
	median: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MEDIAN.html", origin: "vendor-docs" },
	min: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MIN.html", origin: "vendor-docs" },
	mod: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MOD.html", origin: "vendor-docs" },
	months_between: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MONTHS_BETWEEN_function.html",
		origin: "vendor-docs",
	},
	murmur3_32_hash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/MURMUR3_32_HASH.html",
		origin: "vendor-docs",
	},
	ntile: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_NTILE.html", origin: "vendor-docs" },
	nullif: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NULLIF_function.html", origin: "vendor-docs" },
	nvl: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL_function.html", origin: "vendor-docs" },
	nvl2: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL2.html", origin: "vendor-docs" },
	octet_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_OCTET_LENGTH.html",
		origin: "vendor-docs",
	},
	octetindex: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/OCTETINDEX.html", origin: "vendor-docs" },
	percent_rank: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_PERCENT_RANK.html",
		origin: "vendor-docs",
	},
	pg_backend_pid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_BACKEND_PID.html",
		origin: "vendor-docs",
	},
	pg_cancel_backend: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_CANCEL_BACKEND.html",
		origin: "vendor-docs",
	},
	pg_get_cols: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_COLS.html", origin: "vendor-docs" },
	pg_get_grantee_by_iam_role: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_GRANTEE_BY_IAMROLE.html",
		origin: "vendor-docs",
	},
	pg_get_iam_role_by_user: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_IAM_ROLE_BY_USER.html",
		origin: "vendor-docs",
	},
	pg_get_late_binding_view_cols: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_LATE_BINDING_VIEW_COLS.html",
		origin: "vendor-docs",
	},
	pg_get_session_roles: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_SESSION_ROLES.html",
		origin: "vendor-docs",
	},
	pg_last_copy_count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_COPY_COUNT.html",
		origin: "vendor-docs",
	},
	pg_last_copy_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_COPY_ID.html",
		origin: "vendor-docs",
	},
	pg_last_query_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_QUERY_ID.html",
		origin: "vendor-docs",
	},
	pg_last_unload_count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_UNLOAD_COUNT.html",
		origin: "vendor-docs",
	},
	pg_last_unload_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_UNLOAD_ID.html",
		origin: "vendor-docs",
	},
	pg_terminate_backend: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_TERMINATE_BACKEND.html",
		origin: "vendor-docs",
	},
	pi: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_PI.html", origin: "vendor-docs" },
	quote_ident: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_QUOTE_IDENT.html", origin: "vendor-docs" },
	quote_literal: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_QUOTE_LITERAL.html",
		origin: "vendor-docs",
	},
	radians: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_RADIANS.html", origin: "vendor-docs" },
	random: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_RANDOM.html", origin: "vendor-docs" },
	ratio_to_report: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_RATIO_TO_REPORT.html",
		origin: "vendor-docs",
	},
	regexp_count: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_COUNT.html", origin: "vendor-docs" },
	regexp_replace: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_REPLACE.html",
		origin: "vendor-docs",
	},
	regexp_substr: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_SUBSTR.html",
		origin: "vendor-docs",
	},
	repeat: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REPEAT.html", origin: "vendor-docs" },
	replace: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REPLACE.html", origin: "vendor-docs" },
	reverse: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REVERSE.html", origin: "vendor-docs" },
	right: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEFT.html", origin: "vendor-docs" },
	role_is_member_of: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ROLE_IS_MEMBER_OF.html",
		origin: "vendor-docs",
	},
	round: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ROUND.html", origin: "vendor-docs" },
	set_config: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SET_CONFIG.html", origin: "vendor-docs" },
	sha1: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SHA1.html", origin: "vendor-docs" },
	sha2: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SHA2.html", origin: "vendor-docs" },
	sign: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIGN.html", origin: "vendor-docs" },
	sin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIN.html", origin: "vendor-docs" },
	size: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIZE.html", origin: "vendor-docs" },
	slice_num: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SLICE_NUM.html", origin: "vendor-docs" },
	soundex: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SOUNDEX.html", origin: "vendor-docs" },
	split_to_array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/split_to_array.html",
		origin: "vendor-docs",
	},
	sqrt: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SQRT.html", origin: "vendor-docs" },
	st_addpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AddPoint-function.html",
		origin: "vendor-docs",
	},
	st_angle: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Angle-function.html",
		origin: "vendor-docs",
	},
	st_area: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Area-function.html", origin: "vendor-docs" },
	st_asbinary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsBinary-function.html",
		origin: "vendor-docs",
	},
	st_asewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsEWKB-function.html",
		origin: "vendor-docs",
	},
	st_asewkt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsEWKT-function.html",
		origin: "vendor-docs",
	},
	st_asgeojson: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsGeoJSON-function.html",
		origin: "vendor-docs",
	},
	st_ashexewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsHexEWKB-function.html",
		origin: "vendor-docs",
	},
	st_ashexwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsHexWKB-function.html",
		origin: "vendor-docs",
	},
	st_astext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsText-function.html",
		origin: "vendor-docs",
	},
	st_azimuth: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Azimuth-function.html",
		origin: "vendor-docs",
	},
	st_boundary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Boundary-function.html",
		origin: "vendor-docs",
	},
	st_buffer: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Buffer-function.html",
		origin: "vendor-docs",
	},
	st_centroid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Centroid-function.html",
		origin: "vendor-docs",
	},
	st_contains: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Contains-function.html",
		origin: "vendor-docs",
	},
	st_containsproperly: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ContainsProperly-function.html",
		origin: "vendor-docs",
	},
	st_convexhull: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ConvexHull-function.html",
		origin: "vendor-docs",
	},
	st_coveredby: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_CoveredBy-function.html",
		origin: "vendor-docs",
	},
	st_covers: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Covers-function.html",
		origin: "vendor-docs",
	},
	st_crosses: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Crosses-function.html",
		origin: "vendor-docs",
	},
	st_dimension: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Dimension-function.html",
		origin: "vendor-docs",
	},
	st_disjoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Disjoint-function.html",
		origin: "vendor-docs",
	},
	st_distance: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Distance-function.html",
		origin: "vendor-docs",
	},
	st_distancesphere: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_DistanceSphere-function.html",
		origin: "vendor-docs",
	},
	st_dwithin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_DWithin-function.html",
		origin: "vendor-docs",
	},
	st_endpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_EndPoint-function.html",
		origin: "vendor-docs",
	},
	st_envelope: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Envelope-function.html",
		origin: "vendor-docs",
	},
	st_equals: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Equals-function.html",
		origin: "vendor-docs",
	},
	st_exteriorring: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ExteriorRing-function.html",
		origin: "vendor-docs",
	},
	st_force2d: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force2D-function.html",
		origin: "vendor-docs",
	},
	st_force3dm: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force3DM-function.html",
		origin: "vendor-docs",
	},
	st_force3dz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force3DZ-function.html",
		origin: "vendor-docs",
	},
	st_force4d: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force4D-function.html",
		origin: "vendor-docs",
	},
	st_geogfromtext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeogFromText-function.html",
		origin: "vendor-docs",
	},
	st_geogfromwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeogFromWKB-function.html",
		origin: "vendor-docs",
	},
	st_geohash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeoHash-function.html",
		origin: "vendor-docs",
	},
	st_geometryn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeometryN-function.html",
		origin: "vendor-docs",
	},
	st_geometrytype: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeometryType-function.html",
		origin: "vendor-docs",
	},
	st_geomfromewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromEWKB-function.html",
		origin: "vendor-docs",
	},
	st_geomfromewkt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromEWKT-function.html",
		origin: "vendor-docs",
	},
	st_geomfromgeohash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoHash-function.html",
		origin: "vendor-docs",
	},
	st_geomfromgeojson: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoJSON-function.html",
		origin: "vendor-docs",
	},
	st_geomfromgeosquare: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoSquare-function.html",
		origin: "vendor-docs",
	},
	st_geomfromtext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromText-function.html",
		origin: "vendor-docs",
	},
	st_geomfromwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromWKB-function.html",
		origin: "vendor-docs",
	},
	st_geosquare: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeoSquare-function.html",
		origin: "vendor-docs",
	},
	st_interiorringn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_InteriorRingN-function.html",
		origin: "vendor-docs",
	},
	st_intersection: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Intersection-function.html",
		origin: "vendor-docs",
	},
	st_intersects: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Intersects-function.html",
		origin: "vendor-docs",
	},
	st_isclosed: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsClosed-function.html",
		origin: "vendor-docs",
	},
	st_iscollection: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsCollection-function.html",
		origin: "vendor-docs",
	},
	st_isempty: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsEmpty-function.html",
		origin: "vendor-docs",
	},
	st_ispolygonccw: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsPolygonCCW-function.html",
		origin: "vendor-docs",
	},
	st_ispolygoncw: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsPolygonCW-function.html",
		origin: "vendor-docs",
	},
	st_isring: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsRing-function.html",
		origin: "vendor-docs",
	},
	st_issimple: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsSimple-function.html",
		origin: "vendor-docs",
	},
	st_isvalid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsValid-function.html",
		origin: "vendor-docs",
	},
	st_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Length-function.html",
		origin: "vendor-docs",
	},
	st_lengthsphere: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LengthSphere-function.html",
		origin: "vendor-docs",
	},
	st_linefrommultipoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LineFromMultiPoint-function.html",
		origin: "vendor-docs",
	},
	st_lineinterpolatepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LineInterpolatePoint-function.html",
		origin: "vendor-docs",
	},
	st_m: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_M-function.html", origin: "vendor-docs" },
	st_makeenvelope: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakeEnvelope-function.html",
		origin: "vendor-docs",
	},
	st_makeline: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakeLine-function.html",
		origin: "vendor-docs",
	},
	st_makepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakePoint-function.html",
		origin: "vendor-docs",
	},
	st_makepolygon: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakePolygon-function.html",
		origin: "vendor-docs",
	},
	st_memsize: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MemSize-function.html",
		origin: "vendor-docs",
	},
	st_mmax: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MMax-function.html", origin: "vendor-docs" },
	st_mmin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MMin-function.html", origin: "vendor-docs" },
	st_multi: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Multi-function.html",
		origin: "vendor-docs",
	},
	st_ndims: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NDims-function.html",
		origin: "vendor-docs",
	},
	st_npoints: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NPoints-function.html",
		origin: "vendor-docs",
	},
	st_nrings: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NRings-function.html",
		origin: "vendor-docs",
	},
	st_numgeometries: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumGeometries-function.html",
		origin: "vendor-docs",
	},
	st_numinteriorrings: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumInteriorRings-function.html",
		origin: "vendor-docs",
	},
	st_numpoints: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumPoints-function.html",
		origin: "vendor-docs",
	},
	st_perimeter: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Perimeter-function.html",
		origin: "vendor-docs",
	},
	st_point: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Point-function.html",
		origin: "vendor-docs",
	},
	st_pointn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_PointN-function.html",
		origin: "vendor-docs",
	},
	st_points: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Points-function.html",
		origin: "vendor-docs",
	},
	st_polygon: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Polygon-function.html",
		origin: "vendor-docs",
	},
	st_removepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_RemovePoint-function.html",
		origin: "vendor-docs",
	},
	st_reverse: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Reverse-function.html",
		origin: "vendor-docs",
	},
	st_setpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SetPoint-function.html",
		origin: "vendor-docs",
	},
	st_setsrid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SetSRID-function.html",
		origin: "vendor-docs",
	},
	st_simplify: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Simplify-function.html",
		origin: "vendor-docs",
	},
	st_srid: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SRID-function.html", origin: "vendor-docs" },
	st_startpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_StartPoint-function.html",
		origin: "vendor-docs",
	},
	st_touches: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Touches-function.html",
		origin: "vendor-docs",
	},
	st_transform: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Transform-function.html",
		origin: "vendor-docs",
	},
	st_union: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Union-function.html",
		origin: "vendor-docs",
	},
	st_within: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Within-function.html",
		origin: "vendor-docs",
	},
	st_x: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_X-function.html", origin: "vendor-docs" },
	st_xmax: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_XMax-function.html", origin: "vendor-docs" },
	st_xmin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_XMin-function.html", origin: "vendor-docs" },
	st_y: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Y-function.html", origin: "vendor-docs" },
	st_ymax: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_YMax-function.html", origin: "vendor-docs" },
	st_ymin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_YMin-function.html", origin: "vendor-docs" },
	st_z: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Z-function.html", origin: "vendor-docs" },
	st_zmax: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ZMax-function.html", origin: "vendor-docs" },
	st_zmin: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ZMin-function.html", origin: "vendor-docs" },
	stddev_pop: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STDDEV_functions.html",
		origin: "vendor-docs",
	},
	strpos: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STRPOS.html", origin: "vendor-docs" },
	strtol: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STRTOL.html", origin: "vendor-docs" },
	subarray: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_subarray.html", origin: "vendor-docs" },
	substring: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SUBSTRING.html", origin: "vendor-docs" },
	sum: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SUM.html", origin: "vendor-docs" },
	supportsbbox: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SupportsBBox-function.html",
		origin: "vendor-docs",
	},
	tan: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TAN.html", origin: "vendor-docs" },
	text_to_int_alt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TEXT_TO_INT_ALT.html",
		origin: "vendor-docs",
	},
	timeofday: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMEOFDAY_function.html",
		origin: "vendor-docs",
	},
	timestamp_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP.html",
		origin: "vendor-docs",
	},
	timestamp_cmp_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP_DATE.html",
		origin: "vendor-docs",
	},
	timestamp_cmp_timestamptz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP_TIMESTAMPTZ.html",
		origin: "vendor-docs",
	},
	timestamptz_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP.html",
		origin: "vendor-docs",
	},
	timestamptz_cmp_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP_DATE.html",
		origin: "vendor-docs",
	},
	timestamptz_cmp_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP_TIMESTAMP.html",
		origin: "vendor-docs",
	},
	to_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_DATE_function.html",
		origin: "vendor-docs",
	},
	to_hex: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_HEX.html", origin: "vendor-docs" },
	to_number: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_NUMBER.html", origin: "vendor-docs" },
	to_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_TIMESTAMP.html",
		origin: "vendor-docs",
	},
	to_varbyte: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_VARBYTE.html", origin: "vendor-docs" },
	translate: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TRANSLATE.html", origin: "vendor-docs" },
	trunc: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TRUNC.html", origin: "vendor-docs" },
	upper: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_UPPER.html", origin: "vendor-docs" },
	upper_attribute_names: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_upper_attribute_names.html",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_VARIANCE_functions.html",
		origin: "vendor-docs",
	},
	version: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_VERSION.html", origin: "vendor-docs" },
};
