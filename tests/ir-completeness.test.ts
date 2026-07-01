import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { walkIr } from "./helpers/ir-walk.js";

// IR completeness gate: every expression in every real Oatly model must lower to a TYPED
// Expr node — nothing may fall through to `other`. `other` stays in the IR as a safety net
// for constructs the corpus doesn't exercise (so nothing is ever dropped), but a real model
// hitting it means the IR has a known, named hole to close. This test fails with the exact
// CST type(s) that leaked, so the gap is never silent. Skips when the corpus is absent.
const CORPUS = corpusPath("databricks/oatly");

describe.skipIf(!existsSync(CORPUS))("IR completeness over the Oatly corpus", () => {
	it("lowers every expression to a typed node — nothing falls through to `other`", () => {
		const files = readdirSync(CORPUS, { recursive: true }).filter(
			(f): f is string => typeof f === "string" && f.endsWith(".sql"),
		);
		const tally = new Map<string, number>();
		const samples = new Map<string, string>();
		for (const rel of files) {
			const ir = lower(parseDatabricks(readFileSync(join(CORPUS, rel), "utf8")).tree);
			walkIr(ir, tally, samples);
		}
		const total = [...tally.values()].reduce((s, n) => s + n, 0);
		if (total > 0) {
			const lines = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`);
			throw new Error(`IR left ${total} expression(s) as \`other\` — model these:\n${lines.join("\n")}`);
		}
		expect(total).toBe(0);
	}, 120000);
});
