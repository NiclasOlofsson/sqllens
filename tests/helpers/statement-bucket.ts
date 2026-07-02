import type { StatementCategory } from "../../src/ir/statement.js";

// The one bucket rule shared by the corpus ORGANIZER (tools/organize-corpus.test.ts, which lays
// each file under parser/positive/<bucket>/…) and the docs-corpus GATES (tests/helpers/docs-ratchet.ts,
// which reads the bucket back off the path). Keeping it in one place is what lets the gates trust the
// paths: a file is bucketed by exactly the rule the organizer used to place it.
//
//   query — the in-scope read path (the deliverable): SELECT / WITH / VALUES / TABLE / …
//   dml   — write/operational DML: INSERT / UPDATE / DELETE / MERGE / COPY / LOAD (likely future scope)
//   ddl   — everything else: object & platform DDL, DCL, TCL, admin utilities, compounds (cleared Out
//           or operational open gaps) — reported, never gated.

export type SqlKind = "query" | "dml" | "ddl";

/** Bucket a parsed file by its per-statement kinds: the first substantive statement decides —
 *  utility/tcl/other are setup/preamble (USE, SET, DECLARE, BEGIN TRAN, …); query/dml win as
 *  themselves; ddl/dcl and BEGIN…END compounds land in the ddl (everything-else) bucket. A file
 *  with no substantive statement (pure setup, or empty) is ddl. */
export function bucketOfKinds(kinds: StatementCategory[]): SqlKind {
	for (const k of kinds) {
		if (k === "query") return "query";
		if (k === "dml") return "dml";
		if (k === "ddl" || k === "dcl" || k === "compound") return "ddl";
	}
	return "ddl";
}
