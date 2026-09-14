// ---------------------------------------------------------------------------
// statementSpans() — the statement cell spans of a text without building the
// document. The SqlDocument constructor derives its cells from exactly this
// split (the plain text, or the engine's placeholder for a templated one), so
// the spans answered here are the spans `doc.statements[i].span` would carry;
// a consumer that only needs "where do the statements start and end" (code
// lenses, run-at-cursor ranges) pays the lex and the split, not the parses.
// ---------------------------------------------------------------------------

import { debugRethrow } from "../debug.js";
import type { Dialect } from "../dialect.js";
import type { TemplateProvider } from "../qualify/template-provider.js";
import type { TemplateEngine } from "../template/engine.js";
import { splitStatements, type StatementCellSpan } from "./split.js";

/**
 * The statement cell spans `SqlDocument.create(text, dialect, opts)` would produce, without the
 * per-cell parses. Plain text splits directly; with `templating` the engine's placeholder is
 * split (its `placeholder` hook when it has one, else its full `parse`), and an engine without
 * `parseCell` answers one whole-text span, exactly as the document door does. Total: never throws.
 */
export function statementSpans(
	text: string,
	dialect: Dialect,
	opts: { templating?: TemplateEngine; provider?: TemplateProvider } = {},
): StatementCellSpan[] {
	const engine = opts.templating;
	if (!engine) return splitStatements(text, dialect);
	if (!engine.parseCell) return [{ start: 0, end: text.length }];
	let placeholder: string;
	try {
		placeholder = engine.placeholder
			? engine.placeholder(text, dialect, { provider: opts.provider })
			: engine.parse(text, dialect, { provider: opts.provider }).placeholder;
	} catch (e) {
		debugRethrow(e);
		placeholder = text;
	}
	return splitStatements(placeholder, dialect);
}
