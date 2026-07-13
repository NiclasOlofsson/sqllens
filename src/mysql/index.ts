// The complete mysql dialect module: parse + lower (front end) and behavior (semantic knowledge).
// The registry wires this; to understand everything sqllens does for mysql, read this folder.
import { mysqlBehavior } from "./behavior.js";
import { lower } from "./lower.js";
import { parseMysql } from "./parse.js";

export const mysql = {
	parse: parseMysql,
	lower,
	behavior: mysqlBehavior,
};
