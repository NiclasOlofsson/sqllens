// In-memory LSP client/server pair over a duplex stream — the same code path as the stdio
// binary (startServer is shared). Mirrors the plumbing in tests/lsp.acceptance.test.ts.
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
	PublishDiagnosticsNotification,
	type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { startServer } from "../../src/lsp/server.js";

class TestStream extends Duplex {
	_write(chunk: Buffer, _enc: string, done: () => void) {
		this.emit("data", chunk);
		done();
	}
	_read() {}
}

export interface LspHarness {
	root: string;
	client: ReturnType<typeof createProtocolConnection>;
	open(name: string, text: string): string;
	waitForDiagnostics(uri: string): Promise<PublishDiagnosticsParams>;
	waitForDiagnosticsWhere(
		uri: string,
		pred: (d: PublishDiagnosticsParams) => boolean,
	): Promise<PublishDiagnosticsParams>;
	dispose(): void;
}

/** Boot a real server over an in-memory duplex against a temp workspace seeded with `files`. */
export async function startLspHarness(files: Record<string, string>): Promise<LspHarness> {
	const root = mkdtempSync(join(tmpdir(), "sqllens-lsp-"));
	for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);

	const up = new TestStream();
	const down = new TestStream();
	startServer(createConnection(new StreamMessageReader(up), new StreamMessageWriter(down)));

	const client = createProtocolConnection(new StreamMessageReader(down), new StreamMessageWriter(up));
	const diagnosticsByUri = new Map<string, PublishDiagnosticsParams>();
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

	const open = (name: string, text: string): string => {
		const uri = pathToFileURL(join(root, name)).toString();
		void client.sendNotification(DidOpenTextDocumentNotification.type, {
			textDocument: { uri, languageId: "sql", version: 1, text },
		});
		return uri;
	};
	const waitForDiagnosticsWhere = async (
		uri: string,
		pred: (d: PublishDiagnosticsParams) => boolean,
	): Promise<PublishDiagnosticsParams> => {
		for (let i = 0; i < 100; i++) {
			const d = diagnosticsByUri.get(uri);
			if (d && pred(d)) return d;
			await new Promise((r) => setTimeout(r, 10));
		}
		throw new Error("diagnostics never satisfied predicate for " + uri);
	};

	return {
		root,
		client,
		open,
		waitForDiagnostics: (uri) => waitForDiagnosticsWhere(uri, () => true),
		waitForDiagnosticsWhere,
		dispose: () => {
			client.dispose();
			rmSync(root, { recursive: true, force: true });
		},
	};
}
