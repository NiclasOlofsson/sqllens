// Statement classification — what kind of SQL statement was lowered. Derived authoritatively by
// each dialect's lower() from the parsed top-level rule (NOT a text heuristic over the source), and
// reported on the lowered IR so the semantic layer reads a real, parse-derived kind. Two views of
// the same fact, so the simple report stays simple while nothing is hidden:
//
//   StatementCategory — the precise category. dcl / tcl / utility / compound stay VISIBLE; they are
//                       never collapsed into an opaque "other".
//   StatementKind     — a coarse rollup (query / dml / ddl / other) for "query vs DML vs DDL vs the
//                       rest" reporting. Here ddl is object DDL only; dcl/tcl/utility/compound → other.

import { ErrorNode, TerminalNode, Token, type ParserRuleContext } from "antlr4ng";

export type StatementCategory =
	| "query" // SELECT / WITH…SELECT / VALUES / TABLE — the read path
	| "dml" // INSERT / UPDATE / DELETE / MERGE / COPY / LOAD — write / data movement
	| "ddl" // CREATE / ALTER / DROP / TRUNCATE — object & schema definition
	| "dcl" // GRANT / REVOKE / DENY — data control / permissions
	| "tcl" // BEGIN / COMMIT / ROLLBACK / SAVEPOINT — transaction control
	| "utility" // SET / USE / SHOW / DESCRIBE / EXPLAIN / CALL / CACHE … — session / admin
	| "compound" // a multi-statement batch or BEGIN…END script
	| "other"; // unrecognized or empty

export type StatementKind = "query" | "dml" | "ddl" | "other";

/** Coarse rollup of a StatementCategory. ddl stays object DDL; dcl/tcl/utility/compound → other. */
export function coarseKind(category: StatementCategory): StatementKind {
	return category === "query" || category === "dml" || category === "ddl" ? category : "other";
}

/**
 * Statements swallowed by error recovery at a batch root. When a statement inside a `;`-separated
 * batch fails to parse, ANTLR's recovery cannot resync at the separator: the remainder of the input
 * — including healthy statements after the break — attaches to the batch root as flat error-node
 * tokens instead of parsed elements. The CST element count then under-reports the batch, so a
 * CST-derived statement kind called a broken batch "query" and statementCategories under-counted
 * (anvil bug report, 2026-07-05). This derives the missing count from the swallowed TOKENS, which
 * are always intact (lexing is total).
 *
 * A swallowed statement = a non-empty `;`-separated group of error-node tokens among the root's
 * DIRECT children that starts at a statement boundary — beginning of input, after a `;`, or after
 * a parsed sibling whose last token is `;`. The boundary condition keeps a single broken
 * statement's trailing garbage (`select a from t t2 t3` — no separator anywhere) from counting as
 * a phantom second statement; strings can never split a group (a string is one token).
 */
export function swallowedStatements(root: ParserRuleContext): number {
	let count = 0;
	let open = false; // an error-token group is open
	let openAtBoundary = false; // …and it opened at a statement boundary
	let boundary = true; // start of input is a boundary
	// A group is a swallowed STATEMENT only when it is `;`-delimited on BOTH sides (or meets an
	// input edge): opened at a boundary AND closed at one. Garbage directly abutting a parsed
	// statement with no separator (`x select * from t`) belongs WITH that statement — one broken
	// unit, not a phantom batch.
	const close = (atBoundaryEnd: boolean) => {
		if (open && openAtBoundary && atBoundaryEnd) count++;
		open = false;
	};
	for (const child of root.children ?? []) {
		if (child instanceof TerminalNode) {
			const token = child.symbol;
			if (token.type === Token.EOF) continue;
			if (token.text === ";") {
				close(true);
				boundary = true;
			} else if (child instanceof ErrorNode) {
				if (!open) {
					open = true;
					openAtBoundary = boundary;
				}
				boundary = false;
			} else {
				// A real (non-error) content token at the root (e.g. a batch separator keyword):
				// grammar structure, not swallowed content — closes any group, opens none.
				close(false);
				boundary = false;
			}
		} else {
			const ctx = child as ParserRuleContext;
			// An empty recovered element (zero tokens — e.g. the empty `stmtblock` recovery leaves
			// at the root when the very first statement is broken) is transparent: it neither
			// closes a group nor moves the boundary.
			if (!ctx.start || !ctx.stop || ctx.start.tokenIndex > ctx.stop.tokenIndex) continue;
			// A parsed element closes any open group — at a boundary only if the element BEGINS
			// with the separator (it consumed the `;` that ends the group, as T-SQL batches do).
			// The next slot is a boundary iff the element consumed its own trailing separator.
			close(ctx.start.text === ";");
			boundary = ctx.stop.text === ";";
		}
	}
	close(true); // end of input is a boundary
	return count;
}

/** The `statementCategories` entries for the swallowed statements — one honest "other" per unit
 *  (their text never parsed, so no finer classification is derivable without a keyword guess). */
export function swallowedCategories(root: ParserRuleContext): StatementCategory[] {
	return new Array<StatementCategory>(swallowedStatements(root)).fill("other");
}

/**
 * Map a single leading statement keyword to a category. This is the fallback only for grammar
 * alternatives that carry no distinguishing rule — object DDL, DCL and utility commands all begin
 * with their verb, so the keyword is the authoritative signal there. It is used only AFTER the
 * structural query / dml / compound cases have already been decided by the dialect.
 */
export function keywordCategory(keyword: string): StatementCategory {
	switch (keyword.toUpperCase()) {
		case "SELECT":
		case "WITH":
		case "VALUES":
		case "TABLE":
		case "FROM":
		case "MAP":
		case "REDUCE":
		case "(":
			return "query";
		case "INSERT":
		case "UPDATE":
		case "DELETE":
		case "MERGE":
		case "UPSERT":
		case "COPY":
		case "LOAD":
		case "UNLOAD":
		case "PUT":
		case "GET":
			return "dml";
		case "CREATE":
		case "ALTER":
		case "DROP":
		case "TRUNCATE":
		case "REPLACE":
		case "RENAME":
		case "COMMENT":
		case "MSCK":
		case "REPAIR":
		case "REFRESH":
		case "ANALYZE":
		case "UNDROP":
		case "OPTIMIZE":
		case "VACUUM":
			return "ddl";
		case "GRANT":
		case "REVOKE":
		case "DENY":
			return "dcl";
		case "BEGIN":
		case "START":
		case "COMMIT":
		case "ROLLBACK":
		case "SAVEPOINT":
			return "tcl";
		case "EXPLAIN": // returns a plan, not the query's rows — utility per the contract above
		case "SET":
		case "RESET":
		case "UNSET":
		case "USE":
		case "SHOW":
		case "DESCRIBE":
		case "DESC":
		case "CALL":
		case "EXECUTE":
		case "EXEC":
		case "CACHE":
		case "UNCACHE":
		case "CLEAR":
		case "LIST":
		case "REMOVE":
		case "ADD":
		case "BACKUP":
		case "RESTORE":
		case "DBCC":
		case "CHECKPOINT":
			return "utility";
		default:
			return "other";
	}
}
