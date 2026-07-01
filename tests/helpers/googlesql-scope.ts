import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// positives/negatives now live under <category>/ subdirs (post-reorg), so walk recursively and
// return full paths.
export function* sqlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

// Detect-only classification — identical to the parser-corpus gate (tests/corpus/bigquery.parser.test.ts).
// Object DDL (CREATE/ALTER/DROP, incl. …FUNCTION/TABLE/PROCEDURE) and DEFINE MACRO are recognized and
// flagged but not parsed/validated, by cleared scope, so they are out of BOTH gates symmetrically: a
// malformed one we accept is not an over-acceptance bug, and a valid one we don't fully parse is not a
// coverage gap. Keyed on the LEADING KEYWORD only (deliberately not the broad ddl category, which would
// also hide in-scope ANALYZE/TRUNCATE/…). A comment/whitespace-only input is a valid EMPTY SCRIPT under
// our `root` entry but an error under ZetaSQL's single-statement entry — that mode mismatch is also out
// of both gates. Mirrors the parser gate so the two corpora grade identically.
const leadKeyword = (sql: string): string =>
	sql
		.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*/, "")
		.replace(/^@\{[^}]*\}\s*/, "")
		.match(/^[A-Za-z_]+/)?.[0]
		?.toLowerCase() ?? "";
const isMacro = (sql: string): boolean =>
	/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(?:@\{[^}]*\}\s*)?DEFINE\s+MACRO\b/i.test(sql);
const isEmptyScript = (sql: string): boolean =>
	sql
		.replace(/--[^\n]*/g, "")
		.replace(/#[^\n]*/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.trim() === "";
const DETECT_ONLY_LEAD = new Set(["create", "alter", "drop"]); // object DDL — cleared Out
export const isDetectOnly = (sql: string): boolean =>
	isMacro(sql) || isEmptyScript(sql) || DETECT_ONLY_LEAD.has(leadKeyword(sql));
