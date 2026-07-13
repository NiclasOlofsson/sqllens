import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { Schema, type Column } from "../src/qualify/schema.js";
import { CallbackSchema, type TableResolver } from "../src/qualify/schema-provider.js";
import { analyze, parse, qualify, DefaultTemplateProvider } from "../src/index.js";

// ---------------------------------------------------------------------------
// SchemaProvider + CallbackSchema (Task 7). A resolve-on-demand catalog: the
// analysis pipeline stays 100% sync (columnsFor answers from whatever the host
// cache holds NOW; unknown tables degrade to unknown types exactly like a
// missing mapping entry), and asynchrony lives entirely in prime(), which
// drains recorded misses through the resolver and bumps a monotonic `version`
// so SqlDocument.analyze invalidates its memo.
// ---------------------------------------------------------------------------

/** A resolver over a host-side cache Map (keyed by folded dotted path). `fetch` warms the cache
 *  from a fixed "backend" that knows `t2` — modelling the async metadata load. */
function makeResolver(cache: Map<string, Column[]>): TableResolver {
	return {
		resolve: (parts) => cache.get(parts.join(".")),
		fetch: async (missing) => {
			for (const m of missing) {
				if (m.join(".") === "t2") cache.set("t2", [{ name: "b", type: "int" }]);
			}
		},
	};
}

describe("CallbackSchema — fold contract at the resolver boundary", () => {
	it("folds parts (Task 3 rules) before delegating — the resolver receives FOLDED parts", () => {
		const seen: string[][] = [];
		const cb = new CallbackSchema({
			resolve: (parts) => {
				seen.push(parts);
				return undefined;
			},
		});
		cb.columnsFor(["MyTable"], "snowflake"); // snowflake unquoted → UPPER
		cb.columnsFor(['"KeepCase"'], "snowflake"); // snowflake quoted → preserved
		cb.columnsFor(["Foo"], "databricks"); // databricks → lower
		expect(seen[0]).toEqual(["MYTABLE"]);
		expect(seen[1]).toEqual(["KeepCase"]);
		expect(seen[2]).toEqual(["foo"]);
	});

	it("tables() reflects only what the resolver has revealed (a miss reveals nothing)", () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		expect(cb.tables()).toEqual([]);
		cb.columnsFor(["t1"], "databricks");
		expect(cb.tables()).toEqual(["t1"]);
		cb.columnsFor(["nope"], "databricks");
		expect(cb.tables()).toEqual(["t1"]);
	});
});

describe("CallbackSchema — analyze over a resolve-on-demand catalog", () => {
	it("(a) resolves a known table and records a miss (unknown-table) for an unknown one", () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t1;\nSELECT * FROM t2;", "databricks");
		const a = doc.analyze(cb);
		expect(a.diagnostics.filter((d) => d.kind === "unknown-table").map((d) => d.message)).toEqual([
			"Unknown table: t2",
		]);
		expect(cb.misses).toEqual([["t2"]]);
	});

	it("(b) prime() drains misses, bumps version, and re-analyze resolves the fetched table", async () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t1;\nSELECT * FROM t2;", "databricks");

		const first = doc.analyze(cb);
		expect(first.diagnostics.some((d) => d.kind === "unknown-table")).toBe(true);
		expect(cb.version).toBe(0);

		const changed = await cb.prime();
		expect(changed).toBe(true);
		expect(cb.version).toBe(1);
		expect(cb.misses).toEqual([]); // drained

		const second = doc.analyze(cb);
		expect(second).not.toBe(first); // memo invalidated by the version bump
		expect(second.diagnostics.some((d) => d.kind === "unknown-table")).toBe(false); // t2 now resolves
	});

	it("(b2) prime() with nothing new returns false and does NOT bump version", async () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		// A resolver whose fetch warms nothing — t3 stays unknown.
		const resolver: TableResolver = { resolve: (parts) => cache.get(parts.join(".")), fetch: async () => {} };
		const cb = new CallbackSchema(resolver);
		const doc = SqlDocument.create("SELECT * FROM t3", "databricks");
		doc.analyze(cb);
		expect(cb.misses).toEqual([["t3"]]);
		const changed = await cb.prime();
		expect(changed).toBe(false);
		expect(cb.version).toBe(0);
		expect(cb.misses).toEqual([["t3"]]); // still missing
	});

	it("(b3) two concurrent prime() calls coalesce — one fetch, one version bump (Task 8)", async () => {
		// The LSP fires prime() per publish, and opening a document triggers two publishes — so two
		// prime() calls can race. Without coalescing both snapshot the same miss and both fetch + bump.
		// Guard: the second prime() returns the first's in-flight promise, so exactly one fetch runs and
		// version advances by exactly one.
		const cache = new Map<string, Column[]>();
		let fetches = 0;
		const resolver: TableResolver = {
			resolve: (parts) => cache.get(parts.join(".")),
			fetch: async (missing) => {
				fetches++;
				await new Promise((r) => setTimeout(r, 5)); // a real async gap so the second prime() overlaps
				for (const m of missing) if (m.join(".") === "t2") cache.set("t2", [{ name: "b", type: "int" }]);
			},
		};
		const cb = new CallbackSchema(resolver);
		const doc = SqlDocument.create("SELECT * FROM t2", "databricks");
		doc.analyze(cb);
		expect(cb.misses).toEqual([["t2"]]);

		const [r1, r2] = await Promise.all([cb.prime(), cb.prime()]);
		expect(r1).toBe(true);
		expect(r2).toBe(true);
		expect(fetches).toBe(1); // coalesced — not two fetches
		expect(cb.version).toBe(1); // one bump, not two
		expect(cb.misses).toEqual([]); // drained

		// After it settles, a fresh prime() with no misses is a clean no-op false.
		expect(await cb.prime()).toBe(false);
	});

	it("(c) a plain Schema memoizes analyze() exactly as before (version constant 0)", () => {
		const schema = new Schema({ t1: { a: "int" } });
		expect(schema.version).toBe(0);
		const doc = SqlDocument.create("SELECT * FROM t1", "databricks");
		const a = doc.analyze(schema);
		const b = doc.analyze(schema);
		expect(b).toBe(a); // same instance — identity memo hit, no version thrash
	});

	it("(d) misses are distinct and in first-seen order", () => {
		const cache = new Map<string, Column[]>();
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t2;\nSELECT * FROM t3;\nSELECT * FROM t2;", "databricks");
		doc.analyze(cb);
		expect(cb.misses).toEqual([["t2"], ["t3"]]);
	});
});

describe("Schema — optional per-column nullability in the mapping (Task 9)", () => {
	it("a leaf object carries type/nullable; a bare-string leaf leaves nullable undefined", () => {
		const schema = new Schema({ t: { a: "int", b: { type: "int", nullable: false } } });
		const cols = schema.columnsFor(["t"], "databricks");
		expect(cols).toBeDefined();
		const a = cols!.find((c) => c.name === "a");
		const b = cols!.find((c) => c.name === "b");
		expect(a).toEqual({ name: "a", type: "int" });
		expect(a!.nullable).toBeUndefined();
		expect(b).toEqual({ name: "b", type: "int", nullable: false });
	});

	it("nesting detection still classifies db -> table -> columns with mixed leaf forms", () => {
		const schema = new Schema({
			db: { t: { a: "int", b: { type: "int", nullable: false }, c: { nullable: true } } },
		});
		const cols = schema.columnsFor(["db", "t"], "databricks");
		expect(cols).toBeDefined();
		expect(cols).toEqual([
			{ name: "a", type: "int" },
			{ name: "b", type: "int", nullable: false },
			{ name: "c", nullable: true },
		]);
	});

	// A leaf object REQUIRES a boolean `nullable` — otherwise a table whose single column is
	// named `type` would classify as a leaf descriptor and the table would silently VANISH
	// (never-wrong violated: a wrong answer, not an unknown). A type-only object also says
	// nothing the bare string doesn't, so requiring the boolean costs no expressiveness.
	it("a table whose only column is named `type` stays a TABLE — it does not vanish", () => {
		const schema = new Schema({ t: { type: "varchar" } });
		expect(schema.columnsFor(["t"], "databricks")).toEqual([{ name: "type", type: "varchar" }]);
		expect(schema.tables("databricks")).toEqual(["t"]);
	});

	it("same two levels deep: { db: { t: { type: 'varchar' } } } reads db -> table -> column", () => {
		const schema = new Schema({ db: { t: { type: "varchar" } } });
		expect(schema.columnsFor(["db", "t"], "databricks")).toEqual([{ name: "type", type: "varchar" }]);
		expect(schema.tables("databricks")).toEqual(["t"]);
	});

	it("columns named `type` AND `nullable` with string values — an all-string dict is always a table", () => {
		const schema = new Schema({ t: { type: "varchar", nullable: "varchar" } });
		expect(schema.columnsFor(["t"], "databricks")).toEqual([
			{ name: "type", type: "varchar" },
			{ name: "nullable", type: "varchar" },
		]);
	});

	it("a nullable-only leaf ({ nullable: false }) is a leaf — type absent stays unknown", () => {
		const schema = new Schema({ t: { b: { nullable: false } } });
		const cols = schema.columnsFor(["t"], "databricks");
		expect(cols).toEqual([{ name: "b", nullable: false }]);
		expect(cols![0].type).toBeUndefined();
	});

	it("an empty dict is not leaf-eligible — keeps today's reading (unregistered, unknown)", () => {
		// Pre-Task-9 behavior preserved: {} never classifies as a table (entries.length > 0)
		// and now never as a leaf either (no boolean nullable) — the table is simply unknown.
		const schema = new Schema({ t: {} });
		expect(schema.columnsFor(["t"], "databricks")).toBeUndefined();
		expect(schema.tables("databricks")).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// The `world` capability (step 2 of the provider redesign) — a provider states
// what a columnsFor MISS means: "closed" (complete world → unknown-table may
// fire) vs "open" (unknown → never diagnose). The shipped DefaultTemplateProvider
// is open, which makes it the always-present schema default.
// ---------------------------------------------------------------------------
describe("SchemaProvider.world — closed vs open miss semantics", () => {
	it("a declared Schema is closed: star expansion over an unknown table fires unknown-table", () => {
		const { ast } = parse("select * from t", "databricks");
		const q = qualify(ast, new Schema({ u: { x: "int" } }));
		expect(q.diagnostics.map((d) => d.kind)).toContain("unknown-table");
	});

	it("an open provider never fires unknown-table on a miss", () => {
		const { ast } = parse("select * from t", "databricks");
		const q = qualify(ast, new DefaultTemplateProvider());
		expect(q.diagnostics).toEqual([]);
	});

	it("schema-free analyze() runs the full pipeline with NO miss-driven diagnostics", () => {
		const a = analyze("select * from t", "databricks");
		expect(a.diagnostics).toEqual([]);
	});

	it("positive knowledge still diagnoses regardless of world (unknown-column on a known table)", () => {
		class Knows extends DefaultTemplateProvider {
			override columnsFor(parts: string[]): { name: string }[] | undefined {
				return parts.join(".") === "u" ? [{ name: "x" }] : undefined;
			}
		}
		const { ast } = parse("select nope from u", "databricks");
		const q = qualify(ast, new Knows());
		expect(q.diagnostics.map((d) => d.kind)).toContain("unknown-column");
	});
});
