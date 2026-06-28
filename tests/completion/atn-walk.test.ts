import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../../src/generated/databricks/DatabricksParser.js";
import { collectCandidates } from "../../src/completion/atn-walk.js";
import { COMPLETION_CONFIG } from "../../src/completion/config.js";
import { makeParser } from "../../src/completion/parser-factory.js";

const FROM = DatabricksLexer.FROM; // 158
const ASTERISK = DatabricksLexer.ASTERISK; // 447
const ID_REF = DatabricksParser.RULE_identifierReference; // 82 — table/name reference (relationPrimary)
const MULTIPART = DatabricksParser.RULE_multipartIdentifier; // 163

/**
 * Caret token index = index in tokenStream.getTokens() of the first token whose
 * `.start >= caretOffset`. For an end-of-input caret that lands on the EOF token's index.
 */
function caretIndexAt(m: ReturnType<typeof makeParser>, caretOffset: number): number {
	const toks = m.tokenStream.getTokens();
	for (let i = 0; i < toks.length; i++) {
		if (toks[i]!.start >= caretOffset) return i;
	}
	return toks.length - 1; // EOF
}

function candidatesAtEnd(sql: string) {
	const m = makeParser(sql, "databricks");
	m.runEntry();
	const caretIdx = caretIndexAt(m, sql.length);
	const cfg = COMPLETION_CONFIG.databricks;
	return collectCandidates(m.parser, m.entryRuleIndex, caretIdx, cfg.preferredRules, cfg.ignoredTokens);
}

describe("collectCandidates — databricks ATN walk", () => {
	it("after FROM offers a table/name reference rule and some tokens", () => {
		const c = candidatesAtEnd("SELECT a FROM ");
		// A name is legal right after FROM — a preferred name/table rule must be reachable.
		expect(c.rules.has(ID_REF) || c.rules.has(MULTIPART)).toBe(true);
		expect(c.tokens.size).toBeGreaterThan(0);
	});

	it("after a complete projection offers the FROM keyword", () => {
		const c = candidatesAtEnd("SELECT a ");
		expect(c.tokens.has(FROM)).toBe(true);
	});

	it("right after SELECT offers a name rule and/or the star token", () => {
		const c = candidatesAtEnd("SELECT ");
		const offersName = c.rules.has(ID_REF) || c.rules.has(MULTIPART);
		const offersStar = c.tokens.has(ASTERISK);
		expect(offersName || offersStar).toBe(true);
	});

	it("does not throw on broken input and returns a candidates shape", () => {
		const m = makeParser("(((", "databricks");
		m.runEntry();
		const caretIdx = caretIndexAt(m, 3);
		const cfg = COMPLETION_CONFIG.databricks;
		const c = collectCandidates(m.parser, m.entryRuleIndex, caretIdx, cfg.preferredRules, cfg.ignoredTokens);
		expect(c.tokens).toBeInstanceOf(Set);
		expect(c.rules).toBeInstanceOf(Set);
	});
});
