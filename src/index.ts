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
	lineageAt,
	lineageOf,
	type LineageHop,
	type ViaStep,
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
	foldIdentifier,
	displayName,
	type IdentKind,
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

// --- Per-dialect building blocks: parse* (CST + errors) and lower* (CST → IR), kept as one
//     contiguous family. Every export is dialect-suffixed on both sides — parseDatabricks/
//     lowerDatabricks … parseTrino/lowerTrino. (Each dialect's module still exports the function
//     as the bare `lower`; the barrel aliases it per dialect.) ---
export { parseDatabricks } from "./databricks/parse.js";
export { parseTSql } from "./tsql/parse.js";
export { parseSnowflake } from "./snowflake/parse.js";
export { parseBigQuery } from "./bigquery/parse.js";
export { parseRedshift } from "./redshift/parse.js";
export { parsePostgres } from "./postgres/parse.js";
export { parseDuckdb } from "./duckdb/parse.js";
export { parseTrino } from "./trino/parse.js";
export { lower as lowerDatabricks } from "./databricks/lower.js";
export { lower as lowerTSql } from "./tsql/lower.js";
export { lower as lowerSnowflake } from "./snowflake/lower.js";
export { lower as lowerBigQuery } from "./bigquery/lower.js";
export { lower as lowerRedshift } from "./redshift/lower.js";
export { lower as lowerPostgres } from "./postgres/lower.js";
export { lower as lowerDuckdb } from "./duckdb/lower.js";
export { lower as lowerTrino } from "./trino/lower.js";
export type { ParseResult } from "./databricks/parse.js";

// --- Jinja front end (raw jinja-SQL) — the unified SQL+jinja token stream (inc1 R1)
//     + the inc2 surface: control-flow regions / template symbols (R4) and branch-variant
//     realization. Additive-only; reachable ONLY through this barrel (the eight SQL
//     grammars are untouched). See also `TemplateSourceInfo` (IR section) and
//     `TemplateCatalog` (qualify section) — the rest of the template surface. ---
export { parseTemplated, tokenizeTemplated, type TemplatedParseResult, type TagNode } from "./jinja/parse.js";
export {
	templateRegions,
	templateSymbols,
	type TemplateRegion,
	type TemplateArm,
	type TemplateSymbol,
} from "./jinja/regions.js";
export { templateVariants, type TemplateVariant } from "./jinja/variants.js";

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
	TemplateSourceInfo,
} from "./ir/ir.js";

export { coarseKind, type StatementCategory, type StatementKind } from "./ir/statement.js";

// The positioned syntax diagnostic carried on parse()/SqlDocument — surfaced here so the LSP
// presentation layer can map it without reaching into the internal parse-diagnostics module.
export type { SyntaxDiagnostic } from "./parse-diagnostics.js";

// --- Shared passes as building blocks (raw forms) + their typed result interfaces ---
export { resolveScopes, type CteRef, type ResolvedSource, type Scope, type ScopeTree } from "./scope/scope.js";

export { type Diagnostic, type Qualification, type ColumnBinding } from "./qualify/qualify.js";

export { Schema, type Column, type SchemaMapping, type SchemaLeaf } from "./qualify/schema.js";

// The template-layer catalog (inc3.1 `relation` slice): a TemplateCatalog extends SchemaSource with a
// `relation` lookup that resolves a dbt-logical `{{ ref('orders') }}` to its physical relation + columns,
// so qualify can fire real unknown-column diagnostics against a templated source. CallbackTemplateCatalog
// is the resolve-on-demand implementation (mirrors CallbackSchema; one shared version + one prime()). A
// plain SchemaSource has no `relation` and is the zero-catalog fallback.
export {
	CallbackTemplateCatalog,
	type TemplateCatalog,
	type TemplateRef,
	type ResolvedRelation,
	type RelationResolver,
} from "./qualify/template-catalog.js";

export { MAIN_FRAME, type Span, type Sym, type SymbolKind, type SymbolModifier } from "./symbols/symbols.js";

export { inferType } from "./infer/infer.js";
export { parseType, formatType, type Type } from "./infer/types.js";

// Raw lineage building blocks (the wrapper `Lineage` + composable `lineage` come from ./api.js).
export { type ColumnLineage, type Origin } from "./lineage/lineage.js";
