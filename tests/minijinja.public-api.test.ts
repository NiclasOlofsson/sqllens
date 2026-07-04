import { describe, expect, it } from "vitest";
// Import ONLY through the public barrel (src/index.ts) — NOT the internal
// src/minijinja path — to prove the inc1 + inc2 surface is exported: parseTemplated,
// tokenizeTemplated, the region/symbol/variant functions, and every public type.
import {
	parseTemplated,
	tokenizeTemplated,
	templateRegions,
	templateSymbols,
	templateVariants,
	CallbackTemplateCatalog,
	qualify,
	type TemplatedParseResult,
	type TagNode,
	type TemplateRegion,
	type TemplateArm,
	type TemplateSymbol,
	type TemplateVariant,
	type TemplateSourceInfo,
	type TemplateCatalog,
	type TemplateRef,
	type ResolvedRelation,
	type RelationResolver,
} from "../src/index.js";

describe("jinja public surface (barrel export)", () => {
	it("parseTemplated / tokenizeTemplated are reachable through src/index.ts", () => {
		const text = "select {{ ref('stg_orders') }} from t";
		const result: TemplatedParseResult = parseTemplated(text, "databricks");

		expect(result.tokens.length).toBeGreaterThan(0);
		expect(result.sql.ast.kind).toBe("query");
		expect(result.tokens.some((t) => t.channel === 2 && t.role === "minijinja")).toBe(true);

		// tokenizeTemplated yields the same token stream.
		const tokens = tokenizeTemplated(text, "databricks");
		expect(tokens).toEqual(result.tokens);

		// The TagNode type flows through the barrel and a ref node is produced.
		const ref = result.tags.find((n: TagNode): n is Extract<TagNode, { kind: "ref" }> => n.kind === "ref");
		expect(ref?.model).toBe("stg_orders");
	});

	it("is total through the barrel on broken input", () => {
		expect(() => parseTemplated("select {{ ref(", "databricks")).not.toThrow();
	});

	it("the inc2 surface (regions / symbols / variants + types) is reachable through src/index.ts", () => {
		const text =
			"select order_id\nfrom {{ ref('stg_orders') }}\n{% if is_incremental() %}where x > 0{% else %}where x < 0{% endif %}";
		const { tags, sql } = parseTemplated(text, "databricks");

		// templateRegions / templateSymbols flow through the barrel and produce the R4 shapes.
		const regions: TemplateRegion[] = templateRegions(tags, text);
		expect(regions.length).toBeGreaterThanOrEqual(1);
		const arms: TemplateArm[] = regions[0].arms;
		expect(arms.length).toBeGreaterThanOrEqual(2); // if + else
		const symbols: TemplateSymbol[] = templateSymbols(tags);
		expect(Array.isArray(symbols)).toBe(true);

		// templateVariants + the TemplateVariant type flow through the barrel; each variant parses.
		const variants: TemplateVariant[] = templateVariants(text, "databricks");
		expect(variants.length).toBe(2); // all-defaults + the else arm
		for (const v of variants) expect(() => v.parse()).not.toThrow();

		// TemplateSourceInfo is a public IR type: the templated FROM source carries it.
		const from = sql.ast.body.kind === "select" ? sql.ast.body.from[0] : undefined;
		const template: TemplateSourceInfo | undefined = from?.kind === "table" ? from.template : undefined;
		expect(template?.kind).toBe("ref");
	});

	it("the inc3.1 template-catalog surface is reachable through src/index.ts", () => {
		// CallbackTemplateCatalog (value) + TemplateCatalog/TemplateRef/ResolvedRelation/RelationResolver
		// (types) all flow through the barrel. Build a warm catalog through the public surface, resolve a
		// templated ref, and prove qualify fires a real unknown-column against it.
		const resolver: RelationResolver = {
			resolveRelation(ref: TemplateRef): ResolvedRelation | undefined {
				return ref.kind === "ref" && ref.nameParts.join(".") === "orders"
					? { nameParts: ["orders"], columns: [{ name: "id" }, { name: "total" }] }
					: undefined;
			},
		};
		const catalog: TemplateCatalog = new CallbackTemplateCatalog(resolver);

		const good = parseTemplated("SELECT o.total FROM {{ ref('orders') }} o", "databricks");
		expect(qualify(good.sql.ast, catalog).diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		const bad = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		expect(qualify(bad.sql.ast, catalog).diagnostics.filter((d) => d.kind === "unknown-column").length).toBe(1);
	});
});
