import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Node-tools twin of tests/helpers/corpus.ts. The corpus lives in ONE place: the directory
// named by SQL_CORPUS_DIR — the clone of the private `sqllens-corpus` repo. Set in `.env` at
// the repo root (committed) or in the real environment. No fallback. The scraper/extractor
// scripts read their vendor SRC and write their harness/local OUT through corpusPath, so they
// target the corpus repo directly (the in-tree copies are gone). `rel` is the path the data
// has inside that repo, e.g. "vendor/googlesql/googlesql/analyzer/testdata".
//
// This duplicates the tiny resolver in tests/helpers/corpus.ts on purpose: tsconfig includes
// only src+tests, and these .mjs tools can't import a .ts. One trivial rule, two module
// systems — not worth a cross-boundary shim.
function corpusDir() {
	let dir = process.env.SQL_CORPUS_DIR;
	if (!dir) {
		const f = resolve(process.cwd(), ".env");
		if (existsSync(f)) {
			const m = readFileSync(f, "utf8").match(/^\s*SQL_CORPUS_DIR\s*=\s*(.*)$/m);
			if (m) dir = m[1].trim().replace(/^["']|["']$/g, "");
		}
	}
	if (!dir)
		throw new Error(
			"SQL_CORPUS_DIR is not set — define it in .env (the sqllens-corpus clone path). " +
				"See CLAUDE.md → Corpus location.",
		);
	return resolve(dir);
}

const ROOT = corpusDir();

export const corpusPath = (rel) => resolve(ROOT, rel);
