import { describe, expect, it } from "vitest";
import { parse } from "../../src/index.js";
import { qualifiedNameOf, synthesizedQualifiedName } from "../../src/ir/qualified-name.js";
import { DATABRICKS_NAME_CONFIG } from "../../src/databricks/fold.js";
import { TSQL_NAME_CONFIG } from "../../src/tsql/fold.js";
import { BIGQUERY_NAME_CONFIG } from "../../src/bigquery/fold.js";
import { SNOWFLAKE_NAME_CONFIG } from "../../src/snowflake/fold.js";
import { SQLITE_NAME_CONFIG } from "../../src/sqlite/fold.js";

// issue #38 — QualifiedName: the structured relation/column name the IR carries. Lossless (parts
// exactly as written, partial qualification represented, never defaulted) and never-wrong (roles
// only for parts that exist; key folded per the dialect's own rules; consumers never parse or
// assemble dotted strings themselves).

describe("qualifiedNameOf — source-derived names", () => {
	it("full three-part databricks name: parts, right-aligned roles, folded key, fqn as written", () => {
		const q = qualifiedNameOf(["Prod", "Gold", "Orders"], DATABRICKS_NAME_CONFIG);
		expect(q.name).toBe("Orders");
		expect(q.parts).toEqual(["Prod", "Gold", "Orders"]);
		expect(q.catalog).toBe("Prod");
		expect(q.schema).toBe("Gold");
		expect(q.key).toEqual(["prod", "gold", "orders"]); // databricks folds identifiers to lower
		expect(q.fqn).toBe("Prod.Gold.Orders"); // as written, never re-cased
	});

	it("partial qualification: schema.table assigns the INNER role only, catalog stays absent", () => {
		const q = qualifiedNameOf(["gold", "orders"], DATABRICKS_NAME_CONFIG);
		expect(q.schema).toBe("gold");
		expect(q.catalog).toBeUndefined();
		expect(q.server).toBeUndefined();
		expect(q.fqn).toBe("gold.orders");
	});

	it("bare name: no roles at all, fqn is just the name", () => {
		const q = qualifiedNameOf(["orders"], DATABRICKS_NAME_CONFIG);
		expect(q.name).toBe("orders");
		expect(q.parts).toEqual(["orders"]);
		expect(q.catalog).toBeUndefined();
		expect(q.schema).toBeUndefined();
		expect(q.fqn).toBe("orders");
	});

	it("tsql four-part name carries the server role", () => {
		const q = qualifiedNameOf(["LNK", "prod", "dbo", "Orders"], TSQL_NAME_CONFIG);
		expect(q.server).toBe("LNK");
		expect(q.catalog).toBe("prod");
		expect(q.schema).toBe("dbo");
		expect(q.name).toBe("Orders");
	});

	it("tsql elided middle part (db..table): the elided role is EXPLICITLY empty, not absent", () => {
		const q = qualifiedNameOf(["prod", "", "Orders"], TSQL_NAME_CONFIG);
		expect(q.catalog).toBe("prod");
		expect(q.schema).toBe(""); // written-and-elided: '' — distinct from not written at all
		expect(q.name).toBe("Orders");
	});

	it("quoted parts keep their as-written spelling in parts/fqn, and fold per quoting semantics in key", () => {
		// snowflake: unquoted folds UP, quoted preserves — the identity difference must survive.
		const unq = qualifiedNameOf(["sales", "orders"], SNOWFLAKE_NAME_CONFIG);
		expect(unq.key).toEqual(["SALES", "ORDERS"]);
		const q = qualifiedNameOf(['"sales"', '"orders"'], SNOWFLAKE_NAME_CONFIG);
		expect(q.parts).toEqual(["sales", "orders"]); // delimiters stripped for display
		expect(q.key).toEqual(["sales", "orders"]); // quoted = case-preserved identity
		expect(q.fqn).toBe('"sales"."orders"'); // the user's quoting is information — kept
		expect(q.name).toBe("orders");
	});

	it("bigquery relation parts keep case in the key (case-preserving table identity)", () => {
		const q = qualifiedNameOf(["MyProject", "MyDataset", "MyTable"], BIGQUERY_NAME_CONFIG);
		expect(q.key).toEqual(["MyProject", "MyDataset", "MyTable"]);
		expect(q.catalog).toBe("MyProject"); // vendor vocabulary: project
		expect(q.schema).toBe("MyDataset"); // vendor vocabulary: dataset
	});

	it("a two-level dialect (sqlite) never assigns catalog", () => {
		const q = qualifiedNameOf(["aux", "t"], SQLITE_NAME_CONFIG);
		expect(q.schema).toBe("aux"); // the attached-database name
		expect(q.catalog).toBeUndefined();
	});

	it("parts beyond the dialect's namespace depth: extra parts stay in parts/key, no role is invented", () => {
		const q = qualifiedNameOf(["a", "b", "c", "t"], DATABRICKS_NAME_CONFIG); // 3-level dialect, 4 parts
		expect(q.parts).toEqual(["a", "b", "c", "t"]);
		expect(q.catalog).toBe("b"); // right-aligned within the known roles
		expect(q.schema).toBe("c");
		expect(q.server).toBeUndefined(); // databricks has no server level — never fabricated
	});
});

describe("lower() carries relation on every table source (stage 2)", () => {
	it("databricks: FROM prod.gold.orders builds roles, key and as-written fqn", () => {
		const r = parse("select 1 from Prod.Gold.Orders", "databricks");
		const src = (r.ast.body as { from: { relation?: unknown }[] }).from[0] as {
			relation: { name: string; catalog?: string; schema?: string; key: string[]; fqn: string };
		};
		expect(src.relation.name).toBe("Orders");
		expect(src.relation.catalog).toBe("Prod");
		expect(src.relation.schema).toBe("Gold");
		expect(src.relation.key).toEqual(["prod", "gold", "orders"]);
		expect(src.relation.fqn).toBe("Prod.Gold.Orders");
	});

	it("tsql: a four-part name carries the server role", () => {
		const r = parse("select 1 from lnk.prod.dbo.orders", "tsql");
		const src = (r.ast.body as { from: { relation?: unknown }[] }).from[0] as {
			relation: { server?: string; catalog?: string; schema?: string; name: string };
		};
		expect(src.relation.server).toBe("lnk");
		expect(src.relation.catalog).toBe("prod");
		expect(src.relation.schema).toBe("dbo");
		expect(src.relation.name).toBe("orders");
	});

	it("every dialect's simple FROM carries a relation whose key binds the table", () => {
		for (const d of [
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
		] as const) {
			const r = parse("select 1 from gold.orders", d);
			const src = (r.ast.body as { from: { relation?: { name: string; parts: string[] } }[] }).from[0]!;
			expect(src.relation, d).toBeDefined();
			expect(src.relation!.name, d).toBe("orders");
			expect(src.relation!.parts, d).toEqual(["gold", "orders"]);
		}
	});
});

describe("synthesizedQualifiedName — provider-derived names (no source text)", () => {
	it("plain parts join bare", () => {
		const q = synthesizedQualifiedName(["gold", "orders"], DATABRICKS_NAME_CONFIG);
		expect(q.fqn).toBe("gold.orders");
		expect(q.schema).toBe("gold");
	});

	it("a part needing delimiters gets the dialect's quoting, with the close delimiter escaped", () => {
		const db = synthesizedQualifiedName(["my schema", "or`ders"], DATABRICKS_NAME_CONFIG);
		expect(db.fqn).toBe("`my schema`.`or``ders`");
		const ts = synthesizedQualifiedName(["my schema", "orders"], TSQL_NAME_CONFIG);
		expect(ts.fqn).toBe("[my schema].orders");
	});
});
