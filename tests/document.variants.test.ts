import { describe, it, expect } from "vitest";
import { SqlDocument, Schema } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import { TestRelationProvider, relKey } from "./helpers/providers.js";

const A3 = "SELECT {% if v %}col_a{% else %}col_b{% endif %}, c FROM anchor_table";

describe("doc.variants — per-arm sub-documents", () => {
	it("plain and region-free templated docs answer []", () => {
		expect(SqlDocument.create("select 1", "duckdb").variants).toEqual([]);
		expect(
			SqlDocument.create("select * from {{ ref('t') }}", "duckdb", { templating: minijinja() }).variants,
		).toEqual([]);
	});
	// Development pin — the canonical acceptance version of this A3 assertion lives in
	// tests/variant-acceptance.test.ts's "A3 — coordinate preservation outside arms".
	it("each arm is a full document; coordinates are document-true (A3 anchor)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);
		for (const v of doc.variants) {
			expect(v.text().length).toBe(A3.length);
			const d = v.doc();
			expect(d.errors).toBe(0);
			const anchor = d.tokens.find((t) => t.text === "anchor_table")!;
			expect([anchor.start, anchor.stop + 1]).toEqual([57, 69]); // brief A3: byte-exact
		}
	});
	it("arm docs share the cache family across withText (unchanged arm = object-identical ast)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const armAst = doc.variants[1].doc().statements[0].ast;
		const next = doc.withText(A3, 2);
		expect(next.variants[1].doc().statements[0].ast).toBe(armAst);
	});
	it("variantAt routes offsets to the arm where the byte is live", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const inColA = A3.indexOf("col_a");
		const inColB = A3.indexOf("col_b");
		const inAnchor = A3.indexOf("anchor_table");
		expect(doc.variantAt(inColA)!.text()).toContain("col_a");
		expect(doc.variantAt(inColB)!.text()).toContain("col_b");
		expect(doc.variantAt(inAnchor)).toBe(doc.variants[0]); // outside every region → variant 0
		expect(doc.variantAt(-1)).toBe(doc.variants[0]); // honest default, never a throw
		expect(SqlDocument.create("select 1", "duckdb").variantAt(0)).toBeUndefined();
	});
	it("variantAt never routes an arm-0 (default) offset to a sibling synthetic-empty variant", () => {
		// Inner if is else-less and nested inside the outer region's arm 0. An offset in the
		// inner arm-0 body must route to variant 0 (where the default arm is live) — NOT to the
		// inner region's synthetic "region absent" variant, which blanks that very byte.
		const NESTED =
			"with data as (\n    SELECT base_col{% if outer %}, extra_col{% if inner %}, col_a{% endif %}{% else %}, col_c{% endif %} FROM raw_table\n)\nSELECT * FROM data";
		const doc = SqlDocument.create(NESTED, "duckdb", { templating: minijinja() });
		const inColA = NESTED.indexOf("col_a");
		expect(doc.variantAt(inColA)).toBe(doc.variants[0]);
		expect(doc.variants[0].text()).toContain("col_a");
	});
});

describe("union views — unionSymbols / unionDiagnostics / unionCtes / unionOutputColumns", () => {
	// Development pin — the canonical acceptance version of this A4 (and its A3 anchor re-check)
	// lives in tests/variant-acceptance.test.ts's "A3"/"A4" describes.
	it("unionSymbols carries arm-local symbols, deduped (A4)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const syms = doc.unionSymbols();
		const names = syms.map((s) => s.name);
		expect(names).toContain("col_a");
		expect(names).toContain("col_b");
		expect(names.filter((n) => n === "c").length).toBe(1);
		expect(names.filter((n) => n === "anchor_table").length).toBe(1);
		const anchor = syms.find((s) => s.name === "anchor_table")!;
		expect([anchor.span.start, anchor.span.end]).toEqual([57, 69]); // A3 anchor holds in the union
	});

	// Development pin — the canonical acceptance version of this A5 assertion lives in
	// tests/variant-acceptance.test.ts's "A5 — zero-width star-Sym expansion survives the union key".
	it("zero-width star-Sym expansion survives the union key (A5)", async () => {
		// Brief adjustment point, resolved: the plan's own filter (`.includes("star")` alone) also
		// matches the ALWAYS-emitted opaque `*` Sym (symbols.ts emitColumns pushes it unconditionally,
		// modifiers ["star"] with no "reference") — every existing precedent for isolating the
		// EXPANDED star columns (tests/symbols.test.ts) filters on BOTH "star" and "reference"; used
		// here too so the assertion actually targets the 3 expanded columns, not 4.
		const provider = new TestRelationProvider();
		const doc = SqlDocument.create("select * from {{ ref('t') }}", "duckdb", {
			templating: minijinja(),
			provider,
		});
		// Warm the provider exactly as tests/document.templated.test.ts's invalidation test does:
		// a cold `ref('t')` records a miss during the parse above, then prime() drains it.
		provider.pending.set(relKey("ref", ["t"]), { nameParts: ["t"] });
		provider.tableColumns.set("t", [{ name: "a" }, { name: "b" }, { name: "c" }]);
		expect(await provider.prime()).toBe(true);
		const cols = doc
			.unionSymbols(provider)
			.filter((s) => s.modifiers.includes("star") && s.modifiers.includes("reference"));
		expect(cols.map((s) => s.name).sort()).toEqual(["a", "b", "c"]); // span-only key would collapse to one
	});

	// Development pin — the canonical acceptance version of this A6 half (plus the brief's OTHER
	// half — same-position, both arms -> one entry) lives in tests/variant-acceptance.test.ts's
	// "A6 — diagnostics union: span+identity, not message text".
	it("diagnostics dedup by position+identity, not message (A6)", () => {
		const SQL = "{% if v %}select x.nope1 from t x{% else %}select  x.nope1 from t x{% endif %}";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const schema = new Schema({ t: { a: "int" } });
		const diags = doc
			.unionDiagnostics(schema)
			.filter((d) => String((d as { message?: string }).message ?? "").includes("nope1"));
		expect(diags.length).toBe(2); // same message, different offsets — the wart-fix regression pin
	});

	it("lexer errors (offset-undefined) at different positions stay two union entries", () => {
		// A LEXER "token recognition error" carries NO offending symbol, so its offset is undefined
		// (parse-diagnostics.ts; pinned by tests/parse-diagnostics.test.ts). An offset-keyed dedup
		// alone would collapse two same-character lexer errors from DIFFERENT arms at DIFFERENT
		// positions into one — the A6 message-only bug reintroduced for one diagnostic subclass.
		// tsql's lexer has no catch-all error rule, so ¤ provably takes this path (duckdb/postgres
		// recover with an offset-carrying "no viable alternative" instead — probed, not guessed).
		const SQL = "{% if v %}select ¤a from t{% else %}select  ¤a from t{% endif %}";
		const doc = SqlDocument.create(SQL, "tsql", { templating: minijinja() });
		const armDiags = doc.variants.map((v) =>
			v.doc().diagnostics.filter((d) => d.message.includes("token recognition")),
		);
		expect(armDiags.map((a) => a.length)).toEqual([1, 1]); // one per arm...
		expect(armDiags[0][0].offset).toBeUndefined(); // ...provably offset-undefined...
		expect(armDiags[0][0].column).not.toBe(armDiags[1][0].column); // ...at different positions
		const union = doc
			.unionDiagnostics()
			.filter((d) => String((d as { message?: string }).message ?? "").includes("token recognition"));
		expect(union.length).toBe(2); // line:column in the key keeps both
	});

	it("a no-variant doc's union views deep-equal the plain single-doc answers", () => {
		const plain = SqlDocument.create("select a, b from t", "duckdb");
		expect(plain.unionSymbols()).toEqual(plain.analyze().symbols);
		expect(plain.unionDiagnostics()).toEqual([...plain.diagnostics, ...plain.analyze().diagnostics]);

		const noRegion = SqlDocument.create("select * from {{ ref('t') }}", "duckdb", { templating: minijinja() });
		expect(noRegion.unionSymbols()).toEqual(noRegion.analyze().symbols);
	});

	// Development pin (smoke only) — the exact-line acceptance version lives in
	// tests/variant-acceptance.test.ts's "A8a — column union with shared-column dedup".
	it("unionCtes unions one CTE's columns across arms by name (A8a smoke)", () => {
		const SQL =
			"with data as (\n" +
			"    SELECT\n" +
			"        {% if is_incremental() %}incremental_col{% else %}full_col{% endif %},\n" +
			"        shared_col\n" +
			"    FROM raw_table\n" +
			")\n" +
			"SELECT * FROM data";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		const data = ctes[0];
		expect(data.name).toBe("data");
		const names = data.columns.map((c) => c.name);
		expect(names.filter((n) => n === "incremental_col").length).toBe(1);
		expect(names.filter((n) => n === "full_col").length).toBe(1);
		expect(names.filter((n) => n === "shared_col").length).toBe(1);
	});

	it("unionCtes/unionOutputColumns fall through to the single-arm answer with no variants", () => {
		const doc = SqlDocument.create("with data as (select a, b from t) select * from data", "duckdb");
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		expect(ctes[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
		expect(doc.unionOutputColumns().map((c) => c.name)).toEqual(["a", "b"]);

		// A region-free TEMPLATED doc (tags but no control flow) is also a no-variant doc — the
		// fall-through must hold through the templated door too, not just the plain one.
		const templated = SqlDocument.create(
			"with data as (select a, b from {{ ref('t') }}) select * from data",
			"duckdb",
			{ templating: minijinja() },
		);
		expect(templated.variants).toEqual([]);
		const tctes = templated.unionCtes();
		expect(tctes.length).toBe(1);
		expect(tctes[0].name).toBe("data");
		expect(tctes[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
		expect(templated.unionOutputColumns().map((c) => c.name)).toEqual(["a", "b"]);
	});

	it("a setop root answers output columns: names per SQL setop semantics, spans from the declaring branch", () => {
		// Positional UNION: output names are the LEFT branch's; the span is the left `a`'s own token.
		const SQL = "select a from t union all select b from u";
		const doc = SqlDocument.create(SQL, "duckdb");
		const cols = doc.unionOutputColumns();
		expect(cols.map((c) => c.name)).toEqual(["a"]);
		expect(cols[0].span.start).toBe(SQL.indexOf("a"));

		// The dbt incremental shape: the else arm's realization has a setop root — its outputs must
		// reach the union, not silently vanish (the visible-gap rule).
		const TPL =
			"{% if inc %}select a, c from t{% else %}select a, c from t union all select a, c from u{% endif %}";
		const tdoc = SqlDocument.create(TPL, "duckdb", { templating: minijinja() });
		const names = tdoc.unionOutputColumns().map((c) => c.name);
		expect(names.filter((n) => n === "a").length).toBe(1);
		expect(names.filter((n) => n === "c").length).toBe(1);
	});

	it("quoted setop projections survive on asymmetric-fold dialects (raw-name fold provenance)", () => {
		// snowflake folds an UNQUOTED name by upper-casing but PRESERVES a quoted one — so folding
		// the display form (delimiters stripped -> the unquoted rule fires: MYCOL) can never match
		// folding the raw form ("MyCol" kept -> the quoted rule fires: MyCol). Both sides of the
		// setop name<->span match must fold the RAW projection name; displayName's own contract says
		// never use it for comparison (src/ident/fold.ts).
		const SQL = 'select "MyCol" from t union all select "MyCol" from u';
		const cols = SqlDocument.create(SQL, "snowflake").unionOutputColumns();
		expect(cols.map((c) => c.name)).toEqual(["MyCol"]); // display form, not dropped
		expect(cols[0].span.start).toBe(SQL.indexOf('"MyCol"')); // the LEFT branch's own token
	});

	// Gap 1 (ledgered above unionCtes/unionOutputColumns): a multi-statement, no-variant document used
	// to answer [] here, since the compound facade's root carries no CTEs/projections. The real fix
	// merges each statement CELL's own answer, shifted to document coordinates (the same shift
	// `analyze()` already applies to symbols/diagnostics for a multi-cell document).
	describe("union views over a MULTI-STATEMENT document (no variants, the real per-cell merge)", () => {
		it("unionOutputColumns merges every statement's own output columns, shifted to doc coordinates", () => {
			const text = "SELECT amount AS a FROM sales;\nSELECT id AS b FROM sales";
			const doc = SqlDocument.create(text, "databricks");
			expect(doc.statements.length).toBe(2); // sanity: this is really the multi-cell path
			const cols = doc.unionOutputColumns();
			expect(cols.map((c) => c.name)).toEqual(["a", "b"]);
			const b = cols.find((c) => c.name === "b")!;
			expect(b.span.line).toBe(2); // statement 2 lives on doc line 2 (1-based), proves the shift
			expect(text.slice(b.span.start, b.span.end)).toBe("b");
		});

		it("unionCtes merges every statement's CTEs (+ their columns), shifted to doc coordinates", () => {
			const text = "SELECT 1;\nWITH data AS (SELECT a, b FROM t) SELECT * FROM data";
			const doc = SqlDocument.create(text, "databricks");
			expect(doc.statements.length).toBe(2);
			const ctes = doc.unionCtes();
			expect(ctes.length).toBe(1);
			expect(ctes[0].name).toBe("data");
			expect(ctes[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
			expect(ctes[0].declarationSpan.line).toBe(2); // statement 2 → doc line 2
			expect(text.slice(ctes[0].declarationSpan.start, ctes[0].declarationSpan.end)).toBe("data");
		});
	});

	// Gap 2 (ledgered on `scopeOutputColumns`): a PIPE-syntax root used to answer `[]` unconditionally.
	// The real fix derives output columns for the structurally derivable subset of pipe operators
	// (verified against the GoogleSQL pipe-syntax reference), abstaining (never guessing) elsewhere.
	describe("union views over a BigQuery PIPE-syntax root (the derivable subset)", () => {
		it("a terminal |> SELECT stage enumerates its own projections, with real spans", () => {
			const SQL = "FROM t |> SELECT a, b";
			const cols = SqlDocument.create(SQL, "bigquery").unionOutputColumns();
			expect(cols.map((c) => c.name)).toEqual(["a", "b"]);
			expect(cols[0].span.start).toBe(SQL.indexOf("a", SQL.indexOf("SELECT")));
		});

		it("a pass-through stage (WHERE) after a real base SELECT defers to the base's own columns", () => {
			const SQL = "SELECT a, b FROM t |> WHERE a > 1";
			const cols = SqlDocument.create(SQL, "bigquery").unionOutputColumns();
			expect(cols.map((c) => c.name)).toEqual(["a", "b"]);
			expect(cols[0].span.start).toBe(SQL.indexOf("a")); // the base SELECT's own token, not fabricated
		});

		it("a terminal |> AGGREGATE stage names the GROUP BY keys first, then the aggregates (GoogleSQL pipe-syntax reference order)", () => {
			const SQL = "SELECT a, b FROM t |> AGGREGATE COUNT(*) AS n GROUP BY a";
			const cols = SqlDocument.create(SQL, "bigquery").unionOutputColumns();
			expect(cols.map((c) => c.name)).toEqual(["a", "n"]);
			expect(cols[0].span.start).toBe(SQL.lastIndexOf("a")); // the GROUP BY key's own token
			expect(cols[1].span.start).toBe(SQL.indexOf("n"));
		});

		it("abstains (never guesses) on a pipe operator whose output shape isn't modelled here", () => {
			// EXTEND adds a column while keeping the incoming ones: a real shape, but not one this pass
			// enumerates spans for (see scopeOutputColumns' pipe doc comment); JOIN needs a catalog.
			expect(SqlDocument.create("SELECT a FROM t |> EXTEND a + 1 AS c", "bigquery").unionOutputColumns()).toEqual(
				[],
			);
			expect(
				SqlDocument.create("SELECT a FROM t |> JOIN u ON t.a = u.a", "bigquery").unionOutputColumns(),
			).toEqual([]);
		});
	});
});
