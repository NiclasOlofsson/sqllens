// The complete trino dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for trino, read this folder.
import { trinoBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseTrino } from "./parse.js";

export const trino = {
	parse: parseTrino,
	lower,
	behavior: trinoBehavior,
};
