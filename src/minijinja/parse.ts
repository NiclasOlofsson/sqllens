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
import { endPosition } from "../ir/span.js";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";
import { classifyMinijinjaToken } from "../token/classify.js";
import type { Token } from "../token/token.js";
import { applyTemplateTags } from "./apply-tags.js";
import { templateRegions, templateSymbols } from "./regions.js";
import { OPEN_PROVIDER, type TemplateProvider } from "../qualify/template-provider.js";
import { segment, type Segment } from "./segment.js";
import { tagNodesOf, type TagNode } from "./tag-ast.js";
import type { TemplatedParseOptions, TemplatedParseResult } from "../template/engine.js";

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
export type { TemplatedParseOptions, TemplatedParseResult } from "../template/engine.js";

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

/**
 * Scrub placeholder gibberish out of SQL syntax diagnostics. A diagnostic whose
 * offending token starts inside a tag range is really complaining about the TAG:
 * rewrite every occurrence of the placeholder token's text in the message with the
 * tag's original source text, and widen offset/length (+ line/column) to the whole
 * tag. Diagnostics outside every tag pass through untouched. `bySegment` carries the
 * widened diagnostics keyed by the owning tag segment — build() maps that back to a
 * TagNode for `diagnosticsOf`.
 */
function scrubPlaceholderDiagnostics(
	diags: SyntaxDiagnostic[],
	tagRanges: readonly TagSegment[],
	text: string,
	placeholder: string,
): { diagnostics: SyntaxDiagnostic[]; bySegment: Map<TagSegment, SyntaxDiagnostic[]> } {
	const bySegment = new Map<TagSegment, SyntaxDiagnostic[]>();
	if (tagRanges.length === 0) return { diagnostics: diags, bySegment };
	const diagnostics = diags.map((d) => {
		if (d.offset === undefined) return d;
		const tag = tagRanges.find((s) => d.offset! >= s.start && d.offset! < s.end);
		if (!tag) return d;
		const seen = placeholder.slice(d.offset, d.offset + d.length);
		const tagText = text.slice(tag.start, tag.end);
		const message = seen.length > 0 ? d.message.split(`'${seen}'`).join(`'${tagText}'`) : d.message;
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

	// Diagnostics: SQL + jinja, both already in document coordinates, source-ordered
	// so squiggles line up with the merged stream. SQL diagnostics whose offending
	// token is a placeholder fill are scrubbed first — the message quotes the ORIGINAL
	// tag text (never `jjj…` gibberish) and the span widens to the whole tag, which is
	// the true offending unit the user can act on. The scrubbed set ALSO replaces the
	// embedded sql result's own diagnostics: that object is ParseResultIR-shaped — the
	// surface a consumer naturally reads — and the raw fill-quoting messages are
	// engine-internal, never public (the gold__vendor F5 leak, 2026-07-06: the raw
	// "mismatched input 'jjjj…'" reached a user's screen through sql.diagnostics).
	const { diagnostics: scrubbed, bySegment } = scrubPlaceholderDiagnostics(
		sqlResult.diagnostics,
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

	// Step 6 (R4): pair the control tags into regions + extract set/macro symbols.
	// Both are total; they ride inside build()'s caller try/catch for totality.
	const regions = templateRegions(tags, text);
	const symbols = templateSymbols(tags);

	return {
		tokens,
		sql: finalSql,
		tags,
		regions,
		symbols,
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
