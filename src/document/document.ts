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
import { parse, qualify, deriveSymbols, toScopes, TypeInfo, type Dialect } from "../api.js";
import type { QueryExpr, SelectExpr } from "../ir/ir.js";
import { freezeIR } from "../ir/freeze.js";
import type { StatementCategory } from "../ir/statement.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import type { ScopeTree } from "../scope/scope.js";
import type { Qualification, Diagnostic } from "../qualify/qualify.js";
import { Schema } from "../qualify/schema.js";
import type { Sym } from "../symbols/symbols.js";
import type { Token } from "../token/token.js";
import { LineIndex } from "./line-index.js";
import { nodeAt, type NodeHit } from "./node-at.js";
import { splitStatements, type StatementCellSpan } from "./split.js";
import { shiftDiagnostics, shiftTokens } from "./shift.js";

// A single stable empty schema, used as the analyze() default when no catalog is
// configured. Sharing ONE instance keeps the schema-keyed analyze() memo working
// for schema-free calls (cache key = schema ?? EMPTY_SCHEMA), instead of a fresh
// Schema per call that would defeat the cache.
const EMPTY_SCHEMA = new Schema({});

/** How many parsed cells to retain in the cross-edit cache. Bounds memory for a huge script while
 *  keeping the working set of statements around an edit resident. LRU-evicted past this. */
const CELL_CACHE_MAX = 256;

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

	/** Schema-keyed memo of analyze(). The Map reference is frozen with the instance,
	 *  but its contents stay mutable, so memoization works on a frozen SqlDocument. */
	private readonly _analysisCache = new Map<Schema, DocumentAnalysis>();
	/** The content-addressed cross-edit cell cache, carried to withText() children. Its contents stay
	 *  mutable (a memo) even though the reference is frozen with the instance. */
	private readonly _cellCache: CellCache;

	private constructor(
		text: string,
		dialect: Dialect,
		opts: { uri?: string; version?: number },
		cellCache: CellCache,
	) {
		this.uri = opts.uri;
		this.version = opts.version ?? 0;
		this.text = text;
		this.dialect = dialect;
		this.lines = new LineIndex(text);
		this._cellCache = cellCache;

		// Split into per-statement cells and parse each independently, reusing unchanged cells from
		// the (carried) content-addressed cache. Each cell re-enters the dialect's batch entry rule
		// as a batch of one — the proven single-statement path — so no lower() changes are needed.
		const spans = splitStatements(text, dialect);
		const handedOut = new Set<CachedCell>(); // per-BUILD: which cache entries this doc already uses
		const cells: StatementCell[] = spans.map((span) => this.buildCell(span, handedOut));
		this.statements = Object.freeze(cells);

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
	private buildCell(span: StatementCellSpan, handedOut: Set<CachedCell>): StatementCell {
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
		return Object.freeze({
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
	}

	/** Build a document for `text` in `dialect`. Total: never throws, even on broken / mid-edit input.
	 *  Starts a FRESH cell cache — cross-edit reuse comes from withText(), not create(). */
	static create(text: string, dialect: Dialect, opts: { uri?: string; version?: number } = {}): SqlDocument {
		return new SqlDocument(text, dialect, opts, new CellCache());
	}

	/** An edit: a NEW SqlDocument for the new text. This instance is untouched (immutable). The cell
	 *  cache is CARRIED forward, so statements whose text didn't change reuse their parsed cells. */
	withText(text: string, version: number): SqlDocument {
		return new SqlDocument(text, this.dialect, { uri: this.uri, version }, this._cellCache);
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
