/*
 * ANTLR4 grammar for Google BigQuery / GoogleSQL (split lexer + parser pair).
 *
 * Forked from bytebase/parser, path googlesql/ (the h3n4l/Bytebase GoogleSQL grammar — same
 * authors as the grammars-v4 Snowflake grammar this project also forks).
 *   upstream:  https://github.com/bytebase/parser  (googlesql/)
 *   commit:    57b6ef7a2640481d8734cd63af0c7b781fa85f22
 *   retrieved: 2026-06-13
 *
 * License: BSD 3-Clause. Copyright (c) 2025, Bytebase. Full text in grammars/bigquery/LICENSE.
 *
 * Upstream provenance (per its README): hand-authored from Google's BigQuery "Query Syntax"
 * reference for the SELECT syntax, with ZetaSQL's bison_parser.y as the spec for syntax the
 * docs omit (notably expressions). Local edits are tracked in this repo's git history.
 */

parser grammar GoogleSQLParser;

options {
	tokenVocab = GoogleSQLLexer;
}

@parser::members {
	// ZetaSQL enforces non-associativity of the comparison family (=, <, >, …, LIKE, IN, BETWEEN, IS,
	// IS DISTINCT) via bison %nonassoc plus IsAllowedInComparison()/ErrorIfUnparenthesizedNotExpression()
	// actions (googlesql.tm). ANTLR left-recursion has neither, so we reproduce the actions: an operand
	// of a comparison-family or arithmetic operator may not itself be an unparenthesized comparison-family
	// node, and a binary operand may not be a bare `NOT expr`.
	private exprIsComparisonFamily(ctx: any): boolean {
		return (
			!!ctx &&
			!!(
				ctx.comparative_operator?.() ||
				ctx.between_operator?.() ||
				ctx.in_operator?.() ||
				ctx.like_operator?.() ||
				ctx.distinct_operator?.() ||
				ctx.is_operator?.()
			)
		);
	}
	private exprIsBareNot(ctx: any): boolean {
		const c0 = ctx?.getChild?.(0);
		return !!c0 && c0.getText?.().toUpperCase?.() === "NOT" && !!ctx.NOT_SYMBOL?.();
	}
	// A chained function call / field access cannot be applied to a bare (unparenthesized) numeric
	// literal — `123.0.x()`, `-5.0.f()`, `123 .f()` — only to a path or parenthesized expression
	// (googlesql.tm function_call_expression_base: INT/FLOAT base → "Unexpected ("). Parenthesized
	// forms have a `(` in their text and don't match.
	private exprIsBareNumeric(ctx: any): boolean {
		const t = ctx?.getText?.() ?? "";
		return /^[+-]?(\d[\d.]*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(t);
	}
	// googlesql.tm lambda_argument_list: a lambda's parameter list is either a bare path expression
	// (`e`, `a.b.c`) or a parenthesized struct constructor with a top-level comma (`(e, i>0)`, `()`).
	// A single parenthesized non-path (`(e>0)`), a STRUCT(…) constructor, or any other expression is
	// "Expecting lambda argument list". `()` is its own grammar alt; this validates the expression alt.
	private lambdaArgListValid(text: string): boolean {
		const t = (text ?? "").trim();
		if (/^(`[^`]*`|[A-Za-z_]\w*)(\s*\.\s*(`[^`]*`|[A-Za-z_]\w*))*$/.test(t)) return true; // bare path
		if (!t.startsWith("(") || !t.endsWith(")")) return false;
		// Parenthesized: a struct constructor (a top-level comma → any element kinds, `(e, i>0)`) or a
		// single parenthesized path (`(e)`, `(a.b.c)`). A single parenthesized non-path (`(e>0)`) is not.
		let depth = 0;
		for (let k = 0; k < t.length; k++) {
			const c = t[k];
			if (c === "(") depth++;
			else if (c === ")") depth--;
			else if (c === "," && depth === 1) return true;
		}
		return this.lambdaArgListValid(t.slice(1, -1));
	}
	// A graph path factor is a bare edge pattern only when it is an UNquantified graph_edge_pattern.
	// A quantified edge (`-[e]->{1,3}`) is a path pattern in ZetaSQL (ASTGraphPathPattern), not an edge,
	// so a hint adjacent to it is allowed — only a hint between two bare edges is ambiguous/rejected.
	private graphFactorIsEdge(f: any): boolean {
		if (!f) return false;
		return !!f.graph_path_primary?.()?.graph_element_pattern?.()?.graph_edge_pattern?.();
	}
	// ZetaSQL: "Hint cannot be used in between two GraphEdgePatterns" — a `@{…}` hint may precede a node
	// (or a parenthesized path) but not sit between two adjacent edge patterns.
	private checkGraphEdgeHints(ctx: any): void {
		const hints = ctx.hint?.() ?? [];
		if (!hints.length) return;
		const factors = ctx.graph_path_factor?.() ?? [];
		for (const h of hints) {
			const hs = h.start?.tokenIndex ?? -1;
			let prev: any = null;
			let next: any = null;
			for (const f of factors) {
				const fStart = f.start?.tokenIndex ?? -1;
				const fStop = f.stop?.tokenIndex ?? -1;
				if (fStop < hs && (!prev || fStop > (prev.stop?.tokenIndex ?? -1))) prev = f;
				if (fStart > hs && (!next || fStart < (next.start?.tokenIndex ?? Number.MAX_SAFE_INTEGER))) next = f;
			}
			if (this.graphFactorIsEdge(prev) && this.graphFactorIsEdge(next)) {
				this.notifyErrorListeners("Syntax error: Hint cannot be used in between two GraphEdgePatterns", null, null);
				return;
			}
		}
	}
	// Two tokens are adjacent when no character (whitespace/comment) sits between them. GoogleSQL
	// requires a graph edge pattern's punctuation to be written without spaces (`-[…]->`, `<-[…]-`);
	// the filler inside `[…]` may contain spaces (ZetaSQL graph_edge_pattern adjacency checks).
	private adj(a: any, b: any): boolean {
		return !!a && !!b && a.stop + 1 === b.start;
	}
	// One join step: a comma join, or a JOIN carrying N consecutive ON/USING clauses. `qualified` is a
	// join that requires a condition — i.e. not CROSS and not NATURAL (join_processor IsQualifiedJoin).
	private joinStep(s: any): { comma: boolean; qualified: boolean; ons: number; outer: boolean } {
		if (s.COMMA_SYMBOL?.()) return { comma: true, qualified: false, ons: 0, outer: false };
		const jtText = s.join_type?.()?.getText?.() ?? "";
		const isCross = /CROSS/i.test(jtText);
		const isNatural = !!s.opt_natural?.();
		const list = s.on_or_using_clause_list?.();
		const ons = list ? (list.on_or_using_clause?.()?.length ?? 0) : s.on_or_using_clause?.() ? 1 : 0;
		return { comma: false, qualified: !isCross && !isNatural, ons, outer: /FULL|RIGHT/i.test(jtText) };
	}
	// JOIN condition balance — a faithful port of ZetaSQL join_processor.cc JoinRuleAction's left fold
	// over the join chain. Each step carries a running `unmatched` join count (lhs.unmatched_join_count):
	// a qualified join adds 1, then the step's ON/USING clauses subtract. A step with ≥2 clauses (the
	// consecutive-ON "join rewrite") that has more clauses than unmatched joins is a hard error; with a
	// comma join already in the chain it is "Unexpected keyword ON"; a single over-count is *deferred*
	// (backward compat) and only thrown if a later ≥2-clause step meets it. A comma after a step that
	// used consecutive ON/USING is rejected ("Comma join is not allowed after consecutive ON/USING"),
	// and resets the running state (a comma join node carries none of it). Returns true when valid.
	private joinBalanced(steps: any[]): boolean {
		let unmatched = 0; // lhs.unmatched_join_count
		let transformNeeded = false; // lhs.transformation_needed — a ≥2-clause step occurred (sticky until a comma)
		let containsComma = false; // lhs.contains_comma_join (sticky)
		let deferred = false; // lhs has a saved (not-yet-thrown) parse error
		let sawComma = false; // any comma join seen (for the outer-after-comma grammar guard)
		for (const s of steps ?? []) {
			const st = this.joinStep(s);
			// A RIGHT/FULL join after a comma join must be parenthesized — `FROM a, b RIGHT JOIN c`.
			if (st.outer && sawComma) return false;
			if (st.comma) {
				if (transformNeeded) return false; // comma after consecutive ON/USING
				containsComma = true;
				sawComma = true;
				unmatched = 0;
				transformNeeded = false;
				deferred = false;
				continue;
			}
			const cc = st.ons;
			const u = unmatched + (st.qualified ? 1 : 0);
			if (cc >= 2 && containsComma) return false; // mixing consecutive ON/USING with a comma join
			if (deferred || cc > u) {
				if (cc >= 2) return false; // more join conditions than joins that require one
				deferred = true; // single over-count: defer; thrown only if a later ≥2-clause step hits it
			}
			unmatched = u - cc;
			if (cc >= 2) transformNeeded = true;
		}
		// When a consecutive-ON "join rewrite" occurred, ZetaSQL runs a second pass
		// (ProcessFlattenedJoinExpression) that re-pairs each ON/USING with a join; if any qualified join
		// is left without a matching condition the flattened stack does not reduce to one node and it
		// errors ("… JOIN must have an ON or USING clause"). Replay that stack reduction here.
		return transformNeeded ? this.joinPhase2(steps) : true;
	}
	// ZetaSQL join_processor.cc ProcessFlattenedJoinExpression, replayed over the join steps. Builds the
	// source-order token stream (T=operand, Q=qualified-join marker, X=cross/comma/natural-join marker,
	// O=ON/USING clause) and reduces it: a Q pushes a pending join (join_count++), an O matches the top
	// (lhs, join, rhs)→one node (join_condition_count++, both counts reset when equal — a new block), an
	// X folds lhs with the next operand. Valid iff the stack reduces to exactly one node.
	private joinPhase2(steps: any[]): boolean {
		const toks: string[] = ["T"]; // leading table_primary
		for (const s of steps ?? []) {
			const st = this.joinStep(s);
			toks.push(st.comma || !st.qualified ? "X" : "Q", "T");
			for (let k = 0; k < st.ons; k++) toks.push("O");
		}
		const stack: string[] = [];
		let jc = 0;
		let jcc = 0;
		for (let i = 0; i < toks.length; i++) {
			const t = toks[i];
			if (t === "T") {
				stack.push("T");
			} else if (t === "Q") {
				jc++;
				stack.push("Q");
			} else if (t === "X") {
				if (!stack.length || toks[i + 1] !== "T") return false;
				stack.pop();
				i++; // fold lhs with the next operand → one node
				stack.push("T");
			} else {
				jcc++;
				if (jcc === jc) {
					jc = 0;
					jcc = 0;
				}
				if (stack.length < 3) return false;
				stack.pop();
				stack.pop();
				stack.pop();
				stack.push("T");
			}
		}
		return stack.length === 1;
	}
	private checkGraphEdgeAdjacency(ctx: any): void {
		const lt = ctx.LT_OPERATOR?.()?.symbol;
		const m0 = ctx.MINUS_OPERATOR?.(0)?.symbol;
		const m1 = ctx.MINUS_OPERATOR?.(1)?.symbol;
		const ls = ctx.LS_BRACKET_SYMBOL?.()?.symbol;
		const rs = ctx.RS_BRACKET_SYMBOL?.()?.symbol;
		const arrow = ctx.SUB_GT_BRACKET_SYMBOL?.()?.symbol;
		const tail = m1 ?? arrow; // trailing `-` or `->`
		const bad =
			(lt && m0 && !this.adj(lt, m0)) ||
			(m0 && ls && !this.adj(m0, ls)) ||
			(rs && tail && !this.adj(rs, tail));
		if (bad) {
			this.notifyErrorListeners("Syntax error: graph edge pattern punctuation must be adjacent", null, null);
		}
	}
}

// An input of only comments/whitespace is a valid (empty) script in GoogleSQL (ParseScript).
root: stmts? EOF;

// A script is a sequence of SQL or procedural (scripting) statements — ZetaSQL ParseScript.
// Top level accepts both; the script statements (DECLARE/IF/WHILE/LOOP/BREAK/RAISE/BEGIN…) were
// previously reachable only inside a BEGIN…END block.
stmts:
	top_statement (SEMI_SYMBOL top_statement)* SEMI_SYMBOL?;

// DEFINE MACRO is valid only at the top level (not nested under a statement/block); a nested one is a
// syntax error in GoogleSQL, so it is reachable only here, not from unterminated_statement.
top_statement: define_macro_statement | unterminated_statement;

unterminated_sql_statement: statement_level_hint? sql_statement_body;

// DEFINE MACRO is DETECT-ONLY (like Spark's CREATE TEMPORARY MACRO and our object DDL): GoogleSQL's
// macro body uses a dedicated preprocessor lexer mode (`$arg` substitution, bare tokens like `3m`,
// `*/`) we don't model, so we recognize the statement and consume its name + body opaquely to the
// terminator rather than parsing it. It lowers to a flagged non-query body. (define_macro_statement
// in googlesql.tm.)
define_macro_statement:
	statement_level_hint? DEFINE_SYMBOL MACRO_SYMBOL define_macro_body?;

define_macro_body: ~SEMI_SYMBOL+;

sql_statement_body:
	query_statement
	| alter_statement
	| analyze_statement
	| assert_statement
	| aux_load_data_statement
	| clone_data_statement
	| dml_statement
	| merge_statement
	| truncate_statement
	| begin_statement
	| set_statement
	| commit_statement
	| start_batch_statement
	| run_batch_statement
	| abort_batch_statement
	| create_constant_statement
	| create_connection_statement
	| create_database_statement
	| create_function_statement
	| create_procedure_statement
	| create_index_statement
	| create_privilege_restriction_statement
	| create_row_access_policy_statement
	| create_external_table_statement
	| create_external_table_function_statement
	| create_model_statement
	| create_property_graph_statement
	| create_schema_statement
	| create_sequence_statement
	| create_external_schema_statement
	| create_snapshot_statement
	| create_table_function_statement
	| create_table_statement
	| create_view_statement
	| create_entity_statement
	// /* TODO(zp): define macro statement */ | define_macro_statement
	| define_table_statement
	// CALL/DESCRIBE/EXECUTE IMMEDIATE/RUN/SHOW may carry a pipe-operator suffix when they return a
	// single table (FEATURE_STATEMENT_WITH_PIPE_OPERATORS; sql_statement_body_maybe_pipe_suffix in
	// googlesql.tm). The suffix is optional, so this also covers the bare statements.
	| statement_maybe_pipe_suffix
	| explain_statement
	| export_data_statement
	| export_model_statement
	| export_metadata_statement
	| gql_statement
	| grant_statement
	| rename_statement
	| revoke_statement
	| rollback_statement
	| drop_all_row_access_policies_statement
	| drop_statement
	| import_statement
	| module_statement
	| undrop_statement
	// A bare subpipeline (`|> op …`) is a valid statement with an implicit input table.
	| subpipeline_statement;

subpipeline_statement: pipe_operator+;

// Statements that may return a single table and so accept a trailing pipe-operator suffix
// (googlesql.tm sql_statement_body_maybe_pipe_suffix). The suffix is optional.
statement_maybe_pipe_suffix: (
		call_statement
		| describe_statement
		| execute_immediate
		| run_statement
		| show_statement
	) pipe_operator*;

// RUN '<path>' [( arg => 'v', … )] or RUN <path_expression>( … ) (googlesql.tm run_statement, both
// alternatives — a script path as a string literal or a bare path with a required arg list). RUN BATCH
// is a separate batch statement (run_batch_statement), distinguished by the BATCH keyword.
run_statement:
	RUN_SYMBOL string_literal (
		LR_BRACKET_SYMBOL run_statement_arg_list? RR_BRACKET_SYMBOL
	)?
	| RUN_SYMBOL path_expression LR_BRACKET_SYMBOL run_statement_arg_list? RR_BRACKET_SYMBOL;

run_statement_arg_list: run_statement_arg (COMMA_SYMBOL run_statement_arg)* COMMA_SYMBOL?;

run_statement_arg: identifier (EQUAL_OPERATOR | EQUAL_GT_BRACKET_SYMBOL) string_literal;

gql_statement:
	GRAPH_SYMBOL path_expression graph_operation_block;

graph_operation_block:
	graph_composite_query_block (
		NEXT_SYMBOL graph_composite_query_block
	)*;

graph_composite_query_block:
	graph_linear_query_operation
	| graph_composite_query_prefix;

graph_composite_query_prefix:
	graph_linear_query_operation graph_set_operation_metadata graph_linear_query_operation (
		graph_set_operation_metadata graph_linear_query_operation
	)*;

// GQL composite query set ops carry an outer mode (LEFT/FULL/INNER/OUTER) like SQL set ops.
graph_set_operation_metadata:
	opt_corresponding_outer_mode? query_set_operation_type all_or_distinct;

graph_linear_query_operation:
	graph_linear_operator_list? graph_return_operator;

graph_linear_operator_list: graph_linear_operator+;

graph_linear_operator:
	graph_match_operator
	| graph_optional_match_operator
	| graph_let_operator
	| graph_filter_operator
	| graph_order_by_operator
	| graph_page_operator
	| graph_with_operator
	| graph_for_operator
	| graph_sample_clause
	| graph_call_operator;

// CALL operator: named/TVF call (with optional PER and YIELD), or an inline braced subquery.
graph_call_operator:
	OPTIONAL_SYMBOL? graph_call_operator_core;

graph_call_operator_core:
	CALL_SYMBOL graph_per_clause? tvf_with_suffixes graph_yield_clause?
	| CALL_SYMBOL graph_per_clause? braced_graph_subquery
	| CALL_SYMBOL parenthesized_identifier_list braced_graph_subquery;

graph_per_clause: PER_SYMBOL parenthesized_identifier_list;

parenthesized_identifier_list:
	LR_BRACKET_SYMBOL identifier_list? RR_BRACKET_SYMBOL;

graph_yield_clause: YIELD_SYMBOL graph_yield_item (COMMA_SYMBOL graph_yield_item)*;

graph_yield_item: identifier opt_as_alias_with_required_as?;

// Braced graph subquery: { ops } or { GRAPH g ops }
braced_graph_subquery:
	LC_BRACKET_SYMBOL graph_operation_block RC_BRACKET_SYMBOL
	| LC_BRACKET_SYMBOL GRAPH_SYMBOL path_expression graph_operation_block RC_BRACKET_SYMBOL;

graph_sample_clause:
	TABLESAMPLE_SYMBOL identifier LR_BRACKET_SYMBOL sample_size RR_BRACKET_SYMBOL
		opt_graph_sample_clause_suffix?;

opt_graph_sample_clause_suffix:
	repeatable_clause
	| WITH_SYMBOL WEIGHT_SYMBOL repeatable_clause?
	| WITH_SYMBOL WEIGHT_SYMBOL AS_SYMBOL identifier repeatable_clause?;

graph_for_operator:
	FOR_SYMBOL identifier IN_SYMBOL expression opt_with_offset_and_alias_with_required_as?;

opt_with_offset_and_alias_with_required_as:
	WITH_SYMBOL OFFSET_SYMBOL opt_as_alias_with_required_as?;

graph_with_operator:
	WITH_SYMBOL all_or_distinct? hint? graph_return_item_list group_by_clause?;

graph_page_operator: graph_page_clause;

graph_order_by_operator: graph_order_by_clause;

graph_filter_operator:
	FILTER_SYMBOL where_clause
	| FILTER_SYMBOL expression;

graph_let_operator:
	LET_SYMBOL graph_let_variable_definition_list;

graph_let_variable_definition_list:
	graph_let_variable_definition (
		COMMA_SYMBOL graph_let_variable_definition
	)*;

graph_let_variable_definition:
	identifier EQUAL_OPERATOR expression;

graph_optional_match_operator:
	OPTIONAL_SYMBOL MATCH_SYMBOL hint? graph_pattern;

graph_match_operator: MATCH_SYMBOL hint? graph_pattern;

graph_pattern: graph_path_pattern_list where_clause?;

graph_path_pattern_list:
	graph_path_pattern (COMMA_SYMBOL hint? graph_path_pattern)*;

graph_path_pattern:
	opt_path_variable_assignment? opt_graph_search_prefix? opt_graph_path_mode_prefix?
		graph_path_pattern_expr;

graph_path_pattern_expr:
	graph_path_factor (hint? graph_path_factor)* { this.checkGraphEdgeHints(localContext); };

graph_path_factor:
	graph_path_primary
	| graph_quantified_path_primary;

// A quantifier (`{m,n}`, `+`, `*`) may follow an edge pattern or a parenthesized path, but NOT a bare
// node pattern (`(a){1,3}`) — ZetaSQL "Quantifier cannot be used on a node pattern".
graph_quantified_path_primary:
	graph_path_primary graph_quantifier {
		if (localContext.graph_path_primary()?.graph_element_pattern()?.graph_node_pattern()) this.notifyErrorListeners("Syntax error: Quantifier cannot be used on a node pattern", null, null);
	};

// {m,n} (bounds optional), {n}, +, *  (graph-patterns quantifier)
graph_quantifier:
	LC_BRACKET_SYMBOL int_literal_or_parameter? COMMA_SYMBOL int_literal_or_parameter?
		RC_BRACKET_SYMBOL
	| LC_BRACKET_SYMBOL int_literal_or_parameter RC_BRACKET_SYMBOL
	| MULTIPLY_OPERATOR
	| PLUS_OPERATOR;

graph_path_primary:
	graph_element_pattern
	| graph_parenthesized_path_pattern;

graph_parenthesized_path_pattern:
	LR_BRACKET_SYMBOL hint? graph_path_pattern where_clause? RR_BRACKET_SYMBOL;

graph_element_pattern: graph_node_pattern | graph_edge_pattern;

graph_edge_pattern:
	LT_OPERATOR? MINUS_OPERATOR LS_BRACKET_SYMBOL graph_element_pattern_filler RS_BRACKET_SYMBOL
		MINUS_OPERATOR { this.checkGraphEdgeAdjacency(localContext); }
	| MINUS_OPERATOR LS_BRACKET_SYMBOL graph_element_pattern_filler RS_BRACKET_SYMBOL
		SUB_GT_BRACKET_SYMBOL { this.checkGraphEdgeAdjacency(localContext); }
	| MINUS_OPERATOR
	| LT_OPERATOR MINUS_OPERATOR {
		if (!this.adj(localContext.LT_OPERATOR()?.symbol, localContext.MINUS_OPERATOR(0)?.symbol)) this.notifyErrorListeners("Syntax error: graph edge pattern punctuation must be adjacent", null, null);
	}
	| SUB_GT_BRACKET_SYMBOL;

graph_node_pattern:
	LR_BRACKET_SYMBOL graph_element_pattern_filler RR_BRACKET_SYMBOL;

// graph-patterns element filler: name, label filter, property spec, WHERE, COST (all optional). The
// {prop:…} spec and a WHERE clause cannot both appear — ZetaSQL "WHERE clause cannot be used together
// with property specification".
graph_element_pattern_filler:
	hint? opt_graph_element_identifier? opt_is_label_expression? graph_property_specification?
		where_clause? opt_graph_cost? {
		if (localContext.graph_property_specification() && localContext.where_clause()) this.notifyErrorListeners("Syntax error: WHERE clause cannot be used together with property specification", null, null);
	};

opt_graph_cost: COST_SYMBOL expression;

graph_property_specification:
	LC_BRACKET_SYMBOL graph_property_name_and_value (
		COMMA_SYMBOL graph_property_name_and_value
	)* RC_BRACKET_SYMBOL;

graph_property_name_and_value:
	identifier COLON_SYMBOL expression;

opt_is_label_expression:
	IS_SYMBOL label_expression
	| COLON_SYMBOL label_expression;

label_expression:
	label_primary
	| label_expression BIT_AND_SYMBOL label_expression
	| label_expression STROKE_SYMBOL label_expression
	| EXCLAMATION_OPERATOR label_expression;

label_primary:
	identifier
	| MODULO_OPERATOR
	| parenthesized_label_expression;

parenthesized_label_expression:
	LR_BRACKET_SYMBOL label_expression RR_BRACKET_SYMBOL;

opt_graph_element_identifier: graph_identifier;

opt_graph_path_mode_prefix: opt_graph_path_mode path_or_paths?;

path_or_paths: PATH_SYMBOL | PATHS_SYMBOL;

opt_graph_path_mode:
	WALK_SYMBOL
	| TRAIL_SYMBOL
	| SIMPLE_SYMBOL
	| ACYCLIC_SYMBOL;

// graph-patterns search prefix: ANY / ANY SHORTEST / ANY CHEAPEST / ANY k / SHORTEST k /
// CHEAPEST k / ALL / ALL SHORTEST / ALL CHEAPEST.
opt_graph_search_prefix:
	ANY_SYMBOL (SHORTEST_SYMBOL | CHEAPEST_SYMBOL | int_literal_or_parameter)?
	| SHORTEST_SYMBOL int_literal_or_parameter
	| CHEAPEST_SYMBOL int_literal_or_parameter
	| ALL_SYMBOL (SHORTEST_SYMBOL | CHEAPEST_SYMBOL)?;

opt_path_variable_assignment: graph_identifier EQUAL_OPERATOR;

graph_identifier:
	token_identifier
	| common_keyword_as_identifier
	// SHORTEST is nonreserved in GoogleSQL (common_keyword_as_identifier), so it may name a graph path
	// variable (`MATCH shortest = …`) even though we also use it as a search-prefix keyword.
	| SHORTEST_SYMBOL;

graph_return_operator:
	RETURN_SYMBOL hint? all_or_distinct? graph_return_item_list group_by_clause?
		graph_order_by_clause? graph_page_clause?;

graph_page_clause:
	OFFSET_SYMBOL possibly_cast_int_literal_or_parameter LIMIT_SYMBOL
		possibly_cast_int_literal_or_parameter
	| SKIP_SYMBOL possibly_cast_int_literal_or_parameter LIMIT_SYMBOL
		possibly_cast_int_literal_or_parameter
	| OFFSET_SYMBOL possibly_cast_int_literal_or_parameter
	| SKIP_SYMBOL possibly_cast_int_literal_or_parameter
	| LIMIT_SYMBOL possibly_cast_int_literal_or_parameter;

graph_order_by_clause:
	ORDER_SYMBOL hint? BY_SYMBOL graph_ordering_expression (
		COMMA_SYMBOL graph_ordering_expression
	)*;

graph_ordering_expression:
	expression collate_clause? opt_graph_asc_or_desc? null_order?;

opt_graph_asc_or_desc:
	asc_or_desc
	| ASCENDING_SYMBOL
	| DESCENDING_SYMBOL;

graph_return_item_list:
	graph_return_item (COMMA_SYMBOL graph_return_item)*;

graph_return_item:
	expression (AS_SYMBOL identifier)?
	| MULTIPLY_OPERATOR;

undrop_statement:
	UNDROP_SYMBOL schema_object_kind opt_if_not_exists? path_expression opt_at_system_time?
		opt_options_list?;

module_statement:
	MODULE_SYMBOL path_expression opt_options_list?;

import_statement:
	IMPORT_SYMBOL import_type path_expression_or_string opt_as_or_into_alias? opt_options_list?;

opt_as_or_into_alias: (AS_SYMBOL | INTO_SYMBOL) identifier;

path_expression_or_string: path_expression | string_literal;

import_type: MODULE_SYMBOL | PROTO_SYMBOL;

call_statement:
	CALL_SYMBOL path_expression LR_BRACKET_SYMBOL (
		tvf_argument (COMMA_SYMBOL tvf_argument)*
	)? RR_BRACKET_SYMBOL;

drop_statement:
	DROP_SYMBOL PRIVILEGE_SYMBOL RESTRICTION_SYMBOL opt_if_exists? ON_SYMBOL privilege_list
		ON_SYMBOL identifier path_expression
	| DROP_SYMBOL ROW_SYMBOL ACCESS_SYMBOL POLICY_SYMBOL opt_if_exists? identifier
		on_path_expression
	| DROP_SYMBOL index_type INDEX_SYMBOL opt_if_exists? path_expression on_path_expression?
	| /* TODO(zp): Refine syntax error */ DROP_SYMBOL table_or_table_function opt_if_exists?
		maybe_dashed_path_expression opt_function_parameters?
	| DROP_SYMBOL SNAPSHOT_SYMBOL TABLE_SYMBOL opt_if_exists? maybe_dashed_path_expression
	| DROP_SYMBOL PROPERTY_SYMBOL GRAPH_SYMBOL opt_if_exists? path_expression
	| DROP_SYMBOL generic_entity_type opt_if_exists? path_expression
	| DROP_SYMBOL schema_object_kind opt_if_exists? path_expression opt_function_parameters?
		opt_drop_mode?;

opt_drop_mode: RESTRICT_SYMBOL | CASCADE_SYMBOL;

drop_all_row_access_policies_statement:
	DROP_SYMBOL ALL_SYMBOL ROW_SYMBOL ACCESS_SYMBOL? POLICIES_SYMBOL ON_SYMBOL path_expression;

show_statement:
	SHOW_SYMBOL show_target opt_from_path_expression? opt_like_string_literal?;

opt_like_string_literal: LIKE_SYMBOL string_literal;

show_target: MATERIALIZED_SYMBOL VIEWS_SYMBOL | identifier;

rename_statement:
	RENAME_SYMBOL identifier path_expression TO_SYMBOL path_expression;

revoke_statement:
	REVOKE_SYMBOL privileges ON_SYMBOL (identifier identifier?)? path_expression FROM_SYMBOL
		grantee_list;

grant_statement:
	GRANT_SYMBOL privileges ON_SYMBOL (identifier identifier?)? path_expression TO_SYMBOL
		grantee_list;

privileges: ALL_SYMBOL PRIVILEGES_SYMBOL? | privilege_list;

export_metadata_statement:
	EXPORT_SYMBOL table_or_table_function METADATA_SYMBOL FROM_SYMBOL maybe_dashed_path_expression
		with_connection_clause? opt_options_list?;

export_model_statement:
	EXPORT_SYMBOL MODEL_SYMBOL path_expression with_connection_clause? opt_options_list?;

export_data_statement: export_data_no_query as_query;

export_data_no_query:
	EXPORT_SYMBOL DATA_SYMBOL with_connection_clause? opt_options_list?;

explain_statement: EXPLAIN_SYMBOL unterminated_sql_statement;

execute_immediate:
	EXECUTE_SYMBOL IMMEDIATE_SYMBOL expression opt_execute_into_clause? opt_execute_using_clause?;

opt_execute_into_clause: INTO_SYMBOL identifier_list;

opt_execute_using_clause:
	USING_SYMBOL execute_using_argument_list;

execute_using_argument_list:
	execute_using_argument (COMMA_SYMBOL execute_using_argument)*;

execute_using_argument: expression (AS_SYMBOL identifier)?;

describe_statement: describe_keyword describe_info;

describe_info:
	identifier? maybe_slashed_or_dashed_path_expression opt_from_path_expression?;

opt_from_path_expression:
	FROM_SYMBOL maybe_slashed_or_dashed_path_expression;

describe_keyword: DESCRIBE_SYMBOL | DESC_SYMBOL;

// googlesql.tm define_table_statement: the OPTIONS(...) list is REQUIRED — `DEFINE TABLE t1` alone is
// a syntax error.
define_table_statement:
	DEFINE_SYMBOL TABLE_SYMBOL path_expression options_list;

create_entity_statement:
	CREATE_SYMBOL opt_or_replace? generic_entity_type opt_if_not_exists? path_expression
		opt_options_list? opt_generic_entity_body?;

opt_generic_entity_body: AS_SYMBOL generic_entity_body;

create_view_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? RECURSIVE_SYMBOL? VIEW_SYMBOL opt_if_not_exists?
		maybe_dashed_path_expression column_with_options_list? opt_sql_security_clause?
		opt_options_list? as_query
	| CREATE_SYMBOL opt_or_replace? MATERIALIZED_SYMBOL RECURSIVE_SYMBOL? VIEW_SYMBOL
		opt_if_not_exists? maybe_dashed_path_expression column_with_options_list?
		opt_sql_security_clause? partition_by_clause_prefix_no_hint?
		cluster_by_clause_prefix_no_hint? opt_options_list? AS_SYMBOL query_or_replica_source
	| CREATE_SYMBOL opt_or_replace? APPROX_SYMBOL RECURSIVE_SYMBOL? VIEW_SYMBOL opt_if_not_exists?
		maybe_dashed_path_expression column_with_options_list? opt_sql_security_clause?
		opt_options_list? as_query;

query_or_replica_source:
	query
	| REPLICA_SYMBOL OF_SYMBOL maybe_dashed_path_expression;

column_with_options_list:
	LR_BRACKET_SYMBOL column_with_options (
		COMMA_SYMBOL column_with_options
	)* RR_BRACKET_SYMBOL;

column_with_options: identifier opt_options_list?;

create_table_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? TABLE_SYMBOL opt_if_not_exists?
		maybe_dashed_path_expression table_element_list? opt_spanner_table_options?
		opt_like_path_expression? opt_clone_table? opt_copy_table? opt_default_collate_clause?
		partition_by_clause_prefix_no_hint? cluster_by_clause_prefix_no_hint? opt_ttl_clause?
		with_connection_clause? opt_options_list? as_query?;

opt_ttl_clause:
	ROW_SYMBOL DELETION_SYMBOL POLICY_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL;

opt_copy_table: COPY_SYMBOL copy_data_source;

copy_data_source:
	maybe_dashed_path_expression opt_at_system_time? where_clause?;

opt_clone_table: CLONE_SYMBOL clone_data_source;

opt_spanner_table_options:
	spanner_primary_key opt_spanner_interleave_in_parent_clause?;

opt_spanner_interleave_in_parent_clause:
	COMMA_SYMBOL INTERLEAVE_SYMBOL IN_SYMBOL PARENT_SYMBOL maybe_dashed_path_expression
		foreign_key_on_delete;

spanner_primary_key:
	PRIMARY_SYMBOL KEY_SYMBOL primary_key_element_list;

create_table_function_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? TABLE_SYMBOL FUNCTION_SYMBOL opt_if_not_exists?
		path_expression opt_function_parameters? opt_returns? opt_sql_security_clause?
		unordered_language_options? opt_as_query_or_string? {
			if (localContext.opt_function_parameters() === null) {
				this.notifyErrorListeners("Syntax error: Expected (", null, null)
			}
		};

opt_as_query_or_string: as_query | AS_SYMBOL string_literal;

unordered_language_options:
	language opt_options_list?
	| opt_options_list language?;

opt_function_parameters:
	LR_BRACKET_SYMBOL (
		function_parameter (COMMA_SYMBOL function_parameter)*
	)? RR_BRACKET_SYMBOL;

create_snapshot_statement:
	CREATE_SYMBOL opt_or_replace? SNAPSHOT_SYMBOL (
		TABLE_SYMBOL
		| schema_object_kind
	) opt_if_not_exists? maybe_dashed_path_expression CLONE_SYMBOL clone_data_source
		opt_options_list?;

create_external_schema_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? EXTERNAL_SYMBOL SCHEMA_SYMBOL opt_if_not_exists?
		path_expression with_connection_clause? opt_options_list;

create_schema_statement:
	CREATE_SYMBOL opt_or_replace? SCHEMA_SYMBOL opt_if_not_exists? path_expression
		opt_default_collate_clause? opt_options_list?;

// CREATE SEQUENCE [IF NOT EXISTS] name [OPTIONS(...)]  (data-definition-language#create_sequence)
create_sequence_statement:
	CREATE_SYMBOL opt_or_replace? SEQUENCE_SYMBOL opt_if_not_exists? path_expression opt_options_list?;

create_property_graph_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? PROPERTY_SYMBOL GRAPH_SYMBOL opt_if_not_exists?
		path_expression NODE_SYMBOL TABLES_SYMBOL element_table_list opt_edge_table_clause?
		opt_options_list?;

opt_edge_table_clause:
	EDGE_SYMBOL TABLES_SYMBOL element_table_list;

element_table_list:
	LR_BRACKET_SYMBOL element_table_definition (
		COMMA_SYMBOL element_table_definition
	)* COMMA_SYMBOL? RR_BRACKET_SYMBOL;

element_table_definition:
	path_expression opt_as_alias_with_required_as? opt_key_clause? opt_source_node_table_clause?
		opt_dest_node_table_clause? opt_options_list? opt_label_and_properties_clause?
		dynamic_label_and_properties?;

opt_label_and_properties_clause:
	properties_clause
	| label_and_properties_list;

label_and_properties_list: label_and_properties+;

// graph-schema-statements: DEFAULT LABEL [OPTIONS …] | LABEL <name>, each with optional PROPERTIES.
label_and_properties:
	DEFAULT_SYMBOL LABEL_SYMBOL opt_options_list? properties_clause?
	| LABEL_SYMBOL identifier properties_clause?;

dynamic_label_and_properties: dynamic_label_or_properties+;

dynamic_label_or_properties:
	DYNAMIC_SYMBOL LABEL_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL
	| DYNAMIC_SYMBOL PROPERTIES_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL;

properties_clause:
	NO_SYMBOL PROPERTIES_SYMBOL
	| properties_all_columns opt_except_column_list?
	| PROPERTIES_SYMBOL LR_BRACKET_SYMBOL derived_property_list RR_BRACKET_SYMBOL;

derived_property_list:
	derived_property (COMMA_SYMBOL derived_property)*;

derived_property: expression opt_as_alias_with_required_as? opt_options_list?;

opt_except_column_list: EXCEPT_SYMBOL column_list;

properties_all_columns:
	PROPERTIES_SYMBOL ARE_SYMBOL? ALL_SYMBOL COLUMNS_SYMBOL;

opt_dest_node_table_clause:
	DESTINATION_SYMBOL KEY_SYMBOL column_list REFERENCES_SYMBOL identifier column_list?;

opt_source_node_table_clause:
	SOURCE_SYMBOL KEY_SYMBOL column_list REFERENCES_SYMBOL identifier column_list?;

opt_key_clause: KEY_SYMBOL column_list;

create_model_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? MODEL_SYMBOL opt_if_not_exists? path_expression
		opt_input_output_clause? opt_transform_clause? remote_with_connection_clause?
		opt_options_list? opt_as_query_or_aliased_query_list?;

opt_input_output_clause:
	INPUT_SYMBOL table_element_list OUTPUT_SYMBOL table_element_list;

opt_transform_clause:
	TRANSFORM_SYMBOL LR_BRACKET_SYMBOL select_list RR_BRACKET_SYMBOL;

opt_as_query_or_aliased_query_list:
	as_query
	| AS_SYMBOL LR_BRACKET_SYMBOL aliased_query_list RR_BRACKET_SYMBOL;

aliased_query_list: aliased_query (COMMA_SYMBOL aliased_query)*;

// CREATE … AS <query> — the body may also be a GQL graph query (CREATE VIEW v AS GRAPH g …).
as_query: AS_SYMBOL (query | gql_statement);

create_external_table_function_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? EXTERNAL_SYMBOL TABLE_SYMBOL FUNCTION_SYMBOL {
		this.notifyErrorListeners("Syntax error: CREATE EXTERNAL TABLE FUNCTION is not supported", null, null)
	};

create_external_table_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? EXTERNAL_SYMBOL TABLE_SYMBOL opt_if_not_exists?
		maybe_dashed_path_expression table_element_list? opt_like_path_expression?
		opt_default_collate_clause? opt_external_table_with_clauses? opt_options_list?;

opt_default_collate_clause: DEFAULT_SYMBOL collate_clause;

opt_like_path_expression:
	LIKE_SYMBOL maybe_dashed_path_expression;

create_row_access_policy_statement:
	CREATE_SYMBOL opt_or_replace? ROW_SYMBOL ACCESS_SYMBOL? POLICY_SYMBOL opt_if_not_exists?
		identifier? ON_SYMBOL path_expression create_row_access_policy_grant_to_clause?
		filter_using_clause;

filter_using_clause:
	FILTER_SYMBOL? USING_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL;

create_row_access_policy_grant_to_clause:
	grant_to_clause
	| TO_SYMBOL grantee_list;

create_privilege_restriction_statement:
	CREATE_SYMBOL opt_or_replace? PRIVILEGE_SYMBOL RESTRICTION_SYMBOL opt_if_not_exists? ON_SYMBOL
		privilege_list ON_SYMBOL identifier path_expression restrict_to_clause?;

restrict_to_clause:
	RESTRICT_SYMBOL TO_SYMBOL possibly_empty_grantee_list;

possibly_empty_grantee_list:
	LR_BRACKET_SYMBOL (
		string_literal_or_parameter (
			COMMA_SYMBOL string_literal_or_parameter
		)*
	)? RR_BRACKET_SYMBOL;

create_index_statement:
	CREATE_SYMBOL opt_or_replace? UNIQUE_SYMBOL? opt_spanner_null_filtered? index_type? INDEX_SYMBOL
		opt_if_not_exists? path_expression on_path_expression as_alias? index_unnest_expression_list
		? index_order_by_and_options index_storing_list? opt_create_index_statement_suffix?;

opt_create_index_statement_suffix:
	partition_by_clause_prefix_no_hint opt_options_list?
	| opt_options_list? spanner_index_interleave_clause
	| opt_options_list;

spanner_index_interleave_clause:
	COMMA_SYMBOL INTERLEAVE_SYMBOL IN_SYMBOL maybe_dashed_path_expression;

index_storing_list:
	STORING_SYMBOL index_storing_expression_list;

index_storing_expression_list:
	LR_BRACKET_SYMBOL expression (COMMA_SYMBOL expression)* RR_BRACKET_SYMBOL;

index_order_by_and_options:
	LR_BRACKET_SYMBOL column_ordering_and_options_expr (
		COMMA_SYMBOL column_ordering_and_options_expr
	)* RR_BRACKET_SYMBOL
	| index_all_columns;

index_all_columns:
	LR_BRACKET_SYMBOL ALL_SYMBOL COLUMNS_SYMBOL opt_with_column_options? RR_BRACKET_SYMBOL;

opt_with_column_options:
	WITH_SYMBOL COLUMN_SYMBOL OPTIONS_SYMBOL all_column_column_options;

all_column_column_options:
	LR_BRACKET_SYMBOL column_ordering_and_options_expr (
		COMMA_SYMBOL column_ordering_and_options_expr
	)* RR_BRACKET_SYMBOL;

column_ordering_and_options_expr:
	expression collate_clause? asc_or_desc? null_order? opt_options_list?;

index_unnest_expression_list:
	unnest_expression_with_opt_alias_and_offset+;

unnest_expression_with_opt_alias_and_offset:
	unnest_expression as_alias? opt_with_offset_and_alias?;

on_path_expression: ON_SYMBOL path_expression;

index_type: SEARCH_SYMBOL | VECTOR_SYMBOL;

opt_spanner_null_filtered: NULL_FILTERED_SYMBOL;

create_procedure_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? PROCEDURE_SYMBOL opt_if_not_exists?
		path_expression procedure_parameters opt_external_security_clause? with_connection_clause?
		opt_options_list? begin_end_block_or_language_as_code;

begin_end_block_or_language_as_code:
	begin_end_block
	| LANGUAGE_SYMBOL identifier opt_as_code?;

begin_end_block:
	BEGIN_SYMBOL statement_list? opt_exception_handler? END_SYMBOL;

// The handler body may be empty (`EXCEPTION WHEN ERROR THEN END`) — spec statement_list allows %empty.
opt_exception_handler:
	EXCEPTION_SYMBOL WHEN_SYMBOL ERROR_SYMBOL THEN_SYMBOL statement_list?;

statement_list:
	unterminated_non_empty_statement_list SEMI_SYMBOL;

unterminated_non_empty_statement_list:
	unterminated_statement (SEMI_SYMBOL unterminated_statement)*;

unterminated_statement:
	unterminated_sql_statement
	| unterminated_script_statement;

unterminated_script_statement:
	if_statement
	| case_statement
	| variable_declaration
	| break_statement
	| continue_statement
	| return_statement
	| raise_statement
	| unterminated_unlabeled_script_statement
	| label COLON_SYMBOL unterminated_unlabeled_script_statement identifier?;

label: /* TODO(zp): refine label. */ identifier;

unterminated_unlabeled_script_statement:
	begin_end_block
	| while_statement
	| loop_statement
	| repeat_statement
	| for_in_statement;

for_in_statement:
	FOR_SYMBOL identifier IN_SYMBOL parenthesized_query DO_SYMBOL statement_list? END_SYMBOL
		FOR_SYMBOL;

repeat_statement:
	REPEAT_SYMBOL statement_list? until_clause END_SYMBOL REPEAT_SYMBOL;

until_clause: UNTIL_SYMBOL expression;

loop_statement:
	LOOP_SYMBOL statement_list? END_SYMBOL LOOP_SYMBOL;

while_statement:
	WHILE_SYMBOL expression DO_SYMBOL statement_list? END_SYMBOL WHILE_SYMBOL;

raise_statement:
	RAISE_SYMBOL
	| RAISE_SYMBOL USING_SYMBOL MESSAGE_SYMBOL EQUAL_OPERATOR expression;

return_statement: RETURN_SYMBOL;

continue_statement:
	CONTINUE_SYMBOL identifier?
	| ITERATE_SYMBOL identifier?;

variable_declaration:
	DECLARE_SYMBOL identifier_list type opt_default_expression?
	| DECLARE_SYMBOL identifier_list DEFAULT_SYMBOL expression;

break_statement:
	BREAK_SYMBOL identifier?
	| LEAVE_SYMBOL identifier?;

case_statement:
	CASE_SYMBOL expression? when_then_clauses opt_else? END_SYMBOL CASE_SYMBOL;

when_then_clauses:
	(WHEN_SYMBOL expression THEN_SYMBOL statement_list?)+;

if_statement:
	IF_SYMBOL expression THEN_SYMBOL statement_list? elseif_clauses? opt_else? END_SYMBOL IF_SYMBOL;

elseif_clauses:
	(ELSEIF_SYMBOL expression THEN_SYMBOL statement_list?)+;

opt_else: ELSE_SYMBOL statement_list?;

opt_as_code: AS_SYMBOL string_literal;

opt_external_security_clause:
	EXTERNAL_SYMBOL SECURITY_SYMBOL external_security_clause_kind;

external_security_clause_kind: INVOKER_SYMBOL | DEFINER_SYMBOL;

procedure_parameters:
	LR_BRACKET_SYMBOL (
		procedure_parameter (COMMA_SYMBOL procedure_parameter)*
	)? RR_BRACKET_SYMBOL;

procedure_parameter:
	opt_procedure_parameter_mode? identifier type_or_tvf_schema
	| opt_procedure_parameter_mode? identifier procedure_parameter_termination {
		this.notifyErrorListeners("Syntax error: Unexpected end of parameter. Parameters should be in the format [<parameter mode>] <parameter name> <type>. If IN/OUT/INOUT is intended to be the name of a parameter, it must be escaped with backticks", null, null)
	};

procedure_parameter_termination:
	RR_BRACKET_SYMBOL
	| COMMA_SYMBOL;

opt_procedure_parameter_mode:
	IN_SYMBOL
	| OUT_SYMBOL
	| INOUT_SYMBOL;

create_function_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? opt_aggregate? FUNCTION_SYMBOL opt_if_not_exists
		? function_declaration opt_function_returns? opt_sql_security_clause? opt_determinism_level?
		opt_language_or_remote_with_connection? unordered_options_body?;

opt_determinism_level:
	DETERMINISTIC_SYMBOL
	| NOT_SYMBOL DETERMINISTIC_SYMBOL
	| IMMUTABLE_SYMBOL
	| STABLE_SYMBOL
	| VOLATILE_SYMBOL;

opt_sql_security_clause:
	SQL_SYMBOL SECURITY_SYMBOL sql_security_clause_kind;

sql_security_clause_kind: INVOKER_SYMBOL | DEFINER_SYMBOL;

as_sql_function_body_or_string:
	AS_SYMBOL sql_function_body
	| AS_SYMBOL string_literal;

sql_function_body:
	LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL
	| LR_BRACKET_SYMBOL SELECT_SYMBOL {
		this.notifyErrorListeners("The body of each CREATE FUNCTION statement is an expression, not a query; to use a query as an expression, the query must be wrapped with additional parentheses to make it a scalar subquery expression", null, null)
	};

unordered_options_body:
	opt_options_list as_sql_function_body_or_string?
	| as_sql_function_body_or_string opt_options_list?;

opt_language_or_remote_with_connection:
	LANGUAGE_SYMBOL identifier remote_with_connection_clause?
	| remote_with_connection_clause language?;

language: LANGUAGE_SYMBOL identifier;

remote_with_connection_clause:
	REMOTE_SYMBOL with_connection_clause?
	| with_connection_clause;

with_connection_clause: WITH_SYMBOL connection_clause;

opt_function_returns: opt_returns;

opt_returns: RETURNS_SYMBOL type_or_tvf_schema;

function_declaration: path_expression function_parameters;

function_parameters:
	LR_BRACKET_SYMBOL (
		function_parameter (COMMA_SYMBOL function_parameter)*
	)? RR_BRACKET_SYMBOL;

function_parameter:
	identifier type_or_tvf_schema opt_as_alias_with_required_as? opt_default_expression?
		opt_not_aggregate?
	| type_or_tvf_schema opt_as_alias_with_required_as? opt_not_aggregate?;

opt_not_aggregate: NOT_SYMBOL AGGREGATE_SYMBOL;

opt_default_expression: DEFAULT_SYMBOL expression;

type_or_tvf_schema:
	type
	| templated_parameter_type
	| tvf_schema;

tvf_schema:
	TABLE_SYMBOL template_type_open tvf_schema_column (
		COMMA_SYMBOL tvf_schema_column
	)* template_type_close;

tvf_schema_column: identifier type | type;

templated_parameter_type: ANY_SYMBOL templated_parameter_kind;

templated_parameter_kind:
	PROTO_SYMBOL
	| ENUM_SYMBOL
	| STRUCT_SYMBOL
	| ARRAY_SYMBOL
	| identifier;

opt_aggregate: AGGREGATE_SYMBOL;

create_database_statement:
	CREATE_SYMBOL DATABASE_SYMBOL path_expression opt_options_list?;

create_connection_statement:
	CREATE_SYMBOL opt_or_replace? CONNECTION_SYMBOL opt_if_not_exists? path_expression
		opt_options_list?;

create_constant_statement:
	CREATE_SYMBOL opt_or_replace? opt_create_scope? CONSTANT_SYMBOL opt_if_not_exists?
		path_expression EQUAL_OPERATOR expression;

opt_or_replace: OR_SYMBOL REPLACE_SYMBOL;

opt_create_scope:
	TEMP_SYMBOL
	| TEMPORARY_SYMBOL
	| PUBLIC_SYMBOL
	| PRIVATE_SYMBOL;

run_batch_statement: RUN_SYMBOL BATCH_SYMBOL;

abort_batch_statement: ABORT_SYMBOL BATCH_SYMBOL;

start_batch_statement: START_SYMBOL BATCH_SYMBOL identifier?;

rollback_statement: ROLLBACK_SYMBOL TRANSACTION_SYMBOL?;

commit_statement: COMMIT_SYMBOL TRANSACTION_SYMBOL?;

set_statement:
	SET_SYMBOL TRANSACTION_SYMBOL transaction_mode_list
	| SET_SYMBOL identifier EQUAL_OPERATOR expression
	| SET_SYMBOL named_parameter_expression EQUAL_OPERATOR expression
	| SET_SYMBOL system_variable_expression EQUAL_OPERATOR expression
	| SET_SYMBOL LR_BRACKET_SYMBOL identifier_list RR_BRACKET_SYMBOL EQUAL_OPERATOR expression
	| SET_SYMBOL identifier COMMA_SYMBOL identifier EQUAL_OPERATOR {
		this.notifyErrorListeners("Using SET with multiple variable required parentheses around the variable list", null, null)
	};

identifier_list: identifier (COMMA_SYMBOL identifier)*;

begin_statement:
	begin_transaction_keywords transaction_mode_list?;

begin_transaction_keywords:
	START_SYMBOL TRANSACTION_SYMBOL
	| BEGIN_SYMBOL TRANSACTION_SYMBOL?;

transaction_mode_list:
	transaction_mode (COMMA_SYMBOL transaction_mode)*;

transaction_mode:
	READ_SYMBOL ONLY_SYMBOL
	| READ_SYMBOL WRITE_SYMBOL
	| ISOLATION_SYMBOL LEVEL_SYMBOL identifier
	| ISOLATION_SYMBOL LEVEL_SYMBOL identifier identifier;

truncate_statement:
	TRUNCATE_SYMBOL TABLE_SYMBOL maybe_dashed_path_expression opt_where_expression?;

merge_statement:
	MERGE_SYMBOL INTO_SYMBOL? maybe_dashed_path_expression as_alias? USING_SYMBOL merge_source
		ON_SYMBOL expression (merge_when_clause)+;

merge_source: table_path_expression | table_subquery;

merge_when_clause:
	WHEN_SYMBOL MATCHED_SYMBOL opt_and_expression? THEN_SYMBOL merge_action
	| WHEN_SYMBOL NOT_SYMBOL MATCHED_SYMBOL by_target? opt_and_expression? THEN_SYMBOL merge_action
	| WHEN_SYMBOL NOT_SYMBOL MATCHED_SYMBOL BY_SYMBOL SOURCE_SYMBOL opt_and_expression? THEN_SYMBOL
		merge_action;

merge_action:
	INSERT_SYMBOL column_list? merge_insert_value_list_or_source_row
	| UPDATE_SYMBOL SET_SYMBOL update_item_list
	| DELETE_SYMBOL;

merge_insert_value_list_or_source_row:
	VALUES_SYMBOL insert_values_row
	| ROW_SYMBOL;

by_target: BY_SYMBOL TARGET_SYMBOL;

opt_and_expression: AND_SYMBOL expression;

statement_level_hint: hint;

// query_statement: https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax
query_statement: query;

dml_statement:
	insert_statement
	| delete_statement
	| update_statement;

update_statement:
	UPDATE_SYMBOL maybe_dashed_generalized_path_expression hint? as_alias? opt_with_offset_and_alias
		? SET_SYMBOL update_item_list from_clause? opt_where_expression? opt_assert_rows_modified?
		opt_returning_clause?;

delete_statement:
	DELETE_SYMBOL FROM_SYMBOL? maybe_dashed_generalized_path_expression hint? as_alias?
		opt_with_offset_and_alias? opt_where_expression? opt_assert_rows_modified?
		opt_returning_clause?;

insert_statement:
	insert_statement_prefix column_list? insert_values_or_query opt_assert_rows_modified?
		opt_returning_clause?
	| insert_statement_prefix column_list? insert_values_list_or_table_clause on_conflict_clause
		opt_assert_rows_modified? opt_returning_clause?
	| insert_statement_prefix column_list? LR_BRACKET_SYMBOL query RR_BRACKET_SYMBOL
		on_conflict_clause opt_assert_rows_modified? opt_returning_clause?;

on_conflict_clause:
	ON_SYMBOL CONFLICT_SYMBOL opt_conflict_target? DO_SYMBOL NOTHING_SYMBOL
	| ON_SYMBOL CONFLICT_SYMBOL opt_conflict_target? DO_SYMBOL UPDATE_SYMBOL SET_SYMBOL
		update_item_list opt_where_expression?;

opt_where_expression: WHERE_SYMBOL expression;

opt_conflict_target:
	column_list
	| ON_SYMBOL UNIQUE_SYMBOL CONSTRAINT_SYMBOL identifier;

update_item_list: update_item (COMMA_SYMBOL update_item)*;

update_item: update_set_value | nested_dml_statement;

update_set_value:
	generalized_path_expression EQUAL_OPERATOR expression_or_default;

nested_dml_statement:
	LR_BRACKET_SYMBOL dml_statement RR_BRACKET_SYMBOL;

insert_values_list_or_table_clause:
	insert_values_list
	| table_clause_unreversed;

table_clause_unreversed: TABLE_SYMBOL table_clause_no_keyword;

table_clause_no_keyword:
	path_expression where_clause?
	| tvf_with_suffixes where_clause?;

opt_returning_clause:
	THEN_SYMBOL RETURN_SYMBOL select_list
	| THEN_SYMBOL RETURN_SYMBOL WITH_SYMBOL ACTION_SYMBOL select_list
	| THEN_SYMBOL RETURN_SYMBOL WITH_SYMBOL ACTION_SYMBOL AS_SYMBOL identifier select_list;

opt_assert_rows_modified:
	ASSERT_ROWS_MODIFIED_SYMBOL possibly_cast_int_literal_or_parameter;

insert_values_or_query: insert_values_list | query;

insert_values_list:
	VALUES_SYMBOL insert_values_row (
		COMMA_SYMBOL insert_values_row
	)*;

insert_values_row:
	LR_BRACKET_SYMBOL expression_or_default (
		COMMA_SYMBOL expression_or_default
	)* RR_BRACKET_SYMBOL;

expression_or_default: expression | DEFAULT_SYMBOL;

insert_statement_prefix:
	INSERT_SYMBOL opt_or_ignore_replace_update? opt_into? maybe_dashed_generalized_path_expression
		hint?;

maybe_dashed_generalized_path_expression:
	generalized_path_expression
	| dashed_path_expression;

opt_into: INTO_SYMBOL;

// Insert mode (googlesql.tm insert_mode): `[OR] IGNORE`, `OR REPLACE` / bare REPLACE, `OR UPDATE` /
// bare UPDATE. Bare REPLACE/UPDATE are the mode only when the token-rewrite has retyped them to
// KW_REPLACE_AFTER_INSERT / KW_UPDATE_AFTER_INSERT (REPLACE/UPDATE directly after INSERT, not
// followed by `.`/`[`); an un-retyped REPLACE/UPDATE is a target path (`INSERT replace.col …`), and
// `INSERT REPLACE VALUES …` correctly fails as incomplete (mode REPLACE, target VALUES, no source).
opt_or_ignore_replace_update:
	OR_SYMBOL IGNORE_SYMBOL
	| IGNORE_SYMBOL
	| OR_SYMBOL REPLACE_SYMBOL
	| KW_REPLACE_AFTER_INSERT
	| OR_SYMBOL UPDATE_SYMBOL
	| KW_UPDATE_AFTER_INSERT;

alter_statement:
	ALTER_SYMBOL table_or_table_function opt_if_exists? maybe_dashed_path_expression
		alter_action_list
	| ALTER_SYMBOL schema_object_kind opt_if_exists? path_expression alter_action_list
	| ALTER_SYMBOL generic_entity_type opt_if_exists? path_expression alter_action_list
	| ALTER_SYMBOL generic_entity_type opt_if_exists? alter_action_list
	| ALTER_SYMBOL PRIVILEGE_SYMBOL RESTRICTION_SYMBOL opt_if_exists? ON_SYMBOL privilege_list
		ON_SYMBOL identifier path_expression
	| ALTER_SYMBOL ROW_SYMBOL ACCESS_SYMBOL POLICY_SYMBOL opt_if_exists? identifier ON_SYMBOL
		path_expression row_access_policy_alter_action_list
	| ALTER_SYMBOL ALL_SYMBOL ROW_SYMBOL ACCESS_SYMBOL POLICIES_SYMBOL ON_SYMBOL path_expression
		row_access_policy_alter_action;

analyze_statement:
	ANALYZE_SYMBOL opt_options_list? table_and_column_info_list?;

assert_statement: ASSERT_SYMBOL expression opt_description?;

aux_load_data_statement:
	LOAD_SYMBOL DATA_SYMBOL append_or_overwrite maybe_dashed_path_expression_with_scope
		table_element_list? load_data_partitions_clause? collate_clause?
		partition_by_clause_prefix_no_hint? cluster_by_clause_prefix_no_hint? opt_options_list?
		aux_load_data_from_files_options_list opt_external_table_with_clauses?;

clone_data_statement:
	CLONE_SYMBOL DATA_SYMBOL INTO_SYMBOL maybe_dashed_path_expression FROM_SYMBOL
		clone_data_source_list;

clone_data_source_list:
	clone_data_source (UNION_SYMBOL ALL_SYMBOL clone_data_source)*;

clone_data_source:
	maybe_dashed_path_expression opt_at_system_time? where_clause?;

opt_external_table_with_clauses:
	with_partition_columns_clause with_connection_clause
	| with_partition_columns_clause
	| with_connection_clause;

with_partition_columns_clause:
	WITH_SYMBOL PARTITION_SYMBOL COLUMNS_SYMBOL table_element_list?;

aux_load_data_from_files_options_list:
	FROM_SYMBOL FILES_SYMBOL options_list;

cluster_by_clause_prefix_no_hint:
	CLUSTER_SYMBOL BY_SYMBOL expression (COMMA_SYMBOL expression)*;

load_data_partitions_clause:
	OVERWRITE_SYMBOL? PARTITIONS_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL;

maybe_dashed_path_expression_with_scope:
	TEMP_SYMBOL TABLE_SYMBOL maybe_dashed_path_expression
	| TEMPORARY_SYMBOL TABLE_SYMBOL maybe_dashed_path_expression
	| maybe_dashed_path_expression;

table_element_list:
	LR_BRACKET_SYMBOL (
		table_element (COMMA_SYMBOL table_element)* COMMA_SYMBOL?
	)? RR_BRACKET_SYMBOL;

table_element:
	table_column_definition
	| table_constraint_definition;

table_constraint_definition:
	primary_key_spec
	| table_constraint_spec
	| identifier identifier table_constraint_spec;

append_or_overwrite: INTO_SYMBOL | OVERWRITE_SYMBOL;

opt_description: AS_SYMBOL string_literal;

table_and_column_info_list:
	table_and_column_info (COMMA_SYMBOL table_and_column_info)*;

table_and_column_info:
	maybe_dashed_path_expression column_list?;

row_access_policy_alter_action_list:
	row_access_policy_alter_action (
		COMMA_SYMBOL row_access_policy_alter_action
	)*;

row_access_policy_alter_action:
	grant_to_clause
	| FILTER_SYMBOL USING_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL
	| REVOKE_SYMBOL FROM_SYMBOL LR_BRACKET_SYMBOL grantee_list RR_BRACKET_SYMBOL
	| REVOKE_SYMBOL FROM_SYMBOL ALL_SYMBOL
	| RENAME_SYMBOL TO_SYMBOL identifier;

grant_to_clause:
	GRANT_SYMBOL TO_SYMBOL LR_BRACKET_SYMBOL grantee_list RR_BRACKET_SYMBOL;

grantee_list:
	string_literal_or_parameter (
		COMMA_SYMBOL string_literal_or_parameter
	)*;

privilege_list: privilege (COMMA_SYMBOL privilege)*;

privilege: privilege_name path_expression_list_with_parens?;

path_expression_list_with_parens:
	LR_BRACKET_SYMBOL path_expression_list RR_BRACKET_SYMBOL;

privilege_name: identifier | SELECT_SYMBOL;

generic_entity_type: generic_entity_type_unchecked;

generic_entity_type_unchecked: IDENTIFIER | PROJECT_SYMBOL;

schema_object_kind:
	AGGREGATE_SYMBOL FUNCTION_SYMBOL
	| APPROX_SYMBOL VIEW_SYMBOL
	| CONNECTION_SYMBOL
	| CONSTANT_SYMBOL
	| DATABASE_SYMBOL
	| EXTERNAL_SYMBOL table_or_table_function
	| EXTERNAL_SYMBOL SCHEMA_SYMBOL
	| FUNCTION_SYMBOL
	| INDEX_SYMBOL
	| MATERIALIZED_SYMBOL VIEW_SYMBOL
	| MODEL_SYMBOL
	| SEQUENCE_SYMBOL
	| PROCEDURE_SYMBOL
	| SCHEMA_SYMBOL
	| VIEW_SYMBOL;

alter_action_list: alter_action (COMMA_SYMBOL alter_action)*;

alter_action:
	SET_SYMBOL OPTIONS_SYMBOL options_list
	| SET_SYMBOL AS_SYMBOL generic_entity_body
	| ADD_SYMBOL table_constraint_spec
	| ADD_SYMBOL primary_key_spec
	| ADD_SYMBOL CONSTRAINT_SYMBOL opt_if_not_exists? identifier
		primary_key_or_table_constraint_spec
	| DROP_SYMBOL CONSTRAINT_SYMBOL opt_if_exists? identifier
	| DROP_SYMBOL PRIMARY_SYMBOL KEY_SYMBOL opt_if_exists?
	| ALTER_SYMBOL CONSTRAINT_SYMBOL opt_if_exists? identifier constraint_enforcement
	| ALTER_SYMBOL CONSTRAINT_SYMBOL opt_if_exists? identifier SET_SYMBOL OPTIONS_SYMBOL
		options_list
	| ADD_SYMBOL COLUMN_SYMBOL opt_if_not_exists? table_column_definition column_position?
		fill_using_expression?
	| DROP_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier
	| RENAME_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier TO_SYMBOL identifier
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier SET_SYMBOL DATA_SYMBOL TYPE_SYMBOL
		field_schema
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier SET_SYMBOL OPTIONS_SYMBOL options_list
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier SET_SYMBOL DEFAULT_SYMBOL expression
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier DROP_SYMBOL DEFAULT_SYMBOL
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier DROP_SYMBOL NOT_SYMBOL NULL_SYMBOL
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier SET_SYMBOL generated_column_info
	| ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier DROP_SYMBOL GENERATED_SYMBOL
	| RENAME_SYMBOL TO_SYMBOL path_expression
	| SET_SYMBOL DEFAULT_SYMBOL collate_clause
	| ADD_SYMBOL ROW_SYMBOL DELETION_SYMBOL POLICY_SYMBOL opt_if_not_exists? LR_BRACKET_SYMBOL
		expression RR_BRACKET_SYMBOL
	| REPLACE_SYMBOL ROW_SYMBOL DELETION_SYMBOL POLICY_SYMBOL opt_if_exists? LR_BRACKET_SYMBOL
		expression RR_BRACKET_SYMBOL
	| DROP_SYMBOL ROW_SYMBOL DELETION_SYMBOL POLICY_SYMBOL opt_if_exists?
	| ALTER_SYMBOL generic_sub_entity_type opt_if_exists? identifier alter_action
	| ADD_SYMBOL generic_sub_entity_type opt_if_not_exists? identifier
	| DROP_SYMBOL generic_sub_entity_type opt_if_exists? identifier
	| spanner_alter_column_action
	| spanner_set_on_delete_action;

spanner_set_on_delete_action:
	SET_SYMBOL ON_SYMBOL DELETE_SYMBOL foreign_key_action;

spanner_alter_column_action:
	ALTER_SYMBOL COLUMN_SYMBOL opt_if_exists? identifier column_schema_inner
		not_null_column_attribute? spanner_generated_or_default? opt_options_list?;

spanner_generated_or_default:
	AS_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL STORED_SYMBOL;

generic_sub_entity_type: sub_entity_type_identifier;

sub_entity_type_identifier: IDENTIFIER | REPLICA_SYMBOL;

fill_using_expression: FILL_SYMBOL USING_SYMBOL expression;

column_position:
	PRECEDING_SYMBOL identifier
	| FOLLOWING_SYMBOL identifier;

table_column_definition:
	identifier table_column_schema column_attributes? opt_options_list?;

column_attributes: column_attribute+ constraint_enforcement?;

column_attribute:
	primary_key_column_attribute
	| foreign_key_column_attribute
	| hidden_column_attribute
	| not_null_column_attribute;

primary_key_column_attribute: PRIMARY_SYMBOL KEY_SYMBOL;

foreign_key_column_attribute:
	opt_constraint_identity? foreign_key_reference;

hidden_column_attribute: HIDDEN_SYMBOL;

opt_constraint_identity: CONSTRAINT_SYMBOL identifier;

table_column_schema:
	column_schema_inner collate_clause? opt_column_info?
	| generated_column_info;

opt_column_info:
	generated_column_info invalid_default_column? {
		if (localContext.invalid_default_column() !== null) {
			this.notifyErrorListeners("Syntax error: \"DEFAULT\" and \"GENERATED ALWAYS AS\" clauses must not be both provided for the column", null, null)
		}
	}
	| default_column_info invalid_generated_column? {
		if (localContext.invalid_generated_column() !== null) {
			this.notifyErrorListeners("Syntax error: \"DEFAULT\" and \"GENERATED ALWAYS AS\" clauses must not be both provided for the column", null, null)
		}
	};

invalid_generated_column: generated_column_info;

invalid_default_column: default_column_info;

default_column_info: DEFAULT_SYMBOL expression;

generated_column_info:
	generated_mode LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL stored_mode?
	| generated_mode identity_column_info;

identity_column_info:
	IDENTITY_SYMBOL LR_BRACKET_SYMBOL opt_start_with? opt_increment_by? opt_maxvalue? opt_minvalue?
		opt_cycle? RR_BRACKET_SYMBOL;

opt_start_with: START_SYMBOL WITH_SYMBOL signed_numeric_literal;

opt_increment_by:
	INCREMENT_SYMBOL BY_SYMBOL signed_numeric_literal;

opt_maxvalue: MAXVALUE_SYMBOL signed_numeric_literal;

opt_minvalue: MINVALUE_SYMBOL signed_numeric_literal;

opt_cycle: CYCLE_SYMBOL | NO_SYMBOL CYCLE_SYMBOL;

signed_numeric_literal:
	integer_literal
	| numeric_literal
	| bignumeric_literal
	| floating_point_literal
	| MINUS_OPERATOR integer_literal
	| MINUS_OPERATOR floating_point_literal;

// All rules reference stored_mode should make stored_mode optional.
stored_mode: STORED_SYMBOL VOLATILE_SYMBOL | STORED_SYMBOL;

generated_mode:
	GENERATED_SYMBOL AS_SYMBOL
	| GENERATED_SYMBOL ALWAYS_SYMBOL AS_SYMBOL
	| GENERATED_SYMBOL BY_SYMBOL DEFAULT_SYMBOL AS_SYMBOL
	| AS_SYMBOL;

column_schema_inner:
	raw_column_schema_inner opt_type_parameters?;

raw_column_schema_inner:
	simple_column_schema_inner
	| array_column_schema_inner
	| struct_column_schema_inner
	| range_column_schema_inner
	| map_column_schema_inner;

map_column_schema_inner:
	MAP_SYMBOL template_type_open field_schema COMMA_SYMBOL field_schema template_type_close;

range_column_schema_inner:
	RANGE_SYMBOL template_type_open field_schema template_type_close;

struct_column_schema_inner:
	STRUCT_SYMBOL template_type_open (
		struct_column_field (COMMA_SYMBOL struct_column_field)*
	)? template_type_close;

struct_column_field:
	column_schema_inner collate_clause? opt_field_attributes?
	| identifier field_schema;

simple_column_schema_inner: path_expression | INTERVAL_SYMBOL;

array_column_schema_inner:
	ARRAY_SYMBOL template_type_open field_schema template_type_close;

field_schema:
	column_schema_inner collate_clause? opt_field_attributes? opt_options_list?;

opt_field_attributes: not_null_column_attribute;

not_null_column_attribute: NOT_SYMBOL NULL_SYMBOL;

primary_key_or_table_constraint_spec:
	primary_key_spec
	| table_constraint_spec;

opt_if_not_exists: IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL;

primary_key_spec:
	PRIMARY_SYMBOL KEY_SYMBOL primary_key_element_list constraint_enforcement? opt_options_list?;

primary_key_element_list:
	LR_BRACKET_SYMBOL (
		primary_key_element (COMMA_SYMBOL primary_key_element)*
	)? RR_BRACKET_SYMBOL;

primary_key_element: identifier asc_or_desc? null_order?;

table_constraint_spec:
	CHECK_SYMBOL LR_BRACKET_SYMBOL expression RR_BRACKET_SYMBOL constraint_enforcement?
		opt_options_list?
	| FOREIGN_SYMBOL KEY_SYMBOL column_list foreign_key_reference constraint_enforcement?
		opt_options_list?;

foreign_key_reference:
	REFERENCES_SYMBOL path_expression column_list opt_foreign_key_match? opt_foreign_key_action?;

opt_foreign_key_action:
	foreign_key_on_update foreign_key_on_delete?
	| foreign_key_on_delete foreign_key_on_update?;

foreign_key_on_update:
	ON_SYMBOL UPDATE_SYMBOL foreign_key_action;

foreign_key_on_delete:
	ON_SYMBOL DELETE_SYMBOL foreign_key_action;

foreign_key_action:
	NO_SYMBOL ACTION_SYMBOL
	| RESTRICT_SYMBOL
	| CASCADE_SYMBOL
	| SET_SYMBOL NULL_SYMBOL;

opt_foreign_key_match: MATCH_SYMBOL foreign_key_match_mode;

foreign_key_match_mode:
	SIMPLE_SYMBOL
	| FULL_SYMBOL
	| NOT_SYMBOL DISTINCT_SYMBOL;

column_list:
	LR_BRACKET_SYMBOL identifier (COMMA_SYMBOL identifier)* RR_BRACKET_SYMBOL;

opt_options_list: OPTIONS_SYMBOL options_list;

constraint_enforcement: NOT_SYMBOL? ENFORCED_SYMBOL;

generic_entity_body: json_literal | string_literal;

opt_if_exists: IF_SYMBOL EXISTS_SYMBOL;

table_or_table_function: TABLE_SYMBOL FUNCTION_SYMBOL?;

// …/pipe-syntax — a query is a base query followed by zero or more `|>` pipe operators.
// Pipes propagate through `query` everywhere it is used (subqueries, set-op operands, CTEs).
query: query_without_pipe_operators pipe_operator*;

// A bare FROM clause (no SELECT) is a valid query in pipe syntax — `FROM t` ≡ `SELECT * FROM t`.
query_without_pipe_operators:
	with_clause query_primary_or_set_operation order_by_clause? limit_offset_clause? lock_mode_clause?
	| with_clause_with_trailing_comma select_or_from_keyword {this.notifyErrorListeners("Syntax error: Trailing comma after the WITH clause before the main query is not allowed", null, null)
		}
	| with_clause PIPE_SYMBOL {this.notifyErrorListeners("Syntax error: A pipe operator cannot follow the WITH clause before the main query; The main query usually starts with SELECT or FROM here", null, null)
		}
	| query_primary_or_set_operation order_by_clause? limit_offset_clause? lock_mode_clause?
	| with_clause? from_query lock_mode_clause?;

// FROM-query: the whole query is just a FROM clause (rows flow into the pipe operators).
from_query: from_clause;

// FOR UPDATE — the only lock mode in GoogleSQL (query-syntax). Trails ORDER BY / LIMIT.
lock_mode_clause: FOR_SYMBOL UPDATE_SYMBOL;

// --- Pipe operators (…/pipe-syntax; grammar from google/googlesql googlesql.tm) -----------------
// Every operator is introduced by `|>`. Each delegates to the standard clause it mirrors; the
// EXTEND/WINDOW/AGGREGATE selection list is the restricted form (no bare `*`).
pipe_operator:
	PIPE_SYMBOL (
		pipe_where
		| pipe_select
		| pipe_extend
		| pipe_rename
		| pipe_set
		| pipe_drop
		| pipe_aggregate
		| pipe_order_by
		| pipe_limit_offset
		| pipe_distinct
		| pipe_window
		| pipe_join
		| pipe_call
		| pipe_as
		| pipe_set_operation
		| pipe_recursive_union
		| pipe_pivot
		| pipe_unpivot
		| pipe_tablesample
		| pipe_match_recognize
		| pipe_assert
		| pipe_log
		| pipe_static_describe
		| pipe_describe
		| pipe_if
		| pipe_fork
		| pipe_tee
		| pipe_with
		| pipe_export_data
		| pipe_create_table
		| pipe_insert
	);

// A subpipeline is a parenthesized run of `|>` operators with an implicit input (may be empty).
subpipeline: LR_BRACKET_SYMBOL pipe_operator* RR_BRACKET_SYMBOL;

subquery_or_subpipeline: subpipeline | parenthesized_query;

pipe_where: where_clause;

// SELECT reuses the full select_clause (bare `*`, star modifiers, AS aliases) + trailing WINDOW.
// SELECT / EXTEND allow a trailing WINDOW clause which itself may have a trailing comma
// (opt_window_clause_with_trailing_comma in googlesql.tm).
pipe_select: select_clause (window_clause COMMA_SYMBOL?)?;

// EXTEND / WINDOW use the restricted selection list (no bare `*`); EXTEND allows a trailing WINDOW.
pipe_extend: EXTEND_SYMBOL pipe_selection_item_list (window_clause COMMA_SYMBOL?)?;

pipe_window: WINDOW_SYMBOL pipe_selection_item_list;

pipe_selection_item: select_column_expr | select_column_dot_star;

pipe_selection_item_list:
	pipe_selection_item (COMMA_SYMBOL pipe_selection_item)* COMMA_SYMBOL?;

pipe_rename: RENAME_SYMBOL pipe_rename_item (COMMA_SYMBOL pipe_rename_item)* COMMA_SYMBOL?;

pipe_rename_item: identifier AS_SYMBOL? identifier;

pipe_set: SET_SYMBOL pipe_set_item (COMMA_SYMBOL pipe_set_item)* COMMA_SYMBOL?;

pipe_set_item: identifier EQUAL_OPERATOR expression;

pipe_drop: DROP_SYMBOL identifier (COMMA_SYMBOL identifier)* COMMA_SYMBOL?;

// AGGREGATE: agg list may be empty; GROUP BY is the pipe variant (no GROUP BY ALL) but otherwise
// the full grouping-item set (ROLLUP/CUBE/GROUPING SETS/(), AS alias, order suffix, GROUP AND ORDER).
// The optional `WITH <identifier> [OPTIONS(...)]` differential-privacy/anonymization modifier is the
// shared opt_with_modifier (googlesql.tm pipe_aggregate: "AGGREGATE" opt_with_modifier … — the same
// modifier SELECT carries via opt_select_with).
pipe_aggregate:
	AGGREGATE_SYMBOL opt_select_with? pipe_aggregate_item_list? pipe_group_by_clause?;

// Pipe GROUP BY: the pipe variant — `GROUP [AND ORDER] BY` and per-item alias/ordering suffixes,
// which the standard GROUP BY (group_by_clause_prefix) does NOT allow (googlesql.tm grouping_item vs
// grouping_item_in_pipe, group_by_preamble vs group_by_preamble_in_pipe).
pipe_group_by_clause:
	group_by_preamble_in_pipe grouping_item_in_pipe (COMMA_SYMBOL grouping_item_in_pipe)* COMMA_SYMBOL?;

pipe_aggregate_item_list:
	pipe_aggregate_item (COMMA_SYMBOL pipe_aggregate_item)* COMMA_SYMBOL?;

pipe_aggregate_item: pipe_selection_item opt_selection_item_order?;

// Pipe ORDER BY allows a trailing comma (order_by_clause_with_opt_comma in googlesql.tm).
pipe_order_by: order_by_clause COMMA_SYMBOL?;

pipe_limit_offset: limit_offset_clause;

pipe_distinct: DISTINCT_SYMBOL;

// JOIN with no LHS (the pipe input is the LHS).
// googlesql.tm pipe_join takes a SINGLE on_or_using_clause (not the list a regular join allows): a pipe
// `|> JOIN t ON … ON …` / `USING (…) USING (…)` is rejected ("Expected end of input but got ON/USING").
pipe_join:
	opt_natural? join_type? join_hint? JOIN_SYMBOL hint? table_primary on_or_using_clause? {
		if (!this.joinBalanced([localContext])) this.notifyErrorListeners("Syntax error: JOIN must have an ON or USING clause", null, null);
	};

pipe_call: CALL_SYMBOL tvf_with_suffixes;

pipe_as: AS_SYMBOL identifier;

// Set operations: {ALL|DISTINCT} mandatory; operands are parenthesized queries or `TABLE name`.
pipe_set_operation:
	set_operation_metadata pipe_set_operation_operand (
		COMMA_SYMBOL pipe_set_operation_operand
	)* COMMA_SYMBOL?;

pipe_set_operation_operand: parenthesized_query | table_clause;

pipe_recursive_union:
	RECURSIVE_SYMBOL set_operation_metadata recursion_depth_modifier? subquery_or_subpipeline
		opt_as_alias_with_required_as?;

pipe_pivot: pivot_clause as_alias?;

pipe_unpivot: unpivot_clause as_alias?;

pipe_tablesample: sample_clause;

pipe_match_recognize: match_recognize_clause;

pipe_assert: ASSERT_SYMBOL expression (COMMA_SYMBOL expression)* COMMA_SYMBOL?;

pipe_log: LOG_SYMBOL hint? subpipeline?;

pipe_static_describe: STATIC_DESCRIBE_SYMBOL;

pipe_describe: DESCRIBE_SYMBOL;

pipe_if:
	IF_SYMBOL hint? expression THEN_SYMBOL subpipeline pipe_if_elseif* (
		ELSE_SYMBOL subpipeline
	)?;

pipe_if_elseif: ELSEIF_SYMBOL expression THEN_SYMBOL subpipeline;

pipe_fork: FORK_SYMBOL hint? subpipeline (COMMA_SYMBOL subpipeline)* COMMA_SYMBOL?;

pipe_tee: TEE_SYMBOL hint? (subpipeline (COMMA_SYMBOL subpipeline)* COMMA_SYMBOL?)?;

pipe_with: with_clause COMMA_SYMBOL?;

pipe_export_data: export_data_no_query;

// googlesql.tm pipe_create_table: a pipe `|> CREATE TABLE` takes the create prefix only — an AS query
// is the pipe's own input, so a trailing `AS <query>` is a syntax error.
pipe_create_table: create_table_statement {
	if (localContext.create_table_statement()?.as_query()) this.notifyErrorListeners("Syntax error: AS query is not allowed on pipe CREATE TABLE", null, null);
};

pipe_insert:
	insert_statement_prefix column_list? on_conflict_clause? opt_assert_rows_modified?
		opt_returning_clause?;

bad_keyword_after_from_query:
	WHERE_SYMBOL
	| SELECT_SYMBOL
	| GROUP_SYMBOL;

bad_keyword_after_from_query_allows_parens:
	ORDER_SYMBOL
	| UNION_SYMBOL
	| INTERSECT_SYMBOL
	| EXCEPT_SYMBOL
	| LIMIT_SYMBOL;

with_clause_with_trailing_comma: with_clause COMMA_SYMBOL;

select_or_from_keyword: SELECT_SYMBOL | FROM_SYMBOL;

query_primary_or_set_operation:
	query_primary
	| query_set_operation;

query_set_operation: query_set_operation_prefix;

query_set_operation_prefix:
	query_primary query_set_operation_item+
	| query_primary set_operation_metadata FROM_SYMBOL { this.notifyErrorListeners("Syntax error: Unexpected FROM;FROM queries following a set operation must be parenthesized", null, null); 
		}
	| query_set_operation_prefix set_operation_metadata FROM_SYMBOL { this.notifyErrorListeners("Syntax error: Unexpected FROM;FROM queries following a set operation must be parenthesized", null, null); 
		};

query_set_operation_item: set_operation_metadata query_primary;

// `TABLE name` is shorthand for `SELECT * FROM name` (query-syntax).
query_primary:
	select
	| TABLE_SYMBOL path_expression
	| parenthesized_query opt_as_alias_with_required_as?;

// googlesql.tm set_operation_metadata: STRICT is incompatible with an outer mode (FULL/LEFT/OUTER/
// INNER) and with BY NAME — both are parser syntax errors, not resolver checks.
set_operation_metadata:
	opt_corresponding_outer_mode? query_set_operation_type hint? all_or_distinct opt_strict?
		opt_column_match_suffix? {
		if (localContext.opt_strict()) {
			if (localContext.opt_corresponding_outer_mode()) this.notifyErrorListeners("Syntax error: STRICT cannot be used with outer mode in set operations", null, null);
			else if (localContext.opt_column_match_suffix()?.NAME_SYMBOL()) this.notifyErrorListeners("Syntax error: STRICT cannot be used with BY NAME in set operations", null, null);
		}
	};

// …/query-syntax#set_operators: { BY NAME [ON (column_list)] | CORRESPONDING [BY (column_list)] }
opt_column_match_suffix:
	CORRESPONDING_SYMBOL (
		BY_SYMBOL LR_BRACKET_SYMBOL identifier_list RR_BRACKET_SYMBOL
	)?
	| BY_SYMBOL NAME_SYMBOL (
		ON_SYMBOL LR_BRACKET_SYMBOL identifier_list RR_BRACKET_SYMBOL
	)?;

opt_strict: STRICT_SYMBOL;

all_or_distinct: ALL_SYMBOL | DISTINCT_SYMBOL;

query_set_operation_type:
	UNION_SYMBOL
	| EXCEPT_SYMBOL
	| INTERSECT_SYMBOL;

// …/pipe-syntax + query-syntax#set_operators — set-op outer mode (also pipe set ops): the bytebase
// port had FULL/OUTER/LEFT; ZetaSQL also allows INNER.
opt_corresponding_outer_mode:
	FULL_SYMBOL opt_outer?
	| OUTER_SYMBOL
	| INNER_SYMBOL
	| LEFT_SYMBOL opt_outer?;

opt_outer: OUTER_SYMBOL;

with_clause:
	WITH_SYMBOL RECURSIVE_SYMBOL? with_clause_entry (
		COMMA_SYMBOL with_clause_entry
	)*;

// A WITH entry is a named subquery, or the WITH_GROUP_ROWS form `name() AS GROUP ROWS` usable inside
// an aggregate subquery (googlesql.tm with_clause_entry).
with_clause_entry:
	aliased_query
	| identifier LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL AS_SYMBOL GROUP_SYMBOL ROWS_SYMBOL;

aliased_query:
	identifier AS_SYMBOL parenthesized_query opt_aliased_query_modifiers?;

opt_aliased_query_modifiers: recursion_depth_modifier;

recursion_depth_modifier:
	WITH_SYMBOL DEPTH_SYMBOL opt_as_alias_with_required_as?
	| WITH_SYMBOL DEPTH_SYMBOL opt_as_alias_with_required_as? BETWEEN_SYMBOL
		possibly_unbounded_int_literal_or_parameter AND_SYMBOL
		possibly_unbounded_int_literal_or_parameter
	| WITH_SYMBOL DEPTH_SYMBOL opt_as_alias_with_required_as? MAX_SYMBOL
		possibly_unbounded_int_literal_or_parameter;

possibly_unbounded_int_literal_or_parameter:
	int_literal_or_parameter
	| UNBOUNDED_SYMBOL;

int_literal_or_parameter:
	integer_literal
	| parameter_expression
	| system_variable_expression;

order_by_clause: order_by_clause_prefix;

order_by_clause_prefix:
	ORDER_SYMBOL hint? BY_SYMBOL ordering_expression (
		COMMA_SYMBOL ordering_expression
	)*;

ordering_expression:
	expression collate_clause? asc_or_desc? null_order?;

select: select_clause from_clause? opt_clauses_following_from?;

opt_clauses_following_from:
	where_clause group_by_clause? having_clause? qualify_clause_nonreserved? window_clause?
	| opt_clauses_following_where;

opt_clauses_following_where:
	group_by_clause having_clause? qualify_clause_nonreserved? window_clause?
	| opt_clauses_following_group_by;

opt_clauses_following_group_by:
	having_clause qualify_clause_nonreserved? window_clause?
	| qualify_clause_nonreserved window_clause?
	| window_clause;

window_clause: window_clause_prefix;

window_clause_prefix:
	WINDOW_SYMBOL window_definition (
		COMMA_SYMBOL window_definition
	)*;

window_definition: identifier AS_SYMBOL window_specification;

where_clause: WHERE_SYMBOL expression;

having_clause: HAVING_SYMBOL expression;

group_by_clause: group_by_all | group_by_clause_prefix;

group_by_all: group_by_preamble ALL_SYMBOL;

select_clause:
	SELECT_SYMBOL hint? opt_select_with? all_or_distinct? opt_select_as_clause? select_list
	| SELECT_SYMBOL hint? opt_select_with? all_or_distinct? opt_select_as_clause? FROM_SYMBOL {this.notifyErrorListeners("Syntax error: SELECT list must not be empty", null, null)
		};

opt_select_as_clause:
	AS_SYMBOL STRUCT_SYMBOL
	| AS_SYMBOL path_expression;

opt_select_with:
	WITH_SYMBOL identifier
	| WITH_SYMBOL identifier OPTIONS_SYMBOL options_list;

// from_clause: https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#from_clause
from_clause: FROM_SYMBOL from_clause_contents;

from_clause_contents:
	table_primary from_clause_contents_suffix* {
		if (!this.joinBalanced(localContext.from_clause_contents_suffix())) this.notifyErrorListeners("Syntax error: JOIN must have an ON or USING clause", null, null);
	}
	| AT_SYMBOL {this.notifyErrorListeners("Query parameters cannot be used in place of table names",null,null)
		}
	| QUESTION_SYMBOL {this.notifyErrorListeners("Query parameters cannot be used in place of table names",null,null)
		}
	| ATAT_SYMBOL {this.notifyErrorListeners("System variables cannot be used in place of table names",null,null)
		};

from_clause_contents_suffix:
	COMMA_SYMBOL table_primary
	| opt_natural? join_type? join_hint? JOIN_SYMBOL hint? table_primary on_or_using_clause_list?;

// LATERAL allows the RHS subquery/TVF to reference earlier sources (query-syntax LATERAL).
table_primary:
	tvf_with_suffixes
	| LATERAL_SYMBOL tvf_with_suffixes
	| table_path_expression
	// table_subquery (a parenthesized query, incl. nested `((query))`) is tried before the
	// parenthesized join so `(((select 1)))` / `(table t)` parse as subqueries; only non-query
	// parenthesized content (`(a join b)`, and the invalid `(t1)`) reaches the join alt.
	| table_subquery
	| LATERAL_SYMBOL table_subquery
	| LR_BRACKET_SYMBOL join RR_BRACKET_SYMBOL
	| graph_table_query
	| table_primary match_recognize_clause
	| table_primary sample_clause;

// GRAPH_TABLE(...) operator (graph-sql-queries#graph_table_operator): a graph + a single MATCH
// with a COLUMNS shape, or a full GQL operation block (ending in RETURN).
graph_table_query:
	GRAPH_TABLE_SYMBOL LR_BRACKET_SYMBOL path_expression graph_match_operator graph_shape_clause?
		RR_BRACKET_SYMBOL as_alias?
	| GRAPH_TABLE_SYMBOL LR_BRACKET_SYMBOL path_expression graph_operation_block RR_BRACKET_SYMBOL
		as_alias?;

graph_shape_clause: COLUMNS_SYMBOL LR_BRACKET_SYMBOL select_list RR_BRACKET_SYMBOL;

tvf_with_suffixes:
	tvf_prefix_no_args RR_BRACKET_SYMBOL hint? pivot_or_unpivot_clause_and_aliases?
	| tvf_prefix RR_BRACKET_SYMBOL hint? pivot_or_unpivot_clause_and_aliases?;

// Bare QUALIFY (no WHERE/GROUP BY/HAVING) is valid BigQuery — …/query-syntax#qualify_clause;
// the upstream error actions predate that. The clause still lands here (after the table
// alias) because opt_clauses_following_from only reaches QUALIFY via WHERE/GROUP BY/HAVING.
pivot_or_unpivot_clause_and_aliases:
	// QUALIFY is nonreserved in GoogleSQL, so it may be a bare table alias (`FROM t QUALIFY`,
	// `FROM t AS QUALIFY`); LL prediction still routes `QUALIFY <expr>` to the qualify clause below.
	AS_SYMBOL (identifier | QUALIFY_SYMBOL)
	| identifier
	| QUALIFY_SYMBOL
	| AS_SYMBOL identifier pivot_clause as_alias?
	| AS_SYMBOL identifier unpivot_clause as_alias?
	| AS_SYMBOL identifier qualify_clause_nonreserved
	| identifier pivot_clause as_alias
	| identifier unpivot_clause as_alias
	| identifier qualify_clause_nonreserved
	| pivot_clause as_alias?
	| unpivot_clause as_alias?
	| qualify_clause_nonreserved;

as_alias: AS_SYMBOL? identifier;

// …/query-syntax#tablesample_operator — REPEATABLE/WITH WEIGHT suffix is optional.
sample_clause:
	TABLESAMPLE_SYMBOL identifier LR_BRACKET_SYMBOL sample_size RR_BRACKET_SYMBOL
		opt_sample_clause_suffix?;

opt_sample_clause_suffix:
	repeatable_clause
	| WITH_SYMBOL WEIGHT_SYMBOL repeatable_clause?
	| WITH_SYMBOL WEIGHT_SYMBOL identifier repeatable_clause?
	| WITH_SYMBOL WEIGHT_SYMBOL AS_SYMBOL identifier repeatable_clause?;

repeatable_clause:
	REPEATABLE_SYMBOL LR_BRACKET_SYMBOL possibly_cast_int_literal_or_parameter RR_BRACKET_SYMBOL;

possibly_cast_int_literal_or_parameter:
	cast_int_literal_or_parameter
	| int_literal_or_parameter;

cast_int_literal_or_parameter:
	CAST_SYMBOL LR_BRACKET_SYMBOL int_literal_or_parameter AS_SYMBOL type opt_format?
		RR_BRACKET_SYMBOL;

sample_size:
	sample_size_value sample_size_unit partition_by_clause_prefix_no_hint?;

sample_size_value:
	possibly_cast_int_literal_or_parameter
	| floating_point_literal;

sample_size_unit: ROWS_SYMBOL | PERCENT_SYMBOL;

partition_by_clause_prefix_no_hint:
	PARTITION_SYMBOL BY_SYMBOL expression (
		COMMA_SYMBOL expression
	)*;

// query-syntax MATCH_RECOGNIZE — ORDER BY / MEASURES / DEFINE mandatory; PARTITION BY, AFTER MATCH
// SKIP, OPTIONS, alias optional. (ZetaSQL has no ONE/ALL ROWS PER MATCH, PERMUTE, CLASSIFIER, etc.)
match_recognize_clause:
	MATCH_RECOGNIZE_SYMBOL LR_BRACKET_SYMBOL partition_by_clause_prefix? order_by_clause
		MEASURES_SYMBOL select_list_prefix_with_as_aliases after_match_skip_clause? PATTERN_SYMBOL
		LR_BRACKET_SYMBOL row_pattern_expr RR_BRACKET_SYMBOL DEFINE_SYMBOL
		with_expression_variable_prefix opt_options_list? RR_BRACKET_SYMBOL as_alias?;

after_match_skip_clause:
	AFTER_SYMBOL MATCH_SYMBOL SKIP_SYMBOL PAST_SYMBOL LAST_SYMBOL ROW_SYMBOL
	| AFTER_SYMBOL MATCH_SYMBOL SKIP_SYMBOL TO_SYMBOL NEXT_SYMBOL ROW_SYMBOL;

// `|` alternation (and `||` = alternate-with-empty); concatenation by juxtaposition.
row_pattern_expr:
	row_pattern_concatenation_or_empty
	| row_pattern_expr STROKE_SYMBOL row_pattern_concatenation_or_empty
	| row_pattern_expr BOOL_OR_SYMBOL row_pattern_concatenation_or_empty;

row_pattern_concatenation_or_empty: row_pattern_concatenation?;

row_pattern_concatenation:
	row_pattern_factor
	| row_pattern_concatenation row_pattern_factor;

row_pattern_factor:
	row_pattern_primary row_pattern_quantifier?
	| CIRCUMFLEX_SYMBOL // ^ start anchor
	| DOLLAR_SYMBOL; // $ end anchor

row_pattern_primary:
	identifier
	| LR_BRACKET_SYMBOL row_pattern_expr RR_BRACKET_SYMBOL;

// *, +, ?, {n}, {m,n} with optional reluctant `?`.
row_pattern_quantifier:
	(MULTIPLY_OPERATOR | PLUS_OPERATOR | QUESTION_SYMBOL) QUESTION_SYMBOL?
	| LC_BRACKET_SYMBOL int_literal_or_parameter? COMMA_SYMBOL int_literal_or_parameter?
		RC_BRACKET_SYMBOL QUESTION_SYMBOL?
	| LC_BRACKET_SYMBOL int_literal_or_parameter RC_BRACKET_SYMBOL;

select_list_prefix_with_as_aliases:
	select_column_expr_with_as_alias (
		COMMA_SYMBOL select_column_expr_with_as_alias
	)*;

select_column_expr_with_as_alias:
	expression AS_SYMBOL identifier;

table_subquery:
	parenthesized_query opt_pivot_or_unpivot_clause_and_alias?;

// `join` only appears parenthesized — `( a JOIN b … )`. A parenthesized single table or a
// double-parenthesized join is invalid (`(t1)`, `((a join b))`), so require at least one join_item.
join: table_primary join_item* {
		if (localContext.join_item().length === 0) this.notifyErrorListeners("Syntax error: Expected keyword JOIN", null, null);
		else if (!this.joinBalanced(localContext.join_item())) this.notifyErrorListeners("Syntax error: JOIN must have an ON or USING clause", null, null);
	};

// join_item resolves the mutually left-recursive for [join, join_input]. join_input: join |
// table_primary;
join_item:
	opt_natural? join_type? join_hint? JOIN_SYMBOL hint? table_primary on_or_using_clause_list?;


on_or_using_clause_list: on_or_using_clause+;

on_or_using_clause: on_clause | using_clause;

// JOIN … USING (col, col, …) — a comma-separated column list (the port had a dotted path here).
using_clause:
	USING_SYMBOL LR_BRACKET_SYMBOL identifier (
		COMMA_SYMBOL identifier
	)* RR_BRACKET_SYMBOL;

join_hint: HASH_SYMBOL | LOOKUP_SYMBOL;

// googlesql.tm table_path_expression: WITH OFFSET precedes PIVOT/UNPIVOT, and PIVOT/UNPIVOT may not
// be followed by WITH OFFSET or FOR SYSTEM TIME (the spec errors on pivot + at_system_time, and offset
// has no slot after pivot). We model the mutual exclusion structurally by splitting on pivot presence:
// the pivot-bearing alternative offers no trailing offset/time, the non-pivot one keeps both.
table_path_expression:
	table_path_expression_base hint? opt_with_offset_and_alias? table_path_pivot_suffix
	| table_path_expression_base hint? table_path_alias_or_qualify? opt_with_offset_and_alias?
		opt_at_system_time?;

table_path_pivot_suffix:
	AS_SYMBOL identifier pivot_clause as_alias?
	| AS_SYMBOL identifier unpivot_clause as_alias?
	| identifier pivot_clause as_alias?
	| identifier unpivot_clause as_alias?
	| pivot_clause as_alias?
	| unpivot_clause as_alias?;

table_path_alias_or_qualify:
	AS_SYMBOL identifier qualify_clause_nonreserved
	| identifier qualify_clause_nonreserved
	| qualify_clause_nonreserved
	// QUALIFY is nonreserved in GoogleSQL, so it may itself be the table alias (`FROM t QUALIFY`,
	// `FROM t AS QUALIFY`); the `qualify_clause_nonreserved` alts above are tried first, so a real
	// `QUALIFY <expr>` clause still wins over a bare-QUALIFY alias.
	| AS_SYMBOL (identifier | QUALIFY_SYMBOL)
	| identifier
	| QUALIFY_SYMBOL;

opt_at_system_time:
	FOR_SYMBOL SYSTEM_SYMBOL TIME_SYMBOL AS_SYMBOL OF_SYMBOL expression
	| FOR_SYMBOL SYSTEM_TIME_SYMBOL AS_SYMBOL OF_SYMBOL expression;

opt_with_offset_and_alias: WITH_SYMBOL OFFSET_SYMBOL as_alias?;

// Bare QUALIFY is valid BigQuery — see pivot_or_unpivot_clause_and_aliases above.
opt_pivot_or_unpivot_clause_and_alias:
	AS_SYMBOL identifier
	| identifier
	| AS_SYMBOL identifier pivot_clause as_alias?
	| AS_SYMBOL identifier unpivot_clause as_alias?
	| AS_SYMBOL identifier qualify_clause_nonreserved
	| identifier pivot_clause as_alias?
	| identifier unpivot_clause as_alias?
	| identifier qualify_clause_nonreserved
	| pivot_clause as_alias?
	| unpivot_clause as_alias?
	| qualify_clause_nonreserved;

table_path_expression_base:
	unnest_expression
	| maybe_slashed_or_dashed_path_expression
	| path_expression LS_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Array element access is not allowed in the FROM clause without UNNEST; Use UNNEST(<expression>)",null,null)
		}
	| path_expression DOT_SYMBOL LR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Generalized field access is not allowed in the FROM clause without UNNEST; Use UNNEST(<expression>)",null,null)
		}
	| unnest_expression LS_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Array element access is not allowed in the FROM clause without UNNEST; Use UNNEST(<expression>)",null,null)
		}
	| unnest_expression DOT_SYMBOL LR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Generalized field access is not allowed in the FROM clause without UNNEST; Use UNNEST(<expression>)",null,null)
		};

maybe_slashed_or_dashed_path_expression:
	maybe_dashed_path_expression
	| slashed_path_expression;

maybe_dashed_path_expression:
	path_expression
	| dashed_path_expression;

dashed_path_expression:
	dashed_identifier
	| dashed_path_expression DOT_SYMBOL identifier;

// googlesql.tm dashed_identifier: a dash-separated path component (`my-project`, `a-3-b`, `db-1-2`). The
// recursive alts APPEND one component at a time (`dashed_identifier "-" identifier`), so an odd-length
// chain ending in a plain identifier (`a-3-b` = `((a-3)-b)`) parses — not `dashed_identifier "-"
// dashed_identifier`, which would wrongly require the trailing component to itself be dashed.
dashed_identifier:
	identifier MINUS_OPERATOR identifier
	| dashed_identifier MINUS_OPERATOR identifier
	| identifier MINUS_OPERATOR INTEGER_LITERAL
	| dashed_identifier MINUS_OPERATOR INTEGER_LITERAL
	| identifier MINUS_OPERATOR floating_point_literal identifier
	| dashed_identifier MINUS_OPERATOR floating_point_literal identifier;

slashed_identifier:
	SLASH_SYMBOL identifier_or_integer
	| slashed_identifier slashed_identifier_separator identifier_or_integer
	| slashed_identifier slashed_identifier_separator floating_point_literal
		slashed_identifier_separator identifier_or_integer;

identifier_or_integer:
	identifier
	| INTEGER_LITERAL; // TODO(zp): SCRIPT_LABEL;

slashed_identifier_separator:
	MINUS_OPERATOR SLASH_SYMBOL COLON_SYMBOL;

slashed_path_expression:
	slashed_identifier
	| slashed_identifier slashed_identifier_separator floating_point_literal identifier;

unnest_expression:
	unnest_expression_prefix opt_array_zip_mode? RR_BRACKET_SYMBOL
	| UNNEST_SYMBOL LR_BRACKET_SYMBOL SELECT_SYMBOL {this.notifyErrorListeners("The argument to UNNEST is an expression, not a query; to use a query as an expression, the query must be wrapped with additional parentheses to make it a scalar subquery expression", null, null)
		};

unnest_expression_prefix:
	UNNEST_SYMBOL LR_BRACKET_SYMBOL expression_with_opt_alias (
		COMMA_SYMBOL expression_with_opt_alias
	)*;

opt_array_zip_mode: COMMA_SYMBOL named_argument;

expression_with_opt_alias:
	expression opt_as_alias_with_required_as?;

tvf_prefix:
	tvf_prefix_no_args tvf_argument (COMMA_SYMBOL tvf_argument)*;

tvf_argument:
	expression
	| descriptor_argument
	| table_clause
	| model_clause
	| connection_clause
	| named_argument
	// INPUT TABLE: the pipe input passed as a TVF table arg (PIPE_CALL_INPUT_TABLE).
	| INPUT_SYMBOL TABLE_SYMBOL
	| LR_BRACKET_SYMBOL table_clause RR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Table arguments for table-valued function calls written as \"TABLE path\" must not be enclosed in parentheses. To fix this, replace (TABLE path) with TABLE path",null,null)
		}
	| LR_BRACKET_SYMBOL model_clause RR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Model arguments for table-valued function calls written as \"MODEL path\" must not be enclosed in parentheses. To fix this, replace (MODEL path) with MODEL path",null,null)
		}
	| LR_BRACKET_SYMBOL connection_clause RR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Connection arguments for table-valued function calls written as \"CONNECTION path\" must not be enclosed in parentheses. To fix this, replace (CONNECTION path) with CONNECTION path",null,null)
		}
	| LR_BRACKET_SYMBOL named_argument RR_BRACKET_SYMBOL {this.notifyErrorListeners("Syntax error: Named arguments for table-valued function calls written as \"name => value\" must not be enclosed in parentheses. To fix this, replace (name => value) with name => value",null,null)
		}
	| SELECT_SYMBOL {this.notifyErrorListeners("Syntax error: Each subquery argument for table-valued function calls must be enclosed in parentheses. To fix this, replace SELECT... with (SELECT...)",null,null)
		}
	| WITH_SYMBOL {this.notifyErrorListeners("Syntax error: Each subquery argument for table-valued function calls must be enclosed in parentheses. To fix this, replace WITH... with (WITH...)",null,null)
		};

connection_clause: CONNECTION_SYMBOL path_expression_or_default;

path_expression_or_default: path_expression | DEFAULT_SYMBOL;

descriptor_argument:
	DESCRIPTOR_SYMBOL LR_BRACKET_SYMBOL descriptor_column_list RR_BRACKET_SYMBOL;

descriptor_column_list:
	descriptor_column (COMMA_SYMBOL descriptor_column)*;

descriptor_column: identifier;

// TABLE <tvf|path> with an optional trailing WHERE (googlesql.tm table_clause_no_keyword:
// `path_expression opt_where_clause` / `tvf as_alias? pivot? opt_where_clause`). ZetaSQL's PARSER
// accepts the WHERE and a later pass rejects it ("TABLE clause with WHERE is not supported"), so the
// parse must succeed; tvf_with_suffixes already carries the alias/pivot suffixes.
table_clause:
	TABLE_SYMBOL tvf_with_suffixes where_clause?
	| TABLE_SYMBOL path_expression where_clause?;

model_clause: MODEL_SYMBOL path_expression;

qualify_clause_nonreserved: QUALIFY_SYMBOL expression;

unpivot_clause:
	UNPIVOT_SYMBOL unpivot_nulls_filter? LR_BRACKET_SYMBOL path_expression_list_with_opt_parens
		FOR_SYMBOL path_expression IN_SYMBOL unpivot_in_item_list RR_BRACKET_SYMBOL;

unpivot_in_item_list:
	unpivot_in_item_list_prefix RR_BRACKET_SYMBOL;

unpivot_in_item_list_prefix:
	LR_BRACKET_SYMBOL unpivot_in_item
	| unpivot_in_item_list_prefix COMMA_SYMBOL unpivot_in_item;

unpivot_in_item:
	path_expression_list_with_opt_parens opt_as_string_or_integer?;

opt_as_string_or_integer:
	AS_SYMBOL? string_literal
	| AS_SYMBOL? integer_literal;

path_expression_list_with_opt_parens:
	LR_BRACKET_SYMBOL path_expression_list RR_BRACKET_SYMBOL
	| path_expression_list;

path_expression_list:
	path_expression (COMMA_SYMBOL path_expression)*;

unpivot_nulls_filter:
	EXCLUDE_SYMBOL NULLS_SYMBOL
	| INCLUDE_SYMBOL NULLS_SYMBOL;

pivot_clause:
	PIVOT_SYMBOL LR_BRACKET_SYMBOL pivot_expression_list FOR_SYMBOL expression_higher_prec_than_and
		IN_SYMBOL LR_BRACKET_SYMBOL pivot_value_list RR_BRACKET_SYMBOL RR_BRACKET_SYMBOL {
		// The FOR target must not itself be an IN-expression — `FOR y IN (1,2) IN (…)` greedily binds the
		// first IN to the target, but ZetaSQL takes it as the pivot's IN and rejects the second
		// ("Expected ")" but got keyword IN"). Reject a FOR target whose top operator is IN.
		if (localContext.expression_higher_prec_than_and()?.in_operator?.()) this.notifyErrorListeners("Syntax error: Expected \")\" but got keyword IN", null, null);
	};

pivot_expression_list:
	pivot_expression (COMMA_SYMBOL pivot_expression)*;

pivot_expression: expression as_alias?;

pivot_value_list: pivot_value (COMMA_SYMBOL pivot_value)*;

pivot_value: expression as_alias?;

// docs.cloud.google.com/bigquery/docs/table-functions — the TVF name is followed by '('.
// (The upstream port dropped the paren on the path_expression alternative, which made every
// TVF call in FROM unparseable.)
tvf_prefix_no_args:
	path_expression LR_BRACKET_SYMBOL
	| IF_SYMBOL LR_BRACKET_SYMBOL;

join_type:
	CROSS_SYMBOL
	| FULL_SYMBOL opt_outer?
	| INNER_SYMBOL
	| LEFT_SYMBOL opt_outer?
	| RIGHT_SYMBOL opt_outer?;

opt_natural: NATURAL_SYMBOL;

on_clause:
	ON_SYMBOL expression /* Actullay, this should be bool_expression */;

select_list:
	select_list_item (COMMA_SYMBOL select_list_item)* COMMA_SYMBOL?;

select_list_item:
	select_column_expr
	| select_column_dot_star
	| select_column_star;

select_column_star: MULTIPLY_OPERATOR star_modifiers?;

select_column_expr:
	expression
	| select_column_expr_with_as_alias
	| expression identifier;

select_column_dot_star:
	expression_higher_prec_than_and DOT_SYMBOL MULTIPLY_OPERATOR star_modifiers?;

star_modifiers:
	star_except_list
	| star_except_list? star_replace_list;

star_except_list:
	EXCEPT_SYMBOL LR_BRACKET_SYMBOL identifier (
		COMMA_SYMBOL identifier
	)* RR_BRACKET_SYMBOL;

star_replace_list:
	REPLACE_SYMBOL LR_BRACKET_SYMBOL star_replace_item (
		COMMA_SYMBOL star_replace_item
	)* RR_BRACKET_SYMBOL;

star_replace_item: expression AS_SYMBOL identifier;

// expression: https://github.com/google/zetasql/blob/194cd32b5d766d60e3ca442651d792c7fe54ea74/zetasql/parser/bison_parser.y#L7712
expression:
	expression_higher_prec_than_and
	| and_expression
	| expression OR_SYMBOL expression;

// expression_higher_prec_than_and: https://github.com/google/zetasql/blob/194cd32b5d766d60e3ca442651d792c7fe54ea74/zetasql/parser/bison_parser.y#L7747
expression_higher_prec_than_and:
	// unparenthesized_expression_higher_prec_than_and scope begin
	null_literal
	| boolean_literal
	| string_literal
	| bytes_literal
	| integer_literal
	| numeric_literal
	| bignumeric_literal
	| json_literal
	| floating_point_literal
	| date_or_time_literal
	| range_literal
	| parameter_expression
	| system_variable_expression
	| array_constructor
	| new_constructor
	| braced_constructor
	| braced_new_constructor
	// UPDATE constructor: a function call followed by a braced field block — `UPDATE(p) {f:10}`
	// (googlesql.tm: function_call_expression braced_constructor → ASTUpdateConstructor).
	| function_call_expression_with_clauses braced_constructor
	| struct_braced_constructor
	| case_expression
	| cast_expression
	| extract_expression
	| with_expression
	| replace_fields_expression
	| function_call_expression_with_clauses
	| interval_expression
	| identifier
	| struct_constructor
	| expression_subquery_with_keyword
	| expression_higher_prec_than_and LS_BRACKET_SYMBOL expression RS_BRACKET_SYMBOL
	| expression_higher_prec_than_and DOT_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
	// Chained function call: base.method(args) — functions-reference#chained_function_calls.
	// NOTE: a trailing braced UPDATE constructor `(p).update() {f: v}` (googlesql.tm
	// function_call_expression_with_clauses: function_call_expression braced_constructor) is NOT modelled
	// here — adding an optional braced_constructor to this left-recursive alt destabilised ATN prediction
	// on deeply-nested scalar subqueries (a real parse regression), and the clean fix needs the chained
	// call to flow through function_call_expression_with_clauses. Enumerated as an Open Gap
	// (chained_function_call_special_cases_18 in the analyzer corpus); the plain-call form is covered by
	// the function_call_expression_with_clauses braced_constructor alt above.
	| expression_higher_prec_than_and DOT_SYMBOL (
		dot_identifier
		| function_name_from_keyword
	) LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix {
		if (this.exprIsBareNumeric(localContext.expression_higher_prec_than_and(0)) || /^@@/.test(localContext.expression_higher_prec_than_and(0)?.getText?.() ?? "")) this.notifyErrorListeners("Syntax error: Unexpected \"(\"", null, null);
	}
	// Chained call on a generalized field: base.(pkg.ext)(args).
	| expression_higher_prec_than_and DOT_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
		LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix
	| expression_higher_prec_than_and DOT_SYMBOL dot_identifier
	| NOT_SYMBOL expression_higher_prec_than_and
	| expression_higher_prec_than_and like_operator any_some_all hint? unnest_expression
	| expression_higher_prec_than_and like_operator any_some_all hint?
		parenthesized_anysomeall_list_in_rhs
	| expression_higher_prec_than_and like_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of LIKE must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and distinct_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and in_operator hint? unnest_expression {
		if (localContext.hint() !== null) {
			this.notifyErrorListeners("Syntax error: HINTs cannot be specified on IN clause with UNNEST", null, null)
		}
	}
	| expression_higher_prec_than_and in_operator hint? parenthesized_in_rhs
	| expression_higher_prec_than_and between_operator expression_higher_prec_than_and AND_SYMBOL
		expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of BETWEEN must be parenthesized", null, null)
		}
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(2))) {
			this.notifyErrorListeners("Syntax error: Expression in BETWEEN must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1)) ||
			this.exprIsBareNot(localContext.expression_higher_prec_than_and(2))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and between_operator expression_higher_prec_than_and OR_SYMBOL {
		this.notifyErrorListeners("Syntax error: Expression in BETWEEN must be parenthesized", null, null)
	}
	| expression_higher_prec_than_and is_operator UNKNOWN_SYMBOL {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and is_operator null_literal {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and is_operator boolean_literal {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	// Graph predicates (graph-sql-functions): IS [NOT] SOURCE/DESTINATION [OF], IS [NOT] LABELED.
	| expression_higher_prec_than_and IS_SYMBOL NOT_SYMBOL? (SOURCE_SYMBOL | DESTINATION_SYMBOL)
		OF_SYMBOL? expression_higher_prec_than_and
	| expression_higher_prec_than_and IS_SYMBOL NOT_SYMBOL? LABELED_SYMBOL label_expression
	| expression_higher_prec_than_and in_operator braced_graph_subquery
	| expression_higher_prec_than_and comparative_operator any_some_all hint? unnest_expression {
		if (localContext.hint()) this.notifyErrorListeners("Syntax error: HINTs cannot be specified on ANY/SOME/ALL clause with UNNEST", null, null)
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) this.notifyErrorListeners("Syntax error: comparison operator cannot be chained", null, null)
	}
	| expression_higher_prec_than_and comparative_operator any_some_all hint?
		parenthesized_anysomeall_list_in_rhs {
		if (localContext.hint() && !localContext.parenthesized_anysomeall_list_in_rhs()?.parenthesized_query()) this.notifyErrorListeners("Syntax error: HINTs cannot be specified on ANY/SOME/ALL clause with value list", null, null)
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) this.notifyErrorListeners("Syntax error: comparison operator cannot be chained", null, null)
	}
	| expression_higher_prec_than_and comparative_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of comparison must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and STROKE_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and CIRCUMFLEX_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and BIT_AND_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and BOOL_OR_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and shift_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and additive_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and multiplicative_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| unary_operator expression_higher_prec_than_and
	// unparenthesized_expression_higher_prec_than_and scope end
	| parenthesized_expression_not_a_query
	| parenthesized_query;

expression_maybe_parenthesized_not_a_query:
	parenthesized_expression_not_a_query
	// unparenthesized_expression_higher_prec_than_and scope begin
	| null_literal
	| boolean_literal
	| string_literal
	| bytes_literal
	| integer_literal
	| numeric_literal
	| bignumeric_literal
	| json_literal
	| floating_point_literal
	| date_or_time_literal
	| range_literal
	| parameter_expression
	| system_variable_expression
	| array_constructor
	| new_constructor
	| braced_constructor
	| braced_new_constructor
	// UPDATE constructor: a function call followed by a braced field block — `UPDATE(p) {f:10}`
	// (googlesql.tm: function_call_expression braced_constructor → ASTUpdateConstructor).
	| function_call_expression_with_clauses braced_constructor
	| struct_braced_constructor
	| case_expression
	| cast_expression
	| extract_expression
	| with_expression
	| replace_fields_expression
	| function_call_expression_with_clauses
	| interval_expression
	| identifier
	| struct_constructor
	| expression_subquery_with_keyword
	| expression_higher_prec_than_and LS_BRACKET_SYMBOL expression RS_BRACKET_SYMBOL
	| expression_higher_prec_than_and DOT_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
	// Chained function call (see expression_higher_prec_than_and).
	| expression_higher_prec_than_and DOT_SYMBOL (
		dot_identifier
		| function_name_from_keyword
	) LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix {
		if (this.exprIsBareNumeric(localContext.expression_higher_prec_than_and(0)) || /^@@/.test(localContext.expression_higher_prec_than_and(0)?.getText?.() ?? "")) this.notifyErrorListeners("Syntax error: Unexpected \"(\"", null, null);
	}
	// Chained call on a generalized field: base.(pkg.ext)(args).
	| expression_higher_prec_than_and DOT_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
		LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix
	| expression_higher_prec_than_and DOT_SYMBOL dot_identifier
	| NOT_SYMBOL expression_higher_prec_than_and
	| expression_higher_prec_than_and like_operator any_some_all hint? unnest_expression
	| expression_higher_prec_than_and like_operator any_some_all hint?
		parenthesized_anysomeall_list_in_rhs
	| expression_higher_prec_than_and like_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of LIKE must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and distinct_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and in_operator hint? unnest_expression {
		if (localContext.hint() !== null) {
			this.notifyErrorListeners("Syntax error: HINTs cannot be specified on IN clause with UNNEST", null, null)
		}
	}
	| expression_higher_prec_than_and in_operator hint? parenthesized_in_rhs
	| expression_higher_prec_than_and between_operator expression_higher_prec_than_and AND_SYMBOL
		expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of BETWEEN must be parenthesized", null, null)
		}
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(2))) {
			this.notifyErrorListeners("Syntax error: Expression in BETWEEN must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1)) ||
			this.exprIsBareNot(localContext.expression_higher_prec_than_and(2))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and between_operator expression_higher_prec_than_and OR_SYMBOL {
		this.notifyErrorListeners("Syntax error: Expression in BETWEEN must be parenthesized", null, null)
	}
	| expression_higher_prec_than_and is_operator UNKNOWN_SYMBOL {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and is_operator null_literal {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	| expression_higher_prec_than_and is_operator boolean_literal {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of IS must be parenthesized", null, null)
		}
	}
	// Graph predicates (also valid inside parentheses, e.g. GRAPH_TABLE COLUMNS((a IS SOURCE OF b))).
	| expression_higher_prec_than_and IS_SYMBOL NOT_SYMBOL? (SOURCE_SYMBOL | DESTINATION_SYMBOL)
		OF_SYMBOL? expression_higher_prec_than_and
	| expression_higher_prec_than_and IS_SYMBOL NOT_SYMBOL? LABELED_SYMBOL label_expression
	| expression_higher_prec_than_and in_operator braced_graph_subquery
	| expression_higher_prec_than_and comparative_operator any_some_all hint? unnest_expression {
		if (localContext.hint()) this.notifyErrorListeners("Syntax error: HINTs cannot be specified on ANY/SOME/ALL clause with UNNEST", null, null)
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) this.notifyErrorListeners("Syntax error: comparison operator cannot be chained", null, null)
	}
	| expression_higher_prec_than_and comparative_operator any_some_all hint?
		parenthesized_anysomeall_list_in_rhs {
		if (localContext.hint() && !localContext.parenthesized_anysomeall_list_in_rhs()?.parenthesized_query()) this.notifyErrorListeners("Syntax error: HINTs cannot be specified on ANY/SOME/ALL clause with value list", null, null)
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0))) this.notifyErrorListeners("Syntax error: comparison operator cannot be chained", null, null)
	}
	| expression_higher_prec_than_and comparative_operator expression_higher_prec_than_and {
		if (this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(0)) ||
			this.exprIsComparisonFamily(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Expression to the left of comparison must be parenthesized", null, null)
		}
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and STROKE_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and CIRCUMFLEX_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and BIT_AND_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and BOOL_OR_SYMBOL expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and shift_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and additive_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| expression_higher_prec_than_and multiplicative_operator expression_higher_prec_than_and {
		if (this.exprIsBareNot(localContext.expression_higher_prec_than_and(1))) {
			this.notifyErrorListeners("Syntax error: Unexpected NOT", null, null)
		}
	}
	| unary_operator expression_higher_prec_than_and
	// unparenthesized_expression_higher_prec_than_and scope end
	| and_expression
	// Previous or_expression, replace by solving mutually left-recursive.
	| expression OR_SYMBOL expression;

parenthesized_in_rhs:
	parenthesized_query
	| LR_BRACKET_SYMBOL expression_maybe_parenthesized_not_a_query RR_BRACKET_SYMBOL
	| in_list_two_or_more_prefix RR_BRACKET_SYMBOL;

unary_operator:
	PLUS_OPERATOR
	| MINUS_OPERATOR
	| BITWISE_NOT_OPERATOR;

comparative_operator:
	EQUAL_OPERATOR
	| NOT_EQUAL_OPERATOR
	| NOT_EQUAL2_OPERATOR
	| LT_OPERATOR
	| LE_OPERATOR
	| GT_OPERATOR
	| GE_OPERATOR;

// '>>' is lexed as two '>' so nested generics close (ARRAY<STRUCT<INT64>>); recombine here.
shift_operator: KL_OPERATOR | GT_OPERATOR GT_OPERATOR;

additive_operator: PLUS_OPERATOR | MINUS_OPERATOR;

multiplicative_operator: MULTIPLY_OPERATOR | DIVIDE_OPERATOR;

is_operator: IS_SYMBOL NOT_SYMBOL?;

between_operator: NOT_SYMBOL? BETWEEN_SYMBOL;

in_operator: NOT_SYMBOL? IN_SYMBOL;

distinct_operator:
	IS_SYMBOL NOT_SYMBOL? DISTINCT_SYMBOL FROM_SYMBOL;

parenthesized_query: LR_BRACKET_SYMBOL query RR_BRACKET_SYMBOL;

parenthesized_expression_not_a_query:
	LR_BRACKET_SYMBOL (
		expression_maybe_parenthesized_not_a_query
	) RR_BRACKET_SYMBOL;

parenthesized_anysomeall_list_in_rhs:
	parenthesized_query
	| parenthesized_expression_not_a_query
	| in_list_two_or_more_prefix RR_BRACKET_SYMBOL;

and_expression:
	expression_higher_prec_than_and AND_SYMBOL expression_higher_prec_than_and (
		AND_SYMBOL expression_higher_prec_than_and
	)*;

in_list_two_or_more_prefix:
	LR_BRACKET_SYMBOL expression COMMA_SYMBOL expression (
		COMMA_SYMBOL expression
	)*;

any_some_all: ANY_SYMBOL | SOME_SYMBOL | ALL_SYMBOL;

like_operator: LIKE_SYMBOL | NOT_SYMBOL LIKE_SYMBOL;

expression_subquery_with_keyword:
	ARRAY_SYMBOL parenthesized_query
	| ARRAY_SYMBOL braced_graph_subquery
	| VALUE_SYMBOL hint? braced_graph_subquery
	| EXISTS_SYMBOL hint? parenthesized_query
	| EXISTS_SYMBOL hint? braced_graph_subquery
	| EXISTS_SYMBOL hint? LC_BRACKET_SYMBOL graph_pattern RC_BRACKET_SYMBOL
	| EXISTS_SYMBOL hint? LC_BRACKET_SYMBOL graph_linear_operator_list RC_BRACKET_SYMBOL
	| EXISTS_SYMBOL hint? LC_BRACKET_SYMBOL GRAPH_SYMBOL path_expression graph_pattern
		RC_BRACKET_SYMBOL
	| EXISTS_SYMBOL hint? LC_BRACKET_SYMBOL GRAPH_SYMBOL path_expression graph_linear_operator_list
		RC_BRACKET_SYMBOL;

struct_constructor:
	struct_constructor_prefix_with_keyword RR_BRACKET_SYMBOL
	| struct_constructor_prefix_with_keyword_no_arg RR_BRACKET_SYMBOL
	| struct_constructor_prefix_without_keyword RR_BRACKET_SYMBOL;

struct_constructor_prefix_with_keyword:
	struct_constructor_prefix_with_keyword_no_arg struct_constructor_arg (
		COMMA_SYMBOL struct_constructor_arg
	)*;

struct_constructor_arg:
	expression opt_as_alias_with_required_as?;

struct_constructor_prefix_without_keyword:
	LR_BRACKET_SYMBOL expression COMMA_SYMBOL expression (
		COMMA_SYMBOL expression
	)*;

struct_constructor_prefix_with_keyword_no_arg:
	struct_type LR_BRACKET_SYMBOL
	| STRUCT_SYMBOL LR_BRACKET_SYMBOL;

interval_expression:
	INTERVAL_SYMBOL expression identifier (TO_SYMBOL identifier)?;

function_call_expression_with_clauses:
	// NOTE: zetasql bison.y is LALR(1) parser, it checks the first rule should be path_expression
	// in action code instead of use expression directly to avoid parser ambiguous.
	path_expression LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix {
		// REPLACE_FIELDS( always commits to the dedicated replace_fields_expression rule (googlesql.tm
		// AMBIGUOUS CASE 4); a general call named `replace_fields` means the arg list wasn't the required
		// `expr, value AS path …` form — e.g. `replace_fields()`, `replace_fields(p)` — which is an error.
		if (/^replace_fields$/i.test(localContext.path_expression()?.getText?.() ?? "")) this.notifyErrorListeners("Syntax error: Expected \"AS\"", null, null);
	}
	// function_name_from_keyword "(" opt_distinct (IF/GROUPING etc. as aggregate calls — googlesql.tm).
	| function_name_from_keyword LR_BRACKET_SYMBOL DISTINCT_SYMBOL? function_call_expression_with_clauses_suffix;

function_call_expression_with_clauses_suffix:
	(
		// Empty argument list — same modifier set as the non-empty form minus clamped_between (which
		// requires at least one argument): [IGNORE|RESPECT NULLS] [WHERE] [GROUP BY/HAVING] [WITH
		// REPORT] [ORDER BY] [LIMIT] (googlesql.tm function_call_expression, empty-arg-list rule).
		opt_null_handling_modifier? where_clause? opt_having_or_group_by_modifier? with_report_modifier?
			order_by_clause? limit_offset_clause? RR_BRACKET_SYMBOL
		// Non empty argument list. Modifier order per ZetaSQL aggregate-call grammar:
		// [IGNORE|RESPECT NULLS] [WHERE …] [GROUP BY … / HAVING …] [CLAMPED BETWEEN …]
		// [WITH REPORT …] [ORDER BY …] [LIMIT …] — WHERE (aggregate filtering) and the
		// full GROUP BY / boolean HAVING (multi-level aggregation) are ZetaSQL surface
		// the corpus exercises.
		| (
			(function_call_argument | MULTIPLY_OPERATOR) (
				COMMA_SYMBOL function_call_argument
			)*
		) opt_null_handling_modifier? where_clause? opt_having_or_group_by_modifier?
			clamped_between_modifier? with_report_modifier? order_by_clause? limit_offset_clause?
			RR_BRACKET_SYMBOL
	) hint? with_group_rows? over_clause?;

over_clause: OVER_SYMBOL window_specification;

window_specification:
	identifier
	| LR_BRACKET_SYMBOL identifier? partition_by_clause? order_by_clause? opt_window_frame_clause?
		RR_BRACKET_SYMBOL;

opt_window_frame_clause:
	frame_unit BETWEEN_SYMBOL window_frame_bound AND_SYMBOL window_frame_bound
	| frame_unit window_frame_bound;

window_frame_bound:
	UNBOUNDED_SYMBOL preceding_or_following
	| CURRENT_SYMBOL ROW_SYMBOL
	| expression preceding_or_following;

preceding_or_following: PRECEDING_SYMBOL | FOLLOWING_SYMBOL;

frame_unit: ROWS_SYMBOL | RANGE_SYMBOL;

partition_by_clause: partition_by_clause_prefix;

partition_by_clause_prefix:
	PARTITION_SYMBOL hint? BY_SYMBOL expression (
		COMMA_SYMBOL expression
	)*;

with_group_rows:
	WITH_SYMBOL GROUP_SYMBOL ROWS_SYMBOL /* XXX(zp): query = parenthesized_query*/;

// Anonymization WITH REPORT — the OPTIONS(...) format is optional (e.g. anon_avg(* WITH REPORT)).
with_report_modifier:
	WITH_SYMBOL REPORT_SYMBOL with_report_format?;

// ZetaSQL anonymization: CLAMPED BETWEEN low AND high (the port dropped BETWEEN).
clamped_between_modifier:
	CLAMPED_SYMBOL BETWEEN_SYMBOL expression_higher_prec_than_and AND_SYMBOL expression;

with_report_format: options_list;

options_list:
	options_list_prefix RR_BRACKET_SYMBOL
	| LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL;

options_list_prefix:
	LR_BRACKET_SYMBOL options_entry (COMMA_SYMBOL options_entry)*;

options_entry:
	identifier_in_hints options_assignment_operator expression_or_proto;

expression_or_proto: PROTO_SYMBOL | expression;

options_assignment_operator:
	EQUAL_OPERATOR
	| PLUS_EQUAL_SYMBOL
	| SUB_EQUAL_SYMBOL;

opt_null_handling_modifier:
	IGNORE_SYMBOL NULLS_SYMBOL
	| RESPECT_SYMBOL NULLS_SYMBOL;

function_call_argument:
	expression opt_as_alias_with_required_as?
	| named_argument
	| lambda_argument
	| sequence_arg
	| SELECT_SYMBOL { this.notifyErrorListeners("Each function argument is an expression, not a query; to use a query as an expression, the query must be wrapped with additional parentheses to make it a scalar subquery expression", null, null); 
		};

sequence_arg: SEQUENCE_SYMBOL path_expression;

named_argument:
	identifier EQUAL_GT_BRACKET_SYMBOL expression
	| identifier EQUAL_GT_BRACKET_SYMBOL lambda_argument
	// Named relation arg: name => TABLE t  /  name => TABLE  /  name => INPUT TABLE.
	| identifier EQUAL_GT_BRACKET_SYMBOL table_clause
	| identifier EQUAL_GT_BRACKET_SYMBOL TABLE_SYMBOL
	| identifier EQUAL_GT_BRACKET_SYMBOL INPUT_SYMBOL TABLE_SYMBOL;

lambda_argument:
	lambda_argument_list SUB_GT_BRACKET_SYMBOL expression {
		const al = localContext.lambda_argument_list();
		if (al?.expression() && !this.lambdaArgListValid(al.getText())) this.notifyErrorListeners("Syntax error: Expecting lambda argument list", null, null);
	};

lambda_argument_list:
	expression
	| LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL;

// GoogleSQL allows `LIMIT ALL` (no row cap) as well as `LIMIT n [OFFSET m]`.
// LIMIT <expr> [OFFSET <expr>] or LIMIT ALL [OFFSET <expr>] (limit_offset_clause in googlesql.tm;
// LIMIT ALL means no row cap but an OFFSET may still apply).
limit_offset_clause:
	LIMIT_SYMBOL expression OFFSET_SYMBOL expression
	| LIMIT_SYMBOL expression
	| LIMIT_SYMBOL ALL_SYMBOL OFFSET_SYMBOL expression
	| LIMIT_SYMBOL ALL_SYMBOL;

// Aggregate-call modifiers (ZetaSQL): the "HAVING MAX/MIN value" row-picker, and the
// multi-level-aggregation "GROUP BY keys [HAVING <bool>]". Bare boolean HAVING is valid
// only after GROUP BY; standalone HAVING requires MAX/MIN.
opt_having_or_group_by_modifier:
	HAVING_SYMBOL (MAX_SYMBOL | MIN_SYMBOL) expression aggregate_group_by_modifier?
	| aggregate_group_by_modifier (HAVING_SYMBOL expression)?;

// The keys are full grouping_items (googlesql.tm function_call_expression uses group_by_clause_prefix =
// group_by_preamble grouping_item …, the SAME rule top-level GROUP BY uses), so `GROUP BY ()`, ROLLUP,
// CUBE and GROUPING SETS parse here too — ZetaSQL's PARSER accepts them and a later semantic pass
// rejects them ("GROUP BY ROLLUP is not supported inside an aggregate function"), so the parse must
// succeed. No AND ORDER preamble / ASC-DESC / alias (those are pipe-AGGREGATE-only, grouping_item_in_pipe).
aggregate_group_by_modifier:
	GROUP_SYMBOL hint? BY_SYMBOL grouping_item (COMMA_SYMBOL grouping_item)*;

group_by_clause_prefix:
	group_by_preamble grouping_item (COMMA_SYMBOL grouping_item)*;

// Standard GROUP BY has no `AND ORDER` — that is pipe-AGGREGATE-only (group_by_preamble_in_pipe).
group_by_preamble: GROUP_SYMBOL hint? BY_SYMBOL;

group_by_preamble_in_pipe: GROUP_SYMBOL hint? opt_and_order? BY_SYMBOL;

opt_and_order: AND_SYMBOL ORDER_SYMBOL;

hint:
	/*XXX(zp): ABORT_CHECK*/ AT_SYMBOL integer_literal
	| hint_with_body;
hint_with_body: hint_with_body_prefix RC_BRACKET_SYMBOL;

hint_with_body_prefix:
	AT_SYMBOL (integer_literal AT_SYMBOL)? LC_BRACKET_SYMBOL hint_entry (
		COMMA_SYMBOL hint_entry
	)*;

hint_entry:
	identifier_in_hints EQUAL_OPERATOR expression
	| identifier_in_hints DOT_SYMBOL identifier_in_hints EQUAL_OPERATOR expression;

identifier_in_hints:
	identifier
	| extra_identifier_in_hints_name;

extra_identifier_in_hints_name:
	HASH_SYMBOL
	| PROTO_SYMBOL
	| PARTITION_SYMBOL;

// Standard GROUP BY item: a bare expression or a grouping construct — NO alias, NO ordering suffix
// (those are pipe-AGGREGATE-only — grouping_item_in_pipe). googlesql.tm grouping_item/grouping_item_base.
grouping_item_base:
	LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL
	| rollup_list RR_BRACKET_SYMBOL
	| cube_list RR_BRACKET_SYMBOL
	| grouping_set_list RR_BRACKET_SYMBOL;

grouping_item: grouping_item_base | expression;

// In a pipe GROUP BY, a grouping key may carry an implicit (AS-optional) alias and an ordering
// suffix: `GROUP BY x y`, `x+1 alias NULLS FIRST` (googlesql.tm grouping_item_in_pipe uses as_alias?).
grouping_item_in_pipe:
	grouping_item_base
	| expression as_alias? opt_grouping_item_order?;

grouping_set_list:
	GROUPING_SYMBOL SETS_SYMBOL LR_BRACKET_SYMBOL grouping_set (
		COMMA_SYMBOL grouping_set
	)*;

grouping_set:
	LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL
	| expression
	| rollup_list RR_BRACKET_SYMBOL
	| cube_list RR_BRACKET_SYMBOL;

cube_list:
	CUBE_SYMBOL LR_BRACKET_SYMBOL expression (COMMA_SYMBOL expression)*;

rollup_list:
	ROLLUP_SYMBOL LR_BRACKET_SYMBOL expression (
		COMMA_SYMBOL expression
	)*;

opt_as_alias_with_required_as: AS_SYMBOL identifier;

opt_grouping_item_order: opt_selection_item_order | null_order;

opt_selection_item_order: asc_or_desc null_order?;

asc_or_desc: ASC_SYMBOL | DESC_SYMBOL;

null_order:
	NULLS_SYMBOL FIRST_SYMBOL
	| NULLS_SYMBOL LAST_SYMBOL;

function_name_from_keyword:
	IF_SYMBOL
	| GROUPING_SYMBOL
	| LEFT_SYMBOL
	| RIGHT_SYMBOL
	| COLLATE_SYMBOL
	| RANGE_SYMBOL;

replace_fields_expression:
	replace_fields_prefix RR_BRACKET_SYMBOL;

replace_fields_prefix:
	REPLACE_FIELDS_SYMBOL LR_BRACKET_SYMBOL expression COMMA_SYMBOL replace_fields_arg (
		COMMA_SYMBOL replace_fields_arg
	)*;

replace_fields_arg:
	expression AS_SYMBOL generalized_path_expression
	| expression AS_SYMBOL generalized_extension_path;

generalized_path_expression:
	identifier
	| generalized_path_expression DOT_SYMBOL generalized_extension_path
	// After a dot, a path component may be a reserved keyword (DOT_IDENTIFIER mode): `path.to.extension`.
	| generalized_path_expression DOT_SYMBOL dot_identifier
	| generalized_path_expression LS_BRACKET_SYMBOL expression RS_BRACKET_SYMBOL;

generalized_extension_path:
	LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
	| generalized_extension_path DOT_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL
	| generalized_extension_path DOT_SYMBOL identifier;

with_expression:
	/* XXX(zp): zetasql Yacc implement this in lookahead_transformer. */ WITH_SYMBOL
		LR_BRACKET_SYMBOL with_expression_variable_prefix COMMA_SYMBOL expression RR_BRACKET_SYMBOL;

with_expression_variable_prefix:
	with_expression_variable (
		COMMA_SYMBOL with_expression_variable
	)*;

with_expression_variable: identifier AS_SYMBOL expression;

extract_expression:
	extract_expression_base RR_BRACKET_SYMBOL
	| extract_expression_base AT_KEYWORD_SYMBOL TIME_SYMBOL ZONE_SYMBOL expression RR_BRACKET_SYMBOL;

extract_expression_base:
	EXTRACT_SYMBOL LR_BRACKET_SYMBOL expression FROM_SYMBOL expression;

opt_format: FORMAT_SYMBOL expression opt_at_time_zone?;

opt_at_time_zone: AT_KEYWORD_SYMBOL TIME_SYMBOL ZONE_SYMBOL expression;

cast_expression:
	CAST_SYMBOL LR_BRACKET_SYMBOL expression AS_SYMBOL type opt_format? RR_BRACKET_SYMBOL
	| CAST_SYMBOL LR_BRACKET_SYMBOL CAST_SYMBOL { this.notifyErrorListeners("The argument to CAST is an expression, not a query; to use a query as an expression, the query must be wrapped with additional parentheses to make it a scalar subquery expression", null, null); 
		}
	| SAFE_CAST_SYMBOL LR_BRACKET_SYMBOL expression AS_SYMBOL type opt_format? RR_BRACKET_SYMBOL
	| SAFE_CAST_SYMBOL LR_BRACKET_SYMBOL SAFE_CAST_SYMBOL { this.notifyErrorListeners("The argument to CAST is an expression, not a query; to use a query as an expression, the query must be wrapped with additional parentheses to make it a scalar subquery expression", null, null); 
		};

case_expression:
	case_expression_prefix END_SYMBOL
	| case_expression_prefix ELSE_SYMBOL expression END_SYMBOL;

case_expression_prefix:
	case_no_value_expression_prefix
	| case_value_expression_prefix;

case_value_expression_prefix:
	CASE_SYMBOL expression (
		WHEN_SYMBOL expression THEN_SYMBOL expression
	)+;

case_no_value_expression_prefix:
	CASE_SYMBOL (WHEN_SYMBOL expression THEN_SYMBOL expression)+;

struct_braced_constructor:
	stype = struct_type ctor = braced_constructor
	| STRUCT_SYMBOL ctor = braced_constructor;

// NEW Type { field: value, … } — braced form (the parenthesized `NEW Type(args)` is new_constructor).
braced_new_constructor: NEW_SYMBOL type_name braced_constructor;

braced_constructor:
	braced_constructor_start RC_BRACKET_SYMBOL
	| braced_constructor_prefix RC_BRACKET_SYMBOL
	// Allow a trailing comma in a braced constructor.
	| braced_constructor_prefix COMMA_SYMBOL RC_BRACKET_SYMBOL;

// A braced constructor opens with `{` (the port had `}` here, which broke every braced/proto/
// struct constructor).
braced_constructor_start: LC_BRACKET_SYMBOL;

braced_constructor_prefix:
	braced_constructor_start braced_constructor_field
	| braced_constructor_start braced_constructor_extension
	| braced_constructor_prefix COMMA_SYMBOL braced_constructor_field
	| braced_constructor_prefix braced_constructor_field
	| braced_constructor_prefix COMMA_SYMBOL braced_constructor_extension;

braced_constructor_field:
	braced_constructor_lhs braced_constructor_field_value;

// A field key is a path or a parenthesized proto-extension path `(pkg.Ext)` (with value or nested brace).
braced_constructor_lhs:
	generalized_path_expression
	| braced_constructor_extension;

braced_constructor_field_value:
	COLON_SYMBOL expression
	| braced_constructor;

braced_constructor_extension:
	LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL;

new_constructor:
	new_constructor_prefix RR_BRACKET_SYMBOL
	| new_constructor_prefix_no_arg RR_BRACKET_SYMBOL;

new_constructor_prefix:
	new_constructor_prefix_no_arg new_constructor_arg (
		COMMA_SYMBOL new_constructor_arg
	)*;

new_constructor_prefix_no_arg:
	NEW_SYMBOL type_name LR_BRACKET_SYMBOL;

new_constructor_arg:
	expression
	| expression AS_SYMBOL identifier
	| expression AS_SYMBOL LR_BRACKET_SYMBOL path_expression RR_BRACKET_SYMBOL;

array_constructor:
	array_constructor_prefix_no_expressions RS_BRACKET_SYMBOL
	| array_constructor_prefix RS_BRACKET_SYMBOL;

array_constructor_prefix:
	array_constructor_prefix_no_expressions expression (
		COMMA_SYMBOL expression
	)*;

array_constructor_prefix_no_expressions:
	ARRAY_SYMBOL LS_BRACKET_SYMBOL
	| LS_BRACKET_SYMBOL
	| array_type LS_BRACKET_SYMBOL;

range_literal: range_type string_literal;

range_type:
	RANGE_SYMBOL template_type_open type template_type_close;

type: raw_type opt_type_parameters? collate_clause?;

collate_clause: COLLATE_SYMBOL string_literal_or_parameter;

string_literal_or_parameter:
	string_literal
	| parameter_expression
	| system_variable_expression;

// @@name.path — every component (incl. the head) may be a reserved keyword (@@FROM, @@ORDER.with).
system_variable_expression: ATAT_SYMBOL dot_identifier (DOT_SYMBOL dot_identifier)*;

parameter_expression:
	named_parameter_expression
	| QUESTION_SYMBOL;

// After `@`, GoogleSQL's tokenizer lexes the name in DOT_IDENTIFIER mode, so a query parameter may be
// named with a reserved keyword (`@from`, `@union`, `@full`, `@proto`) — same set as a path component
// after a dot. (named_parameter_expression in googlesql.tm; the reserved names re-lex as identifiers.)
named_parameter_expression: AT_SYMBOL dot_identifier;

// This is opt_type_parameters in zetasql yacc, but here prefer to use ? in ANTLR.
opt_type_parameters:
	type_parameters_prefix RR_BRACKET_SYMBOL
	| type_parameters_prefix COMMA_SYMBOL RR_BRACKET_SYMBOL { this.notifyErrorListeners("Syntax error: Trailing comma in type parameters list is not allowed.", null, null); 
		};

type_parameters_prefix:
	LR_BRACKET_SYMBOL type_parameter (
		COMMA_SYMBOL type_parameter
	)*;

type_parameter:
	integer_literal
	| boolean_literal
	| string_literal
	| bytes_literal
	| floating_point_literal
	| MAX_SYMBOL;

raw_type:
	array_type
	| struct_type
	| type_name
	| range_type
	| function_type
	| map_type;

map_type:
	MAP_SYMBOL template_type_open key_type = type COMMA_SYMBOL value_type = type template_type_close
		;

function_type:
	FUNCTION_SYMBOL template_type_open LR_BRACKET_SYMBOL RR_BRACKET_SYMBOL SUB_GT_BRACKET_SYMBOL
		return_type = type template_type_close
	| FUNCTION_SYMBOL template_type_open arg_type = type SUB_GT_BRACKET_SYMBOL return_type = type
		template_type_close
	| arg_list = function_type_prefix RR_BRACKET_SYMBOL SUB_GT_BRACKET_SYMBOL return_type = type
		template_type_close;

function_type_prefix:
	FUNCTION_SYMBOL template_type_open LR_BRACKET_SYMBOL type (
		COMMA_SYMBOL type
	)*;

type_name: path_expression | INTERVAL_SYMBOL;

// After a `.`, GoogleSQL's tokenizer enters DOT_IDENTIFIER mode, so a path component may be a
// reserved keyword (foo.all, hll_count.merge, t.array). We model that as dot_identifier; the head
// must still be a regular identifier.
path_expression: identifier (DOT_SYMBOL dot_identifier)*;

dot_identifier: identifier | reserved_keyword_as_dot_identifier;

// Reserved keywords usable as a path component after a dot (the DOT_IDENTIFIER set).
reserved_keyword_as_dot_identifier:
	ALL_SYMBOL
	| AND_SYMBOL
	| ANY_SYMBOL
	| ARRAY_SYMBOL
	| AS_SYMBOL
	| ASC_SYMBOL
	| ASSERT_ROWS_MODIFIED_SYMBOL
	| BETWEEN_SYMBOL
	| BY_SYMBOL
	| CASE_SYMBOL
	| CAST_SYMBOL
	| COLLATE_SYMBOL
	| CREATE_SYMBOL
	| CROSS_SYMBOL
	| CUBE_SYMBOL
	| CURRENT_SYMBOL
	| DEFAULT_SYMBOL
	| DEFINE_SYMBOL
	| DESC_SYMBOL
	| DISTINCT_SYMBOL
	| ELSE_SYMBOL
	| END_SYMBOL
	| ENUM_SYMBOL
	| EXCEPT_SYMBOL
	| EXCLUDE_SYMBOL
	| EXISTS_SYMBOL
	| EXTRACT_SYMBOL
	| FALSE_SYMBOL
	| FOLLOWING_SYMBOL
	| FOR_SYMBOL
	| FROM_SYMBOL
	| FULL_SYMBOL
	| GROUP_SYMBOL
	| GROUPING_SYMBOL
	| HASH_SYMBOL
	| HAVING_SYMBOL
	| IF_SYMBOL
	| IGNORE_SYMBOL
	| IN_SYMBOL
	| INNER_SYMBOL
	| INTERSECT_SYMBOL
	| INTERVAL_SYMBOL
	| INTO_SYMBOL
	| IS_SYMBOL
	| JOIN_SYMBOL
	| LATERAL_SYMBOL
	| LEFT_SYMBOL
	| LIKE_SYMBOL
	| LIMIT_SYMBOL
	| LOOKUP_SYMBOL
	| MATCH_RECOGNIZE_SYMBOL
	| MERGE_SYMBOL
	| NATURAL_SYMBOL
	| NEW_SYMBOL
	| NO_SYMBOL
	| NOT_SYMBOL
	| NOTHING_SYMBOL
	| NULL_SYMBOL
	| NULLS_SYMBOL
	| OF_SYMBOL
	| ON_SYMBOL
	| OR_SYMBOL
	| ORDER_SYMBOL
	| OUTER_SYMBOL
	| OVER_SYMBOL
	| PARTITION_SYMBOL
	| PRECEDING_SYMBOL
	| PROTO_SYMBOL
	| QUALIFY_SYMBOL
	| RANGE_SYMBOL
	| RECURSIVE_SYMBOL
	| RESPECT_SYMBOL
	| RIGHT_SYMBOL
	| ROLLUP_SYMBOL
	| ROWS_SYMBOL
	| SELECT_SYMBOL
	| SET_SYMBOL
	| SHORTEST_SYMBOL
	| SLASH_SYMBOL
	| SOME_SYMBOL
	| STRUCT_SYMBOL
	| TABLESAMPLE_SYMBOL
	| THEN_SYMBOL
	| TO_SYMBOL
	| TRUE_SYMBOL
	| UNBOUNDED_SYMBOL
	| UNION_SYMBOL
	| UNNEST_SYMBOL
	| USING_SYMBOL
	| WHEN_SYMBOL
	| WHERE_SYMBOL
	| WINDOW_SYMBOL
	| WITH_SYMBOL;

identifier: token_identifier | keyword_as_identifier;

keyword_as_identifier:
	common_keyword_as_identifier
	| SIMPLE_SYMBOL;

common_keyword_as_identifier:
	ABORT_SYMBOL
	| ACCESS_SYMBOL
	| ACTION_SYMBOL
	| AFTER_SYMBOL
	| PAST_SYMBOL
	| AGGREGATE_SYMBOL
	| ADD_SYMBOL
	| ALTER_SYMBOL
	| ALWAYS_SYMBOL
	| ANALYZE_SYMBOL
	| APPROX_SYMBOL
	| ARE_SYMBOL
	| ASSERT_SYMBOL
	| AT_KEYWORD_SYMBOL
	| BATCH_SYMBOL
	| BEGIN_SYMBOL
	| BIGDECIMAL_SYMBOL
	| BIGNUMERIC_SYMBOL
	| BREAK_SYMBOL
	| CALL_SYMBOL
	| CASCADE_SYMBOL
	| CHECK_SYMBOL
	| CLAMPED_SYMBOL
	| CONFLICT_SYMBOL
	| CLONE_SYMBOL
	| COPY_SYMBOL
	| CLUSTER_SYMBOL
	| COLUMN_SYMBOL
	| COLUMNS_SYMBOL
	| COMMIT_SYMBOL
	| CONNECTION_SYMBOL
	| CONSTANT_SYMBOL
	| CONSTRAINT_SYMBOL
	| CONTINUE_SYMBOL
	| CORRESPONDING_SYMBOL
	| CYCLE_SYMBOL
	| DATA_SYMBOL
	| DATABASE_SYMBOL
	| DATE_SYMBOL
	| DATETIME_SYMBOL
	| DECIMAL_SYMBOL
	| DECLARE_SYMBOL
	| DEFINER_SYMBOL
	| DELETE_SYMBOL
	| DELETION_SYMBOL
	| DEPTH_SYMBOL
	| DESCRIBE_SYMBOL
	| DETERMINISTIC_SYMBOL
	| DELTA_SYMBOL
	| DIFFERENTIAL_PRIVACY_SYMBOL
	| DO_SYMBOL
	| DYNAMIC_SYMBOL
	| DROP_SYMBOL
	| ELSEIF_SYMBOL
	| ENFORCED_SYMBOL
	| EPSILON_SYMBOL
	| ERROR_SYMBOL
	| EXCEPTION_SYMBOL
	| EXECUTE_SYMBOL
	| EXPLAIN_SYMBOL
	| EXPORT_SYMBOL
	| EXTEND_SYMBOL
	| EXTERNAL_SYMBOL
	| FILES_SYMBOL
	| FILTER_SYMBOL
	| FILL_SYMBOL
	| FIRST_SYMBOL
	| FOREIGN_SYMBOL
	| FORK_SYMBOL
	| FORMAT_SYMBOL
	| FUNCTION_SYMBOL
	| GENERATED_SYMBOL
	| GRANT_SYMBOL
	| GROUP_ROWS_SYMBOL
	| HIDDEN_SYMBOL
	| IDENTITY_SYMBOL
	| IMMEDIATE_SYMBOL
	| IMMUTABLE_SYMBOL
	| IMPORT_SYMBOL
	| INCLUDE_SYMBOL
	| INCREMENT_SYMBOL
	| INDEX_SYMBOL
	| INOUT_SYMBOL
	| INPUT_SYMBOL
	| INSERT_SYMBOL
	| INVOKER_SYMBOL
	| ISOLATION_SYMBOL
	| ITERATE_SYMBOL
	| JSON_SYMBOL
	| KEY_SYMBOL
	| LANGUAGE_SYMBOL
	| LAST_SYMBOL
	| LEAVE_SYMBOL
	| LEVEL_SYMBOL
	| LOAD_SYMBOL
	| LOG_SYMBOL
	| LOOP_SYMBOL
	| MACRO_SYMBOL
	| TEE_SYMBOL
	| MAP_SYMBOL
	| MATCH_SYMBOL
	| KW_MATCH_RECOGNIZE_NONRESERVED_SYMBOL
	| MATCHED_SYMBOL
	| MATERIALIZED_SYMBOL
	| MAX_SYMBOL
	| MAXVALUE_SYMBOL
	| MEASURES_SYMBOL
	| MESSAGE_SYMBOL
	| METADATA_SYMBOL
	| MIN_SYMBOL
	| MINVALUE_SYMBOL
	| MODEL_SYMBOL
	| MAX_GROUPS_CONTRIBUTED_SYMBOL
	| MODULE_SYMBOL
	| NAME_SYMBOL
	| NUMERIC_SYMBOL
	| OFFSET_SYMBOL
	| ONLY_SYMBOL
	| OPTIONS_SYMBOL
	| OUT_SYMBOL
	| OUTPUT_SYMBOL
	| OVERWRITE_SYMBOL
	| PARTITIONS_SYMBOL
	| PATTERN_SYMBOL
	| PERCENT_SYMBOL
	| PIVOT_SYMBOL
	| POLICIES_SYMBOL
	| POLICY_SYMBOL
	| PRIMARY_SYMBOL
	| PRIVACY_UNIT_COLUMN_SYMBOL
	| PRIVATE_SYMBOL
	| PRIVILEGE_SYMBOL
	| PRIVILEGES_SYMBOL
	| PROCEDURE_SYMBOL
	| PROJECT_SYMBOL
	| PUBLIC_SYMBOL
	| RAISE_SYMBOL
	| READ_SYMBOL
	| REFERENCES_SYMBOL
	| REMOTE_SYMBOL
	| REMOVE_SYMBOL
	| RENAME_SYMBOL
	| REPEAT_SYMBOL
	| REPEATABLE_SYMBOL
	| REPLACE_SYMBOL
	| REPLACE_FIELDS_SYMBOL
	| REPLICA_SYMBOL
	| REPORT_SYMBOL
	| RESTRICT_SYMBOL
	| RESTRICTION_SYMBOL
	| RETURNS_SYMBOL
	| RETURN_SYMBOL
	| REVOKE_SYMBOL
	| ROLLBACK_SYMBOL
	| ROW_SYMBOL
	| RUN_SYMBOL
	| SAFE_CAST_SYMBOL
	| SCHEMA_SYMBOL
	| SEARCH_SYMBOL
	| SECURITY_SYMBOL
	| SEQUENCE_SYMBOL
	| SETS_SYMBOL
	| SHOW_SYMBOL
	| SNAPSHOT_SYMBOL
	| SOURCE_SYMBOL
	| SQL_SYMBOL
	| STABLE_SYMBOL
	| START_SYMBOL
	| STATIC_DESCRIBE_SYMBOL
	| STORED_SYMBOL
	| STORING_SYMBOL
	| STRICT_SYMBOL
	| SYSTEM_SYMBOL
	| SYSTEM_TIME_SYMBOL
	| TABLE_SYMBOL
	| TABLES_SYMBOL
	| TARGET_SYMBOL
	| TEMP_SYMBOL
	| TEMPORARY_SYMBOL
	| TIME_SYMBOL
	| TIMESTAMP_SYMBOL
	| TRANSACTION_SYMBOL
	| TRANSFORM_SYMBOL
	| TRUNCATE_SYMBOL
	| TYPE_SYMBOL
	| UNDROP_SYMBOL
	| UNIQUE_SYMBOL
	| UNKNOWN_SYMBOL
	| UNPIVOT_SYMBOL
	| UNTIL_SYMBOL
	| UPDATE_SYMBOL
	| VALUE_SYMBOL
	| VALUES_SYMBOL
	| VECTOR_SYMBOL
	| VIEW_SYMBOL
	| VIEWS_SYMBOL
	| VOLATILE_SYMBOL
	| WEIGHT_SYMBOL
	| WHILE_SYMBOL
	| WRITE_SYMBOL
	| ZONE_SYMBOL
	| DESCRIPTOR_SYMBOL
	| INTERLEAVE_SYMBOL
	| NULL_FILTERED_SYMBOL
	| PARENT_SYMBOL
	| DESTINATION_SYMBOL
	| PROPERTY_SYMBOL
	| GRAPH_SYMBOL
	// GRAPH_TABLE is conditionally reserved (reserved only in the GRAPH_TABLE(…) operator position);
	// ZetaSQL's parser testdata uses it as a bare identifier (alias, zero-arg TVF), so keep it here.
	| GRAPH_TABLE_SYMBOL
	| NODE_SYMBOL
	| PROPERTIES_SYMBOL
	| LABEL_SYMBOL
	| LABELED_SYMBOL
	| CHEAPEST_SYMBOL
	| PER_SYMBOL
	| YIELD_SYMBOL
	| COST_SYMBOL
	| EDGE_SYMBOL
	| NEXT_SYMBOL
	| ASCENDING_SYMBOL
	| DESCENDING_SYMBOL
	| SKIP_SYMBOL
	| PATH_SYMBOL
	| PATHS_SYMBOL
	| WALK_SYMBOL
	| TRAIL_SYMBOL
	| ACYCLIC_SYMBOL
	| OPTIONAL_SYMBOL
	| LET_SYMBOL;

token_identifier: IDENTIFIER;

struct_type:
	STRUCT_SYMBOL template_type_open template_type_close
	// STRUCT<> empty type list: `<>` is lexed as a single token (the not-equals operator) by
	// maximal munch, so the adjacent open/close angles arrive fused.
	| STRUCT_SYMBOL NOT_EQUAL2_OPERATOR
	| struct_type_prefix template_type_close;

struct_type_prefix:
	STRUCT_SYMBOL template_type_open struct_field (
		COMMA_SYMBOL struct_field
	)*;

struct_field: identifier type | type;

array_type:
	ARRAY_SYMBOL template_type_open type template_type_close;

template_type_open: LT_OPERATOR;

template_type_close: GT_OPERATOR;

date_or_time_literal: date_or_time_literal_kind string_literal;

date_or_time_literal_kind:
	DATE_SYMBOL
	| TIME_SYMBOL
	| DATETIME_SYMBOL
	| TIMESTAMP_SYMBOL;

floating_point_literal: FLOATING_POINT_LITERAL;

json_literal: JSON_SYMBOL string_literal;

bignumeric_literal: bignumeric_literal_prefix string_literal;

bignumeric_literal_prefix:
	BIGNUMERIC_SYMBOL
	| BIGDECIMAL_SYMBOL;

numeric_literal: numeric_literal_prefix string_literal;

numeric_literal_prefix: NUMERIC_SYMBOL | DECIMAL_SYMBOL;

integer_literal: INTEGER_LITERAL;

bytes_literal:
	bytes_literal_component
	| bytes_literal bytes_literal_component {
	 const literalStopIndex = localContext.bytes_literal()!.stop!.stop; const componentStartIndex = localContext.bytes_literal_component()!.start!.start;
	 if (literalStopIndex + 1 === componentStartIndex) { this.notifyErrorListeners("Syntax error: concatenated bytes literals must be separated by whitespace or comments.", null, null) } 
		}
	| bytes_literal string_literal_component {this.notifyErrorListeners("Syntax error: string and bytes literals cannot be concatenated.", null,
	 null); };

null_literal: NULL_SYMBOL;

boolean_literal: TRUE_SYMBOL | FALSE_SYMBOL;

string_literal:
	string_literal_component
	| string_literal string_literal_component {
	 const literalStopIndex = localContext.string_literal()!.stop!.stop; const componentStartIndex = localContext.string_literal_component()!.start!.start;
	 if (literalStopIndex + 1 === componentStartIndex) { this.notifyErrorListeners("Syntax error: concatenated string literals must be separated by whitespace or comments.", null, null) } 
		}
	| string_literal bytes_literal_component {this.notifyErrorListeners("Syntax error: string and bytes literals cannot be concatenated.", null, null); 
		};

string_literal_component: STRING_LITERAL;

bytes_literal_component: BYTES_LITERAL;