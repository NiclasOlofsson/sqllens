// The complete postgres dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for postgres, read this folder.
import { postgresBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parsePostgres } from "./parse.js";

export const postgres = {
	parse: parsePostgres,
	lower,
	behavior: postgresBehavior,
};
