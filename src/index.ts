// Public API for the Databricks semantic layer: parse -> lower -> scope -> qualify.
// Syntax + name resolution only (see docs/PLAN.md Phase 1.5); no transpilation or lineage.

export { parseDatabricks, type ParseResult } from "./databricks/parse.js";

export {
  lower,
  type CteDef,
  type Projection,
  type QueryBody,
  type QueryExpr,
  type SelectExpr,
  type SetOpExpr,
  type Source,
  type SubquerySource,
  type TableSource,
} from "./databricks/ir.js";

export {
  resolveScopes,
  type CteRef,
  type ResolvedSource,
  type Scope,
  type ScopeTree,
} from "./scope/scope.js";

export { qualify, type Diagnostic, type Qualification } from "./qualify/qualify.js";

export { Schema, type Column, type SchemaMapping } from "./qualify/schema.js";

export {
  deriveSymbols,
  MAIN_FRAME,
  type Span,
  type Sym,
  type SymbolKind,
  type SymbolModifier,
} from "./symbols/symbols.js";

export { inferType } from "./infer/infer.js";
export { parseType, type Type } from "./infer/types.js";

export { lineage, originsOf, type ColumnLineage, type Origin } from "./lineage/lineage.js";
