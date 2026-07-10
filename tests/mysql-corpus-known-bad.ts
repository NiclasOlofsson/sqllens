// Genuinely-invalid entries in the MySQL grammars-v4 example corpus — upstream examples that are
// not valid MySQL and that the parser therefore correctly rejects. These examples are the grammar's
// OWN positive corpus (they ship to exercise `sql/mysql/Positive-Technologies/MySqlParser.g4`), so
// this is expected to stay EMPTY: a fork that regresses on one of these broke something the upstream
// grammar handled.
//
// An entry is warranted only when an upstream example is genuinely not valid MySQL (RTFM'd against
// https://dev.mysql.com/doc/refman/8.4/en/sql-statements.html). Never add an entry to route around a
// real grammar gap — fix the `.g4` instead. Each key is a path relative to `mysql/grammars-v4`
// (forward slashes); each value cites the specific defect.

export const KNOWN_BAD: Record<string, string> = {};
