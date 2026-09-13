// ---------------------------------------------------------------------------
// The engine-neutral templating contract. `template*` names the CONCEPT the
// core understands (holes with externally-supplied meaning); an ENGINE is the
// concrete front end that produces them (src/minijinja/ ships the only one).
// The engine owns the whole strategy — segmentation, fills, control flow —
// and calls the core `parse()` as a primitive; the core never imports an
// engine at runtime (engines arrive by injection). The tag/region/symbol
// types below are type-only imports from the minijinja module: erased at
// runtime, they define the result shape until the tag taxonomy is
// de-dbt'd into this layer (a later, anvil-coordinated wave).
// ---------------------------------------------------------------------------
import type { Dialect } from "../dialect.js";
import type { PartSpan } from "../ir/part-span.js";
import type { ParseResultIR } from "../api.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import type { Token } from "../token/token.js";
import type { ExpansionShape, TemplateProvider } from "../qualify/template-provider.js";
import type { TagNode } from "../minijinja/tag-ast.js";
import type { TemplateRegion, TemplateSymbol } from "../minijinja/regions.js";
import type { TemplateVariant } from "../minijinja/variants.js";
// Re-exported type-only so a consumer (src/document/document.ts) can reference TemplateVariant
// without importing ../minijinja directly (the layering gate: document.ts imports no minijinja
// module at all — only this neutral contract). Same type-only exception the file header documents.
export type { TemplateVariant } from "../minijinja/variants.js";

/** Options for a templated parse: the knowledge seam. The provider is a
 *  semantic-layer citizen (per-document lifecycle, prime()/version) — the
 *  engine only CONSULTS it at parse time, it never owns it. */
export interface TemplatedParseOptions {
	provider?: TemplateProvider;
}

/**
 * What a `{% macro %}` definition's body can stand in for at a call site, read from the
 * definition text alone (no project, no rendering): the body's fragment verdict mapped onto the
 * provider's shape vocabulary, plus what its control flow adds. A host answers `shapeOf(call)`
 * for a call by looking the macro up by name and returning `shapes` as they are.
 */
export interface MacroShape {
	/** The declared macro name (`{% macro name(...) %}`). */
	name: string;
	nameSpan: PartSpan;
	/** The whole block, opening tag through `{% endmacro %}`. */
	span: PartSpan;
	/**
	 * Every shape the body can take, most specific first; empty when nothing can be established
	 * (never-wrong). `expression` → `expr`, `cteList` → `cte-definition`, `selectList` →
	 * `column-list`, `tableSource` → `relation`, `statement` → `statement`; a body led by a hole
	 * whose jinja `default('where')` / `default('and')` is visible → `where-clause` / `conjunct`;
	 * a body whose SQL all sits under an `if` with no `else` adds `nothing` last.
	 */
	shapes: ExpansionShape[];
	/**
	 * Present when the body OPENS with a hole bound to one of the macro's own parameters
	 * (`{{ stat|default('where') }} {{ col }} = 0`): the clause keyword the body starts with is
	 * whatever the caller passes for that parameter (or `default` when the caller passes
	 * nothing). `shapesForCall` resolves it per call; `shapes` above carries only the default's
	 * shape (or nothing when there is no default).
	 */
	keywordParam?: { name: string; index: number; default?: string };
}

/** The unified result of parsing raw jinja-SQL: one token stream + the SQL parse + tags. */
export interface TemplatedParseResult {
	/** ONE source-ordered stream: SQL tokens (channel 0) + jinja tokens (channel 2, role "minijinja"). */
	tokens: Token[];
	/** The underlying SQL parse over the placeholder (ast / cst / errors / diagnostics). */
	sql: ParseResultIR;
	/** R2 tag nodes. Task 4 fills these; Task 3 leaves them empty. */
	tags: TagNode[];
	/** R4 control-flow regions (if/for/macro), stack-paired from the control tags. */
	regions: TemplateRegion[];
	/** R4 go-to-def template symbols (set targets / macro names). */
	symbols: TemplateSymbol[];
	/** Every `{% macro %}` definition in the text with the shapes its body can take (see
	 *  `MacroShape`). Empty when the text defines no macro. */
	macros: MacroShape[];
	/** SQL diagnostics (+ jinja diagnostics from Task 4), positioned in original coordinates. */
	diagnostics: SyntaxDiagnostic[];
	/**
	 * The placeholder-filled SQL text the SQL parser actually saw: `text` with every jinja
	 * tag replaced by its length-/newline-preserving fill (identical length, newlines at
	 * identical offsets, everything outside tags byte-identical). On the defensive
	 * degrade-to-plain-SQL path this IS the original text.
	 */
	placeholder: string;
	/**
	 * Present (true) ONLY on the defensive degrade path: the jinja front end threw and the
	 * result is the whole text parsed as plain SQL — `tags`/`regions`/`symbols` are empty
	 * NOT because the text has no jinja, but because jinja handling gave up. Absent on
	 * every normal parse (including plain SQL with no jinja).
	 */
	degraded?: true;
	/** The TagNode a template-marked IR node came from (TableSource with .template, or a
	 *  marked column expr). undefined for unmarked nodes and on plain SQL. */
	tagOf(node: object): TagNode | undefined;
	/** The IR node a tag became (a ref/source in a FROM slot → its TableSource; a scalar-slot
	 *  tag → its column expr). undefined for tags with no IR presence (control/comment/config). */
	nodeOf(tag: TagNode): object | undefined;
	/** The diagnostics attributed to a tag: its own jinja parse errors + SQL diagnostics the
	 *  scrubber widened to it. Empty array when none. */
	diagnosticsOf(tag: TagNode): SyntaxDiagnostic[];
}

/** One statement CELL of a templated document (`TemplateEngine.parseCell`): the plain per-dialect
 *  parse of the cell's placeholder slice, in CELL-relative coordinates like a plain document's
 *  cells, with the whole-document tags correlated onto it (provider-resolved source names,
 *  `template` markers, and the two-spine join). */
export interface TemplatedCellResult {
	/** The cell's SQL parse over its placeholder slice (ast / cst / tokens / errors / diagnostics),
	 *  every span cell-relative. A `template` marker's span is cell-relative too. */
	sql: ParseResultIR;
	/** The whole document's TagNode a template-marked node of THIS cell's IR came from. */
	tagOf(node: object): TagNode | undefined;
	/** The node of THIS cell's IR a whole-document tag became; undefined when the tag sits in
	 *  another cell or has no IR presence. */
	nodeOf(tag: TagNode): object | undefined;
}

/** A template engine: the syntax front end for one templating language over
 *  SQL. `parse` must satisfy the engine contract the conformance suite
 *  checks — tokens tile the source byte-for-byte, every span in original
 *  document coordinates, total on broken input (degrade, never throw), and
 *  tag-free text yields the plain parse plus empty facets. */
export interface TemplateEngine {
	/** Engine name — surfaces as the channel-2 TokenRole and in diagnostics attribution. */
	readonly name: string;
	parse(text: string, dialect: Dialect, opts?: TemplatedParseOptions): TemplatedParseResult;
	/** Optional: coherent per-branch variant enumeration, for engines with control-flow arms. */
	variants?(text: string, dialect: Dialect): TemplateVariant[];
	/** Optional: the products of ONE statement cell of a templated document — the plain parse of
	 *  `whole.placeholder`'s slice `[span.start, span.end)` (cell-relative) with `whole`'s tags
	 *  correlated onto it. `whole` is this engine's own `parse` result for the full `text`, `span`
	 *  a `splitStatements` span over that placeholder. An engine without it keeps the templated
	 *  `SqlDocument` door at one whole-text cell. */
	parseCell?(
		whole: TemplatedParseResult,
		span: { start: number; end: number },
		text: string,
		dialect: Dialect,
		opts?: TemplatedParseOptions,
	): TemplatedCellResult;
}
