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
 *  `expr` (identifier fill) and `nothing` (whitespace fill) are handled before this table is consulted.
 *  `cte-definition` is ALSO excluded: unlike every other shape, its fragment introduces a NAME into the
 *  enclosing WITH list's namespace, so it can't be a fixed literal (two tags would collide) — it is built
 *  per-tag from the same base-35 ordinal scheme the identifier fill uses (see the main placeholder loop). */
const SHAPE_FRAGMENT: Record<Exclude<ExpansionShape, "expr" | "nothing" | "cte-definition">, string> = {
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

/** The identifier-fill character — used in runs like `jjj…` when filling placeholder ranges. */
const PLACEHOLDER_CHAR = "j";

/** A conjunct fill is admitted only after an operand word (identifier / number / TRUE / FALSE / NULL
 *  — any word outside the block set), a closing paren/bracket, or a string / quoted-identifier
 *  terminator. BOF, `;`, `,`, `(`, operator chars and the clause keywords keep the identifier fill. */
function conjunctSlotAdmits(slot: string): boolean {
	if (slot.length === 0 || slot === ";") return false;
	if (/^[A-Za-z0-9_]+$/.test(slot)) return !CONJUNCT_BLOCK_WORDS.has(slot);
	return slot === ")" || slot === "]" || slot === "'" || slot === '"' || slot === "`";
}

/**
 * cte-definition slot guard — a shape of admission no prior shape needed: not a body-start
 * allowlist (`STATEMENT_SLOTS`) and not a trailing-expression allowlist (`conjunctSlotAdmits`),
 * but admission INSIDE an already-open WITH list, between two CTE clauses. That position is
 * always immediately after the `,` that closes a prior clause's `(...)` — so admit ONLY
 * `slot === ","` (conservative by construction, matching anvil's stated case; broaden only if a
 * real corpus case needs more).
 */
function cteDefinitionSlotAdmits(slot: string): boolean {
	return slot === ",";
}

/**
 * Query-starting keywords — the words that can open the MAIN query body immediately after a
 * WITH list's last CTE-closing comma. Feeds the cte-definition fragment's trailing-comma
 * decision (review finding, Task 8 follow-up — see `followingSlot` and its call site in the
 * main placeholder loop): membership here means "the main query follows, no more CTEs" (the
 * fragment must NOT add its own trailing comma); anything else — including "" (ambiguous) —
 * is presumed to be another CTE name, since after a WITH-list comma the ONLY two grammatically
 * valid things are another CTE name or the main query (keep the comma, the already-working
 * default). `with` covers a nested `WITH …` main query (rare but legal); `insert`/`update`/
 * `delete`/`merge` are the DML statements a WITH clause can prefix across the eight dialects,
 * alongside `select`.
 */
const QUERY_START_WORDS: ReadonlySet<string> = new Set(["select", "with", "insert", "update", "delete", "merge"]);

/**
 * The slot immediately preceding `start`: skip whitespace AND SQL comment trivia backward over
 * `chars` (the placeholder being built, so earlier tags read as their fills — a blanked
 * `{{ config }}` reads as whitespace) and return the preceding word (lowercased) or single
 * character; "" at document start.
 *
 * Comment trivia is invisible to every fill guard (anvil torture-corpus finding, 2026-07-06:
 * `-- header\n{{ whole_view(…) }}` read slot "header" instead of document start, defeating the
 * statement fill): `--` line comments are skipped string-aware (a quoted `--` is not trivia),
 * and `/*`-style block comments skip to before their opener (multi-line fine). Boundaries, both
 * conservative degradations rather than corruptions: snowflake's `//` line comments are NOT
 * skipped (the scan is dialect-blind and `//` elsewhere is division); nested block comments
 * (postgres) match the nearest opener; a multi-line string whose body contains `--` can misread
 * line-locally — each corner degrades to a word slot, i.e. today's fallback fill.
 */
function precedingSlot(chars: readonly string[], start: number): string {
	let k = start - 1;
	for (;;) {
		while (k >= 0 && /[ \t\r\n]/.test(chars[k])) k -= 1;
		if (k < 0) return "";
		// A block comment closing at k: skip to before its opener.
		if (chars[k] === "/" && k >= 1 && chars[k - 1] === "*") {
			let open = -1;
			for (let i = k - 3; i >= 0; i--) {
				if (chars[i] === "/" && chars[i + 1] === "*") {
					open = i;
					break;
				}
			}
			if (open === -1) return ""; // unterminated backward — conservative document start
			k = open - 1;
			continue;
		}
		// A `--` line comment on the line ending at k: everything from the first unquoted `--`
		// on that line is trivia — resume the scan before it.
		let lineStart = 0;
		for (let i = k; i >= 0; i--) {
			if (chars[i] === "\n") {
				lineStart = i + 1;
				break;
			}
		}
		const dash = lineCommentStart(chars, lineStart, k);
		if (dash !== -1) {
			k = dash - 1;
			continue;
		}
		break;
	}
	if (!/[A-Za-z0-9_]/.test(chars[k])) return chars[k];
	let word = "";
	while (k >= 0 && /[A-Za-z0-9_]/.test(chars[k])) {
		word = chars[k] + word;
		k -= 1;
	}
	return word.toLowerCase();
}

/** The index of the first `--` at or before `end` on the line starting at `lineStart`, tracking
 *  '…' / "…" / \`…\` quotes forward so a quoted `--` is never trivia; -1 when the line has none. */
function lineCommentStart(chars: readonly string[], lineStart: number, end: number): number {
	let quote: string | null = null;
	for (let i = lineStart; i <= end; i++) {
		const c = chars[i];
		if (quote !== null) {
			if (c === quote) quote = null;
			continue;
		}
		if (c === "'" || c === '"' || c === "`") {
			quote = c;
			continue;
		}
		if (c === "-" && chars[i + 1] === "-") return i;
	}
	return -1;
}

/**
 * The word immediately following `end` — the forward mirror of `precedingSlot`, needed only by
 * the `cte-definition` shape's last-CTE-in-the-list check (review finding, Task 8 follow-up):
 * is this tag's synthetic CTE followed by another CTE name, or by the main query? Skips
 * whitespace and SQL comment trivia FORWARD (the same `--` / `/* *\/` shapes `precedingSlot`
 * skips backward) and returns the next word (lowercased) or single character; "" at document
 * end. Forward comment detection needs no quote-awareness (unlike `precedingSlot`'s backward
 * scan): a `--`/`/*` found here is the FIRST thing after the skipped whitespace, so it can never
 * sit inside a string that started earlier — a string starts with a quote char, which this
 * function would already have returned as its answer instead of continuing.
 *
 * Degrades to "" (ambiguous) rather than guessing whenever it cannot cheaply tell: an
 * unterminated forward block comment (mirrors `precedingSlot`'s own unterminated-backward
 * conservatism), OR the very next thing is another jinja tag's opening delimiter (`{{`/`{%`/
 * `{#`) — that tag's own text is still RAW at this point in the main loop (segments fill in
 * source order, so a LATER tag hasn't been filled yet while THIS tag is being decided), and `{`
 * fails the identifier-start test below, so it falls out to the same "" answer with no special
 * casing needed. The caller (the cte-definition fragment build) treats "" as "not a
 * query-starting keyword" — i.e. keep the trailing comma, never assume the main query follows.
 */
function followingSlot(chars: readonly string[], end: number): string {
	let k = end;
	const len = chars.length;
	for (;;) {
		while (k < len && /[ \t\r\n]/.test(chars[k])) k += 1;
		if (k >= len) return "";
		// A `--` line comment opening at k: skip to (not past) the line's end.
		if (chars[k] === "-" && chars[k + 1] === "-") {
			while (k < len && chars[k] !== "\n") k += 1;
			continue;
		}
		// A `/*` block comment opening at k: skip to just past its closer.
		if (chars[k] === "/" && chars[k + 1] === "*") {
			let close = -1;
			for (let i = k + 2; i < len - 1; i++) {
				if (chars[i] === "*" && chars[i + 1] === "/") {
					close = i;
					break;
				}
			}
			if (close === -1) return ""; // unterminated forward — conservative: ambiguous
			k = close + 2;
			continue;
		}
		break;
	}
	if (!/[A-Za-z0-9_]/.test(chars[k])) return chars[k];
	let word = "";
	while (k < len && /[A-Za-z0-9_]/.test(chars[k])) {
		word += chars[k];
		k += 1;
	}
	return word.toLowerCase();
}

/**
 * Fit-window guard shared by every fragment fill (static or dynamic): the first newline-free
 * run inside the tag long enough to hold `fragment`. A one-line tag places at its start as
 * before; a multi-line tag (the whole-model `{{\n  macro(…)\n}}` pattern — 490/1525 Oatly
 * models, the 2026-07-06 F5 finding) places on its first line that fits, with every other tag
 * char whitespace — so the fragment is still the fill's first non-whitespace content and the
 * pre-tag slot logic is unchanged. No window → undefined (a shaped fill is strictly an
 * improvement, never a regression). Length and every original `\n` offset are preserved by the
 * caller's placement loop.
 */
function fitWindow(
	seg: Extract<Segment, { kind: "tag" }>,
	fragment: string,
): { fragment: string; at: number } | undefined {
	let lineStart = 0;
	for (let k = 0; k <= seg.text.length; k++) {
		if (k === seg.text.length || seg.text[k] === "\n") {
			if (k - lineStart >= fragment.length) return { fragment, at: lineStart };
			lineStart = k + 1;
		}
	}
	return undefined;
}

/**
 * The shaped fill fragment for a tag — the fragment text plus its placement offset
 * WITHIN the tag — or undefined to fall back to the positional char fill. Applies a
 * fragment ONLY for a real CALL whose shape admits one and whose slot admits it (the
 * guards above), fit-windowed via `fitWindow`. `cte-definition` is handled separately
 * by the caller (its fragment is dynamic, built from the live `ordinal` counter — see
 * the main placeholder loop), so it never reaches `SHAPE_FRAGMENT` here.
 */
function fragmentFill(
	seg: Extract<Segment, { kind: "tag" }>,
	shape: ExpansionShape,
	isCall: boolean,
	slot: string,
): { fragment: string; at: number } | undefined {
	if (shape === "expr" || shape === "nothing" || shape === "cte-definition") return undefined; // positional/dynamic fills, not this table
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
	return fitWindow(seg, SHAPE_FRAGMENT[shape]);
}

/** Base-35 digits for the identifier fill's per-tag ordinal — the alphabet EXCLUDES `j`, so an
 *  encoded ordinal can never rebuild the all-`j` padding (base36's 19 is `j`, which would make
 *  tag 19 collide with a plain run), and it stays distinct under case-insensitive identifier
 *  folding (an upper/lower trick would fold together). A 2-char first line (`{{` on its own
 *  line) holds 35 ordinals; beyond the encodable window the head truncates — the documented
 *  degenerate corner where a collision is still possible, never a length/newline break. */
const ORDINAL_ALPHABET = "0123456789abcdefghiklmnopqrstuvwxyz";

function ordinalFill(n: number): string {
	let s = "";
	do {
		s = ORDINAL_ALPHABET[n % 35] + s;
		n = Math.floor(n / 35);
	} while (n > 0);
	return s;
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
	// Interior DEFAULT-channel tokens per tag — the loop-realization post-pass reads stmt-tag
	// conditions from these (same tokens tagCall consumed; stored, not re-derived).
	const interiorByTag = new Map<Segment, AntlrToken[]>();
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
		interiorByTag.set(seg, interior);
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
	let ordinal = 0; // per-identifier-fill counter, document order (fill uniqueness)
	for (const seg of segments) {
		if (seg.kind !== "tag") continue;
		const info = callByTag.get(seg) ?? { isCall: false };
		const slot = precedingSlot(chars, seg.start);

		// ONE provider consult per tag — the uniform seam. stmt/comment tags are pure
		// jinja control text and always whitespace-fill (no consult needed).
		const exp = seg.tagKind === "expr" && info.call ? provider.expansion(info.call) : undefined;
		const shape = exp?.shape;

		// Fusion boundary (anvil torture-corpus, 2026-07-06): a tag GLUED to a preceding SQL
		// clause/operator keyword (`from{{ ref('x') }}` — dbt compiles it because the rendered
		// relation opens with a quote char) must not fuse with the fill into one token: the old
		// fill made `fromj0jjj…` — zero errors, no FROM clause at all. The fill's first char
		// becomes a space ONLY in that case; `prefix_{{ var('x') }}` gluing is a legitimate dbt
		// identifier-composition pattern (an underscore word is never a keyword) and keeps fusing.
		const fusesWithKeyword =
			seg.start > 0 && /[A-Za-z0-9_]/.test(chars[seg.start - 1]) && CONJUNCT_BLOCK_WORDS.has(slot);

		// cte-definition's fragment is DYNAMIC (Design — per-tag uniqueness): the synthetic CTE's
		// name must never collide with another tag's in the same WITH list, so it is built here,
		// per-tag, from the SAME base-35 ordinal counter the identifier fill uses below (`ordinal`,
		// `PLACEHOLDER_CHAR`/`ordinalFill`) — never a fixed literal like every other shape's
		// `SHAPE_FRAGMENT` entry. The counter is consumed (incremented) ONLY when the fragment
		// actually fires; an admission failure falls through to the identifier fill, which
		// consumes the ordinal itself (`ordinalFill(ordinal++)` below) — so ordinals stay in sync
		// and no two tags in the document, cte-definition or identifier-fill, ever collide.
		//
		// The trailing comma is CONDITIONAL (review finding, Task 8 follow-up): the original
		// fragment always ended in `,` because anvil's reported case always sat between two OTHER
		// named CTEs — but the shape is also admitted when this tag's CTE is the LAST one in the
		// WITH list, immediately before the main query, where a hardcoded trailing comma has
		// nothing after it (`with base as (...), j0 as (select 1), select * from base` — a parse
		// error). `followingSlot` looks forward past the tag for the next real word; a
		// query-starting keyword there (`QUERY_START_WORDS`) means the main query follows, so the
		// comma is omitted. Anything else — another CTE name, or "" (ambiguous) — keeps it, which
		// is exactly the already-working "another CTE follows" behavior, unchanged.
		let shaped: { fragment: string; at: number } | undefined;
		if (shape === "cte-definition") {
			if (info.isCall && cteDefinitionSlotAdmits(slot)) {
				const needsComma = !QUERY_START_WORDS.has(followingSlot(chars, seg.end));
				shaped = fitWindow(
					seg,
					`${PLACEHOLDER_CHAR}${ordinalFill(ordinal)} as (select 1)${needsComma ? "," : ""}`,
				);
			} else {
				shaped = undefined;
			}
			if (shaped !== undefined) ordinal += 1;
		} else {
			shaped = shape !== undefined ? fragmentFill(seg, shape, info.isCall, slot) : undefined;
		}
		if (shaped !== undefined) {
			// Fragment fill: at the fit window's start (`at` — tag start for a one-line tag, the
			// first fitting line for a multi-line one), spaces everywhere else, `\n` preserved.
			// The window is newline-free by construction, so the fragment lands intact. A glued
			// SLOT WORD (`t{{ m() }}` with a conjunct answer → `tAND 1=1`) shifts the fragment one
			// char right when the window allows — fragments fuse with ANY glued word, keyword or
			// not, since they all start with a keyword letter.
			const glued = seg.start > 0 && /[A-Za-z0-9_]/.test(chars[seg.start - 1]);
			const fits =
				seg.text[shaped.at + shaped.fragment.length] !== "\n" &&
				shaped.at + shaped.fragment.length < seg.end - seg.start;
			const at = shaped.at === 0 && glued && fits ? 1 : shaped.at;
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") continue;
				const rel = k - seg.start - at;
				chars[k] = rel >= 0 && rel < shaped.fragment.length ? shaped.fragment[rel] : " ";
			}
			continue;
		}

		// Positional char fill. The identifier fill is placed on the tag's FIRST line
		// only; every continuation line fills with spaces. A multi-line tag otherwise
		// becomes a run PER LINE (the preserved `\n`s split it), which the SQL lexer
		// reads as SEVERAL adjacent identifiers — a parse error (`select jjjj jjjjjj …
		// as x`). First-line-only yields ONE identifier followed by whitespace. The
		// whitespace fill (`" "`) is unaffected (spaces before AND after a newline are
		// identical); length + newline offsets hold.
		let identifier = false;
		if (seg.tagKind === "expr" && shape !== "nothing") {
			identifier = true;
			// Statement-slot default: a CALL with NO expansion answer at all sitting at a
			// statement slot (BOF / after `;`) blanks instead of the identifier fill — a lone
			// identifier is never a valid statement, so the identifier fill ALWAYS breaks there
			// (`{{ my_helper() }}\nselect …` → extraneous input) while blank lets the
			// surrounding statements parse. Calls WITH an answer (ref/source → relation,
			// var/env_var → value, a shaped macro whose fragment was slot-guarded away) keep
			// the identifier fill.
			if (info.isCall && exp === undefined && (slot === "" || slot === ";")) identifier = false;
			// cte-definition slot-admitted-but-no-fit default: unlike every other shape, the
			// identifier fill is NEVER safe here even when it's the only option left — a bare
			// identifier right after the `,` inside an already-open WITH list is exactly the
			// anvil-repro failure mode (`with base as (...), jjj final as (...)` — a parse
			// error) whether the break is "no shape at all" or "shape known, fragment too long
			// for this tag's span." Blank instead: the list's own real comma (from the
			// surrounding text, not this tag) chains straight to whatever follows.
			if (shape === "cte-definition" && cteDefinitionSlotAdmits(slot)) identifier = false;
		}
		// Uniqueness (Niclas's design review, 2026-07-06): each identifier fill encodes a
		// per-tag ordinal so two same-length tags never fill byte-identically (name-keyed
		// consumers — projection names, alias resolution, variant merges — collided on the
		// old all-`j` fill). The head is built once here; the loop below places it on the
		// tag's first line and pads the remainder with PLACEHOLDER_CHAR.
		const head = identifier ? `${fusesWithKeyword ? " " : ""}${PLACEHOLDER_CHAR}${ordinalFill(ordinal++)}` : "";
		let seenNewline = false;
		for (let k = seg.start; k < seg.end; k++) {
			if (chars[k] === "\n") {
				seenNewline = true;
				continue;
			}
			if (seenNewline || !identifier) {
				chars[k] = " ";
				continue;
			}
			const rel = k - seg.start;
			chars[k] = rel < head.length ? head[rel] : PLACEHOLDER_CHAR;
		}
	}

	// Single-representative-iteration loop realization (anvil torture-corpus, 2026-07-06): in
	// jinja itself a 1-length loop has loop.first = loop.last = true, so the primary realization
	// models ONE representative iteration — inside a {% for %}, an {% if %} arm whose condition
	// is a trivially-decidable loop-constant ("not loop.last" / "not loop.first") is statically
	// DEAD and blanks (the dbt union-arm separator idiom used to leave a dangling `union all`).
	// Anything the engine cannot decide structurally stays live (all-text-live holds); else/elif
	// arms of a blanked if stay live (a false condition means the else runs). Pure jinja-core
	// structural knowledge — no rendering, no provider consult.
	blankDeadLoopArms(segments, callByTag, interiorByTag, chars);

	return { segments, placeholder: chars.join(""), tagTokens };
}

/** True when a stmt-tag `if` condition is exactly `not loop.last` / `not loop.first` — false by
 *  construction in the single representative iteration. Strict token-shape match (never-wrong:
 *  anything else is undecidable and stays live). `interior` includes the leading `if` keyword. */
function isLoopConstFalse(interior: readonly AntlrToken[]): boolean {
	if (interior.length !== 5) return false;
	const [kw, not, loop, dot, member] = interior.map(textOf);
	return kw === "if" && not === "not" && loop === "loop" && dot === "." && (member === "last" || member === "first");
}

/** Blank (to spaces, `\n` preserved) the body of every statically-dead loop-constant `if` arm.
 *  Depth-safe pairing over the stmt tags: a nested if inside a blanked arm blanks with it; an
 *  `else`/`elif` at the blanked if's own depth ENDS the blank (its arm stays live); an unclosed
 *  blanked if blanks nothing (tolerant — same spirit as the M1 region boundary). */
function blankDeadLoopArms(
	segments: readonly Segment[],
	callByTag: ReadonlyMap<Segment, TagCallInfo>,
	interiorByTag: ReadonlyMap<Segment, readonly AntlrToken[]>,
	chars: string[],
): void {
	let forDepth = 0;
	let ifDepth = 0;
	let blankFrom = -1; // char offset where the current dead arm's body starts; -1 = not blanking
	let blankAtIfDepth = -1;
	const blank = (from: number, to: number): void => {
		for (let k = from; k < to; k++) if (chars[k] !== "\n") chars[k] = " ";
	};
	for (const seg of segments) {
		if (seg.kind !== "tag" || seg.tagKind !== "stmt") continue;
		const kw = callByTag.get(seg)?.call?.name;
		if (kw === "for") forDepth += 1;
		else if (kw === "endfor") forDepth = Math.max(0, forDepth - 1);
		else if (kw === "if") {
			ifDepth += 1;
			if (blankFrom === -1 && forDepth > 0 && isLoopConstFalse(interiorByTag.get(seg) ?? [])) {
				blankFrom = seg.end;
				blankAtIfDepth = ifDepth;
			}
		} else if (kw === "elif" || kw === "else") {
			if (blankFrom !== -1 && ifDepth === blankAtIfDepth) {
				blank(blankFrom, seg.start);
				blankFrom = -1;
			}
		} else if (kw === "endif") {
			if (blankFrom !== -1 && ifDepth === blankAtIfDepth) {
				blank(blankFrom, seg.start);
				blankFrom = -1;
			}
			ifDepth = Math.max(0, ifDepth - 1);
		}
	}
}
