import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { CharStream, CommonTokenStream, ParserRuleContext, type ParseTree } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";

// Real, proprietary corpus copied locally (gitignored). See harness/local/.
const CORPUS = corpusPath("databricks/oatly");

function parse(sql: string): { errors: number; first?: string; tree: ParseTree } {
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const parser = new DatabricksParser(new CommonTokenStream(lexer));
	let errors = 0;
	let first: string | undefined;
	const listener = {
		syntaxError(_r: unknown, _s: unknown, line: number, col: number, msg: string) {
			errors++;
			if (!first) first = `${line}:${col} ${msg}`;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
	return { errors, first, tree: parser.singleStatement() };
}

// Walk the typed parse tree, collecting every node produced by a given parser rule.
function nodesOfRule(node: ParseTree, ruleIndex: number, acc: ParserRuleContext[] = []) {
	if (node instanceof ParserRuleContext && node.ruleIndex === ruleIndex) acc.push(node);
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child) nodesOfRule(child, ruleIndex, acc);
	}
	return acc;
}

// Collapse an ANTLR error into a cluster key so similar gaps group together.
function clusterKey(msg: string): string {
	return msg
		.replace(/^\d+:\d+ /, "")
		.replace(/'[^']*'/g, "'X'")
		.replace(/\{[^}]*\}/g, "{...}");
}

describe.skipIf(!existsSync(CORPUS))("databricks REAL corpus (local dbt output)", () => {
	it("coverage over compiled dbt models", () => {
		const files = readdirSync(CORPUS, { recursive: true }).filter(
			(f): f is string => typeof f === "string" && f.endsWith(".sql"),
		);

		let pass = 0;
		let withQuery = 0;
		const failures: { file: string; first?: string }[] = [];
		// Files that parsed with zero errors but produced no query structure — a "clean" parse that
		// recognized nothing. Spark's non-reserved keywords make zero-errors necessary but not
		// sufficient, so we also require a real querySpecification in the tree.
		const degenerate: string[] = [];
		const clusters = new Map<string, number>();

		for (const rel of files) {
			const { errors, first, tree } = parse(readFileSync(join(CORPUS, rel), "utf8"));
			const hasQuery = nodesOfRule(tree, DatabricksParser.RULE_querySpecification).length > 0;
			if (hasQuery) withQuery++;
			if (errors === 0) {
				pass++;
				if (!hasQuery) degenerate.push(rel);
			} else {
				failures.push({ file: rel, first });
				if (first) clusters.set(clusterKey(first), (clusters.get(clusterKey(first)) ?? 0) + 1);
			}
		}

		const top = [...clusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
		const pct = ((pass / files.length) * 100).toFixed(1);

		console.log(
			[
				``,
				`Databricks REAL corpus (compiled dbt models): ${files.length} files`,
				`  PASS (0 syntax errors): ${pass} (${pct}%)`,
				`  Recognized as queries:  ${withQuery}/${files.length}`,
				`  FAIL: ${failures.length}`,
				``,
				`Top failure clusters (normalized first error):`,
				...top.map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`),
				``,
				`Sample failing files:`,
				...failures.slice(0, 10).map((f) => `  - ${f.file}  | ${f.first}`),
			].join("\n"),
		);

		expect(files.length).toBeGreaterThan(0);
		// THE Databricks baseline. Two-part gate, both required because Spark over-accepts:
		//   1. every compiled Oatly model parses with zero syntax errors, and
		//   2. every clean parse yields a real query tree (no degenerate "parsed but recognized
		//      nothing" results). All current Oatly models are SELECT-based; if a genuinely
		//      non-query model is ever added, exclude it here rather than weakening the check.
		// toEqual prints the offending files. Skipped entirely when the local corpus is absent.
		expect(failures).toEqual([]);
		expect(degenerate).toEqual([]);
	}, 180000);
});
