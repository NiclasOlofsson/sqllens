// Statement classification — what kind of SQL statement was lowered. Derived authoritatively by
// each dialect's lower() from the parsed top-level rule (NOT a text heuristic over the source), and
// reported on the lowered IR so the semantic layer reads a real, parse-derived kind. Two views of
// the same fact, so the simple report stays simple while nothing is hidden:
//
//   StatementCategory — the precise category. dcl / tcl / utility / compound stay VISIBLE; they are
//                       never collapsed into an opaque "other".
//   StatementKind     — a coarse rollup (query / dml / ddl / other) for "query vs DML vs DDL vs the
//                       rest" reporting. Here ddl is object DDL only; dcl/tcl/utility/compound → other.

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
		case "EXPLAIN":
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
