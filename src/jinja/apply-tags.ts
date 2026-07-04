// ---------------------------------------------------------------------------
// R3 — templated ref/source as first-class TableSource nodes (inc2).
//
// `{{ ref('x') }}` / `{{ source('a','b') }}` in a FROM/JOIN slot lowers, via the
// placeholder mechanism, to an ordinary `TableSource` whose `name` is the raw
// placeholder identifier (a `jjj…` run). This POST-LOWER transform rewrites those
// sources so `name` carries the dbt-logical model/source names, and attaches a
// `template` marker — so scope/qualify/lineage see the model, not the placeholder
// (scope binds a TableSource purely by `name`, so the whole downstream pipeline
// works UNCHANGED).
//
// Correlation is by CONTAINMENT, not equality: a `TableSource` correlates with a
// tag when the char offset of its FIRST NAME TOKEN (`cst.start.start`) lies inside
// the tag's `tagSpan` [start, end). Containment (not equality) because a multi-line
// expr tag fills ONE placeholder identifier per line — the name token covers only
// the first line, but its offset still sits inside the whole-tag span.
//
// Substitution is LITERAL-ONLY (never-wrong): inc1's `directStringToken` guard
// already guarantees a ref/source TagNode carries only literal names, so a `ref`
// node's `model` and a `source` node's `sourceName`/`tableName` are real literals.
// A macro (or computed) call in a FROM slot keeps its placeholder name and gets
// `opaque: true` — its physical relation is undeterminable without the catalog;
// we NEVER fabricate a name for it.
//
// The IR is frozen after lower(); this transform REBUILDS with STRUCTURAL SHARING
// (new objects only on changed paths — an unchanged subtree keeps its original,
// already-frozen reference) and re-freezes the rebuilt tree. It NEVER mutates a
// frozen node. Total: never throws — on any internal surprise it returns the input
// `ast` unchanged.
// ---------------------------------------------------------------------------

import { freezeIR } from "../ir/freeze.js";
import type {
	CteDef,
	PipeBranch,
	PipeExpr,
	PipeStage,
	QueryBody,
	QueryExpr,
	SelectExpr,
	SetOpExpr,
	Source,
	TableSource,
	TemplateSourceInfo,
} from "../ir/ir.js";
import type { TagNode } from "./tag-ast.js";

/** The tag kinds that produce a template attachment (a FROM-slot relation). */
type RelationTag = Extract<TagNode, { kind: "ref" | "source" | "macro" }>;

/**
 * Rewrite templated FROM/JOIN sources in `ast` to carry their dbt-logical name +
 * a `template` marker, correlating each source to a tag by span containment.
 * Returns the SAME reference when nothing correlates (structural sharing); returns
 * a re-frozen rebuilt tree otherwise. Total — never throws.
 */
export function applyTemplateTags(ast: QueryExpr, tags: TagNode[]): QueryExpr {
	try {
		const relTags = tags.filter(
			(t): t is RelationTag => t.kind === "ref" || t.kind === "source" || t.kind === "macro",
		);
		if (relTags.length === 0) return ast;
		const next = transformQuery(ast, relTags);
		return next === ast ? ast : freezeIR(next);
	} catch {
		return ast;
	}
}

/** Map an array with structural sharing: the SAME array reference back when no element changed. */
function mapShared<T>(arr: readonly T[], fn: (x: T) => T): T[] {
	let changed = false;
	const out = arr.map((x) => {
		const y = fn(x);
		if (y !== x) changed = true;
		return y;
	});
	return changed ? out : (arr as T[]);
}

/** The first relation-tag whose `tagSpan` contains `offset` ([start, end)), or undefined. */
function containingTag(tags: RelationTag[], offset: number): RelationTag | undefined {
	for (const t of tags) {
		if (offset >= t.tagSpan.start && offset < t.tagSpan.end) return t;
	}
	return undefined;
}

function transformQuery(q: QueryExpr, tags: RelationTag[]): QueryExpr {
	const ctes = mapShared(q.ctes, (c) => transformCte(c, tags));
	const body = transformBody(q.body, tags);
	if (ctes === q.ctes && body === q.body) return q;
	return { ...q, ctes, body };
}

function transformCte(cte: CteDef, tags: RelationTag[]): CteDef {
	const body = transformQuery(cte.body, tags);
	return body === cte.body ? cte : { ...cte, body };
}

function transformBody(body: QueryBody, tags: RelationTag[]): QueryBody {
	if (body.kind === "select") return transformSelect(body, tags);
	if (body.kind === "setop") return transformSetOp(body, tags);
	if (body.kind === "pipe") return transformPipe(body, tags);
	return body;
}

function transformSelect(sel: SelectExpr, tags: RelationTag[]): SelectExpr {
	// Transform the FROM sources, tracking old→new so `joins` (whose `source` is
	// reference-identical to a `from` entry — the documented invariant) stays aligned.
	const srcMap = new Map<Source, Source>();
	const from = mapShared(sel.from, (s) => {
		const n = transformSource(s, tags);
		if (n !== s) srcMap.set(s, n);
		return n;
	});

	// Expression subqueries (scalar / IN / EXISTS) — scope reads these as child scopes.
	const subqueries = sel.subqueries ? mapShared(sel.subqueries, (q) => transformQuery(q, tags)) : sel.subqueries;

	// Keep `joins[i].source` reference-identical to the rebuilt `from` entry.
	let joins = sel.joins;
	if (sel.joins && srcMap.size > 0) {
		joins = mapShared(sel.joins, (j) => {
			const n = srcMap.get(j.source);
			return n ? { ...j, source: n } : j;
		});
	}

	if (from === sel.from && subqueries === sel.subqueries && joins === sel.joins) return sel;
	return { ...sel, from, subqueries, joins };
}

function transformSetOp(so: SetOpExpr, tags: RelationTag[]): SetOpExpr {
	const left = transformBody(so.left, tags);
	const right = transformBody(so.right, tags);
	if (left === so.left && right === so.right) return so;
	return { ...so, left, right };
}

function transformPipe(pe: PipeExpr, tags: RelationTag[]): PipeExpr {
	const input = transformBody(pe.input, tags);
	const stages = transformStages(pe.stages, tags);
	if (input === pe.input && stages === pe.stages) return pe;
	return { ...pe, input, stages };
}

function transformStages(stages: readonly PipeStage[], tags: RelationTag[]): PipeStage[] {
	return mapShared(stages, (s) => transformStage(s, tags));
}

function transformStage(stage: PipeStage, tags: RelationTag[]): PipeStage {
	switch (stage.op) {
		case "join": {
			const source = transformSource(stage.source, tags);
			return source === stage.source ? stage : { ...stage, source };
		}
		case "setop": {
			const operands = mapShared(stage.operands, (q) => transformQuery(q, tags));
			return operands === stage.operands ? stage : { ...stage, operands };
		}
		case "recursiveUnion": {
			const operand = transformQuery(stage.operand, tags);
			return operand === stage.operand ? stage : { ...stage, operand };
		}
		case "with": {
			const ctes = mapShared(stage.ctes, (c) => transformCte(c, tags));
			return ctes === stage.ctes ? stage : { ...stage, ctes };
		}
		case "if": {
			const arms = mapShared(stage.arms, (a) => transformBranch(a, tags));
			return arms === stage.arms ? stage : { ...stage, arms };
		}
		case "fork":
		case "tee": {
			const branches = mapShared(stage.branches, (b) => transformStages(b, tags));
			return branches === stage.branches ? stage : { ...stage, branches };
		}
		case "log": {
			if (!stage.pipeline) return stage;
			const pipeline = transformStages(stage.pipeline, tags);
			return pipeline === stage.pipeline ? stage : { ...stage, pipeline };
		}
		default:
			return stage;
	}
}

function transformBranch(arm: PipeBranch, tags: RelationTag[]): PipeBranch {
	const pipeline = transformStages(arm.pipeline, tags);
	return pipeline === arm.pipeline ? arm : { ...arm, pipeline };
}

function transformSource(source: Source, tags: RelationTag[]): Source {
	if (source.kind === "subquery") {
		const query = transformQuery(source.query, tags);
		return query === source.query ? source : { ...source, query };
	}
	if (source.kind === "table") return transformTableSource(source, tags);
	// lateral / graphtable carry no inner QueryExpr field in the IR — nothing to walk.
	return source;
}

function transformTableSource(src: TableSource, tags: RelationTag[]): TableSource {
	const startTok = src.cst?.start;
	if (!startTok) return src;
	const tag = containingTag(tags, startTok.start);
	if (!tag) return src;

	if (tag.kind === "ref") {
		const template: TemplateSourceInfo = { kind: "ref", span: tag.tagSpan };
		return { ...src, name: [tag.model], template };
	}
	if (tag.kind === "source") {
		const template: TemplateSourceInfo = { kind: "source", span: tag.tagSpan };
		return { ...src, name: [tag.sourceName, tag.tableName], template };
	}
	// macro in a FROM slot: keep the placeholder name (honest), mark opaque.
	const template: TemplateSourceInfo = { kind: "macro", span: tag.tagSpan, opaque: true };
	return { ...src, template };
}
