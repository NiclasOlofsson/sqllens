// Parse-speed benchmark over the real Oatly corpus (compiled-dbt Databricks SQL).
//
// Durable rebuild of the throwaway perf probes that used to live in temp_auto. Methodology and the
// reference baseline are documented in the knowledgebase (perf-baseline-parser-vs-sqlglot); this
// reproduces it so a before/after (e.g. a gen-flag or minify change) is one command: `npm run bench`.
//
// It measures the two things that matter:
//   - parse-to-CST (parseDatabricks, the two-stage SLL->LL entry): cold first parse (one-time warm-up
//     tax), warm steady per-file median/mean/p95/max, and the pass-by-pass totals that show ANTLR's
//     lazy DFA making the FIRST full sweep ~6x the steady sweep.
//   - full pipeline (parse + lower + resolveScopes): the semantic front-half throughput.
//
// Reference baseline (2026-07-02, 1558 files): parse median 0.24 ms / mean 0.50 ms per file, pipeline
// ~1.6 ms/file, cold first parse ~140-160 ms. Numbers are machine-relative; compare deltas, not absolutes.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower } from "../src/databricks/lower.js";
import { resolveScopes } from "../src/scope/scope.js";

const PASSES = 6;
const CORPUS = corpusPath("databricks/oatly");

const rels = readdirSync(CORPUS, { recursive: true }).filter((f) => typeof f === "string" && f.endsWith(".sql"));
const texts = rels.map((rel) => readFileSync(join(CORPUS, rel), "utf8"));
if (texts.length === 0) {
	console.error(`No .sql files under ${CORPUS} — is SQL_CORPUS_DIR set (see .env / CLAUDE.md)?`);
	process.exit(1);
}
const mb = (texts.reduce((n, t) => n + t.length, 0) / 1048576).toFixed(1);
console.log(`Oatly corpus: ${texts.length} files, ${mb} MB\n`);

// Cold: the very first parse of the process (the one-time V8-JIT + lazy-DFA warm-up tax).
const c0 = performance.now();
parseDatabricks(texts[0]);
const cold = performance.now() - c0;

// Warm parse-to-CST: full sweeps with per-file timing; steady = the best (fastest) sweep.
const passTotals = [];
let warmPerFile = [];
for (let p = 0; p < PASSES; p++) {
	const perFile = new Array(texts.length);
	const t = performance.now();
	for (let i = 0; i < texts.length; i++) {
		const s = performance.now();
		parseDatabricks(texts[i]);
		perFile[i] = performance.now() - s;
	}
	passTotals.push(performance.now() - t);
	warmPerFile = perFile;
}

// Warm full pipeline: parse + lower + resolveScopes; steady = best sweep.
let pipeTotal = Infinity;
for (let p = 0; p < PASSES; p++) {
	const t = performance.now();
	for (const text of texts) resolveScopes(lower(parseDatabricks(text).tree), "databricks");
	pipeTotal = Math.min(pipeTotal, performance.now() - t);
}

const sorted = [...warmPerFile].sort((a, b) => a - b);
const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const mean = warmPerFile.reduce((a, b) => a + b, 0) / warmPerFile.length;
const steady = Math.min(...passTotals);
const fps = (msTotal) => Math.round(texts.length / (msTotal / 1000));
const f = (n) => n.toFixed(2);

console.log("parse-to-CST (two-stage SLL->LL):");
console.log(`  cold first parse:   ${f(cold)} ms  (one-time)`);
console.log(`  warm steady sweep:  ${f(steady)} ms  (${fps(steady)} files/s)`);
console.log(
	`  per-file:           median ${f(at(0.5))} ms, mean ${f(mean)} ms, p95 ${f(at(0.95))} ms, max ${f(at(1))} ms`,
);
console.log(
	`  pass totals (ms):   ${passTotals.map((t) => Math.round(t)).join(" -> ")}   (first sweep >> steady = lazy DFA)\n`,
);
console.log("full pipeline (parse + lower + resolveScopes):");
console.log(
	`  warm steady sweep:  ${f(pipeTotal)} ms  (${f(pipeTotal / texts.length)} ms/file, ${fps(pipeTotal)} files/s)`,
);
