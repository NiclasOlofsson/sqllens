// The cross-dialect `other` ratchet (D1, 2026-07-01 review): Databricks pins 0 `other`
// expressions over its corpus (tests/ir-completeness.test.ts); nothing measured the other
// four — an unmodelled expression there was silent. This suite runs every in-scope parsed
// example through lower → resolveScopes → deriveSymbols, counts `other` expression nodes,
// and ratchets the count (it may only fall; drive to 0 like Databricks). The failure output
// names the leaking CST node types — that list IS the lower() worklist per dialect.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import type { ParserRuleContext } from "antlr4ng";
import type { QueryExpr } from "../src/ir/ir.js";
import { walkIr } from "./helpers/ir-walk.js";
import { isDetectOnly, sqlFiles } from "./helpers/googlesql-scope.js";
import { classifySql } from "./helpers/sql-kind.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { parseTSql } from "../src/tsql/parse.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";

interface Gate {
	dialect: "tsql" | "snowflake" | "bigquery" | "redshift";
	corpus: string;
	/** In-scope examples: docs query bucket (regex, like the parse gates) or ZetaSQL positives. */
	inScope(sql: string): boolean;
	parse(sql: string): { tree: ParserRuleContext; errors: number };
	lower(tree: ParserRuleContext): QueryExpr;
	/** Measured 2026-07-01 — a ratchet: the count may only fall. 0 = corpus-complete. */
	otherBaseline: number;
}

const GATES: Gate[] = [
	{
		dialect: "tsql",
		corpus: corpusPath("tsql/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseTSql,
		lower: lowerTSql,
		otherBaseline: 26, // measured 2026-07-01 over 923 parsed examples; may only fall
	},
	{
		dialect: "snowflake",
		corpus: corpusPath("snowflake/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseSnowflake,
		lower: lowerSnowflake,
		otherBaseline: 10, // measured 2026-07-01 over 2958 parsed examples; may only fall
	},
	{
		dialect: "bigquery",
		corpus: join(corpusPath("bigquery/zetasql/analyzer"), "positive"),
		inScope: (sql) => !isDetectOnly(sql),
		parse: parseBigQuery,
		lower: lowerBigQuery,
		otherBaseline: 234, // measured 2026-07-01 over 14695 parsed examples; may only fall
	},
	{
		dialect: "redshift",
		corpus: corpusPath("redshift/docs"),
		inScope: (sql) => classifySql(sql) === "query",
		parse: parseRedshift,
		lower: lowerRedshift,
		otherBaseline: 0, // measured 2026-07-01 over 1796 parsed examples; corpus-complete
	},
];

describe.each(GATES)("`other` ratchet over the $dialect corpus", (g) => {
	it.skipIf(!existsSync(g.corpus))(
		"lower models the corpus; other-count only falls; the pipeline is total",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let parsed = 0;
			let flagged = 0;
			for (const f of sqlFiles(g.corpus)) {
				const sql = readFileSync(f, "utf8");
				if (!g.inScope(sql)) continue;
				let res;
				try {
					res = g.parse(sql);
				} catch {
					continue; // parse-stage failures are the parse gates' business, not this one's
				}
				if (res.errors !== 0) continue;
				parsed++;
				try {
					const ir = g.lower(res.tree);
					if (ir.body.kind === "select" && (ir.body.unsupported?.length ?? 0) > 0) flagged++;
					walkIr(ir, tally, samples);
					deriveSymbols(resolveScopes(ir, g.dialect));
				} catch (e) {
					throwers.push(`${f}: ${String(e).slice(0, 140)}`);
				}
			}
			const total = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			// eslint-disable-next-line no-console
			console.log(
				`\n  ${g.dialect}: ${parsed} parsed, ${flagged} flagged bodies (reported), ` +
					`${total} \`other\` exprs (baseline ${g.otherBaseline})${top ? "\n" + top : ""}`,
			);
			expect(parsed).toBeGreaterThan(0);
			expect(throwers, `pipeline threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${g.otherBaseline} baseline:\n${top}`).toBeLessThanOrEqual(
				g.otherBaseline,
			);
		},
	);
});
