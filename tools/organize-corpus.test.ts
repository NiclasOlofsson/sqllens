// MAINTAINED corpus reclassifier (not a one-shot). Runs HERE (where the parsers live) and moves
// files in the corpus repo (resolved via corpusPath / SQL_CORPUS_DIR). The corpus is laid out as:
//
//   <dialect>/<source>/<stage>/<validity>/<category>/<slug…>/<file>.sql
//
// dialect   databricks | tsql | snowflake | bigquery | redshift
// source    where it came from, a plain label (oatly, docs, zetasql, grammars-v4, bytebase)
// stage     parser (syntax) | analyzer (resolution/types)
// validity  positive (must parse) | negative (must be rejected)
// category  query | dml | ddl | unparsed  (bucketOfKinds over the CURRENT parse; unparsed = didn't parse)
//
// The <category> segment is the SAME bucket the docs-corpus gates read off the path
// (tests/helpers/statement-bucket.ts `bucketOfKinds`), so the gates can trust the layout instead of
// re-classifying at test time. Re-run this whenever the parsers change (a file the grammar learned
// to parse leaves unparsed/; a statement whose bucket changed moves) — it re-buckets in place using
// the current parsers, moving only what changed. The corpus repo is git-backed, so moves are
// recoverable.
//
// Guarded behind ORGANIZE=1 so `npm test` never triggers it. Run explicitly (ONLY = a <dialect>/<source>
// root, exactly as it sits in the corpus repo):
//   ORGANIZE=1 npx vitest run tools/organize-corpus.test.ts
//   ORGANIZE=1 ONLY="databricks/docs" npx vitest run tools/organize-corpus.test.ts

import { readdirSync, mkdirSync, renameSync, existsSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it } from "vitest";
import { corpusPath } from "../tests/helpers/corpus.js";
import { bucketOfKinds } from "../tests/helpers/statement-bucket.js";
import type { StatementCategory } from "../src/ir/statement.js";

import { parseDatabricks } from "../src/databricks/parse.js";
import { statementCategories as databricksCategories } from "../src/databricks/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { statementCategories as tsqlCategories } from "../src/tsql/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { statementCategories as snowflakeCategories } from "../src/snowflake/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { statementCategories as bigQueryCategories } from "../src/bigquery/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { statementCategories as redshiftCategories } from "../src/redshift/lower.js";
import { parsePostgres } from "../src/postgres/parse.js";
import { statementCategories as postgresCategories } from "../src/postgres/lower.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { statementCategories as duckdbCategories } from "../src/duckdb/lower.js";
import { parseTrino } from "../src/trino/parse.js";
import { statementCategories as trinoCategories } from "../src/trino/lower.js";
import { parseSqlite } from "../src/sqlite/parse.js";
import { statementCategories as sqliteCategories } from "../src/sqlite/lower.js";
import { parseMysql } from "../src/mysql/parse.js";
import { statementCategories as mysqlCategories } from "../src/mysql/lower.js";

type Dialect =
	| "databricks"
	| "tsql"
	| "snowflake"
	| "bigquery"
	| "redshift"
	| "postgres"
	| "duckdb"
	| "trino"
	| "sqlite"
	| "mysql";

const PARSERS: Record<
	Dialect,
	{ parse: (s: string) => { tree: any; errors: number }; categories: (t: any) => StatementCategory[] }
> = {
	databricks: { parse: parseDatabricks, categories: databricksCategories },
	tsql: { parse: parseTSql, categories: tsqlCategories },
	snowflake: { parse: parseSnowflake, categories: snowflakeCategories },
	bigquery: { parse: parseBigQuery, categories: bigQueryCategories },
	redshift: { parse: parseRedshift, categories: redshiftCategories },
	postgres: { parse: parsePostgres, categories: postgresCategories },
	duckdb: { parse: parseDuckdb, categories: duckdbCategories },
	trino: { parse: parseTrino, categories: trinoCategories },
	sqlite: { parse: parseSqlite, categories: sqliteCategories },
	mysql: { parse: parseMysql, categories: mysqlCategories },
};

/** The gate's bucket over the current parse: query | dml | ddl, or "unparsed" when the parser
 *  rejects it (syntax errors or a throw). This is exactly the rule the docs gates apply to the path. */
function reclassify(dialect: Dialect, sql: string): string {
	const p = PARSERS[dialect];
	let r: { tree: any; errors: number };
	try {
		r = p.parse(sql);
	} catch {
		return "unparsed";
	}
	if (r.errors > 0) return "unparsed";
	try {
		return bucketOfKinds(p.categories(r.tree));
	} catch {
		return "unparsed";
	}
}

interface Corpus {
	/** The corpus root as it sits in the corpus repo, `<dialect>/<source>`. */
	rootRel: string;
	dialect: Dialect;
}

// Every organized corpus root. The reclassifier re-buckets each in place under the current parsers.
const CORPORA: Corpus[] = [
	{ rootRel: "databricks/oatly", dialect: "databricks" },
	{ rootRel: "databricks/docs", dialect: "databricks" },
	{ rootRel: "snowflake/docs", dialect: "snowflake" },
	{ rootRel: "snowflake/grammars-v4", dialect: "snowflake" },
	{ rootRel: "tsql/docs", dialect: "tsql" },
	{ rootRel: "tsql/grammars-v4", dialect: "tsql" },
	{ rootRel: "redshift/docs", dialect: "redshift" },
	{ rootRel: "redshift/bytebase", dialect: "redshift" },
	{ rootRel: "bigquery/zetasql", dialect: "bigquery" },
	{ rootRel: "postgres/docs", dialect: "postgres" },
	{ rootRel: "postgres/bytebase", dialect: "postgres" },
	{ rootRel: "duckdb/docs", dialect: "duckdb" },
	{ rootRel: "trino/docs", dialect: "trino" },
	{ rootRel: "trino/bytebase", dialect: "trino" },
	{ rootRel: "sqlite/grammars-v4", dialect: "sqlite" },
	{ rootRel: "sqlite/docs", dialect: "sqlite" },
	{ rootRel: "mysql/grammars-v4", dialect: "mysql" },
	{ rootRel: "mysql/docs", dialect: "mysql" },
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

describe.skipIf(!process.env.ORGANIZE)("organize-corpus (maintained reclassifier)", () => {
	it(
		"re-buckets <dialect>/<source>/<stage>/<validity>/<category>/… under the current parsers",
		{ timeout: 1_800_000 },
		() => {
			const only = process.env.ONLY;
			const counts = new Map<string, number>();
			let moved = 0;
			let inPlace = 0;

			for (const c of CORPORA) {
				if (only && c.rootRel !== only) continue;
				const root = corpusPath(c.rootRel);
				if (!existsSync(root)) {
					console.log(`(absent) ${c.rootRel}`);
					continue;
				}
				for (const file of sqlFiles(root)) {
					// rel = <stage>/<validity>/<oldCategory>/<slug…> — split off the fixed prefix, keep the slug.
					const rel = relative(root, file).split(sep).join("/");
					const parts = rel.split("/");
					if (parts.length < 4) {
						console.log(`(skip, unexpected layout) ${c.rootRel}/${rel}`);
						continue;
					}
					const [stage, validity, , ...slugParts] = parts;
					const slug = slugParts.join("/");
					const sql = readFileSync(file, "utf8");
					// Parser negatives must be rejected — they stay in unparsed/, never re-bucketed.
					const category =
						validity === "negative" && stage === "parser" ? "unparsed" : reclassify(c.dialect, sql);
					const targetRel = [c.rootRel, stage, validity, category, slug].join("/");
					const target = corpusPath(targetRel);
					if (resolve(target) === resolve(file)) {
						inPlace++;
						continue; // already in the right bucket
					}
					if (existsSync(target)) {
						console.log(`(skip, target exists) ${targetRel}`);
						continue;
					}
					mkdirSync(dirname(target), { recursive: true });
					renameSync(file, target);
					moved++;
					const key = [c.rootRel, stage, validity, category].join("/");
					counts.set(key, (counts.get(key) ?? 0) + 1);
				}
				pruneEmpty(root);
			}

			const lines = [`moved ${moved} files (${inPlace} already in place)`, ""];
			for (const key of [...counts.keys()].sort()) lines.push(`  ${String(counts.get(key)).padStart(6)}  ${key}`);
			const summary = lines.join("\n");
			console.log("\n" + summary);
			writeFileSync(corpusPath("_organize-summary.txt"), summary + "\n");
		},
	);
});
