import {
	type ATNState,
	AtomTransition,
	NotSetTransition,
	type Parser,
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

/**
 * Our own ATN candidate-collection walk — a reimplementation of antlr4-c3's
 * `CodeCompletionCore` (`collectCandidates` / `processRule` / the transition `process`),
 * in our own naming/structure, over the antlr4ng ATN API. No `antlr4-c3` dependency.
 *
 * The idea: ANTLR compiles each parser rule into an ATN (a state graph). Starting at the entry
 * rule's start state we DFS the graph, threading a `tokenListIndex` (how many of the real input
 * tokens before the caret we have consumed) so impossible paths get pruned. At the caret
 * (`tokenListIndex === caretTokenIndex`) every terminal transition's label contributes its token
 * types as candidates, and entering a preferred rule records that rule.
 *
 * Correctness over cleverness for now; this is hot-path code we will optimize later.
 */
export function collectCandidates(
	parser: Parser,
	startRuleIndex: number,
	caretTokenIndex: number,
	preferredRules: Set<number>,
	ignoredTokens: Set<number>,
): Candidates {
	const walk = new CandidateWalk(parser, caretTokenIndex, preferredRules, ignoredTokens);
	return walk.run(startRuleIndex);
}

/** One entry in the DFS work queue: an ATN state plus how many input tokens we have consumed. */
interface PipelineEntry {
	state: ATNState;
	tokenListIndex: number;
}

class CandidateWalk {
	private readonly tokens: Candidates = { tokens: new Set(), rules: new Set() };
	/** The on-channel input token TYPES from index 0 up to (and including) the caret token. */
	private readonly inputTypes: number[] = [];
	/** The caret position within `inputTypes` (the last entry; "at caret" means index === this). */
	private readonly caretListIndex: number;
	/** Cross-rule recursion guard: `${ruleIndex}:${tokenListIndex}` frames currently on the stack —
	 *  re-entering the same rule at the same input position is unbounded left recursion. */
	private readonly activeFrames = new Set<string>();

	constructor(
		private readonly parser: Parser,
		caretTokenIndex: number,
		private readonly preferredRules: Set<number>,
		private readonly ignoredTokens: Set<number>,
	) {
		// Precompute the on-channel token types from 0 up to the caret token. The walk consumes
		// these to prune paths that cannot match what the user already typed. Mirrors c3's
		// `tokens` array built in `collectCandidates`.
		const stream = this.parser.inputStream;
		for (let i = 0; i <= caretTokenIndex; i++) {
			const tok = stream.get(i);
			if (tok.channel !== Token.DEFAULT_CHANNEL) continue;
			this.inputTypes.push(tok.type);
			if (tok.type === Token.EOF) break;
		}
		// The caret sits just past the last consumed on-channel token.
		this.caretListIndex = this.inputTypes.length - 1;
	}

	run(startRuleIndex: number): Candidates {
		const startState = this.parser.atn.ruleToStartState[startRuleIndex];
		if (startState) this.processRule(startState, 0);
		return this.tokens;
	}

	/**
	 * Walk one rule's ATN starting at its `RuleStartState`. Returns the set of token-list indices
	 * at which this rule can complete (its `RuleStopState` positions) — the caller resumes its own
	 * walk at the rule's `followState` for each returned position. Mirrors c3's `processRule`.
	 */
	private processRule(startState: ATNState, tokenListIndex: number): Set<number> {
		const result = new Set<number>();
		// Cross-rule guard: if this exact (rule, position) frame is already on the stack we are in
		// unbounded left recursion (A → … → A with no token consumed) — bail with no completions.
		const frameKey = `${startState.ruleIndex}:${tokenListIndex}`;
		if (this.activeFrames.has(frameKey)) return result;
		this.activeFrames.add(frameKey);

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
					const subRule = transition.ruleIndex;
					// Entering a preferred (name) rule right at the caret: record the rule and do
					// NOT descend — the name slot itself is the candidate (c3 behavior).
					if (atCaret && this.preferredRules.has(subRule)) {
						this.tokens.rules.add(subRule);
						continue;
					}
					// Otherwise descend into the sub-rule, then resume at its followState for each
					// position the sub-rule can complete at.
					const subStart = transition.target as ATNState;
					const ends = this.processRule(asRuleStart(subStart), idx);
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
					this.collectTerminal(transition);
				} else {
					const inputType = this.inputTypes[idx];
					if (inputType !== undefined && this.transitionMatches(transition, inputType)) {
						pipeline.push({ state: transition.target, tokenListIndex: idx + 1 });
					}
					// No match → dead path, stop.
				}
			}
		}

		this.activeFrames.delete(frameKey);
		return result;
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
		const max = this.parser.atn.maxTokenType;
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
