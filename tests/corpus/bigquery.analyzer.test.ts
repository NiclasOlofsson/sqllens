import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import type { PipeStage, QueryExpr } from "../../src/ir/ir.js";
import { lower } from "../../src/bigquery/lower.js";
import { parseBigQuery } from "../../src/bigquery/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { isDetectOnly, sqlFiles } from "../helpers/googlesql-scope.js";
import { walkIr } from "../helpers/ir-walk.js";
import { allPipeStages, stageSubIr } from "../helpers/pipe-walk.js";

// The ZetaSQL .test corpus (gitignored; rebuild with tools/extract-googlesql-tests.mjs).
// Two-sided gate — the project's first: positives must parse (ratchet floor), negatives whose
// expected output is "ERROR: Syntax error" must be rejected (ratchet floor). The positive corpus
// also carries semantically-invalid-but-syntactically-valid cases and a few ZetaSQL-only surfaces
// (pipe `|>`, test-only constructs), so the positive rate is a partial floor that ratchets up as
// grammar gaps close — not 100%.
//
// One pass over the positives: each is parsed ONCE; the in-scope clean ones then feed the whole
// pipeline (lower → walkIr `other`-count → resolveScopes → deriveSymbols) AND the pipe-stage
// drift-guard (no pipe operator falls through to the `other` stage). The negatives are a separate
// parse-only pass — rejection can't be subsumed into the positive pipeline.
const CORPUS = corpusPath("bigquery/zetasql/analyzer");
const positives = () => [...sqlFiles(join(CORPUS, "positive"))];
const negatives = () => [...sqlFiles(join(CORPUS, "negative"))];

// Baselines: regression floors over the IN-SCOPE bucket (object DDL / DEFINE MACRO / empty-script are
// detect-only, excluded by isDetectOnly — symmetric with the parser-corpus gate). Corpus is mode-aware
// (type-mode dropped, expression-mode wrapped as SELECT). The extractor classifies out cases that are
// not parse-negatives for us: feature-off / divergence (featureOffExpected — PIPES from-queries, bare
// QUALIFY, dashed names, …), post-parse structural errors ZetaSQL labels "Syntax error" but its bare
// PARSER accepts (isParserAcceptedPostParse — mixed set operations, hint-on-non-first set op), the
// single-statement-mode boundary, and expression-mode query-wrap artifacts — all shared with the parser
// extractor so the two corpora grade identically.
const POSITIVE_BASELINE = 14695; // in-scope positives parsed (14695/14714); the 19 remaining are real
// grammar gaps (pipe AGGREGATE WITH DIFFERENTIAL_PRIVACY, multi-level aggregation `agg(x GROUP BY …)`,
// TVF TABLE/scalar args, WITH POSITION on param-table sources, chained braced call) plus a few mis-
// bucketed ZetaSQL errors — see docs Open Gaps.
const NEGATIVE_BASELINE = 166; // 166/166 in-scope syntax-error negatives rejected — zero accepted
// The cross-dialect `other` ratchet (D1, 2026-07-01 review): count `other` expression nodes over the
// in-scope, cleanly-parsed positives and ratchet the total (it may only fall). The failure output
// names the leaking CST node types — that list IS the lower() worklist for BigQuery.
const OTHER_BASELINE = 234; // measured 2026-07-01 over the parsed in-scope positives; may only fall

// Collect every pipe stage the IR nests (main body, CTE bodies, subquery bodies, set-op operands, and
// sub-pipelines) — ported verbatim from bigquery.pipe.test.ts's corpus gate.
function collectPipeStages(q: QueryExpr, out: PipeStage[]): void {
	const visitBody = (body: QueryExpr["body"]): void => {
		if (body.kind === "pipe") {
			visitBody(body.input);
			for (const stage of allPipeStages(body)) {
				out.push(stage);
				for (const sub of stageSubIr(stage)) collectPipeStages(sub, out);
			}
		} else if (body.kind === "setop") {
			visitBody(body.left);
			visitBody(body.right);
		} else {
			for (const s of body.from) if (s.kind === "subquery") collectPipeStages(s.query, out);
			for (const sub of body.subqueries ?? []) collectPipeStages(sub, out);
		}
	};
	for (const cte of q.ctes) collectPipeStages(cte.body, out);
	visitBody(q.body);
}

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL .test corpus", () => {
	it(
		"positives: parse ratchet + pipeline (lower/walkIr/scope/symbols) + pipe-stage drift-guard — one pass",
		{ timeout: 600000 },
		() => {
			let pass = 0;
			let ddlExcluded = 0;
			const fails: string[] = [];
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throws: string[] = [];
			const stages: PipeStage[] = [];

			for (const f of positives()) {
				const sql = readFileSync(f, "utf8");
				if (isDetectOnly(sql)) {
					ddlExcluded++;
					continue;
				}
				let res;
				try {
					res = parseBigQuery(sql);
				} catch {
					fails.push(f);
					continue;
				}
				if (res.errors !== 0) {
					fails.push(f);
					continue;
				}
				pass++;
				// Clean, in-scope positive → lower ONCE and run every downstream concern off that one IR.
				try {
					const ir = lower(res.tree);
					walkIr(ir, tally, samples); // `other` expr-count (baseline 234)
					collectPipeStages(ir, stages); // pipe-stage drift guard (0 `other` op)
					deriveSymbols(resolveScopes(ir, "bigquery")); // scope+symbols must not throw
				} catch (e) {
					throws.push(`${f}: ${(e as Error).message}`);
				}
			}

			const other = stages.filter((s) => s.op === "other");
			const otherExprs = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			// eslint-disable-next-line no-console
			console.log(
				`BigQuery positives: ${pass}/${pass + fails.length} (${ddlExcluded} DDL/macro detect-only, excluded); ` +
					`${otherExprs} \`other\` exprs (baseline ${OTHER_BASELINE}); ` +
					`pipe stages ${stages.length} (${other.length} unmodelled "other")${top ? "\n" + top : ""}`,
			);

			expect(pass).toBeGreaterThanOrEqual(POSITIVE_BASELINE);
			expect(throws, `lower/resolveScopes/deriveSymbols threw on:\n${throws.slice(0, 20).join("\n")}`).toEqual(
				[],
			);
			expect(
				otherExprs,
				`\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`,
			).toBeLessThanOrEqual(OTHER_BASELINE);
			// Pipe drift guard: the corpus DOES exercise pipe syntax, and all 31 operators are modelled —
			// the `other` stage never fires (ported from bigquery.pipe.test.ts's corpus gate).
			expect(stages.length).toBeGreaterThan(0);
			expect(other).toEqual([]);
		},
	);

	it("rejects the syntax-error negative cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let rejected = 0;
		let accepted = 0;
		let ddlExcluded = 0;
		for (const f of negatives()) {
			const sql = readFileSync(f, "utf8");
			if (isDetectOnly(sql)) {
				ddlExcluded++;
				continue;
			}
			let errs = 0;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = 1;
			}
			if (errs > 0) rejected++;
			else accepted++;
		}
		// eslint-disable-next-line no-console
		console.log(
			`BigQuery negatives rejected: ${rejected}/${rejected + accepted} (${ddlExcluded} DDL/macro detect-only, excluded)`,
		);
		expect(rejected).toBeGreaterThanOrEqual(NEGATIVE_BASELINE);
	});
});
