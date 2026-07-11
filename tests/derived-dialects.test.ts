// tests/derived-dialects.test.ts — the derived-dialect → dialect map. The grammars parse many more
// engines; this table is where that family knowledge lives, so consumers (the LSP config, an editor
// reading an engine name) never re-derive it. The map must stay exact: an engine we don't genuinely
// serve resolves to undefined, never to a guess.
import { describe, it, expect } from "vitest";
import { DERIVED_DIALECTS, resolveDialect, parse, type Dialect } from "../src/index.js";

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

describe("resolveDialect", () => {
	it("every dialect name resolves to itself (both vocabularies accepted)", () => {
		for (const d of DIALECTS) expect(resolveDialect(d)).toBe(d);
	});

	it("maps the derived-dialect families to their primary dialect", () => {
		// each key is a real engine / product name
		expect(resolveDialect("athena")).toBe("trino"); // Athena engine v3 executes on Trino
		expect(resolveDialect("presto")).toBe("trino"); // Trino's predecessor
		expect(resolveDialect("spark")).toBe("databricks"); // Databricks SQL = Spark SQL
		expect(resolveDialect("glue")).toBe("databricks"); // AWS Glue runs Spark
		expect(resolveDialect("fabric")).toBe("tsql");
		expect(resolveDialect("synapse")).toBe("tsql");
		expect(resolveDialect("sqlserver")).toBe("tsql");
		expect(resolveDialect("mariadb")).toBe("mysql"); // near-superset core SQL; MariaDB-only extensions are an Open Gap
		expect(resolveDialect("postgresql")).toBe("postgres"); // alternate engine-name spelling (alias class)
	});

	it("is case-insensitive and trims", () => {
		expect(resolveDialect("Athena")).toBe("trino");
		expect(resolveDialect(" FABRIC ")).toBe("tsql");
	});

	it("an unserved engine resolves to undefined — never a guess", () => {
		for (const unknown of ["clickhouse", "exasol", "oracle", "materialize", ""]) {
			expect(resolveDialect(unknown)).toBeUndefined();
		}
	});

	it("every mapped dialect is dispatchable through parse()", () => {
		// the map may only ever point at wired dialects — a typo'd value must fail here
		for (const [engine, dialect] of Object.entries(DERIVED_DIALECTS)) {
			expect(DIALECTS, `DERIVED_DIALECTS["${engine}"]`).toContain(dialect);
			expect(parse("SELECT 1", dialect).errors).toBe(0);
		}
	});
});
