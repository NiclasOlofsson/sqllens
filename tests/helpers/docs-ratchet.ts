import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import type { ParserRuleContext } from "antlr4ng";

// Shared runner for the per-dialect docs-corpus gates. A docs corpus is mostly object/platform DDL
// that is cleared OUT of scope; gating on the blended pass rate would measure us on work we
// deliberately don't do. So the gate applies to the in-scope query bucket (SELECT/WITH/VALUES/…) and
// only REPORTS the dml/ddl/unparsed buckets — they never fail the gate.
//
// BUCKETING IS FROM THE PATH. The corpus is laid out by the organizer (tools/organize-corpus.test.ts)
// as `parser/positive/<kind>/<slug…>`, where <kind> is `bucketOfKinds(statementCategories)` over the
// CURRENT parser (tests/helpers/statement-bucket.ts) — the same rule this gate would apply. So the
// gate trusts the path: it never re-classifies at test time (no leading-keyword regex, no
// parse-everything). It parses ONLY the query bucket — the deliverable — which is why the gate is
// fast even on a corpus of thousands of DDL files. A query/ file that fails to parse is a regression
// (or a stale reclassification), never an exclusion — re-run the organizer, then investigate.

export interface DocsRatchetOptions {
	/**
	 * Documented-broken query examples (docs typos/truncations) and valid SQL the grammar doesn't
	 * accept yet (issue-tracked gaps) — slugs relative to the corpus page root, mapped to the reason.
	 * By construction these fail to parse, so the organizer files them under `unparsed/`. The gate
	 * asserts each slug STILL sits under `unparsed/`: if a rebuild moved one out (the docs got fixed or
	 * the grammar grew), the file now parses and left `unparsed/`, the assertion fails, and the entry
	 * is removed. The query gate needs no exclusion list — known-bad files are not in `query/`.
	 */
	knownBad?: Record<string, string>;
	/**
	 * Query-bucket parse: return the syntax-error count AND the parse tree so the tree can feed
	 * `onCleanQuery` without a second parse. When omitted, `parseErrors` supplies the count (and
	 * `onCleanQuery` cannot fire, since there is no tree).
	 */
	parse?: (sql: string) => { errors: number; tree: ParserRuleContext };
	/**
	 * Pipeline hook: fires ONCE per clean query-bucket file with the already-produced parse tree. Lets
	 * a gate run lower → walkIr → resolveScopes → deriveSymbols over the same single parse the ratchet
	 * made. Never fires for dml/ddl/unparsed or failing files.
	 */
	onCleanQuery?: (rel: string, tree: ParserRuleContext) => void;
}

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

type Bucket = "query" | "dml" | "ddl" | "unparsed";

/** The bucket a file was placed in, read off its rel path `…/<validity>/<kind>/<slug…>`. The organizer
 *  emits only query/dml/ddl/unparsed, but map the legacy fine-grained kinds too (dcl/tcl/utility/
 *  compound/other → ddl) so a not-yet-reclassified tree still buckets sensibly. */
function pathBucket(rel: string): Bucket {
	const seg = rel.split("/");
	const vi = seg.findIndex((s) => s === "positive" || s === "negative");
	const kind = vi >= 0 && vi + 1 < seg.length ? seg[vi + 1] : seg[0];
	if (kind === "query") return "query";
	if (kind === "dml") return "dml";
	if (kind === "unparsed") return "unparsed";
	return "ddl"; // ddl | dcl | tcl | utility | compound | other
}

/**
 * Parse the query-bucket examples (100% must parse), and report the dml/ddl/unparsed side buckets.
 * `parseErrors` returns the syntax-error count for one query example (0 = clean); a throw counts as a
 * failure. `opts.parse` supersedes it when the tree is needed for `onCleanQuery`.
 */
export function runDocsRatchet(
	dir: string,
	parseErrors: (sql: string) => number,
	queryBaseline: number,
	opts: DocsRatchetOptions = {},
): void {
	const knownBad = opts.knownBad ?? {};
	// KNOWN_BAD keys are provenance slugs (e.g. "account-usage/5.sql"); the file lives at
	// "…/unparsed/<slug>", so match by slug suffix. Slugs are full page-paths, so no suffix collisions.
	const matchKey = (rel: string, k: string): boolean => rel === k || rel.endsWith("/" + k);

	const query = { pass: 0, total: 0 };
	let dml = 0;
	let ddl = 0;
	const unparsedRels: string[] = [];
	const queryFails: string[] = [];

	for (const f of sqlFiles(dir)) {
		const rel = f
			.slice(dir.length + 1)
			.split("\\")
			.join("/");
		const bucket = pathBucket(rel);
		if (bucket === "dml") {
			dml++;
			continue;
		}
		if (bucket === "ddl") {
			ddl++;
			continue;
		}
		if (bucket === "unparsed") {
			unparsedRels.push(rel);
			continue;
		}
		// query bucket — the gated, in-scope read path. Parse it (100% must be clean).
		query.total++;
		const sql = readFileSync(f, "utf8");
		let errs = 1;
		let tree: ParserRuleContext | undefined;
		try {
			if (opts.parse) {
				const res = opts.parse(sql);
				errs = res.errors;
				tree = res.tree;
			} else {
				errs = parseErrors(sql);
			}
		} catch {
			errs = -1;
		}
		if (errs === 0) {
			query.pass++;
			if (tree && opts.onCleanQuery) opts.onCleanQuery(rel, tree);
		} else {
			queryFails.push(rel);
		}
	}

	const pct = query.total ? ((100 * query.pass) / query.total).toFixed(1) : "—";
	console.log(
		`\n  query ${query.pass}/${query.total} (${pct}%)  [gated, floor ${queryBaseline}]` +
			`\n  dml   ${dml} files  [out of scope, reported]` +
			`\n  ddl   ${ddl} files  [out of scope, reported]` +
			`\n  unparsed ${unparsedRels.length} files  [known-fail as of the last reclassification, reported]`,
	);

	// Vacuity guard: the query bucket must not be empty (a reclassification that emptied query/ would
	// otherwise pass a 0/0 gate silently).
	expect(query.total, "query bucket is empty — did reclassification misfile everything?").toBeGreaterThan(0);

	// Soft population floor: the 100% gate below only proves every query/ file parses — it says nothing
	// about how many files are IN query/. A reclassification that drained query/ into dml/ddl/unparsed
	// would still pass a shrunken 100% gate silently. queryBaseline is the documented floor (see each
	// caller's QUERY_BASELINE); dropping below it is a regression to investigate, not to lower the number.
	expect(
		query.total,
		`query bucket shrank below its documented floor (${query.total} < ${queryBaseline}) — investigate the reclassification, don't lower the floor`,
	).toBeGreaterThanOrEqual(queryBaseline);

	// Inverted self-policing: each known-bad / deferred slug must STILL sit under unparsed/. If the
	// docs were fixed or the grammar grew, the file now parses, the organizer moved it into query/,
	// and it is no longer here — drop it from the list (and close the issue item).
	const escaped = Object.keys(knownBad).filter((k) => !unparsedRels.some((rel) => matchKey(rel, k)));
	expect(
		escaped,
		`KNOWN_BAD/DEFERRED entries no longer sit under unparsed/ (docs fixed or grammar grew — re-run the organizer, then remove them):\n${escaped.join("\n")}`,
	).toEqual([]);

	// 100% gate: every query-bucket example must parse. The bucket is populated by the organizer from
	// a clean parse, so a failure here is a regression or a stale reclassification — never an exclusion.
	expect(
		queryFails,
		`in-scope query examples failed to parse (query/ is reclassifier-populated — investigate, don't exclude):\n${queryFails.join("\n")}`,
	).toEqual([]);
}
