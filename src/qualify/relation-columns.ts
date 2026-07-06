// ---------------------------------------------------------------------------
// Template-aware TYPED column resolution for a table source — the semantic half
// of the provider seam: a templated source's marker carries its provider key
// (`TemplateSourceInfo.call`), and everything that types or binds its columns
// (qualify / infer / nullability / sema-resolve) resolves through ONE
// `TemplateProvider.expansion(call)` consult here.
//
// A leaf module: imports only the schema/provider types, so `src/infer` and
// `src/sema` use it without a runtime cycle through qualify.ts (qualify
// imports inferType).
//
// Two layers, different fallback semantics on purpose:
//   - `relationColumns` — PROVIDER-ONLY: undefined for a marker with no call,
//     a schema that is not a provider, or a provider with no relation answer.
//     qualify's diagnostic exemption is built on this (unknown-column fires
//     only on a POSITIVE relation answer that yields columns).
//   - `tableSourceColumns` — provider first, then the plain `columnsFor(name)`
//     lookup the type consumers have always done. The fallback keeps a Schema
//     keyed by dbt-LOGICAL names working for types, while the provider path
//     adds real warehouse types for `{{ ref('x') }}.col` hover/inference.
// ---------------------------------------------------------------------------

import type { TemplateSourceInfo } from "../ir/ir.js";
import type { Column } from "./schema.js";
import type { SchemaProvider } from "./schema-provider.js";
import type { TemplateCall, TemplateProvider } from "./template-provider.js";

/** The schema as a TemplateProvider when it is one (structural — the shipped base or a subclass). */
export function asProvider(schema: SchemaProvider): TemplateProvider | undefined {
	return schema && "expansion" in schema ? (schema as TemplateProvider) : undefined;
}

/** The provider key of a template SOURCE marker — apply-tags always attaches `call` for
 *  ref/source/macro, so this is a direct return. Expr markers carry none and correctly resolve nothing. */
function sourceCall(t: TemplateSourceInfo): TemplateCall | undefined {
	return t.call;
}

/**
 * Resolve a templated source's TYPED columns through the provider, or undefined for the
 * exemption (no call, no provider, no relation answer). A relation answer WITHOUT columns
 * (`columns: undefined` — the not-loaded sentinel) resolves through the physical-name
 * lookup; `columns: []` is a genuinely EMPTY relation.
 */
export function relationColumns(t: TemplateSourceInfo, schema: SchemaProvider, dialect?: string): Column[] | undefined {
	const provider = asProvider(schema);
	const call = sourceCall(t);
	if (!provider || !call) return undefined;
	const rel = provider.expansion(call)?.relation;
	if (!rel) return undefined; // no/cold answer → exemption (warms on a later prime())
	if (rel.columns) return rel.columns;
	return schema.columnsFor(rel.nameParts, dialect);
}

/**
 * TYPED columns of a table source, template-aware: a templated source resolves through
 * the provider first (real warehouse columns); no answer — or no provider — falls back
 * to the plain `columnsFor(name)` lookup (which for a templated source carries the
 * dbt-logical name, so a Schema declaring model names keeps answering as before).
 */
export function tableSourceColumns(
	name: string[],
	template: TemplateSourceInfo | undefined,
	schema: SchemaProvider,
	dialect?: string,
): Column[] | undefined {
	if (template) {
		const fromProvider = relationColumns(template, schema, dialect);
		if (fromProvider) return fromProvider;
	}
	return schema.columnsFor(name, dialect);
}
