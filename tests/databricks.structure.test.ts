import { CharStream, CommonTokenStream, ParserRuleContext, type ParseTree } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";

// These tests prove the parser actually *understands* SQL — it extracts structure (projected
// columns, tables, joins, clauses), not merely "parses without error". With Spark's permissive
// non-reserved keywords, zero syntax errors alone is a weak signal; the assertions below read
// information back out of the parse tree to show the structure is genuinely recognized.

const P = DatabricksParser;

function parse(sql: string): { tree: ParseTree; errors: number } {
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const parser = new DatabricksParser(new CommonTokenStream(lexer));
	let errors = 0;
	const listener = {
		syntaxError() {
			errors++;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
	return { tree: parser.singleStatement(), errors };
}

// Walk the typed parse tree and collect every node produced by a given parser rule.
function nodesOfRule(node: ParseTree, ruleIndex: number, acc: ParserRuleContext[] = []) {
	if (node instanceof ParserRuleContext && node.ruleIndex === ruleIndex) acc.push(node);
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child) nodesOfRule(child, ruleIndex, acc);
	}
	return acc;
}

// Pull the bits a consumer would care about straight out of the tree. getText() concatenates
// token text with no separators, so "a as b" reads back as "aasb" — fine for counting/identity.
function summarize(sql: string) {
	const { tree, errors } = parse(sql);
	const selectClause = nodesOfRule(tree, P.RULE_selectClause)[0];
	return {
		errors,
		// One entry per projected expression in the SELECT list.
		projections: selectClause ? nodesOfRule(selectClause, P.RULE_namedExpression).map((n) => n.getText()) : [],
		// The relation name behind each FROM/JOIN relationPrimary (not column refs in predicates).
		tables: nodesOfRule(tree, P.RULE_relationPrimary)
			.map((rp) => nodesOfRule(rp, P.RULE_multipartIdentifier)[0]?.getText())
			.filter((t): t is string => Boolean(t)),
		hasFrom: nodesOfRule(tree, P.RULE_fromClause).length > 0,
		hasWhere: nodesOfRule(tree, P.RULE_whereClause).length > 0,
		joins: nodesOfRule(tree, P.RULE_joinRelation).length,
	};
}

describe("databricks parse-tree extraction", () => {
	it("separates the projection list, table, and WHERE of a SELECT", () => {
		const s = summarize("SELECT a, b, c FROM t WHERE a > 1");
		expect(s.errors).toBe(0);
		expect(s.projections).toEqual(["a", "b", "c"]); // three distinct projected columns
		expect(s.tables).toEqual(["t"]);
		expect(s.hasFrom).toBe(true);
		expect(s.hasWhere).toBe(true);
		expect(s.joins).toBe(0);
	});

	it("recognizes a JOIN and both joined relations", () => {
		const s = summarize("SELECT x FROM a JOIN b ON a.id = b.id");
		expect(s.errors).toBe(0);
		expect(s.joins).toBe(1);
		expect(s.tables).toEqual(["a", "b"]); // a.id / b.id in the ON are NOT mistaken for tables
		expect(s.projections).toEqual(["x"]);
	});

	it("reads a backtick-quoted 3-part identifier as one table (Oatly style)", () => {
		const s = summarize("SELECT col FROM `cat`.`sch`.`tbl`");
		expect(s.errors).toBe(0);
		expect(s.tables).toEqual(["`cat`.`sch`.`tbl`"]);
		expect(s.projections).toEqual(["col"]);
	});

	it("extracts structure from a real Oatly-shaped query", () => {
		const s = summarize(
			"select distinct planningtypeperiodmonth as `Forecast Version` " +
				"from `hive_metastore`.`s`.`t` where x <> '(b)'",
		);
		expect(s.errors).toBe(0);
		expect(s.projections).toHaveLength(1);
		expect(s.tables).toEqual(["`hive_metastore`.`s`.`t`"]);
		expect(s.hasWhere).toBe(true);
	});

	it("treats non-reserved FROM/WHERE as a column, not as clauses (permissiveness is structural)", () => {
		// In Spark's default (non-ANSI) mode FROM/WHERE are non-reserved, so "SELECT FROM WHERE" is
		// valid: a column named `from` aliased `where`. The proof that the parser understands this
		// rather than blindly accepting anything: it yields exactly one projection and NO from/where
		// clauses — structurally different from a real SELECT ... FROM ... WHERE.
		const permissive = summarize("SELECT FROM WHERE");
		expect(permissive.errors).toBe(0);
		expect(permissive.projections).toHaveLength(1);
		expect(permissive.hasFrom).toBe(false);
		expect(permissive.hasWhere).toBe(false);
		expect(permissive.tables).toEqual([]);

		// Contrast: a genuine FROM clause IS recognized as one.
		const real = summarize("SELECT col FROM t WHERE col > 0");
		expect(real.hasFrom).toBe(true);
		expect(real.hasWhere).toBe(true);
		expect(real.tables).toEqual(["t"]);
	});
});

describe("databricks — qualified named-argument key (GAP 1)", () => {
	it("accepts a dotted key in a table function's named argument", () => {
		// docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document: the corpus
		// repro (functions/ai_parse_document/6.sql) calls read_files with `databricks.connection => ...`.
		const { errors } = parse("SELECT * FROM read_files('u', databricks.connection => 'x')");
		expect(errors).toBe(0);
	});

	it("still accepts a plain unqualified named-argument key", () => {
		const { errors } = parse("SELECT * FROM read_files('u', format => 'csv')");
		expect(errors).toBe(0);
	});
});

describe("databricks — USE CATALOG (GAP 2)", () => {
	// docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-use-catalog:
	// `{ USE | SET } CATALOG [ catalog_name | 'catalog_name' ]`
	it.each([
		["bare identifier", "USE CATALOG hive_metastore"],
		["string literal", "USE CATALOG 'hive_metastore'"],
		["IDENTIFIER(expr)", "USE CATALOG IDENTIFIER(mycat)"],
		["backtick-quoted identifier", "USE CATALOG `some_catalog`"],
	])("parses USE CATALOG with a %s", (_name, sql) => {
		const { errors } = parse(sql);
		expect(errors).toBe(0);
	});

	it("still parses the sibling USE DATABASE/SCHEMA/NAMESPACE forms", () => {
		expect(parse("USE DATABASE main.my_db").errors).toBe(0);
		expect(parse("USE SCHEMA s").errors).toBe(0);
	});
});
