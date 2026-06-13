import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseTSql } from "./src/tsql/parse.js";
import { lower, statementCategories } from "./src/tsql/lower.js";
import { resolveScopes } from "./src/scope/scope.js";
import { KNOWN_BAD, OUT_OF_SCOPE } from "./tests/tsql-corpus-known-bad.js";

const DIR = resolve("harness/local/tsql-docs");
function* files(d) {
	for (const e of readdirSync(d, { withFileTypes: true })) {
		const p = join(d, e.name);
		if (e.isDirectory()) yield* files(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}
function bucketOf(kinds) {
	for (const k of kinds) {
		if (k === "query") return "query";
		if (k === "dml") return "dml";
		if (k === "ddl" || k === "dcl" || k === "compound") return "ddl";
	}
	return "ddl";
}
const r = { query: { p: 0, t: 0 }, dml: { p: 0, t: 0 }, ddl: { p: 0, t: 0 } };
let total = 0,
	parsedOk = 0,
	knownBadSeen = 0,
	knownBadStillFails = 0,
	knownBadNowParses = 0;
const queryFails = [];
for (const f of files(DIR)) {
	total++;
	const sql = readFileSync(f, "utf8");
	const rel = f
		.slice(DIR.length + 1)
		.split("\\")
		.join("/");
	let errs = 1,
		kinds;
	try {
		const res = parseTSql(sql);
		errs = res.errors;
		kinds = res.errors === 0 ? statementCategories(res.tree) : undefined;
	} catch {
		errs = -1;
	}
	const clean = errs === 0;
	if (clean) parsedOk++;
	const kind = kinds
		? bucketOf(kinds)
		: /^(select|with|values|table|from|explain|\()/i.test(sql.trim())
			? "query"
			: /^(insert|update|delete|merge|copy|load)/i.test(sql.trim())
				? "dml"
				: "ddl";
	if (rel in OUT_OF_SCOPE) {
		r.ddl.t++;
		if (clean) r.ddl.p++;
		continue;
	}
	if (rel in KNOWN_BAD) {
		knownBadSeen++;
		if (clean) knownBadNowParses++;
		else knownBadStillFails++;
		continue;
	}
	r[kind].t++;
	if (clean) r[kind].p++;
	else if (kind === "query") queryFails.push(rel);
}
const pct = (b) => (b.t ? ((100 * b.p) / b.t).toFixed(1) : "-");
console.log(`TOTAL files: ${total}, parsed clean: ${parsedOk} (${((100 * parsedOk) / total).toFixed(1)}%)`);
console.log(`query ${r.query.p}/${r.query.t} (${pct(r.query)}%)  [GATED]`);
console.log(`dml   ${r.dml.p}/${r.dml.t} (${pct(r.dml)}%)  [reported]`);
console.log(`ddl   ${r.ddl.p}/${r.ddl.t} (${pct(r.ddl)}%)  [reported]`);
console.log(
	`KNOWN_BAD listed=${Object.keys(KNOWN_BAD).length} seen=${knownBadSeen} stillFails=${knownBadStillFails} NOW-PARSES(stale)=${knownBadNowParses}`,
);
console.log(`OUT_OF_SCOPE listed=${Object.keys(OUT_OF_SCOPE).length}`);
console.log(`query-bucket failures NOT known-bad: ${queryFails.length}`);
queryFails.slice(0, 30).forEach((x) => console.log("  FAIL " + x));
