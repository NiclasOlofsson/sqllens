import { describe, it, expect } from "vitest";
import { SqlDocument, Schema, statementSpans, type StatementCategory } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import { TestRelationProvider, dbt, relKey } from "./helpers/providers.js";

const MODEL = "select o.total from {{ ref('orders') }} o where o.total > {{ var('min') }}";

describe("SqlDocument + templating engine (the unified door)", () => {
	it("plain document: no templating option → templated is undefined, everything as before", () => {
		const doc = SqlDocument.create("select 1", "databricks");
		expect(doc.templated).toBeUndefined();
	});
	it("templated document: ref binds, facets ride, coordinates are document-true", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		expect(doc.templated).toBeDefined();
		expect(doc.templated!.tags.some((t) => t.kind === "call" && t.name === "ref")).toBe(true);
		// the marker-carrying IR reached scopes: the source is aliased `o` — that's the sources key.
		expect([...doc.scopes.root.sources.keys()]).toContain("o");
		// tokens: one merged stream, channel-2 jinja present, spans slice the source
		const jinja = doc.tokens.filter((t) => t.channel === 2);
		expect(jinja.length).toBeGreaterThan(0);
		for (const t of jinja) expect(MODEL.slice(t.start, t.stop + 1)).toBe(t.text);
		// two-spine join works through the door
		const body = doc.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const fromTag = doc.templated!.tagOf(body.from[0]);
		expect(fromTag?.kind === "call" && fromTag.name).toBe("ref");
	});
	it("engine + tag-free text degenerates: facets empty, parse identical to plain door", () => {
		const plain = SqlDocument.create("select a from t", "databricks");
		const doored = SqlDocument.create("select a from t", "databricks", { templating: minijinja() });
		expect(doored.templated!.tags).toEqual([]);
		expect(doored.tokens.map((t) => [t.start, t.stop, t.text])).toEqual(
			plain.tokens.map((t) => [t.start, t.stop, t.text]),
		);
		expect(doored.errors).toBe(plain.errors);
	});
	it("analyze() runs over a templated document (schema-fed types on a templated source's column)", () => {
		const schema = new Schema({ orders: { total: "decimal" } });
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const a = doc.analyze(schema);
		expect(a.symbols.length).toBeGreaterThan(0);
		expect(a.diagnostics).toEqual([]); // templated source resolvable → no false unknowns
	});
	it("withText carries the engine: the child re-parses templated", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const next = doc.withText(MODEL + " ", 2);
		expect(next.templated).toBeDefined();
		expect(next.templated!.tags.length).toBe(doc.templated!.tags.length);
	});
	it("unchanged text reuses the cached templated cell across withText", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const next = doc.withText(MODEL, 2);
		expect(next.statements[0].ast).toBe(doc.statements[0].ast); // object identity = cache hit
	});
	it("a provider version bump invalidates the cached templated parse", async () => {
		// TestRelationProvider (tests/helpers/providers.ts) is a DefaultTemplateProvider subclass
		// driven exactly like a host: relationOf records a miss on a cold ref('orders'), and
		// prime() drains it through fetchExpansions and bumps `version` — the real invalidation
		// path (mirrors how an editor drives schema.prime() on each publish), not a poke at
		// the counter.
		const provider = new TestRelationProvider();
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja(), provider });
		expect(provider.misses.length).toBe(1); // the ref('orders') tag missed during that parse
		provider.pending.set(relKey("ref", ["orders"]), { nameParts: ["orders"] });
		expect(await provider.prime()).toBe(true); // real bump
		const next = doc.withText(MODEL, 2);
		expect(next.statements[0].ast).not.toBe(doc.statements[0].ast); // stale entry missed
	});
});

describe("templated door: statement cells (anvil ask 2026-09-13, sqllens owns the split)", () => {
	const TSQL_BATCH = `{% if execute %}
  {%- call statement('rename') -%}
begin try
  EXEC sp_rename '{{ target_relation.schema }}.{{ tmp_table.identifier }}', '{{ x }}';
  commit transaction;
end try
begin catch
  if @@trancount > 0 rollback transaction;
  throw;
end catch
  {%- endcall %}
{% endif %}`;
	const TWO = "select a from {{ ref('m1') }};\nselect b from {{ ref('m2') }};";

	it("a T-SQL BEGIN TRY batch inside {% call %} inside {% if %} is ONE cell: inner semicolons never cut", () => {
		const doc = SqlDocument.create(TSQL_BATCH, "tsql", { templating: minijinja() });
		expect(doc.statements.length).toBe(1);
		expect(doc.errors).toBe(0);
	});
	it("GO alone on a line still cuts a templated T-SQL document", () => {
		const doc = SqlDocument.create("select 1 as a\nGO\nselect {{ var('n') }} as b\n", "tsql", {
			templating: minijinja(),
		});
		expect(doc.statements.length).toBe(2);
		expect(doc.statements.map((c) => c.category)).toEqual(["query", "query"]);
	});
	it("two templated statements: two cells, each source resolved (never the fill), tags round-trip", () => {
		const doc = SqlDocument.create(TWO, "databricks", { templating: minijinja(), ...dbt() });
		expect(doc.statements.length).toBe(2);
		expect(doc.statements.map((c) => c.category)).toEqual(["query", "query"]);
		expect(doc.ast.statement).toBe("compound");
		const [c1, c2] = doc.statements;
		expect([...c1.scopes.root.sources.keys()]).toEqual(["m1"]);
		expect([...c2.scopes.root.sources.keys()]).toEqual(["m2"]);
		const body = c2.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const src = body.from[0];
		if (src.kind !== "table") throw new Error("expected table source");
		// the two-spine join answers from the CELL's IR, with the whole document's own tag
		const tag = doc.templated!.tagOf(src);
		expect(tag?.kind === "call" && tag.name).toBe("ref");
		expect(doc.templated!.nodeOf(tag!)).toBe(src);
		// the marker's span is cell-relative like every other span in the cell IR
		expect(src.template?.span.start).toBe(TWO.indexOf("{{ ref('m2')") - c2.span.start);
		expect(src.template?.span.line).toBe(2); // the cell opens with the newline that ended statement one
		// and the tag itself stays in document coordinates
		expect(tag?.tagSpan.start).toBe(TWO.indexOf("{{ ref('m2')"));
	});
	it("cell tokens are the unified SQL+jinja stream sliced; concatenated they ARE the document stream", () => {
		const doc = SqlDocument.create(TWO, "databricks", { templating: minijinja() });
		const whole = minijinja().parse(TWO, "databricks");
		const key = (t: { start: number; stop: number; text: string; channel: number }) => [
			t.start,
			t.stop,
			t.text,
			t.channel,
		];
		expect(doc.tokens.map(key)).toEqual(whole.tokens.map(key));
		expect(doc.statements[1].tokens.some((t) => t.channel === 2)).toBe(true);
		for (const c of doc.statements) for (const t of c.tokens) expect(t.start).toBeGreaterThanOrEqual(c.span.start);
	});
	it("diagnostics partition by cell and sum to the document's scrubbed set", () => {
		const text = "select a from {{ ref('m1') }};\nselect b from {{ ref('m2') }} where (;";
		const doc = SqlDocument.create(text, "databricks", { templating: minijinja() });
		const whole = minijinja().parse(text, "databricks");
		expect(doc.statements.length).toBe(2);
		expect(doc.statements[0].errors).toBe(0);
		expect(doc.statements[1].errors).toBeGreaterThan(0);
		expect(doc.errors).toBe(whole.diagnostics.length);
		expect(doc.diagnostics).toEqual(whole.diagnostics);
		for (const d of doc.diagnostics) expect(d.message).not.toMatch(/j{4,}/); // scrubbed, never the fill
	});
	it("a single-statement model keeps the whole-text cell: byte-identical products", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		expect(doc.statements.length).toBe(1);
		expect(doc.statements[0].ast).toBe(doc.templated!.sql.ast);
		expect(doc.ast).toBe(doc.templated!.sql.ast);
	});
	it("editing statement two keeps statement one's cell across withText (content-addressed reuse)", () => {
		const doc = SqlDocument.create(TWO, "databricks", { templating: minijinja() });
		const next = doc.withText(TWO.replace("select b", "select bb"), 2);
		expect(next.statements.length).toBe(2);
		expect(next.statements[0].ast).toBe(doc.statements[0].ast);
		expect(next.statements[1].ast).not.toBe(doc.statements[1].ast);
		// the reused cell's tag join answers with the NEW parse's TagNodes, not the ones it was built under
		const body = next.statements[0].ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const tag = next.templated!.tags[0];
		expect(next.templated!.tagOf(body.from[0])).toBe(tag);
		expect(next.templated!.nodeOf(tag)).toBe(body.from[0]);
		expect(doc.templated!.tags[0]).not.toBe(tag); // the parses really do hold distinct tag objects
	});
	it("a cell reused at a new position keeps its join right: tags resolve by cell-relative offset", () => {
		// statement two's slice is unchanged when text is inserted INSIDE statement one, so its cell
		// is a cache hit under a document where every tag object and offset after the edit is new
		const doc = SqlDocument.create(TWO, "databricks", { templating: minijinja() });
		const next = doc.withText(TWO.replace("select a", "select aa"), 2);
		expect(next.statements[1].ast).toBe(doc.statements[1].ast);
		const body = next.statements[1].ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const tag = next.templated!.tags[1];
		expect(tag.tagSpan.start).toBe(next.text.indexOf("{{ ref('m2')"));
		expect(next.templated!.tagOf(body.from[0])).toBe(tag);
		expect(next.templated!.nodeOf(tag)).toBe(body.from[0]);
	});
	it("a {% set %} edited elsewhere misses every cell it could rebind", () => {
		const text = "{% set t = ref('m1') %}\nselect a from {{ t }};\nselect b from {{ t }};";
		const doc = SqlDocument.create(text, "databricks", { templating: minijinja(), ...dbt() });
		expect(doc.statements.length).toBe(2);
		expect([...doc.statements[1].scopes.root.sources.keys()]).toEqual(["m1"]);
		const next = doc.withText(text.replace("ref('m1')", "ref('m9')"), 2);
		expect(next.statements[1].ast).not.toBe(doc.statements[1].ast);
		expect([...next.statements[1].scopes.root.sources.keys()]).toEqual(["m9"]);
	});
	it("variants first: a multi-cell arm contributes its own cells to the union views", () => {
		const text =
			"{% if x %}select a from {{ ref('m1') }};{% else %}select a from {{ ref('m3') }};{% endif %}\nselect b from {{ ref('m2') }};";
		const doc = SqlDocument.create(text, "databricks", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);
		for (const v of doc.variants) expect(v.doc().statements.length).toBe(2);
		expect(doc.unionOutputColumns().map((c) => c.name)).toEqual(["a", "b"]);
	});
	it("a BEGIN in every arm of an if/else: the all-arms-live document over-cuts, each balanced arm cuts right", () => {
		const text = "{% if x %}begin{% else %}begin{% endif %}\nselect 1;\nend;\nselect 2;";
		const doc = SqlDocument.create(text, "tsql", { templating: minijinja() });
		// two BEGINs, one END: the placeholder ends inside an open level, so every separator from the
		// first BEGIN on cuts (an over-cut block beats one cell spanning `select 2`)
		expect(doc.statements.map((c) => c.text.trim())).toEqual([
			"{% if x %}begin{% else %}begin{% endif %}\nselect 1;",
			"end;",
			"select 2;",
		]);
		expect(doc.variants.length).toBe(2);
		for (const v of doc.variants) {
			const arm = v.doc(); // one BEGIN live, one END: the block closes, `select 2` is its own cell
			expect(arm.statements.length).toBe(2);
			expect(arm.statements[0].text).toMatch(/begin[\s\S]*select 1;\s*end;$/);
			expect(arm.statements[1].text.trim()).toBe("select 2;");
		}
	});
	it("a terminated single statement plus trailing trivia is ONE cell on both doors", () => {
		const probes: [string, number, StatementCategory][] = [
			["select 1 as a", 1, "query"],
			["select 1 as a;", 1, "query"],
			["select 1 as a;\n", 1, "query"],
			["select 1 as a;\n\n\n", 1, "query"],
			["select 1 as a;\nselect 2 as b;\n", 2, "compound"],
		];
		const opts = { templating: minijinja(), ...dbt() };
		for (const [text, cells, statement] of probes) {
			const plain = SqlDocument.create(text, "duckdb");
			const templated = SqlDocument.create(text, "duckdb", opts);
			expect([plain.statements.length, plain.ast.statement]).toEqual([cells, statement]);
			expect([templated.statements.length, templated.ast.statement]).toEqual([cells, statement]);
			for (const c of [...plain.statements, ...templated.statements]) expect(c.category).not.toBe("other");
		}
	});
	it("jinja arms that leave the placeholder with an unclosed level still split after the opener", () => {
		const text =
			"{% if x %}select case when a = 1 then 'x' {% else %}select case when a = 2 then 'y' {% endif %}\nend as x from t;\nselect 2;";
		const doc = SqlDocument.create(text, "tsql", { templating: minijinja() });
		expect(doc.statements.length).toBe(2); // two CASEs, one END on the all-arms-live placeholder
		expect(doc.statements[1].text.trim()).toBe("select 2;");
		for (const v of doc.variants) expect(v.doc().statements.length).toBe(2); // each arm is balanced
	});
	it("statementSpans answers the spans the document's cells carry, plain and templated", () => {
		const opts = { templating: minijinja(), ...dbt() };
		for (const text of [TWO, TSQL_BATCH, "select 1 as a;\n", "select 1\nGO\nselect {{ var('n') }}"]) {
			const dialect = text.includes("GO") || text.includes("begin try") ? "tsql" : "databricks";
			expect(statementSpans(text, dialect, opts)).toEqual(
				SqlDocument.create(text, dialect, opts).statements.map((c) => c.span),
			);
			expect(statementSpans(text, dialect)).toEqual(
				SqlDocument.create(text, dialect).statements.map((c) => c.span),
			);
		}
		// a single-statement templated document's cell carries its separator like any other
		const one = SqlDocument.create("select 1 as a;\n", "databricks", opts);
		expect(one.statements[0].span.separator).toEqual({ start: 13, end: 14 });
		// an engine without the placeholder hook falls back to its parse; without parseCell it is one span
		const noHook = { name: "nohook", parse: minijinja().parse, parseCell: minijinja().parseCell };
		expect(statementSpans(TWO, "databricks", { templating: noHook })).toEqual(
			statementSpans(TWO, "databricks", opts),
		);
		const bare = { name: "bare", parse: minijinja().parse };
		expect(statementSpans(TWO, "databricks", { templating: bare })).toEqual([{ start: 0, end: TWO.length }]);
	});
	it("an engine without parseCell keeps the templated door at one whole-text cell", () => {
		const bare = { name: "bare", parse: minijinja().parse };
		const doc = SqlDocument.create(TWO, "databricks", { templating: bare });
		expect(doc.statements.length).toBe(1);
	});
});
