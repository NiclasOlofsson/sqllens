// Task 8 (anvil post-wave design batch) — the "cte-definition" ExpansionShape: a macro whose
// ENTIRE body is one or more complete CTE clauses (`extra_a as (select 1 as x),`) called inside
// a WITH list between two other CTEs. No existing shape fits "this expands to a whole CTE
// definition" — the fallback identifier fill produces `with base as (...),\njjj…\nfinal`, a
// parse error (anvil's filing, verified reproducible against pre-Task-8 HEAD).
//
// Two wrinkles this shape has that no prior shape needs: (1) the fill introduces a NAME into
// the enclosing WITH list's namespace, so it must be per-tag UNIQUE (the same base-35 ordinal
// scheme the identifier fill already uses) — two cte-definition tags in one WITH list must not
// collide; (2) slot admission is neither the statement/relation body-start allowlist nor the
// conjunct/where-clause trailing-expression allowlist — it is admitted ONLY immediately after a
// `,` that follows a completed prior CTE clause (a comma-only slot guard).

import { describe, expect, test } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";
import { NamedShapeProvider } from "./helpers/providers.js";

describe("cte-definition ExpansionShape", () => {
	test("a macro emitting a bare CTE clause fills as a valid, slot-guarded CTE definition", () => {
		const text =
			"with base as (\n    select 1 as x\n),\n{{ make_extra_ctes() }}\nfinal as (\n    select * from base join extra_a on base.x = extra_a.x\n)\nselect * from final\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0);
	});

	test("two cte-definition tags in the same WITH list get DIFFERENT synthetic names", () => {
		// The brief's literal `{{ a() }}` / `{{ b() }}` sketch is only 9 chars per tag — too
		// short to EVER hold a valid `name as (select 1),` fragment (minimum ~15 chars), so both
		// would blank out and the test would pass without proving anything. Real macro calls
		// (the anvil repro's own `make_extra_ctes()` is 24 chars) are never this short, so this
		// uses realistically-sized names that actually fit — the case the uniqueness scheme
		// exists for.
		const text =
			"with base as (select 1),\n{{ make_extra_a() }}\n{{ make_extra_b() }}\nfinal as (select * from base)\nselect * from final\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_a: "cte-definition", make_extra_b: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0);
		// The uniqueness proof: two DISTINCT synthetic CTE names landed, not the same literal
		// twice (a repeated literal name would be a duplicate CTE name — invalid SQL in most
		// dialects, the exact hazard this scheme exists to avoid).
		const names = [...r.placeholder.matchAll(/j[0-9a-z]+ as \(select 1\),/g)].map((m) => m[0]);
		expect(names).toHaveLength(2);
		expect(names[0]).not.toBe(names[1]);
	});

	test("length and newlines preserved through a cte-definition fill", () => {
		const text =
			"with base as (select 1),\n{{ make_extra_ctes() }}\nfinal as (select * from base)\nselect * from final\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.placeholder.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});

	test("a cte-definition answer NOT in a comma slot falls back to the identifier fill (slot guard)", () => {
		// A cte-definition-shaped call used as a plain scalar expression — not after a CTE-closing comma.
		const text = "select {{ make_extra_ctes() }} from t\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0); // identifier fill parses as a bare column reference
	});

	test("a comma-admitted cte-definition tag too short to hold its fragment blanks instead of corrupting (deviation from the identifier-fill fallback every other shape uses)", () => {
		// The brief's own `{{ a() }}` / `{{ b() }}` sketch: 9 chars, physically shorter than the
		// ~15-char minimum for ANY valid `name as (select 1),` clause. Every other shape's guard
		// falls back to the identifier fill when its fragment doesn't fit, because the identifier
		// fill is a SAFE default at their admitted slots. It is NOT safe here — a bare identifier
		// right after a WITH-list comma is exactly the original anvil-repro parse error — so this
		// shape blanks instead when admitted-but-too-short, never falling through to identifier fill.
		const text =
			"with base as (select 1),\n{{ a() }}\n{{ b() }}\nfinal as (select * from base)\nselect * from final\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ a: "cte-definition", b: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0);
	});

	// --- Review finding, Task 8 follow-up ---------------------------------------------------
	// Anvil's original filing (quoted in the follow-up brief) admits this shape "after
	// `WITH <name> AS (...),` or another cte-definition fill; before another CTE name OR THE MAIN
	// QUERY KEYWORD" — the last-CTE-in-the-list placement was always in scope, but the fragment's
	// hardcoded trailing comma (`...(select 1),`) only works for the "another CTE follows" half.
	// When this tag's synthetic CTE is the LAST one, immediately before the main query, that
	// trailing comma has nothing after it: `with base as (...), j0 as (select 1), select * ...`
	// is a real parse error (confirmed by the reviewer, reproduced independently).

	test("cte-definition as the LAST CTE before the main query omits its trailing comma", () => {
		const text = "with base as (select 1),\n{{ make_extra_ctes() }}\nselect * from base\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0);
		// The fragment landed (not blanked) — and with NO trailing comma, unlike the non-last case.
		expect(r.placeholder).toMatch(/j[0-9a-z]+ as \(select 1\)/);
		expect(r.placeholder).not.toMatch(/j[0-9a-z]+ as \(select 1\),/);
	});

	test("length and newlines are preserved when the last-CTE fragment omits its comma", () => {
		const text = "with base as (select 1),\n{{ make_extra_ctes() }}\nselect * from base\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.placeholder.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});

	test("cte-definition as a NON-last CTE still gets its trailing comma (regression guard — the last-CTE fix must not regress the already-working case)", () => {
		const text =
			"with base as (select 1),\n{{ make_extra_ctes() }}\nfinal as (select * from base)\nselect * from final\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toMatch(/j[0-9a-z]+ as \(select 1\),/);
		expect(r.placeholder.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});

	test("a cte-definition tag immediately followed by another (not-yet-filled) jinja tag conservatively keeps its trailing comma (ambiguous lookahead degrades safe, never guesses toward removal)", () => {
		// The forward lookahead can't see through a LATER tag's raw `{{`/`{%`/`{#` delimiters — that
		// tag hasn't been filled yet when THIS one is decided (segments fill in source order), so
		// `followingSlot` reads a `{` and returns it as-is: not a word, not in `QUERY_START_WORDS`,
		// so the caller keeps the comma — the pre-existing, already-proven-safe default — rather
		// than guessing that the intervening tag renders to nothing and the main query follows.
		//
		// Residual known limitation (unchanged by this fix, not a regression): if the intervening
		// tag blanks to whitespace (as `config(...)` does here) AND is itself immediately followed
		// by the main query, the kept comma has nothing after it and the overall SQL still fails to
		// parse — the same composed case was already unparseable before this fix (every
		// cte-definition fragment always carried an unconditional trailing comma). Closing that
		// would need a lookahead that sees THROUGH a not-yet-classified tag's eventual shape, which
		// is out of scope here; this test only proves the comma decision itself never guesses wrong
		// in the ambiguous direction.
		const text =
			"with base as (select 1),\n{{ make_extra_ctes() }}\n{{ config(materialized='table') }}\nselect * from base\n";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ make_extra_ctes: "cte-definition" }),
		});
		expect(r.placeholder).toMatch(/j[0-9a-z]+ as \(select 1\),/);
	});
});
