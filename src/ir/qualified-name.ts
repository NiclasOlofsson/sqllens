// ---------------------------------------------------------------------------
// QualifiedName — the structured relation/column name the IR carries (issue #38).
//
// Root cause this type exists to fix: LOSS OF INFORMATION AT LOWERING. A dotted name's
// structure (which part is the catalog, which the schema; what was quoted; what identity each
// part folds to) was flattened to string[] at lower time, and every downstream layer re-derived
// it by heuristic — collapsing, in practice, to last-part matching. The two standing principles
// applied to names:
//
//   lossless    — `parts` is exactly what was written (partial qualification represented, never
//                 defaulted; a tsql elided middle part `db..table` is an EXPLICITLY EMPTY part);
//                 `fqn` joins the raw parts as written, quoting included. Nothing re-cased,
//                 nothing invented.
//   never-wrong — roles are assigned only to parts that exist, right-aligned against the
//                 dialect's namespace; a part beyond the dialect's depth gets NO role. `key` is
//                 the folded identity under the dialect's own quoting semantics; consumers
//                 compare keys and never fold or parse dotted strings themselves.
//
// The dialect's lower() builds these (it is the one layer that knows both the CST shape and the
// dialect's namespace); each dialect's config lives next to its fold rule in
// src/<dialect>/fold.ts. This module is dialect-agnostic mechanics only.
// ---------------------------------------------------------------------------

import { displayWith, foldWith, type FoldRule } from "../ident/fold.js";

/** Qualifier roles, normalized across dialects (vendor vocabulary noted per dialect at its
 *  config): "catalog" covers database/project, "schema" covers dataset/attached-database,
 *  "server" is tsql's linked-server level. The object's own name is never a role — it is the
 *  final part, always. */
export type NameRole = "server" | "catalog" | "schema";

/** A dialect's namespace shape: its qualifier roles OUTER→INNER, and the fold/delimiter rule
 *  its identifiers obey. Declared once per dialect in src/<dialect>/fold.ts, doc-cited there. */
export interface QualifiedNameConfig {
	roles: readonly NameRole[];
	rule: FoldRule;
}

/** A structured, dialect-resolved name. Plain frozen data like every IR node. */
export interface QualifiedName {
	/** The object's OWN name (the last part), delimiters stripped, as written. */
	name: string;
	/** Every part as written, outermost first, delimiters stripped. An elided middle part is "". */
	parts: string[];
	/** tsql linked-server level. Absent = not written. */
	server?: string;
	/** Catalog level (vendor: catalog / database / project). Absent = not written. */
	catalog?: string;
	/** Schema level (vendor: schema / dataset / attached database). Absent = not written;
	 *  "" = written-and-elided (`db..table`). */
	schema?: string;
	/** Folded identity parts (the dialect's own quoting-aware fold). COMPARE with these — never
	 *  display them, never re-fold. */
	key: string[];
	/** The qualified name as ONE display-ready string. Source-derived: the raw parts joined as
	 *  written (quoting kept). Synthesized: parts joined with dialect quoting where needed. */
	fqn: string;
}

/** Right-align the dialect's roles onto the qualifier parts (everything before the last part).
 *  Only parts that exist get a role; qualifier parts beyond the dialect's depth get none. */
function assignRoles(q: QualifiedName, stripped: string[], roles: readonly NameRole[]): void {
	const qualifiers = stripped.slice(0, -1);
	const n = Math.min(qualifiers.length, roles.length);
	for (let j = 0; j < n; j++) {
		const role = roles[roles.length - 1 - j]!;
		q[role] = qualifiers[qualifiers.length - 1 - j]!;
	}
}

/**
 * Build a QualifiedName from SOURCE-derived raw parts (as they appear in the text, delimiters
 * intact where the user wrote them). `fqn` preserves the user's spelling and quoting exactly.
 */
export function qualifiedNameOf(rawParts: string[], config: QualifiedNameConfig): QualifiedName {
	const parts = rawParts.map((p) => displayWith(config.rule, p));
	const q: QualifiedName = {
		name: parts[parts.length - 1] ?? "",
		parts,
		key: rawParts.map((p) => foldWith(config.rule, p, "table")),
		fqn: rawParts.join("."),
	};
	assignRoles(q, parts, config.roles);
	return q;
}

/**
 * Build a QualifiedName from SYNTHESIZED plain parts (a provider's resolved relation — no source
 * text exists). `fqn` renders each part with the dialect's quoting exactly where the part needs
 * delimiters to round-trip; plain identifier parts stay bare.
 */
export function synthesizedQualifiedName(parts: string[], config: QualifiedNameConfig): QualifiedName {
	const q: QualifiedName = {
		name: parts[parts.length - 1] ?? "",
		parts: [...parts],
		key: parts.map((p) => foldWith(config.rule, p, "table")),
		fqn: parts.map((p) => renderPart(p, config.rule)).join("."),
	};
	assignRoles(q, parts, config.roles);
	return q;
}

/** True when `part` round-trips as a bare identifier (letters/digits/underscore, non-digit lead).
 *  Anything else needs the dialect's delimiters. Reserved words are a documented boundary: this
 *  renderer does not consult keyword lists. */
const PLAIN_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function renderPart(part: string, rule: FoldRule): string {
	if (PLAIN_IDENT.test(part)) return part;
	const [open, close] = rule.delimiters[0] ?? ['"', '"'];
	const body =
		rule.escapeStyle === "backslash" ? part.split(close).join(`\\${close}`) : part.split(close).join(close + close);
	return `${open}${body}${close}`;
}
