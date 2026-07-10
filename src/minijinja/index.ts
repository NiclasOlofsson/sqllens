// Public surface of the minijinja engine — import from "sqllens/minijinja".
// The neutral contract types (TemplateEngine, TemplatedParseResult,
// TemplatedParseOptions) stay on the MAIN barrel; this module is the engine.
export { minijinja } from "./engine.js";
export { parseTemplated, tokenizeTemplated } from "./parse.js";
export type { TemplatedParseResult, TemplatedParseOptions } from "../template/engine.js";
export type { TagNode, MacroCall } from "./parse.js";
export { templateRegions, templateSymbols } from "./regions.js";
export type { TemplateRegion, TemplateArm, TemplateSymbol } from "./regions.js";
export { templateVariants } from "./variants.js";
export type { TemplateVariant } from "./variants.js";
