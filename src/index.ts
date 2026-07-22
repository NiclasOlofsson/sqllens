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
	completeAt,
	type Completion,
	type CompletionResult,
	type ReplaceRange,
	type CompleteOptions,
	type CandidateIdentity,
	type CandidateDecoration,
	type DecorateCandidate,
	jinjaSlotAt,
	type JinjaSlot,
	signatureAt,
	SIGNATURES,
	lookupSignature,
	hasSignature,
	renderSignature,
	FN_DOCS,
	lookupFnDoc,
	referencesAt,
	type Occurrence,
	type Occurrences,
	frameAt,
	type Frame,
	clausesOf,
	type ClauseInfo,
	type ClauseKind,
	setOpArmsOf,
	type SetOpArm,
	type SetOpArms,
	dialectSymbols,
	type DialectSymbols,
	dialectVocabulary,
	type DialectVocabulary,
	reservedKeywords,
	type KeywordEntry,
	type KeywordReservation,
	CallbackSchema,
	type SchemaProvider,
	type TableResolver,
	DERIVED_DIALECTS,
	resolveDialect,
	foldIdentifier,
	displayName,
	type IdentKind,
	type SignatureHelpInfo,
	type SignatureLabel,
	type FnSignature,
	type ParamSig,
	type RenderSignatureOptions,
	type FnDoc,
	type Dialect,
	type DialectOpts,
	type ParseResultIR,
	type Analysis,
	type Token,
	type TokenRole,
	type DocumentAnalysis,
	type StatementCell,
	type StatementCellSpan,
	type DocumentVariant,
	type UnionCte,
} from "./api.js";

// SqlSession — the verb-shaped facade over one SqlDocument (offset in, answer out; pure delegation).
export { SqlSession, type SessionOptions } from "./session.js";

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
export { parseSqlite } from "./sqlite/parse.js";
export { parseMysql } from "./mysql/parse.js";
export { lower as lowerDatabricks } from "./databricks/lower.js";
export { lower as lowerTSql } from "./tsql/lower.js";
export { lower as lowerSnowflake } from "./snowflake/lower.js";
export { lower as lowerBigQuery } from "./bigquery/lower.js";
export { lower as lowerRedshift } from "./redshift/lower.js";
export { lower as lowerPostgres } from "./postgres/lower.js";
export { lower as lowerDuckdb } from "./duckdb/lower.js";
export { lower as lowerTrino } from "./trino/lower.js";
export { lower as lowerSqlite } from "./sqlite/lower.js";
export { lower as lowerMysql } from "./mysql/lower.js";
export type { ParseResult } from "./parse-result.js";

// --- Minijinja front end (raw jinja-SQL) — the engine itself (parseTemplated/tokenizeTemplated,
//     tag/region/symbol/variant types) lives at the `sqllens/minijinja` subpath
//     (src/minijinja/index.ts), not here. The main barrel keeps only the engine-neutral contract:
//     the TemplateEngine interface (below) and the result/options shape it produces. See also
//     `TemplateSourceInfo`/`TemplateExprInfo` (IR section) and `DefaultTemplateProvider` (qualify
//     section) — the rest of the template surface. ---
export { type TemplatedParseResult, type TemplatedParseOptions } from "./template/engine.js";

// --- The IR ---
export type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	GraphElement,
	GraphTableSource,
	Join,
	JoinKind,
	LateralViewSource,
	LimitInfo,
	PartSpan,
	PipeBranch,
	PipeExpr,
	PipeSetItem,
	PipeStage,
	PivotInfo,
	Projection,
	QualifiedName,
	QueryBody,
	QueryExpr,
	SelectExpr,
	SetOpExpr,
	Source,
	SubquerySource,
	TableSource,
	TemplateExprInfo,
	TemplateSourceInfo,
	UnpivotInfo,
	UnsupportedFlag,
	VariableDecl,
	WindowSpec,
} from "./ir/ir.js";

export { partSpanOf, partSpansOf } from "./ir/part-span.js";

export { endPosition } from "./ir/span.js";

// The shared IR walk — expr/query-tree traversal with no scope/document knowledge, single-sourced
// for src/document/node-at.ts and any other IR-only consumer.
export { childExprs, walkExprs, allQueryExprs } from "./ir/walk.js";

// The CST node-at-offset walk — the one genuinely editor-shaped capability: given an offset, the
// smallest IR Expr (+ owning Scope) that covers it. Backs hover.
export { nodeAt, type NodeHit } from "./document/node-at.js";

// The antlr CST escape hatch every IR node's `.cst` back-ref carries the type of.
export type { ParserRuleContext } from "antlr4ng";

export { coarseKind, type StatementCategory, type StatementKind } from "./ir/statement.js";

// The positioned syntax diagnostic carried on parse()/SqlDocument — surfaced here so the LSP
// presentation layer can map it without reaching into the internal parse-diagnostics module.
export type { SyntaxDiagnostic } from "./parse-diagnostics.js";

// --- Shared passes as building blocks (raw forms) + their typed result interfaces ---
export { resolveScopes, type CteRef, type ResolvedSource, type Scope, type ScopeTree } from "./scope/scope.js";

// The node→scope join: every (expr, owning scope) pair in structure order, and the memoized
// point lookup built on top of it. Backs hover/completion/lineage/references-shaped consumers
// that need "which Scope owns this Expr" without re-deriving the walk by hand.
export { walk, scopeOf } from "./scope/walk.js";

export { type Diagnostic, type Qualification, type ColumnBinding } from "./qualify/qualify.js";

export { Schema, type Column, type SchemaMapping, type SchemaLeaf } from "./qualify/schema.js";

// The template PROVIDER (the catalog-unification redesign): ONE resolution seam —
// `expansion(call)` — for every template expression. `DefaultTemplateProvider` is the shipped,
// concrete, inheritance-designed NEUTRAL default (fully functional with zero input, knows no macro
// vocabulary; override the granular methods with what your host knows; misses + prime() warm
// lazily). `DbtTemplateProvider` is the shipped dbt overlay (ref/source/env_var/no-output builtins) a
// dbt consumer extends. Pass the SAME per-document instance to parseTemplated (fills) and
// qualify/analyze (semantics).
export {
	DefaultTemplateProvider,
	DbtTemplateProvider,
	OPEN_PROVIDER,
	NO_OUTPUT_BUILTINS,
	type TemplateProvider,
	type TemplateCall,
	type ResolvedExpansion,
	type ResolvedRelation,
	type TemplateCandidate,
	type ValueType,
	type ExpansionShape,
} from "./qualify/template-provider.js";

export type { TemplateEngine } from "./template/engine.js";

export {
	MAIN_FRAME,
	symbolAt,
	type Span,
	type StarExpansion,
	type Sym,
	type SymbolKind,
	type SymbolModifier,
} from "./symbols/symbols.js";

export { inferType } from "./infer/infer.js";
export { parseType, formatType, type Type } from "./infer/types.js";

// Raw lineage building blocks (the wrapper `Lineage` + composable `lineage` come from ./api.js).
export { type ColumnLineage, type Origin } from "./lineage/lineage.js";
