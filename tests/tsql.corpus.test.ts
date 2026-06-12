import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { TSqlLexer } from "../src/generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../src/generated/tsql/TSqlParser.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

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

// Locked 2026-06-10: the SQL examples scraped from the Microsoft T-SQL reference
// (MicrosoftDocs/sql-docs docs/t-sql via tools/extract-tsql-docs.mjs; gitignored,
// 3,405 files). Ratchet: the pass count must never drop below this baseline. The
// shortfall is platform/admin DDL (CREATE EXTERNAL DATA SOURCE, GRANT/DENY/REVOKE
// permission lists, BULK INSERT, RESTORE, ALTER DATABASE SCOPED CONFIGURATION, the
// Azure Synapse CTAS dialect) — tracked grammar gaps, not query-layer failures.
// Raise as fixes land.
const DOCS_BASELINE = 2698;

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

	it("lowers + scopes every example our SELECT parser accepts, without throwing", () => {
		let accepted = 0;
		for (const rel of files) {
			const sql = readFileSync(join(EXAMPLES, rel), "utf8");
			const r = parseTSql(sql);
			if (r.errors === 0) {
				accepted++;
				expect(() => resolveScopes(lower(r.tree), "tsql"), rel).not.toThrow();
			}
		}
		// The SELECT-bearing subset of the examples (~19 files) — proves lower() survives them.
		expect(accepted).toBeGreaterThan(0);
	}, 120000);
});

function* sqlFilesDeep(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFilesDeep(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

describe.skipIf(!existsSync(DOCS_CORPUS))("T-SQL grammar vs the scraped MS docs corpus", () => {
	it(`parses at least ${DOCS_BASELINE} docs examples via tsql_file (ratchet)`, () => {
		let pass = 0;
		let total = 0;
		for (const f of sqlFilesDeep(DOCS_CORPUS)) {
			total++;
			let errs = 1;
			try {
				errs = parseFullFile(readFileSync(f, "utf8"));
			} catch {
				errs = -1;
			}
			if (errs === 0) pass++;
		}
		expect(pass, `docs-corpus pass count dropped: ${pass}/${total} (baseline ${DOCS_BASELINE})`).toBeGreaterThanOrEqual(
			DOCS_BASELINE,
		);
	}, 600000);
});
