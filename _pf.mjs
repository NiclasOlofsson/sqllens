import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseBigQuery } from "./src/bigquery/parse.ts";
const dir = join(resolve("harness/local/bigquery-zetasql-parser"), "positive");
const files = readdirSync(dir).filter(f=>f.endsWith(".sql"));
const fails=[];
for (const f of files){ const sql=readFileSync(join(dir,f),"utf8"); let e=1; try{e=parseBigQuery(sql).errors;}catch{e=-1;} if(e!==0) fails.push({f,sql}); }
const b={}; for(const{f}of fails){const k=f.replace(/_\d+\.sql$/,"");b[k]=(b[k]||0)+1;}
let out=""; for(const[k,v]of Object.entries(b).sort((a,b)=>b[1]-a[1])) out+=`${String(v).padStart(3)}  ${k}\n`;
writeFileSync("_pf.txt", fails.map(x=>`=== ${x.f}\n${x.sql.trim()}`).join("\n\n"));
console.log(out+"\nTOTAL "+fails.length);
