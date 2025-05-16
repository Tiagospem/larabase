export const LIST_TABLES_SQL = `
    SELECT
        table_name   AS name,
        COUNT(*)     AS columnCount
    FROM
        information_schema.columns
    WHERE
        table_schema = ?
    GROUP BY
        table_name
    ORDER BY
        table_name;
`;

export const BASE_COUNT_SQL = `
    SELECT
        TABLE_NAME   AS name,
        TABLE_ROWS   AS rowCount
    FROM
        information_schema.tables
    WHERE
        TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE';
`;

export const HAS_FK_USAGE_SQL = `
  SELECT 1
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_NAME = ? AND REFERENCED_TABLE_SCHEMA = ?
  LIMIT 1
`;

export const COLUMN_SQL = `
  SELECT
    COLUMN_NAME   AS name,
    COLUMN_TYPE   AS type,
    IS_NULLABLE = 'YES'      AS nullable,
    COLUMN_DEFAULT           AS \`default\`,
    COLUMN_KEY = 'PRI'       AS primary_key,
    COLUMN_KEY = 'UNI'       AS unique_key,
    EXTRA                   AS extra
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  ORDER BY ORDINAL_POSITION
`;

export const FK_SQL = `
  SELECT COLUMN_NAME AS column_name
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
`;

export const REFERENCE_CONSTRAINTS_SQL = `
  SELECT
    k.CONSTRAINT_NAME        AS constraint_name,
    k.TABLE_NAME             AS child_table,
    k.COLUMN_NAME            AS child_column,
    r.DELETE_RULE            AS on_delete
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME
   AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
  WHERE k.REFERENCED_TABLE_NAME = ? AND k.REFERENCED_TABLE_SCHEMA = ?
`;

export const OUTGOING_SQL = `
  SELECT
    k.CONSTRAINT_NAME        AS name,
    k.COLUMN_NAME            AS \`column\`,
    k.REFERENCED_TABLE_NAME  AS referenced_table,
    k.REFERENCED_COLUMN_NAME AS referenced_column,
    rc.UPDATE_RULE           AS on_update,
    rc.DELETE_RULE           AS on_delete
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
   AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
  WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
`;

export const INCOMING_SQL = `
  SELECT
    k.CONSTRAINT_NAME        AS name,
    k.TABLE_NAME             AS \`table\`,
    k.COLUMN_NAME            AS \`column\`,
    k.REFERENCED_COLUMN_NAME AS referenced_column,
    rc.UPDATE_RULE           AS on_update,
    rc.DELETE_RULE           AS on_delete
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
   AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
  WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME = ?
`;

export const TABLE_INDEXES_SQL = `
  SELECT 
    INDEX_NAME AS name,
    INDEX_TYPE AS type,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns,
    INDEX_TYPE AS algorithm,
    MAX(CARDINALITY) AS cardinality,
    MAX(INDEX_COMMENT) AS comment,
    MIN(NON_UNIQUE) AS is_unique
  FROM 
    information_schema.STATISTICS
  WHERE 
    TABLE_SCHEMA = ? AND TABLE_NAME = ?
  GROUP BY 
    INDEX_NAME, INDEX_TYPE
  ORDER BY 
    INDEX_NAME = 'PRIMARY' DESC, 
    is_unique ASC, 
    INDEX_NAME ASC
`;
