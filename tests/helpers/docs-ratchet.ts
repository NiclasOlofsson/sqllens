import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { classifySql, type SqlKind } from "./sql-kind.js";

// Shared runner for the per-dialect docs-corpus gates. A docs corpus is mostly object/
// platform DDL that is cleared OUT of scope; gating on the blended pass rate would measure
// us on work we deliberately don't do. So the gate RATCHETS on the in-scope query bucket
// (SELECT/WITH/VALUES/…) and only REPORTS the dml/ddl buckets — they never fail the gate.

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
}

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
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
		const kind: SqlKind = classifySql(sql);
		const rel = f.slice(dir.length + 1).split("\\").join("/");
		let errs = 1;
		try {
			errs = parseErrors(sql);
		} catch {
			errs = -1;
		}
		const clean = errs === 0;

		if (kind === "query" && rel in knownBad) {
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
	console.log(
		`\n  query ${r.query.pass}/${r.query.total} (${pct(r.query)}%)  [gated${excluded}]` +
			`\n  dml   ${r.dml.pass}/${r.dml.total} (${pct(r.dml)}%)  [reported, out of scope]` +
			`\n  ddl   ${r.ddl.pass}/${r.ddl.total} (${pct(r.ddl)}%)  [reported, out of scope]`,
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
