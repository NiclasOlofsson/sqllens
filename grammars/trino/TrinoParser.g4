/*
 * ANTLR4 parser grammar for Trino (split lexer + parser pair).
 *
 * This IS the first-party Trino grammar, mechanically split from the combined SqlBase.g4 in
 * trinodb/trino — kept rule-for-rule verbatim so future upstream diffs stay trivial.
 *   upstream:  https://github.com/trinodb/trino  core/trino-grammar/src/main/antlr4/io/trino/grammar/sql/SqlBase.g4
 *   release:   482   commit f04d222fbeedaf888ac3c907748209c7e716a4c2
 *   retrieved: 2026-07-02
 *   license:   Apache-2.0 (see grammars/trino/LICENSE)
 *
 * Local edits (the whole delta from upstream):
 *   - split into a standalone pair; inline punctuation literals renamed to the named tokens the
 *     lexer defines (LPAREN, COMMA, ARROW, …) — a parser grammar cannot carry implicit tokens
 *     and this repo bans anonymous T__n names. 'SKIP' -> SKIP_ (SKIP is reserved in ANTLR).
 *   - the single Java predicate isKeyword() ported to TypeScript in @members; the predicate
 *     rule's ParserRuleContext argument type qualified as antlr.ParserRuleContext (TS target).
 *   - a batch-level `root` entry rule added (upstream parses one statement at a time; our
 *     corpora and editor documents are ;-separated batches).
 */

parser grammar TrinoParser;

options {
    tokenVocab = TrinoLexer;
}

@members {
/** Java SqlKeywords.isKeyword(type) port: a Trino keyword token is exactly a token whose
 *  lexer literal is a quoted all-letters word (operators quote punctuation; IDENTIFIER &c.
 *  have no literal). Used by methodName to accept any keyword after '.' in chained calls. */
isKeyword(): boolean {
    const type = this.inputStream.LT(1)?.type;
    if (type == null) { return false; }
    const lit = this.vocabulary.getLiteralName(type);
    return lit != null && /^'[A-Z][A-Z_]*'$/.test(lit);
}
}

// Batch entry (local addition — see header): a ;-separated batch of statements.
root
    : SEMICOLON* statement (SEMICOLON+ statement)* SEMICOLON* EOF
    | SEMICOLON* EOF
    ;

singleStatement
    : statement EOF
    ;

standaloneExpression
    : expression EOF
    ;

standalonePathSpecification
    : pathSpecification EOF
    ;

standaloneType
    : type EOF
    ;

standaloneRowPattern
    : rowPattern EOF
    ;

standaloneFunctionSpecification
    : functionSpecification EOF
    ;

statement
    : rootQueryWithSession                                             #statementDefault
    | USE schema=identifier                                            #use
    | USE catalog=identifier  DOT  schema=identifier                     #use
    | CREATE CATALOG (IF NOT EXISTS)? catalog=identifier
         USING connectorName=identifier
         (COMMENT string)?
         (AUTHORIZATION principal)?
         (WITH properties)?                                            #createCatalog
    | DROP CATALOG (IF EXISTS)? catalog=identifier
         (CASCADE | RESTRICT)?                                         #dropCatalog
    | CREATE SCHEMA (IF NOT EXISTS)? qualifiedName
        (AUTHORIZATION principal)?
        (WITH properties)?                                             #createSchema
    | DROP SCHEMA (IF EXISTS)? qualifiedName (CASCADE | RESTRICT)?     #dropSchema
    | ALTER SCHEMA qualifiedName RENAME TO identifier                  #renameSchema
    | CREATE (OR REPLACE)? TABLE (IF NOT EXISTS)? qualifiedName
        columnAliases?
        (COMMENT string)?
        (WITH properties)? AS (rootQuery |  LPAREN rootQuery RPAREN )
        (WITH (NO)? DATA)?                                             #createTableAsSelect
    | CREATE (OR REPLACE)? TABLE (IF NOT EXISTS)? qualifiedName
         LPAREN  tableElement ( COMMA  tableElement)*  RPAREN 
         (COMMENT string)?
         (WITH properties)?                                            #createTable
    | DROP TABLE (IF EXISTS)? qualifiedName                            #dropTable
    | INSERT INTO qualifiedName ( AT_SIGN  branch=identifier)?
       columnAliases? rootQuery                                        #insertInto
    | DELETE FROM qualifiedName ( AT_SIGN  branch=identifier)?
         (WHERE booleanExpression)?                                    #delete
    | TRUNCATE TABLE qualifiedName                                     #truncateTable
    | COMMENT ON TABLE qualifiedName IS (string | NULL)                #commentTable
    | COMMENT ON VIEW qualifiedName IS (string | NULL)                 #commentView
    | COMMENT ON COLUMN qualifiedName IS (string | NULL)               #commentColumn
    | ALTER TABLE (IF EXISTS)? from=qualifiedName
        RENAME TO to=qualifiedName                                     #renameTable
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        ADD COLUMN (IF NOT EXISTS)? column=columnDefinition
        (FIRST | LAST | AFTER after=identifier)?                       #addColumn
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        RENAME COLUMN (IF EXISTS)? from=qualifiedName TO to=identifier #renameColumn
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        DROP COLUMN (IF EXISTS)? column=qualifiedName                  #dropColumn
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        ALTER COLUMN columnName=qualifiedName SET DEFAULT literal      #setDefaultValue
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        ALTER COLUMN columnName=qualifiedName DROP DEFAULT             #dropDefaultValue
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        ALTER COLUMN columnName=qualifiedName SET DATA TYPE type       #setColumnType
    | ALTER TABLE (IF EXISTS)? tableName=qualifiedName
        ALTER COLUMN columnName=identifier DROP NOT NULL               #dropNotNullConstraint
    | ALTER TABLE tableName=qualifiedName
        SET PROPERTIES propertyAssignments                             #setTableProperties
    | ALTER TABLE tableName=qualifiedName
        EXECUTE procedureName=identifier
        ( LPAREN  (argument ( COMMA  argument)*)?  RPAREN )?
        (WHERE where=booleanExpression)?                               #tableExecute
    | ALTER ownedEntityKind qualifiedName SET AUTHORIZATION principal  #setAuthorization
    | ANALYZE qualifiedName (WITH properties)?                         #analyze
    | CREATE (OR REPLACE)? MATERIALIZED VIEW
        (IF NOT EXISTS)? qualifiedName
        (GRACE PERIOD interval)?
        (WHEN STALE (INLINE | FAIL))?
        (COMMENT string)?
        (WITH properties)? AS rootQuery                                #createMaterializedView
    | CREATE (OR REPLACE)? VIEW qualifiedName
        (COMMENT string)?
        (SECURITY (DEFINER | INVOKER))?
        (WITH properties)? AS rootQuery                                #createView
    | REFRESH MATERIALIZED VIEW qualifiedName                          #refreshMaterializedView
    | DROP MATERIALIZED VIEW (IF EXISTS)? qualifiedName                #dropMaterializedView
    | ALTER MATERIALIZED VIEW (IF EXISTS)? from=qualifiedName
        RENAME TO to=qualifiedName                                     #renameMaterializedView
    | ALTER MATERIALIZED VIEW qualifiedName
        SET PROPERTIES propertyAssignments                             #setMaterializedViewProperties
    | DROP VIEW (IF EXISTS)? qualifiedName                             #dropView
    | ALTER VIEW from=qualifiedName RENAME TO to=qualifiedName         #renameView
    | ALTER VIEW viewName=qualifiedName REFRESH                        #refreshView
    | CALL qualifiedName  LPAREN  (argument ( COMMA  argument)*)?  RPAREN            #call
    | CREATE (OR REPLACE)? functionSpecification                       #createFunction
    | DROP FUNCTION (IF EXISTS)? functionDeclaration                   #dropFunction
    | CREATE (OR REPLACE)? BRANCH (IF NOT EXISTS)? branch=identifier
        (WITH properties)? IN TABLE qualifiedName
        (FROM from=identifier)?                                        #createBranch
    | DROP BRANCH (IF EXISTS)? identifier
        IN TABLE qualifiedName                                         #dropBranch
    | ALTER BRANCH source=identifier IN TABLE qualifiedName
        FAST FORWARD TO target=identifier                              #fastForwardBranch
    | SHOW BRANCHES (FROM | IN) TABLE qualifiedName                    #showBranches
    | CREATE ROLE name=identifier
        (WITH ADMIN grantor)?
        (IN catalog=identifier)?                                       #createRole
    | DROP ROLE (IF EXISTS)? name=identifier (IN catalog=identifier)?  #dropRole
    | GRANT
        privilegeOrRole ( COMMA  privilegeOrRole)*
        TO principal ( COMMA  principal)*
        (WITH ADMIN OPTION)?
        (GRANTED BY grantor)?
        (IN catalog=identifier)?                                       #grantRoles
    | GRANT
        ((privilegeOrRole ( COMMA  privilegeOrRole)*) | ALL PRIVILEGES)
        ON grantObject
        TO principal
        (WITH GRANT OPTION)?                                           #grantPrivileges
    | REVOKE
        (ADMIN OPTION FOR)?
        privilegeOrRole ( COMMA  privilegeOrRole)*
        FROM principal ( COMMA  principal)*
        (GRANTED BY grantor)?
        (IN catalog=identifier)?                                       #revokeRoles
    | REVOKE
        (GRANT OPTION FOR)?
        ((privilegeOrRole ( COMMA  privilegeOrRole)*) | ALL PRIVILEGES)
        ON grantObject
        FROM grantee=principal                                         #revokePrivileges
    | DENY
        (privilege ( COMMA  privilege)* | ALL PRIVILEGES)
        ON grantObject
        TO grantee=principal                                           #deny
    | SET ROLE (ALL | NONE | role=identifier)
        (IN catalog=identifier)?                                       #setRole
    | SHOW GRANTS (ON grantObject)?                                    #showGrants
    | EXPLAIN ( LPAREN  explainOption ( COMMA  explainOption)*  RPAREN )? statement  #explain
    | EXPLAIN ANALYZE VERBOSE? statement                               #explainAnalyze
    | SHOW CREATE TABLE qualifiedName                                  #showCreateTable
    | SHOW CREATE SCHEMA qualifiedName                                 #showCreateSchema
    | SHOW CREATE VIEW qualifiedName                                   #showCreateView
    | SHOW CREATE MATERIALIZED VIEW qualifiedName                      #showCreateMaterializedView
    | SHOW CREATE FUNCTION qualifiedName                               #showCreateFunction
    | SHOW TABLES ((FROM | IN) qualifiedName)?
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showTables
    | SHOW SCHEMAS ((FROM | IN) identifier)?
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showSchemas
    | SHOW CATALOGS
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showCatalogs
    | SHOW COLUMNS (FROM | IN) qualifiedName
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showColumns
    | SHOW STATS FOR qualifiedName                                     #showStats
    | SHOW STATS FOR  LPAREN  rootQuery  RPAREN                                  #showStatsForQuery
    | SHOW CURRENT? ROLES ((FROM | IN) identifier)?                    #showRoles
    | SHOW ROLE GRANTS ((FROM | IN) identifier)?                       #showRoleGrants
    | DESCRIBE qualifiedName                                           #showColumns
    | DESC qualifiedName                                               #showColumns
    | SHOW FUNCTIONS ((FROM | IN) qualifiedName)?
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showFunctions
    | SHOW SESSION
        (LIKE pattern=string (ESCAPE escape=string)?)?                 #showSession
    | SET SESSION AUTHORIZATION authorizationUser                      #setSessionAuthorization
    | RESET SESSION AUTHORIZATION                                      #resetSessionAuthorization
    | SET SESSION qualifiedName EQ expression                          #setSession
    | RESET SESSION qualifiedName                                      #resetSession
    | START TRANSACTION (transactionMode ( COMMA  transactionMode)*)?      #startTransaction
    | COMMIT WORK?                                                     #commit
    | ROLLBACK WORK?                                                   #rollback
    | PREPARE identifier FROM statement                                #prepare
    | DEALLOCATE PREPARE identifier                                    #deallocate
    | EXECUTE identifier (USING expression ( COMMA  expression)*)?         #execute
    | EXECUTE IMMEDIATE string (USING expression ( COMMA  expression)*)?   #executeImmediate
    | DESCRIBE INPUT identifier                                        #describeInput
    | DESCRIBE OUTPUT identifier                                       #describeOutput
    | DESCRIBE OUTPUT  LPAREN  rootQuery  RPAREN                                 #describeQueryOutput
    | SET PATH pathSpecification                                       #setPath
    | SET TIME ZONE (LOCAL | expression)                               #setTimeZone
    | UPDATE qualifiedName ( AT_SIGN  branch=identifier)?
        SET updateAssignment ( COMMA  updateAssignment)*
        (WHERE where=booleanExpression)?                               #update
    | MERGE INTO
        qualifiedName ( AT_SIGN  branch=identifier)? (AS? alias=identifier)?
        USING relation ON expression mergeCase+                        #merge
    ;

rootQuery
    : (WITH functionSpecification ( COMMA  functionSpecification)*)?
      query
    ;

rootQueryWithSession
    : (WITH SESSION sessionProperty ( COMMA  sessionProperty)*)?
      rootQuery
    ;

sessionProperty
    : qualifiedName EQ expression
    ;

query
    : with? queryNoWith
    ;

with
    : WITH RECURSIVE? namedQuery ( COMMA  namedQuery)*
    ;

tableElement
    : columnDefinition
    | likeClause
    ;

columnDefinition
    : qualifiedName type (DEFAULT literal)? (NOT NULL)? (COMMENT string)? (WITH properties)?
    ;

likeClause
    : LIKE qualifiedName (optionType=(INCLUDING | EXCLUDING) PROPERTIES)?
    ;

properties
    :  LPAREN  propertyAssignments  RPAREN 
    ;

propertyAssignments
    : property ( COMMA  property)*
    ;

property
    : identifier EQ propertyValue
    ;

propertyValue
    : DEFAULT       #defaultPropertyValue
    | expression    #nonDefaultPropertyValue
    ;

queryNoWith
    : queryTerm
      orderBy?
      (OFFSET offset=rowCount (ROW | ROWS)?)?
      ( (LIMIT limit=limitRowCount)
      | (FETCH (FIRST | NEXT) (fetchFirst=rowCount)? (ROW | ROWS) (ONLY | WITH TIES))
      )?
    ;

orderBy
    : ORDER BY sortItem ( COMMA  sortItem)*
    ;

limitRowCount
    : ALL
    | rowCount
    ;

rowCount
    : INTEGER_VALUE
    | QUESTION_MARK
    ;

queryTerm
    : queryPrimary                                                                                #queryTermDefault
    | left=queryTerm operator=INTERSECT setQuantifier? corresponding? right=queryTerm             #setOperation
    | left=queryTerm operator=(UNION | EXCEPT) setQuantifier? corresponding? right=queryTerm      #setOperation
    ;

queryPrimary
    : querySpecification                   #queryPrimaryDefault
    | TABLE qualifiedName                  #table
    | VALUES expression ( COMMA  expression)*  #inlineTable
    |  LPAREN  queryNoWith  RPAREN                   #subquery
    ;

corresponding
    : CORRESPONDING (BY columnAliases)?
    ;

sortItem
    : expression ordering=(ASC | DESC)? (NULLS nullOrdering=(FIRST | LAST))?
    ;

querySpecification
    : SELECT setQuantifier? selectItem ( COMMA  selectItem)*
      (FROM relation ( COMMA  relation)*)?
      (WHERE where=booleanExpression)?
      (GROUP BY groupBy)?
      (HAVING having=booleanExpression)?
      (WINDOW windowDefinition ( COMMA  windowDefinition)*)?
    ;

groupBy
    : setQuantifier? groupingElement ( COMMA  groupingElement)*
    ;

groupingElement
    : groupingSet                                            #singleGroupingSet
    | AUTO                                                   #auto
    | ROLLUP  LPAREN  (groupingSet ( COMMA  groupingSet)*)?  RPAREN        #rollup
    | CUBE  LPAREN  (groupingSet ( COMMA  groupingSet)*)?  RPAREN          #cube
    | GROUPING SETS  LPAREN  groupingSet ( COMMA  groupingSet)*  RPAREN    #multipleGroupingSets
    ;

groupingSet
    :  LPAREN  (expression ( COMMA  expression)*)?  RPAREN 
    | expression
    ;

windowDefinition
    : name=identifier AS  LPAREN  windowSpecification  RPAREN 
    ;

windowSpecification
    : (existingWindowName=identifier)?
      (PARTITION BY partition+=expression ( COMMA  partition+=expression)*)?
      orderBy?
      windowFrame?
    ;

namedQuery
    : name=identifier (columnAliases)? AS  LPAREN  query  RPAREN 
    ;

setQuantifier
    : DISTINCT
    | ALL
    ;

selectItem
    : expression (AS? identifier)?                          #selectSingle
    | primaryExpression  DOT  ASTERISK (AS columnAliases)?    #selectAll
    | ASTERISK                                              #selectAll
    ;

relation
    : left=relation
      ( CROSS JOIN right=sampledRelation
      | joinType JOIN rightRelation=relation joinCriteria
      | NATURAL joinType JOIN right=sampledRelation
      )                                                     #joinRelation
    | sampledRelation                                       #relationDefault
    ;

joinType
    : INNER?
    | LEFT OUTER?
    | RIGHT OUTER?
    | FULL OUTER?
    ;

joinCriteria
    : ON booleanExpression
    | USING  LPAREN  identifier ( COMMA  identifier)*  RPAREN 
    ;

sampledRelation
    : patternRecognition (
        TABLESAMPLE sampleType  LPAREN  percentage=expression  RPAREN 
      )?
    ;

sampleType
    : BERNOULLI
    | SYSTEM
    ;

trimsSpecification
    : LEADING
    | TRAILING
    | BOTH
    ;

listAggOverflowBehavior
    : ERROR
    | TRUNCATE string? listaggCountIndication
    ;

listaggCountIndication
    : WITH COUNT
    | WITHOUT COUNT
    ;

patternRecognition
    : aliasedRelation (
        MATCH_RECOGNIZE  LPAREN 
          (PARTITION BY partition+=expression ( COMMA  partition+=expression)*)?
          orderBy?
          (MEASURES measureDefinition ( COMMA  measureDefinition)*)?
          rowsPerMatch?
          (AFTER MATCH skipTo)?
          (INITIAL | SEEK)?
          PATTERN  LPAREN  rowPattern  RPAREN 
          (SUBSET subsetDefinition ( COMMA  subsetDefinition)*)?
          DEFINE variableDefinition ( COMMA  variableDefinition)*
         RPAREN 
        (AS? identifier columnAliases?)?
      )?
    ;

measureDefinition
    : expression AS identifier
    ;

rowsPerMatch
    : ONE ROW PER MATCH
    | ALL ROWS PER MATCH emptyMatchHandling?
    ;

emptyMatchHandling
    : SHOW EMPTY MATCHES
    | OMIT EMPTY MATCHES
    | WITH UNMATCHED ROWS
    ;

skipTo
    :  SKIP_  TO NEXT ROW
    |  SKIP_  PAST LAST ROW
    |  SKIP_  TO FIRST identifier
    |  SKIP_  TO LAST identifier
    |  SKIP_  TO identifier
    ;

subsetDefinition
    : name=identifier EQ  LPAREN  union+=identifier ( COMMA  union+=identifier)*  RPAREN 
    ;

variableDefinition
    : identifier AS expression
    ;

aliasedRelation
    : relationPrimary (AS? identifier columnAliases?)?
    ;

columnAliases
    :  LPAREN  identifier ( COMMA  identifier)*  RPAREN 
    ;

relationPrimary
    : qualifiedName queryPeriod?                                      #tableName
    |  LPAREN  query  RPAREN                                                    #subqueryRelation
    | UNNEST  LPAREN  expression ( COMMA  expression)*  RPAREN  (WITH ORDINALITY)?  #unnest
    | LATERAL  LPAREN  query  RPAREN                                            #lateral
    | TABLE  LPAREN  tableFunctionCall  RPAREN                                  #tableFunctionInvocation
    |  LPAREN  relation  RPAREN                                                 #parenthesizedRelation
    | JSON_TABLE  LPAREN 
        jsonPathInvocation
        COLUMNS  LPAREN  jsonTableColumn ( COMMA  jsonTableColumn)*  RPAREN 
        (PLAN  LPAREN  jsonTableSpecificPlan  RPAREN 
        | PLAN DEFAULT  LPAREN  jsonTableDefaultPlan  RPAREN 
        )?
        ((ERROR | EMPTY) ON ERROR)?
       RPAREN                                                              #jsonTable
    | NEAREST  LPAREN 
        FROM relation
        (WHERE where=booleanExpression)?
        MATCH match=booleanExpression  RPAREN                              #nearest
    ;

jsonTableColumn
    : identifier FOR ORDINALITY                                     #ordinalityColumn
    | identifier type
        (PATH string)?
        (emptyBehavior=jsonValueBehavior ON EMPTY)?
        (errorBehavior=jsonValueBehavior ON ERROR)?                 #valueColumn
    | identifier type FORMAT jsonRepresentation
        (PATH string)?
        (jsonQueryWrapperBehavior WRAPPER)?
        ((KEEP | OMIT) QUOTES (ON SCALAR TEXT_STRING)?)?
        (emptyBehavior=jsonQueryBehavior ON EMPTY)?
        (errorBehavior=jsonQueryBehavior ON ERROR)?                 #queryColumn
    | NESTED PATH? string (AS identifier)?
        COLUMNS  LPAREN  jsonTableColumn ( COMMA  jsonTableColumn)*  RPAREN       #nestedColumns
    ;

jsonTableSpecificPlan
    : jsonTablePathName                                         #leafPlan
    | jsonTablePathName (OUTER | INNER) planPrimary             #joinPlan
    | planPrimary UNION planPrimary (UNION planPrimary)*        #unionPlan
    | planPrimary CROSS planPrimary (CROSS planPrimary)*        #crossPlan
    ;

jsonTablePathName
    : identifier
    ;

planPrimary
    : jsonTablePathName
    |  LPAREN  jsonTableSpecificPlan  RPAREN 
    ;

jsonTableDefaultPlan
    : (OUTER | INNER) ( COMMA  (UNION | CROSS))?
    | (UNION | CROSS) ( COMMA  (OUTER | INNER))?
    ;

tableFunctionCall
    : qualifiedName  LPAREN  (tableFunctionArgument ( COMMA  tableFunctionArgument)*)?
      (COPARTITION copartitionTables ( COMMA  copartitionTables)*)?  RPAREN 
    ;

tableFunctionArgument
    : (identifier  FAT_ARROW )? (tableArgument | descriptorArgument | expression) // descriptor before expression to avoid parsing descriptor as a function call
    ;

tableArgument
    : tableArgumentRelation
        (PARTITION BY ( LPAREN  (expression ( COMMA  expression)*)?  RPAREN  | expression))?
        (PRUNE WHEN EMPTY | KEEP WHEN EMPTY)?
        (ORDER BY ( LPAREN  sortItem ( COMMA  sortItem)*  RPAREN  | sortItem))?
    ;

tableArgumentRelation
    : TABLE  LPAREN  qualifiedName  RPAREN  (AS? identifier columnAliases?)?  #tableArgumentTable
    | TABLE  LPAREN  query  RPAREN  (AS? identifier columnAliases?)?          #tableArgumentQuery
    ;

descriptorArgument
    : DESCRIPTOR  LPAREN  descriptorField ( COMMA  descriptorField)*  RPAREN 
    | CAST  LPAREN  NULL AS DESCRIPTOR  RPAREN 
    ;

descriptorField
    : identifier type?
    ;

copartitionTables
    :  LPAREN  qualifiedName  COMMA  qualifiedName ( COMMA  qualifiedName)*  RPAREN 
    ;

expression
    : booleanExpression
    ;

booleanExpression
    : valueExpression predicate[$valueExpression.ctx]?  #predicated
    | NOT booleanExpression                             #logicalNot
    | booleanExpression AND booleanExpression           #and
    | booleanExpression OR booleanExpression            #or
    ;

// workaround for https://github.com/antlr/antlr4/issues/780
predicate[antlr.ParserRuleContext|null|undefined value]
    : comparisonOperator right=valueExpression                            #comparison
    | comparisonOperator comparisonQuantifier  LPAREN  query  RPAREN                #quantifiedComparison
    | NOT? BETWEEN (ASYMMETRIC | SYMMETRIC)? lower=valueExpression AND upper=valueExpression #between
    | NOT? IN  LPAREN  expression ( COMMA  expression)*  RPAREN                         #inList
    | NOT? IN  LPAREN  query  RPAREN                                                #inSubquery
    | NOT? LIKE pattern=valueExpression (ESCAPE escape=valueExpression)?  #like
    | IS NOT? NULL                                                        #nullPredicate
    | IS NOT? truthValue=(TRUE | FALSE | UNKNOWN)                         #booleanTest
    | IS NOT? DISTINCT FROM right=valueExpression                         #distinctFrom
    | MATCH UNIQUE? matchType=(SIMPLE | PARTIAL | FULL)?  LPAREN  query  RPAREN     #match
    ;

valueExpression
    : primaryExpression                                                                 #valueExpressionDefault
    | valueExpression AT timeZoneSpecifier                                              #atTimeZone
    | valueExpression AT LOCAL                                                          #atLocal
    | operator=(MINUS | PLUS) valueExpression                                           #arithmeticUnary
    | left=valueExpression operator=(ASTERISK | SLASH | PERCENT) right=valueExpression  #arithmeticBinary
    | left=valueExpression operator=(PLUS | MINUS) right=valueExpression                #arithmeticBinary
    | left=valueExpression CONCAT right=valueExpression                                 #concatenation
    ;

primaryExpression
    : literal                                                                             #literals
    | QUESTION_MARK                                                                       #parameter
    | POSITION  LPAREN  valueExpression IN valueExpression  RPAREN                                  #position
    |  LPAREN  expression ( COMMA  expression)+  RPAREN                                                 #rowConstructor
    | ROW  LPAREN  fieldConstructor ( COMMA  fieldConstructor)*  RPAREN                                 #rowConstructor
    | name=LISTAGG  LPAREN  setQuantifier? expression ( COMMA  string)?
        (ON OVERFLOW listAggOverflowBehavior)?  RPAREN 
        (WITHIN GROUP  LPAREN  orderBy  RPAREN )
        filter? over?                                                                     #listagg
    | processingMode? qualifiedName  LPAREN  (label=identifier  DOT )? ASTERISK  RPAREN 
        filter? over?                                                                     #functionCall
    | processingMode? qualifiedName  LPAREN  (setQuantifier? argument ( COMMA  argument)*)?
        orderBy?  RPAREN  filter? (nullTreatment? over)?                                       #functionCall
    | qualifiedName  DOUBLECOLON  methodName  LPAREN  (argument ( COMMA  argument)*)?  RPAREN                    #staticMethodCall
    | primaryExpression  DOT  methodName  LPAREN  (argument ( COMMA  argument)*)?  RPAREN                 #methodCall
    | identifier over                                                                     #measure
    | identifier  ARROW  expression                                                          #lambda
    |  LPAREN  (identifier ( COMMA  identifier)*)?  RPAREN   ARROW  expression                             #lambda
    |  LPAREN  query  RPAREN                                                                        #subqueryExpression
    // This is an extension to ANSI SQL, which considers EXISTS to be a <boolean expression>
    | EXISTS  LPAREN  query  RPAREN                                                                 #exists
    | UNIQUE  LPAREN  query  RPAREN                                                                 #unique
    | CASE operand=expression simpleWhenClause+ (ELSE elseExpression=expression)? END     #simpleCase
    | CASE searchedWhenClause+ (ELSE elseExpression=expression)? END                      #searchedCase
    | CAST  LPAREN  expression AS type  RPAREN                                                      #cast
    | TRY_CAST  LPAREN  expression AS type  RPAREN                                                  #cast
    | ARRAY  LSQUARE  (expression ( COMMA  expression)*)?  RSQUARE                                        #arrayConstructor
    |  LSQUARE  (expression ( COMMA  expression)*)?  RSQUARE                                              #arrayConstructor
    | value=primaryExpression  LSQUARE  index=valueExpression  RSQUARE                                #subscript
    | identifier                                                                          #columnReference
    | base=primaryExpression  DOT  fieldName=identifier                                     #dereference
    | name=CURRENT_DATE                                                                   #currentDate
    | name=CURRENT_TIME ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                                #currentTime
    | name=CURRENT_TIMESTAMP ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                           #currentTimestamp
    | name=LOCALTIME ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                                   #localTime
    | name=LOCALTIMESTAMP ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                              #localTimestamp
    | name=CURRENT_USER                                                                   #currentUser
    | name=CURRENT_CATALOG                                                                #currentCatalog
    | name=CURRENT_SCHEMA                                                                 #currentSchema
    | name=CURRENT_PATH                                                                   #currentPath
    | TRIM  LPAREN  (trimsSpecification? trimChar=valueExpression? FROM)?
        trimSource=valueExpression  RPAREN                                                     #trim
    | TRIM  LPAREN  trimSource=valueExpression  COMMA  trimChar=valueExpression  RPAREN                 #trim
    | SUBSTRING  LPAREN  valueExpression FROM valueExpression (FOR valueExpression)?  RPAREN        #substring
    | OVERLAY  LPAREN  source=valueExpression PLACING replacement=valueExpression
        FROM start=valueExpression (FOR length=valueExpression)?  RPAREN                       #overlay
    | NORMALIZE  LPAREN  valueExpression ( COMMA  normalForm)?  RPAREN                                  #normalize
    | EXTRACT  LPAREN  identifier FROM valueExpression  RPAREN                                      #extract
    |  LPAREN  expression  RPAREN                                                                   #parenthesizedExpression
    | GROUPING  LPAREN  (qualifiedName ( COMMA  qualifiedName)*)?  RPAREN                               #groupingOperation
    | JSON_EXISTS  LPAREN  jsonPathInvocation (jsonExistsErrorBehavior ON ERROR)?  RPAREN           #jsonExists
    | JSON_VALUE  LPAREN 
        jsonPathInvocation
        (RETURNING type)?
        (emptyBehavior=jsonValueBehavior ON EMPTY)?
        (errorBehavior=jsonValueBehavior ON ERROR)?
       RPAREN                                                                                  #jsonValue
    | JSON_QUERY  LPAREN 
        jsonPathInvocation
        (RETURNING type (FORMAT jsonRepresentation)?)?
        (jsonQueryWrapperBehavior WRAPPER)?
        ((KEEP | OMIT) QUOTES (ON SCALAR TEXT_STRING)?)?
        (emptyBehavior=jsonQueryBehavior ON EMPTY)?
        (errorBehavior=jsonQueryBehavior ON ERROR)?
       RPAREN                                                                                  #jsonQuery
    | JSON_OBJECT  LPAREN 
        (
          jsonObjectMember ( COMMA  jsonObjectMember)*
          (NULL ON NULL | ABSENT ON NULL)?
          (WITH UNIQUE KEYS? | WITHOUT UNIQUE KEYS?)?
        )?
        (RETURNING type (FORMAT jsonRepresentation)?)?
       RPAREN                                                                                  #jsonObject
    | JSON_ARRAY  LPAREN 
        (
          jsonValueExpression ( COMMA  jsonValueExpression)*
          (NULL ON NULL | ABSENT ON NULL)?
        )?
        (RETURNING type (FORMAT jsonRepresentation)?)?
      RPAREN                                                                                   #jsonArray
    ;

literal
    : interval                                                                            #intervalLiteral
    | identifier string                                                                   #typeConstructor
    | DOUBLE PRECISION string                                                             #typeConstructor
    | number                                                                              #numericLiteral
    | booleanValue                                                                        #booleanLiteral
    | string                                                                              #stringLiteral
    | BINARY_LITERAL                                                                      #binaryLiteral
    | NULL                                                                                #nullLiteral
    ;

fieldConstructor
    : expression (AS? identifier)?
    ;

jsonPathInvocation
    : jsonValueExpression  COMMA  path=string
        (AS pathName=identifier)?
        (PASSING jsonArgument ( COMMA  jsonArgument)*)?
    ;

jsonValueExpression
    : expression (FORMAT jsonRepresentation)?
    ;

jsonRepresentation
    : JSON (ENCODING (UTF8 | UTF16 | UTF32))? // TODO add implementation-defined JSON representation option
    ;

jsonArgument
    : jsonValueExpression AS identifier
    ;

jsonExistsErrorBehavior
    : TRUE
    | FALSE
    | UNKNOWN
    | ERROR
    ;

jsonValueBehavior
    : ERROR
    | NULL
    | DEFAULT expression
    ;

jsonQueryWrapperBehavior
    : WITHOUT ARRAY?
    | WITH (CONDITIONAL | UNCONDITIONAL)? ARRAY?
    ;

jsonQueryBehavior
    : ERROR
    | NULL
    | EMPTY ARRAY
    | EMPTY OBJECT
    ;

jsonObjectMember
    : KEY? expression VALUE jsonValueExpression
    | expression  COLON  jsonValueExpression
    ;

processingMode
    : RUNNING
    | FINAL
    ;

nullTreatment
    : IGNORE NULLS
    | RESPECT NULLS
    ;

string
    : STRING                                #basicStringLiteral
    | UNICODE_STRING (UESCAPE STRING)?      #unicodeStringLiteral
    ;

timeZoneSpecifier
    : TIME ZONE interval  #timeZoneInterval
    | TIME ZONE string    #timeZoneString
    ;

comparisonOperator
    : EQ | NEQ | LT | LTE | GT | GTE
    ;

comparisonQuantifier
    : ALL | SOME | ANY
    ;

booleanValue
    : TRUE | FALSE
    ;

interval
    : INTERVAL sign=(PLUS | MINUS)? string intervalQualifier
    ;

normalForm
    : NFD | NFC | NFKD | NFKC
    ;

type
    : ROW  LPAREN  rowField ( COMMA  rowField)*  RPAREN                                          #rowType
    | INTERVAL intervalQualifier                                                   #intervalType
    | base=TIMESTAMP ( LPAREN  precision = typeParameter  RPAREN )? (WITHOUT TIME ZONE)?     #dateTimeType
    | base=TIMESTAMP ( LPAREN  precision = typeParameter  RPAREN )? WITH TIME ZONE           #dateTimeType
    | base=TIME ( LPAREN  precision = typeParameter  RPAREN )? (WITHOUT TIME ZONE)?          #dateTimeType
    | base=TIME ( LPAREN  precision = typeParameter  RPAREN )? WITH TIME ZONE                #dateTimeType
    | DOUBLE PRECISION                                                             #doublePrecisionType
    | ARRAY  LT  type  GT                                                            #legacyArrayType
    | MAP  LT  keyType=type  COMMA  valueType=type  GT                                   #legacyMapType
    | type ARRAY ( LSQUARE  INTEGER_VALUE  RSQUARE )?                                          #arrayType
    | identifier ( LPAREN  typeParameter ( COMMA  typeParameter)*  RPAREN )?                     #genericType
    ;

intervalQualifier
  : YEAR ( LPAREN  precision=INTEGER_VALUE  RPAREN )? TO MONTH                                              #compositeYearToMonthInterval
  | field=(YEAR | MONTH) ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                                       #simpleYearMonthInterval
  | start=(DAY | HOUR | MINUTE) ( LPAREN  leadingPrecision=INTEGER_VALUE  RPAREN )?
    TO (
      end=HOUR |
      end=MINUTE |
      end=SECOND ( LPAREN  fractionalPrecision=INTEGER_VALUE  RPAREN )?)                                    #compositeDayTimeInterval
  | field=(DAY | HOUR | MINUTE) ( LPAREN  precision=INTEGER_VALUE  RPAREN )?                                #simpleDayTimeInterval
  | SECOND ( LPAREN  leadingPrecision=INTEGER_VALUE ( COMMA  fractionalPrecision=INTEGER_VALUE)?  RPAREN )?     #secondsDayTimeInterval
  ;

rowField
    : type
    | identifier type;

typeParameter
    : INTEGER_VALUE | type
    ;

simpleWhenClause
    : WHEN partial=predicate[null] THEN result=expression
    | WHEN condition=expression THEN result=expression
    ;

searchedWhenClause
    : WHEN condition=expression THEN result=expression
    ;

filter
    : FILTER  LPAREN  WHERE booleanExpression  RPAREN 
    ;

mergeCase
    : WHEN MATCHED (AND condition=expression)? THEN
        UPDATE SET targets+=identifier EQ values+=expression
          ( COMMA  targets+=identifier EQ values+=expression)*                  #mergeUpdate
    | WHEN MATCHED (AND condition=expression)? THEN DELETE                  #mergeDelete
    | WHEN NOT MATCHED (AND condition=expression)? THEN
        INSERT ( LPAREN  targets+=identifier ( COMMA  targets+=identifier)*  RPAREN )?
        VALUES  LPAREN  values+=expression ( COMMA  values+=expression)*  RPAREN          #mergeInsert
    ;

over
    : OVER (windowName=identifier |  LPAREN  windowSpecification  RPAREN )
    ;

windowFrame
    : (MEASURES measureDefinition ( COMMA  measureDefinition)*)?
      frameExtent
      (AFTER MATCH skipTo)?
      (INITIAL | SEEK)?
      (PATTERN  LPAREN  rowPattern  RPAREN )?
      (SUBSET subsetDefinition ( COMMA  subsetDefinition)*)?
      (DEFINE variableDefinition ( COMMA  variableDefinition)*)?
    ;

frameExtent
    : frameType=RANGE start=frameBound
    | frameType=ROWS start=frameBound
    | frameType=GROUPS start=frameBound
    | frameType=RANGE BETWEEN start=frameBound AND end=frameBound
    | frameType=ROWS BETWEEN start=frameBound AND end=frameBound
    | frameType=GROUPS BETWEEN start=frameBound AND end=frameBound
    ;

frameBound
    : UNBOUNDED boundType=PRECEDING                 #unboundedFrame
    | UNBOUNDED boundType=FOLLOWING                 #unboundedFrame
    | CURRENT ROW                                   #currentRowBound
    | expression boundType=(PRECEDING | FOLLOWING)  #boundedFrame
    ;

rowPattern
    : patternPrimary patternQuantifier?                 #quantifiedPrimary
    | rowPattern rowPattern                             #patternConcatenation
    | rowPattern  VBAR  rowPattern                         #patternAlternation
    ;

patternPrimary
    : identifier                                        #patternVariable
    |  LPAREN   RPAREN                                            #emptyPattern
    | PERMUTE  LPAREN  rowPattern ( COMMA  rowPattern)*  RPAREN       #patternPermutation
    |  LPAREN  rowPattern  RPAREN                                 #groupedPattern
    |  CARET                                                #partitionStartAnchor
    |  DOLLAR                                                #partitionEndAnchor
    |  LCURLY_HYPHEN  rowPattern  HYPHEN_RCURLY                               #excludedPattern
    ;

patternQuantifier
    : ASTERISK (reluctant=QUESTION_MARK)?                                                       #zeroOrMoreQuantifier
    | PLUS (reluctant=QUESTION_MARK)?                                                           #oneOrMoreQuantifier
    | QUESTION_MARK (reluctant=QUESTION_MARK)?                                                  #zeroOrOneQuantifier
    |  LCURLY  exactly=INTEGER_VALUE  RCURLY  (reluctant=QUESTION_MARK)?                                  #rangeQuantifier
    |  LCURLY  (atLeast=INTEGER_VALUE)?  COMMA  (atMost=INTEGER_VALUE)?  RCURLY  (reluctant=QUESTION_MARK)?   #rangeQuantifier
    ;

updateAssignment
    : identifier EQ expression
    ;

explainOption
    : FORMAT value=(TEXT | GRAPHVIZ | JSON)                 #explainFormat
    | TYPE value=(LOGICAL | DISTRIBUTED | VALIDATE | IO)    #explainType
    ;

transactionMode
    : ISOLATION LEVEL levelOfIsolation    #isolationLevel
    | READ accessMode=(ONLY | WRITE)      #transactionAccessMode
    ;

levelOfIsolation
    : READ UNCOMMITTED                    #readUncommitted
    | READ COMMITTED                      #readCommitted
    | REPEATABLE READ                     #repeatableRead
    | SERIALIZABLE                        #serializable
    ;

argument
    : expression                    #positionalArgument
    | identifier  FAT_ARROW  expression    #namedArgument
    ;

pathElement
    : identifier  DOT  identifier     #qualifiedArgument
    | identifier                    #unqualifiedArgument
    ;

pathSpecification
    : pathElement ( COMMA  pathElement)*
    ;

functionSpecification
    : FUNCTION functionDeclaration returnsClause routineCharacteristic*
        (controlStatement | AS functionDefinition)
    ;

functionDefinition
    : DOLLAR_STRING
    ;

functionDeclaration
    : qualifiedName  LPAREN  (parameterDeclaration ( COMMA  parameterDeclaration)*)?  RPAREN 
    ;

parameterDeclaration
    : identifier? type
    ;

returnsClause
    : RETURNS type
    ;

routineCharacteristic
    : LANGUAGE identifier               #languageCharacteristic
    | NOT? DETERMINISTIC                #deterministicCharacteristic
    | RETURNS NULL ON NULL INPUT        #returnsNullOnNullInputCharacteristic
    | CALLED ON NULL INPUT              #calledOnNullInputCharacteristic
    | SECURITY (DEFINER | INVOKER)      #securityCharacteristic
    | COMMENT string                    #commentCharacteristic
    | (WITH properties)                 #propertiesCharacteristic
    ;

controlStatement
    : RETURN valueExpression                                                        #returnStatement
    | SET identifier EQ expression                                                  #assignmentStatement
    | CASE expression caseStatementWhenClause+ elseClause? END CASE                 #simpleCaseStatement
    | CASE caseStatementWhenClause+ elseClause? END CASE                            #searchedCaseStatement
    | IF expression THEN sqlStatementList elseIfClause* elseClause? END IF          #ifStatement
    | ITERATE identifier                                                            #iterateStatement
    | LEAVE identifier                                                              #leaveStatement
    | BEGIN (variableDeclaration SEMICOLON)* sqlStatementList? END                  #compoundStatement
    | (label=identifier  COLON )? LOOP sqlStatementList END LOOP                        #loopStatement
    | (label=identifier  COLON )? WHILE expression DO sqlStatementList END WHILE        #whileStatement
    | (label=identifier  COLON )? REPEAT sqlStatementList UNTIL expression END REPEAT   #repeatStatement
    ;

caseStatementWhenClause
    : WHEN expression THEN sqlStatementList
    ;

elseIfClause
    : ELSEIF expression THEN sqlStatementList
    ;

elseClause
    : ELSE sqlStatementList
    ;

variableDeclaration
    : DECLARE identifier ( COMMA  identifier)* type (DEFAULT valueExpression)?
    ;

sqlStatementList
    : (controlStatement SEMICOLON)+
    ;

privilege
    : CREATE | SELECT | DELETE | INSERT | UPDATE | identifier | CREATE BRANCH
    ;

entityKind
    : TABLE | SCHEMA | identifier
    ;

grantObject
    : (BRANCH branch=identifier IN)? entityKind? qualifiedName
    ;

ownedEntityKind
    : TABLE | SCHEMA | VIEW | MATERIALIZED VIEW | identifier
    ;

qualifiedName
    : identifier ( DOT  identifier)*
    ;

queryPeriod
    : FOR rangeType AS OF end=valueExpression
    ;

rangeType
    : TIMESTAMP
    | VERSION
    ;

grantor
    : principal             #specifiedPrincipal
    | CURRENT_USER          #currentUserGrantor
    | CURRENT_ROLE          #currentRoleGrantor
    ;

principal
    : identifier            #unspecifiedPrincipal
    | USER identifier       #userPrincipal
    | ROLE identifier       #rolePrincipal
    ;

privilegeOrRole
    : CREATE | SELECT | DELETE | INSERT | UPDATE | identifier | CREATE BRANCH
    ;

identifier
    : IDENTIFIER             #unquotedIdentifier
    | QUOTED_IDENTIFIER      #quotedIdentifier
    | nonReserved            #unquotedIdentifier
    | BACKQUOTED_IDENTIFIER  #backQuotedIdentifier
    | DIGIT_IDENTIFIER       #digitIdentifier
    ;

methodName
    : identifier
    | {this.isKeyword()}? .
    ;

number
    : MINUS? DECIMAL_VALUE  #decimalLiteral
    | MINUS? DOUBLE_VALUE   #doubleLiteral
    | MINUS? INTEGER_VALUE  #integerLiteral
    ;

authorizationUser
    : identifier            #identifierUser
    | string                #stringUser
    ;

nonReserved
    // IMPORTANT: this rule must only contain tokens. Nested rules are not supported. See SqlParser.exitNonReserved
    : ABSENT | ADD | ADMIN | AFTER | ALL | ANALYZE | ANY | ARRAY | ASC | ASYMMETRIC | AT | AUTHORIZATION
    | BEGIN | BERNOULLI | BOTH | BRANCH | BRANCHES
    | CALL | CALLED | CASCADE | CATALOG | CATALOGS | COLUMN | COLUMNS | COMMENT | COMMIT | COMMITTED | CONDITIONAL | COPARTITION | CORRESPONDING | COUNT | CURRENT
    | DATA | DATE | DAY | DECLARE | DEFAULT | DEFINE | DEFINER | DENY | DESC | DESCRIPTOR | DETERMINISTIC | DISTRIBUTED | DO | DOUBLE
    | ELSEIF | EMPTY | ENCODING | ERROR | EXCLUDING | EXECUTE | EXPLAIN
    | FAIL | FAST | FETCH | FILTER | FINAL | FIRST | FOLLOWING | FORMAT | FORWARD | FUNCTION | FUNCTIONS
    | GRACE | GRANT | GRANTED | GRANTS | GRAPHVIZ | GROUPS
    | HOUR
    | IF | IGNORE | IMMEDIATE | INCLUDING | INITIAL | INLINE | INPUT | INTERVAL | INVOKER | IO | ITERATE | ISOLATION
    | JSON
    | KEEP | KEY | KEYS
    | LANGUAGE | LAST | LATERAL | LEADING | LEAVE | LEVEL | LIMIT | LOCAL | LOGICAL | LOOP
    | MAP | MATCH | MATCHED | MATCHES | MATCH_RECOGNIZE | MATERIALIZED | MEASURES | MERGE | MINUTE | MONTH
    | NEAREST | NESTED | NEXT | NFC | NFD | NFKC | NFKD | NO | NONE | NULLIF | NULLS
    | OBJECT | OF | OFFSET | OMIT | ONE | ONLY | OPTION | ORDINALITY | OUTPUT | OVER | OVERFLOW | OVERLAY
    | PARTIAL | PARTITION | PARTITIONS | PASSING | PAST | PATH | PATTERN | PER | PERIOD | PERMUTE | PLACING | PLAN | POSITION | PRECEDING | PRECISION | PRIVILEGES | PROPERTIES | PRUNE
    | QUOTES
    | RANGE | READ | REFRESH | RENAME | REPEAT  | REPEATABLE | REPLACE | RESET | RESPECT | RESTRICT | RETURN | RETURNING | RETURNS | REVOKE | ROLE | ROLES | ROLLBACK | ROW | ROWS | RUNNING
    | SCALAR | SCHEMA | SCHEMAS | SECOND | SECURITY | SEEK | SERIALIZABLE | SESSION | SET | SETS
    | SHOW | SIMPLE | SOME | STALE | START | STATS | SUBSET | SUBSTRING | SYMMETRIC | SYSTEM
    | TABLES | TABLESAMPLE | TEXT | TEXT_STRING | TIES | TIME | TIMESTAMP | TO | TRAILING | TRANSACTION | TRUNCATE | TRY_CAST | TYPE
    | UNBOUNDED | UNCOMMITTED | UNCONDITIONAL | UNIQUE | UNKNOWN | UNMATCHED | UNTIL | UPDATE | USE | USER | UTF16 | UTF32 | UTF8
    | VALIDATE | VALUE | VERBOSE | VERSION | VIEW
    | WHILE | WINDOW | WITHIN | WITHOUT | WORK | WRAPPER | WRITE
    | YEAR
    | ZONE
    ;

