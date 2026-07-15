import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DbtTemplateProvider, qualify, Schema } from "../../src/index.js";
import {
	parseTemplated,
	templateRegions,
	templateSymbols,
	templateVariants,
	type TagNode,
} from "../../src/minijinja/index.js";
import type { Dialect } from "../../src/api.js";
import type { Token } from "../../src/token/token.js";
import type { PartSpan } from "../../src/ir/part-span.js";
import type { QueryExpr, QueryBody, Source, TableSource } from "../../src/ir/ir.js";

// ---------------------------------------------------------------------------
// The jinja corpus gate (docs/minijinja-front-end.md §The gates). A focused,
// in-repo fixture set of real-shaped dbt model snippets (NOT the big corpus —
// raw jinja templates aren't in sqllens-corpus, which holds COMPILED SQL). Over
// every fixture it proves the four hard inc1 contracts:
//
//   1. TOTAL (R5)          — parseTemplated never throws, on any input incl. a
//                            half-typed `{{ ref(`.
//   2. TILES the source    — the unified SQL(ch 0/1) + jinja(ch 2) stream is
//                            contiguous with no gaps/overlaps, and the token
//                            texts in order reconstruct the source EXACTLY
//                            (length-/newline-preserving placeholder invariant).
//   3. SQL round-trip      — every SQL-side token (channel != 2) sits OUTSIDE
//                            all tag regions and its span round-trips to the
//                            original coordinates (source.slice == text).
//   4. R2 span contract    — every ref/source/macro tag node's spans lie within
//                            [0, len) and its quotes-excluded content spans slice
//                            back to the node's own strings (multi-line correct).
//
// The gate runs over the databricks dialect (dbt's most common target); a small
// cross-dialect check proves the jinja channel is dialect-agnostic.
// ---------------------------------------------------------------------------

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/minijinja/", import.meta.url));
const DIALECT: Dialect = "databricks";

interface Fixture {
	name: string;
	text: string;
}

function loadFixtures(): Fixture[] {
	return readdirSync(FIXTURES_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((name) => ({ name, text: readFileSync(FIXTURES_DIR + name, "utf8") }));
}

const FIXTURES = loadFixtures();

/** Tag regions of the source (segment bounds) — SQL tokens must sit outside these. */
function tagRanges(tags: readonly { tagSpan: PartSpan }[]): [number, number][] {
	return tags.map((t) => [t.tagSpan.start, t.tagSpan.end] as [number, number]);
}

/** The merged stream tiles the source: starts at 0, each token abuts the previous,
 *  ends at len-1, and the token texts in order reconstruct the source exactly. */
function assertTiles(tokens: Token[], text: string): void {
	if (text.length === 0) {
		expect(tokens).toEqual([]);
		return;
	}
	expect(tokens.length).toBeGreaterThan(0);
	expect(tokens[0].start).toBe(0);
	for (let i = 1; i < tokens.length; i++) {
		expect(tokens[i].start).toBe(tokens[i - 1].stop + 1);
		expect(tokens[i].stop).toBeGreaterThanOrEqual(tokens[i].start - 1);
	}
	expect(tokens[tokens.length - 1].stop).toBe(text.length - 1);
	// Length-/newline-preserving invariant, end to end: the ordered token texts
	// reconstruct the source byte-for-byte (subsumes per-token round-trip given
	// contiguity).
	expect(tokens.map((t) => t.text).join("")).toBe(text);
}

/** A PartSpan lies within the source and slices back to `expected` (content match). */
function assertSpanContent(span: PartSpan, text: string, expected: string, label: string): void {
	expect(span.start, `${label}.start in-bounds`).toBeGreaterThanOrEqual(0);
	expect(span.end, `${label}.end in-bounds`).toBeLessThanOrEqual(text.length);
	expect(span.start, `${label} start<=end`).toBeLessThanOrEqual(span.end);
	expect(text.slice(span.start, span.end), `${label} content`).toBe(expected);
}

/** A PartSpan lies within [0, len]. */
function assertSpanInBounds(span: PartSpan, text: string, label: string): void {
	expect(span.start, `${label}.start`).toBeGreaterThanOrEqual(0);
	expect(span.end, `${label}.end`).toBeLessThanOrEqual(text.length);
	expect(span.start, `${label} start<=end`).toBeLessThanOrEqual(span.end);
}

/** Every ref/source/macro node's spans are in-bounds and content-true. */
function assertTagSpans(node: TagNode, text: string): void {
	// tagSpan (present on every kind) covers the whole tag incl. delimiters.
	assertSpanInBounds(node.tagSpan, text, `${node.kind}.tagSpan`);
	const tagText = text.slice(node.tagSpan.start, node.tagSpan.end);
	expect(/^\{[{%#]/.test(tagText), `${node.kind}.tagSpan opens a tag`).toBe(true);

	if (node.kind === "call") {
		// One neutral call node for ref/source/macro/etc. — spans checked uniformly.
		assertSpanContent(node.nameSpan, text, node.name, "call.nameSpan");
		assertSpanInBounds(node.callSpan, text, "call.callSpan");
		if (node.packageName !== undefined && node.packageSpan) {
			assertSpanContent(node.packageSpan, text, node.packageName, "call.packageSpan");
		}
		if (node.argsSpan) assertSpanInBounds(node.argsSpan, text, "call.argsSpan");
		for (const [i, arg] of node.args.entries()) {
			assertSpanInBounds(arg.span, text, `call.args[${i}]`);
			// A string/number literal arg carries value + its quote-excluded valueSpan.
			if (arg.valueSpan && arg.value !== null) {
				assertSpanContent(arg.valueSpan, text, arg.value, `call.args[${i}].valueSpan`);
			}
		}
	}
}

describe("jinja corpus gate — inc1 (R1 unified stream + R2 tag spans)", () => {
	it(`loads the fixture set (${FIXTURES.length} files)`, () => {
		expect(FIXTURES.length).toBeGreaterThanOrEqual(10);
	});

	// Kinds + call callees observed across the whole set — proves the classifier fired on the
	// required shapes. Kinds are neutral now (call / control / other); ref/source/var/config are
	// callees of "call" nodes.
	const seenKinds = new Set<string>();
	const seenCallees = new Set<string>();

	for (const { name, text } of FIXTURES) {
		describe(name, () => {
			it("parseTemplated is total (never throws)", () => {
				expect(() => parseTemplated(text, DIALECT)).not.toThrow();
			});

			it("the unified stream tiles the source and reconstructs it exactly", () => {
				const { tokens } = parseTemplated(text, DIALECT);
				assertTiles(tokens, text);
			});

			it("every SQL-side token sits outside tag regions and round-trips", () => {
				const { tokens, tags } = parseTemplated(text, DIALECT);
				const ranges = tagRanges(tags);
				for (const tok of tokens) {
					if (tok.channel === 2) continue; // jinja side
					// No SQL token overlaps a tag region (the placeholder filler was clipped).
					for (const [ts, te] of ranges) {
						const overlaps = tok.start < te && tok.stop >= ts;
						expect(overlaps, `SQL token ${JSON.stringify(tok.text)} @${tok.start} inside a tag`).toBe(
							false,
						);
					}
					// Round-trips to original coordinates.
					expect(text.slice(tok.start, tok.stop + 1)).toBe(tok.text);
				}
			});

			it("every ref/source/macro tag node has in-bounds, content-true spans", () => {
				const { tags } = parseTemplated(text, DIALECT);
				for (const node of tags) {
					seenKinds.add(node.kind);
					if (node.kind === "call") seenCallees.add(node.name);
					assertTagSpans(node, text);
				}
			});
		});
	}

	it("the fixture set exercises the neutral kinds + the key callees (ref/source/var/config/a macro)", () => {
		// Populated by the per-fixture span assertions above.
		for (const { text } of FIXTURES)
			for (const n of parseTemplated(text, DIALECT).tags) {
				seenKinds.add(n.kind);
				if (n.kind === "call") seenCallees.add(n.name);
			}
		// Neutral kinds: call + control (+ other).
		expect(seenKinds.has("call"), "no call node in the corpus").toBe(true);
		expect(seenKinds.has("control"), "no control node in the corpus").toBe(true);
		// ref/source/var/config are callees now — the corpus must still exercise them.
		for (const callee of ["ref", "source", "var", "config"]) {
			expect(seenCallees.has(callee), `no ${callee}() call in the corpus`).toBe(true);
		}
		// and at least one plain user macro (a callee that is not a known dbt builtin).
		const builtins = new Set(["ref", "source", "var", "env_var", "config", "docs", "print", "log", "return"]);
		expect(
			[...seenCallees].some((n) => !builtins.has(n)),
			"no user macro call in the corpus",
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// R3 (inc2): the tag-applied IR + the qualify exemption. For every fixture that
// writes a `{{ ref('x') }}` / `{{ source('a','b') }}` FROM/JOIN source, the
// lowered IR (`parseTemplated().sql.ast`) must carry a `template`-marked
// TableSource whose name is the real dbt-logical name (NOT the `jjj…`
// placeholder fill), and qualify against an EMPTY schema must emit zero
// unknown-table/-column against those templated sources — a diagnostic on the
// dbt-logical name would be never-wrong-violating (docs/minijinja-front-end.md §R3).
// ---------------------------------------------------------------------------

/** Every TableSource reachable from a query IR (CTE bodies, FROM/JOIN, subqueries). Best-effort +
 *  total — a shape it doesn't recognise is simply not descended (the gate only needs table sources). */
function collectTableSources(ast: QueryExpr): TableSource[] {
	const out: TableSource[] = [];
	const seenQ = new Set<QueryExpr>();
	const query = (q: QueryExpr | undefined): void => {
		if (!q || seenQ.has(q)) return;
		seenQ.add(q);
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

describe("jinja corpus gate — R3 templated-source IR + qualify exemption (inc2)", () => {
	const REF_SOURCE = FIXTURES.filter((f) => f.text.includes("{{ ref(") || f.text.includes("{{ source("));

	it(`covers the ref/source fixtures (${REF_SOURCE.length} files)`, () => {
		expect(REF_SOURCE.length).toBeGreaterThanOrEqual(3);
	});

	for (const { name, text } of REF_SOURCE) {
		describe(name, () => {
			it("the IR carries a template-marked source with the real dbt-logical name (no placeholder fill)", () => {
				const { sql, tags } = parseTemplated(text, DIALECT, { provider: new DbtTemplateProvider() });
				const tables = collectTableSources(sql.ast);
				const templated = tables.filter((t) => t.template !== undefined);
				// (a) at least one templated source is present — but ONLY when a ref/source tag actually
				//     parsed to completion. A deliberately-broken totality fixture (`from {{ ref(`) yields
				//     no complete tag, hence no templated source; that is correct, not a gate failure.
				const hasRelationTag = tags.some(
					(n) => n.kind === "call" && !n.incomplete && (n.name === "ref" || n.name === "source"),
				);
				const inFrom = /\bfrom\s*(?:\()?\s*\{\{\s*(?:ref|source)\s*\(/i.test(text);
				if (hasRelationTag && inFrom) expect(templated.length).toBeGreaterThanOrEqual(1);
				// (b) no ref/source-tagged source's name is the `jjj…` placeholder fill (Task 2's guard
				//     protects the honest literal name Task 1 substituted).
				for (const t of templated) {
					if (t.template!.call?.name === "ref" || t.template!.call?.name === "source") {
						for (const part of t.relation.parts) expect(part, `name part ${part}`).not.toMatch(/jjjj/);
					}
				}
			});

			it("qualify with an EMPTY schema emits no unknown-table/-column against templated sources", () => {
				const { sql } = parseTemplated(text, DIALECT, { provider: new DbtTemplateProvider() });
				const templatedNames = new Set(
					collectTableSources(sql.ast)
						.filter((t) => t.template !== undefined)
						.map((t) => t.relation.parts.join(".")),
				);
				const q = qualify(sql.ast, new Schema({}));
				// No unknown-table diagnostic names a templated source's dbt-logical name.
				const badTable = q.diagnostics.filter(
					(d) => d.kind === "unknown-table" && [...templatedNames].some((n) => d.message.includes(n)),
				);
				expect(badTable).toEqual([]);
				// These fixtures have no non-templated base tables, so every column resolves against a
				// templated (unknown-but-not-wrong) or CTE-over-templated source: zero unknown-column.
				expect(q.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
			});
		});
	}
});

describe("jinja corpus gate — multi-line span correctness (R2 parity upgrade)", () => {
	it("a source() call split across lines carries content-true multi-line spans", () => {
		const text = readFileSync(FIXTURES_DIR + "05_multiline_tag.sql", "utf8");
		const { tags } = parseTemplated(text, DIALECT);
		const src = tags.find((t): t is Extract<TagNode, { kind: "call" }> => t.kind === "call" && t.name === "source");
		expect(src).toBeDefined();
		if (!src) return;
		const [srcName, tblName] = src.args;
		// The two string args are on different lines — offset spans still slice true.
		expect(srcName.valueSpan!.line).not.toBe(tblName.valueSpan!.line);
		expect(text.slice(srcName.valueSpan!.start, srcName.valueSpan!.end)).toBe(srcName.value);
		expect(text.slice(tblName.valueSpan!.start, tblName.valueSpan!.end)).toBe(tblName.value);
	});
});

describe("jinja corpus gate — dialect-agnostic jinja channel", () => {
	const cross: Dialect[] = ["databricks", "snowflake", "postgres"];
	it("the jinja token slice is byte-identical across dialects", () => {
		const text = readFileSync(FIXTURES_DIR + "14_config_cte_model.sql", "utf8");
		const perDialect = cross.map((d) =>
			parseTemplated(text, d)
				.tokens.filter((t) => t.channel === 2)
				.map((t) => `${t.name}:${t.text}:${t.start}-${t.stop}`),
		);
		for (let i = 1; i < perDialect.length; i++) expect(perDialect[i]).toEqual(perDialect[0]);
	});
});

// ---------------------------------------------------------------------------
// R4 (inc2): control-flow regions + set/macro symbols. Over EVERY fixture the
// two passes must be total (never throw on any tag sequence, balanced or not),
// their spans in-bounds, and their names honest (a symbol name always slices
// back to its own source — no fabricated names, docs/minijinja-front-end.md §R4).
// ---------------------------------------------------------------------------
describe("jinja corpus gate — R4 regions + symbols totality (inc2)", () => {
	for (const { name, text } of FIXTURES) {
		describe(name, () => {
			it("templateRegions / templateSymbols are total (never throw)", () => {
				const { tags } = parseTemplated(text, DIALECT);
				expect(() => templateRegions(tags, text)).not.toThrow();
				expect(() => templateSymbols(tags)).not.toThrow();
			});

			it("region arm/body spans are in-bounds and every symbol name is content-true", () => {
				const { tags } = parseTemplated(text, DIALECT);
				const walk = (regions: ReturnType<typeof templateRegions>): void => {
					for (const r of regions) {
						assertSpanInBounds(r.span, text, `${r.kind}.span`);
						expect(r.arms.length, `${r.kind} has arms`).toBeGreaterThanOrEqual(1);
						for (const arm of r.arms) {
							assertSpanInBounds(arm.tagSpan, text, `${arm.keyword}.tagSpan`);
							assertSpanInBounds(arm.bodySpan, text, `${arm.keyword}.bodySpan`);
							walk(arm.children);
						}
					}
				};
				walk(templateRegions(tags, text));
				// A set/macro symbol name always slices back to its own nameSpan (never fabricated).
				for (const s of templateSymbols(tags)) {
					assertSpanContent(s.nameSpan, text, s.name, `${s.kind}.nameSpan`);
					assertSpanInBounds(s.span, text, `${s.kind}.span`);
				}
			});
		});
	}

	it("the set/macro fixture surfaces both a `set` target and a `macro` name", () => {
		const text = readFileSync(FIXTURES_DIR + "20_set_and_macro_block.sql", "utf8");
		const kinds = new Set(templateSymbols(parseTemplated(text, DIALECT).tags).map((s) => s.kind));
		expect(kinds.has("set")).toBe(true);
		expect(kinds.has("macro")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Variant realization (inc2): `templateVariants` enumerates the branch variants
// of a template (arm-coverage, linear). Over EVERY fixture: at least one variant;
// each variant's `parse()` is total; its token stream tiles the (length-preserving,
// blanked) realized text — start 0, contiguous, ends at len-1, total length equal
// to the original (blanking preserves length + newline positions). The two-WHERE
// if/else fixture must yield exactly two coherent variants.
// ---------------------------------------------------------------------------
describe("jinja corpus gate — variant coherence (inc2)", () => {
	/** A merged stream is contiguous and covers [0, len): start 0, each token abuts the
	 *  previous, last ends at len-1. (No exact string match — a variant blanks arm bodies,
	 *  so the realized text differs from the original while keeping its length.) */
	function assertContiguous(tokens: Token[], len: number): void {
		if (len === 0) {
			expect(tokens).toEqual([]);
			return;
		}
		expect(tokens.length).toBeGreaterThan(0);
		expect(tokens[0].start).toBe(0);
		for (let i = 1; i < tokens.length; i++) expect(tokens[i].start).toBe(tokens[i - 1].stop + 1);
		expect(tokens[tokens.length - 1].stop).toBe(len - 1);
		// Length preserved end-to-end (the blanking invariant): the joined texts have the
		// same length as the source even though the content of blanked arms is whitespace.
		expect(tokens.reduce((n, t) => n + t.text.length, 0)).toBe(len);
	}

	for (const { name, text } of FIXTURES) {
		describe(name, () => {
			it("templateVariants is total and yields at least one variant", () => {
				let variants: ReturnType<typeof templateVariants> = [];
				expect(() => {
					variants = templateVariants(text, DIALECT);
				}).not.toThrow();
				expect(variants.length).toBeGreaterThanOrEqual(1);
			});

			it("every variant parses (total) and its token stream tiles the realized text", () => {
				for (const v of templateVariants(text, DIALECT)) {
					let result: ReturnType<typeof v.parse> | undefined;
					expect(() => {
						result = v.parse();
					}).not.toThrow();
					if (!result) continue;
					assertContiguous(result.tokens, text.length);
				}
			});
		});
	}

	it("the two-WHERE if/else fixture yields exactly two coherent variants", () => {
		const text = readFileSync(FIXTURES_DIR + "16_if_else_where.sql", "utf8");
		const variants = templateVariants(text, DIALECT);
		expect(variants.length).toBe(2);
		// One variant activates all defaults (the `if` arm); the other activates the `else` arm.
		const actives = variants.map((v) => v.active?.armIndex ?? 0);
		expect(new Set(actives)).toEqual(new Set([0, 1]));
	});
});
