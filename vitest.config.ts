import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Git worktrees live under .claude/worktrees/<name>/ INSIDE this repo and carry their own copy
		// of tests/. Without this exclude, vitest's `**/*.test.ts` glob runs a sibling worktree's tests
		// as part of this project's suite — they fail against shared state this branch has changed (e.g.
		// the relocated corpus). A project's test run should cover only this working tree.
		exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
		// Use the worker-threads pool, not the default `forks` pool.
		//
		// On this toolchain (Windows + Node 24 + vitest 4) the forks pool intermittently dies
		// while a fresh worker imports our large generated parser modules (the serialized ANTLR
		// ATN is a big module). The crash surfaces *before any test runs* as
		// "Cannot read properties of undefined (reading 'config')" with a "no tests" result —
		// it's a worker-startup race, not a real test failure. The threads pool imports into the
		// same process and has been stable. This replaces the previous "just rerun it" workaround.
		pool: "threads",
	},
});
