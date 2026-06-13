import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import type { StatementCategory } from "../../src/ir/statement.js";
import { classifySql, type SqlKind } from "./sql-kind.js";

// Shared runner for the per-dialect docs-corpus gates. A docs corpus is mostly object/
// platform DDL that is cleared OUT of scope; gating on the blended pass rate would measure
// us on work we deliberately don't do. So the gate applies to the in-scope query bucket
// (SELECT/WITH/VALUES/…) and only REPORTS the dml/ddl buckets — they never fail the gate.
//
// Bucketing: when the dialect provides parse-based statement detection (opts.classify — T-SQL
// does, via statementCategories), EVERY file is parsed ONCE and a parseable file is bucketed
// from its parsed statement kinds; the leading-keyword regex (sql-kind.ts) is only the fallback
// for files that do not parse. Dialects without opts.classify keep the regex bucketing and skip
// parsing out-of-scope files (a speed optimization — parsing ~2,800 failing DDL files just to
// print an ungated number was the bulk of the corpus runtime).

export interface DocsRatchetResult {
	query: { pass: number; total: number };
	dml: { pass: number; total: number };
	ddl: { pass: number; total: number };
}

export interface DocsRatchetOptions {
	/**
	 * Known-bad query examples — paths relative to `dir` (forward slashes) mapped to the reason
	 * they are not valid SQL (docs typos/truncations). Excluded from the gated query bucket and
	 * asserted to STILL fail; one that starts parsing fails the gate as stale (remove it then).
	 * When provided, the query gate tightens from "ratchet" to "100% of the remaining bucket".
	 */
	knownBad?: Record<string, string>;
	/**
	 * Valid-SQL files whose payload is out-of-scope DDL/admin although they lead with a query
	 * keyword (mixed setup-SELECT + DDL scripts). Forced into the ddl bucket; no still-fails
	 * assertion — whether they parse is irrelevant to the query gate.
	 */
	outOfScope?: Record<string, string>;
	/**
	 * Parse-based statement-kind detection: parse the file ONCE and return both its syntax-error
	 * count and (when clean) its per-statement categories. When set, bucketing is parse-derived
	 * (the regex is only the no-parse fallback) and the dml/ddl buckets get real pass rates. One
	 * call does the whole job — the gate does not re-parse for the error count, so the slow LL
	 * stage runs at most once per file.
	 */
	classify?: (sql: string) => { errors: number; kinds: StatementCategory[] | undefined };
}

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

/** Bucket a parsed file by its statement kinds: the first substantive statement decides —
 *  utility/tcl/other are setup/preamble (USE, SET, DECLARE, BEGIN TRAN, …); query/dml win as
 *  themselves; ddl/dcl and BEGIN…END compounds land in the ddl (everything-else) bucket. A file
 *  with no substantive statement (pure setup) is ddl. */
function bucketOfKinds(kinds: StatementCategory[]): SqlKind {
	for (const k of kinds) {
		if (k === "query") return "query";
		if (k === "dml") return "dml";
		if (k === "ddl" || k === "dcl" || k === "compound") return "ddl";
	}
	return "ddl";
}

/**
 * Parse every example, bucket it by statement kind, and print the per-bucket breakdown.
 * `parseErrors` returns the syntax-error count for one example (0 = clean); a throw counts as
 * a failure. Only the query bucket gates: by default it ratchets (never drops below
 * `queryBaseline`). Pass `opts.knownBad` to exclude documented-broken examples and require the
 * remaining query bucket to parse at 100%.
 */
export function runDocsRatchet(
	dir: string,
	parseErrors: (sql: string) => number,
	queryBaseline: number,
	opts: DocsRatchetOptions = {},
): void {
	const knownBad = opts.knownBad ?? {};
	const outOfScope = opts.outOfScope ?? {};
	const r: DocsRatchetResult = {
		query: { pass: 0, total: 0 },
		dml: { pass: 0, total: 0 },
		ddl: { pass: 0, total: 0 },
	};
	const queryFails: string[] = []; // in-scope query files that failed and are NOT known-bad
	const staleKnownBad: string[] = []; // listed as known-bad but now parse cleanly
	let knownBadSeen = 0;

	for (const f of sqlFiles(dir)) {
		const sql = readFileSync(f, "utf8");
		const rel = f
			.slice(dir.length + 1)
			.split("\\")
			.join("/");

		let errs: number;
		let kind: SqlKind;
		if (opts.classify) {
			// Detection mode: ONE parse per file yields both the error count and the kinds; bucket
			// from the parse, regex only as the no-parse fallback (a failed parse has no usable tree).
			let kinds: StatementCategory[] | undefined;
			try {
				const res = opts.classify(sql);
				errs = res.errors;
				kinds = res.kinds;
			} catch {
				errs = -1;
				kinds = undefined;
			}
			kind = kinds ? bucketOfKinds(kinds) : classifySql(sql);
		} else {
			// Regex mode: only the query bucket is parsed; dml/ddl are counted, not parsed.
			kind = classifySql(sql);
			if (kind !== "query") {
				r[kind].total++;
				continue;
			}
			errs = 1;
			try {
				errs = parseErrors(sql);
			} catch {
				errs = -1;
			}
		}
		const clean = errs === 0;

		if (rel in outOfScope) {
			// Out-of-scope payload (DDL/admin) behind a query-leading script — never gated.
			r.ddl.total++;
			if (clean) r.ddl.pass++;
			continue;
		}
		if (rel in knownBad) {
			knownBadSeen++;
			if (clean) staleKnownBad.push(rel);
			continue; // excluded from the gated query bucket
		}

		r[kind].total++;
		if (clean) r[kind].pass++;
		else if (kind === "query") queryFails.push(rel);
	}

	const pct = (b: { pass: number; total: number }) => (b.total ? ((100 * b.pass) / b.total).toFixed(1) : "—");
	const excluded = knownBadSeen ? `, ${knownBadSeen} known-bad excluded` : "";
	const offScope = Object.keys(outOfScope).length ? `, ${Object.keys(outOfScope).length} out-of-scope -> ddl` : "";
	const side = (b: { pass: number; total: number }, name: string) =>
		opts.classify
			? `\n  ${name}   ${b.pass}/${b.total} (${pct(b)}%)  [out of scope, reported only]`
			: `\n  ${name}   ${b.total} files  [out of scope, not parsed]`;
	console.log(
		`\n  query ${r.query.pass}/${r.query.total} (${pct(r.query)}%)  [gated${excluded}${offScope}]` +
			side(r.dml, "dml") +
			side(r.ddl, "ddl"),
	);

	// Self-policing: a known-bad file that now parses means the docs were fixed (or our grammar
	// grew to accept it) — drop it from the list rather than silently keeping a stale exclusion.
	expect(
		staleKnownBad,
		`known-bad examples now parse cleanly — remove them from KNOWN_BAD:\n${staleKnownBad.join("\n")}`,
	).toEqual([]);

	if (opts.knownBad) {
		// 100% gate: every in-scope query example that is not documented-broken must parse.
		expect(
			queryFails,
			`in-scope query examples failed to parse (not in KNOWN_BAD):\n${queryFails.join("\n")}`,
		).toEqual([]);
	} else {
		expect(
			r.query.pass,
			`in-scope query pass count dropped: ${r.query.pass}/${r.query.total} (baseline ${queryBaseline})`,
		).toBeGreaterThanOrEqual(queryBaseline);
	}
}
