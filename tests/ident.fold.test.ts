import { describe, expect, it } from "vitest";
import { displayName, foldIdentifier } from "../src/dialect-behavior/public-fold.js";
import { fold as snowflakeFold } from "../src/snowflake/fold.js";

// Case-folding is the identity key for name comparison across the pipeline (scope/qualify/
// references/…). Each dialect's rule is doc-cited in its own src/<dialect>/fold.ts and reached here
// through the public foldIdentifier (registry -> behavior); this suite pins the exact fold direction +
// quoted-identifier behavior per dialect against those citations.

describe("databricks", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "databricks")).toBe("mytable");
	});
	it("folds backtick-quoted to lower too (backticks are not case-quoting)", () => {
		expect(foldIdentifier("`MyTable`", "databricks")).toBe("mytable");
	});
	it("unescapes a doubled backtick inside a quoted identifier", () => {
		expect(foldIdentifier("`a``b`", "databricks")).toBe("a`b");
	});
});

describe("tsql", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "tsql")).toBe("mytable");
	});
	it("folds bracket-quoted identifiers to lower", () => {
		expect(foldIdentifier("[MyTable]", "tsql")).toBe("mytable");
	});
	it("unescapes a doubled close-bracket inside a bracket-quoted identifier", () => {
		expect(foldIdentifier("[a]]b]", "tsql")).toBe("a]b");
	});
	it("folds double-quoted identifiers to lower (default CI collation)", () => {
		expect(foldIdentifier('"MyTable"', "tsql")).toBe("mytable");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "tsql")).toBe('a"b');
	});
});

// snowflake's fold is colocated in src/snowflake/fold.ts (it left the central RULES table), so this
// block tests that module directly. Same doc-cited rule: unquoted -> UPPER, quoted -> preserve.
describe("snowflake (colocated)", () => {
	it("folds unquoted mixed case to UPPER", () => {
		expect(snowflakeFold("foo")).toBe("FOO");
	});
	it("preserves case inside quotes (case-sensitive)", () => {
		expect(snowflakeFold('"foo"')).toBe("foo");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(snowflakeFold('"a""b"')).toBe('a"b');
	});
	it('unquoted foo equals quoted "FOO" but not quoted "foo"', () => {
		const unquoted = snowflakeFold("foo");
		expect(unquoted).toBe(snowflakeFold('"FOO"'));
		expect(unquoted).not.toBe(snowflakeFold('"foo"'));
	});
});

describe("bigquery", () => {
	it("folds an unquoted 'other'-kind identifier (column/alias) to lower", () => {
		expect(foldIdentifier("MyCol", "bigquery", "other")).toBe("mycol");
	});
	it("preserves case for an unquoted table identifier", () => {
		expect(foldIdentifier("MyTable", "bigquery", "table")).toBe("MyTable");
	});
	it("preserves case for a backtick-quoted table identifier too (backticks are not case-quoting)", () => {
		expect(foldIdentifier("`MyTable`", "bigquery", "table")).toBe("MyTable");
	});
	it("folds a backtick-quoted 'other'-kind identifier to lower", () => {
		expect(foldIdentifier("`MyCol`", "bigquery", "other")).toBe("mycol");
	});
	it("unescapes a backslash-escaped backtick inside a quoted identifier (string-literal escape rules)", () => {
		expect(foldIdentifier("`a\\`b`", "bigquery", "other")).toBe("a`b");
	});
	it("defaults kind to 'other' (folds) when not given", () => {
		expect(foldIdentifier("MyTable", "bigquery")).toBe("mytable");
	});
});

describe("redshift", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "redshift")).toBe("mytable");
	});
	it("folds quoted identifiers to lower too (case-sensitive-identifier param defaults off)", () => {
		expect(foldIdentifier('"MyTable"', "redshift")).toBe("mytable");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "redshift")).toBe('a"b');
	});
	// issue #22: the vendor fold is ASCII-only ("ASCII letters … are folded to lowercase"):
	// Ä and ä are distinct identifiers; A and a still conflate.
	it("keeps non-ASCII case distinctions (ASCII-only fold)", () => {
		expect(foldIdentifier("Äx", "redshift")).not.toBe(foldIdentifier("äx", "redshift"));
		expect(foldIdentifier('"Äx"', "redshift")).not.toBe(foldIdentifier('"äx"', "redshift"));
		expect(foldIdentifier("Ax", "redshift")).toBe(foldIdentifier("ax", "redshift"));
	});
});

describe("postgres", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "postgres")).toBe("mytable");
	});
	it("preserves case inside quotes (case-sensitive)", () => {
		expect(foldIdentifier('"MyTable"', "postgres")).toBe("MyTable");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "postgres")).toBe('a"b');
	});
	it('unquoted foo equals quoted "foo" but not quoted "Foo"', () => {
		const unquoted = foldIdentifier("foo", "postgres");
		expect(unquoted).toBe(foldIdentifier('"foo"', "postgres"));
		expect(unquoted).not.toBe(foldIdentifier('"Foo"', "postgres"));
	});
	// issue #22: unquoted downcasing is ASCII-only in a UTF-8 database (pg_ascii_tolower):
	// Ä and ä stay distinct unquoted; A and a still conflate.
	it("keeps non-ASCII case distinctions in unquoted identifiers (ASCII-only fold)", () => {
		expect(foldIdentifier("Äx", "postgres")).not.toBe(foldIdentifier("äx", "postgres"));
		expect(foldIdentifier("Ax", "postgres")).toBe(foldIdentifier("ax", "postgres"));
	});
});

describe("duckdb", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "duckdb")).toBe("mytable");
	});
	it("folds quoted identifiers to lower too (quoting is display-preserving only, not identity)", () => {
		expect(foldIdentifier('"MyTable"', "duckdb")).toBe("mytable");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "duckdb")).toBe('a"b');
	});
	// issue #22: vendor-documented: "Case-insensitivity is implemented using an ASCII-based
	// comparison: col_A and col_a are equal but col_á is not equal to them."
	it("keeps non-ASCII case distinctions (ASCII-only fold)", () => {
		expect(foldIdentifier("Äx", "duckdb")).not.toBe(foldIdentifier("äx", "duckdb"));
		expect(foldIdentifier('"Äx"', "duckdb")).not.toBe(foldIdentifier('"äx"', "duckdb"));
		expect(foldIdentifier("Ax", "duckdb")).toBe(foldIdentifier("ax", "duckdb"));
	});
});

describe("trino", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("MyTable", "trino")).toBe("mytable");
	});
	it("folds quoted identifiers to lower too (docs state identifiers are uniformly not case sensitive)", () => {
		expect(foldIdentifier('"MyTable"', "trino")).toBe("mytable");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "trino")).toBe('a"b');
	});
});

describe("sqlite", () => {
	it("folds unquoted mixed case to lower", () => {
		expect(foldIdentifier("Foo", "sqlite")).toBe("foo");
	});
	it("folds double-quoted identifiers to lower too (SQLite quirk: quoting does NOT make it case-sensitive, unlike Postgres)", () => {
		expect(foldIdentifier('"Foo"', "sqlite")).toBe("foo");
	});
	it("folds bracket- and backtick-quoted identifiers to lower too", () => {
		expect(foldIdentifier("[Foo]", "sqlite")).toBe("foo");
		expect(foldIdentifier("`Foo`", "sqlite")).toBe("foo");
	});
	it("unescapes a doubled double-quote inside a quoted identifier", () => {
		expect(foldIdentifier('"a""b"', "sqlite")).toBe('a"b');
	});
	it('unquoted Foo equals unquoted foo, AND equals quoted "Foo" (the SQLite quoted-insensitive quirk)', () => {
		const unquoted = foldIdentifier("Foo", "sqlite");
		expect(unquoted).toBe(foldIdentifier("foo", "sqlite"));
		expect(unquoted).toBe(foldIdentifier('"Foo"', "sqlite"));
	});
	// issue #22: sqlite3StrICmp is ASCII-only: Ä and ä are distinct identifiers.
	it("keeps non-ASCII case distinctions (ASCII-only fold)", () => {
		expect(foldIdentifier("Äx", "sqlite")).not.toBe(foldIdentifier("äx", "sqlite"));
		expect(foldIdentifier('"Äx"', "sqlite")).not.toBe(foldIdentifier('"äx"', "sqlite"));
		expect(foldIdentifier("Ax", "sqlite")).toBe(foldIdentifier("ax", "sqlite"));
	});
});

describe("mysql", () => {
	it("folds unquoted mixed case to lower (column/alias names are case-insensitive on every platform)", () => {
		expect(foldIdentifier("Amount", "mysql")).toBe("amount");
	});
	it("folds backtick-quoted identifiers to lower too, so a backtick-quoted name equals its unquoted spelling", () => {
		expect(foldIdentifier("`Amount`", "mysql")).toBe("amount");
		expect(foldIdentifier("`Amount`", "mysql")).toBe(foldIdentifier("amount", "mysql"));
	});
	it("unquoted Amount equals unquoted amount, AND equals backtick-quoted `Amount` (column/alias case-insensitivity, not a quoting-based distinction)", () => {
		const unquoted = foldIdentifier("Amount", "mysql");
		expect(unquoted).toBe(foldIdentifier("amount", "mysql"));
		expect(unquoted).toBe(foldIdentifier("`Amount`", "mysql"));
	});
	it("unescapes a doubled backtick inside a quoted identifier", () => {
		expect(foldIdentifier("`a``b`", "mysql")).toBe("a`b");
	});
	// issue #22 audit outcome: mysql stays Unicode-wide: the manual does not scope its
	// case-insensitivity to ASCII, and identifier comparison is Unicode-collation-based
	// (general_ci conflates Ä/ä). Deliberate contrast with the ascii-lower dialects above.
	it("conflates non-ASCII case (Unicode-wide fold, unlike sqlite/postgres/duckdb/redshift)", () => {
		expect(foldIdentifier("Äx", "mysql")).toBe(foldIdentifier("äx", "mysql"));
	});
});

describe("undefined/unknown dialect throws — sqllens applies no default fallback", () => {
	it("throws on an undefined dialect", () => {
		expect(() => foldIdentifier("MyTable", undefined)).toThrow(/no behavior for dialect/);
	});
	it("throws on an unrecognized dialect string", () => {
		expect(() => foldIdentifier("`MyTable`", "not-a-real-dialect")).toThrow(/no behavior for dialect/);
	});
	it("throws on an Object.prototype key (never reads it off the rule table)", () => {
		expect(() => foldIdentifier("x", "constructor")).toThrow(/no behavior for dialect/);
		expect(() => displayName("`MyTable`", "constructor")).toThrow(/no behavior for dialect/);
	});
});
