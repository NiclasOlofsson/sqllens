// Public API — a uniform, layered, composable, immutable analysis surface over the shared
// dialect-neutral IR (src/ir/ir.ts). The pipeline is parse → lower → resolveScopes → qualify →
// infer / lineage / symbols; only parse + lower are per-dialect (each dialect has its own
// grammar/CST), everything after runs unchanged on all four.
//
// Three layers of entry:
//   - Uniform:   parse(sql, dialect) / analyze(sql, dialect, opts), with `Dialect` a parameter.
//   - Composable: qualify / lineage / deriveSymbols accept the closest upstream result OR a
//                 string / IR via the idempotent lift helpers (toAst / toScopes).
//   - Building blocks: the per-dialect parse*/lower and the raw shared passes, for callers who
//                 want a specific tier or the raw CST escape hatch.

// --- Uniform entry, lift helpers, typed wrappers, composable passes (src/api.ts) ---
export {
	parse,
	analyze,
	toAst,
	toScopes,
	qualify,
	lineage,
	deriveSymbols,
	TypeInfo,
	type Nullability,
	Lineage,
	originsOfExpr,
	tokenize,
	SqlDocument,
	LineIndex,
	complete,
	type Completion,
	signatureAt,
	FUNCTION_SIGNATURES,
	HARVESTED_SIGNATURES,
	lookupSignature,
	hasSignature,
	referencesAt,
	type Occurrence,
	type Occurrences,
	dialectSymbols,
	type DialectSymbols,
	CallbackSchema,
	type SchemaSource,
	type TableResolver,
	ADAPTER_DIALECTS,
	adapterDialect,
	type SignatureInfo,
	type FnSignature,
	type ParamSig,
	type Dialect,
	type DialectOpts,
	type ParseResultIR,
	type Analysis,
	type Token,
	type TokenRole,
	type DocumentAnalysis,
	type StatementCell,
	type StatementCellSpan,
} from "./api.js";

// --- Per-dialect building blocks: parse* (CST + errors) and lower (CST → IR) ---
export { parseDatabricks } from "./databricks/parse.js";
export { lower } from "./databricks/lower.js";
export { parseTSql } from "./tsql/parse.js";
export { parseSnowflake } from "./snowflake/parse.js";
export { parseBigQuery } from "./bigquery/parse.js";
export { parseRedshift } from "./redshift/parse.js";
export { parsePostgres } from "./postgres/parse.js";
export { parseDuckdb } from "./duckdb/parse.js";
export { parseTrino } from "./trino/parse.js";
export { lower as lowerTSql } from "./tsql/lower.js";
export { lower as lowerSnowflake } from "./snowflake/lower.js";
export { lower as lowerBigQuery } from "./bigquery/lower.js";
export { lower as lowerRedshift } from "./redshift/lower.js";
export { lower as lowerPostgres } from "./postgres/lower.js";
export { lower as lowerDuckdb } from "./duckdb/lower.js";
export { lower as lowerTrino } from "./trino/lower.js";
export type { ParseResult } from "./databricks/parse.js";

// --- The IR ---
export type {
	ColumnRef,
	CteDef,
	Expr,
	Join,
	JoinKind,
	PartSpan,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	SetOpExpr,
	Source,
	SubquerySource,
	TableSource,
} from "./ir/ir.js";

export { coarseKind, type StatementCategory, type StatementKind } from "./ir/statement.js";

// The positioned syntax diagnostic carried on parse()/SqlDocument — surfaced here so the LSP
// presentation layer can map it without reaching into the internal parse-diagnostics module.
export type { SyntaxDiagnostic } from "./parse-diagnostics.js";

// --- Shared passes as building blocks (raw forms) + their typed result interfaces ---
export { resolveScopes, type CteRef, type ResolvedSource, type Scope, type ScopeTree } from "./scope/scope.js";

export { type Diagnostic, type Qualification } from "./qualify/qualify.js";

export { Schema, type Column, type SchemaMapping, type SchemaLeaf } from "./qualify/schema.js";

export { MAIN_FRAME, type Span, type Sym, type SymbolKind, type SymbolModifier } from "./symbols/symbols.js";

export { inferType } from "./infer/infer.js";
export { parseType, formatType, type Type } from "./infer/types.js";

// Raw lineage building blocks (the wrapper `Lineage` + composable `lineage` come from ./api.js).
export { type ColumnLineage, type Origin } from "./lineage/lineage.js";
