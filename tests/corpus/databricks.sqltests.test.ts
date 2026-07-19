import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../../src/api.js";
import { formatType } from "../../src/infer/types.js";
import { Schema } from "../../src/qualify/schema.js";
import { corpusPath } from "../helpers/corpus.js";
import { parseSqlOut } from "../helpers/spark-sqltests.js";

// ---------------------------------------------------------------------------
// External semantic grading for databricks (cheat-eradication Task 4, slice A):
// apache/spark's own sql-tests golden files (vendored at tag v4.2.0, corpus
// vendor/spark/sql-tests/results, 356 files) carry, per query, the schema
// Spark's OWN analyzer produced (`-- !query schema` -> struct<name:type,...>).
// This gate replays every golden query through analyze("databricks") with the
// suite's six fixture tables (SQLQueryTestSuite.createTestTables) and grades
// our inferred output-column types against Spark's. It is the first gate whose
// expected TYPES come from an engine, not from our own doc reading.
//
// Classification (every record lands in exactly one bucket; the totals are
// pinned so no class can drift silently):
//   - command:          struct<> schema (SET / DDL / DESCRIBE ...) — nothing to grade
//   - schemaUnparseable: the schema line failed the round-trip parse (exotic names)
//   - parseFailure:     our grammar rejects the query (grammar coverage is the
//                       parse gates' concern; counted here, not graded)
//   - unknownTable:     references a relation outside the fixture six — almost
//                       always a CREATE TEMPORARY VIEW defined earlier in the
//                       same file. Threading those per-file is the tracked
//                       follow-up that would roughly double coverage.
//   - nonqueryModeled / root:setop / hasStar / countMismatch: shapes slice A
//                       does not grade (no projections, set-op root, star
//                       expansion, projection-count disagreement)
//   - graded columns:   match / coarse / abstain / MISMATCH
//
// coarse = our type is a documented coarsening of Spark's exact type: the ADT
// has ONE `interval` scalar (Spark: qualified ANSI intervals, `interval day to
// second`), and timestamp_ntz/ltz deliberately fold to `timestamp`
// (src/infer/types.ts BASE_ALIASES). Modeling those distinctly is an Open Gap.
//
// MISMATCH is the debt number: columns where we claim a CONCRETE type and
// Spark's analyzer says a different concrete type — never-wrong violations.
// Baseline 430 (2026-07-19 census, ~16 rule classes: 2-arg CEIL/FLOOR decimal,
// date_add/date_sub(date,int)->date vs 3-arg dateadd->timestamp, array_position
// bigint, bit_count int, getbit tinyint, date_part double, from_json DDL-string
// schema mis-parse, date/timestamp/interval arithmetic operators, postgres-style
// smallint()/float() converters, unary +/- string coercion, decimal div, ...).
// Tracked in the cheat-eradication issue; the ratchet may only FALL as the
// registry/operator rules are fixed, and colMatch may only RISE.
//
// Policy skips (whole directories/files, counted nowhere): udf/ udaf/ udtf/
// (UDF-wrapped rewrites of base files — they test UDF machinery, and every
// udf(...) call would abstain), and pipe-operators.sql.out (needs the 24-table
// TPC-DS schema; single-file gate in SQLQueryTestSuite, skipped wholesale).
// ---------------------------------------------------------------------------

const ROOT = corpusPath("vendor/spark/sql-tests/results");
const SKIP_DIRS = new Set(["udf", "udaf", "udtf"]);
const SKIP_FILES = new Set(["pipe-operators.sql.out"]);

// The six tables SQLQueryTestSuite.createTestTables registers for EVERY golden
// file (apache/spark SQLQueryTestSuite.scala:644-740 at v4.2.0). onek/tenk1
// share the 16-column PostgreSQL-regression layout.
const INT16 = Object.fromEntries(
	"unique1 unique2 two four ten twenty hundred thousand twothousand fivethous tenthous odd even"
		.split(" ")
		.map((c) => [c, "int"]),
);
const STR3 = { stringu1: "string", stringu2: "string", string4: "string" };
const FIXTURES = new Schema({
	testdata: { key: "int", value: "string" },
	arraydata: { arraycol: "array<int>", nestedarraycol: "array<array<int>>" },
	mapdata: { mapcol: "map<int,string>" },
	aggtest: { a: "int", b: "float" },
	onek: { ...INT16, ...STR3 },
	tenk1: { ...INT16, ...STR3 },
});

/** Comparison normalization: case, length/precision params, collation qualifiers,
 *  and all whitespace (our formatType renders `intervaldaytosecond`; Spark writes
 *  `interval day to second` — same type, different spacing). */
const norm = (t: string) =>
	t
		.toLowerCase()
		.replace(/\(\s*[\d,\s]+\)/g, "")
		.replace(/\s+collate\s+[\w.]+/g, "")
		.replace(/\s+/g, "");

const stripTicks = (s: string) => s.replace(/^`|`$/g, "");

function* walk(dir: string): Generator<string> {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) {
			if (!SKIP_DIRS.has(name)) yield* walk(p);
		} else if (name.endsWith(".sql.out") && !SKIP_FILES.has(name)) yield p;
	}
}

describe.skipIf(!existsSync(ROOT))("databricks vs Spark's own analyzer schemas (sql-tests goldens)", () => {
	it("grades analyze() output types against the vendored v4.2.0 goldens", () => {
		const counts: Record<string, number> = {};
		const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
		const mismatchClasses = new Map<string, number>();
		let nameMismatches = 0;

		for (const file of walk(ROOT)) {
			for (const rec of parseSqlOut(readFileSync(file, "utf8"))) {
				bump("records");
				if (rec.fields === undefined) {
					bump("schemaUnparseable");
					continue;
				}
				if (rec.fields.length === 0) {
					bump("command");
					continue;
				}
				const a = analyze(rec.sql, "databricks", { schema: FIXTURES });
				if (a.errors > 0) {
					bump("parseFailure");
					continue;
				}
				if (a.diagnostics.some((d) => d.kind === "unknown-table")) {
					bump("unknownTable");
					continue;
				}
				const body = a.scopes.root.body;
				if (body.kind !== "select") {
					bump("rootNotSelect");
					continue;
				}
				if (body.projections.length === 0) {
					bump("nonqueryModeled");
					continue;
				}
				if (body.projections.some((p) => p.isStar)) {
					bump("hasStar");
					continue;
				}
				if (body.projections.length !== rec.fields.length) {
					bump("countMismatch");
					continue;
				}
				bump("graded");
				for (let i = 0; i < rec.fields.length; i++) {
					const proj = body.projections[i];
					const ours = formatType(a.types.typeOf(proj.expr, a.scopes.root));
					const spark = rec.fields[i].type;
					if (ours.includes("unknown")) {
						bump("colAbstain");
						continue;
					}
					const o = norm(ours);
					const s = norm(spark);
					if (o === s) bump("colMatch");
					else if (o === "timestamp" && s === "timestamp_ntz") bump("colCoarse");
					else if (o === "interval" && s.startsWith("interval")) bump("colCoarse");
					else {
						bump("colMismatch");
						const key = `${o} -> ${s}`;
						mismatchClasses.set(key, (mismatchClasses.get(key) ?? 0) + 1);
					}
					if (proj.aliasCst && proj.name && rec.fields[i].name.toLowerCase() !== stripTicks(proj.name).toLowerCase())
						nameMismatches++;
				}
			}
		}

		// Debuggability on any pin break: the full class table.
		const table = [...mismatchClasses.entries()].sort((x, y) => y[1] - x[1]);
		const dump = () => table.map(([k, n]) => `${String(n).padStart(5)}  ${k}`).join("\n");

		// Corpus is pinned at the immutable v4.2.0 vendor pull, so totals are exact.
		expect(counts.records).toBe(18084);
		expect(counts.command).toBe(6866);
		expect(counts.schemaUnparseable).toBe(28);
		expect(counts.unknownTable).toBe(5860);
		expect(counts.nonqueryModeled).toBe(589);
		expect(counts.rootNotSelect).toBe(38);
		expect(counts.hasStar).toBe(99);
		expect(counts.countMismatch).toBe(35);
		expect(counts.graded).toBe(4566);

		// Parse coverage over Spark's own suite (the parse gates own the grammar; this
		// just pins the residue): 3 rejects out of 18k as of 2026-07-19.
		expect(counts.parseFailure).toBeLessThanOrEqual(3);

		// The graded-column ledger. Ratchets: match may only rise; abstain/coarse/
		// mismatch may only fall. Baselines from the 2026-07-19 census.
		expect(counts.colMatch, "engine-confirmed types (may only rise)").toBeGreaterThanOrEqual(3655);
		expect(counts.colAbstain, "unknown where Spark knows (may only fall)").toBeLessThanOrEqual(1275);
		expect(counts.colCoarse, "documented coarsenings (may only fall)").toBeLessThanOrEqual(325);
		expect(counts.colMismatch, `wrong concrete types (may only fall):\n${dump()}`).toBeLessThanOrEqual(430);

		// Aliased output names agree everywhere except ONE case: `SELECT 1 AS
		// IDENTIFIER('col1')` (identifier-clause.sql.out) — Spark resolves the
		// IDENTIFIER() clause to `col1`; our lower() keeps the raw constructor text as
		// the name. IDENTIFIER-clause resolution is part of the same debt issue as the
		// type mismatches. May only fall.
		expect(nameMismatches).toBeLessThanOrEqual(1);
	});
});
