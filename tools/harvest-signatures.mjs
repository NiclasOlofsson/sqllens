// Harvest per-dialect function SIGNATURES (parameter names + arity + variadic) from the docs
// corpora into committed, generated tables `src/signature/generated/<dialect>.ts`. Signature help
// (src/signature/signature.ts) reads these AFTER the hand-curated FUNCTION_SIGNATURES table, so a
// curated entry always wins and the harvest fills the long tail; anything neither table knows still
// degrades to the name-only hint.
//
// NEVER-WRONG CONTRACT: a signature is emitted ONLY when its documented syntax block parses
// UNAMBIGUOUSLY into `name(param[, param…])` form — a flat, comma-separated list of plain parameter
// names (optional trailing params flattened in, a `…n`/`...` tail marked variadic). Anything else —
// alternations `{ a | b }`, in-argument clause keywords (FROM/AS/OVER/ORDER/USING), `<angle>` sub-rule
// references, `::=` productions, multi-word params, or two blocks on one page that disagree on the
// parameter list (a genuine overload) — is SKIPPED, counted, and reported. A wrong parameter name or
// arity is worse than the name-only fallback, so we skip aggressively.
//
// SOURCES. The scraped example corpora hold runnable SQL statements, not function-syntax blocks, so
// they can't yield parameter names. Five dialects have an offline source in the corpus repo that DOES
// carry function SYNTAX notation: the T-SQL reference markdown (MicrosoftDocs/sql-docs, vendored at
// vendor/sql-docs), whose ```syntaxsql``` fenced blocks are exactly `NAME ( param , … )`; the DuckDB
// reference markdown (duckdb-web, vendored at vendor/duckdb-web), whose "#### `name(...)`" headings
// are the per-function syntax; the PostgreSQL 18 DocBook SGML reference (vendored at
// vendor/postgres-sgml/func.sgml), whose `<para role="func_signature">` blocks carry the same notation
// in SGML tags; and the Databricks and Snowflake committed syntax tiers (databricks/docs/syntax and
// snowflake/docs/syntax, per-function N.txt Syntax blocks captured by tools/scrape-databricks-syntax.mjs
// and tools/scrape-snowflake-syntax.mjs from the vendor docs). The remaining dialects (bigquery,
// redshift, trino, sqlite, mysql) still have no syntax-notation source in the corpus repo (their docs
// were consumed live by their scrapers and only the extracted example SQL landed there), so they get
// no generated table until their raw docs are vendored or a syntax tier is scraped. Each dialect's
// extractor is registered below; an absent source is reported, not guessed.
//
// MERGE RULE (shared by every extractor, applied once a name's raw occurrences are collected). Occurrences
// are deduped first — an identical param list + variadic flag collapse to one. Among the survivors: if
// every shorter param list is a prefix (name-for-name, and where the dialect tracks types, type-for-type
// too) of one single longest list, they merge into that longest list with the extra tail params marked
// optional. Anything else — two lists that disagree outside a shared prefix, or two lists tied for
// longest with neither a prefix of the other — is a CONFLICT: the name is dropped and nothing is emitted
// for it. A wrong signature is worse than no signature, so ambiguity always loses to omission.
//
// Self-contained by design (repo convention — shares no code with the library). The emitted tables
// are committed, so rebuild AND format after a corpus refresh:
//   node tools/harvest-signatures.mjs && npm run format
// (prettier owns line-wrapping; the harvester emits one entry per line and lets format wrap it.)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "signature", "generated");
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// T-SQL — MicrosoftDocs/sql-docs docs/t-sql/functions/**/*.md, ```syntaxsql``` blocks.
// ---------------------------------------------------------------------------

/** All ```syntaxsql``` fenced blocks in a markdown string. */
function syntaxsqlBlocks(md) {
	const out = [];
	// [^\S\n]* : the docs leave trailing spaces (markdown hard breaks) after the fence info string.
	const re = /```syntaxsql[^\S\n]*\r?\n([\s\S]*?)```/g;
	let m;
	while ((m = re.exec(md))) out.push(m[1]);
	return out;
}

/**
 * Parse ONE syntaxsql block into `{ name, params, variadic }`, or `{ skip: reason }` when it isn't a
 * clean `name(param, …)` signature, or `null` when the block has no function-call line at all. Only
 * the FIRST balanced `( … )` after a leading function name is considered; trailing clauses (OVER,
 * WITHIN GROUP, `[ <order_clause> ]`) are ignored.
 */
function parseTSqlSig(block) {
	const lines = block
		.replace(/\r/g, "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const line = lines.find((l) => /^[A-Za-z_][\w]*\s*\(/.test(l));
	if (!line) return null;
	const name = line.match(/^([A-Za-z_][\w]*)\s*\(/)[1];

	// First balanced paren group on the signature line.
	let depth = 0;
	let start = -1;
	let end = -1;
	for (let i = line.indexOf("("); i < line.length; i++) {
		if (line[i] === "(") {
			if (depth === 0) start = i;
			depth++;
		} else if (line[i] === ")") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (start === -1 || end === -1) return null;

	let inner = line.slice(start + 1, end).trim();
	if (inner === "") return { name, params: [], variadic: false };

	// A `[ , …n ]` / trailing `...` marks the last param as repeating.
	let variadic = false;
	if (/\[\s*,?\s*\.\.\.\s*n?\s*\]|\.\.\.\s*n?\s*$|,\s*\.\.\./.test(inner)) variadic = true;
	inner = inner.replace(/\[\s*,?\s*\.\.\.\s*n?\s*\]/g, "").replace(/\.\.\.\s*n?/g, "");

	// Anything the flat-list model can't represent → skip (never guess).
	if (/[{}|<>]|::=|\bFROM\b|\bAS\b|\bOVER\b|\bUSING\b|\bORDER\b/i.test(inner)) return { skip: "complex" };

	// Flatten SIMPLE optional groups — `[ , x ]` → `, x`, `[ x ]` → `x` — repeatedly. Anything left
	// bracketed is a non-trivial optional group → skip.
	let prev;
	do {
		prev = inner;
		inner = inner.replace(/\[\s*(,?)\s*([A-Za-z_][\w]*)\s*\]/g, "$1 $2");
	} while (inner !== prev);
	if (/[[\]]/.test(inner)) return { skip: "optional-group" };

	const params = inner
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s !== "");
	// Every param must be a single plain identifier — a multi-word / typed / punctuated piece means
	// the notation is richer than we model, so skip rather than mis-name.
	for (const pr of params) if (!/^[A-Za-z_][\w]*$/.test(pr)) return { skip: "param-shape" };
	return { name, params, variadic };
}

function* mdFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* mdFiles(p);
		else if (e.name.endsWith(".md")) yield p;
	}
}

/** T-SQL extractor. Returns null when the source tree is absent. */
function harvestTSql() {
	const src = corpusPath("vendor/sql-docs/docs/t-sql/functions");
	if (!existsSync(src)) return null;
	const signatures = {};
	const provenance = {};
	const skips = { complex: 0, "optional-group": 0, "param-shape": 0 };
	let conflicts = 0;
	let pagesNoSig = 0;

	for (const f of mdFiles(src)) {
		// Per page (= one function's reference), collect each name's candidate signatures. A page that
		// documents overloads with DIFFERENT parameter lists is a conflict → skip that name.
		const cands = new Map();
		for (const block of syntaxsqlBlocks(readFileSync(f, "utf8"))) {
			const r = parseTSqlSig(block);
			if (!r) continue;
			if (r.skip) {
				skips[r.skip]++;
				continue;
			}
			const key = r.name.toLowerCase();
			if (!cands.has(key)) cands.set(key, new Map());
			const sig = { name: r.name, params: r.params.map((n) => ({ name: n })), variadic: r.variadic };
			cands.get(key).set(JSON.stringify([r.params, r.variadic]), sig);
		}
		if (cands.size === 0) {
			pagesNoSig++;
			continue;
		}
		for (const [key, variants] of cands) {
			if (variants.size !== 1) {
				conflicts++;
				continue;
			}
			signatures[key] = [...variants.values()][0];
			provenance[key] = relative(corpusPath("vendor/sql-docs/docs/t-sql"), f).split("\\").join("/");
		}
	}
	return {
		signatures,
		provenance,
		source: "MicrosoftDocs/sql-docs  docs/t-sql/functions/**/*.md (```syntaxsql``` blocks)",
		stats: { emitted: Object.keys(signatures).length, conflicts, pagesNoSig, skips },
	};
}

// ---------------------------------------------------------------------------
// Operator blocklist — shared by every extractor whose source tree mixes function pages with
// operator/predicate pages (all but T-SQL, whose source tree is functions-only markdown).
// ---------------------------------------------------------------------------

// Operator/predicate keywords whose doc pages can render function-call-shaped syntax (the databricks
// `in ( elem, expr1 [, ...] )` page parses cleanly), and signature help treats a keyword-role token as
// a call exactly when a signature exists for it, so a harvested entry would pop a bogus hint on e.g.
// WHERE x IN (...). Dropped after merge, counted under skip reason "operator-name".
const OPERATOR_NAMES = new Set([
	"all",
	"and",
	"any",
	"between",
	"case",
	"distinct",
	"exists",
	"ilike",
	"in",
	"interval",
	"is",
	"like",
	"not",
	"or",
	"over",
	"regexp",
	"rlike",
	"similar",
	"some",
	"when",
]);

/** Drops every emitted entry whose (lowercased) key is an operator/predicate keyword. Mutates the
 *  maps, counts each drop under skips["operator-name"], and returns the dropped keys. */
function dropOperatorNames(signatures, provenance, skips) {
	skips["operator-name"] = 0;
	const dropped = [];
	for (const key of Object.keys(signatures)) {
		if (OPERATOR_NAMES.has(key)) {
			delete signatures[key];
			delete provenance[key];
			skips["operator-name"]++;
			dropped.push(key);
		}
	}
	return dropped;
}

// Leading "[ DISTINCT ]" / "[ALL | DISTINCT]" keyword-modifier group ahead of the first param on
// aggregate-function pages (databricks and snowflake). A calling-convention modifier, not a param:
// stripped before parsing, counted as nothing.
const DISTINCT_ALL_GROUP_RE = /^\s*\[\s*(?:ALL|DISTINCT)(?:\s*\|\s*(?:ALL|DISTINCT))*\s*\]\s*/i;

/** All `*.txt` files under a directory, recursively (databricks + snowflake syntax tiers). */
function* txtFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* txtFiles(p);
		else if (e.name.endsWith(".txt")) yield p;
	}
}

// ---------------------------------------------------------------------------
// Databricks (Spark SQL): databricks/docs/syntax/functions/<name>/N.txt Syntax blocks, captured
// from docs.databricks.com by tools/scrape-databricks-syntax.mjs.
//
// Two widenings beyond the plain flat-list model (both shape-anchored; everything else stays
// exactly as strict as the NEVER-WRONG CONTRACT requires):
//   - a leading "[ DISTINCT ]" / "[ALL | DISTINCT]" keyword-modifier group ahead of the first
//     param (aggregate-function pages) is a calling-convention modifier, not a param: stripped via
//     the shared DISTINCT_ALL_GROUP_RE above before parsing.
//   - a trailing "[FILTER ( WHERE cond ) ]" clause after the call's closing paren (aggregates)
//     does not by itself invalidate the block: it is stripped first, then the ordinary
//     trailing-content rule applies to whatever remains (so a further clause after FILTER still
//     skips, e.g. any_value's "[FILTER (...)] [IGNORE NULLS | RESPECT NULLS]").
// One more widening, narrower than either of those: a wholly-bracketed single param as the ENTIRE
// inner, e.g. current_time([precision]), parses as one optional param (the sole shape this
// recovers beyond a trailing "[, x]" continuation chain); a leading optional group followed by more
// required text (log's "[ base , ] expr") is unaffected and still skips as optional-group.
// ---------------------------------------------------------------------------

const DATABRICKS_CALL_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
// Clause keywords that mark a signature as a clause-shaped construct, not a flat call.
const DATABRICKS_CLAUSE_KEYWORD_RE = /\b(FROM|AS|OVER|USING|ORDER|IGNORE|RESPECT|DISTINCT|WITHIN)\b/i;
// Widening 4's shape: nothing but "[ ident ]" as the whole inner.
const DATABRICKS_SOLE_OPTIONAL_RE = /^\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]$/;
// Widening 3's shape: a trailing FILTER(WHERE ident) clause, stripped from the tail.
const DATABRICKS_FILTER_CLAUSE_RE = /^\[\s*FILTER\s*\(\s*WHERE\s+[A-Za-z_][A-Za-z0-9_]*\s*\)\s*\]/i;

function isPlainIdentDatabricks(s) {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s.trim());
}

/** Recursively unwrap a "[, x]" / "[, x [, y]]" trailing optional chain (already stripped of its
 *  own outer "[" "]" and leading comma). Returns { ok:true, params, variadic } or { ok:false, reason }. */
function parseOptionalChainDatabricks(str) {
	const s = str.trim();
	if (s === "..." || s === "…") return { ok: true, params: [], variadic: true };

	const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(s);
	if (!m) return { ok: false, reason: "param-shape" };
	const name = m[1];
	const rest = s.slice(m[0].length).trim();
	if (rest === "") return { ok: true, params: [{ name, optional: true }], variadic: false };

	if (rest[0] !== "[" || rest[rest.length - 1] !== "]") return { ok: false, reason: "optional-group" };
	// The bracket must cover the whole remainder (depth returns to 0 only at the last char).
	let depth = 0;
	for (let i = 0; i < rest.length; i++) {
		if (rest[i] === "[") depth++;
		else if (rest[i] === "]") {
			depth--;
			if (depth === 0 && i !== rest.length - 1) return { ok: false, reason: "optional-group" };
		}
	}
	if (depth !== 0) return { ok: false, reason: "optional-group" };

	let inner = rest.slice(1, -1).trim();
	if (!inner.startsWith(",")) return { ok: false, reason: "optional-group" };
	inner = inner.slice(1).trim();
	const nested = parseOptionalChainDatabricks(inner);
	if (!nested.ok) return nested;
	return { ok: true, params: [{ name, optional: true }, ...nested.params], variadic: nested.variadic };
}

/** Parse the text captured between one call's balanced outer parens into `{ params, variadic }`,
 *  or a skip reason, per the NEVER-WRONG CONTRACT plus the two widenings above. */
function parseParamsTextDatabricks(paramsTextRaw) {
	let text = paramsTextRaw.trim();
	text = text.replace(DISTINCT_ALL_GROUP_RE, "").trim();

	const sole = DATABRICKS_SOLE_OPTIONAL_RE.exec(text);
	if (sole) return { ok: true, params: [{ name: sole[1], optional: true }], variadic: false };

	if (/<[^<>\n]*>/.test(text)) return { ok: false, reason: "complex" }; // <placeholder>
	if (text.includes("::=")) return { ok: false, reason: "complex" };
	if (text.includes("=>")) return { ok: false, reason: "complex" };
	if (/[{}]/.test(text)) return { ok: false, reason: "complex" }; // alternation/grouping braces
	if (text.includes("|")) return { ok: false, reason: "complex" }; // alternation, even outside {}
	if (DATABRICKS_CLAUSE_KEYWORD_RE.test(text)) return { ok: false, reason: "complex" };
	if (/[()]/.test(text)) return { ok: false, reason: "complex" }; // nested parens left after outer pair

	// The first top-level "[": everything before it is the required prefix.
	let depth = 0;
	let firstBracket = -1;
	let closeAtEnd = -1;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === "[") {
			if (depth === 0 && firstBracket === -1) firstBracket = i;
			depth++;
		} else if (c === "]") {
			depth--;
			if (depth < 0) return { ok: false, reason: "optional-group" };
			if (depth === 0 && firstBracket !== -1 && closeAtEnd === -1) closeAtEnd = i;
		}
	}
	if (depth !== 0) return { ok: false, reason: "optional-group" };

	let requiredPart, chainStr;
	if (firstBracket === -1) {
		requiredPart = text;
		chainStr = null;
	} else {
		if (closeAtEnd !== text.length - 1) return { ok: false, reason: "optional-group" }; // bracket not trailing
		requiredPart = text.slice(0, firstBracket).trim();
		chainStr = text.slice(firstBracket, closeAtEnd + 1);
	}

	const requiredNames = requiredPart === "" ? [] : requiredPart.split(",").map((s) => s.trim());
	// A bare trailing "..." in the plain comma list (no brackets at all, e.g. "expr1, ...") marks
	// the previous param as variadic too, same as the bracketed "[, ...]" tail.
	let bareVariadic = false;
	if (chainStr === null && requiredNames.length > 1 && /^(\.\.\.|…)$/.test(requiredNames[requiredNames.length - 1])) {
		requiredNames.pop();
		bareVariadic = true;
	}
	for (const n of requiredNames) if (!isPlainIdentDatabricks(n)) return { ok: false, reason: "param-shape" };
	const requiredParams = requiredNames.map((n) => ({ name: n }));

	let optionalParams = [];
	let variadic = bareVariadic;
	if (chainStr !== null) {
		let inner = chainStr.slice(1, -1).trim();
		if (!inner.startsWith(",")) return { ok: false, reason: "optional-group" };
		inner = inner.slice(1).trim();
		const chain = parseOptionalChainDatabricks(inner);
		if (!chain.ok) return chain;
		optionalParams = chain.params;
		variadic = chain.variadic;
	}

	const allParams = requiredParams.concat(optionalParams);
	if (variadic && allParams.length === 0) return { ok: false, reason: "param-shape" };
	return { ok: true, params: allParams, variadic };
}

/** Process one captured *.txt block's raw text into `{ name, params, variadic }`, or records a
 *  skip reason on `stats` and returns null. */
function processBlockDatabricks(rawText, stats) {
	const lines = rawText.split("\n");

	let callLineIdx = -1;
	let name = null;
	for (let i = 0; i < lines.length; i++) {
		const m = DATABRICKS_CALL_LINE_RE.exec(lines[i].trim());
		if (m) {
			callLineIdx = i;
			name = m[1];
			break;
		}
	}
	if (callLineIdx === -1) {
		stats.skip("no-call-line");
		return null;
	}
	// Anything non-blank before the call line means this block isn't just one flat signature.
	for (let i = 0; i < callLineIdx; i++) {
		if (lines[i].trim() !== "") {
			stats.skip("leading-content");
			return null;
		}
	}

	// Reconstruct the text from the call line's "(" onward, through the rest of the block, so a
	// multi-line paren group still balances correctly.
	const callLine = lines[callLineIdx];
	const openParenIdx = callLine.indexOf("(", callLine.search(/\S/));
	const afterOpen = callLine.slice(openParenIdx + 1) + "\n" + lines.slice(callLineIdx + 1).join("\n");

	let depth = 1;
	let closeIdx = -1;
	for (let i = 0; i < afterOpen.length; i++) {
		if (afterOpen[i] === "(") depth++;
		else if (afterOpen[i] === ")") {
			depth--;
			if (depth === 0) {
				closeIdx = i;
				break;
			}
		}
	}
	if (closeIdx === -1) {
		stats.skip("unbalanced");
		return null;
	}

	const paramsText = afterOpen.slice(0, closeIdx);
	let trailing = afterOpen.slice(closeIdx + 1).trim();
	// Widening 3: strip a trailing FILTER(WHERE ident) clause before judging the trailing text.
	const filterMatch = DATABRICKS_FILTER_CLAUSE_RE.exec(trailing);
	if (filterMatch) trailing = trailing.slice(filterMatch[0].length).trim();

	const parsed = parseParamsTextDatabricks(paramsText);
	if (!parsed.ok) {
		stats.skip(parsed.reason);
		return null;
	}
	if (trailing !== "") {
		// Content beyond the first balanced paren group (and beyond a stripped FILTER clause):
		// another overload, a required clause, or a variant crammed into the same code box, never
		// safe to treat the leading call as "the" signature, so bail.
		stats.skip("trailing-content");
		return null;
	}

	return { name, params: parsed.params, variadic: parsed.variadic };
}

function sameParamListDatabricks(a, b) {
	if (a.length !== b.length) return false;
	return a.every((p, i) => p.name === b[i].name && !!p.optional === !!b[i].optional);
}
function namesArePrefixDatabricks(shorter, longer) {
	if (shorter.length > longer.length) return false;
	return shorter.every((p, i) => p.name === longer[i].name);
}

/** Databricks extractor. Returns null when the source tree is absent. */
function harvestDatabricks() {
	const src = corpusPath("databricks/docs/syntax/functions");
	if (!existsSync(src)) return null;

	const skipCounts = {
		"no-call-line": 0,
		"leading-content": 0,
		unbalanced: 0,
		"trailing-content": 0,
		"optional-group": 0,
		"param-shape": 0,
		complex: 0,
	};
	const stats = {
		skip(reason) {
			skipCounts[reason]++;
		},
	};
	const occurrencesByName = new Map();

	for (const f of txtFiles(src)) {
		const sourceFile = relative(corpusPath("databricks/docs/syntax"), f).split("\\").join("/");
		const text = readFileSync(f, "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
		const result = processBlockDatabricks(text, stats);
		if (!result) continue;
		const key = result.name.toLowerCase();
		const list = occurrencesByName.get(key) ?? [];
		list.push({ name: result.name, params: result.params, variadic: result.variadic, sourceFile });
		occurrencesByName.set(key, list);
	}

	const signatures = {};
	const provenance = {};
	let conflicts = 0;
	for (const [key, occs] of occurrencesByName) {
		// Dedupe identical (params + variadic) occurrences, keeping first sourceFile seen.
		const distinct = [];
		for (const occ of occs) {
			const dup = distinct.find(
				(d) => d.variadic === occ.variadic && sameParamListDatabricks(d.params, occ.params),
			);
			if (!dup) distinct.push(occ);
		}

		let chosen;
		if (distinct.length === 1) {
			chosen = distinct[0];
		} else {
			const maxLen = Math.max(...distinct.map((d) => d.params.length));
			const maximal = distinct.filter((d) => d.params.length === maxLen);
			if (maximal.length > 1) {
				conflicts++; // two or more distinct signatures tie for longest, can't pick a canonical one
				continue;
			}
			const longest = maximal[0];
			const shorterOnes = distinct.filter((d) => d !== longest);
			const allPrefixes = shorterOnes.every((d) => namesArePrefixDatabricks(d.params, longest.params));
			if (!allPrefixes) {
				conflicts++;
				continue;
			}
			const minLen = Math.min(...distinct.map((d) => d.params.length));
			const mergedParams = longest.params.map((p, i) => ({ ...p, optional: i >= minLen ? true : p.optional }));
			chosen = {
				name: longest.name,
				params: mergedParams,
				variadic: longest.variadic,
				sourceFile: longest.sourceFile,
			};
		}

		signatures[key] = { name: chosen.name, params: chosen.params, ...(chosen.variadic ? { variadic: true } : {}) };
		provenance[key] = chosen.sourceFile;
	}

	dropOperatorNames(signatures, provenance, skipCounts);

	return {
		signatures,
		provenance,
		source: "docs.databricks.com  databricks/docs/syntax/functions/<name>/N.txt (Syntax blocks, captured by tools/scrape-databricks-syntax.mjs)",
		stats: { emitted: Object.keys(signatures).length, conflicts, skips: skipCounts },
	};
}

// ---------------------------------------------------------------------------
// Snowflake: snowflake/docs/syntax/functions/<name>/N.txt (some nested under an overload-slug
// directory), captured from docs.snowflake.com by tools/scrape-snowflake-syntax.mjs. Placeholders
// use `<name>` angle-bracket notation; a blank-line-separated segment inside one block is an
// INDEPENDENT candidate (an alias pair such as LENGTH/LEN, or SUBSTR/SUBSTRING, shares one file).
//
// Two widenings beyond the plain flat-list model (shape-anchored; everything else stays exactly as
// strict):
//   - a placeholder wrapped in literal single quotes, '<rounding_mode>', is an ordinary placeholder
//     (the quotes just mark "this argument is a quoted string literal": rounding mode, pad side,
//     collation params). Recovers ROUND, among others.
//   - the shared leading "[ DISTINCT ]" / "[ALL | DISTINCT]" keyword-modifier group (see
//     DISTINCT_ALL_GROUP_RE above) is stripped before tokenizing, recovering COUNT / LISTAGG /
//     ARRAY_AGG and their aggregate siblings.
// Trailing text after the call's own balanced parens (WITHIN GROUP, OVER, …) is never inspected: it
// always sits outside that first paren pair by construction, so it never reaches the tokenizer.
// Unlike Databricks, there is no FILTER-clause rule to apply here.
// ---------------------------------------------------------------------------

/** Whitelist tokenizer for one balanced-paren inner region: top-level commas, `[`/`]` optional-
 *  group brackets, `...` ellipsis, `<placeholder>`, and (widening 1) a `'<placeholder>'` quoted
 *  form. Any other character (bare keywords, `{`/`}`/`|` alternation, `*`, `=>` named-arg arrows,
 *  stray literal parens, `@` stage sigils, …) fails the whole inner region: never guessed at. */
function tokenizeInnerSnowflake(inner) {
	const tokens = [];
	let i = 0;
	while (i < inner.length) {
		const c = inner[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === ",") {
			tokens.push({ t: "COMMA" });
			i++;
			continue;
		}
		if (c === "[") {
			tokens.push({ t: "LBRACKET" });
			i++;
			continue;
		}
		if (c === "]") {
			tokens.push({ t: "RBRACKET" });
			i++;
			continue;
		}
		if (inner.startsWith("...", i)) {
			tokens.push({ t: "ELLIPSIS" });
			i += 3;
			continue;
		}
		if (c === "'") {
			// Widening 1: a single-quoted placeholder, e.g. '<rounding_mode>'.
			const m = /^'<([A-Za-z_][A-Za-z0-9_]*)>'/.exec(inner.slice(i));
			if (!m) return { skip: "complex" };
			tokens.push({ t: "PLACEHOLDER", name: m[1] });
			i += m[0].length;
			continue;
		}
		if (c === "<") {
			const close = inner.indexOf(">", i);
			if (close === -1) return { skip: "complex" };
			const content = inner.slice(i + 1, close);
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(content)) return { skip: "param-shape" };
			tokens.push({ t: "PLACEHOLDER", name: content });
			i = close + 1;
			continue;
		}
		return { skip: "complex" };
	}
	return { tokens };
}

// Consume one `[ , <body> ]` optional-tail group at tokens[i], recursing for a further-nested
// group before this level's own closing bracket (ROUND-style `[ , x [ , y ] ]` chain). `<body>` is
// one of: a bare `...` (optionally `, <label>`, as in COALESCE's `[ , ... , <exprN> ]`, where the
// label is repetition notation, not a distinct param), or `<placeholder>` optionally followed by `...`
// (GREATEST's `[ , <expr2> ... ]`) or by a further nested group (ROUND's chain).
function parseOptTailSnowflake(tokens, i, params) {
	if (!tokens[i] || tokens[i].t !== "LBRACKET") return { i, variadic: false };
	i++;
	if (!tokens[i] || tokens[i].t !== "COMMA") return { skip: "optional-group" };
	i++;
	let variadic = false;
	if (tokens[i] && tokens[i].t === "ELLIPSIS") {
		i++;
		variadic = true;
		if (tokens[i] && tokens[i].t === "COMMA") {
			i++;
			if (!tokens[i] || tokens[i].t !== "PLACEHOLDER") return { skip: "complex" };
			i++; // trailing label placeholder (e.g. <exprN>): repetition notation, not a distinct param
		}
	} else if (tokens[i] && tokens[i].t === "PLACEHOLDER") {
		const name = tokens[i].name;
		i++;
		params.push({ name, optional: true });
		if (tokens[i] && tokens[i].t === "ELLIPSIS") {
			i++;
			variadic = true;
		} else {
			const nested = parseOptTailSnowflake(tokens, i, params);
			if (nested.skip) return nested;
			i = nested.i;
			variadic = variadic || nested.variadic;
		}
	} else {
		return { skip: "optional-group" };
	}
	if (!tokens[i] || tokens[i].t !== "RBRACKET") return { skip: "optional-group" };
	i++;
	return { i, variadic };
}

function parseParamsSnowflake(tokens) {
	if (tokens.length === 0) return { params: [], variadic: false };
	const params = [];
	let i = 0;
	while (tokens[i] && tokens[i].t === "PLACEHOLDER") {
		params.push({ name: tokens[i].name });
		i++;
		if (tokens[i] && tokens[i].t === "COMMA") {
			i++;
			continue;
		}
		break;
	}
	if (i === tokens.length) return { params, variadic: false };
	const tail = parseOptTailSnowflake(tokens, i, params);
	if (tail.skip) return tail;
	if (tail.i !== tokens.length) return { skip: "optional-group" }; // leftover unparsed tokens
	return { params, variadic: tail.variadic };
}

/** Extracts the candidate `NAME( … )` call from one blank-line-separated segment of a scraped
 *  block, or null when the segment has no such call at all (not a signature-shape skip). Nothing
 *  may precede the name on its own line: dotted/qualified names (SNOWFLAKE.CORTEX.COMPLETE) never
 *  match a plain identifier, by design, not a bug. */
function parseCandidateSnowflake(segment, stats) {
	const re = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(/m;
	const m = re.exec(segment);
	if (!m) return null;

	const name = m[1];
	const openIdx = segment.indexOf("(", m.index);
	let depth = 0;
	let start = -1;
	let end = -1;
	for (let i = openIdx; i < segment.length; i++) {
		if (segment[i] === "(") {
			if (depth === 0) start = i;
			depth++;
		} else if (segment[i] === ")") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (start === -1 || end === -1) {
		stats.skip("unbalanced-parens");
		return null;
	}

	let inner = segment.slice(start + 1, end).trim();
	// Widening 2: strip the shared leading "[ DISTINCT ]" / "[ALL | DISTINCT]" modifier group.
	inner = inner.replace(DISTINCT_ALL_GROUP_RE, "").trim();

	const tok = tokenizeInnerSnowflake(inner);
	if (tok.skip) {
		stats.skip(tok.skip);
		return null;
	}
	const parsed = parseParamsSnowflake(tok.tokens);
	if (parsed.skip) {
		stats.skip(parsed.skip);
		return null;
	}
	return { name, params: parsed.params, variadic: parsed.variadic };
}

function sameParamListSnowflake(a, b) {
	if (a.length !== b.length) return false;
	return a.every((p, i) => p.name === b[i].name && !!p.optional === !!b[i].optional);
}
function namesArePrefixSnowflake(shorter, longer) {
	if (shorter.length > longer.length) return false;
	return shorter.every((p, i) => p.name === longer[i].name);
}

/** Snowflake extractor. Returns null when the source tree is absent. */
function harvestSnowflake() {
	const src = corpusPath("snowflake/docs/syntax/functions");
	if (!existsSync(src)) return null;

	const skipCounts = {
		complex: 0,
		"optional-group": 0,
		"unbalanced-parens": 0,
		"param-shape": 0,
	};
	const stats = {
		skip(reason) {
			skipCounts[reason]++;
		},
	};
	const occurrencesByName = new Map();

	for (const f of txtFiles(src)) {
		const sourceFile = relative(corpusPath("snowflake/docs/syntax"), f).split("\\").join("/");
		const text = readFileSync(f, "utf8");
		const segments = text
			.split(/\n\s*\n/)
			.map((s) => s.trim())
			.filter(Boolean);
		for (const seg of segments) {
			const cand = parseCandidateSnowflake(seg, stats);
			if (!cand) continue;
			const key = cand.name.toLowerCase();
			const list = occurrencesByName.get(key) ?? [];
			list.push({ name: cand.name, params: cand.params, variadic: cand.variadic, sourceFile });
			occurrencesByName.set(key, list);
		}
	}

	const signatures = {};
	const provenance = {};
	let conflicts = 0;
	for (const [key, occs] of occurrencesByName) {
		const distinct = [];
		for (const occ of occs) {
			const dup = distinct.find(
				(d) => d.variadic === occ.variadic && sameParamListSnowflake(d.params, occ.params),
			);
			if (!dup) distinct.push(occ);
		}

		let chosen;
		if (distinct.length === 1) {
			chosen = distinct[0];
		} else {
			const maxLen = Math.max(...distinct.map((d) => d.params.length));
			const maximal = distinct.filter((d) => d.params.length === maxLen);
			if (maximal.length > 1) {
				conflicts++;
				continue;
			}
			const longest = maximal[0];
			const shorterOnes = distinct.filter((d) => d !== longest);
			const allPrefixes = shorterOnes.every((d) => namesArePrefixSnowflake(d.params, longest.params));
			if (!allPrefixes) {
				conflicts++;
				continue;
			}
			const minLen = Math.min(...distinct.map((d) => d.params.length));
			const mergedParams = longest.params.map((p, i) => ({ ...p, optional: i >= minLen ? true : p.optional }));
			const mergedVariadic = distinct.some((d) => d.variadic) || undefined;
			chosen = {
				name: longest.name,
				params: mergedParams,
				variadic: mergedVariadic,
				sourceFile: longest.sourceFile,
			};
		}

		signatures[key] = { name: chosen.name, params: chosen.params, ...(chosen.variadic ? { variadic: true } : {}) };
		provenance[key] = chosen.sourceFile;
	}

	dropOperatorNames(signatures, provenance, skipCounts);

	return {
		signatures,
		provenance,
		source: "docs.snowflake.com  snowflake/docs/syntax/functions/<name>/N.txt (Syntax blocks, captured by tools/scrape-snowflake-syntax.mjs)",
		stats: { emitted: Object.keys(signatures).length, conflicts, skips: skipCounts },
	};
}

// ---------------------------------------------------------------------------
// DuckDB — duckdb-web docs/current/sql/functions/*.md, "#### `name(...)`" headings.
//
// One rule widening beyond the plain flat-list model: a param segment (bare, or inside a trailing
// optional group) matching a lowercase identifier followed by whitespace and one ALL-CAPS word — a
// typed param declaration such as `v NUMERIC` — becomes `{ name, type }` with the documented type kept
// verbatim. This recovers round(v NUMERIC, s INTEGER) and its two siblings (round_even, roundbankers);
// nothing else is widened beyond the NEVER-WRONG contract above.
// ---------------------------------------------------------------------------

const DUCKDB_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DUCKDB_NAME_CALL_RE = /^([A-Za-z_][A-Za-z0-9_]*)\(/;
// Keywords that, inside otherwise-invalid parameter text, mean the heading is using SQL clause syntax
// (not a plain identifier param) — e.g. extract(part FROM date), cume_dist([ORDER BY ordering]).
const DUCKDB_KEYWORD_RE = /\b(order|over|from|as|by|in|partition|distinct|when|case|then|else|end|ignore|nulls)\b/i;
const DUCKDB_TYPED_PARAM_RE = /^([a-z_][a-z0-9_]*)\s+([A-Z][A-Z0-9_]*)$/;

/** Splits `text` on top-level occurrences of `sep`, `(`/`[` depth-increasing, `)`/`]` depth-decreasing.
 *  Returns null on mismatched or unbalanced brackets. */
function splitTopLevelDuckdb(text, sep) {
	const stack = [];
	const parts = [];
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === "(" || c === "[") {
			stack.push(c);
		} else if (c === ")" || c === "]") {
			const open = stack.pop();
			if (open === undefined) return null;
			if ((c === ")" && open !== "(") || (c === "]" && open !== "[")) return null;
		} else if (c === sep && stack.length === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	if (stack.length !== 0) return null;
	parts.push(text.slice(start));
	return parts;
}

/** Finds the outer name(...) shape of a heading's backtick-quoted text: the whole trimmed text must be
 *  `identifier(...)` with nothing after the matching closing paren. */
function matchOuterShapeDuckdb(raw) {
	const s = raw.trim();
	const m = DUCKDB_NAME_CALL_RE.exec(s);
	if (!m) return { ok: false };
	const openIdx = m[0].length - 1;
	const stack = [];
	let matchIdx = -1;
	for (let i = openIdx; i < s.length; i++) {
		const c = s[i];
		if (c === "(" || c === "[") {
			stack.push(c);
		} else if (c === ")" || c === "]") {
			const open = stack.pop();
			if (open === undefined) return { ok: false, reason: "unbalanced" };
			if ((c === ")" && open !== "(") || (c === "]" && open !== "[")) {
				return { ok: false, reason: "unbalanced" };
			}
			if (stack.length === 0) {
				matchIdx = i;
				break;
			}
		}
	}
	if (matchIdx === -1) return { ok: false, reason: "unbalanced" };
	if (matchIdx !== s.length - 1) return { ok: false }; // trailing junk after the call
	return { ok: true, name: m[1], inner: s.slice(openIdx + 1, matchIdx) };
}

/** Decides the skip reason for parameter text that isn't a plain identifier or well-formed optional
 *  group. `defaultReason` applies when no complex-syntax marker is present. */
function classifyFailureDuckdb(text, defaultReason) {
	if (text.includes(":=")) return "complex";
	if (/[{}<>]/.test(text)) return "complex";
	if (DUCKDB_KEYWORD_RE.test(text)) return "complex";
	return defaultReason;
}

/** Parses a trailing bracket-tail string (starting with `[`) into ordered optional params — sibling
 *  groups (`[, a][, b]`) and nested groups (`[, a[, b]]`) both handled. A tail segment that is exactly
 *  a typed declaration (the widening above) becomes a typed optional param; otherwise it must be
 *  exactly ", identifier" (optionally continued by more bracket tail). */
function parseOptionalTailDuckdb(text) {
	let i = 0;
	const params = [];
	while (i < text.length) {
		if (text[i] !== "[") return { ok: false };
		let depth = 0;
		let j = i;
		for (; j < text.length; j++) {
			if (text[j] === "[") depth++;
			else if (text[j] === "]") {
				depth--;
				if (depth === 0) break;
			}
		}
		if (j >= text.length || depth !== 0) return { ok: false };
		const content = text.slice(i + 1, j);
		if (!content.startsWith(",")) return { ok: false };
		const inner = content.slice(1).trim();
		const typed = DUCKDB_TYPED_PARAM_RE.exec(inner);
		if (typed) {
			params.push({ name: typed[1], type: typed[2], optional: true });
			i = j + 1;
			continue;
		}
		const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(inner);
		if (!idMatch) return { ok: false };
		const name = idMatch[0];
		params.push({ name, optional: true });
		const rest = inner.slice(name.length);
		if (rest.length === 0) {
			i = j + 1;
			continue;
		} else if (rest[0] === "[") {
			const nested = parseOptionalTailDuckdb(rest);
			if (!nested.ok) return { ok: false };
			params.push(...nested.params);
			i = j + 1;
			continue;
		}
		return { ok: false };
	}
	return { ok: true, params };
}

/** Parses one top-level comma-separated segment into 1+ params (a trailing optional-bracket tail
 *  expands into a base param plus its optional tail params). */
function parseSegmentDuckdb(segmentText, isLastSegment) {
	const s = segmentText.trim();
	if (s === "") return { ok: false, reason: "param-shape" };
	const bracketStart = s.indexOf("[");
	if (bracketStart === -1) {
		if (DUCKDB_IDENT_RE.test(s)) return { ok: true, params: [{ name: s, optional: false }] };
		const typed = DUCKDB_TYPED_PARAM_RE.exec(s);
		if (typed) return { ok: true, params: [{ name: typed[1], type: typed[2], optional: false }] };
		return { ok: false, reason: classifyFailureDuckdb(s, "param-shape") };
	}
	if (!isLastSegment) return { ok: false, reason: "optional-group" };
	const base = s.slice(0, bracketStart);
	const tail = s.slice(bracketStart);
	if (!DUCKDB_IDENT_RE.test(base)) return { ok: false, reason: classifyFailureDuckdb(s, "param-shape") };
	const tailResult = parseOptionalTailDuckdb(tail);
	if (!tailResult.ok) return { ok: false, reason: classifyFailureDuckdb(s, "optional-group") };
	return { ok: true, params: [{ name: base, optional: false }, ...tailResult.params] };
}

/** Parses the full inner (between-outer-parens) text of a heading into a signature, or a skip reason. */
function parseSignatureDuckdb(inner) {
	const trimmed = inner.trim();
	if (trimmed === "") return { ok: true, params: [], variadic: false };

	const rawSegments = splitTopLevelDuckdb(inner, ",");
	if (rawSegments === null) return { ok: false, reason: "unbalanced" };
	let segments = rawSegments.map((s) => s.trim());

	const ellipsisIdx = [];
	segments.forEach((s, i) => {
		if (s === "...") ellipsisIdx.push(i);
	});

	let variadic = false;
	if (ellipsisIdx.length > 0) {
		const isSoleTrailing =
			ellipsisIdx.length === 1 && ellipsisIdx[0] === segments.length - 1 && segments.length >= 2;
		if (!isSoleTrailing) return { ok: false, reason: "variadic-not-trailing" };
		variadic = true;
		segments = segments.slice(0, -1);
	}

	const params = [];
	for (let i = 0; i < segments.length; i++) {
		const isLast = i === segments.length - 1;
		const result = parseSegmentDuckdb(segments[i], isLast);
		if (!result.ok) return { ok: false, reason: result.reason };
		params.push(...result.params);
	}
	return { ok: true, params, variadic };
}

/** All `#### \`...\`` headings in a markdown string, backtick content only. */
function extractHeadingsDuckdb(text) {
	const headings = [];
	for (const line of text.split(/\r?\n/)) {
		const m = /^####\s+(.*)$/.exec(line);
		if (!m) continue;
		const rest = m[1];
		const firstTick = rest.indexOf("`");
		if (firstTick === -1) continue; // prose section heading, not a candidate at all
		const secondTick = rest.indexOf("`", firstTick + 1);
		if (secondTick === -1) continue;
		headings.push(rest.slice(firstTick + 1, secondTick));
	}
	return headings;
}

function sameParamListDuckdb(a, b) {
	if (a.length !== b.length) return false;
	return a.every(
		(p, i) => p.name === b[i].name && p.optional === b[i].optional && (p.type ?? null) === (b[i].type ?? null),
	);
}
function namesArePrefixDuckdb(shorter, longer) {
	if (shorter.length > longer.length) return false;
	return shorter.every((p, i) => p.name === longer[i].name && (p.type ?? null) === (longer[i].type ?? null));
}

/** DuckDB extractor. Returns null when the source tree is absent. */
function harvestDuckdb() {
	const src = corpusPath("vendor/duckdb-web/docs/current/sql/functions");
	if (!existsSync(src)) return null;

	const skipCounts = {
		"no-signature-shape": 0,
		unbalanced: 0,
		"variadic-not-trailing": 0,
		"optional-group": 0,
		"param-shape": 0,
		complex: 0,
	};
	// name -> occurrences [{ params, variadic, sourceFile }], one page-relative-name scan per heading.
	const occurrencesByName = new Map();

	for (const f of mdFiles(src)) {
		const sourceFile = relative(corpusPath("vendor/duckdb-web/docs/current"), f).split("\\").join("/");
		const text = readFileSync(f, "utf8");
		for (const heading of extractHeadingsDuckdb(text)) {
			const outer = matchOuterShapeDuckdb(heading);
			if (!outer.ok) {
				skipCounts[outer.reason ?? "no-signature-shape"]++;
				continue;
			}
			const sig = parseSignatureDuckdb(outer.inner);
			if (!sig.ok) {
				skipCounts[sig.reason]++;
				continue;
			}
			const list = occurrencesByName.get(outer.name) ?? [];
			list.push({ params: sig.params, variadic: sig.variadic, sourceFile });
			occurrencesByName.set(outer.name, list);
		}
	}

	const signatures = {};
	const provenance = {};
	let conflicts = 0;
	for (const [name, occs] of occurrencesByName) {
		// Dedupe identical (params + variadic) occurrences, keeping first sourceFile seen.
		const distinct = [];
		for (const occ of occs) {
			const dup = distinct.find((d) => d.variadic === occ.variadic && sameParamListDuckdb(d.params, occ.params));
			if (!dup) distinct.push(occ);
		}

		let chosen;
		if (distinct.length === 1) {
			chosen = distinct[0];
		} else {
			const maxLen = Math.max(...distinct.map((d) => d.params.length));
			const maximal = distinct.filter((d) => d.params.length === maxLen);
			if (maximal.length > 1) {
				conflicts++; // two or more distinct signatures tie for longest — can't pick a canonical one
				continue;
			}
			const longest = maximal[0];
			const shorterOnes = distinct.filter((d) => d !== longest);
			const allPrefixes = shorterOnes.every((d) => namesArePrefixDuckdb(d.params, longest.params));
			if (!allPrefixes) {
				conflicts++;
				continue;
			}
			const minLen = Math.min(...distinct.map((d) => d.params.length));
			const mergedParams = longest.params.map((p, i) => ({ ...p, optional: i >= minLen ? true : p.optional }));
			chosen = { params: mergedParams, variadic: longest.variadic, sourceFile: longest.sourceFile };
		}

		const key = name.toLowerCase();
		signatures[key] = { name, params: chosen.params, variadic: chosen.variadic };
		provenance[key] = chosen.sourceFile;
	}

	dropOperatorNames(signatures, provenance, skipCounts);

	return {
		signatures,
		provenance,
		source: 'duckdb-web  docs/current/sql/functions/*.md ("#### `name(...)`" headings)',
		stats: { emitted: Object.keys(signatures).length, conflicts, skips: skipCounts },
	};
}

// ---------------------------------------------------------------------------
// PostgreSQL — the PostgreSQL 18 DocBook SGML function reference, vendor/postgres-sgml/func.sgml,
// `<para role="func_signature">` blocks.
//
// Param emission: a `<parameter>name</parameter>` immediately followed by a `<type>t</type>` emits
// `{ name, type: t }`. A BARE `<type>t</type>` with no parameter name (the common case for PostgreSQL's
// polymorphic math/string functions, which document the argument only by its type) emits `{ name: t }`
// with NO type field — the rendered docs show the type standing in for the argument name, and carrying
// it as both name and type would render "text: text" in signature help.
// ---------------------------------------------------------------------------

const POSTGRES_ENTITY_MAP = {
	"&lt;": "<",
	"&gt;": ">",
	"&amp;": "&",
	"&quot;": '"',
	"&apos;": "'",
	"&percnt;": "%",
	"&eacute;": "e",
};
function decodeEntitiesPostgres(s) {
	return s.replace(/&[a-z]+;/gi, (m) => POSTGRES_ENTITY_MAP[m] ?? m);
}

/** Recognizes exactly: VARIADIC? (<parameter>name</parameter>)? (<type>t</type>)?, with nothing else. */
function paramShapePostgres(text) {
	const t = text.trim();
	let m;
	if ((m = /^<literal>VARIADIC<\/literal>\s*<parameter>([^<]*)<\/parameter>\s*<type>([^<]*)<\/type>$/.exec(t))) {
		return { name: decodeEntitiesPostgres(m[1].trim()), type: decodeEntitiesPostgres(m[2].trim()), variadic: true };
	}
	if ((m = /^<literal>VARIADIC<\/literal>\s*<type>([^<]*)<\/type>$/.exec(t))) {
		return { name: decodeEntitiesPostgres(m[1].trim()), variadic: true }; // bare type stands in for the name
	}
	if ((m = /^<parameter>([^<]*)<\/parameter>\s*<type>([^<]*)<\/type>$/.exec(t))) {
		return { name: decodeEntitiesPostgres(m[1].trim()), type: decodeEntitiesPostgres(m[2].trim()) };
	}
	if ((m = /^<type>([^<]*)<\/type>$/.exec(t))) {
		return { name: decodeEntitiesPostgres(m[1].trim()) }; // bare type stands in for the name, no type field
	}
	if ((m = /^<parameter>([^<]*)<\/parameter>$/.exec(t))) {
		return { name: decodeEntitiesPostgres(m[1].trim()) };
	}
	return null;
}

const POSTGRES_FN_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parses one func_signature para's raw SGML body into `{ name, params, variadic, sourceFile }`, or
 *  records a skip reason and returns null. */
function processParaPostgres(body, sourceFile, stats) {
	const fnTags = [...body.matchAll(/<function>([^<]*)<\/function>/g)];
	if (fnTags.length === 0) {
		stats.skip("no-function-tag"); // operator syntax rows / table header rows
		return null;
	}
	if (fnTags.length > 1) {
		stats.skip("multiple-function-tags");
		return null;
	}

	const name = fnTags[0][1].trim();
	if (!POSTGRES_FN_NAME_RE.test(name)) {
		stats.skip("non-identifier-name");
		return null;
	}

	const fnFull = fnTags[0][0];
	const afterIdx = body.indexOf(fnFull) + fnFull.length;
	const tail = body.slice(afterIdx);
	const parenIdx = tail.indexOf("(");

	if (parenIdx === -1) {
		// niladic keyword function with no parenthesized arg list at all (CURRENT_DATE, etc.)
		return { name, params: [], sourceFile };
	}

	const preParen = tail.slice(0, parenIdx);
	if (!/^\s*$/.test(preParen)) {
		stats.skip("complex:junk-before-paren");
		return null;
	}

	// Matching close paren by raw-character depth counting (tags never contain literal parens in their
	// own syntax, so this is safe even when tag *content* does).
	let depth = 0;
	let endIdx = -1;
	for (let i = parenIdx; i < tail.length; i++) {
		if (tail[i] === "(") depth++;
		else if (tail[i] === ")") {
			depth--;
			if (depth === 0) {
				endIdx = i;
				break;
			}
		}
	}
	if (endIdx === -1) {
		stats.skip("complex:unbalanced-parens");
		return null;
	}

	let rest = tail.slice(parenIdx + 1, endIdx);

	// Peel trailing "<optional> [,] simple-param </optional>" groups off the tail, one at a time. Per
	// the contract, only TAIL optional groups unwrap; anything else is complex.
	const trailingParams = [];
	let variadic = false;
	for (;;) {
		const m = /<optional>\s*(,\s*)?([\s\S]*?)<\/optional>\s*$/.exec(rest);
		if (!m) break;
		const inner = m[2].trim();
		if (inner === "..." || inner === "&hellip;") {
			if (trailingParams.length === 0) {
				stats.skip("complex:ellipsis-no-prior-param");
				return null;
			}
			variadic = true;
			rest = rest.slice(0, m.index);
			continue;
		}
		const shape = paramShapePostgres(inner);
		if (!shape) {
			stats.skip("complex:trailing-optional-unrecognized-shape");
			return null;
		}
		if (shape.variadic) variadic = true;
		trailingParams.unshift({ ...shape, optional: true });
		rest = rest.slice(0, m.index);
	}

	if (/<\/?optional>/.test(rest)) {
		// leading or interior optional group (e.g. to_tsvector's leading config param) — out of scope.
		stats.skip("complex:leading-or-interior-optional");
		return null;
	}
	if (/[{}|]/.test(rest) || /\.\.\./.test(rest)) {
		stats.skip("complex:braces-or-ellipsis");
		return null;
	}

	const requiredParams = [];
	const requiredSegments = rest
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	for (const seg of requiredSegments) {
		const shape = paramShapePostgres(seg);
		if (!shape) {
			stats.skip("complex:unrecognized-param-shape");
			return null;
		}
		if (shape.variadic) variadic = true;
		requiredParams.push({ name: shape.name, ...(shape.type !== undefined ? { type: shape.type } : {}) });
	}
	for (const param of trailingParams) {
		requiredParams.push({
			name: param.name,
			...(param.type !== undefined ? { type: param.type } : {}),
			optional: true,
		});
	}

	return { name, params: requiredParams, variadic: variadic || undefined, sourceFile };
}

function sigKeyPostgres(sig) {
	return JSON.stringify(sig.params.map((p) => [p.name, p.type ?? null, !!p.optional])) + "|" + !!sig.variadic;
}

function prefixCompatiblePostgres(shorter, longer) {
	if (shorter.params.length > longer.params.length) return false;
	for (let i = 0; i < shorter.params.length; i++) {
		const a = shorter.params[i];
		const b = longer.params[i];
		if (a.name !== b.name) return false;
		if ((a.type ?? null) !== (b.type ?? null)) return false;
	}
	return true;
}

/** Dedupe + prefix-compatible merge across a name's raw parses, else conflict (nothing emitted). */
function aggregatePostgres(byName) {
	const emitted = new Map();
	let conflicts = 0;
	for (const [name, sigs] of byName) {
		const seen = new Set();
		const unique = [];
		for (const s of sigs) {
			const k = sigKeyPostgres(s);
			if (!seen.has(k)) {
				seen.add(k);
				unique.push(s);
			}
		}
		if (unique.length === 1) {
			emitted.set(name, unique[0]);
			continue;
		}
		unique.sort((a, b) => a.params.length - b.params.length);
		let ok = true;
		for (let i = 0; i < unique.length && ok; i++) {
			for (let j = i + 1; j < unique.length && ok; j++) {
				if (!prefixCompatiblePostgres(unique[i], unique[j])) ok = false;
			}
		}
		if (!ok) {
			conflicts++; // e.g. PostgreSQL overloads by argument TYPE, not just count (lower(text) vs lower(anyrange))
			continue;
		}
		const longest = unique[unique.length - 1];
		const minLen = unique[0].params.length;
		const mergedParams = longest.params.map((p, i) => (i >= minLen ? { ...p, optional: true } : p));
		const mergedVariadic = unique.some((s) => s.variadic) || undefined;
		emitted.set(name, { name, params: mergedParams, variadic: mergedVariadic, sourceFile: longest.sourceFile });
	}
	return { emitted, conflicts };
}

/** PostgreSQL extractor. Returns null when the source file is absent. */
function harvestPostgres() {
	const src = corpusPath("vendor/postgres-sgml/func.sgml");
	if (!existsSync(src)) return null;

	const skipCounts = {
		"no-function-tag": 0,
		"multiple-function-tags": 0,
		"non-identifier-name": 0,
		"complex:junk-before-paren": 0,
		"complex:unbalanced-parens": 0,
		"complex:ellipsis-no-prior-param": 0,
		"complex:trailing-optional-unrecognized-shape": 0,
		"complex:leading-or-interior-optional": 0,
		"complex:braces-or-ellipsis": 0,
		"complex:unrecognized-param-shape": 0,
	};
	const stats = {
		skip(reason) {
			skipCounts[reason]++;
		},
	};

	const byName = new Map();
	const txt = readFileSync(src, "utf8");
	const re = /<para role="func_signature">([\s\S]*?)<\/para>/g;
	let m;
	let parasFound = 0;
	while ((m = re.exec(txt))) {
		parasFound++;
		const sig = processParaPostgres(m[1], "func.sgml", stats);
		if (sig) {
			if (!byName.has(sig.name)) byName.set(sig.name, []);
			byName.get(sig.name).push(sig);
		}
	}

	const { emitted, conflicts } = aggregatePostgres(byName);
	const signatures = {};
	const provenance = {};
	for (const [name, sig] of emitted) {
		const key = name.toLowerCase();
		signatures[key] = { name: sig.name, params: sig.params, ...(sig.variadic ? { variadic: true } : {}) };
		provenance[key] = sig.sourceFile;
	}

	dropOperatorNames(signatures, provenance, skipCounts);

	return {
		signatures,
		provenance,
		source: 'postgresql.org PostgreSQL 18 DocBook SGML  vendor/postgres-sgml/func.sgml (`<para role="func_signature">` blocks)',
		stats: { emitted: Object.keys(signatures).length, conflicts, parasFound, skips: skipCounts },
	};
}

// ---------------------------------------------------------------------------
// Registry — one entry per dialect. An extractor returns null (source absent) or a harvest result.
// T-SQL, Databricks, Snowflake, DuckDB, and PostgreSQL have an offline syntax-block source in the
// corpus repo today; the rest don't (see the header note).
// ---------------------------------------------------------------------------
const EXTRACTORS = {
	databricks: harvestDatabricks,
	tsql: harvestTSql,
	snowflake: harvestSnowflake,
	bigquery: () => null,
	redshift: () => null,
	postgres: harvestPostgres,
	duckdb: harvestDuckdb,
	trino: () => null,
	sqlite: () => null,
	mysql: () => null,
};

const CONST_NAME = {
	databricks: "DATABRICKS_HARVESTED",
	tsql: "TSQL_HARVESTED",
	snowflake: "SNOWFLAKE_HARVESTED",
	bigquery: "BIGQUERY_HARVESTED",
	redshift: "REDSHIFT_HARVESTED",
	postgres: "POSTGRES_HARVESTED",
	duckdb: "DUCKDB_HARVESTED",
	trino: "TRINO_HARVESTED",
	sqlite: "SQLITE_HARVESTED",
	mysql: "MYSQL_HARVESTED",
};

/** Serialize one FnSignature literal (stable key order). Params carry `type` (postgres gives the
 *  documented type even when the docs name no parameter) and `optional` (a trailing `[, x]` doc
 *  group stays marked optional rather than silently flattened to required). */
function fnLiteral(sig) {
	const params = sig.params
		.map((p) => {
			const fields = [`name: ${JSON.stringify(p.name)}`];
			if (p.type !== undefined) fields.push(`type: ${JSON.stringify(p.type)}`);
			if (p.optional) fields.push("optional: true");
			return `{ ${fields.join(", ")} }`;
		})
		.join(", ");
	const variadic = sig.variadic ? ", variadic: true" : "";
	return `{ name: ${JSON.stringify(sig.name)}, params: [${params}]${variadic} }`;
}

function renderTable(dialect, result) {
	const constName = CONST_NAME[dialect];
	const keys = Object.keys(result.signatures).sort();
	const rows = keys.map((k) => `\t${k}: ${fnLiteral(result.signatures[k])}, // ${result.provenance[k]}`).join("\n");
	return (
		`// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format\n` +
		`// Source: ${result.source}\n` +
		`// Harvested ${TODAY}. ${keys.length} signatures. Curated FUNCTION_SIGNATURES override these.\n` +
		`import type { FnSignature } from "../signatures.js";\n\n` +
		`/** Harvested (doc-syntax-derived) parameter signatures for ${dialect}, keyed by lowercased name. */\n` +
		`export const ${constName}: Record<string, FnSignature> = {\n${rows}\n};\n`
	);
}

function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	const summary = [];
	for (const [dialect, extractor] of Object.entries(EXTRACTORS)) {
		const result = extractor();
		if (!result) {
			summary.push(`  ${dialect.padEnd(11)} — no offline syntax-block source in the corpus repo → no table`);
			continue;
		}
		writeFileSync(join(OUT_DIR, `${dialect}.ts`), renderTable(dialect, result));
		const s = result.stats;
		const skipStr = Object.entries(s.skips)
			.map(([k, v]) => `${k}=${v}`)
			.join(" ");
		// pagesNoSig (T-SQL) and parasFound (PostgreSQL) are extractor-specific scan totals; DuckDB has
		// neither (its scan is per-heading, with no page/para grouping to report a total for).
		const scanTotal =
			s.pagesNoSig !== undefined
				? `, pages-without-clean-sig=${s.pagesNoSig}`
				: s.parasFound !== undefined
					? `, paras-scanned=${s.parasFound}`
					: "";
		summary.push(
			`  ${dialect.padEnd(11)} — ${s.emitted} emitted | skipped: ${skipStr}, conflicts=${s.conflicts}${scanTotal}`,
		);
	}
	console.log(`harvest-signatures → ${OUT_DIR}`);
	console.log(summary.join("\n"));
}

main();
