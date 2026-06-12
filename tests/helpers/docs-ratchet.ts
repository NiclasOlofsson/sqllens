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

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

/**
 * Parse every example, bucket it by statement kind, assert the query bucket never drops
 * below `queryBaseline`, and print the per-bucket breakdown. `parseErrors` returns the
 * syntax-error count for one example (0 = clean); a throw counts as a failure.
 */
export function runDocsRatchet(dir: string, parseErrors: (sql: string) => number, queryBaseline: number): void {
	const r: DocsRatchetResult = {
		query: { pass: 0, total: 0 },
		dml: { pass: 0, total: 0 },
		ddl: { pass: 0, total: 0 },
	};
	for (const f of sqlFiles(dir)) {
		const sql = readFileSync(f, "utf8");
		const kind: SqlKind = classifySql(sql);
		r[kind].total++;
		let errs = 1;
		try {
			errs = parseErrors(sql);
		} catch {
			errs = -1;
		}
		if (errs === 0) r[kind].pass++;
	}

	const pct = (b: { pass: number; total: number }) => (b.total ? ((100 * b.pass) / b.total).toFixed(1) : "—");
	// Reported for visibility; only the query bucket gates. dml = write/operational DML,
	// ddl = object/platform DDL (cleared Out) — both informational.
	console.log(
		`\n  query ${r.query.pass}/${r.query.total} (${pct(r.query)}%)  [gated]` +
			`\n  dml   ${r.dml.pass}/${r.dml.total} (${pct(r.dml)}%)  [reported, out of scope]` +
			`\n  ddl   ${r.ddl.pass}/${r.ddl.total} (${pct(r.ddl)}%)  [reported, out of scope]`,
	);

	expect(
		r.query.pass,
		`in-scope query pass count dropped: ${r.query.pass}/${r.query.total} (baseline ${queryBaseline})`,
	).toBeGreaterThanOrEqual(queryBaseline);
}
