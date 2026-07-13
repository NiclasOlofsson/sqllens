// The complete bigquery dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for bigquery, read this folder.
import { bigqueryBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseBigQuery } from "./parse.js";

export const bigquery = {
	parse: parseBigQuery,
	lower,
	behavior: bigqueryBehavior,
};
