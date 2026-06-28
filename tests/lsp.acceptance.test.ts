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
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
  HoverRequest,
  DefinitionRequest,
  DocumentSymbolRequest,
  PublishDiagnosticsNotification,
  type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { startServer } from "../src/lsp/server.js";

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
});
