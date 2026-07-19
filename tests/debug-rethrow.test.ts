import { afterEach, describe, expect, it, vi } from "vitest";
import { referencesAt } from "../src/references/references.js";
import { lineageAt } from "../src/lineage/hops.js";
import { splitStatements } from "../src/document/split.js";
import { completeAt } from "../src/completion/complete.js";
import type { ScopeTree } from "../src/scope/scope.js";
import type { Dialect } from "../src/dialect.js";
import type { SqlDocument } from "../src/document/document.js";

// Poisoned inputs that make the internal compute throw. The public contract is
// "never throws, degrade to the documented empty result"; SQLLENS_DEBUG=1 flips
// every total-by-contract catch to rethrow, so a real internal defect is visible
// in development instead of masquerading as "no result" (src/debug.ts).
const poisonedScopes = {} as unknown as ScopeTree; // no .root: the scope walk throws
const poisonedDoc = null as unknown as SqlDocument; // .dialect access throws
const badDialect = "nosuchdialect" as Dialect; // tokenize throws on an unregistered dialect

const TWO_STMTS = "select 1; select 2";

afterEach(() => vi.unstubAllEnvs());

describe("total-by-contract degrade (no SQLLENS_DEBUG)", () => {
	it("degrades to the documented empty result", () => {
		expect(referencesAt(poisonedScopes, 0)).toBeNull();
		expect(lineageAt(poisonedScopes, 0)).toBeUndefined();
		expect(splitStatements(TWO_STMTS, badDialect)).toEqual([{ start: 0, end: TWO_STMTS.length }]);
		expect(completeAt(poisonedDoc, 0)).toEqual([]);
	});
});

describe("SQLLENS_DEBUG=1 rethrows instead of degrading", () => {
	it("rethrows the internal error at every wired site", () => {
		vi.stubEnv("SQLLENS_DEBUG", "1");
		expect(() => referencesAt(poisonedScopes, 0)).toThrow();
		expect(() => lineageAt(poisonedScopes, 0)).toThrow();
		expect(() => splitStatements(TWO_STMTS, badDialect)).toThrow();
		expect(() => completeAt(poisonedDoc, 0)).toThrow();
	});
});
