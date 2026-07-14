import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Git worktrees live under .claude/worktrees/<name>/ INSIDE this repo and carry their own copy
		// of tests/. Without this exclude, vitest's `**/*.test.ts` glob runs a sibling worktree's tests
		// as part of this project's suite — they fail against shared state this branch has changed (e.g.
		// the relocated corpus). A project's test run should cover only this working tree.
		// Corpus conformance gates live in tests/corpus/ and run as their own tier (npm run test:corpus,
		// vitest.corpus.config.ts). They parse thousands of files each and are the every-merge bar, not
		// the every-run inner loop — excluding them here keeps `npm test` a fast units/features tier.
		exclude: [...configDefaults.exclude, ".claude/worktrees/**", "tests/corpus/**", "temp_auto/**"],
		// Use the worker-threads pool, not the default `forks` pool.
		//
		// On this toolchain (Windows + Node 24 + vitest 4) the forks pool intermittently dies
		// while a fresh worker imports our large generated parser modules (the serialized ANTLR
		// ATN is a big module). The crash surfaces *before any test runs* as
		// "Cannot read properties of undefined (reading 'config')" with a "no tests" result —
		// it's a worker-startup race, not a real test failure. The threads pool imports into the
		// same process and has been stable. This replaces the previous "just rerun it" workaround.
		pool: "threads",
		// Cap workers hard. Each thread imports the large generated ANTLR modules (a big serialized ATN
		// per dialect), so worker count is a RAM multiplier, not just a CPU one. Uncapped, tier-1 grabs
		// all ~16 logical cores; with several agents running suites in parallel that oversubscribes RAM
		// and flattens the machine. 4 workers is plenty for this fast units/features tier and leaves
		// headroom for a concurrent run. RAM is the constraint here, not throughput. Dropped 4→2 after a
		// worker OOM'd mid-run (`DataCloneError: out of memory` serializing results) even at 4 — the box is
		// tight enough (+ other processes resident) that 4 is intermittently over the line. 2 is safe.
		maxWorkers: 2,
	},
});
