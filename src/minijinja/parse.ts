// ---------------------------------------------------------------------------
// Task 3 — parseTemplated / tokenizeTemplated: the unified SQL+jinja token stream
// (docs/minijinja-front-end.md §mechanism steps 3-6, §R1).
//
// This is the INTEGRATION stage. It composes three pieces that each stay in their
// lane:
//   1. segment()      (Task 2) — ONE whole-document tokenization with the
//                     generated MinijinjaLexer: splits raw jinja-SQL over the
//                     OUTER jinja language into SQL runs + tag runs, builds the
//                     length-/newline-preserving placeholder string, and hands
//                     back each tag's FULL document-native token slice
//                     (`tagTokens`, keyed by tag segment identity).
//   2. parse()        (src/api.ts, UNTOUCHED) — the existing per-dialect SQL entry,
//                     run over the placeholder. Because the placeholder occupies
//                     each tag's EXACT char range and preserves every `\n`, every
//                     antlr start/stop/line/column it returns is already in ORIGINAL
//                     document coordinates — no span remap for SQL tokens.
//   3. per-tag PARSE  — a `MinijinjaParser` fed by a `CommonTokenStream` wrapping
//                     an antlr4ng `ListTokenSource` over that SAME document-native
//                     slice (NOT a re-lex of `seg.text`), so the resulting tag-AST
//                     tree and its tokens are ALREADY in document coordinates —
//                     no offset/anchor composition anywhere below. The parse stays
//                     PER-TAG (not one whole-document parse): a broken tag's error
//                     recovery never bleeds into its neighbors (error containment
//                     by construction, same as before).
//
// The merge (step 4): one source-ordered Token[] = SQL tokens (channel 0) + jinja
// tokens (channel 2), sorted by start. The placeholder's FILLER tokens inside a
// tag region (PLACEHOLDER_CHAR-filled identifiers and whitespace from segment.ts)
// are GARBAGE — the jinja tokens replace them — so each SQL token is CLIPPED to
// the parts OUTSIDE the tag regions: a token fully inside a tag drops, one
// straddling a tag edge keeps only its outside remainder (a whitespace-fill tag
// can fuse with an adjacent real newline into one WS token). The result tiles
// the source.
//
// Total (R5, step 6): the whole build is wrapped so no input — including a half-
// typed `{{ ref(` — ever throws. Each composed piece is already total (segment,
// the SQL parse, the per-tag jinja parse all recover rather than throw); the
// try/catch is defense-in-depth, degrading worst-case to the whole text as plain
// SQL with no jinja tokens.
//
// The eight SQL grammars are UNTOUCHED: jinja is a pre-stage that WRAPS parse();
// parseTemplated is NOT a `DIALECTS` entry. The merge happens on the Token[]
// outside antlr's lazy token buffer, so no dialect parse.ts is touched.
// ---------------------------------------------------------------------------

import { CharStream, CommonTokenStream, ListTokenSource, type ParserRuleContext, Token as AntlrToken } from "antlr4ng";
import { parse } from "../api.js";
import { debugRethrow } from "../debug.js";
import type { Dialect } from "../dialect.js";
import { MinijinjaLexer } from "../generated/minijinja/MinijinjaLexer.js";
import { type FragmentRange, type FragmentSession, openFragments } from "../fragment.js";
import type { PartSpan } from "../ir/part-span.js";
import { endPosition } from "../ir/span.js";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";
import { classifyMinijinjaToken } from "../token/classify.js";
import type { Token } from "../token/token.js";
import { applyTemplateTags, type CellBase } from "./apply-tags.js";
import { templateRegions, templateSymbols, type TemplateArm, type TemplateRegion } from "./regions.js";
import { OPEN_PROVIDER, type TemplateProvider } from "../qualify/template-provider.js";
import { segment, type Segment } from "./segment.js";
import { tagNodesOf, type TagNode } from "./tag-ast.js";
import type {
	MacroShape,
	TemplatedCellResult,
	TemplatedParseOptions,
	TemplatedParseResult,
} from "../template/engine.js";
import type { ExpansionShape } from "../qualify/template-provider.js";
import type { TemplateCall } from "../ir/ir.js";
import type { FragmentKind } from "../fragment-grammar.js";

/**
 * A single shared `MinijinjaLexer` instance, used ONLY for its static vocabulary
 * (`.vocabulary.getSymbolicName`/`getDisplayName`, consulted by `classifyMinijinjaToken`
 * and the token `name` lookup below) — never for lexing. One instance suffices because
 * the vocabulary is a property of the GRAMMAR, not of any particular input; constructing
 * it once here avoids a throwaway `new MinijinjaLexer(...)` per tag per document.
 */
const vocabLexer = new MinijinjaLexer(CharStream.fromString(""));

// Re-export the R2 tag-AST union (Task 4) so `src/index.ts` keeps re-exporting
// TagNode from this module — the union now lives in ./tag-ast.js. MacroCall (C1)
// is the reusable call-fields shape carried by macro nodes and control-tag `calls`.
export type { TagNode, MacroCall } from "./tag-ast.js";
// Re-export the R4 region / symbol shapes (Task 3) so the barrel re-exports them here.
export type { TemplateRegion, TemplateArm, TemplateSymbol } from "./regions.js";
export { templateRegions, templateSymbols } from "./regions.js";
// TemplatedParseOptions / TemplatedParseResult now live in ../template/engine.js
// (the neutral TemplateEngine contract); re-exported here so every existing
// import site keeps working.
export type { MacroShape, TemplatedParseOptions, TemplatedParseResult } from "../template/engine.js";

/** No-op accessors for the degraded/no-correlation path: total, never wrong. */
function noCorrelation(): Pick<TemplatedParseResult, "tagOf" | "nodeOf" | "diagnosticsOf"> {
	return {
		tagOf: () => undefined,
		nodeOf: () => undefined,
		diagnosticsOf: () => [],
	};
}

/** Document line (1-based) / column (0-based) of a source offset. */
interface DocPos {
	line: number;
	column: number;
}

/**
 * Document line/column of an absolute offset — a small forward scan over the
 * original text (sqllens convention: 1-based line, 0-based column). Used once per
 * tag to anchor the jinja lexer's tag-relative line/column into document coords,
 * so a multi-line tag carries a correct multi-line span (§R1 multi-line).
 */
function docPosAt(text: string, offset: number): DocPos {
	let line = 1;
	let column = 0;
	const end = Math.min(offset, text.length);
	for (let i = 0; i < end; i++) {
		if (text.charCodeAt(i) === 0x0a /* \n */) {
			line += 1;
			column = 0;
		} else {
			column += 1;
		}
	}
	return { line, column };
}

/**
 * Map one jinja token from a tag's document-native slice (segment.ts's `tagTokens`)
 * to a neutral document Token: channel 2, role "minijinja", every other field read
 * straight off the antlr token — it is ALREADY in document coordinates (no offset
 * shift, no anchor composition; the old tag-relative re-lex + shift is gone).
 */
function mapSliceToken(tok: AntlrToken): Token {
	const name =
		vocabLexer.vocabulary.getSymbolicName(tok.type) ??
		vocabLexer.vocabulary.getDisplayName(tok.type) ??
		String(tok.type);
	const text = tok.text ?? "";
	const end = endPosition(tok.line, tok.column, text);
	return {
		type: tok.type,
		name,
		text,
		start: tok.start,
		stop: tok.stop,
		line: tok.line,
		column: tok.column,
		endLine: end.endLine,
		endColumn: end.endColumn,
		channel: 2,
		role: classifyMinijinjaToken(vocabLexer, tok.type),
	};
}

/** A clipped copy of an SQL token covering only the inclusive [a,b] sub-span. */
function sliceToken(tok: Token, a: number, b: number, text: string): Token {
	if (a === tok.start && b === tok.stop) return tok; // whole token — identity
	const pos = docPosAt(text, a);
	const sliced = tok.text.slice(a - tok.start, b - tok.start + 1);
	const end = endPosition(pos.line, pos.column, sliced);
	return {
		...tok,
		text: sliced,
		start: a,
		stop: b,
		line: pos.line,
		column: pos.column,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

/**
 * Clip an SQL token to the parts OUTSIDE every tag region, dropping the parts the
 * jinja tokens replace. Three cases:
 *   - no overlap    → the token unchanged (the fast, overwhelmingly common path);
 *   - fully inside  → [] (the placeholder filler — `jjj` identifiers / whitespace);
 *   - straddling    → one clipped token per outside remainder.
 * The straddle case is real: the SQL lexer's WS token can fuse a whitespace-fill
 * tag (e.g. `{{ config(...) }}`) with an adjacent real newline, so the token pokes
 * past the tag edge; clipping keeps only the newline. A two-sided straddle
 * (`x{{ref}}y` fusing into one identifier) yields two pieces — the known fragment
 * case (spec §the hole); the stream still tiles. Tag coverage is inclusive
 * [start, end-1] (segment end is exclusive).
 */
function clipToTagBoundaries(tok: Token, tagRanges: readonly Segment[], text: string): Token[] {
	// Fast path: the token touches no tag at all.
	if (!tagRanges.some((seg) => tok.start < seg.end && tok.stop >= seg.start)) return [tok];

	// Interval subtraction over the inclusive [start, stop] span.
	let intervals: [number, number][] = [[tok.start, tok.stop]];
	for (const seg of tagRanges) {
		const ts = seg.start;
		const te = seg.end - 1; // inclusive last covered offset
		const next: [number, number][] = [];
		for (const [a, b] of intervals) {
			if (te < a || ts > b) {
				next.push([a, b]); // disjoint from this tag
				continue;
			}
			if (ts > a) next.push([a, ts - 1]); // remainder left of the tag
			if (te < b) next.push([te + 1, b]); // remainder right of the tag
			// the overlap itself is dropped
		}
		intervals = next;
	}
	return intervals.map(([a, b]) => sliceToken(tok, a, b, text));
}

/**
 * Parse one tag's DOCUMENT-NATIVE token slice (segment.ts's `tagTokens` — the one
 * whole-document tokenization, not a re-lex of `seg.text`) with the jinja island
 * grammar. The slice feeds a `CommonTokenStream` wrapping antlr4ng's
 * `ListTokenSource` (a TokenSource over a plain token array — it auto-supplies an
 * EOF once the list is exhausted, so no manual EOF append is needed), so the
 * resulting tree's tokens stay document-native throughout: no offset/anchor
 * composition anywhere downstream. Uses the DEFAULT recovering error strategy
 * (like the old parseMinijinjaTag), so a half-typed tag yields a best-effort tree
 * + positioned diagnostics and never throws (R5). There is no lexer stage here —
 * the tokens are already lexed — so lexer-level diagnostics are moot; the island
 * lexer is total via its STRAY/*_ANY fallbacks and never actually errors, so
 * nothing is lost. Kept strictly PER-TAG (never one whole-document parse): a
 * broken tag's error recovery must never bleed into its neighbors.
 */
function parseSliceTag(slice: readonly AntlrToken[]): { tree: ParserRuleContext; diagnostics: SyntaxDiagnostic[] } {
	const tokenSource = new ListTokenSource([...slice]);
	const tokenStream = new CommonTokenStream(tokenSource);
	const parser = new MinijinjaParser(tokenStream);

	const collector = makeErrorCollector();
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener);

	const tree = parser.tag();
	return { tree, diagnostics: collector.diagnostics };
}

/** A tag segment (the `kind: "tag"` arm of Segment) — reused as the key linking a scrubbed
 *  diagnostic's owning range back to its TagNode (Task 10). */
type TagSegment = Extract<Segment, { kind: "tag" }>;

/** A pure placeholder-fill run: `j` + up to two base-35 ordinal chars + `j` padding (segment.ts). */
const FILL_RUN = /^j[0-9a-ik-z]{0,2}j*$/;

/**
 * Scrub placeholder gibberish out of SQL syntax diagnostics. Two parts:
 *   - every message: each placeholder FILL RUN of any tag is rewritten to that tag's original
 *     source text. ANTLR's "no viable alternative at input '…'" quotes a whole token RANGE, so a
 *     fill can sit inside a message whose offending token is plain SQL far away; fills are
 *     ordinal-unique, so plain substring replacement (longest fill first, a shorter fill can be
 *     a prefix of a longer one) is exact;
 *   - a diagnostic whose offending token starts inside a tag range is really complaining about
 *     the TAG: its offset/length (+ line/column) widen to the whole tag.
 * `bySegment` carries the widened diagnostics keyed by the owning tag segment — build() maps
 * that back to a TagNode for `diagnosticsOf`.
 */
function scrubPlaceholderDiagnostics(
	diags: SyntaxDiagnostic[],
	tagRanges: readonly TagSegment[],
	text: string,
	placeholder: string,
): { diagnostics: SyntaxDiagnostic[]; bySegment: Map<TagSegment, SyntaxDiagnostic[]> } {
	const bySegment = new Map<TagSegment, SyntaxDiagnostic[]>();
	if (tagRanges.length === 0) return { diagnostics: diags, bySegment };
	// fill run → the tag's source text, longest fill first.
	const fills: [string, string][] = [];
	for (const tag of tagRanges) {
		const tagText = text.slice(tag.start, tag.end);
		for (const run of placeholder.slice(tag.start, tag.end).split(/\s+/)) {
			if (run.length >= 3 && FILL_RUN.test(run)) fills.push([run, tagText]);
		}
	}
	fills.sort((a, b) => b[0].length - a[0].length);
	const scrubMessage = (message: string): string => {
		for (const [run, tagText] of fills) if (message.includes(run)) message = message.split(run).join(tagText);
		return message;
	};
	const diagnostics = diags.map((d) => {
		const tag =
			d.offset === undefined ? undefined : tagRanges.find((s) => d.offset! >= s.start && d.offset! < s.end);
		if (!tag) {
			const message = scrubMessage(d.message);
			return message === d.message ? d : { ...d, message };
		}
		const seen = placeholder.slice(d.offset, d.offset! + d.length);
		const tagText = text.slice(tag.start, tag.end);
		const message = scrubMessage(seen.length > 0 ? d.message.split(`'${seen}'`).join(`'${tagText}'`) : d.message);
		const pos = docPosAt(text, tag.start);
		const widened = {
			...d,
			message,
			offset: tag.start,
			length: tag.end - tag.start,
			line: pos.line,
			column: pos.column,
		};
		const existing = bySegment.get(tag);
		if (existing) existing.push(widened);
		else bySegment.set(tag, [widened]);
		return widened;
	});
	return { diagnostics, bySegment };
}

/**
 * Re-read every `{% macro %}` body as an SQL fragment. The whole-file statement parse's
 * diagnostics are replaced wholesale: they are recovery noise once a body has derailed it
 * (a body that is a CASE expression leaves "missing 'CASE' at EOF" far outside itself).
 * What replaces them: the text OUTSIDE the macro bodies read as a statement batch (a model
 * file that also defines a macro keeps its real errors). Lexer diagnostics (offset-less)
 * are kept as they are. Each region learns what its body is (`body`); a body that reads
 * clean as none of the kinds carries NO diagnostic and no verdict: a body is whatever gets
 * pasted at the call site (a clause tail led by a keyword hole has no reading and never
 * will), so "matches no known shape" is not evidence of invalid SQL (never-wrong). Mutates
 * the regions' `body` field only. Files without a macro region are untouched.
 */
function reparseMacroBodies(
	regions: TemplateRegion[],
	diagnostics: SyntaxDiagnostic[],
	placeholder: string,
	fragments: () => FragmentSession,
): SyntaxDiagnostic[] {
	const macros: TemplateRegion[] = [];
	// Macros can sit under an if/for (a guarded definition); a macro inside a macro body is
	// covered by the outer body's read and not visited on its own.
	const visit = (list: TemplateRegion[]): void => {
		for (const region of list) {
			if (region.kind === "macro") macros.push(region);
			else for (const arm of region.arms) visit(arm.children);
		}
	};
	visit(regions);
	if (macros.length === 0) return diagnostics;

	const bodies: FragmentRange[] = [];
	for (const region of macros) {
		const arm = region.arms[0];
		if (!arm) continue;
		// An unclosed macro (mid-edit, no endmacro yet) closes at its own opening tag with an empty
		// body; its SQL runs to the end of the text, so that is what gets read.
		const unclosed = arm.bodySpan.end <= arm.bodySpan.start && region.span.end === arm.tagSpan.end;
		const body: FragmentRange = unclosed ? { start: arm.tagSpan.end, end: placeholder.length } : arm.bodySpan;
		if (body.end <= body.start) continue;
		bodies.push(body);
		const verdict = fragments().verdict([body]);
		if (verdict) region.body = verdict;
	}

	// The remainder: everything between the bodies, as the statement batch it always was.
	const remainder: FragmentRange[] = [];
	let at = 0;
	for (const body of [...bodies].sort((a, b) => a.start - b.start)) {
		if (body.start > at) remainder.push({ start: at, end: body.start });
		at = Math.max(at, body.end);
	}
	if (at < placeholder.length) remainder.push({ start: at, end: placeholder.length });
	const rest = fragments().parse(remainder, ["statement"]);

	return [...diagnostics.filter((d) => d.offset === undefined), ...(rest?.diagnostics ?? [])];
}

/** Insert a hidden WS-shaped token over every gap in the source-ordered stream whose original text
 *  is not pure whitespace (see the call site). Mutates `tokens` in place, keeping it sorted. */
function fillDeadGaps(tokens: Token[], text: string): void {
	const out: Token[] = [];
	let at = 0;
	const fill = (start: number, end: number): void => {
		const slice = text.slice(start, end);
		if (slice.trim().length === 0) return;
		const pos = docPosAt(text, start);
		const endPos = endPosition(pos.line, pos.column, slice);
		out.push({
			type: 0, // antlr's INVALID_TYPE: no lexer rule produced this token
			name: "WS",
			text: slice,
			start,
			stop: end - 1,
			line: pos.line,
			column: pos.column,
			endLine: endPos.endLine,
			endColumn: endPos.endColumn,
			channel: 1,
			role: "whitespace",
		});
	};
	for (const tok of tokens) {
		if (tok.start > at) fill(at, tok.start);
		out.push(tok);
		at = Math.max(at, tok.stop + 1);
	}
	if (at < text.length) fill(at, text.length);
	if (out.length !== tokens.length) tokens.splice(0, tokens.length, ...out);
}

/** Fragment verdict → the provider's shape vocabulary (`MacroShape.shapes`). */
const VERDICT_SHAPE: Record<FragmentKind, ExpansionShape> = {
	statement: "statement",
	expression: "expr",
	tableSource: "relation",
	cteList: "cte-definition",
	selectList: "column-list",
};

/** The keyword a leading hole's jinja `default('…')` filter names → the clause shape it opens. */
const DEFAULT_KEYWORD_SHAPE: Record<string, ExpansionShape> = {
	where: "where-clause",
	and: "conjunct",
	or: "conjunct",
};

/**
 * `MacroShape` for every macro region, read from the text alone. Three sources, all in-text:
 *   1. the body's fragment verdict (`region.body`), mapped 1:1;
 *   2. a body led by a `{{ x|default('where') }}`-style hole: the default literal is the
 *      keyword the body opens with (`where` → where-clause, `and`/`or` → conjunct);
 *   3. control flow: when every SQL byte of the body sits under `if` regions that have no
 *      `else` arm, the macro can render to nothing → `nothing`, last.
 * Anything else stays out (never-wrong): a hole with no visible default, a return-only body.
 */
function macroShapesOf(
	regions: TemplateRegion[],
	tags: TagNode[],
	text: string,
	placeholder: string,
	fragments: () => FragmentSession,
): MacroShape[] {
	const out: MacroShape[] = [];
	const visit = (list: TemplateRegion[]): void => {
		for (const region of list) {
			if (region.kind !== "macro") {
				for (const arm of region.arms) visit(arm.children);
				continue;
			}
			const arm = region.arms[0];
			const open = tags.find(
				(t): t is Extract<TagNode, { kind: "control" }> =>
					t.kind === "control" && t.keyword === "macro" && t.tagSpan.start === region.span.start,
			);
			if (!arm || !open?.name || !open.nameSpan) continue;
			const shapes: ExpansionShape[] = [];
			let keywordParam: MacroShape["keywordParam"];
			if (region.body) shapes.push(VERDICT_SHAPE[region.body]);
			else {
				// A body opening with a hole: `{{ name }}` / `{{ name|default('kw') }}`, `name` one of
				// the macro's declared parameters. The signature's args are `name` or `name=default`
				// (the jinja-standard default spelling); the filter default wins over the signature's.
				const lead = leadingHole(arm.bodySpan, tags, placeholder);
				const holeText = lead ? text.slice(lead.tagSpan.start, lead.tagSpan.end) : "";
				const bound = /^\{\{-?\s*([A-Za-z_]\w*)\s*(?:\||-?\}\})/.exec(holeText)?.[1];
				const params = (open.calls[0]?.args ?? []).map((a) =>
					signatureParam(text.slice(a.span.start, a.span.end)),
				);
				const index = bound === undefined ? -1 : params.findIndex((p) => p?.name === bound);
				const fallback = /\|\s*default\(\s*['"](\w+)['"]\s*\)/.exec(holeText)?.[1] ?? params[index]?.default;
				if (bound !== undefined && index >= 0) {
					keywordParam = { name: bound, index, ...(fallback !== undefined ? { default: fallback } : {}) };
				}
				const clause = fallback ? DEFAULT_KEYWORD_SHAPE[fallback.toLowerCase()] : undefined;
				if (clause) shapes.push(clause);
				// A body that literally opens with the clause keyword (`and {{ c }} = 0`): the shape the
				// same word resolves to through a hole, provided the rest reads as an expression.
				if (!lead) {
					const led = leadingKeyword(arm.bodySpan, placeholder);
					if (led && fragments().verdict([{ start: led.end, end: arm.bodySpan.end }], ["expression"])) {
						shapes.push(DEFAULT_KEYWORD_SHAPE[led.word]);
					}
				}
			}
			if ((shapes.length > 0 || keywordParam) && rendersToNothing(arm, placeholder)) shapes.push("nothing");
			out.push({
				name: open.name,
				nameSpan: open.nameSpan,
				span: region.span,
				shapes,
				...(keywordParam ? { keywordParam } : {}),
			});
		}
	};
	visit(regions);
	return out;
}

/**
 * The shapes a specific CALL of a macro takes: `macro.shapes`, with the keyword-parameter hole
 * (if any) resolved from the call's own literal argument (positional or keyword) or the
 * parameter's default. A call whose keyword is not a literal, or names a word that opens no
 * known clause, resolves to nothing for that hole (never-wrong). Pure: definition text + call
 * text, no project knowledge; a host's `shapeOf(call)` is `shapesForCall(index.get(call.name), call)`.
 */
export function shapesForCall(macro: MacroShape, call: TemplateCall): ExpansionShape[] {
	const kp = macro.keywordParam;
	if (!kp) return macro.shapes;
	const kwarg = call.kwargs?.find((k) => k.name === kp.name)?.value;
	const positional = call.args[kp.index];
	const word = (kwarg ?? positional ?? kp.default)?.toLowerCase();
	const clause = word !== undefined ? DEFAULT_KEYWORD_SHAPE[word] : undefined;
	const rest = macro.shapes.filter((s) => s !== "where-clause" && s !== "conjunct");
	return clause ? [clause, ...rest] : rest;
}

/** One signature argument, `name` or `name=default` (a quoted string default is unquoted). */
function signatureParam(argText: string): { name: string; default?: string } | undefined {
	const m = /^\s*([A-Za-z_]\w*)\s*(?:=\s*(.+?))?\s*$/s.exec(argText);
	if (!m) return undefined;
	const raw = m[2];
	const literal = raw === undefined ? undefined : /^(['\"])(.*)\1$/s.exec(raw)?.[2];
	return { name: m[1], ...(literal !== undefined ? { default: literal } : {}) };
}

/** A clause keyword (`and`/`or`/`where`) opening the body, past whitespace and `--` comment lines:
 *  the word (lowercased) and the offset just past it. */
function leadingKeyword(body: PartSpan, placeholder: string): { word: string; end: number } | undefined {
	const slice = placeholder.slice(body.start, body.end);
	const m = /^(?:\s|--[^\n]*\n)*(and|or|where)\b/i.exec(slice);
	return m ? { word: m[1].toLowerCase(), end: body.start + m[0].length } : undefined;
}

/** The expression tag at the very start of a body (only whitespace, comments and control tags
 *  before it in the placeholder), or undefined when the body opens with SQL. */
function leadingHole(body: PartSpan, tags: TagNode[], placeholder: string): TagNode | undefined {
	const first = placeholder.slice(body.start, body.end).search(/\S/);
	if (first === -1) return undefined;
	const at = body.start + first;
	return tags.find((t) => (t.kind === "call" || t.kind === "other") && t.tagSpan.start <= at && at < t.tagSpan.end);
}

/** True when every non-whitespace placeholder byte of the arm's body lies inside an `if` child
 *  region that has no `else` arm: nothing outside such regions, so the macro can render empty. */
function rendersToNothing(arm: TemplateArm, placeholder: string): boolean {
	const optional = arm.children.filter((c) => c.kind === "if" && !c.arms.some((a) => a.keyword === "else"));
	if (optional.length === 0) return false;
	const chars = placeholder.slice(arm.bodySpan.start, arm.bodySpan.end).split("");
	for (const c of optional) {
		for (let k = c.span.start; k < c.span.end; k++) chars[k - arm.bodySpan.start] = " ";
	}
	return chars.join("").trim().length === 0;
}

/** The core build — total by construction (every composed piece is total). */
function build(text: string, dialect: Dialect, provider: TemplateProvider): TemplatedParseResult {
	const { segments, placeholder, tagTokens } = segment(text, provider);

	// Step 3: lex the placeholder with the UNTOUCHED per-dialect SQL entry. Its
	// tokens are already in original document coordinates (length preservation).
	const sql = parse(placeholder, dialect);

	const tagRanges = segments.filter((s): s is Extract<Segment, { kind: "tag" }> => s.kind === "tag");

	// Step 4a: clip the placeholder's filler tokens out of the tag regions (drop
	// the parts inside a tag; keep any real SQL a token fused across the boundary).
	// INVARIANT: an SQL-side token's text is ALWAYS the ORIGINAL document slice at its
	// span — the placeholder is engine-internal. Normally identical, but a statically-dead
	// loop arm (single-representative-iteration realization) is blanked in the placeholder
	// while the stream must still reconstruct the source byte-for-byte: its content rides
	// as hidden trivia carrying the true text (dead text as trivia — the honest model).
	const sqlTokens: Token[] = [];
	for (const t of sql.tokens) {
		for (const clipped of clipToTagBoundaries(t, tagRanges, text)) {
			sqlTokens.push(
				clipped.text === text.slice(clipped.start, clipped.stop + 1)
					? clipped
					: { ...clipped, text: text.slice(clipped.start, clipped.stop + 1) },
			);
		}
	}

	// Step 4b: map each tag's document-native token slice onto channel 2.
	// Step 5 (R2): parse that SAME slice (parseSliceTag — no re-lex) and build its
	// ref/source/macro tag-AST node; its diagnostics are already document-positioned
	// (the offending tokens are), so they're pushed straight through — no offset
	// step. Both ride the same per-tag loop (each piece is total — never throws).
	const jinjaTokens: Token[] = [];
	const tags: TagNode[] = [];
	const jinjaDiagnostics: SyntaxDiagnostic[] = [];
	// Task 10: the direct tag↔diagnostics join, built alongside `tags` (no span
	// matching needed — `seg`/`tag` are already in hand together in this loop).
	const segToTag = new Map<TagSegment, TagNode>();
	const diagsByTag = new Map<TagNode, SyntaxDiagnostic[]>();
	for (const seg of tagRanges) {
		const slice = tagTokens.get(seg) ?? [];
		for (const tok of slice) {
			if (tok.type === AntlrToken.EOF) continue; // shouldn't appear in a slice — defensive
			jinjaTokens.push(mapSliceToken(tok));
		}

		const { tree, diagnostics } = parseSliceTag(slice);
		const tag = tagNodesOf(seg, tree, slice);
		if (tag) {
			tags.push(tag);
			segToTag.set(seg, tag);
			if (diagnostics.length > 0) diagsByTag.set(tag, [...diagnostics]);
		}
		jinjaDiagnostics.push(...diagnostics);
	}

	// Step 5b (R3): rewrite templated FROM/JOIN sources onto first-class TableSource
	// nodes carrying the provider-resolved relation name and a `template` marker, so
	// scope/qualify/lineage bind the real relation rather than the `jjj…` placeholder.
	// Total (returns the input ast on any surprise); the reassignment stays inside
	// build()'s caller try/catch so parseTemplated's totality holds. `correlation`
	// carries the Task 10 tag to IR-node join collected while rebuilding.
	const correlation = applyTemplateTags(sql.ast, tags, text, provider);
	const sqlResult = { ...sql, ast: correlation.ast };

	// Step 4c: merge into one source-ordered stream. SQL and jinja token spans are
	// disjoint (tag-contained SQL tokens were dropped), so a stable sort by start
	// (stop as tiebreak) tiles the source.
	const tokens = [...sqlTokens, ...jinjaTokens].sort((a, b) => a.start - b.start || a.stop - b.stop);
	// Dead text with no carrier: the statically-dead loop arm above rides as trivia ONLY when an SQL
	// token covers its blanked span. A dialect whose whitespace rule is `-> skip` (tsql) lexes no
	// token over an all-space span, so the arm's true text (`union all`, a trailing `,`) would fall
	// out of the stream. Every uncovered gap holding non-whitespace source text gets a synthesized
	// hidden trivia token carrying that text, the same shape the carrier token takes elsewhere.
	fillDeadGaps(tokens, text);

	// Diagnostics: SQL + jinja, both already in document coordinates, source-ordered
	// so squiggles line up with the merged stream. SQL diagnostics whose offending
	// token is a placeholder fill are scrubbed first — the message quotes the ORIGINAL
	// tag text (never `jjj…` gibberish) and the span widens to the whole tag, which is
	// the true offending unit the user can act on. The scrubbed set ALSO replaces the
	// embedded sql result's own diagnostics: that object is ParseResultIR-shaped — the
	// surface a consumer naturally reads — and the raw fill-quoting messages are
	// engine-internal, never public (the gold__vendor F5 leak, 2026-07-06: the raw
	// "mismatched input 'jjjj…'" reached a user's screen through sql.diagnostics).
	// Step 6 (R4): pair the control tags into regions + extract set/macro symbols.
	// Both are total; they ride inside build()'s caller try/catch for totality.
	const regions = templateRegions(tags, text);
	const symbols = templateSymbols(tags);

	// Macro bodies (issue #48): a `{% macro %}` body is whatever gets pasted at the call site,
	// so the whole-file statement parse is the wrong reading for most of them. Each top-level
	// macro body is re-read from the placeholder as a fragment (statement, expression, FROM-slot
	// source, CTE list, select list; src/fragment.ts) and its own diagnostics replace whatever
	// the statement parse reported inside that body. The IR and tokens stay the whole-file
	// parse's: the fragment verdict rides the region as `body`.
	// One lex of the placeholder, opened on first use, shared by both macro passes.
	let session: FragmentSession | undefined;
	const fragments = (): FragmentSession => (session ??= openFragments(placeholder, dialect));
	const sqlDiagnostics = reparseMacroBodies(regions, sqlResult.diagnostics, placeholder, fragments);
	const macros = macroShapesOf(regions, tags, text, placeholder, fragments);

	const { diagnostics: scrubbed, bySegment } = scrubPlaceholderDiagnostics(
		sqlDiagnostics,
		tagRanges,
		text,
		placeholder,
	);
	// Fold the scrubbed SQL diagnostics into the same per-tag map as the jinja ones
	// (Task 10) — a tag's diagnostics are its own jinja parse errors PLUS whatever
	// SQL diagnostics the scrubber widened onto it.
	for (const [seg, widened] of bySegment) {
		const tag = segToTag.get(seg);
		if (!tag) continue;
		const existing = diagsByTag.get(tag);
		if (existing) existing.push(...widened);
		else diagsByTag.set(tag, [...widened]);
	}
	const finalSql = { ...sqlResult, diagnostics: scrubbed };
	const diagnostics = [...scrubbed, ...jinjaDiagnostics].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));

	return {
		tokens,
		sql: finalSql,
		tags,
		regions,
		symbols,
		macros,
		diagnostics,
		placeholder,
		tagOf: (node: object) => correlation.byNode.get(node),
		nodeOf: (tag: TagNode) => correlation.byTag.get(tag),
		diagnosticsOf: (tag: TagNode) => diagsByTag.get(tag) ?? [],
	};
}

/**
 * Parse raw jinja-SQL: one whole-document jinja lex (segment()), the untouched
 * per-dialect SQL parse over the resulting placeholder, a per-tag jinja parse over
 * each tag's document-native token slice, and a merged source-ordered token stream
 * (SQL channel 0 + jinja channel 2). Total — never throws on any input, including
 * broken mid-edit jinja (R5).
 */
export function parseTemplated(text: string, dialect: Dialect, opts?: TemplatedParseOptions): TemplatedParseResult {
	try {
		return build(text, dialect, opts?.provider ?? OPEN_PROVIDER);
	} catch (e) {
		// Defense-in-depth: degrade to the whole text as plain SQL, jinja empty.
		// parse() is itself total, so this is the safe floor.
		debugRethrow(e);
		const sql = parse(text, dialect);
		return {
			tokens: sql.tokens,
			sql,
			tags: [],
			regions: [],
			symbols: [],
			macros: [],
			diagnostics: sql.diagnostics,
			placeholder: text,
			degraded: true,
			...noCorrelation(),
		};
	}
}

/**
 * The unified source-ordered token stream for raw jinja-SQL — the token-only view
 * of parseTemplated. Total — never throws.
 */
export function tokenizeTemplated(text: string, dialect: Dialect, opts?: TemplatedParseOptions): Token[] {
	return parseTemplated(text, dialect, opts).tokens;
}

/**
 * One statement cell of a templated document (`TemplateEngine.parseCell`): the plain per-dialect
 * parse of the placeholder slice `[span.start, span.end)`, the same batch-of-one path a plain
 * document's cells take, so IR / CST / tokens / diagnostics are CELL-relative, with `whole`'s tags
 * correlated onto it by DOCUMENT offset (a node's cell offset plus the cell's start). The cell's
 * sources then carry their provider-resolved names and `template` markers exactly as the
 * whole-text parse's do, never the fill; a marker's `span` is rebased to cell coordinates like
 * every other span in the cell IR, while `tagOf`/`nodeOf` answer with `whole.tags`'s own nodes.
 * Total: `applyTemplateTags` leaves the plain parse in place on any internal surprise.
 */
export function parseTemplatedCell(
	whole: TemplatedParseResult,
	span: { start: number; end: number },
	text: string,
	dialect: Dialect,
	opts?: TemplatedParseOptions,
): TemplatedCellResult {
	const sql = parse(whole.placeholder.slice(span.start, span.end), dialect);
	const provider = opts?.provider ?? OPEN_PROVIDER;
	const correlation = applyTemplateTags(sql.ast, whole.tags, text, provider, cellBaseOf(text, span.start));
	return {
		sql: { ...sql, ast: correlation.ast },
		tagOf: (node) => correlation.byNode.get(node),
		nodeOf: (tag) => correlation.byTag.get(tag),
	};
}

/** The cell start's 0-based line / column / char offset in `text` (`\n` is the line break, the
 *  convention every span in the pipeline follows; a `\r` is an ordinary column). */
function cellBaseOf(text: string, offset: number): CellBase {
	let line = 0;
	let lineStart = 0;
	for (let i = 0; i < offset; i++) {
		if (text.charCodeAt(i) === 10) {
			line++;
			lineStart = i + 1;
		}
	}
	return { line, column: offset - lineStart, offset };
}
