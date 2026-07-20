import { describe, expect, it } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower } from "../src/redshift/lower.js";

// Redshift is the fifth dialect: grammar forked from bytebase/parser redshift/ (a PostgreSQL-
// grammar fork focused on Redshift), the Go superClass bases ported inline to antlr4ng @members.
// These smoke tests pin that the generated parser actually loads and recognizes the canonical
// query surface with zero syntax errors before the corpus gates and lower() are wired.

function errorsOf(sql: string): number {
	return parseRedshift(sql).errors;
}

describe("Redshift parser — canonical statements parse with zero errors", () => {
	it("SELECT with JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT", () => {
		expect(
			errorsOf(
				`SELECT c.name, sum(o.total) AS revenue
				 FROM customers c JOIN orders o ON o.customer_id = c.id
				 WHERE o.status = 'paid'
				 GROUP BY c.name
				 HAVING sum(o.total) > 100
				 ORDER BY revenue DESC
				 LIMIT 10`,
			),
		).toBe(0);
	});

	it("CTE (WITH)", () => {
		expect(
			errorsOf(`WITH recent AS (SELECT id FROM events WHERE ts > '2020-01-01')
			          SELECT count(*) FROM recent`),
		).toBe(0);
	});

	it("UNION ALL", () => {
		expect(errorsOf("SELECT 1 AS n UNION ALL SELECT 2")).toBe(0);
	});

	it("window function", () => {
		expect(errorsOf("SELECT id, row_number() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn FROM emp")).toBe(
			0,
		);
	});

	it(":: cast and Postgres-style operators", () => {
		expect(errorsOf("SELECT '2020-01-01'::date, 5 % 2, 'a' || 'b'")).toBe(0);
	});

	it("INSERT … SELECT", () => {
		expect(errorsOf("INSERT INTO archive (id, total) SELECT id, total FROM orders WHERE status = 'closed'")).toBe(
			0,
		);
	});

	it("CREATE TABLE with DISTKEY/SORTKEY/ENCODE (Redshift-specific)", () => {
		expect(
			errorsOf(
				`CREATE TABLE sales (
					salesid integer not null,
					dateid smallint not null encode mostly16,
					pricepaid decimal(8,2) encode delta
				) DISTKEY(salesid) SORTKEY(dateid)`,
			),
		).toBe(0);
	});

	it("CREATE TABLE … DISTSTYLE", () => {
		expect(errorsOf("CREATE TABLE t (a int) DISTSTYLE ALL")).toBe(0);
	});

	it("late-binding view (WITH NO SCHEMA BINDING)", () => {
		expect(errorsOf("CREATE VIEW v AS SELECT a FROM t WITH NO SCHEMA BINDING")).toBe(0);
	});

	it("flags a genuine syntax error", () => {
		expect(errorsOf("SELECT FROM WHERE")).toBeGreaterThan(0);
	});
});

// Redshift-specific constructs cleaned from the scraped docs corpus (TDD: each was a corpus
// failure before its grammar fix). Self-contained so they hold even when the corpus is absent.
describe("Redshift-specific constructs", () => {
	it("VARBYTE cast without a length", () => {
		expect(errorsOf("SELECT 'a'::VARBYTE < 'b'::VARBYTE AS lt")).toBe(0);
		expect(errorsOf("SELECT LEN(CAST('x' AS VARBYTE))")).toBe(0);
	});

	it("TRY_CAST", () => {
		expect(errorsOf("SELECT TRY_CAST('123' AS INT)")).toBe(0);
	});

	it("# temp-table reference", () => {
		expect(errorsOf("SELECT * FROM #venuetemp ORDER BY venueid")).toBe(0);
	});

	it("SELECT * EXCLUDE (bare and parenthesized)", () => {
		expect(errorsOf("SELECT * EXCLUDE col1, col2 FROM tablea")).toBe(0);
		expect(errorsOf("SELECT * EXCLUDE (col1, col2) FROM tablea")).toBe(0);
	});

	it("SELECT TOP n DISTINCT", () => {
		expect(errorsOf("SELECT TOP 10 DISTINCT sellerid, qtysold FROM sales")).toBe(0);
	});

	it("CONNECT BY with trailing START WITH", () => {
		expect(
			errorsOf(`SELECT COUNT(*) FROM Employee CONNECT BY PRIOR id = manager_id START WITH name = 'John'`),
		).toBe(0);
	});

	it("PIVOT", () => {
		expect(errorsOf("SELECT * FROM sales PIVOT (sum(qty) FOR region IN ('A', 'B', 'C'))")).toBe(0);
	});

	it("UNPIVOT", () => {
		expect(
			errorsOf(
				"SELECT * FROM (SELECT red, green, blue FROM count_by_color) UNPIVOT (cnt FOR color IN (red, green, blue))",
			),
		).toBe(0);
	});

	it("DISTKEY/SORTKEY usable as column identifiers", () => {
		expect(errorsOf(`SELECT "column", type, encoding, distkey, sortkey FROM pg_table_def`)).toBe(0);
	});

	// ITEMS is borrowed for COLLECTION ITEMS TERMINATED BY (external-table ROW FORMAT DELIMITED), but
	// isn't in r_pg_keywords.html, so it must stay usable as an ordinary identifier/attribute name.
	it("ITEMS usable as a column identifier and as a SUPER dotted-path attribute name", () => {
		expect(errorsOf("SELECT items FROM t")).toBe(0);
		expect(errorsOf("SELECT a.items FROM t")).toBe(0);
	});
});

// Round 2: every remaining in-scope query-corpus construct that the grammar rejected, each
// verified against the AWS SQL reference (RTFM, not guessed). TDD: written failing, then the
// grammar was extended to green. The full docs corpus then gates these at 100% (no-other policy).
describe("Redshift constructs (round 2, doc-verified)", () => {
	it("Oracle-style (+) outer join in WHERE (both sides, with arithmetic)", () => {
		// r_WHERE_oracle_outer.html — table.column(+) marks the outer side.
		expect(errorsOf("select count(*) from event a, event b where a.eventid(+)=b.catid")).toBe(0);
		expect(errorsOf("select count(*) from sales, listing where sales.listid = listing.listid(+)")).toBe(0);
		expect(errorsOf("select count(*) from event, category where event.eventid(+)*10=category.catid")).toBe(0);
		expect(
			errorsOf("select catname from category, event where category.catid=event.catid(+) and eventid(+)=796"),
		).toBe(0);
	});

	it("catalog three-part path database@namespace.schema.table", () => {
		// iceberg-integration-querying.html / federated querying.
		expect(errorsOf("SELECT * FROM b@a.c.d")).toBe(0);
		expect(errorsOf("SELECT price FROM sales_db@mynamespace.sales_schema.inventory_table")).toBe(0);
		expect(errorsOf("SELECT * FROM my_database@my_namespace.sales.transactions WHERE x >= '2024-01-01'")).toBe(0);
	});

	it("SUPER array unnest with AT index alias (x AS y AT z)", () => {
		// query-super.html#unnest — "x AS y AT z iterates over array x and generates the field z".
		expect(
			errorsOf("SELECT index FROM customer_orders_lineitem c, c.c_orders AS orders AT index ORDER BY index"),
		).toBe(0);
		expect(errorsOf("SELECT label FROM churn p, p.prediction.labels AS label AT index")).toBe(0);
	});

	it("SUPER object UNPIVOT in FROM (UNPIVOT expr AS val AT attr)", () => {
		// query-super.html#unpivoting — "UNPIVOT expression AS value_alias [ AT attribute_alias ]".
		expect(errorsOf("SELECT attr, val FROM customer_orders_lineitem c, UNPIVOT c.c_orders[0] AS val AT attr")).toBe(
			0,
		);
		expect(
			errorsOf("SELECT attr, val FROM customer_orders_lineitem c, c.c_orders AS o, UNPIVOT o AS val AT attr"),
		).toBe(0);
	});

	it("IGNORE NULLS / RESPECT NULLS on window functions", () => {
		// r_WF_FIRST_VALUE.html / r_WF_NTH_VALUE.html.
		expect(
			errorsOf(
				"select first_value(venuename) ignore nulls over (partition by venuestate order by venueseats desc rows between unbounded preceding and unbounded following) from venue",
			),
		).toBe(0);
		expect(
			errorsOf("select nth_value(venueseats, 3) ignore nulls over (order by venueseats desc) from venue"),
		).toBe(0);
		expect(errorsOf("select last_value(x) respect nulls over (order by y) from t")).toBe(0);
	});

	it("APPROXIMATE PERCENTILE_DISC and APPROXIMATE COUNT(DISTINCT …)", () => {
		// r_APPROXIMATE_PERCENTILE_DISC.html.
		expect(
			errorsOf("select approximate percentile_disc(0.5) within group (order by totalprice) from listing"),
		).toBe(0);
		expect(errorsOf("select approximate count(distinct pricepaid) from sales")).toBe(0);
	});

	it("UNNEST(array) WITH OFFSET AS alias(col[, idx])", () => {
		// r_FROM_clause-unnest-examples.html.
		expect(errorsOf("SELECT up.product FROM orders o, UNNEST(o.products) WITH OFFSET AS up(product)")).toBe(0);
		expect(
			errorsOf("SELECT up.product, up.idx FROM orders o, UNNEST(o.products) WITH OFFSET AS up(product, idx)"),
		).toBe(0);
	});

	it("FILE / QUOTA / DISTSTYLE usable as column identifiers (non-reserved)", () => {
		// System-table column names; none are in r_pg_keywords.html.
		expect(errorsOf("select query, trim(filename) as file from stl_load_commits")).toBe(0);
		expect(errorsOf("SELECT quota, disk_usage FROM svv_schema_quota_state")).toBe(0);
		expect(errorsOf('select "table", encoded, diststyle, sortkey1 from svv_table_info')).toBe(0);
	});

	it("GROUP BY ALL (the corrected r_GROUP_BY_clause example)", () => {
		// r_GROUP_BY_clause.html — GROUP BY ALL; the doc's own example has a typo (missing comma).
		expect(errorsOf("SELECT col1, col2, sum(col3) FROM testtable GROUP BY ALL")).toBe(0);
	});

	// GAP 2, deep dotted column references over SUPER. The repro boundary (verified with
	// temp_auto/redshift-probe.mjs before the fix) is NOT depth: arbitrary-depth dotted refs already
	// parsed (a.b.c.d.e, 5 parts). The real cause was ITEMS being a lexer token used only inside
	// COLLECTION ITEMS TERMINATED BY and never folded into any nonreserved-word class, so it couldn't
	// be used as an identifier or attr_name anywhere, even at depth 1 (SELECT a.items FROM t alone
	// failed). Fixed by classifying ITEMS into unreserved_keyword (see the "ITEMS usable as a column
	// identifier" test above); this is the exact corpus repro.
	it("SUPER dotted path through a mixed-case, keyword-colliding attribute name (super-configurations/2.sql)", () => {
		// super-configurations.html#upper-mixed-case
		expect(
			errorsOf(
				`SELECT json_table.data.ITEMS.Name, json_table.data.price
				 FROM (SELECT json_parse('{"ITEMS":{"Name":"TV"}, "price": 345}') AS data) AS json_table`,
			),
		).toBe(0);
	});

	it("arbitrary-depth dotted column references (unaffected by the ITEMS fix, already worked)", () => {
		expect(errorsOf("SELECT a.b.c.d.e FROM t")).toBe(0);
		expect(errorsOf("SELECT 1 FROM t WHERE a.b.c.d = 1")).toBe(0);
	});

	// GAP 1, OBJECT_TRANSFORM's KEEP/SET argument mini-grammar (r_object_transform_function.html).
	it("OBJECT_TRANSFORM with KEEP and SET clauses (the docs example)", () => {
		expect(
			errorsOf(
				`SELECT OBJECT_TRANSFORM(
					col_person
					KEEP
						'"name"."first"',
						'"age"',
						'"company"',
						'"country"'
					SET
						'"name"."first"', UPPER(col_person.name.first::TEXT),
						'"age"', col_person.age + 5,
						'"company"', 'Amazon'
				) AS col_person_transformed
				FROM employees`,
			),
		).toBe(0);
		// Each clause is independently optional.
		expect(errorsOf(`SELECT OBJECT_TRANSFORM(col_person) FROM employees`)).toBe(0);
		expect(errorsOf(`SELECT OBJECT_TRANSFORM(col_person KEEP '"a"') FROM employees`)).toBe(0);
		expect(errorsOf(`SELECT OBJECT_TRANSFORM(col_person SET '"a"', 1) FROM employees`)).toBe(0);
	});

	// GAP 3, Spectrum nested-data unnest join: a comma-joined FROM list where a LATER comma item
	// carries a bare ON (no JOIN keyword), per nested-data-use-cases.html, "Joining Amazon Redshift and
	// nested data" (the exact corpus repro, nested-data-use-cases/7.sql).
	it("comma-joined FROM list with a trailing bare ON (nested-data-use-cases/7.sql)", () => {
		expect(
			errorsOf(
				`SELECT c.name.given, c.name.family, COUNT(o.date) AS ordercount, SUM(p.price) AS ordersum
				 FROM spectrum.customers2 c, c.orders o, prices p ON o.item = p.id
				 GROUP BY c.id, c.name.given, c.name.family`,
			),
		).toBe(0);
	});
});

// TIGHTEN: the SELECT list is mandatory (docs.aws.amazon.com/redshift/latest/dg/r_SELECT_list.html:
// `* | expression [, ...]`, not bracketed as optional). A bare SELECT / SELECT ALL / SELECT FROM t
// with no list was a ledgered leniency (CLAUDE.md Known shortcuts); removed for Redshift. SELECT INTO
// is the one documented exception (r_SELECT_INTO.html: its list is optional) and must keep parsing.
describe("Redshift TIGHTEN: the SELECT list is mandatory outside SELECT INTO", () => {
	it("rejects a SELECT with no list", () => {
		expect(errorsOf("SELECT")).toBeGreaterThan(0);
		expect(errorsOf("SELECT ALL")).toBeGreaterThan(0);
		expect(errorsOf("SELECT FROM t")).toBeGreaterThan(0);
		expect(errorsOf("SELECT ALL FROM t")).toBeGreaterThan(0);
	});

	it("SELECT INTO with no list still parses (the documented exception)", () => {
		expect(errorsOf("SELECT INTO foo FROM t")).toBe(0);
		expect(errorsOf("SELECT ALL INTO foo FROM t")).toBe(0);
	});

	it("an ordinary SELECT with a list is unaffected", () => {
		expect(errorsOf("SELECT a FROM t")).toBe(0);
		expect(errorsOf("SELECT * FROM t")).toBe(0);
		expect(errorsOf("SELECT a INTO foo FROM t")).toBe(0);
	});
});

// SLL-surgery wave (task-6-report.md). Redshift's c_expr listed columnref above func_expr, so every
// `f(args)` mispredicted a bare column and bailed to full LL. Ordering func_expr above columnref makes
// SLL resolve calls locally: columnref never full-matches a call (indirection_el is DOT/`[`-led, never
// `(` — the sole paren columnref carries is the Oracle `(+)` marker), so the two are disjoint on a full
// match and the reorder changes no accepted string. These probes pin parse-clean + sllFallback===false,
// and — the mandatory reading guard (Task-5 review) — the exact lowered IR of aliased dotted calls,
// which must NOT flip (redshift has no `.attr(args)` method form, so the duckdb failure mode is absent).
describe("Redshift SLL-surgery — c_expr func_expr above columnref", () => {
	function parsed(sql: string) {
		const r = parseRedshift(sql);
		expect(r.errors, `parse errors for: ${sql}`).toBe(0);
		return r;
	}
	function proj(sql: string) {
		const body = lower(parsed(sql).tree).body;
		if (body.kind !== "select") throw new Error("expected select");
		return body.projections[0].expr;
	}

	it("plain function calls resolve under SLL (no fallback)", () => {
		for (const sql of [
			"SELECT f(a) FROM t",
			"SELECT f(1) FROM t",
			"SELECT st_geomfromtext('POINT(1 2)')",
			"SELECT convert_timezone('GMT', 'PST', ts) FROM t",
			"SELECT abs(-1)",
		]) {
			const r = parsed(sql);
			expect(r.sllFallback, `expected SLL-resolved: ${sql}`).toBe(false);
		}
	});

	it("reading guard — aliased dotted calls keep their exact IR (receiver-as-name, not flipped)", () => {
		// Pre-surgery baseline: a dotted call takes its LAST name part as the function name and drops the
		// qualifier. The reorder must preserve this exactly (proven byte-identical by the corpus IR hash).
		expect(proj("SELECT sch.f(a) AS x FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [{ kind: "column", parts: ["a"] }],
		});
		expect(proj("SELECT sch.f(a) x FROM t")).toMatchObject({ kind: "function", name: "f" });
		expect(proj("SELECT a.b.f(x) AS y FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [{ kind: "column", parts: ["x"] }],
		});
		// bare dotted column stays a column (func_expr needs the `(`).
		expect(proj("SELECT x.y.z FROM t")).toMatchObject({ kind: "column", parts: ["x", "y", "z"] });
	});

	it("pinned more-faithful fix — CURRENT_USER lowers to the niladic function, not a phantom column", () => {
		// r_CURRENT_USER.html: CURRENT_USER is a special value/function returning the current user, NOT a
		// column. Pre-surgery, columnref (above func_expr) intercepted it and produced a phantom column
		// named "current_user"; the reorder routes it through func_expr_common_subexpr (the correct form).
		// 3 corpus files changed IR here (datashare-views/4,5; r_CURRENT_USER/1) — a pinned bug fix.
		expect(proj("SELECT current_user")).toMatchObject({ kind: "function", name: "current_user", args: [] });
		expect(proj("SELECT user")).toMatchObject({ kind: "function", name: "user" });
	});

	it("the redshift-specific (+) outer-join marker still rides columnref (not a call)", () => {
		const r = parsed("SELECT count(*) FROM a, b WHERE a.id(+) = b.id");
		expect(r.errors).toBe(0);
	});

	it("rejects malformed calls (no widening from the reorder)", () => {
		expect(errorsOf("SELECT f(")).toBeGreaterThan(0);
		expect(errorsOf("SELECT f(,)")).toBeGreaterThan(0);
	});
});

// SLL-surgery wave, iteration 2. The identifier-led aexprconst forms (`type '…'` typed literals,
// `func_name '(' args ')' sconst`, INTERVAL) all REQUIRE a concrete trailing sconst, so a bare call or
// column can never full-match aexprconst — disjoint on a full match. Ordering aexprconst above
// func_expr/columnref makes SLL resolve typed literals locally without bailing to LL. Proven
// reading-neutral by the corpus IR hash diff (byte-identical bar the 3 already-pinned current_user files).
describe("Redshift SLL-surgery — c_expr aexprconst above func_expr/columnref", () => {
	function noFallback(sql: string) {
		const r = parseRedshift(sql);
		expect(r.errors, `parse errors for: ${sql}`).toBe(0);
		expect(r.sllFallback, `expected SLL-resolved: ${sql}`).toBe(false);
		return r;
	}
	function proj(sql: string) {
		const body = lower(parseRedshift(sql).tree).body;
		if (body.kind !== "select") throw new Error("expected select");
		return body.projections[0].expr;
	}

	it("typed literals resolve under SLL (no fallback) and lower to literals", () => {
		for (const sql of [
			"SELECT DATE '2008-01-01'",
			"SELECT TIMESTAMP '2001-02-16 20:38:40'",
			"SELECT TIME '13:24:55 PST'",
			"SELECT INTERVAL '1' DAY",
		]) {
			noFallback(sql);
			expect(proj(sql).kind).toBe("literal");
		}
	});

	it("a plain call and a typed literal stay distinct (trailing sconst is the discriminator)", () => {
		expect(proj("SELECT f(1) FROM t")).toMatchObject({ kind: "function", name: "f" });
		// `f(1) '5'` is the func_name '(' args ')' sconst aexprconst form — a literal, not a call.
		expect(proj("SELECT f(1) '5'")).toMatchObject({ kind: "literal" });
	});

	it("rejects the typed-literal-with-STAR non-form (no widening)", () => {
		expect(errorsOf("SELECT count(*) '5'")).toBeGreaterThan(0);
	});
});

// SLL-surgery wave, iteration 3. simple_select_pramary's select-list was three overlapping branches
// (`opt_all_clause? into_clause? opt_target_list?` | `opt_top_clause? distinct_clause? into_clause?
// target_list` | `distinct_clause target_list`): branch 3 was a strict subset of branch 2, and branches
// 1/2 overlapped on every plain `SELECT list`, so ANTLR ran a deep full-LL prediction (maxLook 66) on
// EVERY select — the top prediction-cost sink (68.5% of profiled time). Left-factored into two disjoint
// alternatives — one ending in a REQUIRED target_list (any quantifier), one with NO target (only ALL /
// nothing may precede an empty list) — decided locally by whether a target follows (maxLook 66 → 1).
// Accepts exactly the same strings (proven by the corpus gate at 1808/1808 and the IR hash diff); lower
// reads target_list via firstShallow, so the IR is byte-identical.
describe("Redshift SLL-surgery — simple_select_pramary select-list left-factor", () => {
	function noFallback(sql: string) {
		const r = parseRedshift(sql);
		expect(r.errors, `parse errors for: ${sql}`).toBe(0);
		expect(r.sllFallback, `expected SLL-resolved: ${sql}`).toBe(false);
	}

	it("every SELECT quantifier form parses under SLL (no fallback)", () => {
		for (const sql of [
			"SELECT a, b FROM t",
			"SELECT ALL a FROM t",
			"SELECT TOP 5 a FROM t",
			"SELECT DISTINCT a FROM t",
			"SELECT TOP 5 DISTINCT a FROM t",
			"SELECT DISTINCT ON (a) a, b FROM t",
			"SELECT * FROM t",
		]) {
			noFallback(sql);
		}
	});

	it("empty-target forms (INTO / ALL INTO) still parse — no narrowing", () => {
		expect(errorsOf("SELECT INTO foo FROM t")).toBe(0);
		expect(errorsOf("SELECT ALL INTO foo FROM t")).toBe(0);
		expect(errorsOf("SELECT a INTO foo FROM t")).toBe(0);
	});

	it("TOP / DISTINCT still require a target list — no widening", () => {
		// The former grammar rejected these (branch 2 required target_list; branch 1 barred TOP/DISTINCT).
		expect(errorsOf("SELECT TOP 5 FROM t")).toBeGreaterThan(0);
		expect(errorsOf("SELECT DISTINCT FROM t")).toBeGreaterThan(0);
		expect(errorsOf("SELECT TOP 5 DISTINCT FROM t")).toBeGreaterThan(0);
	});
});
