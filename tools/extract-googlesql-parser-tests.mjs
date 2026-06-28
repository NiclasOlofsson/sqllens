// Extract a parse corpus from ZetaSQL's PARSER golden files (googlesql/parser/testdata).
//
// This is a second, stricter corpus alongside tools/extract-googlesql-tests.mjs (which reads the
// ANALYZER testdata). The parser testdata is pure syntax: every block is `query -- <parse-tree> --
// <unparsed-sql>` for a positive, or `query -- ERROR: Syntax error: …` for a negative. Unlike the
// analyzer corpus, the negatives here are *true* syntax errors (the parser's own error productions),
// so this gate is a cleaner two-sided signal and the positives are parseable by construction.
//
// Block options (`[default …]`, `[language_features=…]`, `[node_kind=…]`) and `#` comments are
// stripped; alternations are classified per-variant by reconstructing their ALTERNATION GROUP labels.
// All shared extraction/classification lives in tools/googlesql-testdata.mjs (kept identical to the
// analyzer extractor). Run: node tools/extract-googlesql-parser-tests.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";
import {
	blockDir,
	blockModeOverride,
	blocks,
	classifyVariants,
	cleanQuery,
	defaultModeOf,
	disablesImplemented,
	expand,
	featureOffExpected,
	fileDefaultDir,
	normalize,
	stripLeadingDirectives,
} from "./googlesql-testdata.mjs";

const SRC = corpusPath("vendor/googlesql/googlesql/parser/testdata");
const OUT = corpusPath("harness/local/bigquery-zetasql-parser");
const MAX_VARIANTS = 8; // cap `{{a|b|…}}` expansion per block (matches the analyzer extractor)

if (!existsSync(SRC)) {
	console.error(
		`missing ${SRC} — add it to the sparse clone first:\n` +
			`  git -C "$SQL_CORPUS_DIR/vendor/googlesql" sparse-checkout add googlesql/parser/testdata`,
	);
	process.exit(1);
}

// The parser testdata uses analyzer-style modes: `type` (bare type names — dropped, not a statement),
// `expression` (bare expressions — wrapped as `SELECT (…)`), `script`/`statement` (pass through).
function applyMode(query, mode) {
	if (mode === "type") return null;
	if (mode === "expression") return `SELECT (${query})`;
	return query;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

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
		const blockDirective = blockDir(querySection);
		const directive = blockDirective ?? defaultDir;
		const query = cleanQuery(querySection);
		if (!query) continue;
		const expectedSection = block.slice(sep + 3);
		const all = expand(query);
		if (all.length > MAX_VARIANTS) capped++;
		const negatives = classifyVariants(query, expectedSection, directive);
		// A block whose own directive disables an implemented feature the file default enables tests that
		// feature OFF — we accept such SQL (permissive superset), so its negatives aren't valid for us.
		// The expected-string feature-off / divergence rules are shared with the analyzer extractor.
		const featureOff =
			disablesImplemented(blockDirective, defaultDir) || featureOffExpected(expectedSection, query);
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = stripLeadingDirectives(all[v]);
			if (!variant.trim()) continue;
			const emitted = applyMode(variant, mode);
			if (emitted === null) continue; // type-mode: not a statement
			if (featureOff && negatives[v]) continue; // feature-off negative for a feature we implement
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
