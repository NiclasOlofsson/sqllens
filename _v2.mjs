import { parseBigQuery } from "./src/bigquery/parse.ts";
const pos = ["select x.123","select x.1.2.3","select foo.123bar from foo","select x.1e+5","select a.b.c.123","select x.2daysago","SELECT a.0x123","select FOO().123","select x.1 .2 . 3","select null from x.y. 2. z","select null from x.y. 2.0. z","select a. 1. 2. 3. b . 4. 5. c. 6. 7. 8. 9. d","select x from a.b.456.   2daysago","select x. 1e","select x. 1e+5"];
const flt = ["select .1 + .2","select 1.5","SELECT 0.5","select 1.0 + 2","select count(*) from t group by 1","select 1.5e3"];
let bad=0;
for (const s of pos){const r=parseBigQuery(s); if(r.errors)bad++; console.log((r.errors===0?"OK ":"ERR")+" "+s);}
console.log("--- floats must still parse ---");
for (const s of flt){const r=parseBigQuery(s); if(r.errors)bad++; console.log((r.errors===0?"OK ":"ERR")+" "+s);}
console.log("BAD="+bad);
