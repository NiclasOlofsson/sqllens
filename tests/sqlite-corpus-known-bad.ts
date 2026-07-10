// Genuinely-invalid entries in the SQLite grammars-v4 example corpus — upstream examples that are
// not valid SQLite and that the parser therefore correctly rejects. The grammars-v4 examples are the
// grammar's OWN positive corpus (they ship to exercise `sql/sqlite/SQLiteParser.g4`), so this is
// expected to stay EMPTY: a fork that regresses on one of these broke something upstream handled.
//
// An entry is warranted only when an upstream example is genuinely not valid SQLite (RTFM'd against
// https://sqlite.org/lang.html). Never add an entry to route around a real grammar gap — fix the
// `.g4` instead. Each key is a path relative to `sqlite/grammars-v4` (forward slashes); each value
// cites the specific defect.

export const KNOWN_BAD: Record<string, string> = {};
