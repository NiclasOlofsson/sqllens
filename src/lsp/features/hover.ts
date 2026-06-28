import type { Hover, Position } from "vscode-languageserver-types";
import { toAst, TypeInfo, type Dialect } from "../../api.js";
import { resolveScopes } from "../../scope/scope.js";
import { Schema } from "../../qualify/schema.js";
import { formatType } from "../../infer/types.js";
import { nodeAt } from "../node-at.js";
import { positionToOffset, rangeFromCst } from "../ranges.js";

// ---------------------------------------------------------------------------
// Hover: the inferred type of the expression under the cursor. Pure translation
// over the library — node-at finds the expr + its scope, TypeInfo.typeOf infers
// the type (the library's inference, not ours), formatType renders it.
// ---------------------------------------------------------------------------

export function computeHover(text: string, dialect: Dialect, position: Position, schema?: Schema): Hover | null {
	const ast = toAst(text, dialect);
	const tree = resolveScopes(ast, dialect);
	// Pass `ast` so node-at can also reach query-level ORDER BY / LIMIT exprs (Task B2 fix) —
	// those live on QueryExpr, outside any Scope.body, so hover would miss them without it.
	const hit = nodeAt(tree, positionToOffset(text, position), ast);
	if (!hit) return null;

	const types = new TypeInfo(schema ?? new Schema({}));
	const type = types.typeOf(hit.expr, hit.scope);
	if (type.kind === "unknown") return null;

	return {
		contents: { kind: "markdown", value: "```\n" + formatType(type) + "\n```" },
		range: rangeFromCst(hit.expr.cst),
	};
}
