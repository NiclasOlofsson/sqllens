// src/lsp/main.ts
// Attachable stdio entry: the same server any LSP client (VS Code) connects to.
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { startServer } from "./server.js";

startServer(createConnection(ProposedFeatures.all));
