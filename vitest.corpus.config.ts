import { configDefaults, defineConfig } from "vitest/config";

// Tier 2 — the corpus conformance gates. `npm run test:corpus` runs ONLY tests/corpus/**: the
// per-dialect grammar/pipeline gates that parse thousands of files each (Oatly, the scraped docs
// corpora, the ZetaSQL golden corpora). They are the bar to clear before any merge to master, not
// the inner-loop `npm test` tier. Each corpus file is parsed once, at the highest pipeline level.
export default defineConfig({
	test: {
		include: ["tests/corpus/**/*.test.ts"],
		// A sibling git worktree under .claude/worktrees/ carries its own tests/corpus/ — don't run it.
		exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
		// Same threads pool as tier 1 — the forks pool intermittently dies importing the large generated
		// parser modules on this toolchain (see vitest.config.ts). Each thread imports the big generated
		// ANTLR modules, so worker count is a RAM multiplier — this tier parses thousands of files and is
		// the heavy one. Capped to 4 (was 50% = 8 of 16): RAM is the constraint, and this tier must NEVER
		// run concurrently with another corpus run (controller serializes it — one corpus run at a time,
		// at merge, never per-implementer). Slower per run, but it doesn't flatten the machine.
		pool: "threads",
		maxWorkers: 4,
		testTimeout: 1_800_000,
	},
});
