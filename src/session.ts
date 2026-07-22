// ---------------------------------------------------------------------------
// SqlSession — the verb-shaped facade over one document. PURE DELEGATION: every
// member is one line into the document or a free function; no logic here (the
// one documented exception is typeAt's nodeAt → types().typeOf two-step, which
// IS the recipe every other cursor verb's underlying pass already uses).
//
// Import discipline: MODULES only (never ./index.js — session.ts is re-exported
// from the barrel, so importing it back would be a cycle). api.js is imported
// directly for `lineage`, the one composable wrapper this facade needs — that's
// a one-directional session -> api edge, not the api <-> document call-time
// cycle documented in document.ts:26-30 (api.js/document.js never import
// session.ts, so there is nothing to cycle back through).
// ---------------------------------------------------------------------------

import type { ParserRuleContext } from "antlr4ng";
import { SqlDocument, type DocumentAnalysis, type DocumentVariant, type UnionCte } from "./document/document.js";
import type { NodeHit } from "./document/node-at.js";
import { lineage, type Lineage, type TypeInfo } from "./api.js";
import type { Dialect } from "./dialect.js";
import type { QueryExpr } from "./ir/ir.js";
import type { Type } from "./infer/types.js";
import { UNKNOWN } from "./infer/types.js";
import type { TagNode } from "./minijinja/tag-ast.js";
import type { TemplateRegion, TemplateSymbol } from "./minijinja/regions.js";
import type { SyntaxDiagnostic } from "./parse-diagnostics.js";
import { completeAt, type CompleteOptions, type CompletionResult } from "./completion/complete.js";
import type { Diagnostic, Qualification } from "./qualify/qualify.js";
import type { SchemaProvider } from "./qualify/schema-provider.js";
import { OPEN_PROVIDER, type TemplateProvider } from "./qualify/template-provider.js";
import type { Occurrences } from "./references/references.js";
import type { LineageHop } from "./lineage/hops.js";
import { signatureAt, type SignatureHelpInfo } from "./signature/signature.js";
import type { Scope, ScopeTree } from "./scope/scope.js";
import type { Frame } from "./scope/frame.js";
import type { ClauseInfo } from "./scope/clauses.js";
import type { SetOpArms } from "./scope/setop-arms.js";
import type { Span, Sym } from "./symbols/symbols.js";
import type { TemplateEngine } from "./template/engine.js";
import type { Token } from "./token/token.js";

export interface SessionOptions {
	uri?: string;
	schema?: SchemaProvider;
	provider?: TemplateProvider;
	templating?: TemplateEngine;
}

export class SqlSession {
	/** The document underneath — the escape hatch DOWN. */
	readonly doc: SqlDocument;
	private readonly schema: SchemaProvider;

	private constructor(doc: SqlDocument, schema: SchemaProvider) {
		this.doc = doc;
		this.schema = schema;
	}

	static create(text: string, dialect: Dialect, opts: SessionOptions = {}): SqlSession {
		const doc = SqlDocument.create(text, dialect, {
			uri: opts.uri,
			templating: opts.templating,
			provider: opts.provider,
		});
		return new SqlSession(doc, opts.schema ?? OPEN_PROVIDER);
	}

	/** An edit: a new session over the successor document. Version auto-increments from doc.version + 1;
	 *  the templating engine + provider ride forward via SqlDocument.withText's own carry. */
	withText(text: string): SqlSession {
		return new SqlSession(this.doc.withText(text, this.doc.version + 1), this.schema);
	}

	// ── properties: cheap reads of construction products ──
	get text(): string {
		return this.doc.text;
	}
	get dialect(): Dialect {
		return this.doc.dialect;
	}
	get ast(): QueryExpr {
		return this.doc.ast;
	}
	get tokens(): readonly Token[] {
		return this.doc.tokens;
	}
	get cst(): ParserRuleContext {
		return this.doc.cst;
	}
	get scopes(): ScopeTree {
		return this.doc.scopes;
	}
	get syntaxDiagnostics(): readonly SyntaxDiagnostic[] {
		return this.doc.diagnostics;
	}

	// ── template facets (flattened; empty/undefined on plain docs) ──
	get tags(): readonly TagNode[] {
		return this.doc.templated?.tags ?? [];
	}
	get regions(): readonly TemplateRegion[] {
		return this.doc.templated?.regions ?? [];
	}
	get templateSymbols(): readonly TemplateSymbol[] {
		return this.doc.templated?.symbols ?? [];
	}
	get placeholder(): string {
		return this.doc.templated?.placeholder ?? this.doc.text;
	}
	get degraded(): boolean {
		return this.doc.templated?.degraded === true;
	}
	tagOf(node: object): TagNode | undefined {
		return this.doc.templated?.tagOf(node);
	}
	nodeOf(tag: TagNode): object | undefined {
		return this.doc.templated?.nodeOf(tag);
	}
	diagnosticsOf(tag: TagNode): SyntaxDiagnostic[] {
		return this.doc.templated?.diagnosticsOf(tag) ?? [];
	}
	get variants(): readonly DocumentVariant[] {
		return this.doc.variants;
	}

	// ── pass verbs: execute a pipeline stage with the session's schema (memoized underneath) ──
	analyze(): DocumentAnalysis {
		return this.doc.analyze(this.schema);
	}
	qualify(): Qualification {
		return this.analyze().qualification;
	}
	deriveSymbols(): Sym[] {
		return this.analyze().symbols;
	}
	/** Syntax + semantic diagnostics, one doc-ordered list (syntax diagnostics first — both arrays are
	 *  already in document order on their own; see DocumentAnalysis.diagnostics / SqlDocument.diagnostics). */
	diagnostics(): (SyntaxDiagnostic | Diagnostic)[] {
		return [...this.doc.diagnostics, ...this.analyze().diagnostics];
	}
	/** Column lineage for the output columns. WHOLE-DOCUMENT-scoped: on a multi-statement document
	 *  `doc.scopes` is the compound facade (no outputs), so this answers empty there — use
	 *  `lineageAt(offset)` for per-statement lineage. Single-statement documents (every dbt model,
	 *  and all templated documents) are fully covered. */
	lineage(): Lineage {
		return lineage(this.doc.scopes, this.schema);
	}
	types(): TypeInfo {
		return this.analyze().types;
	}

	// ── cursor verbs: offset in, spans out; total ──
	tokenAt(offset: number): Token | undefined {
		return this.doc.tokenAt(offset);
	}
	nodeAt(offset: number): NodeHit | undefined {
		return this.doc.nodeAt(offset);
	}
	scopeAt(offset: number): Scope | undefined {
		return this.nodeAt(offset)?.scope;
	}
	/** The ONE documented two-step composition: nodeAt locates the expr + its scope, types().typeOf
	 *  infers it. A miss returns Type's own `unknown` (src/infer/types.ts's UNKNOWN), never a throw. */
	typeAt(offset: number): Type {
		const hit = this.nodeAt(offset);
		return hit ? this.types().typeOf(hit.expr, hit.scope) : UNKNOWN;
	}
	completeAt(offset: number, opts?: CompleteOptions): CompletionResult {
		return completeAt(this.doc, offset, this.schema, opts);
	}
	signatureAt(offset: number): SignatureHelpInfo | null {
		return signatureAt(this.doc, offset);
	}
	referencesAt(offset: number): Occurrences | null {
		return this.doc.referencesAt(offset, this.schema);
	}
	lineageAt(offset: number): LineageHop | undefined {
		return this.doc.lineageAt(offset, this.schema);
	}
	/** Schema-free: frame identity is structural. */
	frameAt(offset: number): Frame | undefined {
		return this.doc.frameAt(offset);
	}
	clausesOf(scope: Scope): ClauseInfo[] {
		return this.doc.clausesOf(scope);
	}
	setOpArmsOf(scope: Scope): SetOpArms | undefined {
		return this.doc.setOpArmsOf(scope);
	}
	variantAt(offset: number): DocumentVariant | undefined {
		return this.doc.variantAt(offset);
	}
	unionSymbols(): Sym[] {
		return this.doc.unionSymbols(this.schema);
	}
	unionDiagnostics(): (SyntaxDiagnostic | Diagnostic)[] {
		return this.doc.unionDiagnostics(this.schema);
	}
	unionCtes(): UnionCte[] {
		return this.doc.unionCtes(this.schema);
	}
	unionOutputColumns(): { name: string; span: Span }[] {
		return this.doc.unionOutputColumns(this.schema);
	}
}
