// ---------------------------------------------------------------------------
// Task 2 — the document-level segmenter + placeholder substitution
// (docs/minijinja-front-end.md §mechanism steps 1-2). Driven by ONE whole-document
// tokenization from the minijinja island lexer (grammars/minijinja/MinijinjaLexer.g4):
// it walks the token stream over the OUTER jinja language, finds where tags
// start/end, and builds the length- and newline-preserving placeholder string
// the untouched per-dialect SQL lexer will see.
//
// The load-bearing invariant: every placeholder occupies the EXACT [start,end)
// char range of the tag it replaces AND preserves every `\n` at its original
// offset, so antlr start/stop/line/column for SQL tokens stay in original
// document coordinates with no remap (global-constraints §length + newline).
//
// Jinja is the OUTER language: a `{{ }}` inside what LOOKS like a SQL string is
// a real jinja tag (dbt renders into SQL strings). The lexer respects only
// JINJA's own nesting — string literals inside a tag's expression, `{% raw %}`
// literal blocks, and `{# #}` comments — never SQL string/comment boundaries.
//
// Total: unterminated tag/string is treated to EOF as that tag; never throws.
// ---------------------------------------------------------------------------

import { CharStream, Token as AntlrToken } from "antlr4ng";
import { MinijinjaLexer } from "../generated/minijinja/MinijinjaLexer.js";
import type { ExpansionShape } from "../qualify/template-catalog.js";

export type Segment =
	| { kind: "sql"; start: number; end: number }
	| {
			kind: "tag";
			tagKind: "expr" | "stmt" | "comment";
			start: number;
			end: number;
			text: string;
	  };

/**
 * A synchronous, by-name syntactic-slot lookup for a MACRO call (inc3.2). The catalog's
 * `expansionShape` bound into a bare callback, so `segment` stays decoupled from the catalog type — it
 * only knows the shape vocabulary, never the `TemplateCatalog` interface. `undefined` = no shape known
 * (fall back to the positional fill). Only macro-call expr tags consult it (ref/source/var/no-output
 * builtins keep their existing fill — they already parse).
 */
export type ShapeOf = (call: { name: string; parts?: string[] }) => ExpansionShape | undefined;

export interface SegmentResult {
	/** Source order, tiling (contiguous, cover [0, text.length)). */
	segments: Segment[];
	/** Same length + same newline positions as the input. */
	placeholder: string;
	/**
	 * Pipeline-internal (parse.ts consumes it; NOT part of the placeholder/segments public
	 * contract — the golden gate only serializes `segments`/`placeholder`). Every tag segment's
	 * FULL token slice from the one whole-document tokenization: the OPEN token, every token
	 * between it and the CLOSE (ALL channels, hidden JWS included), and the CLOSE token when
	 * present (absent on an unterminated tag). Keyed by tag segment object IDENTITY, same pattern
	 * as the internal `leadingByTag` map. Lets parse.ts build each tag's channel-2 token stream and
	 * parse tree directly from this slice — already in document coordinates, no re-lex.
	 */
	tagTokens: ReadonlyMap<Segment, readonly AntlrToken[]>;
}

// ---------------------------------------------------------------------------
// The dbt builtins that emit NO SQL text. An expr tag topped by one of these
// (`{{ config(...) }}`, `{{ exceptions.raise_compiler_error(...) }}`, …) fills
// with newline-preserving whitespace, not an identifier — an identifier at
// statement position is a syntax error and config-topped models are the
// majority (spec §the hole — anvil-flagged, 2026-07-04). Exported as the single
// source of truth; Task 4's R2 classifier reuses this same set.
// ---------------------------------------------------------------------------
export const NO_OUTPUT_BUILTINS: ReadonlySet<string> = new Set([
	"config",
	"docs",
	"print",
	"log",
	"return",
	"exceptions",
]);

/**
 * The leading word + leading call of a tag, derived from its interior DEFAULT-channel tokens (never
 * re-scanned from `seg.text`). `word` is the very first identifier-shaped token after the opener — for
 * an expr tag the leading call name (`config`, `ref`, `dbt_utils` in `dbt_utils.star(…)`), for a stmt
 * tag the keyword (`if`, `for`, …); "" when none. `call` is the same leading position read as a dotted
 * callee path (`dbt_utils.star(` → `{ name: "star", parts: ["dbt_utils","star"], isCall: true }`),
 * present only when a word actually leads. `Segment` is a public type that must not gain fields, so
 * this rides in a side map (`leadingInfoOf`'s caller) instead of on the segment itself.
 */
interface LeadingInfo {
	word: string;
	call?: { name: string; parts?: string[]; isCall: boolean };
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `t.text` is optional on the antlr4ng `Token` interface; every real token here always carries it. */
function textOf(t: AntlrToken): string {
	return t.text ?? "";
}

/**
 * Compute `LeadingInfo` from a tag's interior tokens (every DEFAULT-channel token strictly between
 * the OPEN and CLOSE tokens; the close token itself is excluded by the caller's walk).
 */
function leadingInfoOf(interior: AntlrToken[]): LeadingInfo {
	let i = 0;
	const isWord = (t: AntlrToken | undefined): boolean => t !== undefined && IDENT_RE.test(textOf(t));

	const first = interior[i];
	if (!isWord(first)) return { word: "" };
	const word = textOf(first);

	const parts: string[] = [];
	for (;;) {
		const t = interior[i];
		if (!isWord(t)) break;
		parts.push(textOf(t));
		i += 1;
		const dot = interior[i];
		if (dot && dot.type === MinijinjaLexer.DOT) {
			i += 1;
			continue; // read the next path segment (`pkg . macro`)
		}
		break;
	}
	const isCall = interior[i]?.type === MinijinjaLexer.LPAREN;
	const name = parts[parts.length - 1];
	return { word, call: { name, ...(parts.length > 1 ? { parts } : {}), isCall } };
}

/** The fill character for a tag segment, or " " for a no-output/whitespace tag. */
function fillChar(seg: Extract<Segment, { kind: "tag" }>, leading: LeadingInfo): string {
	if (seg.tagKind !== "expr") return " "; // stmt / comment → whitespace to SQL
	// expr: no-output builtin → whitespace; otherwise an identifier token.
	return NO_OUTPUT_BUILTINS.has(leading.word) ? " " : "j";
}

// ---------------------------------------------------------------------------
// inc3.2 — shaped placeholders. When a catalog answers `expansionShape` for a
// macro-call tag, the single-char identifier fill (`"j"`) generalizes to a
// length-matched, shape-VALID fragment placed at the tag start, padded with
// spaces, newlines preserved — so an unknown callable at statement/CTE/predicate
// position parses instead of failing. Everything here is a no-op without a
// `shapeOf` (the zero-catalog keystone: byte-identical to the char fill above).
// ---------------------------------------------------------------------------

/** Shape → the minimal shape-valid SQL fragment. `SELECT 1` is valid across all eight dialects both as a
 *  standalone statement AND as a `(…)` CTE/subquery body (verified), so `statement`/`relation` share it;
 *  `expr` is absent — it keeps the identifier fill (handled before this table is consulted). */
const SHAPE_FRAGMENT: Record<Exclude<ExpansionShape, "expr">, string> = {
	statement: "SELECT 1",
	relation: "SELECT 1",
	predicate: "1=1",
	"column-list": "1",
};

/** dbt builtins that already parse with the identifier fill and must NOT be shaped — a buggy catalog
 *  returning a shape for `ref` must never break `from {{ ref('x') }}` (spec §only macro-call tags). The
 *  no-output builtins are already excluded via `fillChar`'s whitespace path; this set covers the
 *  value/relation builtins that get the identifier fill today. */
const SHAPE_EXCLUDED: ReadonlySet<string> = new Set(["ref", "source", "var", "env_var"]);

/**
 * The shaped fill fragment for a tag, or undefined to fall back to the positional
 * char fill. Returns a fragment ONLY for a macro-call expr tag whose `shapeOf`
 * answers a non-`expr` shape AND for which the fragment FITS: it must be no longer
 * than the tag and must contain no `\n` in its placement window (the fit guard —
 * the shaped fill is strictly an improvement, never a regression on a tag it can't
 * shape). The caller places the fragment at the tag start and pads the rest with
 * spaces, preserving every original `\n`.
 */
function shapedFill(
	seg: Extract<Segment, { kind: "tag" }>,
	shapeOf: ShapeOf,
	leading: LeadingInfo,
): string | undefined {
	if (seg.tagKind !== "expr") return undefined;
	if (NO_OUTPUT_BUILTINS.has(leading.word) || SHAPE_EXCLUDED.has(leading.word)) return undefined;
	const call = leading.call;
	if (!call || !call.isCall) return undefined; // only a real macro CALL is shaped
	const shape = shapeOf({ name: call.name, ...(call.parts ? { parts: call.parts } : {}) });
	if (!shape || shape === "expr") return undefined; // expr / unknown → identifier fill (today's default)
	const fragment = SHAPE_FRAGMENT[shape];
	// Fit guard: the fragment must fit within the tag AND before its first `\n`. seg.text[k] is the
	// document char at seg.start + k, so a `\n` at any k < fragment.length would land inside the fragment.
	if (fragment.length > seg.end - seg.start) return undefined;
	for (let k = 0; k < fragment.length; k++) {
		if (seg.text[k] === "\n") return undefined;
	}
	return fragment;
}

/** Tag-opening token type → its tag kind. */
const OPEN_TAG_KIND: ReadonlyMap<number, Extract<Segment, { kind: "tag" }>["tagKind"]> = new Map([
	[MinijinjaLexer.EXPR_OPEN, "expr"],
	[MinijinjaLexer.STMT_OPEN, "stmt"],
	[MinijinjaLexer.COMMENT_OPEN, "comment"],
]);

/**
 * Tag-opening token type → the token types that end it. Expr and stmt tags share the `Minijinja`
 * interior mode, where BOTH close tokens live and either one pops the mode — so a MISMATCHED closer
 * (`{{ a %}`) must still end the tag: after the pop the lexer is back in DEFAULT mode and the "right"
 * closer can never arrive, which would otherwise swallow the rest of the document into this tag.
 * Ending at the first closer of either kind keeps broken input localized (totality/tolerance).
 * Comments have their own mode with a single close token.
 */
const INTERIOR_CLOSES = new Set<number>([MinijinjaLexer.EXPR_CLOSE, MinijinjaLexer.STMT_CLOSE]);
const CLOSES_FOR_OPEN: ReadonlyMap<number, ReadonlySet<number>> = new Map([
	[MinijinjaLexer.EXPR_OPEN, INTERIOR_CLOSES],
	[MinijinjaLexer.STMT_OPEN, INTERIOR_CLOSES],
	[MinijinjaLexer.COMMENT_OPEN, new Set([MinijinjaLexer.COMMENT_CLOSE])],
]);

/**
 * The two raw-block delimiters lex as ONE self-contained token each (`{% raw %}` = RAW_TAG,
 * `{% endraw %}` = ENDRAW_TAG — the whole tag, delimiters included), so they need no close hunt:
 * the token IS the tag. Both read as stmt tags, `word` carrying the keyword.
 */
const SELF_CONTAINED_TAGS: ReadonlyMap<number, string> = new Map([
	[MinijinjaLexer.RAW_TAG, "raw"],
	[MinijinjaLexer.ENDRAW_TAG, "endraw"],
]);

/**
 * Segment raw jinja-SQL over the outer jinja language and build the length- and
 * newline-preserving placeholder. Total: never throws on any input.
 *
 * Driven by ONE whole-document tokenization from the minijinja island lexer
 * (`grammars/minijinja/MinijinjaLexer.g4`): every RAW_TEXT/STRAY/RAW_BODY/RAW_BODY_STRAY token outside
 * a tag accumulates into the current sql run; an OPEN token starts a tag that runs to its matching
 * CLOSE token (or to `text.length` on EOF — unterminated-tag totality); `{% raw %}` raw-block spanning
 * is the lexer's own `RawBody` mode (grammar-level), so this function does no raw-specific scanning at
 * all — it just walks whatever tokens the lexer produced.
 *
 * `shapeOf` (inc3.2, optional) supplies a syntactic slot per macro-call tag; when
 * given, a shape-valid fragment (`SELECT 1`, …) replaces the identifier fill for
 * the tags it fits (fit-guarded, newline-safe). With no `shapeOf` — or when it
 * returns undefined / a tag doesn't fit — the placeholder is BYTE-IDENTICAL to the
 * positional char fill (the zero-catalog keystone).
 */
export function segment(text: string, shapeOf?: ShapeOf): SegmentResult {
	const lexer = new MinijinjaLexer(CharStream.fromString(text));
	lexer.removeErrorListeners();
	const tokens = lexer.getAllTokens(); // hidden-channel tokens included, EOF excluded

	const segments: Segment[] = [];
	const leadingByTag = new Map<Segment, LeadingInfo>();
	const tagTokens = new Map<Segment, readonly AntlrToken[]>();
	let sqlStart = 0;
	let i = 0;
	const n = tokens.length;

	const pushSql = (start: number, end: number): void => {
		if (end > start) segments.push({ kind: "sql", start, end });
	};

	while (i < n) {
		const openTok = tokens[i];

		// `{% raw %}` / `{% endraw %}` — one self-contained token, the whole tag.
		const selfWord = SELF_CONTAINED_TAGS.get(openTok.type);
		if (selfWord !== undefined) {
			pushSql(sqlStart, openTok.start);
			const end = openTok.stop + 1;
			const seg: Segment = {
				kind: "tag",
				tagKind: "stmt",
				start: openTok.start,
				end,
				text: text.slice(openTok.start, end),
			};
			segments.push(seg);
			leadingByTag.set(seg, { word: selfWord });
			tagTokens.set(seg, [openTok]);
			i += 1;
			sqlStart = end;
			continue;
		}

		const tagKind = OPEN_TAG_KIND.get(openTok.type);
		if (tagKind === undefined) {
			i += 1; // RAW_TEXT / STRAY / RAW_BODY / RAW_BODY_STRAY — sql text, merges into the current run
			continue;
		}

		pushSql(sqlStart, openTok.start);
		const closeTypes = CLOSES_FOR_OPEN.get(openTok.type)!;
		i += 1;

		// Tokens between OPEN and CLOSE belong to the tag and never produce their own segments; the
		// DEFAULT-channel ones among them feed leadingInfoOf for fillChar/shapedFill, and EVERY one
		// (all channels — hidden JWS included) feeds the full slice parse.ts consumes.
		const interior: AntlrToken[] = [];
		const slice: AntlrToken[] = [openTok];
		let closeTok: AntlrToken | undefined;
		while (i < n) {
			const t = tokens[i];
			i += 1;
			if (closeTypes.has(t.type)) {
				closeTok = t;
				slice.push(t);
				break;
			}
			slice.push(t);
			if (t.channel === AntlrToken.DEFAULT_CHANNEL) interior.push(t);
		}

		const end = closeTok ? closeTok.stop + 1 : text.length; // unterminated tag → to EOF (totality)
		const seg: Segment = { kind: "tag", tagKind, start: openTok.start, end, text: text.slice(openTok.start, end) };
		segments.push(seg);
		leadingByTag.set(seg, leadingInfoOf(interior));
		tagTokens.set(seg, slice);
		sqlStart = end;
	}
	pushSql(sqlStart, text.length);

	// Build the placeholder: copy the input, overwrite each tag range with its
	// fill, preserving `\n` at its original offset (antlr line/column anchor).
	const chars = text.split(""); // UTF-16 units — indices align with tag offsets
	for (const seg of segments) {
		if (seg.kind !== "tag") continue;
		const leading = leadingByTag.get(seg)!;
		const shaped = shapeOf ? shapedFill(seg, shapeOf, leading) : undefined;
		if (shaped !== undefined) {
			// Shaped fill: fragment at the tag start, spaces for the rest, `\n` preserved. The fit guard
			// guaranteed no `\n` sits inside [start, start+fragment.length), so the fragment lands intact.
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") continue;
				const rel = k - seg.start;
				chars[k] = rel < shaped.length ? shaped[rel] : " ";
			}
		} else {
			// Positional char fill. The identifier fill (`"j"`) is placed on the tag's
			// FIRST line only; every continuation line fills with spaces. A multi-line
			// tag otherwise becomes a `j`-run PER LINE (the preserved `\n`s split it),
			// which the SQL lexer reads as SEVERAL adjacent identifiers — a parse error
			// (`select jjjj jjjjjj … as x`). First-line-only yields ONE identifier
			// followed by whitespace. The whitespace fill (`" "`) is unaffected (spaces
			// before AND after a newline are identical); length + newline offsets hold.
			const fill = fillChar(seg, leading);
			let seenNewline = false;
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") {
					seenNewline = true;
					continue;
				}
				chars[k] = seenNewline ? " " : fill;
			}
		}
	}

	return { segments, placeholder: chars.join(""), tagTokens };
}
