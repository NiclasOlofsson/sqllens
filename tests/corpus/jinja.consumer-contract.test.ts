import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	parseTemplated,
	resolveScopes,
	lineage,
	deriveSymbols,
	Schema,
	type Scope,
	type QueryExpr,
	type QueryBody,
	type Source,
	type TableSource,
} from "../../src/index.js";
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
// returns — never the `^j+$` placeholder fill. It scans EVERY public name path:
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

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/jinja/", import.meta.url));
const DIALECT: Dialect = "databricks";

/** A pure placeholder-fill run — one or more of the segmenter's `j` fill chars and nothing else. */
const isPlaceholderRun = (s: string): boolean => /^j+$/.test(s);

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
	return parseTemplated(text, DIALECT).tags.some((n) => n.kind === "ref" || n.kind === "source");
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
	return src.template?.kind === "ref" || src.template?.kind === "source";
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
				if (n.kind === "ref") expected.add(n.model);
				else if (n.kind === "source") expected.add(`${n.sourceName}.${n.tableName}`);
			}

			it("declares at least one real ref/source name", () => {
				expect(expected.size, `${name}: no completed ref/source tag`).toBeGreaterThanOrEqual(1);
			});

			it("1) sql.ast — every ref/source source's IR name is the real dbt-logical name", () => {
				const { sql } = parseTemplated(text, DIALECT);
				const refSrcs = collectTableSources(sql.ast).filter(isRefOrSource);
				expect(refSrcs.length, "at least one ref/source IR source").toBeGreaterThanOrEqual(1);
				for (const t of refSrcs) {
					for (const part of t.name) expect(isPlaceholderRun(part), `IR name part "${part}"`).toBe(false);
					expect(expected.has(t.name.join(".")), `IR name "${t.name.join(".")}" is a real tag name`).toBe(
						true,
					);
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
		});
	}
});
