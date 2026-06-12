// Classify a SQL example by the kind of its first statement, so the docs-corpus gates can
// report and ratchet on the *in-scope* read path (the deliverable) separately from the
// object/platform DDL that is cleared OUT of scope (CLAUDE.md: "what we don't do is regular
// DDL"). Keeping DDL examples in the corpus is useful, but they must not drag the headline
// conformance number, nor gate it.
//
// TEST-SIDE STAND-IN: this is a leading-keyword heuristic for the corpus gates only. Nicke
// is building real statement-kind detection into each dialect + the semantic layer (so it
// won't be a hack); once that lands, the gates should classify via that instead and this
// file can go away.
//
//   query — the in-scope read path: SELECT / WITH / VALUES / TABLE / FROM / EXPLAIN.
//   dml   — write/operational DML: INSERT / UPDATE / DELETE / MERGE / COPY / LOAD
//           (the project's "likely future scope", tracked but not the deliverable).
//   ddl   — everything else: object & platform DDL and admin (CREATE/ALTER/DROP/GRANT/
//           SHOW/USE/SET/OPTIMIZE/…), cleared Out or operational open gaps.

export type SqlKind = "query" | "dml" | "ddl";

const QUERY = /^(SELECT|WITH|VALUES|TABLE|FROM|EXPLAIN|\()/;
const DML = /^(INSERT|UPDATE|DELETE|MERGE|COPY|LOAD)/;

/** The leading statement keyword, after skipping leading comments and a setup `USE …;`. */
function firstKeyword(sql: string): string {
	const lines = sql.split("\n");
	let i = 0;
	for (; i < lines.length; i++) {
		const t = lines[i].trim();
		if (t === "" || t.startsWith("--")) continue;
		break;
	}
	const s = lines
		.slice(i)
		.join("\n")
		.replace(/^\/\*[\s\S]*?\*\//, "") // a leading /* … */ block
		.trim()
		.replace(/^use\s+[^;]+;\s*/i, "") // a leading USE …; (setup, not the example's point)
		.trim();
	const m = s.match(/^[A-Za-z(]+/);
	return (m ? m[0] : "?").toUpperCase();
}

export function classifySql(sql: string): SqlKind {
	const kw = firstKeyword(sql);
	if (QUERY.test(kw)) return "query";
	if (DML.test(kw)) return "dml";
	return "ddl";
}
