import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(__dirname, "..", "src");

function importsOf(file: string): string[] {
	const text = readFileSync(file, "utf8");
	return [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

describe("layering", () => {
	it("src/ir imports nothing above itself", () => {
		for (const f of readdirSync(join(SRC, "ir"))) {
			if (!f.endsWith(".ts")) continue;
			for (const imp of importsOf(join(SRC, "ir", f))) {
				expect(imp, `${f} imports ${imp}`).not.toMatch(
					/\.\.\/(qualify|scope|infer|lineage|symbols|document|completion|signature|minijinja|references|api|index)/,
				);
			}
		}
	});
});
