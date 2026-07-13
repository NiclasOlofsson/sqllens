// The public foldIdentifier / displayName, resolved through the registry so a dialect's fold rule can
// live in its own folder (reachable via resolveBehavior) instead of a central RULES table. Behaviour
// is identical to the old ident/fold versions while dialects are unmigrated (the transitional behavior
// still folds via RULES); once a dialect's rule moves to its folder, its behavior.fold binds the
// folder rule and this keeps resolving correctly with no API change. Throws on an unknown/absent
// dialect (sqllens applies no default).
import type { IdentKind } from "../ident/fold.js";
import { resolveBehavior } from "./registry.js";

export type { IdentKind };

/** Fold an identifier to its identity key under the dialect's rules. */
export function foldIdentifier(raw: string, dialect: string | undefined, kind: IdentKind = "other"): string {
	return resolveBehavior(dialect).fold(raw, kind);
}

/** Presentation twin: strip delimiters, no case change. Never use for comparison. */
export function displayName(raw: string, dialect: string | undefined): string {
	return resolveBehavior(dialect).displayName(raw);
}
