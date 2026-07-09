import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/bigquery/lower.js";
import { parseBigQuery } from "../../src/bigquery/parse.js";
import { qualify } from "../../src/qualify/qualify.js";
import { Schema } from "../../src/qualify/schema.js";
import { resolveScopes } from "../../src/scope/scope.js";

// The FIRST external check on the semantic layer: drive our resolver with a schema HARVESTED from
// ZetaSQL's own analyzer goldens (tools/harvest-googlesql-schema.mjs → harness/local/googlesql-schema.json,
// derived from the resolved-AST TableScan/ColumnRef nodes) and confirm it agrees with the catalog.
// This is a smoke gate, not the full comparator: it checks resolution (unknown-table/column), not
// types/lineage, and the broad pass is a ratchet (harvest covers only referenced columns, so a query
// using a real-but-unharvested column legitimately shows "unknown" — the floor tracks coverage, not 100%).
const SCHEMA_JSON = corpusPath("harness/local/googlesql-schema.json");
const POS = corpusPath("bigquery/zetasql/analyzer/positive");
// post-reorg the positives live under <category>/ subdirs, so walk recursively for full paths.
function* sqlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}
const BROAD_SAMPLE = 3000; // bound the corpus pass for speed

// Floor for the broad ratchet — measured 2026-06-14. Raise as harvest coverage / the resolver improve.
const FULLY_RESOLVED_BASELINE = 2700; // 2700/3000 (90%) resolve with zero unknown diagnostics

describe.skipIf(!existsSync(SCHEMA_JSON))("BigQuery resolver vs harvested GoogleSQL catalog", () => {
	const schema = new Schema(JSON.parse(readFileSync(SCHEMA_JSON, "utf8")));
	const diagsFor = (sql: string): string[] => {
		const { tree, errors } = parseBigQuery(sql);
		if (errors !== 0) return ["<parse-error>"];
		return qualify(resolveScopes(lower(tree), "bigquery"), schema).diagnostics.map((d) => d.kind);
	};

	it("resolves real-table/column queries clean and flags genuinely-unknown columns", () => {
		// Real columns of well-covered catalog tables → must resolve with no diagnostics.
		for (const sql of [
			"select int64, string, bool from SimpleTypes",
			"select Key, Value from KeyValue",
			"select bool from SimpleTypes where int64 > 0",
			"select key, nested_int64 from TestTable",
		]) {
			expect(diagsFor(sql), sql).toEqual([]);
		}
		// Planted unknown columns of real tables → must be flagged.
		for (const sql of ["select not_a_real_col from SimpleTypes", "select Key, bogus from KeyValue"]) {
			expect(diagsFor(sql), sql).toContain("unknown-column");
		}
	});

	it.skipIf(!existsSync(POS))(
		"agrees with the catalog across the corpus (ratchet; no throws)",
		{ timeout: 600000 },
		() => {
			const files = [...sqlFiles(POS)].slice(0, BROAD_SAMPLE);
			let fullyResolved = 0;
			const threw: string[] = [];
			for (const f of files) {
				const sql = readFileSync(f, "utf8");
				try {
					const d = diagsFor(sql);
					// "fully resolved against the catalog" = parsed + zero unknown-table/column/field diagnostics.
					if (d.length === 0) fullyResolved++;
				} catch (e) {
					threw.push(`${f}: ${(e as Error).message}`);
				}
			}
			// eslint-disable-next-line no-console
			console.log(`fully resolved against harvested catalog: ${fullyResolved}/${files.length}`);
			expect(threw, `qualify threw on:\n${threw.slice(0, 10).join("\n")}`).toEqual([]);
			expect(fullyResolved).toBeGreaterThanOrEqual(FULLY_RESOLVED_BASELINE);
		},
	);
});
