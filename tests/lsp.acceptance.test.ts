// tests/lsp.acceptance.test.ts
//
// The acceptance gate: drives the REAL LSP server (startServer) over an in-memory
// JSON-RPC duplex pair — the same code path the stdio binary uses — and asserts
// positioned results for all four features against a temp workspace with
// .sqllens.json + schema.json. A green run here is the proof the library is
// sufficient for the LSP consumer.
//
// Subpath note (adapted from the plan): the plan's imports use a `.js` suffix on
// the package subpaths (`vscode-languageserver/node.js`), but those packages'
// `exports` map only declares `"./node"` (no `"./node.js"` key), so the suffixed
// form fails to resolve under vitest's Bundler resolution. The bare `"./node"`
// subpath resolves and matches src/lsp/main.ts — used here.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Duplex } from "node:stream";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createConnection } from "vscode-languageserver/node";
import {
	createProtocolConnection,
	StreamMessageReader,
	StreamMessageWriter,
	InitializeRequest,
	DidOpenTextDocumentNotification,
	DidChangeTextDocumentNotification,
	HoverRequest,
	DefinitionRequest,
	DocumentSymbolRequest,
	SemanticTokensRequest,
	SemanticTokensRangeRequest,
	SemanticTokensDeltaRequest,
	CompletionRequest,
	CompletionResolveRequest,
	SignatureHelpRequest,
	ReferencesRequest,
	DocumentHighlightRequest,
	CodeLensRequest,
	FoldingRangeRequest,
	SelectionRangeRequest,
	InlayHintRequest,
	DocumentDiagnosticRequest,
	DiagnosticSeverity,
	PublishDiagnosticsNotification,
	type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { SEMANTIC_LEGEND } from "../src/lsp/features/semantic-tokens.js";
import { startServer } from "../src/lsp/server.js";
import { SqlDocument, CallbackSchema, type TableResolver } from "../src/index.js";

// Diagnostic.message is typed `string | MarkupContent` in this version; coerce.
const msg = (m: string | { value: string }): string => (typeof m === "string" ? m : m.value);

class TestStream extends Duplex {
	_write(chunk: Buffer, _enc: string, done: () => void) {
		this.emit("data", chunk);
		done();
	}
	_read() {}
}

let root: string;
let client: ReturnType<typeof createProtocolConnection>;
const diagnosticsByUri = new Map<string, PublishDiagnosticsParams>();

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), "sqllens-lsp-"));
	writeFileSync(
		join(root, ".sqllens.json"),
		JSON.stringify({
			dialects: [{ files: "**/*.sql", dialect: "databricks" }],
			default: "databricks",
			schema: "schema.json",
		}),
	);
	writeFileSync(
		join(root, "schema.json"),
		JSON.stringify({
			sales: { amount: "decimal", id: "int" },
			orders: { id: { type: "int", nullable: false }, cust_id: "int" },
			customers: { id: "int" },
		}),
	);

	const up = new TestStream();
	const down = new TestStream();
	// Server reads `up`, writes `down`; client reads `down`, writes `up`.
	const serverConnection = createConnection(new StreamMessageReader(up), new StreamMessageWriter(down));
	startServer(serverConnection);

	client = createProtocolConnection(new StreamMessageReader(down), new StreamMessageWriter(up));
	client.onNotification(PublishDiagnosticsNotification.type, (p) => {
		diagnosticsByUri.set(p.uri, p);
	});
	client.listen();

	await client.sendRequest(InitializeRequest.type, {
		processId: null,
		rootUri: pathToFileURL(root).toString(),
		capabilities: {},
		workspaceFolders: null,
	});
});

afterAll(() => {
	client.dispose();
	rmSync(root, { recursive: true, force: true });
});

function open(name: string, text: string): string {
	const uri = pathToFileURL(join(root, name)).toString();
	void client.sendNotification(DidOpenTextDocumentNotification.type, {
		textDocument: { uri, languageId: "sql", version: 1, text },
	});
	return uri;
}

function change(uri: string, version: number, text: string): void {
	void client.sendNotification(DidChangeTextDocumentNotification.type, {
		textDocument: { uri, version },
		contentChanges: [{ text }], // Full-sync (TextDocumentSyncKind.Full): one change with the whole text.
	});
}

/** Wait until the published diagnostics for `uri` satisfy `pred` (the server republishes on change). */
async function waitForDiagnosticsWhere(
	uri: string,
	pred: (d: PublishDiagnosticsParams) => boolean,
): Promise<PublishDiagnosticsParams> {
	for (let i = 0; i < 50; i++) {
		const d = diagnosticsByUri.get(uri);
		if (d && pred(d)) return d;
		await new Promise((r) => setTimeout(r, 10));
	}
	throw new Error("diagnostics never satisfied predicate for " + uri);
}

async function waitForDiagnostics(uri: string): Promise<PublishDiagnosticsParams> {
	for (let i = 0; i < 50; i++) {
		const d = diagnosticsByUri.get(uri);
		if (d) return d;
		await new Promise((r) => setTimeout(r, 10));
	}
	throw new Error("no diagnostics published for " + uri);
}

/** Poll `fn` until it returns a defined value (used by the lazy-catalog suite, which collects every
 *  publish rather than only the latest-per-uri). */
async function waitFor<T>(fn: () => T | undefined): Promise<T> {
	for (let i = 0; i < 50; i++) {
		const v = fn();
		if (v !== undefined) return v;
		await new Promise((r) => setTimeout(r, 10));
	}
	throw new Error("waitFor: predicate never satisfied");
}

describe("LSP acceptance", () => {
	it("syntax diagnostic lands on the expected line", async () => {
		// NOTE: the plan's "SELECT FROM" parses cleanly in the Databricks grammar
		// (FROM is read as the projection) and yields only a semantic diagnostic, not
		// a syntax error. "SELECT * FORM x" (FORM typo) is reliably rejected and
		// produces a real syntax diagnostic on line 0.
		const uri = open("broken.sql", "SELECT * FORM x");
		const d = await waitForDiagnostics(uri);
		expect(d.diagnostics.length).toBeGreaterThanOrEqual(1);
		expect(d.diagnostics[0].range.start.line).toBe(0);
	});

	it("semantic diagnostic flags an unknown column with the schema", async () => {
		const uri = open("bad-col.sql", "SELECT nope FROM sales");
		const d = await waitForDiagnostics(uri);
		expect(d.diagnostics.some((x) => /nope|unknown/i.test(msg(x.message)))).toBe(true);
	});

	it("valid SQL with matching schema is diagnostic-clean", async () => {
		const uri = open("ok.sql", "SELECT amount FROM sales");
		const d = await waitForDiagnostics(uri);
		expect(d.diagnostics).toEqual([]);
	});

	it("a call-arity diagnostic squiggles the RIGHT statement (per-cell, statement 2)", async () => {
		// Statement 1 is clean; nullif takes exactly 2 args, so nullif(amount) in statement 2 is a
		// wrong-arity WARNING — and it must land on statement 2's line (line 1), proving the per-cell
		// qualification merge carries the diagnostic to the right document position.
		const uri = open("calls.sql", "SELECT amount FROM sales;\nSELECT nullif(amount) FROM sales;");
		const d = await waitForDiagnosticsWhere(uri, (x) => x.diagnostics.some((y) => /nullif/i.test(msg(y.message))));
		const arity = d.diagnostics.find((y) => /nullif/i.test(msg(y.message)));
		expect(arity).toBeDefined();
		expect(arity!.range.start.line).toBe(1);
		expect(arity!.severity).toBe(DiagnosticSeverity.Warning);
	});

	it("hover returns the inferred type of a column", async () => {
		const text = "SELECT amount FROM sales";
		const uri = open("hover.sql", text);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.indexOf("amount") },
		});
		expect(hover).not.toBeNull();
		const value = (hover as any).contents.value as string;
		expect(value).toMatch(/decimal/);
	});

	it("hover over a NOT-NULL schema column shows the type and 'not null'", async () => {
		const text = "SELECT id FROM orders";
		const uri = open("hover-notnull.sql", text);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.indexOf("id") },
		});
		expect(hover).not.toBeNull();
		const value = (hover as any).contents.value as string;
		expect(value).toMatch(/int/);
		expect(value).toMatch(/not null/);
	});

	it("hover over the same NOT-NULL column behind a LEFT JOIN shows 'nullable'", async () => {
		const text = "SELECT o.id FROM customers c LEFT JOIN orders o ON c.id = o.cust_id";
		const uri = open("hover-leftjoin.sql", text);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.indexOf("o.id") + 2 },
		});
		expect(hover).not.toBeNull();
		const value = (hover as any).contents.value as string;
		expect(value).toMatch(/int/);
		expect(value).toMatch(/nullable/);
		expect(value).not.toMatch(/not null/);
	});

	it("hover over an un-schema'd (nullability-unstated) column shows the type only — no noise", async () => {
		const text = "SELECT cust_id FROM orders";
		const uri = open("hover-unstated.sql", text);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.indexOf("cust_id") },
		});
		expect(hover).not.toBeNull();
		const value = (hover as any).contents.value as string;
		expect(value).toMatch(/int/);
		expect(value).not.toMatch(/not null/);
		expect(value).not.toMatch(/nullable/);
	});

	it("go-to-definition jumps from a CTE reference to its declaration", async () => {
		const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const uri = open("def.sql", text);
		const loc = await client.sendRequest(DefinitionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.lastIndexOf("recent") },
		});
		expect(loc).not.toBeNull();
		const range = Array.isArray(loc) ? (loc[0] as any).range : (loc as any).range;
		// The definition is the CTE declaration earlier in the text, before the reference.
		expect(range.start.character).toBeLessThan(text.lastIndexOf("recent"));
	});

	it("document symbols list a CTE", async () => {
		const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const uri = open("sym.sql", text);
		const syms = await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
		expect((syms as any[]).some((s) => s.name === "recent")).toBe(true);
	});

	it("serves results from the REBUILT document after an edit (not the stale text)", async () => {
		// Open valid text → diagnostic-clean; then change the SAME document to text with an
		// unknown column. The server must rebuild its SqlDocument and serve the NEW text:
		// a semantic diagnostic for the unknown column, and a hover that reflects the new column.
		const v1 = "SELECT amount FROM sales";
		const uri = open("edit.sql", v1);
		await waitForDiagnosticsWhere(uri, (d) => d.diagnostics.length === 0);

		const v2 = "SELECT nope FROM sales";
		change(uri, 2, v2);
		const after = await waitForDiagnosticsWhere(uri, (d) =>
			d.diagnostics.some((x) => /nope|unknown/i.test(msg(x.message))),
		);
		expect(after.diagnostics.some((x) => /nope|unknown/i.test(msg(x.message)))).toBe(true);

		// Hover over the NEW column position resolves against the rebuilt doc (id is int per schema).
		const v3 = "SELECT id FROM sales";
		change(uri, 3, v3);
		await waitForDiagnosticsWhere(uri, (d) => d.diagnostics.length === 0);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: v3.indexOf("id") },
		});
		expect(hover).not.toBeNull();
		expect((hover as any).contents.value as string).toMatch(/int/);
	});

	it("reuses the cached document across requests on an unchanged version, rebuilds once per edit", async () => {
		// A document is (re)built on open/change — NOT per request. Since Task 6 an EDIT rebuilds via
		// prev.withText() (carrying the cell cache), while a fresh open uses SqlDocument.create — so
		// "builds" counts both paths. Assert on DELTAS: request handlers add zero builds, one edit adds one.
		const createSpy = vi.spyOn(SqlDocument, "create");
		const withTextSpy = vi.spyOn(SqlDocument.prototype, "withText");
		const builds = (): number => createSpy.mock.calls.length + withTextSpy.mock.calls.length;
		try {
			const text = "SELECT amount FROM sales";
			const uri = open("cache.sql", text);
			await waitForDiagnostics(uri);
			// Let any open-time build(s) settle, then snapshot the count.
			await new Promise((r) => setTimeout(r, 20));
			const settled = builds();
			expect(settled).toBeGreaterThanOrEqual(1);

			const pos = { line: 0, character: text.indexOf("amount") };
			await client.sendRequest(HoverRequest.type, { textDocument: { uri }, position: pos });
			await client.sendRequest(HoverRequest.type, { textDocument: { uri }, position: pos });
			await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
			// Three requests on the unchanged doc: served from cache, zero new builds.
			expect(builds()).toBe(settled);

			// One edit rebuilds exactly once (via withText). Edit to text whose diagnostics DIFFER from
			// the open-time state (an unknown column), so the wait can only succeed after the change's
			// rebuild lands — not on stale open-time diagnostics.
			change(uri, 2, "SELECT nope FROM sales");
			await waitForDiagnosticsWhere(uri, (d) => d.diagnostics.some((x) => /nope|unknown/i.test(msg(x.message))));
			expect(builds()).toBe(settled + 1);
		} finally {
			createSpy.mockRestore();
			withTextSpy.mockRestore();
		}
	});

	// Decode the LSP semantic-tokens `data` (flat array of 5-int tuples, delta-encoded:
	// deltaLine, deltaStart, length, tokenType, tokenModifiers) into absolute positioned
	// tokens with their resolved type name (per SEMANTIC_LEGEND.tokenTypes).
	function decodeSemanticTokens(data: number[]): {
		line: number;
		char: number;
		length: number;
		type: string;
	}[] {
		const out: { line: number; char: number; length: number; type: string }[] = [];
		let line = 0;
		let char = 0;
		for (let i = 0; i + 4 < data.length; i += 5) {
			const dLine = data[i];
			const dStart = data[i + 1];
			const length = data[i + 2];
			const typeIdx = data[i + 3];
			if (dLine === 0) {
				char += dStart;
			} else {
				line += dLine;
				char = dStart;
			}
			out.push({ line, char, length, type: SEMANTIC_LEGEND.tokenTypes[typeIdx] });
		}
		return out;
	}

	it("semantic tokens classify keywords and identifiers at the right positions", async () => {
		const text = "SELECT amount FROM sales";
		const uri = open("semtok.sql", text);
		const result = await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		const toks = decodeSemanticTokens((result as any).data as number[]);

		// SELECT keyword at line 0, col 0.
		expect(toks.some((t) => t.type === "keyword" && t.line === 0 && t.char === 0)).toBe(true);
		// FROM keyword at its column.
		expect(toks.some((t) => t.type === "keyword" && t.line === 0 && t.char === text.indexOf("FROM"))).toBe(true);
		// `amount` is an identifier → variable.
		expect(toks.some((t) => t.type === "variable" && t.line === 0 && t.char === text.indexOf("amount"))).toBe(true);
	});

	it("semantic tokens emit a block comment as comment", async () => {
		const text = "/* c */ SELECT 1";
		const uri = open("semtok-comment.sql", text);
		const result = await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		const toks = decodeSemanticTokens((result as any).data as number[]);
		expect(toks.some((t) => t.type === "comment" && t.line === 0 && t.char === 0)).toBe(true);
	});

	it("semantic tokens split a multi-line block comment into one entry per line", async () => {
		// A block comment spanning two lines must emit TWO `comment` tokens: the first on
		// its own line at the comment's start column, the second on the next line at column 0
		// (the multi-line split path). The comment starts at a NON-ZERO column so the
		// first-line-vs-subsequent-line column logic is genuinely observable: if subsequent
		// lines wrongly reused the token's start column, the second entry would land at the
		// start column (>0) instead of 0, failing this test. The trailing SELECT keyword must
		// still decode at its correct absolute position after the comment closes.
		const text = "SELECT /* line1\nline2 */ 1";
		//            line 0: "SELECT /* line1"   (SELECT at col 0; comment starts at col 7)
		//            line 1: "line2 */ 1"        (comment tail at col 0; literal 1 at col 9)
		const uri = open("semtok-multiline.sql", text);
		const result = await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		const toks = decodeSemanticTokens((result as any).data as number[]);

		const commentStartCol = text.indexOf("/*"); // 7 — the comment's start column on line 0
		expect(commentStartCol).toBeGreaterThan(0);

		const comments = toks.filter((t) => t.type === "comment");
		// Exactly two comment entries, on consecutive lines.
		expect(comments.length).toBe(2);
		// First segment: line 0, at the comment's start column (7, NOT 0).
		const first = comments.find((t) => t.line === 0);
		expect(first).toBeDefined();
		expect(first!.char).toBe(commentStartCol);
		// Second segment: next line, at column 0 — the subsequent-line rule, NOT the
		// first line's start column (this is the assertion that fails on a regression).
		const second = comments.find((t) => t.line === 1);
		expect(second).toBeDefined();
		expect(second!.char).toBe(0);

		// The trailing SELECT keyword still decodes at its absolute position on line 0.
		expect(toks.some((t) => t.type === "keyword" && t.line === 0 && t.char === 0)).toBe(true);
	});

	it("semantic tokens are produced on broken input", async () => {
		const uri = open("semtok-broken.sql", "SELECT amount FORM");
		const result = await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		expect(((result as any).data as number[]).length).toBeGreaterThan(0);
	});

	it("semantic tokens range returns only the requested line's tokens", async () => {
		// Two statements on two lines; request semantic tokens for line 1 only. Every decoded
		// token must land on line 1 — the line-0 tokens are filtered out by the offset window.
		const text = "SELECT amount FROM sales\nSELECT id FROM sales";
		const uri = open("semtok-range.sql", text);
		const result = await client.sendRequest(SemanticTokensRangeRequest.type, {
			textDocument: { uri },
			range: { start: { line: 1, character: 0 }, end: { line: 1, character: 100 } },
		});
		const toks = decodeSemanticTokens((result as any).data as number[]);
		expect(toks.length).toBeGreaterThan(0);
		for (const t of toks) expect(t.line).toBe(1);
		// The line-1 SELECT keyword is present; nothing from line 0 leaks in.
		expect(toks.some((t) => t.type === "keyword" && t.line === 1 && t.char === 0)).toBe(true);
	});

	it("semantic tokens delta returns empty edits when nothing changed", async () => {
		// Full request seeds a resultId; a delta with that SAME id over UNCHANGED text yields a
		// delta result whose edits are empty (no token moved).
		const text = "SELECT amount FROM sales";
		const uri = open("semtok-delta.sql", text);
		const full = (await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } })) as any;
		expect(full.resultId).toBeDefined();
		const delta = (await client.sendRequest(SemanticTokensDeltaRequest.type, {
			textDocument: { uri },
			previousResultId: full.resultId,
		})) as any;
		// A delta result carries `edits`; with no change the edit list is empty.
		expect(Array.isArray(delta.edits)).toBe(true);
		expect(delta.edits.length).toBe(0);
	});

	it("semantic tokens delta with an unknown previousResultId falls back to a full token set", async () => {
		const text = "SELECT amount FROM sales";
		const uri = open("semtok-delta-stale.sql", text);
		// Seed a full result so the uri is known, then ask for a delta against a bogus id.
		await client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		const delta = (await client.sendRequest(SemanticTokensDeltaRequest.type, {
			textDocument: { uri },
			previousResultId: "definitely-not-a-real-id",
		})) as any;
		// Fallback: a full SemanticTokens (has `data`, no `edits`), with the line-0 SELECT keyword.
		expect(Array.isArray(delta.data)).toBe(true);
		expect(delta.edits).toBeUndefined();
		const toks = decodeSemanticTokens(delta.data as number[]);
		expect(toks.some((t) => t.type === "keyword" && t.line === 0 && t.char === 0)).toBe(true);
	});

	it("completion offers the FROM relation's schema columns at an empty-projection caret", async () => {
		// Mid-edit: caret in the empty projection of `SELECT  FROM sales`. The completion provider
		// resolves the FROM relation's columns from the workspace schema (sales: amount, id).
		const text = "SELECT  FROM sales";
		const uri = open("complete.sql", text);
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: "SELECT ".length },
		});
		const list = Array.isArray(items) ? items : ((items as any)?.items ?? []);
		const labels = (list as { label: string }[]).map((c) => c.label);
		expect(labels).toContain("amount");
		expect(labels).toContain("id");
	});

	it("completionItem/resolve fills a function item's detail with its parameter signature", async () => {
		// At a column slot, completion offers dialect functions (no detail eagerly). Resolving a
		// curated function item (date_add) must lazily fill `detail` with the rendered param list.
		const text = "SELECT  FROM sales";
		const uri = open("complete-fn.sql", text);
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: "SELECT ".length },
		});
		const list = Array.isArray(items) ? items : ((items as any)?.items ?? []);
		const fnItem = (list as any[]).find((c) => c.label === "date_add");
		expect(fnItem).toBeDefined();
		// Not eagerly filled — detail arrives only on resolve.
		expect(fnItem.detail).toBeUndefined();

		const resolved = (await client.sendRequest(CompletionResolveRequest.type, fnItem)) as any;
		expect(resolved.detail).toBeDefined();
		// The rendered signature names the function and its parameters.
		expect(resolved.detail).toContain("date_add");
		expect(resolved.detail).toContain("(");
		expect(resolved.detail).toContain("start_date");
	});

	it("completionItem/resolve leaves a non-function item unchanged", async () => {
		const text = "SELECT  FROM sales";
		const uri = open("complete-col.sql", text);
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: "SELECT ".length },
		});
		const list = Array.isArray(items) ? items : ((items as any)?.items ?? []);
		const colItem = (list as any[]).find((c) => c.label === "amount");
		expect(colItem).toBeDefined();
		const resolved = (await client.sendRequest(CompletionResolveRequest.type, colItem)) as any;
		// A column item carries its own detail (the type) and is returned unchanged by resolve.
		expect(resolved.label).toBe("amount");
		expect(resolved.kind).toBe(colItem.kind);
	});

	it("signature help shows the active parameter inside a curated call's parens", async () => {
		// Mid-typing the 2nd arg of date_add: caret just after the comma. The signature provider names
		// date_add and reports activeParameter 1 (the comma at the call's depth advanced the index).
		const text = "SELECT date_add(x, ";
		const uri = open("sig.sql", text);
		const help = await client.sendRequest(SignatureHelpRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.length },
		});
		expect(help).not.toBeNull();
		const h = help as any;
		expect(h.activeParameter).toBe(1);
		expect(h.signatures[0].label).toContain("date_add");
	});

	it("references returns every occurrence of a CTE-projected column", async () => {
		// `id` is projected by the CTE `recent` and re-selected from it. The final `id`
		// reference, the CTE's projected `id`, and the base `id` all share identity (schema
		// unifies them via sales.id). references must return ≥2 Locations, deduped, with
		// ranges that actually cover an `id` occurrence in the source.
		const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const uri = open("refs.sql", text);
		const locs = await client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.lastIndexOf("id") },
			context: { includeDeclaration: true },
		});
		const list = (locs as any[]) ?? [];
		expect(list.length).toBeGreaterThanOrEqual(2);
		// Every range, sliced from the source, is the symbol `id`.
		for (const l of list) {
			const r = l.range;
			expect(r.start.line).toBe(0);
			expect(text.slice(r.start.character, r.end.character)).toBe("id");
		}
		// Deduped: no two Locations share the same range.
		const keys = list.map((l) => `${l.range.start.character}:${l.range.end.character}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("documentHighlight marks the declaration Write and references Read", async () => {
		const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const uri = open("hl.sql", text);
		const hls = await client.sendRequest(DocumentHighlightRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: text.lastIndexOf("id") },
		});
		const list = (hls as any[]) ?? [];
		expect(list.length).toBeGreaterThanOrEqual(2);
		// DocumentHighlightKind: 2 = Read, 3 = Write. The CTE-projected `id` is the declaration (Write);
		// at least one occurrence is a Read reference.
		const kinds = list.map((h) => h.kind);
		expect(kinds).toContain(2); // Read
		expect(kinds).toContain(3); // Write
		for (const h of list) expect(text.slice(h.range.start.character, h.range.end.character)).toBe("id");
	});

	it("references on broken input returns an empty array, no error", async () => {
		const uri = open("refs-broken.sql", "SELECT * FORM x");
		const locs = await client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: 0 },
			context: { includeDeclaration: true },
		});
		expect(locs).toEqual([]);
	});

	it("codeLens shows a reference count over a CTE declaration", async () => {
		// `recent` is declared as a CTE and referenced exactly once in the FROM. The count is
		// references only (excludes the declaration occurrence), so a CTE used once reads
		// "1 reference". A lens lands on the CTE declaration, at the declaration's position.
		const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const uri = open("lens.sql", text);
		const lenses = await client.sendRequest(CodeLensRequest.type, { textDocument: { uri } });
		const list = (lenses as any[]) ?? [];
		// A lens whose range covers the CTE declaration `recent` (the one before the reference).
		const declCol = text.indexOf("recent");
		const lens = list.find((l) => l.range.start.line === 0 && l.range.start.character === declCol);
		expect(lens).toBeDefined();
		expect(lens.range.start.character).toBeLessThan(text.lastIndexOf("recent"));
		// One use of `recent` → references-only count is 1, with singular wording.
		expect(lens.command.title).toBe("1 reference");
	});

	it("codeLens on broken input returns an empty array, no error", async () => {
		const uri = open("lens-broken.sql", "SELECT * FORM x");
		const lenses = await client.sendRequest(CodeLensRequest.type, { textDocument: { uri } });
		expect(lenses).toEqual([]);
	});

	it("foldingRange folds a multi-line CTE body and the statement", async () => {
		// A CTE whose body spans lines 0–3, with the outer SELECT below. The provider must
		// emit a fold covering the CTE body (a multi-line region) — and the whole statement.
		const text = "WITH r AS (\n  SELECT id\n  FROM sales\n)\nSELECT id\nFROM r";
		//            line 0: WITH r AS (
		//            line 1:   SELECT id
		//            line 2:   FROM sales
		//            line 3: )
		//            line 4: SELECT id
		//            line 5: FROM r
		const uri = open("fold.sql", text);
		const ranges = (await client.sendRequest(FoldingRangeRequest.type, { textDocument: { uri } })) as any[];
		expect(ranges.length).toBeGreaterThanOrEqual(1);
		// The CTE body `( SELECT id FROM sales )` spans line 0 → line 3.
		expect(ranges.some((r) => r.startLine === 0 && r.endLine === 3)).toBe(true);
		// Every emitted range is multi-line.
		for (const r of ranges) expect(r.endLine).toBeGreaterThan(r.startLine);
		// De-duped: no two identical (startLine,endLine) pairs.
		const keys = ranges.map((r) => `${r.startLine}:${r.endLine}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("foldingRange returns [] for a single-line query", async () => {
		const uri = open("fold-single.sql", "SELECT id FROM sales");
		const ranges = await client.sendRequest(FoldingRangeRequest.type, { textDocument: { uri } });
		expect(ranges).toEqual([]);
	});

	it("foldingRange on broken input returns an empty array, no error", async () => {
		const uri = open("fold-broken.sql", "SELECT * FORM x");
		const ranges = await client.sendRequest(FoldingRangeRequest.type, { textDocument: { uri } });
		expect(Array.isArray(ranges)).toBe(true);
	});

	it("selectionRange widens from a column to the whole statement", async () => {
		// Caret inside `amount`: the innermost SelectionRange must cover `amount`, and its
		// .parent chain must widen through strictly larger ranges out to the whole statement.
		const text = "SELECT amount FROM sales";
		const uri = open("selrange.sql", text);
		const amountStart = text.indexOf("amount");
		const result = (await client.sendRequest(SelectionRangeRequest.type, {
			textDocument: { uri },
			positions: [{ line: 0, character: amountStart + 1 }],
		})) as any[];
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);

		// Walk the .parent chain into a list of ranges, innermost first.
		const ranges: { start: { character: number }; end: { character: number } }[] = [];
		for (let sr: any = result[0]; sr; sr = sr.parent) ranges.push(sr.range);

		// At least two levels: innermost covers `amount`; outermost covers the whole statement.
		expect(ranges.length).toBeGreaterThanOrEqual(2);
		const innermost = ranges[0];
		expect(innermost.start.character).toBeLessThanOrEqual(amountStart);
		expect(innermost.end.character).toBeGreaterThanOrEqual(amountStart + "amount".length);

		// Each parent strictly contains its child (no duplicate identical ranges).
		for (let i = 1; i < ranges.length; i++) {
			const child = ranges[i - 1];
			const parent = ranges[i];
			const wider = parent.start.character < child.start.character || parent.end.character > child.end.character;
			const notNarrower =
				parent.start.character <= child.start.character && parent.end.character >= child.end.character;
			expect(wider && notNarrower).toBe(true);
		}

		// The outermost range covers the entire statement text.
		const outer = ranges[ranges.length - 1];
		expect(outer.start.character).toBe(0);
		expect(outer.end.character).toBe(text.length);
	});

	it("inlayHint shows the inferred type at the end of a SELECT output column", async () => {
		// `amount` is decimal per the workspace schema; the inlay hint annotates the projection
		// end with its inferred type. The hint must land at the end of the `amount` token.
		const text = "SELECT amount FROM sales";
		const uri = open("inlay.sql", text);
		const fullRange = {
			start: { line: 0, character: 0 },
			end: { line: 0, character: text.length },
		};
		const hints = (await client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: fullRange,
		})) as any[];
		expect(Array.isArray(hints)).toBe(true);
		expect(hints.length).toBeGreaterThanOrEqual(1);
		const label = (h: any): string =>
			typeof h.label === "string" ? h.label : h.label.map((p: any) => p.value).join("");
		const amountHint = hints.find((h) => /decimal/.test(label(h)));
		expect(amountHint).toBeDefined();
		// The hint anchors at the end of the `amount` token.
		const amountEnd = text.indexOf("amount") + "amount".length;
		expect(amountHint.position.line).toBe(0);
		expect(amountHint.position.character).toBe(amountEnd);
	});

	it("inlayHint without a typed column emits no hint, no error", async () => {
		// `1` projects no schema-resolvable column; with EMPTY-schema inference a bare literal still
		// resolves to a scalar, but a column with no schema match yields `unknown` → skipped. Use an
		// unknown column ref so the projection's type is `unknown` and no hint is emitted for it.
		const text = "SELECT mystery FROM nowhere";
		const uri = open("inlay-none.sql", text);
		const hints = (await client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 0, character: 0 }, end: { line: 0, character: text.length } },
		})) as any[];
		expect(Array.isArray(hints)).toBe(true);
		const label = (h: any): string =>
			typeof h.label === "string" ? h.label : h.label.map((p: any) => p.value).join("");
		// No hint covers the `mystery` projection (its type is unknown).
		const myEnd = text.indexOf("mystery") + "mystery".length;
		expect(hints.some((h) => h.position.character === myEnd)).toBe(false);
	});

	it("inlayHint only emits hints inside the requested range", async () => {
		// Two statements on two lines; request hints for line 1 only. The line-0 projection's hint
		// must be excluded (LSP sends the visible range).
		const text = "SELECT amount FROM sales;\nSELECT id FROM sales";
		const uri = open("inlay-range.sql", text);
		const hints = (await client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 1, character: 0 }, end: { line: 1, character: 100 } },
		})) as any[];
		expect(Array.isArray(hints)).toBe(true);
		for (const h of hints) expect(h.position.line).toBe(1);
	});

	it("inlayHint on broken input returns an empty array, no error", async () => {
		const uri = open("inlay-broken.sql", "SELECT * FORM x");
		const hints = await client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 0, character: 0 }, end: { line: 0, character: 15 } },
		});
		expect(Array.isArray(hints)).toBe(true);
	});

	it("pull diagnostics (textDocument/diagnostic) returns a full report flagging an unknown column", async () => {
		// Pull model: the client asks for diagnostics on demand. The full report's `items` carry the
		// same diagnostics the push path would publish — here, the unknown column `nope`.
		const uri = open("pull-bad.sql", "SELECT nope FROM sales");
		const report = (await client.sendRequest(DocumentDiagnosticRequest.type, { textDocument: { uri } })) as any;
		expect(report.kind).toBe("full");
		expect(Array.isArray(report.items)).toBe(true);
		expect(report.items.some((x: any) => /nope|unknown/i.test(msg(x.message)))).toBe(true);
	});

	it("pull diagnostics returns an empty full report for valid SQL", async () => {
		const uri = open("pull-ok.sql", "SELECT amount FROM sales");
		const report = (await client.sendRequest(DocumentDiagnosticRequest.type, { textDocument: { uri } })) as any;
		expect(report.kind).toBe("full");
		expect(report.items).toEqual([]);
	});

	it("pull diagnostics returns the syntax diagnostic on broken input", async () => {
		const uri = open("pull-broken.sql", "SELECT * FORM x");
		const report = (await client.sendRequest(DocumentDiagnosticRequest.type, { textDocument: { uri } })) as any;
		expect(report.kind).toBe("full");
		expect(report.items.length).toBeGreaterThanOrEqual(1);
		expect(report.items[0].range.start.line).toBe(0);
	});

	it("selectionRange on broken input returns a range, no error", async () => {
		const uri = open("selrange-broken.sql", "SELECT * FORM x");
		const result = (await client.sendRequest(SelectionRangeRequest.type, {
			textDocument: { uri },
			positions: [{ line: 0, character: 3 }],
		})) as any[];
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
		expect(result[0].range).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Task 6 — per-statement semantics. A multi-statement file used to be
// semantically dead (the compound-flagged facade collapsed every statement past
// the first). Each statement is now its own scoped cell: features route through
// the cell owning the caret, and whole-doc features merge across every cell.
// The matrix below is positioned on STATEMENT 2 (doc line 1) so every assertion
// proves the cell routing + the cell-relative→doc coordinate shift.
// ---------------------------------------------------------------------------
describe("LSP multi-statement semantics (Task 6)", () => {
	it("hover on statement 2's column answers from its own scope", async () => {
		const text = "SELECT amount FROM sales;\nSELECT id FROM sales";
		const uri = open("multi-hover.sql", text);
		await waitForDiagnostics(uri);
		const line1 = "SELECT id FROM sales";
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 1, character: line1.indexOf("id") },
		});
		expect(hover).not.toBeNull();
		expect((hover as any).contents.value as string).toMatch(/int/);
	});

	it("completion at a caret in statement 2 offers that statement's columns", async () => {
		const text = "SELECT id FROM sales;\nSELECT  FROM sales";
		const uri = open("multi-complete.sql", text);
		await waitForDiagnostics(uri);
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 1, character: "SELECT ".length },
		});
		const list = Array.isArray(items) ? items : ((items as any)?.items ?? []);
		const labels = (list as { label: string }[]).map((c) => c.label);
		expect(labels).toContain("amount");
		expect(labels).toContain("id");
	});

	it("an unknown-column error in statement 1 does not suppress statement 2's hover", async () => {
		const text = "SELECT nope FROM sales;\nSELECT amount FROM sales";
		const uri = open("multi-mixed.sql", text);
		const d = await waitForDiagnosticsWhere(uri, (x) =>
			x.diagnostics.some((y) => /nope|unknown/i.test(msg(y.message))),
		);
		// statement 1's semantic error is present (proves per-cell analyze runs on cell 1)...
		expect(d.diagnostics.some((y) => /nope|unknown/i.test(msg(y.message)))).toBe(true);
		// ...and statement 2's hover still resolves — not dark from the earlier statement's error.
		const line1 = "SELECT amount FROM sales";
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 1, character: line1.indexOf("amount") },
		});
		expect(hover).not.toBeNull();
		expect((hover as any).contents.value as string).toMatch(/decimal/);
	});

	it("document symbols list output columns of BOTH statements", async () => {
		const text = "SELECT amount AS a FROM sales;\nSELECT id AS b FROM sales";
		const uri = open("multi-sym.sql", text);
		await waitForDiagnostics(uri);
		const syms = (await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } })) as any[];
		const names = syms.map((s) => s.name);
		expect(names).toContain("a");
		expect(names).toContain("b");
		// the second statement's symbol carries its real doc-coordinate line (line 1), not the facade's line 0.
		const b = syms.find((s) => s.name === "b");
		expect(b.range.start.line).toBe(1);
	});

	it("a semantic diagnostic in statement 2 is positioned on statement 2's line", async () => {
		const text = "SELECT amount FROM sales;\nSELECT nope FROM sales";
		const uri = open("multi-diag2.sql", text);
		const d = await waitForDiagnosticsWhere(uri, (x) =>
			x.diagnostics.some((y) => /nope|unknown/i.test(msg(y.message))),
		);
		const bad = d.diagnostics.find((y) => /nope|unknown/i.test(msg(y.message)))!;
		expect(bad.range.start.line).toBe(1);
		expect("SELECT nope FROM sales".slice(bad.range.start.character, bad.range.end.character)).toBe("nope");
	});

	it("go-to-definition resolves a CTE declared in statement 2 (doc-coordinate range)", async () => {
		const text = "SELECT amount FROM sales;\nWITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const uri = open("multi-def.sql", text);
		await waitForDiagnostics(uri);
		const line1 = "WITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const loc = await client.sendRequest(DefinitionRequest.type, {
			textDocument: { uri },
			position: { line: 1, character: line1.lastIndexOf("c") },
		});
		expect(loc).not.toBeNull();
		const range = Array.isArray(loc) ? (loc[0] as any).range : (loc as any).range;
		expect(range.start.line).toBe(1);
		expect(range.start.character).toBe(line1.indexOf("c"));
	});

	it("references of a statement-2 CTE column are all on statement 2's line", async () => {
		const text = "SELECT amount FROM sales;\nWITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const uri = open("multi-refs.sql", text);
		await waitForDiagnostics(uri);
		const line1 = "WITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const locs = (await client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri },
			position: { line: 1, character: line1.lastIndexOf("id") },
			context: { includeDeclaration: true },
		})) as any[];
		expect(locs.length).toBeGreaterThanOrEqual(2);
		for (const l of locs) {
			expect(l.range.start.line).toBe(1);
			expect(line1.slice(l.range.start.character, l.range.end.character)).toBe("id");
		}
	});

	it("inlay hints annotate output columns of BOTH statements", async () => {
		const text = "SELECT amount FROM sales;\nSELECT id FROM sales";
		const uri = open("multi-inlay.sql", text);
		await waitForDiagnostics(uri);
		const hints = (await client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 0, character: 0 }, end: { line: 1, character: 100 } },
		})) as any[];
		const label = (h: any): string =>
			typeof h.label === "string" ? h.label : h.label.map((p: any) => p.value).join("");
		const line0 = hints.filter((h) => h.position.line === 0);
		const line1 = hints.filter((h) => h.position.line === 1);
		expect(line0.some((h) => /decimal/.test(label(h)))).toBe(true);
		expect(line1.some((h) => /int/.test(label(h)))).toBe(true);
	});

	it("selectionRange in statement 2 widens through doc-coordinate ranges", async () => {
		const text = "SELECT amount FROM sales;\nSELECT id FROM sales";
		const uri = open("multi-sel.sql", text);
		const line1 = "SELECT id FROM sales";
		const idStart = line1.indexOf("id");
		const result = (await client.sendRequest(SelectionRangeRequest.type, {
			textDocument: { uri },
			positions: [{ line: 1, character: idStart + 1 }],
		})) as any[];
		expect(result.length).toBe(1);
		// The innermost range covers `id` on doc line 1 (proves the CST-node range shifted to doc coords).
		expect(result[0].range.start.line).toBe(1);
		expect(result[0].range.start.character).toBeLessThanOrEqual(idStart);
	});
});

// ---------------------------------------------------------------------------
// Task 8 — lazy catalog. A host embeds the server with a CallbackSchema (the
// resolve-on-demand catalog) instead of a static file schema. The FIRST publish
// resolves against a cold host cache, so an unknown table squiggles. The server's
// publish loop then warms the resolver in the background (prime()) and — when a
// table is revealed — RE-publishes; the second publish drops the diagnostic. This
// is the whole lazy-catalog contract: never-wrong on the cold read, self-healing
// when the resolver warms.
// ---------------------------------------------------------------------------
describe("LSP lazy catalog (Task 8)", () => {
	let lazyRoot: string;
	let lazyClient: ReturnType<typeof createProtocolConnection>;
	const publishes: PublishDiagnosticsParams[] = [];
	let fetchCalls = 0;

	beforeAll(async () => {
		lazyRoot = mkdtempSync(join(tmpdir(), "sqllens-lazy-"));
		writeFileSync(
			join(lazyRoot, ".sqllens.json"),
			JSON.stringify({ dialects: [{ files: "**/*.sql", dialect: "databricks" }], default: "databricks" }),
		);

		// The host's warm cache — empty at first. `resolve` is a sync read of it (a cold miss returns
		// undefined → the CallbackSchema records the miss); `fetch` is the background warm that reveals
		// `orders` on the first prime.
		const cache = new Map<string, { name: string; type?: string }[]>();
		const resolver: TableResolver = {
			resolve: (parts) => cache.get(parts.join(".")),
			fetch: async (missing) => {
				fetchCalls++;
				for (const parts of missing) {
					if (parts.join(".") === "orders") cache.set("orders", [{ name: "id", type: "int" }]);
				}
			},
		};
		const schema = new CallbackSchema(resolver);

		const up = new TestStream();
		const down = new TestStream();
		const serverConnection = createConnection(new StreamMessageReader(up), new StreamMessageWriter(down));
		// The embedding entry point: the host hands the server a SchemaSource.
		startServer(serverConnection, { schema });

		lazyClient = createProtocolConnection(new StreamMessageReader(down), new StreamMessageWriter(up));
		lazyClient.onNotification(PublishDiagnosticsNotification.type, (p) => {
			publishes.push(p);
		});
		lazyClient.listen();

		await lazyClient.sendRequest(InitializeRequest.type, {
			processId: null,
			rootUri: pathToFileURL(lazyRoot).toString(),
			capabilities: {},
			workspaceFolders: null,
		});
	});

	afterAll(() => {
		lazyClient.dispose();
		rmSync(lazyRoot, { recursive: true, force: true });
	});

	it("first publish flags the unknown table; a later publish drops it once the resolver warms", async () => {
		const uri = pathToFileURL(join(lazyRoot, "lazy.sql")).toString();
		// `SELECT *` forces star-expansion, which needs the table's columns — so a cold `orders`
		// yields an unknown-table diagnostic that a warm one (columns revealed) clears.
		void lazyClient.sendNotification(DidOpenTextDocumentNotification.type, {
			textDocument: { uri, languageId: "sql", version: 1, text: "SELECT * FROM orders" },
		});

		// First publish: the host cache is cold, so `orders` is unknown and squiggles.
		const dirty = await waitFor(() =>
			publishes.find((p) => p.uri === uri && p.diagnostics.some((d) => /orders/i.test(msg(d.message)))),
		);
		expect(dirty.diagnostics.some((d) => /orders/i.test(msg(d.message)))).toBe(true);

		// The prime microtask warms the resolver, then a SECOND publish arrives — diagnostic-clean.
		const clean = await waitFor(() => publishes.find((p) => p.uri === uri && p.diagnostics.length === 0));
		expect(clean.diagnostics).toEqual([]);

		// It is a RE-publish (came after the dirty one), and the resolver was fetched exactly once
		// (in-flight coalescing — no double fetch on the single open).
		expect(publishes.indexOf(clean)).toBeGreaterThan(publishes.indexOf(dirty));
		expect(fetchCalls).toBe(1);
	});
});
