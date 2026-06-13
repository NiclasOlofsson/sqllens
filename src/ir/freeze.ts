// Freeze the IR structure after lower() so it is the single, immutable structural source of truth:
// no semantic pass may write back into it (the sqlglot in-place-annotation trap). The deep freeze
// walks the IR's own objects/arrays and STOPS at the foreign antlr CST back-refs (`cst`, `aliasCst`)
// — those are cyclic, owned by antlr, and kept only for source spans, so we neither freeze nor
// recurse into them. A pass that needs another's output passes that result in; it never mutates the
// tree. Idempotent: re-freezing an already-frozen tree is a no-op.

const CST_KEYS = new Set(["cst", "aliasCst"]);

/** Deep-freeze the IR rooted at `node` (skipping CST back-refs) and return it. */
export function freezeIR<T>(node: T): T {
	deepFreeze(node, new Set());
	return node;
}

function deepFreeze(value: unknown, seen: Set<object>): void {
	if (value === null || typeof value !== "object") return;
	const obj = value as object;
	if (seen.has(obj)) return;
	seen.add(obj);

	if (Array.isArray(value)) {
		for (const item of value) deepFreeze(item, seen);
		Object.freeze(value);
		return;
	}

	for (const [key, child] of Object.entries(obj)) {
		if (CST_KEYS.has(key)) continue; // don't freeze or recurse into antlr's tree
		deepFreeze(child, seen);
	}
	Object.freeze(obj);
}
