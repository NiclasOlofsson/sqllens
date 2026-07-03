# Anvil phase-0 wave — API-delta report

For the dbt Anvil extension side, consuming sqllens as TS source via `sqllens -> src/index.ts`. Keyed
to `.superpowers/sdd/anvil-phase0-brief.md`'s five items. Every entry below is a new or changed export
from `src/index.ts`; nothing else in the public surface moved. All five items landed on all **eight**
dialects (databricks, tsql, snowflake, bigquery, redshift, postgres, duckdb, trino — the brief predates
trino, which joined the roster before this wave started; P1-P4 all cover it).

Full per-task detail lives in `.superpowers/sdd/task-p{1,2,3}-report.md`; this report is the consumer-
facing summary plus the two P4 verification items.

---

## Item 1 — Join / JoinKind + SelectExpr.joins (CRITICAL PATH)

**New exports:** `Join`, `JoinKind` (types, from `src/ir/ir.ts`).
**New field:** `SelectExpr.joins?: Join[]` — additive, source order, `undefined` (not `[]`) when there
is no explicit JOIN. `from`/`joinConditions` are byte-identical to before (proven by a corpus-wide
hash-diff oracle, see task-p1-report.md).

```ts
export type JoinKind =
	| "inner" | "left" | "right" | "full"   // ANSI qualified joins
	| "cross"                                // CROSS JOIN (comma-separated sources are NOT joins)
	| "semi" | "anti"                        // Spark/Databricks LEFT SEMI/ANTI; DuckDB SEMI/ANTI
	| "asof" | "positional"                  // Snowflake/DuckDB ASOF; DuckDB POSITIONAL
	| "natural" | "lateral";                 // a bare NATURAL / LATERAL join carrying no ANSI type

export interface Join {
	kind: JoinKind;
	source: Source;              // reference-IDENTICAL to the matching SelectExpr.from entry
	on?: Expr;                   // ON predicate — reference-EQUAL to the matching joinConditions entry
	using?: string[];            // USING (col, ...) — mutually exclusive with `on`
	natural?: boolean;
	lateral?: boolean;
	cst: ParserRuleContext;      // spans the full `[type] JOIN ... [ON ...|USING ...]` construct
}
```

**Extension sign-off needed — Trino cumulative spans.** For every dialect except Trino, `join.cst`
isolates the `JOIN x ON ...` text. Trino's `relation` grammar rule is left-recursive, so a JoinRelation
context's span includes its left input — `join.cst` is **cumulative** (`base ... ON`, all three joins in
a chain sharing the same start offset, ordered by increasing stop offset). This is not a defect: it is
exactly the debugger's progressive cumulative slice shape. If the formatter needs an *isolated*
`JOIN x ON ...` span for Trino specifically, no single CST node in this grammar yields one — it would
need a synthetic sub-range computed from the token stream (e.g. from the previous join's stop / the
FROM keyword to this join's stop). Confirm which shape the formatter actually needs before we build
that.

> **ANSWERED 2026-07-03 — cumulative spans are final; no lowering change.** The extension resolved
> this on its own side: `dbt-studio-vscode/src/ftl/sqllens/decompose.ts` `joinLeadToken()` derives each
> join's isolated construct start uniformly across dialects (anchor on the `JOIN` token after the prior
> chain element, walk back over the type-prefix keywords), explicitly citing trino's cumulative
> `join.cst`. The formatter (ninja engine) consumes tokens, not Join spans, so no isolated-span API is
> needed there either. Any future consumer needing isolation uses the same token-anchored recipe.

**Grammar-precision note — DuckDB/Snowflake bare-keyword join-alias ambiguity.** Pre-existing grammar
gap, not introduced by this wave, surfaced while building the Join tests: DuckDB's `SEMI`/`ANTI`/`ASOF`
and Snowflake's `LEFT`/`RIGHT`/`FULL`/`INNER` are non-reserved words, so after a bare left table
(`a SEMI JOIN b` in DuckDB, `t LEFT JOIN u` in Snowflake) the parser reads the keyword as the left
table's alias, producing an inner join instead of the intended kind. Aliasing the left side explicitly
(`a AS x SEMI JOIN b`, `t LEFT OUTER JOIN u`) disambiguates and the lowering is faithful. Not fixed in
this IR-only wave (a fix would reserve the keyword in join position, risking the fallback/positive
corpus ratchets) — flagged as a grammar follow-up.

Other framing decisions worth knowing: T-SQL's `APPLY` is NOT modelled as a Join (no ON, never flowed
through `joinConditions`, stays a plain `from` source); nested/parenthesized join groups get no Join
nodes (top-level FROM chain only — the debugger's actual slice target); LATERAL's flag is only set where
the grammar carries an explicit LATERAL token on the JOIN construct itself (databricks) — where LATERAL
is modelled as a source instead (trino/bigquery/snowflake/redshift/postgres), the flag is unset.

## Item 2 — PartSpan / ColumnRef + partSpans on column Expr + Sym

**New export:** `PartSpan` (type, from `src/ir/ir.ts`).
**Newly-exported existing type:** `ColumnRef` (was internal before this wave).
**New fields (all optional, additive):** `ColumnRef.partSpans?: PartSpan[]`, the `column` Expr variant's
`partSpans?: PartSpan[]`, and `Sym.partSpans?: PartSpan[]` on column-reference symbols.

```ts
export interface PartSpan {
	start: number;  // absolute char offset, inclusive (0-based)
	end: number;    // absolute char offset one-past-last, exclusive (0-based)
	line: number;   // 1-based   (matches SyntaxDiagnostic)
	column: number; // 0-based   (matches SyntaxDiagnostic)
}
```

**All-or-nothing rule** (the contract to code against): `partSpans` is present only when *every* part of
that reference was read from a real token. If even one part was synthesized (a dotted `getText()` split
with no per-part token, a `$n` positional part, a dot-fused path segment) the whole array is omitted —
never a partially-populated array with gaps. So: `partSpans`, when present, is guaranteed the same
length as `parts` and 1:1 aligned; when absent, fall back to the whole-reference span as today.

Spans include each part's own quoting delimiters (`"a b"` spans the quotes, `[a]` the brackets,
`` `a` `` the backticks) but exclude the dots — the extension maps a cursor offset directly against
each part's span without needing to special-case quote characters.

Known omission classes (documented per-dialect in task-p2-report.md): postgres/redshift/duckdb omit
`partSpans` on the intermediate column of a subscript chain (`r.a[1]` -> the `r.a` ref has no spans even
though `r`/`a` have real tokens); postgres/tsql/snowflake/trino omit it when name resolution fell back to
a dotted `getText()` split; bigquery omits it for dot-fused paths (backtick-quoted `` `a.b` `` or a
reserved-keyword `DOT_IDENTIFIER` segment); snowflake omits it for the `$n` positional part. All are
conservative (present implies aligned), not silent misalignment.

## Item 3 — dialectSymbols (dialect-neutral membership sets)

**New export:** `dialectSymbols` (function), `DialectSymbols` (type), from `src/dialect-symbols.ts`
(re-exported via `src/api.ts`).

```ts
export interface DialectSymbols {
	functions: ReadonlySet<string>;
	keywords: ReadonlySet<string>;
	types: ReadonlySet<string>;
}
export function dialectSymbols(dialect: Dialect): DialectSymbols;
```

Canonical UPPERCASE strings in every set; computed once per dialect and cached (repeat calls for the
same dialect return the identical `Set` instances — safe to call once per session per dialect as the
brief specifies, no need for the extension to cache it itself).

**Semantics and documented limits, per set** (full sourcing detail in the module header,
`src/dialect-symbols.ts`, and task-p3-report.md):

- **functions** — union of the dialect's type-inference registry keys, curated + harvested signature
  tables, and (databricks only) the six Spark higher-order-function names that bypass the registry.
  LIMIT: not the dialect's full builtin surface, only names the inference/signature layers already know
  — absence is not proof a function doesn't exist (the project's "never guess" contract means an
  unrecognized function infers `unknown` rather than getting registered here either).
- **keywords** — every generated-lexer token type with a fixed string literal (e.g. `AGGREGATE: 'AGGREGATE';`),
  filtered to bare-word literals, uppercased. LIMIT: "lexed as a fixed string token" is broader than "SQL
  standard reserved word" — these grammars lex plenty of non-reserved/contextual keywords as exact
  literals too (`QUALIFY`, `PIVOT`). That is the right membership check for a capitalization/reserved-word
  lint rule, but don't read it as an ANSI reserved-word list.
- **types** — union of each dialect's scalar-type-alias table's keys (alias spellings, e.g. `nvarchar`)
  and values (canonical targets, e.g. `string`). **Gap class, tightened in this wave (P3 review
  follow-up):** a canonical, non-reserved type name that is lexed as a plain identifier (not a fixed
  keyword token) and never appears as an alias *target* either — because it needs no spelling
  normalization and nothing else maps onto it — is absent from `types` entirely. Concretely: postgres
  `JSONB`/`UUID`/`INET`/`CIDR`/`MACADDR`/`POINT` and the equivalent contextually-lexed type names in
  other dialects are **not** members of `types` (nor `keywords`, since they aren't reserved lexer
  literals either) — they are simply invisible to this API. If the extension's lint rules need to
  recognize these, they are a genuine gap, not a lookup miss.

Per-dialect set sizes are in task-p3-report.md; they'll drift as the inference/signature registries grow
and shouldn't be treated as a stable contract.

## Item 4 — batch (multi-statement) parse parity

**No new exports.** Verification only, per the brief ("verify first" — item 4 predicted all dialects
already pass, and they do).

**What's pinned** (`tests/batch-parity.test.ts`, tier 1): for all eight dialects, `SELECT 1; SELECT 2;`
parses with 0 syntax errors on the dialect's real batch-level entry rule (`multiStatement` for databricks,
`tsql_file`/`snowflake_file`/`root` for the rest — every one of the eight grammars' entry productions is
already a `;`-separated list, not a single-statement rule), and each dialect's `statementCategories`
(exported from `src/<dialect>/lower.ts`, not from the public API — an internal building block, imported
directly the way `tests/ir.join.test.ts` does) reports exactly `["query", "query"]` in source order.
T-SQL additionally proves the unterminated form (`SELECT 1 SELECT 2`, no semicolons at all) parses
clean too, since its grammar explicitly allows a statement with no trailing `SEMI`.

**No dialect failed.** All nine cases (eight dialects + T-SQL's extra unterminated variant) pass as of
this wave; no grammar changes were made or needed.

**Honest scope caveat — read this before building on it.** This is a **parse-level** parity pin only. It
proves the entry rule accepts a multi-statement batch and that per-statement *categorization* sees two
statements. It does **not** prove per-statement IR: today, `lower()` still produces one dominant body per
parse tree (e.g. databricks flags a >1-element batch as a single `"compound"`-category statement, not two
independent `QueryExpr`s with their own spans). A consumer that wants "give me statement #2's IR /
span so I can slice the source at it" — which is what the SQL debugger's stage-snapshot feature and any
"run just this statement" editor action need — is not yet served. That per-statement IR arrives with the
**editor-gold wave's statement-cell work** (not scoped to this phase-0 wave). Don't build a
per-statement-IR consumer against today's `lower()` output; wait for that wave, or ask if the extension
needs it pulled forward.

## Item 5 — comment tokens through tokenize()

**No new exports.** Verification + gap-fill, per the brief ("verify only").

**Where it was already covered:** `tests/token/tokenize.test.ts` already asserted a `role === "comment"`
token exists for a trailing `--` comment, for 5 of the 8 dialects (databricks/tsql/snowflake/bigquery/
redshift) — role only, no exact-span assertion, no `/* */` case. `tests/token/classify.test.ts` asserted
a `/* c */` block comment classifies `role === "comment"`, but only for databricks, only through the raw
generated lexer (not the public `tokenize()`), and without a span assertion.

**What this wave added** (`tests/tokenize.comments.test.ts`, tier 1, 32 tests): for all eight dialects,
through the public `tokenize(sql, dialect)`, four shapes — `--` trailing at EOF (no newline after), `--`
between two tokens, `/* */` between two tokens, `/* */` trailing at EOF — each asserting (a) the token's
`role` is `"comment"`, (b) the span is self-consistent (`sql.slice(t.start, t.stop + 1) === t.text` — the
actual "exact spans" contract), and (c) the comment body matches what was written.

**Grammar variance worth knowing (not a bug, just a fact to code against):** databricks/trino/bigquery's
`--` comment lexer rule optionally consumes the trailing line terminator into the comment token itself;
postgres/redshift/duckdb/snowflake/tsql's does not (the newline lexes as a separate whitespace token). Both
are legitimate grammar designs. If the extension slices/reconstructs source around a `--` comment, do not
assume a fixed relationship between the comment token's `stop` and the start of the next real token across
dialects — always use the reported spans directly rather than assuming "comment ends at end-of-line."

---

## Acceptance

- `npm test` (tier 1): **1934 passed / 1 skipped** (baseline 1893/1 + 41 new: 9 batch-parity + 32
  comment-token).
- `npm run test:corpus` (tier 2): **30 passed / 10 files**, unchanged — this wave touched no grammar,
  parser, or corpus path (Items 4-5 are read-only verification; the P3 doc fix is a comment-only change).
- `npm run typecheck` (tsgo): clean.
- `prettier --check`: clean on every file this wave touched. (Pre-existing, unrelated warnings on three
  gitignored `.superpowers/sdd/scratch/*` files are untouched scratch artifacts from an earlier task, not
  part of this diff.)

## Commits (this task, P4)

- `9cd0a7b` feat(anvil-phase0): batch-parity + comment-token verification pins
- `962a5b7` docs(dialect-symbols): tighten the types-set LIMIT paragraph

(P1-P3's commits are listed in their own task reports.)
