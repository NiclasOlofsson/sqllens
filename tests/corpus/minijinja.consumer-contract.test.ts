import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	resolveScopes,
	lineage,
	deriveSymbols,
	qualify,
	Schema,
	DefaultTemplateProvider,
	type Scope,
	type QueryExpr,
	type QueryBody,
	type Source,
	type TableSource,
	type Column,
	type ResolvedRelation,
	type TemplateCall,
} from "../../src/index.js";
import { parseTemplated } from "../helpers/templated.js";
import type { Dialect } from "../../src/api.js";

// ---------------------------------------------------------------------------
// THE CONSUMER-CONTRACT GATE (inc2 — the twice-proven lesson).
//
// A green suite over our layer IN ISOLATION is NOT proof a downstream consumer
// can use it. The dbt-studio extension's cross-repo shadow-diff twice caught a
// regression our own green unit tests missed: inc1 leaked the `jjj…` placeholder
// name; R3's first cut read the source's name off the placeholder token instead
// of the tag literal. Both are the SAME class of bug — a public name path that
// surfaces the internal placeholder fill instead of the real dbt-logical name.
//
// This gate exercises the DOWNSTREAM READS a consumer makes over
// `parseTemplated(text, "databricks")` and asserts, for every ref/source-tagged
// FROM source, that the REAL model name is what every consumer-visible read
// returns — never the ordinal-headed placeholder fill. It scans EVERY public name path:
//
//   1. sql.ast source names   — the lowered IR (TableSource.name), walked.
//   2. resolveScopes keys      — the scope binding keys + each ResolvedSource.name.
//   3. Lineage.originsOf       — the base-table origins of every output column.
//   4. deriveSymbols names     — the symbol model's table-source names.
//   5. tokens stream text      — the unified SQL+jinja Token[] text.
//
// It fails at OUR layer, before the shadow-diff has to, and documents the
// consumption contract executably: read a templated source's identity from
// `src.name` / the scope, NEVER from the placeholder token text.
//
// SCOPE (never-wrong): the assertion is about ref/source-tagged sources only —
// a `{{ ref('x') }}` / `{{ source('a','b') }}` whose physical name is a LITERAL
// dbt knows. A macro-in-FROM (`{{ my_macro() }}`) is intentionally OPAQUE: its
// relation is undeterminable, so its placeholder name is HONEST, not a leak — it
// is excluded (matching R3 / apply-tags). A deliberately-broken totality fixture
// (`from {{ ref(`) never completes a ref tag, so it carries no ref/source source
// and contributes nothing to scan — also correct, not a failure.
// ---------------------------------------------------------------------------

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/minijinja/", import.meta.url));
const DIALECT: Dialect = "databricks";

/** A pure placeholder-fill run — one or more of the segmenter's `j` fill chars and nothing else. */
// Ordinal-aware since the fill-uniqueness change (2026-07-06): a fill is `j` + up to two
// base35 ordinal chars (alphabet excludes `j`) + all-`j` padding. Matches the legacy pure
// run too ({0,2} admits zero ordinal chars) — the detector must never go blind to a leak.
const isPlaceholderRun = (s: string): boolean => /^j[0-9a-ik-z]{0,2}j*$/.test(s);

interface Case {
	name: string;
	text: string;
}

/** True when the text parses to at least one COMPLETED ref/source tag — i.e. a real
 *  ref/source-tagged source exists to police. A deliberately-broken totality fixture
 *  (`from {{ ref(`) matches the text filter but completes no tag, so it is NOT a case:
 *  its placeholder name is the honest never-wrong fallback, not a leak (same guard the
 *  R3 gate uses via `hasRelationTag`). */
function hasCompletedRelation(text: string): boolean {
	return parseTemplated(text, DIALECT).tags.some(
		(n) => n.kind === "call" && !n.incomplete && (n.name === "ref" || n.name === "source"),
	);
}

/** In-repo ref/source fixtures that actually complete a `{{ ref('x') }}` / `{{ source('a','b') }}` tag. */
function refSourceFixtures(): Case[] {
	return readdirSync(FIXTURES_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((name) => ({ name, text: readFileSync(FIXTURES_DIR + name, "utf8") }))
		.filter((c) => (c.text.includes("{{ ref(") || c.text.includes("{{ source(")) && hasCompletedRelation(c.text));
}

/** A couple of inline ref/source cases (aliased — the alias is the binding key; the REAL
 *  name still has to be readable off `src.name` / the scope / lineage). */
const INLINE: Case[] = [
	{ name: "inline_ref", text: "select o.order_id, o.amount from {{ ref('stg_orders') }} as o" },
	{ name: "inline_source", text: "select e.id, e.ts from {{ source('raw', 'events') }} as e" },
];

const CASES: Case[] = [...refSourceFixtures(), ...INLINE];

/** Every TableSource reachable from a query IR (CTE bodies, FROM/JOIN, subqueries). Total. */
function collectTableSources(ast: QueryExpr): TableSource[] {
	const out: TableSource[] = [];
	const seen = new Set<QueryExpr>();
	const query = (q: QueryExpr | undefined): void => {
		if (!q || seen.has(q)) return;
		seen.add(q);
		for (const c of q.ctes ?? []) query(c.body);
		body(q.body);
	};
	const body = (b: QueryBody | undefined): void => {
		if (!b) return;
		if (b.kind === "select") {
			for (const s of b.from ?? []) source(s);
			for (const j of b.joins ?? []) source(j.source);
			for (const sq of b.subqueries ?? []) query(sq);
		} else if (b.kind === "setop") {
			body(b.left);
			body(b.right);
		} else if (b.kind === "pipe") {
			body(b.input);
		}
	};
	const source = (s: Source | undefined): void => {
		if (!s) return;
		if (s.kind === "table") out.push(s);
		else if (s.kind === "subquery") query(s.query);
	};
	query(ast);
	return out;
}

/** Every scope in the tree (pre-order). */
function allScopes(root: Scope): Scope[] {
	const out: Scope[] = [];
	const rec = (s: Scope | undefined): void => {
		if (!s) return;
		out.push(s);
		for (const c of s.children ?? []) rec(c);
	};
	rec(root);
	return out;
}

/** True when a TableSource was written as a `{{ ref(...) }}` / `{{ source(...) }}` tag —
 *  the identity-bearing case this gate polices. A macro (opaque) source is excluded. */
function isRefOrSource(src: TableSource): boolean {
	return src.template?.call?.name === "ref" || src.template?.call?.name === "source";
}

describe("jinja CONSUMER-CONTRACT gate — no placeholder leaks any public name path (inc2)", () => {
	it(`covers the ref/source cases (${CASES.length})`, () => {
		expect(CASES.length).toBeGreaterThanOrEqual(4);
	});

	for (const { name, text } of CASES) {
		describe(name, () => {
			// The real dbt-logical names the tags declared (ref → model; source → "a.b").
			// CASES only holds fixtures that completed a ref/source tag, so this is non-empty.
			const { tags } = parseTemplated(text, DIALECT);
			const expected = new Set<string>();
			for (const n of tags) {
				if (n.kind !== "call") continue;
				if (n.name === "ref" && n.args.at(-1)?.value != null) expected.add(n.args.at(-1)!.value!);
				else if (n.name === "source" && n.args[0]?.value != null && n.args[1]?.value != null) {
					expected.add(`${n.args[0].value}.${n.args[1].value}`);
				}
			}

			it("declares at least one real ref/source name", () => {
				expect(expected.size, `${name}: no completed ref/source tag`).toBeGreaterThanOrEqual(1);
			});

			it("1) sql.ast — every ref/source source's IR name is the real dbt-logical name", () => {
				const { sql } = parseTemplated(text, DIALECT);
				const refSrcs = collectTableSources(sql.ast).filter(isRefOrSource);
				expect(refSrcs.length, "at least one ref/source IR source").toBeGreaterThanOrEqual(1);
				for (const t of refSrcs) {
					for (const part of t.relation.parts)
						expect(isPlaceholderRun(part), `IR name part "${part}"`).toBe(false);
					expect(
						expected.has(t.relation.parts.join(".")),
						`IR name "${t.relation.parts.join(".")}" is a real tag name`,
					).toBe(true);
				}
			});

			it("2) resolveScopes — binding keys + ResolvedSource names carry the real name, never `jjj…`", () => {
				const { sql } = parseTemplated(text, DIALECT);
				const scopes = resolveScopes(sql.ast, DIALECT);
				let seen = 0;
				for (const sc of allScopes(scopes.root)) {
					for (const [key, rs] of sc.sources) {
						if (rs.kind !== "table" || !isRefOrSource(rs.source)) continue;
						seen++;
						// The binding key is the alias when aliased (never a placeholder), else the
						// real last name part — either way never a `jjj…` fill.
						expect(isPlaceholderRun(key), `scope binding key "${key}"`).toBe(false);
						for (const part of rs.name)
							expect(isPlaceholderRun(part), `ResolvedSource name part "${part}"`).toBe(false);
						expect(
							expected.has(rs.name.join(".")),
							`ResolvedSource name "${rs.name.join(".")}" is a real tag name`,
						).toBe(true);
					}
				}
				expect(seen, "at least one ref/source bound in scope").toBeGreaterThanOrEqual(1);
			});

			it("3) Lineage.originsOf — no output column's base-table origin is a placeholder run", () => {
				const { sql } = parseTemplated(text, DIALECT);
				const lin = lineage(sql.ast, new Schema({}));
				for (const col of lin.all) {
					for (const o of lin.originsOf(col.output)) {
						for (const part of o.table)
							expect(isPlaceholderRun(part), `origin table part "${part}" for ${col.output}`).toBe(false);
					}
				}
			});

			it("4) deriveSymbols — no table-source symbol name is a placeholder run", () => {
				const { sql } = parseTemplated(text, DIALECT);
				for (const s of deriveSymbols(sql.ast, new Schema({}))) {
					if (s.kind !== "table") continue;
					expect(isPlaceholderRun(s.name), `table symbol name "${s.name}"`).toBe(false);
				}
			});

			it("5) tokens — the unified stream never surfaces a placeholder-fill token", () => {
				const { tokens } = parseTemplated(text, DIALECT);
				for (const tok of tokens) {
					expect(isPlaceholderRun(tok.text), `token text "${tok.text}" @${tok.start}`).toBe(false);
				}
			});

			it("6) diagnostics — no message on EITHER public surface quotes placeholder fill text", () => {
				// The gold__vendor F5 leak (2026-07-06): a raw "mismatched input 'jjjj…'" reached a
				// user's screen through the embedded sql.diagnostics while the merged top-level set
				// was scrubbed. Both surfaces must quote raw source, never the fill.
				const r = parseTemplated(text, DIALECT);
				for (const d of [...r.diagnostics, ...r.sql.diagnostics]) {
					expect(d.message, `diagnostic @${d.offset}`).not.toMatch(/j{4,}/);
				}
			});
		});
	}
});

// ---------------------------------------------------------------------------
// inc3.1 CONSUMER-CONTRACT extension — the catalog-resolution win AND the
// zero-catalog keystone, both end-to-end over the fixtures.
//
// (a) A warm CallbackTemplateCatalog resolving a fixture's `{{ ref(...) }}` to
//     real columns makes qualify fire a real unknown-column for a bad column and
//     stay silent for good ones — the column-resolution win is real, not just a
//     unit-test artifact.
// (b) A ZERO-catalog run (plain Schema, no `relation`) over EVERY fixture is
//     byte-identical to R3: it emits NO unknown-column diagnostic against any
//     templated source (the R3 blanket exemption). unknown-column is the only new
//     diagnostic class inc3.1 can add, and it is catalog-gated — so its absence
//     with a plain Schema is the keystone that inc3.1 is invisible without a catalog.
// ---------------------------------------------------------------------------

/** A provider over a fixed map of `"<name>:<dotted-args>" → columns` (undefined = miss). */
function catalogFor(relations: Record<string, Column[]>): DefaultTemplateProvider {
	class Fixed extends DefaultTemplateProvider {
		override relationOf(call: TemplateCall): ResolvedRelation | undefined {
			if (call.name !== "ref" && call.name !== "source") return super.relationOf(call);
			const parts = call.args.filter((a): a is string => a !== null);
			const cols = relations[`${call.name}:${parts.join(".")}`];
			return cols ? { nameParts: parts, columns: cols } : undefined;
		}
	}
	return new Fixed();
}

const unknownColumns = (q: { diagnostics: { kind: string; message: string }[] }) =>
	q.diagnostics.filter((d) => d.kind === "unknown-column");

describe("jinja CONSUMER-CONTRACT — inc3.1 catalog column resolution (relation)", () => {
	// Fixture 02_ref_from.sql: `select o.order_id, o.customer_id, o.amount from {{ ref('stg_orders') }} o`.
	const FIXTURE_02 = readFileSync(FIXTURES_DIR + "02_ref_from.sql", "utf8");

	it("(a) warm catalog: a resolved ref's real columns silence good refs and fire on a bad one", () => {
		const { sql } = parseTemplated(FIXTURE_02, DIALECT);

		// Full column set → every `o.<col>` reference resolves, no unknown-column.
		const full = catalogFor({
			"ref:stg_orders": [{ name: "order_id" }, { name: "customer_id" }, { name: "amount" }],
		});
		expect(unknownColumns(qualify(sql.ast, full))).toEqual([]);

		// Same fixture, but the resolved relation LACKS `amount` → a real unknown-column fires for it
		// (the fixture references `o.amount` in both the SELECT list and the WHERE, so both fire; the
		// two present columns stay silent).
		const missingAmount = catalogFor({
			"ref:stg_orders": [{ name: "order_id" }, { name: "customer_id" }],
		});
		const bad = unknownColumns(qualify(sql.ast, missingAmount));
		expect(bad.length).toBeGreaterThanOrEqual(1);
		for (const d of bad) expect(d.message).toContain("amount");
	});

	it("(b) KEYSTONE — a zero-catalog run over every fixture emits NO unknown-column (R3-identical)", () => {
		const zeroCatalog = new Schema({});
		for (const { name, text } of CASES) {
			const { sql } = parseTemplated(text, DIALECT);
			const uc = unknownColumns(qualify(sql.ast, zeroCatalog));
			expect(uc, `${name}: zero-catalog must add no unknown-column (byte-identical to R3)`).toEqual([]);
		}
	});
});
