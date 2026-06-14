import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Test corpora (the proprietary Oatly SQL, the scraped vendor-docs corpora, and the bulky
// upstream example clones) live OUTSIDE the source tree — they are gitignored and, for the
// closed docs, must not be redistributed. To survive disk loss / new machines and to be
// reachable from git worktrees (where the gitignored in-tree copies don't exist), keep them
// in a separate private repo, `sqllens-corpus`, cloned once.
//
// Corpus root resolution, in order:
//   1. $SQL_CORPUS_DIR        — absolute override; set once at the user/machine level, it is
//                               inherited by every worktree and every spawned agent process,
//                               so it is the only reliable option inside a worktree.
//   2. ../sqllens-corpus      — a sibling clone, zero-config for the main checkout. Named for the
//                               repo (NiclasOlofsson/sqllens), not the local folder (which is still
//                               the provisional `sql-dialect-grammars`), so it is independent of the
//                               working-copy directory name.
//   3. the repo itself (cwd)  — back-compat with the legacy in-tree harness/local + vendor.
//
// `rel` is the full repo-relative path the file would have in-tree (e.g.
// "harness/local/databricks", "vendor/grammars-v4/sql/tsql/examples"); the corpus repo
// mirrors those same paths. We prefer the corpus copy when it exists and fall back to the
// in-tree path otherwise, so the corpus repo may carry any subset. Gates skipIf the result
// is absent, so a missing corpus stays a no-op rather than a failure.
function corpusRoot(): string {
	if (process.env.SQL_CORPUS_DIR) return resolve(process.env.SQL_CORPUS_DIR);
	const sibling = resolve(process.cwd(), "..", "sqllens-corpus");
	return existsSync(sibling) ? sibling : process.cwd();
}

const ROOT = corpusRoot();

export function corpusPath(rel: string): string {
	if (ROOT !== process.cwd()) {
		const inCorpus = resolve(ROOT, rel);
		if (existsSync(inCorpus)) return inCorpus;
	}
	return resolve(process.cwd(), rel);
}
