// Dialect-true identifier case-folding — the single fold module every dialect's scope/qualify/
// references pass threads through (Tasks 2-3 wire the callers; this module is self-contained).
//
// The result of foldIdentifier() is an IDENTITY KEY for name comparison ONLY — display text
// always comes from the raw source text, never from this function's return value. Getting the
// fold DIRECTION wrong silently breaks equality: e.g. Snowflake's unquoted `foo` must equal
// quoted `"FOO"` and must NOT equal quoted `"foo"` — a lowercase fold gets both wrong.
//
// Every rule row below was verified against the LIVE vendor page (not training data) before
// encoding; citations note the verbatim wording that decided the direction, and any place the
// live page diverged from the originally proposed rule.

/** "table" = a table/view identifier — only BigQuery treats these differently from everything
 *  else (columns, aliases, CTE names, struct/field names, …), which is "other". */
export type IdentKind = "table" | "other";

type CaseFold = "lower" | "upper" | "preserve";

interface FoldRule {
	/** [open, close] delimiter pairs this dialect recognizes, tried in order. */
	delimiters: readonly (readonly [string, string])[];
	/** Case fold applied to an unquoted identifier. */
	unquoted: "lower" | "upper";
	/** Case fold applied to a quoted (delimited) identifier. */
	quoted: CaseFold;
	/** BigQuery only: table identifiers preserve case whether or not they're backtick-quoted —
	 *  backticks there are an escaping mechanism, not a case-quoting one. When set, this
	 *  overrides both `unquoted`/`quoted` for kind:"table". */
	tableCase?: "preserve";
	/** How an escaped delimiter is written inside a quoted identifier's body.
	 *  "double" (default) — the close delimiter is escaped by doubling it (`""`→`"`, `` `` ``→`` ` ``,
	 *  `]]`→`]`).
	 *  "backslash" — BigQuery only (see rule comment below): quoted identifiers use string-literal
	 *  escape sequences, not doubling. */
	escapeStyle?: "double" | "backslash";
}

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];
const BACKTICK: readonly [string, string] = ["`", "`"];

const RULES: Record<string, FoldRule> = {
	// docs.databricks.com/en/sql/language-manual/sql-ref-identifiers.html — verified live:
	// "Identifiers are case-insensitive when referenced." Backtick escaping is doubling, not
	// case-quoting: "Use ` to escape ` itself" (example: `` `a``b` `` → `` a`b ``).
	databricks: {
		delimiters: [BACKTICK],
		unquoted: "lower",
		quoted: "lower",
	},

	// learn.microsoft.com/en-us/sql/relational-databases/databases/database-identifiers +
	// .../sql/t-sql/statements/collations — verified live: case folding is NOT a hardcoded T-SQL
	// rule, it's a function of the identifier's COLLATION: "you can create two tables with names
	// that differ only in case in a database that has case-sensitive collation, but you can't...
	// in a database that has case-insensitive collation." Most SQL Server / Fabric SQL database
	// defaults are case-insensitive (e.g. SQL_Latin1_General_CP1_CI_AS), but this is not universal
	// — Fabric Warehouse defaults to the case-SENSITIVE Latin1_General_100_BIN2_UTF8. This module
	// encodes the common default-collation (CI) behavior; a caller with a known case-sensitive
	// collation is a documented boundary this module does not cross. Delimiting with `[ ]` or
	// `" "` does not itself change case behavior — quoting only unlocks reserved words/specials.
	tsql: {
		delimiters: [["[", "]"], DOUBLE_QUOTE],
		unquoted: "lower",
		quoted: "lower",
	},

	// docs.snowflake.com/en/sql-reference/identifiers-syntax — verified live: unquoted identifiers
	// "are stored and resolved as uppercase characters (e.g. id is stored and resolved as ID)";
	// quoted identifiers — "the case of the identifier is preserved when storing and resolving the
	// identifier" (case-sensitive). Doubled-quote escape: "To use the double quote character inside
	// a quoted identifier, use two quotes."
	snowflake: {
		delimiters: [DOUBLE_QUOTE],
		unquoted: "upper",
		quoted: "preserve",
	},

	// cloud.google.com/bigquery/docs/reference/standard-sql/lexical — verified live (via search,
	// the JS-rendered page would not return body text to WebFetch): "table names are case-sensitive,
	// but column names are not" — so table identifiers preserve case and everything else (column,
	// field, alias, CTE) folds to lower, REGARDLESS of backtick-quoting either way (backticks are
	// required for reserved words/specials, not a case-quoting mechanism — same "not case-quoting"
	// shape as Databricks, but the preserved/folded split is per identifier KIND here, not
	// per-quoting). Escape mechanism corrected from the originally assumed doubling: "Quoted
	// identifiers have the same escape sequences as string literals" (backslash-escaped, e.g.
	// `` `a\`b` `` → `` a`b ``) — NOT doubling like every other backtick/quote dialect here. This
	// module unescapes the identifier-relevant case (`` \` ``) plus the general `\X`→`X` pattern; it
	// does not implement BigQuery's full string-literal escape grammar (\n, \xHH, \uXXXX, octal, …),
	// out of scope for an identifier fold — those escapes are exotic in identifier text.
	bigquery: {
		delimiters: [BACKTICK],
		unquoted: "lower",
		quoted: "lower",
		tableCase: "preserve",
		escapeStyle: "backslash",
	},

	// docs.aws.amazon.com/redshift/latest/dg/r_names.html — verified live: "ASCII letters in
	// standard and delimited identifiers are case-insensitive and are folded to lowercase in the
	// database" — explicitly covers BOTH unquoted and quoted by default (the
	// enable_case_sensitive_identifier parameter can flip quoted identifiers case-sensitive; this
	// module encodes the default). Doubled-quote escape: "To use a double quotation mark in a
	// string, you must precede it with another double quotation mark character."
	redshift: {
		delimiters: [DOUBLE_QUOTE],
		unquoted: "lower",
		quoted: "lower",
	},

	// postgresql.org/docs/18/sql-syntax-lexical.html §4.1.1 — verified live: "unquoted names are
	// always folded to lower case"; "Quoting an identifier also makes it case-sensitive" — example
	// "the identifiers FOO, foo, and "foo" are considered the same by PostgreSQL, but "Foo" and
	// "FOO" are different." Doubled-quote escape: "To include a double quote, write two double
	// quotes."
	postgres: {
		delimiters: [DOUBLE_QUOTE],
		unquoted: "lower",
		quoted: "preserve",
	},

	// duckdb.org/docs/current/sql/dialect/keywords_and_identifiers.html — verified live: "Identifiers
	// in DuckDB are always case-insensitive, similarly to PostgreSQL. However, unlike PostgreSQL...
	// DuckDB also treats quoted identifiers as case-insensitive" — quoting only preserves the
	// identifier for DISPLAY, not identity. Doubled-quote escape: "Double quotes can be escaped by
	// repeating the quote character."
	duckdb: {
		delimiters: [DOUBLE_QUOTE],
		unquoted: "lower",
		quoted: "lower",
	},

	// trino.io/docs/current/language/reserved.html — verified live: "Identifiers with other
	// characters must be delimited with double quotes (\"). ... Escape a \" with another preceding
	// double quote in a delimited identifier." and, blanket, "Identifiers are not treated as case
	// sensitive" — no quoted/unquoted distinction is drawn, and no backtick delimiter is documented
	// (adjusted from the originally proposed "backtick tolerated" — dropped, unconfirmed by the
	// live page). The fold DIRECTION (lower here) is this module's choice, not vendor-documented —
	// the live docs only commit to uniform case-insensitivity across quoted/unquoted, which lower-
	// folding both forms reproduces; chosen for consistency with the other case-insensitive-quoted
	// dialects (redshift/duckdb) and this module's undefined-dialect default. NOTE: Trino's own
	// engine source is internally inconsistent with this blanket docs claim — trino-parser's
	// Identifier.getCanonicalValue() canonicalizes unquoted to UPPER and preserves quoted verbatim
	// (ANSI-style, would make quoted case-sensitive), while trino-main's Field field-matching does
	// a blanket case-insensitive compare regardless of quoting. Encoding the documented behavior
	// per this module's citation policy; flagged as a discrepancy, not resolved against a live
	// engine.
	trino: {
		delimiters: [DOUBLE_QUOTE],
		unquoted: "lower",
		quoted: "lower",
	},
};

// Today's behavior — the safe default for an unrecognized/absent dialect tag: strip backticks,
// fold to lower.
const DEFAULT_RULE: FoldRule = {
	delimiters: [BACKTICK],
	unquoted: "lower",
	quoted: "lower",
};

function applyCase(text: string, fold: CaseFold): string {
	if (fold === "lower") return text.toLowerCase();
	if (fold === "upper") return text.toUpperCase();
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

/** Unquote (dialect's delimiters, doubled-delimiter unescape) + case-fold per the dialect's
 *  documented identifier rules. The result is the IDENTITY KEY for name comparison — display
 *  text always comes from the raw source, never from this. */
export function foldIdentifier(raw: string, dialect: string | undefined, kind: IdentKind = "other"): string {
	const rule = (dialect && Object.hasOwn(RULES, dialect) ? RULES[dialect] : undefined) || DEFAULT_RULE;
	const [body, wasQuoted] = unwrap(raw, rule);
	if (kind === "table" && rule.tableCase) return applyCase(body, rule.tableCase);
	return applyCase(body, wasQuoted ? rule.quoted : rule.unquoted);
}

/** PRESENTATION twin of foldIdentifier: strip the dialect's delimiters (unescaping the body) but
 *  apply NO case change — the string a UI shows for a name. Never use this for comparison; two
 *  displayName results being equal proves nothing about identity. */
export function displayName(raw: string, dialect: string | undefined): string {
	const rule = (dialect && Object.hasOwn(RULES, dialect) ? RULES[dialect] : undefined) || DEFAULT_RULE;
	return unwrap(raw, rule)[0];
}

/** Fold a multipart table name for a catalog lookup — every part folded with kind "table" (only
 *  BigQuery treats table parts specially; everywhere else this is the plain fold). */
export function foldTableName(parts: string[], dialect: string | undefined): string[] {
	return parts.map((p) => foldIdentifier(p, dialect, "table"));
}

/** True when a source-map KEY (already folded — an alias folded as "other", or a table's last name
 *  part folded as "table") matches a RAW qualifier part. Tries both folds; they differ only for
 *  BigQuery, whose table identifiers preserve case while aliases/columns fold lower. */
export function matchesSourceKey(key: string, rawPart: string, dialect: string | undefined): boolean {
	return key === foldIdentifier(rawPart, dialect) || key === foldIdentifier(rawPart, dialect, "table");
}
