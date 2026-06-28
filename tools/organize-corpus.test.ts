// ONE-TIME corpus reorganization. Runs HERE (where the parsers live), moves files in the corpus
// repo (resolved via corpusPath / SQL_CORPUS_DIR). Classifies every .sql by parse → lower → the
// real statement category, and lays the corpus out as:
//
//   <dialect>/<source>/<stage>/<validity>/<category>/<slug…>/<file>.sql
//
// dialect   databricks | tsql | snowflake | bigquery | redshift
// source    where it came from, a plain label (oatly, docs, zetasql, grammars-v4, bytebase)
// stage     parser (syntax) | analyzer (resolution/types)
// validity  positive (must parse) | negative (must be rejected)
// category  query|dml|ddl|dcl|tcl|utility|compound|other|unparsed  (parse-derived; unparsed = didn't parse)
//
// Guarded behind ORGANIZE=1 so `npm test` never triggers it. Run explicitly:
//   ORGANIZE=1 npx vitest run tools/organize-corpus.test.ts
//   ORGANIZE=1 ONLY="vendor/grammars-v4/sql/snowflake/examples" npx vitest run tools/organize-corpus.test.ts
// It's a one-shot migration; the corpus repo is git-backed, so moves are recoverable.

import { readdirSync, mkdirSync, renameSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, it } from "vitest";
import { corpusPath } from "../tests/helpers/corpus.js";

import { parseDatabricks } from "../src/databricks/parse.js";
import { lower as lowerDatabricks } from "../src/databricks/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";

type Dialect = "databricks" | "tsql" | "snowflake" | "bigquery" | "redshift";

const PARSERS: Record<Dialect, { parse: (s: string) => { tree: any; errors: number }; lower: (t: any) => { statement?: string } }> = {
	databricks: { parse: parseDatabricks, lower: lowerDatabricks },
	tsql: { parse: parseTSql, lower: lowerTSql },
	snowflake: { parse: parseSnowflake, lower: lowerSnowflake },
	bigquery: { parse: parseBigQuery, lower: lowerBigQuery },
	redshift: { parse: parseRedshift, lower: lowerRedshift },
};

/** Parse-derived category; "unparsed" when the dialect's parser rejects it. */
function classify(dialect: Dialect, sql: string): string {
	const p = PARSERS[dialect];
	let r: { tree: any; errors: number };
	try {
		r = p.parse(sql);
	} catch {
		return "unparsed";
	}
	if (r.errors > 0) return "unparsed";
	try {
		return p.lower(r.tree).statement ?? "other";
	} catch {
		return "unparsed";
	}
}

interface Corpus {
	srcRel: string; // path of the corpus root inside the corpus repo
	dialect: Dialect;
	source: string;
	stage: "parser" | "analyzer";
	/** "positive" fixed, or "byDir" = first path segment (positive/negative) under srcRel. */
	validity: "positive" | "byDir";
}

const CORPORA: Corpus[] = [
	{ srcRel: "harness/local/databricks", dialect: "databricks", source: "oatly", stage: "parser", validity: "positive" },
	{ srcRel: "harness/local/databricks-docs", dialect: "databricks", source: "docs", stage: "parser", validity: "positive" },
	{ srcRel: "harness/local/snowflake-docs", dialect: "snowflake", source: "docs", stage: "parser", validity: "positive" },
	{ srcRel: "harness/local/tsql-docs", dialect: "tsql", source: "docs", stage: "parser", validity: "positive" },
	{ srcRel: "harness/local/redshift-docs", dialect: "redshift", source: "docs", stage: "parser", validity: "positive" },
	{ srcRel: "harness/local/bigquery-zetasql", dialect: "bigquery", source: "zetasql", stage: "analyzer", validity: "byDir" },
	{ srcRel: "harness/local/bigquery-zetasql-parser", dialect: "bigquery", source: "zetasql", stage: "parser", validity: "byDir" },
	{ srcRel: "vendor/grammars-v4/sql/tsql/examples", dialect: "tsql", source: "grammars-v4", stage: "parser", validity: "positive" },
	{ srcRel: "vendor/grammars-v4/sql/snowflake/examples", dialect: "snowflake", source: "grammars-v4", stage: "parser", validity: "positive" },
	{ srcRel: "vendor/bytebase-parser/redshift/examples", dialect: "redshift", source: "bytebase", stage: "parser", validity: "positive" },
];

function sqlFiles(root: string): string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((d) => d.isFile() && d.name.endsWith(".sql"))
		.map((d) => join((d as any).parentPath ?? (d as any).path, d.name));
}

/** Remove now-empty directories under root, bottom-up. Leaves root itself. */
function pruneEmpty(root: string): void {
	if (!existsSync(root)) return;
	for (const e of readdirSync(root, { withFileTypes: true })) {
		if (e.isDirectory()) {
			const sub = join(root, e.name);
			pruneEmpty(sub);
			if (readdirSync(sub).length === 0) rmSync(sub, { recursive: true, force: true });
		}
	}
}

describe.skipIf(!process.env.ORGANIZE)("organize-corpus (one-time migration)", () => {
	it(
		"reorganizes the corpus into <dialect>/<source>/<stage>/<validity>/<category>/…",
		{ timeout: 1_800_000 },
		() => {
			const only = process.env.ONLY;
			const counts = new Map<string, number>();
			let moved = 0;
			let skipped = 0;

			for (const c of CORPORA) {
				if (only && c.srcRel !== only) continue;
				const root = corpusPath(c.srcRel);
				if (!existsSync(root)) {
					console.log(`(absent) ${c.srcRel}`);
					continue;
				}
				for (const file of sqlFiles(root)) {
					const rel = relative(root, file).split(sep).join("/"); // e.g. positive/agg_4.sql or account-usage/1.sql
					let validity: string;
					let sub: string;
					if (c.validity === "byDir") {
						const i = rel.indexOf("/");
						validity = rel.slice(0, i); // positive | negative
						sub = rel.slice(i + 1);
					} else {
						validity = "positive";
						sub = rel;
					}
					const sql = readFile(file);
					const category = validity === "negative" && c.stage === "parser" ? "unparsed" : classify(c.dialect, sql);
					const targetRel = [c.dialect, c.source, c.stage, validity, category, sub].join("/");
					const target = corpusPath(targetRel);
					if (existsSync(target)) {
						skipped++;
						continue;
					}
					mkdirSync(dirname(target), { recursive: true });
					renameSync(file, target);
					moved++;
					const key = [c.dialect, c.source, c.stage, validity, category].join("/");
					counts.set(key, (counts.get(key) ?? 0) + 1);
				}
				pruneEmpty(root);
			}

			const lines = [`moved ${moved} files (${skipped} skipped — target existed)`, ""];
			for (const key of [...counts.keys()].sort()) lines.push(`  ${String(counts.get(key)).padStart(6)}  ${key}`);
			const summary = lines.join("\n");
			console.log("\n" + summary);
			writeFileSync(corpusPath("_organize-summary.txt"), summary + "\n");
		},
	);
});

import { readFileSync } from "node:fs";
function readFile(p: string): string {
	return readFileSync(p, "utf8");
}
