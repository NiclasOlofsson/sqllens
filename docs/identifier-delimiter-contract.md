# Identifier delimiter contract: per IR field, per dialect

Five IR string fields carry identifier text read straight from the parse tree:
`ColumnRef.parts`, `TableSource.name`, `TableSource.alias`, `CteDef.name`, and
`Projection.name`. Each dialect's `lower.ts` decides, independently, whether that
text keeps its quoting delimiters (backticks, double quotes, `[brackets]`) or
strips them. This page records the CURRENT answer for all 40 (field × dialect)
cells, verified against HEAD `6eb49cb` by reading each dialect's identifier-text
helper and by parsing a probe query per dialect. (SQLite was added later and is
verified separately, below.)

The inconsistency below is real and intentionally NOT unified: normalizing
it would change what existing consumers already see in these fields, risking a
regression for no offsetting fix (nothing here is a bug; every dialect's choice
is deliberate, see `src/ident/fold.ts`). What removes the need to care: the raw
delimited form is always recoverable, regardless of what a field's own string
strips, via `partSpanOf`/`partSpansOf` (exported from the barrel, `src/index.ts`)
applied to the field's raw-CST-backref sibling plus the original source text.
A span's offsets index straight into the source, never through the
possibly-stripped string. So a consumer that needs the exact written form (to
decide whether to re-quote on rewrite, for instance) uses the span, not the
string.

## The contract

| IR field            | databricks | tsql   | snowflake | bigquery       | redshift | postgres | duckdb | trino  | sqlite | mysql |
| -------------------- | ---------- | ------ | --------- | -------------- | -------- | -------- | ------ | ------ | ------ | ----- |
| `ColumnRef.parts`     | kept       | kept   | kept      | **stripped**   | kept     | kept     | kept   | kept   | kept   | kept  |
| `TableSource.name`    | kept       | kept   | kept      | **stripped**   | kept     | kept     | kept   | kept   | kept   | kept  |
| `TableSource.alias`   | kept       | kept   | kept      | **stripped**   | kept     | kept     | kept   | kept   | kept   | kept  |
| `CteDef.name`         | kept       | kept   | kept      | **stripped**   | kept     | kept     | kept   | kept   | kept   | kept  |
| `Projection.name`     | kept       | kept   | kept      | **stripped**   | kept     | kept     | kept   | kept   | kept   | kept  |

"Kept" means `` `col` ``/`"col"`/`[col]` arrives in the string with its delimiters
still on it. "Stripped" means the delimiters are gone and the string is the bare
name (`col`).

BigQuery is the sole outlier: it strips uniformly across all five fields.
Every other dialect keeps delimiters intact, uniformly, across all five fields.
BigQuery's `lower.ts` funnels every identifier read through `identText()` /
`stripBackticks()`; the code documents this as a deliberate exception (comment at
`src/bigquery/lower.ts`, near `identText`): BigQuery's case-fold rules
(`src/ident/fold.ts`) treat a backtick-quoted identifier exactly like its
unquoted twin for every kind (tables preserve case, everything else lowers,
quoted or not), so stripping at lower time loses no identity information. It
is also structurally required, because one backticked token can embed a
whole dotted path (`` `proj.ds.t` ``) that must still be split into separate name
parts.

Every other dialect's `lower.ts` reads identifier text through a small
`textOf`/`idText`/`getText()`-only helper with no stripping; postgres, redshift,
duckdb, and trino even carry the same doc comment on it verbatim: *"Identifier
text, RAW — delimiters intact (quotedness must survive into the IR; comparisons
fold via `foldIdentifier`, display via `displayName`)."* Case-folding and
delimiter-stripping for identity/display purposes happen downstream, in
`src/ident/fold.ts`'s `foldIdentifier`/`displayName`, never inside `lower()`
itself for these dialects.

SQLite (added after the original eight-dialect audit) follows the same "keep
raw" pattern: its `lower.ts` reads identifier text through plain `.getText()`,
kept intact across all five fields. Its quoting styles are `"double-quoted"`,
`[bracketed]`, and `` `backtick-quoted` `` — SQLite accepts all three as
identifier delimiters (plus `'single-quoted'` in string-literal-fallback
contexts). The SQLite-specific quirk lives downstream in `foldIdentifier`
(`src/ident/fold.ts`), not in this raw-field contract: unlike Postgres, SQLite
folds a *quoted* identifier case-insensitively too (`"Foo"` and `"foo"` name
the same column) — quoting suppresses SQLite's normal keyword handling, not its
case-insensitivity.

MySQL follows the same "keep raw" pattern too: its `lower.ts` reads identifier
text through plain `.getText()`, delimiters intact across all five fields. Its
only identifier-quoting delimiter is `` `backtick-quoted` `` — a bare `"..."` is
a STRING_LITERAL by default (`MysqlLexer.g4` only defines `REVERSE_QUOTE_ID` for
identifiers; `DOUBLE_QUOTE_ID` is commented out, matching MySQL's own
`ANSI_QUOTES`-off default). The fold rule (`src/ident/fold.ts`'s `mysql` entry)
folds both unquoted AND backtick-quoted identifiers case-insensitively for
column/alias/CTE/field names (`` `Amount` `` and `amount` name the same column)
— MySQL's own docs are explicit that this holds "on any platform" for those
kinds. Table/database names are the one exception, and it's platform-dependent
(`lower_case_table_names`, not discoverable from SQL text alone): see the
`mysql` entry's doc comment in `src/ident/fold.ts` for the exact default-per-OS
breakdown and the narrow case it gets wrong. Separately, an UNSPACED dot (`a.b`,
how it's normally written) lexes as one fused `DOT_ID` token in this grammar
fork; the part after the dot still gets a real `PartSpan` — `dottedParts` in
`src/mysql/lower.ts` computes it from the token (one char past the dot; the
lexer admits only plain identifier chars there, so no delimiter can hide in
it), field-identical to the span a spaced `a . b` produces. Both
`ColumnRef.partSpans` and `TableSource.namePartSpans` are present for either
spelling, and the recovery path in the next section applies normally.

## Recovering the raw form regardless of a field's own stripping

| Stripped/kept field  | Raw-CST-backref sibling                  | How to recover the exact written text                                                                                                                                   |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ColumnRef.parts`     | `ColumnRef.partSpans` (`PartSpan[]`)      | Already a parallel array of per-part spans — slice the source text at each span directly. Present only when every part came from a real token (all-or-nothing).           |
| `TableSource.name`    | `TableSource.namePartSpans` (`PartSpan[]`)| Same as above — a parallel per-segment span array; slice the source text at each span.                                                                                     |
| `TableSource.alias`   | `TableSource.aliasCst` (CST node)         | `partSpanOf(tableSource.aliasCst)` → one `PartSpan`; slice the source text at `[span.start, span.end)`. Present only when the source is aliased.                           |
| `CteDef.name`         | `CteDef.nameCst` (CST node)               | `partSpanOf(cteDef.nameCst)` → one `PartSpan`; slice the source text. Absent only for a genuinely nameless/broken CTE (mid-edit input).                                    |
| `Projection.name`     | `Projection.aliasCst` (CST node)          | `partSpanOf(projection.aliasCst)` → one `PartSpan`; slice the source text. Present **only** when the projection carries an EXPLICIT alias in source (with or without `AS`). |

The last row has one nuance: `Projection.name` can also be a **derived** name: a
bare column reference's own trailing part, when the projection has no explicit
alias (`SELECT "t"."c" FROM …` → `name` is `` "c" ``/`c` depending on dialect,
with no `AS`). In that case `aliasCst` is absent by design (it marks "explicit
alias present", not "name present"). The raw form is instead recoverable from
that same expression's `ColumnRef.partSpans`, the last entry, since a derived
projection name and the underlying column reference's last part are the same
identifier occurrence.

`partSpanOf`/`partSpansOf` live in `src/ir/part-span.ts` and are exported from
the public barrel (`src/index.ts`). A span's `start`/`end` are absolute
character offsets into the original source string passed to `parse()`. They
index the source directly, so recovery works identically whether the
corresponding field's own string happened to strip delimiters (BigQuery) or not
(every other dialect).

## Note on the 2026-07-05 anvil measurement

An earlier anvil measurement (channel message 2026-07-06 16:05, referring to a
2026-07-05-vintage check) claimed `ColumnRef.parts` arrives double-quote-stripped
in snowflake and postgres. That does not hold against current HEAD:
verified both by direct source inspection (`nameParts`/`textOf` in
`src/snowflake/lower.ts` and `src/postgres/lower.ts` call plain `.getText()`,
with postgres's `textOf` explicitly commented "RAW — delimiters intact") and by
parsing `` SELECT "t"."c" AS "o" FROM "db"."tbl" AS "t" `` through both dialects:
`parts` comes back as `["\"t\"", "\"c\""]`, quotes intact, for both. The rest of
that measurement holds up: databricks' column-parts helper using `getText()`
(backticks kept), BigQuery's `identText()` stripping backticks, and
`TableSource.alias` / `CteDef.name` arriving delimiter-intact.

The most likely source of the discrepancy: `src/ident/fold.ts` exports
`displayName(raw, dialect)`, a presentation helper that strips a dialect's
delimiters (unescaping the body) with no case change, called downstream of
`lower()` by `src/symbols/symbols.ts`, `src/references/references.ts`, and
`src/completion/complete.ts`, for every dialect, not only snowflake/postgres
(scope.ts and qualify.ts do not import it). A consumer inspecting an
already-folded/displayed value
(rather than the raw `ColumnRef.parts` field straight off `lower()`) would see a
quote-stripped string regardless of dialect, which is a fold-layer view, not
the IR field's own contract. This page is scoped to the raw field as `lower()`
produces it, before any fold/display step.
