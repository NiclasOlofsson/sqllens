// ---------------------------------------------------------------------------
// Fragment parsing: parse RANGES of a text as an SQL fragment, trying each
// FragmentKind in order until one parses clean. The consumer is the minijinja
// front end (a `{% macro %}` body is whatever gets pasted at the call site: a
// statement, an expression, a FROM-slot source, a CTE list, a select list); the
// statement entry is right for a model file and wrong for most macro bodies.
//
// The text is lexed ONCE (`openFragments`) and every parse cuts its token slice
// from that lex, so the tokens (and every diagnostic they position) stay in the
// text's own coordinates: no remap. A fast SLL+bail probe per kind finds the
// clean reading; when none is clean the kinds are re-run with recovery and the
// reading that got furthest before its first error supplies the diagnostics —
// a heuristic for the broken-input case only (the reading closest to what was
// meant), never a claim: `clean` is false and the region carries no verdict.
// ---------------------------------------------------------------------------

import type { ParserRuleContext, Token as AntlrToken } from "antlr4ng";
import type { Dialect } from "./dialect.js";
import { FRAGMENT_KINDS, type FragmentGrammar, type FragmentKind } from "./fragment-grammar.js";
import type { SyntaxDiagnostic } from "./parse-diagnostics.js";
import { fragmentGrammar as bigquery } from "./bigquery/parse.js";
import { fragmentGrammar as databricks } from "./databricks/parse.js";
import { fragmentGrammar as duckdb } from "./duckdb/parse.js";
import { fragmentGrammar as mysql } from "./mysql/parse.js";
import { fragmentGrammar as postgres } from "./postgres/parse.js";
import { fragmentGrammar as redshift } from "./redshift/parse.js";
import { fragmentGrammar as snowflake } from "./snowflake/parse.js";
import { fragmentGrammar as sqlite } from "./sqlite/parse.js";
import { fragmentGrammar as trino } from "./trino/parse.js";
import { fragmentGrammar as tsql } from "./tsql/parse.js";

export type { FragmentKind } from "./fragment-grammar.js";

const FRAGMENT_GRAMMARS: Record<Dialect, FragmentGrammar> = {
	databricks,
	tsql,
	snowflake,
	bigquery,
	redshift,
	postgres,
	duckdb,
	trino,
	sqlite,
	mysql,
};

/** A half-open [start, end) offset range of the lexed text (a `PartSpan` fits). */
export interface FragmentRange {
	start: number;
	end: number;
}

export interface FragmentResult {
	/** The kind the ranges parsed as; when `clean` is false, the kind that got furthest. */
	kind: FragmentKind;
	/** True when the ranges parsed with zero syntax errors as `kind`. */
	clean: boolean;
	tree: ParserRuleContext;
	/** Positioned in the text's coordinates. Empty when clean. */
	diagnostics: SyntaxDiagnostic[];
}

export interface FragmentSession {
	/**
	 * Parse the tokens inside `ranges` (a token counts when it starts inside one) as a fragment.
	 * Returns undefined when the ranges hold no default-channel token (nothing to parse; no
	 * verdict). Never throws: every attempt runs a recovering parser over a fixed kind list.
	 */
	parse(ranges: readonly FragmentRange[], kinds?: readonly FragmentKind[]): FragmentResult | undefined;
	/** The first kind the ranges parse clean as, or undefined (no token, or no clean reading).
	 *  Probes only (SLL + bail); never a diagnostic. */
	verdict(ranges: readonly FragmentRange[], kinds?: readonly FragmentKind[]): FragmentKind | undefined;
}

/** Lex `text` once with `dialect`'s statement-entry token pipeline; parse ranges of it after. */
export function openFragments(text: string, dialect: Dialect): FragmentSession {
	const grammar = FRAGMENT_GRAMMARS[dialect];
	const lexed = grammar.lex(text);
	const inRanges = (offset: number, ranges: readonly FragmentRange[]): boolean =>
		ranges.some((r) => offset >= r.start && offset < r.end);

	const sliceOf = (ranges: readonly FragmentRange[]): AntlrToken[] | undefined => {
		const slice = lexed.tokens.filter((t) => inRanges(t.start, ranges));
		return slice.some((t) => t.channel === 0) ? slice : undefined;
	};
	// Token-derived diagnostics of a slice (bigquery literal escapes) hold under every reading.
	const lexDiagsOf = (ranges: readonly FragmentRange[]): SyntaxDiagnostic[] =>
		lexed.diagnostics.filter((d) => d.offset !== undefined && inRanges(d.offset, ranges));
	const probe = (slice: AntlrToken[], kinds: readonly FragmentKind[]): FragmentResult | undefined => {
		for (const kind of kinds) {
			const clean = grammar.parse(slice, kind, true);
			if (clean) return { kind, clean: true, tree: clean.tree, diagnostics: [] };
		}
		return undefined;
	};

	return {
		verdict(ranges, kinds = FRAGMENT_KINDS) {
			const slice = sliceOf(ranges);
			if (!slice || lexDiagsOf(ranges).length > 0) return undefined;
			return probe(slice, kinds)?.kind;
		},
		parse(ranges, kinds = FRAGMENT_KINDS) {
			const slice = sliceOf(ranges);
			if (!slice) return undefined;
			const lexDiags = lexDiagsOf(ranges);
			if (lexDiags.length === 0) {
				const clean = probe(slice, kinds);
				if (clean) return clean;
			}

			let best: FragmentResult | undefined;
			let bestAt = -1;
			for (const kind of kinds) {
				const attempt = grammar.parse(slice, kind, false);
				if (!attempt) continue;
				const diagnostics = [...lexDiags, ...attempt.diagnostics];
				if (diagnostics.length === 0) return { kind, clean: true, tree: attempt.tree, diagnostics };
				const at = attempt.diagnostics[0]?.offset ?? Number.MAX_SAFE_INTEGER;
				if (at > bestAt) {
					bestAt = at;
					best = { kind, clean: false, tree: attempt.tree, diagnostics };
				}
			}
			return best;
		},
	};
}
