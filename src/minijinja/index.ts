// Public surface of the minijinja engine — import from "sqllens/minijinja".
// TemplateEngine lives ONLY on the main barrel; the result/option types are
// canonically declared in src/template/engine.ts and re-exported both there
// and here.
export { minijinja } from "./engine.js";
export { parseTemplated, tokenizeTemplated } from "./parse.js";
export type { TemplatedParseResult, TemplatedParseOptions } from "../template/engine.js";
export type { TagNode, MacroCall } from "./parse.js";
export { templateRegions, templateSymbols } from "./regions.js";
export type { TemplateRegion, TemplateArm, TemplateSymbol } from "./regions.js";
export { templateVariants } from "./variants.js";
export type { TemplateVariant } from "./variants.js";
