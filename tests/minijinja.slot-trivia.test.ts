// SQL comment trivia must be invisible to the fill-slot scan (anvil torture-corpus finding,
// 2026-07-06): `precedingSlot` — the scanner behind EVERY fill guard (statement/relation
// allowlist, conjunct + where-clause admission) — skipped only whitespace backward, so a
// leading `-- header` comment made a statement-shaped tag read slot "header" instead of
// document start: statement fill rejected, identifier fill, parse error. The scan now skips
// `--` line comments (string-aware) and `/* … */` block comments (incl. multi-line).
// Boundary: snowflake's `//` line comments stay unskipped (the scan is dialect-blind, and
// `//` elsewhere is division) — documented, revisit on a real snowflake hit.

import { describe, expect, test } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";
import { NamedShapeProvider } from "./helpers/providers.js";

const stmtShaped = () => ({ provider: new NamedShapeProvider({ whole_view: "statement" }) });
const whereShaped = () => ({ provider: new NamedShapeProvider({ soft_delete: "where-clause" }) });

describe("comment trivia is invisible to the fill-slot scan", () => {
	test("a leading -- comment does not defeat the statement fill (the anvil repro)", () => {
		const bare = parseTemplated("{{ whole_view('raw_events') }}\n", "databricks", stmtShaped());
		expect(bare.sql.errors).toBe(0); // control — already true
		const commented = parseTemplated(
			"-- a header comment\n{{ whole_view('raw_events') }}\n",
			"databricks",
			stmtShaped(),
		);
		expect(commented.sql.errors).toBe(0);
		expect(commented.placeholder).toContain("SELECT 1");
	});

	test("a leading block comment (multi-line) does not defeat the statement fill", () => {
		const r = parseTemplated(
			"/* header\n   spanning lines */\n{{ whole_view('raw_events') }}\n",
			"databricks",
			stmtShaped(),
		);
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toContain("SELECT 1");
	});

	test("a trailing same-line comment before a where-mode tag keeps the WHERE fill", () => {
		const text = `select a
from t
join u on (t.a = u.a) -- join note
{{ soft_delete('t.x','where') }}
union all
select b from v`;
		const r = parseTemplated(text, "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("a comment line between the FROM and the tag keeps the WHERE fill", () => {
		const text = "select a from t\n-- soft-delete filter below\n{{ soft_delete('t.x','where') }}";
		const r = parseTemplated(text, "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("a quoted '--' is NOT trivia — the string close still admits the conjunct fill", () => {
		// The `--` sits inside a string literal; the slot is the closing quote, which admits the
		// conjunct fill (`AND 1=1` → parses clean). Misreading the quoted `--` as a comment would
		// move the slot to the `=` before the string, reject the conjunct, and the identifier
		// fill would break the parse — so errors:0 here discriminates string-awareness.
		const text = "select a from t where x = 'a -- b' {{ is_active('t.x') }}";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ is_active: "conjunct" }),
		});
		expect(r.sql.errors).toBe(0);
	});

	test("statement-slot blank default also sees through a leading comment", () => {
		// A CALL with NO shape answer at a (comment-preceded) statement slot blanks instead of
		// the identifier fill — same rule as at true document start.
		const r = parseTemplated("-- header\n{{ my_helper() }}\nselect 1", "databricks");
		expect(r.sql.errors).toBe(0);
	});
});
