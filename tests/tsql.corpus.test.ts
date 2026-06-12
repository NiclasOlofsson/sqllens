import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { TSqlLexer } from "../src/generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../src/generated/tsql/TSqlParser.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";

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
// docs/t-sql via tools/extract-tsql-docs.mjs; gitignored, 3,405 files). The gate RATCHETS
// on the in-scope query bucket only and reports dml/ddl: this corpus is ~70% admin/platform
// DDL (CREATE EXTERNAL DATA SOURCE, GRANT/DENY/REVOKE lists, BULK INSERT, RESTORE, ALTER
// DATABASE SCOPED CONFIGURATION, Synapse CTAS), all out of scope. Query conformance is
// 854/940 (90.9%). Raise the baseline as fixes land.
const QUERY_BASELINE = 854;

/** Parse a whole T-SQL script with the full-file entry rule; return the syntax-error count. */
function parseFullFile(sql: string): number {
	const lexer = new TSqlLexer(CharStream.fromString(sql));
	const parser = new TSqlParser(new CommonTokenStream(lexer));
	let errors = 0;
	const listener = {
		syntaxError() {
			errors++;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
	parser.tsql_file();
	return errors;
}

describe.skipIf(!existsSync(EXAMPLES))("T-SQL grammar vs the grammars-v4 example corpus", () => {
	const files = readdirSync(EXAMPLES).filter((f) => f.endsWith(".sql"));

	it("parses the full T-SQL example scripts via tsql_file (>= baseline)", () => {
		let ok = 0;
		const fails: string[] = [];
		for (const rel of files) {
			let errs = 1;
			try {
				errs = parseFullFile(readFileSync(join(EXAMPLES, rel), "utf8"));
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
		for (const rel of files) {
			const sql = readFileSync(join(EXAMPLES, rel), "utf8");
			const r = parseTSql(sql);
			if (r.errors === 0) {
				accepted++;
				// Query examples lower to a modelled body; DML/DDL/admin lower to a flagged-empty body
				// carrying their category. Either way the semantic layer must run without throwing.
				expect(() => resolveScopes(lower(r.tree), "tsql"), rel).not.toThrow();
			}
		}
		expect(accepted).toBeGreaterThan(0);
	}, 120000);
});

describe.skipIf(!existsSync(DOCS_CORPUS))("T-SQL grammar vs the scraped MS docs corpus", () => {
	it("parses the in-scope query examples via tsql_file (ratchet); reports dml/ddl", { timeout: 600000 }, () => {
		runDocsRatchet(DOCS_CORPUS, parseFullFile, QUERY_BASELINE);
	});
});
