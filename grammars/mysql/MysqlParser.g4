// ---------------------------------------------------------------------------
// Forked from antlr/grammars-v4 (sql/mysql/Positive-Technologies)
//   upstream commit: bf61744020dc46f2d7b8761e35b0c0cb39b3f31a
//   retrieved:       2026-07-10
// Upstream MIT license retained below. Local edits tracked in git history.
// ---------------------------------------------------------------------------
/*
MySQL (Positive Technologies) grammar
The MIT License (MIT).
Copyright (c) 2015-2017, Ivan Kochurkin (kvanttt@gmail.com), Positive Technologies.
Copyright (c) 2017, Ivan Khudyashev (IHudyashov@ptsecurity.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// $antlr-format alignTrailingComments true, columnLimit 150, minEmptyLines 1, maxEmptyLinesToKeep 1, reflowComments false, useTab false
// $antlr-format allowShortRulesOnASingleLine false, allowShortBlocksOnASingleLine true, alignSemicolons hanging, alignColons hanging

parser grammar MysqlParser;

options {
    tokenVocab = MysqlLexer;
}

// Top Level Description

root
    : sqlStatements? (MINUS MINUS)? EOF
    ;

// A `;`-separated batch. Real MySQL REQUIRES a semicolon (statement delimiter) between adjacent
// statements — `SELECT 1 SELECT 2` is a syntax error, and the client splits a script on `;`
// (dev.mysql.com/doc/refman/8.4/en/mysql-batch-commands.html, .../stored-programs-defining.html on the
// delimiter). Upstream's `SEMI?` made the separator OPTIONAL, so a trailing parenthesized construct
// could be claimed as a fresh statement: `... WHERE a > ANY (SELECT ...)` split at `> ANY` into a bare
// column plus a second `(SELECT ...)` statement (the quantifiedSubqueryAtom mis-split). Requiring SEMI
// between statements (trailing SEMI on the last is optional) removes that: with no `;`, the parenthesized
// query can only continue the current statement, so the quantified comparison parses as one statement.
sqlStatements
    : (statementItem (MINUS MINUS)? SEMI | emptyStatement_)* (statementItem ((MINUS MINUS)? SEMI)? | emptyStatement_)
    ;

// One batch element. The upstream Positive-Technologies grammar models `WITH cte AS (...) SELECT ...`
// as a bare `withStatement` (the WITH clause only) followed by its query — the two are NOT joined by a
// rule, and MySQL writes them with NO separating semicolon (the CTE binds to the query that follows).
// So the ONE no-semicolon statement adjacency real MySQL has is `withStatement` → its query; admit
// exactly that here and require SEMI for every other pair. lower() rejoins the pair into one CTE query.
statementItem
    : withStatement sqlStatement
    | sqlStatement
    | emptyStatement_
    ;

sqlStatement
    : ddlStatement
    | dmlStatement
    | transactionStatement
    | replicationStatement
    | preparedStatement
    | administrationStatement
    | utilityStatement
    ;

emptyStatement_
    : SEMI
    ;

ddlStatement
    : createDatabase
    | createEvent
    | createIndex
    | createLogfileGroup
    | createProcedure
    | createFunction
    | createServer
    | createTable
    | createTablespaceInnodb
    | createTablespaceNdb
    | createTrigger
    | createView
    | createRole
    | alterDatabase
    | alterEvent
    | alterFunction
    | alterInstance
    | alterLogfileGroup
    | alterProcedure
    | alterServer
    | alterTable
    | alterTablespace
    | alterView
    | dropDatabase
    | dropEvent
    | dropIndex
    | dropLogfileGroup
    | dropProcedure
    | dropFunction
    | dropServer
    | dropTable
    | dropTablespace
    | dropTrigger
    | dropView
    | dropRole
    | setRole
    | renameTable
    | truncateTable
    ;

dmlStatement
    : selectStatement
    | insertStatement
    | updateStatement
    | deleteStatement
    | replaceStatement
    | callStatement
    | loadDataStatement
    | loadXmlStatement
    | importTableStatement
    | doStatement
    | handlerStatement
    | valuesStatement
    | withStatement
    | tableStatement
    ;

transactionStatement
    : startTransaction
    | beginWork
    | commitWork
    | rollbackWork
    | savepointStatement
    | rollbackStatement
    | releaseStatement
    | lockTables
    | unlockTables
    ;

replicationStatement
    : changeMaster
    | changeReplicationFilter
    | purgeBinaryLogs
    | resetMaster
    | resetSlave
    | startSlave
    | stopSlave
    | startGroupReplication
    | stopGroupReplication
    | xaStartTransaction
    | xaEndTransaction
    | xaPrepareStatement
    | xaCommitWork
    | xaRollbackWork
    | xaRecoverWork
    ;

preparedStatement
    : prepareStatement
    | executeStatement
    | deallocatePrepare
    ;

// remark: NOT INCLUDED IN sqlStatement, but include in body
//  of routine's statements
compoundStatement
    : blockStatement
    | caseStatement
    | ifStatement
    | leaveStatement
    | loopStatement
    | repeatStatement
    | whileStatement
    | iterateStatement
    | returnStatement
    | cursorStatement
    | withStatement dmlStatement
    ;

administrationStatement
    : alterUser
    | createUser
    | dropUser
    | grantStatement
    | grantProxy
    | renameUser
    | revokeStatement
    | revokeProxy
    | analyzeTable
    | checkTable
    | checksumTable
    | optimizeTable
    | repairTable
    | createUdfunction
    | installPlugin
    | uninstallPlugin
    | setStatement
    | showStatement
    | binlogStatement
    | cacheIndexStatement
    | flushStatement
    | killStatement
    | loadIndexIntoCache
    | resetStatement
    | shutdownStatement
    ;

utilityStatement
    : simpleDescribeStatement
    | fullDescribeStatement
    | helpStatement
    | useStatement
    | signalStatement
    | resignalStatement
    | diagnosticsStatement
    ;

// Data Definition Language

//    Create statements

createDatabase
    : CREATE dbFormat = (DATABASE | SCHEMA) ifNotExists? uid createDatabaseOption*
    ;

createEvent
    : CREATE ownerStatement? EVENT ifNotExists? fullId ON SCHEDULE scheduleExpression (
        ON COMPLETION NOT? PRESERVE
    )? enableType? (COMMENT STRING_LITERAL)? DO routineBody
    ;

createIndex
    : CREATE intimeAction = (ONLINE | OFFLINE)? indexCategory = (UNIQUE | FULLTEXT | SPATIAL)? INDEX uid indexType? ON tableName indexColumnNames
        indexOption* (
        ALGORITHM EQUAL_SYMBOL? algType = (DEFAULT | INPLACE | COPY)
        | LOCK EQUAL_SYMBOL? lockType = (DEFAULT | NONE | SHARED | EXCLUSIVE)
    )*
    ;

createLogfileGroup
    : CREATE LOGFILE GROUP uid ADD UNDOFILE undoFile = STRING_LITERAL (
        INITIAL_SIZE '='? initSize = fileSizeLiteral
    )? (UNDO_BUFFER_SIZE '='? undoSize = fileSizeLiteral)? (
        REDO_BUFFER_SIZE '='? redoSize = fileSizeLiteral
    )? (NODEGROUP '='? uid)? WAIT? (COMMENT '='? comment = STRING_LITERAL)? ENGINE '='? engineName
    ;

createProcedure
    : CREATE ownerStatement? PROCEDURE ifNotExists? fullId '(' procedureParameter? (',' procedureParameter)* ')' routineOption* routineBody
    ;

createFunction
    : CREATE ownerStatement? AGGREGATE? FUNCTION ifNotExists? fullId '(' functionParameter? (
        ',' functionParameter
    )* ')' RETURNS dataType routineOption* (routineBody | returnStatement)
    ;

createRole
    : CREATE ROLE ifNotExists? roleName (',' roleName)*
    ;

createServer
    : CREATE SERVER uid FOREIGN DATA WRAPPER wrapperName = (MYSQL | STRING_LITERAL) OPTIONS '(' serverOption (
        ',' serverOption
    )* ')'
    ;

createTable
    : CREATE TEMPORARY? TABLE ifNotExists? tableName (
        LIKE tableName
        | '(' LIKE parenthesisTable = tableName ')'
    ) # copyCreateTable
    // CREATE TABLE ... [AS] query_expression takes any query primary — SELECT, TABLE t, or
    // VALUES ROW(...) (dev.mysql.com/doc/refman/8.4/en/create-table-select.html), hence subqueryBody.
    | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions? (
        tableOption (','? tableOption)*
    )? partitionDefinitions? keyViolate = (IGNORE | REPLACE)? AS? subqueryBody # queryCreateTable
    | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions (
        tableOption (','? tableOption)*
    )? partitionDefinitions? # columnCreateTable
    ;

createTablespaceInnodb
    : CREATE TABLESPACE uid ADD DATAFILE datafile = STRING_LITERAL (
        FILE_BLOCK_SIZE '=' fileBlockSize = fileSizeLiteral
    )? (ENGINE '='? engineName)?
    ;

createTablespaceNdb
    : CREATE TABLESPACE uid ADD DATAFILE datafile = STRING_LITERAL USE LOGFILE GROUP uid (
        EXTENT_SIZE '='? extentSize = fileSizeLiteral
    )? (INITIAL_SIZE '='? initialSize = fileSizeLiteral)? (
        AUTOEXTEND_SIZE '='? autoextendSize = fileSizeLiteral
    )? (MAX_SIZE '='? maxSize = fileSizeLiteral)? (NODEGROUP '='? uid)? WAIT? (
        COMMENT '='? comment = STRING_LITERAL
    )? ENGINE '='? engineName
    ;

createTrigger
    : CREATE ownerStatement? TRIGGER ifNotExists? thisTrigger = fullId triggerTime = (
        BEFORE
        | AFTER
    ) triggerEvent = (INSERT | UPDATE | DELETE) ON tableName FOR EACH ROW (
        triggerPlace = (FOLLOWS | PRECEDES) otherTrigger = fullId
    )? routineBody
    ;

withClause
    : WITH RECURSIVE? commonTableExpressions
    ;

commonTableExpressions
    : cteName ('(' cteColumnName (',' cteColumnName)* ')')? AS '(' dmlStatement ')' (
        ',' commonTableExpressions
    )?
    ;

cteName
    : uid
    ;

cteColumnName
    : uid
    ;

createView
    : CREATE orReplace? (ALGORITHM '=' algType = (UNDEFINED | MERGE | TEMPTABLE))? ownerStatement? (
        SQL SECURITY secContext = (DEFINER | INVOKER)
    )? VIEW fullId ('(' uidList ')')? AS (
        '(' withClause? selectStatement ')'
        | withClause? selectStatement (WITH checkOption = (CASCADED | LOCAL)? CHECK OPTION)?
    )
    ;

// details

createDatabaseOption
    : DEFAULT? charSet '='? (charsetName | DEFAULT)
    | DEFAULT? COLLATE '='? collationName
    | DEFAULT? ENCRYPTION '='? STRING_LITERAL
    | READ ONLY '='? (DEFAULT | ZERO_DECIMAL | ONE_DECIMAL)
    ;

charSet
    : CHARACTER SET
    | CHARSET
    | CHAR SET
    ;

currentUserExpression
    : CURRENT_USER ('(' ')')?
    ;

ownerStatement
    : DEFINER '=' (userName | currentUserExpression)
    ;

scheduleExpression
    : AT timestampValue intervalExpr* # preciseSchedule
    | EVERY (decimalLiteral | expression) intervalType (
        STARTS startTimestamp = timestampValue (startIntervals += intervalExpr)*
    )? (ENDS endTimestamp = timestampValue (endIntervals += intervalExpr)*)? # intervalSchedule
    ;

timestampValue
    : CURRENT_TIMESTAMP
    | stringLiteral
    | decimalLiteral
    | expression
    ;

intervalExpr
    : '+' INTERVAL (decimalLiteral | expression) intervalType
    ;

intervalType
    : intervalTypeBase
    | YEAR
    | YEAR_MONTH
    | DAY_HOUR
    | DAY_MINUTE
    | DAY_SECOND
    | HOUR_MINUTE
    | HOUR_SECOND
    | MINUTE_SECOND
    | SECOND_MICROSECOND
    | MINUTE_MICROSECOND
    | HOUR_MICROSECOND
    | DAY_MICROSECOND
    ;

enableType
    : ENABLE
    | DISABLE
    | DISABLE ON SLAVE
    ;

indexType
    : USING (BTREE | HASH)
    ;

indexOption
    : KEY_BLOCK_SIZE EQUAL_SYMBOL? fileSizeLiteral
    | indexType
    | WITH PARSER uid
    | COMMENT STRING_LITERAL
    | (VISIBLE | INVISIBLE)
    | ENGINE_ATTRIBUTE EQUAL_SYMBOL? STRING_LITERAL
    | SECONDARY_ENGINE_ATTRIBUTE EQUAL_SYMBOL? STRING_LITERAL
    ;

procedureParameter
    : direction = (IN | OUT | INOUT)? uid dataType
    ;

functionParameter
    : uid dataType
    ;

routineOption
    : COMMENT STRING_LITERAL                                        # routineComment
    | LANGUAGE SQL                                                  # routineLanguage
    | NOT? DETERMINISTIC                                            # routineBehavior
    | ( CONTAINS SQL | NO SQL | READS SQL DATA | MODIFIES SQL DATA) # routineData
    | SQL SECURITY context = (DEFINER | INVOKER)                    # routineSecurity
    ;

serverOption
    : HOST STRING_LITERAL
    | DATABASE STRING_LITERAL
    | USER STRING_LITERAL
    | PASSWORD STRING_LITERAL
    | SOCKET STRING_LITERAL
    | OWNER STRING_LITERAL
    | PORT decimalLiteral
    ;

createDefinitions
    : '(' createDefinition (',' createDefinition)* ')'
    ;

createDefinition
    : fullColumnName columnDefinition # columnDeclaration
    | tableConstraint NOT? ENFORCED?  # constraintDeclaration
    | indexColumnDefinition           # indexDeclaration
    ;

columnDefinition
    : dataType columnConstraint* NOT? ENFORCED?
    ;

columnConstraint
    : nullNotnull                                                   # nullColumnConstraint
    | DEFAULT defaultValue                                          # defaultColumnConstraint
    | VISIBLE                                                       # visibilityColumnConstraint
    | INVISIBLE                                                     # invisibilityColumnConstraint
    | (AUTO_INCREMENT | ON UPDATE currentTimestamp)                 # autoIncrementColumnConstraint
    | PRIMARY? KEY                                                  # primaryKeyColumnConstraint
    | CLUSTERING KEY                                                # clusteringKeyColumnConstraint // Tokudb-specific only
    | UNIQUE KEY?                                                   # uniqueKeyColumnConstraint
    | COMMENT STRING_LITERAL                                        # commentColumnConstraint
    | COLUMN_FORMAT colformat = (FIXED | DYNAMIC | DEFAULT)         # formatColumnConstraint
    | STORAGE storageval = (DISK | MEMORY | DEFAULT)                # storageColumnConstraint
    | referenceDefinition                                           # referenceColumnConstraint
    | COLLATE collationName                                         # collateColumnConstraint
    | (GENERATED ALWAYS)? AS '(' expression ')' (VIRTUAL | STORED)? # generatedColumnConstraint
    | SERIAL DEFAULT VALUE                                          # serialDefaultColumnConstraint
    | (CONSTRAINT name = uid?)? CHECK '(' expression ')'            # checkColumnConstraint
    // Column-level [SECONDARY_]ENGINE_ATTRIBUTE [=] 'json' (8.0.21+), part of column_definition on
    // dev.mysql.com/doc/refman/8.4/en/create-table.html; upstream modelled it only as a table option.
    | attr = (ENGINE_ATTRIBUTE | SECONDARY_ENGINE_ATTRIBUTE) '='? STRING_LITERAL # engineAttributeColumnConstraint
    ;

tableConstraint
    : (CONSTRAINT name = uid?)? PRIMARY KEY index = uid? indexType? indexColumnNames indexOption*                         # primaryKeyTableConstraint
    | (CONSTRAINT name = uid?)? UNIQUE indexFormat = (INDEX | KEY)? index = uid? indexType? indexColumnNames indexOption* # uniqueKeyTableConstraint
    | (CONSTRAINT name = uid?)? FOREIGN KEY index = uid? indexColumnNames referenceDefinition                             # foreignKeyTableConstraint
    | (CONSTRAINT name = uid?)? CHECK '(' expression ')'                                                                  # checkTableConstraint
    | CLUSTERING KEY index = uid? indexColumnNames                                                                        # clusteringKeyTableConstraint
    // Tokudb-specific only
    ;

referenceDefinition
    : REFERENCES tableName indexColumnNames? (MATCH matchType = (FULL | PARTIAL | SIMPLE))? referenceAction?
    ;

referenceAction
    : ON DELETE onDelete = referenceControlType (ON UPDATE onUpdate = referenceControlType)?
    | ON UPDATE onUpdate = referenceControlType (ON DELETE onDelete = referenceControlType)?
    ;

referenceControlType
    : RESTRICT
    | CASCADE
    | SET NULL_LITERAL
    | NO ACTION
    | SET DEFAULT
    ;

indexColumnDefinition
    : indexFormat = (INDEX | KEY) uid? indexType? indexColumnNames indexOption*            # simpleIndexDeclaration
    | (FULLTEXT | SPATIAL) indexFormat = (INDEX | KEY)? uid? indexColumnNames indexOption* # specialIndexDeclaration
    ;

tableOption
    : ENGINE '='? engineName?                                       # tableOptionEngine
    | ENGINE_ATTRIBUTE '='? STRING_LITERAL                          # tableOptionEngineAttribute
    | AUTOEXTEND_SIZE '='? decimalLiteral                           # tableOptionAutoextendSize
    | AUTO_INCREMENT '='? decimalLiteral                            # tableOptionAutoIncrement
    | AVG_ROW_LENGTH '='? decimalLiteral                            # tableOptionAverage
    | DEFAULT? charSet '='? (charsetName | DEFAULT)                 # tableOptionCharset
    | (CHECKSUM | PAGE_CHECKSUM) '='? boolValue = ('0' | '1')       # tableOptionChecksum
    | DEFAULT? COLLATE '='? collationName                           # tableOptionCollate
    | COMMENT '='? STRING_LITERAL                                   # tableOptionComment
    | COMPRESSION '='? (STRING_LITERAL | ID)                        # tableOptionCompression
    | CONNECTION '='? STRING_LITERAL                                # tableOptionConnection
    | (DATA | INDEX) DIRECTORY '='? STRING_LITERAL                  # tableOptionDataDirectory
    | DELAY_KEY_WRITE '='? boolValue = ('0' | '1')                  # tableOptionDelay
    | ENCRYPTION '='? STRING_LITERAL                                # tableOptionEncryption
    | (PAGE_COMPRESSED | STRING_LITERAL) '='? ('0' | '1')           # tableOptionPageCompressed
    | (PAGE_COMPRESSION_LEVEL | STRING_LITERAL) '='? decimalLiteral # tableOptionPageCompressionLevel
    | ENCRYPTION_KEY_ID '='? decimalLiteral                         # tableOptionEncryptionKeyId
    | INDEX DIRECTORY '='? STRING_LITERAL                           # tableOptionIndexDirectory
    | INSERT_METHOD '='? insertMethod = (NO | FIRST | LAST)         # tableOptionInsertMethod
    | KEY_BLOCK_SIZE '='? fileSizeLiteral                           # tableOptionKeyBlockSize
    | MAX_ROWS '='? decimalLiteral                                  # tableOptionMaxRows
    | MIN_ROWS '='? decimalLiteral                                  # tableOptionMinRows
    | PACK_KEYS '='? extBoolValue = ('0' | '1' | DEFAULT)           # tableOptionPackKeys
    | PASSWORD '='? STRING_LITERAL                                  # tableOptionPassword
    | ROW_FORMAT '='? rowFormat = (
        DEFAULT
        | DYNAMIC
        | FIXED
        | COMPRESSED
        | REDUNDANT
        | COMPACT
        | ID
    )                                                             # tableOptionRowFormat
    | START TRANSACTION                                           # tableOptionStartTransaction
    | SECONDARY_ENGINE '='? (ID | STRING_LITERAL)                 # tableOptionSecondaryEngine
    // HeatWave-specific only
    | SECONDARY_ENGINE_ATTRIBUTE '='? STRING_LITERAL              # tableOptionSecondaryEngineAttribute
    | STATS_AUTO_RECALC '='? extBoolValue = (DEFAULT | '0' | '1') # tableOptionRecalculation
    | STATS_PERSISTENT '='? extBoolValue = (DEFAULT | '0' | '1')  # tableOptionPersistent
    | STATS_SAMPLE_PAGES '='? (DEFAULT | decimalLiteral)          # tableOptionSamplePage
    | TABLESPACE uid tablespaceStorage?                           # tableOptionTablespace
    | TABLE_TYPE '=' tableType                                    # tableOptionTableType
    | tablespaceStorage                                           # tableOptionTablespace
    | TRANSACTIONAL '='? ('0' | '1')                              # tableOptionTransactional
    | UNION '='? '(' tables ')'                                   # tableOptionUnion
    ;

tableType
    : MYSQL
    | ODBC
    ;

tablespaceStorage
    : STORAGE (DISK | MEMORY | DEFAULT)
    ;

partitionDefinitions
    : PARTITION BY partitionFunctionDefinition (PARTITIONS count = decimalLiteral)? (
        SUBPARTITION BY subpartitionFunctionDefinition (SUBPARTITIONS subCount = decimalLiteral)?
    )? ('(' partitionDefinition (',' partitionDefinition)* ')')?
    ;

partitionFunctionDefinition
    : LINEAR? HASH '(' expression ')'                                     # partitionFunctionHash
    | LINEAR? KEY (ALGORITHM '=' algType = ('1' | '2'))? '(' uidList? ')' # partitionFunctionKey // Optional uidList for MySQL only
    | RANGE ('(' expression ')' | COLUMNS '(' uidList ')')                # partitionFunctionRange
    | LIST ('(' expression ')' | COLUMNS '(' uidList ')')                 # partitionFunctionList
    ;

subpartitionFunctionDefinition
    : LINEAR? HASH '(' expression ')'                                    # subPartitionFunctionHash
    | LINEAR? KEY (ALGORITHM '=' algType = ('1' | '2'))? '(' uidList ')' # subPartitionFunctionKey
    ;

partitionDefinition
    : PARTITION uid VALUES LESS THAN '(' partitionDefinerAtom (',' partitionDefinerAtom)* ')' partitionOption* (
        '(' subpartitionDefinition (',' subpartitionDefinition)* ')'
    )? # partitionComparison
    | PARTITION uid VALUES LESS THAN partitionDefinerAtom partitionOption* (
        '(' subpartitionDefinition (',' subpartitionDefinition)* ')'
    )? # partitionComparison
    | PARTITION uid VALUES IN '(' partitionDefinerAtom (',' partitionDefinerAtom)* ')' partitionOption* (
        '(' subpartitionDefinition (',' subpartitionDefinition)* ')'
    )? # partitionListAtom
    | PARTITION uid VALUES IN '(' partitionDefinerVector (',' partitionDefinerVector)* ')' partitionOption* (
        '(' subpartitionDefinition (',' subpartitionDefinition)* ')'
    )?                                                                                               # partitionListVector
    | PARTITION uid partitionOption* ('(' subpartitionDefinition (',' subpartitionDefinition)* ')')? # partitionSimple
    ;

partitionDefinerAtom
    : constant
    | expression
    | MAXVALUE
    ;

partitionDefinerVector
    : '(' partitionDefinerAtom (',' partitionDefinerAtom)+ ')'
    ;

subpartitionDefinition
    : SUBPARTITION uid partitionOption*
    ;

partitionOption
    : DEFAULT? STORAGE? ENGINE '='? engineName             # partitionOptionEngine
    | COMMENT '='? comment = STRING_LITERAL                # partitionOptionComment
    | DATA DIRECTORY '='? dataDirectory = STRING_LITERAL   # partitionOptionDataDirectory
    | INDEX DIRECTORY '='? indexDirectory = STRING_LITERAL # partitionOptionIndexDirectory
    | MAX_ROWS '='? maxRows = decimalLiteral               # partitionOptionMaxRows
    | MIN_ROWS '='? minRows = decimalLiteral               # partitionOptionMinRows
    | TABLESPACE '='? tablespace = uid                     # partitionOptionTablespace
    | NODEGROUP '='? nodegroup = uid                       # partitionOptionNodeGroup
    ;

//    Alter statements

alterDatabase
    : ALTER dbFormat = (DATABASE | SCHEMA) uid? createDatabaseOption+      # alterSimpleDatabase
    | ALTER dbFormat = (DATABASE | SCHEMA) uid UPGRADE DATA DIRECTORY NAME # alterUpgradeName
    ;

alterEvent
    : ALTER ownerStatement? EVENT fullId (ON SCHEDULE scheduleExpression)? (
        ON COMPLETION NOT? PRESERVE
    )? (RENAME TO fullId)? enableType? (COMMENT STRING_LITERAL)? (DO routineBody)?
    ;

alterFunction
    : ALTER FUNCTION fullId routineOption*
    ;

alterInstance
    : ALTER INSTANCE ROTATE INNODB MASTER KEY
    ;

alterLogfileGroup
    : ALTER LOGFILE GROUP uid ADD UNDOFILE STRING_LITERAL (INITIAL_SIZE '='? fileSizeLiteral)? WAIT? ENGINE '='? engineName
    ;

alterProcedure
    : ALTER PROCEDURE fullId routineOption*
    ;

alterServer
    : ALTER SERVER uid OPTIONS '(' serverOption (',' serverOption)* ')'
    ;

alterTable
    : ALTER intimeAction = (ONLINE | OFFLINE)? IGNORE? TABLE tableName (
        alterSpecification (',' alterSpecification)*
    )? partitionDefinitions?
    ;

alterTablespace
    : ALTER TABLESPACE uid objectAction = (ADD | DROP) DATAFILE STRING_LITERAL (
        INITIAL_SIZE '=' fileSizeLiteral
    )? WAIT? ENGINE '='? engineName
    ;

alterView
    : ALTER (ALGORITHM '=' algType = (UNDEFINED | MERGE | TEMPTABLE))? ownerStatement? (
        SQL SECURITY secContext = (DEFINER | INVOKER)
    )? VIEW fullId ('(' uidList ')')? AS selectStatement (
        WITH checkOpt = (CASCADED | LOCAL)? CHECK OPTION
    )?
    ;

// details

alterSpecification
    : tableOption (','? tableOption)*                                                                                             # alterByTableOption
    | ADD COLUMN? uid columnDefinition (FIRST | AFTER uid)?                                                                       # alterByAddColumn
    | ADD COLUMN? '(' uid columnDefinition (',' uid columnDefinition)* ')'                                                        # alterByAddColumns
    | ADD indexFormat = (INDEX | KEY) uid? indexType? indexColumnNames indexOption*                                               # alterByAddIndex
    | ADD (CONSTRAINT name = uid?)? PRIMARY KEY index = uid? indexType? indexColumnNames indexOption*                             # alterByAddPrimaryKey
    | ADD (CONSTRAINT name = uid?)? UNIQUE indexFormat = (INDEX | KEY)? indexName = uid? indexType? indexColumnNames indexOption* # alterByAddUniqueKey
    | ADD keyType = (FULLTEXT | SPATIAL) indexFormat = (INDEX | KEY)? uid? indexColumnNames indexOption*                          # alterByAddSpecialIndex
    | ADD (CONSTRAINT name = uid?)? FOREIGN KEY indexName = uid? indexColumnNames referenceDefinition                             # alterByAddForeignKey
    | ADD (CONSTRAINT name = uid?)? CHECK (uid | stringLiteral | '(' expression ')') NOT? ENFORCED?                               # alterByAddCheckTableConstraint
    | ALTER (CONSTRAINT name = uid?)? CHECK (uid | stringLiteral | '(' expression ')') NOT? ENFORCED?                             # alterByAlterCheckTableConstraint
    | ADD (CONSTRAINT name = uid?)? CHECK '(' expression ')'                                                                      # alterByAddCheckTableConstraint
    | ALGORITHM '='? algType = (DEFAULT | INSTANT | INPLACE | COPY)                                                               # alterBySetAlgorithm
    | ALTER COLUMN? uid (SET DEFAULT defaultValue | DROP DEFAULT)                                                                 # alterByChangeDefault
    | CHANGE COLUMN? oldColumn = uid newColumn = uid columnDefinition (
        FIRST
        | AFTER afterColumn = uid
    )?                                                           # alterByChangeColumn
    | RENAME COLUMN oldColumn = uid TO newColumn = uid           # alterByRenameColumn
    | LOCK '='? lockType = (DEFAULT | NONE | SHARED | EXCLUSIVE) # alterByLock
    | MODIFY COLUMN? uid columnDefinition (FIRST | AFTER uid)?   # alterByModifyColumn
    | DROP COLUMN? uid RESTRICT?                                 # alterByDropColumn
    | DROP (CONSTRAINT | CHECK) uid                              # alterByDropConstraintCheck
    | DROP PRIMARY KEY                                           # alterByDropPrimaryKey
    | DROP indexFormat = (INDEX | KEY) uid                       # alterByDropIndex
    | RENAME indexFormat = (INDEX | KEY) uid TO uid              # alterByRenameIndex
    | ALTER COLUMN? uid (
        SET DEFAULT ( stringLiteral | '(' expression ')')
        | SET (VISIBLE | INVISIBLE)
        | DROP DEFAULT
    )                                                                           # alterByAlterColumnDefault
    | ALTER INDEX uid (VISIBLE | INVISIBLE)                                     # alterByAlterIndexVisibility
    | DROP FOREIGN KEY uid dottedId?                                            # alterByDropForeignKey
    | DISABLE KEYS                                                              # alterByDisableKeys
    | ENABLE KEYS                                                               # alterByEnableKeys
    | RENAME renameFormat = (TO | AS)? (uid | fullId)                           # alterByRename
    | ORDER BY uidList                                                          # alterByOrder
    | CONVERT TO (CHARSET | CHARACTER SET) charsetName (COLLATE collationName)? # alterByConvertCharset
    | DEFAULT? CHARACTER SET '=' charsetName (COLLATE '=' collationName)?       # alterByDefaultCharset
    | DISCARD TABLESPACE                                                        # alterByDiscardTablespace
    | IMPORT TABLESPACE                                                         # alterByImportTablespace
    | FORCE                                                                     # alterByForce
    | validationFormat = (WITHOUT | WITH) VALIDATION                            # alterByValidate
    | ADD COLUMN? '(' createDefinition (',' createDefinition)* ')'              # alterByAddDefinitions
    | alterPartitionSpecification                                               # alterPartition
    ;

alterPartitionSpecification
    : ADD PARTITION '(' partitionDefinition (',' partitionDefinition)* ')'                          # alterByAddPartition
    | DROP PARTITION uidList                                                                        # alterByDropPartition
    | DISCARD PARTITION (uidList | ALL) TABLESPACE                                                  # alterByDiscardPartition
    | IMPORT PARTITION (uidList | ALL) TABLESPACE                                                   # alterByImportPartition
    | TRUNCATE PARTITION (uidList | ALL)                                                            # alterByTruncatePartition
    | COALESCE PARTITION decimalLiteral                                                             # alterByCoalescePartition
    | REORGANIZE PARTITION uidList INTO '(' partitionDefinition (',' partitionDefinition)* ')'      # alterByReorganizePartition
    | EXCHANGE PARTITION uid WITH TABLE tableName (validationFormat = (WITH | WITHOUT) VALIDATION)? # alterByExchangePartition
    | ANALYZE PARTITION (uidList | ALL)                                                             # alterByAnalyzePartition
    | CHECK PARTITION (uidList | ALL)                                                               # alterByCheckPartition
    | OPTIMIZE PARTITION (uidList | ALL)                                                            # alterByOptimizePartition
    | REBUILD PARTITION (uidList | ALL)                                                             # alterByRebuildPartition
    | REPAIR PARTITION (uidList | ALL)                                                              # alterByRepairPartition
    | REMOVE PARTITIONING                                                                           # alterByRemovePartitioning
    | UPGRADE PARTITIONING                                                                          # alterByUpgradePartitioning
    ;

//    Drop statements

dropDatabase
    : DROP dbFormat = (DATABASE | SCHEMA) ifExists? uid
    ;

dropEvent
    : DROP EVENT ifExists? fullId
    ;

dropIndex
    : DROP INDEX intimeAction = (ONLINE | OFFLINE)? uid ON tableName (
        ALGORITHM '='? algType = (DEFAULT | INPLACE | COPY)
        | LOCK '='? lockType = (DEFAULT | NONE | SHARED | EXCLUSIVE)
    )*
    ;

dropLogfileGroup
    : DROP LOGFILE GROUP uid ENGINE '=' engineName
    ;

dropProcedure
    : DROP PROCEDURE ifExists? fullId
    ;

dropFunction
    : DROP FUNCTION ifExists? fullId
    ;

dropServer
    : DROP SERVER ifExists? uid
    ;

dropTable
    : DROP TEMPORARY? TABLE ifExists? tables dropType = (RESTRICT | CASCADE)?
    ;

dropTablespace
    : DROP TABLESPACE uid (ENGINE '='? engineName)?
    ;

dropTrigger
    : DROP TRIGGER ifExists? fullId
    ;

dropView
    : DROP VIEW ifExists? fullId (',' fullId)* dropType = (RESTRICT | CASCADE)?
    ;

dropRole
    : DROP ROLE ifExists? roleName (',' roleName)*
    ;

setRole
    : SET DEFAULT ROLE (NONE | ALL | roleName (',' roleName)*) TO (userName | uid) (
        ',' (userName | uid)
    )*
    | SET ROLE roleOption
    ;

//    Other DDL statements

renameTable
    : RENAME TABLE renameTableClause (',' renameTableClause)*
    ;

renameTableClause
    : tableName TO tableName
    ;

truncateTable
    : TRUNCATE TABLE? tableName
    ;

// Data Manipulation Language

//    Primary DML Statements

callStatement
    : CALL fullId ('(' (constants | expressions)? ')')?
    ;

deleteStatement
    : singleDeleteStatement
    | multipleDeleteStatement
    ;

doStatement
    : DO expressions
    ;

handlerStatement
    : handlerOpenStatement
    | handlerReadIndexStatement
    | handlerReadStatement
    | handlerCloseStatement
    ;

insertStatement
    : INSERT priority = (LOW_PRIORITY | DELAYED | HIGH_PRIORITY)? IGNORE? INTO? tableName (
        PARTITION '(' partitions = uidList? ')'
    )? (
        // The row alias may carry a column-alias list — VALUES (...) AS new(m, n, p) — and the SET
        // form takes the alias too (both 8.0.19+): dev.mysql.com/doc/refman/8.4/en/insert.html and
        // dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html.
        ('(' columns = fullColumnNameList? ')')? insertStatementValue (AS? uid ('(' uidList ')')?)?
        | SET setFirst = updatedElement (',' setElements += updatedElement)* (AS? uid ('(' uidList ')')?)?
    ) (
        ON DUPLICATE KEY UPDATE duplicatedFirst = updatedElement (
            ',' duplicatedElements += updatedElement
        )*
    )?
    ;

// IMPORT TABLE FROM sdi_file [, sdi_file] ... — imports tables from their .sdi metadata files
// (dev.mysql.com/doc/refman/8.4/en/import-table.html); a whole statement upstream lacked.
importTableStatement
    : IMPORT TABLE FROM STRING_LITERAL (',' STRING_LITERAL)*
    ;

loadDataStatement
    : LOAD DATA priority = (LOW_PRIORITY | CONCURRENT)? LOCAL? INFILE filename = STRING_LITERAL violation = (
        REPLACE
        | IGNORE
    )? INTO TABLE tableName (PARTITION '(' uidList ')')? (CHARACTER SET charset = charsetName)? (
        fieldsFormat = (FIELDS | COLUMNS) selectFieldsInto+
    )? (LINES selectLinesInto+)? (IGNORE decimalLiteral linesFormat = (LINES | ROWS))? (
        '(' assignmentField (',' assignmentField)* ')'
    )? (SET updatedElement (',' updatedElement)*)?
    ;

loadXmlStatement
    : LOAD XML priority = (LOW_PRIORITY | CONCURRENT)? LOCAL? INFILE filename = STRING_LITERAL violation = (
        REPLACE
        | IGNORE
    )? INTO TABLE tableName (CHARACTER SET charset = charsetName)? (
        // The tag is ONE string literal that contains the angle brackets — ROWS IDENTIFIED BY '<person>'
        // (dev.mysql.com/doc/refman/8.4/en/load-xml.html); upstream wrote '<' 'person' '>' (three
        // tokens), which no real LOAD XML statement can produce.
        ROWS IDENTIFIED BY tag = STRING_LITERAL
    )? (IGNORE decimalLiteral linesFormat = (LINES | ROWS))? (
        '(' assignmentField (',' assignmentField)* ')'
    )? (SET updatedElement (',' updatedElement)*)?
    ;

replaceStatement
    : REPLACE priority = (LOW_PRIORITY | DELAYED)? INTO? tableName (
        PARTITION '(' partitions = uidList ')'
    )? (
        ('(' columns = uidList ')')? insertStatementValue
        | SET setFirst = updatedElement (',' setElements += updatedElement)*
    )
    ;

// The 8.0.19+ query-expression surface (dev.mysql.com/doc/refman/8.4/en/set-operations.html,
// .../table.html, .../values.html, .../parenthesized-query-expressions.html): set-operation chains
// take UNION / EXCEPT / INTERSECT; TABLE and VALUES ROW(...) are query primaries (leading cores and
// operands, via explicitTable / tableValueConstructor); a parenthesized query expression may carry
// trailing ORDER BY / LIMIT (parenthesisSelect). INTERSECT-over-UNION/EXCEPT precedence is realized
// in lowering (the CST chain is flat, like upstream's UNION-only shape).
selectStatement
    : querySpecification lockClause*                        # simpleSelect
    | queryExpression orderByClause? limitClause? lockClause* # parenthesisSelect
    | (querySpecificationNointo | queryExpressionNointo | explicitTable | tableValueConstructor) unionStatement+ (
        (UNION | EXCEPT | INTERSECT) unionType = (ALL | DISTINCT)? (querySpecification | queryExpression)
    )? orderByClause? limitClause? lockClause?                                                                                               # unionSelect
    | queryExpressionNointo unionParenthesis+ ((UNION | EXCEPT | INTERSECT) unionType = (ALL | DISTINCT)? queryExpression)? orderByClause? limitClause? lockClause? #
        unionParenthesisSelect
    | querySpecificationNointo (',' lateralStatement)+ # withLateralStatement
    ;

updateStatement
    : singleUpdateStatement
    | multipleUpdateStatement
    ;

// The VALUES statement (dev.mysql.com/doc/refman/8.4/en/values.html, 8.0.19+):
// VALUES row_constructor_list [ORDER BY column_designator] [LIMIT n]. The bare constructor is split
// out as tableValueConstructor so set-operation operands stay bare — a trailing ORDER BY / LIMIT after
// an unparenthesized operand belongs to the set-operation RESULT
// (dev.mysql.com/doc/refman/8.4/en/set-operations.html), never to the operand.
valuesStatement
    : tableValueConstructor orderByClause? limitClause?
    ;

// VALUES ROW(...), ROW(...) — dev.mysql.com/doc/refman/8.4/en/values.html. ROW? keeps upstream's
// bare `VALUES (...)` form parsing (the pre-8.0.19 shape this grammar shipped with).
tableValueConstructor
    : VALUES ROW? '(' expressionsWithDefaults? ')' (',' ROW? '(' expressionsWithDefaults? ')')*
    ;

// The 8.0.19 "explicit table" query primary: TABLE tbl (dev.mysql.com/doc/refman/8.4/en/table.html).
// Bare on purpose (see tableValueConstructor's note); tableStatement adds ORDER BY / LIMIT for the
// standalone-statement form.
explicitTable
    : TABLE tableName
    ;

// details

insertStatementValue
    : selectStatement
    // INSERT ... TABLE t is a documented source form (dev.mysql.com/doc/refman/8.4/en/insert.html).
    | tableStatement
    // Each value list may be a ROW(...) row constructor (8.0.19+, same page):
    // INSERT INTO t VALUES ROW(1,2), ROW(3,4).
    | insertFormat = (VALUES | VALUE) ROW? '(' expressionsWithDefaults? ')' (
        ',' ROW? '(' expressionsWithDefaults? ')'
    )*
    ;

updatedElement
    : fullColumnName '=' (expression | DEFAULT)
    ;

assignmentField
    : uid
    | LOCAL_ID
    ;

// Locking reads (dev.mysql.com/doc/refman/8.4/en/select.html):
//   FOR {UPDATE | SHARE} [OF tbl_name [, tbl_name] ...] [NOWAIT | SKIP LOCKED] | LOCK IN SHARE MODE
// FOR SHARE / OF / NOWAIT / SKIP LOCKED are 8.0+ forms upstream never modelled; a SELECT may stack
// several FOR clauses (e.g. `FOR SHARE OF t1 FOR UPDATE OF t2`), hence lockClause* at the call sites.
lockClause
    : FOR lockMode = (UPDATE | SHARE) (OF tableName (',' tableName)*)? (NOWAIT | SKIP_ LOCKED)?
    | LOCK IN SHARE MODE
    ;

//    Detailed DML Statements

singleDeleteStatement
    : DELETE priority = LOW_PRIORITY? QUICK? IGNORE? FROM tableName (AS? uid)? (
        PARTITION '(' uidList ')'
    )? (WHERE expression)? orderByClause? (LIMIT limitClauseAtom)?
    ;

multipleDeleteStatement
    : DELETE priority = LOW_PRIORITY? QUICK? IGNORE? (
        tableName ('.' '*')? ( ',' tableName ('.' '*')?)* FROM tableSources
        | FROM tableName ('.' '*')? ( ',' tableName ('.' '*')?)* USING tableSources
    ) (WHERE expression)?
    ;

handlerOpenStatement
    : HANDLER tableName OPEN (AS? uid)?
    ;

handlerReadIndexStatement
    : HANDLER tableName READ index = uid (
        comparisonOperator '(' constants ')'
        | moveOrder = (FIRST | NEXT | PREV | LAST)
    ) (WHERE expression)? (LIMIT limitClauseAtom)?
    ;

handlerReadStatement
    : HANDLER tableName READ moveOrder = (FIRST | NEXT) (WHERE expression)? (LIMIT limitClauseAtom)?
    ;

handlerCloseStatement
    : HANDLER tableName CLOSE
    ;

singleUpdateStatement
    : UPDATE priority = LOW_PRIORITY? IGNORE? tableSources (AS? uid)? SET updatedElement (
        ',' updatedElement
    )* (WHERE expression)? orderByClause? limitClause?
    ;

multipleUpdateStatement
    : UPDATE priority = LOW_PRIORITY? IGNORE? tableSources SET updatedElement (',' updatedElement)* (
        WHERE expression
    )?
    ;

// details

orderByClause
    : ORDER BY orderByExpression (',' orderByExpression)*
    ;

orderByExpression
    : expression order = (ASC | DESC)?
    ;

tableSources
    : tableSource (',' tableSource)*
    ;

tableSource
    : tableSourceItem joinPart*         # tableSourceBase
    | '(' tableSourceItem joinPart* ')' # tableSourceNested
    | jsonTable                         # tableJson
    ;

tableSourceItem
    : tableName (PARTITION '(' uidList ')')? (AS? alias = uid)? (indexHint (',' indexHint)*)? # atomTableItem
    | sequenceFunctionName '(' DECIMAL_LITERAL ')' (AS? alias = uid)?                         # sequenceTableItem
    // The parenthesized derived-table body is subqueryBody (TABLE / VALUES / WITH-prefixed queries are
    // legal derived tables — dev.mysql.com/doc/refman/8.4/en/derived-tables.html), and the alias may
    // carry a column-alias list: `(SELECT 1, 2) AS dt (a, b)` (same page).
    | (selectStatement | '(' parenthesisSubquery = subqueryBody ')') AS? alias = uid (
        '(' uidList ')'
    )?                                                                                        # subqueryTableItem
    | '(' tableSources ')'                                                                    # tableSourcesItem
    // JSON_TABLE is a full table factor, usable as a join operand — `t JOIN JSON_TABLE(...) jt ON ...`
    // (dev.mysql.com/doc/refman/8.4/en/json-table-functions.html); upstream admitted it only as a
    // top-level tableSource alternative, never behind a JOIN.
    | jsonTable                                                                               # jsonTableItem
    ;

indexHint
    : indexHintAction = (USE | IGNORE | FORCE) keyFormat = (INDEX | KEY) (FOR indexHintType)? '(' uidList ')'
    ;

indexHintType
    : JOIN
    | ORDER BY
    | GROUP BY
    ;

joinPart
    : (INNER | CROSS)? JOIN LATERAL? tableSourceItem joinSpec*      # innerJoin
    | STRAIGHT_JOIN tableSourceItem (ON expression)*                # straightJoin
    | (LEFT | RIGHT) OUTER? JOIN LATERAL? tableSourceItem joinSpec* # outerJoin
    | NATURAL ((LEFT | RIGHT) OUTER?)? JOIN tableSourceItem         # naturalJoin
    ;

joinSpec
    : (ON expression)
    | USING '(' uidList ')'
    ;

// The query forms admissible inside subquery parentheses — scalar/IN/EXISTS/quantified operands and
// parenthesized derived tables: a full SELECT (set-op chains ride querySpecificationNointo's trailing
// unionStatement), an explicit TABLE, a VALUES table value constructor (both 8.0.19+ query primaries:
// dev.mysql.com/doc/refman/8.4/en/table.html, .../values.html — e.g. `WHERE a IN (TABLE t)`,
// `> ANY (VALUES ROW(2))`), or a WITH-prefixed query (CTEs are legal in derived tables/subqueries:
// dev.mysql.com/doc/refman/8.4/en/with.html).
subqueryBody
    : withClause? selectStatement
    | tableStatement
    | valuesStatement
    ;

//    Select Statement's Details

// Parenthesized query expressions (dev.mysql.com/doc/refman/8.4/en/parenthesized-query-expressions.html,
// 8.0.19+): the parens may wrap a whole set-operation chain, an explicit TABLE, or a VALUES table
// value constructor — each with ORDER BY / LIMIT inside the parens applying to that operand. A
// SELECT-led chain needs no explicit alternative here: it rides querySpecificationNointo's trailing
// unionStatement (hence the extra Nointo alternative under queryExpression, whose querySpecification
// has no trailing operator).
queryExpression
    : '(' querySpecification ')'
    | '(' queryExpression ')'
    | '(' querySpecificationNointo ')'
    | '(' (explicitTable | tableValueConstructor) unionStatement+ orderByClause? limitClause? ')'
    | '(' tableStatement ')'
    | '(' valuesStatement ')'
    ;

queryExpressionNointo
    : '(' querySpecificationNointo ')'
    | '(' queryExpressionNointo ')'
    | '(' (explicitTable | tableValueConstructor) unionStatement+ orderByClause? limitClause? ')'
    | '(' tableStatement ')'
    | '(' valuesStatement ')'
    ;

querySpecification
    : SELECT selectSpec* selectElements selectIntoExpression? fromClause? groupByClause? havingClause? windowClause? orderByClause? limitClause?
    | SELECT selectSpec* selectElements fromClause? groupByClause? havingClause? windowClause? orderByClause? limitClause? selectIntoExpression?
    ;

querySpecificationNointo
    : SELECT selectSpec* selectElements fromClause? groupByClause? havingClause? windowClause? orderByClause? limitClause? unionStatement?
    ;

// Both set-operator rules take all three operators (UNION / EXCEPT / INTERSECT [ALL | DISTINCT] —
// dev.mysql.com/doc/refman/8.4/en/set-operations.html), and unionStatement's operand set covers all
// four query primaries. Rule names kept from upstream (they are the lowering's navigation anchors).
unionParenthesis
    : op = (UNION | EXCEPT | INTERSECT) unionType = (ALL | DISTINCT)? queryExpressionNointo
    ;

unionStatement
    : op = (UNION | EXCEPT | INTERSECT) unionType = (ALL | DISTINCT)? (
        querySpecificationNointo
        | queryExpressionNointo
        | explicitTable
        | tableValueConstructor
    )
    ;

lateralStatement
    : LATERAL (
        querySpecificationNointo
        | queryExpressionNointo
        | ('(' (querySpecificationNointo | queryExpressionNointo) ')' (AS? uid)?)
    )
    ;

// JSON

// https://dev.mysql.com/doc/refman/8.0/en/json-table-functions.html
jsonTable
    : JSON_TABLE '(' expression ',' STRING_LITERAL COLUMNS '(' jsonColumnList ')' ')' (AS? uid)?
    ;

jsonColumnList
    : jsonColumn (',' jsonColumn)*
    ;

jsonColumn
    : fullColumnName (
        FOR ORDINALITY
        | dataType (PATH STRING_LITERAL jsonOnEmpty? jsonOnError? | EXISTS PATH STRING_LITERAL)
    )
    | NESTED PATH? STRING_LITERAL COLUMNS '(' jsonColumnList ')'
    ;

jsonOnEmpty
    : (NULL_LITERAL | ERROR | DEFAULT defaultValue) ON EMPTY
    ;

jsonOnError
    : (NULL_LITERAL | ERROR | DEFAULT defaultValue) ON ERROR
    ;

// details

selectSpec
    : (ALL | DISTINCT | DISTINCTROW)
    | HIGH_PRIORITY
    | STRAIGHT_JOIN
    | SQL_SMALL_RESULT
    | SQL_BIG_RESULT
    | SQL_BUFFER_RESULT
    | (SQL_CACHE | SQL_NO_CACHE)
    | SQL_CALC_FOUND_ROWS
    ;

selectElements
    : (star = '*' | selectElement) (',' selectElement)*
    ;

selectElement
    : fullId '.' '*'                               # selectStarElement
    | fullColumnName (AS? uid)?                    # selectColumnElement
    | functionCall (AS? uid)?                      # selectFunctionElement
    | (LOCAL_ID VAR_ASSIGN)? expression (AS? uid)? # selectExpressionElement
    ;

selectIntoExpression
    : INTO assignmentField (',' assignmentField)* # selectIntoVariables
    | INTO DUMPFILE STRING_LITERAL                # selectIntoDumpFile
    | (
        INTO OUTFILE filename = STRING_LITERAL (CHARACTER SET charset = charsetName)? (
            fieldsFormat = (FIELDS | COLUMNS) selectFieldsInto+
        )? (LINES selectLinesInto+)?
    ) # selectIntoTextFile
    ;

selectFieldsInto
    : TERMINATED BY terminationField = STRING_LITERAL
    | OPTIONALLY? ENCLOSED BY enclosion = STRING_LITERAL
    | ESCAPED BY escaping = STRING_LITERAL
    ;

selectLinesInto
    : STARTING BY starting = STRING_LITERAL
    | TERMINATED BY terminationLine = STRING_LITERAL
    ;

fromClause
    : (FROM tableSources)? (WHERE whereExpr = expression)?
    ;

groupByClause
    : GROUP BY groupByItem (',' groupByItem)* (WITH ROLLUP)?
    ;

havingClause
    : HAVING havingExpr = expression
    ;

windowClause
    : WINDOW windowName AS '(' windowSpec ')' (',' windowName AS '(' windowSpec ')')*
    ;

groupByItem
    : expression order = (ASC | DESC)?
    ;

limitClause
    : LIMIT (
        (offset = limitClauseAtom ',')? limit = limitClauseAtom
        | limit = limitClauseAtom OFFSET offset = limitClauseAtom
    )
    ;

limitClauseAtom
    : decimalLiteral
    | mysqlVariable
    | simpleId
    ;

// Transaction's Statements

startTransaction
    : START TRANSACTION (transactionMode (',' transactionMode)*)?
    ;

beginWork
    : BEGIN WORK?
    ;

commitWork
    : COMMIT WORK? (AND nochain = NO? CHAIN)? (norelease = NO? RELEASE)?
    ;

rollbackWork
    : ROLLBACK WORK? (AND nochain = NO? CHAIN)? (norelease = NO? RELEASE)?
    ;

savepointStatement
    : SAVEPOINT uid
    ;

rollbackStatement
    : ROLLBACK WORK? TO SAVEPOINT? uid
    ;

releaseStatement
    : RELEASE SAVEPOINT uid
    ;

lockTables
    : LOCK (TABLE | TABLES) lockTableElement (',' lockTableElement)*
    ;

unlockTables
    : UNLOCK TABLES
    ;

// details

setAutocommitStatement
    : SET AUTOCOMMIT '=' autocommitValue = ('0' | '1')
    ;

setTransactionStatement
    : SET transactionContext = (GLOBAL | SESSION)? TRANSACTION transactionOption (
        ',' transactionOption
    )*
    ;

transactionMode
    : WITH CONSISTENT SNAPSHOT
    | READ WRITE
    | READ ONLY
    ;

lockTableElement
    : tableName (AS? uid)? lockAction
    ;

lockAction
    : READ LOCAL?
    | LOW_PRIORITY? WRITE
    ;

transactionOption
    : ISOLATION LEVEL transactionLevel
    | READ WRITE
    | READ ONLY
    ;

transactionLevel
    : REPEATABLE READ
    | READ COMMITTED
    | READ UNCOMMITTED
    | SERIALIZABLE
    ;

// Replication's Statements

//    Base Replication

changeMaster
    : CHANGE MASTER TO masterOption (',' masterOption)* channelOption?
    ;

changeReplicationFilter
    : CHANGE REPLICATION FILTER replicationFilter (',' replicationFilter)*
    ;

purgeBinaryLogs
    : PURGE purgeFormat = (BINARY | MASTER) LOGS (
        TO fileName = STRING_LITERAL
        | BEFORE timeValue = STRING_LITERAL
    )
    ;

resetMaster
    : RESET MASTER
    ;

resetSlave
    : RESET SLAVE ALL? channelOption?
    ;

startSlave
    : START SLAVE (threadType (',' threadType)*)? (UNTIL untilOption)? connectionOption* channelOption?
    ;

stopSlave
    : STOP SLAVE (threadType (',' threadType)*)?
    ;

startGroupReplication
    : START GROUP_REPLICATION
    ;

stopGroupReplication
    : STOP GROUP_REPLICATION
    ;

// details

masterOption
    : stringMasterOption '=' STRING_LITERAL           # masterStringOption
    | decimalMasterOption '=' decimalLiteral          # masterDecimalOption
    | boolMasterOption '=' boolVal = ('0' | '1')      # masterBoolOption
    | MASTER_HEARTBEAT_PERIOD '=' REAL_LITERAL        # masterRealOption
    | IGNORE_SERVER_IDS '=' '(' (uid (',' uid)*)? ')' # masterUidListOption
    ;

stringMasterOption
    : MASTER_BIND
    | MASTER_HOST
    | MASTER_USER
    | MASTER_PASSWORD
    | MASTER_LOG_FILE
    | RELAY_LOG_FILE
    | MASTER_SSL_CA
    | MASTER_SSL_CAPATH
    | MASTER_SSL_CERT
    | MASTER_SSL_CRL
    | MASTER_SSL_CRLPATH
    | MASTER_SSL_KEY
    | MASTER_SSL_CIPHER
    | MASTER_TLS_VERSION
    ;

decimalMasterOption
    : MASTER_PORT
    | MASTER_CONNECT_RETRY
    | MASTER_RETRY_COUNT
    | MASTER_DELAY
    | MASTER_LOG_POS
    | RELAY_LOG_POS
    ;

boolMasterOption
    : MASTER_AUTO_POSITION
    | MASTER_SSL
    | MASTER_SSL_VERIFY_SERVER_CERT
    ;

channelOption
    : FOR CHANNEL STRING_LITERAL
    ;

replicationFilter
    : REPLICATE_DO_DB '=' '(' uidList ')'                         # doDbReplication
    | REPLICATE_IGNORE_DB '=' '(' uidList ')'                     # ignoreDbReplication
    | REPLICATE_DO_TABLE '=' '(' tables ')'                       # doTableReplication
    | REPLICATE_IGNORE_TABLE '=' '(' tables ')'                   # ignoreTableReplication
    | REPLICATE_WILD_DO_TABLE '=' '(' simpleStrings ')'           # wildDoTableReplication
    | REPLICATE_WILD_IGNORE_TABLE '=' '(' simpleStrings ')'       # wildIgnoreTableReplication
    | REPLICATE_REWRITE_DB '=' '(' tablePair (',' tablePair)* ')' # rewriteDbReplication
    ;

tablePair
    : '(' firstTable = tableName ',' secondTable = tableName ')'
    ;

threadType
    : IO_THREAD
    | SQL_THREAD
    ;

untilOption
    : gtids = (SQL_BEFORE_GTIDS | SQL_AFTER_GTIDS) '=' gtuidSet                # gtidsUntilOption
    | MASTER_LOG_FILE '=' STRING_LITERAL ',' MASTER_LOG_POS '=' decimalLiteral # masterLogUntilOption
    | RELAY_LOG_FILE '=' STRING_LITERAL ',' RELAY_LOG_POS '=' decimalLiteral   # relayLogUntilOption
    | SQL_AFTER_MTS_GAPS                                                       # sqlGapsUntilOption
    ;

connectionOption
    : USER '=' conOptUser = STRING_LITERAL            # userConnectionOption
    | PASSWORD '=' conOptPassword = STRING_LITERAL    # passwordConnectionOption
    | DEFAULT_AUTH '=' conOptDefAuth = STRING_LITERAL # defaultAuthConnectionOption
    | PLUGIN_DIR '=' conOptPluginDir = STRING_LITERAL # pluginDirConnectionOption
    ;

gtuidSet
    : uuidSet (',' uuidSet)*
    | STRING_LITERAL
    ;

//    XA Transactions

xaStartTransaction
    : XA xaStart = (START | BEGIN) xid xaAction = (JOIN | RESUME)?
    ;

xaEndTransaction
    : XA END xid (SUSPEND (FOR MIGRATE)?)?
    ;

xaPrepareStatement
    : XA PREPARE xid
    ;

xaCommitWork
    : XA COMMIT xid (ONE PHASE)?
    ;

xaRollbackWork
    : XA ROLLBACK xid
    ;

xaRecoverWork
    : XA RECOVER (CONVERT xid)?
    ;

// Prepared Statements

prepareStatement
    : PREPARE uid FROM (query = STRING_LITERAL | variable = LOCAL_ID)
    ;

executeStatement
    : EXECUTE uid (USING userVariables)?
    ;

deallocatePrepare
    : dropFormat = (DEALLOCATE | DROP) PREPARE uid
    ;

// Compound Statements

routineBody
    : blockStatement
    | sqlStatement
    ;

// details

blockStatement
    : (uid ':')? BEGIN (declareVariable SEMI)* (declareCondition SEMI)* (declareCursor SEMI)* (
        declareHandler SEMI
    )* procedureSqlStatement* END uid?
    ;

caseStatement
    : CASE (uid | expression)? caseAlternative+ (ELSE procedureSqlStatement+)? END CASE
    ;

ifStatement
    : IF expression THEN thenStatements += procedureSqlStatement+ elifAlternative* (
        ELSE elseStatements += procedureSqlStatement+
    )? END IF
    ;

iterateStatement
    : ITERATE uid
    ;

leaveStatement
    : LEAVE uid
    ;

loopStatement
    : (uid ':')? LOOP procedureSqlStatement+ END LOOP uid?
    ;

repeatStatement
    : (uid ':')? REPEAT procedureSqlStatement+ UNTIL expression END REPEAT uid?
    ;

returnStatement
    : RETURN expression
    ;

whileStatement
    : (uid ':')? WHILE expression DO procedureSqlStatement+ END WHILE uid?
    ;

cursorStatement
    : CLOSE uid                            # CloseCursor
    | FETCH (NEXT? FROM)? uid INTO uidList # FetchCursor
    | OPEN uid                             # OpenCursor
    ;

// details

declareVariable
    : DECLARE uidList dataType (DEFAULT expression)?
    ;

declareCondition
    : DECLARE uid CONDITION FOR (decimalLiteral | SQLSTATE VALUE? STRING_LITERAL)
    ;

declareCursor
    : DECLARE uid CURSOR FOR selectStatement
    ;

declareHandler
    : DECLARE handlerAction = (CONTINUE | EXIT | UNDO) HANDLER FOR handlerConditionValue (
        ',' handlerConditionValue
    )* routineBody
    ;

handlerConditionValue
    : decimalLiteral                 # handlerConditionCode
    | SQLSTATE VALUE? STRING_LITERAL # handlerConditionState
    | uid                            # handlerConditionName
    | SQLWARNING                     # handlerConditionWarning
    | NOT FOUND                      # handlerConditionNotfound
    | SQLEXCEPTION                   # handlerConditionException
    ;

procedureSqlStatement
    : (compoundStatement | sqlStatement) SEMI
    ;

caseAlternative
    : WHEN (constant | expression) THEN procedureSqlStatement+
    ;

elifAlternative
    : ELSEIF expression THEN procedureSqlStatement+
    ;

// Administration Statements

//    Account management statements

alterUser
    : ALTER USER userSpecification (',' userSpecification)* # alterUserMysqlV56
    | ALTER USER ifExists? userAuthOption (',' userAuthOption)* (
        REQUIRE (tlsNone = NONE | tlsOption (AND? tlsOption)*)
    )? (WITH userResourceOption+)? (userPasswordOption | userLockOption)* (
        COMMENT STRING_LITERAL
        | ATTRIBUTE STRING_LITERAL
    )?                                                              # alterUserMysqlV80
    | ALTER USER ifExists? (userName | uid) DEFAULT ROLE roleOption # alterUserMysqlV80
    ;

createUser
    : CREATE USER userAuthOption (',' userAuthOption)* # createUserMysqlV56
    | CREATE USER ifNotExists? userAuthOption (',' userAuthOption)* (DEFAULT ROLE roleOption)? (
        REQUIRE (tlsNone = NONE | tlsOption (AND? tlsOption)*)
    )? (WITH userResourceOption+)? (userPasswordOption | userLockOption)* (
        COMMENT STRING_LITERAL
        | ATTRIBUTE STRING_LITERAL
    )? # createUserMysqlV80
    ;

dropUser
    : DROP USER ifExists? userName (',' userName)*
    ;

grantStatement
    : GRANT privelegeClause (',' privelegeClause)* ON privilegeObject = (
        TABLE
        | FUNCTION
        | PROCEDURE
    )? privilegeLevel TO userAuthOption (',' userAuthOption)* (
        REQUIRE (tlsNone = NONE | tlsOption (AND? tlsOption)*)
    )? (WITH (GRANT OPTION | userResourceOption)*)? (AS userName WITH ROLE roleOption)?
    | GRANT (userName | uid) (',' (userName | uid))* TO (userName | uid) (',' (userName | uid))* (
        WITH ADMIN OPTION
    )?
    ;

roleOption
    : DEFAULT
    | NONE
    | ALL (EXCEPT userName (',' userName)*)?
    | userName (',' userName)*
    ;

grantProxy
    : GRANT PROXY ON fromFirst = userName TO toFirst = userName (',' toOther += userName)* (
        WITH GRANT OPTION
    )?
    ;

renameUser
    : RENAME USER renameUserClause (',' renameUserClause)*
    ;

revokeStatement
    : REVOKE ifExists? (privelegeClause | uid) (',' privelegeClause | uid)* ON privilegeObject = (
        TABLE
        | FUNCTION
        | PROCEDURE
    )? privilegeLevel FROM userName (',' userName)* (IGNORE UNKNOWN USER)? # detailRevoke
    | REVOKE ifExists? ALL PRIVILEGES? ',' GRANT OPTION FROM userName (',' userName)* (
        IGNORE UNKNOWN USER
    )? # shortRevoke
    | REVOKE ifExists? (userName | uid) (',' (userName | uid))* FROM (userName | uid) (
        ',' (userName | uid)
    )* (IGNORE UNKNOWN USER)? # roleRevoke
    ;

revokeProxy
    : REVOKE PROXY ON onUser = userName FROM fromFirst = userName (',' fromOther += userName)*
    ;

setPasswordStatement
    : SET PASSWORD (FOR userName)? '=' (passwordFunctionClause | STRING_LITERAL)
    ;

// details

userSpecification
    : userName userPasswordOption
    ;

userAuthOption
    : userName IDENTIFIED BY PASSWORD hashed = STRING_LITERAL # hashAuthOption
    | userName IDENTIFIED BY RANDOM PASSWORD authOptionClause # randomAuthOption
    | userName IDENTIFIED BY STRING_LITERAL authOptionClause  # stringAuthOption
    | userName IDENTIFIED WITH authenticationRule             # moduleAuthOption
    | userName                                                # simpleAuthOption
    ;

authOptionClause
    : (REPLACE STRING_LITERAL)? (RETAIN CURRENT PASSWORD)?
    ;

authenticationRule
    : authPlugin ((BY | USING | AS) (STRING_LITERAL | RANDOM PASSWORD) authOptionClause)? # module
    | authPlugin USING passwordFunctionClause                                             # passwordModuleOption
    ;

tlsOption
    : SSL
    | X509
    | CIPHER STRING_LITERAL
    | ISSUER STRING_LITERAL
    | SUBJECT STRING_LITERAL
    ;

userResourceOption
    : MAX_QUERIES_PER_HOUR decimalLiteral
    | MAX_UPDATES_PER_HOUR decimalLiteral
    | MAX_CONNECTIONS_PER_HOUR decimalLiteral
    | MAX_USER_CONNECTIONS decimalLiteral
    ;

userPasswordOption
    : PASSWORD EXPIRE (
        expireType = DEFAULT
        | expireType = NEVER
        | expireType = INTERVAL decimalLiteral DAY
    )?
    | PASSWORD HISTORY (DEFAULT | decimalLiteral)
    | PASSWORD REUSE INTERVAL (DEFAULT | decimalLiteral DAY)
    | PASSWORD REQUIRE CURRENT (OPTIONAL | DEFAULT)?
    | FAILED_LOGIN_ATTEMPTS decimalLiteral
    | PASSWORD_LOCK_TIME (decimalLiteral | UNBOUNDED)
    ;

userLockOption
    : ACCOUNT lockType = (LOCK | UNLOCK)
    ;

privelegeClause
    : privilege ('(' uidList ')')?
    ;

privilege
    : ALL PRIVILEGES?
    | ALTER ROUTINE?
    | CREATE (TEMPORARY TABLES | ROUTINE | VIEW | USER | TABLESPACE | ROLE)?
    | DELETE
    | DROP (ROLE)?
    | EVENT
    | EXECUTE
    | FILE
    | GRANT OPTION
    | INDEX
    | INSERT
    | LOCK TABLES
    | PROCESS
    | PROXY
    | REFERENCES
    | RELOAD
    | REPLICATION (CLIENT | SLAVE)
    | SELECT
    | SHOW (VIEW | DATABASES)
    | SHUTDOWN
    | SUPER
    | TRIGGER
    | UPDATE
    | USAGE
    | APPLICATION_PASSWORD_ADMIN
    | AUDIT_ABORT_EXEMPT
    | AUDIT_ADMIN
    | AUTHENTICATION_POLICY_ADMIN
    | BACKUP_ADMIN
    | BINLOG_ADMIN
    | BINLOG_ENCRYPTION_ADMIN
    | CLONE_ADMIN
    | CONNECTION_ADMIN
    | ENCRYPTION_KEY_ADMIN
    | FIREWALL_ADMIN
    | FIREWALL_EXEMPT
    | FIREWALL_USER
    | FLUSH_OPTIMIZER_COSTS
    | FLUSH_STATUS
    | FLUSH_TABLES
    | FLUSH_USER_RESOURCES
    | GROUP_REPLICATION_ADMIN
    | INNODB_REDO_LOG_ARCHIVE
    | INNODB_REDO_LOG_ENABLE
    | NDB_STORED_USER
    | PASSWORDLESS_USER_ADMIN
    | PERSIST_RO_VARIABLES_ADMIN
    | REPLICATION_APPLIER
    | REPLICATION_SLAVE_ADMIN
    | RESOURCE_GROUP_ADMIN
    | RESOURCE_GROUP_USER
    | ROLE_ADMIN
    | SENSITIVE_VARIABLES_OBSERVER
    | SERVICE_CONNECTION_ADMIN
    | SESSION_VARIABLES_ADMIN
    | SET_USER_ID
    | SKIP_QUERY_REWRITE
    | SHOW_ROUTINE
    | SYSTEM_USER
    | SYSTEM_VARIABLES_ADMIN
    | TABLE_ENCRYPTION_ADMIN
    | TELEMETRY_LOG_ADMIN
    | TP_CONNECTION_ADMIN
    | VERSION_TOKEN_ADMIN
    | XA_RECOVER_ADMIN
    // MySQL on Amazon RDS
    | LOAD FROM S3
    | SELECT INTO S3
    | INVOKE LAMBDA
    ;

privilegeLevel
    : '*'          # currentSchemaPriviLevel
    | '*' '.' '*'  # globalPrivLevel
    | uid '.' '*'  # definiteSchemaPrivLevel
    | uid '.' uid  # definiteFullTablePrivLevel
    | uid dottedId # definiteFullTablePrivLevel2
    | uid          # definiteTablePrivLevel
    ;

renameUserClause
    : fromFirst = userName TO toFirst = userName
    ;

//    Table maintenance statements

analyzeTable
    : ANALYZE actionOption = (NO_WRITE_TO_BINLOG | LOCAL)? (TABLE | TABLES) tables (
        UPDATE HISTOGRAM ON fullColumnName (',' fullColumnName)* (WITH decimalLiteral BUCKETS)?
    )? (DROP HISTOGRAM ON fullColumnName (',' fullColumnName)*)?
    ;

checkTable
    : CHECK TABLE tables checkTableOption*
    ;

checksumTable
    : CHECKSUM TABLE tables actionOption = (QUICK | EXTENDED)?
    ;

optimizeTable
    : OPTIMIZE actionOption = (NO_WRITE_TO_BINLOG | LOCAL)? (TABLE | TABLES) tables
    ;

repairTable
    : REPAIR actionOption = (NO_WRITE_TO_BINLOG | LOCAL)? TABLE tables QUICK? EXTENDED? USE_FRM?
    ;

// details

checkTableOption
    : FOR UPGRADE
    | QUICK
    | FAST
    | MEDIUM
    | EXTENDED
    | CHANGED
    ;

//    Plugin and udf statements

createUdfunction
    : CREATE AGGREGATE? FUNCTION ifNotExists? uid RETURNS returnType = (
        STRING
        | INTEGER
        | REAL
        | DECIMAL
    ) SONAME STRING_LITERAL
    ;

installPlugin
    : INSTALL PLUGIN uid SONAME STRING_LITERAL
    ;

uninstallPlugin
    : UNINSTALL PLUGIN uid
    ;

//    Set and show statements

setStatement
    : SET variableClause ('=' | ':=') (expression | ON) (
        ',' variableClause ('=' | ':=') (expression | ON)
    )*                                                                         # setVariable
    | SET charSet (charsetName | DEFAULT)                                      # setCharset
    | SET NAMES (charsetName (COLLATE collationName)? | DEFAULT)               # setNames
    | setPasswordStatement                                                     # setPassword
    | setTransactionStatement                                                  # setTransaction
    | setAutocommitStatement                                                   # setAutocommit
    | SET fullId ('=' | ':=') expression (',' fullId ('=' | ':=') expression)* # setNewValueInsideTrigger
    ;

showStatement
    : SHOW logFormat = (BINARY | MASTER) LOGS # showMasterLogs
    | SHOW logFormat = (BINLOG | RELAYLOG) EVENTS (IN filename = STRING_LITERAL)? (
        FROM fromPosition = decimalLiteral
    )? (LIMIT (offset = decimalLiteral ',')? rowCount = decimalLiteral)? # showLogEvents
    | SHOW showCommonEntity showFilter?                                  # showObjectFilter
    | SHOW FULL? columnsFormat = (COLUMNS | FIELDS) tableFormat = (FROM | IN) tableName (
        schemaFormat = (FROM | IN) uid
    )? showFilter?                                                                             # showColumns
    | SHOW CREATE schemaFormat = (DATABASE | SCHEMA) ifNotExists? uid                          # showCreateDb
    | SHOW CREATE namedEntity = (EVENT | FUNCTION | PROCEDURE | TABLE | TRIGGER | VIEW) fullId # showCreateFullIdObject
    | SHOW CREATE USER userName                                                                # showCreateUser
    | SHOW ENGINE engineName engineOption = (STATUS | MUTEX)                                   # showEngine
    | SHOW showGlobalInfoClause                                                                # showGlobalInfo
    | SHOW errorFormat = (ERRORS | WARNINGS) (
        LIMIT (offset = decimalLiteral ',')? rowCount = decimalLiteral
    )?                                                                    # showErrors
    | SHOW COUNT '(' '*' ')' errorFormat = (ERRORS | WARNINGS)            # showCountErrors
    | SHOW showSchemaEntity (schemaFormat = (FROM | IN) uid)? showFilter? # showSchemaFilter
    | SHOW routine = (FUNCTION | PROCEDURE) CODE fullId                   # showRoutine
    | SHOW GRANTS (FOR userName)?                                         # showGrants
    | SHOW indexFormat = (INDEX | INDEXES | KEYS) tableFormat = (FROM | IN) tableName (
        schemaFormat = (FROM | IN) uid
    )? (WHERE expression)?                                           # showIndexes
    | SHOW OPEN TABLES (schemaFormat = (FROM | IN) uid)? showFilter? # showOpenTables
    | SHOW PROFILE showProfileType (',' showProfileType)* (FOR QUERY queryCount = decimalLiteral)? (
        LIMIT (offset = decimalLiteral ',')? rowCount = decimalLiteral
    )                                                 # showProfile
    | SHOW SLAVE STATUS (FOR CHANNEL STRING_LITERAL)? # showSlaveStatus
    ;

// details

variableClause
    : LOCAL_ID
    | GLOBAL_ID
    | ( ('@' '@')? (GLOBAL | SESSION | LOCAL))? uid
    ;

showCommonEntity
    : CHARACTER SET
    | COLLATION
    | DATABASES
    | SCHEMAS
    | FUNCTION STATUS
    | PROCEDURE STATUS
    | (GLOBAL | SESSION)? (STATUS | VARIABLES)
    ;

showFilter
    : LIKE STRING_LITERAL
    | WHERE expression
    ;

showGlobalInfoClause
    : STORAGE? ENGINES
    | MASTER STATUS
    | PLUGINS
    | PRIVILEGES
    | FULL? PROCESSLIST
    | PROFILES
    | SLAVE HOSTS
    | AUTHORS
    | CONTRIBUTORS
    ;

showSchemaEntity
    : EVENTS
    | TABLE STATUS
    | FULL? TABLES
    | TRIGGERS
    ;

showProfileType
    : ALL
    | BLOCK IO
    | CONTEXT SWITCHES
    | CPU
    | IPC
    | MEMORY
    | PAGE FAULTS
    | SOURCE
    | SWAPS
    ;

//    Other administrative statements

binlogStatement
    : BINLOG STRING_LITERAL
    ;

cacheIndexStatement
    : CACHE INDEX tableIndexes (',' tableIndexes)* (PARTITION '(' (uidList | ALL) ')')? IN schema = uid
    ;

flushStatement
    : FLUSH flushFormat = (NO_WRITE_TO_BINLOG | LOCAL)? flushOption (',' flushOption)*
    // Specific for Azure Database for MySQL Single Server instance.
    | FLUSH FIREWALL_RULES
    ;

killStatement
    : KILL connectionFormat = (CONNECTION | QUERY)? expression
    ;

loadIndexIntoCache
    : LOAD INDEX INTO CACHE loadedTableIndexes (',' loadedTableIndexes)*
    ;

// remark reset (maser | slave) describe in replication's
//  statements section
resetStatement
    : RESET QUERY CACHE
    ;

shutdownStatement
    : SHUTDOWN
    ;

// details

tableIndexes
    : tableName (indexFormat = (INDEX | KEY)? '(' uidList ')')?
    ;

flushOption
    : (
        DES_KEY_FILE
        | HOSTS
        | ( BINARY | ENGINE | ERROR | GENERAL | RELAY | SLOW)? LOGS
        | OPTIMIZER_COSTS
        | PRIVILEGES
        | QUERY CACHE
        | STATUS
        | USER_RESOURCES
        | TABLES (WITH READ LOCK)?
    )                                            # simpleFlushOption
    | RELAY LOGS channelOption?                  # channelFlushOption
    | (TABLE | TABLES) tables? flushTableOption? # tableFlushOption
    ;

flushTableOption
    : WITH READ LOCK
    | FOR EXPORT
    ;

loadedTableIndexes
    : tableName (PARTITION '(' (partitionList = uidList | ALL) ')')? (
        indexFormat = (INDEX | KEY)? '(' indexList = uidList ')'
    )? (IGNORE LEAVES)?
    ;

// Utility Statements

simpleDescribeStatement
    : command = (EXPLAIN | DESCRIBE | DESC) tableName (column = uid | pattern = STRING_LITERAL)?
    ;

fullDescribeStatement
    : command = (EXPLAIN | DESCRIBE | DESC) (
        formatType = (EXTENDED | PARTITIONS | FORMAT) '=' formatValue = (TRADITIONAL | JSON)
    )? describeObjectClause
    ;

helpStatement
    : HELP STRING_LITERAL
    ;

useStatement
    : USE uid
    ;

signalStatement
    : SIGNAL (( SQLSTATE VALUE? stringLiteral) | ID | REVERSE_QUOTE_ID) (
        SET signalConditionInformation ( ',' signalConditionInformation)*
    )?
    ;

resignalStatement
    : RESIGNAL (( SQLSTATE VALUE? stringLiteral) | ID | REVERSE_QUOTE_ID)? (
        SET signalConditionInformation ( ',' signalConditionInformation)*
    )?
    ;

signalConditionInformation
    : (
        CLASS_ORIGIN
        | SUBCLASS_ORIGIN
        | MESSAGE_TEXT
        | MYSQL_ERRNO
        | CONSTRAINT_CATALOG
        | CONSTRAINT_SCHEMA
        | CONSTRAINT_NAME
        | CATALOG_NAME
        | SCHEMA_NAME
        | TABLE_NAME
        | COLUMN_NAME
        | CURSOR_NAME
    ) '=' (stringLiteral | DECIMAL_LITERAL | mysqlVariable | simpleId)
    ;

withStatement
    : WITH RECURSIVE? commonTableExpressions (',' commonTableExpressions)*
    ;

tableStatement
    : explicitTable orderByClause? limitClause?
    ;

diagnosticsStatement
    : GET (CURRENT | STACKED)? DIAGNOSTICS (
        (variableClause '=' ( NUMBER | ROW_COUNT) ( ',' variableClause '=' ( NUMBER | ROW_COUNT))*)
        | (
            CONDITION (decimalLiteral | variableClause) variableClause '=' diagnosticsConditionInformationName (
                ',' variableClause '=' diagnosticsConditionInformationName
            )*
        )
    )
    ;

diagnosticsConditionInformationName
    : CLASS_ORIGIN
    | SUBCLASS_ORIGIN
    | RETURNED_SQLSTATE
    | MESSAGE_TEXT
    | MYSQL_ERRNO
    | CONSTRAINT_CATALOG
    | CONSTRAINT_SCHEMA
    | CONSTRAINT_NAME
    | CATALOG_NAME
    | SCHEMA_NAME
    | TABLE_NAME
    | COLUMN_NAME
    | CURSOR_NAME
    ;

// details

describeObjectClause
    : (selectStatement | deleteStatement | insertStatement | replaceStatement | updateStatement) # describeStatements
    | FOR CONNECTION uid                                                                         # describeConnection
    ;

// Common Clauses

//    DB Objects

fullId
    : uid (DOT_ID | '.' uid)?
    ;

tableName
    : fullId
    ;

roleName
    : userName
    | uid
    ;

fullColumnName
    : uid (dottedId dottedId?)?
    | .? dottedId dottedId?
    ;

indexColumnName
    : ((uid | STRING_LITERAL) ('(' decimalLiteral ')')? | expression) sortType = (ASC | DESC)?
    ;

simpleUserName
    : STRING_LITERAL
    | ID
    | ADMIN
    | keywordsCanBeId
    ;

hostName
    : (LOCAL_ID | HOST_IP_ADDRESS | '@')
    ;

userName
    : simpleUserName
    | simpleUserName hostName
    | currentUserExpression
    ;

mysqlVariable
    : LOCAL_ID
    | GLOBAL_ID
    ;

charsetName
    : BINARY
    | charsetNameBase
    | STRING_LITERAL
    | CHARSET_REVERSE_QOUTE_STRING
    ;

collationName
    : uid
    | STRING_LITERAL
    ;

engineName
    : engineNameBase
    | ID
    | STRING_LITERAL
    ;

engineNameBase
    : ARCHIVE
    | BLACKHOLE
    | CONNECT
    | CSV
    | FEDERATED
    | INNODB
    | MEMORY
    | MRG_MYISAM
    | MYISAM
    | NDB
    | NDBCLUSTER
    | PERFORMANCE_SCHEMA
    | TOKUDB
    ;

uuidSet
    : decimalLiteral '-' decimalLiteral '-' decimalLiteral '-' decimalLiteral '-' decimalLiteral (
        ':' decimalLiteral '-' decimalLiteral
    )+
    ;

xid
    : globalTableUid = xuidStringId (',' qualifier = xuidStringId (',' idFormat = decimalLiteral)?)?
    ;

xuidStringId
    : STRING_LITERAL
    | BIT_STRING
    | HEXADECIMAL_LITERAL+
    ;

authPlugin
    : uid
    | STRING_LITERAL
    ;

uid
    : simpleId
    //| DOUBLE_QUOTE_ID
    //| REVERSE_QUOTE_ID
    | CHARSET_REVERSE_QOUTE_STRING
    | STRING_LITERAL
    ;

simpleId
    : ID
    | charsetNameBase
    | transactionLevelBase
    | engineNameBase
    | privilegesBase
    | intervalTypeBase
    | dataTypeBase
    | keywordsCanBeId
    | scalarFunctionName
    ;

dottedId
    : DOT_ID
    | '.' uid
    ;

//    Literals

decimalLiteral
    : DECIMAL_LITERAL
    | ZERO_DECIMAL
    | ONE_DECIMAL
    | TWO_DECIMAL
    | REAL_LITERAL
    ;

fileSizeLiteral
    : FILESIZE_LITERAL
    | decimalLiteral
    ;

stringLiteral
    : (STRING_CHARSET_NAME? STRING_LITERAL | START_NATIONAL_STRING_LITERAL) STRING_LITERAL+
    | (STRING_CHARSET_NAME? STRING_LITERAL | START_NATIONAL_STRING_LITERAL) (COLLATE collationName)?
    ;

booleanLiteral
    : TRUE
    | FALSE
    ;

hexadecimalLiteral
    : STRING_CHARSET_NAME? HEXADECIMAL_LITERAL
    ;

nullNotnull
    : NOT? (NULL_LITERAL | NULL_SPEC_LITERAL)
    ;

constant
    : stringLiteral
    | decimalLiteral
    | '-' decimalLiteral
    | hexadecimalLiteral
    | booleanLiteral
    | REAL_LITERAL
    // A bit-value literal takes an optional charset introducer like the hex/string forms:
    // _binary b'01001111' — dev.mysql.com/doc/refman/8.4/en/bit-value-literals.html.
    | STRING_CHARSET_NAME? BIT_STRING
    // Typed temporal literals: DATE 'str' / TIME 'str' / TIMESTAMP 'str'
    // (dev.mysql.com/doc/refman/8.4/en/date-and-time-literals.html), e.g. CAST(TIME "11:35:00" AS YEAR)
    // on dev.mysql.com/doc/refman/8.4/en/cast-functions.html. Upstream never modelled them.
    | (DATE | TIME | TIMESTAMP) stringLiteral
    | NOT? nullLiteral = (NULL_LITERAL | NULL_SPEC_LITERAL)
    // The `?` prepared-statement placeholder, MySQL's one documented parameter marker
    // (dev.mysql.com/doc/refman/8.4/en/sql-prepared-statements.html). Wired into `constant`
    // (not a separate expressionAtom alternative) so it lands anywhere a literal is legal —
    // including expressionOrDefault's VALUES (...) row constructors.
    | PLACEHOLDER
    ;

//    Data Types

dataType
    : typeName = (
        CHAR
        | CHARACTER
        | VARCHAR
        | TINYTEXT
        | TEXT
        | MEDIUMTEXT
        | LONGTEXT
        | NCHAR
        | NVARCHAR
        | LONG
    ) VARYING? lengthOneDimension? BINARY? (charSet charsetName)? (COLLATE collationName | BINARY)? # stringDataType
    | NATIONAL typeName = (CHAR | CHARACTER) VARYING lengthOneDimension? BINARY?                    # nationalVaryingStringDataType
    | NATIONAL typeName = (VARCHAR | CHARACTER | CHAR) lengthOneDimension? BINARY?                  # nationalStringDataType
    | NCHAR typeName = VARCHAR lengthOneDimension? BINARY?                                          # nationalStringDataType
    | typeName = (
        TINYINT
        | SMALLINT
        | MEDIUMINT
        | INT
        | INTEGER
        | BIGINT
        | MIDDLEINT
        | INT1
        | INT2
        | INT3
        | INT4
        | INT8
    ) lengthOneDimension? (SIGNED | UNSIGNED | ZEROFILL)*                              # dimensionDataType
    | typeName = REAL lengthTwoDimension? (SIGNED | UNSIGNED | ZEROFILL)*              # dimensionDataType
    | typeName = DOUBLE PRECISION? lengthTwoDimension? (SIGNED | UNSIGNED | ZEROFILL)* # dimensionDataType
    | typeName = (DECIMAL | DEC | FIXED | NUMERIC | FLOAT | FLOAT4 | FLOAT8) lengthTwoOptionalDimension? (
        SIGNED
        | UNSIGNED
        | ZEROFILL
    )*                                                                                                               # dimensionDataType
    | typeName = (DATE | TINYBLOB | MEDIUMBLOB | LONGBLOB | BOOL | BOOLEAN | SERIAL)                                 # simpleDataType
    | typeName = (BIT | TIME | TIMESTAMP | DATETIME | BINARY | VARBINARY | BLOB | YEAR | VECTOR) lengthOneDimension? # dimensionDataType
    | typeName = (ENUM | SET) collectionOptions BINARY? (charSet charsetName)?                                       # collectionDataType
    | typeName = (
        GEOMETRYCOLLECTION
        | GEOMCOLLECTION
        | LINESTRING
        | MULTILINESTRING
        | MULTIPOINT
        | MULTIPOLYGON
        | POINT
        | POLYGON
        | JSON
        | GEOMETRY
    ) (SRID decimalLiteral)?                                                           # spatialDataType
    | typeName = LONG VARCHAR? BINARY? (charSet charsetName)? (COLLATE collationName)? # longVarcharDataType // LONG VARCHAR is the same as LONG
    | LONG VARBINARY                                                                   # longVarbinaryDataType
    ;

collectionOptions
    : '(' collectionOption (',' collectionOption)* ')'
    ;

collectionOption
    : STRING_LITERAL
    ;

convertedDataType
    : (
        typeName = (BINARY | NCHAR | FLOAT) lengthOneDimension?
        | typeName = CHAR lengthOneDimension? (charSet charsetName)?
        // DATETIME / TIME take an optional fractional-seconds precision — CAST(x AS DATETIME(2)) —
        // dev.mysql.com/doc/refman/8.4/en/cast-functions.html#function_cast.
        | typeName = (DATETIME | TIME) lengthOneDimension?
        | typeName = (DATE | YEAR | JSON | INT | INTEGER | DOUBLE)
        | typeName = (DECIMAL | DEC) lengthTwoOptionalDimension?
        | (SIGNED | UNSIGNED) (INTEGER | INT)?
    ) ARRAY?
    ;

lengthOneDimension
    : '(' decimalLiteral ')'
    ;

lengthTwoDimension
    : '(' decimalLiteral ',' decimalLiteral ')'
    ;

lengthTwoOptionalDimension
    : '(' decimalLiteral (',' decimalLiteral)? ')'
    ;

//    Common Lists

uidList
    : uid (',' uid)*
    ;

fullColumnNameList
    : fullColumnName (',' fullColumnName)*
    ;

tables
    : tableName (',' tableName)*
    ;

indexColumnNames
    : '(' indexColumnName (',' indexColumnName)* ')'
    ;

expressions
    : expression (',' expression)*
    ;

expressionsWithDefaults
    : expressionOrDefault (',' expressionOrDefault)*
    ;

constants
    : constant (',' constant)*
    ;

simpleStrings
    : STRING_LITERAL (',' STRING_LITERAL)*
    ;

userVariables
    : LOCAL_ID (',' LOCAL_ID)*
    ;

//    Common Expressons

defaultValue
    : NULL_LITERAL
    | CAST '(' expression AS convertedDataType ')'
    | unaryOperator? constant
    | currentTimestamp (ON UPDATE currentTimestamp)?
    | '(' expression ')'
    | '(' fullId ')'
    ;

currentTimestamp
    : (
        (CURRENT_TIMESTAMP | LOCALTIME | LOCALTIMESTAMP) ('(' decimalLiteral? ')')?
        | NOW '(' decimalLiteral? ')'
    )
    ;

expressionOrDefault
    : expression
    | DEFAULT
    ;

ifExists
    : IF EXISTS
    ;

ifNotExists
    : IF NOT EXISTS
    ;

orReplace
    : OR REPLACE
    ;

//    Functions

functionCall
    : specificFunction             # specificFunctionCall
    | aggregateWindowedFunction    # aggregateFunctionCall
    | nonAggregateWindowedFunction # nonAggregateFunctionCall
    // LEFT / RIGHT are RESERVED words (dev.mysql.com/doc/refman/8.4/en/keywords.html) so they were
    // removed from scalarFunctionName / simpleId (they must not be bare identifiers or table aliases —
    // see the outerJoin fix), but they are still the LEFT()/RIGHT() string functions
    // (dev.mysql.com/doc/refman/8.4/en/string-functions.html), so admit them only in call position here.
    | (scalarFunctionName | LEFT | RIGHT) '(' functionArgs? ')' # scalarFunctionCall
    | fullId '(' functionArgs? ')'                             # udfFunctionCall
    | passwordFunctionClause                                   # passwordFunctionCall
    // The INTERVAL(N, N1, N2, ...) comparison function
    // (dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_interval). Two-plus
    // arguments by construction — that is both the function's real arity (one comparison subject,
    // >=1 boundaries) and what keeps `INTERVAL (expr) unit` (intervalExpressionAtom) unambiguous.
    | INTERVAL '(' expression (',' expression)+ ')'            # intervalFunctionCall
    ;

specificFunction
    // CURRENT_ROLE() added: a documented information function
    // (dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_current-role); the lexer
    // token existed but no parser rule admitted it.
    : (CURRENT_DATE | CURRENT_TIME | CURRENT_TIMESTAMP | CURRENT_ROLE | LOCALTIME | UTC_TIMESTAMP | SCHEMA) (
        '(' ')'
    )?                                                                       # simpleFunctionCall
    | currentUserExpression                                                  # currentUser
    | CONVERT '(' expression separator = ',' convertedDataType ')'           # dataTypeFunctionCall
    | CONVERT '(' expression USING charsetName ')'                           # dataTypeFunctionCall
    // The optional AT TIME ZONE [INTERVAL] 'tz' clause (8.0.22+) converts a TIMESTAMP argument's zone:
    // CAST(ts AT TIME ZONE '+00:00' AS DATETIME) — dev.mysql.com/doc/refman/8.4/en/cast-functions.html#function_cast.
    | CAST '(' expression (AT TIME ZONE INTERVAL? stringLiteral)? AS convertedDataType ')' # dataTypeFunctionCall
    | VALUES '(' fullColumnName ')'                                          # valuesFunctionCall
    | CASE expression caseFuncAlternative+ (ELSE elseArg = functionArg)? END # caseExpressionFunctionCall
    | CASE caseFuncAlternative+ (ELSE elseArg = functionArg)? END            # caseFunctionCall
    | CHAR '(' functionArgs (USING charsetName)? ')'                         # charFunctionCall
    | POSITION '(' (positionString = stringLiteral | positionExpression = expression) IN (
        inString = stringLiteral
        | inExpression = expression
    ) ')' # positionFunctionCall
    | (SUBSTR | SUBSTRING) '(' (sourceString = stringLiteral | sourceExpression = expression) FROM (
        fromDecimal = decimalLiteral
        | fromExpression = expression
    ) (FOR ( forDecimal = decimalLiteral | forExpression = expression))? ')' # substrFunctionCall
    | TRIM '(' positioinForm = (BOTH | LEADING | TRAILING) (
        sourceString = stringLiteral
        | sourceExpression = expression
    )? FROM (fromString = stringLiteral | fromExpression = expression) ')' # trimFunctionCall
    | TRIM '(' (sourceString = stringLiteral | sourceExpression = expression) FROM (
        fromString = stringLiteral
        | fromExpression = expression
    ) ')' # trimFunctionCall
    | WEIGHT_STRING '(' (stringLiteral | expression) (
        AS stringFormat = (CHAR | BINARY) '(' decimalLiteral ')'
    )? levelsInWeightString? ')'                                                                            # weightFunctionCall
    | EXTRACT '(' intervalType FROM (sourceString = stringLiteral | sourceExpression = expression) ')'      # extractFunctionCall
    | GET_FORMAT '(' datetimeFormat = (DATE | TIME | DATETIME) ',' stringLiteral ')'                        # getFormatFunctionCall
    | JSON_VALUE '(' expression ',' expression (RETURNING convertedDataType)? jsonOnEmpty? jsonOnError? ')' # jsonValueFunctionCall
    ;

caseFuncAlternative
    : WHEN condition = functionArg THEN consequent = functionArg
    ;

levelsInWeightString
    : LEVEL levelInWeightListElement (',' levelInWeightListElement)*   # levelWeightList
    | LEVEL firstLevel = decimalLiteral '-' lastLevel = decimalLiteral # levelWeightRange
    ;

levelInWeightListElement
    : decimalLiteral orderType = (ASC | DESC | REVERSE)?
    ;

aggregateWindowedFunction
    : (AVG | MAX | MIN | SUM) '(' aggregator = (ALL | DISTINCT)? functionArg ')' overClause?
    | COUNT '(' (
        starArg = '*'
        | aggregator = ALL? functionArg
        | aggregator = DISTINCT functionArgs
    ) ')' overClause?
    | (
        BIT_AND
        | BIT_OR
        | BIT_XOR
        | STD
        | STDDEV
        | STDDEV_POP
        | STDDEV_SAMP
        | VAR_POP
        | VAR_SAMP
        | VARIANCE
    ) '(' aggregator = ALL? functionArg ')' overClause?
    | GROUP_CONCAT '(' aggregator = DISTINCT? functionArgs (
        ORDER BY orderByExpression (',' orderByExpression)*
    )? (SEPARATOR separator = STRING_LITERAL)? ')'
    ;

nonAggregateWindowedFunction
    : (LAG | LEAD) '(' expression (',' decimalLiteral)? (',' decimalLiteral)? ')' overClause
    | (FIRST_VALUE | LAST_VALUE) '(' expression ')' overClause
    | (CUME_DIST | DENSE_RANK | PERCENT_RANK | RANK | ROW_NUMBER) '(' ')' overClause
    | NTH_VALUE '(' expression ',' decimalLiteral ')' overClause
    | NTILE '(' decimalLiteral ')' overClause
    ;

overClause
    : OVER ('(' windowSpec? ')' | windowName)
    ;

windowSpec
    : windowName? partitionClause? orderByClause? frameClause?
    ;

windowName
    : uid
    ;

frameClause
    : frameUnits frameExtent
    ;

frameUnits
    : ROWS
    | RANGE
    ;

frameExtent
    : frameRange
    | frameBetween
    ;

frameBetween
    : BETWEEN frameRange AND frameRange
    ;

frameRange
    : CURRENT ROW
    | UNBOUNDED (PRECEDING | FOLLOWING)
    | expression (PRECEDING | FOLLOWING)
    ;

partitionClause
    : PARTITION BY expression (',' expression)*
    ;

sequenceFunctionName
    : SEQUENCE_TABLE
    | PERCONA_SEQUENCE_TABLE
    ;

scalarFunctionName
    : functionNameBase
    | ASCII
    | CURDATE
    | CURRENT_DATE
    | CURRENT_TIME
    | CURRENT_TIMESTAMP
    | CURTIME
    | DATE_ADD
    | DATE_SUB
    | IF
    | INSERT
    | LOCALTIME
    | LOCALTIMESTAMP
    | MID
    | NOW
    | REPEAT
    | REPLACE
    | SUBSTR
    | SUBSTRING
    | SYSDATE
    | TRIM
    | UTC_DATE
    | UTC_TIME
    | UTC_TIMESTAMP
    ;

passwordFunctionClause
    : functionName = (PASSWORD | OLD_PASSWORD) '(' functionArg ')'
    ;

functionArgs
    : (constant | fullColumnName | functionCall | expression) (
        ',' (constant | fullColumnName | functionCall | expression)
    )*
    ;

functionArg
    : constant
    | fullColumnName
    | functionCall
    | expression
    ;

//    Expressions, predicates

// Simplified approach for expression
expression
    : notOperator = (NOT | '!') expression                   # notExpression
    | expression logicalOperator expression                  # logicalExpression
    | predicate IS NOT? testValue = (TRUE | FALSE | UNKNOWN) # isExpression
    | predicate                                              # predicateExpression
    ;

predicate
    // Subquery operands are subqueryBody (not bare selectStatement) so TABLE / VALUES / WITH-prefixed
    // queries are legal in IN / quantified-comparison position (see subqueryBody's citations).
    // There is deliberately NO separate `comparisonOperator quantifier '(' subqueryBody ')'`
    // alternative: quantified comparisons (`> ANY (SELECT ...)`) are quantifiedSubqueryAtom in
    // expressionAtom instead. ANY/SOME are also keywordsCanBeId members, so `a > ANY (SELECT ...)` was
    // once ambiguous with `a > ANY` (a bare column) followed by a parenthesized second statement — but
    // that second reading needed the batch rule to admit an adjacent statement with NO separating
    // semicolon. sqlStatements now REQUIRES a SEMI between statements (see its citation), so at
    // statement-final position the parenthesized query can only continue the current statement, and the
    // quantified comparison parses correctly whether or not a trailing `;` is present.
    : predicate NOT? IN '(' (subqueryBody | expressions) ')'                               # inPredicate
    | predicate IS nullNotnull                                                             # isNullPredicate
    | left = predicate comparisonOperator right = predicate                                # binaryComparisonPredicate
    | predicate NOT? BETWEEN predicate AND predicate                                       # betweenPredicate
    | predicate SOUNDS LIKE predicate                                                      # soundsLikePredicate
    | predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?                               # likePredicate
    | predicate NOT? regex = (REGEXP | RLIKE) predicate                                    # regexpPredicate
    | predicate MEMBER OF '(' predicate ')'                                                # jsonMemberOfPredicate
    | expressionAtom                                                                       # expressionAtomPredicate
    ;

// Add in ASTVisitor nullNotnull in constant
expressionAtom
    // The quantified-comparison subquery, `ANY (SELECT ...)` / `ALL (TABLE t)` / `SOME (...)`
    // (dev.mysql.com/doc/refman/8.4/en/any-in-some-subqueries.html, .../all-subqueries.html). FIRST
    // alternative on purpose: ANY/SOME are keywordsCanBeId members, so this must beat the
    // fullColumnName alternative for `ANY (` — a primary-alternative decision resolves an ambiguity
    // by source order (unlike predicate's left-recursion loop; see the note there).
    : quantifier = (ALL | ANY | SOME) '(' subqueryBody ')'      # quantifiedSubqueryAtom
    | constant                                                  # constantExpressionAtom
    | fullColumnName                                            # fullColumnNameExpressionAtom
    | functionCall                                              # functionCallExpressionAtom
    | expressionAtom COLLATE collationName                      # collateExpressionAtom
    | mysqlVariable                                             # mysqlVariableExpressionAtom
    | unaryOperator expressionAtom                              # unaryExpressionAtom
    | BINARY expressionAtom                                     # binaryExpressionAtom
    | LOCAL_ID VAR_ASSIGN expressionAtom                        # variableAssignExpressionAtom
    | '(' expression (',' expression)* ')'                      # nestedExpressionAtom
    | ROW '(' expression (',' expression)+ ')'                  # nestedRowExpressionAtom
    // EXISTS/scalar subqueries take subqueryBody (not bare selectStatement) so TABLE / VALUES /
    // WITH-prefixed queries are legal: `EXISTS (TABLE t)`, `SELECT (TABLE t2) FROM t1`
    // (see subqueryBody's citations).
    | EXISTS '(' subqueryBody ')'                               # existsExpressionAtom
    | '(' subqueryBody ')'                                      # subqueryExpressionAtom
    | INTERVAL expression intervalType                          # intervalExpressionAtom
    // Fulltext search: MATCH (col [, col] ...) AGAINST (expr [search_modifier])
    // (dev.mysql.com/doc/refman/8.4/en/fulltext-search.html) — legal anywhere an expression is
    // (select list, WHERE, HAVING, GROUP BY, ORDER BY). Upstream never modelled it.
    | MATCH '(' fullColumnName (',' fullColumnName)* ')' AGAINST '(' expression searchModifier? ')' # matchAgainstExpressionAtom
    | left = expressionAtom bitOperator right = expressionAtom  # bitExpressionAtom
    | left = expressionAtom multOperator right = expressionAtom # mathExpressionAtom
    | left = expressionAtom addOperator right = expressionAtom  # mathExpressionAtom
    | left = expressionAtom jsonOperator right = expressionAtom # jsonExpressionAtom
    ;

unaryOperator
    : '!'
    | '~'
    | '+'
    | '-'
    | NOT
    ;

// The fulltext search_modifier (dev.mysql.com/doc/refman/8.4/en/fulltext-search.html):
//   IN NATURAL LANGUAGE MODE [WITH QUERY EXPANSION] | IN BOOLEAN MODE | WITH QUERY EXPANSION
searchModifier
    : IN NATURAL LANGUAGE MODE (WITH QUERY EXPANSION)?
    | IN BOOLEAN MODE
    | WITH QUERY EXPANSION
    ;

comparisonOperator
    : '='
    | '>'
    | '<'
    | '<' '='
    | '>' '='
    | '<' '>'
    | '!' '='
    | '<' '=' '>'
    ;

logicalOperator
    : AND
    | '&' '&'
    | XOR
    | OR
    | '|' '|'
    ;

bitOperator
    : '<' '<'
    | '>' '>'
    | '&'
    | '^'
    | '|'
    ;

multOperator
    : '*'
    | '/'
    | '%'
    | DIV
    | MOD
    ;

addOperator
    : '+'
    | '-'
    ;

jsonOperator
    : '-' '>'
    | '-' '>' '>'
    ;

//    Simple id sets
//     (that keyword, which can be id)

charsetNameBase
    : ARMSCII8
    | ASCII
    | BIG5
    | BINARY
    | CP1250
    | CP1251
    | CP1256
    | CP1257
    | CP850
    | CP852
    | CP866
    | CP932
    | DEC8
    | EUCJPMS
    | EUCKR
    | GB18030
    | GB2312
    | GBK
    | GEOSTD8
    | GREEK
    | HEBREW
    | HP8
    | KEYBCS2
    | KOI8R
    | KOI8U
    | LATIN1
    | LATIN2
    | LATIN5
    | LATIN7
    | MACCE
    | MACROMAN
    | SJIS
    | SWE7
    | TIS620
    | UCS2
    | UJIS
    | UTF16
    | UTF16LE
    | UTF32
    | UTF8
    | UTF8MB3
    | UTF8MB4
    ;

transactionLevelBase
    : REPEATABLE
    | COMMITTED
    | UNCOMMITTED
    | SERIALIZABLE
    ;

privilegesBase
    : TABLES
    | ROUTINE
    | EXECUTE
    | FILE
    | PROCESS
    | RELOAD
    | SHUTDOWN
    | SUPER
    | PRIVILEGES
    ;

intervalTypeBase
    : QUARTER
    | MONTH
    | DAY
    | HOUR
    | MINUTE
    | WEEK
    | SECOND
    | MICROSECOND
    ;

dataTypeBase
    : DATE
    | TIME
    | TIMESTAMP
    | DATETIME
    | YEAR
    | ENUM
    | TEXT
    ;

// Non-reserved keywords usable as identifiers (dev.mysql.com/doc/refman/8.4/en/keywords.html).
// Reserved-word audit (the LEFT/RIGHT defect class, checked systematically 2026-07-11): this set —
// and functionNameBase / scalarFunctionName, which also feed simpleId — still admit a number of words
// the 8.4 manual marks RESERVED (R) as bare identifiers (e.g. GROUP, ORDER, PRIMARY, ROW(S), RECURSIVE,
// LATERAL, OF, EMPTY here; the window-function names and IF/INSERT/REPLACE/REPEAT via the function
// rules). Each was probed as a real parse+lower: unlike bare LEFT/RIGHT JOIN (which silently mis-parsed
// LEFT as a table alias and was fixed — see functionNameBase / functionCall), none of the remaining
// reserved words mis-parses a VALID query — the admission only OVER-accepts an invalid one
// (`SELECT a group FROM t` takes `group` as an alias where real MySQL would reject it), and the correct
// production always wins for legal input. Left as a deliberate, inert over-acceptance: removing them is a
// large, upstream-diverging change with no valid-query benefit that would regress the grammars-v4 corpus
// (real dumps quote reserved identifiers). Words that caused actual damage were removed at their source
// (LEFT/RIGHT above; EXCEPT / SEQUENCE below).
keywordsCanBeId
    : ACCOUNT
    | ACTION
    | ADMIN
    | AFTER
    // AGAINST / EXPANSION / ZONE are new fork tokens (fulltext search, CAST AT TIME ZONE) and are
    // non-reserved words (dev.mysql.com/doc/refman/8.4/en/keywords.html), so they stay identifiers.
    | AGAINST
    | AGGREGATE
    | ALGORITHM
    | ANY
    | APPLICATION_PASSWORD_ADMIN
    | ARRAY
    | AT
    | AUDIT_ADMIN
    | AUDIT_ABORT_EXEMPT
    | AUTHORS
    | AUTOCOMMIT
    | AUTOEXTEND_SIZE
    | AUTO_INCREMENT
    | AUTHENTICATION_POLICY_ADMIN
    | AVG
    | AVG_ROW_LENGTH
    | ATTRIBUTE
    | BACKUP_ADMIN
    | BEGIN
    | BINLOG
    | BINLOG_ADMIN
    | BINLOG_ENCRYPTION_ADMIN
    | BIT
    | BIT_AND
    | BIT_OR
    | BIT_XOR
    | BLOCK
    | BOOL
    | BOOLEAN
    | BTREE
    | BUCKETS
    | CACHE
    | CASCADED
    | CHAIN
    | CHANGED
    | CHANNEL
    | CHECKSUM
    | PAGE_CHECKSUM
    | CATALOG_NAME
    | CIPHER
    | CLASS_ORIGIN
    | CLIENT
    | CLONE_ADMIN
    | CLOSE
    | CLUSTERING
    | COALESCE
    | CODE
    | COLUMNS
    | COLUMN_FORMAT
    | COLUMN_NAME
    | COMMENT
    | COMMIT
    | COMPACT
    | COMPLETION
    | COMPRESSED
    | COMPRESSION
    | CONCURRENT
    | CONDITION
    | CONNECT
    | CONNECTION
    | CONNECTION_ADMIN
    | CONSISTENT
    | CONSTRAINT_CATALOG
    | CONSTRAINT_NAME
    | CONSTRAINT_SCHEMA
    | CONTAINS
    | CONTEXT
    | CONTRIBUTORS
    | COPY
    | COUNT
    | CPU
    | CURRENT
    | CURRENT_USER
    | CURSOR_NAME
    | DATA
    | DATAFILE
    | DEALLOCATE
    | DEFAULT
    | DEFAULT_AUTH
    | DEFINER
    | DELAY_KEY_WRITE
    | DES_KEY_FILE
    | DIAGNOSTICS
    | DIRECTORY
    | DISABLE
    | DISCARD
    | DISK
    | DO
    | DUMPFILE
    | DUPLICATE
    | DYNAMIC
    | EMPTY
    | ENABLE
    | ENCRYPTION
    | ENCRYPTION_KEY_ADMIN
    | END
    | ENDS
    | ENGINE
    | ENGINE_ATTRIBUTE
    | ENGINES
    | ENFORCED
    | ERROR
    | ERRORS
    | ESCAPE
    | EUR
    | EVEN
    | EVENT
    | EVENTS
    | EVERY
    // EXCEPT removed: it is a RESERVED word (dev.mysql.com/doc/refman/8.4/en/keywords.html) and must
    // not reach simpleId as a bare identifier/alias — as an identifier candidate it fights the
    // EXCEPT set operator (dev.mysql.com/doc/refman/8.4/en/except.html). Same class as LEFT/RIGHT.
    | EXCHANGE
    | EXCLUSIVE
    | EXPANSION
    | EXPIRE
    | EXPORT
    | EXTENDED
    | EXTENT_SIZE
    | FAILED_LOGIN_ATTEMPTS
    | FAST
    | FAULTS
    | FIELDS
    | FILE_BLOCK_SIZE
    | FILTER
    | FIREWALL_ADMIN
    | FIREWALL_EXEMPT
    | FIREWALL_USER
    | FIRST
    | FIXED
    | FLUSH
    | FLUSH_OPTIMIZER_COSTS
    | FLUSH_STATUS
    | FLUSH_TABLES
    | FLUSH_USER_RESOURCES
    | FOLLOWS
    | FOUND
    | FULL
    | FUNCTION
    | GENERAL
    | GEOMETRY
    | GLOBAL
    | GRANTS
    | GROUP
    | GROUP_CONCAT
    | GROUP_REPLICATION
    | GROUP_REPLICATION_ADMIN
    | HANDLER
    | HASH
    | HELP
    | HISTORY
    | HOST
    | HOSTS
    | IDENTIFIED
    | IGNORED
    | IGNORE_SERVER_IDS
    | IMPORT
    | INDEXES
    | INITIAL_SIZE
    | INNODB_REDO_LOG_ARCHIVE
    | INNODB_REDO_LOG_ENABLE
    | INPLACE
    | INSERT_METHOD
    | INSTALL
    | INSTANCE
    | INSTANT
    | INTERNAL
    | INVOKE
    | INVOKER
    | IO
    | IO_THREAD
    | IPC
    | ISO
    | ISOLATION
    | ISSUER
    | JIS
    | JSON
    | KEY_BLOCK_SIZE
    | LAMBDA
    | LANGUAGE
    | LAST
    | LATERAL
    | LEAVES
    | LESS
    | LEVEL
    | LIST
    | LOCAL
    | LOGFILE
    | LOGS
    | MASTER
    | MASTER_AUTO_POSITION
    | MASTER_CONNECT_RETRY
    | MASTER_DELAY
    | MASTER_HEARTBEAT_PERIOD
    | MASTER_HOST
    | MASTER_LOG_FILE
    | MASTER_LOG_POS
    | MASTER_PASSWORD
    | MASTER_PORT
    | MASTER_RETRY_COUNT
    | MASTER_SSL
    | MASTER_SSL_CA
    | MASTER_SSL_CAPATH
    | MASTER_SSL_CERT
    | MASTER_SSL_CIPHER
    | MASTER_SSL_CRL
    | MASTER_SSL_CRLPATH
    | MASTER_SSL_KEY
    | MASTER_TLS_VERSION
    | MASTER_USER
    | MAX_CONNECTIONS_PER_HOUR
    | MAX_QUERIES_PER_HOUR
    | MAX
    | MAX_ROWS
    | MAX_SIZE
    | MAX_UPDATES_PER_HOUR
    | MAX_USER_CONNECTIONS
    | MEDIUM
    | MEMBER
    | MEMORY
    | MERGE
    | MESSAGE_TEXT
    | MID
    | MIGRATE
    | MIN
    | MIN_ROWS
    | MODE
    | MODIFY
    | MUTEX
    | MYSQL
    | MYSQL_ERRNO
    | NAME
    | NAMES
    | NATIONAL
    | NCHAR
    | NDB_STORED_USER
    | NESTED
    | NEVER
    | NEXT
    | NO
    | NOCOPY
    | NODEGROUP
    | NONE
    | NOWAIT
    | NUMBER
    | ODBC
    | OFFLINE
    | OFFSET
    | OF
    | OJ
    | OLD_PASSWORD
    | ONE
    | ONLINE
    | ONLY
    | OPEN
    | OPTIMIZER_COSTS
    | OPTIONAL
    | OPTIONS
    | ORDER
    | ORDINALITY
    | OWNER
    | PACK_KEYS
    | PAGE
    | PARSER
    | PARTIAL
    | PARTITIONING
    | PARTITIONS
    | PASSWORD
    | PASSWORDLESS_USER_ADMIN
    | PASSWORD_LOCK_TIME
    | PATH
    | PERCONA_SEQUENCE_TABLE
    | PERSIST_RO_VARIABLES_ADMIN
    | PHASE
    | PLUGINS
    | PLUGIN_DIR
    | PLUGIN
    | PORT
    | PRECEDES
    | PREPARE
    | PRESERVE
    | PREV
    | PRIMARY
    | PROCESSLIST
    | PROFILE
    | PROFILES
    | PROXY
    | QUERY
    | QUICK
    | REBUILD
    | RECOVER
    | RECURSIVE
    | REDO_BUFFER_SIZE
    | REDUNDANT
    | RELAY
    | RELAYLOG
    | RELAY_LOG_FILE
    | RELAY_LOG_POS
    | REMOVE
    | REORGANIZE
    | REPAIR
    | REPLICATE_DO_DB
    | REPLICATE_DO_TABLE
    | REPLICATE_IGNORE_DB
    | REPLICATE_IGNORE_TABLE
    | REPLICATE_REWRITE_DB
    | REPLICATE_WILD_DO_TABLE
    | REPLICATE_WILD_IGNORE_TABLE
    | REPLICATION
    | REPLICATION_APPLIER
    | REPLICATION_SLAVE_ADMIN
    | RESET
    | RESOURCE_GROUP_ADMIN
    | RESOURCE_GROUP_USER
    | RESUME
    | RETURNED_SQLSTATE
    | RETURNING
    | RETURNS
    | REUSE
    | ROLE
    | ROLE_ADMIN
    | ROLLBACK
    | ROLLUP
    | ROTATE
    | ROW
    | ROWS
    | ROW_FORMAT
    | RTREE
    | S3
    | SAVEPOINT
    | SCHEDULE
    | SCHEMA_NAME
    | SECURITY
    | SECONDARY_ENGINE_ATTRIBUTE
    | SENSITIVE_VARIABLES_OBSERVER
    // SEQUENCE is NOT a MySQL keyword at all (dev.mysql.com/doc/refman/8.4/en/keywords.html has no
    // SEQUENCE entry) — the lexer token existed but was orphaned, silently reserving the word and
    // rejecting `CREATE TABLE sequence` (a documented example on
    // dev.mysql.com/doc/refman/8.4/en/information-functions.html). Same defect class as LEFT/RIGHT.
    | SEQUENCE
    | SEQUENCE_TABLE
    | SERIAL
    | SERVER
    | SESSION
    | SESSION_VARIABLES_ADMIN
    | SET_USER_ID
    | SHARE
    | SHARED
    | SHOW_ROUTINE
    | SIGNED
    | SIMPLE
    | SLAVE
    | SLOW
    | SKIP_QUERY_REWRITE
    | SNAPSHOT
    | SOCKET
    | SOME
    | SONAME
    | SOUNDS
    | SOURCE
    | SQL_AFTER_GTIDS
    | SQL_AFTER_MTS_GAPS
    | SQL_BEFORE_GTIDS
    | SQL_BUFFER_RESULT
    | SQL_CACHE
    | SQL_NO_CACHE
    | SQL_THREAD
    | STACKED
    | START
    | STARTS
    | STATS_AUTO_RECALC
    | STATS_PERSISTENT
    | STATS_SAMPLE_PAGES
    | STATUS
    | STD
    | STDDEV
    | STDDEV_POP
    | STDDEV_SAMP
    | STOP
    | STORAGE
    | STRING
    | SUBCLASS_ORIGIN
    | SUBJECT
    | SUBPARTITION
    | SUBPARTITIONS
    | SUM
    | SUSPEND
    | SWAPS
    | SWITCHES
    | SYSTEM_VARIABLES_ADMIN
    | SYSTEM_USER
    | TABLE_NAME
    | TABLESPACE
    | TABLE_ENCRYPTION_ADMIN
    | TABLE_TYPE
    | TELEMETRY_LOG_ADMIN
    | TEMPORARY
    | TEMPTABLE
    | THAN
    | TP_CONNECTION_ADMIN
    | TRADITIONAL
    | TRANSACTION
    | TRANSACTIONAL
    | TRIGGERS
    | TRUNCATE
    | UNBOUNDED
    | UNDEFINED
    | UNDOFILE
    | UNDO_BUFFER_SIZE
    | UNINSTALL
    | UNKNOWN
    | UNTIL
    | UPGRADE
    | USA
    | USER
    | USE_FRM
    | USER_RESOURCES
    | VALIDATION
    | VALUE
    | VAR_POP
    | VAR_SAMP
    | VARIABLES
    | VARIANCE
    | VERSION_TOKEN_ADMIN
    | VIEW
    | VIRTUAL
    | WAIT
    | WARNINGS
    | WITHOUT
    | WORK
    | WRAPPER
    | X509
    | XA
    | XA_RECOVER_ADMIN
    | XML
    | YES
    | ZONE
    ;

functionNameBase
    : ABS
    | ACOS
    | ADDDATE
    | ADDTIME
    | AES_DECRYPT
    | AES_ENCRYPT
    | AREA
    | ASBINARY
    | ASIN
    | ASTEXT
    | ASWKB
    | ASWKT
    | ASYMMETRIC_DECRYPT
    | ASYMMETRIC_DERIVE
    | ASYMMETRIC_ENCRYPT
    | ASYMMETRIC_SIGN
    | ASYMMETRIC_VERIFY
    | ATAN
    | ATAN2
    | BENCHMARK
    | BIN
    | BIT_COUNT
    | BIT_LENGTH
    | BUFFER
    | CEIL
    | CEILING
    | CENTROID
    | CHARACTER_LENGTH
    | CHARSET
    | CHAR_LENGTH
    | COERCIBILITY
    | COLLATION
    | COMPRESS
    | CONCAT
    | CONCAT_WS
    | CONNECTION_ID
    | CONV
    | CONVERT_TZ
    | COS
    | COT
    | COUNT
    | CRC32
    | CREATE_ASYMMETRIC_PRIV_KEY
    | CREATE_ASYMMETRIC_PUB_KEY
    | CREATE_DH_PARAMETERS
    | CREATE_DIGEST
    | CROSSES
    | CUME_DIST
    | DATABASE
    | DATE
    | DATEDIFF
    | DATE_FORMAT
    | DAY
    | DAYNAME
    | DAYOFMONTH
    | DAYOFWEEK
    | DAYOFYEAR
    | DECODE
    | DEGREES
    | DENSE_RANK
    | DES_DECRYPT
    | DES_ENCRYPT
    | DIMENSION
    | DISJOINT
    | DISTANCE
    | ELT
    | ENCODE
    | ENCRYPT
    | ENDPOINT
    | ENVELOPE
    | EQUALS
    | EXP
    | EXPORT_SET
    | EXTERIORRING
    | EXTRACTVALUE
    | FIELD
    | FIND_IN_SET
    | FIRST_VALUE
    | FLOOR
    | FORMAT
    | FOUND_ROWS
    | FROM_BASE64
    | FROM_DAYS
    | FROM_UNIXTIME
    | GEOMCOLLFROMTEXT
    | GEOMCOLLFROMWKB
    | GEOMETRYCOLLECTION
    | GEOMETRYCOLLECTIONFROMTEXT
    | GEOMETRYCOLLECTIONFROMWKB
    | GEOMETRYFROMTEXT
    | GEOMETRYFROMWKB
    | GEOMETRYN
    | GEOMETRYTYPE
    | GEOMFROMTEXT
    | GEOMFROMWKB
    | GET_FORMAT
    | GET_LOCK
    | GLENGTH
    | GREATEST
    | GTID_SUBSET
    | GTID_SUBTRACT
    | HEX
    | HOUR
    | IFNULL
    | INET6_ATON
    | INET6_NTOA
    | INET_ATON
    | INET_NTOA
    | INSTR
    | INTERIORRINGN
    | INTERSECTS
    | INVISIBLE
    | ISCLOSED
    | ISEMPTY
    | ISNULL
    | ISSIMPLE
    | IS_FREE_LOCK
    | IS_IPV4
    | IS_IPV4_COMPAT
    | IS_IPV4_MAPPED
    | IS_IPV6
    | IS_USED_LOCK
    | LAG
    | LAST_INSERT_ID
    | LAST_VALUE
    | LCASE
    | LEAD
    | LEAST
    // LEFT removed: it is a RESERVED word (dev.mysql.com/doc/refman/8.4/en/keywords.html) and must not
    // reach simpleId as a bare identifier/alias; the LEFT() function stays via functionCall's scalarFunctionCall.
    | LENGTH
    | LINEFROMTEXT
    | LINEFROMWKB
    | LINESTRING
    | LINESTRINGFROMTEXT
    | LINESTRINGFROMWKB
    | LN
    | LOAD_FILE
    | LOCATE
    | LOG
    | LOG10
    | LOG2
    | LOWER
    | LPAD
    | LTRIM
    | MAKEDATE
    | MAKETIME
    | MAKE_SET
    | MASTER_POS_WAIT
    | MBRCONTAINS
    | MBRDISJOINT
    | MBREQUAL
    | MBRINTERSECTS
    | MBROVERLAPS
    | MBRTOUCHES
    | MBRWITHIN
    | MD5
    | MICROSECOND
    | MINUTE
    | MLINEFROMTEXT
    | MLINEFROMWKB
    | MOD
    | MONTH
    | MONTHNAME
    | MPOINTFROMTEXT
    | MPOINTFROMWKB
    | MPOLYFROMTEXT
    | MPOLYFROMWKB
    | MULTILINESTRING
    | MULTILINESTRINGFROMTEXT
    | MULTILINESTRINGFROMWKB
    | MULTIPOINT
    | MULTIPOINTFROMTEXT
    | MULTIPOINTFROMWKB
    | MULTIPOLYGON
    | MULTIPOLYGONFROMTEXT
    | MULTIPOLYGONFROMWKB
    | NAME_CONST
    | NTH_VALUE
    | NTILE
    | NULLIF
    | NUMGEOMETRIES
    | NUMINTERIORRINGS
    | NUMPOINTS
    | OCT
    | OCTET_LENGTH
    | ORD
    | OVERLAPS
    | PERCENT_RANK
    | PERIOD_ADD
    | PERIOD_DIFF
    | PI
    | POINT
    | POINTFROMTEXT
    | POINTFROMWKB
    | POINTN
    | POLYFROMTEXT
    | POLYFROMWKB
    | POLYGON
    | POLYGONFROMTEXT
    | POLYGONFROMWKB
    | POSITION
    | POW
    | POWER
    | QUARTER
    | QUOTE
    | RADIANS
    | RAND
    | RANDOM
    | RANK
    | RANDOM_BYTES
    | RELEASE_LOCK
    | REVERSE
    // RIGHT removed: it is a RESERVED word (dev.mysql.com/doc/refman/8.4/en/keywords.html) and must not
    // reach simpleId as a bare identifier/alias; the RIGHT() function stays via functionCall's scalarFunctionCall.
    | ROUND
    | ROW_COUNT
    | ROW_NUMBER
    | RPAD
    | RTRIM
    | SCHEMA
    | SECOND
    | SEC_TO_TIME
    | SESSION_USER
    | SESSION_VARIABLES_ADMIN
    | SHA
    | SHA1
    | SHA2
    | SIGN
    | SIN
    | SLEEP
    | SOUNDEX
    | SQL_THREAD_WAIT_AFTER_GTIDS
    | SQRT
    | SRID
    | STARTPOINT
    | STRCMP
    | STR_TO_DATE
    | ST_AREA
    | ST_ASBINARY
    | ST_ASTEXT
    | ST_ASWKB
    | ST_ASWKT
    | ST_BUFFER
    | ST_CENTROID
    | ST_CONTAINS
    | ST_CROSSES
    | ST_DIFFERENCE
    | ST_DIMENSION
    | ST_DISJOINT
    | ST_DISTANCE
    | ST_ENDPOINT
    | ST_ENVELOPE
    | ST_EQUALS
    | ST_EXTERIORRING
    | ST_GEOMCOLLFROMTEXT
    | ST_GEOMCOLLFROMTXT
    | ST_GEOMCOLLFROMWKB
    | ST_GEOMETRYCOLLECTIONFROMTEXT
    | ST_GEOMETRYCOLLECTIONFROMWKB
    | ST_GEOMETRYFROMTEXT
    | ST_GEOMETRYFROMWKB
    | ST_GEOMETRYN
    | ST_GEOMETRYTYPE
    | ST_GEOMFROMTEXT
    | ST_GEOMFROMWKB
    | ST_INTERIORRINGN
    | ST_INTERSECTION
    | ST_INTERSECTS
    | ST_ISCLOSED
    | ST_ISEMPTY
    | ST_ISSIMPLE
    | ST_LINEFROMTEXT
    | ST_LINEFROMWKB
    | ST_LINESTRINGFROMTEXT
    | ST_LINESTRINGFROMWKB
    | ST_NUMGEOMETRIES
    | ST_NUMINTERIORRING
    | ST_NUMINTERIORRINGS
    | ST_NUMPOINTS
    | ST_OVERLAPS
    | ST_POINTFROMTEXT
    | ST_POINTFROMWKB
    | ST_POINTN
    | ST_POLYFROMTEXT
    | ST_POLYFROMWKB
    | ST_POLYGONFROMTEXT
    | ST_POLYGONFROMWKB
    | ST_SRID
    | ST_STARTPOINT
    | ST_SYMDIFFERENCE
    | ST_TOUCHES
    | ST_UNION
    | ST_WITHIN
    | ST_X
    | ST_Y
    | STRING_TO_VECTOR
    | SUBDATE
    | SUBSTRING_INDEX
    | SUBTIME
    | SYSTEM_USER
    | TAN
    | TIME
    | TIMEDIFF
    | TIMESTAMP
    | TIMESTAMPADD
    | TIMESTAMPDIFF
    | TIME_FORMAT
    | TIME_TO_SEC
    | TOUCHES
    | TO_BASE64
    | TO_DAYS
    | TO_SECONDS
    | UCASE
    | UNCOMPRESS
    | UNCOMPRESSED_LENGTH
    | UNHEX
    | UNIX_TIMESTAMP
    | UPDATEXML
    | UPPER
    | UUID
    | UUID_SHORT
    | VALIDATE_PASSWORD_STRENGTH
    | VECTOR_DIM
    | VECTOR_TO_STRING
    | VERSION
    | VISIBLE
    | WAIT_UNTIL_SQL_THREAD_AFTER_GTIDS
    | WEEK
    | WEEKDAY
    | WEEKOFYEAR
    | WEIGHT_STRING
    | WITHIN
    | YEAR
    | YEARWEEK
    | Y_FUNCTION
    | X_FUNCTION
    | JSON_ARRAY
    | JSON_OBJECT
    | JSON_QUOTE
    | JSON_CONTAINS
    | JSON_CONTAINS_PATH
    | JSON_EXTRACT
    | JSON_KEYS
    | JSON_OVERLAPS
    | JSON_SEARCH
    | JSON_VALUE
    | JSON_ARRAY_APPEND
    | JSON_ARRAY_INSERT
    | JSON_INSERT
    | JSON_MERGE
    | JSON_MERGE_PATCH
    | JSON_MERGE_PRESERVE
    | JSON_REMOVE
    | JSON_REPLACE
    | JSON_SET
    | JSON_UNQUOTE
    | JSON_DEPTH
    | JSON_LENGTH
    | JSON_TYPE
    | JSON_VALID
    | JSON_TABLE
    | JSON_SCHEMA_VALID
    | JSON_SCHEMA_VALIDATION_REPORT
    | JSON_PRETTY
    | JSON_STORAGE_FREE
    | JSON_STORAGE_SIZE
    | JSON_ARRAYAGG
    | JSON_OBJECTAGG
    | STATEMENT
    ;
