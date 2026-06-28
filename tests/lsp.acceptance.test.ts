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
  CompletionRequest,
  PublishDiagnosticsNotification,
  type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { SEMANTIC_LEGEND } from "../src/lsp/features/semantic-tokens.js";
import { startServer } from "../src/lsp/server.js";
import { SqlDocument } from "../src/index.js";

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
  writeFileSync(join(root, "schema.json"), JSON.stringify({ sales: { amount: "decimal", id: "int" } }));

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
    // SqlDocument.create runs on open/change — NOT per request. Assert on DELTAS: once the
    // document is built and settled, request handlers add zero builds, and one edit adds one.
    const spy = vi.spyOn(SqlDocument, "create");
    try {
      const text = "SELECT amount FROM sales";
      const uri = open("cache.sql", text);
      await waitForDiagnostics(uri);
      // Let any open-time build(s) settle, then snapshot the count.
      await new Promise((r) => setTimeout(r, 20));
      const settled = spy.mock.calls.length;
      expect(settled).toBeGreaterThanOrEqual(1);

      const pos = { line: 0, character: text.indexOf("amount") };
      await client.sendRequest(HoverRequest.type, { textDocument: { uri }, position: pos });
      await client.sendRequest(HoverRequest.type, { textDocument: { uri }, position: pos });
      await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
      // Three requests on the unchanged doc: served from cache, zero new builds.
      expect(spy.mock.calls.length).toBe(settled);

      // One edit rebuilds exactly once. Edit to text whose diagnostics DIFFER from the open-time
      // state (an unknown column), so the wait can only succeed after the change's rebuild lands —
      // not on stale open-time diagnostics.
      change(uri, 2, "SELECT nope FROM sales");
      await waitForDiagnosticsWhere(uri, (d) => d.diagnostics.some((x) => /nope|unknown/i.test(msg(x.message))));
      expect(spy.mock.calls.length).toBe(settled + 1);
    } finally {
      spy.mockRestore();
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
    expect(
      toks.some((t) => t.type === "variable" && t.line === 0 && t.char === text.indexOf("amount")),
    ).toBe(true);
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

  it("completion offers the FROM relation's schema columns at an empty-projection caret", async () => {
    // Mid-edit: caret in the empty projection of `SELECT  FROM sales`. The completion provider
    // resolves the FROM relation's columns from the workspace schema (sales: amount, id).
    const text = "SELECT  FROM sales";
    const uri = open("complete.sql", text);
    const items = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri },
      position: { line: 0, character: "SELECT ".length },
    });
    const list = Array.isArray(items) ? items : (items as any)?.items ?? [];
    const labels = (list as { label: string }[]).map((c) => c.label);
    expect(labels).toContain("amount");
    expect(labels).toContain("id");
  });
});
