// The dialect-agnostic identifier case-folding ENGINE. A dialect owns its FoldRule (in
// src/<dialect>/fold.ts) and binds it to these functions; the registry maps a dialect string to that
// bound behavior. This module holds no per-dialect knowledge — only the rule shape and the fold/display
// mechanics every dialect's rule runs through.
//
// The result of foldWith() is an IDENTITY KEY for name comparison ONLY — display text always comes from
// the raw source text, never from a fold result. Getting the fold DIRECTION wrong silently breaks
// equality: e.g. Snowflake's unquoted `foo` must equal quoted `"FOO"` and must NOT equal quoted `"foo"`
// — a lowercase fold gets both wrong. Each dialect's rule is doc-cited in its own src/<dialect>/fold.ts.

/** "table" = a table/view identifier — only BigQuery treats these differently from everything
 *  else (columns, aliases, CTE names, struct/field names, …), which is "other". */
export type IdentKind = "table" | "other";

/** "ascii-lower" folds [A-Z] only, passing every other character through, for dialects whose
 *  engines compare identifiers ASCII-case-insensitively (sqlite, postgres, duckdb, redshift):
 *  there `Ä` and `ä` are DISTINCT identifiers, and a Unicode-wide fold would conflate them (#22). */
type CaseFold = "lower" | "upper" | "preserve" | "ascii-lower";

export interface FoldRule {
	/** [open, close] delimiter pairs this dialect recognizes, tried in order. */
	delimiters: readonly (readonly [string, string])[];
	/** Case fold applied to an unquoted identifier. */
	unquoted: "lower" | "upper" | "ascii-lower";
	/** Case fold applied to a quoted (delimited) identifier. */
	quoted: CaseFold;
	/** BigQuery only: table identifiers preserve case whether or not they're backtick-quoted —
	 *  backticks there are an escaping mechanism, not a case-quoting one. When set, this
	 *  overrides both `unquoted`/`quoted` for kind:"table". */
	tableCase?: "preserve";
	/** How an escaped delimiter is written inside a quoted identifier's body.
	 *  "double" (default) — the close delimiter is escaped by doubling it (`""`→`"`, `` `` ``→`` ` ``,
	 *  `]]`→`]`).
	 *  "backslash" — BigQuery only (see its rule comment): quoted identifiers use string-literal escape
	 *  sequences, not doubling. */
	escapeStyle?: "double" | "backslash";
}

function applyCase(text: string, fold: CaseFold): string {
	if (fold === "lower") return text.toLowerCase();
	if (fold === "upper") return text.toUpperCase();
	if (fold === "ascii-lower") return text.replace(/[A-Z]/g, (c) => c.toLowerCase());
	return text;
}

/** Strip one matching delimiter pair off `raw` (if present) and unescape its body.
 *  Returns [body, wasQuoted]. */
function unwrap(raw: string, rule: FoldRule): [string, boolean] {
	if (raw.length < 2) return [raw, false];
	for (const [open, close] of rule.delimiters) {
		if (raw.startsWith(open) && raw.endsWith(close)) {
			const body = raw.slice(open.length, raw.length - close.length);
			const unescaped =
				rule.escapeStyle === "backslash" ? body.replace(/\\(.)/g, "$1") : body.split(close + close).join(close);
			return [unescaped, true];
		}
	}
	return [raw, false];
}

/** Fold an identifier to its identity key under an explicit rule (the engine each dialect folder binds). */
export function foldWith(rule: FoldRule, raw: string, kind: IdentKind = "other"): string {
	const [body, wasQuoted] = unwrap(raw, rule);
	if (kind === "table" && rule.tableCase) return applyCase(body, rule.tableCase);
	return applyCase(body, wasQuoted ? rule.quoted : rule.unquoted);
}

/** Presentation twin of foldWith: strip delimiters, no case change. */
export function displayWith(rule: FoldRule, raw: string): string {
	return unwrap(raw, rule)[0];
}
