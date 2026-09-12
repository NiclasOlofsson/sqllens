// Single-representative-iteration loop realization (anvil torture-corpus, 2026-07-06): the dbt
// union-arm idiom — a {% for %} loop emitting one SELECT per iteration with a loop.last-guarded
// separator — left a dangling `union all` in the primary realization (control tags blank, the
// guarded separator text stayed live). In jinja itself a 1-length loop has loop.first =
// loop.last = true, so the primary realization models ONE representative iteration: an {% if %}
// arm whose condition is a trivially-decidable loop-constant ("not loop.last" / "not loop.first")
// is statically DEAD and blanks; any condition the engine cannot decide structurally stays live
// (all-text-live, today's behavior). else/elif arms of a blanked if stay live (false → else runs).

import { describe, expect, test } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";

const UNION_LOOP = `{% for x in ['a','b'] %}
select 1 as n
{% if not loop.last %}
union all
{% endif %}
{% endfor %}
`;

describe("single-representative-iteration loop realization", () => {
	test("the loop.last-guarded separator blanks — no dangling UNION ALL (the anvil repro)", () => {
		const r = parseTemplated(UNION_LOOP, "databricks");
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).not.toMatch(/union/i);
	});

	test("length and newline offsets preserved through arm blanking", () => {
		const r = parseTemplated(UNION_LOOP, "databricks");
		expect(r.placeholder.length).toBe(UNION_LOOP.length);
		for (let i = 0; i < UNION_LOOP.length; i++) {
			if (UNION_LOOP[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});

	test("not loop.first blanks the same way", () => {
		const text = `{% for x in items %}
{% if not loop.first %}
union all
{% endif %}
select 2 as n
{% endfor %}
`;
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).not.toMatch(/union/i);
	});

	test("the else arm of a blanked if stays LIVE (false condition → else runs)", () => {
		const text = `{% for x in items %}
select 1 as n
{% if not loop.last %}
union all
{% else %}
order by n
{% endif %}
{% endfor %}
`;
		const r = parseTemplated(text, "databricks");
		expect(r.placeholder).not.toMatch(/union/i);
		expect(r.placeholder).toMatch(/order by n/);
		expect(r.sql.errors).toBe(0);
	});

	test("an undecidable condition stays live — all-text-live is untouched", () => {
		const text = `select 1 as n
{% if flag %}
, 2 as m
{% endif %}
from t`;
		const r = parseTemplated(text, "databricks");
		expect(r.placeholder).toMatch(/, 2 as m/);
	});

	test("a loop.first-TRUE arm stays live", () => {
		const text = `{% for x in items %}
{% if loop.first %}
select 1 as n
{% endif %}
{% endfor %}
`;
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toMatch(/select 1 as n/);
	});

	test("nested ifs inside a blanked arm blank with it (depth-safe pairing)", () => {
		const text = `{% for x in items %}
select 1 as n
{% if not loop.last %}
union all
{% if flag %}
union distinct
{% endif %}
{% endif %}
{% endfor %}
`;
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).not.toMatch(/union/i);
	});

	test("the blanked separator still rides the token stream as trivia under tsql's skipped whitespace", () => {
		// Databricks keeps a WS token over the blanked span and rewrites its text; T-SQL's WS rule is
		// `-> skip`, so nothing covered the span and `union all` fell out of the stream (12 Oatly
		// fabric models, 2026-09-12). Lossless: the stream must carry every byte of the source.
		const text = `{% for s in ['a','b'] %}select 1 as x from {{ s }}
{% if not loop.last %}union all{% endif %}
{% endfor %}`;
		for (const dialect of ["tsql", "databricks"] as const) {
			const r = parseTemplated(text, dialect);
			const carrier = r.tokens.find((t) => t.text === "union all");
			expect(carrier, dialect).toBeDefined();
			expect(carrier!.channel, dialect).toBe(1);
			expect(text.slice(carrier!.start, carrier!.stop + 1), dialect).toBe("union all");
			expect(r.placeholder).not.toMatch(/union/i);
		}
	});
});
