import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { parse, toScopes, deriveSymbols } from "../src/api.js";
import { shiftDiagnostic } from "../src/document/shift.js";
import { Schema } from "../src/qualify/schema.js";
import type { SyntaxDiagnostic } from "../src/parse-diagnostics.js";

// ---------------------------------------------------------------------------
// SqlDocument statement cells (Task 5). A document splits into per-statement
// cells (src/document/split.ts), each parsed independently, with a content-
// addressed cache so an edit reuses the unchanged cells across withText().
// The single-cell facade stays byte-identical to today; multi-cell keeps a
// compound-flagged facade, with statements/cellAt as the real surface.
// ---------------------------------------------------------------------------

/** Strip the foreign antlr cst back-refs so two independent parses compare structurally. */
function stripCst(o: unknown): unknown {
	return JSON.parse(JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v)));
}

describe("shiftDiagnostic", () => {
	it("a diagnostic on the cell's first line shifts line + column + offset", () => {
		const d: SyntaxDiagnostic = { message: "x", line: 1, column: 3, offset: 5, length: 2 };
		const s = shiftDiagnostic(d, 2, 10, 100);
		expect(s.line).toBe(3); // 1 + baseLine 2
		expect(s.column).toBe(13); // first line → 3 + baseCol 10
		expect(s.offset).toBe(105); // 5 + baseOffset 100
		expect(s.length).toBe(2);
	});

	it("a diagnostic on a later line shifts only the line (column unchanged)", () => {
		const d: SyntaxDiagnostic = { message: "y", line: 3, column: 4, offset: 7, length: 1 };
		const s = shiftDiagnostic(d, 2, 10, 100);
		expect(s.line).toBe(5); // 3 + baseLine 2
		expect(s.column).toBe(4); // later line → unchanged
		expect(s.offset).toBe(107);
	});

	it("a zero base is an identity (returns the same values)", () => {
		const d: SyntaxDiagnostic = { message: "z", line: 2, column: 1, offset: 9, length: 3 };
		const s = shiftDiagnostic(d, 0, 0, 0);
		expect(s).toEqual(d);
	});
});

describe("SqlDocument single-cell back-compat (byte-exact)", () => {
	const text = "SELECT amount FROM sales";

	it("tokens / diagnostics / errors deep-equal a raw parse() (pre-refactor snapshot)", () => {
		const doc = SqlDocument.create(text, "databricks");
		const p = parse(text, "databricks");
		expect(doc.tokens).toEqual(p.tokens);
		expect(doc.diagnostics).toEqual(p.diagnostics);
		expect(doc.errors).toBe(p.errors);
	});

	it("ast deep-equals a raw parse() (cst-stripped)", () => {
		const doc = SqlDocument.create(text, "databricks");
		const p = parse(text, "databricks");
		expect(stripCst(doc.ast)).toEqual(stripCst(p.ast));
		expect(doc.ast.statement).toBe("query");
	});

	it("scopes match a raw resolve (statement + output columns)", () => {
		const doc = SqlDocument.create(text, "databricks");
		const scopes = toScopes(parse(text, "databricks").ast, { dialect: "databricks" });
		expect(doc.scopes.statement).toBe(scopes.statement);
		expect(doc.scopes.root.outputs).toEqual(scopes.root.outputs);
	});

	it("has exactly one statement cell, reference-identical to the facade fields", () => {
		const doc = SqlDocument.create(text, "databricks");
		expect(doc.statements.length).toBe(1);
		expect(doc.statements[0].ast).toBe(doc.ast);
		expect(doc.statements[0].cst).toBe(doc.cst);
		expect(doc.statements[0].scopes).toBe(doc.scopes);
	});
});

describe("SqlDocument multi-cell", () => {
	it("two statements become two real (non-compound) cells", () => {
		const text = "SELECT amount FROM sales; SELECT id FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		expect(doc.statements.length).toBe(2);
		expect(doc.statements[0].ast.statement).toBe("query");
		expect(doc.statements[1].ast.statement).toBe("query");
		// facade keeps the compound-flagged shape for back-compat
		expect(doc.ast.statement).toBe("compound");
		expect(doc.scopes.statement).toBe("compound");
	});

	it("token spans are in doc coordinates and tile monotonically", () => {
		const text = "SELECT amount FROM sales; SELECT id FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		// tokens are non-decreasing in doc offsets, and each matches the source slice
		let prev = -1;
		for (const t of doc.tokens) {
			expect(t.start).toBeGreaterThanOrEqual(prev);
			expect(text.slice(t.start, t.stop + 1)).toBe(t.text);
			prev = t.start;
		}
		// the second statement's `id` token sits at its real doc offset
		const idTok = doc.tokens.find((t) => t.text === "id");
		expect(idTok).toBeDefined();
		expect(idTok!.start).toBe(text.indexOf("id"));
	});

	it("a syntax error in statement 2 is positioned in statement 2's lines; statement 1 is clean", () => {
		const text = "SELECT amount FROM sales;\nSELECT (1";
		const doc = SqlDocument.create(text, "databricks");
		expect(doc.statements[0].errors).toBe(0);
		expect(doc.statements[0].diagnostics.length).toBe(0);
		expect(doc.statements[1].errors).toBeGreaterThan(0);
		// stmt 2 lives on doc line 2 (1-based) — diagnostics shifted there, not line 1
		for (const d of doc.statements[1].diagnostics) expect(d.line).toBe(2);
		// facade concat: doc.errors is the sum, doc.diagnostics the concat
		expect(doc.errors).toBe(doc.statements[1].errors);
		expect(doc.diagnostics.length).toBe(doc.statements[1].diagnostics.length);
	});

	it("cellAt() binary-searches to the cell owning an offset", () => {
		const text = "SELECT amount FROM sales; SELECT id FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		expect(doc.cellAt(text.indexOf("amount"))).toBe(doc.statements[0]);
		expect(doc.cellAt(text.indexOf("id"))).toBe(doc.statements[1]);
		expect(doc.cellAt(0)).toBe(doc.statements[0]);
		expect(doc.cellAt(text.length - 1)).toBe(doc.statements[1]);
	});

	it("cells are frozen", () => {
		const text = "SELECT amount FROM sales; SELECT id FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		expect(Object.isFrozen(doc.statements)).toBe(true);
		expect(Object.isFrozen(doc.statements[0])).toBe(true);
	});
});

describe("SqlDocument content-addressed cell reuse across edits", () => {
	it("editing only statement 2 reuses statement 1's cell (cst reference identity)", () => {
		const d1 = SqlDocument.create("SELECT amount FROM sales;\nSELECT id FROM sales", "databricks");
		const d2 = d1.withText("SELECT amount FROM sales;\nSELECT other FROM sales", 1);
		expect(d2.statements[0].cst).toBe(d1.statements[0].cst); // reused
		expect(d2.statements[1].cst).not.toBe(d1.statements[1].cst); // re-parsed
	});

	it("reordering two statements cache-hits both cells (content addressing)", () => {
		const d1 = SqlDocument.create("SELECT a FROM x;\nSELECT b FROM y;", "databricks");
		expect(d1.statements.length).toBe(2);
		const [c1, c2] = d1.statements;
		// concatenating the exact cell slices in swapped order reproduces both cell texts
		const d2 = d1.withText(c2.text + c1.text, 1);
		expect(d2.statements.length).toBe(2);
		const d1csts = new Set([c1.cst, c2.cst]);
		expect(d1csts.has(d2.statements[0].cst)).toBe(true);
		expect(d1csts.has(d2.statements[1].cst)).toBe(true);
	});

	it("duplicate-text cells in ONE doc get DISTINCT parse products (no intra-doc aliasing)", () => {
		// NOTE: `SELECT 1;\nSELECT 1;` does NOT alias — tiling gives cell 2 the leading `\n`, a
		// different content address. The tight form below yields two byte-identical cell slices.
		const text = "SELECT 1;SELECT 1;";
		const doc = SqlDocument.create(text, "databricks");
		expect(doc.statements.length).toBe(2);
		expect(doc.statements[0].text).toBe(doc.statements[1].text);
		// Task 6 walks per-cell scopes by object identity — shared cst/ast/scopes across two
		// spans would cross-contaminate occurrences between the duplicate statements.
		expect(doc.statements[0].cst).not.toBe(doc.statements[1].cst);
		expect(doc.statements[0].scopes).not.toBe(doc.statements[1].scopes);
		// spans + tokens still correct for both
		expect(doc.statements[0].span).toEqual({ start: 0, end: 9 });
		expect(doc.statements[1].span).toEqual({ start: 9, end: text.length });
		const ones = doc.tokens.filter((t) => t.text === "1");
		expect(ones.map((t) => t.start)).toEqual([7, 16]);
		// cross-edit reuse is untouched: editing only statement 2 still cache-hits statement 1
		const d2 = doc.withText("SELECT 1;SELECT 2;", 1);
		expect(d2.statements[0].cst).toBe(doc.statements[0].cst);
		expect(d2.statements[1].cst).not.toBe(doc.statements[1].cst);
	});

	it("a fresh create() does NOT reuse a prior document's cache", () => {
		const d1 = SqlDocument.create("SELECT a FROM x;\nSELECT b FROM y", "databricks");
		const fresh = SqlDocument.create("SELECT a FROM x;\nSELECT b FROM y", "databricks");
		expect(fresh.statements[0].cst).not.toBe(d1.statements[0].cst);
	});
});

describe("SqlDocument.analyze() — per-statement merge (Task 6)", () => {
	const schema = new Schema({ sales: { amount: "decimal", id: "int" } });

	it("merges symbols across every cell in DOC coordinates", () => {
		const text = "SELECT amount AS a FROM sales;\nSELECT id AS b FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		const names = doc.analyze(schema).symbols.map((s) => s.name);
		expect(names).toContain("a");
		expect(names).toContain("b");
		// `b` is declared in statement 2 (doc line 2, 1-based) — proves the shift to doc coordinates.
		const b = doc.analyze(schema).symbols.find((s) => s.name === "b" && s.modifiers.includes("output"))!;
		expect(b.span.line).toBe(2);
	});

	it("merges semantic diagnostics from every cell, positioned in doc coordinates", () => {
		const text = "SELECT amount FROM sales;\nSELECT nope FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		const diags = doc.analyze(schema).diagnostics;
		const bad = diags.find((d) => /nope|unknown/i.test(d.message))!;
		expect(bad).toBeDefined();
		expect(bad.line).toBe(2); // statement 2 → doc line 2 (1-based)
	});

	it("single-cell analyze() matches a direct qualify/deriveSymbols (fast path, no shift)", () => {
		const text = "SELECT amount AS a FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		const a = doc.analyze(schema);
		const directSyms = deriveSymbols(doc.statements[0].scopes, schema, { dialect: "databricks" });
		const strip = (syms: { name: string; span: unknown }[]) => syms.map((s) => ({ name: s.name, span: s.span }));
		expect(strip(a.symbols)).toEqual(strip(directSyms));
		// The fast path returns qualification.diagnostics directly (same array object).
		expect(a.diagnostics).toBe(a.qualification.diagnostics);
	});

	it("a relation Sym's alias span shifts to doc coordinates in a multi-statement document", () => {
		const text = "SELECT amount AS a FROM sales;\nSELECT id AS b FROM sales x";
		const doc = SqlDocument.create(text, "databricks");
		const syms = doc.analyze(schema).symbols;
		const tableSym = syms.find((s) => s.kind === "table" && s.alias?.name === "x")!;
		expect(tableSym).toBeDefined();
		const aliasSym = syms.find((s) => s.kind === "alias" && s.name === "x")!;
		expect(aliasSym).toBeDefined();
		// The alias span is on doc line 2, matching the separate alias Sym's (already-shifted) span —
		// not the stale cell-relative coordinates a missed shift would leave behind.
		expect(tableSym.alias!.span).toEqual(aliasSym.span);
		expect(tableSym.alias!.span.line).toBe(2);
		// start/end are absolute DOC char offsets too — a shift that only moved line/column (mirroring
		// the shiftSpanFields spread bug) would leave these at their stale cell-relative values.
		expect(text.slice(tableSym.alias!.span.start, tableSym.alias!.span.end)).toBe("x");
		expect(text.slice(aliasSym.span.start, aliasSym.span.end)).toBe("x");
	});

	it("a column Sym's .source link is remapped to the SHIFTED relation Sym in a multi-statement document", () => {
		const text = "SELECT 1;\nSELECT o.id FROM orders o";
		const doc = SqlDocument.create(text, "databricks");
		const syms = doc.analyze(schema).symbols;
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "orders")!;
		expect(tableSym).toBeDefined();
		const colSym = syms.find((s) => s.kind === "column" && s.modifiers.includes("reference") && s.name === "o.id")!;
		expect(colSym).toBeDefined();
		// Object identity with the ARRAY'S OWN table Sym, not a stale pre-shift copy — a naive
		// per-Sym shift (map without a re-pointing pass) would leave .source pointing at the
		// original cell-relative object, which is no longer reachable from the returned array.
		expect(colSym.source).toBe(tableSym);
		expect(colSym.source!.span.line).toBe(2); // doc coordinates, not cell-relative
		expect(text.slice(colSym.source!.span.start, colSym.source!.span.end)).toBe("orders o"); // whole source ref
	});

	it("expanded star column Syms shift to doc coordinates and keep their zero-width span + .source remap", () => {
		const text = "SELECT 1;\nSELECT * FROM sales";
		const doc = SqlDocument.create(text, "databricks");
		const syms = doc.analyze(schema).symbols;
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "sales")!;
		expect(tableSym).toBeDefined();
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded.map((s) => s.name).sort()).toEqual(["amount", "id"]);
		for (const e of expanded) {
			expect(e.span.line).toBe(2); // shifted to doc coordinates, not cell-relative
			expect(e.span.column).toBe(e.span.endColumn); // still zero-width after the shift
			expect(e.span.start).toBe(e.span.end); // zero-width in offsets too, not just line/column
			expect(e.span.start).toBe(text.indexOf("*")); // at the star's DOC offset, not cell-relative
			expect(e.source).toBe(tableSym); // remapped to the SHIFTED relation Sym
		}
	});

	it("editing statement 2 reuses statement 1's cell analysis (no re-qualify of statement 1)", () => {
		const d1 = SqlDocument.create("SELECT amount FROM sales;\nSELECT id FROM sales", "databricks");
		const s1before = d1.analyze(schema).symbols.find((s) => s.name === "amount");
		expect(s1before).toBeDefined();
		const d2 = d1.withText("SELECT amount FROM sales;\nSELECT id AS other FROM sales", 1);
		// Statement 1's cell (and thus its cached per-cell analysis) is reused across the edit.
		expect(d2.statements[0].scopes).toBe(d1.statements[0].scopes);
		// Statement 2 re-parsed → its analysis reflects the edit (the new `other` output symbol).
		const names2 = d2.analyze(schema).symbols.map((s) => s.name);
		expect(names2).toContain("other");
	});

	it("analyze() memoizes the merged result per schema identity", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales;\nSELECT id FROM sales", "databricks");
		expect(doc.analyze(schema)).toBe(doc.analyze(schema));
	});
});
