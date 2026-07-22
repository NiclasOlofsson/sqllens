// ---------------------------------------------------------------------------
// consumedAs derivation: the post-parse "how was this keyword actually used"
// classifier (Token.consumedAs; see token.ts's field doc for the full contract).
//
// Method: every dialect's grammar admits SOME keywords as bare identifiers through a
// non-reserved-word wrapper rule (the same fact the reserved/soft split in
// tools/gen-reserved.ts probes black-box; this derives the same truth structurally, from
// the CST the parser actually built), and several also admit them through a data-type
// production. `deriveConsumedAs` walks the parse tree ONCE, top-down, carrying a verdict
// down from whichever ancestor rule first establishes one:
//
//   - entering a rule that is NOT in either rule set resets the carried verdict to
//     undefined (this subtree is not name/type territory, whatever the parent was);
//   - entering a rule that IS in one of the sets keeps the carried verdict if the parent
//     already had one (the OUTERMOST matching rule wins), or starts a fresh one (own
//     class) otherwise;
//   - a terminal (an ordinary consumed token, not an error-recovery node) is stamped with
//     whatever verdict is carried into it, defaulting to `"keyword"` when nothing matched.
//
// The "outermost wins, but only across an unbroken run of matching rules" rule matters
// because some dialects fold a type production INTO their identifier wrapper (Snowflake's
// `id_` lists `data_type` as one of the ways to spell an object name, so a column
// literally named `varchar` reads VARCHAR through `data_type` nested inside `id_`; the
// outer `id_` match must win, giving "identifier"), while others fold the identifier
// wrapper INTO their type production (T-SQL's `data_type` bottoms out at `unscaled_type =
// id_`, so `CAST(x AS INT)` reads INT through `id_`/`keyword` nested inside `data_type`;
// there the outer `data_type` match must win, giving "type"). Both directions are handled
// by the same single rule (the parent's carried verdict beats the child's own), so no
// dialect-specific priority logic is needed in the algorithm itself, only in which rules
// are enumerated per dialect below.
//
// Every rule strictly between the establishing wrapper and the actual keyword terminal
// must itself be listed in one of the two sets (either one: once a carried verdict
// exists, a listed-but-differently-classed rule does not overwrite it, it just keeps
// propagation alive); an unlisted rule on that path is a genuine reset and breaks the
// chain, which is exactly the behavior wanted for a rule that legitimately introduces an
// unrelated name (MySQL's `dataType ... COLLATE collationName`: `collationName` is left
// unlisted on purpose, so a collation name nested inside a type production still reads as
// "identifier", not "type").
//
// Linear: one DFS over the CST (an explicit stack, not per-terminal ancestor re-walks), a
// Set lookup per rule context, a Map.set per ordinary terminal. O(nodes in the tree).
// ---------------------------------------------------------------------------

import { ErrorNode, ParserRuleContext, TerminalNode } from "antlr4ng";
import type { Dialect } from "../dialect.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";
import { SnowflakeParser } from "../generated/snowflake/SnowflakeParser.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";
import { RedshiftParser } from "../generated/redshift/RedshiftParser.js";
import { PostgresParser } from "../generated/postgres/PostgresParser.js";
import { DuckdbParser } from "../generated/duckdb/DuckdbParser.js";
import { TrinoParser } from "../generated/trino/TrinoParser.js";
import { SqliteParser } from "../generated/sqlite/SqliteParser.js";
import { MysqlParser } from "../generated/mysql/MysqlParser.js";

/** The three verdicts `deriveConsumedAs` ever stamps (matches `Token.consumedAs`'s type). */
export type ConsumedAs = "keyword" | "identifier" | "type";

export interface ConsumedAsRules {
	/** Rule indices that realize "this token is a name": non-reserved-word wrappers and every
	 *  rule strictly between one and the keyword terminal for a real grammar path. */
	identifierRules: ReadonlySet<number>;
	/** Rule indices that realize "this token is a type name": data-type productions and every
	 *  rule strictly between one and the keyword terminal. Undefined when the dialect's type
	 *  grammar does not cleanly separate from generic identifier/keyword use (documented per
	 *  dialect below); those dialects only ever produce "identifier" | "keyword". */
	typeRules?: ReadonlySet<number>;
}

/**
 * Walk `tree` once and return every ordinary (non-error-recovery) consumed terminal's antlr
 * `tokenIndex` mapped to its verdict. A tokenIndex absent from the map was never consumed as
 * a genuine part of the parse (error-recovery skip, or the caller passed a hidden-channel
 * token that could never reach the tree); callers read that absence as "no verdict", not
 * "keyword" (see token.ts's `consumedAs` doc). Every entry is one of the three verdicts;
 * whether the caller SHOWS "keyword" (vs. leaving the field off) is the caller's call, gated
 * on the token's role. This function has no notion of token role at all.
 */
export function deriveConsumedAs(tree: ParserRuleContext, rules: ConsumedAsRules): Map<number, ConsumedAs> {
	const out = new Map<number, ConsumedAs>();
	const classOf = (ruleIndex: number): ConsumedAs | undefined => {
		if (rules.typeRules?.has(ruleIndex)) return "type";
		if (rules.identifierRules.has(ruleIndex)) return "identifier";
		return undefined;
	};

	const stack: Array<{ ctx: ParserRuleContext; carried: ConsumedAs | undefined }> = [
		{ ctx: tree, carried: classOf(tree.ruleIndex) },
	];
	while (stack.length > 0) {
		const top = stack.pop();
		if (!top) break;
		const { ctx, carried } = top;
		const n = ctx.getChildCount();
		for (let i = 0; i < n; i++) {
			const child = ctx.getChild(i);
			if (child === null || child instanceof ErrorNode) continue; // resync-inserted node: no real ancestry
			if (child instanceof TerminalNode) {
				const idx = child.symbol.tokenIndex;
				if (idx >= 0) out.set(idx, carried ?? "keyword");
			} else if (child instanceof ParserRuleContext) {
				const own = classOf(child.ruleIndex);
				stack.push({ ctx: child, carried: own !== undefined ? (carried ?? own) : undefined });
			}
		}
	}
	return out;
}

// Per-dialect rule config. Grammar citations are in each dialect's .g4 (see the
// identifier/data_type rule names below); this table only records WHICH rule indices realize
// each verdict, not why. That reasoning is in the CLAUDE.md task history and the .g4 files
// themselves.

const DATABRICKS_IDENTIFIER = new Set<number>([
	DatabricksParser.RULE_identifier,
	DatabricksParser.RULE_simpleIdentifier,
	DatabricksParser.RULE_strictIdentifier,
	DatabricksParser.RULE_simpleStrictIdentifier,
	DatabricksParser.RULE_nonReserved,
	DatabricksParser.RULE_ansiNonReserved,
	DatabricksParser.RULE_strictNonReserved,
]);
const DATABRICKS_TYPE = new Set<number>([
	DatabricksParser.RULE_dataType,
	DatabricksParser.RULE_primitiveType,
	DatabricksParser.RULE_nonTrivialPrimitiveType,
	DatabricksParser.RULE_trivialPrimitiveType,
]);

const TSQL_IDENTIFIER = new Set<number>([TSqlParser.RULE_id_, TSqlParser.RULE_simple_id, TSqlParser.RULE_keyword]);
const TSQL_TYPE = new Set<number>([TSqlParser.RULE_data_type]);

// Snowflake: `id_` is the one identifier-realization rule (SnowflakeParser.g4's own comment: "id_ is
// used for object name. Snowflake is very permissive so we could use nearly all keyword as object
// name"). Its own alternatives (keyword / non_reserved_words / object_type_plural / the
// builtin-function-name families / pivot_unpivot_word) must all be listed too so the carried
// "identifier" verdict survives down through them to the actual keyword terminal.
const SNOWFLAKE_IDENTIFIER = new Set<number>([
	SnowflakeParser.RULE_id_,
	SnowflakeParser.RULE_keyword,
	SnowflakeParser.RULE_non_reserved_words,
	SnowflakeParser.RULE_object_type_plural,
	SnowflakeParser.RULE_pivot_unpivot_word,
	SnowflakeParser.RULE_builtin_function,
	SnowflakeParser.RULE_unary_or_binary_builtin_function,
	SnowflakeParser.RULE_binary_builtin_function,
	SnowflakeParser.RULE_binary_or_ternary_builtin_function,
	SnowflakeParser.RULE_ternary_builtin_function,
]);
// `data_type` also being one of id_'s own alternatives is exactly the identifier-wraps-type
// crossover the module header describes (a column literally named VARCHAR reads VARCHAR through
// data_type nested inside id_): the outer id_ match wins there by construction, and `data_type`
// reached directly (a real CAST target) still gets "type" on its own.
const SNOWFLAKE_TYPE = new Set<number>([SnowflakeParser.RULE_data_type]);

// Postgres / Redshift / DuckDB (TVL-lineage forks, same colid/collabel/type_function_name/... etc.
// identifier-realization family and typename/simpletypename/... etc. type family in every one; see
// PostgresParser.g4's `colid`/`collabel`/`typename` neighborhood). `reserved_keyword` is included
// even though 2 of its non-collabel call sites (`def_arg`, `option_value`, PL/pgSQL config values)
// use the keyword as a bare value rather than strictly a name; still "not the keyword's own
// meaning", so "identifier" is the honest, non-wrong call there too.
const PG_FAMILY_IDENTIFIER_BASE = [
	"identifier",
	"colid",
	"table_alias",
	"type_function_name",
	"nonreservedword",
	"collabel",
	"unreserved_keyword",
	"col_name_keyword",
	"type_func_name_keyword",
	"plsql_unreserved_keyword",
	"reserved_keyword",
] as const;
const PG_FAMILY_TYPE_BASE = [
	"typename",
	"simpletypename",
	"consttypename",
	"generictype",
	"numeric",
	"bit",
	"constbit",
	"bitwithlength",
	"bitwithoutlength",
	"character",
	"constcharacter",
	"character_c",
	"constdatetime",
	"constinterval",
] as const;

type RuleIndexed = Record<string, number>;
const ruleSet = (parser: RuleIndexed, names: readonly string[]): Set<number> =>
	new Set(names.map((name) => parser[`RULE_${name}`]));

const POSTGRES_IDENTIFIER = ruleSet(PostgresParser as unknown as RuleIndexed, [
	...PG_FAMILY_IDENTIFIER_BASE,
	"bare_col_label",
	"bare_label_keyword",
]);
const POSTGRES_TYPE = ruleSet(PostgresParser as unknown as RuleIndexed, [...PG_FAMILY_TYPE_BASE, "jsontype"]);

const REDSHIFT_IDENTIFIER = ruleSet(RedshiftParser as unknown as RuleIndexed, [...PG_FAMILY_IDENTIFIER_BASE]);
const REDSHIFT_TYPE = ruleSet(RedshiftParser as unknown as RuleIndexed, [...PG_FAMILY_TYPE_BASE]);

const DUCKDB_IDENTIFIER = ruleSet(DuckdbParser as unknown as RuleIndexed, [
	...PG_FAMILY_IDENTIFIER_BASE,
	"bare_colid",
	"bare_table_alias",
	"bare_col_label",
	"bare_label_keyword",
	"non_join_unreserved_keyword",
]);
const DUCKDB_TYPE = ruleSet(DuckdbParser as unknown as RuleIndexed, [...PG_FAMILY_TYPE_BASE, "jsontype"]);

// Trino (first-party SqlBase.g4 split): `identifier`/`nonReserved` are the whole family. `type` is a
// single flat rule covering both the direct keyword alternatives (ROW/INTERVAL/TIMESTAMP/TIME/
// DOUBLE/ARRAY/MAP) and the generic `identifier`-wrapped alternative (#genericType), so the same
// "outer wins" crossover applies here too, in the type-wraps-identifier direction.
const TRINO_IDENTIFIER = new Set<number>([TrinoParser.RULE_identifier, TrinoParser.RULE_nonReserved]);
const TRINO_TYPE = new Set<number>([TrinoParser.RULE_type]);

// BigQuery / GoogleSQL (Bytebase fork): scalar type names (INT64, STRING, BOOL, etc.) are not
// distinct keyword tokens at all in this grammar. `type_name: path_expression | INTERVAL_SYMBOL`
// reads them as plain identifiers, so they never reach this classifier (their role is already
// "identifier"). The templated compound-type keywords (ARRAY/STRUCT/MAP/RANGE/FUNCTION) ARE
// distinct keyword tokens and ARE cleanly enumerable (`raw_type`'s direct alternatives), so "type"
// is modeled for those. `type_name`'s OTHER alternative, `path_expression` (a schema-qualified
// custom type name), is deliberately left off `identifierRules`/`typeRules`: it's the same rule
// used pervasively for ordinary column/table path references, so marking it either way would be
// wrong somewhere. A keyword reached that way (e.g. `CAST(x AS someKeyword)`) falls back to
// "identifier" rather than a forced, possibly-wrong "type": the honest call per the never-guess
// contract.
const BIGQUERY_IDENTIFIER = new Set<number>([
	GoogleSQLParser.RULE_identifier,
	GoogleSQLParser.RULE_keyword_as_identifier,
	GoogleSQLParser.RULE_common_keyword_as_identifier,
]);
const BIGQUERY_TYPE = new Set<number>([
	GoogleSQLParser.RULE_type,
	GoogleSQLParser.RULE_raw_type,
	GoogleSQLParser.RULE_array_type,
	GoogleSQLParser.RULE_struct_type,
	GoogleSQLParser.RULE_map_type,
	GoogleSQLParser.RULE_range_type,
	GoogleSQLParser.RULE_function_type,
	GoogleSQLParser.RULE_type_name,
]);

// SQLite (grammars-v4 fork): `type_name` is a bare repetition of `name` (SqliteParser.g4:
// `type_name: name+? (...)?`), its own universal identifier wrapper (`name -> any_name ->
// fallback`). There is no distinct type-keyword rule at all (matches SQLite's column-affinity
// model, where a declared type is informational free text, not a fixed vocabulary), so there is
// nothing to widen: a keyword landing in a CAST or column-type slot is "identifier", the same as
// anywhere else. No `typeRules`.
const SQLITE_IDENTIFIER = new Set<number>([
	SqliteParser.RULE_name,
	SqliteParser.RULE_any_name,
	SqliteParser.RULE_any_name_excluding_raise,
	SqliteParser.RULE_any_name_excluding_joins,
	SqliteParser.RULE_any_name_excluding_string,
	SqliteParser.RULE_fallback,
	SqliteParser.RULE_fallback_excluding_conflicts,
	SqliteParser.RULE_join_keyword,
]);

// MySQL (grammars-v4 Positive-Technologies fork): `uid`/`simpleId` are the identifier-realization
// family (simpleId's own alternatives, charsetNameBase/transactionLevelBase/engineNameBase/
// privilegesBase/intervalTypeBase/dataTypeBase/keywordsCanBeId/scalarFunctionName, all listed so
// propagation survives down to the terminal). `dataType`/`convertedDataType` are separate, disjoint
// productions (not nested inside uid/simpleId) with genuine literal type keywords, including the
// INT4/INT8/FLOAT4/FLOAT8 family: the module header's `int4` example is literal here. Their
// sub-productions charSet/charsetName/collationName are deliberately left off both sets: they are
// genuinely a different name (a charset/collation identifier), not the type name itself, so a
// keyword landing there via `uid` correctly resets to "identifier" rather than inheriting "type".
const MYSQL_IDENTIFIER = new Set<number>([
	MysqlParser.RULE_uid,
	MysqlParser.RULE_simpleId,
	MysqlParser.RULE_fullId,
	MysqlParser.RULE_dottedId,
	MysqlParser.RULE_keywordsCanBeId,
	MysqlParser.RULE_charsetNameBase,
	MysqlParser.RULE_transactionLevelBase,
	MysqlParser.RULE_engineNameBase,
	MysqlParser.RULE_privilegesBase,
	MysqlParser.RULE_intervalTypeBase,
	MysqlParser.RULE_dataTypeBase,
	MysqlParser.RULE_scalarFunctionName,
]);
const MYSQL_TYPE = new Set<number>([MysqlParser.RULE_dataType, MysqlParser.RULE_convertedDataType]);

/** Per-dialect rule config for `deriveConsumedAs`. `typeRules` is absent for sqlite (see its note
 *  above); every other dialect's type grammar was clean enough to enumerate. */
export const CONSUMED_AS_RULES: Record<Dialect, ConsumedAsRules> = {
	databricks: { identifierRules: DATABRICKS_IDENTIFIER, typeRules: DATABRICKS_TYPE },
	tsql: { identifierRules: TSQL_IDENTIFIER, typeRules: TSQL_TYPE },
	snowflake: { identifierRules: SNOWFLAKE_IDENTIFIER, typeRules: SNOWFLAKE_TYPE },
	bigquery: { identifierRules: BIGQUERY_IDENTIFIER, typeRules: BIGQUERY_TYPE },
	redshift: { identifierRules: REDSHIFT_IDENTIFIER, typeRules: REDSHIFT_TYPE },
	postgres: { identifierRules: POSTGRES_IDENTIFIER, typeRules: POSTGRES_TYPE },
	duckdb: { identifierRules: DUCKDB_IDENTIFIER, typeRules: DUCKDB_TYPE },
	trino: { identifierRules: TRINO_IDENTIFIER, typeRules: TRINO_TYPE },
	sqlite: { identifierRules: SQLITE_IDENTIFIER },
	mysql: { identifierRules: MYSQL_IDENTIFIER, typeRules: MYSQL_TYPE },
};
