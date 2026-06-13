import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseDatabricks } from "./src/databricks/parse.js";
import { KNOWN_BAD, DEFERRED_GRAMMAR } from "./tests/databricks-corpus-known-bad.js";
import { classifySql } from "./tests/helpers/sql-kind.js";

const DIR = resolve("harness/local/databricks-docs");
function* files(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.name.endsWith(".sql")) yield* [p];
  }
}
const excluded = { ...KNOWN_BAD, ...DEFERRED_GRAMMAR };
const r = { query: { p: 0, t: 0 }, dml: { p: 0, t: 0 }, ddl: { p: 0, t: 0 } };
let total = 0, exSeen = 0, exStillFails = 0, exNowParses = 0;
const queryFails = [];
for (const f of files(DIR)) {
  total++;
  const sql = readFileSync(f, "utf8");
  const rel = f.slice(DIR.length + 1).split("\\").join("/");
  const kind = classifySql(sql);
  let errs = 1;
  try { errs = parseDatabricks(sql).errors; } catch { errs = -1; }
  const clean = errs === 0;
  if (rel in excluded) { exSeen++; if (clean) exNowParses++; else exStillFails++; continue; }
  r[kind].t++; if (clean) r[kind].p++; else if (kind === "query") queryFails.push(rel);
}
const pct = (b) => b.t ? (100 * b.p / b.t).toFixed(1) : "-";
console.log(`TOTAL docs files: ${total}`);
console.log(`query ${r.query.p}/${r.query.t} (${pct(r.query)}%)  [GATED 100%]`);
console.log(`dml   ${r.dml.p}/${r.dml.t} (${pct(r.dml)}%)  [reported]`);
console.log(`ddl   ${r.ddl.p}/${r.ddl.t} (${pct(r.ddl)}%)  [reported]`);
console.log(`EXCLUDED(known-bad+deferred) listed=${Object.keys(excluded).length} seen=${exSeen} stillFails=${exStillFails} NOW-PARSES(stale)=${exNowParses}`);
console.log(`  KNOWN_BAD=${Object.keys(KNOWN_BAD).length} DEFERRED_GRAMMAR=${Object.keys(DEFERRED_GRAMMAR).length}`);
console.log(`query-bucket failures NOT excluded: ${queryFails.length}`);
queryFails.slice(0, 30).forEach((x) => console.log("  FAIL " + x));
