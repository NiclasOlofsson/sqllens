// Extract SQL examples from the Trino docs (trinodb/trino docs/src/main/sphinx, Apache-2.0)
// into the corpus repo. Trino's MyST-markdown docs put SQL in ```sql fences AND bare ```
// fences (results ride inside as `-- comment` lines or live in separate ```text blocks, which
// are skipped). Blocks are kept only when they start like a Trino statement; synopsis blocks
// (with [ ] option brackets or <placeholders>) are dropped.
//
// Self-contained by design (repo convention). Usage:
//   node tools/extract-trino-docs.mjs <trino-clone>/docs/src/main/sphinx
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const SRC = process.argv[2] ?? "temp_auto/trino-official/docs/src/main/sphinx";
const OUT = corpusPath("trino/docs");

// First words that can begin a Trino statement — the statement list in the Trino SQL reference
// (trino.io/docs/current/sql.html).
const STATEMENT_STARTERS =
	/^(alter|analyze|call|comment|commit|create|deallocate|delete|deny|desc|describe|drop|execute|explain|grant|insert|merge|prepare|refresh|reset|revoke|rollback|select|set|show|start|table|truncate|update|use|values|with)\b/i;

function* mdFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* mdFiles(p);
		else if (e.name.endsWith(".md")) yield p;
	}
}

export function cleanSql(sql) {
	// Cut at a rendered result-table (box-drawing or dashed border, or a `col |`-header row)
	// if one leaked into the fence.
	const lines = sql.split("\n");
	let cut = lines.findIndex((l) => /^[\s]*[┌│├└─┬┴┼┐┤┘]/.test(l) || (/^[\s\-+|]+$/.test(l) && /-{3,}/.test(l)));
	// A statement terminator whose next non-blank line is neither a statement, a comment, nor a
	// statement CONTINUATION (END of a routine body, set-op branch, …) is rendered output
	// (result rows) — cut there. Runs even when a border cut was found (take the earlier cut:
	// the `col |` header row sits above the border).
	const CONTINUATIONS = /^(end|when|then|else|elseif|union|intersect|except)\b/i;
	for (let i = 0; i < (cut === -1 ? lines.length : cut); i++) {
		if (!/;\s*$/.test(lines[i])) continue;
		const next = lines.slice(i + 1).find((x) => x.trim() !== "");
		if (
			next !== undefined &&
			!STATEMENT_STARTERS.test(next.trim()) &&
			!CONTINUATIONS.test(next.trim()) &&
			!/^\s*(--|\/\*)/.test(next)
		) {
			cut = i + 1;
			break;
		}
	}
	const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder
	if (/<[a-z_][a-z0-9_]*( [^>]*)?>/i.test(kept)) return null; // <placeholder> template
	// Synopsis option brackets: `[ WITH ... ]`, `[, ...]` — never valid SQL.
	if (/\[\s*(,|WITH|OR|IF|NOT|GRANTED|FROM|AS|LIKE|IN|CASCADE|RESTRICT)\b/i.test(kept)) return null;
	// Synopsis alternation `( user | USER user | ROLE role )` — Trino has no bare `|` operator
	// (bitwise ops are functions; `||` is concat), so a spaced single pipe is metasyntax.
	if (/[^|]\s\|\s[^|]/.test(kept)) return null;
	// A bare `WITH ( prop = … )` property-clause fragment (no CTE list, no statement around it).
	if (/^WITH\s*\(/i.test(kept)) return null;
	if ((kept.match(/'/g) ?? []).length % 2 === 1) return null; // truncated illustration
	if (!/^\(+\s*(select|with|values|table)\b/i.test(kept) && !STATEMENT_STARTERS.test(kept)) return null;
	return kept;
}

/** Docs blocks often stack several UNTERMINATED statements separated by blank lines (each with a
 *  `--> result` comment). Split into per-statement chunks ONLY when every chunk independently
 *  starts like a statement — otherwise the block is one statement with blank lines, kept whole. */
export function splitStatements(block) {
	const chunks = block
		.split(/\n\s*\n/)
		.map((c) => c.trim())
		.filter((c) => c !== "");
	if (chunks.length < 2) return [block];
	const bare = (c) =>
		c
			.split("\n")
			.filter((l) => !/^\s*(-->|--)/.test(l))
			.join("\n")
			.trim();
	const parts = chunks.map(bare).filter((c) => c !== "");
	if (
		parts.length >= 2 &&
		parts.every((c) => STATEMENT_STARTERS.test(c) || /^\(+\s*(select|with|values|table)\b/i.test(c))
	)
		return parts;
	return [block];
}

export function extractSql(md) {
	// Line-based fence walk — a regex over paired ``` mispairs a ```text closer with the next
	// opener and captures the PROSE between blocks (the bug this replaced). Trino's docs put SQL
	// in ```sql fences AND bare ``` fences; ```text/none/properties/… are output/config, skipped.
	const blocks = [];
	let lang = null; // null = outside a fence; "" = bare fence; "sql"/"text"/… = tagged fence
	let fenceLen = 0; // CommonMark: a fence opened with N backticks closes only on >= N backticks
	let buf = [];
	for (const line of md.split(/\r?\n/)) {
		const m = line.match(/^\s*(`{3,})([^`]*)$/);
		if (m) {
			const ticks = m[1].length;
			const info = m[2].trim().toLowerCase();
			if (lang === null) {
				lang = info;
				fenceLen = ticks;
				buf = [];
				continue;
			}
			if (ticks >= fenceLen && info === "") {
				if (lang === "sql" || lang === "") {
					for (const part of splitStatements(buf.join("\n"))) {
						const sql = cleanSql(part);
						if (sql) blocks.push(sql);
					}
				}
				lang = null;
				continue;
			}
			// A shorter/tagged ``` inside a longer fence is content (nested example), not a closer.
		}
		if (lang !== null) buf.push(line);
	}
	return blocks;
}

async function main() {
	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });
	let files = 0;
	let pages = 0;
	const manifest = {};
	for (const f of mdFiles(SRC)) {
		const rel = relative(SRC, f).split("\\").join("/");
		// The Hive migration appendix documents HIVE syntax alongside the Trino equivalents —
		// its foreign-dialect blocks cannot be attributed per-block, so the page is excluded
		// (its Trino examples all appear in the main reference pages too). Release notes are
		// historical and carry foreign SQL (e.g. MySQL DDL for the verifier tool) — excluded.
		if (rel === "appendix/from-hive.md" || rel.startsWith("release/")) continue;
		const slug = rel.replace(/\.md$/, "").replace(/[^a-z0-9_-]/gi, "_");
		const blocks = extractSql(readFileSync(f, "utf8"));
		manifest[rel] = { blocks: blocks.length };
		if (blocks.length) {
			const dir = join(OUT, slug);
			mkdirSync(dir, { recursive: true });
			blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
			files += blocks.length;
			pages++;
		}
	}
	writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
	console.log(`done: ${pages} pages with SQL, ${files} sql files written`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
