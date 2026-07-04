import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTemplated, type TagNode } from "../../src/index.js";
import type { Dialect } from "../../src/api.js";
import type { Token } from "../../src/token/token.js";
import type { PartSpan } from "../../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// inc1 jinja corpus gate (docs/jinja-front-end.md §inc1 gates). A focused,
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

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/jinja/", import.meta.url));
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

	switch (node.kind) {
		case "ref":
			assertSpanContent(node.modelSpan, text, node.model, "ref.modelSpan");
			assertSpanInBounds(node.callSpan, text, "ref.callSpan");
			break;
		case "source":
			assertSpanContent(node.sourceNameSpan, text, node.sourceName, "source.sourceNameSpan");
			assertSpanContent(node.tableNameSpan, text, node.tableName, "source.tableNameSpan");
			break;
		case "macro":
			assertSpanContent(node.nameSpan, text, node.name, "macro.nameSpan");
			if (node.packageName !== undefined && node.packageSpan) {
				assertSpanContent(node.packageSpan, text, node.packageName, "macro.packageSpan");
			}
			if (node.argsSpan) assertSpanInBounds(node.argsSpan, text, "macro.argsSpan");
			for (const [i, arg] of node.args.entries()) assertSpanInBounds(arg.span, text, `macro.args[${i}]`);
			break;
	}
}

describe("jinja corpus gate — inc1 (R1 unified stream + R2 tag spans)", () => {
	it(`loads the fixture set (${FIXTURES.length} files)`, () => {
		expect(FIXTURES.length).toBeGreaterThanOrEqual(10);
	});

	// Kinds observed across the whole set — proves the classifier actually fired
	// on the required shapes (ref / source / macro / var / config / control).
	const seenKinds = new Set<string>();

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
					assertTagSpans(node, text);
				}
			});
		});
	}

	it("the fixture set exercises ref / source / macro / var / config / control nodes", () => {
		// Populated by the per-fixture span assertions above.
		for (const { text } of FIXTURES) for (const n of parseTemplated(text, DIALECT).tags) seenKinds.add(n.kind);
		for (const kind of ["ref", "source", "macro", "var", "config", "control"]) {
			expect(seenKinds.has(kind), `no ${kind} node in the corpus`).toBe(true);
		}
	});
});

describe("jinja corpus gate — multi-line span correctness (R2 parity upgrade)", () => {
	it("a source() call split across lines carries content-true multi-line spans", () => {
		const text = readFileSync(FIXTURES_DIR + "05_multiline_tag.sql", "utf8");
		const { tags } = parseTemplated(text, DIALECT);
		const src = tags.find((t): t is Extract<TagNode, { kind: "source" }> => t.kind === "source");
		expect(src).toBeDefined();
		if (!src) return;
		// The two string args are on different lines — offset spans still slice true.
		expect(src.sourceNameSpan.line).not.toBe(src.tableNameSpan.line);
		expect(text.slice(src.sourceNameSpan.start, src.sourceNameSpan.end)).toBe(src.sourceName);
		expect(text.slice(src.tableNameSpan.start, src.tableNameSpan.end)).toBe(src.tableName);
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
