import { describe, expect, it } from "vitest";
import { parsePostgres } from "../src/postgres/parse.js";
import { parseTSql } from "../src/tsql/parse.js";

// sllFallback surfaces which of the two-stage parse's paths produced the result: false when the fast
// SLL prediction pass parsed clean, true when it bailed and the parse re-ran under full LL. Either way
// the parse itself is identical — this is purely a perf-profiling signal (tools/profile-sll.ts and the
// per-dialect fallback ratchets in tests/corpus/*.test.ts), so a fallback parse must still be error-free.

describe("sllFallback", () => {
	it("is false for a plain valid statement (SLL alone resolves it)", () => {
		expect(parseTSql("SELECT a FROM t").sllFallback).toBe(false);
	});

	it("is true for a construct that forces the SLL pass to bail, and still parses clean", () => {
		// T-SQL's `full_table_name`/dotted-name grammar is context-sensitive (see task-1-brief.md's
		// known first targets): a bare `a.b.c` in the select list can't be resolved under SLL's local
		// lookahead alone, so stage 1 bails and stage 2 (full LL) reparses it — same result, just slower.
		const r = parseTSql("SELECT a.b.c FROM t");
		expect(r.sllFallback).toBe(true);
		expect(r.errors).toBe(0);
	});

	it("also fires for Postgres's function-call grammar (a second dialect, same two-stage shape)", () => {
		const r = parsePostgres("SELECT f(a, b) FROM t");
		expect(r.sllFallback).toBe(true);
		expect(r.errors).toBe(0);
	});
});
