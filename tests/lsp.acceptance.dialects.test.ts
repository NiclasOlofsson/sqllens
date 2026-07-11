// The five-dialect LSP acceptance matrix: one real server, glob-routed dialects, the same
// smoke battery per dialect. The engines are dialect-tested at the library level; this is
// the proof the PROTOCOL layer serves every dialect, not just Databricks.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
	HoverRequest,
	DefinitionRequest,
	ReferencesRequest,
	CompletionRequest,
	SignatureHelpRequest,
	SemanticTokensRequest,
	DocumentSymbolRequest,
	InlayHintRequest,
} from "vscode-languageserver-protocol/node";
import { startLspHarness, type LspHarness } from "./helpers/lsp-harness.js";

const DIALECTS = [
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
] as const;

let h: LspHarness;
beforeAll(async () => {
	h = await startLspHarness({
		".sqllens.json": JSON.stringify({
			dialects: DIALECTS.map((d) => ({ files: `**/*.${d}.sql`, dialect: d })),
			default: "databricks",
			schema: "schema.json",
		}),
		"schema.json": JSON.stringify({ sales: { amount: "decimal", id: "int" } }),
	});
});
afterAll(() => h.dispose());

describe.each(DIALECTS)("LSP over %s", (d) => {
	it("valid SQL is diagnostic-clean", async () => {
		const uri = h.open(`ok.${d}.sql`, "SELECT amount FROM sales");
		const diag = await h.waitForDiagnostics(uri);
		expect(diag.diagnostics).toEqual([]);
	});

	it("a syntax error yields a positioned diagnostic", async () => {
		const uri = h.open(`broken.${d}.sql`, "SELECT (1");
		const diag = await h.waitForDiagnosticsWhere(uri, (x) => x.diagnostics.length > 0);
		expect(diag.diagnostics[0].range.start.line).toBe(0);
	});

	it("an unknown column is flagged against the schema", async () => {
		const uri = h.open(`badcol.${d}.sql`, "SELECT nope FROM sales");
		const diag = await h.waitForDiagnosticsWhere(uri, (x) => x.diagnostics.length > 0);
		expect(diag.diagnostics.some((x) => /nope|unknown/i.test(String(x.message)))).toBe(true);
	});

	it("hover reports the schema column type", async () => {
		const uri = h.open(`hover.${d}.sql`, "SELECT amount FROM sales");
		await h.waitForDiagnostics(uri);
		const hov = await h.client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: 9 }, // inside `amount`
		});
		expect(hov && JSON.stringify(hov.contents)).toContain("decimal");
	});

	it("definition and references resolve a CTE", async () => {
		const sql = "WITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const uri = h.open(`cte.${d}.sql`, sql);
		await h.waitForDiagnostics(uri);
		const at = { line: 0, character: sql.indexOf("FROM c") + 5 }; // the trailing `c`
		const def = await h.client.sendRequest(DefinitionRequest.type, { textDocument: { uri }, position: at });
		expect(def).toMatchObject({ range: { start: { line: 0, character: 5 } } }); // `c` in `WITH c`
		const refs = await h.client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri },
			position: at,
			context: { includeDeclaration: true },
		});
		expect((refs ?? []).length).toBeGreaterThanOrEqual(2);
	});

	it("completion offers schema columns after SELECT", async () => {
		const uri = h.open(`compl.${d}.sql`, "SELECT  FROM sales");
		await h.waitForDiagnostics(uri);
		const res = await h.client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: 7 },
		});
		const labels = (Array.isArray(res) ? res : (res?.items ?? [])).map((i) => i.label);
		expect(labels).toContain("amount");
	});

	it("signature help tracks the active argument", async () => {
		// `round(expr, scale)` is a curated 2-param signature in every dialect; the caret in the
		// 2nd arg must report activeParameter 1. (The brief used `coalesce`, but coalesce is a
		// variadic single-param signature in all five tables — its active index correctly CLAMPS
		// to 0, so it can never show 1. This is signature semantics, not a per-dialect gap.)
		const sql = "SELECT round(amount, 0) FROM sales";
		const uri = h.open(`sig.${d}.sql`, sql);
		await h.waitForDiagnostics(uri);
		const sig = await h.client.sendRequest(SignatureHelpRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: sql.indexOf(", 0") + 2 },
		});
		expect(sig?.signatures.length ?? 0).toBeGreaterThanOrEqual(1);
		expect(sig?.activeParameter).toBe(1);
	});

	it("semantic tokens are emitted", async () => {
		const uri = h.open(`tok.${d}.sql`, "SELECT amount FROM sales -- note");
		await h.waitForDiagnostics(uri);
		const tok = await h.client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		expect((tok?.data ?? []).length).toBeGreaterThan(0);
	});

	it("document symbols include the output column", async () => {
		// Bare unaliased projections are reference-only symbols (locked contract,
		// tests/symbols.test.ts) — alias so the column becomes a declared output symbol.
		const uri = h.open(`sym.${d}.sql`, "SELECT amount AS amount_out FROM sales");
		await h.waitForDiagnostics(uri);
		const syms = await h.client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
		expect((syms ?? []).map((s: { name: string }) => s.name)).toContain("amount_out");
	});

	it("inlay hints type the projection", async () => {
		const uri = h.open(`inlay.${d}.sql`, "SELECT amount FROM sales");
		await h.waitForDiagnostics(uri);
		const hints = await h.client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 0, character: 0 }, end: { line: 0, character: 40 } },
		});
		expect(JSON.stringify(hints)).toContain("decimal");
	});
});
