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
import { sweepCallDiagnostics } from "../helpers/call-check.js";
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
const POSITIVE_BASELINE = 14707; // in-scope positives parsed: 14707/14708. The former 19-file gap is now
// 18 closed + 1 enumerated: 9 real grammar gaps fixed (pipe AGGREGATE `WITH <dp>` modifier, the full
// grouping-item set inside an aggregate call `agg(x GROUP BY ()|ROLLUP|CUBE|GROUPING SETS)`, `TABLE t
// WHERE …` TVF relation arg, `RUN <path>(…)`); 3 extractor bugs fixed (a `[ language_features…]`
// bracket-space directive and indented `[int64]`/`[string]` array-arg lines both mis-cleaned, and a
// `\#`-escaped comment line) that had corrupted otherwise-valid positives; and 6 mis-bucketed genuine
// parse-negatives reclassified OUT to the negative bucket (a "Syntax error" behind a `Table resolution
// time:` preamble / after an earlier statement, and the parser-structural "is an expression, not a query"
// / "Query parameters cannot be used in place of table names" rejections). The 1 remaining Open Gap is
// chained_function_call_special_cases_18 — a chained-call + braced UPDATE constructor `(p).f() {k: v}`;
// adding the braced tail to the left-recursive chained-call alt regressed ATN prediction on deeply-nested
// scalar subqueries, so it needs the chained call to flow through function_call_expression_with_clauses.
const NEGATIVE_BASELINE = 172; // 172/172 in-scope syntax-error negatives rejected — zero accepted (was
// 166; +6 from the reclassified parse-negatives above, symmetric with the parser corpus)
// The cross-dialect `other` ratchet (D1, 2026-07-01 review): count `other` expression nodes over the
// in-scope, cleanly-parsed positives and ratchet the total (it may only fall). The failure output
// names the leaking CST node types — that list IS the lower() worklist for BigQuery.
const OTHER_BASELINE = 0; // Task 7 (B/C/D closing wave): every leaker modelled — constructor forms
// (braced `{f: v}` / `STRUCT{…}` / `NEW T{…}` / `NEW T(…)` → named_struct/new calls keeping field values),
// the expression-scoped `WITH(name AS expr, …, result)` (→ the `with` IR node, bindings retained), the
// `REPLACE_FIELDS(…)` call, and a parenthesized JOIN-ON `and` that had been falling to `other` through a
// lowering shape bug (a bare `and_expression`/OR under expression_maybe_parenthesized_not_a_query). Down
// from 234; BigQuery is now expression-corpus-complete like Databricks/Redshift/Postgres/DuckDB.

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
			const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL

			for (const f of positives()) {
				const sql = readFileSync(f, "utf8");
				const detectOnly = isDetectOnly(sql);
				if (detectOnly) ddlExcluded++;

				let res;
				try {
					res = parseBigQuery(sql);
				} catch {
					if (!detectOnly) fails.push(f);
					continue;
				}
				if (res.errors !== 0) {
					if (!detectOnly) fails.push(f);
					continue;
				}
				if (!detectOnly) pass++;
				// Clean parse (in-scope or detect-only) → lower ONCE and run the full-domain sweep. detect-only
				// (object DDL/macro) stays out of the ratchet counters and the `other` tally, but its clean parse
				// still feeds the totality sweep and the pipe drift-guard — the domain the deleted pre-
				// consolidation suites (bigquery.corpus/bigquery.pipe) swept.
				try {
					const ir = lower(res.tree);
					if (!detectOnly) walkIr(ir, tally, samples); // `other` expr-count (baseline 234), in-scope only
					collectPipeStages(ir, stages); // pipe-stage drift guard (0 `other` op) — full domain
					const scopes = resolveScopes(ir, "bigquery");
					deriveSymbols(scopes); // scope+symbols must not throw — full domain
					// Task 12 honesty gate — over the IN-SCOPE analyzer positives only (detect-only DDL/macro
					// and the parser-corpus keyword-torture files are not valid-semantics SQL, so excluded).
					if (!detectOnly) sweepCallDiagnostics(scopes, f, callHits);
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
			// The failing in-scope positives — the triage worklist. Kept permanently so a regression names
			// its files, not just a count.
			if (fails.length) {
				// eslint-disable-next-line no-console
				console.log(`BigQuery positive FAILS (${fails.length}):\n${fails.map((f) => `  ${f}`).join("\n")}`);
			}

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
			// The analyzer corpus's "positive" bucket guarantees the absence of a SYNTAX error only
			// (tools/extract-googlesql-tests.mjs: "only 'ERROR: Syntax error' is a parse error;
			// semantic errors parse fine"), so ZetaSQL's own wrong-arity ERROR cases legitimately live
			// here, and the call checker flagging them is CORRECT behavior, pinned exactly below. A
			// hit outside this set is either a corpus rebuild surfacing another semantic-error case
			// (verify against the .test file, then re-pin) or a real false positive to fix in the
			// signature tables / checker, never to exclude.
			const KNOWN_SEMANTIC_INVALID = [
				"query/array_path_26.sql: [wrong-arity] FLATTEN expects 1 argument, got 0",
				"query/array_path_63.sql: [wrong-arity] FLATTEN expects 1 argument, got 2",
				"query/collation_24.sql: [wrong-arity] COLLATE expects 2 arguments, got 1",
				"query/geography_11.sql: [wrong-arity] ST_DISTANCE expects 2–3 arguments, got 1",
				"query/geography_15.sql: [wrong-arity] ST_ASGEOJSON expects 1 argument, got 2",
				"query/geography_24.sql: [wrong-arity] ST_GEOGPOINT expects 2 arguments, got 3",
				"query/lambda_5.sql: [wrong-arity] LENGTH expects 1 argument, got 2",
				"query/lambda_6.sql: [wrong-arity] LENGTH expects 1 argument, got 2",
				"query/lambda_8.sql: [wrong-arity] LENGTH expects 1 argument, got 2",
				"query/normalize_13.sql: [wrong-arity] NORMALIZE expects 1–2 arguments, got 0",
				"query/normalize_14.sql: [wrong-arity] NORMALIZE_AND_CASEFOLD expects 1–2 arguments, got 0",
				"query/normalize_18.sql: [wrong-arity] NORMALIZE expects 1–2 arguments, got 3",
				"query/normalize_21.sql: [wrong-arity] NORMALIZE_AND_CASEFOLD expects 1–2 arguments, got 3",
			];
			const normalizedHits = callHits
				.map((h) => h.split(/[\\/]analyzer[\\/]positive[\\/]/)[1]?.replace(/\\/g, "/") ?? h)
				.sort();
			expect(
				normalizedHits,
				`call-signature hits diverge from the pinned semantic-error set (fix the signature table / checker, never exclude):\n${normalizedHits.slice(0, 20).join("\n")}`,
			).toEqual(KNOWN_SEMANTIC_INVALID);
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
