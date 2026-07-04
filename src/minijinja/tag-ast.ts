// ---------------------------------------------------------------------------
// Task 4 — R2 tag-AST: ref / source / macro-call nodes with the EXACT span
// contract (docs/minijinja-front-end.md §R2). This is the HARD deliverable: the
// dbt-anvil extension positions hover / rename / signature-help exactly on the
// spans emitted here, so every offset must be document-true.
//
// The walk is a small tree-navigation over the per-tag jinja parse tree (Task 1
// grammar, parsed by parse-tag.ts's parseMinijinjaTag). The tree is TAG-RELATIVE
// (offset 0 = the tag's opening `{`); every span is shifted into DOCUMENT
// coordinates by the tag's document start (`seg.start`), and line/column are
// composed with the tag's document anchor (`base`) so a MULTI-LINE tag carries a
// correct multi-line PartSpan — the parity UPGRADE over the extension's
// single-line-lossy regex extractors.
//
// Classification is by the LEADING call name (§R2 / §the hole):
//   - a bare `ref(...)`             → ref node    (model = last positional string)
//   - a bare `source(...)`          → source node (source + table, both strings)
//   - a bare `var(...)`/`env_var(…)`→ that node kind
//   - a leading NO_OUTPUT_BUILTIN   → config → "config"; the rest → "other"
//     (config/docs/print/log/return/exceptions — REUSES segment.ts's set, the
//      single source of truth; `exceptions.raise_compiler_error(…)` classifies
//      off the leading `exceptions` too)
//   - `pkg.macro(...)` or a bare unknown call → macro node
//   - any other expr (bare name, literal, arithmetic) → "other"
//   - a `{% … %}` statement tag     → "control" (inc1 treatment; precise
//     if/for/set structure + `{% do macro() %}` macro-in-stmt is inc2)
//   - a `{# … #}` comment tag       → "other"
//
// Never-wrong (global-constraints): a ref/source node is emitted only when its
// required string args are actually present; a broken `{{ ref( }}` degrades to a
// macro node (name = "ref") + the parse's positioned diagnostic, never a ref
// node with a fabricated modelSpan and never a throw.
// ---------------------------------------------------------------------------

import { ParserRuleContext, TerminalNode, type ParseTree, type Token as AntlrToken } from "antlr4ng";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import {
	Arg_listContext,
	CallExprContext,
	MemberExprContext,
	NameExprContext,
	StmtContext,
} from "../generated/minijinja/MinijinjaParser.js";
import type { PartSpan } from "../ir/part-span.js";
import { NO_OUTPUT_BUILTINS, type Segment } from "./segment.js";

/** A tag segment (the `kind: "tag"` arm of Segment). */
type TagSegment = Extract<Segment, { kind: "tag" }>;

/**
 * The reusable call fields the extension consumes for signature-help / hover — the
 * macro TagNode's fields minus `kind`/`tagSpan`. A `{{ }}` macro node IS a
 * MacroCall + kind/tagSpan; a `{% %}` control tag carries an array of them
 * (`calls`). Every field comes only from real identifier tokens (never-wrong): a
 * computed / dynamic callee yields no MacroCall.
 */
export interface MacroCall {
	name: string;
	nameSpan: PartSpan;
	packageName?: string;
	packageSpan?: PartSpan;
	argsSpan?: PartSpan;
	args: { span: PartSpan }[];
}

/** Document line (1-based) / column (0-based) of the tag's start offset — the anchor. */
export interface DocPos {
	line: number;
	column: number;
}

/**
 * R2 tag-AST node. The ref/source/macro arms carry the span contract the
 * extension positions on; the last arm classifies everything else by kind.
 * Spans are PartSpan in DOCUMENT coordinates (1-based line, 0-based column,
 * 0-based offsets — sqllens convention).
 */
export type TagNode =
	| { kind: "ref"; model: string; modelSpan: PartSpan; callSpan: PartSpan; tagSpan: PartSpan }
	| {
			kind: "source";
			sourceName: string;
			tableName: string;
			sourceNameSpan: PartSpan;
			tableNameSpan: PartSpan;
			/** Span of the whole `source(…)` call — the sibling of `ref`'s `callSpan`; the extension hit-tests the bare `source` identifier / call on it. */
			callSpan: PartSpan;
			tagSpan: PartSpan;
	  }
	| {
			kind: "macro";
			name: string;
			nameSpan: PartSpan;
			packageName?: string;
			packageSpan?: PartSpan;
			tagSpan: PartSpan;
			argsSpan?: PartSpan;
			args: { span: PartSpan }[];
			/**
			 * Every macro CALL in the expression, in source order, EACH as its own
			 * MacroCall — symmetric to `control.calls` (C1). A NESTED `outer(inner())`
			 * yields BOTH (outer before inner); sibling calls `a() + b()` yield both in
			 * textual order. A computed / dynamic callee is skipped, never fabricated.
			 * Additive: `calls[0]` is the top-level call (same identifier as the node's
			 * own `name`/`args`), the rest are nested — the node's top-level fields
			 * (name/nameSpan/args/…) are unchanged. So the extension consumes `calls[]`
			 * uniformly for control AND macro nodes.
			 */
			calls: MacroCall[];
	  }
	| {
			kind: "control";
			tagSpan: PartSpan;
			/** The statement lead, lowercased (`if`/`elif`/`else`/`endif`/`for`/`endfor`/`set`/`macro`/`endmacro`/… or an unknown dbt-custom lead). Absent on a lead-less/degenerate tag. */
			keyword?: string;
			/** The declared name — `set` target / `macro` name / `for` loop variable. LITERAL identifier only (never-wrong); absent for the other keywords. */
			name?: string;
			/** Token-exact span of `name` (excludes nothing — it is the bare identifier). */
			nameSpan?: PartSpan;
			/**
			 * Every macro CALL embedded in the statement body, in source order, EACH as
			 * its own MacroCall (C1). `{% set x = a() + b() %}` → two; a NESTED
			 * `outer(inner())` yields BOTH (outer before inner). A computed / dynamic
			 * callee is skipped, never fabricated. `[]` when the tag has no call
			 * (`{% if x %}`, `{% endif %}`). Additive — `keyword`/`name`/`nameSpan` are
			 * unchanged.
			 */
			calls: MacroCall[];
	  }
	| { kind: "var" | "env_var" | "config" | "other"; tagSpan: PartSpan };

// ---------------------------------------------------------------------------
// Span helpers — the doc-offset math. A token's tag-relative start/stop offsets
// are shifted by `docOffset`; its line/column composed with `base`: a token on
// the tag's FIRST line adds the anchor column, a token on a LATER line already
// sits at its own absolute column (line starts reset the column). Mirrors
// parse.ts's mapMinijinjaToken exactly.
// ---------------------------------------------------------------------------

function docLineCol(tok: AntlrToken, base: DocPos): { line: number; column: number } {
	return {
		line: base.line + (tok.line - 1),
		column: tok.line === 1 ? base.column + tok.column : tok.column,
	};
}

/** Span from a first + last token (inclusive stop → exclusive end). */
function spanFromTokens(a: AntlrToken, b: AntlrToken, docOffset: number, base: DocPos): PartSpan {
	const lc = docLineCol(a, base);
	return { start: docOffset + a.start, end: docOffset + b.stop + 1, line: lc.line, column: lc.column };
}

/** Span of a rule context (its start..stop tokens), or undefined if it has none. */
function spanOfNode(node: ParserRuleContext, docOffset: number, base: DocPos): PartSpan | undefined {
	const s = node.start;
	const e = node.stop;
	if (!s || !e) return undefined;
	return spanFromTokens(s, e, docOffset, base);
}

/**
 * Quote-EXCLUDED span of a STRING token: `'my_model'` → covers `my_model`. The
 * content starts one char past the opening quote and ends one char before the
 * closing quote.
 */
function stringContentSpan(t: AntlrToken, docOffset: number, base: DocPos): PartSpan {
	const line = base.line + (t.line - 1);
	const column = t.line === 1 ? base.column + t.column + 1 : t.column + 1;
	// t.start = opening quote, t.stop = closing quote (inclusive). Content is
	// [start+1, stop-1]; exclusive end = docOffset + (stop-1) + 1 = docOffset + stop.
	return { start: docOffset + t.start + 1, end: docOffset + t.stop, line, column };
}

/** The value of a STRING token with its surrounding quotes stripped. */
function stringValue(t: AntlrToken): string {
	const text = t.text ?? "";
	return text.length >= 2 ? text.slice(1, -1) : "";
}

// ---------------------------------------------------------------------------
// Tree navigation.
// ---------------------------------------------------------------------------

/**
 * The topmost call in a subtree — the whole-expression call for `ref('x')`,
 * `pkg.macro(a, nested(b))`, `outer(inner())` (outer is found first, being
 * higher in the tree). DFS returns the leftmost-topmost CallExprContext.
 */
function findTopCall(node: ParseTree | null | undefined): CallExprContext | undefined {
	if (!node) return undefined;
	if (node instanceof CallExprContext) return node;
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) {
			const found = findTopCall(node.getChild(i));
			if (found) return found;
		}
	}
	return undefined;
}

/**
 * EVERY CallExprContext in a subtree, in source order (pre-order DFS). Unlike
 * `findTopCall` this does NOT stop at the topmost call: a NESTED `outer(inner())`
 * yields BOTH (outer visited before inner, pre-order), and sibling calls
 * `a() + b()` yield both in textual order. The R2/C1 control-tag extraction walks
 * the whole `stmt` body with this so every embedded call is surfaced.
 */
function findAllCalls(node: ParseTree | null | undefined, out: CallExprContext[] = []): CallExprContext[] {
	if (!node) return out;
	if (node instanceof CallExprContext) out.push(node);
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) findAllCalls(node.getChild(i), out);
	}
	return out;
}

/** The `stmt` context of a statement tag's parse tree (DFS, leftmost). */
function findStmt(node: ParseTree | null | undefined): StmtContext | undefined {
	if (!node) return undefined;
	if (node instanceof StmtContext) return node;
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) {
			const found = findStmt(node.getChild(i));
			if (found) return found;
		}
	}
	return undefined;
}

/**
 * The first `NameExprContext` in pre-order (leftmost identifier reference). For a
 * `stmt` body the keyword lead is a KeywordContext (not a NameExpr), so this
 * returns the FIRST real name after the keyword: `set x = …` → `x`, `for row in …`
 * → `row`, `macro build(a,b) %}` → `build` (the callee, visited before its args).
 */
function firstNameExpr(node: ParseTree | null | undefined): NameExprContext | undefined {
	if (!node) return undefined;
	if (node instanceof NameExprContext) return node;
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) {
			const found = firstNameExpr(node.getChild(i));
			if (found) return found;
		}
	}
	return undefined;
}

/** The leftmost identifier of a callee path (`pkg` in `pkg.macro`, `ref` in `ref`). */
function leftmostName(p: ParseTree | null | undefined): string | undefined {
	if (p instanceof NameExprContext) return p.id().getText();
	if (p instanceof MemberExprContext) return leftmostName(p.primary());
	if (p instanceof CallExprContext) return leftmostName(p.primary());
	return undefined;
}

/**
 * The STRING token of an argument ONLY when the argument's DIRECT expression is a
 * bare string literal — i.e. the whole arg is a single STRING token (`'x'` /
 * `"x"`). A computed arg (`var('x')`, `'a' ~ b`, `1 + 'x'`) returns undefined:
 * its target is dynamic, so a ref/source must NOT fabricate a literal model from
 * a string buried inside it (never-wrong — a fabricated model/modelSpan is a node
 * the extension would wrongly position hover/rename on). A single-token arg has
 * `start === stop`; anything with a call/operator wrapping the string does not.
 */
function directStringToken(arg: ParserRuleContext): AntlrToken | undefined {
	const s = arg.start;
	const e = arg.stop;
	if (s && s === e && s.type === MinijinjaParser.STRING) return s;
	return undefined;
}

/** Positional-argument contexts in source order (excludes kwargs). */
function positionalArgs(argList: Arg_listContext | null): ParserRuleContext[] {
	if (!argList) return [];
	// PosargContext is `expr`; KwargContext is `id = expr`. A posarg has no
	// ASSIGN child, so its whole span descends to the expr. We keep the arg ctx.
	return argList.arg().filter((a): a is ParserRuleContext => a.getChildCount() > 0 && !isKwarg(a));
}

/** A kwarg (`k=v`) has an ASSIGN terminal as its second child; a posarg does not. */
function isKwarg(arg: ParserRuleContext): boolean {
	for (let i = 0; i < arg.getChildCount(); i++) {
		const c = arg.getChild(i);
		if (c instanceof TerminalNode && c.symbol.type === MinijinjaParser.ASSIGN) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Callee decomposition — name + optional package, with spans.
// ---------------------------------------------------------------------------

interface Callee {
	name: string;
	nameSpan: PartSpan | undefined;
	packageName?: string;
	packageSpan?: PartSpan;
	/** The leftmost identifier of the path (drives NO_OUTPUT / ref classification). */
	leading: string;
}

function decomposeCallee(call: CallExprContext, docOffset: number, base: DocPos): Callee | undefined {
	const callee = call.primary();
	if (callee instanceof MemberExprContext) {
		// pkg.macro(...) — the id is the macro name; the primary prefix is the package.
		const idNode = callee.id();
		const prefix = callee.primary();
		const name = idNode.getText();
		const nameSpan = spanOfNode(idNode, docOffset, base);
		const packageName = prefix.getText();
		const packageSpan = spanOfNode(prefix, docOffset, base);
		return { name, nameSpan, packageName, packageSpan, leading: leftmostName(prefix) ?? packageName };
	}
	if (callee instanceof NameExprContext) {
		const idNode = callee.id();
		const name = idNode.getText();
		return { name, nameSpan: spanOfNode(idNode, docOffset, base), leading: name };
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Node builders.
// ---------------------------------------------------------------------------

/**
 * Per-argument spans (source order, kwargs included) + the paren-to-paren
 * `argsSpan`. Shared by the macro node and the control-tag call extraction.
 * argsSpan runs from the opening paren to one char past the closing paren (or the
 * call's last token when the close is missing on broken input).
 */
function argInfo(
	call: CallExprContext,
	docOffset: number,
	base: DocPos,
): { args: { span: PartSpan }[]; argsSpan?: PartSpan } {
	const argList = call.arg_list();
	const args: { span: PartSpan }[] = [];
	if (argList) {
		for (const arg of argList.arg()) {
			const span = spanOfNode(arg, docOffset, base);
			if (span) args.push({ span });
		}
	}
	let argsSpan: PartSpan | undefined;
	const lp = call.LPAREN();
	if (lp) {
		const rp = call.RPAREN();
		const end = rp ? rp.symbol : (call.stop ?? lp.symbol);
		argsSpan = spanFromTokens(lp.symbol, end, docOffset, base);
	}
	return { args, ...(argsSpan ? { argsSpan } : {}) };
}

/**
 * Extract a CallExprContext into the reusable MacroCall fields — name/nameSpan +
 * optional package via `decomposeCallee`, args[] + argsSpan via `argInfo`. Returns
 * undefined when the callee is not a real, locatable identifier (decomposeCallee
 * undefined, or no nameSpan): a computed / dynamic callee is skipped, never
 * fabricated (never-wrong). The `{{ }}` macro node and the `{% %}` control tag both
 * build from this, so a call surfaces identically wherever it appears.
 */
export function callToMacroCall(call: CallExprContext, docOffset: number, base: DocPos): MacroCall | undefined {
	const callee = decomposeCallee(call, docOffset, base);
	if (!callee || !callee.nameSpan) return undefined;
	const { args, argsSpan } = argInfo(call, docOffset, base);
	return {
		name: callee.name,
		nameSpan: callee.nameSpan,
		...(callee.packageName !== undefined ? { packageName: callee.packageName } : {}),
		...(callee.packageSpan !== undefined ? { packageSpan: callee.packageSpan } : {}),
		...(argsSpan ? { argsSpan } : {}),
		args,
	};
}

function macroNode(
	call: CallExprContext,
	callee: Callee,
	docOffset: number,
	base: DocPos,
	tagSpan: PartSpan,
	tree: ParserRuleContext,
): TagNode {
	// C1-symmetric: every macro call in the expression, source order, nested
	// included — same walk (findAllCalls) + mapping (callToMacroCall) as the
	// control tag. Over the whole `tree` (not just `call`) so sibling calls
	// (`{{ a() + b() }}`) are surfaced too; a computed/dynamic callee is skipped
	// (never fabricated). `calls[0]` is the leftmost-topmost call = the node's own
	// name/args (pre-order DFS visits it first).
	const calls: MacroCall[] = [];
	for (const c of findAllCalls(tree)) {
		const mc = callToMacroCall(c, docOffset, base);
		if (mc) calls.push(mc);
	}

	const mc = callToMacroCall(call, docOffset, base);
	if (mc) return { kind: "macro", ...mc, tagSpan, calls };
	// Degenerate fallback: a callee with a name but no locatable span (a broken
	// tree). Preserve the pre-refactor node shape — nameSpan defaults to tagSpan,
	// args are still extracted. (Unreachable for a well-formed parsed call, where
	// the identifier token always has a span; kept for behavioral parity.)
	const { args, argsSpan } = argInfo(call, docOffset, base);
	return {
		kind: "macro",
		name: callee.name,
		nameSpan: tagSpan,
		...(callee.packageName !== undefined ? { packageName: callee.packageName } : {}),
		...(callee.packageSpan !== undefined ? { packageSpan: callee.packageSpan } : {}),
		tagSpan,
		...(argsSpan ? { argsSpan } : {}),
		args,
		calls,
	};
}

/** Keywords whose stmt declares a name we surface (set target / macro name / for loop var). */
const NAME_DECLARING = new Set(["set", "macro", "for"]);

/**
 * Build the enriched `control` node for a `{% … %}` statement tag (R4). The lead
 * `keyword` is the statement's leading word, lowercased (a known jinja keyword or
 * an unknown dbt-custom lead like `snapshot`); `name`/`nameSpan` are extracted for
 * the name-declaring keywords only (`set`/`macro`/`for`) from the FIRST identifier
 * after the keyword — never fabricated (absent when the tolerant tree has no name).
 */
function controlNode(tree: ParserRuleContext, docOffset: number, base: DocPos, tagSpan: PartSpan): TagNode {
	const stmt = findStmt(tree);
	if (!stmt) return { kind: "control", tagSpan, calls: [] };

	// C1: surface every macro call embedded in the statement body (source order,
	// nested calls included), each as its own MacroCall. A computed / dynamic
	// callee is skipped by callToMacroCall (never fabricated). This is additive —
	// the declared keyword/name/nameSpan below are unchanged.
	const calls: MacroCall[] = [];
	for (const call of findAllCalls(stmt)) {
		const mc = callToMacroCall(call, docOffset, base);
		if (mc) calls.push(mc);
	}

	const lead = stmt.keyword() ?? stmt.id();
	const keyword = lead?.getText().toLowerCase();
	if (keyword === undefined) return { kind: "control", tagSpan, calls };

	if (NAME_DECLARING.has(keyword)) {
		const ne = firstNameExpr(stmt);
		const idNode = ne?.id();
		const nameSpan = idNode ? spanOfNode(idNode, docOffset, base) : undefined;
		if (idNode && nameSpan) {
			return { kind: "control", tagSpan, keyword, name: idNode.getText(), nameSpan, calls };
		}
	}
	return { kind: "control", tagSpan, keyword, calls };
}

/**
 * Build the R2 tag-AST node for ONE tag. `seg` carries the tag's document range
 * (`seg.start` = docOffset, `seg.end`); `tree` is the per-tag jinja parse tree;
 * `base` is the document line/column of the tag start (the multi-line anchor).
 * Returns undefined only for an empty/degenerate tree (never throws).
 */
export function tagNodesOf(seg: TagSegment, tree: ParserRuleContext, base: DocPos): TagNode | undefined {
	const docOffset = seg.start;
	// tagSpan is the whole tag including delimiters — the segment bounds are exact
	// (they cover `{{ … }}` / `{% … %}` / `{# … #}` and any `-` whitespace control).
	const tagSpan: PartSpan = { start: seg.start, end: seg.end, line: base.line, column: base.column };

	// Statement tags: classify as "control" and enrich with the lead keyword and,
	// for the name-declaring keywords, the declared name + its span (R4).
	if (seg.tagKind === "stmt") return controlNode(tree, docOffset, base, tagSpan);
	if (seg.tagKind === "comment") return { kind: "other", tagSpan };

	// Expr tag: classify by the leading call.
	const call = findTopCall(tree);
	if (!call) return { kind: "other", tagSpan };
	const callee = decomposeCallee(call, docOffset, base);
	if (!callee) return { kind: "other", tagSpan };

	const leading = callee.leading;
	const bare = callee.packageName === undefined;

	// Bare special forms (ref/source/var/env_var never take a package qualifier).
	if (bare && leading === "ref") {
		// The model is the LAST positional arg (dbt: ref('pkg','model')), and only
		// when THAT arg is a direct string literal — a computed target
		// (`ref(var('x'))`) does not fabricate a model.
		const pos = positionalArgs(call.arg_list());
		const modelArg = pos.at(-1);
		const modelTok = modelArg ? directStringToken(modelArg) : undefined;
		if (modelTok) {
			const callSpan = spanOfNode(call, docOffset, base) ?? tagSpan;
			return {
				kind: "ref",
				model: stringValue(modelTok),
				modelSpan: stringContentSpan(modelTok, docOffset, base),
				callSpan,
				tagSpan,
			};
		}
		// computed / broken / argless ref → macro fallback (never a fabricated model).
		return macroNode(call, callee, docOffset, base, tagSpan, tree);
	}
	if (bare && leading === "source") {
		// source('name', 'table') — both must be DIRECT string literals; a computed
		// arg does not fabricate a name/table.
		const pos = positionalArgs(call.arg_list());
		const srcTok = pos[0] ? directStringToken(pos[0]) : undefined;
		const tblTok = pos[1] ? directStringToken(pos[1]) : undefined;
		if (srcTok && tblTok) {
			const callSpan = spanOfNode(call, docOffset, base) ?? tagSpan;
			return {
				kind: "source",
				sourceName: stringValue(srcTok),
				tableName: stringValue(tblTok),
				sourceNameSpan: stringContentSpan(srcTok, docOffset, base),
				tableNameSpan: stringContentSpan(tblTok, docOffset, base),
				callSpan,
				tagSpan,
			};
		}
		return macroNode(call, callee, docOffset, base, tagSpan, tree);
	}
	if (bare && leading === "var") return { kind: "var", tagSpan };
	if (bare && leading === "env_var") return { kind: "env_var", tagSpan };

	// No-output builtins (config/docs/print/log/return/exceptions) — config is its
	// own kind; the rest map to "other". Applies to the leading name whether bare
	// (`config(...)`) or member (`exceptions.raise_compiler_error(...)`).
	if (NO_OUTPUT_BUILTINS.has(leading)) {
		return leading === "config" ? { kind: "config", tagSpan } : { kind: "other", tagSpan };
	}

	// pkg.macro(...) or a bare unknown call → macro.
	return macroNode(call, callee, docOffset, base, tagSpan, tree);
}
