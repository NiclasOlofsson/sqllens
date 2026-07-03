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
		// After the SLL-surgery wave (task-3-report.md) the dotted-name context-sensitivity is gone —
		// `SELECT a.b.c FROM t` now resolves under SLL alone. The one surviving T-SQL fallback is the
		// batch-boundary bare-procedure execute (`sp_who` with no EXEC): whether the leading token is an
		// `execute_body_batch` proc name or the start of a `sql_clauses` statement is decidable only with
		// caller context, so stage 1 bails and stage 2 (full LL) reparses it — same result, just slower.
		const r = parseTSql("sp_who\nGO");
		expect(r.sllFallback).toBe(true);
		expect(r.errors).toBe(0);
	});

	it("also fires for Postgres, a second dialect with the same two-stage shape", () => {
		// The SLL-surgery wave (task-4-report.md) cured the function-call and typed-literal fallbacks by
		// reordering c_expr. A surviving Postgres fallback is the two-word `double precision` type used as
		// a cast typmod: `func_application`'s `func_name` overlaps `simpletypename`, so `x::double
		// precision` mispredicts and stage 1 bails to full LL — same result, just slower.
		const r = parsePostgres("SELECT round(x::double precision) FROM t");
		expect(r.sllFallback).toBe(true);
		expect(r.errors).toBe(0);
	});
});
