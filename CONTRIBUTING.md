# Contributing to sqllens

## Setup

```bash
npm install
npm run gen -- databricks   # generate parsers: databricks | tsql | snowflake
npm run gen -- tsql
npm run gen -- snowflake
npm run typecheck
npm test
```

`src/generated/` is gitignored build output — regenerate it with `npm run gen`
after a fresh clone or any `.g4` edit, or every test fails at import. Never
hand-edit generated files.

## Commands

| Command | What it does |
|---|---|
| `npm run gen -- <dialect>` | generate the TypeScript parser for one dialect |
| `npm run typecheck` | type-check with `tsgo` (`tsc` is the fallback) |
| `npm test` | run all suites, including the conformance corpus gates |
| `npx vitest run tests/<file>` | run one test file |
| `npm run format` | format with Prettier |

## The gate is the corpus

Conformance corpora are the source of truth. A grammar change that regresses a
corpus is **not done**. Grammar work is test-driven:

1. Add a corpus case (or a probe) that fails.
2. Edit the `.g4`.
3. Regenerate, run the gate until it is green.
4. Commit.

Some corpora are machine-local or gitignored; their gates skip themselves when the
data is absent, so a green run with a corpus missing proves less than it looks
like — check the skip count before claiming a gate passed.

## Adding or changing a dialect

A dialect touches four places:

- `grammars/<dialect>/` — the split `.g4` pair (lexer + parser).
- `src/<dialect>/parse.ts` — the parse wrapper.
- `src/<dialect>/lower.ts` — CST → the shared IR (the only dialect-specific
  lowering).
- `src/infer/dialect.ts` — one entry for per-dialect type knowledge.

Everything downstream of `lower` (scope, qualify, infer, lineage, symbols) is
dialect-neutral and should not need changes.

## Grammar provenance and licenses

The grammars under `grammars/` are forks of upstream ANTLR grammars and keep their
upstream licenses (see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)). When you
touch a grammar:

- **Keep the original license header.** Do not strip or relicense it.
- **Record the provenance.** Every dialect-specific rule should carry a comment
  linking the vendor manual section that justifies it.
- **Contribute fixes upstream.** Where a change fixes a real bug in a grammars-v4
  grammar (T-SQL, Snowflake), send the fix back upstream as well.

## Conventions

- One folder per dialect; no `grammars/core/`. Every dialect grammar is
  standalone.
- Match the surrounding code's conventions — conformance beats personal taste
  inside the codebase.
- Generated TypeScript is build output; commit the `.g4` source, not the output.

See `CLAUDE.md` for the locked design decisions and conventions.
