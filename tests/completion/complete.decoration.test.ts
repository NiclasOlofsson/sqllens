import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completeAt,
	DbtTemplateProvider,
	SqlDocument,
	type CandidateIdentity,
	type Completion,
	type TemplateCall,
} from "../../src/index.js";
import { minijinja } from "../../src/minijinja/index.js";
import { Schema } from "../../src/qualify/schema.js";

// The per-candidate decoration hook (anvil channel ask, greenlit 2026-07-20): completeAt calls
// `decorate` once per candidate it is about to return, with the candidate's STRUCTURAL identity —
// never just the label string — so a consumer answers detail/documentation from real structure. The
// candidate SET stays completeAt's own to decide; the hook only supplies display text.

afterEach(() => vi.unstubAllEnvs());

describe("completeAt's decorate hook", () => {
	it("a CTE candidate carries the RIGHT declaration span under shadowing (nested same-named CTEs)", () => {
		// Two CTEs named "a": an outer one and an inner one declared in a nested subquery. The caret
		// sits inside the INNER subquery, completing the CTE name "a" it just typed — the identity
		// must pin the INNER declaration, not the outer one it shadows.
		const outerCteBody = "select 1 as one";
		const innerCteBody = "select 2 as two, 3 as three";
		const innerHead = `with a as (${innerCteBody})\nselect * from a`;
		const sql = `with a as (${outerCteBody})\nselect * from (\n${innerHead} x\n)t`;
		const offset = sql.indexOf(innerHead) + innerHead.length; // right after the typed inner "a"
		const innerNameOffset = sql.indexOf(innerHead) + "with ".length; // the inner CTE's own "a" span

		const doc = SqlDocument.create(sql, "databricks");
		expect(doc.errors).toBe(0); // sanity: this is a clean parse, not a broken-input fallback

		const identities: CandidateIdentity[] = [];
		completeAt(doc, offset, undefined, {
			decorate: (c, identity) => {
				if (c.kind === "cte") identities.push(identity);
				return undefined;
			},
		});

		expect(identities).toHaveLength(1); // dedup collapses the two same-named CTEs to one candidate
		const identity = identities[0]!;
		if (identity.kind !== "cte") throw new Error("expected a cte identity");
		expect(identity.declarationSpan?.start).toBe(innerNameOffset);
	});

	it("a column candidate carries its source relation (the resolved ResolvedSource)", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "SELECT amount FROM sales s WHERE ";
		const doc = SqlDocument.create(sql, "databricks");

		let amountIdentity: CandidateIdentity | undefined;
		completeAt(doc, sql.length, schema, {
			decorate: (c, identity) => {
				if (c.kind === "column" && c.label === "amount") amountIdentity = identity;
				return undefined;
			},
		});

		expect(amountIdentity).toBeDefined();
		if (amountIdentity?.kind !== "column") throw new Error("expected a column identity");
		const source = amountIdentity.source;
		if (source?.kind !== "table") throw new Error("expected a table source");
		expect(source.name).toEqual(["sales"]);
		expect(source.source.alias).toBe("s"); // the source relation's OWN alias, as written
	});

	it("a templated table candidate carries its TemplateCall (ref's model-name slot)", () => {
		// Same fixture style as complete.jinja-candidates.test.ts: a host catalog answering ref's
		// model-name slot as "template" completions.
		class Catalog extends DbtTemplateProvider {
			override templateCandidates(call: TemplateCall, argIndex: number) {
				if (call.name === "ref" && argIndex === 0) return [{ label: "orders" }, { label: "customers" }];
				return [];
			}
		}
		const text = "select * from {{ ref('";
		const doc = SqlDocument.create(text, "databricks", { templating: minijinja(), provider: new Catalog() });

		const calls: TemplateCall[] = [];
		const items = completeAt(doc, text.length, new Catalog(), {
			decorate: (c, identity) => {
				expect(c.kind).toBe("template");
				if (identity.kind === "template") calls.push(identity.call);
				return undefined;
			},
		});

		expect(items.map((c) => c.label).sort()).toEqual(["customers", "orders"]);
		expect(calls).toHaveLength(2);
		for (const call of calls) expect(call.name).toBe("ref"); // the SAME call templateCandidates saw
	});

	it("returned detail/documentation land on the items", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "SELECT  FROM sales";
		const offset = "SELECT ".length;
		const doc = SqlDocument.create(sql, "databricks");

		const items = completeAt(doc, offset, schema, {
			decorate: (c) => {
				if (c.kind === "column" && c.label === "amount") {
					return { detail: "the sale amount", documentation: "how much the sale was for" };
				}
				return undefined;
			},
		});

		const amount = items.find((c) => c.kind === "column" && c.label === "amount");
		expect(amount?.detail).toBe("the sale amount");
		expect(amount?.documentation).toBe("how much the sale was for");
		// an undecorated candidate is untouched — no documentation fabricated for it.
		const id = items.find((c) => c.kind === "column" && c.label === "id");
		expect(id?.documentation).toBeUndefined();
	});

	it("a throwing hook does not break completeAt, and rethrows under SQLLENS_DEBUG", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "SELECT amount FROM sales s WHERE ";
		const doc = SqlDocument.create(sql, "databricks");
		const throwing = (): never => {
			throw new Error("decorate boom");
		};

		// Total-by-contract: the throw is swallowed, completeAt still returns its full result.
		const items = completeAt(doc, sql.length, schema, { decorate: throwing });
		expect(items.some((c) => c.kind === "column" && c.label === "amount")).toBe(true);

		vi.stubEnv("SQLLENS_DEBUG", "1");
		expect(() => completeAt(doc, sql.length, schema, { decorate: throwing })).toThrow("decorate boom");
	});

	it("no-hook behavior is byte-identical to a plain completeAt call", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "SELECT amount FROM sales s WHERE ";
		const doc = SqlDocument.create(sql, "databricks");

		const plain = completeAt(doc, sql.length, schema);
		const withEmptyOpts = completeAt(doc, sql.length, schema, {});
		const decorateReturnsNothing = completeAt(doc, sql.length, schema, { decorate: () => undefined });

		const strip = (items: readonly Completion[]) => items.map((c) => ({ ...c }));
		expect(strip(withEmptyOpts)).toEqual(strip(plain));
		expect(strip(decorateReturnsNothing)).toEqual(strip(plain));
		expect(withEmptyOpts.replaceRange).toEqual(plain.replaceRange);
		expect(decorateReturnsNothing.replaceRange).toEqual(plain.replaceRange);
	});
});
