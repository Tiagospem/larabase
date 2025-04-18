const { ipcMain } = require('electron');
const mysql = require('mysql2/promise');

const _LIST_TABLES_SQL = `
  SELECT table_name AS name, COUNT(*) AS columnCount
  FROM information_schema.columns
  WHERE table_schema = ?
  GROUP BY table_name
  ORDER BY table_name
`;
const _COLUMN_SQL =
  `
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
const _OUTGOING_SQL =
  `
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
const _INCOMING_SQL =
  `
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
async function _getDbConnection({ store, dbMonitoringConnections }, config) {
  if (
    store &&
    config.connectionId &&
    (!config.host || !config.port || !config.username || !config.database)
  ) {
    const saved = (store.get('connections') || []).find(c => c.id === config.connectionId);
    if (!saved) return { error: 'Connection not found' };
    Object.assign(config, saved);
  }
  const { host, port, username, password = '', database, connectionId } = config;
  if (!host || !port || !username || !database) return { error: 'Missing parameters' };
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
  ipcMain.handle('list-tables', async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection(
      { store, dbMonitoringConnections },
      config
    );
    if (error) return _error('tables', error);
    try {
      const [rows] = await connection.query(_LIST_TABLES_SQL, [config.database]);
      return { success: true, tables: rows };
    } catch (err) {
      return _error('tables', err.message || 'Failed to list tables');
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle('get-table-record-count', async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({ store }, config);
    if (error) return _error('count', error);
    try {
      const escaped = connection.escapeId(config.tableName);
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${escaped}`);
      return rows.length
        ? { success: true, count: rows[0].count || 0 }
        : _error('count', 'Failed to count records');
    } catch (err) {
      return _error('count', err.message || 'Failed to count records');
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle('get-table-structure', async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection(
      { store, dbMonitoringConnections },
      config
    );
    if (error) return _error('structure', error);
    try {
      const [cols] = await connection.query(_COLUMN_SQL, [config.database, config.tableName]);
      const [fks] = await connection.query(_FK_SQL, [config.database, config.tableName]);
      const fkSet = new Set(fks.map(f => f.column_name));
      return { success: true, columns: cols.map(c => ({ ...c, foreign_key: fkSet.has(c.name) })) };
    } catch (err) {
      return _error('structure', err.message || 'Failed to fetch table structure');
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle('get-table-foreign-keys', async (_e, config = {}) => {
    const { error, connection, isMonitored } = await _getDbConnection({}, config);
    if (error) return _error('foreign', error);
    try {
      const [out] = await connection.query(_OUTGOING_SQL, [config.database, config.tableName]);
      const [inc] = await connection.query(_INCOMING_SQL, [config.database, config.tableName]);
      return {
        success: true,
        foreignKeys: [
          ...out.map(fk => ({ ...fk, type: 'outgoing' })),
          ...inc.map(fk => ({ ...fk, type: 'incoming' }))
        ]
      };
    } catch (err) {
      return _error('foreign', err.message || 'Failed to fetch foreign keys');
    } finally {
      _closeConnection(connection, isMonitored);
    }
  });

  ipcMain.handle('update-table-record', async (_e, { connection, tableName, record } = {}) => {
    if (!connection) return _error('default', 'Connection details are required');
    if (!tableName) return _error('default', 'Table name is required');
    if (!record || !Object.keys(record).length) return _error('default', 'Record data is required');
    if (record.id == null) return _error('default', 'Record must have an ID field to update');
    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || '',
        database: connection.database
      });
      const processed = Object.fromEntries(
        Object.entries(record).map(([k, v]) => {
          if (typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}T/.test(v)) {
            const d = new Date(v);
            if (!isNaN(d)) v = d.toISOString().slice(0, 19).replace('T', ' ');
          }
          return [k, v];
        })
      );
      const fields = Object.keys(processed).filter(k => k !== 'id');
      const assignments = fields.map(f => `\`${f}\` = ?`).join(', ');
      const values = fields.map(f => processed[f]).concat(processed.id);
      const [res] = await conn.execute(
        `UPDATE \`${tableName}\` SET ${assignments} WHERE \`id\` = ?`,
        values
      );
      return {
        success: true,
        message: 'Record updated successfully',
        affectedRows: res.affectedRows
      };
    } catch (err) {
      return _error('default', err.message || 'Failed to update record');
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
      }
    }
  });

  ipcMain.handle('delete-table-records', async (_e, { connection, tableName, ids } = {}) => {
    if (!connection) throw new Error('Connection details are required');
    if (!tableName) throw new Error('Table name is required');
    if (!Array.isArray(ids) || !ids.length) throw new Error('At least one record ID is required');
    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || '',
        database: connection.database
      });
      const valIds = ids.map(id =>
        typeof id === 'string' && !isNaN(Number(id)) ? Number(id) : id
      );
      const [cRes] = await conn.query(_REFERENCE_CONSTRAINTS_SQL, [tableName, connection.database]);
      const restricts = cRes.filter(c => ['RESTRICT', 'NO ACTION'].includes(c.on_delete));
      const problematic = [];
      for (const id of valIds) {
        for (const c of restricts) {
          const [r] = await conn.query(
            `SELECT 1 FROM ${conn.escapeId(c.child_table)} WHERE ${conn.escapeId(c.child_column)} = ? LIMIT 1`,
            [id]
          );
          if (r.length) {
            problematic.push(id);
            break;
          }
        }
      }
      if (problematic.length)
        return {
          success: false,
          message: `Cannot delete records with IDs ${problematic.join(', ')} because they are referenced by other tables`,
          problematicIds: problematic
        };
      const placeholders = valIds.map(() => '?').join(',');
      const [delRes] = await conn.execute(
        `DELETE FROM ${conn.escapeId(tableName)} WHERE id IN (${placeholders})`,
        valIds
      );
      return {
        success: true,
        message: `${delRes.affectedRows} record(s) deleted successfully`,
        affectedRows: delRes.affectedRows
      };
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2')
        return {
          success: false,
          message: 'Cannot delete these records because they are referenced by other tables',
          constraintError: true
        };
      return { success: false, message: err.message };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
      }
    }
  });

  ipcMain.handle('truncate-table', async (_e, { connection, tableName } = {}) => {
    if (!connection) throw new Error('Connection details are required');
    if (!tableName) throw new Error('Table name is required');
    let conn;
    try {
      conn = await _createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || '',
        database: connection.database
      });
      const [fkRes] = await conn.query(_HAS_FK_USAGE_SQL, [tableName, connection.database]);
      const disable = fkRes.length > 0;
      await conn.beginTransaction();
      if (disable) await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.query(`TRUNCATE TABLE ${conn.escapeId(tableName)}`);
      if (disable) await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.commit();
      return { success: true, message: `Table ${tableName} truncated successfully` };
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
        await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
      return { success: false, message: err.message };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
      }
    }
  });

  ipcMain.handle('getTableData', async (_e, config = {}) => {
    console.log("getTableData handler in tables.js called with sorting params:", {
      sortColumn: config.sortColumn,
      sortDirection: config.sortDirection
    });
    
    let connection;
    let monitoredConnection = null;

    try {
      if (
        config.connectionId &&
        (!config.host || !config.port || !config.username || !config.database)
      ) {
        console.log(`Getting connection details for table data, ID: ${config.connectionId}`);
        const connections = store.get('connections') || [];
        const connectionDetails = connections.find(conn => conn.id === config.connectionId);

        if (!connectionDetails) {
          return {
            success: false,
            message: 'Connection not found',
            data: [],
            totalRecords: 0
          };
        }

        config.host = connectionDetails.host;
        config.port = connectionDetails.port;
        config.username = connectionDetails.username;
        config.password = connectionDetails.password;
        config.database = connectionDetails.database;
      }

      if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
        return {
          success: false,
          message: 'Missing parameters',
          data: [],
          totalRecords: 0
        };
      }

      let useMonitoredConnection = false;

      if (config.connectionId) {
        monitoredConnection = dbMonitoringConnections.get(config.connectionId);
        if (monitoredConnection) {
          console.log(`Using existing monitored connection for ${config.connectionId}`);
          connection = monitoredConnection;
          useMonitoredConnection = true;
        }
      }

      if (!useMonitoredConnection) {
        connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password || '',
          database: config.database,
          connectTimeout: 10000
        });
      }

      // Escapar nome da tabela para prevenir SQL injection
      const tableName = connection.escapeId(config.tableName);

      // Configurações de paginação
      const page = config.page || 1;
      const limit = parseInt(config.limit) || 100;
      const offset = (page - 1) * limit;

      console.log(
        `Fetching data from ${config.database}.${config.tableName} (page: ${page}, limit: ${limit}, offset: ${offset})`
      );

      // Primeiro, obter a contagem total de registros
      const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM ${tableName}`);
      const totalRecords = countResult[0].total;

      console.log(`Total records in ${config.tableName}: ${totalRecords}`);

      // Build query with sorting if provided
      let sql = `SELECT * FROM ${tableName}`;
      
      if (config.sortColumn) {
        const sortColumn = connection.escapeId(config.sortColumn);
        const sortDirection = config.sortDirection === 'desc' ? 'DESC' : 'ASC';
        
        sql += ` ORDER BY ${sortColumn} ${sortDirection}`;
        console.log(`Sorting by ${config.sortColumn} ${sortDirection}`);
      }
      
      sql += ` LIMIT ? OFFSET ?`;
      
      console.log(`Executing SQL: ${sql}`, [limit, offset]);
      
      // Obter os dados da página atual
      const [rows] = await connection.query(sql, [limit, offset]);

      console.log(`Fetched ${rows?.length || 0} rows from ${config.tableName} for page ${page}`);

      return {
        success: true,
        data: rows || [],
        totalRecords: totalRecords,
        page: page,
        limit: limit
      };
    } catch (error) {
      console.error('Error fetching table data:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch table data',
        data: [],
        totalRecords: 0
      };
    } finally {
      if (connection && !monitoredConnection) {
        try {
          await connection.end();
        } catch (err) {
          console.error('Error closing MySQL connection:', err);
        }
      }
    }
  });

  ipcMain.handle('getFilteredTableData', async (_e, config = {}) => {
    console.log("getFilteredTableData handler in tables.js called with sorting params:", {
      sortColumn: config.sortColumn,
      sortDirection: config.sortDirection
    });
    
    let connection;
    let monitoredConnection = null;

    try {
      if (
        !config.host ||
        !config.port ||
        !config.username ||
        !config.database ||
        !config.tableName ||
        !config.filter
      ) {
        return {
          success: false,
          message: 'Missing required parameters',
          data: [],
          totalRecords: 0
        };
      }

      if (config.connectionId) {
        monitoredConnection = dbMonitoringConnections.get(config.connectionId);
        if (monitoredConnection) {
          console.log(
            `Using existing monitored connection for filtered data: ${config.connectionId}`
          );
          connection = monitoredConnection;
        }
      }

      if (!monitoredConnection) {
        connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password || '',
          database: config.database,
          connectTimeout: 10000
        });
      }

      // Escapar nome da tabela para prevenir SQL injection
      const tableName = connection.escapeId(config.tableName);

      // Limpar o filtro - remover 'WHERE' se estiver no início
      let filterClause = config.filter.trim();
      if (filterClause.toLowerCase().startsWith('where')) {
        filterClause = filterClause.substring(5).trim();
      }

      const page = config.page || 1;
      const limit = parseInt(config.limit) || 100;
      const offset = (page - 1) * limit;

      console.log(`Executing filtered query on ${config.database}.${config.tableName}`);
      console.log(`Filter: ${filterClause}`);
      console.log(`Page: ${page}, Limit: ${limit}, Offset: ${offset}`);

      const countQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE ${filterClause}`;
      console.log(`Count query: ${countQuery}`);

      let totalRecords = 0;
      try {
        const [countResult] = await connection.query(countQuery);
        totalRecords = countResult[0].total;
        console.log(`Total records matching filter: ${totalRecords}`);
      } catch (countError) {
        console.error('Error executing count query:', countError);
      }

      // Build query with sorting if provided
      let sql = `SELECT * FROM ${tableName} WHERE ${filterClause}`;
      
      if (config.sortColumn) {
        const sortColumn = connection.escapeId(config.sortColumn);
        const sortDirection = config.sortDirection === 'desc' ? 'DESC' : 'ASC';
        
        sql += ` ORDER BY ${sortColumn} ${sortDirection}`;
        console.log(`Sorting by ${config.sortColumn} ${sortDirection}`);
      }
      
      sql += ` LIMIT ? OFFSET ?`;
      
      console.log(`Executing SQL: ${sql}`, [limit, offset]);
      
      const [rows] = await connection.query(sql, [limit, offset]);

      console.log(`Fetched ${rows?.length || 0} rows from filtered data`);

      return {
        success: true,
        data: rows || [],
        totalRecords: totalRecords,
        page: page,
        limit: limit
      };
    } catch (error) {
      console.error('Error fetching filtered data:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch filtered data',
        data: [],
        totalRecords: 0
      };
    } finally {
      if (connection && !monitoredConnection) {
        try {
          await connection.end();
        } catch (err) {
          console.error('Error closing MySQL connection:', err);
        }
      }
    }
  });
}

module.exports = { registerTableHandlers };
