// src/lsp/server.ts
import {
  type Connection,
  type InitializeParams,
  type InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { SqlDocument } from "../index.js";
import { loadDialectConfig, type DialectConfig } from "./dialect-config.js";
import { computeDiagnostics } from "./features/diagnostics.js";
import { computeHover } from "./features/hover.js";
import { computeDocumentSymbols } from "./features/symbols.js";
import { computeDefinition } from "./features/definition.js";
import { computeSemanticTokens, SEMANTIC_LEGEND } from "./features/semantic-tokens.js";
import { computeCompletion } from "./features/completion.js";
import { computeSignatureHelp } from "./features/signature.js";

// ---------------------------------------------------------------------------
// The server: connection wiring only. It holds ONE SqlDocument per open file,
// rebuilt on open/change and cached in `docs`, and serves every feature from
// that cached model — no per-request re-parse. Each document maps to its dialect
// (via .sqllens.json). No analysis lives here; the LSP↔internal coordinate
// conversion stays at this boundary (in ranges.ts / SqlDocument.lines).
// startServer(connection) is shared by the stdio binary (main.ts) and the
// in-memory acceptance suite, so the tested code path IS the shipped one.
// ---------------------------------------------------------------------------

export function startServer(connection: Connection): void {
  const documents = new TextDocuments<TextDocument>(TextDocument);
  // One SqlDocument per open file, keyed by URI; rebuilt on open/change.
  const docs = new Map<string, SqlDocument>();
  let rootDir = process.cwd();
  let config: DialectConfig = loadDialectConfig(rootDir);

  const uriToRel = (uri: string): string => {
    try {
      return relative(rootDir, fileURLToPath(uri));
    } catch {
      return uri;
    }
  };

  // Build (or rebuild) the SqlDocument for `uri` from the TextDocuments registry's
  // current text + version, resolving the dialect via config, and cache it. Returns
  // undefined only when the registry has no such open document.
  const rebuild = (uri: string): SqlDocument | undefined => {
    const td = documents.get(uri);
    if (!td) return undefined;
    const dialect = config.dialectFor(uriToRel(uri));
    const doc = SqlDocument.create(td.getText(), dialect, { uri, version: td.version });
    docs.set(uri, doc);
    return doc;
  };

  // The cached document for `uri`, rebuilding once as a fallback if it is missing.
  const docFor = (uri: string): SqlDocument | undefined => docs.get(uri) ?? rebuild(uri);

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    if (params.rootUri) {
      try {
        rootDir = fileURLToPath(params.rootUri);
      } catch {
        /* keep cwd */
      }
    } else if (params.workspaceFolders?.[0]) {
      try {
        rootDir = fileURLToPath(params.workspaceFolders[0].uri);
      } catch {
        /* keep cwd */
      }
    }
    config = loadDialectConfig(rootDir);
    // window/logMessage at Info level. In vscode-languageserver v10 this is RemoteConsole.info
    // (connection.console), not connection.window.logMessage — same wire notification.
    for (const w of config.warnings) connection.console.info(w);
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        semanticTokensProvider: { legend: SEMANTIC_LEGEND, full: true },
        completionProvider: { triggerCharacters: [".", " "] },
        signatureHelpProvider: { triggerCharacters: ["(", ","] },
      },
    };
  });

  const publish = (uri: string): void => {
    const doc = rebuild(uri);
    if (!doc) return;
    const diagnostics = computeDiagnostics(doc, config.schema);
    connection.sendDiagnostics({ uri, diagnostics });
  };

  documents.onDidOpen((e) => publish(e.document.uri));
  documents.onDidChangeContent((e) => publish(e.document.uri));
  documents.onDidClose((e) => docs.delete(e.document.uri));

  connection.onHover((params) => {
    const doc = docFor(params.textDocument.uri);
    if (!doc) return null;
    return computeHover(doc, params.position, config.schema);
  });

  connection.onDefinition((params) => {
    const doc = docFor(params.textDocument.uri);
    if (!doc) return null;
    return computeDefinition(doc, params.position, params.textDocument.uri);
  });

  connection.onDocumentSymbol((params) => {
    const doc = docFor(params.textDocument.uri);
    if (!doc) return [];
    return computeDocumentSymbols(doc);
  });

  connection.languages.semanticTokens.on((params) => {
    const doc = docFor(params.textDocument.uri);
    return doc ? computeSemanticTokens(doc) : { data: [] };
  });

  connection.onCompletion((params) => {
    const doc = docFor(params.textDocument.uri);
    return doc ? computeCompletion(doc, params.position, config.schema) : [];
  });

  connection.onSignatureHelp((params) => {
    const doc = docFor(params.textDocument.uri);
    return doc ? computeSignatureHelp(doc, params.position, config.schema) : null;
  });

  documents.listen(connection);
  connection.listen();
}
