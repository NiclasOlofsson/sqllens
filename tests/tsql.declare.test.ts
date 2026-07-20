import { describe, expect, it } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { nodeAt } from "../src/document/node-at.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { referencesAt } from "../src/references/references.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// ---------------------------------------------------------------------------
// T-SQL DECLARE linking (the parameter/variable IR wave's follow-on task, see
// .claude/PLAN.md's "Open Gaps" entry). DECLARE's variable declarations are now
// real IR content (QueryExpr.declarations / Scope.declarations, VariableDecl),
// and a `variable` Expr reference (kind "variable" — see ir.ts) links to its
// declaring DECLARE: within one statement via symbols.ts/infer.ts (a same-
// root-scope lookup, single-unambiguous-match), and across statement cells of
// one SqlDocument via document.ts's per-name last-declaration map (T-SQL
// variables live for the rest of the batch and die at GO — learn.microsoft.com/
// en-us/sql/t-sql/language-elements/variables-transact-sql, "Variable scope").
// ---------------------------------------------------------------------------

function ir(sql: string) {
	const { tree, errors } = parseTSql(sql);
	return { q: lower(tree), errors };
}

function scopes(sql: string) {
	return resolveScopes(lower(parseTSql(sql).tree), "tsql");
}

describe("T-SQL DECLARE -> QueryExpr.declarations", () => {
	it("lowers a DECLARE list into one VariableDecl per entry: name (sigil stripped), typeText, initializer", () => {
		const { q, errors } = ir("DECLARE @x int = 1, @y int = @x + 1");
		expect(errors).toBe(0);
		expect(q.statement).toBe("utility");
		expect(q.declarations).toHaveLength(2);
		expect(q.declarations?.[0]).toMatchObject({ name: "x", typeText: "int" });
		expect(q.declarations?.[0]?.init).toMatchObject({ kind: "literal", text: "1" });
		expect(q.declarations?.[1]).toMatchObject({ name: "y", typeText: "int" });
		expect(q.declarations?.[1]?.init).toMatchObject({ kind: "binary", op: "+" });
		// The @x reference inside @y's own initializer is a real "variable" Expr node.
		const yInit = q.declarations?.[1]?.init;
		expect(yInit?.kind).toBe("binary");
		if (yInit?.kind === "binary") expect(yInit.left).toMatchObject({ kind: "variable", name: "x" });
	});

	it("a DECLARE with no initializer leaves init undefined", () => {
		const { q } = ir("DECLARE @x int");
		expect(q.declarations).toHaveLength(1);
		expect(q.declarations?.[0]?.init).toBeUndefined();
	});

	it("nameSpan covers exactly the LOCAL_ID token (sigil included in the span, excluded from name)", () => {
		const sql = "DECLARE @counter int";
		const { q } = ir(sql);
		const span = q.declarations?.[0]?.nameSpan;
		expect(span).toBeDefined();
		expect(sql.slice(span!.start, span!.end)).toBe("@counter");
		expect(q.declarations?.[0]?.name).toBe("counter");
	});

	it("a table-variable DECLARE gets a bare name + typeText only (no deep modeling)", () => {
		const { q, errors } = ir("DECLARE @t TABLE (id int, name varchar(50))");
		expect(errors).toBe(0);
		expect(q.declarations).toHaveLength(1);
		expect(q.declarations?.[0]?.name).toBe("t");
		expect(q.declarations?.[0]?.typeText).toBeTruthy();
		expect(q.declarations?.[0]?.init).toBeUndefined();
	});

	it("a qualified user-defined table-type DECLARE gets a bare name + typeText", () => {
		const { q, errors } = ir("DECLARE @t dbo.MyTableType");
		expect(errors).toBe(0);
		expect(q.declarations?.[0]).toMatchObject({ name: "t", typeText: "dbo.MyTableType" });
	});

	it("an XML-schema-collection DECLARE gets a bare name + typeText", () => {
		const { q, errors } = ir("DECLARE @x XML(myschema.mycollection)");
		expect(errors).toBe(0);
		expect(q.declarations?.[0]?.name).toBe("x");
		expect(q.declarations?.[0]?.typeText).toBeTruthy();
	});

	it("a multi-statement batch (more than one top-level statement) does not populate declarations", () => {
		const { q } = ir("DECLARE @x int; SELECT @x FROM t");
		expect(q.statement).toBe("compound");
		expect(q.declarations).toBeUndefined();
	});
});

describe("T-SQL DECLARE -> Scope.declarations + symbols (same-statement linking)", () => {
	it("links a same-statement variable reference to its declaration and types it (single unambiguous match)", () => {
		const tree = scopes("DECLARE @x int = 1, @y int = @x + 1");
		expect(tree.root.declarations).toHaveLength(2);
		const syms = deriveSymbols(tree);
		const decl = syms.find((s) => s.kind === "variable" && s.modifiers.includes("declaration") && s.name === "x");
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "x");
		expect(decl).toBeDefined();
		expect(ref).toBeDefined();
		expect(ref!.definition).toEqual(decl!.span);
		expect(ref!.type).toEqual({ kind: "scalar", name: "int" });
	});

	it("inferType resolves the declared type for the same-statement reference directly", () => {
		const { q } = ir("DECLARE @x int = 1, @y int = @x + 1");
		const tree = resolveScopes(q, "tsql");
		const yInit = q.declarations?.[1]?.init;
		if (yInit?.kind !== "binary") throw new Error("expected a binary initializer");
		expect(inferType(yInit.left, tree.root, new Schema({}))).toEqual({ kind: "scalar", name: "int" });
	});

	it("does not link when the SAME statement double-declares the name (ambiguous: 0/2 candidates never guessed)", () => {
		const tree = scopes("DECLARE @x int = 1, @x varchar(10) = 'a', @y int = @x + 1");
		const syms = deriveSymbols(tree);
		const decls = syms.filter(
			(s) => s.kind === "variable" && s.modifiers.includes("declaration") && s.name === "x",
		);
		expect(decls).toHaveLength(2); // both declarations are still real Syms
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "x");
		expect(ref).toBeDefined();
		expect(ref!.definition).toBeUndefined();
		expect(ref!.type).toBeUndefined();
	});

	it("does not link an undeclared variable reference", () => {
		const tree = scopes("DECLARE @x int = 1, @y int = @z + 1");
		const syms = deriveSymbols(tree);
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "z");
		expect(ref).toBeDefined();
		expect(ref!.definition).toBeUndefined();
		expect(ref!.type).toBeUndefined();
	});

	it("a table-variable DECLARE still gets a declaration Sym (carrying typeText via its parsed type when determinate)", () => {
		const tree = scopes("DECLARE @t TABLE (id int, name varchar(50))");
		const syms = deriveSymbols(tree);
		const decl = syms.find((s) => s.kind === "variable" && s.modifiers.includes("declaration"));
		expect(decl).toBeDefined();
		expect(decl!.name).toBe("t");
	});

	it("parameter references are unaffected: still no definition/type link", () => {
		const tree = scopes("SELECT ? FROM t");
		const syms = deriveSymbols(tree);
		const param = syms.find((s) => s.kind === "parameter");
		expect(param).toBeDefined();
		expect(param!.definition).toBeUndefined();
	});
});

describe("SqlDocument cross-statement DECLARE linking", () => {
	it("links @x's declaration across statement cells and carries its type onto the reference Sym, in document coordinates", () => {
		const text = "DECLARE @x int;\nSELECT @x FROM t";
		const doc = SqlDocument.create(text, "tsql");
		expect(doc.statements).toHaveLength(2);
		const analysis = doc.analyze();
		const decl = analysis.symbols.find((s) => s.kind === "variable" && s.modifiers.includes("declaration"));
		const ref = analysis.symbols.find((s) => s.kind === "variable" && s.modifiers.includes("reference"));
		expect(decl).toBeDefined();
		expect(ref).toBeDefined();
		expect(ref!.definition).toEqual(decl!.span);
		expect(ref!.type).toEqual({ kind: "scalar", name: "int" });
		// The reference's span is in DOCUMENT coordinates (cell 2's own offset), not cell-relative.
		const expectedStart = text.indexOf("@x", text.indexOf("SELECT"));
		expect(ref!.span.start).toBe(expectedStart);
		expect(text.slice(ref!.span.start, ref!.span.end)).toBe("@x");
	});

	it("a GO batch separator resets the link: a variable declared before GO does not link after it", () => {
		const text = "DECLARE @x int\nGO\nSELECT @x";
		const doc = SqlDocument.create(text, "tsql");
		expect(doc.statements.length).toBeGreaterThanOrEqual(2);
		const analysis = doc.analyze();
		const ref = analysis.symbols.find((s) => s.kind === "variable" && s.modifiers.includes("reference"));
		expect(ref).toBeDefined();
		expect(ref!.definition).toBeUndefined();
		expect(ref!.type).toBeUndefined();
	});

	it("an undeclared cross-cell variable reference stays unlinked", () => {
		const doc = SqlDocument.create("DECLARE @x int;\nSELECT @z FROM t", "tsql");
		const analysis = doc.analyze();
		const ref = analysis.symbols.find(
			(s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "z",
		);
		expect(ref).toBeDefined();
		expect(ref!.definition).toBeUndefined();
		expect(ref!.type).toBeUndefined();
	});

	it("referencesAt (cursor on a reference) groups the declaration + every reference of @x across the document", () => {
		const text = "DECLARE @x int;\nSELECT @x FROM t;\nSELECT @x + 1 FROM u";
		const doc = SqlDocument.create(text, "tsql");
		const firstRefOffset = text.indexOf("@x", text.indexOf("SELECT"));
		const occ = doc.referencesAt(firstRefOffset);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("variable");
		expect(occ!.symbol).toBe("x");
		expect(occ!.declaration).toBeDefined();
		expect(occ!.occurrences.filter((o) => o.role === "declaration")).toHaveLength(1);
		expect(occ!.occurrences.filter((o) => o.role === "reference")).toHaveLength(2);
		expect(occ!.occurrences).toHaveLength(3);
	});

	it("parameter occurrences stay per-cell (ungrouped), unlike variables", () => {
		const text = "SELECT ? FROM t;\nSELECT ? FROM u";
		const doc = SqlDocument.create(text, "tsql");
		const occ = doc.referencesAt(text.indexOf("?"));
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.occurrences).toHaveLength(1); // NOT unioned with the second cell's own `?`
	});
});

describe("nodeAt / referencesAt reach a DECLARE initializer's own variable references", () => {
	// declarations' init exprs live on QueryExpr, not any Scope.body, so the offset-based walk
	// (src/ir/walk.ts / src/document/node-at.ts / src/scope/walk.ts) needs its own attribution the
	// same way it already handles ORDER BY / LIMIT — otherwise hovering/go-to-def on the @x inside
	// `DECLARE @y int = @x + 1` finds nothing, even though deriveSymbols/inferType (structural walks
	// over scope.declarations) already link and type it correctly.
	it("nodeAt on the @x inside @y's initializer returns the variable Expr", () => {
		const sql = "DECLARE @x int = 1, @y int = @x + 1";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "tsql");
		const off = sql.lastIndexOf("@x"); // the @x reference inside @y's initializer, not the DECLARE of @x
		const hit = nodeAt(tree, off, q);
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("variable");
		expect((hit!.expr as { name: string }).name).toBe("x");
	});

	it("referencesAt (free function, single scope tree) groups the initializer's @x with another same-statement reference", () => {
		// Two uses of @x within the SAME DECLARE statement: @y's and @z's initializers. Before the
		// fix, nodeAt found neither (both live inside a declaration's init, unreached by the walk),
		// so referencesAt returned null for either offset instead of grouping the two together.
		const sql = "DECLARE @x int = 1, @y int = @x + 1, @z int = @x + 2";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "tsql");
		const yInitOffset = sql.indexOf("@x", sql.indexOf("@y"));
		const zInitOffset = sql.indexOf("@x", sql.indexOf("@z"));
		const occ = referencesAt(tree, yInitOffset, undefined, q);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("variable");
		expect(occ!.symbol).toBe("x");
		const offsets = occ!.occurrences.map((o) => o.span.start);
		expect(offsets).toContain(yInitOffset);
		expect(offsets).toContain(zInitOffset);
		expect(occ!.occurrences).toHaveLength(2);
	});

	it("referencesAt (SqlDocument, cell-aware) groups the initializer's @x with the declaration and a later cell's reference", () => {
		const text = "DECLARE @x int = 1, @y int = @x + 1;\nSELECT @x FROM t";
		const doc = SqlDocument.create(text, "tsql");
		expect(doc.statements).toHaveLength(2);
		const initOffset = text.indexOf("@x", text.indexOf("@y")); // the @x inside @y's initializer
		expect(text.slice(initOffset, initOffset + 2)).toBe("@x");

		const docOcc = doc.referencesAt(initOffset);
		expect(docOcc).not.toBeNull();
		expect(docOcc!.kind).toBe("variable");
		expect(docOcc!.symbol).toBe("x");
		expect(docOcc!.declaration).toBeDefined();
		expect(docOcc!.occurrences.filter((o) => o.role === "declaration")).toHaveLength(1);
		// the reference inside @y's own initializer + the later SELECT @x.
		expect(docOcc!.occurrences.filter((o) => o.role === "reference")).toHaveLength(2);
	});
});
