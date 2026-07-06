// No source file may contain raw control bytes: they are invisible in editors and make
// grep/ripgrep classify the file as BINARY and silently skip it — which is exactly how the
// 0x00/0x01 sentinels in template-provider.ts's callKey() hid from every search (2026-07-06).
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (name === "generated") continue; // build output, not ours to police
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(ts|mjs|g4|md|json)$/.test(name)) out.push(p);
	}
	return out;
}

describe("source hygiene", () => {
	test("no file under src/, grammars/, or docs/ contains raw control bytes", () => {
		// docs/ included deliberately: the plan file for THIS task briefly went binary by quoting
		// the offending code — pasted invisible bytes travel anywhere text does.
		const offenders: string[] = [];
		for (const f of [...walk("src"), ...walk("grammars"), ...walk("docs")]) {
			const buf = readFileSync(f);
			let found = false;
			for (const b of buf) {
				// allowed: \t (9), \n (10), \r (13)
				if (b < 9 || b === 11 || b === 12 || (b > 13 && b < 32) || b === 0) {
					offenders.push(f);
					found = true;
					break;
				}
			}
			// Zero-width characters are the same disease in multi-byte form (a U+200B was used
			// to dodge a JSDoc `*/` terminator on 2026-07-06 — invisible in every editor):
			if (!found && /[\u200B\u200C\u200D\uFEFF]/.test(buf.toString("utf8"))) {
				offenders.push(f);
			}
		}
		expect(offenders).toEqual([]);
	});
});
