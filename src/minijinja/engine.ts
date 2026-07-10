// ---------------------------------------------------------------------------
// Stage-2 Task 2 — the minijinja TemplateEngine factory. Wraps the existing
// parseTemplated/templateVariants pipeline (untouched) behind the neutral
// TemplateEngine contract (src/template/engine.ts) so the front end can be
// injected by name rather than imported directly.
// ---------------------------------------------------------------------------
import type { TemplateEngine } from "../template/engine.js";
import { parseTemplated } from "./parse.js";
import { templateVariants } from "./variants.js";

/** The minijinja template engine (the Rust engine dbt Fusion uses — the grammar
 *  oracle for what we accept). The shipped, and only, TemplateEngine. */
export function minijinja(): TemplateEngine {
	return {
		name: "minijinja",
		parse: (text, dialect, opts) => parseTemplated(text, dialect, opts),
		variants: (text, dialect) => templateVariants(text, dialect),
	};
}
