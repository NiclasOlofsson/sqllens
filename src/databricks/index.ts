// The complete databricks dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for databricks, read this folder.
import { databricksBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseDatabricks } from "./parse.js";

export const databricks = {
	parse: parseDatabricks,
	lower,
	behavior: databricksBehavior,
};
