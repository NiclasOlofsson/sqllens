/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This file is an adaptation of Presto's presto-parser/src/main/antlr4/com/facebook/presto/sql/parser/SqlBase.g4 grammar.
 *
 * Provenance: forked from apache/spark's SqlBaseLexer.g4 (Spark SQL == Databricks SQL).
 * Renamed lexer grammar SqlBaseLexer -> DatabricksLexer. The Java @header/@members were
 * ported to TypeScript for the antlr4ng target: getText() -> this.text, _input -> this.inputStream
 * (LA() returns a char code), and the Deque<String> tag stack -> a string[]. Per-site actions and
 * predicates were prefixed with `this.` as the TypeScript target requires.
 */

lexer grammar DatabricksLexer;

// Spark's keyword token rules are uppercase literals (SELECT: 'SELECT';). The real Spark
// runtime matches them case-insensitively by feeding the lexer through an UpperCaseCharStream
// wrapper. We have no such wrapper in the antlr4ng port, so we use ANTLR's built-in
// caseInsensitive lexer option instead — same effect (case-insensitive matching, original token
// text preserved), no runtime shim required.
options { caseInsensitive = true; }

@members {
  /** When true, the parser should fail on an unclosed bracketed comment. */
  public has_unclosed_bracketed_comment = false;

  /**
   * Verify whether the current token is a valid decimal token (one containing a dot).
   * Returns true when the character that follows the token is not a digit, letter, or underscore.
   *
   * For example:
   * For char stream "2.3", "2." is not a valid decimal token, because it is followed by digit '3'.
   * For char stream "2.3_", "2.3" is not a valid decimal token, because it is followed by '_'.
   * For char stream "2.3W", "2.3" is not a valid decimal token, because it is followed by 'W'.
   * For char stream "12.0D 34.E2+0.12 "  12.0D is a valid decimal token because it is followed
   * by a space. 34.E2 is a valid decimal token because it is followed by symbol '+'.
   */
  public isValidDecimal(): boolean {
    const nextChar = this.inputStream.LA(1);
    // antlr4ng's caseInsensitive option leaves LA() returning the original character, so we must
    // reject a following letter of either case (Spark's UpperCaseCharStream only ever saw upper).
    if (nextChar >= 0x41 /* A */ && nextChar <= 0x5A /* Z */ ||
        nextChar >= 0x61 /* a */ && nextChar <= 0x7A /* z */ ||
        nextChar >= 0x30 /* 0 */ && nextChar <= 0x39 /* 9 */ ||
        nextChar === 0x5F /* _ */) {
      return false;
    } else {
      return true;
    }
  }

  /**
   * Called when we see the start of a block comment and try to match it as a bracketed
   * comment. If the next character is '+', it should be parsed as a hint later, so we must
   * not match it as a bracketed comment. Returns true if the next character is '+'.
   */
  public isHint(): boolean {
    return this.inputStream.LA(1) === 0x2B /* + */;
  }

  /**
   * Called when the character stream ends inside a bracketed comment. Sets the flag so the
   * parse can fail later for the unclosed comment.
   */
  public markUnclosedComment(): void {
    this.has_unclosed_bracketed_comment = true;
  }

  /** Tags used to detect the end of a dollar-quoted string literal (used as a stack). */
  private readonly tags: string[] = [];

  /** When greater than zero, we are in the middle of parsing an ARRAY/MAP/STRUCT type. */
  public complex_type_level_counter = 0;

  /** Increment when we hit keyword 'ARRAY', 'MAP', or 'STRUCT'. */
  public incComplexTypeLevelCounter(): void {
    this.complex_type_level_counter++;
  }

  /**
   * Decrement on a closing '>' while the counter is positive (i.e. inside a complex type).
   * Otherwise it is a dangling GT token and we do nothing.
   */
  public decComplexTypeLevelCounter(): void {
    if (this.complex_type_level_counter > 0) this.complex_type_level_counter--;
  }

  /**
   * If the counter is zero, '>>'/'>>>' is a shift operator rather than the closing tags of a
   * complex type definition such as MAP<INT, ARRAY<INT>>.
   */
  public isShiftRightOperator(): boolean {
    return this.complex_type_level_counter === 0;
  }
}

SEMICOLON: ';';

LEFT_PAREN: '(';
RIGHT_PAREN: ')';
COMMA: ',';
DOT: '.';
LEFT_BRACKET: '[';
RIGHT_BRACKET: ']';
BANG: '!';

// NOTE: If you add a new token in the list below, you should update the list of keywords
// and reserved tag in `docs/sql-ref-ansi-compliance.md#sql-keywords`, and
// modify `ParserUtils.toExprAlias()` which assumes all keywords are between `ADD` and `ZONE`.

//============================
// Start of the keywords list
//============================
//--SPARK-KEYWORD-LIST-START
ADD: 'ADD';
AFTER: 'AFTER';
AGGREGATE: 'AGGREGATE';
ALL: 'ALL';
ALTER: 'ALTER';
ALWAYS: 'ALWAYS';
ANALYZE: 'ANALYZE';
AND: 'AND';
ANTI: 'ANTI';
ANY: 'ANY';
ANY_VALUE: 'ANY_VALUE';
APPROX: 'APPROX';
ARCHIVE: 'ARCHIVE';
ARRAY: 'ARRAY' {this.incComplexTypeLevelCounter();};
AS: 'AS';
ASC: 'ASC';
ASENSITIVE: 'ASENSITIVE';
AT: 'AT';
ATOMIC: 'ATOMIC';
AUTHORIZATION: 'AUTHORIZATION';
BEGIN: 'BEGIN';
BERNOULLI: 'BERNOULLI';
BETWEEN: 'BETWEEN';
BIGINT: 'BIGINT';
BINARY: 'BINARY';
BINDING: 'BINDING';
BOOLEAN: 'BOOLEAN';
BOTH: 'BOTH';
BUCKET: 'BUCKET';
BUCKETS: 'BUCKETS';
BY: 'BY';
BYTE: 'BYTE';
CACHE: 'CACHE';
CALL: 'CALL';
CALLED: 'CALLED';
CASCADE: 'CASCADE';
CASE: 'CASE';
CAST: 'CAST';
CATALOG: 'CATALOG';
CATALOGS: 'CATALOGS';
CHANGE: 'CHANGE';
CHANGES: 'CHANGES';
CHAR: 'CHAR';
CHARACTER: 'CHARACTER';
CHECK: 'CHECK';
CLEAR: 'CLEAR';
CLOSE: 'CLOSE';
CLUSTER: 'CLUSTER';
CLUSTERED: 'CLUSTERED';
CODEGEN: 'CODEGEN';
COLLATE: 'COLLATE';
COLLATION: 'COLLATION';
COLLATIONS: 'COLLATIONS';
COLLECTION: 'COLLECTION';
COLUMN: 'COLUMN';
COLUMNS: 'COLUMNS';
COMMENT: 'COMMENT';
COMMIT: 'COMMIT';
COMPACT: 'COMPACT';
COMPACTIONS: 'COMPACTIONS';
COMPENSATION: 'COMPENSATION';
COMPUTE: 'COMPUTE';
CONCATENATE: 'CONCATENATE';
CONDITION: 'CONDITION';
CONSTRAINT: 'CONSTRAINT';
CONTAINS: 'CONTAINS';
CONTINUE: 'CONTINUE';
COST: 'COST';
CREATE: 'CREATE';
// CREDENTIAL — storage-credential option on a path-based table reference,
// `FROM ... WITH (CREDENTIAL <name>)`. https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-table-reference
CREDENTIAL: 'CREDENTIAL';
CROSS: 'CROSS';
CUBE: 'CUBE';
CURRENT: 'CURRENT';
CURRENT_DATABASE: 'CURRENT_DATABASE';
CURRENT_DATE: 'CURRENT_DATE';
CURRENT_PATH: 'CURRENT_PATH';
CURRENT_SCHEMA: 'CURRENT_SCHEMA';
CURRENT_TIME: 'CURRENT_TIME';
CURRENT_TIMESTAMP: 'CURRENT_TIMESTAMP';
CURRENT_USER: 'CURRENT_USER';
CURSOR: 'CURSOR';
DAY: 'DAY';
DAYS: 'DAYS';
DAYOFYEAR: 'DAYOFYEAR';
DATA: 'DATA';
DATE: 'DATE';
DATABASE: 'DATABASE';
DATABASES: 'DATABASES';
DATEADD: 'DATEADD';
DATE_ADD: 'DATE_ADD';
DATEDIFF: 'DATEDIFF';
DATE_DIFF: 'DATE_DIFF';
DBPROPERTIES: 'DBPROPERTIES';
DEC: 'DEC';
DECIMAL: 'DECIMAL';
DECLARE: 'DECLARE';
DEFAULT: 'DEFAULT';
DEFAULT_PATH: 'DEFAULT_PATH';
DEFINED: 'DEFINED';
DEFINER: 'DEFINER';
DELAY: 'DELAY';
DELETE: 'DELETE';
DELIMITED: 'DELIMITED';
DESC: 'DESC';
DESCRIBE: 'DESCRIBE';
DETERMINISTIC: 'DETERMINISTIC';
DFS: 'DFS';
DIRECTORIES: 'DIRECTORIES';
DIRECTORY: 'DIRECTORY';
DISTANCE: 'DISTANCE';
DISTINCT: 'DISTINCT';
DISTRIBUTE: 'DISTRIBUTE';
DIV: 'DIV';
DO: 'DO';
DOUBLE: 'DOUBLE';
DROP: 'DROP';
ELSE: 'ELSE';
ELSEIF: 'ELSEIF';
END: 'END';
ENFORCED: 'ENFORCED';
ESCAPE: 'ESCAPE';
ESCAPED: 'ESCAPED';
EVOLUTION: 'EVOLUTION';
EXACT: 'EXACT';
EXCEPT: 'EXCEPT';
EXCHANGE: 'EXCHANGE';
EXCLUDE: 'EXCLUDE';
EXCLUSIVE: 'EXCLUSIVE';
EXISTS: 'EXISTS';
EXIT: 'EXIT';
EXPLAIN: 'EXPLAIN';
EXPORT: 'EXPORT';
EXTEND: 'EXTEND';
EXTENDED: 'EXTENDED';
EXTERNAL: 'EXTERNAL';
EXTRACT: 'EXTRACT';
FALSE: 'FALSE';
FETCH: 'FETCH';
FIELDS: 'FIELDS';
FILTER: 'FILTER';
FILEFORMAT: 'FILEFORMAT';
FIRST: 'FIRST';
FLOAT: 'FLOAT';
FLOW: 'FLOW';
FOLLOWING: 'FOLLOWING';
FOR: 'FOR';
FOREIGN: 'FOREIGN';
FORMAT: 'FORMAT';
FORMATTED: 'FORMATTED';
FOUND: 'FOUND';
FROM: 'FROM';
FULL: 'FULL';
FUNCTION: 'FUNCTION';
FUNCTIONS: 'FUNCTIONS';
GENERATED: 'GENERATED';
GEOGRAPHY: 'GEOGRAPHY';
GEOMETRY: 'GEOMETRY';
GLOBAL: 'GLOBAL';
GRANT: 'GRANT';
GROUP: 'GROUP';
GROUPING: 'GROUPING';
HANDLER: 'HANDLER';
HAVING: 'HAVING';
BINARY_HEX: 'X';
HOUR: 'HOUR';
HOURS: 'HOURS';
IDENTIFIER_KW: 'IDENTIFIER';
IDENTIFIED: 'IDENTIFIED';
IDENTITY: 'IDENTITY';
IF: 'IF';
IGNORE: 'IGNORE';
IMMEDIATE: 'IMMEDIATE';
IMPORT: 'IMPORT';
IN: 'IN';
INCLUDE: 'INCLUDE';
INCLUSIVE: 'INCLUSIVE';
INCREMENT: 'INCREMENT';
INDEX: 'INDEX';
INDEXES: 'INDEXES';
INNER: 'INNER';
INPATH: 'INPATH';
INPUT: 'INPUT';
INPUTFORMAT: 'INPUTFORMAT';
INSERT: 'INSERT';
INSENSITIVE: 'INSENSITIVE';
INTERSECT: 'INTERSECT';
INTERVAL: 'INTERVAL';
INT: 'INT';
INTEGER: 'INTEGER';
INTO: 'INTO';
INVOKER: 'INVOKER';
IS: 'IS';
ITEMS: 'ITEMS';
ITERATE: 'ITERATE';
JOIN: 'JOIN';
JSON: 'JSON';
KEY: 'KEY';
KEYS: 'KEYS';
LANGUAGE: 'LANGUAGE';
LAST: 'LAST';
LATERAL: 'LATERAL';
LAZY: 'LAZY';
LEADING: 'LEADING';
LEAVE: 'LEAVE';
LEFT: 'LEFT';
LEVEL: 'LEVEL';
LIKE: 'LIKE';
ILIKE: 'ILIKE';
LIMIT: 'LIMIT';
LINES: 'LINES';
LIST: 'LIST';
LOAD: 'LOAD';
LOCAL: 'LOCAL';
LOCATION: 'LOCATION';
LOCK: 'LOCK';
LOCKS: 'LOCKS';
LOGICAL: 'LOGICAL';
LONG: 'LONG';
LOOP: 'LOOP';
MACRO: 'MACRO';
MAP: 'MAP' {this.incComplexTypeLevelCounter();};
MATCHED: 'MATCHED';
MATERIALIZED: 'MATERIALIZED';
MAX: 'MAX';
MEASURE: 'MEASURE';
MERGE: 'MERGE';
METRICS: 'METRICS';
MICROSECOND: 'MICROSECOND';
MICROSECONDS: 'MICROSECONDS';
MILLISECOND: 'MILLISECOND';
MILLISECONDS: 'MILLISECONDS';
MINUTE: 'MINUTE';
MINUTES: 'MINUTES';
MODIFIES: 'MODIFIES';
MONTH: 'MONTH';
MONTHS: 'MONTHS';
MSCK: 'MSCK';
NAME: 'NAME';
NAMESPACE: 'NAMESPACE';
NAMESPACES: 'NAMESPACES';
NANOSECOND: 'NANOSECOND';
NANOSECONDS: 'NANOSECONDS';
NATURAL: 'NATURAL';
NEAREST: 'NEAREST';
NEXT: 'NEXT';
NO: 'NO';
NONE: 'NONE';
NOT: 'NOT';
NULL: 'NULL';
NULLS: 'NULLS';
NUMERIC: 'NUMERIC';
NORELY: 'NORELY';
OF: 'OF';
OFFSET: 'OFFSET';
ON: 'ON';
ONLY: 'ONLY';
OPEN: 'OPEN';
OPTION: 'OPTION';
OPTIONS: 'OPTIONS';
OR: 'OR';
ORDER: 'ORDER';
OUT: 'OUT';
OUTER: 'OUTER';
OUTPUTFORMAT: 'OUTPUTFORMAT';
OVER: 'OVER';
OVERLAPS: 'OVERLAPS';
OVERLAY: 'OVERLAY';
OVERWRITE: 'OVERWRITE';
PARTITION: 'PARTITION';
PARTITIONED: 'PARTITIONED';
PARTITIONS: 'PARTITIONS';
PATH: 'PATH';
PERCENTLIT: 'PERCENT';
PIVOT: 'PIVOT';
PLACING: 'PLACING';
POSITION: 'POSITION';
PRECEDING: 'PRECEDING';
PRIMARY: 'PRIMARY';
PRINCIPALS: 'PRINCIPALS';
PROCEDURE: 'PROCEDURE';
PROCEDURES: 'PROCEDURES';
PROPERTIES: 'PROPERTIES';
PURGE: 'PURGE';
QUALIFY: 'QUALIFY';
QUARTER: 'QUARTER';
QUERY: 'QUERY';
RANGE: 'RANGE';
READ: 'READ';
READS: 'READS';
REAL: 'REAL';
RECORDREADER: 'RECORDREADER';
RECORDWRITER: 'RECORDWRITER';
RECOVER: 'RECOVER';
RECURSION: 'RECURSION';
RECURSIVE: 'RECURSIVE';
REDUCE: 'REDUCE';
REFERENCES: 'REFERENCES';
REFRESH: 'REFRESH';
RELY: 'RELY';
RENAME: 'RENAME';
REPAIR: 'REPAIR';
REPEAT: 'REPEAT';
REPEATABLE: 'REPEATABLE';
REPLACE: 'REPLACE';
RESET: 'RESET';
RESPECT: 'RESPECT';
RESTRICT: 'RESTRICT';
RETURN: 'RETURN';
RETURNS: 'RETURNS';
REVOKE: 'REVOKE';
RIGHT: 'RIGHT';
RLIKE: 'RLIKE' | 'REGEXP';
ROLE: 'ROLE';
ROLES: 'ROLES';
ROLLBACK: 'ROLLBACK';
ROLLUP: 'ROLLUP';
ROW: 'ROW';
ROWS: 'ROWS';
SECOND: 'SECOND';
SECONDS: 'SECONDS';
SCHEMA: 'SCHEMA';
SCHEMAS: 'SCHEMAS';
SECURITY: 'SECURITY';
SELECT: 'SELECT';
SEMI: 'SEMI';
SEPARATED: 'SEPARATED';
SERDE: 'SERDE';
SERDEPROPERTIES: 'SERDEPROPERTIES';
SESSION_USER: 'SESSION_USER';
SET: 'SET';
SETMINUS: 'MINUS';
SETS: 'SETS';
SHORT: 'SHORT';
SHOW: 'SHOW';
SIMILARITY: 'SIMILARITY';
SINGLE: 'SINGLE';
SKEWED: 'SKEWED';
SMALLINT: 'SMALLINT';
SOME: 'SOME';
SORT: 'SORT';
SORTED: 'SORTED';
SOURCE: 'SOURCE';
SPECIFIC: 'SPECIFIC';
SQL: 'SQL';
SQLEXCEPTION: 'SQLEXCEPTION';
SQLSTATE: 'SQLSTATE';
START: 'START';
STATISTICS: 'STATISTICS';
STORED: 'STORED';
STRATIFY: 'STRATIFY';
STREAM: 'STREAM';
STREAMING: 'STREAMING';
STRING: 'STRING';
STRUCT: 'STRUCT' {this.incComplexTypeLevelCounter();};
SUBSTR: 'SUBSTR';
SUBSTRING: 'SUBSTRING';
SYNC: 'SYNC';
SYSTEM: 'SYSTEM';
SYSTEM_TIME: 'SYSTEM_TIME';
SYSTEM_VERSION: 'SYSTEM_VERSION';
SYSTEM_PATH: 'SYSTEM_PATH';
TABLE: 'TABLE';
TABLES: 'TABLES';
TABLESAMPLE: 'TABLESAMPLE';
TARGET: 'TARGET';
TBLPROPERTIES: 'TBLPROPERTIES';
TEMPORARY: 'TEMPORARY' | 'TEMP';
TERMINATED: 'TERMINATED';
THEN: 'THEN';
TIME: 'TIME';
TIMEDIFF: 'TIMEDIFF';
TIMESTAMP: 'TIMESTAMP';
TIMESTAMP_LTZ: 'TIMESTAMP_LTZ';
TIMESTAMP_NTZ: 'TIMESTAMP_NTZ';
TIMESTAMPADD: 'TIMESTAMPADD';
TIMESTAMPDIFF: 'TIMESTAMPDIFF';
TINYINT: 'TINYINT';
TO: 'TO';
EXECUTE: 'EXECUTE';
TOUCH: 'TOUCH';
TRAILING: 'TRAILING';
TRANSACTION: 'TRANSACTION';
TRANSACTIONS: 'TRANSACTIONS';
TRANSFORM: 'TRANSFORM';
TRIM: 'TRIM';
TRUE: 'TRUE';
TRUNCATE: 'TRUNCATE';
TRY_CAST: 'TRY_CAST';
TYPE: 'TYPE';
UNARCHIVE: 'UNARCHIVE';
UNBOUNDED: 'UNBOUNDED';
UNCACHE: 'UNCACHE';
UNION: 'UNION';
UNIQUE: 'UNIQUE';
UNKNOWN: 'UNKNOWN';
UNLOCK: 'UNLOCK';
UNPIVOT: 'UNPIVOT';
UNSET: 'UNSET';
UNTIL: 'UNTIL';
UPDATE: 'UPDATE';
USE: 'USE';
USER: 'USER';
USING: 'USING';
VALUE: 'VALUE';
VALUES: 'VALUES';
VARCHAR: 'VARCHAR';
VAR: 'VAR';
VARIABLE: 'VARIABLE';
VARIANT: 'VARIANT';
VERSION: 'VERSION';
VIEW: 'VIEW';
VIEWS: 'VIEWS';
VOID: 'VOID';
WATERMARK: 'WATERMARK';
WEEK: 'WEEK';
WEEKS: 'WEEKS';
WHEN: 'WHEN';
WHERE: 'WHERE';
WHILE: 'WHILE';
WINDOW: 'WINDOW';
WITH: 'WITH';
WITHIN: 'WITHIN';
WITHOUT: 'WITHOUT';
YEAR: 'YEAR';
YEARS: 'YEARS';
ZONE: 'ZONE';
//--SPARK-KEYWORD-LIST-END
//============================
// End of the keywords list
//============================

EQ  : '=' | '==';
NSEQ: '<=>';
NEQ : '<>';
NEQJ: '!=';
LT  : '<';
LTE : '<=' | '!>';
GT  : '>' {this.decComplexTypeLevelCounter();};
GTE : '>=' | '!<';
SHIFT_LEFT: '<<';
SHIFT_RIGHT: '>>' {this.isShiftRightOperator()}?;
SHIFT_RIGHT_UNSIGNED: '>>>' {this.isShiftRightOperator()}?;

PLUS: '+';
MINUS: '-';
ASTERISK: '*';
SLASH: '/';
PERCENT: '%';
TILDE: '~';
AMPERSAND: '&';
// Databricks Delta time-travel shorthand `t@v123` / `t@20240101000000000`
// (docs.databricks.com delta history: "Query an earlier version of the table").
AT_SIGN: '@';
PIPE: '|';
CONCAT_PIPE: '||';
OPERATOR_PIPE: '|>';
HAT: '^';
COLON: ':';
DOUBLE_COLON: '::';
ARROW: '->';
FAT_ARROW : '=>';
HENT_START: '/*+';
HENT_END: '*/';
QUESTION: '?';

STRING_LITERAL
    : '\'' ( ~('\''|'\\') | ('\\' .) | ('\'' '\'') )* '\''
    | 'R\'' (~'\'')* '\''
    | 'R"'(~'"')* '"'
    ;

BEGIN_DOLLAR_QUOTED_STRING
    : DOLLAR_QUOTED_TAG {this.tags.push(this.text);} -> pushMode(DOLLAR_QUOTED_STRING_MODE)
    ;

DOUBLEQUOTED_STRING
    :'"' ( ~('"'|'\\') | '""' | ('\\' .) )* '"'
    ;

// NOTE: If you move a numeric literal, you should modify `ParserUtils.toExprAlias()`
// which assumes all numeric literals are between `BIGINT_LITERAL` and `BIGDECIMAL_LITERAL`.

BIGINT_LITERAL
    : DIGIT+ 'L'
    ;

SMALLINT_LITERAL
    : DIGIT+ 'S'
    ;

TINYINT_LITERAL
    : DIGIT+ 'Y'
    ;

INTEGER_VALUE
    : DIGIT+
    ;

EXPONENT_VALUE
    : DIGIT+ EXPONENT
    | DECIMAL_DIGITS EXPONENT {this.isValidDecimal()}?
    ;

DECIMAL_VALUE
    : DECIMAL_DIGITS {this.isValidDecimal()}?
    ;

FLOAT_LITERAL
    : DIGIT+ EXPONENT? 'F'
    | DECIMAL_DIGITS EXPONENT? 'F' {this.isValidDecimal()}?
    ;

DOUBLE_LITERAL
    : DIGIT+ EXPONENT? 'D'
    | DECIMAL_DIGITS EXPONENT? 'D' {this.isValidDecimal()}?
    ;

BIGDECIMAL_LITERAL
    : DIGIT+ EXPONENT? 'BD'
    | DECIMAL_DIGITS EXPONENT? 'BD' {this.isValidDecimal()}?
    ;

// Generalize the identifier to give a sensible INVALID_IDENTIFIER error message:
// * Unicode letters rather than a-z and A-Z only
// * URI paths for table references using paths
// We then narrow down to ANSI rules in exitUnquotedIdentifier() in the parser.
IDENTIFIER
    : (UNICODE_LETTER | DIGIT | '_')+
    | UNICODE_LETTER+ '://' (UNICODE_LETTER | DIGIT | '_' | '/' | '-' | '.' | '?' | '=' | '&' | '#' | '%')+
    ;

BACKQUOTED_IDENTIFIER
    : '`' ( ~'`' | '``' )* '`'
    ;

fragment DECIMAL_DIGITS
    : DIGIT+ '.' DIGIT*
    | '.' DIGIT+
    ;

fragment EXPONENT
    : 'E' [+-]? DIGIT+
    ;

fragment DIGIT
    : [0-9]
    ;

fragment LETTER
    : [A-Z]
    ;

fragment DOLLAR_QUOTED_TAG
    : '$' LETTER* '$'
    ;

fragment UNICODE_LETTER
    : [\p{L}]
    ;

SIMPLE_COMMENT
    : '--' ('\\\n' | ~[\r\n])* '\r'? '\n'? -> channel(HIDDEN)
    ;

BRACKETED_COMMENT
    : '/*' {!this.isHint()}? ( BRACKETED_COMMENT | . )*? ('*/' | {this.markUnclosedComment();} EOF) -> channel(HIDDEN)
    ;

WS
    : [ \t\n\f\r\u000B\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u202F\u205F\u3000]+ -> channel(HIDDEN)
    ;

// Catch-all for anything we can't recognize.
// We use this to be able to ignore and recover all the text
// when splitting statements with DelimiterLexer
UNRECOGNIZED
    : .
    ;

mode DOLLAR_QUOTED_STRING_MODE;
DOLLAR_QUOTED_STRING_BODY
    : ~'$'+
    | '$' ~'$'*
    ;

END_DOLLAR_QUOTED_STRING
    : DOLLAR_QUOTED_TAG {this.text === this.tags[this.tags.length - 1]}? {this.tags.pop();} -> popMode
    ;
