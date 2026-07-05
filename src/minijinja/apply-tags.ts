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
	PartSpan,
	PipeBranch,
	PipeExpr,
	PipeStage,
	QueryBody,
	QueryExpr,
	SelectExpr,
	SetOpExpr,
	Source,
	TableSource,
	TemplateExprInfo,
	TemplateSourceInfo,
} from "../ir/ir.js";
import type { TemplateCall } from "../qualify/template-provider.js";
import type { MacroCall, TagNode } from "./tag-ast.js";

/** The tag kinds that produce a template attachment (a FROM-slot relation). `var`/`env_var`/`other`
 *  are the NON-CALL expression tags: a bare variable or arbitrary expression occupying a FROM slot
 *  gets the opaque `"expr"` marker (or resolves through a literal `{% set %}` — see `SetResolution`),
 *  so the placeholder name never reaches qualify/hover as if it were a real table. */
type ExprTag = Extract<TagNode, { kind: "var" | "env_var" | "config" | "other" }>;
type RelationTag = Extract<TagNode, { kind: "ref" | "source" | "macro" }> | ExprTag;
type ControlTag = Extract<TagNode, { kind: "control" }>;

/** What a template-local variable is known to hold: a literal ref/source target (name resolvable),
 *  or any other single-call RHS (identity known, relation up to the provider). */
type SetResolution =
	| { kind: "ref"; name: string[]; call: TemplateCall }
	| { kind: "source"; name: string[]; call: TemplateCall }
	| { kind: "macro"; call: TemplateCall };

/** Everything transformTableSource needs, threaded once. */
interface TagContext {
	relTags: RelationTag[];
	sets: ReadonlyMap<string, SetResolution>;
	text: string;
}

/**
 * Rewrite templated FROM/JOIN sources in `ast` to carry their dbt-logical name +
 * a `template` marker, correlating each source to a tag by span containment.
 * Returns the SAME reference when nothing correlates (structural sharing); returns
 * a re-frozen rebuilt tree otherwise. Total — never throws.
 */
export function applyTemplateTags(ast: QueryExpr, tags: TagNode[], text: string): QueryExpr {
	try {
		// config is a no-output tag (whitespace-filled) — it can never yield a table
		// source, so it stays out of the correlation set even though ExprTag admits it.
		const relTags = tags.filter(
			(t): t is RelationTag =>
				t.kind === "ref" ||
				t.kind === "source" ||
				t.kind === "macro" ||
				t.kind === "var" ||
				t.kind === "env_var" ||
				t.kind === "other",
		);
		if (relTags.length === 0) return ast;
		const ctx: TagContext = { relTags, sets: resolveSets(tags, text), text };
		const next = transformQuery(ast, ctx);
		// Scalar-slot marking: every column-shaped node whose token is a tag's placeholder
		// fill gets a `template` marker (span + provider key), so inference resolves it
		// through the provider and qualify never checks the placeholder as a real column.
		const marked = markTemplateExprs(next, ctx) as QueryExpr;
		return marked === ast ? ast : freezeIR(marked);
	} catch {
		return ast;
	}
}

/** The TemplateExprInfo for a scalar-slot tag: its span + (when an identity is extractable)
 *  its provider key — ref/source from their literal names, macro from its call fields,
 *  var/env_var lexically, a bare set-bound variable from its RHS call. */
function exprInfoOf(tag: RelationTag, ctx: TagContext): TemplateExprInfo {
	if (tag.kind === "ref") return { span: tag.tagSpan, call: { name: "ref", args: [tag.model] } };
	if (tag.kind === "source") {
		return { span: tag.tagSpan, call: { name: "source", args: [tag.sourceName, tag.tableName] } };
	}
	if (tag.kind === "macro") return { span: tag.tagSpan, call: callOf(tag, ctx.text) };
	if (tag.kind === "var" || tag.kind === "env_var") {
		const m = VALUE_CALL_TAG.exec(sliceSpan(ctx.text, tag.tagSpan));
		if (m) {
			const args: (string | null)[] = [m[3]];
			if (m[4] !== undefined) args.push(null); // further args present but not extracted — computed
			return { span: tag.tagSpan, call: { name: m[1], args } };
		}
		return { span: tag.tagSpan };
	}
	const ident = bareIdentOf(tag, ctx.text);
	const resolved = ident !== undefined ? ctx.sets.get(ident) : undefined;
	if (resolved) return { span: tag.tagSpan, call: resolved.call };
	return { span: tag.tagSpan };
}

/** `{{ var('x') }}` / `{{ env_var('Y', …) }}` — the name + first literal arg, lexically. */
const VALUE_CALL_TAG = /^\{\{-?\s*(var|env_var)\s*\(\s*(['"])([^'"\\]*)\2\s*(,[\s\S]*?)?\)\s*(?:\|[\s\S]*)?-?\}\}$/;

/**
 * Rebuild (with structural sharing) marking every column-shaped node — a column Expr
 * (`kind: "column"`) or a scope ColumnRef record (`parts` + `clause`, no `kind`) — whose
 * first token sits inside a tag span. The walk is generic over plain objects/arrays,
 * never descends through the foreign antlr back-refs (`cst`/`aliasCst` keys), and
 * returns the SAME reference on unchanged subtrees. Total under the caller's try/catch.
 */
function markTemplateExprs(node: unknown, ctx: TagContext): unknown {
	if (Array.isArray(node)) {
		let changed = false;
		const out = node.map((v) => {
			const nv = markTemplateExprs(v, ctx);
			if (nv !== v) changed = true;
			return nv;
		});
		return changed ? out : node;
	}
	if (node === null || typeof node !== "object") return node;
	const rec = node as Record<string, unknown>;

	const isColumnExpr = rec.kind === "column";
	const isColumnRef = rec.kind === undefined && Array.isArray(rec.parts) && "clause" in rec;
	if ((isColumnExpr || isColumnRef) && rec.template === undefined) {
		const start = (rec.cst as { start?: { start: number } } | undefined)?.start?.start;
		if (start !== undefined) {
			const tag = containingTag(ctx.relTags, start);
			if (tag) return { ...rec, template: exprInfoOf(tag, ctx) };
		}
	}

	let changed = false;
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(rec)) {
		const v = rec[k];
		if (k === "cst" || k === "aliasCst") {
			out[k] = v;
			continue;
		}
		const nv = markTemplateExprs(v, ctx);
		out[k] = nv;
		if (nv !== v) changed = true;
	}
	return changed ? out : node;
}

// ---------------------------------------------------------------------------
// Literal {% set %} resolution — the never-wrong subset of jinja data flow.
//
// `{% set t = ref('stg_orders') %} … FROM {{ t }}` binds t's use site to the real
// model. Guards (each one sound on its own; together they make a wrong binding
// unreachable):
//   - the template defines NO inline `{% macro %}` (a macro PARAMETER could shadow
//     the name inside its body, and parameters are not surfaced on the tag AST);
//   - the name is declared by EXACTLY ONE `{% set %}` (two assignments — incl. the
//     if/else reassignment idiom — are ambiguous) and NO `{% for %}` target shadows it;
//   - the set's RHS is EXACTLY one literal `ref('x')` / `source('a','b')` call and
//     nothing else (a concat / conditional / member-navigation RHS does not resolve);
//   - the use tag is a BARE identifier (`{{ t }}`), nothing composed.
// Anything that fails a guard falls back to the opaque `"expr"` marker — degraded,
// never wrong.
// ---------------------------------------------------------------------------

/** Match a direct string-literal argument's raw text (no escapes, one token). */
const LITERAL_ARG = /^(['"])([^'"\\]*)\1$/;

/** The raw text of a span. */
function sliceSpan(text: string, span: PartSpan): string {
	return text.slice(span.start, span.end);
}

/** The literal string value of a MacroCall argument, or undefined when computed. */
function literalArg(text: string, call: MacroCall, i: number): string | undefined {
	const arg = call.args[i];
	if (!arg) return undefined;
	const m = LITERAL_ARG.exec(sliceSpan(text, arg.span).trim());
	return m ? m[2] : undefined;
}

/** A kwarg's raw text split: `name = rest`, with `rest`'s literal (or null when computed). */
const KWARG_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)([\s\S]*)$/;

/**
 * The provider key of a tag-AST MacroCall — name + package + literal args, with kwargs
 * carried separately (the channel-agreed TemplateCall contract: quote-stripped, escapes
 * NOT resolved, computed arguments null, kwargs never dropped).
 */
function callOf(mc: MacroCall, text: string): TemplateCall {
	const args: (string | null)[] = [];
	const kwargs: { name: string; value: string | null }[] = [];
	for (const arg of mc.args) {
		const raw = sliceSpan(text, arg.span).trim();
		const kw = KWARG_RE.exec(raw);
		if (kw) {
			const m = LITERAL_ARG.exec(kw[2].trim());
			kwargs.push({ name: kw[1], value: m ? m[2] : null });
		} else {
			const m = LITERAL_ARG.exec(raw);
			args.push(m ? m[2] : null);
		}
	}
	return {
		name: mc.name,
		...(mc.packageName !== undefined ? { packageParts: mc.packageName.split(".") } : {}),
		args,
		...(kwargs.length ? { kwargs } : {}),
	};
}

/**
 * The RHS of a `{% set name = … %}` control tag as a SetResolution, or undefined.
 * Requires the tag's call list to be exactly one call that IS the ENTIRE RHS: the
 * text between the declared name and the call is exactly `=`, and the text after
 * the call runs straight to the tag close (whitespace + optional `-%}`).
 * `ref('a') ~ '_x'` or `ref('a').identifier` therefore do not resolve. A literal
 * ref/source RHS resolves with its NAME (scope binds the real model); any other
 * single-call RHS resolves as a macro identity (the provider may know its relation).
 */
function setResolution(tag: ControlTag, text: string): SetResolution | undefined {
	if (tag.calls.length !== 1 || !tag.nameSpan) return undefined;
	const call = tag.calls[0];
	if (!call.argsSpan) return undefined;

	const callStart = call.packageSpan?.start ?? call.nameSpan.start;
	const callEnd = call.argsSpan.end;
	if (!/^\s*=\s*$/.test(text.slice(tag.nameSpan.end, callStart))) return undefined;
	if (!/^\s*-?%\}$/.test(text.slice(callEnd, tag.tagSpan.end))) return undefined;

	const tCall = callOf(call, text);
	if (call.packageName === undefined && call.name === "ref" && call.args.length === 1) {
		const model = literalArg(text, call, 0);
		return model !== undefined ? { kind: "ref", name: [model], call: tCall } : undefined;
	}
	if (call.packageName === undefined && call.name === "source" && call.args.length === 2) {
		const src = literalArg(text, call, 0);
		const tbl = literalArg(text, call, 1);
		return src !== undefined && tbl !== undefined
			? { kind: "source", name: [src, tbl], call: tCall }
			: undefined;
	}
	return { kind: "macro", call: tCall };
}

/** The template-wide map of resolvable set variables (empty when any guard trips globally). */
function resolveSets(tags: TagNode[], text: string): Map<string, SetResolution> {
	const empty = new Map<string, SetResolution>();
	const controls = tags.filter((t): t is ControlTag => t.kind === "control");
	if (controls.some((c) => c.keyword === "macro")) return empty; // param shadowing unknowable

	const forTargets = new Set(controls.filter((c) => c.keyword === "for" && c.name).map((c) => c.name as string));
	const counts = new Map<string, number>();
	const out = new Map<string, SetResolution>();
	for (const c of controls) {
		if (c.keyword !== "set" || !c.name) continue;
		counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
		const r = setResolution(c, text);
		if (r) out.set(c.name, r);
	}
	for (const [name] of out) {
		if ((counts.get(name) ?? 0) !== 1 || forTargets.has(name)) out.delete(name);
	}
	return out;
}

/** The bare identifier inside a `{{ t }}` expr tag, or undefined for anything composed. */
const BARE_IDENT_TAG = /^\{\{-?\s*([A-Za-z_][A-Za-z0-9_]*)\s*-?\}\}$/;

function bareIdentOf(tag: RelationTag, text: string): string | undefined {
	const m = BARE_IDENT_TAG.exec(sliceSpan(text, tag.tagSpan));
	return m ? m[1] : undefined;
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

/** Half-open containment: `offset` lies inside `span` ([start, end)). */
function inSpan(offset: number, span: PartSpan): boolean {
	return offset >= span.start && offset < span.end;
}

/** The first relation-tag whose `tagSpan` contains `offset` ([start, end)), or undefined. */
function containingTag(tags: readonly RelationTag[], offset: number): RelationTag | undefined {
	for (const t of tags) {
		if (inSpan(offset, t.tagSpan)) return t;
	}
	return undefined;
}

function transformQuery(q: QueryExpr, ctx: TagContext): QueryExpr {
	const ctes = mapShared(q.ctes, (c) => transformCte(c, ctx));
	const body = transformBody(q.body, ctx);
	if (ctes === q.ctes && body === q.body) return q;
	return { ...q, ctes, body };
}

function transformCte(cte: CteDef, ctx: TagContext): CteDef {
	const body = transformQuery(cte.body, ctx);
	return body === cte.body ? cte : { ...cte, body };
}

function transformBody(body: QueryBody, ctx: TagContext): QueryBody {
	if (body.kind === "select") return transformSelect(body, ctx);
	if (body.kind === "setop") return transformSetOp(body, ctx);
	if (body.kind === "pipe") return transformPipe(body, ctx);
	return body;
}

function transformSelect(sel: SelectExpr, ctx: TagContext): SelectExpr {
	// Transform the FROM sources, tracking old→new so `joins` (whose `source` is
	// reference-identical to a `from` entry — the documented invariant) stays aligned.
	const srcMap = new Map<Source, Source>();
	const from = mapShared(sel.from, (s) => {
		const n = transformSource(s, ctx);
		if (n !== s) srcMap.set(s, n);
		return n;
	});

	// Expression subqueries (scalar / IN / EXISTS) — scope reads these as child scopes.
	const subqueries = sel.subqueries ? mapShared(sel.subqueries, (q) => transformQuery(q, ctx)) : sel.subqueries;

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

function transformSetOp(so: SetOpExpr, ctx: TagContext): SetOpExpr {
	const left = transformBody(so.left, ctx);
	const right = transformBody(so.right, ctx);
	if (left === so.left && right === so.right) return so;
	return { ...so, left, right };
}

function transformPipe(pe: PipeExpr, ctx: TagContext): PipeExpr {
	const input = transformBody(pe.input, ctx);
	const stages = transformStages(pe.stages, ctx);
	if (input === pe.input && stages === pe.stages) return pe;
	return { ...pe, input, stages };
}

function transformStages(stages: readonly PipeStage[], ctx: TagContext): PipeStage[] {
	return mapShared(stages, (s) => transformStage(s, ctx));
}

function transformStage(stage: PipeStage, ctx: TagContext): PipeStage {
	switch (stage.op) {
		case "join": {
			const source = transformSource(stage.source, ctx);
			return source === stage.source ? stage : { ...stage, source };
		}
		case "setop": {
			const operands = mapShared(stage.operands, (q) => transformQuery(q, ctx));
			return operands === stage.operands ? stage : { ...stage, operands };
		}
		case "recursiveUnion": {
			const operand = transformQuery(stage.operand, ctx);
			return operand === stage.operand ? stage : { ...stage, operand };
		}
		case "with": {
			const ctes = mapShared(stage.ctes, (c) => transformCte(c, ctx));
			return ctes === stage.ctes ? stage : { ...stage, ctes };
		}
		case "if": {
			const arms = mapShared(stage.arms, (a) => transformBranch(a, ctx));
			return arms === stage.arms ? stage : { ...stage, arms };
		}
		case "fork":
		case "tee": {
			const branches = mapShared(stage.branches, (b) => transformStages(b, ctx));
			return branches === stage.branches ? stage : { ...stage, branches };
		}
		case "log": {
			if (!stage.pipeline) return stage;
			const pipeline = transformStages(stage.pipeline, ctx);
			return pipeline === stage.pipeline ? stage : { ...stage, pipeline };
		}
		default:
			return stage;
	}
}

function transformBranch(arm: PipeBranch, ctx: TagContext): PipeBranch {
	const pipeline = transformStages(arm.pipeline, ctx);
	return pipeline === arm.pipeline ? arm : { ...arm, pipeline };
}

function transformSource(source: Source, ctx: TagContext): Source {
	if (source.kind === "subquery") {
		const query = transformQuery(source.query, ctx);
		return query === source.query ? source : { ...source, query };
	}
	if (source.kind === "table") return transformTableSource(source, ctx);
	// lateral / graphtable carry no inner QueryExpr field in the IR — nothing to walk.
	return source;
}

/** Drop `alias` + `aliasCst` from a table source (returns a copy without those fields). */
function withoutAlias(src: TableSource): TableSource {
	const { alias: _alias, aliasCst: _aliasCst, ...rest } = src;
	return rest;
}

function transformTableSource(src: TableSource, ctx: TagContext): TableSource {
	const startTok = src.cst?.start;
	if (!startTok) return src;
	const tag = containingTag(ctx.relTags, startTok.start);
	if (!tag) return src;

	// A placeholder-fill alias sits INSIDE the tag span: a multi-line tag fills one
	// identifier per line, and the second line is consumed as the alias slot at parse
	// time. Drop it — else the fabricated `jjj…` becomes the scope BINDING KEY
	// (src/scope/scope.ts sourceKey prefers alias over name), shadowing the real model
	// name set below. A real user alias (`{{ ref('x') }} o`) always sits AFTER `}}`
	// (offset >= tagSpan.end), so it is never dropped. BOUNDARY: a multi-line tag WITH
	// a trailing user alias loses that real alias at parse time (an inc1 placeholder-
	// fill limitation, out of apply-tags' reach); making it `undefined` here is honest,
	// where `jjj…` was a fabrication.
	const aliasTok = src.aliasCst?.start;
	const base = aliasTok != null && inSpan(aliasTok.start, tag.tagSpan) ? withoutAlias(src) : src;

	// NOTE: `template.span` intentionally aliases `tag.tagSpan` BY REFERENCE. freezeIR
	// therefore also freezes the TagNode.tagSpan object returned in `.tags` — benign,
	// since spans are read-only. Every marker with a resolvable identity carries its
	// `call` — the provider key the semantic layer consults (relation-columns.ts).
	if (tag.kind === "ref") {
		const call: TemplateCall = { name: "ref", args: [tag.model] };
		const template: TemplateSourceInfo = { kind: "ref", span: tag.tagSpan, call };
		return { ...base, name: [tag.model], template };
	}
	if (tag.kind === "source") {
		const call: TemplateCall = { name: "source", args: [tag.sourceName, tag.tableName] };
		const template: TemplateSourceInfo = { kind: "source", span: tag.tagSpan, call };
		return { ...base, name: [tag.sourceName, tag.tableName], template };
	}
	if (tag.kind === "macro") {
		// A macro in a FROM slot keeps the placeholder name (never fabricated) but is no
		// longer a dead end: its `call` lets a provider resolve the relation it produces
		// (a TVF-like macro). Without a provider answer it behaves exactly like the old
		// opaque marker (exemption, no diagnostics).
		const template: TemplateSourceInfo = { kind: "macro", span: tag.tagSpan, call: callOf(tag, ctx.text) };
		return { ...base, template };
	}

	// Non-call expression tag (var / env_var / other) in a FROM slot. A bare `{{ t }}`
	// resolving through a `{% set t = … %}` single-call RHS binds the real model
	// (ref/source) or carries the call identity (macro); everything else gets the opaque
	// "expr" marker — either way the placeholder name stops posing as a real table.
	const ident = tag.kind === "other" ? bareIdentOf(tag, ctx.text) : undefined;
	const resolved = ident !== undefined ? ctx.sets.get(ident) : undefined;
	if (resolved && resolved.kind !== "macro") {
		const template: TemplateSourceInfo = {
			kind: resolved.kind,
			span: tag.tagSpan,
			indirect: true,
			call: resolved.call,
		};
		return { ...base, name: [...resolved.name], template };
	}
	if (resolved) {
		// set-var bound to a non-ref/source call: macro semantics at the use site.
		const template: TemplateSourceInfo = {
			kind: "macro",
			span: tag.tagSpan,
			indirect: true,
			call: resolved.call,
		};
		return { ...base, template };
	}
	const template: TemplateSourceInfo = { kind: "expr", span: tag.tagSpan, opaque: true };
	return { ...base, template };
}
