// The complete tsql dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for tsql, read this folder.
import { tsqlBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseTSql } from "./parse.js";

export const tsql = {
	parse: parseTSql,
	lower,
	behavior: tsqlBehavior,
};
