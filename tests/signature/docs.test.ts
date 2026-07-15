import { describe, expect, it } from "vitest";
import { FN_DOCS, lookupFnDoc } from "../../src/signature/docs.js";
import { SIGNATURES } from "../../src/signature/signatures.js";
import type { Dialect } from "../../src/dialect.js";

// issue #34 — the per-NAME function docs table. Structural gates over every emitted entry
// (this suite must not depend on the corpus: the generated tables are committed), plus a
// known-name spot check per dialect pinning the URL host each dialect must link to.

const DIALECTS = Object.keys(FN_DOCS) as Dialect[];

describe("fn-docs tables — structural gates", () => {
	it("every entry has at least one payload field and a valid https URL when docUrl is present", () => {
		for (const dialect of DIALECTS) {
			for (const [name, doc] of Object.entries(FN_DOCS[dialect])) {
				expect(doc.docUrl !== undefined || doc.description !== undefined, `${dialect}.${name} is empty`).toBe(
					true,
				);
				if (doc.docUrl !== undefined) {
					const url = new URL(doc.docUrl); // throws on malformed
					expect(url.protocol, `${dialect}.${name} docUrl protocol`).toBe("https:");
				}
				expect(["vendor-docs", "spark-docs", "authored"]).toContain(doc.origin);
			}
		}
	});

	it("every docs key is a lowercased name known to the same dialect's signature table", () => {
		for (const dialect of DIALECTS) {
			for (const name of Object.keys(FN_DOCS[dialect])) {
				expect(name).toBe(name.toLowerCase());
				expect(SIGNATURES[dialect][name], `${dialect}.${name} has docs but no signature`).toBeDefined();
			}
		}
	});

	it("EVERY signature name has a docUrl — total link coverage, no dialect exceptions", () => {
		for (const dialect of DIALECTS) {
			for (const name of Object.keys(SIGNATURES[dialect])) {
				expect(FN_DOCS[dialect][name]?.docUrl, `${dialect}.${name} has no docUrl`).toBeDefined();
			}
		}
	});

	it("descriptions are single-line, non-empty, and tooltip-sized", () => {
		for (const dialect of DIALECTS) {
			for (const [name, doc] of Object.entries(FN_DOCS[dialect])) {
				if (doc.description === undefined) continue;
				expect(doc.description.length, `${dialect}.${name} description empty`).toBeGreaterThan(0);
				expect(doc.description.includes("\n"), `${dialect}.${name} description multi-line`).toBe(false);
				expect(doc.description.length, `${dialect}.${name} description too long`).toBeLessThanOrEqual(400);
			}
		}
	});
});

// One well-known name per dialect: the docUrl must point at the dialect's own doc host. Pins
// the resolver's host/path mapping without depending on page-internal structure.
const SPOT: Record<Dialect, { name: string; host: string; path: string; hash?: string }> = {
	databricks: { name: "abs", host: "docs.databricks.com", path: "/functions/abs" },
	tsql: { name: "abs", host: "learn.microsoft.com", path: "/sql/t-sql/functions/abs-transact-sql" },
	snowflake: { name: "abs", host: "docs.snowflake.com", path: "/functions/abs" },
	bigquery: {
		name: "acos",
		host: "cloud.google.com",
		path: "/standard-sql/mathematical_functions",
		hash: "#acos",
	},
	redshift: { name: "abs", host: "docs.aws.amazon.com", path: "/redshift/latest/dg/r_ABS.html" },
	// abs is a curated override there (no source page, hence no docUrl by design) — use a harvested name.
	postgres: { name: "acos", host: "www.postgresql.org", path: "/docs/18/functions-math.html" },
	// duckdb anchor: kramdown auto_id of the heading `abs(x)` (live-verified scheme).
	duckdb: { name: "abs", host: "duckdb.org", path: "/sql/functions/numeric.html", hash: "#absx" },
	trino: { name: "abs", host: "trino.io", path: "/functions/math.html", hash: "#abs" },
	sqlite: { name: "abs", host: "sqlite.org", path: "/lang_corefunc.html", hash: "#abs" },
	// mysql anchor: the refman's own name= id, underscores spelled as hyphens.
	mysql: {
		name: "abs",
		host: "dev.mysql.com",
		path: "/refman/8.4/en/mathematical-functions.html",
		hash: "#function_abs",
	},
};

describe("fn-docs — per-dialect docUrl spot checks", () => {
	for (const dialect of DIALECTS) {
		const spot = SPOT[dialect];
		it(`${dialect}: ${spot.name} links to ${spot.host}`, () => {
			const doc = lookupFnDoc(dialect, spot.name);
			expect(doc?.docUrl, `${dialect}.${spot.name} has no docUrl`).toBeDefined();
			const url = new URL(doc!.docUrl!);
			expect(url.host).toBe(spot.host);
			expect(url.pathname).toContain(spot.path);
			if (spot.hash !== undefined) expect(url.hash).toBe(spot.hash);
		});
	}
});
