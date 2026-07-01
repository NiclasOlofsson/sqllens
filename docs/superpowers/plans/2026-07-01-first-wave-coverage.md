# First-Wave Coverage Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five highest-leverage coverage holes found in the 2026-07-01 layered review: the Redshift inference registry (27 functions → the documented AWS surface, plus its own literal rules), the Databricks single-statement parse entry (issue #1), LSP acceptance limited to Databricks, LSP schema plumbing (document symbols never get the schema; hover goes dark without a type), and the missing cross-dialect `other`-expression ratchets (D1).

**Architecture:** No new subsystems. Each task extends an existing, proven pattern: the registry follows `src/infer/{snowflake,bigquery}.ts`; the batch entry mirrors the other four dialects' file-level entries; the acceptance matrix reuses the in-memory duplex harness from `tests/lsp.acceptance.test.ts`; the ratchets generalize `tests/ir-completeness.test.ts`'s IR walker over the docs corpora that already gate parsing.

**Tech Stack:** TypeScript (tabs, prettier via `npm run format`), vitest, antlr4ng + antlr-ng (`npm run gen -- databricks` after any `.g4` edit), tsgo (`npm run typecheck`).

## Global Constraints

- Inference contract: a missing function rule yields `unknown`, **never a wrong type** — do not guess return types; entries are doc-cited (AWS SQL reference for Redshift).
- `src/generated/` is gitignored build output — never hand-edit; regenerate after `.g4` edits.
- The LSP layer (`src/lsp/`) imports the library **only** through `src/index.ts` / `src/api.ts` (plus `vscode-languageserver-*`). New LSP helper files live under `src/lsp/`.
- Corpus gates are the bar: a change that regresses any corpus suite is **not done**. All corpora are present on this machine (`SQL_CORPUS_DIR` in `.env`), so nothing skips.
- Indentation is **tabs**. Run `npm run format` before each commit; `npm run typecheck` must be clean.
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Long-running suites: the docs-corpus and ZetaSQL gates take minutes each — use the per-file vitest commands given in the steps during TDD, and run the full `npm test` only where a step says so.
- If executing with subagents: every subagent runs on **Opus or Sonnet 5**, never Fable (session rule).

---

### Task 1: Redshift literal rules (`redshiftLiteral`)

Redshift currently borrows `databricksLiteral` (`src/infer/dialect.ts:55`), which is wrong dialect knowledge twice over: it types `"…"` double-quoted text as a string (double quotes delimit **identifiers** in Redshift/Postgres) and types `1.5` as `double` (Redshift: a numeric literal with a decimal point is **DECIMAL**; only an exponent form is FLOAT8). Source: AWS docs, "Numeric literals" (`r_numeric_literals671`).

**Files:**
- Modify: `src/infer/redshift.ts` (add `redshiftLiteral`)
- Modify: `src/infer/dialect.ts:4,53-58` (stop importing `databricksLiteral` for redshift)
- Test: `tests/redshift.infer.test.ts` (extend)

**Interfaces:**
- Produces: `export function redshiftLiteral(text: string): Type` in `src/infer/redshift.ts` (consumed by `dialect.ts` and Task 2's tests).

- [ ] **Step 1: Write the failing tests**

Append to `tests/redshift.infer.test.ts` (follow the file's existing imports; add these):

```ts
import { redshiftLiteral } from "../src/infer/redshift.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

describe("redshift literal typing", () => {
	it("types a decimal-point literal as decimal, not double (AWS r_numeric_literals671)", () => {
		expect(redshiftLiteral("1.5")).toEqual(scalar("decimal"));
	});
	it("types an exponent literal as double (float8)", () => {
		expect(redshiftLiteral("1.5e3")).toEqual(scalar("double"));
	});
	it("types a bare integer as int", () => {
		expect(redshiftLiteral("42")).toEqual(scalar("int"));
	});
	it("does NOT treat double-quoted text as a string (identifiers in Redshift)", () => {
		expect(redshiftLiteral('"col"')).toEqual(UNKNOWN);
	});
	it("types typed literals", () => {
		expect(redshiftLiteral("date '2026-01-01'")).toEqual(scalar("date"));
		expect(redshiftLiteral("timestamp '2026-01-01 00:00:00'")).toEqual(scalar("timestamp"));
		expect(redshiftLiteral("interval '1 day'")).toEqual(scalar("interval"));
	});
	it("NULL is unknown, never guessed", () => {
		expect(redshiftLiteral("NULL")).toEqual(UNKNOWN);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/redshift.infer.test.ts`
Expected: FAIL — `redshiftLiteral` is not exported.

- [ ] **Step 3: Implement `redshiftLiteral` in `src/infer/redshift.ts`**

```ts
const BOOLEAN = scalar("boolean");

/** Redshift literal forms. Numeric rules per the AWS SQL reference "Numeric literals"
 *  (r_numeric_literals671): no decimal point or exponent → integer; a decimal point → DECIMAL;
 *  an exponent → FLOAT8. Double quotes delimit identifiers (Postgres), NOT strings. */
export function redshiftLiteral(text: string): Type {
	const t = text.trim();
	if (/^'/.test(t)) return scalar("string");
	if (/^(true|false)$/i.test(t)) return BOOLEAN;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return scalar("date");
	if (/^time\s*'/i.test(t)) return scalar("time");
	if (/^timestamp\s*'/i.test(t)) return scalar("timestamp");
	if (/^interval\b/i.test(t)) return scalar("interval");
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return scalar("double");
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return scalar("decimal");
	return UNKNOWN;
}
```

In `src/infer/dialect.ts`: import `redshiftLiteral` from `./redshift.js`, use it in the `redshift` entry (`literal: redshiftLiteral`), and drop `databricksLiteral` from that entry (keep the import — databricks still uses it).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/redshift.infer.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add src/infer/redshift.ts src/infer/dialect.ts tests/redshift.infer.test.ts
git commit -m "feat(redshift): own literal-typing rules (decimal point -> decimal; identifiers not strings)

Redshift borrowed databricksLiteral, which typed 1.5 as double (Redshift: decimal)
and \"x\" as a string (Redshift: identifier). AWS r_numeric_literals671.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Redshift function registry build-out (27 → ~250 doc-cited entries)

The registry keys are also the completion function list (`src/completion/complete.ts` enumerates `inferDialect(dialect).functions`), so this task directly fixes Redshift completion/hover/inlay coverage.

**Files:**
- Modify: `src/infer/redshift.ts` (replace `REDSHIFT_FUNCTION_RETURNS`)
- Test: `tests/redshift.infer.test.ts` (extend)

**Interfaces:**
- Consumes: `commonType`, `widenSum` from `src/infer/coerce.js`; `FnRule` from `src/infer/functions.js`.
- Produces: the same `REDSHIFT_FUNCTION_RETURNS: Record<string, FnRule>` export, ~250 entries.

- [ ] **Step 1: Write the failing tests** (append to `tests/redshift.infer.test.ts`)

```ts
import { REDSHIFT_FUNCTION_RETURNS } from "../src/infer/redshift.js";

describe("redshift function registry", () => {
	const rule = (name: string, args: ReturnType<typeof scalar>[] = []) =>
		REDSHIFT_FUNCTION_RETURNS[name]?.(args);

	it("covers the documented AWS surface at real breadth", () => {
		expect(Object.keys(REDSHIFT_FUNCTION_RETURNS).length).toBeGreaterThanOrEqual(200);
	});
	it("date/time: datediff is BIGINT, date_part is DOUBLE, dateadd is TIMESTAMP for date input", () => {
		expect(rule("datediff")).toEqual(scalar("bigint"));
		expect(rule("date_part")).toEqual(scalar("double"));
		expect(rule("dateadd", [scalar("string"), scalar("int"), scalar("date")])).toEqual(scalar("timestamp"));
	});
	it("aggregates: sum widens int->bigint; avg of int is decimal, of double is double", () => {
		expect(rule("sum", [scalar("int")])).toEqual(scalar("bigint"));
		expect(rule("avg", [scalar("int")])).toEqual(scalar("decimal"));
		expect(rule("avg", [scalar("double")])).toEqual(scalar("double"));
	});
	it("SUPER family: json_parse -> super, json_extract_path_text -> string, is_array -> boolean", () => {
		expect(rule("json_parse")).toEqual(scalar("super"));
		expect(rule("json_extract_path_text")).toEqual(scalar("string"));
		expect(rule("is_array")).toEqual(scalar("boolean"));
	});
	it("windows: row_number -> bigint, ratio_to_report -> double, lag follows its input", () => {
		expect(rule("row_number")).toEqual(scalar("bigint"));
		expect(rule("ratio_to_report")).toEqual(scalar("double"));
		expect(rule("lag", [scalar("date")])).toEqual(scalar("date"));
	});
	it("spatial: st_distance -> double, st_intersects -> boolean, st_astext -> string", () => {
		expect(rule("st_distance")).toEqual(scalar("double"));
		expect(rule("st_intersects")).toEqual(scalar("boolean"));
		expect(rule("st_astext")).toEqual(scalar("string"));
	});
	it("conditional: decode types from its result args, not the search args", () => {
		// decode(expr, s1, r1, s2, r2, default): results at 2, 4 and the trailing default.
		expect(
			rule("decode", [scalar("int"), scalar("int"), scalar("string"), scalar("int"), scalar("string"), scalar("string")]),
		).toEqual(scalar("string"));
	});
	it("absent-by-contract: arg-value-dependent functions stay unregistered", () => {
		expect(REDSHIFT_FUNCTION_RETURNS["extract"]).toBeUndefined();
		expect(REDSHIFT_FUNCTION_RETURNS["percentile_cont"]).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/redshift.infer.test.ts`
Expected: FAIL (breadth < 200, missing rules).

- [ ] **Step 3: VERIFY the flagged return types against live AWS docs**

Before writing the table, WebFetch these AWS SQL-reference pages (docs.aws.amazon.com/redshift/latest/dg/) and confirm the noted return types; **adjust or omit** anything that doesn't check out (omission is always safe — the contract yields `unknown`):

| Function | Candidate rule | Page |
|---|---|---|
| MEDIAN | `firstArg` | `r_MEDIAN.html` |
| AVG | int/decimal→decimal, float→double | `r_AVG.html` |
| DATEADD | date/ts→timestamp, time→time | `r_DATEADD_function.html` |
| SIGN | `firstArg` | `r_SIGN.html` |
| GET_ARRAY_LENGTH | `int` (or bigint) | `get_array_length.html` |
| SIZE (SUPER) | `int` | `r_size.html` |
| CURRENT_AWS_ACCOUNT | `string` (or int) | `r_CURRENT_AWS_ACCOUNT.html` |
| ST_GEOHASH | `string` | `ST_GeoHash-function.html` |
| ST_ANGLE | `double` | `ST_Angle-function.html` |
| CONCAT | 2-arg, `string` | `r_CONCAT.html` |
| TRUNC (timestamp) | → `date` | `r_TRUNC_date.html` |
| LISTAGG | `string` | `r_LISTAGG.html` |

- [ ] **Step 4: Replace the registry in `src/infer/redshift.ts`**

Add imports at the top: `import { commonType, widenSum } from "./coerce.js";`. Then replace `REDSHIFT_FUNCTION_RETURNS` with the table below (keep `REDSHIFT_ALIASES` / `redshiftParseType` / `redshiftLiteral` as they are). Every group is doc-cited by its AWS reference section; comment each group accordingly.

```ts
const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const D = scalar("double");
const DEC = scalar("decimal");
const B = scalar("boolean");
const DATE = scalar("date");
const TS = scalar("timestamp");
const BIN = scalar("binary");
const SUPER = scalar("super");
const GEOM = scalar("geometry");
const GEOG = scalar("geography");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN;
const common: FnRule = (args) => commonType(args);
const restCommon: FnRule = (args) => commonType(args.slice(1)); // nvl2(x, a, b) → common(a, b)

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

/** DECODE(expr, search, result [, search, result]… [, default]) → the common type of the
 *  RESULT arguments (and the trailing default when present), never the search arguments. */
const decodeRule: FnRule = (args) => {
	const results: Type[] = [];
	for (let i = 2; i < args.length; i += 2) results.push(args[i]);
	if (args.length >= 4 && args.length % 2 === 0) results.push(args[args.length - 1]);
	return commonType(results);
};
/** DATEADD → TIMESTAMP for date/timestamp input; TIME/TIMETZ input keeps its type (r_DATEADD_function). */
const dateaddRule: FnRule = (args) => {
	const last = args[args.length - 1];
	if (last?.kind === "scalar" && (last.name === "time" || last.name === "timetz")) return last;
	return TS;
};
/** TRUNC(timestamp) → date (r_TRUNC_date); TRUNC(numeric[, scale]) keeps its input type. */
const truncRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "timestamp" || a.name === "date")) return DATE;
	return a ?? UNKNOWN;
};
/** AVG → DECIMAL for integer/decimal input, DOUBLE for float input (r_AVG). */
const avgRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "double" || a.name === "float")) return D;
	return DEC;
};

/** Function return-type registry for Amazon Redshift, from the AWS SQL reference (the language
 *  spec — the docs corpus is only a validation gate). Absent entries are functions whose
 *  documented return type is argument-value-dependent (EXTRACT, PERCENTILE_CONT/DISC) — those
 *  stay `unknown` by contract rather than risking a wrong type. */
export const REDSHIFT_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- String functions → varchar ---
	...group(fixed(S), [
		"btrim", "chr", "concat", "initcap", "left", "lower", "lpad", "ltrim", "quote_ident",
		"quote_literal", "regexp_replace", "regexp_substr", "repeat", "replace", "replicate",
		"reverse", "right", "rpad", "rtrim", "soundex", "split_part", "substr", "substring",
		"translate", "trim", "upper", "collate",
	]),
	// --- String functions → integer positions/lengths ---
	...group(fixed(I), [
		"ascii", "bpcharcmp", "charindex", "difference", "len", "length", "char_length",
		"character_length", "octet_length", "octetindex", "position", "regexp_count",
		"regexp_instr", "strpos", "textlen",
	]),
	strtol: fixed(BIG),
	crc32: fixed(BIG),
	// --- Math functions ---
	...group(fixed(D), [
		"acos", "asin", "atan", "atan2", "cbrt", "cos", "cot", "degrees", "dexp", "dlog1",
		"dlog10", "exp", "ln", "log", "pi", "power", "pow", "radians", "random", "sin",
		"sqrt", "tan",
	]),
	...group(firstArg, ["abs", "ceil", "ceiling", "floor", "round", "sign"]),
	mod: common,
	trunc: truncRule,
	// --- Date/time functions ---
	...group(fixed(TS), ["add_months", "convert_timezone", "getdate", "sysdate", "timezone", "to_timestamp"]),
	...group(fixed(DATE), ["current_date", "last_day", "next_day", "to_date"]),
	...group(fixed(I), [
		"date_cmp", "date_cmp_timestamp", "date_cmp_timestamptz", "date_part_year",
		"interval_cmp", "timestamp_cmp", "timestamp_cmp_date", "timestamp_cmp_timestamptz",
		"timestamptz_cmp", "timestamptz_cmp_date", "timestamptz_cmp_timestamp",
	]),
	datediff: fixed(BIG),
	date_part: fixed(D),
	pgdate_part: fixed(D),
	date_trunc: fixed(TS),
	dateadd: dateaddRule,
	months_between: fixed(D),
	timeofday: fixed(S),
	// EXTRACT is absent by contract: its return type depends on the datepart argument's value.
	// --- Aggregate functions ---
	sum: widenSum,
	avg: avgRule,
	count: fixed(BIG),
	max: firstArg,
	min: firstArg,
	median: firstArg,
	any_value: firstArg,
	listagg: fixed(S),
	...group(fixed(D), ["stddev", "stddev_samp", "stddev_pop", "variance", "var_samp", "var_pop"]),
	...group(fixed(B), ["bool_and", "bool_or"]),
	...group(firstArg, ["bit_and", "bit_or"]),
	// PERCENTILE_CONT/DISC are absent by contract: the type follows the WITHIN GROUP ORDER BY
	// expression, which is not in the call's argument list.
	// --- Window functions ---
	...group(fixed(BIG), ["row_number", "rank", "dense_rank", "ntile"]),
	...group(fixed(D), ["percent_rank", "cume_dist", "ratio_to_report"]),
	...group(firstArg, ["lag", "lead", "first_value", "last_value", "nth_value"]),
	// --- Conditional expressions ---
	coalesce: common,
	nvl: common,
	nvl2: restCommon,
	greatest: common,
	least: common,
	nullif: firstArg,
	decode: decodeRule,
	// --- Data-type formatting ---
	to_char: fixed(S),
	to_number: fixed(DEC),
	text_to_int_alt: fixed(I),
	text_to_numeric_alt: fixed(DEC),
	// --- Hash functions ---
	md5: fixed(S),
	sha: fixed(S),
	sha1: fixed(S),
	sha2: fixed(S),
	func_sha1: fixed(S),
	fnv_hash: fixed(BIG),
	checksum: fixed(I),
	murmur3_32_hash: fixed(I),
	// --- JSON / SUPER functions ---
	json_parse: fixed(SUPER),
	can_json_parse: fixed(B),
	json_serialize: fixed(S),
	json_serialize_to_varbyte: fixed(BIN),
	is_valid_json: fixed(B),
	is_valid_json_array: fixed(B),
	json_array_length: fixed(I),
	json_extract_array_element_text: fixed(S),
	json_extract_path_text: fixed(S),
	json_typeof: fixed(S),
	...group(fixed(B), [
		"is_array", "is_bigint", "is_boolean", "is_char", "is_decimal", "is_float",
		"is_integer", "is_object", "is_scalar", "is_smallint", "is_varchar",
	]),
	decimal_precision: fixed(I),
	decimal_scale: fixed(I),
	size: fixed(I),
	array: fixed(SUPER),
	array_concat: fixed(SUPER),
	array_flatten: fixed(SUPER),
	split_to_array: fixed(SUPER),
	subarray: fixed(SUPER),
	get_array_length: fixed(I),
	// --- VARBYTE functions ---
	from_hex: fixed(BIN),
	to_hex: fixed(S),
	from_varbyte: fixed(S),
	to_varbyte: fixed(BIN),
	getbit: fixed(I),
	// --- System information functions ---
	...group(fixed(S), [
		"current_database", "current_namespace", "current_schema", "current_user",
		"session_user", "user", "version", "current_aws_account",
	]),
	current_user_id: fixed(I),
	pg_backend_pid: fixed(I),
	slice_num: fixed(I),
	...group(fixed(BIG), ["pg_last_copy_count", "pg_last_copy_id", "pg_last_query_id", "pg_last_unload_count"]),
	...group(fixed(B), [
		"has_database_privilege", "has_schema_privilege", "has_table_privilege", "has_assumerole_privilege",
	]),
	// --- Spatial functions (OGC signatures; AWS "Spatial functions") ---
	...group(fixed(D), [
		"st_area", "st_angle", "st_distance", "st_distancesphere", "st_length", "st_perimeter",
		"st_x", "st_xmax", "st_xmin", "st_y", "st_ymax", "st_ymin", "st_z", "st_m",
		"st_zmax", "st_zmin",
	]),
	...group(fixed(B), [
		"st_contains", "st_containsproperly", "st_coveredby", "st_covers", "st_crosses",
		"st_disjoint", "st_dwithin", "st_equals", "st_intersects", "st_isclosed",
		"st_iscollection", "st_isempty", "st_isring", "st_issimple", "st_isvalid",
		"st_overlaps", "st_touches", "st_within",
	]),
	...group(fixed(I), [
		"st_dimension", "st_npoints", "st_nrings", "st_numgeometries",
		"st_numinteriorrings", "st_numpoints", "st_srid",
	]),
	st_geometrytype: fixed(S),
	geometrytype: fixed(S),
	...group(fixed(S), ["st_astext", "st_asewkt", "st_asgeojson", "st_geohash"]),
	...group(fixed(BIN), ["st_asbinary", "st_asewkb"]),
	...group(fixed(GEOM), [
		"st_addpoint", "st_boundary", "st_buffer", "st_centroid", "st_collect", "st_convexhull",
		"st_difference", "st_endpoint", "st_envelope", "st_exteriorring", "st_force2d",
		"st_force3d", "st_force3dm", "st_force3dz", "st_force4d", "st_geometryn",
		"st_geomfromewkb", "st_geomfromtext", "st_geomfromwkb", "st_interiorringn",
		"st_intersection", "st_makeline", "st_makepoint", "st_makepolygon", "st_multi",
		"st_point", "st_pointn", "st_polygon", "st_removepoint", "st_reverse", "st_segmentize",
		"st_setsrid", "st_simplify", "st_startpoint", "st_symdifference", "st_transform",
		"st_union",
	]),
	st_geogfromtext: fixed(GEOG),
	st_geogfromwkb: fixed(GEOG),
};
```

Apply the Step-3 verification results: fix any rule the docs contradict; delete any function the docs don't document. Then delete the old 27-entry table.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/redshift.infer.test.ts tests/redshift.test.ts tests/redshift.ir.test.ts tests/completion/complete.test.ts`
Expected: PASS (completion suite proves the registry keys flow into Redshift completion).

- [ ] **Step 6: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add src/infer/redshift.ts tests/redshift.infer.test.ts
git commit -m "feat(redshift): build out the inference registry (27 -> ~250 doc-cited functions)

Registry keys also feed completion/hover/inlay, so this closes the largest
per-dialect parity hole from the 2026-07-01 layered review.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: LSP schema plumbing — symbols get the schema; hover never goes dark on a known symbol

Two defects from the review: `computeDocumentSymbols` calls `analyze()` bare even when a schema is configured (`src/lsp/features/symbols.ts:30`), and `computeHover` returns null whenever the inferred type is `unknown` (`src/lsp/features/hover.ts:19`) — so without a schema, hover is empty even on symbols the scope tree fully understands.

**Files:**
- Create: `src/lsp/sym-at.ts`
- Modify: `src/lsp/features/hover.ts`, `src/lsp/features/symbols.ts`, `src/lsp/features/definition.ts`, `src/lsp/server.ts:164-168`
- Test: `tests/lsp.feature-hover.test.ts`, `tests/lsp.feature-symbols.test.ts` (extend)

**Interfaces:**
- Produces: `symbolAt(doc: SqlDocument, syms: readonly Sym[], cursor: number, pred?: (s: Sym) => boolean): Sym | undefined` in `src/lsp/sym-at.ts`.
- Changes: `computeDocumentSymbols(doc: SqlDocument, schema?: Schema)` (server passes `config.schema`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/lsp.feature-hover.test.ts` (match its existing import style):

```ts
it("falls back to symbol kind + name when no type is inferable (no schema)", () => {
	const sql = "WITH c AS (SELECT 1 AS x) SELECT x FROM c";
	const doc = SqlDocument.create(sql, "databricks");
	const h = computeHover(doc, { line: 0, character: sql.indexOf("FROM c") + 5 });
	expect(h).not.toBeNull();
	expect((h!.contents as { value: string }).value).toContain("(cte) c");
});
```

Append to `tests/lsp.feature-symbols.test.ts`:

```ts
it("carries inferred types in the outline detail when given a schema", () => {
	const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
	const schema = new Schema({ sales: { amount: "decimal" } });
	const syms = computeDocumentSymbols(doc, schema);
	const amount = syms.find((s) => s.name === "amount");
	expect(amount?.detail).toContain("decimal");
});
```

(Add `import { Schema } from "../src/index.js";` if the file lacks it.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lsp.feature-hover.test.ts tests/lsp.feature-symbols.test.ts`
Expected: FAIL — hover null; `computeDocumentSymbols` takes no schema / detail lacks the type.

- [ ] **Step 3: Implement**

New `src/lsp/sym-at.ts` (span helpers move here from `definition.ts`):

```ts
import type { Span, Sym, SqlDocument } from "../index.js";

// The smallest symbol whose span covers a cursor offset — the shared position→symbol
// lookup for definition (pred: has a definition) and hover's symbol fallback.
export function symbolAt(
	doc: SqlDocument,
	syms: readonly Sym[],
	cursor: number,
	pred: (s: Sym) => boolean = () => true,
): Sym | undefined {
	let best: Sym | undefined;
	for (const s of syms) {
		if (!pred(s)) continue;
		if (!covers(doc, s.span, cursor)) continue;
		if (!best || spanLength(doc, s.span) < spanLength(doc, best.span)) best = s;
	}
	return best;
}

/** Char offset of a span's start: line is 1-based, column 0-based → 0-based line for LineIndex. */
function startOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.line - 1, span.column);
}
function endOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.endLine - 1, span.endColumn);
}
function covers(doc: SqlDocument, span: Span, cursor: number): boolean {
	return startOffset(doc, span) <= cursor && cursor <= endOffset(doc, span);
}
function spanLength(doc: SqlDocument, span: Span): number {
	return endOffset(doc, span) - startOffset(doc, span);
}
```

`src/lsp/features/definition.ts` — replace the body with the shared lookup (delete the now-moved span helpers):

```ts
import type { Location, Position } from "vscode-languageserver-types";
import type { SqlDocument } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";
import { symbolAt } from "../sym-at.js";

export function computeDefinition(doc: SqlDocument, position: Position, uri: string): Location | null {
	const cursor = doc.lines.offsetAt(position.line, position.character);
	const best = symbolAt(doc, doc.analyze().symbols, cursor, (s) => !!s.definition);
	if (!best?.definition) return null;
	return { uri, range: rangeFromSpan(best.definition) };
}
```

`src/lsp/features/hover.ts` — type first, symbol fallback second:

```ts
import type { Hover, Position } from "vscode-languageserver-types";
import { formatType, type Schema, type SqlDocument } from "../../index.js";
import { rangeFromCst, rangeFromSpan } from "../ranges.js";
import { symbolAt } from "../sym-at.js";

// Hover: the inferred type of the expression under the cursor; when inference has no
// answer (no schema, unregistered function), fall back to what the scope tree knows —
// the symbol's kind + name — so hover is never empty on a known symbol.

export function computeHover(doc: SqlDocument, position: Position, schema?: Schema): Hover | null {
	const off = doc.lines.offsetAt(position.line, position.character);
	const hit = doc.nodeAt(off);
	if (hit) {
		const type = doc.analyze(schema).types.typeOf(hit.expr, hit.scope);
		if (type.kind !== "unknown") {
			return { contents: fence(formatType(type)), range: rangeFromCst(hit.expr.cst) };
		}
	}
	const sym = symbolAt(doc, doc.analyze(schema).symbols, off);
	if (!sym) return null;
	const typed = sym.type && sym.type.kind !== "unknown" ? `: ${formatType(sym.type)}` : "";
	return { contents: fence(`(${sym.kind}) ${sym.name}${typed}`), range: rangeFromSpan(sym.span) };
}

function fence(v: string): { kind: "markdown"; value: string } {
	return { kind: "markdown", value: "```\n" + v + "\n```" };
}
```

`src/lsp/features/symbols.ts` — accept the schema, surface types in `detail`:

```ts
export function computeDocumentSymbols(doc: SqlDocument, schema?: Schema): DocumentSymbol[] {
	const out: DocumentSymbol[] = [];
	for (const s of doc.analyze(schema).symbols) {
		if (!include(s)) continue;
		const range = rangeFromSpan(s.span);
		const parts: string[] = [];
		if (s.type && s.type.kind !== "unknown") parts.push(formatType(s.type));
		if (s.frame !== "_main_") parts.push(s.frame);
		out.push({
			name: s.name,
			kind: KIND[s.kind],
			range,
			selectionRange: range,
			detail: parts.length ? parts.join(" — ") : undefined,
		});
	}
	return out;
}
```

(Add `formatType` and `type Schema` to its imports from `../../index.js`.) In `src/lsp/server.ts` `onDocumentSymbol`: `computeDocumentSymbols(doc, config.schema)`.

- [ ] **Step 4: Run to verify pass — including the full LSP suite (behavioral change)**

Run: `npx vitest run tests/lsp.feature-hover.test.ts tests/lsp.feature-symbols.test.ts tests/lsp.feature-definition.test.ts tests/lsp.acceptance.test.ts`
Expected: PASS. If an existing acceptance assertion expected hover `null` where the fallback now answers, update that assertion to the new (better) behavior — do not weaken the fallback.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add src/lsp tests/lsp.feature-hover.test.ts tests/lsp.feature-symbols.test.ts
git commit -m "fix(lsp): pass the configured schema to document symbols; hover falls back to symbol kind+name

Document symbols called analyze() bare even with a schema configured, dropping
types from the outline; hover returned null whenever inference said unknown,
going dark on symbols the scope tree fully resolves.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: LSP acceptance across all five dialects

Every acceptance workspace today is `dialect: "databricks"`; the other four dialects never pass through a server handler in any test. Add a five-dialect matrix over a reusable in-memory harness. The existing `tests/lsp.acceptance.test.ts` stays untouched (its inline harness keeps working); migrating it onto the helper is a follow-up, not this task.

**Files:**
- Create: `tests/helpers/lsp-harness.ts`, `tests/lsp.acceptance.dialects.test.ts`

**Interfaces:**
- Produces: `startLspHarness(files: Record<string, string>): Promise<LspHarness>` with `LspHarness = { root, client, open(name, text): string, waitForDiagnostics(uri), waitForDiagnosticsWhere(uri, pred), dispose() }`.

- [ ] **Step 1: Write the harness helper** — `tests/helpers/lsp-harness.ts`

```ts
// In-memory LSP client/server pair over a duplex stream — the same code path as the stdio
// binary (startServer is shared). Mirrors the plumbing in tests/lsp.acceptance.test.ts.
import { Duplex } from "node:stream";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createConnection } from "vscode-languageserver/node";
import {
	createProtocolConnection,
	StreamMessageReader,
	StreamMessageWriter,
	InitializeRequest,
	DidOpenTextDocumentNotification,
	PublishDiagnosticsNotification,
	type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { startServer } from "../../src/lsp/server.js";

class TestStream extends Duplex {
	_write(chunk: Buffer, _enc: string, done: () => void) {
		this.emit("data", chunk);
		done();
	}
	_read() {}
}

export interface LspHarness {
	root: string;
	client: ReturnType<typeof createProtocolConnection>;
	open(name: string, text: string): string;
	waitForDiagnostics(uri: string): Promise<PublishDiagnosticsParams>;
	waitForDiagnosticsWhere(
		uri: string,
		pred: (d: PublishDiagnosticsParams) => boolean,
	): Promise<PublishDiagnosticsParams>;
	dispose(): void;
}

/** Boot a real server over an in-memory duplex against a temp workspace seeded with `files`. */
export async function startLspHarness(files: Record<string, string>): Promise<LspHarness> {
	const root = mkdtempSync(join(tmpdir(), "sqllens-lsp-"));
	for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);

	const up = new TestStream();
	const down = new TestStream();
	startServer(createConnection(new StreamMessageReader(up), new StreamMessageWriter(down)));

	const client = createProtocolConnection(new StreamMessageReader(down), new StreamMessageWriter(up));
	const diagnosticsByUri = new Map<string, PublishDiagnosticsParams>();
	client.onNotification(PublishDiagnosticsNotification.type, (p) => diagnosticsByUri.set(p.uri, p));
	client.listen();
	await client.sendRequest(InitializeRequest.type, {
		processId: null,
		rootUri: pathToFileURL(root).toString(),
		capabilities: {},
		workspaceFolders: null,
	});

	const open = (name: string, text: string): string => {
		const uri = pathToFileURL(join(root, name)).toString();
		void client.sendNotification(DidOpenTextDocumentNotification.type, {
			textDocument: { uri, languageId: "sql", version: 1, text },
		});
		return uri;
	};
	const waitForDiagnosticsWhere = async (
		uri: string,
		pred: (d: PublishDiagnosticsParams) => boolean,
	): Promise<PublishDiagnosticsParams> => {
		for (let i = 0; i < 100; i++) {
			const d = diagnosticsByUri.get(uri);
			if (d && pred(d)) return d;
			await new Promise((r) => setTimeout(r, 10));
		}
		throw new Error("diagnostics never satisfied predicate for " + uri);
	};

	return {
		root,
		client,
		open,
		waitForDiagnostics: (uri) => waitForDiagnosticsWhere(uri, () => true),
		waitForDiagnosticsWhere,
		dispose: () => {
			client.dispose();
			rmSync(root, { recursive: true, force: true });
		},
	};
}
```

- [ ] **Step 2: Write the failing matrix suite** — `tests/lsp.acceptance.dialects.test.ts`

```ts
// The five-dialect LSP acceptance matrix: one real server, glob-routed dialects, the same
// smoke battery per dialect. The engines are dialect-tested at the library level; this is
// the proof the PROTOCOL layer serves every dialect, not just Databricks.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
	HoverRequest,
	DefinitionRequest,
	ReferencesRequest,
	CompletionRequest,
	SignatureHelpRequest,
	SemanticTokensRequest,
	DocumentSymbolRequest,
	InlayHintRequest,
} from "vscode-languageserver-protocol/node";
import { startLspHarness, type LspHarness } from "./helpers/lsp-harness.js";

const DIALECTS = ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const;

let h: LspHarness;
beforeAll(async () => {
	h = await startLspHarness({
		".sqllens.json": JSON.stringify({
			dialects: DIALECTS.map((d) => ({ files: `**/*.${d}.sql`, dialect: d })),
			default: "databricks",
			schema: "schema.json",
		}),
		"schema.json": JSON.stringify({ sales: { amount: "decimal", id: "int" } }),
	});
});
afterAll(() => h.dispose());

describe.each(DIALECTS)("LSP over %s", (d) => {
	it("valid SQL is diagnostic-clean", async () => {
		const uri = h.open(`ok.${d}.sql`, "SELECT amount FROM sales");
		const diag = await h.waitForDiagnostics(uri);
		expect(diag.diagnostics).toEqual([]);
	});

	it("a syntax error yields a positioned diagnostic", async () => {
		const uri = h.open(`broken.${d}.sql`, "SELECT (1");
		const diag = await h.waitForDiagnosticsWhere(uri, (x) => x.diagnostics.length > 0);
		expect(diag.diagnostics[0].range.start.line).toBe(0);
	});

	it("an unknown column is flagged against the schema", async () => {
		const uri = h.open(`badcol.${d}.sql`, "SELECT nope FROM sales");
		const diag = await h.waitForDiagnosticsWhere(uri, (x) => x.diagnostics.length > 0);
		expect(diag.diagnostics.some((x) => /nope|unknown/i.test(String(x.message)))).toBe(true);
	});

	it("hover reports the schema column type", async () => {
		const uri = h.open(`hover.${d}.sql`, "SELECT amount FROM sales");
		await h.waitForDiagnostics(uri);
		const hov = await h.client.sendRequest(HoverRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: 9 }, // inside `amount`
		});
		expect(hov && JSON.stringify(hov.contents)).toContain("decimal");
	});

	it("definition and references resolve a CTE", async () => {
		const sql = "WITH c AS (SELECT id FROM sales) SELECT id FROM c";
		const uri = h.open(`cte.${d}.sql`, sql);
		await h.waitForDiagnostics(uri);
		const at = { line: 0, character: sql.indexOf("FROM c") + 5 }; // the trailing `c`
		const def = await h.client.sendRequest(DefinitionRequest.type, { textDocument: { uri }, position: at });
		expect(def).toMatchObject({ range: { start: { line: 0, character: 5 } } }); // `c` in `WITH c`
		const refs = await h.client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri },
			position: at,
			context: { includeDeclaration: true },
		});
		expect((refs ?? []).length).toBeGreaterThanOrEqual(2);
	});

	it("completion offers schema columns after SELECT", async () => {
		const uri = h.open(`compl.${d}.sql`, "SELECT  FROM sales");
		await h.waitForDiagnostics(uri);
		const res = await h.client.sendRequest(CompletionRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: 7 },
		});
		const labels = (Array.isArray(res) ? res : (res?.items ?? [])).map((i) => i.label);
		expect(labels).toContain("amount");
	});

	it("signature help tracks the active argument", async () => {
		const sql = "SELECT coalesce(amount, 0) FROM sales";
		const uri = h.open(`sig.${d}.sql`, sql);
		await h.waitForDiagnostics(uri);
		const sig = await h.client.sendRequest(SignatureHelpRequest.type, {
			textDocument: { uri },
			position: { line: 0, character: sql.indexOf(", 0") + 2 },
		});
		expect(sig?.signatures.length ?? 0).toBeGreaterThanOrEqual(1);
		expect(sig?.activeParameter).toBe(1);
	});

	it("semantic tokens are emitted", async () => {
		const uri = h.open(`tok.${d}.sql`, "SELECT amount FROM sales -- note");
		await h.waitForDiagnostics(uri);
		const tok = await h.client.sendRequest(SemanticTokensRequest.type, { textDocument: { uri } });
		expect((tok?.data ?? []).length).toBeGreaterThan(0);
	});

	it("document symbols include the output column", async () => {
		const uri = h.open(`sym.${d}.sql`, "SELECT amount FROM sales");
		await h.waitForDiagnostics(uri);
		const syms = await h.client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
		expect((syms ?? []).map((s: { name: string }) => s.name)).toContain("amount");
	});

	it("inlay hints type the projection", async () => {
		const uri = h.open(`inlay.${d}.sql`, "SELECT amount FROM sales");
		await h.waitForDiagnostics(uri);
		const hints = await h.client.sendRequest(InlayHintRequest.type, {
			textDocument: { uri },
			range: { start: { line: 0, character: 0 }, end: { line: 0, character: 40 } },
		});
		expect(JSON.stringify(hints)).toContain("decimal");
	});
});
```

- [ ] **Step 3: Run the matrix**

Run: `npx vitest run tests/lsp.acceptance.dialects.test.ts`
Expected: mostly PASS. **Any failure here is a finding, not test noise** — a dialect the protocol layer serves worse than Databricks. Diagnose each: if the library engine is at fault, fix it (or, if it is genuinely a separate feature, record it in PLAN.md Open Gaps and adjust the single offending assertion with a comment naming the gap — never delete the dialect from the matrix).

- [ ] **Step 4: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add tests/helpers/lsp-harness.ts tests/lsp.acceptance.dialects.test.ts
git commit -m "test(lsp): acceptance matrix across all five dialects over a reusable in-memory harness

The protocol layer was acceptance-tested for Databricks only; the other four
dialects never passed through a server handler in any test.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Databricks batch parse entry (closes issue #1)

Databricks is the only dialect whose entry accepts a single statement — `SELECT 1; SELECT 2` is a syntax error, i.e. false squiggles on real multi-statement files in the primary dialect. Add a batch entry (`;`-separated, like `tsql_file` / `snowflake_file` / the two `root`s), switch `parseDatabricks` to it, and make `lower()` flag multi-statement input exactly as the other dialects do (`unsupported: ["multi-statement"]`, statement kind `"compound"` — matching `tests/bigquery.test.ts:316`). Statement **modelling** depth is unchanged, per the issue.

Known call sites of the old entry (verified by grep): `src/databricks/parse.ts:56,67` (switch), `src/completion/parser-factory.ts:56-57` (leave — the completion ATN walk is its own risk surface; note as follow-up), `tests/lower-completeness.test.ts:89` (leave — the rule stays in the grammar).

**Files:**
- Modify: `grammars/databricks/DatabricksParser.g4` (add rules after line 90), `src/databricks/parse.ts`, `src/databricks/lower.ts:140-187`
- Test: `tests/databricks.ir.test.ts` or `tests/databricks.test.ts` (whichever holds parse/IR basics — extend), `tests/statement-kind.test.ts`

**Interfaces:**
- Produces: grammar rules `multiStatement` / `multiStatementElement`; `parseDatabricks` unchanged in signature, now accepting batches. Empty input parses clean and lowers flagged `["empty"]`.

- [ ] **Step 1: Write the failing tests**

In the Databricks parse/IR test file:

```ts
describe("batch parse entry (issue #1)", () => {
	it("accepts a multi-statement batch with zero syntax errors", () => {
		expect(parseDatabricks("SELECT 1; SELECT 2").errors).toBe(0);
		expect(parseDatabricks("SELECT 1;;\nSELECT 2;").errors).toBe(0);
	});
	it("lowers a multi-statement batch as one flagged compound (parity with the other dialects)", () => {
		const ir = lower(parseDatabricks("SELECT 1; SELECT 2").tree);
		expect(ir.statement).toBe("compound");
		expect(ir.body.kind === "select" && ir.body.unsupported).toContain("multi-statement");
	});
	it("a single statement with trailing semicolons still lowers fully", () => {
		const ir = lower(parseDatabricks("SELECT a FROM t;").tree);
		expect(ir.body.kind).toBe("select");
		expect(ir.body.kind === "select" && (ir.body.unsupported ?? [])).toEqual([]);
	});
	it("a BEGIN…END compound still parses and flags as compound", () => {
		const r = parseDatabricks("BEGIN SELECT 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.statement).toBe("compound");
	});
	it("empty input parses clean and lowers flagged empty (an editor opens empty files)", () => {
		const r = parseDatabricks("");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.body.kind === "select" && ir.body.unsupported).toContain("empty");
	});
	it("contains an error to its own statement — later statements still lex", () => {
		const r = parseDatabricks("SELECT 1;\nSELEC 2;\nSELECT 3;");
		expect(r.errors).toBeGreaterThan(0);
		// the token stream covers the WHOLE text (statement containment, editor mandate)
		const last = r.tokens[r.tokens.length - 1];
		expect(last.text).toBe(";");
		expect(r.diagnostics[0].line).toBe(2); // the error sits on the broken statement's line
	});
});
```

(Adjust `diagnostics[0].line` to the `SyntaxDiagnostic` field names used in `src/parse-diagnostics.ts` — check that file; the intent is: the first diagnostic points into line 2, not line 1 or 3.)

In `tests/statement-kind.test.ts`, next to the Snowflake case at line 75:

```ts
expect(databricks("SELECT 1; SELECT 2")).toBe("compound");
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/databricks.ir.test.ts tests/statement-kind.test.ts`
Expected: FAIL — `SELECT 1; SELECT 2` currently has syntax errors.

- [ ] **Step 3: Add the grammar rules**

In `grammars/databricks/DatabricksParser.g4`, directly after `singleCompoundStatement` (line 94):

```antlr
// Batch entry: a `;`-separated multi-statement script — parse-entry parity with the other
// dialects (issue #1; tsql_file / snowflake_file / the BigQuery+Redshift `root` are all
// batch-level). Elements are single statements or BEGIN…END scripting compounds. Statement
// MODELLING depth is unchanged: lower() flags a multi-element batch, it does not model it.
multiStatement
    : SEMICOLON* (multiStatementElement (SEMICOLON+ multiStatementElement)* SEMICOLON*)? EOF
    ;

multiStatementElement
    : BEGIN (NOT ATOMIC)? compoundBody? END
    | statement
    | setResetStatement
    ;
```

Regenerate: `npm run gen -- databricks` — must complete without grammar errors.

- [ ] **Step 4: Switch the parse entry**

In `src/databricks/parse.ts`: replace both `parser.compoundOrSingleStatement()` calls (lines 56 and 67) with `parser.multiStatement()`, and update the `ParseResult.tree` doc comment (lines 17-18) to:

```ts
	/** The CST rooted at `multiStatement` (a `;`-separated batch of statements and/or
	 *  BEGIN…END SQL-scripting compounds, + EOF). */
```

- [ ] **Step 5: Teach `lower()` the batch root**

In `src/databricks/lower.ts`, replace `lowerImpl` (lines 140-174) and `statementCategory` (lines 176-187) with:

```ts
/** An empty, flagged body — the stable non-throw shape for anything not modelled. */
function flagged(cst: ParserRuleContext, reason: string, statement: StatementCategory): QueryExpr {
	const body: SelectExpr = {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: [reason],
		cst,
	};
	return { kind: "query", statement, ctes: [], body, cst };
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	// multiStatement root (issue #1): >1 element is a compound script — flagged, not modelled
	// (the issue is parse-entry parity only). 0 elements is an empty file — also flagged,
	// never a throw (an editor opens empty documents).
	const elements = directChildrenOfRule(tree, P.RULE_multiStatementElement);
	if (elements.length > 1) return flagged(tree, "multi-statement", "compound");
	if (elements.length === 0 && tree.ruleIndex === P.RULE_multiStatement) return flagged(tree, "empty", "other");
	const stmt = elements[0] ?? tree; // the single element, or a legacy single-statement root
	const statement = statementCategory(stmt);
	// A BEGIN…END scripting compound is a statement *sequence*, not a query — flag the
	// whole thing rather than modelling whichever SELECT happens to come first inside it.
	if (isCompound(stmt)) return flagged(stmt, "compound", statement);
	const query = firstOfRule(stmt, P.RULE_query);
	if (!query) return flagged(stmt, "non-query", statement);
	const lowered = lowerQuery(query);
	lowered.statement = statement;
	return lowered;
}

/** A BEGIN…END scripting compound: the batch element's BEGIN-led alternative, or a legacy
 *  `singleCompoundStatement` root (other entries into this lowering still work). */
function isCompound(stmt: ParserRuleContext): boolean {
	if (stmt.ruleIndex === P.RULE_multiStatementElement && stmt.start?.type === P.BEGIN) return true;
	return !!firstOfRule(stmt, P.RULE_singleCompoundStatement);
}

/**
 * The statement category, from the parse — not the source text. Spark's `statement` rule labels its
 * alternatives, so the structural cases are exact: a `#dmlStatement` (`ctes? dmlStatementNoWith`) is
 * DML even when written `WITH cte … INSERT …`, and a BEGIN…END compound is its own category. For
 * the remaining keyword-led commands (object DDL, GRANT, SET/USE/SHOW, …) the leading keyword is the
 * authoritative signal — Spark has no grouping rule above them.
 */
function statementCategory(stmt: ParserRuleContext): StatementCategory {
	if (isCompound(stmt)) return "compound";
	if (shallowFirstOfRule(stmt, P.RULE_dmlStatementNoWith)) return "dml";
	return keywordCategory(stmt.start?.text ?? "");
}
```

(The old inline flagged-body literals inside `lowerImpl` are replaced by `flagged`; do not touch `lowerQuery`'s own `unsupported: ["query-body"]` branch.)

- [ ] **Step 6: Run the targeted tests**

Run: `npx vitest run tests/databricks.ir.test.ts tests/statement-kind.test.ts tests/ir/statement-containment.test.ts tests/lsp.acceptance.test.ts tests/lsp.acceptance.dialects.test.ts`
Expected: PASS. Also update the stale comment in `tests/ir/statement-containment.test.ts:17-18` ("databricks' entry is single-statement-oriented") — Databricks is now batch-level; if that suite can simply add databricks to its multi-statement matrix, add it.

- [ ] **Step 7: Full regression — every Databricks gate**

Run: `npx vitest run tests/databricks.local-coverage.test.ts tests/databricks.docs-corpus.test.ts tests/databricks.doc-coverage.test.ts tests/ir-completeness.test.ts tests/conservation.test.ts tests/scope.corpus.test.ts tests/lineage.test.ts tests/symbols.test.ts tests/completion/complete.test.ts`
Expected: ALL PASS (1558-model gate, docs corpus, doc-coverage pins, semantic suites, completion). These corpora are single-statement files, so behavior is identical through the new entry; any regression means the batch rule changed single-statement parsing — stop and fix the grammar, don't adjust gates.

- [ ] **Step 8: Typecheck, format, full suite, commit**

```bash
npm run typecheck && npm run format && npm test
git add grammars/databricks/DatabricksParser.g4 src/databricks/parse.ts src/databricks/lower.ts tests/
git commit -m "feat(databricks): batch parse entry — multi-statement files parse like every other dialect

Closes #1. parseDatabricks now enters multiStatement (;-separated batch, like
tsql_file / snowflake_file / root); a multi-element batch lowers as one flagged
compound (parity with BigQuery/Snowflake/Redshift), single statements are
unchanged. Kills false syntax errors on real multi-statement files in the LSP.
Follow-up (not here): switch the completion parser-factory entry too.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Cross-dialect `other`-expression ratchets (D1)

Only Databricks pins "0 `other` expressions" against a corpus; for the other four dialects an unmodelled expression is silent. Extract the IR walker from `tests/ir-completeness.test.ts` into a helper, then ratchet the `other` count over each dialect's existing corpus (docs query bucket for tsql/snowflake/redshift; ZetaSQL in-scope positives for bigquery), while proving `lower → resolveScopes → deriveSymbols` total. The BigQuery detect-only filter is shared by extracting it from `tests/bigquery.corpus.test.ts`.

**Files:**
- Create: `tests/helpers/ir-walk.ts`, `tests/helpers/googlesql-scope.ts`, `tests/ir-completeness.dialects.test.ts`
- Modify: `tests/ir-completeness.test.ts` (import the walker instead of its local copy), `tests/bigquery.corpus.test.ts` (import the detect-only filter)

**Interfaces:**
- Produces: `walkIr(q: QueryExpr, tally: Map<string, number>, samples: Map<string, string>): void` in `tests/helpers/ir-walk.ts`; `isDetectOnly(sql: string): boolean` and `sqlFiles(dir: string): Generator<string>` in `tests/helpers/googlesql-scope.ts`.

- [ ] **Step 1: Extract the walker**

Create `tests/helpers/ir-walk.ts`: move `walkExpr`, `walkIr`, `walkBody` **verbatim** from `tests/ir-completeness.test.ts:17-90` (imports: `Expr`, `QueryBody`, `QueryExpr` from `../../src/ir/ir.js`; `allPipeStages`, `stageExprs`, `stageSubIr` from `./pipe-walk.js`). Export `walkIr`. Update `tests/ir-completeness.test.ts` to `import { walkIr } from "./helpers/ir-walk.js";` and delete its local copies.

Create `tests/helpers/googlesql-scope.ts`: move `leadKeyword`, `isMacro`, `isEmptyScript`, `DETECT_ONLY_LEAD`, `isDetectOnly`, and `sqlFiles` **verbatim** from `tests/bigquery.corpus.test.ts:18-53` (keep the explanatory comment). Export `isDetectOnly` and `sqlFiles`. Update `tests/bigquery.corpus.test.ts` to import them and delete its local copies.

Run: `npx vitest run tests/ir-completeness.test.ts` (the extraction must not change the Databricks gate)
Expected: PASS.

- [ ] **Step 2: Write the ratchet suite with zero baselines (the measurement run)** — `tests/ir-completeness.dialects.test.ts`

```ts
// The cross-dialect `other` ratchet (D1, 2026-07-01 review): Databricks pins 0 `other`
// expressions over its corpus (tests/ir-completeness.test.ts); nothing measured the other
// four — an unmodelled expression there was silent. This suite runs every in-scope parsed
// example through lower → resolveScopes → deriveSymbols, counts `other` expression nodes,
// and ratchets the count (it may only fall; drive to 0 like Databricks). The failure output
// names the leaking CST node types — that list IS the lower() worklist per dialect.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import type { ParserRuleContext } from "antlr4ng";
import type { QueryExpr } from "../src/ir/ir.js";
import { walkIr } from "./helpers/ir-walk.js";
import { isDetectOnly, sqlFiles } from "./helpers/googlesql-scope.js";
import { classifySql } from "./helpers/sql-kind.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { parseTSql } from "../src/tsql/parse.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";

interface Gate {
	dialect: "tsql" | "snowflake" | "bigquery" | "redshift";
	corpus: string;
	/** In-scope examples: docs query bucket (regex, like the parse gates) or ZetaSQL positives. */
	inScope(sql: string): boolean;
	parse(sql: string): { tree: ParserRuleContext; errors: number };
	lower(tree: ParserRuleContext): QueryExpr;
	/** Measured 2026-07-01 — a ratchet: the count may only fall. 0 = corpus-complete. */
	otherBaseline: number;
}

const GATES: Gate[] = [
	{
		dialect: "tsql",
		corpus: corpusPath("tsql/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseTSql,
		lower: lowerTSql,
		otherBaseline: 0, // ← pinned after the measurement run
	},
	{
		dialect: "snowflake",
		corpus: corpusPath("snowflake/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseSnowflake,
		lower: lowerSnowflake,
		otherBaseline: 0,
	},
	{
		dialect: "bigquery",
		corpus: join(corpusPath("bigquery/zetasql/analyzer"), "positive"),
		inScope: (sql) => !isDetectOnly(sql),
		parse: parseBigQuery,
		lower: lowerBigQuery,
		otherBaseline: 0,
	},
	{
		dialect: "redshift",
		corpus: corpusPath("redshift/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseRedshift,
		lower: lowerRedshift,
		otherBaseline: 0,
	},
];

describe.each(GATES)("`other` ratchet over the $dialect corpus", (g) => {
	it.skipIf(!existsSync(g.corpus))(
		"lower models the corpus; other-count only falls; the pipeline is total",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let parsed = 0;
			let flagged = 0;
			for (const f of sqlFiles(g.corpus)) {
				const sql = readFileSync(f, "utf8");
				if (!g.inScope(sql)) continue;
				let res;
				try {
					res = g.parse(sql);
				} catch {
					continue; // parse-stage failures are the parse gates' business, not this one's
				}
				if (res.errors !== 0) continue;
				parsed++;
				try {
					const ir = g.lower(res.tree);
					if (ir.body.kind === "select" && (ir.body.unsupported?.length ?? 0) > 0) flagged++;
					walkIr(ir, tally, samples);
					deriveSymbols(resolveScopes(ir, g.dialect));
				} catch (e) {
					throwers.push(`${f}: ${String(e).slice(0, 140)}`);
				}
			}
			const total = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			// eslint-disable-next-line no-console
			console.log(
				`\n  ${g.dialect}: ${parsed} parsed, ${flagged} flagged bodies (reported), ` +
					`${total} \`other\` exprs (baseline ${g.otherBaseline})${top ? "\n" + top : ""}`,
			);
			expect(parsed).toBeGreaterThan(0);
			expect(throwers, `pipeline threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${g.otherBaseline} baseline:\n${top}`).toBeLessThanOrEqual(
				g.otherBaseline,
			);
		},
	);
});
```

- [ ] **Step 3: Measurement run**

Run: `npx vitest run tests/ir-completeness.dialects.test.ts`
Expected: the tsql/snowflake/redshift/bigquery blocks likely FAIL against baseline 0 — the console output reports each dialect's real `other` total and its top-10 leaking CST node types. **If any `throwers` appear, that is a totality bug — fix it in the dialect's `lower()`/the shared pass before pinning any baseline** (the no-throw contract is not ratchetable).

- [ ] **Step 4: Pin the measured baselines**

Replace each `otherBaseline: 0` with the measured total, dated:

```ts
		otherBaseline: NNN, // measured 2026-07-01 over MMM parsed examples; may only fall
```

Run: `npx vitest run tests/ir-completeness.dialects.test.ts tests/ir-completeness.test.ts tests/bigquery.corpus.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add tests/helpers/ir-walk.ts tests/helpers/googlesql-scope.ts tests/ir-completeness.dialects.test.ts tests/ir-completeness.test.ts tests/bigquery.corpus.test.ts
git commit -m "test: cross-dialect \`other\`-expression ratchets over the docs/ZetaSQL corpora (D1)

Databricks pinned 0 \`other\` over its corpus; the other four dialects had no
measurement — an unmodelled expression was silent. Ratchets may only fall;
the failure output names the leaking CST node types (the lower() worklist).
Also proves lower -> resolveScopes -> deriveSymbols total per dialect at
corpus scale (deriveSymbols for the first time outside Databricks).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation truth-up and issue close

**Files:**
- Modify: `CLAUDE.md` (Current status: Redshift registry size, own literal rules; Databricks batch entry; LSP acceptance ×5; the new D1 ratchets), `docs/PLAN.md` (Open Gaps: add the measured per-dialect `other` baselines as tracked numbers; note the completion parser-factory entry follow-up)

- [ ] **Step 1:** Update the two docs — current-state statements only, no changelog narrative in CLAUDE.md.
- [ ] **Step 2:** Close the issue: `gh issue close 1 --repo NiclasOlofsson/sqllens --comment "Batch entry shipped: parseDatabricks enters multiStatement; multi-element batches lower flagged (parity with the other dialects). See docs/superpowers/plans/2026-07-01-first-wave-coverage.md Task 5."`
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/PLAN.md
git commit -m "docs: record first-wave coverage state (redshift registry, batch entry, LSP matrix, other-ratchets)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec coverage: B1 → Tasks 1-2; A2 → Task 3; A1 → Task 4; issue #1 → Task 5; D1 → Task 6; docs/issue hygiene → Task 7. ✓
- Type consistency: `flagged()` (Task 5) matches the `SelectExpr`/`QueryExpr` literals already in `lower.ts`; `symbolAt` (Task 3) is consumed with the exact signature it declares; `walkIr` keeps its original signature. ✓
- Known judgment points made explicit: completion parser-factory stays on the old entry (Task 5, follow-up); baselines are measured-then-pinned (Task 6); VERIFY table before the registry lands (Task 2).
