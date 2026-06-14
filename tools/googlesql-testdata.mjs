// Shared extraction + classification for ZetaSQL `.test` golden files, used by both the analyzer
// corpus extractor (extract-googlesql-tests.mjs) and the parser corpus extractor
// (extract-googlesql-parser-tests.mjs). Keeping the logic here avoids the two drifting apart — they
// must grade alternations and classify errors identically.
//
// A `.test` file is `==`-separated blocks; in each block the query precedes `\n--`, the expected
// result follows. `{{a|b}}` alternations expand combinatorially and are classified per variant by
// reconstructing each cell's ALTERNATION GROUP label.

export function blocks(text) {
	return text.split(/^==$/m); // top-level test separator
}

// A `[options…]` directive line: `[` then a lowercase keyword then `=`, a space, or `]`
// (`[language_features=…]`, `[default …]`, `[mode=…]`, `[reserve_graph_table]`). This deliberately
// does NOT match a SQL array constructor on its own line (`[1,2,3]`, `[1, e]`, `[col, x]`), which
// starts with a digit/expression — those must survive into the query (lambda/array cases).
const DIRECTIVE_LINE = /^\s*\[[a-z][a-z0-9_]*\s*[=\] ]/;

export function cleanQuery(raw) {
	// Drop directive lines and `#` comment lines; keep the SQL. The .test format escapes an INPUT line
	// that itself begins with `--` or `==` (which would collide with the input/expected `--` and block
	// `==` separators) by prefixing a backslash; unescape those so the real comment line is recovered
	// (`\--comment` → `--comment`).
	return raw
		.split("\n")
		// A directive line may itself carry an alternation (`[{{|no_}}qualify_reserved]`); test with the
		// `{{…}}` removed so it's still recognized as a directive (and not mistaken for an array).
		.filter((l) => !DIRECTIVE_LINE.test(l.replace(/\{\{[^}]*\}\}/g, "")) && !/^\s*#/.test(l))
		.map((l) => l.replace(/^\\(--|==)/, "$1"))
		.join("\n")
		.trim();
}

export const defaultModeOf = (text) => text.match(/^\[default mode=([a-z_]+)\]/m)?.[1] ?? "statement";
export const blockModeOverride = (querySection) => querySection.match(/^\s*\[mode=([a-z_]+)\]/m)?.[1];
export const fileDefaultDir = (text) => text.match(/^\[default language_features=([^\]]*)\]/m)?.[1] ?? "";
export const blockDir = (querySection) => querySection.match(/^\s*\[language_features=([^\]]*)\]/m)?.[1];
export const normalize = (s) => s.replace(/\s+/g, " ").trim();

/**
 * Expand `{{a|b|c}}` alternations into all variants. Empty option (e.g. `{{x.|}}`) => "". Non-greedy
 * so an option may itself contain a single `}` (graph quantifier, `{prop: v}` spec); the delimiter is
 * `}}`. Leftmost group varies slowest — matches ZetaSQL's ALTERNATION GROUP emission order.
 */
export function expand(query) {
	const m = query.match(/\{\{([\s\S]*?)\}\}/);
	if (!m) return [query];
	const opts = m[1].split("|");
	return opts.flatMap((o) => expand(query.slice(0, m.index) + o + query.slice(m.index + m[0].length)));
}

/** Like `expand`, but also records the chosen option text at each `{{}}` (source order) per variant. */
export function expandWithLabels(query) {
	const m = query.match(/\{\{([\s\S]*?)\}\}/);
	if (!m) return [{ sql: query, labels: [] }];
	const opts = m[1].split("|");
	return opts.flatMap((o) =>
		expandWithLabels(query.slice(0, m.index) + o + query.slice(m.index + m[0].length)).map((r) => ({
			sql: r.sql,
			labels: [o, ...r.labels],
		})),
	);
}

// Feature-aware grading. ZetaSQL's parser is feature-gated: a `[language_features=…]` directive turns
// LanguageFeatures on/off, and a syntax that needs a disabled feature reports a *Syntax error*. Our
// parser is a permissive superset — every feature we implement is permanently ON — so a case that is a
// "syntax error" only because a feature we implement is disabled is one we correctly accept; it is NOT
// a valid negative for us. We grade each case by the alternation group matching OUR feature config (the
// IMPLEMENTED set, all on). IMPLEMENTED is conservative — only the query-layer features we built; a
// feature we do NOT implement is graded feature-OFF so those negatives stay in the bucket.
export const IMPLEMENTED = new Set([
	"PIPES",
	"STATEMENT_WITH_PIPE_OPERATORS",
	"SQL_GRAPH",
	"SQL_GRAPH_ADVANCED_QUERY",
	"SQL_GRAPH_PATH_TYPE",
	"SQL_GRAPH_BOUNDED_PATH_QUANTIFICATION",
	"FOR_UPDATE",
	"QUALIFY",
	"LIMIT_ALL",
	"IS_DISTINCT",
	"BRACED_PROTO_CONSTRUCTORS",
	"WITH_GROUP_ROWS",
]);

const featureTokens = (s) => [...s.matchAll(/\+([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);

/** Our chosen option text at each `{{}}` in the directive — the option enabling the most IMPLEMENTED features and no unimplemented ones. */
function directiveChoices(directive) {
	const choices = [];
	for (const m of directive.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
		const opts = m[1].split("|");
		let best = opts[0];
		let bestScore = -1;
		for (const o of opts) {
			const feats = featureTokens(o);
			if (feats.every((f) => IMPLEMENTED.has(f)) && feats.length > bestScore) {
				bestScore = feats.length;
				best = o;
			}
		}
		choices.push(best);
	}
	return choices;
}

// An expected block may begin with bracketed directive lines (e.g. `[NEWLINE \n]`) before the ERROR or
// parse tree; strip them so the error check sees the real first content line.
const stripExpectedDirectives = (expected) => expected.replace(/^(?:\s*\[[^\]]*\]\s*\r?\n)+/, "").trim();
const startsWithSyntaxError = (expected) => /^ERROR:\s*Syntax error/i.test(stripExpectedDirectives(expected));
const isError = (expected) => /^ERROR:/i.test(stripExpectedDirectives(expected));
// A feature/support rejection only when the message is ABOUT support — and only if not already flagged
// as a "Syntax error" (those, e.g. "Syntax error: WHERE not supported after FROM query", are genuine
// parse errors that merely happen to contain the word "supported").
const isFeatureRejection = (expected) => /\bnot\s+(a\s+)?supported\b|\bnot\s+implemented\b/i.test(expected);
// Negativity predicates differ by corpus:
//  - PARSER testdata: the parser produces only parse trees or parse errors, so ANY expected `ERROR:`
//    is a NEGATIVE — except a post-parse feature/support rejection ("… is not supported"), which we
//    accept as a permissive superset (or it is DDL, excluded at the gate). Custom structural parser
//    errors ("EXCEPT must be followed by …", "… is an expression, not a query") are negatives even
//    without the "Syntax error" prefix.
//  - ANALYZER testdata: most expected `ERROR:`s are SEMANTIC (name/type resolution) errors on queries
//    that PARSE fine — those are positives for a parser. Only an "ERROR: Syntax error: …" is a true
//    parse error (negative).
// Pass the right one to classifyVariants per extractor; the parser-corpus predicate is the default.
export const isSyntaxError = (expected) =>
	startsWithSyntaxError(expected) || (isError(expected) && !isFeatureRejection(expected));
export const isAnalyzerSyntaxError = (expected) => startsWithSyntaxError(expected);

/**
 * Map each ALTERNATION GROUP label → its negative flag. ZetaSQL labels a cell by joining the chosen
 * alternation option texts (directive `{{}}`s then query `{{}}`s, source order) with ",", each trimmed,
 * "<empty>" when all empty. `ALTERNATION GROUP: <label>` (singular) carries the label on the header;
 * `ALTERNATION GROUPS:` (plural) lists several labels (sharing one expected) before `--`. Null when the
 * block has no alternations.
 */
function buildLabelMap(expectedSection, isNeg) {
	if (!/^ALTERNATION GROUPS?:/m.test(expectedSection)) return null;
	const map = new Map();
	const heads = [...expectedSection.matchAll(/^ALTERNATION GROUP(S)?:(.*)$/gm)];
	for (let h = 0; h < heads.length; h++) {
		const plural = heads[h][1] === "S";
		const start = heads[h].index + heads[h][0].length;
		const end = h + 1 < heads.length ? heads[h + 1].index : expectedSection.length;
		const body = expectedSection.slice(start, end);
		const labels = [];
		let expectedText;
		if (plural) {
			const lines = body.replace(/^[\r\n]+/, "").split("\n");
			let i = 0;
			while (i < lines.length && lines[i].trim() !== "--") {
				if (lines[i].trim()) labels.push(lines[i].trim());
				i++;
			}
			expectedText = lines.slice(i).join("\n").replace(/^[\r\n]*--[\r\n]*/, "");
		} else {
			labels.push(heads[h][2].trim());
			const ci = body.indexOf("--");
			expectedText = ci === -1 ? body : body.slice(ci + 2);
		}
		const neg = isNeg(expectedText);
		for (const lab of labels) map.set(normLabel(lab), neg);
	}
	return map;
}

// ZetaSQL emits an ALTERNATION GROUP label by joining the chosen option texts with the literal `, `
// (comma-space) AS WRITTEN in the template, so a label carries the template's spacing — `replace, VALUES
// (1, 2)` — while our reconstruction trims each option and joins with a bare `,`. Normalizing the
// space around every comma on BOTH the map keys and the lookup key makes the two comparable (and is
// safe for commas inside an option, e.g. `(1, 2)` → `(1,2)`, since the same rule hits both sides).
const normLabel = (s) => s.replace(/\s*,\s*/g, ",").trim();

/**
 * Classify each expanded query variant as negative (must not parse for our feature config) or positive.
 * Reconstructs each cell's ALTERNATION GROUP label (our directive feature choices + the variant's query
 * choices, each TRIMMED, joined with "," — matching ZetaSQL's trimmed labels) and looks it up. Robust
 * to multi-dimensional alternations and to ZetaSQL grouping several combos under one expected.
 */
export function classifyVariants(query, expectedSection, directive = "", isNeg = isSyntaxError) {
	const withLabels = expandWithLabels(query);
	const labelMap = buildLabelMap(expectedSection, isNeg);
	if (!labelMap) return withLabels.map(() => isNeg(expectedSection));
	const dChoices = directiveChoices(directive);
	return withLabels.map((v) => {
		// Trim each choice; drop LEADING empty choices (and their separator) while keeping empty
		// middle/trailing ones (`,+PIPES,,commit`, `,+PIPES,`); all-empty is "<empty>".
		const parts = [...dChoices, ...v.labels].map((p) => p.trim());
		while (parts.length && parts[0] === "") parts.shift();
		const joined = parts.join(",");
		const key = joined === "" ? "<empty>" : normLabel(joined);
		if (labelMap.has(key)) return labelMap.get(key);
		const negs = [...labelMap.values()];
		return negs.filter(Boolean).length >= negs.length / 2;
	});
}
