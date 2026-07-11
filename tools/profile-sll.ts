// SLL→LL fallback profiler — the SLL-surgery wave's instrument (see .superpowers/sdd/task-1-brief.md,
// Task 1). Promoted from the throwaway probe temp_auto/profile-sll.ts into a committed tool.
//
// Usage:
//   node --import tsx tools/profile-sll.ts <dialect>               census + per-decision profile
//   node --import tsx tools/profile-sll.ts <dialect> --decision N   drill into decision N: conflicting
//                                                                    alternative pairs + sample triggers
//
// Three passes, each cheaper than the last:
//
//   Pass A (census) — parses the full query bucket through the dialect's REAL production parse
//   function (parseDatabricks/parseTSql/…) and reads `.sllFallback` off the result. This is the whole
//   point of surfacing that field on ParseResult: the tool no longer reimplements the two-stage
//   SLL→LL dance to find out which files fell back, it just asks. Reports fallback count/% and total
//   two-stage wall time.
//
//   Pass B (profiled LL) — a sampled subset, parsed once more under a raw ProfilingATNSimulator in LL
//   mode, aggregated per ATN decision: time share, rule name, invocations, ambiguities,
//   context-sensitivities, max SLL lookahead. This is the "top decision by prediction time" table the
//   surgery loop reads first. Written to temp_auto/sll-profile-<dialect>.json (regenerate any time).
//
//   --decision N (drill-down) — re-parses ONLY the files that fell back in Pass A, under
//   PredictionMode.LL_EXACT_AMBIG_DETECTION, and for decision N reports the distinct conflicting
//   alternative-number sets encountered plus up to 3 sample trigger files per set. That output is each
//   surgery iteration's diagnosis input (cf. task-1-brief.md's disease classification).
//
// Data-driven per dialect; a dialect whose generated parser (src/generated/<name>) or corpus
// directory isn't present is skipped, not errored — that's how a dialect not yet built on this branch
// (e.g. trino) stays a silent no-op until it lands, with no special-casing here.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type BitSet,
	type Lexer,
	type Parser,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
	ProfilingATNSimulator,
	type RecognitionException,
	type Token as AntlrToken,
} from "antlr4ng";
import { corpusPath } from "./corpus-paths.mjs";

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TOOLS_DIR, "..");

const PASS_A_CAP = 4000; // census sample cap per dialect
const PASS_B_CAP = 800; // profiled-LL sample cap per dialect
const DRILLDOWN_CAP = 500; // fallback-file sample cap for the --decision rerun

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LexerCtor = new (input: CharStream) => Lexer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParserCtor = new (input: CommonTokenStream) => Parser & { atn: unknown };

interface DialectCfg {
	name: string;
	/** Corpus-relative path to the query bucket (see CLAUDE.md § Corpus location). */
	dir: string;
	/** The grammar's batch/statement entry rule — matches each src/<dialect>/parse.ts. */
	entry: string;
	/** The production parse wrapper — the source of truth for `sllFallback` (Pass A). */
	loadParse: () => Promise<(sql: string) => { errors: number; sllFallback: boolean }>;
	/** Raw generated Lexer/Parser constructors — needed for direct interpreter control
	 *  (Pass B's ProfilingATNSimulator, the --decision LL_EXACT_AMBIG_DETECTION rerun). */
	loadRaw: () => Promise<{ L: LexerCtor; P: ParserCtor }>;
}

const DIALECTS: DialectCfg[] = [
	{
		name: "databricks",
		dir: "databricks/docs/parser/positive/query",
		entry: "multiStatement",
		loadParse: async () => (await import("../src/databricks/parse.js")).parseDatabricks,
		loadRaw: async () => {
			const { DatabricksLexer } = await import("../src/generated/databricks/DatabricksLexer.js");
			const { DatabricksParser } = await import("../src/generated/databricks/DatabricksParser.js");
			return { L: DatabricksLexer as unknown as LexerCtor, P: DatabricksParser as unknown as ParserCtor };
		},
	},
	{
		name: "tsql",
		dir: "tsql/docs/parser/positive/query",
		entry: "tsql_file",
		loadParse: async () => (await import("../src/tsql/parse.js")).parseTSql,
		loadRaw: async () => {
			const { TSqlLexer } = await import("../src/generated/tsql/TSqlLexer.js");
			const { TSqlParser } = await import("../src/generated/tsql/TSqlParser.js");
			return { L: TSqlLexer as unknown as LexerCtor, P: TSqlParser as unknown as ParserCtor };
		},
	},
	{
		name: "snowflake",
		dir: "snowflake/docs/parser/positive/query",
		entry: "snowflake_file",
		loadParse: async () => (await import("../src/snowflake/parse.js")).parseSnowflake,
		loadRaw: async () => {
			const { SnowflakeLexer } = await import("../src/generated/snowflake/SnowflakeLexer.js");
			const { SnowflakeParser } = await import("../src/generated/snowflake/SnowflakeParser.js");
			return { L: SnowflakeLexer as unknown as LexerCtor, P: SnowflakeParser as unknown as ParserCtor };
		},
	},
	{
		name: "bigquery",
		dir: "bigquery/zetasql/analyzer/positive/query",
		entry: "root",
		loadParse: async () => (await import("../src/bigquery/parse.js")).parseBigQuery,
		loadRaw: async () => {
			const { GoogleSQLLexer } = await import("../src/generated/bigquery/GoogleSQLLexer.js");
			const { GoogleSQLParser } = await import("../src/generated/bigquery/GoogleSQLParser.js");
			return { L: GoogleSQLLexer as unknown as LexerCtor, P: GoogleSQLParser as unknown as ParserCtor };
		},
	},
	{
		name: "redshift",
		dir: "redshift/docs/parser/positive/query",
		entry: "root",
		loadParse: async () => (await import("../src/redshift/parse.js")).parseRedshift,
		loadRaw: async () => {
			const { RedshiftLexer } = await import("../src/generated/redshift/RedshiftLexer.js");
			const { RedshiftParser } = await import("../src/generated/redshift/RedshiftParser.js");
			return { L: RedshiftLexer as unknown as LexerCtor, P: RedshiftParser as unknown as ParserCtor };
		},
	},
	{
		name: "postgres",
		dir: "postgres/docs/parser/positive/query",
		entry: "root",
		loadParse: async () => (await import("../src/postgres/parse.js")).parsePostgres,
		loadRaw: async () => {
			const { PostgresLexer } = await import("../src/generated/postgres/PostgresLexer.js");
			const { PostgresParser } = await import("../src/generated/postgres/PostgresParser.js");
			return { L: PostgresLexer as unknown as LexerCtor, P: PostgresParser as unknown as ParserCtor };
		},
	},
	{
		name: "duckdb",
		dir: "duckdb/docs/parser/positive/query",
		entry: "root",
		loadParse: async () => (await import("../src/duckdb/parse.js")).parseDuckdb,
		loadRaw: async () => {
			const { DuckdbLexer } = await import("../src/generated/duckdb/DuckdbLexer.js");
			const { DuckdbParser } = await import("../src/generated/duckdb/DuckdbParser.js");
			return { L: DuckdbLexer as unknown as LexerCtor, P: DuckdbParser as unknown as ParserCtor };
		},
	},
	{
		name: "sqlite",
		dir: "sqlite/docs/parser/positive/query",
		entry: "parse",
		loadParse: async () => (await import("../src/sqlite/parse.js")).parseSqlite,
		loadRaw: async () => {
			const { SqliteLexer } = await import("../src/generated/sqlite/SqliteLexer.js");
			const { SqliteParser } = await import("../src/generated/sqlite/SqliteParser.js");
			return { L: SqliteLexer as unknown as LexerCtor, P: SqliteParser as unknown as ParserCtor };
		},
	},
	{
		name: "mysql",
		dir: "mysql/docs/parser/positive/query",
		entry: "root",
		loadParse: async () => (await import("../src/mysql/parse.js")).parseMysql,
		loadRaw: async () => {
			const { MysqlLexer } = await import("../src/generated/mysql/MysqlLexer.js");
			const { MysqlParser } = await import("../src/generated/mysql/MysqlParser.js");
			return { L: MysqlLexer as unknown as LexerCtor, P: MysqlParser as unknown as ParserCtor };
		},
	},
];

function sample<T>(xs: T[], cap: number): T[] {
	if (xs.length <= cap) return xs;
	const step = xs.length / cap;
	const out: T[] = [];
	for (let i = 0; i < cap; i++) out.push(xs[Math.floor(i * step)]);
	return out;
}

interface Corpus {
	rel: string;
	text: string;
}

function loadCorpus(dirAbs: string, cap: number): Corpus[] {
	const files = (readdirSync(dirAbs, { recursive: true }) as string[]).filter((f) => f.endsWith(".sql")).sort();
	return sample(files, cap).map((rel) => ({ rel, text: readFileSync(join(dirAbs, rel), "utf8") }));
}

function mkRawParser(L: LexerCtor, P: ParserCtor, text: string): { lexer: Lexer; parser: Parser } {
	const lexer = new L(CharStream.fromString(text));
	const parser = new P(new CommonTokenStream(lexer));
	lexer.removeErrorListeners();
	parser.removeErrorListeners();
	return { lexer, parser };
}

interface DecAgg {
	invocations: number;
	time: number;
	fallbacks: number;
	ambiguities: number;
	ctxSensitivities: number;
	maxLook: number;
}

/** Pass A + Pass B: census (via the production parse fn) + profiled-LL decision aggregation. */
async function census(cfg: DialectCfg): Promise<Corpus[]> {
	const dirAbs = corpusPath(cfg.dir);
	const texts = loadCorpus(dirAbs, PASS_A_CAP);
	const bytes = texts.reduce((n, t) => n + t.text.length, 0);

	const parseFn = await cfg.loadParse();
	const fallbackFiles: Corpus[] = [];
	let errored = 0;
	const tA = performance.now();
	for (const c of texts) {
		const r = parseFn(c.text);
		if (r.sllFallback) fallbackFiles.push(c);
		if (r.errors > 0) errored++;
	}
	const passA = performance.now() - tA;

	const { L, P } = await cfg.loadRaw();
	const bTexts = sample(texts, PASS_B_CAP);
	const agg = new Map<number, DecAgg>();
	let ruleNames: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let atn: any;
	const tB = performance.now();
	for (const c of bTexts) {
		const { parser } = mkRawParser(L, P, c.text);
		const prof = new ProfilingATNSimulator(parser);
		parser.interpreter = prof;
		parser.interpreter.predictionMode = PredictionMode.LL;
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(parser as any)[cfg.entry]();
		} catch {
			/* the fallback census (Pass A) already counted this */
		}
		ruleNames = (P as unknown as { ruleNames: string[] }).ruleNames;
		atn = parser.atn;
		for (const d of prof.getDecisionInfo()) {
			if (d.invocations === 0) continue;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const dd = d as any;
			const cur = agg.get(d.decision) ?? {
				invocations: 0,
				time: 0,
				fallbacks: 0,
				ambiguities: 0,
				ctxSensitivities: 0,
				maxLook: 0,
			};
			cur.invocations += d.invocations;
			cur.time += d.timeInPrediction;
			cur.fallbacks += dd.llFallback ?? 0;
			cur.ambiguities += Array.isArray(dd.ambiguities) ? dd.ambiguities.length : (dd.ambiguities ?? 0);
			cur.ctxSensitivities += Array.isArray(dd.contextSensitivities)
				? dd.contextSensitivities.length
				: (dd.contextSensitivities ?? 0);
			cur.maxLook = Math.max(cur.maxLook, dd.sllMaxLook ?? 0);
			agg.set(d.decision, cur);
		}
	}
	const passB = performance.now() - tB;

	const totalTime = [...agg.values()].reduce((n, a) => n + a.time, 0) || 1;
	const rows = [...agg.entries()]
		.map(([dec, a]) => ({
			dec,
			rule: ruleNames[atn.decisionToState[dec].ruleIndex] ?? "?",
			...a,
			timePct: (a.time / totalTime) * 100,
		}))
		.sort((a, b) => b.time - a.time);

	console.log(
		`\n### ${cfg.name} — ${texts.length} files (${(bytes / 1024).toFixed(0)} KB), two-stage census ${passA.toFixed(0)} ms, profiled LL (${bTexts.length} files) ${passB.toFixed(0)} ms`,
	);
	console.log(
		`SLL fallbacks: ${fallbackFiles.length}/${texts.length} (${((fallbackFiles.length / texts.length) * 100).toFixed(1)}%)${errored ? ` | ${errored} files parsed with errors (unexpected in a positive corpus)` : ""}`,
	);
	console.log(
		`top decisions by prediction time (share | rule | invocations | ctx-sensitivities | ambiguities | maxLook):`,
	);
	for (const r of rows.slice(0, 8)) {
		console.log(
			`  ${r.timePct.toFixed(1).padStart(5)}% | dec ${String(r.dec).padStart(4)} | ${r.rule.padEnd(32)} | inv ${String(r.invocations).padStart(7)} | ctx ${String(r.ctxSensitivities).padStart(5)} | amb ${String(r.ambiguities).padStart(5)} | maxLook ${r.maxLook}`,
		);
	}
	writeFileSync(join(REPO_ROOT, "temp_auto", `sll-profile-${cfg.name}.json`), JSON.stringify(rows, null, 1));

	return fallbackFiles;
}

/** --decision N: rerun the Pass A fallback files under LL_EXACT_AMBIG_DETECTION and report, for
 *  decision N, the distinct conflicting alternative-number sets + up to 3 sample trigger files each. */
async function drilldown(cfg: DialectCfg, decisionNo: number, fallbackFiles: Corpus[]): Promise<void> {
	if (fallbackFiles.length === 0) {
		console.log(`\n  no SLL-fallback files to drill into for ${cfg.name} decision ${decisionNo}.`);
		return;
	}
	const { L, P } = await cfg.loadRaw();
	const files = sample(fallbackFiles, DRILLDOWN_CAP);

	interface AltGroup {
		alts: number[];
		count: number;
		samples: string[];
	}
	const groups = new Map<string, AltGroup>();
	let ruleName = "?";
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let atn: any;
	let ruleNames: string[] = [];

	for (const c of files) {
		const { lexer, parser } = mkRawParser(L, P, c.text);
		parser.interpreter.predictionMode = PredictionMode.LL_EXACT_AMBIG_DETECTION;
		lexer.removeErrorListeners();
		parser.removeErrorListeners();
		parser.addErrorListener({
			syntaxError() {
				/* ignore — this rerun only cares about ambiguity reports */
			},
			reportAmbiguity(
				_recognizer: unknown,
				dfa: { decision: number },
				_startIndex: number,
				_stopIndex: number,
				_exact: boolean,
				ambigAlts: BitSet | undefined,
				configs: { getAlts(): BitSet },
			) {
				if (dfa.decision !== decisionNo) return;
				const alts = [...(ambigAlts ?? configs.getAlts())].sort((a, b) => a - b);
				const key = alts.join(",");
				const g = groups.get(key) ?? { alts, count: 0, samples: [] };
				g.count++;
				if (g.samples.length < 3) g.samples.push(c.rel);
				groups.set(key, g);
			},
			reportAttemptingFullContext() {},
			reportContextSensitivity() {},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(parser as any)[cfg.entry]();
		} catch {
			/* a genuine syntax error in this file — irrelevant to the ambiguity census */
		}
		ruleNames = (P as unknown as { ruleNames: string[] }).ruleNames;
		atn = parser.atn;
	}
	if (atn) ruleName = ruleNames[atn.decisionToState[decisionNo]?.ruleIndex] ?? "?";

	console.log(
		`\n### ${cfg.name} decision ${decisionNo} (rule \`${ruleName}\`) — ${files.length}/${fallbackFiles.length} fallback files rerun under LL_EXACT_AMBIG_DETECTION`,
	);
	if (groups.size === 0) {
		console.log(`  no ambiguity reported for this decision on the fallback set — it may be a context-sensitivity`);
		console.log(
			`  (ctx > 0, amb == 0) or a pure lookahead-depth decision; re-check the census row for decision ${decisionNo}.`,
		);
		return;
	}
	for (const g of [...groups.values()].sort((a, b) => b.count - a.count)) {
		console.log(`  alts [${g.alts.join(", ")}]  x${g.count}`);
		for (const s of g.samples) console.log(`    e.g. ${s}`);
	}
}

/** --bails: the production bail-site census. Re-runs the two-stage front (SLL + BailErrorStrategy)
 *  per corpus file exactly as `parse.ts` does, and on each bail reads the wrapped
 *  RecognitionException's `ctx` (the grammar rule the parser was in at the mispredict) and
 *  `offendingToken` (what tripped it), aggregating `rule @ TOKEN` → count + sample files. This is the
 *  view that actually predicts which files fall back — SLL mispredicts, then a spurious syntax error
 *  surfaces downstream; the profiler's LL-mode ambiguity table (Pass B) says where *time* goes, which
 *  need not be where the *bails* happen (see .superpowers/sdd/task-2-report.md "Method note"). */
async function bailCensus(cfg: DialectCfg): Promise<void> {
	const dirAbs = corpusPath(cfg.dir);
	const texts = loadCorpus(dirAbs, PASS_A_CAP);
	const { L, P } = await cfg.loadRaw();
	const ruleNames = (P as unknown as { ruleNames: string[] }).ruleNames;

	interface BailSite {
		key: string;
		count: number;
		samples: string[];
		tokenTexts: Set<string>;
	}
	const sites = new Map<string, BailSite>();
	let bails = 0;
	let vocab: { getSymbolicName(t: number): string | null; getDisplayName(t: number): string | null } | undefined;

	const tBail = performance.now();
	for (const c of texts) {
		const lexer = new L(CharStream.fromString(c.text));
		const tokens = new CommonTokenStream(lexer);
		const parser = new P(tokens);
		lexer.removeErrorListeners();
		parser.removeErrorListeners();
		parser.errorHandler = new BailErrorStrategy();
		(parser.interpreter as ParserATNSimulator).predictionMode = PredictionMode.SLL;
		vocab ??= (parser as unknown as { vocabulary: typeof vocab }).vocabulary;
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(parser as any)[cfg.entry]();
		} catch (e) {
			bails++;
			// BailErrorStrategy throws ParseCancellationException{ cause: RecognitionException }.
			const cause = (e as { cause?: RecognitionException }).cause;
			const ctx = cause?.ctx as (ParserRuleContext & { ruleIndex: number }) | null | undefined;
			const tok = cause?.offendingToken as AntlrToken | null | undefined;
			const rule = ctx && ctx.ruleIndex >= 0 ? (ruleNames[ctx.ruleIndex] ?? `#${ctx.ruleIndex}`) : "?";
			const ttype = tok?.type ?? -1;
			const tname =
				ttype < 0 ? "?" : (vocab?.getSymbolicName(ttype) ?? vocab?.getDisplayName(ttype) ?? `T${ttype}`);
			const key = `${rule} @ ${tname}`;
			const s = sites.get(key) ?? { key, count: 0, samples: [], tokenTexts: new Set() };
			s.count++;
			if (s.samples.length < 3) s.samples.push(c.rel);
			if (tok?.text) s.tokenTexts.add(tok.text.length > 24 ? tok.text.slice(0, 24) + "…" : tok.text);
			sites.set(key, s);
		}
	}
	const wall = performance.now() - tBail;

	console.log(`\n### ${cfg.name} — bail-site census over ${texts.length} files (SLL+Bail), ${wall.toFixed(0)} ms`);
	console.log(`SLL bails: ${bails}/${texts.length} (${((bails / texts.length) * 100).toFixed(1)}%)`);
	console.log(`bail sites (count | rule @ offending-token | sample texts | e.g. file):`);
	for (const s of [...sites.values()].sort((a, b) => b.count - a.count)) {
		const texts3 = [...s.tokenTexts].slice(0, 4).join(" ");
		console.log(`  ${String(s.count).padStart(4)} | ${s.key.padEnd(44)} | ${texts3.padEnd(28)} | ${s.samples[0]}`);
	}
}

async function main(): Promise<void> {
	const dialectArg = process.argv[2];
	const bailsMode = process.argv.includes("--bails");
	const decisionFlagIdx = process.argv.indexOf("--decision");
	const decisionNo = decisionFlagIdx >= 0 ? Number(process.argv[decisionFlagIdx + 1]) : undefined;

	if (!dialectArg) {
		console.error("usage: node --import tsx tools/profile-sll.ts <dialect> [--decision N]");
		process.exitCode = 1;
		return;
	}

	const cfgs = dialectArg === "all" ? DIALECTS : DIALECTS.filter((d) => d.name === dialectArg);
	if (cfgs.length === 0) {
		console.error(`unknown dialect "${dialectArg}" — known: ${DIALECTS.map((d) => d.name).join(", ")}`);
		process.exitCode = 1;
		return;
	}

	for (const cfg of cfgs) {
		const generatedDir = join(REPO_ROOT, "src", "generated", cfg.name);
		if (!existsSync(generatedDir)) {
			console.log(`\n### ${cfg.name}: no generated parser at src/generated/${cfg.name} — skipped`);
			continue;
		}
		let corpusDir: string;
		try {
			corpusDir = corpusPath(cfg.dir);
		} catch {
			console.log(`\n### ${cfg.name}: SQL_CORPUS_DIR is not set — skipped`);
			continue;
		}
		if (!existsSync(corpusDir)) {
			console.log(`\n### ${cfg.name}: corpus missing at ${cfg.dir} — skipped`);
			continue;
		}

		if (bailsMode) {
			await bailCensus(cfg);
			continue;
		}
		const fallbackFiles = await census(cfg);
		if (decisionNo !== undefined) await drilldown(cfg, decisionNo, fallbackFiles);
	}
	console.log("\ndone — per-dialect JSON in temp_auto/sll-profile-<dialect>.json");
}

await main();
