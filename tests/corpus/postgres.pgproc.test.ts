import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatType } from "../../src/infer/types.js";
import { POSTGRES_FUNCTION_RETURNS, postgresParseType } from "../../src/postgres/infer.js";
import { corpusPath } from "../helpers/corpus.js";
import { parsePgDat } from "../helpers/pg-catalog.js";

// ---------------------------------------------------------------------------
// External semantic grading for postgres (cheat-eradication Task 4, slice B):
// PostgreSQL's own function catalog (corpus vendor/postgres-catalog/pg_proc.dat,
// REL_18_STABLE) is stronger ground truth than doc prose (established when
// pg_proc settled the positional-substring and concat flags). For EVERY
// registry name x pg_proc overload, our FnRule is evaluated with the
// overload's argument types and must produce that overload's return type, or
// abstain. This grades even the argument-dependent rules (sum/avg/stddev/
// random) against the vendor's catalog, overload by overload.
//
// Skips, counted and pinned: procedures (prokind 'p'), overloads whose return
// is polymorphic/pseudo (anyelement, record, void, ...: not statically
// gradable), and rules that answer a pseudo name (a passthrough rule fed a
// pseudo arg). pg spells array types `_base`; mapped to array<base>. Types are
// built directly (never re-parsed from a formatted name — bare SQL FLOAT is
// double precision, but pg float4 is our float).
//
// KNOWN_MISMATCHES is the debt ledger, exact and self-policing: fixing a rule
// must REMOVE its lines here, and any new contradiction fails the set
// equality. Emptied 2026-07-19: all 33 census entries fixed at the rule level
// (bytea/bit-preserving string functions, geometric length overloads, PG17+
// random(min,max) following the arg type, percentile_cont typing the
// ordered-set argument instead of the fraction, log10(numeric), min_scale ->
// int, age(xid), pg_typeof -> regtype, ts_headline json/jsonb variants) — see
// src/postgres/infer.ts for the pg_proc.dat-cited rules.
// ---------------------------------------------------------------------------

const DIR = corpusPath("vendor/postgres-catalog");

const PSEUDO = new Set([
	"any", "anyelement", "anyarray", "anynonarray", "anyenum", "anyrange", "anymultirange",
	"anycompatible", "anycompatiblearray", "anycompatiblenonarray", "anycompatiblerange",
	"anycompatiblemultirange", "internal", "cstring", "record", "_record", "trigger",
	"event_trigger", "language_handler", "fdw_handler", "index_am_handler", "tsm_handler",
	"table_am_handler", "void", "unknown", "pg_ddl_command", "_cstring",
]);

const KNOWN_MISMATCHES: string[] = [];

describe.skipIf(!existsSync(join(DIR, "pg_proc.dat")))("postgres registry vs pg_proc.dat (REL_18_STABLE)", () => {
	it("every registry rule matches the catalog's return type, abstains, or is ledgered", () => {
		const procs = parsePgDat(readFileSync(join(DIR, "pg_proc.dat"), "utf8"));
		const counts: Record<string, number> = {};
		const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
		const mismatches: string[] = [];

		const pgTypeOf = (t: string) =>
			t.startsWith("_") ? ({ kind: "array", element: postgresParseType(t.slice(1)) } as const) : postgresParseType(t);
		const strip = (s: string) => s.toLowerCase().replace(/\(\s*[\d,\s]+\)/g, "").replace(/\s+/g, "");

		for (const p of procs) {
			const name = p.proname?.toLowerCase();
			if (!name) continue;
			const rule = POSTGRES_FUNCTION_RETURNS[name];
			if (!rule) continue;
			if (p.prokind === "p") continue;
			bump("overloads");
			if (PSEUDO.has(p.prorettype)) {
				bump("pseudoReturn");
				continue;
			}
			const argNames = (p.proargtypes ?? "").trim() === "" ? [] : p.proargtypes.trim().split(/\s+/);
			const ours = formatType(rule(argNames.map(pgTypeOf)));
			if (ours.includes("unknown")) {
				bump("abstain");
				continue;
			}
			if (PSEUDO.has(ours)) {
				bump("pseudoOurs");
				continue;
			}
			const expected = formatType(pgTypeOf(p.prorettype));
			if (strip(ours) === strip(expected)) bump("match");
			else mismatches.push(`${name}(${argNames.join(",")}) ours=${ours} pg=${expected}`);
		}

		// Catalog and registry are both pinned artifacts, so the totals are exact.
		expect(counts.overloads).toBe(768);
		expect(counts.pseudoReturn).toBe(46);
		expect(counts.match, "catalog-confirmed overloads (may only rise)").toBeGreaterThanOrEqual(722);

		// Self-policing debt ledger: a fixed rule must remove its lines; any NEW
		// contradiction against the vendor catalog fails here.
		expect(mismatches.sort()).toEqual(KNOWN_MISMATCHES);
	});
});
