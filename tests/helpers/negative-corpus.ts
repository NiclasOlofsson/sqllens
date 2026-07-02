import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect } from "vitest";

// Shared runner for the six dialects' NEGATIVE corpus gate — the two-sided complement to the docs
// ratchet (issue #5). Mirrors the shape of bigquery.analyzer.test.ts's negative block, but over two
// sub-corpora that live under `<dialect>/docs/parser/negative/unparsed/`:
//
//   mutated/<class>/…  — mechanical mutants from tools/mutate-corpus.mjs. Mutation cannot GUARANTEE
//                        invalidity (deleting an optional token, or truncating after a complete clause,
//                        can leave valid SQL), so this is a REJECTION-RATE RATCHET: the count of mutants
//                        the parser rejects must stay at or above the measured floor (it may only rise).
//   curated/…          — hand-authored near-misses, each doc-informed and commented with WHY it is invalid
//                        in this dialect. A curated case that PARSES CLEAN is a real grammar-precision bug,
//                        so this is a 100%-REJECT bar: zero accepted, no exclusions.
//
// A "reject" = the parser reports ≥1 syntax error OR throws. Curated files carry a leading `-- WHY:`
// comment (trivia — it never changes the parse) explaining the invalidity.

function* sqlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

interface Tally {
	rejected: number;
	accepted: number;
	acceptedRels: string[];
}

function tally(dir: string, base: string, rejects: (sql: string) => boolean): Tally {
	const t: Tally = { rejected: 0, accepted: 0, acceptedRels: [] };
	for (const f of sqlFiles(dir)) {
		const sql = readFileSync(f, "utf8");
		if (rejects(sql)) t.rejected++;
		else {
			t.accepted++;
			t.acceptedRels.push(relative(base, f).split(sep).join("/"));
		}
	}
	return t;
}

/**
 * Run the negative gate for one dialect. `baseDir` is `<dialect>/docs/parser/negative/unparsed`.
 * `parseErrors` returns the syntax-error count for one statement (0 = clean parse). `mutatedFloor`
 * is the pinned rejection-rate ratchet (measured, may only rise).
 */
export function runNegativeCorpus(
	label: string,
	baseDir: string,
	parseErrors: (sql: string) => number,
	mutatedFloor: number,
): void {
	const rejects = (sql: string): boolean => {
		try {
			return parseErrors(sql) > 0;
		} catch {
			return true; // a throw is a rejection
		}
	};

	const mutated = tally(join(baseDir, "mutated"), baseDir, rejects);
	const curated = tally(join(baseDir, "curated"), baseDir, rejects);
	const mutTotal = mutated.rejected + mutated.accepted;
	const pct = mutTotal ? ((100 * mutated.rejected) / mutTotal).toFixed(1) : "—";

	// eslint-disable-next-line no-console
	console.log(
		`\n  ${label} negatives:` +
			`\n    mutated  ${mutated.rejected}/${mutTotal} rejected (${pct}%)  [ratchet floor ${mutatedFloor}]` +
			`\n    curated  ${curated.rejected}/${curated.rejected + curated.accepted} rejected  [100%-reject bar]`,
	);

	// Curated: 100%-reject. A false-accept is a grammar-precision bug — investigate + fix, never exclude.
	expect(
		curated.acceptedRels,
		`curated near-misses parsed CLEAN (grammar-precision bug — fix the grammar or the case, do not exclude):\n${curated.acceptedRels.join("\n")}`,
	).toEqual([]);
	// A curated bucket that emptied would silently pass — guard it.
	expect(curated.rejected + curated.accepted, `${label} curated bucket is empty`).toBeGreaterThan(0);

	// Mutated: rejection-rate ratchet. May only rise.
	expect(
		mutated.rejected,
		`${label} mutated rejection count fell below the pinned floor (${mutated.rejected} < ${mutatedFloor}) — a grammar change made more mutants parse; investigate before lowering`,
	).toBeGreaterThanOrEqual(mutatedFloor);
}
