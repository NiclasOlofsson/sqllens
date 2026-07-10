import { describe, expect, it } from "vitest";
import { toScopes, Schema } from "../src/index.js";
import { parseTemplated } from "../src/minijinja/index.js";
import type { ColumnRef } from "../src/ir/ir.js";
import type { Scope } from "../src/scope/scope.js";
import { resolveColumnRef } from "../src/sema/resolve.js";

// The unified column binder — resolveColumnRef(scope, ref, schema?) — returns scope's ColumnResolution
// union. Schema-aware, with the ambiguity FIX: >1 visible source exposing a bare column → "ambiguous"
// (the old resolveColumnSource silently first-matched).

const AMBIG = new Schema({ a: { id: "TEXT" }, b: { id: "TEXT" } });
const ONE = new Schema({ a: { id: "TEXT" }, b: { note: "TEXT" } });

function findColumnRef(node: unknown, name: string, seen = new Set<unknown>()): ColumnRef | undefined {
	if (!node || typeof node !== "object" || seen.has(node)) return undefined;
	seen.add(node);
	const n = node as Record<string, unknown>;
	if (Array.isArray((n as { parts?: unknown }).parts) && (n as { kind?: unknown }).kind === "columnref") {
		const parts = n.parts as string[];
		if (parts[parts.length - 1]?.toLowerCase() === name) return n as unknown as ColumnRef;
	}
	for (const v of Object.values(n)) {
		if (v === (n as { cst?: unknown }).cst) continue;
		const f = Array.isArray(v)
			? v.map((x) => findColumnRef(x, name, seen)).find(Boolean)
			: findColumnRef(v, name, seen);
		if (f) return f;
	}
	return undefined;
}

function rootAndRef(sql: string, name: string): { scope: Scope; ref: ColumnRef } {
	const r = parseTemplated(sql, "duckdb");
	const scope = toScopes(r.sql.ast).root;
	const ref = findColumnRef(r.sql.ast, name)!;
	return { scope, ref };
}

describe("resolveColumnRef", () => {
	it("returns `ambiguous` when more than one visible source exposes the bare column", () => {
		const { scope, ref } = rootAndRef("select id from a join b on a.id = b.id", "id");
		expect(ref.parts).toEqual(["id"]);
		const res = resolveColumnRef(scope, ref, AMBIG);
		expect(res.kind).toBe("ambiguous");
	});

	it("binds a bare column when exactly one visible source exposes it (schema-aware)", () => {
		const { scope, ref } = rootAndRef("select note from a join b on a.id = b.id", "note");
		const res = resolveColumnRef(scope, ref, ONE);
		expect(res.kind).toBe("bound");
		if (res.kind === "bound") expect(res.column.toLowerCase()).toBe("note");
	});

	it("binds a qualified column to the source matching its qualifier", () => {
		const { scope, ref } = rootAndRef("select a.id from a join b on a.id = b.id", "id");
		const res = resolveColumnRef(scope, ref, AMBIG);
		expect(res.kind).toBe("bound");
	});
});
