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
    COLUMN_DEFAULT           AS ` +
  '`default`' +
  `,
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
    k.COLUMN_NAME            AS ` +
  '`column`' +
  `,
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
    k.TABLE_NAME             AS ` +
  '`table`' +
  `,
    k.COLUMN_NAME            AS ` +
  '`column`' +
  `,
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
}

module.exports = { registerTableHandlers };

// const { ipcMain } = require('electron');
// const mysql = require('mysql2/promise');
//
// const _LIST_TABLES_SQL = `
//   SELECT table_name AS name, COUNT(*) AS columnCount
//   FROM information_schema.columns
//   WHERE table_schema = ?
//   GROUP BY table_name
//   ORDER BY table_name
// `;
//
// const _COLUMN_SQL = `
//   SELECT
//     COLUMN_NAME   AS name,
//     COLUMN_TYPE   AS type,
//     IS_NULLABLE = 'YES'      AS nullable,
//     COLUMN_DEFAULT           AS \`default\`,
//     COLUMN_KEY = 'PRI'       AS primary_key,
//     COLUMN_KEY = 'UNI'       AS unique_key,
//     EXTRA                   AS extra
//   FROM information_schema.COLUMNS
//   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
//   ORDER BY ORDINAL_POSITION
// `;
//
// const _FK_SQL = `
//   SELECT COLUMN_NAME AS column_name
//   FROM information_schema.KEY_COLUMN_USAGE
//   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
// `;
//
// const _OUTGOING_SQL = `
//   SELECT
//     k.CONSTRAINT_NAME        AS name,
//     k.COLUMN_NAME            AS \`column\`,
//     k.REFERENCED_TABLE_NAME  AS referenced_table,
//     k.REFERENCED_COLUMN_NAME AS referenced_column,
//     rc.UPDATE_RULE           AS on_update,
//     rc.DELETE_RULE           AS on_delete
//   FROM information_schema.KEY_COLUMN_USAGE k
//   JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
//     ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
//    AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
//   WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
// `;
//
// const _INCOMING_SQL = `
//   SELECT
//     k.CONSTRAINT_NAME        AS name,
//     k.TABLE_NAME             AS \`table\`,
//     k.COLUMN_NAME            AS \`column\`,
//     k.REFERENCED_COLUMN_NAME AS referenced_column,
//     rc.UPDATE_RULE           AS on_update,
//     rc.DELETE_RULE           AS on_delete
//   FROM information_schema.KEY_COLUMN_USAGE k
//   JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
//     ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
//    AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
//   WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME = ?
// `;
//
// async function _getDbConnection({ store, dbMonitoringConnections }, config) {
//     if (store && config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
//         const saved = (store.get('connections') || []).find(c => c.id === config.connectionId);
//         if (!saved) return { error: 'Connection not found' };
//         Object.assign(config, saved);
//     }
//
//     const { host, port, username, password = '', database, connectionId } = config;
//     if (!host || !port || !username || !database) {
//         return { error: 'Missing parameters' };
//     }
//
//     let connection, isMonitored = false;
//     if (dbMonitoringConnections && connectionId) {
//         const mon = dbMonitoringConnections.get(connectionId);
//         if (mon) {
//             connection   = mon;
//             isMonitored = true;
//         }
//     }
//     if (!connection) {
//         connection = await mysql.createConnection({ host, port, user: username, password, database, connectTimeout: 10000 });
//     }
//
//     return { connection, isMonitored };
// }
//
// function _closeConnection(conn, isMonitored) {
//     if (conn && !isMonitored) conn.end().catch(e => console.error('Error closing connection:', e));
// }
//
// function _error(type, message) {
//     const base = { success: false, message };
//     switch (type) {
//         case 'tables':    return { ...base, tables: [] };
//         case 'count':     return { ...base, count: 0 };
//         case 'structure': return { ...base, columns: [] };
//         case 'foreign':   return { ...base, foreignKeys: [] };
//     }
// }
//
// function listTablesHandler(store, dbMonitoringConnections) {
//     ipcMain.handle('list-tables', async (_event, config = {}) => {
//         const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
//         if (error) return _error('tables', error);
//
//         try {
//             const [rows] = await connection.query(_LIST_TABLES_SQL, [config.database]);
//             return { success: true, tables: rows };
//         } catch (err) {
//             console.error('Error listing tables:', err);
//             return _error('tables', err.message || 'Failed to list tables from database');
//         } finally {
//             _closeConnection(connection, isMonitored);
//         }
//     });
// }
//
// function getTableRecordCountHandler(store) {
//     ipcMain.handle('get-table-record-count', async (_event, config = {}) => {
//         const { error, connection, isMonitored } = await _getDbConnection({ store }, config);
//         if (error) return _error('count', error);
//
//         try {
//             const escaped = connection.escapeId(config.tableName);
//             const [rows]   = await connection.query(`SELECT COUNT(*) AS count FROM ${escaped}`);
//             if (rows.length) {
//                 return { success: true, count: rows[0].count || 0 };
//             }
//             return _error('count', 'Failed to count records');
//         } catch (err) {
//             console.error('Error counting table records:', err);
//             return _error('count', err.message || 'Failed to count records');
//         } finally {
//             _closeConnection(connection, isMonitored);
//         }
//     });
// }
//
// function getTableStructureHandler(store, dbMonitoringConnections) {
//     ipcMain.handle('get-table-structure', async (_event, config = {}) => {
//         const { error, connection, isMonitored } = await _getDbConnection({ store, dbMonitoringConnections }, config);
//         if (error) return _error('structure', error);
//
//         try {
//             const [cols] = await connection.query(_COLUMN_SQL, [config.database, config.tableName]);
//             const [fks]  = await connection.query(_FK_SQL,    [config.database, config.tableName]);
//             const fkSet  = new Set(fks.map(fk => fk.column_name));
//
//             const enhanced = cols.map(col => ({ ...col, foreign_key: fkSet.has(col.name) }));
//             return { success: true, columns: enhanced };
//         } catch (err) {
//             console.error('Error fetching table structure:', err);
//             return _error('structure', err.message || 'Failed to fetch table structure');
//         } finally {
//             _closeConnection(connection, isMonitored);
//         }
//     });
// }
//
// function getTableForeignKeysHandler() {
//     ipcMain.handle('get-table-foreign-keys', async (_event, config = {}) => {
//         const { error, connection, isMonitored } = await _getDbConnection({}, config);
//         if (error) return _error('foreign', error);
//
//         try {
//             const [out] = await connection.query(_OUTGOING_SQL, [config.database, config.tableName]);
//             const [inc] = await connection.query(_INCOMING_SQL, [config.database, config.tableName]);
//
//             const outgoing = out.map(fk => ({ ...fk, type: 'outgoing' }));
//             const incoming = inc.map(fk => ({ ...fk, type: 'incoming' }));
//             return { success: true, foreignKeys: [...outgoing, ...incoming] };
//         } catch (err) {
//             console.error('Error fetching foreign keys:', err);
//             return _error('foreign', err.message || 'Failed to fetch foreign keys');
//         } finally {
//             _closeConnection(connection, isMonitored);
//         }
//     });
// }
//
// function updateTableRecordHandler() {
//     ipcMain.handle('update-table-record', async (_event, config = {}) => {
//         const _errorResult = (message) => ({ success: false, message });
//
//         const { connection: connConfig, tableName, record } = config;
//
//         if (!connConfig) {
//             return _errorResult('Connection details are required');
//         }
//
//         if (!tableName) {
//             return _errorResult('Table name is required');
//         }
//
//         if (!record || Object.keys(record).length === 0) {
//             return _errorResult('Record data is required');
//         }
//
//         if (record.id == null) {
//             return _errorResult('Record must have an ID field to update');
//         }
//
//         let conn;
//
//         try {
//             conn = await mysql.createConnection({
//                 host:     connConfig.host,
//                 port:     connConfig.port || 3306,
//                 user:     connConfig.username,
//                 password: connConfig.password || '',
//                 database: connConfig.database,
//                 connectTimeout: 10000
//             });
//
//             const processed = {};
//
//             for (const key of Object.keys(record)) {
//                 let val = record[key];
//
//                 if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
//                     const date = new Date(val);
//
//                     if (!isNaN(date)) {
//                         val = date.toISOString().slice(0, 19).replace('T', ' ');
//                     }
//                 }
//
//                 processed[key] = val;
//             }
//
//             const fields = Object.keys(processed).filter(k => k !== 'id');
//             const assignments = fields.map(f => `\`${f}\` = ?`).join(', ');
//             const values      = fields.map(f => processed[f]);
//             values.push(processed.id);
//
//             const sql = `UPDATE \`${tableName}\` SET ${assignments} WHERE \`id\` = ?`;
//
//             const [result] = await conn.execute(sql, values);
//
//             return {
//                 success: true,
//                 message: 'Record updated successfully',
//                 affectedRows: result.affectedRows
//             };
//
//         } catch (err) {
//             console.error('Error updating record:', err);
//
//             return _errorResult(err.message || 'Failed to update record');
//         } finally {
//             if (conn) {
//                 try {
//                     await conn.end();
//                 } catch (e) {
//                     console.error('Error closing connection:', e);
//                 }
//             }
//         }
//     });
// }
//
// function deleteTableRecordsHandler() {
//     ipcMain.handle('delete-table-records', async (event, config) => {
//         const { connection, tableName, ids } = config;
//
//         if (!connection) {
//             throw new Error('Connection details are required');
//         }
//
//         if (!tableName) {
//             throw new Error('Table name is required');
//         }
//
//         if (!ids || !Array.isArray(ids) || ids.length === 0) {
//             throw new Error('At least one record ID is required');
//         }
//
//         try {
//             const validatedIds = ids.map(id => {
//                 if (typeof id === 'string' && !isNaN(Number(id))) {
//                     return Number(id);
//                 }
//                 return id;
//             });
//
//             const mysqlConfig = {
//                 host: connection.host,
//                 port: connection.port || 3306,
//                 user: connection.username,
//                 password: connection.password,
//                 database: connection.database
//             };
//
//             let conn;
//
//             try {
//                 conn = await mysql.createConnection(mysqlConfig);
//
//                 const [fkResult] = await conn.query(
//                     `
//         SELECT
//           TABLE_NAME as referenced_table_name,
//           COLUMN_NAME as referenced_column_name,
//           CONSTRAINT_NAME,
//           REFERENCED_TABLE_NAME as table_name,
//           REFERENCED_COLUMN_NAME as column_name
//         FROM
//           INFORMATION_SCHEMA.KEY_COLUMN_USAGE
//         WHERE
//           REFERENCED_TABLE_NAME = ?
//           AND REFERENCED_TABLE_SCHEMA = ?
//       `,
//                     [tableName, connection.database]
//                 );
//
//                 if (fkResult && fkResult.length > 0) {
//                     const [constraintResult] = await conn.query(
//                         `
//           SELECT
//             k.CONSTRAINT_NAME,
//             k.TABLE_NAME as child_table,
//             k.COLUMN_NAME as child_column,
//             k.REFERENCED_TABLE_NAME as parent_table,
//             k.REFERENCED_COLUMN_NAME as parent_column,
//             r.DELETE_RULE as on_delete
//           FROM
//             INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
//           JOIN
//             INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r
//           ON
//             k.CONSTRAINT_NAME = r.CONSTRAINT_NAME
//             AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
//           WHERE
//             k.REFERENCED_TABLE_NAME = ?
//             AND k.REFERENCED_TABLE_SCHEMA = ?
//         `,
//                         [tableName, connection.database]
//                     );
//
//                     const restrictingConstraints = constraintResult.filter(
//                         c => c.on_delete === 'RESTRICT' || c.on_delete === 'NO ACTION'
//                     );
//
//                     if (restrictingConstraints.length > 0) {
//                         const problematicIds = [];
//
//                         for (const id of validatedIds) {
//                             let hasReferences = false;
//
//                             for (const constraint of restrictingConstraints) {
//                                 const [refCheck] = await conn.query(
//                                     `
//                 SELECT 1 FROM ${conn.escapeId(constraint.child_table)}
//                 WHERE ${conn.escapeId(constraint.child_column)} = ?
//                 LIMIT 1
//               `,
//                                     [id]
//                                 );
//
//                                 if (refCheck && refCheck.length > 0) {
//                                     hasReferences = true;
//                                     break;
//                                 }
//                             }
//
//                             if (hasReferences) {
//                                 problematicIds.push(id);
//                             }
//                         }
//
//                         if (problematicIds.length > 0) {
//                             return {
//                                 success: false,
//                                 message: `Cannot delete records with IDs ${problematicIds.join(', ')} because they are referenced by other tables`,
//                                 problematicIds
//                             };
//                         }
//                     }
//                 }
//
//                 const placeholders = validatedIds.map(() => '?').join(', ');
//                 const deleteSql = `DELETE FROM ${conn.escapeId(tableName)} WHERE id IN (${placeholders})`;
//
//                 const [result] = await conn.execute(deleteSql, validatedIds);
//
//                 return {
//                     success: true,
//                     message: `${result.affectedRows} record(s) deleted successfully`,
//                     affectedRows: result.affectedRows
//                 };
//             } finally {
//                 if (conn) {
//                     await conn.end();
//                 }
//             }
//         } catch (error) {
//             console.error('Error deleting records:', error);
//
//             if (error.code === 'ER_ROW_IS_REFERENCED_2') {
//                 return {
//                     success: false,
//                     message: 'Cannot delete these records because they are referenced by other tables',
//                     constraintError: true
//                 };
//             }
//
//             return {
//                 success: false,
//                 message: error.message
//             };
//         }
//     });
// }
//
// function truncateTableHandler() {
//     ipcMain.handle('truncate-table', async (event, config) => {
//         const { connection, tableName } = config;
//
//         if (!connection) {
//             throw new Error('Connection details are required');
//         }
//
//         if (!tableName) {
//             throw new Error('Table name is required');
//         }
//
//         try {
//             const mysqlConfig = {
//                 host: connection.host,
//                 port: connection.port || 3306,
//                 user: connection.username,
//                 password: connection.password,
//                 database: connection.database
//             };
//
//             let conn;
//
//             try {
//                 conn = await mysql.createConnection(mysqlConfig);
//
//                 const [fkResult] = await conn.query(
//                     `
//         SELECT
//           TABLE_NAME as referenced_table_name,
//           COLUMN_NAME as referenced_column_name,
//           CONSTRAINT_NAME,
//           REFERENCED_TABLE_NAME as table_name,
//           REFERENCED_COLUMN_NAME as column_name
//         FROM
//           INFORMATION_SCHEMA.KEY_COLUMN_USAGE
//         WHERE
//           REFERENCED_TABLE_NAME = ?
//           AND REFERENCED_TABLE_SCHEMA = ?
//       `,
//                     [tableName, connection.database]
//                 );
//
//                 const hasForeignKeys = fkResult && fkResult.length > 0;
//
//                 await conn.beginTransaction();
//
//                 if (hasForeignKeys) {
//                     await conn.query('SET FOREIGN_KEY_CHECKS = 0');
//                 }
//
//                 await conn.query(`TRUNCATE TABLE ${conn.escapeId(tableName)}`);
//
//                 if (hasForeignKeys) {
//                     await conn.query('SET FOREIGN_KEY_CHECKS = 1');
//                 }
//
//                 await conn.commit();
//
//                 return {
//                     success: true,
//                     message: `Table ${tableName} truncated successfully`
//                 };
//             } catch (error) {
//                 if (conn) {
//                     try {
//                         await conn.rollback();
//
//                         await conn.query('SET FOREIGN_KEY_CHECKS = 1');
//                     } catch (rollbackError) {
//                         console.error('Error rolling back transaction:', rollbackError);
//                     }
//                 }
//                 throw error;
//             } finally {
//                 if (conn) {
//                     try {
//                         await conn.end();
//                     } catch (closeError) {
//                         console.error('Error closing connection:', closeError);
//                     }
//                 }
//             }
//         } catch (error) {
//             console.error('Error truncating table:', error);
//             return {
//                 success: false,
//                 message: error.message
//             };
//         }
//     });
//
// }
//
// function registerTableHandlers(store, dbMonitoringConnections) {
//     getTableStructureHandler(store, dbMonitoringConnections);
//     listTablesHandler(store, dbMonitoringConnections);
//     getTableRecordCountHandler(store);
//     getTableForeignKeysHandler();
//     updateTableRecordHandler();
//     deleteTableRecordsHandler();
//     truncateTableHandler();
// }
//
// module.exports = {
//     registerTableHandlers,
// };
