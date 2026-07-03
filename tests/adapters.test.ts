// tests/adapters.test.ts — the dbt-adapter → dialect map. The eight grammars serve ~15 dbt
// adapters; this table is where that family knowledge lives, so consumers (the LSP config, an
// editor reading profiles.yml `type:`) never re-derive it. The map must stay exact: an adapter we
// don't genuinely serve resolves to undefined, never to a guess.
import { describe, it, expect } from "vitest";
import { ADAPTER_DIALECTS, adapterDialect, parse, type Dialect } from "../src/index.js";

const DIALECTS: Dialect[] = ["databricks", "tsql", "snowflake", "bigquery", "redshift", "postgres", "duckdb", "trino"];

describe("adapterDialect", () => {
	it("every dialect name resolves to itself (both vocabularies accepted)", () => {
		for (const d of DIALECTS) expect(adapterDialect(d)).toBe(d);
	});

	it("maps the aliased adapter families to their engine dialect", () => {
		// each key is a real profiles.yml `type:` value
		expect(adapterDialect("athena")).toBe("trino"); // Athena engine v3 executes on Trino
		expect(adapterDialect("presto")).toBe("trino"); // pre-rename Trino adapter
		expect(adapterDialect("spark")).toBe("databricks"); // Databricks SQL = Spark SQL
		expect(adapterDialect("glue")).toBe("databricks"); // AWS Glue runs Spark
		expect(adapterDialect("fabric")).toBe("tsql");
		expect(adapterDialect("synapse")).toBe("tsql");
		expect(adapterDialect("sqlserver")).toBe("tsql");
	});

	it("is case-insensitive and trims", () => {
		expect(adapterDialect("Athena")).toBe("trino");
		expect(adapterDialect(" FABRIC ")).toBe("tsql");
	});

	it("an unserved adapter resolves to undefined — never a guess", () => {
		for (const unknown of ["clickhouse", "exasol", "oracle", "materialize", ""]) {
			expect(adapterDialect(unknown)).toBeUndefined();
		}
	});

	it("every mapped dialect is dispatchable through parse()", () => {
		// the map may only ever point at wired dialects — a typo'd value must fail here
		for (const [adapter, dialect] of Object.entries(ADAPTER_DIALECTS)) {
			expect(DIALECTS, `ADAPTER_DIALECTS["${adapter}"]`).toContain(dialect);
			expect(parse("SELECT 1", dialect).errors).toBe(0);
		}
	});
});
