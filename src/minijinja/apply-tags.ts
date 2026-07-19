// ---------------------------------------------------------------------------
// R3: a templated call in a FROM slot as a first-class TableSource node (inc2).
//
// `{{ ref('x') }}` / `{{ source('a','b') }}` / a macro call in a FROM/JOIN slot lowers, via the
// placeholder mechanism, to an ordinary `TableSource` whose `name` is the raw placeholder identifier
// (PLACEHOLDER_CHAR-filled runs like `jjj…` from segment.ts). This POST-LOWER transform rewrites those
// sources so `name` carries the provider-resolved relation name and attaches a `template` marker, so
// scope/qualify/lineage see the relation, not the placeholder (scope binds a TableSource purely by
// `name`, so the whole downstream pipeline works UNCHANGED).
//
// Correlation is by CONTAINMENT, not equality: a `TableSource` correlates with a tag when the char
// offset of its FIRST NAME TOKEN (`cst.start.start`) lies inside the tag's `tagSpan` [start, end).
// Containment (not equality) because a multi-line expr tag fills ONE placeholder identifier per line,
// so the name token covers only the first line but its offset still sits inside the whole-tag span.
//
// The tag AST is NEUTRAL (a call is a call), and so is the naming: this transform asks the
// TemplateProvider for a call's relation (`provider.relationOf`) and carries no ref/source vocabulary
// itself. The NEUTRAL provider answers nothing, so a bare parse leaves calls opaque; a
// DbtTemplateProvider names ref/source. Naming is never-wrong: a resolved name comes from the call's
// literal args, and a call whose relation the provider does not resolve takes the RAW TAG TEXT as its
// name ({{ ref('m') }} verbatim) and stays opaque. We NEVER fabricate a name — in particular the
// placeholder fill (scaffolding this library invented) never escapes as one (issue #35).
//
// The IR is frozen after lower(); this transform REBUILDS with STRUCTURAL SHARING (new objects only on
// changed paths, an unchanged subtree keeps its original already-frozen reference) and re-freezes the
// rebuilt tree. It NEVER mutates a frozen node. Total: never throws, on any internal surprise it
// returns the input `ast` unchanged.
// ---------------------------------------------------------------------------

import { debugRethrow } from "../debug.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, synthesizedQualifiedName, type QualifiedNameConfig } from "../ir/qualified-name.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
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
import type { TemplateCall, TemplateProvider } from "../qualify/template-provider.js";
import type { MacroCall, TagNode } from "./tag-ast.js";

/** The tag kinds that can occupy a FROM slot: a CALL (`ref`/`source`/a macro/…) or a non-call
 *  expression tag (`other` — a bare variable or arbitrary expression). The latter gets the opaque
 *  `"expr"` marker (or resolves through a literal `{% set %}`, see `SetResolution`), so a placeholder
 *  name never reaches qualify/hover as if it were a real table. */
type ExprTag = Extract<TagNode, { kind: "other" }>;
type CallTag = Extract<TagNode, { kind: "call" }>;
type RelationTag = CallTag | ExprTag;
type ControlTag = Extract<TagNode, { kind: "control" }>;

/** What a template-local variable is known to hold: the resolved relation `name` (present only when
 *  the provider resolves the single-call RHS), always with the `call` identity the provider keys on. */
interface SetResolution {
	name?: string[];
	call: TemplateCall;
}

/** Everything transformTableSource needs, threaded once. */
interface TagContext {
	relTags: RelationTag[];
	sets: ReadonlyMap<string, SetResolution>;
	text: string;
	/** The dialect's namespace config (from `ast.dialect` via the behavior registry) — a renamed
	 *  source rebuilds `relation` so it never drifts from `name`. Absent only on an untagged ast
	 *  (never the parseTemplated path); then a rename keeps the source's original relation. */
	nameConfig?: QualifiedNameConfig;
	/** Names a call's relation (ref/source/a TVF-like macro). The NEUTRAL provider knows no macro
	 *  vocabulary, so a bare parse leaves calls opaque; a DbtTemplateProvider names ref/source. */
	provider: TemplateProvider;
	/** Collected at every `template`-attach site (Task 10): the two-spine join, direct
	 *  and unambiguous — replaces the span-containment correlation a consumer would
	 *  otherwise have to redo itself. */
	byNode: WeakMap<object, TagNode>;
	byTag: Map<TagNode, object>;
}

/** The rebuilt AST plus the tag↔node correlations collected while building it. */
export interface TagCorrelation {
	ast: QueryExpr;
	/** IR node → the TagNode it came from (a template-marked TableSource, or a marked column expr). */
	byNode: WeakMap<object, TagNode>;
	/** TagNode → the IR node it became (undefined-by-absence for tags with no IR presence). */
	byTag: Map<TagNode, object>;
}

/** Record a freshly built node's correlation to the tag it came from, then return it unchanged
 *  (a passthrough so call sites stay expression-shaped). A scalar-slot tag lowers to BOTH a
 *  column Expr (`kind: "column"`) and a parallel ColumnRef record (`kind: "columnref"`, same
 *  `cst`) — both attach here, but `byTag` (the tag's ONE answer, per `nodeOf`'s contract) keeps
 *  the column Expr: never downgrade an already-recorded "column" to a "columnref", regardless
 *  of which one this walk visits first. */
function attach<T extends object>(ctx: TagContext, node: T, tag: RelationTag): T {
	ctx.byNode.set(node, tag);
	const existing = ctx.byTag.get(tag) as { kind?: string } | undefined;
	if (existing?.kind !== "column") ctx.byTag.set(tag, node);
	return node;
}

/**
 * Rewrite templated FROM/JOIN sources in `ast` to carry their provider-resolved name (when the
 * provider resolves the call) plus a `template` marker, correlating each source to a tag by span
 * containment. Returns the SAME `ast` reference when nothing correlates (structural sharing);
 * returns a re-frozen rebuilt tree otherwise. Total, never throws; the correlation maps are empty
 * (not absent) on the no-op and error paths.
 */
export function applyTemplateTags(
	ast: QueryExpr,
	tags: TagNode[],
	text: string,
	provider: TemplateProvider,
): TagCorrelation {
	const byNode = new WeakMap<object, TagNode>();
	const byTag = new Map<TagNode, object>();
	try {
		// config is a no-output tag (whitespace-filled), so it can never yield a table
		// source and stays out of the correlation set even though ExprTag admits it.
		// An incomplete/mid-typing call (`{{ ref('cu`) is NOT a resolved source, so skip it.
		const relTags = tags.filter(
			(t): t is RelationTag => (t.kind === "call" && !t.incomplete) || t.kind === "other",
		);
		if (relTags.length === 0) return { ast, byNode, byTag };
		const nameConfig = ast.dialect !== undefined ? resolveBehavior(ast.dialect).nameConfig : undefined;
		const ctx: TagContext = {
			relTags,
			sets: resolveSets(tags, text, provider),
			text,
			provider,
			byNode,
			byTag,
			...(nameConfig ? { nameConfig } : {}),
		};
		const next = transformQuery(ast, ctx);
		// Scalar-slot marking: every column-shaped node whose token is a tag's placeholder
		// fill gets a `template` marker (span + provider key), so inference resolves it
		// through the provider and qualify never checks the placeholder as a real column.
		const marked = markTemplateExprs(next, ctx) as QueryExpr;
		return { ast: marked === ast ? ast : freezeIR(marked), byNode, byTag };
	} catch (e) {
		debugRethrow(e);
		return { ast, byNode: new WeakMap(), byTag: new Map() };
	}
}

/** The TemplateExprInfo for a scalar-slot tag: its span + (when an identity is extractable)
 *  its provider key — ref/source from their literal names, macro from its call fields,
 *  var/env_var lexically, a bare set-bound variable from its RHS call. */
function exprInfoOf(tag: RelationTag, ctx: TagContext): TemplateExprInfo {
	// A call tag (ref/source/var/env_var/a macro) carries its provider key straight off the call,
	// callOf reads name + literal args from the source, uniform across every callee.
	if (tag.kind === "call") return { span: tag.tagSpan, call: callOf(tag, ctx.text) };
	// A non-call `other` tag: a bare `{{ t }}` resolving through a single-call `{% set t = … %}`
	// carries that RHS call; anything else is opaque.
	const ident = bareIdentOf(tag, ctx.text);
	const resolved = ident !== undefined ? ctx.sets.get(ident) : undefined;
	if (resolved) return { span: tag.tagSpan, call: resolved.call };
	return { span: tag.tagSpan };
}

/** `{{ var('x') }}` / `{{ env_var('Y', …) }}` — the name + first literal arg, lexically. */
const VALUE_CALL_TAG = /^\{\{-?\s*(var|env_var)\s*\(\s*(['"])([^'"\\]*)\2\s*(,[\s\S]*?)?\)\s*(?:\|[\s\S]*)?-?\}\}$/;

/**
 * Rebuild (with structural sharing) marking every column-shaped node — a column Expr
 * (`kind: "column"`) or a scope ColumnRef record (`kind: "columnref"`) — whose
 * first token sits inside a tag span. The walk is generic over plain objects/arrays,
 * never descends through a foreign antlr back-ref (`cst`, or any `*Cst`-suffixed key —
 * `aliasCst`/`nameCst`/`variableCst`/any future one; matched by naming convention, not an
 * enumerated list, so a new IR field carrying a raw CST node can never silently reintroduce
 * this same stack-overflow-then-swallowed-by-the-caller's-try/catch failure), and returns the
 * SAME reference on unchanged subtrees. Total under the caller's try/catch.
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
	const isColumnRef = rec.kind === "columnref";
	if ((isColumnExpr || isColumnRef) && rec.template === undefined) {
		const start = (rec.cst as { start?: { start: number } } | undefined)?.start?.start;
		if (start !== undefined) {
			const tag = containingTag(ctx.relTags, start);
			if (tag) return attach(ctx, { ...rec, template: exprInfoOf(tag, ctx) }, tag);
		}
	}

	let changed = false;
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(rec)) {
		const v = rec[k];
		if (k === "cst" || k.endsWith("Cst")) {
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
/** A literal argument's value: a quoted string (quote-stripped) or a bare numeric literal —
 *  both are the user's own text, never computed. Everything else stays `null` (computed). */
const LITERAL_ARG = /^(?:(['"])([^'"\\]*)\1|(-?\d+(?:\.\d+)?))$/;
const literalValueOf = (m: RegExpExecArray): string => m[2] ?? m[3]!;

/** The raw text of a span. */
function sliceSpan(text: string, span: PartSpan): string {
	return text.slice(span.start, span.end);
}

/** A kwarg's raw text split: `name = rest`, with `rest`'s literal (or null when computed). */
const KWARG_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)([\s\S]*)$/;

/**
 * The provider key of a tag-AST MacroCall — name + package + literal args, with kwargs
 * carried separately (the channel-agreed TemplateCall contract: quote-stripped, escapes
 * NOT resolved, computed arguments null, kwargs never dropped).
 */
export function callOf(mc: MacroCall, text: string): TemplateCall {
	const args: (string | null)[] = [];
	const kwargs: { name: string; value: string | null }[] = [];
	for (const arg of mc.args) {
		const raw = sliceSpan(text, arg.span).trim();
		const kw = KWARG_RE.exec(raw);
		if (kw) {
			const m = LITERAL_ARG.exec(kw[2].trim());
			kwargs.push({ name: kw[1], value: m ? literalValueOf(m) : null });
		} else {
			const m = LITERAL_ARG.exec(raw);
			args.push(m ? literalValueOf(m) : null);
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
 * `ref('a') ~ '_x'` or `ref('a').identifier` therefore do not resolve. When the provider resolves the
 * call's relation, the set carries that NAME (scope binds the real relation); otherwise it carries the
 * call identity only, and the provider may still resolve its relation at the use site.
 */
function setResolution(tag: ControlTag, text: string, provider: TemplateProvider): SetResolution | undefined {
	if (tag.calls.length !== 1 || !tag.nameSpan) return undefined;
	const call = tag.calls[0];
	if (!call.argsSpan) return undefined;

	const callStart = call.packageSpan?.start ?? call.nameSpan.start;
	const callEnd = call.argsSpan.end;
	if (!/^\s*=\s*$/.test(text.slice(tag.nameSpan.end, callStart))) return undefined;
	if (!/^\s*-?%\}$/.test(text.slice(callEnd, tag.tagSpan.end))) return undefined;

	const tCall = callOf(call, text);
	const rel = provider.relationOf(tCall);
	return rel ? { name: [...rel.nameParts], call: tCall } : { call: tCall };
}

/** The template-wide map of resolvable set variables (empty when any guard trips globally). */
function resolveSets(tags: TagNode[], text: string, provider: TemplateProvider): Map<string, SetResolution> {
	const empty = new Map<string, SetResolution>();
	const controls = tags.filter((t): t is ControlTag => t.kind === "control");
	if (controls.some((c) => c.keyword === "macro")) return empty; // param shadowing unknowable

	const forTargets = new Set(controls.filter((c) => c.keyword === "for" && c.name).map((c) => c.name as string));
	const counts = new Map<string, number>();
	const out = new Map<string, SetResolution>();
	for (const c of controls) {
		if (c.keyword !== "set" || !c.name) continue;
		counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
		const r = setResolution(c, text, provider);
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

	// An unresolved source's name is the RAW TAG TEXT — the bytes the user actually wrote. The
	// placeholder fill is scaffolding this library invented so the grammar parses; letting it
	// escape as a relation name (scope sources, lineage dependencies, go-to-def) is fabrication
	// under the never-wrong rule (issue #35, reported by anvil).
	const rawTagName = [ctx.text.slice(tag.tagSpan.start, tag.tagSpan.end)];

	// Renaming a source rebuilds `relation` (#38): a provider-resolved name is SYNTHESIZED (plain
	// logical parts, quoted where rendering needs it); the raw-tag-text fallback is source text.
	// Without a dialect tag on the ast (never the parseTemplated path) the source keeps its
	// original relation — the documented degrade.
	const renamed = (b: TableSource, parts: string[], synthesized: boolean): TableSource => {
		if (!ctx.nameConfig) return b;
		const relation = synthesized
			? synthesizedQualifiedName(parts, ctx.nameConfig)
			: qualifiedNameOf(parts, ctx.nameConfig);
		return { ...b, relation };
	};

	// NOTE: `template.span` intentionally aliases `tag.tagSpan` BY REFERENCE. freezeIR
	// therefore also freezes the TagNode.tagSpan object returned in `.tags`, benign
	// since spans are read-only. Every call marker carries its `call`, the provider key
	// the semantic layer resolves the relation and its columns through (relation-columns.ts).
	if (tag.kind === "call") {
		const call = callOf(tag, ctx.text);
		const rel = ctx.provider.relationOf(call);
		// A call in a FROM slot (ref/source/a TVF-like macro). When the provider resolves its
		// relation, carry the resolved name; otherwise the raw tag text (never the fill).
		// Either way the `call` keeps it consultable, so an unresolved call is not a dead end: a
		// provider added later resolves it. ref vs source is not stored here, it is call.name.
		const named = rel ? renamed(base, [...rel.nameParts], true) : renamed(base, rawTagName, false);
		const template: TemplateSourceInfo = { kind: "call", span: tag.tagSpan, call };
		return attach(ctx, { ...named, template }, tag);
	}

	// Non-call expression tag (var / env_var / other) in a FROM slot. A bare `{{ t }}` resolving
	// through a `{% set t = … %}` single-call RHS carries the resolved relation name (when the
	// provider resolved it) or the call identity alone; every other case gets the opaque "expr"
	// marker. In every unresolved case the name is the raw tag text, never the fill.
	const ident = tag.kind === "other" ? bareIdentOf(tag, ctx.text) : undefined;
	const resolved = ident !== undefined ? ctx.sets.get(ident) : undefined;
	if (resolved) {
		const named = resolved.name ? renamed(base, [...resolved.name], true) : renamed(base, rawTagName, false);
		const template: TemplateSourceInfo = { kind: "call", span: tag.tagSpan, indirect: true, call: resolved.call };
		return attach(ctx, { ...named, template }, tag);
	}
	const template: TemplateSourceInfo = { kind: "expr", span: tag.tagSpan, opaque: true };
	return attach(ctx, { ...renamed(base, rawTagName, false), template }, tag);
}
