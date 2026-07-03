import { type FoldingRange, FoldingRangeKind } from "vscode-languageserver-types";
import type { CteDef, Expr, QueryBody, QueryExpr, SelectExpr, SetOpExpr, Source, SqlDocument } from "../../index.js";
import { type CellBase, cellBaseOf, rangeFromCst, shiftRange } from "../ranges.js";

// ---------------------------------------------------------------------------
// Folding ranges: foldable regions derived from the IR (doc.ast). Each node that
// reads as a structural block — the statement, every CTE, every subquery, each
// select body, each set-op branch, each pipe stage — folds when its CST span is
// multi-line. Pure translation of the cached document's IR; recurses into nested
// query blocks so nested CTEs / subqueries fold too. Never throws → [].
// Comment-block folding is out of scope (no comment grouping here).
// ---------------------------------------------------------------------------

/** The structural shape of a PipeExpr stage (PipeStage isn't re-exported from the barrel). */
type StageShape = { op: string; cst: QueryExpr["cst"] } & Record<string, unknown>;

export function computeFoldingRanges(doc: SqlDocument): FoldingRange[] {
	const ranges: FoldingRange[] = [];
	const seen = new Set<string>();
	// The current cell's base — cst spans are CELL-relative, so each fold shifts to doc coordinates.
	// Stays {0,0} on the single-cell path (identity), so that path is byte-identical.
	let base: CellBase = { line: 0, character: 0 };

	// Emit a multi-line fold for a node's CST span, de-duped by (startLine,endLine) in doc coordinates.
	const emit = (cst: QueryExpr["cst"]): void => {
		const raw = rangeFromCst(cst);
		if (raw.end.line <= raw.start.line) return; // single-line: not foldable
		const r = shiftRange(raw, base);
		const key = `${r.start.line}:${r.end.line}`;
		if (seen.has(key)) return;
		seen.add(key);
		ranges.push({ startLine: r.start.line, endLine: r.end.line, kind: FoldingRangeKind.Region });
	};

	const visitQuery = (qe: QueryExpr): void => {
		emit(qe.cst);
		for (const cte of qe.ctes) visitCte(cte);
		visitBody(qe.body);
	};

	const visitCte = (cte: CteDef): void => {
		emit(cte.cst);
		visitQuery(cte.body);
	};

	const visitSource = (source: Source): void => {
		if (source.kind === "subquery") {
			emit(source.cst);
			visitQuery(source.query);
		}
	};

	const visitExpr = (expr: Expr): void => {
		// Subquery / EXISTS expressions open nested query blocks worth folding.
		if (expr.kind === "subquery" || expr.kind === "exists") {
			emit(expr.cst);
			visitQuery(expr.query);
			return;
		}
		for (const child of childExprs(expr)) visitExpr(child);
	};

	const visitSelect = (body: SelectExpr): void => {
		emit(body.cst);
		for (const s of body.from) visitSource(s);
		for (const p of body.projections) visitExpr(p.expr);
		if (body.where) visitExpr(body.where);
		for (const j of body.joinConditions ?? []) visitExpr(j);
		for (const g of body.groupBy ?? []) visitExpr(g);
		if (body.having) visitExpr(body.having);
		if (body.qualify) visitExpr(body.qualify);
		for (const sub of body.subqueries ?? []) visitQuery(sub);
	};

	const visitSetOp = (body: SetOpExpr): void => {
		emit(body.cst);
		visitBody(body.left);
		visitBody(body.right);
	};

	const visitBody = (body: QueryBody): void => {
		if (body.kind === "select") {
			visitSelect(body);
		} else if (body.kind === "setop") {
			visitSetOp(body);
		} else {
			// pipe: the input relation plus each |> stage; recurse into stage-borne queries.
			emit(body.cst);
			visitBody(body.input);
			for (const stage of body.stages) visitStage(stage);
		}
	};

	// PipeStage is a wide discriminated union (not re-exported from the barrel); take it as the
	// structural shape and narrow on `op`. Every stage folds by its own span; carried queries recurse.
	const visitStage = (stage: StageShape): void => {
		const s = stage;
		emit(s.cst);
		switch (s.op) {
			case "setop":
				for (const q of s.operands as QueryExpr[]) visitQuery(q);
				break;
			case "recursiveUnion":
				visitQuery(s.operand as QueryExpr);
				break;
			case "with":
				for (const cte of s.ctes as CteDef[]) visitCte(cte);
				break;
			case "join":
				visitSource(s.source as Source);
				break;
			case "if":
				for (const arm of s.arms as { pipeline: StageShape[] }[])
					for (const inner of arm.pipeline) visitStage(inner);
				break;
			case "fork":
			case "tee":
				for (const branch of s.branches as StageShape[][]) for (const inner of branch) visitStage(inner);
				break;
			case "log":
				if (s.pipeline) for (const inner of s.pipeline as StageShape[]) visitStage(inner);
				break;
		}
	};

	try {
		if (doc.statements.length <= 1) {
			// Single-cell: EXACTLY today's path (base stays 0 → emit is an identity shift).
			visitQuery(doc.ast);
			foldMultiStatement(doc, ranges, seen);
		} else {
			// Multi-cell: fold each statement through its OWN real per-statement IR (doc.ast is the empty
			// compound facade), shifting every range to doc coordinates by the owning cell's start.
			for (const cell of doc.statements) {
				base = cellBaseOf(doc, cell);
				visitQuery(cell.ast);
			}
		}
	} catch {
		// Total: never throw on broken / mid-edit input.
	}
	return ranges;
}

/** Sub-expressions reachable without crossing into a nested query block (subquery/exists
 *  are handled by visitExpr directly). Mirrors node-at's childExprs, kept LSP-local. */
function childExprs(expr: Expr): Expr[] {
	switch (expr.kind) {
		case "binary":
			return [expr.left, expr.right];
		case "unary":
			return [expr.operand];
		case "function":
			return [...expr.args, ...(expr.window ? [...expr.window.partitionBy, ...expr.window.orderBy] : [])];
		case "case":
			return [...expr.whens.flatMap((w) => [w.when, w.then]), ...(expr.elseExpr ? [expr.elseExpr] : [])];
		case "cast":
			return [expr.expr];
		case "predicate":
			return [expr.operand, ...expr.args];
		case "lambda":
			return [expr.body];
		case "subscript":
			return [expr.base, expr.index];
		case "star":
			return expr.replace?.map((r) => r.expr) ?? [];
		default:
			return [];
	}
}

// doc.ast models ONE statement. A multi-statement document parses to a single root whose
// CST holds the other statements; fold each top-level statement child of the CST root that
// spans multiple lines, so e.g. two stacked SELECTs each fold even though only the first is
// in doc.ast. De-duped against the IR-derived ranges (the first statement is already folded
// via doc.ast). dbt models are typically single-statement, so this is the uncommon path.
function foldMultiStatement(doc: SqlDocument, ranges: FoldingRange[], seen: Set<string>): void {
	const root = doc.cst as { children?: unknown[] };
	const children = root.children;
	if (!Array.isArray(children)) return;
	for (const child of children) {
		const cst = child as { start?: { line: number; column: number }; stop?: unknown } | null;
		if (!cst || typeof cst !== "object" || !("start" in cst) || !cst.start) continue;
		const r = rangeFromCst(cst as Parameters<typeof rangeFromCst>[0]);
		if (r.end.line <= r.start.line) continue;
		const key = `${r.start.line}:${r.end.line}`;
		if (seen.has(key)) continue;
		seen.add(key);
		ranges.push({ startLine: r.start.line, endLine: r.end.line, kind: FoldingRangeKind.Region });
	}
}
