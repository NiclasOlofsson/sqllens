import { describe, expect, it } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";

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
		expect(
			errorsOf("SELECT attr, val FROM customer_orders_lineitem c, UNPIVOT c.c_orders[0] AS val AT attr"),
		).toBe(0);
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
		expect(errorsOf("select nth_value(venueseats, 3) ignore nulls over (order by venueseats desc) from venue")).toBe(
			0,
		);
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
		expect(errorsOf("SELECT up.product, up.idx FROM orders o, UNNEST(o.products) WITH OFFSET AS up(product, idx)")).toBe(
			0,
		);
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
});
