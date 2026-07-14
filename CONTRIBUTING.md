# Contributing to sqllens

## Setup

```bash
npm install
npm run gen:all             # generate the TypeScript parsers for every dialect
npm run typecheck
npm test
```

`src/generated/` is gitignored build output. `npm run gen:all` regenerates every
dialect's parser (the lexer generates before the parser; the driver handles the
ordering). Run it after a fresh clone or any `.g4` edit, or the barrel import fails
and every test errors. To regenerate one dialect, `npm run gen -- <dialect>`
(`databricks | tsql | snowflake | bigquery | redshift | postgres | duckdb | trino`).
Never hand-edit generated files.

## Commands

| Command | What it does |
|---|---|
| `npm run gen:all` | generate the TypeScript parsers for every dialect |
| `npm run gen -- <dialect>` | generate the parser for one dialect |
| `npm run typecheck` | type-check with `tsgo` (`tsc` is the fallback) |
| `npm test` | tier 1: units, features; excludes the corpus gates (~1 min) |
| `npm run test:corpus` | tier 2: the conformance corpus gates (~3–5 min) |
| `npm run test:all` | both tiers |
| `npx vitest run tests/<file>` | run one test file |
| `npm run build` | generate + compile to `dist/` (JS + `.d.ts`), the published package |
| `npm run format` | format with Prettier |

## The gate is the corpus

Conformance corpora are the source of truth. A grammar change that regresses a
corpus is not done. Grammar work is test-driven:

1. Add a corpus case (or a probe) that fails.
2. Edit the `.g4`.
3. Regenerate, run the gate until it is green.
4. Commit.

## The conformance corpus

The gates run against a private corpus of roughly 50,000 SQL files: vendor
documentation examples, upstream grammar test suites, and real-world query sets,
organized per dialect. It is not public. Much of it is copyrighted vendor
documentation or proprietary customer SQL we have no right to redistribute, and at
that size it would not belong in the source tree anyway.

The corpus lives in a separate repository, located through the `SQL_CORPUS_DIR`
environment variable (a local `.env` at the repo root is an optional override):

```bash
setx SQL_CORPUS_DIR "C:\path\to\sqllens-corpus"   # Windows (persistent user var)
export SQL_CORPUS_DIR=/path/to/sqllens-corpus      # macOS / Linux
```

You don't need the corpus to contribute: tier-1 `npm test` runs the unit and feature
suites without it. When the corpus is absent the gates (`tests/corpus/**`,
`npm run test:corpus`) skip themselves instead of failing, so a green run with it
missing proves less than it looks like; check the skip count before trusting a gate.

## Adding or changing a dialect

A dialect touches four places:

- `grammars/<dialect>/`: the split `.g4` pair (lexer + parser).
- `src/<dialect>/parse.ts`: the parse wrapper.
- `src/<dialect>/lower.ts`: CST to the shared IR (the only dialect-specific
  lowering).
- `src/infer/dialect.ts`: one entry for per-dialect type knowledge.

Everything downstream of `lower` (scope, qualify, infer, lineage, symbols) is
dialect-neutral and should not need changes.

## Grammar provenance and licenses

The grammars under `grammars/` are forks of upstream ANTLR grammars and keep their
upstream licenses (see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)). When you
touch a grammar:

- Keep the original license header: do not strip or relicense it.
- Record the provenance: every dialect-specific rule should carry a comment that
  links the vendor manual section that justifies it.
- Contribute fixes upstream: where a change fixes a real bug in a grammars-v4
  grammar (T-SQL, Snowflake), send the fix back upstream as well.

## Conventions

- One folder per dialect; no `grammars/core/`. Every dialect grammar is
  standalone.
- Match the surrounding code's conventions; conformance beats personal taste
  inside the codebase.
- Generated TypeScript is build output; commit the `.g4` source, not the output.

See `CLAUDE.md` for the locked design decisions and conventions.
