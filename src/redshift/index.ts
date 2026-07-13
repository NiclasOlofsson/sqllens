// The complete redshift dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for redshift, read this folder.
import { redshiftBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseRedshift } from "./parse.js";

export const redshift = {
	parse: parseRedshift,
	lower,
	behavior: redshiftBehavior,
};
