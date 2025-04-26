const { ipcMain } = require("electron");
const mysql = require("mysql2/promise");

const _LIST_TABLES_SQL = `
  SELECT table_name AS name, COUNT(*) AS columnCount
  FROM information_schema.columns
  WHERE table_schema = ?
  GROUP BY table_name
  ORDER BY table_name
`;
const _COLUMN_SQL = `
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
const _FK_SQL = `
  SELECT COLUMN_NAME AS column_name
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
`;
const _OUTGOING_SQL = `
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
const _INCOMING_SQL = `
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
const _REFERENCE_CONSTRAINTS_SQL = `
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
const _HAS_FK_USAGE_SQL = `
  SELECT 1
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_NAME = ? AND REFERENCED_TABLE_SCHEMA = ?
  LIMIT 1
`;

function _applySortingAndPagination(baseSql, connection, config) {
  let sql = baseSql;
  if (config.sortColumn) {
    const sortCol = connection.escapeId(config.sortColumn);
    const dir = config.sortDirection === "desc" ? "DESC" : "ASC";
    sql += ` ORDER BY ${sortCol} ${dir}`;
  }
  sql += ` LIMIT ? OFFSET ?`;
  return sql;
}

async function _getDbConnection({ store, dbMonitoringConnections }, config) {
  if (store && config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
    const saved = (store.get("connections") || []).find((c) => c.id === config.connectionId);
    if (!saved) return { error: "Connection not found" };
    Object.assign(config, saved);
  }
  const { host, port, username, password = "", database, connectionId } = config;
  if (!host || !port || !username || !database) return { error: "Missing parameters" };
  let connection,
    isMonitored = false;
  if (dbMonitoringConnections && connectionId) {
    const mon = dbMonitoringConnections.get(connectionId);
    if (mon) {
      connection = mon;
      isMonitored = true;
    }
  }
  if (!connection) {
    connection = await mysql.createConnection({
      host,
      port,
      user: username,
      password,
      database,
      connectTimeout: 10000
    });
  }
  return { connection, isMonitored };
}

function _closeConnection(conn, isMonitored) {
  if (conn && !isMonitored) conn.end().catch(() => {});
}

function _error(type, message) {
  const base = { success: false, message };
  const map = {
    tables: () => ({ ...base, tables: [] }),
    count: () => ({ ...base, count: 0 }),
    structure: () => ({ ...base, columns: [] }),
    foreign: () => ({ ...base, foreignKeys: [] }),
    default: () => base
  };
  return (map[type] || map.default)();
}

function _createConnection(cfg) {
  return mysql.createConnection({ ...cfg, connectTimeout: 10000 });
}

function registerTableHandlers(store, dbMonitoringConnections) {
  ipcMain.handle("list-tables", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
    if (error) return _error("tables", error);
    try {
      // Primeiro vamos obter a lista de tabelas
      const [tables] = await connection.query(_LIST_TABLES_SQL, [config.database]);
      
      if (tables.length === 0) {
        return { success: true, tables: [] };
      }
      
      // Construir uma única consulta para contar todas as tabelas
      // Usando UNION ALL para combinar resultados de cada tabela
      const tableCountQueries = tables.map(table => {
        const escapedTable = connection.escapeId(table.name);
        return `SELECT '${table.name}' AS tableName, COUNT(*) AS rowCount FROM ${escapedTable}`;
      }).join(' UNION ALL ');
      
      try {
        // Executar a contagem em uma única consulta SQL
        const [countResults] = await connection.query(tableCountQueries);
        
        // Criar um mapa para armazenar os resultados da contagem
        const countsMap = {};
        countResults.forEach(row => {
          countsMap[row.tableName] = row.rowCount;
        });
        
        // Adicionar contagens exatas às tabelas
        tables.forEach(table => {
          table.rowCount = countsMap[table.name] || 0;
        });
      } catch (countError) {
        // Se houver erro na contagem em massa, vamos tentar individualmente
        console.error("Erro na contagem em massa, tentando individualmente:", countError);
        
        // Fazer as contagens uma a uma para cada tabela
        for (const table of tables) {
          try {
            const escapedTable = connection.escapeId(table.name);
            const [rows] = await connection.query(`SELECT COUNT(*) AS rowCount FROM ${escapedTable}`);
            table.rowCount = rows[0]?.rowCount || 0;
          } catch (err) {
            console.error(`Erro ao contar registros da tabela ${table.name}:`, err);
            table.rowCount = 0;
          }
        }
      }

      return { success: true, tables: tables };
    } catch (err) {
      return _error("tables", err.message || "Failed to list tables");
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("get-table-record-count", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store }, config);
    if (error) return _error("count", error);
    try {
      const escaped = connection.escapeId(config.tableName);
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${escaped}`);
      return rows.length ? { success: true, count: rows[0].count || 0 } : _error("count", "Failed to count records");
    } catch (err) {
      return _error("count", err.message || "Failed to count records");
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("get-table-structure", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
    if (error) return _error("structure", error);
    try {
      const [cols] = await connection.query(_COLUMN_SQL, [config.database, config.tableName]);
      const [fks] = await connection.query(_FK_SQL, [config.database, config.tableName]);
      const fkSet = new Set(fks.map((f) => f.column_name));
      return {
        success: true,
        columns: cols.map((c) => ({
          ...c,
          foreign_key: fkSet.has(c.name)
        }))
      };
    } catch (err) {
      return _error("structure", err.message || "Failed to fetch table structure");
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("get-table-foreign-keys", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({}, config);
    if (error) return _error("foreign", error);
    try {
      const [out] = await connection.query(_OUTGOING_SQL, [config.database, config.tableName]);
      const [inc] = await connection.query(_INCOMING_SQL, [config.database, config.tableName]);
      return {
        success: true,
        foreignKeys: [...out.map((fk) => ({ ...fk, type: "outgoing" })), ...inc.map((fk) => ({ ...fk, type: "incoming" }))]
      };
    } catch (err) {
      return _error("foreign", err.message || "Failed to fetch foreign keys");
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("update-table-record", async (_e, { connection, tableName, record } = {}) => {
    if (!connection) return _error("default", "Connection details are required");
    if (!tableName) return _error("default", "Table name is required");
    if (!record || !Object.keys(record).length) return _error("default", "Record data is required");
    if (record.id == null) return _error("default", "Record must have an ID field to update");
    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || "",
        database: connection.database
      });
      const processed = Object.fromEntries(
        Object.entries(record).map(([k, v]) => {
          if (typeof v === "string" && /^\\d{4}-\\d{2}-\\d{2}T/.test(v)) {
            const d = new Date(v);
            if (!isNaN(d)) v = d.toISOString().slice(0, 19).replace("T", " ");
          }
          return [k, v];
        })
      );
      const fields = Object.keys(processed).filter((k) => k !== "id");
      const assignments = fields.map((f) => `\`${f}\` = ?`).join(", ");
      const values = fields.map((f) => processed[f]).concat(processed.id);
      const [res] = await conn.execute(`UPDATE \`${tableName}\` SET ${assignments} WHERE \`id\` = ?`, values);
      return {
        success: true,
        message: "Record updated successfully",
        affectedRows: res.affectedRows
      };
    } catch (err) {
      return _error("default", err.message || "Failed to update record");
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      }
    }
  });

  ipcMain.handle("delete-table-records", async (_e, { connection, tableName, ids, ignoreForeignKeys = false } = {}) => {
    if (!connection) throw new Error("Connection details are required");
    if (!tableName) throw new Error("Table name is required");
    if (!Array.isArray(ids) || !ids.length) throw new Error("At least one record ID is required");

    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || "",
        database: connection.database
      });

      const valIds = ids.map((id) => (typeof id === "string" && !isNaN(Number(id)) ? Number(id) : id));

      // If ignoreForeignKeys is true, disable foreign key checks
      if (ignoreForeignKeys === true) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      } else {
        const [cRes] = await conn.query(_REFERENCE_CONSTRAINTS_SQL, [tableName, connection.database]);
        const restricts = cRes.filter((c) => ["RESTRICT", "NO ACTION"].includes(c.on_delete));
        const problematic = [];
        for (const id of valIds) {
          for (const c of restricts) {
            const query = `SELECT 1 FROM ${conn.escapeId(c.child_table)} WHERE ${conn.escapeId(c.child_column)} = ? LIMIT 1`;
            const [r] = await conn.query(query, [id]);
            if (r.length) {
              problematic.push(id);
              break;
            }
          }
        }

        if (problematic.length) {
          return {
            success: false,
            message: `Cannot delete records with IDs ${problematic.join(", ")} because they are referenced by other tables`,
            problematicIds: problematic
          };
        }
      }

      const placeholders = valIds.map(() => "?").join(",");
      const deleteQuery = `DELETE FROM ${conn.escapeId(tableName)} WHERE id IN (${placeholders})`;

      const [delRes] = await conn.execute(deleteQuery, valIds);

      // Re-enable foreign key checks if they were disabled
      if (ignoreForeignKeys === true) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      }

      return {
        success: true,
        message: `${delRes.affectedRows} record(s) deleted successfully`,
        affectedRows: delRes.affectedRows
      };
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2")
        return {
          success: false,
          message: "Cannot delete these records because they are referenced by other tables",
          constraintError: true
        };
      return { success: false, message: err.message };
    } finally {
      if (conn) {
        try {
          if (ignoreForeignKeys === true) {
            await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch((e) => {
              console.error("Error re-enabling foreign key checks:", e);
            });
          }
          await conn.end();
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      }
    }
  });

  ipcMain.handle("truncate-table", async (_e, { connection, tableName } = {}) => {
    if (!connection) throw new Error("Connection details are required");
    if (!tableName) throw new Error("Table name is required");
    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || "",
        database: connection.database
      });
      const [fkRes] = await conn.query(_HAS_FK_USAGE_SQL, [tableName, connection.database]);
      const disable = fkRes.length > 0;
      await conn.beginTransaction();
      if (disable) await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.query(`TRUNCATE TABLE ${conn.escapeId(tableName)}`);
      if (disable) await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      await conn.commit();
      return {
        success: true,
        message: `Table ${tableName} truncated successfully`
      };
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
        await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
      }
      return { success: false, message: err.message };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      }
    }
  });

  ipcMain.handle("get-table-data", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
    if (error) {
      return {
        success: false,
        message: error,
        data: [],
        totalRecords: 0
      };
    }

    try {
      const tableName = connection.escapeId(config.tableName);
      const page = config.page || 1;
      const limit = parseInt(config.limit, 10) || 100;
      const offset = (page - 1) * limit;

      const [countRows] = await connection.query(`SELECT COUNT(*) AS totalRecords FROM ${tableName}`);
      const totalRecords = countRows[0]?.totalRecords || 0;

      const baseSql = `SELECT * FROM ${tableName}`;
      const sql = _applySortingAndPagination(baseSql, connection, config);
      const [rows] = await connection.query(sql, [limit, offset]);

      return {
        success: true,
        data: rows,
        totalRecords,
        page,
        limit
      };
    } catch (err) {
      return {
        success: false,
        message: err.message || "Failed to fetch table data",
        data: [],
        totalRecords: 0
      };
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("get-filtered-table-data", async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
    if (error) {
      return {
        success: false,
        message: error,
        data: [],
        totalRecords: 0
      };
    }

    try {
      const tableName = connection.escapeId(config.tableName);
      let filter = (config.filter || "").trim();
      if (filter.toLowerCase().startsWith("where")) {
        filter = filter.slice(5).trim();
      }

      const page = config.page || 1;
      const limit = parseInt(config.limit, 10);
      const effectiveLimit = limit || 100;
      const offset = (page - 1) * effectiveLimit;

      const [countRows] = await connection.query(`SELECT COUNT(*) AS totalRecords FROM ${tableName} WHERE ${filter}`);
      const totalRecords = countRows[0]?.totalRecords || 0;

      const baseSql = `SELECT * FROM ${tableName} WHERE ${filter}`;
      const sql = _applySortingAndPagination(baseSql, connection, config);

      const [rows] = await connection.query(sql, [effectiveLimit, offset]);

      return {
        success: true,
        data: rows,
        totalRecords,
        page,
        limit: effectiveLimit,
        debug: {
          filter,
          sql,
          offset,
          effectiveLimit,
          page
        }
      };
    } catch (err) {
      console.error("Error filter data:", err);
      return {
        success: false,
        message: err.message || "Failed to fetch filtered table data",
        data: [],
        totalRecords: 0
      };
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle("list-databases", async (_e, config = {}) => {
    if (!config.host || !config.port || !config.username) {
      return {
        success: false,
        message: "Missing connection parameters",
        databases: []
      };
    }

    let conn;
    try {
      conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || "",
        connectTimeout: 10000
      });

      const [rows] = await conn.query("SHOW DATABASES");
      const databases = rows.map((r) => r.Database || r.database).filter((db) => !["information_schema", "performance_schema", "mysql", "sys"].includes(db));

      return { success: true, databases };
    } catch (err) {
      let msg = err.message;
      if (err.code === "ER_ACCESS_DENIED_ERROR") {
        msg = "Access denied with the provided credentials";
      } else if (err.code === "ECONNREFUSED") {
        msg = "Connection refused - check host and port";
      }
      return {
        success: false,
        message: msg,
        databases: []
      };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      }
    }
  });

  ipcMain.handle("drop-database", async (_e, config = {}) => {
    if (!config.host || !config.port || !config.username || !config.database) {
      return {
        success: false,
        message: "Missing connection parameters"
      };
    }

    let conn;
    try {
      conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || "",
        connectTimeout: 10000
      });

      const dbName = conn.escapeId(config.database);

      await conn.query(`DROP DATABASE ${dbName}`);

      return {
        success: true,
        message: `Database ${config.database} dropped successfully`
      };
    } catch (err) {
      console.error("Error dropping database:", err);
      let msg = err.message;
      if (err.code === "ER_ACCESS_DENIED_ERROR") {
        msg = "Access denied with the provided credentials";
      } else if (err.code === "ECONNREFUSED") {
        msg = "Connection refused - check host and port";
      } else if (err.code === "ER_DB_DROP_EXISTS") {
        msg = `Database ${config.database} does not exist`;
      }
      return {
        success: false,
        message: msg
      };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      }
    }
  });

  ipcMain.handle("drop-tables", async (_e, config = {}) => {
    try {
      config = JSON.parse(
        JSON.stringify({
          connectionId: config.connectionId || "",
          tables: Array.isArray(config.tables) ? [...config.tables] : [],
          ignoreForeignKeys: Boolean(config.ignoreForeignKeys),
          cascade: Boolean(config.cascade)
        })
      );
    } catch (parseError) {
      console.error("Error serializing input config:", parseError);
      return {
        success: false,
        message: "Invalid input format: could not process request data"
      };
    }

    if (!config.connectionId || !config.tables || !Array.isArray(config.tables) || config.tables.length === 0) {
      return {
        success: false,
        message: "Missing required parameters: connectionId or tables"
      };
    }

    console.log("Tables deletion requested:", config);

    const connections = store.get("connections") || [];
    const connection = connections.find((c) => c.id === config.connectionId);

    if (!connection) {
      return {
        success: false,
        message: "Connection not found"
      };
    }

    let conn;

    try {
      conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || "",
        database: connection.database,
        connectTimeout: 10000
      });

      await conn.query("START TRANSACTION");

      if (config.ignoreForeignKeys) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      }

      let successCount = 0;
      let failedTables = [];

      for (const tableName of config.tables) {
        try {
          console.log(`Attempting to drop table: ${tableName}`);
          const escapedTableName = conn.escapeId(tableName);
          let dropQuery = `DROP TABLE `;

          if (config.cascade) {
            dropQuery += `CASCADE `;
          }

          dropQuery += escapedTableName;

          console.log(`Executing query: ${dropQuery}`);
          await conn.query(dropQuery);
          successCount++;
          console.log(`Successfully dropped table: ${tableName}`);
        } catch (err) {
          console.error(`Failed to drop table ${tableName}:`, err.message);
          failedTables.push(tableName);
        }
      }

      if (config.ignoreForeignKeys) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      }

      if (failedTables.length === 0) {
        await conn.query("COMMIT");
        console.log(`Successfully dropped ${successCount} tables`);
        return {
          success: true,
          message: `Successfully dropped ${successCount} tables`
        };
      } else {
        await conn.query("ROLLBACK");
        console.log(`Failed to drop ${failedTables.length} tables: ${failedTables.join(", ")}`);
        return {
          success: false,
          message: `Failed to drop ${failedTables.length} tables: ${failedTables.join(", ")}`
        };
      }
    } catch (err) {
      console.error("Error in drop-tables handler:", err);

      if (conn) {
        try {
          await conn.query("ROLLBACK");
          if (config.ignoreForeignKeys) {
            await conn.query("SET FOREIGN_KEY_CHECKS = 1");
          }
        } catch (rollbackErr) {}
      }

      return {
        success: false,
        message: "Error dropping tables: " + (err.message || "Unknown error")
      };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (err) {}
      }
    }
  });

  ipcMain.handle("get-database-relationships", async (event, config) => {
    let connection;

    try {
      function getConnectionDetails(connectionId) {
        const connections = store.get("connections") || [];
        return connections.find((conn) => conn.id === connectionId);
      }

      if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
        const connectionDetails = getConnectionDetails(config.connectionId);
        if (!connectionDetails) {
          console.error(`Connection details not found for ID: ${config.connectionId}`);
          return {
            success: false,
            message: "Connection details not found"
          };
        }
        config.host = connectionDetails.host;
        config.port = connectionDetails.port;
        config.username = connectionDetails.username;
        config.password = connectionDetails.password;
        config.database = connectionDetails.database;
      }

      if (!config.host || !config.port || !config.username || !config.database) {
        console.error("Missing connection parameters for diagram:", config);
        return {
          success: false,
          message: "Missing required connection parameters"
        };
      }

      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        multipleStatements: true
      });

      const [rows] = await connection.query(
        `
      SELECT 
        TABLE_NAME AS sourceTable,
        COLUMN_NAME AS sourceColumn,
        REFERENCED_TABLE_NAME AS targetTable,
        REFERENCED_COLUMN_NAME AS targetColumn,
        CONSTRAINT_NAME AS constraintName
      FROM
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE
        REFERENCED_TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND REFERENCED_COLUMN_NAME IS NOT NULL
      ORDER BY
        TABLE_NAME, COLUMN_NAME;
    `,
        [config.database]
      );

      if (rows.length === 0) {
        const [tables] = await connection.query(
          `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? 
          AND table_type = 'BASE TABLE'
      `,
          [config.database]
        );

        const inferredRelationships = [];

        for (const table of tables) {
          const tableName = table.table_name || table.TABLE_NAME;

          const [columns] = await connection.query(
            `
          SELECT 
            COLUMN_NAME as name,
            COLUMN_TYPE as type,
            COLUMN_KEY as \`key\`
          FROM 
            information_schema.COLUMNS 
          WHERE 
            TABLE_SCHEMA = ? 
            AND TABLE_NAME = ?
          ORDER BY 
            ORDINAL_POSITION
        `,
            [config.database, tableName]
          );

          for (const column of columns) {
            const columnName = column.name;

            if (columnName.endsWith("_id") || columnName.endsWith("_fk") || (columnName.startsWith("id_") && columnName !== "id")) {
              let targetTable = null;

              if (columnName.endsWith("_id")) {
                targetTable = columnName.substring(0, columnName.length - 3);
              } else if (columnName.endsWith("_fk")) {
                targetTable = columnName.substring(0, columnName.length - 3);
              } else if (columnName.startsWith("id_")) {
                targetTable = columnName.substring(3);
              }

              const targetExists = tables.some((t) => (t.table_name || t.TABLE_NAME).toLowerCase() === targetTable.toLowerCase());

              if (targetExists) {
                inferredRelationships.push({
                  sourceTable: tableName,
                  sourceColumn: columnName,
                  targetTable: targetTable,
                  targetColumn: "id",
                  constraintName: `inferred_${tableName}_${columnName}`,
                  inferred: true
                });

                console.log(`Inferred relationship: ${tableName}.${columnName} -> ${targetTable}.id`);
              }
            }
          }
        }

        if (inferredRelationships.length > 0) {
          console.log(`Generated ${inferredRelationships.length} inferred relationships`);
          await connection.end();
          return inferredRelationships;
        }
      }

      if (connection) {
        await connection.end();
      }

      return rows;
    } catch (error) {
      console.error("Error getting database relationships:", error);

      if (connection) {
        try {
          await connection.end();
        } catch (err) {
          console.error("Error closing MySQL connection:", err);
        }
      }

      return {
        success: false,
        message: error.message || "Failed to get database relationships",
        error: error.toString()
      };
    }
  });

  ipcMain.handle("execute-sql-query", async (event, config) => {
    let connection;
    let monitoredConnection = null;

    try {
      if (!config.connectionId || !config.query) {
        return {
          success: false,
          error: "Missing connectionId or query",
          results: []
        };
      }

      const connections = store.get("connections") || [];
      const connectionDetails = connections.find((conn) => conn.id === config.connectionId);

      if (!connectionDetails) {
        return {
          success: false,
          error: "Connection not found",
          results: []
        };
      }

      monitoredConnection = dbMonitoringConnections.get(config.connectionId);

      if (monitoredConnection) {
        connection = monitoredConnection;
      } else {
        connection = await mysql.createConnection({
          host: connectionDetails.host,
          port: connectionDetails.port,
          user: connectionDetails.username,
          password: connectionDetails.password || "",
          database: connectionDetails.database,
          connectTimeout: 10000,
          multipleStatements: true
        });
      }

      const [results] = await connection.query(config.query);

      return {
        success: true,
        results: Array.isArray(results) ? results : [results]
      };
    } catch (error) {
      console.error("Error executing SQL query:", error);
      return {
        success: false,
        error: error.message || "Failed to execute SQL query",
        results: []
      };
    } finally {
      if (connection && !monitoredConnection) {
        try {
          await connection.end();
        } catch (err) {
          console.error("Error closing MySQL connection:", err);
        }
      }
    }
  });
}

module.exports = { registerTableHandlers };
