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

const isSyntaxError = (expected) => /^ERROR:\s*Syntax error/i.test(expected.trim());

/**
 * Classify each expanded variant as negative (syntax error) or positive.
 *
 * A `{{a|b}}` block's expected section is a sequence of `ALTERNATION GROUP: <subst>\n--\n<expected>`
 * subsections in the same order `expand()` produces variants, so we zip positionally. Without
 * alternations the whole expected applies to the single variant. Each per-group expected may itself
 * carry the trailing `-- <unparsed-sql>` section; isSyntaxError only inspects its start, so that is
 * harmless. Returns an array of booleans (negative?) aligned with `variants`.
 */
function classifyVariants(variants, expectedSection) {
	if (!/^ALTERNATION GROUP:/m.test(expectedSection)) {
		const neg = isSyntaxError(expectedSection);
		return variants.map(() => neg);
	}
	const chunks = expectedSection.split(/^ALTERNATION GROUP:.*$/m).slice(1);
	const groupNegatives = chunks.map((c) => isSyntaxError(c.replace(/^[\r\n]*--[\r\n]*/, "")));
	return variants.map((_, i) => groupNegatives[i] ?? groupNegatives[0] ?? false);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

let pos = 0;
let neg = 0;
let capped = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".test"))) {
	const text = readFileSync(join(SRC, file), "utf8");
	const base = file.replace(/\.test$/, "");
	let i = 0;
	for (const block of blocks(text)) {
		const sep = block.indexOf("\n--");
		if (sep === -1) continue; // no expected section; skip prose-only blocks
		const query = cleanQuery(block.slice(0, sep));
		if (!query) continue;
		const expectedSection = block.slice(sep + 3);
		const all = expand(query);
		if (all.length > MAX_VARIANTS) capped++;
		const negatives = classifyVariants(all, expectedSection);
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = all[v];
			if (!variant.trim()) continue;
			const dir = negatives[v] ? "negative" : "positive";
			writeFileSync(join(OUT, dir, `${base}_${i++}.sql`), variant + "\n");
			if (negatives[v]) neg++;
			else pos++;
		}
	}
}
console.log(`extracted: ${pos} positive, ${neg} negative -> ${OUT}`);
if (capped)
	console.log(`note: ${capped} block(s) had >${MAX_VARIANTS} {{}} variants; capped to the first ${MAX_VARIANTS}`);
