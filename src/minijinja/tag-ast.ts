// ---------------------------------------------------------------------------
// R2 tag-AST: the NEUTRAL tag node with the EXACT span contract
// (docs/minijinja-front-end.md §R2). This is the HARD deliverable: the editor
// positions hover / rename / signature-help exactly on the spans emitted here, so
// every offset must be document-true.
//
// The walk is a small tree-navigation over the per-tag jinja parse tree, built by
// parse.ts from a DOCUMENT-native token slice (segment.ts's `tagTokens`, the one
// whole-document tokenization, sliced per tag via antlr4ng's `ListTokenSource`).
// Every token in that slice already carries its real document start/stop/line/
// column, so every span read off it is document-true with NO offset/anchor
// composition.
//
// The tag AST carries NO dbt vocabulary. Every expression tag classifies into one
// of three neutral kinds:
//   - a leading call `name(args)` (bare or `pkg.name`) → a "call" node. ref/source/
//     config/var/env_var/a user macro are ALL just callees, distinguished by `name`.
//     Whether `ref` denotes a relation is the provider's knowledge, not the tag AST.
//     Each arg carries {value, span, valueSpan}: a consumer that knows a call's arg
//     roles (dbt: ref's model is the last arg) reads value + valueSpan straight off.
//   - a `{% … %}` statement tag → "control" (if/for/set/macro structure).
//   - any other expr (a bare name, a literal, arithmetic) or a `{# … #}` comment →
//     "other".
//
// Never-wrong (global-constraints): a string arg's `value` is a real literal only
// (a computed arg like `ref(var('x'))` has `value: null`, never fabricated); a
// broken `{{ ref( }}` degrades to a best-effort node + the parse's positioned
// diagnostic, never a throw.
// ---------------------------------------------------------------------------

import { ParserRuleContext, TerminalNode, Token as AntlrToken, type ParseTree } from "antlr4ng";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import {
	Arg_listContext,
	CallExprContext,
	Endraw_tagContext,
	MemberExprContext,
	NameExprContext,
	Raw_tagContext,
	StmtContext,
} from "../generated/minijinja/MinijinjaParser.js";
import type { PartSpan } from "../ir/part-span.js";
import { endPosition } from "../ir/span.js";
import { NO_OUTPUT_BUILTINS, type Segment } from "./segment.js";

/** A tag segment (the `kind: "tag"` arm of Segment). */
type TagSegment = Extract<Segment, { kind: "tag" }>;

/**
 * One argument of a call, in the same spirit as a SQL function-call's args. `span` is the WHOLE
 * argument (quote-included: `'orders'`, or `model='orders'` for a kwarg). `value` is the literal
 * value quote-stripped (`orders`), or `null` for a computed arg (`ref(var('x'))`, `'a' ~ b`), never
 * fabricated. `valueSpan` is the quote-EXCLUDED span of that literal value (covers `orders`, not
 * `'orders'`), present only when there's a literal value. So a consumer that knows a call's arg roles
 * (e.g. dbt: `ref`'s model is the last arg) reads the value + valueSpan straight off here, exactly
 * how the old `ref.model`/`modelSpan` read.
 */
export interface TagArg {
	value: string | null;
	span: PartSpan;
	valueSpan?: PartSpan;
}

/**
 * The reusable call fields the extension consumes for signature-help / hover — the
 * call TagNode's fields minus `kind`/`tagSpan`. A `{{ }}` call node IS a
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
	args: TagArg[];
}

/**
 * R2 tag-AST node. The ref/source/macro arms carry the span contract the
 * extension positions on; the last arm classifies everything else by kind.
 * Spans are PartSpan in DOCUMENT coordinates (1-based line, 0-based column,
 * 0-based offsets — sqllens convention).
 */
export type TagNode =
	| {
			// A template CALL: ref/source/config/var/env_var/a user macro/pkg.macro. The NEUTRAL
			// shape. A callee + args + spans, with NO interpretation of what the call MEANS (that
			// `ref` is a relation is dbt knowledge the provider owns, not the tag AST). ref/source/etc.
			// are just callees here, distinguished by `name`; the provider resolves their semantics.
			kind: "call";
			name: string;
			nameSpan: PartSpan;
			packageName?: string;
			packageSpan?: PartSpan;
			/** The whole call `name(args)` (name/package through the close paren). */
			callSpan: PartSpan;
			tagSpan: PartSpan;
			argsSpan?: PartSpan;
			args: TagArg[];
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
			/** Present (true) when the call is UNCLOSED / mid-typing (`{{ ref('cu`) and was recovered
			 *  from the raw tokens because the parser could not build a complete call node. Its args are
			 *  best-effort (a partial string arg has `value: null`); a consumer knows not to treat it as
			 *  a confirmed reference, and completion uses it to place the caret's arg slot. Absent on a
			 *  normally-parsed (closed) call. */
			incomplete?: true;
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
	| { kind: "other"; tagSpan: PartSpan };

// ---------------------------------------------------------------------------
// Span helpers. The tokens here come from parse.ts's per-tag `ListTokenSource`
// slice over the ONE whole-document tokenization (segment.ts's `tagTokens`), so
// every token's start/stop/line/column is ALREADY a document-true position —
// these helpers just read it off, no offset shift or anchor composition needed.
// ---------------------------------------------------------------------------

/** Span from a first + last token (inclusive stop → exclusive end). */
function spanFromTokens(a: AntlrToken, b: AntlrToken): PartSpan {
	const end = endPosition(b.line, b.column, b.text ?? "");
	return {
		start: a.start,
		end: b.stop + 1,
		line: a.line,
		column: a.column,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

/** Span of a rule context (its start..stop tokens), or undefined if it has none. */
function spanOfNode(node: ParserRuleContext): PartSpan | undefined {
	const s = node.start;
	const e = node.stop;
	if (!s || !e) return undefined;
	return spanFromTokens(s, e);
}

/**
 * Quote-EXCLUDED span of a STRING token: `'my_model'` → covers `my_model`. The
 * content starts one char past the opening quote and ends one char before the
 * closing quote.
 */
function stringContentSpan(t: AntlrToken): PartSpan {
	// t.start = opening quote, t.stop = closing quote (inclusive). Content is
	// [start+1, stop-1]; exclusive end = stop. The end position is where the text
	// MINUS the closing quote ends (= one past the content's last char).
	const text = t.text ?? "";
	const end = endPosition(t.line, t.column, text.slice(0, Math.max(0, text.length - 1)));
	return {
		start: t.start + 1,
		end: t.stop,
		line: t.line,
		column: t.column + 1,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
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

/** The keyword of a self-contained raw-block delimiter tag (`raw_tag` / `endraw_tag` — each is ONE
 *  lexer token carrying the whole `{% raw %}` / `{% endraw %}`, see MinijinjaParser.g4), or undefined
 *  for every other tag shape (DFS, leftmost). */
function selfContainedKeyword(node: ParseTree | null | undefined): "raw" | "endraw" | undefined {
	if (!node) return undefined;
	if (node instanceof Raw_tagContext) return "raw";
	if (node instanceof Endraw_tagContext) return "endraw";
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) {
			const found = selfContainedKeyword(node.getChild(i));
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

function decomposeCallee(call: CallExprContext): Callee | undefined {
	const callee = call.primary();
	if (callee instanceof MemberExprContext) {
		// pkg.macro(...) — the id is the macro name; the primary prefix is the package.
		const idNode = callee.id();
		const prefix = callee.primary();
		const name = idNode.getText();
		const nameSpan = spanOfNode(idNode);
		const packageName = prefix.getText();
		const packageSpan = spanOfNode(prefix);
		return { name, nameSpan, packageName, packageSpan, leading: leftmostName(prefix) ?? packageName };
	}
	if (callee instanceof NameExprContext) {
		const idNode = callee.id();
		const name = idNode.getText();
		return { name, nameSpan: spanOfNode(idNode), leading: name };
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
function argInfo(call: CallExprContext): { args: TagArg[]; argsSpan?: PartSpan } {
	const argList = call.arg_list();
	const args: TagArg[] = [];
	if (argList) {
		for (const arg of argList.arg()) {
			const a = argOf(arg);
			if (a) args.push(a);
		}
	}
	let argsSpan: PartSpan | undefined;
	const lp = call.LPAREN();
	if (lp) {
		const rp = call.RPAREN();
		const end = rp ? rp.symbol : (call.stop ?? lp.symbol);
		argsSpan = spanFromTokens(lp.symbol, end);
	}
	return { args, ...(argsSpan ? { argsSpan } : {}) };
}

/** The bare literal token types an argument can be (besides STRING): a consumer reads their text as
 *  the arg value. */
const LITERAL_TOKENS: ReadonlySet<number> = new Set([
	MinijinjaParser.INT,
	MinijinjaParser.FLOAT,
	MinijinjaParser.TRUE,
	MinijinjaParser.FALSE,
	MinijinjaParser.NONE,
]);

/** One argument as `{value, span, valueSpan?}`. `span` is the WHOLE arg (incl. any `name=` and quotes).
 *  The literal VALUE + its quote-excluded `valueSpan` come from the value expression: for a kwarg
 *  (`model='x'`) that's the RHS, for a positional it's the arg itself. A STRING literal yields the
 *  stripped value + content span; a bare number/bool/none yields its text + its span; anything
 *  computed yields `value: null` (never fabricated). undefined only when the arg has no span at all. */
function argOf(arg: ParserRuleContext): TagArg | undefined {
	const span = spanOfNode(arg);
	if (!span) return undefined;
	const valueCtx = isKwarg(arg) ? kwargValue(arg) : arg;
	if (valueCtx) {
		const str = directStringToken(valueCtx);
		if (str) return { value: stringValue(str), span, valueSpan: stringContentSpan(str) };
		const v = valueCtx.start;
		if (v && v === valueCtx.stop && LITERAL_TOKENS.has(v.type)) {
			return { value: v.text ?? null, span, valueSpan: spanOfNode(valueCtx) };
		}
	}
	return { value: null, span };
}

/** The value expression of a kwarg (`id = expr` → the `expr`), or undefined. It is the last child;
 *  the ASSIGN and id precede it. */
function kwargValue(arg: ParserRuleContext): ParserRuleContext | undefined {
	const last = arg.getChild(arg.getChildCount() - 1);
	return last instanceof ParserRuleContext ? last : undefined;
}

/**
 * Extract a CallExprContext into the reusable MacroCall fields — name/nameSpan +
 * optional package via `decomposeCallee`, args[] + argsSpan via `argInfo`. Returns
 * undefined when the callee is not a real, locatable identifier (decomposeCallee
 * undefined, or no nameSpan): a computed / dynamic callee is skipped, never
 * fabricated (never-wrong). The `{{ }}` macro node and the `{% %}` control tag both
 * build from this, so a call surfaces identically wherever it appears.
 */
function callToMacroCall(call: CallExprContext): MacroCall | undefined {
	const callee = decomposeCallee(call);
	if (!callee || !callee.nameSpan) return undefined;
	const { args, argsSpan } = argInfo(call);
	return {
		name: callee.name,
		nameSpan: callee.nameSpan,
		...(callee.packageName !== undefined ? { packageName: callee.packageName } : {}),
		...(callee.packageSpan !== undefined ? { packageSpan: callee.packageSpan } : {}),
		...(argsSpan ? { argsSpan } : {}),
		args,
	};
}

function macroNode(call: CallExprContext, callee: Callee, tagSpan: PartSpan, tree: ParserRuleContext): TagNode {
	// C1-symmetric: every macro call in the expression, source order, nested
	// included — same walk (findAllCalls) + mapping (callToMacroCall) as the
	// control tag. Over the whole `tree` (not just `call`) so sibling calls
	// (`{{ a() + b() }}`) are surfaced too; a computed/dynamic callee is skipped
	// (never fabricated). `calls[0]` is the leftmost-topmost call = the node's own
	// name/args (pre-order DFS visits it first).
	const calls: MacroCall[] = [];
	for (const c of findAllCalls(tree)) {
		const mc = callToMacroCall(c);
		if (mc) calls.push(mc);
	}

	const callSpan = spanOfNode(call) ?? tagSpan;
	const mc = callToMacroCall(call);
	if (mc) return { kind: "call", ...mc, callSpan, tagSpan, calls };
	// Degenerate fallback: a callee with a name but no locatable span (a broken
	// tree). Preserve the pre-refactor node shape — nameSpan defaults to tagSpan,
	// args are still extracted. (Unreachable for a well-formed parsed call, where
	// the identifier token always has a span; kept for behavioral parity.)
	const { args, argsSpan } = argInfo(call);
	return {
		kind: "call",
		name: callee.name,
		nameSpan: tagSpan,
		...(callee.packageName !== undefined ? { packageName: callee.packageName } : {}),
		...(callee.packageSpan !== undefined ? { packageSpan: callee.packageSpan } : {}),
		callSpan,
		tagSpan,
		...(argsSpan ? { argsSpan } : {}),
		args,
		calls,
	};
}

/** The tag's significant tokens: default channel, no EOF, no `{{`/`}}`/`{%` delimiters. */
function significantTokens(tokens: readonly AntlrToken[]): AntlrToken[] {
	const P = MinijinjaParser;
	return tokens.filter(
		(t) =>
			t.channel === AntlrToken.DEFAULT_CHANNEL &&
			t.type !== AntlrToken.EOF &&
			t.type !== P.EXPR_OPEN &&
			t.type !== P.EXPR_CLOSE &&
			t.type !== P.STMT_OPEN,
	);
}

/** The INNERMOST still-open CALL paren in `sig` (the call being typed), or undefined when none is
 *  open. Every `(` is pushed (a call when the token before it is an `id` / `pkg.id`, else a grouping
 *  paren = null) and every `)` pops, so `outer(inner(` reports inner, a call after a keyword
 *  (`if is_incremental(`) is found past the leading words, and a grouping paren never masks the call
 *  it sits inside. */
function trailingOpenCall(
	sig: AntlrToken[],
): { nameTok: AntlrToken; packageTok?: AntlrToken; lparenIdx: number } | undefined {
	const P = MinijinjaParser;
	type Open = { nameTok: AntlrToken; packageTok?: AntlrToken; lparenIdx: number } | null;
	const stack: Open[] = [];
	for (let i = 0; i < sig.length; i++) {
		const t = sig[i]!;
		if (t.type === P.LPAREN) {
			const prev = sig[i - 1];
			if (prev?.type === P.ID) {
				const packageTok = sig[i - 2]?.type === P.DOT && sig[i - 3]?.type === P.ID ? sig[i - 3]! : undefined;
				stack.push({ nameTok: prev, ...(packageTok ? { packageTok } : {}), lparenIdx: i });
			} else {
				stack.push(null); // a grouping paren, not a call
			}
		} else if (t.type === P.RPAREN) {
			stack.pop();
		}
	}
	for (let k = stack.length - 1; k >= 0; k--) {
		const e = stack[k];
		if (e) return e;
	}
	return undefined;
}

/** The args of an unclosed call: the significant tokens from just after its `(` (index `from`) to the
 *  end, split into args by top-level commas. Best-effort per `argFromTokens`. */
function argsFrom(sig: AntlrToken[], from: number): TagArg[] {
	const P = MinijinjaParser;
	const args: TagArg[] = [];
	let depth = 0;
	let cur: AntlrToken[] = [];
	for (let i = from; i < sig.length; i++) {
		const t = sig[i]!;
		if (t.type === P.LPAREN) {
			depth++;
			cur.push(t);
		} else if (t.type === P.RPAREN) {
			if (depth === 0) break;
			depth--;
			cur.push(t);
		} else if (t.type === P.COMMA && depth === 0) {
			if (cur.length > 0) args.push(argFromTokens(cur));
			cur = [];
		} else {
			cur.push(t);
		}
	}
	if (cur.length > 0) args.push(argFromTokens(cur));
	return args;
}

/** The reusable MacroCall fields of the innermost unclosed call in `tokens`, or undefined when none is
 *  open (a bare name / non-call expr). Shared by the expr-tag node recovery and the control-tag
 *  embedded-call recovery. Args are best-effort: a complete STRING is value + quote-excluded span; a
 *  partial or computed arg is `value: null` + its span (never fabricated). */
function openCall(tokens: readonly AntlrToken[]): MacroCall | undefined {
	const sig = significantTokens(tokens);
	const open = trailingOpenCall(sig);
	if (!open) return undefined;
	const lparen = sig[open.lparenIdx]!;
	const last = sig[sig.length - 1]!;
	return {
		name: open.nameTok.text ?? "",
		nameSpan: spanFromTokens(open.nameTok, open.nameTok),
		...(open.packageTok
			? { packageName: open.packageTok.text ?? "", packageSpan: spanFromTokens(open.packageTok, open.packageTok) }
			: {}),
		argsSpan: spanFromTokens(lparen, last),
		args: argsFrom(sig, open.lparenIdx + 1),
	};
}

/** An UNCLOSED / mid-typing expr-tag call (`{{ ref('cu`, `{{ outer(inner(`) recovered as a neutral
 *  "call" node flagged `incomplete: true`, so completion can place the caret's slot. Reports the
 *  INNERMOST open call. Undefined when there's no open `id (` (a bare name / non-call expr stays
 *  "other"). */
function incompleteCall(tokens: readonly AntlrToken[], tagSpan: PartSpan): TagNode | undefined {
	const c = openCall(tokens);
	if (!c || !c.argsSpan) return undefined;
	const from = c.packageSpan ?? c.nameSpan;
	return {
		kind: "call",
		name: c.name,
		nameSpan: c.nameSpan,
		...(c.packageName !== undefined ? { packageName: c.packageName, packageSpan: c.packageSpan } : {}),
		callSpan: {
			start: from.start,
			end: c.argsSpan.end,
			line: from.line,
			column: from.column,
			endLine: c.argsSpan.endLine,
			endColumn: c.argsSpan.endColumn,
		},
		tagSpan,
		argsSpan: c.argsSpan,
		args: c.args,
		calls: [],
		incomplete: true,
	};
}

/** One arg of an incomplete call from its raw tokens: a lone complete STRING → value + quote-excluded
 *  span; anything else (a partial/unterminated string, a computed expression) → value null + span. */
function argFromTokens(toks: AntlrToken[]): TagArg {
	const span = spanFromTokens(toks[0]!, toks[toks.length - 1]!);
	if (toks.length === 1 && toks[0]!.type === MinijinjaParser.STRING) {
		return { value: stringValue(toks[0]!), span, valueSpan: stringContentSpan(toks[0]!) };
	}
	return { value: null, span };
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
function controlNode(tree: ParserRuleContext, tagSpan: PartSpan): TagNode {
	const stmt = findStmt(tree);
	if (!stmt) return { kind: "control", tagSpan, calls: [] };

	// C1: surface every macro call embedded in the statement body (source order,
	// nested calls included), each as its own MacroCall. A computed / dynamic
	// callee is skipped by callToMacroCall (never fabricated). This is additive —
	// the declared keyword/name/nameSpan below are unchanged.
	const calls: MacroCall[] = [];
	for (const call of findAllCalls(stmt)) {
		const mc = callToMacroCall(call);
		if (mc) calls.push(mc);
	}

	const lead = stmt.keyword() ?? stmt.id();
	const keyword = lead?.getText().toLowerCase();
	if (keyword === undefined) return { kind: "control", tagSpan, calls };

	if (NAME_DECLARING.has(keyword)) {
		const ne = firstNameExpr(stmt);
		const idNode = ne?.id();
		const nameSpan = idNode ? spanOfNode(idNode) : undefined;
		if (idNode && nameSpan) {
			return { kind: "control", tagSpan, keyword, name: idNode.getText(), nameSpan, calls };
		}
	}
	return { kind: "control", tagSpan, keyword, calls };
}

/**
 * Build the R2 tag-AST node for ONE tag. `seg` carries the tag's document range
 * (`seg.start`/`seg.end`, used for `tagSpan`'s offsets — its own line/column come
 * from the tree's start token, doc-native by construction); `tree` is the per-tag
 * jinja parse tree, built by parse.ts from a document-native token slice (no
 * offset/anchor composition anywhere in this file). Returns undefined only for an
 * empty/degenerate tree (never throws).
 */
export function tagNodesOf(
	seg: TagSegment,
	tree: ParserRuleContext,
	tokens: readonly AntlrToken[] = [],
): TagNode | undefined {
	// tagSpan is the whole tag including delimiters — the segment bounds are exact
	// (they cover `{{ … }}` / `{% … %}` / `{# … #}` and any `-` whitespace control);
	// its line/column come from the tree's own start token (the tag's OPEN token).
	const start = tree.start;
	const line = start?.line ?? 1;
	const column = start?.column ?? 0;
	// seg.text is the ENTIRE tag's source text, so the end position falls straight
	// out of it (multi-line tags advance endLine).
	const end = endPosition(line, column, seg.text);
	const tagSpan: PartSpan = {
		start: seg.start,
		end: seg.end,
		line,
		column,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};

	// Statement tags: classify as "control" and enrich with the lead keyword and,
	// for the name-declaring keywords, the declared name + its span (R4). The two
	// raw-block delimiters are self-contained lexer tokens (`{% raw %}` = RAW_TAG,
	// `{% endraw %}` = ENDRAW_TAG — the whole tag as one token, keyword fused in, so
	// there is no separate identifier token to read): hardcode their keywords,
	// matching the control shape every other stmt keyword gets (no name, no calls).
	if (seg.tagKind === "stmt") {
		const selfKeyword = selfContainedKeyword(tree);
		if (selfKeyword) return { kind: "control", tagSpan, keyword: selfKeyword, calls: [] };
		const node = controlNode(tree, tagSpan);
		// Recover a trailing UNCLOSED call being typed (`{% if is_incremental(`), which the tree parse
		// could not build, and add it to `calls` so completion can place the caret's slot inside it.
		const partial = openCall(tokens);
		return partial && node.kind === "control" ? { ...node, calls: [...node.calls, partial] } : node;
	}
	if (seg.tagKind === "comment") return { kind: "other", tagSpan };

	// Expr tag: classify by the leading call.
	const call = findTopCall(tree);
	if (!call) {
		// No complete call node: recover an UNCLOSED/mid-typing call from the raw tokens
		// (`{{ ref('cu`) so completion can place the caret's slot. A bare non-call expr stays "other".
		return incompleteCall(tokens, tagSpan) ?? { kind: "other", tagSpan };
	}
	const callee = decomposeCallee(call);
	if (!callee) return { kind: "other", tagSpan };

	// Every expression-call tag is one neutral CALL node. ref/source/config/var/env_var are just
	// callees distinguished by `name`; the provider (DbtTemplateProvider) interprets what each call
	// MEANS (relation / no-output / scalar). The tag AST carries no dbt vocabulary.
	return macroNode(call, callee, tagSpan, tree);
}
