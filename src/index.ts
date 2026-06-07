// Public API: parse (Databricks) -> lower -> scope -> qualify -> infer / lineage / symbols, all
// over the shared dialect-neutral IR (src/ir/ir.ts). Name resolution + type inference + column
// lineage; no transpilation. (T-SQL parse/lower exist under src/tsql but aren't exported here yet.)

export { parseDatabricks, type ParseResult } from "./databricks/parse.js";

export { lower } from "./databricks/lower.js";

export type {
  CteDef,
  Projection,
  QueryBody,
  QueryExpr,
  SelectExpr,
  SetOpExpr,
  Source,
  SubquerySource,
  TableSource,
} from "./ir/ir.js";

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
