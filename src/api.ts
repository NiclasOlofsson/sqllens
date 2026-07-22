// ---------------------------------------------------------------------------
// Public API surface — uniform across dialects, layered, composable, immutable.
//
// `parse(sql, dialect)` dispatches to the right per-dialect parse+lower and returns
// the dialect-neutral IR (QueryExpr) as `ast`, frozen so no later pass can mutate it,
// with the raw antlr CST kept as an escape hatch. `analyze(sql, dialect, opts)` runs
// the whole pipeline and returns every tier as a first-class terminal value.
//
// The per-dialect `parse*` / `lower` and the shared passes (resolveScopes, qualify,
// inferType, lineage, deriveSymbols) stay exported as lower-level building blocks;
// this file adds the uniform entry, the idempotent lift helpers, and the typed
// result wrappers (TypeInfo, Lineage) that keep raw Map/Set/Record out of the API.
// ---------------------------------------------------------------------------

import type { ParserRuleContext } from "antlr4ng";
import { parseDatabricks } from "./databricks/parse.js";
import { lower as lowerDatabricks } from "./databricks/lower.js";
import { parseTSql } from "./tsql/parse.js";
import { lower as lowerTSql } from "./tsql/lower.js";
import { parseSnowflake } from "./snowflake/parse.js";
import { lower as lowerSnowflake } from "./snowflake/lower.js";
import { parseBigQuery } from "./bigquery/parse.js";
import { lower as lowerBigQuery } from "./bigquery/lower.js";
import { parseRedshift } from "./redshift/parse.js";
import { lower as lowerRedshift } from "./redshift/lower.js";
import { parsePostgres } from "./postgres/parse.js";
import { lower as lowerPostgres } from "./postgres/lower.js";
import { parseDuckdb } from "./duckdb/parse.js";
import { lower as lowerDuckdb } from "./duckdb/lower.js";
import { parseTrino } from "./trino/parse.js";
import { lower as lowerTrino } from "./trino/lower.js";
import { parseSqlite } from "./sqlite/parse.js";
import { lower as lowerSqlite } from "./sqlite/lower.js";
import { parseMysql } from "./mysql/parse.js";
import { lower as lowerMysql } from "./mysql/lower.js";
import type { Expr, Projection, QueryExpr } from "./ir/ir.js";
import type { SyntaxDiagnostic } from "./parse-diagnostics.js";
import { resolveScopes, type Scope, type ScopeTree } from "./scope/scope.js";
import { qualify as qualifyScopes, type Qualification } from "./qualify/qualify.js";
import { Schema } from "./qualify/schema.js";
import { CallbackSchema, type SchemaProvider, type TableResolver } from "./qualify/schema-provider.js";
import { OPEN_PROVIDER } from "./qualify/template-provider.js";

import { inferType } from "./infer/infer.js";
import type { Type } from "./infer/types.js";
import { inferNullability, type Nullability } from "./infer/nullability.js";
export type { Nullability } from "./infer/nullability.js";
import {
	lineage as lineageScopes,
	originsOf as exprOriginsOf,
	type ColumnLineage,
	type Origin,
} from "./lineage/lineage.js";
import { deriveSymbols as deriveSymbolsScopes, type StarExpansion, type Sym } from "./symbols/symbols.js";
import type { Token } from "./token/token.js";

import type { Dialect } from "./dialect.js";
export type { Dialect } from "./dialect.js";

interface DialectFns {
	parse(sql: string): {
		tree: ParserRuleContext;
		errors: number;
		diagnostics: SyntaxDiagnostic[];
		tokens: Token[];
		sllFallback: boolean;
	};
	lower(tree: ParserRuleContext): QueryExpr;
}

const DIALECTS: Record<Dialect, DialectFns> = {
	databricks: { parse: parseDatabricks, lower: lowerDatabricks },
	tsql: { parse: parseTSql, lower: lowerTSql },
	snowflake: { parse: parseSnowflake, lower: lowerSnowflake },
	bigquery: { parse: parseBigQuery, lower: lowerBigQuery },
	redshift: { parse: parseRedshift, lower: lowerRedshift },
	postgres: { parse: parsePostgres, lower: lowerPostgres },
	duckdb: { parse: parseDuckdb, lower: lowerDuckdb },
	trino: { parse: parseTrino, lower: lowerTrino },
	sqlite: { parse: parseSqlite, lower: lowerSqlite },
	mysql: { parse: parseMysql, lower: lowerMysql },
};

/** Options carrying the dialect, needed only when a lift helper enters from a raw string. */
export interface DialectOpts {
	dialect?: Dialect;
}

export interface ParseResultIR {
	/** The dialect-neutral IR — the documented "AST" consumers build on. Deep-frozen. */
	ast: QueryExpr;
	/** Count of lexer + parser syntax errors (a valid parse is still returned). */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length). */
	diagnostics: SyntaxDiagnostic[];
	/** The raw antlr CST root — the escape hatch for tokens/exact spans. */
	cst: ParserRuleContext;
	/** Every lexer token (trivia included, EOF excluded), as neutral `Token`s with exact spans —
	 *  the always-available token stream for editor features, present even when `errors > 0`. */
	tokens: Token[];
	/** True when the two-stage parse fell back from fast SLL prediction to full LL. Same result
	 *  either way — this just says which path produced it, for perf profiling (tools/profile-sll.ts). */
	sllFallback: boolean;
}

/**
 * Parse one statement (or a dialect's statement batch) and lower it to the IR. Dispatches on
 * `dialect`. `ast` is the IR, frozen so no later pass can write back into it; `cst` is the raw
 * parse tree for anyone who needs tokens or precise spans. A valid parse never throws — syntax
 * errors are reported in `errors`, not raised.
 */
export function parse(sql: string, dialect: Dialect): ParseResultIR {
	const fns = DIALECTS[dialect];
	const { tree, errors, diagnostics, tokens, sllFallback } = fns.parse(sql);
	// lower() already freezes the IR — it is immutable from here on.
	return { ast: fns.lower(tree), errors, diagnostics, cst: tree, tokens, sllFallback };
}

export interface Analysis {
	ast: QueryExpr;
	errors: number;
	/** The parse tier's positioned SYNTAX diagnostics (line/column/offset/length) — the same array
	 *  parse() returns; `diagnostics` (below) is the SEMANTIC set from qualify. Two tiers, two fields. */
	syntaxDiagnostics: SyntaxDiagnostic[];
	/** The parse tier's first-class token stream (always present, even on broken input). */
	tokens: Token[];
	/** Raw-CST escape hatch, same object parse() returns. */
	cst: ParserRuleContext;
	scopes: ScopeTree;
	/** Schema-fed diagnostics (unknown table/column/field). Empty without a schema. */
	diagnostics: Qualification["diagnostics"];
	/** The full schema-fed resolution (star expansion + diagnostics) — `Qualification.columnsOf`. */
	qualification: Qualification;
	/** Per-expression types — `TypeInfo.typeOf(expr, scope)`. */
	types: TypeInfo;
	/** Base-table origins per output column — `Lineage.originsOf(column)` / `.all`. */
	lineage: Lineage;
	/** The kind × modifier symbol model over the scope tree. */
	symbols: Sym[];
}

/**
 * Run the whole pipeline — parse → lower → resolveScopes → qualify → infer / lineage / symbols —
 * and return each tier as a first-class terminal value. With no schema the schema-fed tiers still
 * answer what they can (scopes, symbols) and stay empty/`unknown` where a catalog is required.
 */
export function analyze(sql: string, dialect: Dialect, opts: { schema?: SchemaProvider } = {}): Analysis {
	const schema = opts.schema ?? OPEN_PROVIDER;
	const parsed = parse(sql, dialect);
	const scopes = resolveScopes(parsed.ast, dialect);
	const qualification = qualifyScopes(scopes, schema);
	return {
		ast: parsed.ast,
		errors: parsed.errors,
		syntaxDiagnostics: parsed.diagnostics,
		tokens: parsed.tokens,
		cst: parsed.cst,
		scopes,
		diagnostics: qualification.diagnostics,
		qualification,
		types: new TypeInfo(schema),
		lineage: new Lineage(lineageScopes(scopes, schema)),
		symbols: deriveSymbolsScopes(scopes, schema, qualification.expandStarOf),
	};
}

// ---------------------------------------------------------------------------
// Lift helpers — idempotent: identity if the value is already at that stage,
// otherwise run only the missing steps. They make every tier ergonomically
// reachable from a raw string / IR without re-doing work already done.
// ---------------------------------------------------------------------------

/** Lift to the IR. A `QueryExpr` returns unchanged; a string is parsed + lowered. */
export function toAst(x: string | QueryExpr, dialect?: Dialect): QueryExpr {
	if (typeof x !== "string") return x;
	if (!dialect) throw new Error("toAst(string) needs a dialect");
	return parse(x, dialect).ast;
}

/** Lift to a ScopeTree. A ScopeTree returns unchanged; an IR is resolved; a string is parsed +
 *  lowered + resolved. The dialect is required only when entering from a string, or a bare
 *  hand-built IR that carries no `dialect` tag — an IR from a dialect's lower() needs nothing. */
export function toScopes(x: string | QueryExpr | ScopeTree, opts: DialectOpts = {}): ScopeTree {
	if (isScopeTree(x)) return x;
	if (typeof x === "string") {
		if (!opts.dialect) throw new Error("toScopes(string) needs a dialect");
		return resolveScopes(toAst(x, opts.dialect), opts.dialect);
	}
	return resolveScopes(x, opts.dialect);
}

function isScopeTree(x: unknown): x is ScopeTree {
	return typeof x === "object" && x !== null && (x as { kind?: unknown }).kind === "scopes";
}

// ---------------------------------------------------------------------------
// Composable wrappers — each accepts its closest upstream result, OR a string /
// IR via the lift, so a caller can hand any upstream value to any later method
// and only the missing steps run. They wrap the lower-level building blocks.
// ---------------------------------------------------------------------------

/** Schema-fed resolution. Accepts a ScopeTree (no rework), an IR, or a raw string. */
export function qualify(
	x: string | QueryExpr | ScopeTree,
	schema: SchemaProvider,
	opts: DialectOpts = {},
): Qualification {
	return qualifyScopes(toScopes(x, opts), schema);
}

/** Column lineage. Accepts a ScopeTree (no rework), an IR, or a raw string. */
export function lineage(x: string | QueryExpr | ScopeTree, schema: SchemaProvider, opts: DialectOpts = {}): Lineage {
	return new Lineage(lineageScopes(toScopes(x, opts), schema));
}

/** Symbol model. Accepts a ScopeTree (no rework), an IR, or a raw string. Schema is optional.
 *  `expandStarOf` (typically the `expandStarOf` of a `Qualification` already built over the same
 *  scopes) additionally expands a resolvable star projection into per-column Syms — a separate
 *  trailing param, not folded into `opts`, since it is a resolved callback tied to a specific
 *  schema-fed pass, not a static dialect option. */
export function deriveSymbols(
	x: string | QueryExpr | ScopeTree,
	schema?: SchemaProvider,
	opts: DialectOpts = {},
	expandStarOf?: StarExpansion,
): Sym[] {
	return deriveSymbolsScopes(toScopes(x, opts), schema, expandStarOf);
}

// ---------------------------------------------------------------------------
// Typed result wrappers — keep raw Map/Set/Record out of the public surface and
// future-proof the internal storage behind typed accessors.
// ---------------------------------------------------------------------------

/** Per-expression type access. `typeOf(expr, scope)` returns the inferred `Type` (a typed union;
 *  `unknown` when undeterminable — no schema, or no rule), never a guess. */
export class TypeInfo {
	constructor(private readonly schema: SchemaProvider) {}

	/** The inferred type of an expression evaluated in a scope. */
	typeOf(expr: Expr, scope: Scope): Type {
		return inferType(expr, scope, this.schema);
	}

	/** The inferred nullability of an expression evaluated in a scope — "notnull"/"nullable" only
	 *  when provable from expression shape + schema + join shape, else "unknown" (never guessed). */
	nullabilityOf(expr: Expr, scope: Scope): Nullability {
		return inferNullability(expr, scope, this.schema);
	}
}

/** Base-table origins for a query's output columns. `all` is the per-output list; `originsOf(col)`
 *  looks an output column up by name. Hides the internal lookup behind a typed accessor. */
export class Lineage {
	/** Per output column: the base-table columns it derives from. */
	readonly all: readonly ColumnLineage[];
	private readonly byOutput: Map<string, Origin[]>;
	private readonly byNode: WeakMap<Projection, Origin[]>;

	constructor(columns: ColumnLineage[]) {
		this.all = columns;
		this.byOutput = new Map();
		this.byNode = new WeakMap();
		for (const c of columns) {
			this.byOutput.set(c.output, c.origins);
			if (c.projection) this.byNode.set(c.projection, c.origins);
		}
	}

	/** The base-table origins of a named output column, or [] if there is no such output. */
	originsOf(column: string): Origin[] {
		return this.byOutput.get(column) ?? [];
	}

	/** Origins keyed by the producing Projection node — unambiguous under duplicate output names. */
	originsOfNode(projection: Projection): Origin[] {
		return this.byNode.get(projection) ?? [];
	}
}

// Re-export the single-expression origin walk under its building-block name (distinct from the
// Lineage wrapper) so consumers can trace one expression without a full query lineage.
export { exprOriginsOf as originsOfExpr };

// Per-hop lineage — the cursor-anchored reference-spine DAG (one hop per qualifiable column, each a
// reference into the frozen IR/scope tree). `lineageAt(scopes, offset, schema?)` anchors on the node
// under a cursor; `lineageOf(node, scope, schema?)` traces any column-ref/projection programmatically.
// Rides the same shared binder as the flat lineage() so the two cannot drift. Total: lineageAt never
// throws (returns undefined off-symbol).
export { lineageAt, lineageOf, type LineageHop, type ViaStep } from "./lineage/hops.js";

// The token-stream front end: the always-available lexer-only token list (tokenize) plus the
// neutral token types. parse() now carries the same tokens on its result; tokenize() serves the
// broken-input case where no parse is wanted.
export { tokenize } from "./token/tokenize.js";
export type { Token, TokenRole } from "./token/token.js";

// The persistent, immutable per-document model — the stateful front of these stateless functions.
// It composes the surface above (parse/toScopes/qualify/deriveSymbols/TypeInfo); the import cycle
// (api re-exports SqlDocument, document imports from api) is safe because document.ts only calls
// these at call time, never at module-eval time.
export {
	SqlDocument,
	type DocumentAnalysis,
	type StatementCell,
	type DocumentVariant,
	type UnionCte,
} from "./document/document.js";
export { LineIndex } from "./document/line-index.js";
export type { StatementCellSpan } from "./document/split.js";

// Scope-aware completion over a SqlDocument — the broken-input editor feature (keywords + schema
// tables/columns + function names at the caret). Total: never throws.
export {
	complete,
	completeAt,
	type Completion,
	type CompletionResult,
	type ReplaceRange,
	type CompleteOptions,
	type CandidateIdentity,
	type CandidateDecoration,
	type DecorateCandidate,
} from "./completion/complete.js";

// The NEUTRAL half of jinja completion: which call + arg slot the caret sits in inside a jinja tag
// (`{{ ref('cu│` → { callee: "ref", argIndex: 0, prefix: "cu" }). Carries no dbt vocabulary; a
// consumer maps callee + argIndex to a role and supplies candidates. Reuses the parsed tags.
export { jinjaSlotAt, type JinjaSlot } from "./completion/jinja-slot.js";

// Signature help over a SqlDocument — the broken-input editor feature that shows parameter hints
// while typing inside a call's parens. SIGNATURES is the merged per-dialect table (curated overrides
// folded over the harvested doc-derived long tail at generation time, tools/harvest-signatures.mjs);
// a name maps to an overload SET (readonly FnSignature[]), not a single shape: it is common for a
// builtin to be overloaded on argument type or arity. An unknown name degrades to a one-entry
// name-only fallback. A pure token scan; never throws.
export { signatureAt, type SignatureHelpInfo, type SignatureLabel } from "./signature/signature.js";
export { SIGNATURES, lookupSignature, hasSignature, type FnSignature, type ParamSig } from "./signature/signatures.js";
export { renderSignature, type RenderSignatureOptions } from "./signature/render.js";
export { FN_DOCS, lookupFnDoc, type FnDoc } from "./signature/docs.js";

// References / occurrence engine — find the declaration + every occurrence of the symbol under a
// cursor offset. The core primitive behind LSP references / documentHighlight / codeLens / rename.
// Total: never throws; returns null off-symbol.
export { referencesAt, type Occurrence, type Occurrences } from "./references/references.js";

// Frame / clause / set-op-arm geometry: the SQL debugger's marker-planting primitives, which frame
// (CTE) a document position sits in, that frame's ordered clause list, and set-op arm spans. Total:
// never throws; frameAt/clausesOf/setOpArmsOf all degrade to undefined/[] off-symbol or off-shape.
export { frameAt, type Frame } from "./scope/frame.js";
export { clausesOf, type ClauseInfo, type ClauseKind } from "./scope/clauses.js";
export { setOpArmsOf, type SetOpArm, type SetOpArms } from "./scope/setop-arms.js";

// Per-dialect function/keyword/type-name membership sets — for lint-style "is this identifier a
// known X for this dialect?" checks. Computed once per dialect and cached.
export { dialectSymbols, dialectVocabulary, type DialectSymbols, type DialectVocabulary } from "./dialect-symbols.js";
export { reservedKeywords, type KeywordEntry, type KeywordReservation } from "./dialect-symbols.js";

// The catalog interface the whole pipeline resolves against, plus its resolve-on-demand
// implementation. `Schema` (a full upfront mapping) and `CallbackSchema` (a host-driven
// lazy resolver whose prime() bumps a version to invalidate SqlDocument.analyze's memo) both
// satisfy `SchemaProvider`; every analysis entry point accepts the interface.
export { CallbackSchema, type SchemaProvider, type TableResolver } from "./qualify/schema-provider.js";
// The derived-dialect → dialect map: resolve an engine name (athena, glue, fabric, spark, …) to the
// dialect that parses its SQL, so consumers don't re-derive the family knowledge.
export { DERIVED_DIALECTS, resolveDialect } from "./derived-dialects.js";
// The dialect-true identifier fold — the identity key for name comparison (unquote + case-fold per
// the dialect's documented rules) and its display twin (unquote only). Exported so an embedding
// consumer comparing names against IR/scope output folds the same way the pipeline does.
export { foldIdentifier, displayName } from "./dialect-behavior/public-fold.js";
export type { IdentKind } from "./ident/fold.js";
