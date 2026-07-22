import { describe, it, expect } from "vitest";
import {
	SqlDocument,
	SqlSession,
	MAIN_FRAME,
	frameAt,
	clausesOf,
	setOpArmsOf,
	type ClauseKind,
} from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import { dbt } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// The SQL debugger's three marker-planting primitives: frameAt (which CTE/frame
// owns a position), clausesOf (that frame's ordered clause list), setOpArmsOf
// (set-op arm geometry). All total, schema-free, additive over the frozen
// scope tree / token stream the parse already holds.
// ---------------------------------------------------------------------------

describe("frameAt", () => {
	it("inside a CTE body returns that CTE's own frame", () => {
		const SQL = "with c as (select x from t) select y from c";
		const doc = SqlDocument.create(SQL, "databricks");
		const hit = doc.frameAt(SQL.indexOf("x from t"));
		expect(hit?.frame).toBe("c");
		expect(hit?.scope).toBeDefined();
	});

	it("in the main query returns MAIN_FRAME", () => {
		const SQL = "with c as (select x from t) select y from c";
		const doc = SqlDocument.create(SQL, "databricks");
		const hit = doc.frameAt(SQL.indexOf("y from c"));
		expect(hit?.frame).toBe(MAIN_FRAME);
	});

	it("carries the Scope object itself alongside the label (the identity anchor for two same-named frames)", () => {
		// Two CTEs, unrelated, that happen to declare columns of the same NAME: the scope identity
		// is what actually distinguishes "this c's x" from a hypothetical shadow, not the frame string.
		const SQL = "with c as (select x from t1), d as (select x from t2) select c.x, d.x from c, d";
		const doc = SqlDocument.create(SQL, "databricks");
		const inC = doc.frameAt(SQL.indexOf("x from t1"))!;
		const inD = doc.frameAt(SQL.indexOf("x from t2"))!;
		expect(inC.frame).toBe("c");
		expect(inD.frame).toBe("d");
		expect(inC.scope).not.toBe(inD.scope); // distinct Scope objects, not just distinct labels
	});

	it("narrowest-cover: a doubly-nested subquery resolves to its OWN frame, not an ancestor's", () => {
		const SQL = "select (select z from (select w from inner_t) sub) as val from outer_t";
		const doc = SqlDocument.create(SQL, "databricks");
		const hit = doc.frameAt(SQL.indexOf("w from inner_t"));
		expect(hit?.frame).toBe("sub"); // the derived table's own alias, not "_sub_" (the scalar subquery's)
		// the scalar subquery's own frame ("_sub_") owns its OWN text, e.g. right after "select z"
		const scalarHit = doc.frameAt(SQL.indexOf("z from"));
		expect(scalarHit?.frame).toBe("_sub_");
		expect(scalarHit?.scope).not.toBe(hit?.scope);
	});

	it("multi-statement: a later cell's offset resolves through that cell's OWN scope tree", () => {
		const TWO = "select a from t1; select b from t2";
		const doc = SqlDocument.create(TWO, "databricks");
		const first = doc.frameAt(TWO.indexOf("a from"));
		const second = doc.frameAt(TWO.indexOf("b from"));
		expect(first?.frame).toBe(MAIN_FRAME);
		expect(second?.frame).toBe(MAIN_FRAME);
		expect(second?.scope).not.toBe(first?.scope); // distinct per-cell scope trees
		expect(second?.scope).toBe(doc.cellAt(TWO.indexOf("b from"))?.scopes.root);
	});

	it("off-document offsets answer undefined, never throw", () => {
		const doc = SqlDocument.create("select 1", "databricks");
		expect(doc.frameAt(-5)).toBeUndefined();
		expect(doc.frameAt(9999)).toBeUndefined();
		expect(frameAt(doc.scopes, -5)).toBeUndefined();
	});

	it("broken input answers honestly (total, never throws)", () => {
		const BROKEN = "select a from where";
		const doc = SqlDocument.create(BROKEN, "databricks");
		expect(() => doc.frameAt(0)).not.toThrow();
		expect(() => doc.frameAt(BROKEN.length)).not.toThrow();
	});

	it("SqlSession.frameAt is a one-line delegation", () => {
		const SQL = "with c as (select x from t) select y from c";
		const s = SqlSession.create(SQL, "databricks");
		expect(s.frameAt(SQL.indexOf("x from t"))?.frame).toBe("c");
	});
});

describe("clausesOf", () => {
	// One representative query per dialect, each with select/from/where/groupBy/having/orderBy/limit
	// (+ qualify where the dialect has it) pinned EXACTLY: anchor + span are textual slices of the
	// fixture, so a wrong span reads as a wrong substring, not an opaque offset mismatch.
	it("databricks: every clause anchored + spanned exactly, incl. QUALIFY", () => {
		const Q =
			"select a, b from t where a > 1 group by a having count(*) > 1 " +
			"qualify row_number() over (order by a) = 1 order by a limit 10";
		const doc = SqlDocument.create(Q, "databricks");
		const clauses = doc.clausesOf(doc.scopes.root);
		const byKind = new Map(clauses.map((c) => [c.kind, c]));
		const slice = (a: number, b: number) => Q.slice(a, b);

		expect(slice(byKind.get("select")!.anchorSpan.start, byKind.get("select")!.anchorSpan.end)).toBe("select");
		expect(slice(byKind.get("select")!.span.start, byKind.get("select")!.span.end)).toBe("select a, b");

		expect(slice(byKind.get("from")!.anchorSpan.start, byKind.get("from")!.anchorSpan.end)).toBe("from");
		expect(slice(byKind.get("from")!.span.start, byKind.get("from")!.span.end)).toBe("from t");

		expect(slice(byKind.get("where")!.anchorSpan.start, byKind.get("where")!.anchorSpan.end)).toBe("where");
		expect(slice(byKind.get("where")!.span.start, byKind.get("where")!.span.end)).toBe("where a > 1");

		expect(slice(byKind.get("groupBy")!.anchorSpan.start, byKind.get("groupBy")!.anchorSpan.end)).toBe("group by");
		expect(slice(byKind.get("groupBy")!.span.start, byKind.get("groupBy")!.span.end)).toBe("group by a");

		expect(slice(byKind.get("having")!.anchorSpan.start, byKind.get("having")!.anchorSpan.end)).toBe("having");
		expect(slice(byKind.get("having")!.span.start, byKind.get("having")!.span.end)).toBe("having count(*) > 1");

		expect(slice(byKind.get("qualify")!.anchorSpan.start, byKind.get("qualify")!.anchorSpan.end)).toBe("qualify");
		expect(slice(byKind.get("qualify")!.span.start, byKind.get("qualify")!.span.end)).toBe(
			"qualify row_number() over (order by a) = 1",
		);

		expect(slice(byKind.get("orderBy")!.anchorSpan.start, byKind.get("orderBy")!.anchorSpan.end)).toBe("order by");
		expect(slice(byKind.get("orderBy")!.span.start, byKind.get("orderBy")!.span.end)).toBe("order by a");

		expect(slice(byKind.get("limit")!.anchorSpan.start, byKind.get("limit")!.anchorSpan.end)).toBe("limit");
		expect(slice(byKind.get("limit")!.span.start, byKind.get("limit")!.span.end)).toBe("limit 10");

		// document order: select < from < where < groupBy < having < qualify < orderBy < limit
		expect(clauses.map((c) => c.kind)).toEqual([
			"select",
			"from",
			"where",
			"groupBy",
			"having",
			"qualify",
			"orderBy",
			"limit",
		]);
		// "window" is in the kind vocabulary but never fabricated: the IR retains no top-level named
		// WINDOW clause (only per-function OVER specs), so it never appears here.
		expect(clauses.some((c) => c.kind === "window")).toBe(false);
		const kinds: ClauseKind[] = clauses.map((c) => c.kind);
		expect(kinds.length).toBeGreaterThan(0);
	});

	it("databricks: JOIN spans + anchors (multi-word keyword runs)", () => {
		const Q = "select * from a join b on a.id = b.id left join c on b.id = c.id";
		const doc = SqlDocument.create(Q, "databricks");
		const joins = doc.clausesOf(doc.scopes.root).filter((c) => c.kind === "join");
		expect(joins.length).toBe(2);
		expect(Q.slice(joins[0].anchorSpan.start, joins[0].anchorSpan.end)).toBe("join");
		expect(Q.slice(joins[0].span.start, joins[0].span.end)).toBe("join b on a.id = b.id");
		expect(Q.slice(joins[1].anchorSpan.start, joins[1].anchorSpan.end)).toBe("left join");
		expect(Q.slice(joins[1].span.start, joins[1].span.end)).toBe("left join c on b.id = c.id");
		// FROM's own span extends through the trailing joins' ON predicates too.
		const from = doc.clausesOf(doc.scopes.root).find((c) => c.kind === "from")!;
		expect(Q.slice(from.span.start, from.span.end)).toBe(Q.slice(Q.indexOf("from"), Q.length));
	});

	it("tsql: TOP is not its own clause; trailing OFFSET/FETCH is (no QUALIFY)", () => {
		const Q =
			"select top 10 a, b from t where a > 1 group by a having count(*) > 1 " +
			"order by a offset 5 rows fetch next 10 rows only";
		const doc = SqlDocument.create(Q, "tsql");
		const clauses = doc.clausesOf(doc.scopes.root);
		const byKind = new Map(clauses.map((c) => [c.kind, c]));
		const slice = (a: number, b: number) => Q.slice(a, b);

		// TOP rides inside "select"'s own span (from "select" through the last projection) rather than
		// being its own "limit" entry.
		expect(slice(byKind.get("select")!.anchorSpan.start, byKind.get("select")!.anchorSpan.end)).toBe("select");
		expect(slice(byKind.get("select")!.span.start, byKind.get("select")!.span.end)).toBe(
			"select top 10 a, b",
		);
		expect(byKind.has("qualify")).toBe(false); // T-SQL has no QUALIFY clause

		expect(slice(byKind.get("from")!.span.start, byKind.get("from")!.span.end)).toBe("from t");
		expect(slice(byKind.get("where")!.span.start, byKind.get("where")!.span.end)).toBe("where a > 1");
		expect(slice(byKind.get("groupBy")!.span.start, byKind.get("groupBy")!.span.end)).toBe("group by a");
		expect(slice(byKind.get("having")!.span.start, byKind.get("having")!.span.end)).toBe(
			"having count(*) > 1",
		);
		expect(slice(byKind.get("orderBy")!.span.start, byKind.get("orderBy")!.span.end)).toBe("order by a");

		// limit: anchored on "offset" (never "top"), spans through the FETCH count only. The trailing
		// bare "rows only" keyword text carries no IR-held content, so it is not included (stated
		// boundary: see src/scope/clauses.ts's file header).
		const limit = byKind.get("limit")!;
		expect(slice(limit.anchorSpan.start, limit.anchorSpan.end)).toBe("offset");
		expect(slice(limit.span.start, limit.span.end)).toBe("offset 5 rows fetch next 10");
	});

	it("snowflake: QUALIFY present", () => {
		const Q = "select a from t qualify row_number() over (order by a) = 1";
		const doc = SqlDocument.create(Q, "snowflake");
		const clauses = doc.clausesOf(doc.scopes.root);
		const qualify = clauses.find((c) => c.kind === "qualify")!;
		expect(qualify).toBeDefined();
		expect(Q.slice(qualify.anchorSpan.start, qualify.anchorSpan.end)).toBe("qualify");
		expect(Q.slice(qualify.span.start, qualify.span.end)).toBe(
			"qualify row_number() over (order by a) = 1",
		);
	});

	it("snowflake: trailing LIMIT (its lower.ts DOES extract a top-level QueryExpr.limit)", () => {
		const Q = "select a from t order by a limit 10";
		const doc = SqlDocument.create(Q, "snowflake");
		const limit = doc.clausesOf(doc.scopes.root).find((c) => c.kind === "limit")!;
		expect(limit).toBeDefined();
		expect(Q.slice(limit.anchorSpan.start, limit.anchorSpan.end)).toBe("limit");
		expect(Q.slice(limit.span.start, limit.span.end)).toBe("limit 10");
	});

	it("databricks: trailing LIMIT ... OFFSET (queryOrganization's own LIMIT/OFFSET, not just pipe-stage)", () => {
		const Q = "select a from t order by a limit 10 offset 5";
		const doc = SqlDocument.create(Q, "databricks");
		const limit = doc.clausesOf(doc.scopes.root).find((c) => c.kind === "limit")!;
		expect(limit).toBeDefined();
		expect(Q.slice(limit.anchorSpan.start, limit.anchorSpan.end)).toBe("limit");
		expect(Q.slice(limit.span.start, limit.span.end)).toBe("limit 10 offset 5");
	});

	it("emits only clauses that exist in the text: a bare SELECT has no where/groupBy/having/etc", () => {
		const Q = "select 1";
		const doc = SqlDocument.create(Q, "databricks");
		const clauses = doc.clausesOf(doc.scopes.root);
		expect(clauses.map((c) => c.kind)).toEqual(["select"]);
	});

	it("a scope this document didn't produce answers [] (never a guess)", () => {
		const a = SqlDocument.create("select 1", "databricks");
		const b = SqlDocument.create("select 2", "databricks");
		expect(a.clausesOf(b.scopes.root)).toEqual([]);
	});

	it("multi-statement: clausesOf shifts spans into document coordinates", () => {
		const TWO = "select a from t1; select b, c from t2 where b > 1";
		const doc = SqlDocument.create(TWO, "databricks");
		const secondRoot = doc.cellAt(TWO.indexOf("b, c"))!.scopes.root;
		const clauses = doc.clausesOf(secondRoot);
		const where = clauses.find((c) => c.kind === "where")!;
		expect(TWO.slice(where.anchorSpan.start, where.anchorSpan.end)).toBe("where");
		expect(TWO.slice(where.span.start, where.span.end)).toBe("where b > 1");
	});

	it("clausesOf as a composable free function over a ScopeTree (mirrors referencesAt/lineageAt)", () => {
		const Q = "select a from t where a > 1";
		const doc = SqlDocument.create(Q, "databricks");
		const clauses = clausesOf(doc.scopes.root, doc.tokens);
		expect(clauses.map((c) => c.kind)).toEqual(["select", "from", "where"]);
	});

	it("works on a template-variant-arm document (just another SqlDocument, by construction)", () => {
		// A3 (tests/document.variants.test.ts's own fixture): two arms differing in the select list.
		const A3 = "SELECT {% if v %}col_a{% else %}col_b{% endif %}, c FROM anchor_table";
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);
		for (const variant of doc.variants) {
			const armDoc = variant.doc();
			const clauses = armDoc.clausesOf(armDoc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from"]);
			const armText = variant.text();
			const from = clauses.find((c) => c.kind === "from")!;
			expect(armText.slice(from.span.start, from.span.end)).toBe("FROM anchor_table");
		}
	});

	// Regression (v1.7.0): a templated relation ({{ ref('x') }}) sitting in the FROM slot made the
	// WHOLE "from" entry vanish. The FROM keyword is plain SQL text outside the jinja tag — only the
	// relation itself is a placeholder fill — so the clause is real and must anchor on the real
	// keyword; only the region the fill occupies is templated. Root cause: the templated source's
	// `cst` starts at the placeholder-fill token, which the unified token stream (src/minijinja/
	// parse.ts) replaces wholesale with channel-2 jinja tokens — so no channel-0 token starts there,
	// and clauses.ts's own exact-index backward lookup missed. Matrix reproduced verbatim from the
	// consumer report, plus the sibling shapes (JOIN's templated side, an aliased templated source,
	// multiple templated sources comma-joined).
	describe("templated FROM sources (anchor/adjacency across a jinja fill)", () => {
		const dbtOpts = () => ({ templating: minijinja(), ...dbt() });

		it("plain baseline (no jinja): select,from", () => {
			const Q = "select id from raw_a";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			expect(doc.clausesOf(doc.scopes.root).map((c) => c.kind)).toEqual(["select", "from"]);
		});

		it("templated FROM alone: from is present, anchored on the real keyword", () => {
			const Q = "select id from {{ ref('raw_a') }}";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from"]);
			const from = clauses.find((c) => c.kind === "from")!;
			expect(Q.slice(from.anchorSpan.start, from.anchorSpan.end)).toBe("from");
			expect(Q.slice(from.span.start, from.span.end)).toBe("from {{ ref('raw_a') }}");
		});

		it("templated FROM + trailing WHERE: both from and where present", () => {
			const Q = "select id from {{ ref('raw_a') }} where id > 0";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from", "where"]);
			const from = clauses.find((c) => c.kind === "from")!;
			const where = clauses.find((c) => c.kind === "where")!;
			expect(Q.slice(from.span.start, from.span.end)).toBe("from {{ ref('raw_a') }}");
			expect(Q.slice(where.span.start, where.span.end)).toBe("where id > 0");
		});

		it("templated FROM with a bare alias: from's span extends through the alias", () => {
			const Q = "select c.id from {{ ref('raw_a') }} c";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from"]);
			const from = clauses.find((c) => c.kind === "from")!;
			expect(Q.slice(from.anchorSpan.start, from.anchorSpan.end)).toBe("from");
			expect(Q.slice(from.span.start, from.span.end)).toBe("from {{ ref('raw_a') }} c");
		});

		it("JOIN with a templated right side: from + join both present", () => {
			const Q = "select id from a join {{ ref('raw_b') }} on a.id = id";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from", "join"]);
			const from = clauses.find((c) => c.kind === "from")!;
			const join = clauses.find((c) => c.kind === "join")!;
			// FROM's own span extends through the trailing join's ON predicate, same as the plain case.
			expect(Q.slice(from.span.start, from.span.end)).toBe(Q.slice(Q.indexOf("from"), Q.length));
			expect(Q.slice(join.anchorSpan.start, join.anchorSpan.end)).toBe("join");
			expect(Q.slice(join.span.start, join.span.end)).toBe("join {{ ref('raw_b') }} on a.id = id");
		});

		it("multiple templated sources, comma-joined: from anchors once on the real keyword", () => {
			const Q = "select id from {{ ref('raw_a') }}, {{ ref('raw_b') }}";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from"]);
			const from = clauses.find((c) => c.kind === "from")!;
			expect(Q.slice(from.anchorSpan.start, from.anchorSpan.end)).toBe("from");
			expect(Q.slice(from.span.start, from.span.end)).toBe("from {{ ref('raw_a') }}, {{ ref('raw_b') }}");
		});

		it("templated + aliased sources on both sides of a JOIN", () => {
			const Q = "select a.id from {{ ref('raw_a') }} a join {{ ref('raw_b') }} b on a.id = b.id";
			const doc = SqlDocument.create(Q, "databricks", dbtOpts());
			const clauses = doc.clausesOf(doc.scopes.root);
			expect(clauses.map((c) => c.kind)).toEqual(["select", "from", "join"]);
			const from = clauses.find((c) => c.kind === "from")!;
			expect(Q.slice(from.span.start, from.span.end)).toBe(Q.slice(Q.indexOf("from"), Q.length));
		});
	});
});

describe("setOpArmsOf", () => {
	it("a 3-branch UNION (left-folded) flattens to 3 arms in source order", () => {
		const Q = "select a from t1 union select a from t2 union select a from t3";
		const doc = SqlDocument.create(Q, "databricks");
		const arms = setOpArmsOf(doc.scopes.root);
		expect(arms).toBeDefined();
		expect(arms!.arms.length).toBe(3);
		expect(Q.slice(arms!.arms[0].span.start, arms!.arms[0].span.end)).toBe("select a from t1");
		expect(Q.slice(arms!.arms[1].span.start, arms!.arms[1].span.end)).toBe("select a from t2");
		expect(Q.slice(arms!.arms[2].span.start, arms!.arms[2].span.end)).toBe("select a from t3");
		expect(Q.slice(arms!.span.start, arms!.span.end)).toBe(Q);
	});

	it("a nested fold: (a UNION b) INTERSECT c still flattens left-to-right", () => {
		const Q = "select a from t1 union select a from t2 intersect select a from t3";
		const doc = SqlDocument.create(Q, "databricks");
		const arms = setOpArmsOf(doc.scopes.root)!;
		// left-associative: (t1 UNION t2) INTERSECT t3. The outer scope IS the intersect, whose left
		// branch is itself a union scope; flattening descends into it rather than stopping one level up.
		expect(arms.arms.length).toBe(3);
		expect(Q.slice(arms.arms[0].span.start, arms.arms[0].span.end)).toBe("select a from t1");
		expect(Q.slice(arms.arms[2].span.start, arms.arms[2].span.end)).toBe("select a from t3");
	});

	it("undefined for a non-setop frame", () => {
		const doc = SqlDocument.create("select a from t", "databricks");
		expect(setOpArmsOf(doc.scopes.root)).toBeUndefined();
	});

	it("SqlDocument.setOpArmsOf shifts spans for a multi-statement document", () => {
		const TWO = "select a from t1; select b from t2a union select b from t2b";
		const doc = SqlDocument.create(TWO, "databricks");
		const secondRoot = doc.cellAt(TWO.indexOf("t2a"))!.scopes.root;
		const arms = doc.setOpArmsOf(secondRoot)!;
		expect(arms.arms.length).toBe(2);
		expect(TWO.slice(arms.arms[0].span.start, arms.arms[0].span.end)).toBe("select b from t2a");
		expect(TWO.slice(arms.arms[1].span.start, arms.arms[1].span.end)).toBe("select b from t2b");
	});

	it("SqlSession.setOpArmsOf is a one-line delegation", () => {
		const Q = "select a from t1 union select a from t2";
		const s = SqlSession.create(Q, "databricks");
		expect(s.setOpArmsOf(s.scopes.root)!.arms.length).toBe(2);
	});
});
