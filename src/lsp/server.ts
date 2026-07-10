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
import { SqlSession, type SchemaProvider } from "../index.js";
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
// The server: connection wiring only. It holds ONE SqlSession per open file,
// rebuilt on open/change and cached in `sessions`, and serves every feature from
// that cached model — no per-request re-parse. SqlSession is the verb-shaped
// facade over one SqlDocument; features reach the document's escape-hatch
// members (LineIndex, cellAt, statements) via `session.doc`. Each document maps
// to its dialect (via .sqllens.json). No analysis lives here; the LSP↔internal
// coordinate conversion stays at this boundary (in ranges.ts / SqlDocument.lines).
// startServer(connection) is shared by the stdio binary (main.ts) and the
// in-memory acceptance suite, so the tested code path IS the shipped one.
//
// EMBEDDING (Task 8): the stdio binary reads a static catalog from .sqllens.json.
// A host that embeds the server can instead hand it a live catalog via
// startServer(connection, { schema }) — any SchemaProvider, typically a
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
function isLazyCatalog(s: SchemaProvider | undefined): s is SchemaProvider & LazyCatalog {
	const c = s as Partial<LazyCatalog> | undefined;
	return !!c && typeof c.prime === "function" && Array.isArray(c.misses);
}

/** Options a host passes when embedding the server (the non-stdio path). */
export interface ServerOptions {
	/** A live catalog the host supplies (the embedding entry point). When present it is the active
	 *  schema for every document, taking precedence over the file-configured `.sqllens.json` schema.
	 *  A CallbackSchema or CallbackTemplateCatalog here enables the lazy-catalog re-publish loop (fetch
	 *  on miss, re-publish when the resolver warms). */
	schema?: SchemaProvider;
}

export function startServer(connection: Connection, options: ServerOptions = {}): void {
	const documents = new TextDocuments<TextDocument>(TextDocument);
	// One SqlSession per open file, keyed by URI; rebuilt on open/change.
	const sessions = new Map<string, SqlSession>();
	let rootDir = process.cwd();
	let config: DialectConfig = loadDialectConfig(rootDir);

	// The catalog every feature resolves against: an injected host SchemaProvider wins over the
	// file-configured `.sqllens.json` schema (the embedding slot supplements, never fights, the file
	// path). Read through this everywhere so the two sources have exactly one precedence point.
	const activeSchema = (): SchemaProvider | undefined => options.schema ?? config.schema;

	const uriToRel = (uri: string): string => {
		try {
			return relative(rootDir, fileURLToPath(uri));
		} catch {
			return uri;
		}
	};

	// Build (or rebuild) the SqlSession for `uri` from the TextDocuments registry's current
	// text, resolving the dialect via config, and cache it. Returns undefined only when the
	// registry has no such open document. On an edit we carry the previous session's underlying
	// document (and its per-statement cell cache) forward via withText(), so statements whose
	// text didn't change reuse their parsed cells AND their cached per-cell analysis — an edit to
	// one statement recomputes only that statement. A fresh open (or a dialect change) starts clean,
	// with the active schema baked into the session for its whole lifetime.
	const rebuild = (uri: string): SqlSession | undefined => {
		const td = documents.get(uri);
		if (!td) return undefined;
		const dialect = config.dialectFor(uriToRel(uri));
		const prev = sessions.get(uri);
		const session =
			prev && prev.dialect === dialect
				? prev.withText(td.getText())
				: SqlSession.create(td.getText(), dialect, { uri, schema: activeSchema() });
		sessions.set(uri, session);
		return session;
	};

	// The cached session for `uri`, rebuilding once as a fallback if it is missing.
	const sessionFor = (uri: string): SqlSession | undefined => sessions.get(uri) ?? rebuild(uri);

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
		const session = rebuild(uri);
		if (!session) return;
		const schema = activeSchema();
		const diagnostics = computeDiagnostics(session, schema);
		connection.sendDiagnostics({ uri, diagnostics });

		// Lazy catalog: computeDiagnostics just resolved against `schema`; a resolve-on-demand catalog
		// (CallbackSchema for physical tables, CallbackTemplateCatalog for templated refs) records what it
		// could not answer from the host's warm cache as misses. If any are outstanding, warm the resolver
		// in the background and re-publish when it reveals something new — so a cold read squiggles once
		// (never-wrong) and self-heals. Fire-and-forget: the current publish already went out with the
		// best-known (possibly incomplete) diagnostics. Duck-typed (isLazyCatalog) so a resolved templated
		// ref republishes on warm exactly like a resolved physical table.
		if (isLazyCatalog(schema) && schema.misses.length > 0) {
			// Version guard, keyed on the CLIENT's TextDocument version (documents.get(uri)?.version), NOT
			// the session's own doc.version. vscode-languageserver's TextDocuments fires BOTH onDidOpen and
			// onDidChangeContent for a single open notification, so publish() runs twice per open — the
			// second rebuild() carries the identical text but is still a fresh SqlSession, whose internal
			// doc.version bumps regardless (rebuild()/withText() has no notion of "nothing changed"). The
			// LSP-protocol version only changes on a REAL didChange, so it's the stable axis a slow prime
			// threatens: if the file is edited before prime() settles, that edit's own publish+prime chain
			// owns the re-publish, and this stale callback stands down. The SCHEMA axis needs no guard here:
			// prime() resolves true only when its version actually bumped (new tables arrived), and
			// publish() re-reads the current session + schema, so a re-publish is never stale data — only a
			// redundant one, which the client-version check suppresses. prime() itself coalesces concurrent
			// calls (both CallbackSchema.prime and CallbackTemplateCatalog.prime), so rapid edits can't
			// double-fetch.
			const version = documents.get(uri)?.version;
			void schema.prime().then((changed) => {
				if (changed && documents.get(uri)?.version === version) publish(uri);
			});
		}
	};

	documents.onDidOpen((e) => publish(e.document.uri));
	documents.onDidChangeContent((e) => publish(e.document.uri));
	documents.onDidClose((e) => {
		sessions.delete(e.document.uri);
		forgetSemanticTokens(e.document.uri);
	});

	// Pull diagnostics (textDocument/diagnostic): same items as the push path, on demand.
	// Push (above) and pull coexist; the client picks whichever it supports.
	connection.languages.diagnostics.on((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeDocumentDiagnostics(session, activeSchema()) : { kind: "full", items: [] };
	});

	connection.onHover((params) => {
		const session = sessionFor(params.textDocument.uri);
		if (!session) return null;
		return computeHover(session, params.position);
	});

	connection.onDefinition((params) => {
		const session = sessionFor(params.textDocument.uri);
		if (!session) return null;
		return computeDefinition(session, params.position, params.textDocument.uri);
	});

	connection.onReferences((params) => {
		const session = sessionFor(params.textDocument.uri);
		if (!session) return [];
		return computeReferences(session, params.position, params.context.includeDeclaration, params.textDocument.uri);
	});

	connection.onDocumentHighlight((params) => {
		const session = sessionFor(params.textDocument.uri);
		if (!session) return [];
		return computeDocumentHighlight(session, params.position);
	});

	connection.onDocumentSymbol((params) => {
		const session = sessionFor(params.textDocument.uri);
		if (!session) return [];
		return computeDocumentSymbols(session);
	});

	connection.onFoldingRanges((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeFoldingRanges(session) : [];
	});

	connection.onSelectionRanges((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeSelectionRanges(session, params.positions) : [];
	});

	connection.onCodeLens((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeCodeLens(session) : [];
	});

	connection.languages.inlayHint.on((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeInlayHints(session, params.range) : [];
	});

	connection.languages.semanticTokens.on((params) => {
		const uri = params.textDocument.uri;
		const session = sessionFor(uri);
		return session ? computeSemanticTokens(session, uri) : { data: [] };
	});

	connection.languages.semanticTokens.onRange((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeSemanticTokensRange(session, params.range) : { data: [] };
	});

	connection.languages.semanticTokens.onDelta((params) => {
		const uri = params.textDocument.uri;
		const session = sessionFor(uri);
		return session ? computeSemanticTokensDelta(session, uri, params.previousResultId) : { data: [] };
	});

	connection.onCompletion((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeCompletion(session, params.position) : [];
	});

	// completionItem/resolve receives ONLY the item (no doc/position); resolveCompletion reads its
	// `data` payload to fill a function's signature lazily. Total — never throws.
	connection.onCompletionResolve((item) => resolveCompletion(item));

	connection.onSignatureHelp((params) => {
		const session = sessionFor(params.textDocument.uri);
		return session ? computeSignatureHelp(session, params.position) : null;
	});

	documents.listen(connection);
	connection.listen();
}
