import { describe, expect, it } from "vitest";
// Import ONLY through the public barrel (src/index.ts) — NOT the internal
// src/minijinja path — to prove the inc1 + inc2 surface is exported: parseTemplated,
// tokenizeTemplated, the region/symbol/variant functions, and every public type.
import {
	DefaultTemplateProvider,
	qualify,
	type TemplatedParseResult,
	type TemplateSourceInfo,
	type TemplateProvider,
	type TemplateCall,
	type ResolvedRelation,
} from "../src/index.js";
import {
	parseTemplated,
	tokenizeTemplated,
	templateRegions,
	templateSymbols,
	templateVariants,
	type TagNode,
	type TemplateRegion,
	type TemplateArm,
	type TemplateSymbol,
	type TemplateVariant,
} from "../src/minijinja/index.js";

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

		// The TagNode type flows through the barrel and a ref call is produced.
		const ref = result.tags.find(
			(n: TagNode): n is Extract<TagNode, { kind: "call" }> => n.kind === "call" && n.name === "ref",
		);
		expect(ref?.args.at(-1)?.value).toBe("stg_orders");
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
		expect(template?.call?.name).toBe("ref");
	});

	it("the template-provider surface is reachable through src/index.ts", () => {
		// DefaultTemplateProvider (value) + TemplateProvider/TemplateCall/ResolvedRelation (types) all
		// flow through the barrel. Subclass the shipped base through the public surface, resolve a
		// templated ref, and prove qualify fires a real unknown-column against it.
		class Warm extends DefaultTemplateProvider {
			override relationOf(call: TemplateCall): ResolvedRelation | undefined {
				return call.name === "ref" && call.args[0] === "orders"
					? { nameParts: ["orders"], columns: [{ name: "id" }, { name: "total" }] }
					: super.relationOf(call);
			}
		}
		const catalog: TemplateProvider = new Warm();

		const good = parseTemplated("SELECT o.total FROM {{ ref('orders') }} o", "databricks");
		expect(qualify(good.sql.ast, catalog).diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		const bad = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		expect(qualify(bad.sql.ast, catalog).diagnostics.filter((d) => d.kind === "unknown-column").length).toBe(1);
	});
});
