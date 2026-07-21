import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { nodeAt } from "../src/document/node-at.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { referencesAt } from "../src/references/references.js";
import { resolveScopes, rootDeclarations } from "../src/scope/scope.js";
import { probeBody } from "./helpers/body-probe.js";

// Entry-rule coverage: SQL scripting compounds (BEGIN ... END) and the Delta time-travel
// @-shorthand (t@v123 / t@yyyyMMddHHmmssSSS) are documented Databricks SQL
// (sql-ref-scripting; delta time travel in sql-ref-syntax-qry-select-table-reference).

describe("SQL scripting entry", () => {
	it("parses a BEGIN ... END compound and flags it (scripting has no single query scope)", () => {
		const r = parseDatabricks("BEGIN DECLARE x INT DEFAULT 0; SET x = x + 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("expected flagged select body");
		expect(ir.body.unsupported).toBeTruthy();
	});

	it("flags a compound even when it contains a SELECT (no partial mis-modelling)", () => {
		const r = parseDatabricks("BEGIN SELECT 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("expected flagged select body");
		expect(ir.body.unsupported).toContain("compound");
		expect(() => resolveScopes(ir, "databricks")).not.toThrow();
	});

	it("still parses and models a plain statement", () => {
		const r = parseDatabricks("SELECT a FROM t");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind === "select") expect(ir.body.unsupported).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// SQL scripting statements[] (the routine-frame slice's Databricks counterpart, see ir.ts's
// `statements` field doc and src/tsql/lower.ts's applyRoutineFrame/lowerInnerStatement, plus this
// dialect's own applyCompoundFrame/lowerStatement/lowerInnerCompoundStatement). The BEGIN...END
// container keeps the existing flagged "compound" stub unchanged (empty projections/from, asserted
// above): these tests add the layer ON TOP — real inner bodies, a DECLARE-VARIABLE statement's own
// declarations, and the shared scope/reference machinery reaching into a compound for the first time.
// ---------------------------------------------------------------------------
describe("SQL scripting statements[] (body)", () => {
	it("a two-SELECT compound's statements[] carry real bodies", () => {
		const r = parseDatabricks("BEGIN SELECT a1 FROM t1; SELECT a2 FROM t2; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		expect(q.statement).toBe("compound");
		expect(q.statements).toHaveLength(2);
		expect(q.statements?.[0]?.statement).toBe("query");
		if (q.statements?.[0]?.body.kind === "select") {
			expect(q.statements[0].body.projections).toHaveLength(1);
			expect(q.statements[0].body.from).toHaveLength(1);
			expect(q.statements[0].body.unsupported ?? []).toEqual([]);
		} else {
			throw new Error("select");
		}
		expect(q.statements?.[1]?.statement).toBe("query");
	});

	it("scripting-only inner statements (DECLARE, IF, WHILE) stay honestly flagged, no query body", () => {
		const sql = `
			BEGIN
				DECLARE x INT DEFAULT 0;
				IF x = 0 THEN
					SET x = 1;
				END IF;
				WHILE x < 5 DO
					SET x = x + 1;
				END WHILE;
			END
		`;
		const r = parseDatabricks(sql);
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		expect(q.statements).toHaveLength(3);
		for (const stmt of q.statements ?? []) {
			expect(stmt.body.kind).toBe("select");
			if (stmt.body.kind === "select") expect(stmt.body.unsupported).toContain("non-query");
		}
		expect(q.statements?.[0]?.declarations).toHaveLength(1); // DECLARE x INT DEFAULT 0
		expect(q.statements?.[1]?.statement).toBe("other"); // IF: not a recognised keyword bucket
		expect(q.statements?.[2]?.statement).toBe("other"); // WHILE: likewise
	});

	it("a nested BEGIN...END inside a compound layers its own statements[] recursively", () => {
		const r = parseDatabricks("BEGIN BEGIN SELECT a FROM t; END; SELECT 1; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		expect(q.statements).toHaveLength(2);
		const nested = q.statements?.[0];
		expect(nested?.statement).toBe("compound");
		if (nested?.body.kind === "select") expect(nested.body.unsupported).toContain("compound");
		expect(nested?.statements).toHaveLength(1);
		expect(nested?.statements?.[0]?.statement).toBe("query");
		if (nested?.statements?.[0]?.body.kind === "select") expect(nested.statements[0].body.from).toHaveLength(1);
	});

	it("a scripting block with a real inner SELECT raises no body-probe hits on that statement", () => {
		const r = parseDatabricks("BEGIN SELECT a FROM t; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		const hits: string[] = [];
		probeBody(q, "scripting.sql", hits);
		expect(hits).toEqual([]);
	});
});

describe("SQL scripting statements[] (DECLARE-VARIABLE declarations)", () => {
	it("a compound-body DECLARE becomes its own inner statement's declarations: name, typeText, init", () => {
		const r = parseDatabricks("BEGIN DECLARE v INT DEFAULT 1; SELECT v FROM t; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		expect(q.statements).toHaveLength(2);
		const declStmt = q.statements?.[0];
		expect(declStmt?.declarations).toHaveLength(1);
		expect(declStmt?.declarations?.[0]).toMatchObject({ name: "v", typeText: "INT" });
		expect(declStmt?.declarations?.[0]?.init).toMatchObject({ kind: "literal" });
	});

	// sql-ref-syntax-ddl-declare-variable's own multi-name example: ONE shared data type and default
	// expression duplicated onto each declared name.
	it("multiple names in one DECLARE share the same typeText and init", () => {
		const r = parseDatabricks("BEGIN DECLARE var1, var2 DOUBLE DEFAULT rand(); SELECT var1 FROM t; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		const decls = q.statements?.[0]?.declarations;
		expect(decls).toHaveLength(2);
		expect(decls?.[0]).toMatchObject({ name: "var1", typeText: "DOUBLE" });
		expect(decls?.[1]).toMatchObject({ name: "var2", typeText: "DOUBLE" });
		expect(decls?.[0]?.init).toMatchObject({ kind: "function" });
		expect(decls?.[1]?.init).toMatchObject({ kind: "function" });
	});

	it("nameSpan covers exactly the declared variable's own token", () => {
		const r = parseDatabricks("BEGIN DECLARE counter INT DEFAULT 0; SELECT counter FROM t; END");
		const q = lower(r.tree);
		const sql = "BEGIN DECLARE counter INT DEFAULT 0; SELECT counter FROM t; END";
		const span = q.statements?.[0]?.declarations?.[0]?.nameSpan;
		expect(span).toBeDefined();
		expect(sql.slice(span!.start, span!.end)).toBe("counter");
	});

	// Declarations pool tree-wide (rootDeclarations), the SAME machinery infer.ts/symbols.ts already
	// use for a tsql body DECLARE or a Snowflake scripting LET — proven reachable from inside a
	// Databricks compound for the first time. Databricks itself has no Expr construct that resolves
	// to `kind: "variable"` yet (a declared session variable is referenced by a BARE identifier
	// everywhere, per sql-ref-syntax-ddl-declare-variable's own example — lexically identical to a
	// plain column reference, which lowers as `kind: "column"`). So this proves the DECLARATION side
	// of the wiring (visible tree-wide from any inner scope), not an end-to-end reference link.
	it("a compound-body DECLARE's declaration is visible tree-wide from a later inner statement's own scope", () => {
		const r = parseDatabricks("BEGIN DECLARE v INT DEFAULT 1; SELECT a FROM t; END");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		const tree = resolveScopes(q, "databricks");
		const selectScope = tree.root.children.find((c) => c.body.kind === "select" && c.body.from.length > 0);
		expect(selectScope).toBeDefined();
		const decls = rootDeclarations(selectScope!);
		expect(decls?.some((d) => d.name === "v" && d.typeText === "INT")).toBe(true);
	});
});

describe("nodeAt / referencesAt reach inner-statement expressions in a compound", () => {
	it("nodeAt finds a column reference inside statements[1]'s body, offset-based", () => {
		const sql = "BEGIN SELECT a1 FROM t1; SELECT a2 FROM t2; END";
		const r = parseDatabricks(sql);
		const q = lower(r.tree);
		const tree = resolveScopes(q, "databricks");
		const off = sql.lastIndexOf("a2");
		const hit = nodeAt(tree, off, q);
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("column");
	});

	it("referencesAt groups repeated column references within one inner statement", () => {
		const sql = "BEGIN SELECT a FROM t1 WHERE a > 0; SELECT b FROM t2; END";
		const r = parseDatabricks(sql);
		const q = lower(r.tree);
		const tree = resolveScopes(q, "databricks");
		const off = sql.indexOf("a > 0");
		const occ = referencesAt(tree, off, undefined, q);
		expect(occ).not.toBeNull();
		expect(occ!.occurrences.length).toBeGreaterThanOrEqual(2);
	});
});

describe("time-travel @ shorthand", () => {
	it("parses t@v123 and lowers to the table t", () => {
		const r = parseDatabricks("SELECT * FROM t@v123");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("select");
		expect(ir.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("parses the timestamp form t@20240101000000000", () => {
		expect(parseDatabricks("SELECT * FROM t@20240101000000000").errors).toBe(0);
	});
});
