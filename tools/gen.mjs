// Generation driver: antlr-ng (pure TS, no Java) -> TypeScript.
// Verified path (2026-06-06): antlr-ng defaults to a Java target, so
// `-D language=TypeScript` is required. No jar / JRE needed.
// `--generate-listener false`: antlr-ng defaults it to true, but lower() walks the CST directly
// through the typed Context accessors (no ParseTreeListener / ParseTreeWalker), so the generated
// listener is dead code. Turning it off drops it from every dialect. The visitor is already off
// (antlr-ng defaults --generate-visitor to false), for the same reason.
// Usage: node tools/gen.mjs <dialect>   (e.g. databricks, tsql)
import { execSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";

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

// antlr-ng writes new outputs but never deletes ones it no longer emits, so a stale file (e.g. a
// listener from a run before --generate-listener=false) would linger. Clean the dialect's output dir
// first so the generated set is always exactly what this run produces.
rmSync(out, { recursive: true, force: true });

execSync(`npx antlr-ng -D language=TypeScript --generate-listener=false -o ${out} ${grammars.join(" ")}`, {
	stdio: "inherit",
});
console.log(`generated ${dialect} -> ${out}`);
