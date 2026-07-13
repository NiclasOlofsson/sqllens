// The complete sqlite dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for sqlite, read this folder.
import { sqliteBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseSqlite } from "./parse.js";

export const sqlite = {
	parse: parseSqlite,
	lower,
	behavior: sqliteBehavior,
};
