import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The corpus (proprietary Oatly SQL + scraped closed-license docs + bulky upstream clones)
// lives in ONE place: the directory named by SQL_CORPUS_DIR — the clone of the private
// `sqllens-corpus` repo. It is set in `.env` at the repo root (committed) or in the real
// environment. There is no fallback: no sibling-folder guess, no in-tree copy. `rel` is the
// path the data has inside that repo, e.g. "harness/local/databricks" or
// "vendor/sql-docs/docs/t-sql". Gates still skipIf(!existsSync(corpusPath(...))) so a
// configured-but-absent sub-path (partial corpus, or a path not on this machine) skips —
// but a missing SQL_CORPUS_DIR fails loudly.
function corpusDir(): string {
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

export const corpusPath = (rel: string): string => resolve(ROOT, rel);
