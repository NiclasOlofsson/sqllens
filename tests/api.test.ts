import { describe, expect, it } from "vitest";
import {
	analyze,
	deriveSymbols,
	formatType,
	lineage,
	parse,
	partSpanOf,
	partSpansOf,
	qualify,
	resolveScopes,
	Schema,
	toAst,
	toScopes,
	TypeInfo,
	type Dialect,
	type Lineage,
	type QueryExpr,
	type ScopeTree,
} from "../src/index.js";

const DIALECTS: Dialect[] = [
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

describe("public API — uniform entry", () => {
	it("parse(sql, dialect) returns the IR as `ast`, an error count, and the raw CST escape hatch, for every dialect", () => {
		for (const dialect of DIALECTS) {
			const r = parse("SELECT a FROM t", dialect);
			expect(r.errors).toBe(0);
			expect(r.ast.kind).toBe("query");
			// `cst` stays reachable for tokens/spans.
			expect(r.cst).toBeDefined();
			expect(r.cst.start).toBeDefined();
		}
	});

	it("reports syntax errors without throwing", () => {
		const r = parse("SELECT a FROM t @@@", "databricks");
		expect(r.errors).toBeGreaterThan(0);
		// still returns a usable IR — a syntax error is reported, not raised
		expect(r.ast.kind).toBe("query");
	});

	it("analyze(sql, dialect, opts) yields every tier as a terminal value", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		for (const dialect of DIALECTS) {
			const a = analyze("SELECT a, b FROM t", dialect, { schema });
			expect(a.ast.kind).toBe("query");
			expect(a.errors).toBe(0);
			expect(a.scopes.root).toBeDefined();
			expect(a.diagnostics).toEqual([]);
			// columnsOf is the typed accessor — no raw Map leaks.
			expect(a.qualification.columnsOf(a.scopes.root)).toEqual(["a", "b"]);
			expect(a.types.typeOf).toBeTypeOf("function");
			expect(a.lineage.all.length).toBeGreaterThanOrEqual(0);
			expect(Array.isArray(a.symbols)).toBe(true);
		}
	});

	it("analyze without a schema still produces scopes + symbols", () => {
		const a = analyze("SELECT a FROM t", "databricks");
		expect(a.scopes.root).toBeDefined();
		expect(Array.isArray(a.symbols)).toBe(true);
		// no schema → no diagnostics about unknown columns it cannot check
		expect(a.diagnostics).toEqual([]);
	});

	it("analyze() carries the parse tier: positioned syntax diagnostics, tokens, cst", () => {
		const a = analyze("select a fromm t", "databricks");
		expect(a.errors).toBeGreaterThan(0);
		// The syntax error is retrievable WITHOUT a second parse() call, with position:
		expect(a.syntaxDiagnostics.length).toBeGreaterThan(0);
		expect(a.syntaxDiagnostics[0]).toMatchObject({ line: 1 });
		expect(a.tokens.length).toBeGreaterThan(0);
		expect(a.cst).toBeDefined();
		// Semantic diagnostics keep their own field and shape:
		expect(Array.isArray(a.diagnostics)).toBe(true);
	});
});

describe("public API — lift helpers are idempotent", () => {
	it("toAst: string -> IR; IR -> identity", () => {
		const fromString = toAst("SELECT a FROM t", "databricks");
		expect(fromString.kind).toBe("query");
		// identity on an existing IR
		expect(toAst(fromString)).toBe(fromString);
	});

	it("toScopes: string -> ScopeTree; IR -> resolve; ScopeTree -> identity", () => {
		const ast = toAst("SELECT a FROM t", "databricks");
		const fromIr = toScopes(ast, { dialect: "databricks" });
		expect(fromIr.root).toBeDefined();
		// identity on an existing ScopeTree
		expect(toScopes(fromIr)).toBe(fromIr);
		// string entry
		const fromString = toScopes("SELECT a FROM t", { dialect: "tsql" });
		expect(fromString.root).toBeDefined();
		expect(fromString.root.dialect).toBe("tsql");
	});

	it("toScopes(resolveScopes(...)) is identity (idempotent lift through the ScopeTree.kind tag)", () => {
		const scopes = resolveScopes(toAst("SELECT a FROM t", "databricks"), "databricks");
		expect(scopes.kind).toBe("scopes");
		expect(toScopes(scopes)).toBe(scopes);
	});

	it("semantic methods accept a string, an IR, or a ScopeTree via the lift", () => {
		const schema = new Schema({ t: { a: "int" } });
		const ast: QueryExpr = toAst("SELECT a FROM t", "snowflake");
		const scopes: ScopeTree = toScopes(ast, { dialect: "snowflake" });

		// qualify accepts each upstream shape
		expect(qualify(scopes, schema).columnsOf(scopes.root)).toEqual(["a"]);
		expect(qualify(ast, schema, { dialect: "snowflake" }).diagnostics).toEqual([]);
		expect(qualify("SELECT a FROM t", schema, { dialect: "snowflake" }).diagnostics).toEqual([]);

		// lineage + deriveSymbols accept the same
		expect(lineage(scopes, schema).all.length).toBe(1);
		expect(lineage("SELECT a FROM t", schema, { dialect: "snowflake" }).all.length).toBe(1);
		expect(deriveSymbols(scopes, schema).length).toBeGreaterThan(0);
		expect(deriveSymbols("SELECT a FROM t", schema, { dialect: "snowflake" }).length).toBeGreaterThan(0);
	});
});

describe("public API — typed result wrappers (no raw collections)", () => {
	it("TypeInfo exposes typeOf(expr), Lineage exposes originsOf(column) + all", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		const a = analyze("SELECT a, b FROM t", "databricks", { schema });

		const types: TypeInfo = a.types;
		const body = a.ast.body;
		// the first projection's expr is `a` (int)
		if (body.kind === "select") {
			const t = types.typeOf(body.projections[0]!.expr, a.scopes.root);
			expect(t).toBeDefined();
		}

		const lin: Lineage = a.lineage;
		const origins = lin.originsOf("a");
		expect(origins.map((o) => o.column)).toContain("a");
	});
});

describe("public API — immutable IR + independent passes", () => {
	it("the IR is frozen after lower()", () => {
		const ast = toAst("SELECT a FROM t WHERE a > 1", "databricks");
		expect(Object.isFrozen(ast)).toBe(true);
		expect(Object.isFrozen(ast.body)).toBe(true);
		// mutating a frozen node is a no-op (or throws in strict mode) — assert it didn't take
		try {
			(ast as { kind: string }).kind = "mutated";
		} catch {
			/* strict-mode throw is fine */
		}
		expect(ast.kind).toBe("query");
	});

	// Property test: feed ONE scopes to all passes in varying orders; the IR must be
	// unchanged and each pass's result independent of call order.
	it("running qualify / lineage / deriveSymbols on the same scopes in any order is order-independent and never mutates the IR", () => {
		const schema = new Schema({ t: { a: "int", b: "string" }, u: { a: "int", c: "double" } });
		const sqls = [
			"SELECT a, b FROM t",
			"SELECT t.a, u.c FROM t JOIN u ON t.a = u.a",
			"WITH c AS (SELECT a FROM t) SELECT a FROM c",
			"SELECT a FROM t UNION ALL SELECT a FROM u",
		];
		for (const sql of sqls) {
			const scopes = toScopes(sql, { dialect: "databricks" });
			const snapshot = JSON.stringify(scopes.root.body, irReplacer);

			// order A
			const qA = qualify(scopes, schema);
			const lA = lineage(scopes, schema);
			const sA = deriveSymbols(scopes, schema);

			// order B — reversed, same scopes object
			const sB = deriveSymbols(scopes, schema);
			const lB = lineage(scopes, schema);
			const qB = qualify(scopes, schema);

			// independence: identical results regardless of order
			expect(qA.columnsOf(scopes.root)).toEqual(qB.columnsOf(scopes.root));
			expect(JSON.stringify(lA.all, irReplacer)).toEqual(JSON.stringify(lB.all, irReplacer));
			expect(sA.length).toEqual(sB.length);

			// the shared IR was not mutated by any pass
			expect(JSON.stringify(scopes.root.body, irReplacer)).toEqual(snapshot);
		}
	});
});

// Drop the `cst` back-refs when snapshotting the IR (foreign CST objects are cyclic and unfrozen).
function irReplacer(key: string, value: unknown): unknown {
	return key === "cst" || key === "aliasCst" ? undefined : value;
}

describe("dialect rides on the IR (issue #7)", () => {
	it("lower() stamps the dialect; toScopes needs no opts", () => {
		const { ast } = parse("SELECT 10 / 4 AS r FROM t", "snowflake");
		expect(ast.dialect).toBe("snowflake");

		const scopes = toScopes(ast); // no opts — the tag drives it
		if (ast.body.kind !== "select") throw new Error("expected a select body");

		const types = new TypeInfo(new Schema({}));
		const t = types.typeOf(ast.body.projections[0]!.expr, scopes.root);
		// Snowflake division is decimal (int/int → decimal), NOT Spark's double —
		// proof the tag (not a default) selected the inference rules.
		expect(formatType(t)).toBe("decimal");
	});

	it("a bare hand-built IR with no dialect throws instead of guessing", () => {
		const bare = {
			kind: "query",
			ctes: [],
			body: {
				kind: "select",
				projections: [],
				from: [],
				columns: [],
				aggregated: false,
				cst: null as never,
			},
			cst: null as never,
		};
		expect(() => toScopes(bare as never)).toThrow(/dialect/);
	});
});

describe("PartSpan helpers are exported from the barrel", () => {
	it("partSpanOf/partSpansOf are exported from the barrel", () => {
		expect(typeof partSpanOf).toBe("function");
		expect(typeof partSpansOf).toBe("function");
	});

	it("partSpanOf computes a real span from a Projection's aliasCst", () => {
		const r = parse("select 1 as x", "databricks");
		const body = r.ast.body as { projections: { aliasCst?: unknown }[] };
		const aliasCst = body.projections[0]!.aliasCst;
		expect(aliasCst).toBeDefined();
		const span = partSpanOf(aliasCst as never);
		expect(span).toBeDefined();
		expect(span!.start).toBeLessThan(span!.end);
	});
});
