import { describe, expect, it } from "vitest";
import { DefaultTemplateProvider, DbtTemplateProvider } from "../src/qualify/template-provider.js";

// ref/source/env_var/config are dbt vocabulary, NOT minijinja knowledge (minijinja-the-engine has no
// such builtins; dbt injects them into the render context). So the neutral DEFAULT provider must know
// none of them, and a DbtTemplateProvider carries the static famous-macro knowledge.
const refCall = { name: "ref", args: ["orders"] };
const sourceCall = { name: "source", args: ["raw", "orders"] };
const envCall = { name: "env_var", args: ["X"] };
const configCall = { name: "config", args: [] as (string | null)[] };

describe("DefaultTemplateProvider is dbt-neutral", () => {
	const p = new DefaultTemplateProvider();
	it("does not resolve ref/source to a relation", () => {
		expect(p.relationOf(refCall)).toBeUndefined();
		expect(p.relationOf(sourceCall)).toBeUndefined();
	});
	it("does not type env_var and does not shape config", () => {
		expect(p.valueOf(envCall)).toBeUndefined();
		expect(p.shapeOf(configCall)).toBeUndefined();
	});
	it("knows nothing about a bare ref (expansion undefined)", () => {
		expect(p.expansion(refCall)).toBeUndefined();
	});
});

describe("DbtTemplateProvider carries the dbt vocabulary", () => {
	const p = new DbtTemplateProvider();
	it("resolves ref to the logical model name", () => {
		expect(p.relationOf(refCall)).toEqual({ nameParts: ["orders"] });
	});
	it("resolves source to [source, table]", () => {
		expect(p.relationOf(sourceCall)).toEqual({ nameParts: ["raw", "orders"] });
	});
	it("types env_var as a string", () => {
		expect(p.valueOf(envCall)).toEqual({ type: "string" });
	});
	it("shapes the no-output builtins as nothing", () => {
		expect(p.shapeOf(configCall)).toBe("nothing");
	});
	it("is a TemplateProvider (a DefaultTemplateProvider subclass, so it composes the same way)", () => {
		expect(p).toBeInstanceOf(DefaultTemplateProvider);
		expect(p.expansion(refCall)).toEqual({ shape: "relation", relation: { nameParts: ["orders"] } });
	});
});
