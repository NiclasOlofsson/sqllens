import {
	type ATN,
	type ATNState,
	AtomTransition,
	NotSetTransition,
	RangeTransition,
	RuleStartState,
	RuleStopState,
	RuleTransition,
	SetTransition,
	Token,
	type Transition,
	WildcardTransition,
} from "antlr4ng";

/**
 * What can legally come next at the caret:
 *  - `tokens`: candidate terminal token TYPES (keywords/punctuation/literals) collectable there.
 *  - `rules`: the *preferred* rule indices (name/column/table reference slots) reachable there;
 *    the editor resolves these with schema-aware names instead of enumerating raw tokens.
 */
export interface Candidates {
	tokens: Set<number>;
	rules: Set<number>;
}

/** The minimal token view the walk needs: each token's antlr type + channel, in source order. Both
 *  antlr's `Token` and our neutral `Token` (src/token/token.ts) satisfy it, so the walk runs over
 *  the document's OWN already-lexed token stream, never a re-parse. */
export interface WalkToken {
	type: number;
	channel: number;
}

/**
 * Our own ATN candidate-collection walk — a reimplementation of antlr4-c3's
 * `CodeCompletionCore` (`collectCandidates` / `processRule` / `translateStackToRuleIndex`),
 * in our own naming/structure, over the antlr4ng ATN API. No `antlr4-c3` dependency.
 *
 * The idea: ANTLR compiles each parser rule into an ATN (a state graph). Starting at the entry
 * rule's start state we DFS the graph, threading a `tokenListIndex` (how many of the real input
 * tokens before the caret we have consumed) so impossible paths get pruned. At the caret
 * (`tokenListIndex === caretListIndex`) every terminal transition's label contributes its token
 * types as candidates — unless the current rule call stack is inside a preferred (name/column)
 * rule, in which case we record that rule and suppress the raw tokens it subsumes.
 *
 * `atn` is the dialect's parser ATN (input-independent, a per-dialect static) and `tokens` is the
 * document's own lexed token stream up to (at least) the caret; the walk consumes only their `type`
 * and `channel`, so it reuses the already-parsed tokens rather than re-lexing the source.
 */
export function collectCandidates(
	atn: ATN,
	startRuleIndex: number,
	tokens: readonly WalkToken[],
	caretTokenIndex: number,
	preferredRules: Set<number>,
	ignoredTokens: Set<number>,
): Candidates {
	const walk = new CandidateWalk(atn, tokens, caretTokenIndex, preferredRules, ignoredTokens);
	return walk.run(startRuleIndex);
}

/** One entry in the DFS work queue: an ATN state plus how many input tokens we have consumed. */
interface PipelineEntry {
	state: ATNState;
	tokenListIndex: number;
}

/** One frame of the rule call stack: the rule we are inside and the input position it started at. */
interface RuleStackEntry {
	ruleIndex: number;
	startTokenIndex: number;
}

/**
 * The result of processing a rule at an input position: the set of token-list indices the rule
 * can advance the input to (its `RuleStopState` positions — c3's "follow positions"). Mirrors
 * c3's `RuleEndStatus`.
 */
type RuleEndStatus = Set<number>;

class CandidateWalk {
	private readonly tokens: Candidates = { tokens: new Set(), rules: new Set() };
	/** The on-channel input token TYPES from index 0 up to (and including) the caret token. */
	private readonly inputTypes: number[] = [];
	/** The caret position within `inputTypes` (the last entry; "at caret" means index === this). */
	private readonly caretListIndex: number;
	/**
	 * Persistent per-`(ruleIndex, tokenListIndex)` cache of follow positions — c3's `shortcutMap`.
	 * It is BOTH the memoization table (a left-recursive grammar revisits the same subproblem on
	 * every call path; without this it is exponential) AND the recursion guard: an in-progress or
	 * completed `(rule, position)` is found here and returned without recomputing. Never cleared
	 * during a walk — that persistence is what kills the blowup.
	 */
	private readonly shortcutMap = new Map<number, Map<number, RuleEndStatus>>();

	constructor(
		private readonly atn: ATN,
		tokens: readonly WalkToken[],
		caretTokenIndex: number,
		private readonly preferredRules: Set<number>,
		private readonly ignoredTokens: Set<number>,
	) {
		// Precompute the on-channel token types from 0 up to the caret token. The walk consumes
		// these to prune paths that cannot match what the user already typed. Mirrors c3's
		// `tokens` array built in `collectCandidates`.
		for (let i = 0; i <= caretTokenIndex && i < tokens.length; i++) {
			const tok = tokens[i]!;
			if (tok.channel !== Token.DEFAULT_CHANNEL) continue;
			this.inputTypes.push(tok.type);
			if (tok.type === Token.EOF) break;
		}
		// The caret sits just past the last consumed on-channel token.
		this.caretListIndex = this.inputTypes.length - 1;
	}

	run(startRuleIndex: number): Candidates {
		const startState = this.atn.ruleToStartState[startRuleIndex];
		if (startState) this.processRule(startState, 0, []);
		return this.tokens;
	}

	/**
	 * Walk one rule's ATN starting at its `RuleStartState`. Returns the set of token-list indices
	 * at which this rule can complete (its `RuleStopState` positions) — the caller resumes its own
	 * walk at the rule's `followState` for each returned position. Mirrors c3's `processRule`.
	 *
	 * `callStack` is the chain of rules currently being processed (each with the input position it
	 * started at). It is threaded down into sub-rules and used at the caret to detect that we are
	 * inside a preferred rule.
	 */
	private processRule(startState: ATNState, tokenListIndex: number, callStack: RuleStackEntry[]): RuleEndStatus {
		const ruleIndex = startState.ruleIndex;

		// shortcutMap lookup (memoization + recursion guard). A hit means this exact
		// (rule, position) was already computed (or is in progress) — all of its candidate
		// positions were collected into `this.tokens` during that first computation, so we just
		// return the cached follow-set without recomputing or re-collecting.
		let positionMap = this.shortcutMap.get(ruleIndex);
		if (!positionMap) {
			positionMap = new Map();
			this.shortcutMap.set(ruleIndex, positionMap);
		} else {
			const cached = positionMap.get(tokenListIndex);
			if (cached) return cached;
		}

		const result: RuleEndStatus = new Set<number>();
		// Seed the cache BEFORE recursing so a re-entry of this same (rule, position) — left
		// recursion — hits the (initially empty) cached set and bails instead of looping forever.
		positionMap.set(tokenListIndex, result);

		callStack.push({ ruleIndex, startTokenIndex: tokenListIndex });

		// Within-rule guard: a `${stateNumber}:${tokenListIndex}` pair already processed on this
		// frame is an epsilon cycle — skip it.
		const seen = new Set<string>();
		const pipeline: PipelineEntry[] = [{ state: startState, tokenListIndex }];

		while (pipeline.length > 0) {
			const entry = pipeline.pop()!;
			const { state } = entry;
			const idx = entry.tokenListIndex;

			const key = `${state.stateNumber}:${idx}`;
			if (seen.has(key)) continue;
			seen.add(key);

			if (state instanceof RuleStopState) {
				result.add(idx);
				continue;
			}

			const atCaret = idx === this.caretListIndex;

			for (const transition of state.transitions) {
				if (transition instanceof RuleTransition) {
					// Descend into the sub-rule, then resume at its followState for each position
					// the sub-rule can complete at. The sub-rule's own start-state caret handling
					// records a preferred rule via the call stack if it is one.
					const subStart = transition.target as ATNState;
					const ends = this.processRule(asRuleStart(subStart), idx, callStack);
					for (const endIdx of ends) {
						pipeline.push({ state: transition.followState, tokenListIndex: endIdx });
					}
					continue;
				}

				if (transition.isEpsilon) {
					// Epsilon / action / predicate: no token consumed, just follow.
					pipeline.push({ state: transition.target, tokenListIndex: idx });
					continue;
				}

				// Terminal transition (Atom/Set/Range/NotSet/Wildcard).
				if (atCaret) {
					// At the caret, before enumerating raw tokens, check whether the current call
					// stack is inside a preferred (name/column) rule. If so, record that rule and
					// suppress the tokens it subsumes — c3's `translateStackToRuleIndex` gate.
					if (!this.translateStackToRuleIndex(callStack)) {
						this.collectTerminal(transition);
					}
				} else {
					const inputType = this.inputTypes[idx];
					if (inputType !== undefined && this.transitionMatches(transition, inputType)) {
						pipeline.push({ state: transition.target, tokenListIndex: idx + 1 });
					}
					// No match → dead path, stop.
				}
			}
		}

		callStack.pop();
		return result;
	}

	/**
	 * At the caret: if any rule currently on the call stack is a preferred rule, record the
	 * OUTERMOST one (scan bottom-up, matching c3's default `translateRulesTopDown === false`) into
	 * `this.tokens.rules` and return true so the caller suppresses the raw token candidates that
	 * the preferred rule subsumes. Mirrors c3's `translateStackToRuleIndex`.
	 */
	private translateStackToRuleIndex(callStack: RuleStackEntry[]): boolean {
		if (this.preferredRules.size === 0) return false;
		for (let i = 0; i < callStack.length; i++) {
			const ruleIndex = callStack[i]!.ruleIndex;
			if (this.preferredRules.has(ruleIndex)) {
				this.tokens.rules.add(ruleIndex);
				return true;
			}
		}
		return false;
	}

	/** Does a terminal transition admit `type` as the next input token? */
	private transitionMatches(transition: Transition, type: number): boolean {
		if (transition instanceof AtomTransition) return transition.labelValue === type;
		if (transition instanceof RangeTransition) {
			return type >= transition.start && type <= transition.stop;
		}
		if (transition instanceof NotSetTransition) {
			return transition.label != null && !transition.label.contains(type);
		}
		if (transition instanceof SetTransition) {
			return transition.label != null && transition.label.contains(type);
		}
		if (transition instanceof WildcardTransition) return type >= Token.MIN_USER_TOKEN_TYPE;
		// Unknown terminal kind: be conservative and treat as non-matching.
		return false;
	}

	/** At the caret: add every token type a terminal transition can offer (minus ignored). */
	private collectTerminal(transition: Transition): void {
		if (transition instanceof AtomTransition) {
			this.addToken(transition.labelValue);
			return;
		}
		if (transition instanceof RangeTransition) {
			for (let t = transition.start; t <= transition.stop; t++) this.addToken(t);
			return;
		}
		if (transition instanceof SetTransition && !(transition instanceof NotSetTransition)) {
			if (transition.label) for (const t of transition.label.toArray()) this.addToken(t);
			return;
		}
		if (transition instanceof NotSetTransition || transition instanceof WildcardTransition) {
			// A NotSet/Wildcard at the caret matches "almost anything" — enumerating every token
			// type is noise. Offer the concrete user-token complement only when it stays small;
			// otherwise skip (the editor falls back to name rules / no keyword hint here).
			this.collectComplement(transition);
			return;
		}
	}

	private collectComplement(transition: Transition): void {
		const max = this.atn.maxTokenType;
		// Cap the enumeration: a wide-open NotSet/Wildcard is not a useful keyword list.
		const COMPLEMENT_CAP = 64;
		const excluded = transition instanceof NotSetTransition && transition.label ? transition.label : null;
		let count = 0;
		const candidates: number[] = [];
		for (let t = Token.MIN_USER_TOKEN_TYPE; t <= max; t++) {
			if (excluded?.contains(t)) continue;
			if (this.ignoredTokens.has(t)) continue;
			candidates.push(t);
			if (++count > COMPLEMENT_CAP) return; // too wide to be useful; skip entirely
		}
		for (const t of candidates) this.tokens.tokens.add(t);
	}

	private addToken(type: number): void {
		if (type < Token.MIN_USER_TOKEN_TYPE && type !== Token.EOF) return;
		if (this.ignoredTokens.has(type)) return;
		this.tokens.tokens.add(type);
	}
}

/** Resolve a RuleTransition target to its rule's start state (it already is one in antlr4ng). */
function asRuleStart(state: ATNState): RuleStartState {
	return state as RuleStartState;
}
