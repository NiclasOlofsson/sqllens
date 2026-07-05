// ---------------------------------------------------------------------------
// Template-aware TYPED column resolution for a table source — the inc3.2
// remainder: thread a TemplateCatalog's `relation` columns (name + type +
// nullable) to every consumer that types or binds a table source's columns
// (infer / nullability / sema-resolve), not just qualify's name checks.
//
// A leaf module: imports only the schema/catalog types, so `src/infer` and
// `src/sema` can use it without a runtime cycle through qualify.ts (qualify
// imports inferType).
//
// Two layers, different fallback semantics on purpose:
//   - `relationColumns` — CATALOG-ONLY: undefined for an opaque tag, a plain
//     SchemaSource, or a catalog miss. qualify's diagnostic exemption is built
//     on this (unknown-column fires only on a POSITIVE catalog answer).
//   - `tableSourceColumns` — catalog first, then the plain `columnsFor(name)`
//     lookup the type consumers have always done. The fallback keeps a Schema
//     keyed by dbt-LOGICAL names working for types (the pre-inc3.2 behavior of
//     infer/resolve, unchanged), while the catalog path adds real warehouse
//     types for `{{ ref('x') }}.col` hover/inference.
// ---------------------------------------------------------------------------

import type { TemplateSourceInfo } from "../ir/ir.js";
import type { Column } from "./schema.js";
import type { SchemaSource } from "./schema-source.js";
import type { TemplateCatalog } from "./template-catalog.js";

/**
 * Resolve a templated source's TYPED columns through a TemplateCatalog, or undefined
 * for the R3 exemption (opaque/macro/expr tag, plain SchemaSource, catalog miss).
 * `columns: []` is a genuinely EMPTY relation; `columns: undefined` on a resolved
 * relation falls through to the physical-name resolver (the not-loaded sentinel).
 */
export function relationColumns(
	t: TemplateSourceInfo,
	name: string[],
	schema: SchemaSource,
	dialect?: string,
): Column[] | undefined {
	if (t.opaque || t.kind === "macro" || t.kind === "expr" || !schema || !("relation" in schema)) return undefined;
	const resolved = (schema as TemplateCatalog).relation({ kind: t.kind, nameParts: name }, dialect);
	if (!resolved) return undefined; // catalog miss → exemption (warms on a later prime())
	if (resolved.columns) return resolved.columns;
	return schema.columnsFor(resolved.nameParts, dialect);
}

/**
 * TYPED columns of a table source, template-aware: a templated source resolves
 * through the catalog first (real warehouse columns); a catalog miss — or no
 * catalog — falls back to the plain `columnsFor(name)` lookup (which for a
 * templated source carries the dbt-logical name, so a Schema declaring model
 * names keeps answering exactly as before).
 */
export function tableSourceColumns(
	name: string[],
	template: TemplateSourceInfo | undefined,
	schema: SchemaSource,
	dialect?: string,
): Column[] | undefined {
	if (template) {
		const fromCatalog = relationColumns(template, name, schema, dialect);
		if (fromCatalog) return fromCatalog;
	}
	return schema.columnsFor(name, dialect);
}
