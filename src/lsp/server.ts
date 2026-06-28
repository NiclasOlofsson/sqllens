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
import { loadDialectConfig, type DialectConfig } from "./dialect-config.js";
import { computeDiagnostics } from "./features/diagnostics.js";
import { computeHover } from "./features/hover.js";
import { computeDocumentSymbols } from "./features/symbols.js";
import { computeDefinition } from "./features/definition.js";

// ---------------------------------------------------------------------------
// The server: connection wiring only. Each request maps a document to its dialect
// (via .sqllens.json) and delegates to a feature unit. No analysis lives here.
// startServer(connection) is shared by the stdio binary (main.ts) and the
// in-memory acceptance suite, so the tested code path IS the shipped one.
// ---------------------------------------------------------------------------

export function startServer(connection: Connection): void {
  const documents = new TextDocuments<TextDocument>(TextDocument);
  let rootDir = process.cwd();
  let config: DialectConfig = loadDialectConfig(rootDir);

  const uriToRel = (uri: string): string => {
    try {
      return relative(rootDir, fileURLToPath(uri));
    } catch {
      return uri;
    }
  };

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
      },
    };
  });

  const publish = (doc: TextDocument): void => {
    const dialect = config.dialectFor(uriToRel(doc.uri));
    const diagnostics = computeDiagnostics(doc.getText(), dialect, config.schema);
    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  };

  documents.onDidOpen((e) => publish(e.document));
  documents.onDidChangeContent((e) => publish(e.document));

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeHover(doc.getText(), dialect, params.position, config.schema);
  });

  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeDefinition(doc.getText(), dialect, params.position, doc.uri);
  });

  connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeDocumentSymbols(doc.getText(), dialect);
  });

  documents.listen(connection);
  connection.listen();
}
