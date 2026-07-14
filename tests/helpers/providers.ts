// Shared TemplateProvider test doubles for the provider-seam tests (the
// catalog-unification cutover): a shape-forcing provider for fill tests and a
// warm/cold relation provider with the miss/prime machinery exercised the way
// a host (anvil) drives it.

import type { Column } from "../../src/index.js";
import { DbtTemplateProvider, type ExpansionShape, type ResolvedRelation, type TemplateCall } from "../../src/index.js";

// These doubles emulate a DBT-AWARE host (the shape anvil's provider takes): they extend
// DbtTemplateProvider so the dbt builtin shapes (config -> "nothing", env_var -> string,
// ref/source -> relation) are the base, exactly as a real dbt consumer's provider inherits them.
// The neutral DefaultTemplateProvider knows none of that.

/** Forces `shape` for every call the base provider has no answer for (builtins keep their
 *  real shapes — config stays "nothing", exactly like a host classifier that answers by name). */
export class AlwaysShapeProvider extends DbtTemplateProvider {
	constructor(private readonly shape: ExpansionShape) {
		super();
	}
	override shapeOf(call: TemplateCall): ExpansionShape | undefined {
		return super.shapeOf(call) ?? this.shape;
	}
}

/** `{ provider }` options forcing one shape — the successor of the old `{ shapeOf: always(x) }`. */
export function shaped(shape: ExpansionShape): { provider: DbtTemplateProvider } {
	return { provider: new AlwaysShapeProvider(shape) };
}

/** `{ provider }` giving a plain dbt provider (ref/source naming, dbt builtin shapes, nothing else).
 *  The neutral default names nothing, so any test asserting a ref/source model or source name passes
 *  this so the names resolve and the assertion keeps catching regressions. */
export function dbt(): { provider: DbtTemplateProvider } {
	return { provider: new DbtTemplateProvider() };
}

/** Answers `shape` per call name (the old name-keyed shapeOf callback pattern). */
export class NamedShapeProvider extends DbtTemplateProvider {
	constructor(private readonly shapes: Record<string, ExpansionShape>) {
		super();
	}
	override shapeOf(call: TemplateCall): ExpansionShape | undefined {
		return super.shapeOf(call) ?? this.shapes[call.name];
	}
}

/** Relation identity key: kind is the call name (ref/source), path the folded logical parts. */
export function relKey(name: string, parts: readonly (string | null)[]): string {
	return `${name}|${parts.map((p) => p ?? "?").join(".")}`;
}

/**
 * A warm-cache relation provider driven exactly like a host: `relationOf` answers from `cache`
 * (recording a miss when cold), `fetchExpansions` moves `pending` entries into the cache so
 * `prime()` warms them and bumps `version`.
 */
export class TestRelationProvider extends DbtTemplateProvider {
	/** A host describe-cache is a CLOSED world (misses are transiently wrong at worst, healed by
	 *  prime + re-publish) — so miss-driven unknown-table diagnostics fire, like the host's would. */
	override readonly world = "closed" as const;
	readonly cache = new Map<string, ResolvedRelation>();
	readonly pending = new Map<string, ResolvedRelation>();
	/** Physical-table columns for the inherited columnsFor (the describe-cache side). */
	readonly tableColumns = new Map<string, Column[]>();

	override relationOf(call: TemplateCall): ResolvedRelation | undefined {
		if (call.name !== "ref" && call.name !== "source") return super.relationOf(call);
		const hit = this.cache.get(relKey(call.name, call.args));
		if (hit) return hit;
		this.recordMiss(call);
		return undefined;
	}

	override columnsFor(parts: string[]): Column[] | undefined {
		return this.tableColumns.get(parts.join("."));
	}

	protected override fetchExpansions(missing: TemplateCall[]): Promise<void> {
		for (const call of missing) {
			const k = relKey(call.name, call.args);
			const p = this.pending.get(k);
			if (p) this.cache.set(k, p);
		}
		return Promise.resolve();
	}
}
