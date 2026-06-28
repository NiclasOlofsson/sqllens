// ---------------------------------------------------------------------------
// SqlDocument — the persistent, immutable per-document model.
//
// Today every LSP feature re-parses the raw text per request and analyze()
// re-parses internally. SqlDocument is a per-open-file model that runs the
// schema-free pipeline ONCE in create() and caches every tier, is immutable
// (an edit yields a NEW instance via withText), and is position-addressable
// (tokenAt / nodeAt). The schema-dependent passes run lazily in analyze(schema)
// and are memoized by schema identity.
//
// It is the public-API extension — the stateful-but-immutable front of the
// otherwise-stateless `api` functions — so it COMPOSES the public surface
// (parse / toScopes / qualify / deriveSymbols / TypeInfo) rather than reaching
// into the internal analysis modules. Core: antlr4ng only, no LSP deps here.
//
// On the api ↔ document import direction: api.ts re-exports SqlDocument and
// document.ts imports the api functions. That cycle is fine in ESM because
// document.ts only CALLS the api functions at call time (inside create() and
// analyze()), never at module-evaluation time — there are no top-level api
// calls in this file, so the modules finish evaluating before either is used.
// ---------------------------------------------------------------------------

import type { ParserRuleContext } from "antlr4ng";
import {
	parse,
	qualify,
	deriveSymbols,
	toScopes,
	TypeInfo,
	type Dialect,
} from "../api.js";
import type { QueryExpr } from "../ir/ir.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import type { ScopeTree } from "../scope/scope.js";
import type { Qualification, Diagnostic } from "../qualify/qualify.js";
import { Schema } from "../qualify/schema.js";
import type { Sym } from "../symbols/symbols.js";
import type { Token } from "../token/token.js";
import { LineIndex } from "./line-index.js";
import { nodeAt, type NodeHit } from "./node-at.js";

// A single stable empty schema, used as the analyze() default when no catalog is
// configured. Sharing ONE instance keeps the schema-keyed analyze() memo working
// for schema-free calls (cache key = schema ?? EMPTY_SCHEMA), instead of a fresh
// Schema per call that would defeat the cache.
const EMPTY_SCHEMA = new Schema({});

/** The schema-dependent analysis tiers, produced by SqlDocument.analyze(schema). */
export interface DocumentAnalysis {
	/** The full schema-fed resolution (star expansion + diagnostics). */
	qualification: Qualification;
	/** Per-expression types — `types.typeOf(expr, scope)`. */
	types: TypeInfo;
	/** The kind × modifier symbol model over the scope tree. */
	symbols: Sym[];
	/** Qualification's semantic diagnostics (unknown table/column/field). */
	diagnostics: Diagnostic[];
}

export class SqlDocument {
	readonly uri?: string;
	readonly version: number;
	readonly text: string;
	readonly dialect: Dialect;
	readonly tokens: readonly Token[];
	/** The raw antlr CST root — the escape hatch for precise spans. */
	readonly cst: ParserRuleContext;
	/** The dialect-neutral IR; already deep-frozen by lower(). */
	readonly ast: QueryExpr;
	readonly errors: number;
	/** Positioned SYNTAX diagnostics from parse() (never semantic — those need a schema). */
	readonly diagnostics: readonly SyntaxDiagnostic[];
	readonly scopes: ScopeTree;
	readonly lines: LineIndex;

	/** Schema-keyed memo of analyze(). The Map reference is frozen with the instance,
	 *  but its contents stay mutable, so memoization works on a frozen SqlDocument. */
	private readonly _analysisCache = new Map<Schema, DocumentAnalysis>();

	private constructor(text: string, dialect: Dialect, opts: { uri?: string; version?: number }) {
		// Compose the PUBLIC surface — the same functions external consumers use.
		const p = parse(text, dialect);
		this.uri = opts.uri;
		this.version = opts.version ?? 0;
		this.text = text;
		this.dialect = dialect;
		this.tokens = p.tokens;
		this.cst = p.cst;
		this.ast = p.ast;
		this.errors = p.errors;
		this.diagnostics = p.diagnostics;
		// Resolve scopes from the already-lowered ast — do NOT re-parse. toScopes returns the
		// ScopeTree unchanged for a ScopeTree, and resolves a QueryExpr (this case) without parsing.
		this.scopes = toScopes(p.ast, { dialect });
		this.lines = new LineIndex(text);
		Object.freeze(this);
	}

	/** Build a document for `text` in `dialect`. Total: never throws, even on broken / mid-edit input. */
	static create(text: string, dialect: Dialect, opts: { uri?: string; version?: number } = {}): SqlDocument {
		return new SqlDocument(text, dialect, opts);
	}

	/** An edit: a NEW SqlDocument for the new text. This instance is untouched (immutable). */
	withText(text: string, version: number): SqlDocument {
		return SqlDocument.create(text, this.dialect, { uri: this.uri, version });
	}

	/** The smallest default-channel (channel 0) token whose [start, stop] covers `offset`; if none
	 *  covers it, the nearest preceding default-channel token (so a caret at end-of-token or between
	 *  tokens still resolves). Hidden-channel trivia is skipped. */
	tokenAt(offset: number): Token | undefined {
		let preceding: Token | undefined;
		for (const t of this.tokens) {
			if (t.channel !== 0) continue;
			if (t.start <= offset && offset <= t.stop) return t;
			if (t.stop < offset) preceding = t; // tokens are in source order; keep the latest before offset
		}
		return preceding;
	}

	/** The smallest IR Expr whose CST range covers `offset`, with its owning Scope. */
	nodeAt(offset: number): NodeHit | undefined {
		return nodeAt(this.scopes, offset, this.ast);
	}

	/** The schema-dependent tiers, over the cached scopes/ast (no re-parse). Memoized by schema
	 *  identity. With no schema the symbols/scopes still resolve structurally and types come back
	 *  `unknown` where a catalog would be needed (the stable EMPTY_SCHEMA keeps the memo working). */
	analyze(schema?: Schema): DocumentAnalysis {
		const s = schema ?? EMPTY_SCHEMA;
		const cached = this._analysisCache.get(s);
		if (cached) return cached;
		const qualification = qualify(this.scopes, s, { dialect: this.dialect });
		const analysis: DocumentAnalysis = {
			qualification,
			types: new TypeInfo(s),
			symbols: deriveSymbols(this.scopes, s, { dialect: this.dialect }),
			diagnostics: qualification.diagnostics,
		};
		this._analysisCache.set(s, analysis);
		return analysis;
	}
}
