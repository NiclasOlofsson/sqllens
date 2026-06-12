import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
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
