// Extract a parse corpus from ZetaSQL's ANALYZER golden files (googlesql/analyzer/testdata).
// Each .test file is `==`-separated blocks; the query precedes `--`, the expected result follows.
// A negative is a query that does not parse (a "Syntax error" or a custom structural parser error);
// anything else — a resolved AST, or a post-parse semantic / "not supported" error — is a positive.
// `{{a|b}}` alternations expand combinatorially (capped per block) and are classified per variant.
//
// All extraction/classification is shared with the parser-testdata extractor via
// tools/googlesql-testdata.mjs so the two gates grade identically (feature-aware alternation label
// matching, custom-error handling, plural ALTERNATION GROUPS, the `\--`/array/directive cleaning).
// Run: node tools/extract-googlesql-tests.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	blockDir,
	blockModeOverride,
	blocks,
	classifyVariants,
	cleanQuery,
	defaultModeOf,
	expand,
	fileDefaultDir,
	isAnalyzerSyntaxError,
	normalize,
} from "./googlesql-testdata.mjs";

const SRC = "vendor/googlesql/googlesql/analyzer/testdata";
const OUT = "harness/local/bigquery-zetasql";
const MAX_VARIANTS = 8; // cap `{{a|b|…}}` expansion per block; see Open Risk 2 in the plan

if (!existsSync(SRC)) {
	console.error(`missing ${SRC} — sparse-clone google/googlesql first (see the plan)`);
	process.exit(1);
}

// ZetaSQL analyzer tests run in a `mode`: statement (default), expression, measure_expression, or
// type, selecting the ParseScript / ParseExpression / ParseType entry. Our parser exposes only the
// statement entry (`root`), so a bare expression isn't a parseable statement: expression-mode blocks
// are wrapped as `SELECT (<expr>)` (faithful) and type-mode blocks are dropped (type-name syntax is
// already exercised by every CAST / column-def in statement-mode files).
function applyMode(query, mode) {
	if (mode === "type") return null;
	if (mode === "expression" || mode === "measure_expression") return `SELECT (${query})`;
	return query;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

const items = []; // { neg, name, sql }
let capped = 0;
let skippedType = 0;
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
		// Analyzer testdata: only "ERROR: Syntax error" is a parse error; semantic errors parse fine.
		const negatives = classifyVariants(query, expectedSection, directive, isAnalyzerSyntaxError);
		for (let v = 0; v < Math.min(all.length, MAX_VARIANTS); v++) {
			const variant = all[v];
			if (!variant.trim()) continue;
			const emitted = applyMode(variant, mode);
			if (emitted === null) {
				skippedType++;
				continue;
			}
			items.push({ neg: negatives[v], name: `${base}_${i++}.sql`, sql: emitted });
		}
	}
}

// Cross-corpus dedup: a feature-off case under a FIXED directive lands in the negative bucket, but if
// the identical SQL is tested with the feature ON elsewhere it is a positive there too. We implement
// the feature, so we correctly accept it — drop the negative copy.
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
console.log(`extracted: ${pos} positive, ${neg} negative (skipped ${skippedType} type-mode) -> ${OUT}`);
console.log(`feature-aware: ${dedup} negative(s) dropped as feature-off duplicates of a positive`);
if (capped)
	console.log(`note: ${capped} block(s) had >${MAX_VARIANTS} {{}} variants; capped to the first ${MAX_VARIANTS}`);
