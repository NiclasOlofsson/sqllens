import type { ParserRuleContext } from "antlr4ng";
import { resolveColumn, type ResolvedSource, type Scope, type ScopeTree } from "../scope/scope.js";

// ---------------------------------------------------------------------------
// Symbols — a SQL-native symbol model derived from the scope tree (and, later,
// the IR's expression trees). Each symbol is a (kind × modifiers) classification
// of a named thing, with a source span and the frame (CTE / main query) it lives
// in. The model is dialect-agnostic: it is defined over relational concepts, so
// each dialect's lowering feeds the same symbols. Consumers: editor (project to
// LSP DocumentSymbol / SemanticTokens) and the SQL debugger (frames + spans).
//
// This first slice covers RELATION symbols (table / view / CTE / subquery /
// lateral, as declarations and references). Column symbols (with provenance) and
// the expression-level symbols build on top of this.
// ---------------------------------------------------------------------------

export type SymbolKind =
  // relations
  | "table"
  | "view"
  | "cte"
  | "subquery"
  | "lateral"
  // within a relation / expression
  | "column"
  | "alias"
  | "function"
  | "parameter"
  | "literal"
  | "keyword";

export type SymbolModifier =
  | "declaration"
  | "reference"
  | "output"
  | "aggregate"
  | "window"
  | "correlated"
  | "star";

export interface Span {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface Sym {
  kind: SymbolKind;
  modifiers: SymbolModifier[];
  /** The name as it identifies the thing (a table's name, a CTE's name, an alias). */
  name: string;
  span: Span;
  /** The frame the symbol lives in: a CTE's name, a subquery alias, or "_main_". */
  frame: string;
}

/** The main query's frame label (no enclosing CTE / subquery). */
export const MAIN_FRAME = "_main_";

export function deriveSymbols(tree: ScopeTree): Sym[] {
  const out: Sym[] = [];
  walk(tree.root, MAIN_FRAME, out);
  return out;
}

function walk(scope: Scope, frame: string, out: Sym[]): void {
  const walked = new Set<Scope>();

  // CTE declarations, and each CTE body as its own frame.
  for (const [name, cteRef] of scope.ctes) {
    out.push({ kind: "cte", modifiers: ["declaration"], name, span: spanOf(cteRef.def.cst), frame });
    walk(cteRef.scope, name, out);
    walked.add(cteRef.scope);
  }
  // Set-op branches share this scope's frame.
  if (scope.branches) {
    walk(scope.branches.left, frame, out);
    walk(scope.branches.right, frame, out);
    walked.add(scope.branches.left);
    walked.add(scope.branches.right);
  }
  // Source references in this frame; a subquery source opens its own frame.
  for (const src of scope.sources.values()) {
    out.push(relationSymbol(src, frame));
    if (src.kind === "subquery") {
      walk(src.scope, src.source.alias ?? "_subquery_", out);
      walked.add(src.scope);
    }
  }
  // Expression subqueries (scalar / IN / EXISTS) — the remaining children, each its own frame.
  for (const child of scope.children) {
    if (!walked.has(child)) walk(child, "_sub_", out);
  }

  emitColumns(scope, frame, out);
}

/** Column references in this frame, plus output declarations for aliased/computed projections. */
function emitColumns(scope: Scope, frame: string, out: Sym[]): void {
  const body = scope.body;
  if (body.kind === "select") {
    for (const p of body.projections) {
      if (p.isStar) {
        const q = p.expr.kind === "star" ? p.expr.qualifier : undefined;
        out.push({ kind: "column", modifiers: ["star"], name: q ? `${q.join(".")}.*` : "*", span: spanOf(p.cst), frame });
        continue;
      }
      // A bare column projection (`a`) is just a reference — the output name echoes the column,
      // so don't double-emit a declaration. An explicit alias or a computed expr does declare.
      if (p.name === undefined) continue;
      const last = p.expr.kind === "column" ? p.expr.parts[p.expr.parts.length - 1] : undefined;
      const echo = last !== undefined && last.toLowerCase() === p.name.toLowerCase();
      if (!echo) {
        out.push({ kind: "column", modifiers: ["declaration", "output"], name: p.name, span: spanOf(p.cst), frame });
      }
    }
  }
  for (const ref of body.columns) {
    const res = resolveColumn(scope, ref);
    const modifiers: SymbolModifier[] = ["reference"];
    // A reference that binds to a source outside this scope is correlated.
    if (res.kind === "bound" && !isLocalSource(scope, res.source)) modifiers.push("correlated");
    out.push({ kind: "column", modifiers, name: ref.parts.join("."), span: spanOf(ref.cst), frame });
  }
}

function isLocalSource(scope: Scope, source: ResolvedSource): boolean {
  for (const s of scope.sources.values()) if (s === source) return true;
  return false;
}

function relationSymbol(src: ResolvedSource, frame: string): Sym {
  const ref = ["reference"] as SymbolModifier[];
  if (src.kind === "table") {
    return { kind: "table", modifiers: ref, name: src.name.join("."), span: spanOf(src.source.cst), frame };
  }
  if (src.kind === "cte") {
    return { kind: "cte", modifiers: ref, name: src.ref.def.name, span: spanOf(src.source.cst), frame };
  }
  if (src.kind === "lateral") {
    return { kind: "lateral", modifiers: ref, name: src.source.alias ?? "", span: spanOf(src.source.cst), frame };
  }
  return { kind: "subquery", modifiers: ref, name: src.source.alias ?? "_subquery_", span: spanOf(src.source.cst), frame };
}

function spanOf(cst: ParserRuleContext): Span {
  const s = cst.start;
  const e = cst.stop;
  return {
    line: s?.line ?? 0,
    column: s?.column ?? 0,
    endLine: e?.line ?? 0,
    endColumn: (e?.column ?? 0) + (e?.text?.length ?? 0),
  };
}
