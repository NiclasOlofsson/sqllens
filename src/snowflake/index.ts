// The complete snowflake dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for snowflake, read this folder.
import { snowflakeBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseSnowflake } from "./parse.js";

export const snowflake = {
	parse: parseSnowflake,
	lower,
	behavior: snowflakeBehavior,
};
