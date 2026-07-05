// ---------------------------------------------------------------------------
// TemplateCatalog — the inc3.1 `relation` slice of the template-layer catalog
// seam. It generalizes SchemaSource the way the schema generalizes to SQL:
// where a SchemaSource answers "what columns does this physical table have",
// a TemplateCatalog ALSO answers "what physical relation (and columns) does
// this dbt-logical `{{ ref('orders') }}` resolve to". qualify duck-types the
// catalog it already receives (`"relation" in schema`); a plain SchemaSource
// has no `relation` and is naturally the zero-catalog fallback (every templated
// source stays at the R3 exemption).
//
// CallbackTemplateCatalog mirrors CallbackSchema (schema-source.ts) EXACTLY —
// sync resolve, recorded distinct-first-seen-order misses, an async prime()
// that drains those misses through the resolver's async fetch, re-probes, and
// bumps a monotonic `version` when anything new arrived, with in-flight
// coalescing and re-entrant-miss truncation. The ONE difference: it wraps TWO
// resolvers (a RelationResolver for `relation`, and an OPTIONAL TableResolver
// for the inherited physical-table `columnsFor`/`tables`) behind ONE `version`
// and ONE `prime()` that drains BOTH miss lists in a single pass and bumps once.
//
// Why mirror rather than compose an inner CallbackSchema: CallbackSchema owns
// its own `_version` and `prime()`, so reusing it would give two independent
// version counters and two prime()s — violating "one shared counter, one prime
// draining both lists". Mirroring its structure here keeps the counter and the
// drain single and shared; the duplicated shape is small and deliberate.
//
// Fold contract at the resolver boundary (identical to CallbackSchema's): every
// name is folded with the dialect's TABLE-identifier fold (`foldIdentifier(p,
// dialect, "table")`) BEFORE the resolver sees it — `resolveRelation` /
// `fetchRelations` (and `resolve` / `fetch`) always receive FOLDED parts (the
// catalog identity key), never raw source text. A host keys its cache by that
// folded path.
// ---------------------------------------------------------------------------

import { foldIdentifier } from "../ident/fold.js";
import type { Column } from "./schema.js";
import type { SchemaSource, TableResolver } from "./schema-source.js";

/** A dbt template reference to resolve — the logical name R3 put on `TableSource.name`. */
export interface TemplateRef {
	kind: "ref" | "source";
	/** The dbt-logical name parts: `["orders"]` (a `ref`) or `["raw","events"]` (a `source`). */
	nameParts: string[];
}

/** The resolved physical relation a TemplateRef maps to. */
export interface ResolvedRelation {
	/** The resolved PHYSICAL relation name parts (e.g. `["analytics","orders"]`). */
	nameParts: string[];
	/** The physical relation's columns, or undefined until an async describe lands (async warm). */
	columns?: Column[];
}

/**
 * The syntactic SLOT a macro's rendered output occupies — the up-front, parse-time answer the
 * placeholder mechanism needs (inc3.2). It is SYNCHRONOUS + by-name (sqllens can't pause mid-lex to
 * await), so it is a plain shape vocabulary, not a lazy resolution like `relation`/`value`:
 *   - `statement`  — a whole statement / query body (also fits a `(…)` CTE/subquery body).
 *   - `relation`   — a relation in FROM (rendered as a query body — same `SELECT 1` fill as `statement`).
 *   - `predicate`  — a boolean expression (a WHERE/ON/HAVING slot).
 *   - `column-list`— one or more select items (the slot parses; the real column COUNT differs).
 *   - `conjunct`   — a TRAILING boolean conjunct (`and c = false`) appended to a complete ON/WHERE
 *                    expression (the dbt `is_deleted_filter`-family macro shape) — fills `AND 1=1`.
 *   - `expr`       — a scalar expression (today's identifier fill — the zero-catalog default).
 */
export type ExpansionShape = "expr" | "column-list" | "predicate" | "relation" | "statement" | "conjunct";

/** Extends SchemaSource: a catalog that ALSO resolves dbt template refs to physical relations+columns.
 *  qualify duck-types this (`"relation" in schema`); a plain SchemaSource is the zero-catalog fallback. */
export interface TemplateCatalog extends SchemaSource {
	/** Resolve a logical template ref to its physical relation (+columns), or undefined if unknown
	 *  (recorded as a miss). `ref.nameParts` are RAW — folding for `dialect` happens inside. */
	relation(ref: TemplateRef, dialect?: string): ResolvedRelation | undefined;
	/**
	 * The syntactic slot a MACRO call's rendered output occupies (inc3.2) — SYNCHRONOUS, by macro
	 * name (+ package `parts`). Consulted at PARSE time to pick a shape-valid placeholder fragment
	 * (`SELECT 1`, `1=1`, …) so an unknown callable at statement/CTE/predicate position still parses.
	 * OPTIONAL — a relation-only / plain SchemaSource catalog omits it, and then the placeholder is the
	 * zero-catalog positional fill (byte-identical to today). `undefined` also falls back to that fill.
	 */
	expansionShape?(call: { name: string; parts?: string[] }, dialect?: string): ExpansionShape | undefined;
}

/** The host-side resolver a CallbackTemplateCatalog drives for template refs — the template-ref twin
 *  of TableResolver. Both hooks receive FOLDED name parts (see the fold contract in the header). */
export interface RelationResolver {
	/** Sync lookup from the host's warm cache. undefined = unknown / not-yet-loaded — the
	 *  CallbackTemplateCatalog records it as a miss (so prime() can later fetch it). */
	resolveRelation(ref: TemplateRef): ResolvedRelation | undefined;
	/** Async fetch for the missed refs, host-side (populates the cache `resolveRelation` reads).
	 *  Called by prime() with the drained relation-miss list. Optional — a resolver with no background
	 *  fetch just never warms its relations. */
	fetchRelations?(missing: TemplateRef[]): Promise<void>;
}

/** A resolve-on-demand template catalog. Implements TemplateCatalog by delegating each folded
 *  `relation` lookup to a RelationResolver (and each folded `columnsFor` lookup to an optional
 *  TableResolver) and recording the misses; ONE prime() drains BOTH miss lists through the
 *  resolvers' async fetches, re-probes, and bumps ONE `version` when anything new arrived. */
export class CallbackTemplateCatalog implements TemplateCatalog {
	private readonly relationResolver: RelationResolver;
	private readonly tableResolver: TableResolver | undefined;
	private _version = 0;

	/** Distinct folded physical-table miss keys, in first-seen order. */
	private readonly _tableMisses: string[][] = [];
	private readonly tableMissSeen = new Set<string>();
	/** Distinct folded relation misses, in first-seen order (keyed by kind + folded path). */
	private readonly _relationMisses: TemplateRef[] = [];
	private readonly relationMissSeen = new Set<string>();

	/** The in-flight prime(), or null when idle — the coalescing guard (see prime()). */
	private inFlight: Promise<boolean> | null = null;
	/** Folded dotted path -> folded parts, for every physical table the table resolver has revealed. */
	private readonly revealed = new Map<string, string[]>();

	/** @param relationResolver drives `relation` (logical ref → physical relation+columns).
	 *  @param tableResolver drives the inherited `columnsFor`/`tables` (physical tables). Optional — a
	 *  relation-only catalog omits it, and then `columnsFor` returns undefined for everything. */
	constructor(relationResolver: RelationResolver, tableResolver?: TableResolver) {
		this.relationResolver = relationResolver;
		this.tableResolver = tableResolver;
	}

	get version(): number {
		return this._version;
	}

	/** The recorded misses — BOTH the physical-table misses and the relation misses, as their folded
	 *  name parts, distinct and in first-seen order (tables first, then relations). Drained by prime(). */
	get misses(): ReadonlyArray<string[]> {
		return [...this._tableMisses, ...this._relationMisses.map((r) => r.nameParts)];
	}

	// --- SchemaSource (physical tables) — delegates to the table resolver EXACTLY as CallbackSchema. ---

	columnsFor(parts: string[], dialect?: string): Column[] | undefined {
		if (!this.tableResolver) return undefined;
		const folded = parts.map((p) => foldIdentifier(p, dialect, "table"));
		const cols = this.tableResolver.resolve(folded);
		if (cols === undefined) {
			this.recordTableMiss(folded);
			return undefined;
		}
		this.revealed.set(folded.join("."), folded);
		return cols;
	}

	/** The physical tables the table resolver has revealed so far (the bare last path part of each). */
	tables(_dialect?: string): string[] {
		return [...this.revealed.values()].map((p) => p[p.length - 1] ?? "");
	}

	// --- TemplateCatalog (`relation`) — the logical-ref side. ---

	relation(ref: TemplateRef, dialect?: string): ResolvedRelation | undefined {
		const folded: TemplateRef = {
			kind: ref.kind,
			nameParts: ref.nameParts.map((p) => foldIdentifier(p, dialect, "table")),
		};
		const rel = this.relationResolver.resolveRelation(folded);
		if (rel === undefined) {
			this.recordRelationMiss(folded);
			return undefined;
		}
		return rel;
	}

	// --- The one async seam: prime() drains BOTH miss lists, bumps ONE version. ---

	/** Drain BOTH recorded miss lists through the resolvers' async fetches, re-probe, and — if any
	 *  missed table OR relation now resolves — remove it from its miss list and bump `version` once.
	 *  Resolves to true when anything new arrived (so the consumer should re-analyze).
	 *
	 *  In-flight coalescing (identical to CallbackSchema): a second prime() while one is already
	 *  running returns the SAME promise rather than starting a fresh drain — one fetch per resolver,
	 *  one version bump. A miss recorded during the in-flight fetch is drained-then-dropped by this
	 *  pass (see the truncation note in drain()) and re-recorded by the next analyze() — never-wrong
	 *  holds, so a coalesced caller loses nothing permanently, it just warms one prime later. */
	prime(): Promise<boolean> {
		if (this.inFlight) return this.inFlight;
		if (this._tableMisses.length === 0 && this._relationMisses.length === 0) return Promise.resolve(false);
		const run = this.drain().finally(() => {
			this.inFlight = null;
		});
		this.inFlight = run;
		return run;
	}

	/** One prime pass: fetch the current table + relation misses, re-probe both, drain the resolved
	 *  ones, bump version once if anything new arrived. */
	private async drain(): Promise<boolean> {
		const pendingTables = this._tableMisses.map((p) => [...p]);
		const pendingRels = this._relationMisses.map((r) => ({ kind: r.kind, nameParts: [...r.nameParts] }));

		// Fetch both sides in parallel — one fetch call per resolver, only when it has pending work.
		const fetches: Promise<void>[] = [];
		if (this.tableResolver?.fetch && pendingTables.length > 0)
			fetches.push(this.tableResolver.fetch(pendingTables));
		if (this.relationResolver.fetchRelations && pendingRels.length > 0)
			fetches.push(this.relationResolver.fetchRelations(pendingRels));
		await Promise.all(fetches);

		let anyNew = false;

		// Re-probe each table miss against the (now possibly warmer) cache. Ones that resolve drain out.
		const stillTables: string[][] = [];
		this.tableMissSeen.clear();
		for (const folded of pendingTables) {
			const cols = this.tableResolver?.resolve(folded);
			if (cols === undefined) {
				stillTables.push(folded);
				this.tableMissSeen.add(folded.join("."));
			} else {
				anyNew = true;
				this.revealed.set(folded.join("."), folded);
			}
		}

		// Re-probe each relation miss the same way.
		const stillRels: TemplateRef[] = [];
		this.relationMissSeen.clear();
		for (const ref of pendingRels) {
			const rel = this.relationResolver.resolveRelation(ref);
			if (rel === undefined) {
				stillRels.push(ref);
				this.relationMissSeen.add(relKey(ref));
			} else {
				anyNew = true;
			}
		}

		// Re-entrant miss truncation (identical to CallbackSchema): a miss recorded by a columnsFor()/
		// relation() that ran DURING the `await` above is in `this._*Misses` now but NOT in `pending*`,
		// so this reset-then-push drops it. Benign and intentional — the next analyze() re-probes the
		// cache, re-records the still-cold entry, and the next prime() warms it (never-wrong: it shows
		// as unknown only until then). Merging it here would be wrong — its parts never reached this
		// pass's fetch.
		this._tableMisses.length = 0;
		this._tableMisses.push(...stillTables);
		this._relationMisses.length = 0;
		this._relationMisses.push(...stillRels);
		if (anyNew) this._version++;
		return anyNew;
	}

	private recordTableMiss(folded: string[]): void {
		const key = folded.join(".");
		if (this.tableMissSeen.has(key)) return;
		this.tableMissSeen.add(key);
		this._tableMisses.push(folded);
	}

	private recordRelationMiss(folded: TemplateRef): void {
		const key = relKey(folded);
		if (this.relationMissSeen.has(key)) return;
		this.relationMissSeen.add(key);
		this._relationMisses.push(folded);
	}
}

/** Miss-identity key for a relation ref — kind + folded dotted path, so a `ref` and a `source` with
 *  the same name parts are distinct misses. */
function relKey(ref: TemplateRef): string {
	return `${ref.kind}|${ref.nameParts.join(".")}`;
}
