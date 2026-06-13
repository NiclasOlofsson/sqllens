// Extract a parse corpus from ZetaSQL's PARSER golden files (googlesql/parser/testdata).
//
// This is a second, stricter corpus alongside tools/extract-googlesql-tests.mjs (which reads the
// ANALYZER testdata). The parser testdata is pure syntax: every block is `query -- <parse-tree> --
// <unparsed-sql>` for a positive, or `query -- ERROR: Syntax error: …` for a negative. Unlike the
// analyzer corpus, the negatives here are *true* syntax errors (the parser's own error productions),
// so this gate is a cleaner two-sided signal and the positives are parseable by construction.
//
// Classification mirrors the analyzer extractor: expected starting with "ERROR: Syntax error" =>
// the query must NOT parse (negative); anything else (a parse tree, or a non-syntax "… is not
// supported" error the parser emits *after* parsing) => the query must parse (positive). `{{a|b}}`
// alternations expand combinatorially and are classified per-variant via the ALTERNATION GROUP
// subsections. Block options (`[default …]`, `[language_features=…]`, `[node_kind=…]`) and `#`
// comments are stripped — they are test directives, not SQL. There are no analyzer modes here.
//
// Run: node tools/extract-googlesql-parser-tests.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SRC = "vendor/googlesql/googlesql/parser/testdata";
const OUT = "harness/local/bigquery-zetasql-parser";
const MAX_VARIANTS = 8; // cap `{{a|b|…}}` expansion per block (matches the analyzer extractor)

if (!existsSync(SRC)) {
	console.error(
		`missing ${SRC} — add it to the sparse clone first:\n` +
			`  git -C vendor/googlesql sparse-checkout add googlesql/parser/testdata`,
	);
	process.exit(1);
}

/**
 * Expand `{{a|b|c}}` alternations into all variants. Empty option (e.g. `{{x.|}}`) => "".
 * Non-greedy so an option may itself contain a single `}` (graph quantifier, `{prop: v}` spec);
 * the delimiter is `}}`. Leftmost group varies slowest — matches ZetaSQL's ALTERNATION GROUP order.
 */
function expand(query) {
	const m = query.match(/\{\{([\s\S]*?)\}\}/);
	if (!m) return [query];
	const opts = m[1].split("|");
	return opts.flatMap((o) => expand(query.slice(0, m.index) + o + query.slice(m.index + m[0].length)));
}

function blocks(text) {
	return text.split(/^==$/m); // top-level test separator
}

function cleanQuery(raw) {
	// Drop leading `[options…]` directive lines and `#` comment lines; keep the SQL.
	return raw
		.split("\n")
		.filter((l) => !/^\s*\[/.test(l) && !/^\s*#/.test(l))
		.join("\n")
		.trim();
}

// The parser testdata also uses analyzer-style modes: `type` (bare type names), `expression`
// (bare expressions), `script` / `statement` (top-level statements). Our entry is `root` (a
// script of statements), so type-mode blocks aren't statements (drop) and expression-mode blocks
// are wrapped as `SELECT (…)`; script/statement pass through.
const defaultModeOf = (text) => text.match(/^\[default mode=([a-z_]+)\]/m)?.[1] ?? "statement";
const blockModeOverride = (querySection) => querySection.match(/^\s*\[mode=([a-z_]+)\]/m)?.[1];
function applyMode(query, mode) {
	if (mode === "type") return null;
	if (mode === "expression") return `SELECT (${query})`;
	return query;
}

// An expected `ERROR:` means the query did not parse — a NEGATIVE — EXCEPT a post-parse feature/
// support rejection ("… is not supported", "… is not implemented", "… is not a supported object
// type"). Those we accept: our parser is a permissive superset (every GoogleSQL feature ON), and a
// feature-OFF rejection for a feature WE implement reads exactly that way; DDL object-type rejections
// are post-parse too and are excluded from the gate as detect-only. Genuine structural parser errors
// with custom messages — "EXCEPT must be followed by ALL, DISTINCT, or (", "Expected keyword X but
// got Y", "The argument to UNNEST is an expression, not a query", "DEFINE MACRO … cannot be nested" —
// are real syntax errors and stay negatives even though they don't start with "Syntax error".
const startsWithSyntaxError = (expected) => /^ERROR:\s*Syntax error/i.test(expected.trim());
const isError = (expected) => /^ERROR:/i.test(expected.trim());
// A feature/support rejection only when the message is ABOUT support — and only if it is not already
// flagged as a "Syntax error" (those, e.g. "Syntax error: WHERE not supported after FROM query", are
// genuine parse errors that merely happen to contain the word "supported").
const isFeatureRejection = (expected) => /\bnot\s+(a\s+)?support|\bnot\s+implemented\b/i.test(expected);
const isSyntaxError = (expected) =>
	startsWithSyntaxError(expected) || (isError(expected) && !isFeatureRejection(expected));

// Feature-aware grading. ZetaSQL's parser is feature-gated: a `[language_features=…]` directive turns
// LanguageFeatures on/off, and a syntax that needs a disabled feature reports a *Syntax error*. Our
// parser is a permissive superset — every feature we implement is permanently ON — so a case that is
// a "syntax error" *only because a feature we implement is disabled* is one we correctly accept; it is
// NOT a valid negative for us. We therefore grade each case by the alternation group matching OUR
// feature config (the IMPLEMENTED set, all on) instead of the test's first (usually feature-off) group.
//
// IMPLEMENTED is deliberately conservative — only the query-layer features we have actually built. A
// feature we do NOT implement (Spanner-legacy DDL, dashed/slashed paths, …) is graded feature-OFF, so
// those negatives stay in the bucket to be driven to rejection by tightening the grammar, not excluded.
const IMPLEMENTED = new Set([
	"PIPES",
	"STATEMENT_WITH_PIPE_OPERATORS",
	"SQL_GRAPH",
	"SQL_GRAPH_ADVANCED_QUERY",
	"SQL_GRAPH_PATH_TYPE",
	"SQL_GRAPH_BOUNDED_PATH_QUANTIFICATION",
	"FOR_UPDATE",
	"QUALIFY",
	"LIMIT_ALL",
	"IS_DISTINCT",
	"BRACED_PROTO_CONSTRUCTORS",
	"WITH_GROUP_ROWS",
]);

const featureTokens = (s) => [...s.matchAll(/\+([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);

/**
 * Flatten the expected section into an ordered list of per-(queryVariant, directiveCombo) negative
 * flags. Handles both `ALTERNATION GROUP: <label>` (one config) and `ALTERNATION GROUPS:` followed by
 * several label lines that all share the next expected (many configs, one expected). The flat order is
 * query-variant outer, directive-combo inner — the same order `expand()` produces both — so a later
 * positional index `v * D + comboIndex` selects the right cell. Returns `[neg]` for a non-alternation
 * block.
 */
function flatGroupNegatives(expectedSection) {
	if (!/^ALTERNATION GROUPS?:/m.test(expectedSection)) return [isSyntaxError(expectedSection)];
	const parts = expectedSection.split(/^ALTERNATION GROUPS?:.*$/m).slice(1);
	const flat = [];
	for (const p of parts) {
		const lines = p.replace(/^[\r\n]+/, "").split("\n");
		let i = 0;
		const labels = [];
		while (i < lines.length && lines[i].trim() !== "--") labels.push(lines[i++]);
		const neg = isSyntaxError(lines.slice(i).join("\n").replace(/^[\r\n]*--[\r\n]*/, ""));
		const count = Math.max(1, labels.filter((l) => l.trim()).length); // GROUPS: shares one expected
		for (let k = 0; k < count; k++) flat.push(neg);
	}
	return flat;
}

/**
 * Index, among the directive's `expand()` combos, of the combo representing OUR parser: every toggled
 * feature we implement ON, every toggled feature we don't OFF. Base features (present in all combos)
 * are always on regardless. Falls back to the max-feature (last) combo when no exact match.
 */
function ourComboIndex(directive) {
	const combos = expand(directive);
	if (combos.length <= 1) return 0;
	const perCombo = combos.map(featureTokens);
	const all = [...new Set(perCombo.flat())];
	const toggled = all.filter((f) => !perCombo.every((c) => c.includes(f)));
	const target = new Set(toggled.filter((f) => IMPLEMENTED.has(f)));
	for (let i = 0; i < combos.length; i++) {
		const on = new Set(perCombo[i].filter((f) => toggled.includes(f)));
		if (on.size === target.size && [...target].every((f) => on.has(f))) return i;
	}
	return combos.length - 1;
}

/**
 * Classify each expanded query variant as negative (syntax error for our feature config) or positive,
 * grading by the directive combo our parser represents. Aligns the flattened expected cells to the
 * (query × directive) grid when the sizes match; otherwise zips per query variant as a fallback.
 */
function classifyVariants(variants, expectedSection, directive) {
	const flat = flatGroupNegatives(expectedSection);
	const D = expand(directive).length;
	const Q = variants.length;
	const ci = ourComboIndex(directive);
	if (flat.length === Q * D) return variants.map((_, v) => flat[v * D + ci]);
	if (flat.length === 1) return variants.map(() => flat[0]);
	return variants.map((_, v) => flat[v] ?? flat[0] ?? false);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

const fileDefaultDir = (text) => text.match(/^\[default language_features=([^\]]*)\]/m)?.[1] ?? "";
const blockDir = (querySection) => querySection.match(/^\s*\[language_features=([^\]]*)\]/m)?.[1];
const normalize = (s) => s.replace(/\s+/g, " ").trim();

const items = []; // { neg, name, sql }
let capped = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".test"))) {
	const text = readFileSync(join(SRC, file), "utf8");
	const base = file.replace(/\.test$/, "");
	const defaultMode = defaultModeOf(text);
	const defaultDir = fileDefaultDir(text);
	let i = 0;
	for (const block of blocks(text)) {
		const sep = block.indexOf("\n--");
		if (sep === -1) continue; // no expected section; skip prose-only blocks
		const querySection = block.slice(0, sep);
		const mode = blockModeOverride(querySection) ?? defaultMode;
		const directive = blockDir(querySection) ?? defaultDir;
		const query = cleanQuery(querySection);
		if (!query) continue;
		const expectedSection = block.slice(sep + 3);
		const all = expand(query);
		if (all.length > MAX_VARIANTS) capped++;
		const negatives = classifyVariants(all, expectedSection, directive);
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = all[v];
			if (!variant.trim()) continue;
			const emitted = applyMode(variant, mode);
			if (emitted === null) continue; // type-mode: not a statement
			items.push({ neg: negatives[v], name: `${base}_${i++}.sql`, sql: emitted });
		}
	}
}

// Cross-corpus dedup: a feature-off case under a FIXED directive (no inline on/off alternation to
// grade against) lands in the negative bucket, but if the identical SQL is tested with the feature ON
// elsewhere it is a positive there too. We implement the feature, so we correctly accept it — drop the
// negative copy. This removes the without-a-doubt feature-off cases that the per-block grading misses.
const posSql = new Set(items.filter((it) => !it.neg).map((it) => normalize(it.sql)));
let pos = 0;
let neg = 0;
let dedup = 0;
for (const it of items) {
	if (it.neg && posSql.has(normalize(it.sql))) {
		dedup++;
		continue;
	}
	writeFileSync(join(OUT, it.neg ? "negative" : "positive", it.name), it.sql + "\n");
	if (it.neg) neg++;
	else pos++;
}
console.log(`extracted: ${pos} positive, ${neg} negative -> ${OUT}`);
console.log(`feature-aware: ${dedup} negative(s) dropped as feature-off duplicates of a positive`);
if (capped)
	console.log(`note: ${capped} block(s) had >${MAX_VARIANTS} {{}} variants; capped to the first ${MAX_VARIANTS}`);
