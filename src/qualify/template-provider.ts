// ---------------------------------------------------------------------------
// TemplateProvider — the ONE resolution seam for every template expression
// (the catalog-unification redesign, agreed with anvil on the channel
// 2026-07-05; replaces template-catalog.ts's per-kind methods).
//
// The model: every jinja call/expression embedded in SQL is a hole with a
// semantic identity. The engine asks ONE question about it — `expansion(call)`
// — and the answer says whatever is known: the relation it produces, the value
// type it yields, the columns it emits, the collection it iterates, and/or the
// syntactic shape of its rendered text. Every field is optional; `undefined`
// anywhere degrades to the never-wrong floor (parse always works, meaning is
// unknown).
//
// DefaultTemplateProvider is a SHIPPED, CONCRETE default implementation
// designed for inheritance (the C# base-class pattern): fully functional with
// zero consumer input — it IS the zero-consumer strategy, in one readable,
// unit-testable place — and composed of small overridable methods so a consumer
// overrides only the parts it knows (manifest lookups, var values, shape
// classification) and inherits the conservative default for the rest.
//
// The DBT-BUILTIN knowledge (config/docs/print/log/return/exceptions produce
// nothing; ref/source produce a relation logically named by their literal args;
// env_var produces a string) is NOT minijinja knowledge and does NOT live in the
// neutral default: it lives in `DbtTemplateProvider` (below), the shipped dbt
// overlay a consumer extends. The neutral `DefaultTemplateProvider` knows no
// macro vocabulary at all. Domain knowledge lives in the provider; the ENGINE
// keeps only the positional machinery (length-/newline-preserving fills, slot
// guards, statement-slot handling) — non-overridable on purpose: a provider
// states WHAT a call produces, never how it is spliced, so a buggy provider can
// make meanings unknown but can never corrupt a parse.
//
// Contract points (agreed on the channel):
//   - SYNC-ONLY: every method answers from a warm cache; misses are recorded
//     and an async `prime()` warms them (the CallbackSchema pattern) — the
//     engine never awaits a provider.
//   - PER-DOCUMENT instances: a provider may close over the document identity
//     and its dialect (there is no dialect parameter on expansion()).
//   - Two type vocabularies, one per field: `value.type` is the NEUTRAL closed
//     union below; `ResolvedRelation.columns[].type` stays DIALECT-NATIVE
//     warehouse type text (parsed by the engine's per-dialect parseType).
// ---------------------------------------------------------------------------

import type { TemplateCall } from "../ir/ir.js";
import type { Column } from "./schema.js";
import type { SchemaProvider } from "./schema-provider.js";

export type { TemplateCall } from "../ir/ir.js";

/**
 * The syntactic SLOT a call's rendered output occupies — the parse-time answer
 * the placeholder mechanism needs:
 *   - `nothing`    — no output at all (config/docs/…): whitespace fill.
 *   - `statement`  — a whole statement / query body (also fits a `(…)` CTE/subquery body).
 *   - `relation`   — a relation in FROM (rendered as a query body — same `SELECT 1` fill as `statement`).
 *   - `predicate`  — a boolean expression (a WHERE/ON/HAVING slot).
 *   - `column-list`— one or more select items (the slot parses; the real column COUNT differs).
 *   - `conjunct`   — a TRAILING boolean conjunct (`and c = false`) appended to a complete ON/WHERE
 *                    expression (the dbt `is_deleted_filter`-family macro shape) — fills `AND 1=1`.
 *   - `where-clause` — a LEADING WHERE clause (`where c = false`) after a complete FROM/JOIN
 *                    context (the mode-as-argument macro family: `{{ m('col','where') }}` — the
 *                    2026-07-06 gold__vendor F5 finding) — fills `WHERE 1=1`.
 *   - `cte-definition` — one or more complete WITH-clause CTE definitions + trailing comma
 *                    (a macro whose whole body is `name as (...),`  — the anvil real-model
 *                    finding, 2026-07-07): admitted ONLY immediately after a `,` that follows a
 *                    completed prior CTE clause; fills a PER-TAG-UNIQUE synthetic `name as (...)`
 *                    (the fill introduces a name into the WITH list's namespace, so — unlike
 *                    every other shape's fixed fragment — it can't repeat verbatim across tags).
 *   - `expr`       — a scalar expression (the identifier fill — the zero-knowledge default).
 */
export type ExpansionShape =
	| "expr"
	| "column-list"
	| "predicate"
	| "relation"
	| "statement"
	| "conjunct"
	| "where-clause"
	| "cte-definition"
	| "nothing";

/** The NEUTRAL value-type vocabulary for `ResolvedExpansion.value` (the engine maps each to its
 *  per-dialect scalar type). Deliberately closed and small — a stringly-typed field with no
 *  vocabulary drifts. */
export type ValueType = "string" | "integer" | "float" | "boolean";

/** The resolved physical relation a relation-producing call maps to (payload unchanged from the
 *  pre-unification `relation()`). `columns` text is DIALECT-NATIVE warehouse type strings. */
export interface ResolvedRelation {
	/** The resolved relation name parts. The DEFAULT provider answers the dbt-LOGICAL name
	 *  (`["orders"]`); an overriding provider answers the PHYSICAL one (`["analytics","orders"]`). */
	nameParts: string[];
	/** The relation's columns, or undefined until an async describe lands (async warm). */
	columns?: Column[];
}

/** A completion candidate a host offers for a template call slot (a dbt model for a ref's arg 0, a
 *  source name for a source's arg 0). `label` is what the editor inserts at the caret; `detail` is
 *  optional display text (a schema, a path). The neutral provider offers none. See
 *  `TemplateProvider.templateCandidates`. */
export interface TemplateCandidate {
	label: string;
	detail?: string;
}

/** Everything known about one call's expansion. Every field optional; `undefined` = unknown. */
export interface ResolvedExpansion {
	/** Parse-time shape. When absent, derived from the strongest present field:
	 *  relation → "relation", columns → "column-list", value → "expr" (an explicit shape always wins). */
	shape?: ExpansionShape;
	/** A relation-producing call (ref, source, a TVF-like macro). */
	relation?: ResolvedRelation;
	/** A scalar value — `{{ var('x') }}`, `{{ env_var('Y') }}`, a scalar macro. */
	value?: { type: ValueType };
	/** A column-list-producing macro's output columns (dialect-native type text, like relation columns). */
	columns?: Column[];
	/** A loop collection's items. The engine binds the FIRST item as the loop variable's
	 *  representative value; it NEVER unrolls (coordinate preservation is absolute). */
	collection?: string[];
}

/** dbt builtins that render no output — knowledge of the DEFAULT provider (was a hardcoded set inside
 *  the segmenter). Exported for the tag-AST's syntactic kind labels, which share the same list. */
export const NO_OUTPUT_BUILTINS: ReadonlySet<string> = new Set([
	"config",
	"docs",
	"print",
	"log",
	"return",
	"exceptions",
]);

/** Miss-identity key for a call — package + name + args + kwargs, so two spellings of the same
 *  call coalesce and different args stay distinct. */
function callKey(call: TemplateCall): string {
	const pkg = call.packageParts?.join(".") ?? "";
	const args = call.args.map((a) => (a === null ? "\u0000" : a)).join("\u0001");
	const kwargs = (call.kwargs ?? []).map((k) => `${k.name}=${k.value ?? "\u0000"}`).join("\u0001");
	return `${pkg}|${call.name}|${args}|${kwargs}`;
}

/** The last positional-or-kwarg value for a builtin arg slot: dbt's `ref` takes the model as the
 *  LAST positional (`ref('pkg','model')`) or the `model=` kwarg. `null` (computed) stays null. */
function refModel(call: TemplateCall): string | null | undefined {
	const kw = call.kwargs?.find((k) => k.name === "model");
	if (kw) return kw.value;
	if (call.args.length === 1 || call.args.length === 2) return call.args[call.args.length - 1];
	return undefined;
}

function sourceParts(call: TemplateCall): (string | null)[] | undefined {
	const kwSrc = call.kwargs?.find((k) => k.name === "source_name");
	const kwTbl = call.kwargs?.find((k) => k.name === "table_name");
	if (kwSrc && kwTbl) return [kwSrc.value, kwTbl.value];
	if (call.args.length === 2) return [call.args[0], call.args[1]];
	return undefined;
}

/**
 * The shipped default provider — concrete, fully functional with zero input,
 * designed for inheritance. Override the granular methods (`relationOf`,
 * `valueOf`, `shapeOf`, `columnsOf`, `collectionOf`, and the SchemaProvider
 * methods `columnsFor`/`tables`) with what your host knows; call
 * `recordMiss(call)` (or `recordTableMiss(parts)`) from an override when a
 * lookup is cold, and implement `fetchExpansions`/`fetchTables` so `prime()`
 * can warm them. Everything you don't override keeps the conservative default.
 *
 * Instances may be PER-DOCUMENT and close over document identity + dialect.
 */
export class DefaultTemplateProvider implements SchemaProvider {
	// --- SchemaProvider (physical tables): conservative defaults, override in subclasses. ---

	/** OPEN world by default: a `columnsFor` miss means "unknown — do not diagnose", which makes a
	 *  bare instance the safe always-present default. A subclass whose cache is authoritative-and-
	 *  self-healing (describe + prime/re-publish) may override to `"closed"` to get unknown-table. */
	readonly world: "closed" | "open" = "open";

	/** Columns of a physical table. Default: unknown. Override with your warm describe cache and
	 *  call `recordTableMiss(foldedParts)` on a cold lookup. */
	columnsFor(_parts: string[], _dialect?: string): Column[] | undefined {
		return undefined;
	}

	/** Bare table-name candidates for completion. Default: none. */
	tables(_dialect?: string): string[] {
		return [];
	}

	/** Monotonic invalidation signal — bumps when `prime()` warmed anything new. */
	get version(): number {
		return this._version;
	}

	// --- Granular expansion knowledge (the C#-style virtuals — override the parts you know). ---

	/** The relation a call produces. The NEUTRAL floor knows no macro vocabulary, so it answers
	 *  undefined for everything: `ref`/`source` are dbt macros, not minijinja knowledge, and live in
	 *  `DbtTemplateProvider`. An overriding provider answers the relation (+columns) it knows. */
	relationOf(_call: TemplateCall): ResolvedRelation | undefined {
		return undefined;
	}

	/** The scalar value a call yields. Neutral floor: unknown (no macro vocabulary). `env_var` is a
	 *  dbt builtin known by `DbtTemplateProvider`. */
	valueOf(_call: TemplateCall): { type: ValueType } | undefined {
		return undefined;
	}

	/** The rendered-output shape of a call. Neutral floor: unknown (the engine derives a shape from
	 *  stronger fields, or falls back to its positional fill). The dbt no-output builtins → "nothing"
	 *  is `DbtTemplateProvider` knowledge. */
	shapeOf(_call: TemplateCall): ExpansionShape | undefined {
		return undefined;
	}

	/** The columns a column-list-producing macro emits. Default: unknown. */
	columnsOf(_call: TemplateCall): Column[] | undefined {
		return undefined;
	}

	/** The items a loop collection holds. Default: unknown (loops analyze one representative pass). */
	collectionOf(_call: TemplateCall): string[] | undefined {
		return undefined;
	}

	/** Completion candidates for a template call slot: the caret sits in `callee`'s positional argument
	 *  `argIndex` (a dbt ref's arg 0 answers the model names, a source's arg 0 the source names, arg 1
	 *  the table names). `argIndex` is -1 when the caret is still in the callee name itself, so a host
	 *  can answer the macro/callee names it knows. `packageName` is the dotted package (`dbt_utils` in
	 *  `dbt_utils.star(...)`). The NEUTRAL provider knows no vocabulary and offers none; a host answers
	 *  from its catalog. `completeAt` reads this when the caret is inside a jinja tag. The WHOLE
	 *  parsed call comes along (issue #37) — a slot's candidates can depend on the sibling args:
	 *  `source('raw', '|')`'s candidates are the tables OF the source named in `call.args[0]`.
	 *  `argIndex` is the positional arg the caret is in (`-1` = the callee-name slot). */
	templateCandidates(_call: TemplateCall, _argIndex: number): TemplateCandidate[] {
		return [];
	}

	// --- The composed entry the ENGINE consults (rarely overridden wholesale). ---

	/**
	 * Everything known about `call`, composed from the granular methods. Field precedence for the
	 * shape (channel-agreed): an EXPLICIT `shapeOf` answer always wins; absent, derived
	 * strongest-first — relation → "relation", columns → "column-list", value → "expr". Returns
	 * undefined when nothing at all is known (the engine's zero-knowledge floor).
	 */
	expansion(call: TemplateCall): ResolvedExpansion | undefined {
		const shape = this.shapeOf(call);
		const relation = this.relationOf(call);
		const value = this.valueOf(call);
		const columns = this.columnsOf(call);
		const collection = this.collectionOf(call);
		const derived: ExpansionShape | undefined =
			shape ?? (relation ? "relation" : columns ? "column-list" : value ? "expr" : undefined);
		if (derived === undefined && !relation && !value && !columns && !collection) return undefined;
		return {
			...(derived !== undefined ? { shape: derived } : {}),
			...(relation ? { relation } : {}),
			...(value ? { value } : {}),
			...(columns ? { columns } : {}),
			...(collection ? { collection } : {}),
		};
	}

	// --- Lazy machinery: miss recording + one coalesced prime() (the CallbackSchema pattern). ---

	private _version = 0;
	private readonly _misses: TemplateCall[] = [];
	private readonly missSeen = new Set<string>();
	private readonly _tableMisses: string[][] = [];
	private readonly tableMissSeen = new Set<string>();
	private inFlight: Promise<boolean> | null = null;

	/** The recorded misses — table misses first (as folded parts), then call misses (as their
	 *  key parts: [package…, name]). Distinct, first-seen order. Drained by prime(). */
	get misses(): ReadonlyArray<string[]> {
		return [...this._tableMisses, ...this._misses.map((c) => [...(c.packageParts ?? []), c.name])];
	}

	/** Record a cold `expansion` lookup (call from an overriding granular method). */
	protected recordMiss(call: TemplateCall): void {
		const key = callKey(call);
		if (this.missSeen.has(key)) return;
		this.missSeen.add(key);
		this._misses.push({ ...call, args: [...call.args], ...(call.kwargs ? { kwargs: [...call.kwargs] } : {}) });
	}

	/** Record a cold `columnsFor` lookup. Fold parts first (`foldIdentifier(p, dialect, "table")`)
	 *  so the miss key matches your cache key. */
	protected recordTableMiss(foldedParts: string[]): void {
		const key = foldedParts.join(".");
		if (this.tableMissSeen.has(key)) return;
		this.tableMissSeen.add(key);
		this._tableMisses.push([...foldedParts]);
	}

	/** Async warm-up for missed calls — populate the cache your granular overrides read. Default
	 *  no-op (nothing ever warms). */
	protected fetchExpansions(_missing: TemplateCall[]): Promise<void> {
		return Promise.resolve();
	}

	/** Async warm-up for missed tables — populate the cache your `columnsFor` override reads. */
	protected fetchTables(_missing: string[][]): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Drain both recorded miss lists through the fetch hooks, RE-PROBE each miss (calls through
	 * `expansion()`, tables through `columnsFor()`), drop the ones that now resolve, and bump
	 * `version` once when anything new arrived. Resolves true when it did (re-analyze). A second
	 * prime() while one is in flight returns the SAME promise (coalescing); a miss recorded DURING
	 * the in-flight fetch is re-recorded by the next analyze and warms one prime later —
	 * never-wrong holds throughout.
	 */
	prime(): Promise<boolean> {
		if (this.inFlight) return this.inFlight;
		if (this._misses.length === 0 && this._tableMisses.length === 0) return Promise.resolve(false);
		const run = this.drain().finally(() => {
			this.inFlight = null;
		});
		this.inFlight = run;
		return run;
	}

	private async drain(): Promise<boolean> {
		const pendingCalls = this._misses.splice(0);
		this.missSeen.clear();
		const pendingTables = this._tableMisses.splice(0);
		this.tableMissSeen.clear();

		const fetches: Promise<void>[] = [];
		if (pendingCalls.length > 0) fetches.push(this.fetchExpansions(pendingCalls));
		if (pendingTables.length > 0) fetches.push(this.fetchTables(pendingTables));
		await Promise.all(fetches);

		let anyNew = false;
		for (const call of pendingCalls) {
			// Re-probe through expansion(); a still-cold call re-records itself via the
			// override's recordMiss and stays on the list for the next prime.
			if (this.expansion(call) !== undefined) anyNew = true;
		}
		for (const parts of pendingTables) {
			if (this.columnsFor(parts) !== undefined) anyNew = true;
		}
		if (anyNew) this._version++;
		return anyNew;
	}
}

/**
 * The shipped dbt overlay: a `DefaultTemplateProvider` that knows dbt's built-in macros and nothing
 * more. `ref(...)` resolves to the dbt-LOGICAL model name, `source(a,b)` to the logical
 * [source, table], `env_var` to a string, and the no-output builtins
 * (config/docs/print/log/return/exceptions) render nothing. Static famous-macro knowledge ONLY: no
 * manifest, no warehouse, no project config, no runtime. A dbt consumer with runtime knowledge
 * extends THIS (not the neutral `DefaultTemplateProvider`) and overrides the granular methods with
 * what its manifest / describe cache resolve to. This class is where the dbt vocabulary lives so the
 * neutral core and default do not carry it.
 */
export class DbtTemplateProvider extends DefaultTemplateProvider {
	override relationOf(call: TemplateCall): ResolvedRelation | undefined {
		if (call.packageParts !== undefined) return undefined;
		if (call.name === "ref") {
			const model = refModel(call);
			return typeof model === "string" ? { nameParts: [model] } : undefined;
		}
		if (call.name === "source") {
			const parts = sourceParts(call);
			if (parts && typeof parts[0] === "string" && typeof parts[1] === "string") {
				return { nameParts: [parts[0], parts[1]] };
			}
		}
		return undefined;
	}

	override valueOf(call: TemplateCall): { type: ValueType } | undefined {
		if (call.packageParts === undefined && call.name === "env_var") return { type: "string" };
		return undefined;
	}

	override shapeOf(call: TemplateCall): ExpansionShape | undefined {
		if (call.packageParts === undefined && NO_OUTPUT_BUILTINS.has(call.name)) return "nothing";
		if (call.packageParts !== undefined && NO_OUTPUT_BUILTINS.has(call.packageParts[0] ?? "")) return "nothing";
		return undefined;
	}
}

/** The provider type the engine consults — the shipped base (or any subclass of it, e.g.
 *  `DbtTemplateProvider`). */
export type TemplateProvider = DefaultTemplateProvider;

/**
 * The ONE shared no-configuration default — an OPEN world that answers nothing and diagnoses
 * nothing. Sharing a single instance across documents/calls is safe ONLY because the bare base
 * is stateless (its granular defaults never record misses — pinned by the statelessness test in
 * tests/minijinja.template-provider.test.ts). A CONFIGURED provider must stay per-document per
 * the contract above; this constant is exclusively the "nothing configured" value.
 */
export const OPEN_PROVIDER: TemplateProvider = new DefaultTemplateProvider();
