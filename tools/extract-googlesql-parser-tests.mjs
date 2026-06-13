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
	// Drop leading `[options…]` directive lines and `#` comment lines; keep the SQL. The .test format
	// escapes an INPUT line that itself begins with `--` or `==` (which would collide with the
	// input/expected `--` and block `==` separators) by prefixing a backslash; unescape those so the
	// real SQL comment line is recovered (`\--comment` → `--comment`).
	return raw
		.split("\n")
		.filter((l) => !/^\s*\[/.test(l) && !/^\s*#/.test(l))
		.map((l) => l.replace(/^\\(--|==)/, "$1"))
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
// An expected block may begin with bracketed directive lines (e.g. `[NEWLINE \n]`) before the ERROR
// or parse tree; strip them so the error check sees the real first content line.
const stripExpectedDirectives = (expected) =>
	expected.replace(/^(?:\s*\[[^\]]*\]\s*\r?\n)+/, "").trim();
const startsWithSyntaxError = (expected) => /^ERROR:\s*Syntax error/i.test(stripExpectedDirectives(expected));
const isError = (expected) => /^ERROR:/i.test(stripExpectedDirectives(expected));
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
 * Expand `{{a|b}}` like `expand`, but also record, per result, the chosen option text at each `{{}}`
 * in source order. The label sequence lets us reconstruct ZetaSQL's per-cell ALTERNATION GROUP label.
 */
function expandWithLabels(query) {
	const m = query.match(/\{\{([\s\S]*?)\}\}/);
	if (!m) return [{ sql: query, labels: [] }];
	const opts = m[1].split("|");
	return opts.flatMap((o) =>
		expandWithLabels(query.slice(0, m.index) + o + query.slice(m.index + m[0].length)).map((r) => ({
			sql: r.sql,
			labels: [o, ...r.labels],
		})),
	);
}

/**
 * Our chosen option text at each `{{}}` in the directive — the option that enables the most IMPLEMENTED
 * features and no unimplemented ones, i.e. the feature config our permissive superset represents.
 */
function directiveChoices(directive) {
	const choices = [];
	for (const m of directive.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
		const opts = m[1].split("|");
		let best = opts[0];
		let bestScore = -1;
		for (const o of opts) {
			const feats = featureTokens(o);
			if (feats.every((f) => IMPLEMENTED.has(f)) && feats.length > bestScore) {
				bestScore = feats.length;
				best = o;
			}
		}
		choices.push(best);
	}
	return choices;
}

/**
 * Map each ALTERNATION GROUP label → its negative flag. ZetaSQL labels a cell by joining the chosen
 * alternation option texts — directive `{{}}`s then query `{{}}`s, in source order — with ",", and uses
 * "<empty>" when every choice is empty. `ALTERNATION GROUP: <label>` (singular) carries one label on
 * the header; `ALTERNATION GROUPS:` (plural) lists several labels (sharing one expected) on the lines
 * before `--`. Returns null when the block has no alternations at all.
 */
function buildLabelMap(expectedSection) {
	if (!/^ALTERNATION GROUPS?:/m.test(expectedSection)) return null;
	const map = new Map();
	const heads = [...expectedSection.matchAll(/^ALTERNATION GROUP(S)?:(.*)$/gm)];
	for (let h = 0; h < heads.length; h++) {
		const plural = heads[h][1] === "S";
		const start = heads[h].index + heads[h][0].length;
		const end = h + 1 < heads.length ? heads[h + 1].index : expectedSection.length;
		const body = expectedSection.slice(start, end);
		const labels = [];
		let expectedText;
		if (plural) {
			const lines = body.replace(/^[\r\n]+/, "").split("\n");
			let i = 0;
			while (i < lines.length && lines[i].trim() !== "--") {
				if (lines[i].trim()) labels.push(lines[i].trim());
				i++;
			}
			expectedText = lines.slice(i).join("\n").replace(/^[\r\n]*--[\r\n]*/, "");
		} else {
			labels.push(heads[h][2].trim());
			const ci = body.indexOf("--");
			expectedText = ci === -1 ? body : body.slice(ci + 2);
		}
		const neg = isSyntaxError(expectedText);
		for (const lab of labels) map.set(lab, neg);
	}
	return map;
}

/**
 * Classify each expanded query variant as negative (the query must not parse for our feature config)
 * or positive. We reconstruct the ALTERNATION GROUP label of each cell — our directive feature choices
 * plus the variant's own query choices, joined with "," (ZetaSQL's labelling) — and look it up. This is
 * robust to multi-dimensional alternations and to ZetaSQL grouping several combos under one expected
 * (where a positional grid is ambiguous). Falls back to the single non-alternation expected.
 */
function classifyVariants(query, expectedSection, directive) {
	const withLabels = expandWithLabels(query);
	const labelMap = buildLabelMap(expectedSection);
	if (!labelMap) return withLabels.map(() => isSyntaxError(expectedSection));
	const dChoices = directiveChoices(directive);
	return withLabels.map((v) => {
		const joined = [...dChoices, ...v.labels].join(",");
		const key = joined === "" ? "<empty>" : joined;
		if (labelMap.has(key)) return labelMap.get(key);
		// Unmatched (label-format edge): default to the most common verdict among the groups.
		const negs = [...labelMap.values()];
		return negs.filter(Boolean).length >= negs.length / 2;
	});
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
		const negatives = classifyVariants(query, expectedSection, directive);
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
