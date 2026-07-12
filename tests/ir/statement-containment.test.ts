import { describe, expect, it } from "vitest";
import { parse, type Dialect } from "../../src/index.js";

// Multi-statement error containment — the guarantee an editor relies on.
//
// Editor input is mid-edit: one broken statement in the middle of a document must
// not destroy the rest. This battery PROVES two levels of containment for the
// dialects whose entry rule is a statement list:
//
//   1. Token-level floor (the editor's hard guarantee): the token stream is total —
//      a broken statement in the middle never truncates the stream, so the tokens of
//      the LATER valid statement are still present with correct spans. parse() never
//      throws on broken input.
//   2. CST/diagnostic level: the parse reports a positioned diagnostic AT the broken
//      middle statement (not smeared to offset 0 or the document end).
//
// Every covered dialect's entry rule is a statement list: databricks (multiStatement,
// issue #1), tsql (tsql_file = batch* EOF), snowflake (snowflake_file), the root-anchored
// dialects (bigquery, redshift, postgres, duckdb, trino, mysql) and sqlite (parse). This
// battery verifies all of them batch ;-separated statements AND localize the diagnostic to
// the broken middle statement.

// A three-statement document with a broken statement in the middle. The trailing
// statement `SELECT c FROM u` is valid in every covered dialect.
const INPUT = "SELECT a FROM t; SELEC b FROM ; SELECT c FROM u";

// Spans of the broken middle statement, used to assert diagnostics are localized.
const FIRST_SEMI = INPUT.indexOf(";"); // end of the first (valid) statement
const SECOND_SEMI = INPUT.indexOf(";", FIRST_SEMI + 1); // end of the broken middle
const TRAILING_START = INPUT.indexOf("SELECT c"); // start of the trailing valid statement

const MULTI_STATEMENT_DIALECTS: Dialect[] = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
];

describe("multi-statement error containment", () => {
	for (const dialect of MULTI_STATEMENT_DIALECTS) {
		describe(dialect, () => {
			it("token stream is total — trailing valid statement's tokens survive the broken middle", () => {
				let r: ReturnType<typeof parse>;
				expect(() => {
					r = parse(INPUT, dialect);
				}).not.toThrow();

				// The trailing statement's identifiers `c` and `u` must both be present as tokens,
				// and they must be spanned in the trailing region of the document — proving the
				// stream was not cut off at the broken middle.
				const cTok = r!.tokens.find((t) => t.text === "c" && t.start >= TRAILING_START);
				const uTok = r!.tokens.find((t) => t.text === "u" && t.start >= TRAILING_START);

				expect(cTok, "`c` token from the trailing statement must be present").toBeDefined();
				expect(uTok, "`u` token from the trailing statement must be present").toBeDefined();
				// Exact-span sanity: each token's text matches the source slice at its span.
				expect(INPUT.slice(cTok!.start, cTok!.stop + 1)).toBe("c");
				expect(INPUT.slice(uTok!.start, uTok!.stop + 1)).toBe("u");
				expect(uTok!.start).toBeGreaterThan(cTok!.start);
			});

			it("diagnostics are localized to the broken middle, not smeared to the document edges", () => {
				const r = parse(INPUT, dialect);

				expect(r.errors).toBeGreaterThan(0);
				expect(r.diagnostics.length).toBeGreaterThan(0);

				// At least one diagnostic must point inside the broken middle statement's span
				// (between the first `;` and the second `;`) — not at offset 0 and not at the end.
				const localized = r.diagnostics.some((d) => {
					const off = d.offset;
					return off !== undefined && off > FIRST_SEMI && off <= SECOND_SEMI;
				});
				expect(
					localized,
					`expected a diagnostic offset in (${FIRST_SEMI}, ${SECOND_SEMI}]; got ${JSON.stringify(
						r.diagnostics.map((d) => d.offset),
					)}`,
				).toBe(true);
			});
		});
	}
});
