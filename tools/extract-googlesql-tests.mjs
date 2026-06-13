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

/** Expand `{{a|b|c}}` alternations into all variants. Empty option (e.g. `{{x.|}}`) => "". */
function expand(query) {
	const m = query.match(/\{\{([^}]*)\}\}/);
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
		const expected = block.slice(sep + 3).trim();
		const negative = /^ERROR:\s*Syntax error/i.test(expected);
		const all = expand(query);
		if (all.length > MAX_VARIANTS) capped++;
		for (const variant of all.slice(0, MAX_VARIANTS)) {
			if (!variant.trim()) continue;
			const dir = negative ? "negative" : "positive";
			writeFileSync(join(OUT, dir, `${base}_${i++}.sql`), variant + "\n");
			if (negative) neg++;
			else pos++;
		}
	}
}
console.log(`extracted: ${pos} positive, ${neg} negative -> ${OUT}`);
if (capped)
	console.log(`note: ${capped} block(s) had >${MAX_VARIANTS} {{}} variants; capped to the first ${MAX_VARIANTS}`);
