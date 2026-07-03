// Freeze the IR structure after lower() so it is the single, immutable structural source of truth:
// no semantic pass may write back into it (the sqlglot in-place-annotation trap). The deep freeze
// descends ONLY into the IR's own plain objects and arrays. Everything else is FOREIGN and left
// untouched: antlr's CST back-refs (`cst`/`aliasCst` are ParserRuleContext instances), tokens, the
// shared lexer/parser ATN, and any typed array reachable through the graph/pipe nodes. Freezing a
// foreign object either throws ("cannot freeze array buffer views with elements" on a typed array)
// or corrupts antlr's shared static state (a frozen DFA can no longer add edges, breaking every
// later parse). A class instance or typed array is never IR data, so we neither freeze nor recurse
// into it. A pass that needs another's output passes that result in; it never mutates the tree.
// Idempotent: re-freezing an already-frozen tree is a no-op.
//
// This is fully generic, so additive IR nodes need no change here: the `SelectExpr.joins` Join[] and
// each plain Join object are frozen via the normal array/plain-object descent; a Join's `source`/`on`
// are the SAME objects already reached through `from`/`joinConditions` (the `seen` set skips the
// second visit), and its `cst` is a foreign ParserRuleContext, skipped like every other cst back-ref.

/** Deep-freeze the IR rooted at `node` (descending only into the IR's own plain objects/arrays). */
export function freezeIR<T>(node: T): T {
	deepFreeze(node, new Set());
	return node;
}

function deepFreeze(value: unknown, seen: Set<object>): void {
	if (value === null || typeof value !== "object") return;
	const obj = value as object;
	if (seen.has(obj)) return;

	// Only the IR's own plain objects/arrays are ours to freeze. Anything with a non-Object
	// prototype — antlr CST/tokens/ATN, typed arrays, Map/Set — is foreign: freezing it throws or
	// corrupts antlr's shared parser state, so we stop at the boundary rather than walk past it.
	const isArray = Array.isArray(obj);
	if (!isArray && !isPlainObject(obj)) return;
	seen.add(obj);

	if (isArray) {
		for (const item of obj as unknown[]) deepFreeze(item, seen);
	} else {
		for (const child of Object.values(obj)) deepFreeze(child, seen);
	}
	Object.freeze(obj);
}

function isPlainObject(obj: object): boolean {
	const proto = Object.getPrototypeOf(obj);
	return proto === Object.prototype || proto === null;
}
