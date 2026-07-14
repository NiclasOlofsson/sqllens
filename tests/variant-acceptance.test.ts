import { describe, it, expect } from "vitest";
import { SqlDocument, Schema, type TableSource } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import type { TagNode } from "../src/minijinja/index.js";
import type { PartSpan } from "../src/ir/part-span.js";
import { TestRelationProvider, relKey } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// The variant-acceptance suite — anvil's brief made permanent, binding tests.
//
// Source of truth: C:/Development/vault/comms/channels/variant-acceptance-brief.md
// (channel sqllens-anvil, item "variant-aware document", delivered 2026-07-10 16:31).
// Every fixture below is lifted VERBATIM from that brief (sections A1-A9) — byte
// for byte, because the brief's own byte positions (A3's [57,69), A8's brief-
// numbered lines) are part of the contract, not incidental to it.
//
// THIS FILE IS THE ACCEPTANCE CONTRACT for Stage 5 (the variant-aware document
// wave, .claude/plans/2026-07-10-stage5-variant-aware-document.md): the wave is
// accepted when every section below (A1-A8; A9 is a documented limit, no test)
// holds against the shipped surface — templateVariants (+ the synthetic
// empty-else arm), doc.variants, doc.variantAt, and the four union views
// (unionSymbols/unionDiagnostics/unionCtes/unionOutputColumns). The per-task
// test files (tests/document.variants.test.ts, tests/minijinja.variants.test.ts)
// are DEVELOPMENT PINS written task-by-task as each piece landed; where an
// assertion here duplicates one there, BOTH stay — this file is the canonical
// acceptance version, the task file is the pin that caught regressions while
// that task was in flight. Cross-pointer comments are left at each duplicated
// assertion, in both directions.
//
// COORDINATE HONESTY: the brief's own convention is 0-based lines/columns
// (offsets are already 0-based UTF-16 code units in BOTH worlds, so offsets need
// no conversion — only LINE differs). The repo's spans are 1-based lines /
// 0-based columns (the PartSpan/Span convention throughout sqllens). Every
// line-numbered assertion below converts explicitly via `briefLine()`, so it
// reads in the BRIEF's own numbers, never the repo's raw `.line`.
//
// DIALECT CHOICES (stated once per fixture group, not re-justified per test):
//   - A1/A2/A8: databricks — these are dbt-shaped fixtures (is_incremental(),
//     ref()), and databricks is this repo's dbt dialect.
//   - A3-A6: duckdb — matches tests/document.variants.test.ts, whose per-task
//     pins for these EXACT fixtures already used duckdb; keeping the dialect
//     identical means a duckdb-specific regression shows up in both files
//     identically, not as a spurious cross-file divergence.
//   - A7: databricks — the fixture uses is_incremental() (dbt-shaped, like
//     A1/A2/A8) and is not one of the duckdb fixtures reused from A3-A6.
// ---------------------------------------------------------------------------

/** repo `span.line` (1-based) -> the brief's own 0-based line number. Offsets/columns need no
 *  conversion (both conventions are already 0-based); only LINE differs. Named per the task brief
 *  so every line assertion below reads in the BRIEF's own numbers, not the repo's raw `.line`. */
function briefLine(span: { line: number }): number {
	return span.line - 1;
}

/** The dbt-ref view (model + its span) of every `ref('…')` call tag — the neutral call node read
 *  through dbt's arg role (ref's model is the last arg), the same lens a consumer applies. */
function refTags(tags: readonly TagNode[]): { node: TagNode; model: string; modelSpan: PartSpan }[] {
	const out: { node: TagNode; model: string; modelSpan: PartSpan }[] = [];
	for (const t of tags) {
		if (t.kind !== "call" || t.name !== "ref") continue;
		const model = t.args[t.args.length - 1];
		if (model?.value != null && model.valueSpan)
			out.push({ node: t, model: model.value, modelSpan: model.valueSpan });
	}
	return out;
}

describe("A1 — primary tag completeness (kills the tag-level union)", () => {
	const SQL =
		"with src as (\n" +
		"    select * from {% if is_incremental() %}{{ ref('orders_inc') }}{% else %}{{ ref('orders_full') }}{% endif %}\n" +
		")\n" +
		"select * from src";

	it("tags carries BOTH refs — orders_inc AND orders_full — with raw-source spans, both on brief-line 1", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		expect(doc.templated).toBeDefined();
		const refs = refTags(doc.templated!.tags);
		expect(refs.map((t) => t.model).sort()).toEqual(["orders_full", "orders_inc"]);
		for (const tag of refs) {
			// raw-source span: slicing the ORIGINAL text at modelSpan reproduces the model name exactly.
			expect(SQL.slice(tag.modelSpan.start, tag.modelSpan.end)).toBe(tag.model);
			expect(briefLine(tag.modelSpan)).toBe(1);
		}
	});
});

describe("A2 — conflicting arms: primary is best-effort, arm-local joins are guaranteed", () => {
	// Anvil's own probe case (the brief names it as such — no verbatim fixture given).
	const SQL = "{% if x %}select a from {{ ref('t_if') }}{% else %}select b from {{ ref('t_else') }}{% endif %}";

	it("the primary parse is error-tolerant: never throws, though the concatenated arms don't parse cleanly", () => {
		expect(() => SqlDocument.create(SQL, "databricks", { templating: minijinja() })).not.toThrow();
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		// Both arms' SQL is live simultaneously on the primary (all-text-live) parse — two SELECTs
		// with no separator between them is not valid SQL, so the primary is best-effort by
		// construction; this is exactly why the variant/union surface exists.
		expect(doc.errors).toBeGreaterThan(0);
	});

	it("tags stay complete on the primary parse regardless (A1's guarantee, restated for conflicting arms)", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		const refs = refTags(doc.templated!.tags);
		expect(refs.map((t) => t.model).sort()).toEqual(["t_else", "t_if"]);
	});

	it("EACH arm's own realization has a guaranteed nodeOf join, and the marker carries the call", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		expect(doc.variants.length).toBe(2); // if/else, both arms real (no synthetic — this if HAS an else)
		// Arm order: variant 0 = if (arm 0, t_if); variant 1 = else (arm 1, t_else).
		const expectedModel = ["t_if", "t_else"];
		doc.variants.forEach((v, i) => {
			const armDoc = v.doc();
			const liveRefs = refTags(armDoc.templated!.tags);
			// The OTHER arm's ref tag is blanked away in THIS realization — exactly one ref tag is live.
			expect(liveRefs.length).toBe(1);
			expect(liveRefs[0].model).toBe(expectedModel[i]);
			const node = armDoc.templated!.nodeOf(liveRefs[0].node) as TableSource | undefined;
			expect(node).toBeDefined(); // guaranteed nodeOf join to a live IR source node
			expect(node!.template?.kind).toBe("call");
			expect(node!.template?.call?.name).toBe("ref"); // the marker carries the call
			expect(node!.template?.call?.args).toEqual([expectedModel[i]]);
		});
	});
});

describe("A3 — coordinate preservation outside arms", () => {
	// Byte-for-byte the fixture tests/document.variants.test.ts's `A3` constant already pins.
	const SQL = "SELECT {% if v %}col_a{% else %}col_b{% endif %}, c FROM anchor_table";

	// Development pin: tests/document.variants.test.ts "each arm is a full document; coordinates are
	// document-true (A3 anchor)" — canonical restatement here; pointer back added there.
	it("anchor_table occupies [57,69) in EVERY realization's tokens", () => {
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);
		for (const v of doc.variants) {
			const anchors = v.doc().tokens.filter((t) => t.text === "anchor_table");
			expect(anchors.length).toBe(1); // exactly ONE
			expect([anchors[0].start, anchors[0].stop + 1]).toEqual([57, 69]);
		}
	});

	// Development pin: tests/document.variants.test.ts "unionSymbols carries arm-local symbols,
	// deduped (A4)" carries the identical anchor assertion — canonical restatement here.
	it("anchor_table occupies [57,69) exactly once in the union view too", () => {
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const anchors = doc.unionSymbols().filter((s) => s.name === "anchor_table");
		expect(anchors.length).toBe(1);
		expect([anchors[0].span.start, anchors[0].span.end]).toEqual([57, 69]);
	});
});

describe("A4 — union view carries arm-local symbols, deduped by span+identity+name", () => {
	// Same fixture as A3.
	// Development pin: tests/document.variants.test.ts "unionSymbols carries arm-local symbols,
	// deduped (A4)" — canonical restatement here; pointer back added there.
	const SQL = "SELECT {% if v %}col_a{% else %}col_b{% endif %}, c FROM anchor_table";

	it("unionSymbols contains BOTH col_a and col_b, plus exactly one c and one anchor_table", () => {
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const names = doc.unionSymbols().map((s) => s.name);
		expect(names).toContain("col_a");
		expect(names).toContain("col_b");
		expect(names.filter((n) => n === "c").length).toBe(1);
		expect(names.filter((n) => n === "anchor_table").length).toBe(1);
	});

	it("unionSymbols is EXACTLY those four — nothing from a blanked arm leaks as whitespace-derived junk", () => {
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const syms = doc.unionSymbols();
		// The fixture's only identifiers, and no others: col_a (if-arm), col_b (else-arm), c,
		// anchor_table. Pinning the total closes the gap the two presence/exactly-once checks above
		// leave open — those pass even if a fifth, unaccounted-for symbol were present.
		expect(syms.length).toBe(4);
		for (const s of syms) {
			// No blanked-arm whitespace/junk symbol: every name is non-blank and traces back to an
			// actual identifier the fixture text contains (not a synthesized or trimmed artifact).
			expect(s.name.trim().length).toBeGreaterThan(0);
			expect(SQL.includes(s.name)).toBe(true);
		}
	});
});

describe("A5 — zero-width star-Sym expansion survives the union key", () => {
	// Development pin: tests/document.variants.test.ts "zero-width star-Sym expansion survives the
	// union key (A5)" — canonical restatement here; pointer back added there.
	it("with t resolving to (a,b,c), the union keeps all three despite sharing one zero-width span", async () => {
		const provider = new TestRelationProvider();
		const doc = SqlDocument.create("select * from {{ ref('t') }}", "duckdb", {
			templating: minijinja(),
			provider,
		});
		// Warm the provider exactly as tests/document.templated.test.ts's invalidation test does: a
		// cold `ref('t')` records a miss during the parse above, then prime() drains it.
		provider.pending.set(relKey("ref", ["t"]), { nameParts: ["t"] });
		provider.tableColumns.set("t", [{ name: "a" }, { name: "b" }, { name: "c" }]);
		expect(await provider.prime()).toBe(true);
		// Every existing precedent for isolating the EXPANDED star columns filters on BOTH "star" and
		// "reference" (the opaque `*` Sym itself carries only "star", no "reference" — see
		// tests/symbols.test.ts) — used here too so the assertion targets the 3 expanded columns.
		const cols = doc
			.unionSymbols(provider)
			.filter((s) => s.modifiers.includes("star") && s.modifiers.includes("reference"));
		expect(cols.map((s) => s.name).sort()).toEqual(["a", "b", "c"]); // span-only key would collapse to one
	});
});

describe("A6 — diagnostics union: span+identity, not message text", () => {
	// Development pin: tests/document.variants.test.ts "diagnostics dedup by position+identity, not
	// message (A6)" — canonical restatement here; pointer back added there.
	it("same message, DIFFERENT positions (two arms) stays TWO entries", () => {
		const SQL = "{% if v %}select x.nope1 from t x{% else %}select  x.nope1 from t x{% endif %}";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const schema = new Schema({ t: { a: "int" } });
		const diags = doc
			.unionDiagnostics(schema)
			.filter((d) => String((d as { message?: string }).message ?? "").includes("nope1"));
		expect(diags.length).toBe(2);
	});

	// The brief's OTHER half of A6 has no per-task pin — construct it here per the brief's own
	// instruction ("one diagnostic shared by both arms at the same position").
	it("the SAME diagnostic (same message, SAME position) shared by both arms collapses to ONE entry", () => {
		// x.nope1 sits OUTSIDE the if/else region — identical bytes, identical position, in EVERY
		// realization — so both arms produce the exact same diagnostic at the exact same span.
		const SQL = "select x.nope1 from t x {% if v %}where a = 1{% else %}where b = 1{% endif %}";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const diags = doc
			.unionDiagnostics(schema)
			.filter((d) => String((d as { message?: string }).message ?? "").includes("nope1"));
		expect(diags.length).toBe(1); // identical bytes outside the region -> one diagnostic, not two
	});
});

describe("A7 — per-arm structural access at every live byte", () => {
	const SQL =
		"select\n" +
		"    {% if is_incremental() %}count (*){% else %}coalesce(id, 0){% endif %}  -- count (comment)\n" +
		"from raw_table";

	it("each arm's own live bytes answer structural nodeAt queries (IR/CST spans)", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);

		const countOffset = SQL.indexOf("count (*)");
		const v0 = doc.variants[0].doc();
		const hit0 = v0.nodeAt(countOffset);
		expect(hit0).toBeDefined();
		expect(v0.text.slice(hit0!.expr.cst.start!.start, hit0!.expr.cst.stop!.stop + 1)).toContain("count");

		const coalesceOffset = SQL.indexOf("coalesce(id, 0)");
		const v1 = doc.variants[1].doc();
		const hit1 = v1.nodeAt(coalesceOffset);
		expect(hit1).toBeDefined();
		expect(v1.text.slice(hit1!.expr.cst.start!.start, hit1!.expr.cst.stop!.stop + 1)).toContain("coalesce");
	});

	it("the unified token stream (SQL + channel-2 jinja + comments) is exposed with document coordinates", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		for (const v of doc.variants) {
			const armDoc = v.doc();
			const tokens = armDoc.tokens;
			expect(tokens.some((t) => t.channel === 2)).toBe(true); // the {% if %}/{% else %}/{% endif %} tokens
			expect(tokens.some((t) => t.role === "comment")).toBe(true);
			// Self-consistent document coordinates: every token slices back to its own text.
			for (const t of tokens) expect(armDoc.text.slice(t.start, t.stop + 1)).toBe(t.text);
		}
	});

	it("the trailing `-- count (comment)` comment token is present and IDENTICALLY positioned in every arm", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		const commentStart = SQL.indexOf("-- count (comment)");
		let reference: { start: number; stop: number; text: string } | undefined;
		for (const v of doc.variants) {
			const comments = v.doc().tokens.filter((t) => t.role === "comment");
			expect(comments.length).toBe(1);
			expect(comments[0].start).toBe(commentStart); // outside the region -> same offset in every arm
			if (!reference) reference = comments[0];
			else {
				expect(comments[0].start).toBe(reference.start);
				expect(comments[0].stop).toBe(reference.stop);
				expect(comments[0].text).toBe(reference.text);
			}
		}
	});
});

describe("A8a — column union with shared-column dedup", () => {
	const SQL = [
		"with data as (",
		"    SELECT",
		"        {% if is_incremental() %}incremental_col{% else %}full_col{% endif %},",
		"        shared_col",
		"    FROM raw_table",
		")",
		"SELECT * FROM data",
	].join("\n");

	// Development pin (smoke only, no line assertions): tests/document.variants.test.ts "unionCtes
	// unions one CTE's columns across arms by name (A8a smoke)" — this is the exact-line acceptance.
	it("incremental_col/full_col at brief-line 2, shared_col at brief-line 3, each exactly once", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		const data = ctes[0];
		expect(data.name).toBe("data");
		const names = data.columns.map((c) => c.name);
		for (const n of ["incremental_col", "full_col", "shared_col"]) {
			expect(names.filter((x) => x === n).length).toBe(1); // exactly once
		}
		const byName = new Map(data.columns.map((c) => [c.name, c]));
		expect(briefLine(byName.get("incremental_col")!.span)).toBe(2);
		expect(briefLine(byName.get("full_col")!.span)).toBe(2);
		expect(briefLine(byName.get("shared_col")!.span)).toBe(3);
	});
});

describe("A8b — if-without-else: the synthetic empty-else arm makes the optional column derivable", () => {
	const SQL = [
		"with data as (",
		"    SELECT always_present{% if condition %}, optional_col{% endif %} FROM raw_table",
		")",
		"SELECT * FROM data",
	].join("\n");

	it("always_present and optional_col both reachable at brief-line 1, each exactly once", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		// Requires the synthetic empty-else arm (Stage-5 Task 1): the region has no else, so without
		// it, optional_col would be live in EVERY variant and "absent" would never be a coverage point.
		expect(doc.variants.length).toBe(2);
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		const names = ctes[0].columns.map((c) => c.name);
		expect(names.filter((n) => n === "always_present").length).toBe(1);
		expect(names.filter((n) => n === "optional_col").length).toBe(1);
		const byName = new Map(ctes[0].columns.map((c) => [c.name, c]));
		expect(briefLine(byName.get("always_present")!.span)).toBe(1);
		expect(briefLine(byName.get("optional_col")!.span)).toBe(1);
	});
});

describe("A8c — nested conditionals: every leaf path enumerated", () => {
	const SQL = [
		"with data as (",
		"    SELECT",
		"        {% if outer %}{% if inner %}col_a{% else %}col_b{% endif %}{% else %}col_c{% endif %},",
		"        base_col",
		"    FROM raw_table",
		")",
		"SELECT * FROM data",
	].join("\n");

	it("col_a/col_b/col_c all reachable at brief-line 2, base_col at brief-line 3 exactly once", () => {
		const doc = SqlDocument.create(SQL, "databricks", { templating: minijinja() });
		expect(doc.variants.length).toBe(3); // 1 + (2-1) + (2-1), linear — never the 4-way cross-product
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		const names = ctes[0].columns.map((c) => c.name);
		for (const n of ["col_a", "col_b", "col_c"]) expect(names).toContain(n);
		expect(names.filter((n) => n === "base_col").length).toBe(1);
		const byName = new Map(ctes[0].columns.map((c) => [c.name, c]));
		for (const n of ["col_a", "col_b", "col_c"]) expect(briefLine(byName.get(n)!.span)).toBe(2);
		expect(briefLine(byName.get("base_col")!.span)).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// A9 — M1 boundary (documented limit, not a gate).
//
// Unclosed region -> empty last-arm bodySpan: carried as documented behavior,
// unchanged. No acceptance case here — the brief lists it so the known edge is
// stated explicitly, not so it can be gated. (src/minijinja/regions.ts's
// `finalize`: an unclosed region's last arm's body falls back to EOF/the arm's
// own tag when no closer is seen; templateVariants and document.ts inherit that
// behavior verbatim — see the Stage-5 plan's Global Constraints, which name this
// exact M1 designation, and docs/minijinja-front-end.md.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fold vocabulary / star anchor — NOT part of the A1-A9 brief above; these
// bindings live in tests/vocabulary-contract.test.ts (the reusable
// `vocabularyContract` suite, the engineContract treatment): union column
// names fold-normalized + quote-preserving, star-expanded spans anchored on
// the `*` character, and UnionCte.name in the same fold vocabulary — invoked
// there for BOTH unionOutputColumns and unionCtes, so the fixtures live once.
// They bind the vocabulary the way A1-A8 above bind the union logic.
// ---------------------------------------------------------------------------
