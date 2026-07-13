// The complete duckdb dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for duckdb, read this folder.
import { duckdbBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseDuckdb } from "./parse.js";

export const duckdb = {
	parse: parseDuckdb,
	lower,
	behavior: duckdbBehavior,
};
