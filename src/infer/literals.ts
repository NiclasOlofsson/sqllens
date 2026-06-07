import { scalar, UNKNOWN, type Type } from "./types.js";

// Literal typing per dialect — the lexeme as written → a Type. Kept out of the inference engine so
// each dialect's literal forms (Spark `date '…'` / `interval`, T-SQL `N'…'` / `0x…`) stay localised.
// NULL is context-dependent → unknown, never guessed.

const BOOLEAN = scalar("boolean");

/** Databricks/Spark literal forms. */
export function databricksLiteral(text: string): Type {
	const t = text.trim();
	if (/^['"]/.test(t)) return scalar("string");
	if (/^(true|false)$/i.test(t)) return BOOLEAN;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return scalar("date");
	if (/^timestamp\s*'/i.test(t)) return scalar("timestamp");
	if (/^interval\b/i.test(t)) return scalar("interval");
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eed][+-]?\d+)?$/i.test(t) && /[.eed]/i.test(t)) return scalar("double");
	return UNKNOWN;
}

/** T-SQL literal forms: `'str'` / `N'unicode'` → string, `0x…` → binary, `1` → int, `1.5` → decimal
 *  (numeric), `1e3` → float. */
export function tsqlLiteral(text: string): Type {
	const t = text.trim();
	if (/^n?['"]/i.test(t)) return scalar("string");
	if (/^0x/i.test(t)) return scalar("binary");
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return scalar("float");
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return scalar("decimal");
	return UNKNOWN;
}
