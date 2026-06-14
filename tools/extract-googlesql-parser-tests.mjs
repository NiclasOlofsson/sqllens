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
import {
	blockDir,
	blockModeOverride,
	blocks,
	classifyVariants,
	cleanQuery,
	defaultModeOf,
	disablesImplemented,
	expand,
	fileDefaultDir,
	normalize,
} from "./googlesql-testdata.mjs";

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
		let featureOff = disablesImplemented(blockDirective, defaultDir);
		// Bare QUALIFY: BigQuery's docs allow a QUALIFY clause without a preceding WHERE/GROUP BY/HAVING;
		// ZetaSQL's parser requires one ("QUALIFY clause must be used in conjunction with WHERE or GROUP
		// BY or HAVING clause"). This repo deliberately follows BigQuery (see CLAUDE.md), so we accept it
		// — not a valid negative for us.
		if (/QUALIFY clause must be used in conjunction with WHERE/.test(expectedSection)) featureOff = true;
		// "Unexpected FROM [at …]" is the signature ZetaSQL emits for a FROM-query (bare `FROM t`, or a
		// from-query as a subquery) when FEATURE_PIPES is off — the from_query production is pipe-gated. We
		// implement PIPES (permanently on), so a from-query is valid for us; such a case is feature-off,
		// not a real negative. (Tighten to the location-suffixed form so the genuine, PIPES-independent
		// "Unexpected FROM; FROM queries following a set operation must be parenthesized" stays a negative.)
		if (/Syntax error: Unexpected FROM \[at/.test(expectedSection)) featureOff = true;
		// An alias on a parenthesized outer query (`(SELECT 1) AS q`) is a pipe-syntax feature; with PIPES
		// off ZetaSQL reports "Alias not allowed on parenthesized outer query". We implement PIPES, so the
		// same SQL is a positive (pipe_parenthesized_query_alias's +PIPES variants) — feature-off for us.
		if (/Alias not allowed on parenthesized outer query/.test(expectedSection)) featureOff = true;
		// Consecutive ON/USING inside a PARENTHESIZED (regular) join is the ALLOW_CONSECUTIVE_ON feature,
		// which we implement — `|> JOIN (t1 JOIN t2 JOIN t3 ON c1 ON c2)`. ZetaSQL with the feature off
		// reports "Expected end of input but got ON/USING". The `JOIN (` guard keeps the genuine,
		// feature-independent pipe-direct form (`|> JOIN t ON a ON b`, single-clause only) a negative.
		if (/Expected end of input but got keyword (ON|USING)\b/.test(expectedSection) && /\bjoin\s*\(/i.test(query)) {
			featureOff = true;
		}
		// `[no_reserve_graph_table]` makes GRAPH_TABLE a plain identifier, so `GRAPH_TABLE(… MATCH …)` is
		// read as a regular function call and the MATCH errors ("Expected ")" but got keyword MATCH"). We
		// always reserve GRAPH_TABLE (the GoogleSQL default), so this is a config we don't model — accept.
		if (/Expected "\)" but got keyword MATCH/.test(expectedSection)) featureOff = true;
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = all[v];
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
