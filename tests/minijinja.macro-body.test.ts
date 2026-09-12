import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/dialect.js";
import { parseTemplated } from "../src/minijinja/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

// ---------------------------------------------------------------------------
// Macro bodies as fragments (issue #48). A `{% macro %}` body is whatever gets
// pasted at the call site: a statement, an expression, a FROM-slot source, a CTE
// list, a select list. The whole-file statement parse is the wrong reading for
// most of them, so a body that fails it is re-read as a fragment: no syntax
// diagnostic on a body that is a valid fragment, the region says which kind, and
// a body that is none of them keeps a positioned diagnostic inside the body.
// The issue's cases are from a dbt-fabric project (T-SQL), so tsql leads.
// ---------------------------------------------------------------------------

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

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/minijinja/", import.meta.url));

function syntax(text: string, dialect: Dialect = "tsql") {
	const r = parseTemplated(text, dialect);
	return { r, messages: r.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`) };
}

describe("macro bodies parse as fragments", () => {
	it("issue #48: a CASE expression body is clean and typed expression (tsql)", () => {
		const text = `{% macro bronze_string_cleaning(column_name) %}
    CASE WHEN TRIM({{ column_name }})='' THEN NULL
         WHEN TRIM({{ column_name }})='NULL' THEN NULL
    ELSE {{ column_name }} END
{% endmacro %}
`;
		const { r, messages } = syntax(text);
		expect(messages).toEqual([]);
		expect(r.sql.diagnostics).toEqual([]);
		expect(r.regions.map((x) => [x.kind, x.body])).toEqual([["macro", "expression"]]);
	});

	it("issue #48: a function-call expression body (concat)", () => {
		const { r, messages } = syntax(`{% macro clean_up(c) %}concat(trim({{ c }}), '-', 'x'){% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("expression");
	});

	it("issue #48: a parenthesised subquery body (cross apply operand)", () => {
		const { r, messages } = syntax(`{% macro extract_range(s) %}
(select value from string_split({{ s }}, ','))
{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBeDefined();
	});

	it("a CTE-list body pasted after WITH (get_groups_connected_rows)", () => {
		const text = `{% macro get_groups_connected_rows() %}
    {#
        Finds all connected rows for a group row.
    #}
    {%- set fixed_number_of_joins = 6 -%}

    row_groups as (
        select
            *
            from udd_pnl_structure where RowType = 'group'
    ),
    row_groups_members as (
        select * from udd_pnl_structure where RowType = 'member'
    )
{% endmacro %}`;
		const { r, messages } = syntax(text);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("cteList");
	});

	it("a select-list body", () => {
		const { r, messages } = syntax(`{% macro cols() %}a, b as bb, c * 2{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("selectList");
	});

	it("a statement body is read as before and typed statement", () => {
		const { r, messages } = syntax(`{% macro q() %}select 1 as x from t{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("statement");
	});

	it("two macros, expression then statement: each body verdicts on its own", () => {
		const text = `{% macro a() %}CASE WHEN x = 1 THEN 1 END{% endmacro %}\n{% macro b() %}select 1{% endmacro %}`;
		const { r, messages } = syntax(text);
		expect(messages).toEqual([]);
		expect(r.regions.map((x) => x.body)).toEqual(["expression", "statement"]);
	});

	it("a macro guarded by an if region is still read as a fragment", () => {
		const text = `{% if target.name == 'prod' %}{% macro a(c) %}trim({{ c }}){% endmacro %}{% endif %}`;
		const { r, messages } = syntax(text);
		expect(messages).toEqual([]);
		const inner = r.regions[0].arms[0].children[0];
		expect(inner.kind).toBe("macro");
		expect(inner.body).toBe("expression");
	});

	it("a body that reads as nothing carries no verdict and no syntax claim", () => {
		// A clause tail led by a keyword hole has no reading and never will; "matches no known
		// shape" is not evidence of invalid SQL (never-wrong), so no diagnostic.
		const text = `{% macro ci_limit(date_field, statement) %}
    {% if target.name == 'ci' %}
        {{ statement|default('where') }} {{ date_field }} > dateadd(day, -10, cast(getdate() as date))
    {% endif %}
{% endmacro %}`;
		const { r, messages } = syntax(text);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBeUndefined();
	});

	it("a mid-edit body (CASE WHEN a = 1 THEN) also carries no claim", () => {
		const { r, messages } = syntax(`{% macro q() %}CASE WHEN a = 1 THEN{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBeUndefined();
	});

	it("no placeholder fill ever reaches a diagnostic message, even inside a quoted token range", () => {
		// The model side of the same macro: "no viable alternative at input '…'" quotes a token
		// RANGE that spans two fills; both must read as their tags.
		const text = `with system_logs as (select * from {{ ref('x') }} where 1=1 {{ ci_limit('d', 'and') }} ) select * from system_logs`;
		const { r } = syntax(text);
		expect(r.diagnostics.length).toBeGreaterThan(0);
		for (const d of r.diagnostics) {
			expect(/j[0-9a-ik-z]{0,2}j{3,}/.test(d.message), d.message).toBe(false);
			expect(d.message).toContain("{{ ci_limit('d', 'and') }}");
		}
	});

	it("a CTE-list body may end with a trailing comma (the caller appends more CTEs)", () => {
		const { r, messages } = syntax(`{% macro ctes() %}a as (select 1 as x),
 b as (select x from a),
{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("cteList");
	});

	it("an unclosed macro (mid-edit) reads its body to the end of the text", () => {
		const { r, messages } = syntax(`{% macro a(c) %}trim({{ c }})`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBe("expression");
	});

	it("an empty body carries no verdict and no diagnostic", () => {
		const { r, messages } = syntax(`{% macro a() %}\n{% endmacro %}`);
		expect(messages).toEqual([]);
		expect(r.regions[0].body).toBeUndefined();
	});

	it("a model file (no macro) is untouched: a real statement error still reports", () => {
		const { r, messages } = syntax(`select from where {{ ref('x') }}`);
		expect(messages.length).toBeGreaterThan(0);
		expect(r.regions).toEqual([]);
	});

	it("the in-repo macro fixture parses clean on databricks", () => {
		const text = readFileSync(FIXTURES_DIR + "20_set_and_macro_block.sql", "utf8");
		const { r, messages } = syntax(text, "databricks");
		expect(messages).toEqual([]);
		expect(r.regions.find((x) => x.kind === "macro")?.body).toBe("expression");
	});

	it("a select-slot macro call is a hole, never a column reference symbol (contract-break leak)", () => {
		const text = readFileSync(FIXTURES_DIR + "21_select_slot_macros.sql", "utf8");
		const { r } = syntax(text);
		const symbols = deriveSymbols(resolveScopes(r.sql.ast, "tsql"));
		const refs = symbols.filter((s) => s.kind === "column" && s.modifiers.includes("reference")).map((s) => s.name);
		expect(refs.some((n) => /^j[0-9a-ik-z]{0,2}j*$/.test(n))).toBe(false);
		expect(refs).toContain("sf.quantity");
		// The holes are still reachable, through the tags.
		expect(r.tags.filter((t) => t.kind === "call" && t.name.startsWith("bronze_")).length).toBe(3);
	});

	it("an expression body is clean on every dialect", () => {
		const text = `{% macro pick(c) %}CASE WHEN {{ c }} = 1 THEN 'a' ELSE 'b' END{% endmacro %}`;
		for (const dialect of ALL_DIALECTS) {
			const { r, messages } = syntax(text, dialect);
			expect(messages, dialect).toEqual([]);
			expect(r.regions[0].body, dialect).toBe("expression");
		}
	});

	it("a CTE-list body is clean on every dialect", () => {
		const text = `{% macro ctes() %}a as (select 1 as x), b as (select x from a){% endmacro %}`;
		for (const dialect of ALL_DIALECTS) {
			const { r, messages } = syntax(text, dialect);
			expect(messages, dialect).toEqual([]);
			expect(r.regions[0].body, dialect).toBe("cteList");
		}
	});
});
