// Grammar-driven lower()-coverage engine. Walks a dialect parser's ATN from a query entry rule to
// generate statements mechanically (recursive holes filled from a generic pool), lowers each, and
// reports: how many of the query-reachable construct rules the generation covered, which it never
// reached, and how many parsed bodies lower() flagged (body.unsupported / {kind:"other"}).
//
// It is the basis of the per-dialect `*.completeness.test.ts` gates. The generator is a FROZEN random
// walk: with a fixed parser/seed/N the result is deterministic, so the per-dialect gates can pin the
// numbers as a change-detector. NOTE: a flagged count is NOT itself a gap list — flags can come from
// malformed combinations the grammar accepts; confirm a real gap by reducing to a clean repro.

import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	PredictionMode,
} from "antlr4ng";

interface ParserStatics {
	_ATN: any;
	literalNames: (string | null)[];
	symbolicNames: (string | null)[];
	ruleNames: string[];
	[k: string]: any;
}

export interface CoverageConfig {
	/** Generated parser class (statics _ATN/ruleNames/RULE_*; constructable with a token stream). */
	Parser: ParserStatics & (new (tokens: CommonTokenStream) => any);
	/** Generated lexer class. */
	Lexer: new (input: CharStream) => Lexer;
	/** Parser ENTRY method used to parse a generated statement, e.g. "compoundOrSingleStatement". */
	parseEntry: string;
	lower: (tree: any) => { body: any };
	/** Query entry rule constant name used to GENERATE, e.g. "RULE_query". */
	entryRule: string;
	/** Recursive holes -> generic fragments. Their subgraph is excluded from the coverage denominator. */
	pool: Record<string, string[]>;
	/** Rules whose NAME matches are treated as leaves (not generated, dropped from the denominator) —
	 *  used to keep DDL/DML/graph rules reachable from the query entry out of the query-construct count. */
	excludeRule?: RegExp;
	/** Number of statements to generate (part of the frozen config). */
	n?: number;
}

export interface CoverageResult {
	denom: number;
	covered: number;
	neverReached: string[];
	parsed: number;
	n: number;
	/** Generated bodies lower() flagged (body.unsupported / {kind:"other"}). NOTE: includes garbage-
	 *  combination artifacts — NOT a confirmed gap list. Use clean repros to confirm a real gap. */
	flagged: number;
	flaggedSamples: string[];
	/** Times lower() THREW on a parsed statement. Should be 0 — lower is contractually total. */
	throws: number;
}

/** Default exclusion: DDL / DML / graph(GQL) / column-schema rules that the query entry can reach
 *  (e.g. via pipe `|> CREATE/INSERT` and the GQL subgraph) but that aren't query constructs. */
export const DEFAULT_EXCLUDE =
	/^(insert|delete|update|merge|create|alter|drop|truncate|grant|revoke)_|^gql_|^graph_|_column_schema|_column_info|column_attribute|foreign_key|_constraint|^opt_(maxvalue|minvalue|cycle|increment|start_with)|sequence_arg/i;

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function setMembers(label: any): number[] {
	const out: number[] = [];
	for (const iv of label?.intervals ?? []) for (let i = iv.start; i <= iv.stop; i++) out.push(i);
	return out.length ? out : [1];
}
function hasOther(node: any, seen = new Set<any>()): boolean {
	if (!node || typeof node !== "object" || seen.has(node)) return false;
	seen.add(node);
	if (node.kind === "other") return true;
	for (const [k, v] of Object.entries(node)) {
		if (k === "cst" || k === "aliasCst") continue;
		if (Array.isArray(v)) {
			for (const e of v) if (hasOther(e, seen)) return true;
		} else if (hasOther(v, seen)) return true;
	}
	return false;
}

// Bounds the generated token length. Kept SHORT on purpose: long random strings (a) parse
// pathologically slowly through a two-stage SLL->LL parser and (b) are almost never valid. Short
// strings keep the gates fast enough for `npm test` and lift the parse rate.
const MAX_STEPS = 300;

export function grammarCoverage(cfg: CoverageConfig): CoverageResult {
	const { Parser, pool } = cfg;
	const LIT = Parser.literalNames;
	const SYM = Parser.symbolicNames;
	const RULE_NAMES = Parser.ruleNames;
	const atn = Parser._ATN;
	const entry: number = Parser[cfg.entryRule];
	const N = cfg.n ?? 1500;
	const excludeRe = cfg.excludeRule ?? DEFAULT_EXCLUDE;
	const excluded = new Set<number>(RULE_NAMES.map((_, i) => i).filter((i) => excludeRe.test(RULE_NAMES[i] ?? "")));

	const realize = (tt: number): string => {
		const lit = LIT[tt];
		if (lit) return lit.slice(1, -1);
		const sym = SYM[tt] ?? "";
		if (/ID|IDENT|NAME/i.test(sym)) return "x";
		if (/INT|NUM|DECIMAL|FLOAT|BIG|REAL/i.test(sym)) return "1";
		if (/STRING|CHAR|CONST/i.test(sym)) return "'s'";
		return sym.toLowerCase() || "?";
	};

	// Static: rules referenced inside a rule's own state subgraph.
	function refsOf(ri: number): number[] {
		const start = atn.ruleToStartState[ri];
		if (!start) return [];
		const seen = new Set<any>();
		const stack: any[] = [start];
		const refs: number[] = [];
		while (stack.length) {
			const s: any = stack.pop();
			if (!s || seen.has(s)) continue;
			seen.add(s);
			if (s.constructor.name === "RuleStopState") continue;
			for (const t of s.transitions as any[]) {
				if (t.constructor.name === "RuleTransition") {
					refs.push(t.ruleIndex);
					stack.push(t.followState);
				} else stack.push(t.target);
			}
		}
		return refs;
	}
	// Reachable rules from `from`, treating `stopAt` rules as leaves (avoids the expr<->query mutual
	// recursion swallowing the whole grammar).
	function reachable(from: number, stopAt: Set<number> = new Set()): Set<number> {
		const seen = new Set<number>();
		const stack = [from];
		while (stack.length) {
			const ri = stack.pop()!;
			if (seen.has(ri)) continue;
			seen.add(ri);
			if (ri !== from && stopAt.has(ri)) continue;
			for (const r of refsOf(ri)) stack.push(r);
		}
		return seen;
	}

	function generate(seed: number, touched: Set<number>): string {
		const rng = mulberry32(seed);
		const pick = (n: number) => Math.floor(rng() * n);
		const out: string[] = [];
		let steps = 0;
		function walk(state: any, depth: number): void {
			while (state && state.constructor.name !== "RuleStopState") {
				if (++steps > MAX_STEPS) return;
				const trs: any[] = state.transitions;
				if (!trs.length) return;
				let t = trs.length === 1 ? trs[0] : trs[pick(trs.length)];
				if ((depth >= 8 || steps > MAX_STEPS * 0.7) && trs.length > 1) {
					t = trs.find((x) => x.constructor.name === "EpsilonTransition") ?? t;
				}
				const kind = t.constructor.name;
				if (kind === "RuleTransition") {
					if (excluded.has(t.ruleIndex)) {
						state = t.followState; // DDL/graph rule — don't generate it
						continue;
					}
					touched.add(t.ruleIndex);
					const p = pool[RULE_NAMES[t.ruleIndex]];
					if (p) out.push(p[pick(p.length)]);
					else if (depth < 12) walk(t.target, depth + 1);
					state = t.followState;
				} else if (kind === "AtomTransition") {
					out.push(realize(t.labelValue));
					state = t.target;
				} else if (kind === "SetTransition" || kind === "NotSetTransition") {
					const m = setMembers(t.label);
					out.push(realize(m[pick(m.length)]));
					state = t.target;
				} else state = t.target;
			}
		}
		walk(atn.ruleToStartState[entry], 0);
		return out.join(" ");
	}

	const pooledRoots = new Set(
		Object.keys(pool)
			.map((nm) => RULE_NAMES.indexOf(nm))
			.filter((i) => i >= 0),
	);
	const stopAt = new Set([...pooledRoots, ...excluded]);
	const denomSet = new Set([...reachable(entry, stopAt)].filter((r) => !pooledRoots.has(r) && !excluded.has(r)));

	// SLL-only parse: garbage fails FAST (BailErrorStrategy throws on the first SLL error) instead of
	// paying the slow full-LL pass the production parse falls back to. Lets the gate stay fast even on
	// the mostly-invalid generated input. Over-acceptance vs LL is irrelevant for coverage.
	function sllParse(sql: string): any | null {
		const lexer = new cfg.Lexer(CharStream.fromString(sql));
		const parser: any = new cfg.Parser(new CommonTokenStream(lexer));
		lexer.removeErrorListeners();
		parser.removeErrorListeners();
		parser.errorHandler = new BailErrorStrategy();
		(parser.interpreter as ParserATNSimulator).predictionMode = PredictionMode.SLL;
		try {
			return parser[cfg.parseEntry]();
		} catch {
			return null;
		}
	}

	const touched = new Set<number>();
	let parsed = 0;
	let flagged = 0;
	let throwsCount = 0;
	const flaggedSamples: string[] = [];
	for (let s = 0; s < N; s++) {
		const sql = generate(s + 1, touched);
		const tree = sllParse(sql);
		if (!tree) continue;
		parsed++;
		try {
			const ir = cfg.lower(tree);
			const body = ir.body as { unsupported?: string[] };
			if (body?.unsupported?.length || hasOther(body)) {
				flagged++;
				if (flaggedSamples.length < 10) flaggedSamples.push(sql.slice(0, 100));
			}
		} catch {
			throwsCount++; // lower is contractually total — any throw is a real bug
		}
	}

	const covered = [...denomSet].filter((r) => touched.has(r)).length;
	const neverReached = [...denomSet].filter((r) => !touched.has(r)).map((r) => RULE_NAMES[r]);
	return { denom: denomSet.size, covered, neverReached, parsed, n: N, flagged, flaggedSamples, throws: throwsCount };
}
