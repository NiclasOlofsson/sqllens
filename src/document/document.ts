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
// STATEMENT CELLS (Task 5): the document is split into per-statement cells
// (src/document/split.ts) and each cell is parsed independently, so an edit
// inside one statement only re-parses that statement's cell — the unchanged
// cells are reused across withText() via a content-addressed cache (keyed by
// dialect + cell text, carried from parent to child). `statements` / `cellAt`
// are the real per-statement surface; the whole-document facade fields
// (`ast`/`cst`/`scopes`/`tokens`/`diagnostics`/`errors`) stay identical to a
// single whole-doc parse for a single-cell document (byte-exact back-compat)
// and keep today's compound-flagged shape for a multi-cell one.
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
import { debugRethrow } from "../debug.js";
import { parse, qualify, deriveSymbols, toScopes, TypeInfo } from "../api.js";
import { lineageAt as lineageAtScopes, type LineageHop } from "../lineage/hops.js";
import { referencesAt as referencesAtScopes, type Occurrence, type Occurrences } from "../references/references.js";
import type { Dialect } from "../dialect.js";
import type { QueryExpr, SelectExpr, PartSpan, PipeStage, VariableDecl } from "../ir/ir.js";
import { freezeIR } from "../ir/freeze.js";
import { partSpanOf, starSpanOf } from "../ir/part-span.js";
import type { StatementCategory } from "../ir/statement.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import type { CteRef, Scope, ScopeTree } from "../scope/scope.js";
import { frameAt as frameAtScopes, type Frame } from "../scope/frame.js";
import { clausesOf as clausesOfScope, type ClauseInfo } from "../scope/clauses.js";
import { setOpArmsOf as setOpArmsOfScope, type SetOpArms } from "../scope/setop-arms.js";
import type { Qualification, Diagnostic } from "../qualify/qualify.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { OPEN_PROVIDER, type TemplateProvider } from "../qualify/template-provider.js";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Type } from "../infer/types.js";
import type { Span, Sym } from "../symbols/symbols.js";
import type { Token } from "../token/token.js";
import type { TemplateEngine, TemplatedParseResult, TemplateVariant } from "../template/engine.js";
import { LineIndex } from "./line-index.js";
import { nodeAt, type NodeHit } from "./node-at.js";
import { splitStatements, type StatementCellSpan } from "./split.js";
import { shiftDiagnostics, shiftTokens, shiftSpanFields, shiftPartSpan, shiftSpan } from "./shift.js";

// A single stable OPEN-WORLD default, used by analyze() when no catalog is configured.
// Sharing ONE instance (OPEN_PROVIDER) keeps the schema-keyed analyze() memo working for
// schema-free calls (cache key = schema ?? OPEN_PROVIDER). Open world: every lookup answers
// unknown and NO miss-driven diagnostics fire — an empty CLOSED Schema here would unknown-table
// every `select * from t` in a schema-free document.

/** A memo entry stamped with the SchemaProvider `version` it was computed for. */
interface Versioned<T> {
	version: number;
	value: T;
}

/** Identity + version memo: one slot per SchemaProvider identity, holding the value computed for the
 *  last-seen version. A version bump (monotonic — CallbackSchema.prime() only increases it) misses
 *  and recomputes; a plain Schema (version constant 0) always hits, memoizing exactly as an
 *  identity-only Map did. Single-slot (not Map<version,…>) keeps memory bounded to one entry per
 *  schema even for a CachedCell that survives many edits + primes, and is correct because a
 *  superseded version is never queried again. */
function memoByVersion<T>(cache: WeakMap<SchemaProvider, Versioned<T>>, schema: SchemaProvider, compute: () => T): T {
	const hit = cache.get(schema);
	if (hit && hit.version === schema.version) return hit.value;
	const value = compute();
	cache.set(schema, { version: schema.version, value });
	return value;
}

/** How many parsed cells to retain in the cross-edit cache. Bounds memory for a huge script while
 *  keeping the working set of statements around an edit resident. LRU-evicted past this. */
const CELL_CACHE_MAX = 256;

/** The schema-dependent analysis of ONE cell, in CELL-RELATIVE coordinates. Memoized on the
 *  CachedCell (keyed by schema identity) so an edit that only touches another statement reuses this
 *  cell's qualify/deriveSymbols unchanged — the memo rides the content-addressed cache across edits. */
interface CellAnalysis {
	qualification: Qualification;
	/** Cell-relative symbols (spans shifted to doc coordinates only at the doc-level merge). */
	symbols: Sym[];
}

/** A parsed statement cell, in CELL-RELATIVE coordinates — the unit the content-addressed cache
 *  stores. Reused verbatim across edits; tokens/diagnostics are re-shifted to doc coordinates when
 *  a StatementCell is built from it (the cst/ast/scopes stay cell-relative, as documented). */
interface CachedCell {
	text: string;
	category: StatementCategory;
	ast: QueryExpr;
	cst: ParserRuleContext;
	scopes: ScopeTree;
	/** cell-relative token stream. */
	tokens: readonly Token[];
	errors: number;
	/** cell-relative syntax diagnostics. */
	diagnostics: readonly SyntaxDiagnostic[];
	/** Per-schema analyze() memo for THIS cell, keyed on schema IDENTITY + VERSION (a CallbackSchema
	 *  bumps its version in prime(), which must invalidate this cell's cached analysis). The Map
	 *  reference is stable across edits (the CachedCell is reused via the CellCache), so a cell
	 *  untouched by an edit keeps its analysis until a schema/version change. */
	readonly analysis: WeakMap<SchemaProvider, Versioned<CellAnalysis>>;
	/** Present ONLY for a cell built by `buildTemplatedCell` — the full engine result, so
	 *  `doc.templated` survives a cache hit across `withText()` without re-invoking the engine.
	 *  Undefined for every plain cell. */
	readonly templated?: TemplatedParseResult;
}

/** The content-addressed cross-edit cell cache: parsed products keyed by `dialect + " " + cellText`,
 *  LRU-bounded. Carried from a parent SqlDocument to its withText() children so an edit reuses the
 *  cells whose text didn't change (including a statement that merely moved — content addressing). */
class CellCache {
	private readonly map = new Map<string, CachedCell>();

	get(key: string): CachedCell | undefined {
		const hit = this.map.get(key);
		if (hit === undefined) return undefined;
		// LRU touch: reinsert so it becomes the most-recently-used entry.
		this.map.delete(key);
		this.map.set(key, hit);
		return hit;
	}

	set(key: string, cell: CachedCell): void {
		this.map.set(key, cell);
		if (this.map.size > CELL_CACHE_MAX) {
			// Evict the least-recently-used (oldest insertion order) entry.
			const oldest = this.map.keys().next().value;
			if (oldest !== undefined) this.map.delete(oldest);
		}
	}
}

/** One top-level statement of the document, in DOCUMENT coordinates. The real per-statement surface —
 *  each cell is parsed and scoped independently. `tokens`/`diagnostics` are shifted into doc offsets;
 *  `ast`/`cst`/`scopes` carry cell-relative spans (per-cell position mapping is Task 6). */
export interface StatementCell {
	/** The cell's [start, end) doc offsets — leading trivia + trailing separator included (tiling). */
	readonly span: StatementCellSpan;
	/** The cell's exact source slice — the content-address key material. */
	readonly text: string;
	/** The statement category from this cell's own lower() — real, never the compound facade. */
	readonly category: StatementCategory;
	/** Per-statement IR (real, not compound-flagged). Spans are cell-relative. */
	readonly ast: QueryExpr;
	/** The per-statement antlr CST root. Spans are cell-relative. */
	readonly cst: ParserRuleContext;
	/** Per-statement scope tree. */
	readonly scopes: ScopeTree;
	/** Tokens with spans in DOC coordinates (shifted from cell-relative). */
	readonly tokens: readonly Token[];
	/** Syntax-error count for this cell alone. */
	readonly errors: number;
	/** Syntax diagnostics with positions in DOC coordinates (shifted from cell-relative). */
	readonly diagnostics: readonly SyntaxDiagnostic[];
}

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

/** One coherent arm realization of a templated document. Lazy: nothing parses until doc() or
 *  text() is first touched. A variant IS a document — everything a plain SqlDocument exposes
 *  (ast/tokens/scopes/templated/analyze/cursor members) is available per arm through doc(). */
export interface DocumentVariant {
	/** The arm this variant activates (undefined = variant 0, all defaults). Mirrors
	 *  TemplateVariant.active, including the synthetic-empty marker from Task 1. */
	readonly active?: TemplateVariant["active"];
	/** The realized text: original text with inactive arms whitespace-blanked —
	 *  length- and newline-preserving (spans stay document-true). Memoized. */
	text(): string;
	/** The arm's own SqlDocument: same dialect, SAME engine, SAME provider, SHARING the parent's
	 *  content-addressed cell-cache family (an arm whose text an edit didn't change is a cache hit).
	 *  Memoized per variant. */
	doc(): SqlDocument;
}

/** One CTE's identity + its output columns unioned across arms (`SqlDocument.unionCtes`). */
export interface UnionCte {
	/** Fold-normalized, quote-preserving identity form — `foldIdentifier(raw, dialect)`, the same
	 *  vocabulary the column entries below (and the rest of the resolved surface) speak. The exact
	 *  written form is recoverable by slicing the source at `declarationSpan`. */
	name: string;
	/** Declaration identity: the CTE name's own span (`CteDef.nameCst`, falling back to the whole
	 *  `CteDef.cst` when the name itself has no real token). Part of the key: two same-named CTEs
	 *  declared at different positions stay distinct entries. */
	declarationSpan: PartSpan;
	/** Output columns unioned by NAME across arms; each column's span is the FIRST LIVE ARM's (arm
	 *  iteration order = `SqlDocument.variants` order) — the representative-span rule pinned by the
	 *  variant-acceptance brief's A8a-c. Names are fold-normalized like `name` above. */
	columns: { name: string; span: Span }[];
}

export class SqlDocument {
	readonly uri?: string;
	readonly version: number;
	readonly text: string;
	readonly dialect: Dialect;
	/** The per-statement cells — the real surface for statement-scoped work. Use `cellAt(offset)` to
	 *  find the cell owning a position. A single-statement document has exactly one cell. */
	readonly statements: readonly StatementCell[];
	/** Whole-document token stream (concat of the cells' doc-coordinate tokens). Byte-identical to a
	 *  single whole-doc parse for a single-cell document. */
	readonly tokens: readonly Token[];
	/** The whole-document CST root — the escape hatch for precise spans. For a MULTI-cell document
	 *  this is the compound facade (the first cell's CST as a placeholder); use `statements`/`cellAt`
	 *  for real per-statement spans. */
	readonly cst: ParserRuleContext;
	/** The whole-document IR. For a single-cell document this is the cell's own IR (identical to
	 *  today). For a MULTI-cell document it keeps today's compound-flagged shape (`statement:
	 *  "compound"`); use `statements`/`cellAt` for the real per-statement IR. */
	readonly ast: QueryExpr;
	/** Total syntax-error count across all cells. */
	readonly errors: number;
	/** Positioned SYNTAX diagnostics (never semantic — those need a schema), concatenated across cells
	 *  in doc coordinates. */
	readonly diagnostics: readonly SyntaxDiagnostic[];
	/** The whole-document scope tree. Single-cell: the cell's own scopes. MULTI-cell: the compound
	 *  facade's scopes (`statement: "compound"`); use `statements`/`cellAt` for per-statement scopes. */
	readonly scopes: ScopeTree;
	readonly lines: LineIndex;
	/** The template artifacts when this document was built with a `templating` engine:
	 *  tags/regions/symbols/placeholder/degraded plus tagOf/nodeOf/diagnosticsOf.
	 *  Undefined on plain documents. */
	readonly templated?: TemplatedParseResult;

	/** Schema-keyed memo of the MERGED analyze() result (concat + coordinate shift). Rebuilt per doc
	 *  version — the merge must redo when an earlier statement's line count changes and shifts later
	 *  cells' doc coordinates — while the per-CELL analysis (the expensive qualify/deriveSymbols) is
	 *  memoized on the CachedCell and survives edits. Keyed on schema IDENTITY + VERSION (a primed
	 *  CallbackSchema bumps its version, invalidating this memo). The Map reference is frozen with the
	 *  instance, but its contents stay mutable, so memoization works on a frozen SqlDocument. */
	private readonly _analysisCache = new WeakMap<SchemaProvider, Versioned<DocumentAnalysis>>();
	/** The CachedCell backing each StatementCell, parallel to `statements`. Holds the cross-edit
	 *  per-cell analysis memo; analyze() reads it to merge per-statement results. */
	private readonly _cells: readonly CachedCell[];
	/** The content-addressed cross-edit cell cache, carried to withText() children. Its contents stay
	 *  mutable (a memo) even though the reference is frozen with the instance. */
	private readonly _cellCache: CellCache;
	/** The injected template engine + provider, carried to withText() children so an edit keeps
	 *  building through the same door its parent used. Undefined on a plain document. */
	private readonly _templating?: TemplateEngine;
	private readonly _provider?: TemplateProvider;
	/** Memo box for the `variants` getter (frozen instance, mutable memo — the `_analysisCache`
	 *  precedent: the box reference is frozen with the instance, but its `.value` stays settable). */
	private readonly _variantsMemo: { value?: readonly DocumentVariant[] } = {};
	/** Schema-keyed memos for the four union views (`unionSymbols`/`unionDiagnostics`/`unionCtes`/
	 *  `unionOutputColumns`) — one WeakMap per view, same identity+version pattern as `_analysisCache`. */
	private readonly _unionSymbolsCache = new WeakMap<SchemaProvider, Versioned<Sym[]>>();
	private readonly _unionDiagnosticsCache = new WeakMap<
		SchemaProvider,
		Versioned<(SyntaxDiagnostic | Diagnostic)[]>
	>();
	private readonly _unionCtesCache = new WeakMap<SchemaProvider, Versioned<UnionCte[]>>();
	private readonly _unionOutputColumnsCache = new WeakMap<
		SchemaProvider,
		Versioned<{ name: string; span: Span }[]>
	>();

	private constructor(
		text: string,
		dialect: Dialect,
		opts: { uri?: string; version?: number; templating?: TemplateEngine; provider?: TemplateProvider },
		cellCache: CellCache,
	) {
		this.uri = opts.uri;
		this.version = opts.version ?? 0;
		this.text = text;
		this.dialect = dialect;
		this.lines = new LineIndex(text);
		this._cellCache = cellCache;
		this._templating = opts.templating;
		this._provider = opts.provider;

		let cells: StatementCell[];
		let backing: CachedCell[];
		if (opts.templating) {
			// The templated door: ONE cell spanning the whole text, bypassing splitStatements —
			// its products come from the engine, not the plain per-dialect parse (see buildTemplatedCell).
			const built = this.buildTemplatedCell(text, opts.templating, opts.provider);
			cells = [built.cell];
			backing = [built.cached];
		} else {
			// Split into per-statement cells and parse each independently, reusing unchanged cells from
			// the (carried) content-addressed cache. Each cell re-enters the dialect's batch entry rule
			// as a batch of one — the proven single-statement path — so no lower() changes are needed.
			const spans = splitStatements(text, dialect);
			const handedOut = new Set<CachedCell>(); // per-BUILD: which cache entries this doc already uses
			cells = [];
			backing = [];
			for (const span of spans) {
				const built = this.buildCell(span, handedOut);
				cells.push(built.cell);
				backing.push(built.cached);
			}
		}
		this.statements = Object.freeze(cells);
		this._cells = backing;
		this.templated = opts.templating ? backing[0]!.templated : undefined;

		// Whole-document facade. tokens/diagnostics/errors are the cheap concat/sum across cells.
		this.tokens = cells.flatMap((c) => c.tokens as Token[]);
		this.diagnostics = cells.flatMap((c) => c.diagnostics as SyntaxDiagnostic[]);
		this.errors = cells.reduce((n, c) => n + c.errors, 0);

		if (cells.length === 1) {
			// Single statement: the cell IS the whole document (byte-exact with today).
			this.ast = cells[0].ast;
			this.cst = cells[0].cst;
			this.scopes = cells[0].scopes;
		} else {
			// Multi-statement: keep today's compound-flagged facade for back-compat. Built directly
			// from the cells (no whole-doc re-parse); consumers should use statements/cellAt.
			const facade = compoundFacade(cells, dialect);
			this.ast = facade.ast;
			this.cst = facade.cst;
			this.scopes = facade.scopes;
		}

		Object.freeze(this);
	}

	/** Build one statement cell for `span`: reuse the cached cell-relative parse if its text is
	 *  already known (content addressing), else parse+scope it and cache it; then shift tokens /
	 *  diagnostics into document coordinates by the cell's start position.
	 *
	 *  `handedOut` dedupes WITHIN one document build: two cells with byte-identical text (e.g.
	 *  `SELECT 1;SELECT 1;`) must NOT share one CachedCell — their StatementCells would carry
	 *  reference-identical cst/ast/scopes under different spans, and the per-cell semantic passes
	 *  (Task 6: references/documentHighlight) walk scope trees by OBJECT IDENTITY, so two positions
	 *  resolving through one shared scopes object would cross-contaminate occurrences. On a second
	 *  use of the same entry in the same build, that cell is parsed fresh. The fresh product does
	 *  NOT replace the cache entry: the first occurrence keeps its stable cross-edit identity (the
	 *  common case), and only intra-doc duplicates — rare — pay a re-parse per build. */
	private buildCell(
		span: StatementCellSpan,
		handedOut: Set<CachedCell>,
	): { cell: StatementCell; cached: CachedCell } {
		const cellText = this.text.slice(span.start, span.end);
		const key = this.dialect + " " + cellText;
		let cached = this._cellCache.get(key);
		if (cached !== undefined && handedOut.has(cached)) cached = undefined; // intra-doc duplicate
		if (cached === undefined) {
			const p = parse(cellText, this.dialect);
			cached = {
				text: cellText,
				category: p.ast.statement ?? "other",
				ast: p.ast,
				cst: p.cst,
				// Resolve scopes from the already-lowered ast — do NOT re-parse.
				scopes: toScopes(p.ast, { dialect: this.dialect }),
				tokens: p.tokens,
				errors: p.errors,
				diagnostics: p.diagnostics,
				analysis: new WeakMap<SchemaProvider, Versioned<CellAnalysis>>(),
			};
			// Cache only the FIRST product for a key (see above — duplicates stay uncached).
			if (this._cellCache.get(key) === undefined) this._cellCache.set(key, cached);
		}
		handedOut.add(cached);
		// Shift cell-relative tokens/diagnostics to doc coordinates. The first cell starts at 0/0/0
		// so the shift is an identity (byte-exact). Later cells offset by the cell's start position.
		const base = this.lines.positionAt(span.start);
		const tokens = shiftTokens(cached.tokens, base.line, base.column, span.start);
		const diagnostics = shiftDiagnostics(cached.diagnostics, base.line, base.column, span.start);
		const cell = Object.freeze({
			span,
			text: cached.text,
			category: cached.category,
			ast: cached.ast,
			cst: cached.cst,
			scopes: cached.scopes,
			tokens,
			errors: cached.errors,
			diagnostics,
		});
		return { cell, cached };
	}

	/** Build the ONE cell for a TEMPLATED document: span [0, text.length) — the templated build path
	 *  bypasses `splitStatements` entirely (one cell, whole text), and its products come from a single
	 *  `engine.parse(text, dialect, { provider })` call rather than the plain per-dialect `parse()`.
	 *  `r.tokens`/`r.diagnostics` are ALREADY document coordinates (the cell always starts at 0), so —
	 *  unlike `buildCell` — nothing is shifted. Mirrors `buildCell`'s CachedCell/StatementCell shapes
	 *  so every downstream consumer (analyze(), cellAt(), nodeAt()…) sees the same structure whether
	 *  the document is plain or templated. Cached in the SAME cross-edit `_cellCache` as plain cells,
	 *  under a prefixed key so a templated cell can never collide with a plain one for the same text. */
	private buildTemplatedCell(
		text: string,
		engine: TemplateEngine,
		provider: TemplateProvider | undefined,
	): { cell: StatementCell; cached: CachedCell } {
		const span: StatementCellSpan = { start: 0, end: text.length };
		// Collision-proofed against a plain cell's `dialect + " " + text` key by the "templated "
		// prefix; folds in the engine name (two engines could tokenize the same text differently)
		// and the provider's version counter (0 when no provider) so a prime() that resolves a
		// miss invalidates every cached templated cell built against the stale answers.
		const providerVersion = provider?.version ?? 0;
		const key = `templated ${engine.name}@${providerVersion} ${this.dialect} ${text}`;
		let cached = this._cellCache.get(key);
		if (cached === undefined) {
			const r = engine.parse(text, this.dialect, { provider });
			cached = {
				text,
				category: r.sql.ast.statement ?? "other",
				ast: r.sql.ast,
				cst: r.sql.cst,
				// Resolve scopes from the already-lowered (marker-carrying) ast — do NOT re-parse.
				scopes: toScopes(r.sql.ast, { dialect: this.dialect }),
				tokens: r.tokens,
				errors: r.sql.errors,
				diagnostics: r.diagnostics,
				analysis: new WeakMap<SchemaProvider, Versioned<CellAnalysis>>(),
				templated: r,
			};
			this._cellCache.set(key, cached);
		}
		const cell = Object.freeze({
			span,
			text: cached.text,
			category: cached.category,
			ast: cached.ast,
			cst: cached.cst,
			scopes: cached.scopes,
			tokens: cached.tokens,
			errors: cached.errors,
			diagnostics: cached.diagnostics,
		});
		return { cell, cached };
	}

	/** Build a document for `text` in `dialect`. Total: never throws, even on broken / mid-edit input.
	 *  Starts a FRESH cell cache — cross-edit reuse comes from withText(), not create(). Pass
	 *  `templating` to parse through an injected TemplateEngine (jinja-SQL etc.) instead of the plain
	 *  per-dialect parser — absent, this is the exact untouched plain-SQL path (never auto-detected).
	 *  `provider` feeds the engine's fills/markers and is ignored without `templating`. */
	static create(
		text: string,
		dialect: Dialect,
		opts: { uri?: string; version?: number; templating?: TemplateEngine; provider?: TemplateProvider } = {},
	): SqlDocument {
		return new SqlDocument(text, dialect, opts, new CellCache());
	}

	/** An edit: a NEW SqlDocument for the new text. This instance is untouched (immutable). The cell
	 *  cache is CARRIED forward, so statements whose text didn't change reuse their parsed cells. The
	 *  injected templating engine + provider (if any) ride the instance to this child too. */
	withText(text: string, version: number): SqlDocument {
		return new SqlDocument(
			text,
			this.dialect,
			{ uri: this.uri, version, templating: this._templating, provider: this._provider },
			this._cellCache,
		);
	}

	/** The statement cell owning `offset` (binary search over the tiling cell spans), or undefined if
	 *  there are no cells. An offset at end-of-document resolves to the last cell. */
	cellAt(offset: number): StatementCell | undefined {
		const cells = this.statements;
		if (cells.length === 0) return undefined;
		let lo = 0;
		let hi = cells.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (offset < cells[mid].span.end) hi = mid;
			else lo = mid + 1;
		}
		return cells[lo];
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

	/** The smallest IR Expr whose CST range covers `offset`, with its owning Scope. Cell-aware: the hit
	 *  comes from the CELL owning `offset` (with a cell-relative offset), so a node in statement 2 of a
	 *  multi-cell document resolves through its own scope tree — NOT the compound facade. The returned
	 *  `expr.cst` carries CELL-relative spans; a caller turning it into a document Range shifts it by the
	 *  owning cell's start. Single-cell: identical to today. */
	nodeAt(offset: number): NodeHit | undefined {
		const cell = this.cellAt(offset);
		if (!cell) return nodeAt(this.scopes, offset, this.ast);
		return nodeAt(cell.scopes, offset - cell.span.start, cell.ast);
	}

	/** The declaration + every occurrence of the symbol at `offset` (the references engine,
	 *  cell-aware): resolved over the CELL owning the offset — its own scopes/ast, with a
	 *  cell-relative offset — then every returned span (occurrences + declaration) shifted from
	 *  cell-relative to DOCUMENT coordinates by the cell base. Absorbs the dance the LSP
	 *  references/documentHighlight/codeLens features hand-rolled. Single-cell documents: base
	 *  0/0/0, byte-identical to the free referencesAt over doc.scopes. Total: null off-symbol or
	 *  with no cells; never throws. */
	referencesAt(offset: number, schema?: SchemaProvider): Occurrences | null {
		const cell = this.cellAt(offset);
		if (!cell) return referencesAtScopes(this.scopes, offset, schema, this.ast);
		const occ = referencesAtScopes(cell.scopes, offset - cell.span.start, schema, cell.ast);
		if (!occ) return occ;
		const base = this.lines.positionAt(cell.span.start);
		const shift = (s: Span): Span => shiftSpan(s, base.line, base.column, cell.span.start);
		const shifted: Occurrences =
			cell.span.start === 0
				? occ // first cell: identity shift
				: {
						...occ,
						declaration: occ.declaration ? shift(occ.declaration) : undefined,
						occurrences: occ.occurrences.map((o) => ({ ...o, span: shift(o.span) })),
					};
		// A variable occurrence can span statement cells (a T-SQL DECLARE and its references each
		// parse as their own scope tree, see buildAnalysis's cross-cell linking above), so the
		// per-cell result above only ever sees THIS cell's own occurrences, with no declaration (a
		// bare variable reference has no in-tree declaration node the way a CTE name does). Escalate
		// to the document-wide grouping, mirroring how a parameter/variable already groups WITHIN one
		// scope tree (references.ts's collectParam) but widened to the whole document and adding the
		// declaration. Parameters stay per-cell only: a caller-bound placeholder has no
		// cross-statement declaration site to escalate to.
		return shifted.kind === "variable" && this.statements.length > 1
			? this.escalateVariableOccurrences(shifted, schema)
			: shifted;
	}

	/** Widen a per-cell "variable" Occurrences to the whole document: every Sym sharing `occ.symbol`'s
	 *  name, across every statement cell, becomes an occurrence (declaration Syms included). Sourced
	 *  from `analyze().symbols`, which already carries the cross-cell `definition` links
	 *  `buildAnalysis` applies: a re-group over already-linked data, not a fresh resolution pass. */
	private escalateVariableOccurrences(occ: Occurrences, schema?: SchemaProvider): Occurrences {
		const matches = this.analyze(schema).symbols.filter(
			(sym) => sym.kind === "variable" && sym.name === occ.symbol,
		);
		if (matches.length === 0) return occ;
		const occurrences: Occurrence[] = [];
		const seen = new Set<string>();
		let declaration: Span | undefined;
		for (const sym of matches) {
			const role: Occurrence["role"] = sym.modifiers.includes("declaration") ? "declaration" : "reference";
			const key = `${sym.span.start}:${sym.span.end}:${role}`;
			if (seen.has(key)) continue;
			seen.add(key);
			occurrences.push({ span: sym.span, role });
			if (role === "declaration" && declaration === undefined) declaration = sym.span;
		}
		return { symbol: occ.symbol, kind: "variable", declaration, occurrences };
	}

	/** The per-hop lineage spine anchored at `offset` (cell-aware): resolved over the CELL owning
	 *  the offset, with a cell-relative offset. NOTE: on a MULTI-statement document the returned
	 *  hop nodes' cst spans are CELL-relative — the spine references the frozen per-cell IR (hops
	 *  are references, not copies), so nothing is shifted here; use `cellAt(offset).span.start` as
	 *  the base to map them to document coordinates. Single-cell documents (every dbt model) are
	 *  identical either way. Total: undefined off-symbol or with no cells; never throws. */
	lineageAt(offset: number, schema?: SchemaProvider): LineageHop | undefined {
		const cell = this.cellAt(offset);
		if (!cell) return lineageAtScopes(this.scopes, offset, schema);
		return lineageAtScopes(cell.scopes, offset - cell.span.start, schema);
	}

	/** The owning frame (the Scope + its `Sym.frame`-matching label) for `offset`, cell-aware,
	 *  mirroring `nodeAt`: resolved over the CELL owning the offset, with a cell-relative offset. The
	 *  returned `Frame.scope`'s own CST spans stay CELL-relative (same convention as `NodeHit.expr`):
	 *  a caller turning it into a document Range shifts by the owning cell's start. Schema-free (frame
	 *  identity is structural). Total: undefined off-document / with no cells; never throws. */
	frameAt(offset: number): Frame | undefined {
		const cell = this.cellAt(offset);
		if (!cell) return frameAtScopes(this.scopes, offset, this.ast);
		return frameAtScopes(cell.scopes, offset - cell.span.start, cell.ast);
	}

	/** The ordered clause list for `scope` (typically the `scope` a prior `frameAt` call returned),
	 *  shifted to document coordinates. Finds the owning cell by matching `scope`'s tree ROOT against
	 *  each cell's own `scopes.root` (a Scope is always reachable from exactly one cell's root): a
	 *  `scope` this document didn't produce answers `[]`, never a guess. */
	clausesOf(scope: Scope): ClauseInfo[] {
		const i = this.cellIndexOfScope(scope);
		if (i < 0) return [];
		const raw = clausesOfScope(scope, this._cells[i].tokens);
		if (i === 0) return raw; // first cell: identity shift
		const span = this.statements[i].span;
		const base = this.lines.positionAt(span.start);
		return raw.map((c) => ({
			kind: c.kind,
			anchorSpan: shiftPartSpan(c.anchorSpan, base.line, base.column, span.start),
			span: shiftPartSpan(c.span, base.line, base.column, span.start),
		}));
	}

	/** Set-op arm geometry for `scope` (undefined for a non-setop frame), shifted to document
	 *  coordinates the same way `clausesOf` is. */
	setOpArmsOf(scope: Scope): SetOpArms | undefined {
		const raw = setOpArmsOfScope(scope);
		if (!raw) return raw;
		const i = this.cellIndexOfScope(scope);
		if (i <= 0) return raw; // not found (defensive), or the first cell: identity shift either way
		const span = this.statements[i].span;
		const base = this.lines.positionAt(span.start);
		const shift = (s: PartSpan) => shiftPartSpan(s, base.line, base.column, span.start);
		return { span: shift(raw.span), arms: raw.arms.map((a) => ({ scope: a.scope, span: shift(a.span) })) };
	}

	/** The index into `this._cells`/`this.statements` of the cell whose scope tree ROOT is `scope`'s
	 *  own root (walking `scope.parent` up), or -1 when `scope` belongs to no cell of this document. */
	private cellIndexOfScope(scope: Scope): number {
		let root = scope;
		while (root.parent) root = root.parent;
		return this._cells.findIndex((c) => c.scopes.root === root);
	}

	/** The coherent per-arm variants of a templated document (engine.variants() consumed). `[]` on
	 *  plain documents and on templated documents with no control-flow regions. Lazy at every level:
	 *  enumeration on first read, realization+parse per variant on first doc()/text(). Memoized on
	 *  the instance (frozen instance, mutable memo box — see `_variantsMemo`). */
	get variants(): readonly DocumentVariant[] {
		return (this._variantsMemo.value ??= this.buildVariants());
	}

	/** Compute (no memo) the variant list: absent `variants` hook, a plain document, or a templated
	 *  document with no control-flow regions all answer `[]`. Otherwise consults the engine, wrapped
	 *  defensively (degrade to `[]`, never throw — engine.variants may throw only on engine bugs, the
	 *  same posture parseTemplated's own catch uses). */
	private buildVariants(): readonly DocumentVariant[] {
		if (!this._templating?.variants || !this.templated || this.templated.regions.length === 0) return [];
		let raw: TemplateVariant[];
		try {
			raw = this._templating.variants(this.text, this.dialect);
		} catch (e) {
			debugRethrow(e);
			return [];
		}
		return raw.map((v) => this.wrapVariant(v));
	}

	/** Wrap one engine-produced TemplateVariant as a DocumentVariant: `text()` delegates straight to
	 *  the engine variant's own memoized realization (never re-realized here); `doc()` builds — once,
	 *  memoized — the arm's own SqlDocument through the PRIVATE constructor, carrying this document's
	 *  `_cellCache` (the exact carry `withText` uses, NOT the public `create`'s fresh cache) plus the
	 *  same templating engine + provider, so an unchanged arm across an edit is a cache hit. */
	private wrapVariant(v: TemplateVariant): DocumentVariant {
		let doc: SqlDocument | undefined;
		return {
			active: v.active,
			text: () => v.text(),
			doc: () =>
				(doc ??= new SqlDocument(
					v.text(),
					this.dialect,
					{ templating: this._templating, provider: this._provider },
					this._cellCache,
				)),
		};
	}

	/** The variant whose realization has `offset` LIVE (its arm active): an offset inside a
	 *  non-default arm routes to that arm's variant; a default-arm or outside-all-regions offset
	 *  routes to variant 0. undefined on plain documents and no-region templated documents.
	 *  Never throws; out-of-range offsets answer variant 0 (the honest default). */
	variantAt(offset: number): DocumentVariant | undefined {
		if (!this.templated) return undefined;
		const variants = this.variants;
		if (variants.length === 0) return undefined;
		const hit = deepestArmAt(this.templated.regions, offset);
		if (!hit || hit.armIndex === 0) return variants[0]; // default arm or outside every region
		// A real (non-synthetic) non-default arm: find the variant that activates exactly this
		// (region, armIndex). `variants` was built by `buildVariants()` from a SEPARATE
		// `engine.variants()` call (its own independent templateRegions derivation), so its
		// `active.region` objects are structurally-identical but NOT reference-identical to the
		// ones on `this.templated.regions` — both walk the exact same original text through the
		// exact same deterministic tag→region algorithm, so a region's `span.start` (the opening
		// tag's offset, unique per region — no two regions can open at the same offset) is a
		// stable cross-parse identity key; `===` on the region object would never match here.
		// Guarding syntheticEmpty matters too: a synthetic-empty variant's `active.armIndex` is a
		// type-stable placeholder (0) — without the guard it could collide with a genuine arm-0
		// lookup, but arm-0 hits are already routed to variants[0] above and never reach this
		// search, so the guard is defense-in-depth, not a load-bearing branch.
		const match = variants.find(
			(v) =>
				v.active &&
				!v.active.syntheticEmpty &&
				v.active.region.span.start === hit.region.span.start &&
				v.active.armIndex === hit.armIndex,
		);
		return match ?? variants[0];
	}

	/** The schema-dependent tiers, over the cached per-cell scopes/ast (no re-parse). Memoized by
	 *  schema IDENTITY + VERSION — a plain Schema (version 0) memoizes exactly as before; a
	 *  CallbackSchema that has been prime()d bumps its version and so re-computes with the newly
	 *  resolved tables. Every statement cell is qualified/symbol-derived INDEPENDENTLY (a broken or
	 *  unknown-column statement never suppresses another), then merged: symbols and semantic
	 *  diagnostics from every cell, each shifted from cell-relative to DOCUMENT coordinates. The
	 *  expensive per-cell work is memoized on each CachedCell, so an edit that touches only one
	 *  statement re-qualifies only that statement; the cheap merge (concat + shift) redoes per version.
	 *  With no schema the symbols/scopes still resolve structurally and types come back `unknown` where
	 *  a catalog would be needed (the stable OPEN_PROVIDER keeps the memo working). */
	analyze(schema?: SchemaProvider): DocumentAnalysis {
		const s = schema ?? OPEN_PROVIDER;
		return memoByVersion(this._analysisCache, s, () => this.buildAnalysis(s));
	}

	/** Compute (no memo) the merged document analysis for schema `s`. */
	private buildAnalysis(s: SchemaProvider): DocumentAnalysis {
		const cells = this.statements;
		let analysis: DocumentAnalysis;
		if (cells.length === 1) {
			// Single-cell fast path: the cell IS the document (base 0/0), so no shifting — byte-identical
			// to a direct qualify/deriveSymbols over the whole-doc scopes (back-compat).
			const ca = this.cellAnalysis(0, s);
			analysis = {
				qualification: ca.qualification,
				types: new TypeInfo(s),
				symbols: ca.symbols,
				diagnostics: ca.qualification.diagnostics,
			};
		} else {
			const symbols: Sym[] = [];
			const diagnostics: Diagnostic[] = [];
			const cellQuals: Qualification[] = [];
			// T-SQL DECLARE'd variables cross statement (`;`) boundaries within a batch but die at GO
			// ("The scope of a variable lasts from the point it's declared until the end of the batch...
			// in which it's declared", learn.microsoft.com/en-us/sql/t-sql/language-elements/
			// variables-transact-sql, "Variable scope"). Each cell is its own scope tree (content-
			// addressed caching means cross-cell state can only live here), so a per-name
			// last-declaration map, walked in cell order and reset at GO, links a still-unlinked
			// variable-reference Sym in a later cell to an earlier cell's declaration. Multiple same-name
			// DECLAREs across cells are not ambiguous here (a later one legitimately re-declares/rebinds
			// the name within a batch): that's simply "last wins"; genuine AMBIGUITY (two declare_local
			// entries of the same name in ONE DECLARE statement) is a same-root-scope concern already
			// resolved at the per-cell level (symbols.ts / infer.ts).
			const lastDecl = new Map<string, { nameSpan: PartSpan; typeText?: string }>();
			for (let i = 0; i < cells.length; i++) {
				const ca = this.cellAnalysis(i, s);
				cellQuals.push(ca.qualification);
				const base = this.lines.positionAt(cells[i].span.start);
				const off = cells[i].span.start;
				const shifted = shiftSymsForCell(ca.symbols, base.line, base.column, off);
				for (const decl of cells[i].ast.declarations ?? []) {
					lastDecl.set(decl.name, {
						nameSpan: shiftPartSpan(decl.nameSpan, base.line, base.column, off),
						typeText: decl.typeText,
					});
				}
				linkVariableReferences(shifted, lastDecl, this.dialect);
				symbols.push(...shifted);
				for (const d of ca.qualification.diagnostics)
					diagnostics.push(shiftSpanFields(d, base.line, base.column));
				if (cellEndsAtGo(cells[i])) lastDecl.clear();
			}
			// The merged qualification: diagnostics in doc coordinates, and columnsOf delegating to the
			// owning cell (scope objects are unique per cell, so only that cell answers non-"unknown").
			const qualification: Qualification = {
				diagnostics,
				columnsOf: (scope) => {
					for (const q of cellQuals) {
						const r = q.columnsOf(scope);
						if (r !== "unknown") return r;
					}
					return "unknown";
				},
				// Scope objects are unique per cell, so only the owning cell binds a ref in `scope`;
				// the rest return undefined and we fall through to it.
				bindingOf: (scope, ref) => {
					for (const q of cellQuals) {
						const b = q.bindingOf(scope, ref);
						if (b) return b;
					}
					return undefined;
				},
				// Same per-cell fall-through: a Projection node is unique to the cell that produced it.
				expandStarOf: (scope, projection) => {
					for (const q of cellQuals) {
						const r = q.expandStarOf(scope, projection);
						if (r !== undefined) return r;
					}
					return undefined;
				},
				// Same per-cell fall-through: a ResolvedSource is unique to the cell that produced it.
				columnsOfSource: (scope, src) => {
					for (const q of cellQuals) {
						const r = q.columnsOfSource(scope, src);
						if (r !== "unknown") return r;
					}
					return "unknown";
				},
			};
			analysis = { qualification, types: new TypeInfo(s), symbols, diagnostics };
		}
		return analysis;
	}

	/** The per-cell schema-dependent analysis (cell-relative), memoized on the CachedCell (by schema
	 *  identity + version) so it survives edits that don't touch this cell, yet re-runs when a primed
	 *  CallbackSchema bumps its version. */
	private cellAnalysis(i: number, s: SchemaProvider): CellAnalysis {
		const cached = this._cells[i];
		return memoByVersion(cached.analysis, s, () => {
			const scopes = this.statements[i].scopes;
			const qualification = qualify(scopes, s, { dialect: this.dialect });
			return {
				qualification,
				symbols: deriveSymbols(scopes, s, { dialect: this.dialect }, qualification.expandStarOf),
			};
		});
	}

	/** Symbols across ALL variants, deduped by span+identity+NAME (`start:end:kind:frame:name` —
	 *  NAME is load-bearing: schema-expanded star Syms share one zero-width span by design, see
	 *  symbols.ts's emitColumns). Computed over the VARIANT documents only — never the primary
	 *  parse, whose all-arms-live SQL can mis-read conflicting arms (e.g. `col_a col_b` reading as
	 *  an alias) into junk that must never leak into the union. Equals the plain `analyze(schema)`
	 *  symbols when there are no variants (a plain document, or a templated one with no
	 *  control-flow regions). Memoized per schema identity+version, like `analyze()`. */
	unionSymbols(schema?: SchemaProvider): Sym[] {
		const s = schema ?? OPEN_PROVIDER;
		return memoByVersion(this._unionSymbolsCache, s, () => this.buildUnionSymbols(s));
	}

	private buildUnionSymbols(s: SchemaProvider): Sym[] {
		const variants = this.variants;
		if (variants.length === 0) return this.analyze(s).symbols;
		return dedupBy(
			variants.flatMap((v) => v.doc().analyze(s).symbols),
			symKey,
		);
	}

	/** Diagnostics across all variants — syntax + semantic, like `session.diagnostics()` — deduped
	 *  by position+identity, NOT message text: two arms producing the SAME diagnostic at the SAME
	 *  position collapse to one entry, but the same message at TWO DIFFERENT positions stays two
	 *  entries (the exact case a message-keyed merge gets wrong). Same variant-only, memoized
	 *  semantics as `unionSymbols`. */
	unionDiagnostics(schema?: SchemaProvider): (SyntaxDiagnostic | Diagnostic)[] {
		const s = schema ?? OPEN_PROVIDER;
		return memoByVersion(this._unionDiagnosticsCache, s, () => this.buildUnionDiagnostics(s));
	}

	private buildUnionDiagnostics(s: SchemaProvider): (SyntaxDiagnostic | Diagnostic)[] {
		const variants = this.variants;
		if (variants.length === 0) return [...this.diagnostics, ...this.analyze(s).diagnostics];
		const all = variants.flatMap((v) => {
			const d = v.doc();
			return [...d.diagnostics, ...d.analyze(s).diagnostics] as (SyntaxDiagnostic | Diagnostic)[];
		});
		return dedupBy(all, diagKey);
	}

	/** Per-CTE column unions across all variants, keyed by NAME + declaration span (two same-named
	 *  CTEs declared at different positions stay distinct entries; a CTE existing in only one arm
	 *  still appears). Columns union by NAME; a column's representative span is the FIRST LIVE ARM's
	 *  (arm iteration order = `this.variants` order): the rule the variant-acceptance brief's A8a-c
	 *  pin. A CTE whose body is a set operation answers through the qualification (names per SQL
	 *  setop semantics, spans from the declaring branch); a PIPE-syntax body answers the derivable
	 *  subset, see `scopeOutputColumns`'s pipe doc comment. Falls through to this document's own
	 *  (single-arm) answer when there are no variants; there is no pre-existing single-doc
	 *  equivalent to delegate to, unlike unionSymbols/unionDiagnostics, so the no-variant case is
	 *  just the one-arm instance of the same algorithm. A MULTI-STATEMENT document (no variants: the
	 *  templated door always forces exactly one cell, so the two "multi" shapes never overlap) merges
	 *  every statement CELL's own CTEs instead, each shifted from cell-relative to DOCUMENT coordinates
	 *  (the same shift `analyze()` already applies to symbols/diagnostics for a multi-cell document);
	 *  the compound facade itself carries no CTEs, so cells are the real per-statement source. Memoized
	 *  like `unionSymbols`. */
	unionCtes(schema?: SchemaProvider): UnionCte[] {
		const s = schema ?? OPEN_PROVIDER;
		return memoByVersion(this._unionCtesCache, s, () => this.buildUnionCtes(s));
	}

	private buildUnionCtes(s: SchemaProvider): UnionCte[] {
		interface CteAgg {
			name: string;
			declarationSpan: PartSpan;
			columns: Map<string, Span>;
		}
		const byKey = new Map<string, CteAgg>();
		const order: string[] = [];
		for (const arm of this.armsData(s)) {
			for (const cteRef of collectCtes(arm.scopeRoot)) {
				const rawSpan = partSpanOf(cteRef.def.nameCst ?? cteRef.def.cst);
				if (!rawSpan) continue; // no real token to key on, never fabricate a span
				const declarationSpan = shiftPartSpan(rawSpan, arm.base.line, arm.base.col, arm.base.offset);
				const name = resolveBehavior(arm.dialect).fold(cteRef.def.name);
				const key = `${name}:${declarationSpan.start}`;
				let entry = byKey.get(key);
				if (!entry) {
					entry = { name, declarationSpan, columns: new Map() };
					byKey.set(key, entry);
					order.push(key);
				}
				for (const col of scopeOutputColumns(cteRef.scope, arm.qualification)) {
					if (!entry.columns.has(col.name)) {
						entry.columns.set(col.name, shiftSpan(col.span, arm.base.line, arm.base.col, arm.base.offset));
					}
				}
			}
		}
		return order.map((key) => {
			const e = byKey.get(key)!;
			return {
				name: e.name,
				declarationSpan: e.declarationSpan,
				columns: [...e.columns].map(([name, span]) => ({ name, span })),
			};
		});
	}

	/** The document's final-SELECT (root scope) output columns unioned across arms: same NAME
	 *  keying, representative-span rule, and multi-statement per-cell merge as `unionCtes` (see its
	 *  doc comment). A setop root (the dbt-incremental `… UNION ALL …` arm shape) answers through the
	 *  qualification, names per SQL setop semantics (left branch positionally, BY NAME appends
	 *  right-only), spans from the declaring branch. A PIPE-syntax root answers the derivable subset,
	 *  see `scopeOutputColumns`'s pipe doc comment. Falls through to this document's own root outputs
	 *  when there are no variants and only one statement cell. */
	unionOutputColumns(schema?: SchemaProvider): { name: string; span: Span }[] {
		const s = schema ?? OPEN_PROVIDER;
		return memoByVersion(this._unionOutputColumnsCache, s, () => this.buildUnionOutputColumns(s));
	}

	private buildUnionOutputColumns(s: SchemaProvider): { name: string; span: Span }[] {
		const byName = new Map<string, Span>();
		const order: string[] = [];
		for (const arm of this.armsData(s)) {
			for (const col of scopeOutputColumns(arm.scopeRoot, arm.qualification)) {
				if (!byName.has(col.name)) {
					byName.set(col.name, shiftSpan(col.span, arm.base.line, arm.base.col, arm.base.offset));
					order.push(col.name);
				}
			}
		}
		return order.map((name) => ({ name, span: byName.get(name)! }));
	}

	/** One "arm" `unionCtes`/`unionOutputColumns` aggregate over, unified across the two shapes that
	 *  can each independently make a document "multi" (never both at once: the templated door always
	 *  builds exactly one statement cell, see its own comment above): a templated document's real
	 *  variants (each a full arm SqlDocument, already in DOCUMENT coordinates, zero shift), or, for a
	 *  plain multi-statement document, each statement CELL (cell-relative scopes, shifted to document
	 *  coordinates by the cell's start, mirroring `buildAnalysis`'s per-cell shift). A single-cell,
	 *  non-templated document is the trivial one-arm case of the same shape (zero shift, this
	 *  document's own scopes/qualification). */
	private armsData(s: SchemaProvider): {
		scopeRoot: Scope;
		qualification: Qualification;
		dialect: Dialect;
		base: { line: number; col: number; offset: number };
	}[] {
		const ZERO = { line: 0, col: 0, offset: 0 };
		if (this.variants.length > 0) {
			return this.variants.map((v) => {
				const doc = v.doc();
				return {
					scopeRoot: doc.scopes.root,
					qualification: doc.analyze(s).qualification,
					dialect: doc.dialect,
					base: ZERO,
				};
			});
		}
		if (this.statements.length > 1) {
			return this.statements.map((cell, i) => {
				const p = this.lines.positionAt(cell.span.start);
				return {
					scopeRoot: cell.scopes.root,
					qualification: this.cellAnalysis(i, s).qualification,
					dialect: this.dialect,
					base: { line: p.line, col: p.column, offset: cell.span.start },
				};
			});
		}
		return [
			{
				scopeRoot: this.scopes.root,
				qualification: this.analyze(s).qualification,
				dialect: this.dialect,
				base: ZERO,
			},
		];
	}
}

/** Dedup `items` by a string key, keeping the FIRST occurrence of each key — arm/document order, so
 *  the "first live arm wins" representative-data rule falls out of plain array order. */
function dedupBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const item of items) {
		const key = keyOf(item);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out;
}

/** `unionSymbols` dedup key — the negotiated `start:end:kind:frame:name` (Stage-5 plan Global
 *  Constraints). NAME is load-bearing: schema-expanded star Syms share one zero-width span by
 *  design (symbols.ts's emitColumns), so span+kind+frame alone would collapse them into one. */
function symKey(s: Sym): string {
	return `${s.span.start}:${s.span.end}:${s.kind}:${s.frame}:${s.name}`;
}

/** `unionDiagnostics` dedup key. A SyntaxDiagnostic keys on `line:column:offset:length:message` —
 *  line:column are LOAD-BEARING, not redundant with offset: a LEXER error ("token recognition
 *  error") carries no offending symbol, so its `offset` is undefined (parse-diagnostics.ts), and an
 *  offset-keyed key alone would collapse two same-character lexer errors from different arms at
 *  different positions into one (the A6 message-only bug for that subclass). A qualify `Diagnostic`
 *  carries no separate "offending name" field — its `message` is wholly DERIVED from `kind` + the
 *  offending name (see qualify.ts's columnDiag/unknownTable: the only variable part of the message
 *  IS the name), so `kind + span fields + message` is the honest equivalent of "kind + span + name"
 *  without inventing a field the interface doesn't carry. The message-as-name-proxy is also safe
 *  ACROSS arms: realizations share one coordinate space and sibling arms occupy DISJOINT byte
 *  ranges, so two arms can only produce identical-span diagnostics from the SAME source bytes
 *  (shared text outside the arms, or one arm's own bytes reached by both variants of an unrelated
 *  region) — identical code at identical spans SHOULD dedup, and a same-span reference that
 *  resolves DIFFERENTLY per arm (unknown in one, ambiguous in the other) differs in kind+message
 *  and correctly keeps both entries. */
function diagKey(d: SyntaxDiagnostic | Diagnostic): string {
	if ("kind" in d) return `${d.kind}:${d.line}:${d.column}:${d.endLine}:${d.endColumn}:${d.message}`;
	return `${d.line}:${d.column}:${d.offset}:${d.length}:${d.message}`;
}

/** Every `CteRef` reachable from `scope` and its descendants. A WITH clause's CTEs live on the
 *  `Scope` that declares them (`Scope.ctes`); a nested WITH clause (in a subquery, a CTE's own
 *  body, a pipe stage) gets its own entries on its own scope, reached by recursing through
 *  `children` — mirrors symbols.ts's own scope walk, minus the frame-labeling this doesn't need. */
function collectCtes(scope: Scope, out: CteRef[] = []): CteRef[] {
	for (const cteRef of scope.ctes.values()) out.push(cteRef);
	for (const child of scope.children) collectCtes(child, out);
	return out;
}

/** One resolved output column of a scope — module-internal (the union views expose only
 *  `{name, span}`; `raw` never leaves this file). */
interface OutputColumn {
	/** Fold-normalized, quote-preserving identity form — `foldIdentifier(raw, dialect)` — the SAME
	 *  vocabulary the rest of the resolved surface speaks (scope/qualify/references). This is the
	 *  name the union views expose; computed exactly once, here, from `raw` below. */
	name: string;
	/** The projection's RAW name as the IR carries it (quoting delimiters intact where the dialect
	 *  keeps them — docs/identifier-delimiter-contract.md). The ONLY safe fold input for identity
	 *  comparison: displayName's contract forbids comparing display forms (src/ident/fold.ts). */
	raw: string;
	span: Span;
}

/** A scope's own projected output columns as {name, span} pairs — schema-fed where a star needs
 *  expansion (via `qualification.expandStarOf`, the same expansion `deriveSymbols` rides, so the
 *  two never disagree). A `select` body enumerates its projections; a `setop` body answers through
 *  `qualification.columnsOf` with spans from the declaring branch (see below); a `pipe` body answers
 *  through `pipeOutputColumns` (the derivable subset of pipe operators; see its own doc comment).
 *  An anonymous (unaliased, non-column) projection has no determinable name and is skipped, never
 *  fabricated; a star that qualify can't resolve (a schema gap) is skipped the same way. */
function scopeOutputColumns(scope: Scope, qualification: Qualification): OutputColumn[] {
	const body = scope.body;
	if (body.kind === "select") {
		const out: OutputColumn[] = [];
		for (const p of body.projections) {
			if (p.isStar) {
				const pairs = qualification.expandStarOf(scope, p);
				if (!pairs) continue; // unresolvable star — never fabricate a partial list
				// The star's OWN span — the `*` character itself, never the qualifier (`t.` in `t.*`)
				// or a modifier clause (Sym star-expansion wave rule, sqllens 9c87f55: a column that
				// exists only by expansion anchors on the star, never on synthesized/unrelated text).
				// Falls back to the whole projection's span in the (should-never-happen) case a star
				// projection's CST carries no literal `*` token — never fabricate, but never drop real
				// columns over an ideal-span miss either.
				const span = starSpanOf(p.expr.cst) ?? partSpanOf(p.cst);
				if (!span) continue;
				// Every star-expanded column shares the star projection's own span — there is no
				// per-column source token to point at. A deliberate divergence from deriveSymbols'
				// zero-width convention (that exists so expanded Syms are never cursor hit-test
				// targets; these pairs are name/position enumeration, where a real span is useful).
				for (const pair of pairs) out.push({ name: behaviorOf(scope).fold(pair.name), raw: pair.name, span });
			} else if (p.name !== undefined) {
				const span = partSpanOf(p.aliasCst ?? p.cst);
				if (span) out.push({ name: behaviorOf(scope).fold(p.name), raw: p.name, span });
			}
			// else: anonymous expression — no determinable name, skip
		}
		return out;
	}
	if (body.kind === "setop" && scope.branches) {
		// A set operation's output NAMES are its left branch's (positional), with BY NAME appending
		// the right branch's not-in-left columns — exactly what `columnsOf` already computes
		// (qualify.ts resolveColumns' setop case), so names route through it rather than being
		// re-derived here. Each name's representative SPAN comes from the branch that declares it
		// (left first — the same first-wins rule the arms use), recursing through nested setops.
		// BOTH sides of the name<->span match fold the RAW projection name (`OutputColumn.raw` —
		// delimiters intact, the same provenance `columnsOf`'s names carry): folding the DISPLAY
		// form instead would apply the unquoted fold rule to a stripped-quotes name and miss on
		// every asymmetric-fold dialect (snowflake `"MyCol"` folds preserved as raw but upper-cases
		// as display — displayName's own contract says never use it for comparison).
		const names = qualification.columnsOf(scope);
		if (names === "unknown") return [];
		const declared = new Map<string, OutputColumn>();
		for (const branch of [scope.branches.left, scope.branches.right]) {
			for (const col of scopeOutputColumns(branch, qualification)) {
				const key = behaviorOf(scope).fold(col.raw);
				if (!declared.has(key)) declared.set(key, col);
			}
		}
		const out: OutputColumn[] = [];
		for (const name of names) {
			const hit = declared.get(behaviorOf(scope).fold(name));
			if (hit) out.push(hit); // a name no branch declares a span for is skipped, never fabricated
		}
		return out;
	}
	if (body.kind === "pipe")
		return scope.pipe ? pipeOutputColumns(scope.pipe.stages, scope.pipe.input, qualification) : [];
	return [];
}

/** A PIPE-syntax scope's output columns: the STRUCTURALLY DERIVABLE subset of pipe operators only,
 *  verified against the GoogleSQL pipe-syntax reference
 *  (https://cloud.google.com/bigquery/docs/reference/standard-sql/pipe-syntax) and, for Databricks'
 *  identical Spark 4.0 `|>` syntax, https://spark.apache.org/docs/latest/sql-pipe-syntax.html.
 *  Walks the stage chain from the LAST stage backward:
 *   - a terminal `select` stage fully redefines the column set. Its stage scope's own body is a
 *     synthesized "select" (`stageBody` in scope.ts), so it re-enters the `select` branch above
 *     verbatim (star expansion included: `qualify()` populates `expandStarOf` for a pipe SELECT's
 *     star exactly as it does for a real one);
 *   - a terminal `aggregate` stage names the GROUP BY keys first, then the aggregate expressions:
 *     "The output columns from the AGGREGATE operator include all grouping columns first, followed
 *     by all aggregate columns" (the reference's own wording; Spark's pipe-syntax page says the same:
 *     "the evaluated grouping expressions followed by the evaluated aggregate functions"). See
 *     `pipeAggregateColumns`;
 *   - a terminal PASS-THROUGH stage (where/orderBy/limit/distinct/tablesample/assert/log/
 *     staticDescribe/with/set/setop/recursiveUnion, none of which change the column set, matching
 *     `stageOutputsFree`'s identical passthrough set, scope.ts's schema-free name-only twin of this
 *     function) defers to whatever precedes it;
 *   - falling through every stage reaches the pipe's own base `input`, whose output columns (a real
 *     SELECT's projections, or another pipe/setop) pass through unchanged.
 *  Every other terminal stage kind ABSTAINS (`[]`, never a guessed column list), because either the
 *  shape change has no simple per-column span to anchor on (`extend`/`window` ADD columns via their
 *  own projections but also keep the incoming ones, which carry no token at this stage; `drop`/
 *  `rename` transform the incoming NAME list, but a renamed column's real token is the OLD name, so
 *  showing it at the new name would misrepresent the span) or the new columns need a catalog this
 *  pass doesn't have (`join`/`call`/`pivot`/`unpivot`/`matchRecognize`) or the operator is
 *  terminal/branching/unmodelled (`describe`/`staticDescribe` narrows to a fixed schema, `if`/`fork`/
 *  `tee` branch into sub-pipelines, `export`/`create`/`insert`/`as`/`other`). */
function pipeOutputColumns(stages: readonly Scope[], input: Scope, qualification: Qualification): OutputColumn[] {
	return pipeStageChainColumns(stages, stages.length - 1, input, qualification);
}

function pipeStageChainColumns(
	stages: readonly Scope[],
	i: number,
	input: Scope,
	qualification: Qualification,
): OutputColumn[] {
	if (i < 0) return scopeOutputColumns(input, qualification); // no stage redefines the shape: the base's own outputs
	const stageScope = stages[i];
	const stage = stageScope.pipeStage;
	if (!stage) return [];
	switch (stage.op) {
		case "where":
		case "orderBy":
		case "limit":
		case "distinct":
		case "tablesample":
		case "assert":
		case "log":
		case "staticDescribe":
		case "with":
		case "set":
		case "setop":
		case "recursiveUnion":
			return pipeStageChainColumns(stages, i - 1, input, qualification); // unchanged column set
		case "select":
			return scopeOutputColumns(stageScope, qualification); // its body is a synthesized "select" (stageBody)
		case "aggregate":
			return pipeAggregateColumns(stage, stageScope);
		default:
			// extend/window/drop/rename/join/call/pivot/unpivot/matchRecognize/describe/if/fork/tee/
			// export/create/insert/as/other: see pipeOutputColumns' doc comment.
			return [];
	}
}

/** A pipe AGGREGATE stage's own output columns: the GROUP BY keys, then the aggregate expressions
 *  (see `pipeOutputColumns`' doc comment for the reference citation), the span-carrying twin of
 *  `aggregateOutputsFree` in scope.ts (the schema-free name-only version this must agree with).
 *  Abstains (`[]`, not a partial list) the moment any grouping key or aggregate has no determinable
 *  name/span, matching `aggregateOutputsFree`'s own all-or-nothing "unknown" rule. */
function pipeAggregateColumns(stage: Extract<PipeStage, { op: "aggregate" }>, stageScope: Scope): OutputColumn[] {
	const keys: OutputColumn[] = [];
	for (const g of stage.groupBy) {
		if (g.kind !== "column") return []; // a non-column grouping key has no determinable name
		const name = g.parts[g.parts.length - 1];
		const span = partSpanOf(g.cst);
		if (!span) return [];
		keys.push({ name: behaviorOf(stageScope).fold(name), raw: name, span });
	}
	const aggs: OutputColumn[] = [];
	for (const p of stage.aggregates) {
		if (p.isStar || p.name === undefined) return []; // an anonymous/star aggregate has no determinable name
		const span = partSpanOf(p.aliasCst ?? p.cst);
		if (!span) return [];
		aggs.push({ name: behaviorOf(stageScope).fold(p.name), raw: p.name, span });
	}
	return [...keys, ...aggs];
}

/** Shift a symbol's every span (its own span, its declaration target, its per-part spans, its
 *  alias's span) from cell-relative to document coordinates. `baseLine`/`baseCol` are the cell
 *  start's 0-based line/column; `baseOffset` its char offset (for the offset-based part spans).
 *  Does NOT fix up `.source` (an object reference to another Sym) — see `shiftSymsForCell`, which
 *  wraps this per-Sym shift with the array-wide reference remap that a single Sym can't do alone. */
function shiftSym(sym: Sym, baseLine: number, baseCol: number, baseOffset: number): Sym {
	return {
		...sym,
		span: shiftSpan(sym.span, baseLine, baseCol, baseOffset),
		definition: sym.definition ? shiftSpan(sym.definition, baseLine, baseCol, baseOffset) : undefined,
		partSpans: sym.partSpans
			? sym.partSpans.map((p) => shiftPartSpan(p, baseLine, baseCol, baseOffset))
			: undefined,
		alias: sym.alias
			? { name: sym.alias.name, span: shiftSpan(sym.alias.span, baseLine, baseCol, baseOffset) }
			: undefined,
	};
}

/** Shift every Sym of ONE cell's `deriveSymbols()` output to document coordinates, preserving
 *  `Sym.source` object-identity links across the shift. `walk()`/`emitColumns()` only ever point a
 *  column Sym's `source` at a relation Sym built by the SAME `deriveSymbols()` call: the
 *  `sourceSyms` map that backs it is created fresh per call and a correlated reference resolves by
 *  walking `scope.parent`, which never leaves the ScopeTree of the statement cell that produced it
 *  (each cell is parsed and scoped independently — see the file header). So `.source` never needs
 *  to cross a cell boundary, and the remap below only has to cover this one cell's array.
 *
 *  Mapping `shiftSym` alone over the array (as before this fix) left `.source` pointing at the
 *  STALE cell-relative Sym from `cellSyms` — `shiftSym`'s `{...sym}` spread copies the reference
 *  as-is, and `.map()` allocates a NEW object per entry, so the old reference is never retargeted
 *  at the new one. This two-pass version shifts every Sym first, then re-points each shifted Sym's
 *  `source` at its shifted twin via an identity-keyed remap (old cell-relative Sym -> new
 *  doc-relative Sym). Sym objects are plain, unfrozen data (only the SqlDocument instance itself is
 *  frozen), so mutating `.source` in place on the freshly built copies is safe. */
function shiftSymsForCell(cellSyms: readonly Sym[], baseLine: number, baseCol: number, baseOffset: number): Sym[] {
	const shifted = cellSyms.map((sym) => shiftSym(sym, baseLine, baseCol, baseOffset));
	const remap = new Map<Sym, Sym>();
	cellSyms.forEach((sym, i) => remap.set(sym, shifted[i]));
	for (const sym of shifted) if (sym.source) sym.source = remap.get(sym.source) ?? sym.source;
	return shifted;
}

/** Link every still-unlinked "variable" reference Sym in `syms` (`definition` undefined, meaning
 *  this cell's own per-cell symbols pass found no same-statement DECLARE, see symbols.ts) to the
 *  CURRENT per-name last-declaration entry, if any: the cross-CELL half of variable linking (see
 *  `buildAnalysis`'s per-cell loop). Mutates `syms` in place: safe because it is the array
 *  `shiftSymsForCell` just freshly allocated for THIS document's own analyze() result, never the
 *  cell-relative array cached on the CachedCell (see that function's own doc comment on why
 *  mutating a freshly-shifted Sym is safe). */
function linkVariableReferences(
	syms: Sym[],
	lastDecl: ReadonlyMap<string, { nameSpan: PartSpan; typeText?: string }>,
	dialect: Dialect,
): void {
	for (const sym of syms) {
		if (sym.kind !== "variable" || !sym.modifiers.includes("reference") || sym.definition !== undefined) continue;
		const hit = lastDecl.get(sym.name);
		if (!hit) continue;
		sym.definition = hit.nameSpan;
		sym.type = hit.typeText ? parsedDeclType(hit.typeText, dialect) : undefined;
	}
}

/** A declaration's `typeText` parsed through the dialect's own type parser (the same path a CAST's
 *  `typeText` uses): undefined when there's no text or it doesn't parse to anything determinate,
 *  never guessed. */
function parsedDeclType(typeText: string, dialect: Dialect): Type | undefined {
	const t = resolveBehavior(dialect).parseType(typeText);
	return t.kind === "unknown" ? undefined : t;
}

/** Whether `cell`'s own text ends in a T-SQL GO batch separator: its LAST channel-0 token is
 *  (case-insensitively) "GO". A cell's text always includes its own trailing separator verbatim
 *  (`StatementCellSpan`'s doc comment: "includes the trailing separator"), and only a genuine
 *  alone-on-its-line GO or a `;` ever ends a non-final cell (split.ts's `findSplitEnds`), so this
 *  can't false-positive on an identifier merely named "go" mid-statement (the one, harmless,
 *  exception is the FINAL cell of a document legitimately ending in a bare `go` reference with no
 *  separator at all, where there is nothing left after it to reset anyway). */
function cellEndsAtGo(cell: StatementCell): boolean {
	const channel0 = cell.tokens.filter((t) => t.channel === 0);
	const last = channel0.at(-1);
	return last !== undefined && last.text.toUpperCase() === "GO";
}

/** One arm-containment hit: the region owning the matched arm, and that arm's index within it. */
interface ArmHit {
	region: TemplatedParseResult["regions"][number];
	armIndex: number;
}

/** Walk `regions` to the DEEPEST arm whose `bodySpan` [start, end) contains `offset` — recursing
 *  into a containing arm's nested children before settling for that arm itself, so an offset in a
 *  nested region attributes to the innermost enclosing arm (not an outer ancestor). undefined when
 *  `offset` falls outside every region (including a negative/out-of-range offset). Does NOT
 *  re-derive from tags — walks the region tree `templateRegions` already built. */
function deepestArmAt(regions: TemplatedParseResult["regions"], offset: number): ArmHit | undefined {
	for (const region of regions) {
		for (let i = 0; i < region.arms.length; i++) {
			const arm = region.arms[i];
			if (offset >= arm.bodySpan.start && offset < arm.bodySpan.end) {
				return deepestArmAt(arm.children, offset) ?? { region, armIndex: i };
			}
		}
	}
	return undefined;
}

/** Build the whole-document compound facade for a multi-cell document — today's compound-flagged
 *  IR/scopes shape, without a whole-doc re-parse. The CST is the FIRST CELL'S only — a compatibility
 *  placeholder, NOT a real multiStatement CST (which would hold every statement); consumers wanting
 *  real spans use `statements`/`cellAt`. The facade body is empty, so nodeAt over it finds nothing. */
function compoundFacade(
	cells: readonly StatementCell[],
	dialect: Dialect,
): {
	ast: QueryExpr;
	cst: ParserRuleContext;
	scopes: ScopeTree;
} {
	const cst = cells[0].cst;
	const body: SelectExpr = {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: ["multi-statement"],
		cst,
	};
	const ast: QueryExpr = { kind: "query", statement: "compound", dialect, ctes: [], body, cst };
	freezeIR(ast);
	return { ast, cst, scopes: toScopes(ast, { dialect }) };
}
