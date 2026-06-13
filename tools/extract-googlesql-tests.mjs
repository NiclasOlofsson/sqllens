// Extract a parse corpus from ZetaSQL's .test golden files.
// Each .test file is `==`-separated blocks; the query precedes `--`, the expected result follows.
// Expected starting with "ERROR: Syntax error" => the query must NOT parse (negative); anything else
// (a resolved AST, or a semantic ERROR) => the query must parse (positive). `{{a|b}}` alternations
// are expanded combinatorially (capped per block to avoid blow-up). Run: node tools/extract-googlesql-tests.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SRC = "vendor/googlesql/googlesql/analyzer/testdata";
const OUT = "harness/local/bigquery-zetasql";
const MAX_VARIANTS = 8; // cap `{{a|b|…}}` expansion per block; see Open Risk 2 in the plan

if (!existsSync(SRC)) {
	console.error(`missing ${SRC} — sparse-clone google/googlesql first (see the plan)`);
	process.exit(1);
}

/**
 * Expand `{{a|b|c}}` alternations into all variants. Empty option (e.g. `{{x.|}}`) => "".
 * Non-greedy `[\s\S]*?` so an option may itself contain a single `}` (e.g. `{{|{1}}}`, a graph
 * quantifier, or a `{prop: v}` spec) — the delimiter is `}}`, not `}`. Leftmost group varies
 * slowest, which matches ZetaSQL's ALTERNATION GROUP emission order (see classifyVariants).
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
	// Drop leading `[options...]` lines and `#` comment lines; keep the SQL.
	return raw
		.split("\n")
		.filter((l) => !/^\s*\[/.test(l) && !/^\s*#/.test(l))
		.join("\n")
		.trim();
}

// ZetaSQL analyzer tests run in a `mode`: statement (default), expression, or type, selecting the
// ParseScript / ParseExpression / ParseType entry point. Our parser only exposes the statement
// entry (`root`), so a bare expression or type isn't a parseable "statement". To keep the corpus a
// statement-parse corpus while preserving expression coverage, expression-mode blocks are wrapped
// as `SELECT (<expr>)` (faithful — routes the expression through the statement grammar) and
// type-mode blocks are dropped (type-name syntax is already exercised by every CAST / column-def
// in the statement-mode files; wrapping types is fragile on the negative cases).
function defaultModeOf(text) {
	const m = text.match(/^\[default mode=([a-z]+)\]/m);
	return m ? m[1] : "statement";
}

function blockModeOverride(rawQuerySection) {
	const m = rawQuerySection.match(/^\s*\[mode=([a-z]+)\]/m);
	return m ? m[1] : undefined;
}

/** Apply the effective mode to a cleaned query. Returns the SQL to emit, or null to skip. */
function applyMode(query, mode) {
	if (mode === "type") return null;
	if (mode === "expression") return `SELECT (${query})`;
	return query;
}

const isSyntaxError = (expected) => /^ERROR:\s*Syntax error/i.test(expected.trim());

/**
 * Classify each expanded variant of a block as negative (syntax error) or positive.
 *
 * A `{{a|b}}` block's expected section is a sequence of `ALTERNATION GROUP: <subst>\n--\n<expected>`
 * subsections, emitted in the same order `expand()` produces variants (leftmost group slowest), so
 * we zip them positionally. Without alternations the whole expected applies to the single variant.
 * Returns an array of booleans (negative?) aligned with `variants`.
 */
function classifyVariants(variants, expectedSection) {
	if (!/^ALTERNATION GROUP:/m.test(expectedSection)) {
		const neg = isSyntaxError(expectedSection);
		return variants.map(() => neg);
	}
	// Split into per-group expecteds, in order. Each chunk after a group header is `\n--\n<exp>`
	// (CRLF-tolerant: strip the leading newline(s) + `--` + newline(s) before the expected text).
	const chunks = expectedSection.split(/^ALTERNATION GROUP:.*$/m).slice(1);
	const groupNegatives = chunks.map((c) => isSyntaxError(c.replace(/^[\r\n]*--[\r\n]*/, "")));
	// Zip positionally; if ZetaSQL emitted fewer groups than we expanded (shouldn't happen), the
	// trailing variants fall back to the first group's classification.
	return variants.map((_, i) => groupNegatives[i] ?? groupNegatives[0] ?? false);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

let pos = 0;
let neg = 0;
let capped = 0;
let skippedType = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".test"))) {
	const text = readFileSync(join(SRC, file), "utf8");
	const base = file.replace(/\.test$/, "");
	const defaultMode = defaultModeOf(text);
	let i = 0;
	for (const block of blocks(text)) {
		const sep = block.indexOf("\n--");
		if (sep === -1) continue; // no expected section; skip prose-only blocks
		const querySection = block.slice(0, sep);
		const mode = blockModeOverride(querySection) ?? defaultMode;
		const query = cleanQuery(querySection);
		if (!query) continue;
		const expectedSection = block.slice(sep + 3);
		const all = expand(query);
		if (all.length > MAX_VARIANTS) capped++;
		// Per-variant classification (alternation groups carry per-variant expecteds).
		const negatives = classifyVariants(all, expectedSection);
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = all[v];
			if (!variant.trim()) continue;
			const emitted = applyMode(variant, mode);
			if (emitted === null) {
				skippedType++;
				continue;
			}
			const dir = negatives[v] ? "negative" : "positive";
			writeFileSync(join(OUT, dir, `${base}_${i++}.sql`), emitted + "\n");
			if (negatives[v]) neg++;
			else pos++;
		}
	}
}
console.log(`extracted: ${pos} positive, ${neg} negative (skipped ${skippedType} type-mode) -> ${OUT}`);
if (capped)
	console.log(`note: ${capped} block(s) had >${MAX_VARIANTS} {{}} variants; capped to the first ${MAX_VARIANTS}`);
