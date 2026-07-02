import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { beforeAll, describe, expect, it } from "vitest";
import { lower } from "../../src/postgres/lower.js";
import { parsePostgres } from "../../src/postgres/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { walkIr } from "../helpers/ir-walk.js";

// Two PostgreSQL conformance corpora, both in the corpus repo and skipped when absent:
//
// 1. postgres/bytebase — the upstream grammar's own example corpus (217 files, largely PG
//    regression-suite-derived). Our fork must keep parsing all of it: a regression here means a
//    port edit broke something the upstream grammar already handled.
//
// 2. postgres/docs — every SQL example scraped from the PostgreSQL 18 manual
//    (tools/scrape-postgres-docs.mjs, ~1,226 files; PostgreSQL License). Organizer-bucketed
//    (parser/positive/<kind>/…); the gate trusts the paths and requires 100% of the query bucket.

const VENDOR_EXAMPLES = corpusPath("postgres/bytebase");
const DOCS_CORPUS = corpusPath("postgres/docs");

const VENDOR_BASELINE = 217; // upstream's own example corpus: the fork parses all of it
const QUERY_BASELINE = 330; // documented floor; the gate itself is 100%-of-query-bucket
// The cross-dialect `other` ratchet: Postgres is expression-corpus-complete — 0 `other`
// (measured 2026-07-02 over the parsed docs query bucket).
const OTHER_BASELINE = 0;

// Documented-broken query examples — each verified against its postgresql.org/docs/18 source page
// as deliberately-invalid or template SQL (not a grammar gap, not scraper noise). By construction
// they fail to parse, so the organizer files them under unparsed/; the gate asserts they STAY there.
const KNOWN_BAD: Record<string, string> = {
	"citext/1.sql":
		"citext page shows a client-side query TEMPLATE — `lower(col) = LOWER(?)` with a bare `?` bind placeholder; not executable SQL.",
	"sql-createaggregate/2.sql":
		"CREATE AGGREGATE page: `ORDER BY col USING sortop` — `sortop` is a metasyntax stand-in for an operator name (a real statement needs an operator like `~<~`).",
	"sql-syntax-lexical/8.sql":
		"§4.1.2.1 shows `SELECT 'foo' 'bar';` as an explicitly INVALID example (adjacent string constants need a newline between them to concatenate).",
};

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("Postgres grammar vs the bytebase example corpus", () => {
	let files: string[];
	beforeAll(() => {
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
				const p = join(dir, e.name);
				if (e.isDirectory()) return walk(p);
				return e.name.endsWith(".sql") ? [relative(VENDOR_EXAMPLES, p).split("\\").join("/")] : [];
			});
		files = walk(VENDOR_EXAMPLES);
	});

	it("parses the upstream examples (ratchet)", { timeout: 300_000 }, () => {
		const fails: string[] = [];
		for (const rel of files) {
			try {
				if (parsePostgres(readFileSync(join(VENDOR_EXAMPLES, rel), "utf8")).errors > 0) fails.push(rel);
			} catch (e) {
				fails.push(`${rel} THREW ${String(e).slice(0, 80)}`);
			}
		}
		expect(files.length).toBeGreaterThan(0);
		const pass = files.length - fails.length;
		console.log(`\n  bytebase postgresql examples: ${pass}/${files.length} parse`);
		if (fails.length) console.log(`  fails:\n    ${fails.join("\n    ")}`);
		expect(pass, `bytebase example pass count dropped below ${VENDOR_BASELINE}`).toBeGreaterThanOrEqual(
			VENDOR_BASELINE,
		);
	});
});

describe.skipIf(!existsSync(DOCS_CORPUS))("Postgres grammar vs the scraped PostgreSQL-manual corpus", () => {
	it(
		"parses 100% of the query bucket (organizer paths; KNOWN_BAD stay unparsed); lower+scope total; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let scoped = 0;
			runDocsRatchet(DOCS_CORPUS, (sql) => parsePostgres(sql).errors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parsePostgres(sql);
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						deriveSymbols(resolveScopes(ir, "postgres"));
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
				`\n  postgres: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `lower/resolveScopes threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
		},
	);
});
