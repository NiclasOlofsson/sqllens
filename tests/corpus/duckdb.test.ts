import { existsSync } from "node:fs";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/duckdb/lower.js";
import { parseDuckdb } from "../../src/duckdb/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { walkIr } from "../helpers/ir-walk.js";

// DuckDB conformance corpus (skipped when absent): duckdb/docs — every ```sql example from the
// duckdb-web docs/current tree (tools/extract-duckdb-docs.mjs, ~2,026 files; duckdb-web is MIT).
// Organizer-bucketed (parser/positive/<kind>/…); the gate trusts the paths and requires 100% of
// the query bucket. DuckDB's PIVOT/UNPIVOT statements classify as query (row-returning reads).

const DOCS_CORPUS = corpusPath("duckdb/docs");
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("duckdb/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 333; // 333/400 mutants rejected (2026-07-02)

const QUERY_BASELINE = 900; // documented floor; the gate itself is 100%-of-query-bucket
// The cross-dialect `other` ratchet: DuckDB is expression-corpus-complete — 0 `other`
// (measured 2026-07-02 over the parsed docs query bucket).
const OTHER_BASELINE = 0;

// Documented-broken query examples — each verified against its duckdb.org source page as
// deliberately-invalid SQL. They fail to parse, so the organizer files them under unparsed/;
// the gate asserts they STAY there.
const KNOWN_BAD: Record<string, string> = {
	"core_extensions_httpfs_s3api_legacy_authentication/5.sql":
		"S3 legacy-auth page elides the join condition — `INNER JOIN 's3://…' t2;` with no ON/USING; DuckDB rejects a conditionless INNER JOIN.",
	"sql_functions_overview/6.sql":
		"functions/overview.md shows `FROM ('file').read_parquet()` explicitly annotated `-- does not work` (chaining does not apply to table functions).",
};

describe.skipIf(!existsSync(DOCS_CORPUS))("DuckDB grammar vs the duckdb-web docs corpus", () => {
	it(
		"parses 100% of the query bucket (organizer paths; KNOWN_BAD stay unparsed); lower+scope total; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let scoped = 0;
			runDocsRatchet(DOCS_CORPUS, (sql) => parseDuckdb(sql).errors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseDuckdb(sql);
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						deriveSymbols(resolveScopes(ir, "duckdb"));
						scoped++;
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 120)}`);
					}
				},
			});
			const total = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			console.log(
				`\n  duckdb: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `lower/resolveScopes threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
		},
	);
});

describe.skipIf(!existsSync(NEGATIVES))("DuckDB negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("duckdb", NEGATIVES, (sql) => parseDuckdb(sql).errors, MUTATED_FLOOR);
	});
});
