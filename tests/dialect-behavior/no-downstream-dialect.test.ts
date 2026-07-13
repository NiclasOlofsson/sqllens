import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The invariant: nothing downstream of lower() may depend on a dialect directly. The semantic layer
// resolves every per-dialect decision through DialectBehavior (behaviorOf / resolveBehavior), so these
// files must NOT import the Dialect union, the raw identifier-fold funnel, or the inferDialect
// dispatcher. If this test fails, a new site reached past the seam — route it through the behavior,
// do not weaken this test.
//
// Scope: the pure semantic passes, plus the two infer ENGINE files. NOT the per-dialect folders
// (src/<dialect>/) or the shared infer engine's knowledge helpers (types.ts / coerce.ts / functions.ts)
// — those ARE the per-dialect implementation the behavior delegates to, and legitimately know a dialect.
const SEMANTIC_DIRS = ["src/scope", "src/qualify", "src/sema", "src/lineage", "src/references", "src/symbols"];
const SEMANTIC_FILES = ["src/infer/infer.ts", "src/infer/nullability.ts"];

// A forbidden dependency, matched on the module specifier of an import/export-from statement.
const FORBIDDEN: { rx: RegExp; why: string }[] = [
	{
		rx: /["'][^"']*ident\/fold\.js["']/,
		why: "imports the raw fold funnel (use behaviorOf(scope).fold / .displayName / .matchesSourceKey)",
	},
	{
		rx: /["'][^"']*(?:\/|^)dialect\.js["']/,
		why: "imports the Dialect union or the inferDialect dispatcher (use DialectBehavior)",
	},
];

function tsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...tsFiles(p));
		else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(p);
	}
	return out;
}

describe("no dialect dependency downstream of lower()", () => {
	it("the semantic layer reaches dialect knowledge only through DialectBehavior", () => {
		const root = resolve(__dirname, "..", "..");
		const files = [
			...SEMANTIC_DIRS.flatMap((d) => tsFiles(resolve(root, d))),
			...SEMANTIC_FILES.map((f) => resolve(root, f)),
		];
		const offenders: string[] = [];
		for (const file of files) {
			for (const line of readFileSync(file, "utf8").split("\n")) {
				if (!/^\s*(import|export)\b.*\bfrom\b/.test(line)) continue;
				for (const { rx, why } of FORBIDDEN) {
					if (rx.test(line))
						offenders.push(`${file.replace(root, "").replace(/\\/g, "/")}: ${why}\n    ${line.trim()}`);
				}
			}
		}
		// A non-empty list means a downstream file bypassed the seam. The message lists each offender.
		expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
	});

	it("covers the files it claims to (guards against an empty sweep)", () => {
		const root = resolve(__dirname, "..", "..");
		const count = SEMANTIC_DIRS.flatMap((d) => tsFiles(resolve(root, d))).length + SEMANTIC_FILES.length;
		expect(count).toBeGreaterThanOrEqual(12);
	});
});
