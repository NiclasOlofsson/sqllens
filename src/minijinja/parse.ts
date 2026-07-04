// ---------------------------------------------------------------------------
// Task 3 — parseTemplated / tokenizeTemplated: the unified SQL+jinja token stream
// (docs/minijinja-front-end.md §mechanism steps 3-6, §R1 — the inc1 deliverable).
//
// This is the INTEGRATION stage. It composes three pieces that each stay in their
// lane:
//   1. segment()      (Task 2) — split raw jinja-SQL over the OUTER jinja language
//                     into SQL runs + tag runs, and build the length-/newline-
//                     preserving placeholder string.
//   2. parse()        (src/api.ts, UNTOUCHED) — the existing per-dialect SQL entry,
//                     run over the placeholder. Because the placeholder occupies
//                     each tag's EXACT char range and preserves every `\n`, every
//                     antlr start/stop/line/column it returns is already in ORIGINAL
//                     document coordinates — no span remap for SQL tokens.
//   3. lexMinijinjaTag()  (Task 1 / parse-tag.ts) — lex each tag's text with the jinja
//                     island lexer; parse.ts offsets those tag-relative tokens into
//                     document coordinates and stamps channel 2 / role "minijinja".
//
// The merge (step 4): one source-ordered Token[] = SQL tokens (channel 0) + jinja
// tokens (channel 2), sorted by start. The placeholder's FILLER tokens inside a
// tag region (the `jjj` identifiers / whitespace the SQL lexer produced for the
// placeholder) are GARBAGE — the jinja tokens replace them — so each SQL token is
// CLIPPED to the parts OUTSIDE the tag regions: a token fully inside a tag drops,
// one straddling a tag edge keeps only its outside remainder (a whitespace-fill
// tag can fuse with an adjacent real newline into one WS token). The result tiles
// the source.
//
// Total (R5, step 6): the whole build is wrapped so no input — including a half-
// typed `{{ ref(` — ever throws. Each composed piece is already total (segment,
// the SQL parse, the jinja lexer all recover rather than throw); the try/catch is
// defense-in-depth, degrading worst-case to the whole text as plain SQL with no
// jinja tokens.
//
// The eight SQL grammars are UNTOUCHED: jinja is a pre-stage that WRAPS parse();
// parseTemplated is NOT a `DIALECTS` entry. The merge happens on the Token[]
// outside antlr's lazy token buffer, so no dialect parse.ts is touched.
// ---------------------------------------------------------------------------

import { Token as AntlrToken } from "antlr4ng";
import { parse, type Dialect, type ParseResultIR } from "../api.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import { classifyMinijinjaToken } from "../token/classify.js";
import type { Token } from "../token/token.js";
import { applyTemplateTags } from "./apply-tags.js";
import { lexMinijinjaTag, parseMinijinjaTag } from "./parse-tag.js";
import { templateRegions, templateSymbols, type TemplateRegion, type TemplateSymbol } from "./regions.js";
import { segment, type Segment } from "./segment.js";
import { tagNodesOf, type TagNode } from "./tag-ast.js";

// Re-export the R2 tag-AST union (Task 4) so `src/index.ts` keeps re-exporting
// TagNode from this module — the union now lives in ./tag-ast.js.
export type { TagNode } from "./tag-ast.js";
// Re-export the R4 region / symbol shapes (Task 3) so the barrel re-exports them here.
export type { TemplateRegion, TemplateArm, TemplateSymbol } from "./regions.js";
export { templateRegions, templateSymbols } from "./regions.js";

/** The unified result of parsing raw jinja-SQL: one token stream + the SQL parse + tags. */
export interface TemplatedParseResult {
	/** ONE source-ordered stream: SQL tokens (channel 0) + jinja tokens (channel 2, role "minijinja"). */
	tokens: Token[];
	/** The underlying SQL parse over the placeholder (ast / cst / errors / diagnostics). */
	sql: ParseResultIR;
	/** R2 tag nodes. Task 4 fills these; Task 3 leaves them empty. */
	tags: TagNode[];
	/** R4 control-flow regions (if/for/macro), stack-paired from the control tags. */
	regions: TemplateRegion[];
	/** R4 go-to-def template symbols (set targets / macro names). */
	symbols: TemplateSymbol[];
	/** SQL diagnostics (+ jinja diagnostics from Task 4), positioned in original coordinates. */
	diagnostics: SyntaxDiagnostic[];
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
 * Shift a tag-relative jinja parse diagnostic into document coordinates: offset
 * by the tag's document start, line/column composed with the tag's anchor (a
 * first-line diagnostic adds the anchor column; a later-line one keeps its own).
 * Mirrors mapMinijinjaToken's line/column composition so squiggles land correctly on
 * multi-line tags.
 */
function offsetDiagnostic(d: SyntaxDiagnostic, tagStart: number, base: DocPos): SyntaxDiagnostic {
	return {
		message: d.message,
		line: base.line + (d.line - 1),
		column: d.line === 1 ? base.column + d.column : d.column,
		offset: d.offset === undefined ? undefined : tagStart + d.offset,
		length: d.length,
	};
}

/**
 * Map one jinja lexer token (tag-relative coordinates) to a neutral document
 * Token: offsets shifted by the tag's document start, line/column composed with
 * the tag's document anchor, channel 2, role "minijinja". `base` is the tag start's
 * document line/column; a token on the tag's first line adds the anchor column, a
 * token on a later line already sits at its own absolute column.
 */
function mapMinijinjaToken(
	lexer: ReturnType<typeof lexMinijinjaTag>["lexer"],
	tok: AntlrToken,
	tagStart: number,
	base: DocPos,
): Token {
	const name =
		lexer.vocabulary.getSymbolicName(tok.type) ?? lexer.vocabulary.getDisplayName(tok.type) ?? String(tok.type);
	const onFirstLine = tok.line === 1;
	return {
		type: tok.type,
		name,
		text: tok.text ?? "",
		start: tagStart + tok.start,
		stop: tagStart + tok.stop,
		line: base.line + (tok.line - 1),
		column: onFirstLine ? base.column + tok.column : tok.column,
		channel: 2,
		role: classifyMinijinjaToken(lexer, tok.type),
	};
}

/** A clipped copy of an SQL token covering only the inclusive [a,b] sub-span. */
function sliceToken(tok: Token, a: number, b: number, text: string): Token {
	if (a === tok.start && b === tok.stop) return tok; // whole token — identity
	const pos = docPosAt(text, a);
	return {
		...tok,
		text: tok.text.slice(a - tok.start, b - tok.start + 1),
		start: a,
		stop: b,
		line: pos.line,
		column: pos.column,
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

/** The core build — total by construction (every composed piece is total). */
function build(text: string, dialect: Dialect): TemplatedParseResult {
	const { segments, placeholder } = segment(text);

	// Step 3: lex the placeholder with the UNTOUCHED per-dialect SQL entry. Its
	// tokens are already in original document coordinates (length preservation).
	const sql = parse(placeholder, dialect);

	const tagRanges = segments.filter((s): s is Extract<Segment, { kind: "tag" }> => s.kind === "tag");

	// Step 4a: clip the placeholder's filler tokens out of the tag regions (drop
	// the parts inside a tag; keep any real SQL a token fused across the boundary).
	const sqlTokens: Token[] = [];
	for (const t of sql.tokens) {
		for (const clipped of clipToTagBoundaries(t, tagRanges, text)) sqlTokens.push(clipped);
	}

	// Step 4b: lex each tag and map its tokens into document coords on channel 2.
	// Step 5 (R2): parse each tag and build its ref/source/macro tag-AST node +
	// offset the jinja parse diagnostics into document coordinates. Both ride the
	// same per-tag loop (each piece is total — never throws).
	const jinjaTokens: Token[] = [];
	const tags: TagNode[] = [];
	const jinjaDiagnostics: SyntaxDiagnostic[] = [];
	for (const seg of tagRanges) {
		const base = docPosAt(text, seg.start);

		const { lexer, tokens } = lexMinijinjaTag(seg.text);
		for (const tok of tokens) {
			if (tok.type === AntlrToken.EOF) continue;
			jinjaTokens.push(mapMinijinjaToken(lexer, tok, seg.start, base));
		}

		const { tree, diagnostics } = parseMinijinjaTag(seg.text);
		const node = tagNodesOf(seg, tree, base);
		if (node) tags.push(node);
		for (const d of diagnostics) jinjaDiagnostics.push(offsetDiagnostic(d, seg.start, base));
	}

	// Step 5b (R3): rewrite templated FROM/JOIN sources onto first-class TableSource
	// nodes carrying the dbt-logical model/source name + a `template` marker, so
	// scope/qualify/lineage bind the real model rather than the `jjj…` placeholder.
	// Total (returns the input ast on any surprise); the reassignment stays inside
	// build()'s caller try/catch so parseTemplated's totality holds.
	sql.ast = applyTemplateTags(sql.ast, tags);

	// Step 4c: merge into one source-ordered stream. SQL and jinja token spans are
	// disjoint (tag-contained SQL tokens were dropped), so a stable sort by start
	// (stop as tiebreak) tiles the source.
	const tokens = [...sqlTokens, ...jinjaTokens].sort((a, b) => a.start - b.start || a.stop - b.stop);

	// Diagnostics: SQL (original coords) + jinja (offset into document coords),
	// source-ordered so squiggles line up with the merged stream.
	const diagnostics = [...sql.diagnostics, ...jinjaDiagnostics].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));

	// Step 6 (R4): pair the control tags into regions + extract set/macro symbols.
	// Both are total; they ride inside build()'s caller try/catch for totality.
	const regions = templateRegions(tags, text);
	const symbols = templateSymbols(tags);

	return { tokens, sql, tags, regions, symbols, diagnostics };
}

/**
 * Parse raw jinja-SQL: segment over the outer jinja language, lex the placeholder
 * with the untouched SQL lexer, lex each tag with the jinja island lexer, and
 * merge one source-ordered token stream (SQL channel 0 + jinja channel 2). Total —
 * never throws on any input, including broken mid-edit jinja (R5).
 */
export function parseTemplated(text: string, dialect: Dialect): TemplatedParseResult {
	try {
		return build(text, dialect);
	} catch {
		// Defense-in-depth: degrade to the whole text as plain SQL, jinja empty.
		// parse() is itself total, so this is the safe floor.
		const sql = parse(text, dialect);
		return { tokens: sql.tokens, sql, tags: [], regions: [], symbols: [], diagnostics: sql.diagnostics };
	}
}

/**
 * The unified source-ordered token stream for raw jinja-SQL — the token-only view
 * of parseTemplated. Total — never throws.
 */
export function tokenizeTemplated(text: string, dialect: Dialect): Token[] {
	return parseTemplated(text, dialect).tokens;
}
