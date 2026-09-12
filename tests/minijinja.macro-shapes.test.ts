import { describe, expect, it } from "vitest";
import { parseTemplated, shapesForCall } from "../src/minijinja/index.js";
import type { MacroShape } from "../src/template/engine.js";
import { DbtTemplateProvider, type ExpansionShape, type TemplateCall } from "../src/qualify/template-provider.js";

// ---------------------------------------------------------------------------
// Macro shapes (issue #49, call side). A `{% macro %}` definition's body says what a
// call of it can stand in for: the fragment verdict mapped onto the provider's shape
// vocabulary, the keyword a leading `{{ param|default('where') }}` hole opens with,
// and `nothing` when the body's SQL all sits under an `if` with no `else`. Everything
// is read from the text: no project, no rendering. `shapesForCall` resolves the
// keyword hole per call from the call's own literal argument. A host's `shapeOf` is
// one lookup over its macro index; with a list answer the segmenter takes the first
// shape the slot admits.
// ---------------------------------------------------------------------------

const CI_LIMIT = `{% macro ci_limit_ten_days(date_field, statement) %}
    {% if target.name == 'ci' %}
        {{ statement|default('where') }} {{ date_field }} > dateadd(day, -10, cast(getdate() as date))
    {% endif %}
{% endmacro %}`;

const IS_DELETED = `-- Add is_deleted using a 'where' or 'and' clause
{% macro generic_is_deleted(column_name, stat) %}
    {{ stat }} {{ column_name }}=0
{% endmacro %}`;

function macrosOf(text: string): MacroShape[] {
	return parseTemplated(text, "tsql").macros;
}

describe("MacroShape: shapes read from the definition text", () => {
	it("an expression body → expr", () => {
		const [m] = macrosOf(`{% macro clean(c) %}trim({{ c }}){% endmacro %}`);
		expect(m.name).toBe("clean");
		expect(m.shapes).toEqual(["expr"]);
		expect(m.keywordParam).toBeUndefined();
	});

	it("statement / CTE list / select list / table source bodies map 1:1", () => {
		expect(macrosOf(`{% macro a() %}select 1 as x{% endmacro %}`)[0].shapes).toEqual(["statement"]);
		expect(macrosOf(`{% macro a() %}c1 as (select 1 as x),{% endmacro %}`)[0].shapes).toEqual(["cte-definition"]);
		expect(macrosOf(`{% macro a() %}x, y as yy{% endmacro %}`)[0].shapes).toEqual(["column-list"]);
	});

	it("a keyword hole with a default → the default's clause shape, plus nothing under an else-less if", () => {
		const [m] = macrosOf(CI_LIMIT);
		expect(m.shapes).toEqual(["where-clause", "nothing"]);
		expect(m.keywordParam).toEqual({ name: "statement", index: 1, default: "where" });
	});

	it("a keyword hole with no default → no shape, but the parameter binding is known", () => {
		const [m] = macrosOf(IS_DELETED);
		expect(m.shapes).toEqual([]);
		expect(m.keywordParam).toEqual({ name: "stat", index: 1 });
	});

	it("a return-only body → no shapes, no binding (never-wrong)", () => {
		const [m] = macrosOf(`{% macro cutoff() %}\n  -- the cutoff\n  {{ return('202601') }}\n{% endmacro %}`);
		expect(m.shapes).toEqual([]);
		expect(m.keywordParam).toBeUndefined();
	});

	it("a body with SQL outside the else-less if does not add nothing", () => {
		const [m] = macrosOf(`{% macro a(c) %}trim({{ c }}){% if x %} + 1{% endif %}{% endmacro %}`);
		expect(m.shapes).not.toContain("nothing");
	});

	it("a plain model has no macros; the degraded path has none either", () => {
		expect(parseTemplated(`select 1 from {{ ref('x') }}`, "tsql").macros).toEqual([]);
	});

	it("spans slice back to the source", () => {
		const text = CI_LIMIT;
		const [m] = macrosOf(text);
		expect(text.slice(m.nameSpan.start, m.nameSpan.end)).toBe("ci_limit_ten_days");
		expect(text.slice(m.span.start, m.span.end)).toBe(text);
	});
});

describe("shapesForCall: the keyword hole resolves per call", () => {
	const ci = macrosOf(CI_LIMIT)[0];
	const del = macrosOf(IS_DELETED)[0];
	const call = (
		name: string,
		args: (string | null)[],
		kwargs?: { name: string; value: string | null }[],
	): TemplateCall => ({
		name,
		args,
		...(kwargs ? { kwargs } : {}),
	});

	it("positional literal overrides the default", () => {
		expect(shapesForCall(ci, call("ci_limit_ten_days", ["d", "and"]))).toEqual(["conjunct", "nothing"]);
	});

	it("keyword argument overrides the default", () => {
		expect(shapesForCall(ci, call("ci_limit_ten_days", ["d"], [{ name: "statement", value: "or" }]))).toEqual([
			"conjunct",
			"nothing",
		]);
	});

	it("no argument → the default", () => {
		expect(shapesForCall(ci, call("ci_limit_ten_days", ["d"]))).toEqual(["where-clause", "nothing"]);
	});

	it("no default and no argument → nothing for the hole", () => {
		expect(shapesForCall(del, call("generic_is_deleted", ["x"]))).toEqual([]);
		expect(shapesForCall(del, call("generic_is_deleted", ["x", "where"]))).toEqual(["where-clause"]);
	});

	it("a computed (null) or unknown keyword resolves to nothing for the hole", () => {
		expect(shapesForCall(del, call("generic_is_deleted", ["x", null]))).toEqual([]);
		expect(shapesForCall(del, call("generic_is_deleted", ["x", "having"]))).toEqual([]);
	});

	it("a macro without a keyword hole returns its shapes unchanged", () => {
		const [m] = macrosOf(`{% macro clean(c) %}trim({{ c }}){% endmacro %}`);
		expect(shapesForCall(m, call("clean", ["x"]))).toEqual(["expr"]);
	});
});

describe("list-valued shapeOf: the first admitted shape fills the tag", () => {
	/** A host provider: one lookup over an index built from the definition files. */
	class IndexProvider extends DbtTemplateProvider {
		constructor(private readonly index: Map<string, MacroShape>) {
			super();
		}
		override shapeOf(call: TemplateCall): ExpansionShape | readonly ExpansionShape[] | undefined {
			const base = super.shapeOf(call);
			if (base !== undefined) return base;
			const m = this.index.get(call.name);
			if (!m) return undefined;
			const shapes = shapesForCall(m, call);
			return shapes.length > 0 ? shapes : undefined;
		}
	}
	const index = new Map<string, MacroShape>();
	for (const m of [...macrosOf(CI_LIMIT), ...macrosOf(IS_DELETED)]) index.set(m.name, m);
	const provider = new IndexProvider(index);

	it("the anvil model: a conjunct call after `where 1=1` parses clean", () => {
		const text = `with system_logs as (
    select * from {{ ref('x') }}
    where 1=1
    {{ ci_limit_ten_days('modified_datetime', 'and') }}
    {{ generic_is_deleted('is_deleted', 'and') }}
)
select * from system_logs`;
		expect(parseTemplated(text, "tsql").sql.diagnostics.length).toBeGreaterThan(0);
		const r = parseTemplated(text, "tsql", { provider });
		expect(r.sql.diagnostics).toEqual([]);
		expect(r.placeholder).toMatch(/AND 1=1/);
	});

	it("a where-clause call after FROM parses clean", () => {
		const text = `select * from t\n{{ generic_is_deleted('is_deleted', 'where') }}`;
		const r = parseTemplated(text, "tsql", { provider });
		expect(r.sql.diagnostics).toEqual([]);
		expect(r.placeholder).toMatch(/WHERE 1=1/);
	});

	it("a slot that refuses the clause falls through the list to nothing", () => {
		// At a statement slot neither AND nor WHERE is admitted; `nothing` blanks the tag and the
		// following statement parses.
		const text = `{{ ci_limit_ten_days('d', 'and') }}\nselect 1 as x`;
		const r = parseTemplated(text, "tsql", { provider });
		expect(r.sql.diagnostics).toEqual([]);
		expect(r.placeholder).not.toMatch(/1=1/);
	});

	it("a single-shape answer behaves as before (list of one)", () => {
		class One extends DbtTemplateProvider {
			override shapeOf(call: TemplateCall): ExpansionShape | readonly ExpansionShape[] | undefined {
				return call.name === "m" ? ["conjunct"] : super.shapeOf(call);
			}
		}
		const r = parseTemplated(`select * from t where a = 1 {{ m() }}`, "tsql", { provider: new One() });
		expect(r.sql.diagnostics).toEqual([]);
		expect(r.placeholder).toMatch(/AND 1=1/);
	});

	it("expansion() exposes the list as shapes with shape = the first", () => {
		const exp = provider.expansion({ name: "ci_limit_ten_days", args: ["d", "and"] });
		expect(exp?.shape).toBe("conjunct");
		expect(exp?.shapes).toEqual(["conjunct", "nothing"]);
		const one = provider.expansion({ name: "generic_is_deleted", args: ["x", "where"] });
		expect(one?.shape).toBe("where-clause");
		expect(one?.shapes).toBeUndefined();
	});
});
