import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower, statementCategories } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";
import { KNOWN_BAD, OUT_OF_SCOPE } from "./tsql-corpus-known-bad.js";

// grammars-v4 ships its own T-SQL example corpus. These are full T-SQL *scripts* (mostly DDL/admin,
// GO-separated batches), so they exercise the GRAMMAR via the full-file entry rule `tsql_file` — not
// our SELECT-scoped lower(). Two files fail the grammars-v4 grammar itself (constants.sql,
// keywords_reserved.sql) — upstream edge cases, not ours. This gate locks the current pass count so a
// toolchain/regen regression is caught, and separately checks that every example our SELECT parser
// accepts also lowers + scopes without throwing.
//
// vendor/ is a gitignored sparse clone, so this gate is a no-op (skipped) when the corpus is absent
// (CI / other machines) — same pattern as the Databricks corpus gate.

const EXAMPLES = resolve("vendor/grammars-v4/sql/tsql/examples");
const DOCS_CORPUS = resolve("harness/local/tsql-docs");

// The SQL examples scraped from the Microsoft T-SQL reference (MicrosoftDocs/sql-docs
// docs/t-sql via tools/extract-tsql-docs.mjs; gitignored, ~3,400 files). Bucketing is
// parse-derived: every file is parsed and bucketed by its statement kinds (statementCategories;
// first substantive statement decides), with the leading-keyword regex only as the no-parse
// fallback. The gate requires 100% of the in-scope query bucket; documented-broken examples are
// excluded via KNOWN_BAD (asserted to still fail) and mixed scripts whose payload is out-of-scope
// DDL/admin are reclassified via OUT_OF_SCOPE — both lists verified file-by-file against the
// source markdown (2026-06-13). dml/ddl buckets are reported, never gated (object/platform DDL is
// cleared Out of scope). The numeric baseline is unused in 100% mode but kept as a documented floor.
const QUERY_BASELINE = 854;

/** Production parse (tsql_file, two-stage SLL→LL); returns the syntax-error count. */
function parseErrors(sql: string): number {
	return parseTSql(sql).errors;
}

/** One parse per file: its error count plus, when clean, the per-statement categories for
 *  parse-derived bucketing. Returning both from a single parse avoids re-parsing every file
 *  (which, for the SLL-false-reject queries, meant paying the slow full-LL pass twice). */
function parseAndClassify(sql: string): { errors: number; kinds: ReturnType<typeof statementCategories> | undefined } {
	const r = parseTSql(sql);
	return { errors: r.errors, kinds: r.errors === 0 ? statementCategories(r.tree) : undefined };
}

describe.skipIf(!existsSync(EXAMPLES))("T-SQL grammar vs the grammars-v4 example corpus", () => {
	const files = readdirSync(EXAMPLES).filter((f) => f.endsWith(".sql"));

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
		expect(fails.sort()).toEqual(["constants.sql", "keywords_reserved.sql"]);
	}, 120000);

	it("lowers + scopes every example the parser accepts, without throwing", () => {
		let accepted = 0;
		let modelled = 0;
		for (const rel of files) {
			const sql = readFileSync(join(EXAMPLES, rel), "utf8");
			const r = parseTSql(sql);
			if (r.errors === 0) {
				accepted++;
				// Query examples lower to a modelled body; DML/DDL/admin lower to a flagged-empty body
				// carrying their category. Either way the semantic layer must run without throwing.
				const q = lower(r.tree);
				if (q.statement === "query" && q.body.kind === "select" && !q.body.unsupported?.length) modelled++;
				expect(() => resolveScopes(q, "tsql"), rel).not.toThrow();
			}
		}
		expect(accepted).toBeGreaterThan(0);
		// At least some examples must take the real modelling path — guards against a
		// statement-classification regression silently routing everything to emptyQuery.
		expect(modelled).toBeGreaterThan(0);
	}, 120000);
});

describe.skipIf(!existsSync(DOCS_CORPUS))("T-SQL grammar vs the scraped MS docs corpus", () => {
	it("parses 100% of in-scope query examples (parse-derived buckets; KNOWN_BAD excluded)", { timeout: 600000 }, () => {
		runDocsRatchet(DOCS_CORPUS, parseErrors, QUERY_BASELINE, {
			knownBad: KNOWN_BAD,
			outOfScope: OUT_OF_SCOPE,
			classify: parseAndClassify,
		});
	});
});
