// ---------------------------------------------------------------------------
// SchemaProvider — the catalog interface the analysis pipeline resolves against.
//
// Two implementations satisfy it:
//   - Schema (schema.ts): a full upfront mapping, the eager catalog. Its `version`
//     is constant 0 — its answers never change, so a memo keyed on it never
//     invalidates.
//   - CallbackSchema (here): a resolve-on-demand catalog for big-warehouse
//     LSP/embedding usage, where a full upfront mapping is infeasible and table
//     metadata is fetched lazily. `columnsFor` answers from whatever the host's
//     cache holds NOW (a sync read); an unknown table degrades to `undefined`
//     exactly like a missing mapping entry — never-wrong holds, no new diagnostic
//     class. The ONLY asynchrony is `prime()`, which drains the recorded misses
//     through the resolver's async fetch and bumps `version` so a consumer's memo
//     (SqlDocument.analyze) knows its cached answers may have changed.
//
// Fold contract at the resolver boundary: `columnsFor(parts, dialect)` folds each
// part with the dialect's TABLE-identifier fold (`foldIdentifier(p, dialect,
// "table")`) — identical to Schema's own lookup fold — BEFORE handing it to the
// resolver. So `TableResolver.resolve` and `TableResolver.fetch` always receive
// FOLDED name parts (the catalog identity key), never the raw source text. A host
// keys its cache by that folded path.
// ---------------------------------------------------------------------------

import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Column } from "./schema.js";

/** The catalog interface qualify / infer / lineage / symbols / completion resolve against.
 *  Structural, so every existing `Schema` caller keeps compiling. */
export interface SchemaProvider {
	/** Columns for a table identified by its RAW (unfolded) name parts, or undefined if unknown.
	 *  Folding for `dialect` happens inside the implementation, once. */
	columnsFor(parts: string[], dialect?: string): Column[] | undefined;
	/** OPTIONAL (#38): every declared table whose full path the written `parts` could mean (folded,
	 *  part-boundary suffix match), as full path-part arrays. Lets the caller tell an AMBIGUOUS
	 *  partial name (several candidates — diagnosed by naming them) from an unknown one (none).
	 *  A provider without a navigable namespace simply omits it; `columnsFor` alone then decides. */
	tableCandidates?(parts: string[], dialect?: string): string[][];
	/** OPTIONAL (#38): the immediate children of a namespace path — segment completion after a
	 *  qualifier dot (`analytics.|` → the datasets/schemas/tables inside `analytics`). Each entry
	 *  is the NEXT SEGMENT only, as declared. A host with a dotted catalog (a dbt manifest, an
	 *  information_schema mirror) implements this to power qualified-path completion. */
	childrenOf?(prefixParts: string[], dialect?: string): { name: string; kind: "namespace" | "table" }[];
	/** Bare table-name candidates for completion. */
	tables(dialect?: string): string[];
	/** Monotonic invalidation signal: a bump means "answers may have changed — drop memos keyed on
	 *  me". A plain Schema is constant 0 (its answers are fixed); a CallbackSchema bumps in prime(). */
	readonly version: number;
	/**
	 * What a `columnsFor` MISS means — and therefore whether the miss-driven diagnostics may fire:
	 *   - `"closed"` (the default when absent): the provider declares a COMPLETE world; a miss means
	 *     "this table does not exist" and unknown-table may fire (`Schema`; `CallbackSchema`, whose
	 *     transiently-cold misses self-heal via prime() + re-publish).
	 *   - `"open"`: a miss means "unknown — do not diagnose" (the never-wrong floor). The shipped
	 *     `DefaultTemplateProvider` is open, making it the safe ALWAYS-PRESENT default when no schema
	 *     was configured: schema-free analysis runs the full pipeline and emits no unknown-table.
	 */
	readonly world?: "closed" | "open";
}

/** The host-side resolver a CallbackSchema drives. Both hooks receive FOLDED name parts (see the
 *  fold contract in this file's header). */
export interface TableResolver {
	/** Sync lookup from the host's warm cache. undefined = unknown / not-yet-loaded — the
	 *  CallbackSchema records it as a miss (so prime() can later fetch it). */
	resolve(parts: string[]): Column[] | undefined;
	/** Async fetch for the missed tables, host-side (populates the cache `resolve` reads). Called by
	 *  prime() with the drained miss list. Optional — a resolver with no background fetch just never
	 *  warms, and prime() is then a no-op that returns false. */
	fetch?(missing: string[][]): Promise<void>;
}

/** A resolve-on-demand catalog. Implements SchemaProvider by delegating each folded lookup to a
 *  TableResolver and recording the misses; prime() drains those misses through the resolver's
 *  async fetch, re-probes, and bumps `version` when anything new arrived. */
export class CallbackSchema implements SchemaProvider {
	/** Closed world: a host cache miss is transiently wrong at worst — prime() + re-publish heal it. */
	readonly world = "closed" as const;
	private readonly resolver: TableResolver;
	private _version = 0;
	/** Distinct folded miss keys, in first-seen order. */
	private readonly _misses: string[][] = [];
	private readonly missSeen = new Set<string>();
	/** The in-flight prime(), or null when idle — the coalescing guard (see prime()). */
	private inFlight: Promise<boolean> | null = null;
	/** Folded dotted path -> folded parts, for every table the resolver has revealed so far. */
	private readonly revealed = new Map<string, string[]>();

	constructor(resolver: TableResolver) {
		this.resolver = resolver;
	}

	get version(): number {
		return this._version;
	}

	/** The recorded misses — distinct, in first-seen order. Drained by prime() as tables resolve. */
	get misses(): ReadonlyArray<string[]> {
		return this._misses;
	}

	columnsFor(parts: string[], dialect?: string): Column[] | undefined {
		const folded = parts.map((p) => resolveBehavior(dialect).fold(p, "table"));
		const cols = this.resolver.resolve(folded);
		if (cols === undefined) {
			this.recordMiss(folded);
			return undefined;
		}
		this.revealed.set(folded.join("."), folded);
		return cols;
	}

	/** The tables the resolver has revealed so far (the bare last path part of each). A CallbackSchema
	 *  cannot enumerate the whole warehouse — it only knows what it has been asked for and answered. */
	tables(_dialect?: string): string[] {
		return [...this.revealed.values()].map((p) => p[p.length - 1] ?? "");
	}

	/** Drain the recorded misses through the resolver's async fetch, re-probe, and — if any missed
	 *  table now resolves — remove it from the miss list and bump `version`. Resolves to true when
	 *  anything new arrived (so the consumer should re-analyze). 100%-sync analysis is preserved:
	 *  this is the one async seam.
	 *
	 *  In-flight coalescing: a second prime() while one is already running returns the SAME promise
	 *  rather than starting a fresh drain. Without this, two concurrent primes (e.g. the LSP fires one
	 *  per publish, and open triggers two publishes) would both snapshot the miss list and both fetch +
	 *  bump the version — a double fetch and a spurious extra invalidation. Returning the in-flight
	 *  promise (rather than chaining a second pass) is deliberate: it keeps the fetch count at one and
	 *  the version bump at one; a miss recorded during the in-flight fetch is drained-then-dropped by
	 *  this pass (see the truncation note below) and re-recorded by the next analyze() — never-wrong
	 *  holds, so the coalesced caller loses nothing permanently, it just warms one prime later. */
	prime(): Promise<boolean> {
		if (this.inFlight) return this.inFlight;
		if (this._misses.length === 0) return Promise.resolve(false);
		const run = this.drain().finally(() => {
			this.inFlight = null;
		});
		this.inFlight = run;
		return run;
	}

	/** One prime pass: fetch the current misses, re-probe, drain the resolved ones, bump version. */
	private async drain(): Promise<boolean> {
		const pending = this._misses.map((p) => [...p]);
		if (this.resolver.fetch) await this.resolver.fetch(pending);

		// Re-probe each miss against the (now possibly warmer) cache. Ones that resolve drain out.
		const stillMissing: string[][] = [];
		this.missSeen.clear();
		let anyNew = false;
		for (const folded of pending) {
			const cols = this.resolver.resolve(folded);
			if (cols === undefined) {
				stillMissing.push(folded);
				this.missSeen.add(folded.join("."));
			} else {
				anyNew = true;
				this.revealed.set(folded.join("."), folded);
			}
		}
		// Re-entrant miss note: a table missed by a columnsFor() that ran DURING the `await fetch` above
		// is in `this._misses` now but NOT in `pending`, so this truncation drops it. That is benign and
		// intentional — the next analyze() re-probes the cache, re-records the still-cold table, and the
		// next prime() warms it (never-wrong: it shows as unknown only until then). Merging it into
		// `stillMissing` would be wrong anyway — its folded parts were never handed to this pass's fetch.
		this._misses.length = 0;
		this._misses.push(...stillMissing);
		if (anyNew) this._version++;
		return anyNew;
	}

	private recordMiss(folded: string[]): void {
		const key = folded.join(".");
		if (this.missSeen.has(key)) return;
		this.missSeen.add(key);
		this._misses.push(folded);
	}
}
