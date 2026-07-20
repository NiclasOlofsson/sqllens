import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { beforeAll, describe, expect, it } from "vitest";
import { lower } from "../../src/tsql/lower.js";
import { parseTSql } from "../../src/tsql/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { probeBody } from "../helpers/body-probe.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";
import { walkIr } from "../helpers/ir-walk.js";
import { KNOWN_BAD } from "../tsql-corpus-known-bad.js";

// grammars-v4 ships its own T-SQL example corpus. These are full T-SQL *scripts* (mostly DDL/admin,
// GO-separated batches), so they exercise the GRAMMAR via the full-file entry rule `tsql_file` — not
// our SELECT-scoped lower(). Two files fail the grammars-v4 grammar itself (constants.sql,
// keywords_reserved.sql) — upstream edge cases, not ours. This gate locks the current pass count so a
// toolchain/regen regression is caught, and separately checks that every example our SELECT parser
// accepts also lowers + scopes without throwing.
//
// vendor/ is a gitignored sparse clone, so this gate is a no-op (skipped) when the corpus is absent
// (CI / other machines) — same pattern as the Databricks corpus gate.

const EXAMPLES = corpusPath("tsql/grammars-v4");
const DOCS_CORPUS = corpusPath("tsql/docs");
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("tsql/docs/parser/negative/unparsed");
// 315/400 mutants rejected (2026-07-02); lowered to 312 (2026-07-20 doc-compliance wave): the CLR/
// spatial bare-property grammar widening (@g.Lat, geography::[Null], no parens required) legitimately
// makes 3 truncation mutants (a dangling `@g.B`, `@g.CurveToLineWithToleran`, `geography::STGeomFromTe`)
// valid syntax — real T-SQL can't distinguish a truncated-to-a-real-prefix property name from a
// deliberate one at parse time either. Mutation cannot guarantee invalidity (see the shared runner's
// own doc comment); this is the standing mutated-floor shortcut (CLAUDE.md § Known shortcuts).
const MUTATED_FLOOR = 312;

// The SQL examples scraped from the Microsoft T-SQL reference (MicrosoftDocs/sql-docs
// docs/t-sql via tools/extract-tsql-docs.mjs; gitignored, ~3,400 files). Bucketing is FROM THE PATH
// (parser/positive/<kind>/…), placed by the organizer with the current parser's per-statement kinds
// (first substantive statement decides) — the gate no longer parses everything to classify. The gate
// requires 100% of the in-scope query bucket; documented-broken examples fail to parse and sit under
// unparsed/ (KNOWN_BAD asserts they stay there). dml/ddl are reported, never gated (object/platform
// DDL is cleared Out of scope). The numeric baseline is a documented floor for the query population.
const QUERY_BASELINE = 1555;

// The cross-dialect `other` ratchet (D1, 2026-07-01 review): count `other` expression nodes over the
// in-scope, cleanly-parsed docs query bucket and ratchet the total (it may only fall; drive to 0 like
// Databricks). This rides the SAME single parse the docs ratchet makes (onCleanQuery gets its tree),
// so no file is parsed twice. The failure output names the leaking CST node types — that list IS the
// lower() worklist for T-SQL.
const OTHER_BASELINE = 0; // driven to 0 (2026-07-02): XML data type methods, REGEXP_LIKE / quantified /
// MATCH / CONTAINS predicates all modelled — T-SQL is expression-corpus-complete like Databricks. May only fall.

// The SLL→LL fallback ratchet (SLL-surgery wave, task-1-brief.md): T-SQL is grammar-sick — its
// heaviest decisions (function_call, select_statement, the batch/sql_clauses statement boundary,
// full_table_name) force the two-stage parse to bail out of the fast SLL prediction path and reparse
// under full LL. Measured 2026-07-03 via `node --import tsx tools/profile-sll.ts tsql` over this same
// docs query bucket. Counted on the SAME single parse the docs ratchet makes (the `parse:` closure
// below), never a re-parse. May only fall as the surgery wave's per-dialect tasks land.
const FALLBACK_RATCHET = 1;

/** Production parse (tsql_file, two-stage SLL→LL); returns the syntax-error count. */
function parseErrors(sql: string): number {
	return parseTSql(sql).errors;
}

describe.skipIf(!existsSync(EXAMPLES))("T-SQL grammar vs the grammars-v4 example corpus", () => {
	// Read the directory in beforeAll, not at collection time — vitest runs the describe body even
	// when skipIf is true, so a top-level readdirSync throws ENOENT when the corpus is absent.
	// Recursive: post-reorg the examples live under <stage>/<validity>/<category>/ subdirs. `files`
	// holds paths relative to EXAMPLES (forward slashes), so join(EXAMPLES, rel) reads them.
	let files: string[];
	beforeAll(() => {
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
				const p = join(dir, e.name);
				if (e.isDirectory()) return walk(p);
				return e.name.endsWith(".sql") ? [relative(EXAMPLES, p).split("\\").join("/")] : [];
			});
		files = walk(EXAMPLES);
	});

	it("parses the full T-SQL example scripts via tsql_file (>= baseline)", () => {
		let ok = 0;
		const fails: string[] = [];
		for (const rel of files) {
			let errs = 1;
			try {
				errs = parseErrors(readFileSync(join(EXAMPLES, rel), "utf8"));
			} catch {
				errs = -1;
			}
			if (errs === 0) ok++;
			else fails.push(rel);
		}
		// 135/137 today; the two failures (constants.sql, keywords_reserved.sql) are upstream
		// grammars-v4 grammar gaps. Assert no regression below the current pass count.
		expect(ok).toBeGreaterThanOrEqual(135);
		// fails carry the reorg path prefix (…/<category>/constants.sql) — compare by basename.
		expect(fails.map((f) => f.split("/").pop()).sort()).toEqual(["constants.sql", "keywords_reserved.sql"]);
	}, 300000);

	it("lowers + scopes every example the parser accepts, without throwing", () => {
		let accepted = 0;
		let modelled = 0;
		const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
		for (const rel of files) {
			const sql = readFileSync(join(EXAMPLES, rel), "utf8");
			const r = parseTSql(sql);
			if (r.errors === 0) {
				accepted++;
				// Query examples lower to a modelled body; DML/DDL/admin lower to a flagged-empty body
				// carrying their category. Either way the semantic layer must run without throwing.
				const q = lower(r.tree);
				if (q.statement === "query" && q.body.kind === "select" && !q.body.unsupported?.length) modelled++;
				probeBody(q, rel, bodyEmpty);
				expect(() => resolveScopes(q, "tsql"), rel).not.toThrow();
			}
		}
		expect(accepted).toBeGreaterThan(0);
		// At least some examples must take the real modelling path — guards against a
		// statement-classification regression silently routing everything to emptyQuery.
		expect(modelled).toBeGreaterThan(0);
		expect(
			bodyEmpty,
			`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
		).toEqual([]);
	}, 300000);
});

describe.skipIf(!existsSync(DOCS_CORPUS))("T-SQL grammar vs the scraped MS docs corpus", () => {
	it(
		"parses 100% of in-scope query examples (path-bucketed; KNOWN_BAD under unparsed/); `other` ratchet",
		{ timeout: 600000 },
		() => {
			// One pass: the docs ratchet parses each file once, then hands the clean query-bucket tree to
			// onCleanQuery, which lowers → walks (other-count) → resolves → derives symbols. The pipeline
			// must never throw and the `other` count must stay at/under baseline.
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL
			const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
			let scoped = 0;
			let fallbacks = 0;
			runDocsRatchet(DOCS_CORPUS, parseErrors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseTSql(sql);
					if (r.sllFallback) fallbacks++;
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						probeBody(ir, rel, bodyEmpty);
						const scopes = resolveScopes(ir, "tsql");
						deriveSymbols(scopes);
						sweepCallDiagnostics(scopes, rel, callHits);
						scoped++;
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 140)}`);
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
				`\n  tsql: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE}), ${fallbacks} SLL fallbacks (ratchet ${FALLBACK_RATCHET})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `pipeline threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(
				callHits,
				`call-signature checker fired on valid SQL (fix the signature table / checker, never exclude):\n${callHits.slice(0, 20).join("\n")}`,
			).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
			expect(
				fallbacks,
				`SLL fallback count rose above the ${FALLBACK_RATCHET} ratchet — a grammar edit made prediction sicker`,
			).toBeLessThanOrEqual(FALLBACK_RATCHET);
			expect(
				bodyEmpty,
				`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
			).toEqual([]);
		},
	);
});

describe.skipIf(!existsSync(NEGATIVES))("T-SQL negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("tsql", NEGATIVES, (sql) => parseTSql(sql).errors, MUTATED_FLOOR);
	});
});
