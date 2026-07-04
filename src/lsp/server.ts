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
import { SqlDocument, type SchemaSource } from "../index.js";
import { loadDialectConfig, type DialectConfig } from "./dialect-config.js";
import { computeDiagnostics } from "./features/diagnostics.js";
import { computeDocumentDiagnostics } from "./features/pull-diagnostics.js";
import { computeHover } from "./features/hover.js";
import { computeDocumentSymbols } from "./features/symbols.js";
import { computeDefinition } from "./features/definition.js";
import {
	computeSemanticTokens,
	computeSemanticTokensRange,
	computeSemanticTokensDelta,
	forgetSemanticTokens,
	SEMANTIC_LEGEND,
} from "./features/semantic-tokens.js";
import { computeCompletion } from "./features/completion.js";
import { resolveCompletion } from "./features/completion-resolve.js";
import { computeSignatureHelp } from "./features/signature.js";
import { computeReferences, computeDocumentHighlight } from "./features/references.js";
import { computeCodeLens } from "./features/code-lens.js";
import { computeFoldingRanges } from "./features/folding.js";
import { computeSelectionRanges } from "./features/selection.js";
import { computeInlayHints } from "./features/inlay-hints.js";

// ---------------------------------------------------------------------------
// The server: connection wiring only. It holds ONE SqlDocument per open file,
// rebuilt on open/change and cached in `docs`, and serves every feature from
// that cached model — no per-request re-parse. Each document maps to its dialect
// (via .sqllens.json). No analysis lives here; the LSP↔internal coordinate
// conversion stays at this boundary (in ranges.ts / SqlDocument.lines).
// startServer(connection) is shared by the stdio binary (main.ts) and the
// in-memory acceptance suite, so the tested code path IS the shipped one.
//
// EMBEDDING (Task 8): the stdio binary reads a static catalog from .sqllens.json.
// A host that embeds the server can instead hand it a live catalog via
// startServer(connection, { schema }) — any SchemaSource, typically a
// CallbackSchema whose tables are fetched lazily from a big warehouse, or a
// CallbackTemplateCatalog that ALSO resolves dbt-logical refs. An injected schema
// is the active catalog for every document (it wins over the file schema). When it
// is a resolve-on-demand catalog (either one), publish() drives the lazy-catalog
// re-publish loop.
// ---------------------------------------------------------------------------

/** A resolve-on-demand catalog that records misses and warms them via prime() — the shape shared by
 *  CallbackSchema (physical tables) and CallbackTemplateCatalog (templated refs). The lazy-catalog
 *  re-publish loop duck-types on this so BOTH drive prime()/republish identically: a resolved templated
 *  ref republishes diagnostics on warm exactly like a resolved physical table. */
interface LazyCatalog {
	readonly misses: ReadonlyArray<string[]>;
	prime(): Promise<boolean>;
}

/** True when `s` is a resolve-on-demand catalog (has prime() + misses) — CallbackSchema OR
 *  CallbackTemplateCatalog. Duck-typed so the loop stays catalog-implementation-agnostic. */
function isLazyCatalog(s: SchemaSource | undefined): s is SchemaSource & LazyCatalog {
	const c = s as Partial<LazyCatalog> | undefined;
	return !!c && typeof c.prime === "function" && Array.isArray(c.misses);
}

/** Options a host passes when embedding the server (the non-stdio path). */
export interface ServerOptions {
	/** A live catalog the host supplies (the embedding entry point). When present it is the active
	 *  schema for every document, taking precedence over the file-configured `.sqllens.json` schema.
	 *  A CallbackSchema or CallbackTemplateCatalog here enables the lazy-catalog re-publish loop (fetch
	 *  on miss, re-publish when the resolver warms). */
	schema?: SchemaSource;
}

export function startServer(connection: Connection, options: ServerOptions = {}): void {
	const documents = new TextDocuments<TextDocument>(TextDocument);
	// One SqlDocument per open file, keyed by URI; rebuilt on open/change.
	const docs = new Map<string, SqlDocument>();
	let rootDir = process.cwd();
	let config: DialectConfig = loadDialectConfig(rootDir);

	// The catalog every feature resolves against: an injected host SchemaSource wins over the
	// file-configured `.sqllens.json` schema (the embedding slot supplements, never fights, the file
	// path). Read through this everywhere so the two sources have exactly one precedence point.
	const activeSchema = (): SchemaSource | undefined => options.schema ?? config.schema;

	const uriToRel = (uri: string): string => {
		try {
			return relative(rootDir, fileURLToPath(uri));
		} catch {
			return uri;
		}
	};

	// Build (or rebuild) the SqlDocument for `uri` from the TextDocuments registry's
	// current text + version, resolving the dialect via config, and cache it. Returns
	// undefined only when the registry has no such open document. On an edit we carry the
	// previous document's per-statement cell cache forward via withText(), so statements whose
	// text didn't change reuse their parsed cells AND their cached per-cell analysis — an edit to
	// one statement recomputes only that statement. A fresh open (or a dialect change) starts clean.
	const rebuild = (uri: string): SqlDocument | undefined => {
		const td = documents.get(uri);
		if (!td) return undefined;
		const dialect = config.dialectFor(uriToRel(uri));
		const prev = docs.get(uri);
		const doc =
			prev && prev.dialect === dialect
				? prev.withText(td.getText(), td.version)
				: SqlDocument.create(td.getText(), dialect, { uri, version: td.version });
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
				referencesProvider: true,
				documentHighlightProvider: true,
				documentSymbolProvider: true,
				foldingRangeProvider: true,
				selectionRangeProvider: true,
				codeLensProvider: { resolveProvider: false },
				inlayHintProvider: true,
				semanticTokensProvider: { legend: SEMANTIC_LEGEND, range: true, full: { delta: true } },
				completionProvider: { triggerCharacters: [".", " "], resolveProvider: true },
				signatureHelpProvider: { triggerCharacters: ["(", ","] },
				diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
			},
		};
	});

	const publish = (uri: string): void => {
		const doc = rebuild(uri);
		if (!doc) return;
		const schema = activeSchema();
		const diagnostics = computeDiagnostics(doc, schema);
		connection.sendDiagnostics({ uri, diagnostics });

		// Lazy catalog: computeDiagnostics just resolved against `schema`; a resolve-on-demand catalog
		// (CallbackSchema for physical tables, CallbackTemplateCatalog for templated refs) records what it
		// could not answer from the host's warm cache as misses. If any are outstanding, warm the resolver
		// in the background and re-publish when it reveals something new — so a cold read squiggles once
		// (never-wrong) and self-heals. Fire-and-forget: the current publish already went out with the
		// best-known (possibly incomplete) diagnostics. Duck-typed (isLazyCatalog) so a resolved templated
		// ref republishes on warm exactly like a resolved physical table.
		if (isLazyCatalog(schema) && schema.misses.length > 0) {
			// Version guard, keyed on the DOCUMENT version — the axis a slow prime threatens. If the file
			// is edited before prime() settles, that edit's OWN publish+prime chain owns the re-publish,
			// so this stale callback stands down (docs.get holds the latest rebuilt doc). The SCHEMA axis
			// needs no guard here: prime() resolves true only when its version actually bumped (new tables
			// arrived), and publish() re-reads the current doc + schema, so a re-publish is never stale
			// data — only a redundant one, which the doc-version check suppresses. prime() itself coalesces
			// concurrent calls (both CallbackSchema.prime and CallbackTemplateCatalog.prime), so rapid edits
			// can't double-fetch.
			const version = doc.version;
			void schema.prime().then((changed) => {
				if (changed && docs.get(uri)?.version === version) publish(uri);
			});
		}
	};

	documents.onDidOpen((e) => publish(e.document.uri));
	documents.onDidChangeContent((e) => publish(e.document.uri));
	documents.onDidClose((e) => {
		docs.delete(e.document.uri);
		forgetSemanticTokens(e.document.uri);
	});

	// Pull diagnostics (textDocument/diagnostic): same items as the push path, on demand.
	// Push (above) and pull coexist; the client picks whichever it supports.
	connection.languages.diagnostics.on((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeDocumentDiagnostics(doc, activeSchema()) : { kind: "full", items: [] };
	});

	connection.onHover((params) => {
		const doc = docFor(params.textDocument.uri);
		if (!doc) return null;
		return computeHover(doc, params.position, activeSchema());
	});

	connection.onDefinition((params) => {
		const doc = docFor(params.textDocument.uri);
		if (!doc) return null;
		return computeDefinition(doc, params.position, params.textDocument.uri);
	});

	connection.onReferences((params) => {
		const doc = docFor(params.textDocument.uri);
		if (!doc) return [];
		return computeReferences(
			doc,
			params.position,
			params.context.includeDeclaration,
			params.textDocument.uri,
			activeSchema(),
		);
	});

	connection.onDocumentHighlight((params) => {
		const doc = docFor(params.textDocument.uri);
		if (!doc) return [];
		return computeDocumentHighlight(doc, params.position, activeSchema());
	});

	connection.onDocumentSymbol((params) => {
		const doc = docFor(params.textDocument.uri);
		if (!doc) return [];
		return computeDocumentSymbols(doc, activeSchema());
	});

	connection.onFoldingRanges((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeFoldingRanges(doc) : [];
	});

	connection.onSelectionRanges((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeSelectionRanges(doc, params.positions) : [];
	});

	connection.onCodeLens((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeCodeLens(doc, activeSchema()) : [];
	});

	connection.languages.inlayHint.on((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeInlayHints(doc, params.range, activeSchema()) : [];
	});

	connection.languages.semanticTokens.on((params) => {
		const uri = params.textDocument.uri;
		const doc = docFor(uri);
		return doc ? computeSemanticTokens(doc, uri) : { data: [] };
	});

	connection.languages.semanticTokens.onRange((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeSemanticTokensRange(doc, params.range) : { data: [] };
	});

	connection.languages.semanticTokens.onDelta((params) => {
		const uri = params.textDocument.uri;
		const doc = docFor(uri);
		return doc ? computeSemanticTokensDelta(doc, uri, params.previousResultId) : { data: [] };
	});

	connection.onCompletion((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeCompletion(doc, params.position, activeSchema()) : [];
	});

	// completionItem/resolve receives ONLY the item (no doc/position); resolveCompletion reads its
	// `data` payload to fill a function's signature lazily. Total — never throws.
	connection.onCompletionResolve((item) => resolveCompletion(item));

	connection.onSignatureHelp((params) => {
		const doc = docFor(params.textDocument.uri);
		return doc ? computeSignatureHelp(doc, params.position, activeSchema()) : null;
	});

	documents.listen(connection);
	connection.listen();
}
