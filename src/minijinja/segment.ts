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
import type { ExpansionShape, TemplateCall, TemplateProvider } from "../qualify/template-provider.js";

export type Segment =
	| { kind: "sql"; start: number; end: number }
	| {
			kind: "tag";
			tagKind: "expr" | "stmt" | "comment";
			start: number;
			end: number;
			text: string;
	  };

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

// NO_OUTPUT_BUILTINS moved to the DEFAULT PROVIDER (src/qualify/template-provider.ts) — that
// knowledge ("config emits no SQL text") is dbt-domain knowledge, not lexer mechanics; the
// segmenter learns it back through `provider.expansion(call).shape === "nothing"`. Re-exported
// here for the R2 classifier (tag-ast.ts), which shares the same list for its syntactic labels.
export { NO_OUTPUT_BUILTINS } from "../qualify/template-provider.js";

/**
 * The lexical `TemplateCall` of a tag — the provider's key, extracted from the interior
 * DEFAULT-channel tokens WITHOUT a parse (segmentation runs before the per-tag parses).
 * Leading dotted path → packageParts + name; a following `(...)` is scanned at depth 1:
 * each argument is its quote-stripped literal when it is a SINGLE escape-free STRING
 * token, `null` otherwise (computed — never fabricated); `id = value` at depth 1 is a
 * kwarg. A bare word (`{{ docs }}`) keys with `args: []` like a zero-arg call.
 * Returns undefined when no identifier leads the tag (a literal / composed expression).
 */
interface TagCallInfo {
	/** The provider key, or undefined when no identifier leads the tag. */
	call?: TemplateCall;
	/** True when the leading path is followed by `(` — a real call (fragments apply to calls only). */
	isCall: boolean;
}

function tagCall(interior: AntlrToken[]): TagCallInfo {
	let i = 0;
	const isWord = (t: AntlrToken | undefined): boolean => t !== undefined && IDENT_RE.test(textOf(t));
	if (!isWord(interior[i])) return { isCall: false };

	const parts: string[] = [];
	for (;;) {
		const t = interior[i];
		if (!isWord(t)) break;
		parts.push(textOf(t));
		i += 1;
		if (interior[i]?.type === MinijinjaLexer.DOT) {
			i += 1;
			continue;
		}
		break;
	}
	const name = parts[parts.length - 1];
	const packageParts = parts.length > 1 ? parts.slice(0, -1) : undefined;
	const isCall = interior[i]?.type === MinijinjaLexer.LPAREN;

	const args: (string | null)[] = [];
	const kwargs: { name: string; value: string | null }[] = [];
	if (isCall) {
		i += 1;
		let depth = 1;
		let argTokens: AntlrToken[] = [];
		const flush = (): void => {
			if (argTokens.length === 0) return;
			// `id = rest` at depth 1 → kwarg (value = the rest's literal or null).
			if (argTokens.length >= 2 && isWord(argTokens[0]) && argTokens[1].type === MinijinjaLexer.ASSIGN) {
				kwargs.push({ name: textOf(argTokens[0]), value: literalOf(argTokens.slice(2)) });
			} else {
				args.push(literalOf(argTokens));
			}
			argTokens = [];
		};
		for (; i < interior.length && depth > 0; i++) {
			const t = interior[i];
			const ty = t.type;
			if (ty === MinijinjaLexer.LPAREN || ty === MinijinjaLexer.LBRACK || ty === MinijinjaLexer.LBRACE)
				depth += 1;
			else if (ty === MinijinjaLexer.RPAREN || ty === MinijinjaLexer.RBRACK || ty === MinijinjaLexer.RBRACE) {
				depth -= 1;
				if (depth === 0) break;
			} else if (ty === MinijinjaLexer.COMMA && depth === 1) {
				flush();
				continue;
			}
			argTokens.push(t);
		}
		flush();
	}
	return {
		call: { name, ...(packageParts ? { packageParts } : {}), args, ...(kwargs.length ? { kwargs } : {}) },
		isCall,
	};
}

/** The quote-stripped literal of an argument's tokens, or null when computed: exactly ONE
 *  STRING token whose content carries no escape (never-wrong — an escaped or composed
 *  argument is not fabricated into a literal). */
function literalOf(tokens: AntlrToken[]): string | null {
	if (tokens.length !== 1 || tokens[0].type !== MinijinjaLexer.STRING) return null;
	const text = textOf(tokens[0]);
	if (text.length < 2) return null;
	const content = text.slice(1, -1);
	return content.includes("\\") ? null : content;
}

/**
 * The leading word + leading call of a tag, derived from its interior DEFAULT-channel tokens (never
 * re-scanned from `seg.text`). `word` is the very first identifier-shaped token after the opener — for
 * an expr tag the leading call name (`config`, `ref`, `dbt_utils` in `dbt_utils.star(…)`), for a stmt
 * tag the keyword (`if`, `for`, …). `Segment` is a public type that must not gain fields, so this
 * rides in a side map (`tagCall`'s caller) instead of on the segment itself.
 */
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `t.text` is optional on the antlr4ng `Token` interface; every real token here always carries it. */
function textOf(t: AntlrToken): string {
	return t.text ?? "";
}

// ---------------------------------------------------------------------------
// Shaped placeholders. The PROVIDER answers what a call produces (its
// `expansion(call).shape`, explicit or derived); everything here — the
// fragments, the fit guard, the slot guards, the positional fills — is the
// ENGINE's non-overridable positional machinery: how an answer becomes a
// length-/newline-preserving stand-in that can never corrupt a parse.
// ---------------------------------------------------------------------------

/** Shape → the minimal shape-valid SQL fragment. `SELECT 1` is valid across all eight dialects both as a
 *  standalone statement AND as a `(…)` CTE/subquery body (verified), so `statement`/`relation` share it;
 *  `expr` (identifier fill) and `nothing` (whitespace fill) are handled before this table is consulted. */
const SHAPE_FRAGMENT: Record<Exclude<ExpansionShape, "expr" | "nothing">, string> = {
	statement: "SELECT 1",
	relation: "SELECT 1",
	predicate: "1=1",
	"column-list": "1",
	conjunct: "AND 1=1",
	// Valid in both live where-mode slots: `from t WHERE 1=1` and `on (...) WHERE 1=1 union all`.
	"where-clause": "WHERE 1=1",
};

/**
 * Slot guard (the durable close of the slot-blind Open Gap, spec §Open Gap — slot-blind shaping):
 * `expansionShape` answers BY NAME, position-blind, so a `statement`/`relation` shape can land in a
 * slot where its `SELECT 1` fill is INVALID SQL while the identifier fill parses fine — a bare
 * `FROM {{ m() }}` (→ `FROM SELECT 1`), a list comma (`select a, {{ m() }}`), or a predicate slot
 * (`WHERE {{ m() }}` — the anvil repro, `extraneous input 'SELECT'`). A BLOCKLIST, not an allowlist:
 * shaping is skipped ONLY where the shaped fill provably breaks and the identifier fill provably
 * parses (a table name after FROM/JOIN, a list element after `,`, a boolean column after the
 * predicate keywords) — every other slot keeps today's shipped behavior, so the guard can only
 * remove breakage, never regress a working shape. `predicate`/`column-list` shapes are untouched.
 */
const SLOT_BLOCK_WORDS: ReadonlySet<string> = new Set(["from", "join", "where", "and", "or", "on", "having", "when"]);

/**
 * statement/relation slot guard — an ALLOWLIST since the provider cutover: the `SELECT 1`
 * fragment is structurally a statement/query body, so it is admitted ONLY where a body can
 * START — document start, after `;`, a `(` (CTE/subquery body), or after `)` (a completed
 * CTE's main statement). Every other slot (FROM/JOIN relation names, select-list scalars,
 * predicates, commas — where the identifier fill parses) falls back. The old blocklist
 * sufficed when shapes were rare consumer answers; the DEFAULT provider now derives
 * "relation" for every `ref`/`source`, so admission must be provably-body slots only.
 * (SLOT_BLOCK_WORDS above still drives the conjunct guard's block set.)
 */
const STATEMENT_SLOTS: ReadonlySet<string> = new Set(["", ";", "(", ")"]);

/**
 * Conjunct slot guard — OPPOSITE polarity to the statement/relation guard above. `AND 1=1` is valid
 * only where a complete expression can just have ENDED; everywhere else the identifier fill parses
 * and the conjunct fill breaks, so those slots fall back. The block set = the clause/operator
 * keywords after which an expression is being OPENED, not closed (the statement/relation block words
 * plus the select-list/operator keywords); the char test in `conjunctSlotAdmits` blocks every
 * operator/opener char and admits only expression terminators (`)`, a string/quoted-ident close).
 */
const CONJUNCT_BLOCK_WORDS: ReadonlySet<string> = new Set([
	...SLOT_BLOCK_WORDS,
	"select",
	"by",
	"distinct",
	"all",
	"as",
	"case",
	"then",
	"else",
	"not",
	"in",
	"like",
	"ilike",
	"rlike",
	"between",
	"is",
	"escape",
	"exists",
	"any",
	"some",
	"union",
	"intersect",
	"except",
	"over",
	"partition",
	"order",
	"group",
	"limit",
	"offset",
	"set",
	"values",
]);

/** A conjunct fill is admitted only after an operand word (identifier / number / TRUE / FALSE / NULL
 *  — any word outside the block set), a closing paren/bracket, or a string / quoted-identifier
 *  terminator. BOF, `;`, `,`, `(`, operator chars and the clause keywords keep the identifier fill. */
function conjunctSlotAdmits(slot: string): boolean {
	if (slot.length === 0 || slot === ";") return false;
	if (/^[A-Za-z0-9_]+$/.test(slot)) return !CONJUNCT_BLOCK_WORDS.has(slot);
	return slot === ")" || slot === "]" || slot === "'" || slot === '"' || slot === "`";
}

/**
 * The slot immediately preceding `start`: skip whitespace backward over `chars` (the placeholder
 * being built, so earlier tags read as their fills — a blanked `{{ config }}` reads as whitespace)
 * and return the preceding word (lowercased) or single character; "" at document start.
 */
function precedingSlot(chars: readonly string[], start: number): string {
	let k = start - 1;
	while (k >= 0 && /[ \t\r\n]/.test(chars[k])) k -= 1;
	if (k < 0) return "";
	if (!/[A-Za-z0-9_]/.test(chars[k])) return chars[k];
	let word = "";
	while (k >= 0 && /[A-Za-z0-9_]/.test(chars[k])) {
		word = chars[k] + word;
		k -= 1;
	}
	return word.toLowerCase();
}

/**
 * The shaped fill fragment for a tag — the fragment text plus its placement offset
 * WITHIN the tag — or undefined to fall back to the positional char fill. Applies a
 * fragment ONLY for a real CALL whose shape admits one, whose slot admits it (the
 * guards above), and for which a fit WINDOW exists: the first newline-free run
 * inside the tag long enough to hold the fragment. A one-line tag places at its
 * start as before; a multi-line tag (the whole-model `{{\n  macro(…)\n}}` pattern —
 * 490/1525 Oatly models, the 2026-07-06 F5 finding) places on its first line that
 * fits, with every other tag char whitespace — so the fragment is still the fill's
 * first non-whitespace content and the pre-tag slot logic is unchanged. No window →
 * fall back (a shaped fill is strictly an improvement, never a regression). Length
 * and every original `\n` offset are preserved by the caller's placement loop.
 */
function fragmentFill(
	seg: Extract<Segment, { kind: "tag" }>,
	shape: ExpansionShape,
	isCall: boolean,
	slot: string,
): { fragment: string; at: number } | undefined {
	if (shape === "expr" || shape === "nothing") return undefined; // positional fills, not fragments
	if (!isCall) return undefined; // fragments only for a real macro CALL (bare words keep the char fill)
	if ((shape === "statement" || shape === "relation") && !STATEMENT_SLOTS.has(slot)) {
		return undefined; // slot guard: SELECT 1 is a statement/body — only where a body can START
	}
	if ((shape === "conjunct" || shape === "where-clause") && !conjunctSlotAdmits(slot)) {
		// Same admission polarity for both trailing-clause fills: `AND 1=1` needs a complete
		// expression just ended; `WHERE 1=1` needs a complete FROM/JOIN context just ended —
		// the admitting slots coincide (an operand word, `)`, a string/quoted-ident close),
		// and the blocked slots (BOF, `;`, `(`, clause/operator keywords) break both.
		return undefined;
	}
	const fragment = SHAPE_FRAGMENT[shape];
	// Fit-window guard: the first newline-free run inside the tag that holds the fragment.
	let lineStart = 0;
	for (let k = 0; k <= seg.text.length; k++) {
		if (k === seg.text.length || seg.text[k] === "\n") {
			if (k - lineStart >= fragment.length) return { fragment, at: lineStart };
			lineStart = k + 1;
		}
	}
	return undefined;
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
 * Every expr tag consults `provider.expansion(call)` (the call extracted lexically
 * by `tagCall`): shape `"nothing"` → whitespace fill; a fragment shape → the
 * shape-valid fragment (fit- and slot-guarded); `"expr"` / no answer → the
 * positional identifier fill. The provider states WHAT a call produces; every
 * fill decision here is the engine's own (non-overridable) machinery.
 */
export function segment(text: string, provider: TemplateProvider): SegmentResult {
	const lexer = new MinijinjaLexer(CharStream.fromString(text));
	lexer.removeErrorListeners();
	const tokens = lexer.getAllTokens(); // hidden-channel tokens included, EOF excluded

	const segments: Segment[] = [];
	const callByTag = new Map<Segment, TagCallInfo>();
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
			callByTag.set(seg, { isCall: false });
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
		// DEFAULT-channel ones among them feed tagCall (the provider's lexical key), and EVERY one
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
		callByTag.set(seg, tagCall(interior));
		tagTokens.set(seg, slice);
		sqlStart = end;
	}
	pushSql(sqlStart, text.length);

	// Build the placeholder: copy the input, overwrite each tag range with its
	// fill, preserving `\n` at its original offset (antlr line/column anchor).
	// Segments are source-ordered, so when tag k is filled, chars[0..k.start) already
	// carries every earlier fill — precedingSlot reads the placeholder-in-progress
	// (a blanked config tag before this one reads as whitespace, as it should).
	const chars = text.split(""); // UTF-16 units — indices align with tag offsets
	for (const seg of segments) {
		if (seg.kind !== "tag") continue;
		const info = callByTag.get(seg) ?? { isCall: false };
		const slot = precedingSlot(chars, seg.start);

		// ONE provider consult per tag — the uniform seam. stmt/comment tags are pure
		// jinja control text and always whitespace-fill (no consult needed).
		const exp = seg.tagKind === "expr" && info.call ? provider.expansion(info.call) : undefined;
		const shape = exp?.shape;

		const shaped = shape !== undefined ? fragmentFill(seg, shape, info.isCall, slot) : undefined;
		if (shaped !== undefined) {
			// Fragment fill: at the fit window's start (`at` — tag start for a one-line tag, the
			// first fitting line for a multi-line one), spaces everywhere else, `\n` preserved.
			// The window is newline-free by construction, so the fragment lands intact.
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") continue;
				const rel = k - seg.start - shaped.at;
				chars[k] = rel >= 0 && rel < shaped.fragment.length ? shaped.fragment[rel] : " ";
			}
			continue;
		}

		// Positional char fill. The identifier fill (`"j"`) is placed on the tag's
		// FIRST line only; every continuation line fills with spaces. A multi-line
		// tag otherwise becomes a `j`-run PER LINE (the preserved `\n`s split it),
		// which the SQL lexer reads as SEVERAL adjacent identifiers — a parse error
		// (`select jjjj jjjjjj … as x`). First-line-only yields ONE identifier
		// followed by whitespace. The whitespace fill (`" "`) is unaffected (spaces
		// before AND after a newline are identical); length + newline offsets hold.
		let fill: string;
		if (seg.tagKind !== "expr" || shape === "nothing") {
			fill = " "; // stmt / comment / no-output call → whitespace to SQL
		} else {
			fill = "j";
			// Statement-slot default: a CALL with NO expansion answer at all sitting at a
			// statement slot (BOF / after `;`) blanks instead of the identifier fill — a lone
			// identifier is never a valid statement, so the identifier fill ALWAYS breaks there
			// (`{{ my_helper() }}\nselect …` → extraneous input) while blank lets the
			// surrounding statements parse. Calls WITH an answer (ref/source → relation,
			// var/env_var → value, a shaped macro whose fragment was slot-guarded away) keep
			// the identifier fill.
			if (info.isCall && exp === undefined && (slot === "" || slot === ";")) fill = " ";
		}
		let seenNewline = false;
		for (let k = seg.start; k < seg.end; k++) {
			if (chars[k] === "\n") {
				seenNewline = true;
				continue;
			}
			chars[k] = seenNewline ? " " : fill;
		}
	}

	return { segments, placeholder: chars.join(""), tagTokens };
}
