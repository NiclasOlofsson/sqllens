import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { GoogleSQLParser as P } from "../generated/bigquery/GoogleSQLParser.js";
import type { QueryExpr, SelectExpr } from "../ir/ir.js";
import { keywordCategory, type StatementCategory } from "../ir/statement.js";

// ---------------------------------------------------------------------------
// Lowering — BigQuery / GoogleSQL (forked bytebase/parser googlesql/) CST ->
// the shared, dialect-neutral IR (src/ir/ir.ts). The semantic layer runs on
// the IR unchanged; only this file knows GoogleSQL's grammar. A single query
// statement lowers fully; anything else (DDL, DML, multi-statement batches)
// becomes a flagged non-query body — a valid parse never throws.
//
// Statement structure: root -> stmts -> unterminated_sql_statement ->
// sql_statement_body -> one of the *_statement rules. query_statement is the
// only one we lower; the query path is query_statement -> query ->
// query_without_pipe_operators -> query_primary -> select.
// ---------------------------------------------------------------------------

/** Lower a parsed GoogleSQL file (`stmts`: a `;`-separated batch) into the IR. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	if (statement === "query") {
		const q = firstOfRule(tree, P.RULE_query_statement);
		if (q) {
			const lowered = lowerQueryStatement(q);
			lowered.statement = "query";
			return lowered;
		}
	}
	const q = emptyQuery(tree, statement === "other" ? "empty" : "non-query");
	q.statement = statement;
	return q;
}

/**
 * The statement category, from the parse. `stmts` holds one or more
 * `unterminated_sql_statement` nodes, each wrapping one `sql_statement_body`.
 * More than one body is a compound batch; a single body is categorised by its
 * wrapped *_statement rule, falling back to its leading keyword.
 */
function statementCategory(tree: ParserRuleContext): StatementCategory {
	const bodies: ParserRuleContext[] = [];
	for (const s of directChildrenOfRule(tree, P.RULE_stmts)) {
		for (const u of directChildrenOfRule(s, P.RULE_unterminated_sql_statement)) {
			bodies.push(...directChildrenOfRule(u, P.RULE_sql_statement_body));
		}
	}
	if (bodies.length === 0) return "other";
	if (bodies.length > 1) return "compound";
	return bodyCategory(bodies[0]);
}

function bodyCategory(body: ParserRuleContext): StatementCategory {
	// sql_statement_body wraps exactly one *_statement; categorise by which rule, or by the
	// leading keyword as a fallback. query_statement is the only one we lower.
	if (directChildrenOfRule(body, P.RULE_query_statement).length) return "query";
	if (
		directChildrenOfRule(body, P.RULE_dml_statement).length ||
		directChildrenOfRule(body, P.RULE_merge_statement).length
	) {
		return "dml";
	}
	// CREATE/ALTER/DROP/TRUNCATE → ddl, GRANT/REVOKE → dcl, BEGIN/COMMIT/ROLLBACK → tcl,
	// SET/CALL/SHOW/DESCRIBE/EXPORT → utility (EXPORT/IMPORT/etc. fall through to "other").
	return keywordCategory(body.start?.text ?? "");
}

/** query_statement: query. Filled in Task 6; returns the empty body for now. */
function lowerQueryStatement(q: ParserRuleContext): QueryExpr {
	return emptyQuery(q, "non-query");
}

function emptyBody(cst: ParserRuleContext, reason: string): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst };
}

function emptyQuery(cst: ParserRuleContext, reason: string): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst, reason), cst };
}

// --- CST navigation helpers (generic; ported from src/snowflake/lower.ts) --------

function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext) {
			yield child;
			yield* descendants(child);
		}
	}
}

function firstOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (const d of descendants(node)) if (d.ruleIndex === ruleIndex) return d;
	return undefined;
}

function directChildrenOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && child.ruleIndex === ruleIndex) out.push(child);
	}
	return out;
}
