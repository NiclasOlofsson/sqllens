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
		expect(
			errorsOf("SELECT id, row_number() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn FROM emp"),
		).toBe(0);
	});

	it(":: cast and Postgres-style operators", () => {
		expect(errorsOf("SELECT '2020-01-01'::date, 5 % 2, 'a' || 'b'")).toBe(0);
	});

	it("INSERT … SELECT", () => {
		expect(errorsOf("INSERT INTO archive (id, total) SELECT id, total FROM orders WHERE status = 'closed'")).toBe(0);
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
