// Deterministic corpus MUTATOR — the volume half of the dialects' negative side (issue #5).
//
// Reads each dialect's positive query bucket (docs/parser/positive/query/) and emits mechanically
// broken variants ("mutants") into the negative bucket. The output is a REJECTION-RATE ratchet, not a
// 100% bar: mutation cannot guarantee invalidity (deleting an optional token, or truncating right after
// a complete clause, can leave valid SQL), so the gate pins the measured reject rate and lets it only
// rise. Curated near-misses (authored by hand, 100%-reject) are the signal half and are NOT touched here.
//
// DETERMINISM is the contract: no Date.now / bare Math.random. A fixed SEED is mixed with an FNV-1a hash
// of the file's dialect+slug to seed a mulberry32 PRNG per file, and the query files are walked in sorted
// order and evenly sampled. Re-running reproduces byte-identical output (the output dir is wiped first).
//
// LAYOUT — organizer fixpoint. The organizer (tools/organize-corpus.test.ts) forces the <category>
// segment of every parser NEGATIVE to "unparsed" (that is why BigQuery's negatives sit at
// bigquery/zetasql/parser/negative/unparsed/). To keep this corpus an organizer fixpoint (ORGANIZE=1
// must not relocate it), mutated/curated live BELOW that category segment:
//   <dialect>/docs/parser/negative/unparsed/mutated/<class>/<slug>.sql
//   <dialect>/docs/parser/negative/unparsed/curated/NNN.sql   (hand-authored, not written here)
//
// Run:  node tools/mutate-corpus.mjs            (all dialects)
//       node tools/mutate-corpus.mjs postgres   (one dialect)

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const DIALECTS = ["databricks", "tsql", "snowflake", "redshift", "postgres", "duckdb", "trino", "sqlite", "mysql"];

// Tuning — bounded so tier-2 stays sane. Up to MAX_FILES evenly-sampled positives per dialect, each
// yielding up to MUTANTS_PER_FILE distinct mutants. Ceiling ~ MAX_FILES * MUTANTS_PER_FILE per dialect.
const SEED = 0x5f3759df; // fixed program seed
const MAX_FILES = 200; // evenly sampled from the (often thousands-strong) query bucket
const MUTANTS_PER_FILE = 2;

// The five mutation classes from the plan. Each takes (sql, rng) and returns a mutated string, or null
// when it cannot apply (no paren to drop, no comma to double, …). A returned string equal to the input
// is discarded by the caller.
const CLASSES = ["unbalance", "delete-keyword", "swap-keywords", "truncate", "duplicate-comma"];

// mulberry32 — a small, fast, fully-deterministic PRNG. Seeded per file; no global state.
function mulberry32(a) {
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// FNV-1a 32-bit hash — mixes the file identity into the seed so different files mutate differently, but
// the SAME file always mutates the same way.
function hash32(s) {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

const randInt = (rng, n) => Math.floor(rng() * n);

// Structural keywords whose removal or reordering breaks a query. Kept small and clause-shaped so the
// mutation targets grammar structure, not incidental identifiers.
const KEYWORDS = new Set([
	"SELECT",
	"FROM",
	"WHERE",
	"GROUP",
	"BY",
	"ORDER",
	"HAVING",
	"JOIN",
	"ON",
	"AND",
	"OR",
	"AS",
	"INNER",
	"LEFT",
	"RIGHT",
	"OUTER",
	"UNION",
	"WITH",
	"DISTINCT",
	"INTO",
	"VALUES",
	"SET",
]);

/** Positions of a char class, used by the unbalance mutation. */
function positionsOf(sql, chars) {
	const out = [];
	for (let i = 0; i < sql.length; i++) if (chars.includes(sql[i])) out.push(i);
	return out;
}

/** Delete one paren or quote → unbalanced brackets / unterminated string. */
function mutUnbalance(sql, rng) {
	const pos = positionsOf(sql, "()'\"");
	if (pos.length === 0) return null;
	const i = pos[randInt(rng, pos.length)];
	return sql.slice(0, i) + sql.slice(i + 1);
}

/** All word-token spans (identifiers/keywords), as [start,end) over the source. */
function wordSpans(sql) {
	const spans = [];
	const re = /[A-Za-z_][A-Za-z0-9_]*/g;
	let m;
	while ((m = re.exec(sql))) spans.push([m.index, m.index + m[0].length, m[0]]);
	return spans;
}

/** Delete a required structural keyword (FROM, BY, SELECT, …). */
function mutDeleteKeyword(sql, rng) {
	const kw = wordSpans(sql).filter(([, , w]) => KEYWORDS.has(w.toUpperCase()));
	if (kw.length === 0) return null;
	const [s, e] = kw[randInt(rng, kw.length)];
	// Drop the keyword and one adjoining space so we don't leave a double space (keeps output tidy).
	const end = e < sql.length && sql[e] === " " ? e + 1 : e;
	return sql.slice(0, s) + sql.slice(end);
}

/** Swap two adjacent keyword tokens (e.g. `GROUP BY` → `BY GROUP`) → invalid clause order. */
function mutSwapKeywords(sql, rng) {
	const spans = wordSpans(sql);
	const pairs = [];
	for (let i = 0; i + 1 < spans.length; i++) {
		if (KEYWORDS.has(spans[i][2].toUpperCase()) && KEYWORDS.has(spans[i + 1][2].toUpperCase())) pairs.push(i);
	}
	if (pairs.length === 0) return null;
	const i = pairs[randInt(rng, pairs.length)];
	const [aS, aE, aW] = spans[i];
	const [bS, bE, bW] = spans[i + 1];
	// Rebuild: head + secondWord + gap + firstWord + tail.
	return sql.slice(0, aS) + bW + sql.slice(aE, bS) + aW + sql.slice(bE);
}

/** Truncate mid-token: cut inside a word and drop the rest of the statement. */
function mutTruncate(sql, rng) {
	const spans = wordSpans(sql);
	// Prefer a token in the back half so the truncation removes real content, not just the SELECT keyword.
	const candidates = spans.filter(([s, e]) => e - s >= 2 && s > sql.length * 0.3);
	const pick = candidates.length ? candidates : spans.filter(([s, e]) => e - s >= 2);
	if (pick.length === 0) return null;
	const [s, e] = pick[randInt(rng, pick.length)];
	const cut = s + 1 + randInt(rng, e - s - 1); // strictly inside the token
	return sql.slice(0, cut);
}

/** Duplicate a comma → `,,`, a syntax error in every list position. */
function mutDuplicateComma(sql, rng) {
	const pos = positionsOf(sql, ",");
	if (pos.length === 0) return null;
	const i = pos[randInt(rng, pos.length)];
	return sql.slice(0, i + 1) + "," + sql.slice(i + 1);
}

const MUTATORS = {
	unbalance: mutUnbalance,
	"delete-keyword": mutDeleteKeyword,
	"swap-keywords": mutSwapKeywords,
	truncate: mutTruncate,
	"duplicate-comma": mutDuplicateComma,
};

/** Deterministic Fisher-Yates over a copy of the class list. */
function shuffledClasses(rng) {
	const a = [...CLASSES];
	for (let i = a.length - 1; i > 0; i--) {
		const j = randInt(rng, i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Recursively collect .sql files under root, returned as sorted "/"-joined slugs relative to root. */
function sqlSlugs(root) {
	if (!existsSync(root)) return [];
	const out = [];
	const walk = (dir, prefix) => {
		for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const rel = prefix ? `${prefix}/${e.name}` : e.name;
			if (e.isDirectory()) walk(join(dir, e.name), rel);
			else if (e.name.endsWith(".sql")) out.push(rel);
		}
	};
	walk(root, "");
	return out.sort();
}

/** Evenly-spaced sample of up to `max` slugs (stable, index-based). */
function sample(slugs, max) {
	if (slugs.length <= max) return slugs;
	const step = slugs.length / max;
	const out = [];
	for (let i = 0; i < max; i++) out.push(slugs[Math.floor(i * step)]);
	return out;
}

function run(dialects) {
	const summary = [];
	for (const dialect of dialects) {
		const srcRoot = corpusPath(`${dialect}/docs/parser/positive/query`);
		const outRoot = corpusPath(`${dialect}/docs/parser/negative/unparsed/mutated`);
		if (!existsSync(srcRoot)) {
			summary.push(`${dialect}: (positive query bucket absent — skipped)`);
			continue;
		}
		// Wipe our own output so a re-run is byte-identical (no stale mutants from a prior tuning).
		if (existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });

		const slugs = sample(sqlSlugs(srcRoot), MAX_FILES);
		let written = 0;
		const perClass = Object.fromEntries(CLASSES.map((c) => [c, 0]));
		for (const slug of slugs) {
			const sql = readFileSync(join(srcRoot, slug), "utf8");
			const rng = mulberry32((SEED ^ hash32(`${dialect}/${slug}`)) >>> 0);
			let made = 0;
			for (const cls of shuffledClasses(rng)) {
				if (made >= MUTANTS_PER_FILE) break;
				let mutated;
				try {
					mutated = MUTATORS[cls](sql, rng);
				} catch {
					mutated = null;
				}
				if (mutated == null || mutated === sql || mutated.trim() === "") continue;
				const target = join(outRoot, cls, slug);
				mkdirSync(dirname(target), { recursive: true });
				writeFileSync(target, mutated);
				perClass[cls]++;
				written++;
				made++;
			}
		}
		summary.push(
			`${dialect}: ${written} mutants from ${slugs.length} files  [${CLASSES.map((c) => `${c} ${perClass[c]}`).join(", ")}]`,
		);
	}
	console.log("Mutant generation complete:\n  " + summary.join("\n  "));
}

const args = process.argv.slice(2).filter((a) => DIALECTS.includes(a));
run(args.length ? args : DIALECTS);
