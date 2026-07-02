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

// A `[options…]` directive line: column 0, `[` (optionally followed by a space — a rare `[ language_
// features=…]` typo in the testdata), then a lowercase keyword then `=`, a space, or `]`
// (`[language_features=…]`, `[default …]`, `[mode=…]`, `[reserve_graph_table]`). Anchored at column 0
// because every real directive sits there; an INDENTED single-element array literal used as SQL
// (`  [int64]`, `  [string]` — a TVF arg, verified the only indented matches across the testdata) is a
// query line, not a directive, and must survive. It also deliberately does NOT match a SQL array
// constructor (`[1,2,3]`, `[1, e]`, `[col, x]`), which starts with a digit/expression or has a comma.
const DIRECTIVE_LINE = /^\[\s*[a-z][a-z0-9_]*\s*[=\] ]/;

export function cleanQuery(raw) {
	// Drop directive lines and `#` comment lines; keep the SQL. The .test format escapes an INPUT line
	// that itself begins with `--` or `==` (which would collide with the input/expected `--` and block
	// `==` separators) by prefixing a backslash; unescape those so the real comment line is recovered
	// (`\--comment` → `--comment`).
	return (
		raw
			.split("\n")
			// A directive line may itself carry an alternation (`[{{|no_}}qualify_reserved]`); test with the
			// `{{…}}` removed so it's still recognized as a directive (and not mistaken for an array). Also
			// drop `#` comment lines — including a `\#`-escaped one (the .test format escapes an input line
			// that begins with `#`, which would otherwise read as a test directive; the `#` line is a SQL
			// comment either way, so dropping it is faithful).
			.filter((l) => !DIRECTIVE_LINE.test(l.replace(/\{\{[^}]*\}\}/g, "")) && !/^\s*\\?#/.test(l))
			.map((l) => l.replace(/^\\(--|==)/, "$1"))
			.join("\n")
			.trim()
	);
}

// Strip leading test-directive lines from an EXPANDED variant. cleanQuery drops directive lines before
// expansion, but three forms only become a leading `[…]` line AFTER `{{}}` expansion / aren't caught by
// the lowercase line filter: a bracket wrapping an alternation (`[{{preserve_unnecessary_cast|no_…}}]`
// → `[]` after `{{}}`-removal, so cleanQuery keeps it), an uppercase `[DEFAULT language_features=…]`,
// and a directive that is itself an alternation OPTION (`{{|[no_preserve_column_aliases]}}` → the
// `[no_…]` variant carries the directive). All three surface as a leading `[<word>=|]|<space>` line on
// the variant; remove them (and any blank lines) so the real SQL starts the statement. Case-insensitive
// on the keyword; an array expression (`[a, b]`, `[1, e]`) does not match (a comma follows the word).
export const stripLeadingDirectives = (sql) =>
	sql.replace(/^(?:[ \t]*\[[A-Za-z][A-Za-z0-9_]*\s*[=\] ][^\n]*\r?\n|[ \t]*\r?\n)+/, "");

export const defaultModeOf = (text) => text.match(/^\[default mode=([a-z_]+)\]/im)?.[1] ?? "statement";
export const blockModeOverride = (querySection) => querySection.match(/^\s*\[mode=([a-z_]+)\]/m)?.[1];
export const fileDefaultDir = (text) => text.match(/^\[default language_features=([^\]]*)\]/im)?.[1] ?? "";
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
	"ALLOW_CONSECUTIVE_ON",
]);

// A block whose own `[language_features=…]` directive REMOVES a feature the file default turns on, where
// that feature is one we implement, is testing the feature-OFF behaviour of a feature we support — we
// accept such SQL as a permissive superset, so its "syntax error" is not a valid negative for us. (Only
// meaningful when the block has a fixed directive; alternation cases are graded by directiveChoices.)
export function disablesImplemented(blockDirective, fileDefault) {
	if (blockDirective == null) return false; // no block override → governed by the file default
	const have = new Set(featureTokens(blockDirective));
	return featureTokens(fileDefault).some((f) => IMPLEMENTED.has(f) && !have.has(f));
}

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
// Parser-structural rejections ZetaSQL's PARSER emits WITHOUT the "Syntax error:" prefix — the parser
// built no tree, so the case is a NEGATIVE for the analyzer corpus too (symmetric with the parser
// corpus's isSyntaxError, which already treats these as negatives). Curated to messages that are
// unambiguously parse-time (our own grammar emits the same rejection), never a semantic name/type error.
const PARSER_STRUCTURAL_ERROR =
	/is an expression, not a query|(?:Query parameters|System variables) cannot be used in place of table names/;
// A case is a parse-negative for the ANALYZER corpus when ZetaSQL's PARSER rejected it. That shows up as
// an "ERROR: Syntax error: …" line ANYWHERE in the expected — a leading analyzer preamble
// ("Table resolution time:", the extract_table_names format) or an earlier resolved statement of a
// multi-statement input can precede the error line — or as one of the curated parser-structural
// rejections above. A semantic name/type error (the common analyzer ERROR) means the parser ACCEPTED and
// stays a positive; hence the line-anchored "Syntax error" test, not a substring match.
export const isAnalyzerSyntaxError = (expected) =>
	/^ERROR:\s*Syntax error/im.test(stripExpectedDirectives(expected)) || PARSER_STRUCTURAL_ERROR.test(expected);

// Expected-string feature-off / deliberate-divergence rules, shared by BOTH extractors so the two
// corpora grade identically. A case whose ZetaSQL error fires only because a feature WE implement is
// disabled (or because of a documented BigQuery-vs-ZetaSQL divergence) is one we correctly accept as a
// permissive superset — not a valid negative for us. These complement disablesImplemented (which keys
// off the directive); these key off the error message. Each rule cites the feature it stands in for.
export function featureOffExpected(expectedSection, query = "") {
	// Bare QUALIFY: BigQuery's docs allow QUALIFY without a preceding WHERE/GROUP BY/HAVING; ZetaSQL's
	// parser requires one. This repo deliberately follows BigQuery (CLAUDE.md), so we accept it.
	if (/QUALIFY clause must be used in conjunction with WHERE/.test(expectedSection)) return true;
	// "Unexpected FROM [at …]" is ZetaSQL's signature for a FROM-query when FEATURE_PIPES is off. We
	// implement PIPES (permanently on). Tightened to the `[at` form so the genuine, PIPES-independent
	// "Unexpected FROM; FROM queries following a set operation must be parenthesized" stays a negative.
	if (/Syntax error: Unexpected FROM \[at/.test(expectedSection)) return true;
	// An alias on a parenthesized outer query is a pipe-syntax feature; PIPES-off ZetaSQL rejects it.
	if (/Alias not allowed on parenthesized outer query/.test(expectedSection)) return true;
	// `[no_reserve_graph_table]` makes GRAPH_TABLE a plain identifier so `GRAPH_TABLE(… MATCH …)` errors;
	// we always reserve GRAPH_TABLE (the GoogleSQL default), so this config is one we don't model.
	if (/Expected "\)" but got keyword MATCH/.test(expectedSection)) return true;
	// ALLOW_DASHES_IN_TABLE_NAME off → "Table name contains '-' character"; we implement dashed names.
	if (/Table name contains '-' character/.test(expectedSection)) return true;
	// Consecutive ON/USING inside a PARENTHESIZED join is the ALLOW_CONSECUTIVE_ON feature we implement;
	// ZetaSQL with it off reports "Expected end of input but got ON/USING". The `JOIN (` guard keeps the
	// genuine pipe-direct form (`|> JOIN t ON a ON b`, single-clause only) a negative.
	if (/Expected end of input but got keyword (ON|USING)\b/.test(expectedSection) && /\bjoin\s*\(/i.test(query))
		return true;
	return false;
}

// Post-parse structural errors that ZetaSQL labels "Syntax error" but its bare PARSER accepts (it builds
// a full tree — proven by the parser/testdata, where the identical query is a POSITIVE with a parse
// tree). The error is emitted by a later structural pass. Since our parseBigQuery follows the parser
// oracle for these (a valid parse must not be rejected — that would regress the parser-corpus positive),
// they are NOT parse-negatives for us in the analyzer corpus. Mixed set operations and a hint on a non-
// first set operation are both such cases (set_operation.test in parser/testdata lists the same SQL as a
// positive). The semantic layer is where these belong, not the parser.
export function isParserAcceptedPostParse(expectedSection) {
	return (
		/Different set operations cannot be used in the same query without using parentheses/.test(expectedSection) ||
		/Hints on set operations must appear on the first/.test(expectedSection)
	);
}

// Single-statement-mode boundary: ZetaSQL's default analyzer entry is AnalyzeStatement (one statement),
// which reports "Expected end of input but got keyword <stmt-start>" at the SECOND statement of a multi-
// statement input. Our entry is `root` = ParseScript (multi-statement), so we legitimately accept it — a
// mode divergence, not over-acceptance (parallel to the empty-script exclusion). Detected only when the
// expected is that boundary error AND the input genuinely carries more than one top-level statement (a
// `;` followed by more non-comment SQL), so a single statement with a real trailing-junk error stays a
// negative.
export function isSingleStmtModeBoundary(expectedSection, query) {
	if (
		!/Syntax error: Expected end of input but got keyword (SELECT|INSERT|UPDATE|DELETE|MERGE|TRUNCATE|WITH|FROM|CREATE|DROP|ALTER|EXPORT|GRANT|REVOKE)\b/i.test(
			expectedSection,
		)
	) {
		return false;
	}
	const afterSemi = query.split(";").slice(1).join(";");
	return /\S/.test(
		afterSemi
			.replace(/--[^\n]*/g, "")
			.replace(/#[^\n]*/g, "")
			.replace(/\/\*[\s\S]*?\*\//g, ""),
	);
}

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
			expectedText = lines
				.slice(i)
				.join("\n")
				.replace(/^[\r\n]*--[\r\n]*/, "");
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
