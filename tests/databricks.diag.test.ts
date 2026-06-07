import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";

function firstError(sql: string): string | null {
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const parser = new DatabricksParser(new CommonTokenStream(lexer));
	let err: string | null = null;
	const l = {
		syntaxError(_r: unknown, _s: unknown, line: number, col: number, msg: string) {
			if (!err) err = `${line}:${col} ${msg}`;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	lexer.removeErrorListeners();
	lexer.addErrorListener(l as never);
	parser.removeErrorListeners();
	parser.addErrorListener(l as never);
	parser.singleStatement();
	return err;
}

const CASES: [string, string][] = [
	["select literal", "SELECT 1"],
	["count(*)", "SELECT count(*) FROM t"],
	["agg max", "SELECT max(x) FROM t"],
	["ifnull()", "SELECT ifnull(a, 1) FROM t"],
	["cast", "SELECT cast(x as string) FROM t"],
	["cast(func())", "SELECT cast(ifnull(a, 1) as string) FROM t"],
	["backtick name", "SELECT a FROM `db`.`t`"],
	["3-part name", "SELECT a FROM db.schema.t"],
	["cte lower", "with c as (select 1 as x) select * from c"],
	["where + and", "SELECT a FROM t WHERE a = 1 AND b = 2"],
	["join", "SELECT a FROM t JOIN u ON t.id = u.id"],
	["case when", "SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t"],
];

describe("databricks minimal-construct diagnostic", () => {
	it("reports which basic constructs parse", () => {
		const rows = CASES.map(([name, sql]) => {
			const e = firstError(sql);
			return `  ${e ? "FAIL" : "ok  "}  ${name.padEnd(16)} ${e ?? ""}`;
		});
		console.log(["", "Minimal-construct diagnostic:", ...rows].join("\n"));
		expect(CASES.length).toBeGreaterThan(0);
	});
});
