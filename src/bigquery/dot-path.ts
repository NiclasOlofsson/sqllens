import { CharStream, CommonToken, type Lexer, ListTokenSource, type Token } from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";

// GoogleSQL's DOT_IDENTIFIER mode, ported from ZetaSQL's lookahead_transformer.cc
// (TransformDotSymbol / TransformIntegerLiteral). After a `.` whose preceding token can head a
// path expression, the tokenizer treats a following numeric token as an identifier path component,
// so `foo.123`, `x.1.2.3`, `a.b.c.123`, `t.2daysago` parse without backquoting. Our ANTLR lexer
// instead eagerly fuses `.123`/`1.2` into FLOATING_POINT_LITERAL tokens, so we replicate ZetaSQL's
// behavior as a token-stream rewrite between the lexer and parser rather than in the grammar.
//
// Spec: vendor/googlesql/googlesql/parser/googlesql.tm (path_expression note ~L9695) and
// lookahead_transformer.cc (LookbackTokenCanBeBeforeDotInPathExpression, TransformDotSymbol,
// TransformIntegerLiteral). A `.` is a path separator when the previous token is an identifier-
// capable token (IDENTIFIER, a nonreserved keyword, SIMPLE_SYMBOL), `)`, `]`, or `?`.

const T_IDENTIFIER = GoogleSQLLexer.IDENTIFIER;
const T_DOT = GoogleSQLLexer.DOT_SYMBOL;
const T_FLOAT = GoogleSQLLexer.FLOATING_POINT_LITERAL;
const T_INTEGER = GoogleSQLLexer.INTEGER_LITERAL; // hex literals lex to INTEGER_LITERAL too
const T_INVALID = GoogleSQLLexer.INVALID_NUMERIC_LITERAL;

// Tokens after which a `.` opens a path component. Identifier-capable tokens = token_identifier
// (IDENTIFIER) plus keyword_as_identifier (the nonreserved keyword set + SIMPLE_SYMBOL), per the
// parser grammar's `identifier` rule; plus the closers `)` `]` and the positional param `?`.
const PATH_HEAD_NAMES = [
	"IDENTIFIER",
	"SIMPLE_SYMBOL",
	"RR_BRACKET_SYMBOL",
	"RS_BRACKET_SYMBOL",
	"QUESTION_SYMBOL",
	// keyword_as_identifier (common_keyword_as_identifier in GoogleSQLParser.g4)
	"ABORT_SYMBOL","ACCESS_SYMBOL","ACTION_SYMBOL","ADD_SYMBOL","AFTER_SYMBOL","AGGREGATE_SYMBOL","ALTER_SYMBOL","ALWAYS_SYMBOL","ANALYZE_SYMBOL","APPROX_SYMBOL","ARE_SYMBOL","ASSERT_SYMBOL","AT_KEYWORD_SYMBOL","BATCH_SYMBOL","BEGIN_SYMBOL","BIGDECIMAL_SYMBOL","BIGNUMERIC_SYMBOL","BREAK_SYMBOL","CALL_SYMBOL","CASCADE_SYMBOL","CHECK_SYMBOL","CLAMPED_SYMBOL","CLONE_SYMBOL","CLUSTER_SYMBOL","COLUMN_SYMBOL","COLUMNS_SYMBOL","COMMIT_SYMBOL","CONFLICT_SYMBOL","CONNECTION_SYMBOL","CONSTANT_SYMBOL","CONSTRAINT_SYMBOL","CONTINUE_SYMBOL","COPY_SYMBOL","CORRESPONDING_SYMBOL","CYCLE_SYMBOL","DATA_SYMBOL","DATABASE_SYMBOL","DATE_SYMBOL","DATETIME_SYMBOL","DECIMAL_SYMBOL","DECLARE_SYMBOL","DEFINER_SYMBOL","DELETE_SYMBOL","DELETION_SYMBOL","DELTA_SYMBOL","DEPTH_SYMBOL","DESCRIBE_SYMBOL","DESCRIPTOR_SYMBOL","DESTINATION_SYMBOL","DETERMINISTIC_SYMBOL","DIFFERENTIAL_PRIVACY_SYMBOL","DO_SYMBOL","DROP_SYMBOL","DYNAMIC_SYMBOL","ELSEIF_SYMBOL","ENFORCED_SYMBOL","EPSILON_SYMBOL","ERROR_SYMBOL","EXCEPTION_SYMBOL","EXECUTE_SYMBOL","EXPLAIN_SYMBOL","EXPORT_SYMBOL","EXTEND_SYMBOL","EXTERNAL_SYMBOL","FILES_SYMBOL","FILL_SYMBOL","FILTER_SYMBOL","FIRST_SYMBOL","FOREIGN_SYMBOL","FORK_SYMBOL","FORMAT_SYMBOL","FUNCTION_SYMBOL","GENERATED_SYMBOL","GRANT_SYMBOL","GRAPH_SYMBOL","GROUP_ROWS_SYMBOL","HIDDEN_SYMBOL","IDENTITY_SYMBOL","IMMEDIATE_SYMBOL","IMMUTABLE_SYMBOL","IMPORT_SYMBOL","INCLUDE_SYMBOL","INCREMENT_SYMBOL","INDEX_SYMBOL","INOUT_SYMBOL","INPUT_SYMBOL","INSERT_SYMBOL","INTERLEAVE_SYMBOL","INVOKER_SYMBOL","ISOLATION_SYMBOL","ITERATE_SYMBOL","JSON_SYMBOL","KEY_SYMBOL","KW_MATCH_RECOGNIZE_NONRESERVED_SYMBOL","LANGUAGE_SYMBOL","LAST_SYMBOL","LEAVE_SYMBOL","LEVEL_SYMBOL","LOAD_SYMBOL","LOG_SYMBOL","LOOP_SYMBOL","MACRO_SYMBOL","MAP_SYMBOL","MATCH_SYMBOL","MATCHED_SYMBOL","MATERIALIZED_SYMBOL","MAX_GROUPS_CONTRIBUTED_SYMBOL","MAX_SYMBOL","MAXVALUE_SYMBOL","MEASURES_SYMBOL","MESSAGE_SYMBOL","METADATA_SYMBOL","MIN_SYMBOL","MINVALUE_SYMBOL","MODEL_SYMBOL","MODULE_SYMBOL","NAME_SYMBOL","NULL_FILTERED_SYMBOL","NUMERIC_SYMBOL","OFFSET_SYMBOL","ONLY_SYMBOL","OPTIONS_SYMBOL","OUT_SYMBOL","OUTPUT_SYMBOL","OVERWRITE_SYMBOL","PARENT_SYMBOL","PARTITIONS_SYMBOL","PAST_SYMBOL","PATTERN_SYMBOL","PERCENT_SYMBOL","PIVOT_SYMBOL","POLICIES_SYMBOL","POLICY_SYMBOL","PRIMARY_SYMBOL","PRIVACY_UNIT_COLUMN_SYMBOL","PRIVATE_SYMBOL","PRIVILEGE_SYMBOL","PRIVILEGES_SYMBOL","PROCEDURE_SYMBOL","PROJECT_SYMBOL","PROPERTY_SYMBOL","PUBLIC_SYMBOL","RAISE_SYMBOL","READ_SYMBOL","REFERENCES_SYMBOL","REMOTE_SYMBOL","REMOVE_SYMBOL","RENAME_SYMBOL","REPEAT_SYMBOL","REPEATABLE_SYMBOL","REPLACE_FIELDS_SYMBOL","REPLACE_SYMBOL","REPLICA_SYMBOL","REPORT_SYMBOL","RESTRICT_SYMBOL","RESTRICTION_SYMBOL","RETURN_SYMBOL","RETURNS_SYMBOL","REVOKE_SYMBOL","ROLLBACK_SYMBOL","ROW_SYMBOL","RUN_SYMBOL","SAFE_CAST_SYMBOL","SCHEMA_SYMBOL","SEARCH_SYMBOL","SECURITY_SYMBOL","SEQUENCE_SYMBOL","SETS_SYMBOL","SHOW_SYMBOL","SNAPSHOT_SYMBOL","SOURCE_SYMBOL","SQL_SYMBOL","STABLE_SYMBOL","START_SYMBOL","STATIC_DESCRIBE_SYMBOL","STORED_SYMBOL","STORING_SYMBOL","STRICT_SYMBOL","SYSTEM_SYMBOL","SYSTEM_TIME_SYMBOL","TABLE_SYMBOL","TABLES_SYMBOL","TARGET_SYMBOL","TEE_SYMBOL","TEMP_SYMBOL","TEMPORARY_SYMBOL","TIME_SYMBOL","TIMESTAMP_SYMBOL","TRANSACTION_SYMBOL","TRANSFORM_SYMBOL","TRUNCATE_SYMBOL","TYPE_SYMBOL","UNDROP_SYMBOL","UNIQUE_SYMBOL","UNKNOWN_SYMBOL","UNPIVOT_SYMBOL","UNTIL_SYMBOL","UPDATE_SYMBOL","VALUE_SYMBOL","VALUES_SYMBOL","VECTOR_SYMBOL","VIEW_SYMBOL","VIEWS_SYMBOL","VOLATILE_SYMBOL","WEIGHT_SYMBOL","WHILE_SYMBOL","WRITE_SYMBOL","ZONE_SYMBOL",
];

const PATH_HEAD: ReadonlySet<number> = new Set(
	PATH_HEAD_NAMES.map((n) => GoogleSQLLexer.symbolicNames.indexOf(n)).filter((t) => t > 0),
);

function cloneRetyped(src: Token, type: number, text: string, start: number, stop: number): CommonToken {
	const t = CommonToken.fromToken(src);
	t.setType(type);
	t.setText(text);
	t.start = start;
	t.stop = stop;
	return t;
}

/** Apply the DOT_IDENTIFIER rewrite to a flat token list (default channel; EOF excluded). */
function rewriteDotPaths(tokens: Token[]): Token[] {
	const out: Token[] = [];
	let lookback = -1; // type of the last emitted default-channel token
	let pathDot = false; // the last emitted token was a path-separator `.`

	for (const tok of tokens) {
		// Hidden-channel tokens (whitespace, comments) pass through and don't affect the lookback;
		// GoogleSQL allows whitespace around the `.` in a path (`x. 123`, `x.1 .2`).
		if (tok.channel !== 0) {
			out.push(tok);
			continue;
		}
		const type = tok.type;
		const text = tok.text ?? "";

		// A leading-dot numeric token (`.123`, `.1e2`, `.2daysago`, `.0x1f`) right after a path head
		// is `.` + identifier. Split it; the identifier is everything after the dot (exact charset
		// fidelity isn't needed — the parser accepts any IDENTIFIER token as a path component).
		if ((type === T_FLOAT || type === T_INVALID) && text.startsWith(".") && PATH_HEAD.has(lookback)) {
			out.push(cloneRetyped(tok, T_DOT, ".", tok.start, tok.start));
			out.push(cloneRetyped(tok, T_IDENTIFIER, text.slice(1), tok.start + 1, tok.stop));
			lookback = T_IDENTIFIER;
			pathDot = false;
			continue;
		}

		// An integer/hex literal right after a path-separator `.` becomes an identifier component
		// (`x.1 .2 . 3`, `a.b.c . 123`).
		if (type === T_INTEGER && pathDot) {
			out.push(cloneRetyped(tok, T_IDENTIFIER, text, tok.start, tok.stop));
			lookback = T_IDENTIFIER;
			pathDot = false;
			continue;
		}

		if (type === T_DOT) {
			out.push(tok);
			pathDot = PATH_HEAD.has(lookback);
			lookback = T_DOT;
			continue;
		}

		out.push(tok);
		lookback = type;
		pathDot = false;
	}
	return out;
}

/**
 * Lex `sql` and return a token source with the DOT_IDENTIFIER rewrite applied. The lexer's error
 * listeners (attached by the caller) fire during the full lex here.
 */
export function dotPathTokenSource(sql: string, lexer: Lexer): ListTokenSource {
	const tokens = lexer.getAllTokens(); // full lex (drives lexer error listeners); EOF excluded
	return new ListTokenSource(rewriteDotPaths(tokens));
}

export { GoogleSQLLexer };
