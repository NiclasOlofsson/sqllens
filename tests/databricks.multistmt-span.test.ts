import { describe, expect, it } from "vitest";
import { parse } from "../src/api.js";
import type { ParserRuleContext } from "antlr4ng";

// Issue #21 — a multi-statement Databricks batch must NOT present as a single whole-file
// Select. The batch lowers as one flagged compound body (the documented multi-statement
// limitation); the bug was that its body claimed kind "select" with a CST span stretched to
// EOF, so a downstream AST index reported a bogus whole-file Select enclosure over stmts 2-3.

const BATCH = `SELECT 1 AS a;\nSELECT partition_col, count(*) FROM t GROUP BY partition_col;\nSELECT 3 AS c;`;

/** 0-based inclusive char range of a CST node. */
function span(cst: ParserRuleContext): { from: number; to: number } {
	return { from: cst.start!.start, to: (cst.stop ?? cst.start)!.stop };
}

describe("databricks multi-statement batch span (#21)", () => {
	it("parses the 3-statement batch with no syntax errors", () => {
		const { errors } = parse(BATCH, "databricks");
		expect(errors).toBe(0);
	});

	it("flags the batch as a compound, not a plain Select", () => {
		const { ast } = parse(BATCH, "databricks");
		expect(ast.statement).toBe("compound");
		// The body must not read as a trustworthy plain Select — it carries the flag.
		expect(ast.body.kind).toBe("select");
		expect(ast.body.kind === "select" && ast.body.unsupported).toContain("multi-statement");
	});

	it("does NOT stretch statement-1's span to EOF", () => {
		const { ast } = parse(BATCH, "databricks");
		const firstStmtEnd = BATCH.indexOf(";"); // end of `SELECT 1 AS a`
		const fileEnd = BATCH.length - 1;
		const bodySpan = span(ast.body.cst);
		// The body must not claim to enclose statements 2 and 3 as if it were their Select.
		// Either it is bounded to statement 1 (span ends at/before the first `;`) — proving it
		// no longer stretches to EOF — matching the "bound statement 1's span" reporter ask.
		expect(bodySpan.to).toBeLessThan(fileEnd);
		expect(bodySpan.to).toBeLessThanOrEqual(firstStmtEnd);
	});
});
