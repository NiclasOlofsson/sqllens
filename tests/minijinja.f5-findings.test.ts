// Niclas's F5 smoke findings on the live Oatly project (gold__vendor.sql), decomposed with anvil
// on the channel 2026-07-06. TDD-ordered by Niclas: these tests land failing, the fixes follow.
//
//  1. where-clause expansion shape — a mode-as-argument macro (`{{ soft_delete('t.x','where') }}`)
//     expands to a leading-WHERE clause; no shipped shape fit (conjunct's `AND 1=1` regresses the
//     `from t <tag>` slot, the identifier fill breaks the `on (...) <tag> union all` slot).
//     A "where-clause" shape fills `WHERE 1=1`, valid in both.
//  2. Templated diagnostics must never quote placeholder fill text. The scrub existed but only on
//     the merged top-level `diagnostics`; the embedded `sql.diagnostics` (the ParseResultIR shape a
//     consumer naturally reads) leaked raw "mismatched input 'jjjj…'" to Niclas's screen.
//  3. Regression pin (finding 3 was anvil-side, trace requested): a templated LEFT OUTER JOIN
//     reports Join kind "left" with the from-entry reference identity intact — including when the
//     statement also carries a broken tag (error recovery must not smear the join chain).

import { describe, expect, test } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";
import { NamedShapeProvider } from "./helpers/providers.js";

// The exact slot Niclas hit: a complete ON predicate, then the where-mode tag, then UNION ALL.
const ON_SLOT = `select a
from t
join u on (t.a = u.a)
{{ soft_delete('t.x','where') }}
union all
select b from v`;

// The other live slot for the same macro family: directly after the FROM relation.
const FROM_SLOT = `select a from t
{{ soft_delete('t.x','where') }}`;

const whereShaped = () => ({ provider: new NamedShapeProvider({ soft_delete: "where-clause" }) });

describe("F5 finding 1 — the where-clause expansion shape", () => {
	test("where-mode macro after a complete ON predicate parses (the gold__vendor slot)", () => {
		const r = parseTemplated(ON_SLOT, "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("where-mode macro after the FROM relation parses", () => {
		const r = parseTemplated(FROM_SLOT, "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("slot guard: a where-clause shape never breaks a slot the identifier fill parses", () => {
		// In a select-list slot the WHERE fragment would be invalid SQL while the identifier
		// fill reads as a column — the guard must fall back, exactly like conjunct's.
		const r = parseTemplated("select {{ soft_delete('t.x','where') }} from t", "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("zero-provider behavior unchanged: the same input keeps today's identifier-fill outcome", () => {
		const r = parseTemplated(ON_SLOT, "databricks");
		expect(r.sql.errors).toBe(1); // still broken without a shape answer — finding 2 owns the message
	});
});

describe("F5 finding 2 — diagnostics never quote placeholder fill text", () => {
	test("the embedded sql.diagnostics quote the raw tag source, not the fill", () => {
		const r = parseTemplated(ON_SLOT, "databricks");
		expect(r.sql.errors).toBe(1);
		for (const d of r.sql.diagnostics) {
			expect(d.message).not.toMatch(/j{4,}/);
		}
		expect(r.sql.diagnostics[0]!.message).toContain("{{ soft_delete('t.x','where') }}");
	});

	test("the merged top-level diagnostics stay scrubbed too (both public surfaces agree)", () => {
		const r = parseTemplated(ON_SLOT, "databricks");
		for (const d of r.diagnostics) {
			expect(d.message).not.toMatch(/j{4,}/);
		}
	});
});

describe("F5 finding 4 — multi-line tags receive shape fills (490/1525 Oatly models)", () => {
	// The whole-model-is-one-macro pattern: the tag spans lines, so the old fit guard
	// (fragment must fit before the tag's FIRST newline — 2 chars in `{{\n…`) rejected every
	// shape and fell back to the identifier fill. The fill must instead place the fragment in
	// the first newline-free window inside the tag that fits it.
	const MULTILINE = "{{\n    create_anaplan_norm_view('salesforecast')\n}}\n";
	const stmtShaped = () => ({
		provider: new NamedShapeProvider({ create_anaplan_norm_view: "statement" }),
	});

	test("a multi-line statement-shaped tag parses like its one-line twin", () => {
		const one = parseTemplated("{{ create_anaplan_norm_view('salesforecast') }}\n", "databricks", stmtShaped());
		expect(one.sql.errors).toBe(0); // the one-line control — already true before the fix
		const multi = parseTemplated(MULTILINE, "databricks", stmtShaped());
		expect(multi.sql.errors).toBe(0);
	});

	test("the shaped multi-line fill preserves length and every newline position", () => {
		const multi = parseTemplated(MULTILINE, "databricks", stmtShaped());
		expect(multi.placeholder.length).toBe(MULTILINE.length);
		for (let i = 0; i < MULTILINE.length; i++) {
			if (MULTILINE[i] === "\n") expect(multi.placeholder[i], `newline @${i}`).toBe("\n");
		}
		expect(multi.placeholder).toContain("SELECT 1");
	});

	test("a multi-line where-mode tag after a complete ON predicate parses (features compose)", () => {
		const text = `select a
from t
join u on (t.a = u.a)
{{
    soft_delete('t.x','where')
}}
union all
select b from v`;
		const r = parseTemplated(text, "databricks", whereShaped());
		expect(r.sql.errors).toBe(0);
	});

	test("a tag whose every line is too short for the fragment still falls back safely", () => {
		// No window fits `SELECT 1` (8 chars): identifier fill, parse outcome unchanged from today.
		const text = "select {{\n a()\n}} x from t";
		const r = parseTemplated(text, "databricks", {
			provider: new NamedShapeProvider({ a: "statement" }),
		});
		expect(r.sql.errors).toBe(0); // identifier fill reads as a column — never a regression
	});
});

describe("F5 finding 3 — templated LEFT OUTER JOIN regression pin", () => {
	const JOINS = `select ve.a
from gold__vendor ve
left outer join {{ ref('gold__project') }} pr
    on (ve.projectkey = pr.projectkey)
left outer join {{ ref('gold__chain') }} ca
    on (ve.chainkey = ca.chainkey and ca.gold_sourcesystemkey = 'd365')`;

	test("join kinds are left, sources reference-identical to the from entries", () => {
		const r = parseTemplated(JOINS, "databricks");
		expect(r.sql.errors).toBe(0);
		const body = r.sql.ast.body as {
			joins?: { kind: string; source: object }[];
			from: object[];
		};
		expect(body.joins?.map((j) => j.kind)).toEqual(["left", "left"]);
		for (const j of body.joins ?? []) expect(body.from).toContain(j.source);
	});

	test("a broken trailing tag does not smear the join chain", () => {
		const r = parseTemplated(`${JOINS}\n{{ generic_is_deleted('ve.is_deleted','where') }}`, "databricks");
		const body = r.sql.ast.body as { joins?: { kind: string }[] };
		expect(body.joins?.map((j) => j.kind)).toEqual(["left", "left"]);
	});
});
