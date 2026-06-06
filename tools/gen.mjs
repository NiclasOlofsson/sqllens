// Generation driver: antlr-ng (pure TS, no Java) -> TypeScript.
// Verified path (2026-06-06): antlr-ng defaults to a Java target, so
// `-D language=TypeScript` is required. No jar / JRE needed.
// Usage: node tools/gen.mjs <dialect>   (e.g. databricks, tsql)
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

const dialect = process.argv[2];
if (!dialect) {
  console.error("usage: node tools/gen.mjs <dialect>");
  process.exit(1);
}

const srcDir = `grammars/${dialect}`;
const out = `src/generated/${dialect}`;
const grammars = readdirSync(srcDir)
  .filter((f) => f.endsWith(".g4"))
  .sort() // lexer before parser (alphabetical), so tokenVocab resolves
  .map((f) => `${srcDir}/${f}`);

if (grammars.length === 0) {
  console.error(`no .g4 files in ${srcDir}`);
  process.exit(1);
}

execSync(`npx antlr-ng -D language=TypeScript -o ${out} ${grammars.join(" ")}`, {
  stdio: "inherit",
});
console.log(`generated ${dialect} -> ${out}`);
