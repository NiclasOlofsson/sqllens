// Harvest per-dialect function SIGNATURES (parameter names + arity + variadic) from the docs
// corpora into committed, generated tables `src/signature/generated/<dialect>.ts`. Signature help
// (src/signature/signature.ts) reads these AFTER the hand-curated FUNCTION_SIGNATURES table, so a
// curated entry always wins and the harvest fills the long tail; anything neither table knows still
// degrades to the name-only hint.
//
// NEVER-WRONG CONTRACT: a signature is emitted ONLY when its documented syntax block parses
// UNAMBIGUOUSLY into `name(param[, param…])` form — a flat, comma-separated list of plain parameter
// names (optional trailing params flattened in, a `…n`/`...` tail marked variadic). Anything else —
// alternations `{ a | b }`, in-argument clause keywords (FROM/AS/OVER/ORDER/USING), `<angle>` sub-rule
// references, `::=` productions, multi-word params, or two blocks on one page that disagree on the
// parameter list (a genuine overload) — is SKIPPED, counted, and reported. A wrong parameter name or
// arity is worse than the name-only fallback, so we skip aggressively.
//
// SOURCES. The scraped example corpora hold runnable SQL statements, not function-syntax blocks, so
// they can't yield parameter names. The only offline source in the corpus repo that carries function
// SYNTAX notation is the T-SQL reference markdown (MicrosoftDocs/sql-docs, vendored at
// vendor/sql-docs), whose ```syntaxsql``` fenced blocks are exactly `NAME ( param , … )`. The other
// seven dialects' reference docs (postgresql.org / docs.snowflake.com / docs.databricks.com HTML,
// duckdb-web markdown, ZetaSQL, and the trinodb sphinx tree — trino/docs holds only the extracted
// example SQL plus a block-count manifest.json, no function-syntax notation) were consumed live by
// their scrapers and only the extracted example SQL landed in the corpus repo — no syntax notation
// survives — so they get no generated table until their raw docs are vendored. Each dialect's
// extractor is registered below; an absent source is reported, not guessed.
//
// Self-contained by design (repo convention — shares no code with the library). The emitted tables
// are committed, so rebuild AND format after a corpus refresh:
//   node tools/harvest-signatures.mjs && npm run format
// (prettier owns line-wrapping; the harvester emits one entry per line and lets format wrap it.)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "signature", "generated");
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// T-SQL — MicrosoftDocs/sql-docs docs/t-sql/functions/**/*.md, ```syntaxsql``` blocks.
// ---------------------------------------------------------------------------

/** All ```syntaxsql``` fenced blocks in a markdown string. */
function syntaxsqlBlocks(md) {
	const out = [];
	const re = /```syntaxsql\r?\n([\s\S]*?)```/g;
	let m;
	while ((m = re.exec(md))) out.push(m[1]);
	return out;
}

/**
 * Parse ONE syntaxsql block into `{ name, params, variadic }`, or `{ skip: reason }` when it isn't a
 * clean `name(param, …)` signature, or `null` when the block has no function-call line at all. Only
 * the FIRST balanced `( … )` after a leading function name is considered; trailing clauses (OVER,
 * WITHIN GROUP, `[ <order_clause> ]`) are ignored.
 */
function parseTSqlSig(block) {
	const lines = block
		.replace(/\r/g, "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const line = lines.find((l) => /^[A-Za-z_][\w]*\s*\(/.test(l));
	if (!line) return null;
	const name = line.match(/^([A-Za-z_][\w]*)\s*\(/)[1];

	// First balanced paren group on the signature line.
	let depth = 0;
	let start = -1;
	let end = -1;
	for (let i = line.indexOf("("); i < line.length; i++) {
		if (line[i] === "(") {
			if (depth === 0) start = i;
			depth++;
		} else if (line[i] === ")") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (start === -1 || end === -1) return null;

	let inner = line.slice(start + 1, end).trim();
	if (inner === "") return { name, params: [], variadic: false };

	// A `[ , …n ]` / trailing `...` marks the last param as repeating.
	let variadic = false;
	if (/\[\s*,?\s*\.\.\.\s*n?\s*\]|\.\.\.\s*n?\s*$|,\s*\.\.\./.test(inner)) variadic = true;
	inner = inner.replace(/\[\s*,?\s*\.\.\.\s*n?\s*\]/g, "").replace(/\.\.\.\s*n?/g, "");

	// Anything the flat-list model can't represent → skip (never guess).
	if (/[{}|<>]|::=|\bFROM\b|\bAS\b|\bOVER\b|\bUSING\b|\bORDER\b/i.test(inner)) return { skip: "complex" };

	// Flatten SIMPLE optional groups — `[ , x ]` → `, x`, `[ x ]` → `x` — repeatedly. Anything left
	// bracketed is a non-trivial optional group → skip.
	let prev;
	do {
		prev = inner;
		inner = inner.replace(/\[\s*(,?)\s*([A-Za-z_][\w]*)\s*\]/g, "$1 $2");
	} while (inner !== prev);
	if (/[[\]]/.test(inner)) return { skip: "optional-group" };

	const params = inner
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s !== "");
	// Every param must be a single plain identifier — a multi-word / typed / punctuated piece means
	// the notation is richer than we model, so skip rather than mis-name.
	for (const pr of params) if (!/^[A-Za-z_][\w]*$/.test(pr)) return { skip: "param-shape" };
	return { name, params, variadic };
}

function* mdFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* mdFiles(p);
		else if (e.name.endsWith(".md")) yield p;
	}
}

/** T-SQL extractor. Returns null when the source tree is absent. */
function harvestTSql() {
	const src = corpusPath("vendor/sql-docs/docs/t-sql/functions");
	if (!existsSync(src)) return null;
	const signatures = {};
	const provenance = {};
	const skips = { complex: 0, "optional-group": 0, "param-shape": 0 };
	let conflicts = 0;
	let pagesNoSig = 0;

	for (const f of mdFiles(src)) {
		// Per page (= one function's reference), collect each name's candidate signatures. A page that
		// documents overloads with DIFFERENT parameter lists is a conflict → skip that name.
		const cands = new Map();
		for (const block of syntaxsqlBlocks(readFileSync(f, "utf8"))) {
			const r = parseTSqlSig(block);
			if (!r) continue;
			if (r.skip) {
				skips[r.skip]++;
				continue;
			}
			const key = r.name.toLowerCase();
			if (!cands.has(key)) cands.set(key, new Map());
			const sig = { name: r.name, params: r.params.map((n) => ({ name: n })), variadic: r.variadic };
			cands.get(key).set(JSON.stringify([r.params, r.variadic]), sig);
		}
		if (cands.size === 0) {
			pagesNoSig++;
			continue;
		}
		for (const [key, variants] of cands) {
			if (variants.size !== 1) {
				conflicts++;
				continue;
			}
			signatures[key] = [...variants.values()][0];
			provenance[key] = relative(corpusPath("vendor/sql-docs/docs/t-sql"), f).split("\\").join("/");
		}
	}
	return {
		signatures,
		provenance,
		source: "MicrosoftDocs/sql-docs  docs/t-sql/functions/**/*.md (```syntaxsql``` blocks)",
		stats: { emitted: Object.keys(signatures).length, conflicts, pagesNoSig, skips },
	};
}

// ---------------------------------------------------------------------------
// Registry — one entry per dialect. An extractor returns null (source absent) or a harvest result.
// Only T-SQL has an offline syntax-block source in the corpus repo today (see the header note).
// ---------------------------------------------------------------------------
const EXTRACTORS = {
	databricks: () => null,
	tsql: harvestTSql,
	snowflake: () => null,
	bigquery: () => null,
	redshift: () => null,
	postgres: () => null,
	duckdb: () => null,
	trino: () => null,
	sqlite: () => null,
};

const CONST_NAME = {
	databricks: "DATABRICKS_HARVESTED",
	tsql: "TSQL_HARVESTED",
	snowflake: "SNOWFLAKE_HARVESTED",
	bigquery: "BIGQUERY_HARVESTED",
	redshift: "REDSHIFT_HARVESTED",
	postgres: "POSTGRES_HARVESTED",
	duckdb: "DUCKDB_HARVESTED",
	trino: "TRINO_HARVESTED",
	sqlite: "SQLITE_HARVESTED",
};

/** Serialize one FnSignature literal (stable key order). */
function fnLiteral(sig) {
	const params = sig.params.map((p) => `{ name: ${JSON.stringify(p.name)} }`).join(", ");
	const variadic = sig.variadic ? ", variadic: true" : "";
	return `{ name: ${JSON.stringify(sig.name)}, params: [${params}]${variadic} }`;
}

function renderTable(dialect, result) {
	const constName = CONST_NAME[dialect];
	const keys = Object.keys(result.signatures).sort();
	const rows = keys.map((k) => `\t${k}: ${fnLiteral(result.signatures[k])}, // ${result.provenance[k]}`).join("\n");
	return (
		`// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format\n` +
		`// Source: ${result.source}\n` +
		`// Harvested ${TODAY}. ${keys.length} signatures. Curated FUNCTION_SIGNATURES override these.\n` +
		`import type { FnSignature } from "../signatures.js";\n\n` +
		`/** Harvested (doc-syntax-derived) parameter signatures for ${dialect}, keyed by lowercased name. */\n` +
		`export const ${constName}: Record<string, FnSignature> = {\n${rows}\n};\n`
	);
}

function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	const summary = [];
	for (const [dialect, extractor] of Object.entries(EXTRACTORS)) {
		const result = extractor();
		if (!result) {
			summary.push(`  ${dialect.padEnd(11)} — no offline syntax-block source in the corpus repo → no table`);
			continue;
		}
		writeFileSync(join(OUT_DIR, `${dialect}.ts`), renderTable(dialect, result));
		const s = result.stats;
		const skipStr = Object.entries(s.skips)
			.map(([k, v]) => `${k}=${v}`)
			.join(" ");
		summary.push(
			`  ${dialect.padEnd(11)} — ${s.emitted} emitted | skipped: ${skipStr}, conflicts=${s.conflicts}, ` +
				`pages-without-clean-sig=${s.pagesNoSig}`,
		);
	}
	console.log(`harvest-signatures → ${OUT_DIR}`);
	console.log(summary.join("\n"));
}

main();
