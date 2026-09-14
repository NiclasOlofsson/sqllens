// Task 4 (editor-gold wave, .superpowers/sdd/task-4-brief.md): the token-level statement
// splitter that Task 5's statement-scoped SqlDocument will slice into cells from. Built over
// the existing total `tokenize()` — string/comment safety comes for free from walking tokens
// instead of characters. The tiling invariant (spans exactly cover [0, text.length)) is the
// safety valve: it's asserted over every case here, not just spot-checked.
import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { splitStatements, type StatementCellSpan } from "../src/document/split.js";

/** The tiling invariant itself: contiguous, starts at 0, ends at text.length. */
function assertTiles(text: string, spans: StatementCellSpan[]): void {
	expect(spans.length).toBeGreaterThan(0);
	expect(spans[0].start).toBe(0);
	for (let i = 0; i < spans.length; i++) {
		expect(spans[i].end).toBeGreaterThanOrEqual(spans[i].start);
		if (i + 1 < spans.length) expect(spans[i].end).toBe(spans[i + 1].start);
	}
	expect(spans[spans.length - 1].end).toBe(text.length);
}

/** Slice `text` into the cell texts the spans denote, for readable assertions. */
function cellTexts(text: string, spans: StatementCellSpan[]): string[] {
	return spans.map((s) => text.slice(s.start, s.end));
}

function split(text: string, dialect: Dialect): StatementCellSpan[] {
	const spans = splitStatements(text, dialect);
	assertTiles(text, spans); // every case is tiling-checked, not just the dedicated property test
	return spans;
}

describe("splitStatements", () => {
	it("splits two ;-separated selects into 2 cells", () => {
		const text = "SELECT 1; SELECT 2;";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["SELECT 1;", " SELECT 2;"]);
	});

	it("a trailing statement without a terminating ; is its own cell", () => {
		const text = "SELECT 1; SELECT 2";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["SELECT 1;", " SELECT 2"]);
	});

	it("trailing trivia after the last separator folds into the last cell (never a token-less tail cell)", () => {
		// A single terminated statement plus the final newline is one cell, so the document facade
		// is the statement itself rather than a compound over a statement and its newline.
		expect(cellTexts("SELECT 1;\n", split("SELECT 1;\n", "duckdb"))).toEqual(["SELECT 1;\n"]);
		expect(cellTexts("SELECT 1;\n\n\n", split("SELECT 1;\n\n\n", "duckdb"))).toEqual(["SELECT 1;\n\n\n"]);
		expect(cellTexts("SELECT 1;\n-- done\n", split("SELECT 1;\n-- done\n", "duckdb"))).toEqual([
			"SELECT 1;\n-- done\n",
		]);
		const two = "SELECT 1;\nSELECT 2;\n";
		expect(cellTexts(two, split(two, "duckdb"))).toEqual(["SELECT 1;", "\nSELECT 2;\n"]);
		// masked per-cell copy (other statements blanked, this cell's `;` kept): still one cell
		const masked = "SELECT 1;\n           \n";
		expect(cellTexts(masked, split(masked, "duckdb"))).toEqual([masked]);
	});

	it("text ending inside an open level splits at every separator from the unclosed opener on", () => {
		// An unclosed CASE (mid-typing) must not swallow the statements after it into one cell: a
		// "run statement at cursor" over that cell would run them all.
		const text = "select case when a = 1 then 'x' from t;\ndelete from staging.orders;";
		expect(cellTexts(text, split(text, "tsql"))).toEqual([
			"select case when a = 1 then 'x' from t;",
			"\ndelete from staging.orders;",
		]);
		// Split points before the unclosed opener stand: a balanced block stays one cell.
		const mixed = "begin\nselect 1;\nselect 2;\nend;\nselect case when a = 1 then 'x' from t;\ndelete from t;";
		expect(cellTexts(mixed, split(mixed, "tsql"))).toEqual([
			"begin\nselect 1;\nselect 2;\nend;",
			"\nselect case when a = 1 then 'x' from t;",
			"\ndelete from t;",
		]);
		// GO splits inside an unclosed level too.
		const go = "begin\nselect 1\nGO\nselect 2";
		expect(cellTexts(go, split(go, "tsql"))).toEqual(["begin\nselect 1\nGO\n", "select 2"]);
	});

	it("every terminated cell carries its separator token; an unterminated one carries none", () => {
		const semi = "SELECT 1;\nSELECT 2";
		expect(split(semi, "duckdb").map((s) => s.separator)).toEqual([{ start: 8, end: 9 }, undefined]);
		// the folded trailing-trivia cell keeps its separator
		expect(split("SELECT 1;\n", "duckdb").map((s) => s.separator)).toEqual([{ start: 8, end: 9 }]);
		// GO: the separator is the GO word, the cell end is the end of its line
		const go = "SELECT 1\nGO\nSELECT 2";
		const spans = split(go, "tsql");
		expect(spans[0]).toEqual({ start: 0, end: 12, separator: { start: 9, end: 11 } });
		expect(spans[1].separator).toBeUndefined();
		expect(split("SELECT 1 FROM t", "duckdb")[0].separator).toBeUndefined();
	});

	it("a doc with no separators is one cell", () => {
		const text = "SELECT 1 FROM t";
		const spans = split(text, "databricks");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("empty text is one empty cell", () => {
		const spans = split("", "databricks");
		expect(spans).toEqual([{ start: 0, end: 0 }]);
	});

	it("a ; inside a string literal does not split", () => {
		const text = "SELECT 'a;b' FROM t";
		const spans = split(text, "databricks");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("a ; inside a line comment does not split", () => {
		const text = "SELECT 1 -- has a ; in it\nFROM t";
		const spans = split(text, "databricks");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("a ; inside a block comment does not split", () => {
		const text = "SELECT 1 /* has a ; in it */ FROM t";
		const spans = split(text, "databricks");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("a ; inside CASE...END does not split, but one after it does", () => {
		// Not valid SQL (a bare `;` mid-CASE) — this is a lexer-level depth test, tokenize()
		// doesn't validate. The point: CASE opens a depth level like BEGIN, END closes it.
		const text = "SELECT CASE WHEN a THEN 1 ; ELSE 2 END; SELECT 2";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["SELECT CASE WHEN a THEN 1 ; ELSE 2 END;", " SELECT 2"]);
	});

	it("a ; inside a Databricks BEGIN...END compound does not split, but one after it does", () => {
		const text = "BEGIN SELECT 1; SELECT 2; END; SELECT 3";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["BEGIN SELECT 1; SELECT 2; END;", " SELECT 3"]);
	});

	it("END IF inside a compound does not close the compound's depth level", () => {
		// The END of `END IF` closes an IF, and IF never incremented depth — so it must not
		// decrement either, or the inner `;` after it would wrongly split the compound.
		const text = "BEGIN IF c THEN SELECT 1; END IF; SELECT 2; END; SELECT 3";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["BEGIN IF c THEN SELECT 1; END IF; SELECT 2; END;", " SELECT 3"]);
	});

	it("a CASE statement's END CASE closes the level without the CASE re-incrementing", () => {
		// `END CASE` = one closer: END decrements, and the trailing CASE keyword must be
		// consumed, not treated as a new opener — else depth sticks +1 and later ; never split.
		const text = "BEGIN CASE WHEN a THEN SELECT 1; END CASE; END; SELECT 2;";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["BEGIN CASE WHEN a THEN SELECT 1; END CASE; END;", " SELECT 2;"]);
	});

	it("an expression CASE...END followed by a comma still balances", () => {
		// Regression guard for the END lookahead: here END's next channel-0 token is `,`,
		// which is neither a scripting-END suffix nor CASE — the plain decrement must fire.
		const text = "SELECT CASE WHEN a THEN b END, x FROM t; SELECT 2";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["SELECT CASE WHEN a THEN b END, x FROM t;", " SELECT 2"]);
	});

	it("adjacent separators yield an empty middle cell and still tile", () => {
		const text = "SELECT 1;;SELECT 2";
		const spans = split(text, "databricks");
		expect(cellTexts(text, spans)).toEqual(["SELECT 1;", ";", "SELECT 2"]);
	});

	it("T-SQL: GO alone on its own line splits", () => {
		const text = "SELECT 1\nGO\nSELECT 2";
		const spans = split(text, "tsql");
		expect(cellTexts(text, spans)).toEqual(["SELECT 1\nGO\n", "SELECT 2"]);
	});

	it("T-SQL: GO used as a column alias mid-line does not split", () => {
		const text = "SELECT 1 AS GO FROM t";
		const spans = split(text, "tsql");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("T-SQL: BEGIN TRAN must not open a depth level, so the ; after COMMIT splits", () => {
		const text = "BEGIN TRAN COMMIT; SELECT 1";
		const spans = split(text, "tsql");
		expect(cellTexts(text, spans)).toEqual(["BEGIN TRAN COMMIT;", " SELECT 1"]);
	});

	it("T-SQL: BEGIN TRANSACTION must not open a depth level either", () => {
		const text = "BEGIN TRANSACTION COMMIT; SELECT 1";
		const spans = split(text, "tsql");
		expect(cellTexts(text, spans)).toEqual(["BEGIN TRANSACTION COMMIT;", " SELECT 1"]);
	});

	it("T-SQL: BEGIN DISTRIBUTED TRAN must not open a depth level either", () => {
		const text = "BEGIN DISTRIBUTED TRAN COMMIT; SELECT 1";
		const spans = split(text, "tsql");
		expect(cellTexts(text, spans)).toEqual(["BEGIN DISTRIBUTED TRAN COMMIT;", " SELECT 1"]);
	});

	it("GO is not treated as a separator outside T-SQL", () => {
		const text = "SELECT 1\nGO\nSELECT 2";
		const spans = split(text, "databricks");
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});

	it("is total: an unknown dialect value never throws and falls back to one cell", () => {
		const text = "SELECT 1; SELECT 2";
		expect(() => splitStatements(text, "not-a-real-dialect" as Dialect)).not.toThrow();
		const spans = splitStatements(text, "not-a-real-dialect" as Dialect);
		assertTiles(text, spans);
		expect(spans).toEqual([{ start: 0, end: text.length }]);
	});
});

// Step 3's fuzz-ish sweep: the tiling invariant must hold over real-world-shaped input, not just
// the hand-picked cases above. These inline SQL fixtures cover valid queries, broken/mid-edit
// fragments, CTEs, comments (incl. multi-line), and a multi-statement file, run across every
// dialect the splitter is total for.
const ALL_DIALECTS: Dialect[] = [
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

const ACCEPTANCE_FIXTURES: string[] = [
	"SELECT amount FROM sales",
	"SELECT (1",
	"SELECT nope FROM sales",
	"SELECT  FROM sales",
	"WITH c AS (SELECT id FROM sales) SELECT id FROM c",
	"SELECT round(amount, 0) FROM sales",
	"SELECT amount FROM sales -- note",
	"SELECT amount AS amount_out FROM sales",
	"SELECT * FORM x",
	"WITH recent AS (SELECT id FROM sales) SELECT id FROM recent",
	"/* c */ SELECT 1",
	"SELECT /* line1\nline2 */ 1",
	"SELECT amount FROM sales\nSELECT id FROM sales",
	"SELECT date_add(x, ",
	"WITH r AS (\n  SELECT id\n  FROM sales\n)\nSELECT id\nFROM r",
	"SELECT mystery FROM nowhere",
	"SELECT amount FROM sales;\nSELECT id FROM sales",
];

describe("splitStatements — tiling sweep over editor fixtures", () => {
	for (const dialect of ALL_DIALECTS) {
		for (const text of ACCEPTANCE_FIXTURES) {
			it(`tiles for ${dialect}: ${JSON.stringify(text).slice(0, 40)}`, () => {
				assertTiles(text, splitStatements(text, dialect));
			});
		}
	}
});
