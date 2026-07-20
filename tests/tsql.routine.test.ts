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
import { probeBody } from "./helpers/body-probe.js";

// ---------------------------------------------------------------------------
// T-SQL routine-frame slice: CREATE/ALTER PROCEDURE and CREATE/ALTER FUNCTION signature
// parameters (QueryExpr.declarations, VariableDecl.mode) + body statements (QueryExpr.statements),
// layered on the container's existing flagged-stub "ddl" QueryExpr, see ir.ts's `statements` field
// and src/tsql/lower.ts's applyRoutineFrame/lowerProcedureFrame/lowerFunctionFrame. The semantic
// layer (scope/symbols/infer/references) needs no per-dialect awareness of routines: it already
// generalizes DECLARE's declarations/rootDeclarations machinery across a nested scope tree.
// ---------------------------------------------------------------------------

function ir(sql: string) {
	const { tree, errors } = parseTSql(sql);
	return { q: lower(tree), errors };
}

function scopes(sql: string) {
	return resolveScopes(lower(parseTSql(sql).tree), "tsql");
}

describe("CREATE PROCEDURE -> QueryExpr.declarations (signature parameters)", () => {
	it("lowers each procedure_param into a VariableDecl: name, typeText, default init, mode", () => {
		const sql = `
			CREATE PROCEDURE dbo.p (@a int, @b varchar(50) = 'x', @c int OUTPUT, @d dbo.MyType READONLY)
			AS
			SELECT 1
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statement).toBe("ddl");
		expect(q.declarations).toHaveLength(4);

		expect(q.declarations?.[0]).toMatchObject({ name: "a", typeText: "int" });
		expect(q.declarations?.[0]?.mode).toBeUndefined();
		expect(q.declarations?.[0]?.init).toBeUndefined();

		expect(q.declarations?.[1]).toMatchObject({ name: "b" });
		expect(q.declarations?.[1]?.init).toMatchObject({ kind: "literal", text: "'x'" });

		expect(q.declarations?.[2]).toMatchObject({ name: "c", typeText: "int", mode: "out" });

		expect(q.declarations?.[3]).toMatchObject({ name: "d", typeText: "dbo.MyType", mode: "readonly" });
	});

	it('OUT and OUTPUT both lower to mode "out"', () => {
		const { q } = ir("CREATE PROCEDURE dbo.p (@a int OUT) AS SELECT 1");
		expect(q.declarations?.[0]?.mode).toBe("out");
	});

	it("nameSpan covers exactly the LOCAL_ID token, sigil excluded from name", () => {
		const sql = "CREATE PROCEDURE dbo.p (@counter int) AS SELECT 1";
		const { q } = ir(sql);
		const span = q.declarations?.[0]?.nameSpan;
		expect(span).toBeDefined();
		expect(sql.slice(span!.start, span!.end)).toBe("@counter");
		expect(q.declarations?.[0]?.name).toBe("counter");
	});

	it("the container keeps its own 'ddl' category and flagged stub body", () => {
		const { q } = ir("CREATE PROCEDURE dbo.p (@a int) AS SELECT @a");
		expect(q.statement).toBe("ddl");
		expect(q.body.kind).toBe("select");
		if (q.body.kind === "select") expect(q.body.unsupported).toContain("unparsed");
	});
});

describe("CREATE PROCEDURE -> QueryExpr.statements (body)", () => {
	it("a BEGIN...END body's inner sql_clauses each become their own QueryExpr", () => {
		const sql = `
			CREATE PROCEDURE dbo.p (@a int)
			AS
			BEGIN
				SELECT @a
				SELECT 1
			END
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(2);
		expect(q.statements?.[0]?.statement).toBe("query");
		expect(q.statements?.[0]?.body.kind).toBe("select");
		expect(q.statements?.[1]?.statement).toBe("query");
	});

	it("a bare (no BEGIN...END) single-statement body is its own statements[0]", () => {
		const { q } = ir("CREATE PROCEDURE dbo.p AS SELECT 1");
		expect(q.statements).toHaveLength(1);
		expect(q.statements?.[0]?.statement).toBe("query");
		expect(q.statements?.[0]?.body.kind).toBe("select");
	});

	it("non-query inner statements stay honestly flagged (SET, IF)", () => {
		const sql = `
			CREATE PROCEDURE dbo.p (@a int)
			AS
			BEGIN
				SET @a = 1
				IF @a > 0
					SELECT @a
			END
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(2);
		expect(q.statements?.[0]?.statement).not.toBe("query");
		const firstBody = q.statements?.[0]?.body;
		expect(firstBody?.kind === "select" && firstBody.unsupported).toBeTruthy();
		expect(q.statements?.[1]?.statement).not.toBe("query");
	});

	it("a procedure-body DECLARE is its own inner statement, carrying its own declarations", () => {
		const sql = `
			CREATE PROCEDURE dbo.p
			AS
			BEGIN
				DECLARE @v int = 1, @w int = @v + 1
				SELECT @w
			END
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(2);
		const declStmt = q.statements?.[0];
		expect(declStmt?.statement).toBe("utility");
		expect(declStmt?.declarations).toHaveLength(2);
		expect(declStmt?.declarations?.[0]).toMatchObject({ name: "v", typeText: "int" });
	});
});

describe("routine body scopes + symbols (statements[] hangs under the container's own scope)", () => {
	it("body SELECT is reachable via statements[0] with real scopes", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a AS x FROM t END";
		const tree = scopes(sql);
		expect(tree.root.children.length).toBeGreaterThan(0);
		const stmtScope = tree.root.children.find((c) => c.body.kind === "select" && c.body.from.length > 0);
		expect(stmtScope).toBeDefined();
		expect(stmtScope!.outputs).toEqual(["x"]);
	});

	it("a body reference to @a links to the signature declaration and types int", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a END";
		const tree = scopes(sql);
		const syms = deriveSymbols(tree);
		const decl = syms.find((s) => s.kind === "variable" && s.modifiers.includes("declaration") && s.name === "a");
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "a");
		expect(decl).toBeDefined();
		expect(ref).toBeDefined();
		expect(ref!.definition).toEqual(decl!.span);
		expect(ref!.type).toEqual({ kind: "scalar", name: "int" });
	});

	it("inferType resolves the parameter's declared type for a body reference directly", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a END";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "tsql");
		const innerSelect = q.statements?.[0];
		expect(innerSelect?.body.kind).toBe("select");
		const proj = innerSelect!.body.kind === "select" ? innerSelect!.body.projections[0] : undefined;
		expect(proj?.expr.kind).toBe("variable");
		const stmtScope = tree.root.children.find((c) => c.body === innerSelect!.body);
		expect(stmtScope).toBeDefined();
		expect(inferType(proj!.expr, stmtScope!, new Schema({}))).toEqual({ kind: "scalar", name: "int" });
	});

	it("a procedure-body DECLARE + later reference link locally within the SAME inner statement", () => {
		const sql = `
			CREATE PROCEDURE dbo.p
			AS
			BEGIN
				DECLARE @v int = 1, @w int = @v + 1
			END
		`;
		const tree = scopes(sql);
		const syms = deriveSymbols(tree);
		const decl = syms.find((s) => s.kind === "variable" && s.modifiers.includes("declaration") && s.name === "v");
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "v");
		expect(decl).toBeDefined();
		expect(ref).toBeDefined();
		expect(ref!.definition).toEqual(decl!.span);
	});

	it("a body DECLARE reusing the signature parameter's name is an ambiguity (2 candidates, no link)", () => {
		const sql = `
			CREATE PROCEDURE dbo.p (@a int)
			AS
			BEGIN
				DECLARE @a varchar(10)
				SELECT @a
			END
		`;
		const tree = scopes(sql);
		const syms = deriveSymbols(tree);
		const ref = syms.find((s) => s.kind === "variable" && s.modifiers.includes("reference") && s.name === "a");
		expect(ref).toBeDefined();
		expect(ref!.definition).toBeUndefined();
		expect(ref!.type).toBeUndefined();
	});
});

describe("nodeAt / referencesAt reach inner-statement expressions", () => {
	it("nodeAt finds the @a reference inside statements[0]'s body, offset-based", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a END";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "tsql");
		const off = sql.lastIndexOf("@a");
		const hit = nodeAt(tree, off, q);
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("variable");
		expect((hit!.expr as { name: string }).name).toBe("a");
	});

	it("referencesAt groups the parameter declaration with its body reference", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a FROM t WHERE @a > 0 END";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "tsql");
		const off = sql.indexOf("@a", sql.indexOf("WHERE"));
		const occ = referencesAt(tree, off, undefined, q);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("variable");
		expect(occ!.symbol).toBe("a");
		expect(occ!.occurrences).toHaveLength(2); // the SELECT list ref + the WHERE ref
	});
});

describe("inline TVF (func_body_returns_select): the SELECT is the statement's own body", () => {
	it("replaces the flagged stub with the real SELECT body + outputs", () => {
		const sql = "CREATE FUNCTION dbo.f (@a int) RETURNS TABLE AS RETURN SELECT @a AS x FROM t";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statement).toBe("ddl");
		expect(q.body.kind).toBe("select");
		if (q.body.kind === "select") expect(q.body.unsupported).toBeUndefined();
		expect(q.declarations).toHaveLength(1);
		expect(q.declarations?.[0]).toMatchObject({ name: "a", typeText: "int" });

		const tree = resolveScopes(q, "tsql");
		expect(tree.root.outputs).toEqual(["x"]);
	});

	it("a parenthesized RETURN (select) form lowers the same way", () => {
		const sql = "CREATE FUNCTION dbo.f () RETURNS TABLE AS RETURN (SELECT 1 AS one)";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.body.kind).toBe("select");
		const tree = resolveScopes(q, "tsql");
		expect(tree.root.outputs).toEqual(["one"]);
	});
});

describe("scalar function (func_body_returns_scalar): body statements only, RETURN's expression skipped", () => {
	it("BEGIN...END sql_clauses before RETURN become statements[]", () => {
		const sql = `
			CREATE FUNCTION dbo.f (@a int)
			RETURNS int
			AS
			BEGIN
				DECLARE @r int = @a + 1
				RETURN @r
			END
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.declarations).toHaveLength(1);
		expect(q.declarations?.[0]).toMatchObject({ name: "a", typeText: "int" });
		expect(q.statements).toHaveLength(1);
		expect(q.statements?.[0]?.declarations?.[0]).toMatchObject({ name: "r" });
	});

	it("a minimal BEGIN RETURN <expr> END body has no statements (nothing else to report)", () => {
		const { q } = ir("CREATE FUNCTION dbo.f (@a int) RETURNS int AS BEGIN RETURN @a END");
		expect(q.statements).toBeUndefined();
		expect(q.declarations).toHaveLength(1);
	});
});

describe("multi-statement TVF (func_body_returns_table): statements[] + the return table variable", () => {
	it("registers the return table variable as its own VariableDecl, alongside the params", () => {
		const sql = `
			CREATE FUNCTION dbo.f (@a int)
			RETURNS @t TABLE (id int, name varchar(50))
			AS
			BEGIN
				INSERT INTO @t SELECT @a, 'x'
				RETURN
			END
		`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.declarations).toHaveLength(2);
		expect(q.declarations?.[0]).toMatchObject({ name: "a", typeText: "int" });
		expect(q.declarations?.[1]?.name).toBe("t");
		expect(q.declarations?.[1]?.typeText).toBeTruthy();
		expect(q.statements).toHaveLength(1);
	});
});

describe("body-non-emptiness probe stays clean over routine frames", () => {
	it("a procedure with a real body raises no probe hits", () => {
		const sql = "CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a FROM t END";
		const { q } = ir(sql);
		const hits: string[] = [];
		probeBody(q, "proc.sql", hits);
		expect(hits).toEqual([]);
	});

	it("an inline TVF's real body raises no probe hits", () => {
		const sql = "CREATE FUNCTION dbo.f (@a int) RETURNS TABLE AS RETURN SELECT @a AS x FROM t";
		const { q } = ir(sql);
		const hits: string[] = [];
		probeBody(q, "tvf.sql", hits);
		expect(hits).toEqual([]);
	});
});

describe("a procedure inside a multi-statement SqlDocument keeps everything working in document coordinates", () => {
	it("nodeAt/referencesAt on a body reference resolve through the procedure's own cell", () => {
		const text = [
			"SELECT 1;",
			"CREATE PROCEDURE dbo.p (@a int) AS BEGIN SELECT @a FROM t WHERE @a > 0 END;",
			"SELECT 2",
		].join("\n");
		const doc = SqlDocument.create(text, "tsql");
		expect(doc.statements).toHaveLength(3);
		const procCell = doc.statements[1];
		expect(procCell.ast.statement).toBe("ddl");
		expect(procCell.ast.statements).toHaveLength(1);

		const off = text.indexOf("@a", text.indexOf("WHERE"));
		const hit = doc.nodeAt(off);
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("variable");

		// Document-wide escalation (>1 statement cell) widens to every Sym named "a": the parameter's
		// own declaration plus its two body references, see document.ts's escalateVariableOccurrences.
		const occ = doc.referencesAt(off);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("variable");
		expect(occ!.symbol).toBe("a");
		expect(occ!.occurrences.filter((o) => o.role === "declaration")).toHaveLength(1);
		expect(occ!.occurrences.filter((o) => o.role === "reference")).toHaveLength(2);
		expect(occ!.occurrences).toHaveLength(3);
	});
});
