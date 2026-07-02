import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { beforeAll, describe, expect, it } from "vitest";
import { lower } from "../../src/trino/lower.js";
import { parseTrino } from "../../src/trino/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { walkIr } from "../helpers/ir-walk.js";

// Two Trino conformance corpora, both in the corpus repo and skipped when absent:
//
// 1. trino/bytebase — the Bytebase grammar's example corpus (94 files, extracted from Trino's
//    own TestSqlParser). One file (set_materialized_view_properties.sql) is a bare window-
//    expression FRAGMENT, not a statement — Bytebase's test entry accepts standalone
//    expressions; our statement-batch entry correctly rejects it. Ratchet floor 93.
//
// 2. trino/docs — every SQL example from the trinodb sphinx docs at the pinned release
//    (tools/extract-trino-docs.mjs, Apache-2.0, ~334 files). Organizer-bucketed
//    (parser/positive/<kind>/…); the gate trusts the paths and requires 100% of the query bucket.

const VENDOR_EXAMPLES = corpusPath("trino/bytebase");
const DOCS_CORPUS = corpusPath("trino/docs");

const VENDOR_BASELINE = 93; // 94 files minus the one expression-fragment (see header)
const QUERY_BASELINE = 600; // documented floor (635 at build); the gate itself is 100%-of-query-bucket
// The cross-dialect `other` ratchet: Trino is expression-corpus-complete — 0 `other`
// (measured 2026-07-02 over the parsed docs query bucket).
const OTHER_BASELINE = 0;

// Documented-broken query examples — each verified against its trinodb docs source page as
// deliberately-invalid, fragmentary, or FOREIGN-dialect SQL (connector passthrough examples show
// the remote system's syntax). They fail to parse, so the organizer files them under unparsed/;
// the gate asserts they STAY there.
const KNOWN_BAD: Record<string, string> = {
	"connector_hive/14.sql":
		"hive.md CSV-format illustration: CREATE TABLE with a WITH(properties) clause but no column list and no AS — a config fragment, not a statement.",
	"connector_lakehouse/1.sql":
		"lakehouse.md doc typo — missing comma after type = 'ICEBERG' in the WITH properties list.",
	"connector_oracle/7.sql":
		"oracle.md query-passthrough example embeds an Oracle MODEL query whose inner quotes ('Bounce') are not doubled — the varchar literal terminates early; invalid as written.",
	"connector_pinot/5.sql":
		"pinot.md dynamic-table example is PINOT dialect (trailing TOP 30000) — the raw query passed through to Pinot, not Trino syntax.",
	"connector_sqlserver/8.sql":
		"sqlserver.md CREATE STATISTICS is a SQL SERVER command (documented to run on the remote database).",
	"connector_sqlserver/9.sql":
		"sqlserver.md UPDATE STATISTICS is a SQL SERVER command (documented to run on the remote database).",
	"functions_table/5.sql":
		"table.md shows two alternative TVF invocation forms as consecutive unterminated SELECTs — an either/or illustration, not a batch.",
	"sql_execute-immediate/3.sql":
		"execute-immediate.md shows the PREPARE/EXECUTE/DEALLOCATE sequence as three unterminated statements — an illustration of the flow, not a batch.",
	"sql_explain/6.sql":
		"explain.md (TYPE VALIDATE) example is DELIBERATELY invalid ('SELET') — it demonstrates the validation error output.",
};

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("Trino grammar vs the bytebase example corpus", () => {
	let files: string[];
	beforeAll(() => {
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
				const p = join(dir, e.name);
				if (e.isDirectory()) return walk(p);
				return e.name.endsWith(".sql") ? [relative(VENDOR_EXAMPLES, p).split("\\").join("/")] : [];
			});
		files = walk(VENDOR_EXAMPLES);
	});

	it("parses the upstream examples (ratchet)", { timeout: 300_000 }, () => {
		const fails: string[] = [];
		for (const rel of files) {
			try {
				if (parseTrino(readFileSync(join(VENDOR_EXAMPLES, rel), "utf8")).errors > 0) fails.push(rel);
			} catch (e) {
				fails.push(`${rel} THREW ${String(e).slice(0, 80)}`);
			}
		}
		expect(files.length).toBeGreaterThan(0);
		const pass = files.length - fails.length;
		console.log(`\n  bytebase trino examples: ${pass}/${files.length} parse`);
		if (fails.length) console.log(`  fails:\n    ${fails.join("\n    ")}`);
		expect(pass, `bytebase example pass count dropped below ${VENDOR_BASELINE}`).toBeGreaterThanOrEqual(
			VENDOR_BASELINE,
		);
	});
});

describe.skipIf(!existsSync(DOCS_CORPUS))("Trino grammar vs the trinodb docs corpus", () => {
	it(
		"parses 100% of the query bucket (organizer paths); lower+scope total; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let scoped = 0;
			runDocsRatchet(DOCS_CORPUS, (sql) => parseTrino(sql).errors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseTrino(sql);
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						deriveSymbols(resolveScopes(ir, "trino"));
						scoped++;
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 120)}`);
					}
				},
			});
			const total = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			console.log(
				`\n  trino: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `lower/resolveScopes threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
		},
	);
});
