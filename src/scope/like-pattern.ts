// SQL LIKE/ILIKE pattern matching. A leaf module (no scope/IR imports) so the dialect-behavior
// registry can depend on it without pulling in scope.ts — which imports the behavior carrier, which
// imports the registry (the cycle this split breaks).
//
// NOTE: LIKE pattern semantics are dialect-specific (T-SQL adds `[a-c]` / `[^…]` character classes and
// an ESCAPE clause; Postgres/Snowflake treat `[` as a literal). This shared `%`/`_` translation is the
// current floor, exposed per-dialect via DialectBehavior.likeMatch so a dialect can override it later.

/** SQL LIKE pattern to an anchored case-insensitive RegExp (`%` to `.*`, `_` to `.`). */
export function likePatternToRegExp(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.replace(/%/g, ".*")
		.replace(/_/g, ".");
	return new RegExp(`^${escaped}$`, "i");
}
