// A `parseTemplated` that defaults to a dbt provider, for the tests that assert ref/source naming.
//
// The library default provider is NEUTRAL: it knows no macro vocabulary, so a bare parse leaves
// {{ ref('x') }} / {{ source(...) }} FROM sources opaque (their `name` stays the raw placeholder).
// dbt naming is opt-in, through a DbtTemplateProvider. These tests exercise the dbt path, so they opt
// in once here (a fresh provider per call) instead of threading it through every call site. Passing an
// explicit `opts.provider` still wins, so a test that wants the neutral provider (or a warm/cold
// double) overrides it as before.

import { DbtTemplateProvider } from "../../src/index.js";
import type { Dialect } from "../../src/index.js";
import { parseTemplated as raw } from "../../src/minijinja/index.js";
import type { TemplatedParseOptions, TemplatedParseResult } from "../../src/template/engine.js";

export function parseTemplated(text: string, dialect: Dialect, opts?: TemplatedParseOptions): TemplatedParseResult {
	return raw(text, dialect, { provider: new DbtTemplateProvider(), ...opts });
}
