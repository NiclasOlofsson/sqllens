import { CharStream, CommonToken, type Lexer, ListTokenSource, type Token } from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { badLiteralEscapes } from "./literal-escapes.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";

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
const T_AT = GoogleSQLLexer.AT_SYMBOL;
const T_ATAT = GoogleSQLLexer.ATAT_SYMBOL;
const T_INSERT = GoogleSQLLexer.INSERT_SYMBOL;
const T_REPLACE = GoogleSQLLexer.REPLACE_SYMBOL;
const T_UPDATE = GoogleSQLLexer.UPDATE_SYMBOL;
const T_LS_BRACKET = GoogleSQLLexer.LS_BRACKET_SYMBOL;
const T_REPLACE_AFTER_INSERT = GoogleSQLLexer.KW_REPLACE_AFTER_INSERT;
const T_UPDATE_AFTER_INSERT = GoogleSQLLexer.KW_UPDATE_AFTER_INSERT;
const T_SEQUENCE = GoogleSQLLexer.SEQUENCE_SYMBOL;
const T_CLAMPED = GoogleSQLLexer.CLAMPED_SYMBOL;

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
	"ABORT_SYMBOL",
	"ACCESS_SYMBOL",
	"ACTION_SYMBOL",
	"ADD_SYMBOL",
	"AFTER_SYMBOL",
	"AGGREGATE_SYMBOL",
	"ALTER_SYMBOL",
	"ALWAYS_SYMBOL",
	"ANALYZE_SYMBOL",
	"APPROX_SYMBOL",
	"ARE_SYMBOL",
	"ASSERT_SYMBOL",
	"AT_KEYWORD_SYMBOL",
	"BATCH_SYMBOL",
	"BEGIN_SYMBOL",
	"BIGDECIMAL_SYMBOL",
	"BIGNUMERIC_SYMBOL",
	"BREAK_SYMBOL",
	"CALL_SYMBOL",
	"CASCADE_SYMBOL",
	"CHECK_SYMBOL",
	"CLAMPED_SYMBOL",
	"CLONE_SYMBOL",
	"CLUSTER_SYMBOL",
	"COLUMN_SYMBOL",
	"COLUMNS_SYMBOL",
	"COMMIT_SYMBOL",
	"CONFLICT_SYMBOL",
	"CONNECTION_SYMBOL",
	"CONSTANT_SYMBOL",
	"CONSTRAINT_SYMBOL",
	"CONTINUE_SYMBOL",
	"COPY_SYMBOL",
	"CORRESPONDING_SYMBOL",
	"CYCLE_SYMBOL",
	"DATA_SYMBOL",
	"DATABASE_SYMBOL",
	"DATE_SYMBOL",
	"DATETIME_SYMBOL",
	"DECIMAL_SYMBOL",
	"DECLARE_SYMBOL",
	"DEFINER_SYMBOL",
	"DELETE_SYMBOL",
	"DELETION_SYMBOL",
	"DELTA_SYMBOL",
	"DEPTH_SYMBOL",
	"DESCRIBE_SYMBOL",
	"DESCRIPTOR_SYMBOL",
	"DESTINATION_SYMBOL",
	"DETERMINISTIC_SYMBOL",
	"DIFFERENTIAL_PRIVACY_SYMBOL",
	"DO_SYMBOL",
	"DROP_SYMBOL",
	"DYNAMIC_SYMBOL",
	"ELSEIF_SYMBOL",
	"ENFORCED_SYMBOL",
	"EPSILON_SYMBOL",
	"ERROR_SYMBOL",
	"EXCEPTION_SYMBOL",
	"EXECUTE_SYMBOL",
	"EXPLAIN_SYMBOL",
	"EXPORT_SYMBOL",
	"EXTEND_SYMBOL",
	"EXTERNAL_SYMBOL",
	"FILES_SYMBOL",
	"FILL_SYMBOL",
	"FILTER_SYMBOL",
	"FIRST_SYMBOL",
	"FOREIGN_SYMBOL",
	"FORK_SYMBOL",
	"FORMAT_SYMBOL",
	"FUNCTION_SYMBOL",
	"GENERATED_SYMBOL",
	"GRANT_SYMBOL",
	"GRAPH_SYMBOL",
	"GROUP_ROWS_SYMBOL",
	"HIDDEN_SYMBOL",
	"IDENTITY_SYMBOL",
	"IMMEDIATE_SYMBOL",
	"IMMUTABLE_SYMBOL",
	"IMPORT_SYMBOL",
	"INCLUDE_SYMBOL",
	"INCREMENT_SYMBOL",
	"INDEX_SYMBOL",
	"INOUT_SYMBOL",
	"INPUT_SYMBOL",
	"INSERT_SYMBOL",
	"INTERLEAVE_SYMBOL",
	"INVOKER_SYMBOL",
	"ISOLATION_SYMBOL",
	"ITERATE_SYMBOL",
	"JSON_SYMBOL",
	"KEY_SYMBOL",
	"KW_MATCH_RECOGNIZE_NONRESERVED_SYMBOL",
	"LANGUAGE_SYMBOL",
	"LAST_SYMBOL",
	"LEAVE_SYMBOL",
	"LEVEL_SYMBOL",
	"LOAD_SYMBOL",
	"LOG_SYMBOL",
	"LOOP_SYMBOL",
	"MACRO_SYMBOL",
	"MAP_SYMBOL",
	"MATCH_SYMBOL",
	"MATCHED_SYMBOL",
	"MATERIALIZED_SYMBOL",
	"MAX_GROUPS_CONTRIBUTED_SYMBOL",
	"MAX_SYMBOL",
	"MAXVALUE_SYMBOL",
	"MEASURES_SYMBOL",
	"MESSAGE_SYMBOL",
	"METADATA_SYMBOL",
	"MIN_SYMBOL",
	"MINVALUE_SYMBOL",
	"MODEL_SYMBOL",
	"MODULE_SYMBOL",
	"NAME_SYMBOL",
	"NULL_FILTERED_SYMBOL",
	"NUMERIC_SYMBOL",
	"OFFSET_SYMBOL",
	"ONLY_SYMBOL",
	"OPTIONS_SYMBOL",
	"OUT_SYMBOL",
	"OUTPUT_SYMBOL",
	"OVERWRITE_SYMBOL",
	"PARENT_SYMBOL",
	"PARTITIONS_SYMBOL",
	"PAST_SYMBOL",
	"PATTERN_SYMBOL",
	"PERCENT_SYMBOL",
	"PIVOT_SYMBOL",
	"POLICIES_SYMBOL",
	"POLICY_SYMBOL",
	"PRIMARY_SYMBOL",
	"PRIVACY_UNIT_COLUMN_SYMBOL",
	"PRIVATE_SYMBOL",
	"PRIVILEGE_SYMBOL",
	"PRIVILEGES_SYMBOL",
	"PROCEDURE_SYMBOL",
	"PROJECT_SYMBOL",
	"PROPERTY_SYMBOL",
	"PUBLIC_SYMBOL",
	"RAISE_SYMBOL",
	"READ_SYMBOL",
	"REFERENCES_SYMBOL",
	"REMOTE_SYMBOL",
	"REMOVE_SYMBOL",
	"RENAME_SYMBOL",
	"REPEAT_SYMBOL",
	"REPEATABLE_SYMBOL",
	"REPLACE_FIELDS_SYMBOL",
	"REPLACE_SYMBOL",
	"REPLICA_SYMBOL",
	"REPORT_SYMBOL",
	"RESTRICT_SYMBOL",
	"RESTRICTION_SYMBOL",
	"RETURN_SYMBOL",
	"RETURNS_SYMBOL",
	"REVOKE_SYMBOL",
	"ROLLBACK_SYMBOL",
	"ROW_SYMBOL",
	"RUN_SYMBOL",
	"SAFE_CAST_SYMBOL",
	"SCHEMA_SYMBOL",
	"SEARCH_SYMBOL",
	"SECURITY_SYMBOL",
	"SEQUENCE_SYMBOL",
	"SETS_SYMBOL",
	"SHOW_SYMBOL",
	"SNAPSHOT_SYMBOL",
	"SOURCE_SYMBOL",
	"SQL_SYMBOL",
	"STABLE_SYMBOL",
	"START_SYMBOL",
	"STATIC_DESCRIBE_SYMBOL",
	"STORED_SYMBOL",
	"STORING_SYMBOL",
	"STRICT_SYMBOL",
	"SYSTEM_SYMBOL",
	"SYSTEM_TIME_SYMBOL",
	"TABLE_SYMBOL",
	"TABLES_SYMBOL",
	"TARGET_SYMBOL",
	"TEE_SYMBOL",
	"TEMP_SYMBOL",
	"TEMPORARY_SYMBOL",
	"TIME_SYMBOL",
	"TIMESTAMP_SYMBOL",
	"TRANSACTION_SYMBOL",
	"TRANSFORM_SYMBOL",
	"TRUNCATE_SYMBOL",
	"TYPE_SYMBOL",
	"UNDROP_SYMBOL",
	"UNIQUE_SYMBOL",
	"UNKNOWN_SYMBOL",
	"UNPIVOT_SYMBOL",
	"UNTIL_SYMBOL",
	"UPDATE_SYMBOL",
	"VALUE_SYMBOL",
	"VALUES_SYMBOL",
	"VECTOR_SYMBOL",
	"VIEW_SYMBOL",
	"VIEWS_SYMBOL",
	"VOLATILE_SYMBOL",
	"WEIGHT_SYMBOL",
	"WHILE_SYMBOL",
	"WRITE_SYMBOL",
	"ZONE_SYMBOL",
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
	// Keep the column in sync with the byte offset so error messages on a decomposed path component
	// (`x.1.2.3`) point at the right spot; a path token never spans a newline, so the line is unchanged.
	t.setCharPositionInLine(src.column + (start - src.start));
	return t;
}

const NUMERIC = new Set([T_FLOAT, T_INTEGER, T_INVALID]);

/** Apply the DOT_IDENTIFIER rewrite to a flat token list (default channel; EOF excluded). */
function rewriteDotPaths(tokens: Token[]): Token[] {
	const out: Token[] = [];
	let lookback = -1; // type of the last emitted default-channel token
	let lookback2 = -1; // type of the token before lookback
	let pathDot = false; // the last emitted token was a path-separator `.`

	// A `.` opens a path component when the previous token can head a path — an identifier-capable
	// token / `)` / `]` / `?`, OR a parameter name right after `@`/`@@` (`@full.1`, `@@sysvar.1`),
	// where the name may be a reserved keyword and so isn't itself in PATH_HEAD.
	const pathHead = () => PATH_HEAD.has(lookback) || lookback2 === T_AT || lookback2 === T_ATAT;
	// Type of the next default-channel token after index i (-1 if none).
	const nextDefaultType = (i: number): number => {
		for (let k = i + 1; k < tokens.length; k++) if (tokens[k].channel === 0) return tokens[k].type;
		return -1;
	};

	for (let idx = 0; idx < tokens.length; idx++) {
		const tok = tokens[idx];
		// Hidden-channel tokens (whitespace, comments) pass through and don't affect the lookback;
		// GoogleSQL allows whitespace around the `.` in a path (`x. 123`, `x.1 .2`).
		if (tok.channel !== 0) {
			out.push(tok);
			continue;
		}
		let type = tok.type;
		const text = tok.text ?? "";

		// ZetaSQL lookahead transformer (AMBIGUOUS CASE 11): SEQUENCE immediately followed by CLAMPED is
		// forced to an IDENTIFIER, so `f(sequence clamped …)` reads `sequence` as a column with a CLAMPED
		// BETWEEN modifier (and `f(sequence clamped)` without BETWEEN is an error) rather than a SEQUENCE
		// input argument. A real SEQUENCE arg named `clamped` must be backtick-quoted.
		if (type === T_SEQUENCE && nextDefaultType(idx) === T_CLAMPED) {
			out.push(cloneRetyped(tok, T_IDENTIFIER, text, tok.start, tok.stop));
			lookback2 = lookback;
			lookback = T_IDENTIFIER;
			pathDot = false;
			continue;
		}

		// ZetaSQL lookahead transformer: REPLACE/UPDATE immediately after INSERT is the insert mode
		// (KW_REPLACE_AFTER_INSERT / KW_UPDATE_AFTER_INSERT) — UNLESS it begins a path (`.`/`[` next),
		// where it stays a target path component. Retyping forces the grammar to treat it as the mode:
		// `INSERT REPLACE VALUES …` fails as incomplete while `INSERT replace.col …` parses.
		if ((type === T_REPLACE || type === T_UPDATE) && lookback === T_INSERT) {
			const nxt = nextDefaultType(idx);
			if (nxt !== T_DOT && nxt !== T_LS_BRACKET) {
				type = type === T_REPLACE ? T_REPLACE_AFTER_INSERT : T_UPDATE_AFTER_INSERT;
				out.push(cloneRetyped(tok, type, text, tok.start, tok.stop));
				lookback2 = lookback;
				lookback = type;
				pathDot = false;
				continue;
			}
		}

		// In path context a numeric literal is a sequence of identifier components: our lexer fuses
		// the digit runs and dots (`.123`, `2.0`, `1.`, `2daysago`, `0x1f`, `1.2e3`) into one
		// FLOATING_POINT/INTEGER/INVALID token, but each embedded `.` is a path separator and each
		// run is a component. Decompose into `IDENTIFIER (DOT IDENTIFIER)*`. Path context = right
		// after a path-separator `.` (pathDot), or a leading-dot literal right after a path head
		// (the literal's own leading `.` is the separator). Exact identifier charset fidelity isn't
		// needed — the parser accepts any IDENTIFIER token as a path component.
		const inPath = pathDot || (pathHead() && text.startsWith("."));
		if (NUMERIC.has(type) && inPath) {
			const parts = text.split(".");
			let pos = tok.start;
			for (let i = 0; i < parts.length; i++) {
				if (i > 0) {
					out.push(cloneRetyped(tok, T_DOT, ".", pos, pos));
					pos += 1;
					lookback2 = lookback;
					lookback = T_DOT;
					pathDot = true;
				}
				if (parts[i] !== "") {
					out.push(cloneRetyped(tok, T_IDENTIFIER, parts[i], pos, pos + parts[i].length - 1));
					pos += parts[i].length;
					lookback2 = lookback;
					lookback = T_IDENTIFIER;
					pathDot = false;
				}
			}
			continue;
		}

		if (type === T_DOT) {
			out.push(tok);
			pathDot = pathHead();
			lookback2 = lookback;
			lookback = T_DOT;
			continue;
		}

		out.push(tok);
		lookback2 = lookback;
		lookback = type;
		pathDot = false;
	}
	return out;
}

/**
 * Lex `sql` and return a token source with the DOT_IDENTIFIER rewrite applied, plus positioned
 * diagnostics for string/bytes/identifier literals with invalid escapes (ZetaSQL validates these in
 * the parser as syntax errors). The lexer's error listeners (attached by the caller) fire during the
 * full lex here.
 */
export function dotPathTokenSource(
	sql: string,
	lexer: Lexer,
): {
	source: ListTokenSource;
	escapeDiagnostics: SyntaxDiagnostic[];
} {
	const tokens = lexer.getAllTokens(); // full lex (drives lexer error listeners); EOF excluded
	return { source: new ListTokenSource(rewriteDotPaths(tokens)), escapeDiagnostics: badLiteralEscapes(tokens) };
}
