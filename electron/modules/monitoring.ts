import { BrowserWindow, ipcMain } from 'electron';
import { MysqlConnection } from '../../src/types/mysql-connection';
import { createConnection, safeEndConnection } from '../helpers/mysql';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';

interface ColumnRow extends RowDataPacket {
  column_name: string;
  COLUMN_NAME: string;
}

interface TableRow extends RowDataPacket {
  table_name: string;
  TABLE_NAME: string;
}

interface ActivityLogRow extends RowDataPacket {
  id: number;
  action_type: string;
  table_name: string;
  record_id: string;
  details: string;
  created_at: string;
}

const ACTIVITY_LOG_TABLE = 'lb_db_activity_log';

const state = {
  connections: new Map<string, PoolConnection>(),
  pollingIntervals: new Map<string, NodeJS.Timeout>(),
  lastSeenIds: new Map<string, number>(),
  windowConnectionMap: new Map<number, Set<string>>(),
  monitoredTables: new Map<string, string[]>(),
  monitoredDatabases: new Map<string, string>(),
};

const SQL = {
  CREATE_ACTIVITY_LOG: `
    CREATE TABLE IF NOT EXISTS ${ACTIVITY_LOG_TABLE} (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      action_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      record_id VARCHAR(255),
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (action_type),
      INDEX (table_name),
      INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  DROP_ACTIVITY_LOG: `DROP TABLE IF EXISTS ${ACTIVITY_LOG_TABLE};`,
  GET_TABLES: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ? 
    AND table_name != ?
  `,
  CHECK_PRIMARY_KEY: `
    SELECT column_name
    FROM information_schema.key_column_usage
    WHERE table_schema = ?
    AND table_name = ?
    AND constraint_name = 'PRIMARY'
    LIMIT 1
  `,
  GET_FIRST_COLUMN: `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ?
    AND table_name = ?
    ORDER BY ordinal_position
    LIMIT 1
  `,
  GET_COLUMNS: `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ?
    AND table_name = ?
  `,
  FIND_TRIGGERS_BY_PREFIX: `
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE trigger_schema = ? 
    AND trigger_name LIKE 'trg_%'
  `,
  FIND_TRIGGERS_BY_REFERENCE: `
    SELECT TRIGGER_NAME 
    FROM information_schema.TRIGGERS 
    WHERE TRIGGER_SCHEMA = ? 
    AND ACTION_STATEMENT LIKE ?
  `,
  GET_RECENT_ACTIVITY: `
    SELECT * FROM ${ACTIVITY_LOG_TABLE}
    ORDER BY id DESC
    LIMIT ?
  `,
  GET_NEW_ACTIVITY: `
    SELECT * FROM ${ACTIVITY_LOG_TABLE}
    WHERE id > ?
    ORDER BY id ASC
  `,
  TRUNCATE_ACTIVITY_LOG: `TRUNCATE TABLE ${ACTIVITY_LOG_TABLE}`,
  CHECK_TABLE_EXISTS: `
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = ? 
    AND table_name = ?
  `,
  GET_MAX_ID: `SELECT MAX(id) as maxId FROM ${ACTIVITY_LOG_TABLE}`,
};

async function dropTableTriggers(connection: PoolConnection, tableName: string) {
  const triggers = [
    `trg_${tableName}_insert`,
    `trg_${tableName}_update`,
    `trg_${tableName}_delete`,
  ];

  for (const trigger of triggers) {
    try {
      await connection.query(`DROP TRIGGER IF EXISTS ${trigger}`);
    } catch (error) {
      console.error(`Error dropping trigger ${trigger}`);
    }
  }
}

async function findAndDropAllTriggers(connection: PoolConnection, database: string) {
  try {
    const [triggersResult] = await connection.query(SQL.FIND_TRIGGERS_BY_PREFIX, [database]);

    if (triggersResult && Array.isArray(triggersResult)) {
      for (const row of triggersResult as any[]) {
        const triggerName = row.trigger_name || row.TRIGGER_NAME;
        await connection.query(`DROP TRIGGER IF EXISTS ${triggerName}`);
      }
    }

    try {
      const [refTriggers] = await connection.query(SQL.FIND_TRIGGERS_BY_REFERENCE, [
        database,
        `%${ACTIVITY_LOG_TABLE}%`,
      ]);

      if (refTriggers && Array.isArray(refTriggers)) {
        for (const row of refTriggers as any[]) {
          const triggerName = row.TRIGGER_NAME || row.trigger_name;
          await connection.query(`DROP TRIGGER IF EXISTS ${triggerName}`);
        }
      }
    } catch (error) {
      console.error(`Error dropping triggers referencing ${ACTIVITY_LOG_TABLE}`);
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function createTableTriggers(
  connection: PoolConnection,
  database: string,
  tableName: string,
  primaryKeyColumn: string
) {
  await dropTableTriggers(connection, tableName);

  let idColumn = primaryKeyColumn;

  if (!idColumn) {
    try {
      const [firstColumnResult] = await connection.query(SQL.GET_FIRST_COLUMN, [
        database,
        tableName,
      ]);

      if (firstColumnResult && Array.isArray(firstColumnResult) && firstColumnResult.length > 0) {
        const firstColumn = firstColumnResult[0] as ColumnRow;
        idColumn = firstColumn.column_name || firstColumn.COLUMN_NAME;
      }
    } catch (error) {
      console.error(`Error getting first column for ${tableName}`);
    }
  }

  const [allColumnsResult] = await connection.query(SQL.GET_COLUMNS, [database, tableName]);
  const allColumns = allColumnsResult as ColumnRow[];
  const existingColumns = new Set(
    Array.isArray(allColumns)
      ? allColumns.map((col: ColumnRow) => col.column_name || col.COLUMN_NAME)
      : []
  );

  if (idColumn && !existingColumns.has(idColumn)) {
    idColumn = '';
  }

  const recordIdExpr = idColumn ? `IFNULL(NEW.${idColumn}, '')` : `'no-id'`;
  const oldRecordIdExpr = idColumn ? `IFNULL(OLD.${idColumn}, '')` : `'no-id'`;
  const columnsArray = Array.from(existingColumns);

  let insertColumns = '';
  let deleteColumns = '';
  for (let i = 0; i < columnsArray.length; i++) {
    if (i > 0) {
      insertColumns += ', ';
      deleteColumns += ', ';
    }
    const col = columnsArray[i];
    insertColumns += `'${col}', CAST(IFNULL(NEW.${col}, 'null') AS CHAR)`;
    deleteColumns += `'${col}', CAST(IFNULL(OLD.${col}, 'null') AS CHAR)`;
  }

  const updateTriggerBody = columnsArray
    .map(col => {
      return `
    IF NEW.${col} <> OLD.${col} OR (NEW.${col} IS NULL AND OLD.${col} IS NOT NULL) OR (NEW.${col} IS NOT NULL AND OLD.${col} IS NULL) THEN
      SET @changes = JSON_MERGE_PATCH(@changes, JSON_OBJECT(
        '${col}', JSON_OBJECT(
          'old', CAST(IFNULL(OLD.${col}, 'null') AS CHAR),
          'new', CAST(IFNULL(NEW.${col}, 'null') AS CHAR)
        )
      ));
    END IF;`;
    })
    .join('\n');

  const insertTriggerSQL = `
    CREATE TRIGGER trg_${tableName}_insert AFTER INSERT ON ${connection.escapeId(tableName)}
    FOR EACH ROW
    BEGIN
      INSERT INTO ${ACTIVITY_LOG_TABLE} (action_type, table_name, record_id, details)
      VALUES ('INSERT', '${tableName}', ${recordIdExpr}, JSON_OBJECT(${insertColumns}));
    END;
  `;

  const updateTriggerSQL = `
    CREATE TRIGGER trg_${tableName}_update AFTER UPDATE ON ${connection.escapeId(tableName)}
    FOR EACH ROW
    BEGIN
      SET @changes = JSON_OBJECT();
      ${updateTriggerBody}
      INSERT INTO ${ACTIVITY_LOG_TABLE} (action_type, table_name, record_id, details)
      VALUES ('UPDATE', '${tableName}', ${recordIdExpr}, @changes);
    END;
  `;

  const deleteTriggerSQL = `
    CREATE TRIGGER trg_${tableName}_delete AFTER DELETE ON ${connection.escapeId(tableName)}
    FOR EACH ROW
    BEGIN
      INSERT INTO ${ACTIVITY_LOG_TABLE} (action_type, table_name, record_id, details)
      VALUES ('DELETE', '${tableName}', ${oldRecordIdExpr}, JSON_OBJECT(${deleteColumns}));
    END;
  `;

  try {
    await connection.query(insertTriggerSQL);
    await connection.query(updateTriggerSQL);
    await connection.query(deleteTriggerSQL);

    if (!state.monitoredTables.has(connection.config.database)) {
      state.monitoredTables.set(connection.config.database, []);
    }

    const tables = state.monitoredTables.get(connection.config.database);
    if (tables && !tables.includes(tableName)) {
      tables.push(tableName);
    }

    return true;
  } catch (error) {
    console.error(`Error creating triggers for ${tableName}`);
    return false;
  }
}

async function dropMonitoringTable(connection: PoolConnection) {
  try {
    await connection.query(SQL.DROP_ACTIVITY_LOG);
    return true;
  } catch (error) {
    return false;
  }
}

async function clearActivityLog(connection: PoolConnection) {
  try {
    await connection.query(SQL.TRUNCATE_ACTIVITY_LOG);
    return true;
  } catch (error) {
    return false;
  }
}

function startPolling(connectionId: string, connection: PoolConnection, mainWindow: BrowserWindow) {
  if (state.pollingIntervals.has(connectionId)) {
    clearInterval(state.pollingIntervals.get(connectionId));
  }

  const interval = setInterval(async () => {
    try {
      const [tableExists] = await connection.query(SQL.CHECK_TABLE_EXISTS, [
        connection.config.database,
        ACTIVITY_LOG_TABLE,
      ]);

      if (!(Array.isArray(tableExists) && tableExists.length > 0)) {
        await connection.query(SQL.CREATE_ACTIVITY_LOG);
        state.lastSeenIds.set(connectionId, 0);
        return;
      }

      if (!state.lastSeenIds.has(connectionId)) {
        const [latest] = await connection.query(SQL.GET_MAX_ID);
        const maxId = (latest as RowDataPacket[])[0]?.maxId || 0;
        state.lastSeenIds.set(connectionId, maxId);
        return;
      }

      const lastId = state.lastSeenIds.get(connectionId);
      const [newActivities] = await connection.query(SQL.GET_NEW_ACTIVITY, [lastId]);

      if (Array.isArray(newActivities) && newActivities.length > 0) {
        state.lastSeenIds.set(
          connectionId,
          (newActivities as ActivityLogRow[])[newActivities.length - 1].id
        );

        for (const activity of newActivities as ActivityLogRow[]) {
          mainWindow.webContents.send(`db-operation-${connectionId}`, activity);
        }
      }
    } catch (error) {
      console.error(`Error polling for new activities: ${error}`);
      state.lastSeenIds.set(connectionId, 0);
      stopPolling(connectionId);
    }
  }, 2000);

  state.pollingIntervals.set(connectionId, interval);
}

function stopPolling(connectionId: string) {
  if (state.pollingIntervals.has(connectionId)) {
    clearInterval(state.pollingIntervals.get(connectionId));
    state.pollingIntervals.delete(connectionId);
  }
  state.lastSeenIds.delete(connectionId);
}

async function cleanupMonitoring(connectionId: string) {
  if (state.connections.has(connectionId)) {
    try {
      const connection = state.connections.get(connectionId);
      const database = state.monitoredDatabases.get(connectionId);

      if (database) {
        await findAndDropAllTriggers(connection, database);

        const tables = state.monitoredTables.get(database) || [];
        for (const tableName of tables) {
          await dropTableTriggers(connection, tableName);
        }
        state.monitoredTables.delete(database);

        await dropMonitoringTable(connection);
      }

      await safeEndConnection(connection);

      state.connections.delete(connectionId);
      stopPolling(connectionId);
      state.monitoredDatabases.delete(connectionId);

      const windowEntries = Array.from(state.windowConnectionMap.entries());
      for (const [_, connections] of windowEntries) {
        if (connections.has(connectionId)) {
          connections.delete(connectionId);
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
  return true;
}

async function closeAllWindowConnections(windowId: number) {
  const connectionIds = state.windowConnectionMap.get(windowId);
  if (!connectionIds || connectionIds.size === 0) return;

  for (const connectionId of Array.from(connectionIds)) {
    await cleanupMonitoring(connectionId);
  }
  state.windowConnectionMap.delete(windowId);
}

function registerConnectionWithWindow(windowId: number, connectionId: string) {
  if (!state.windowConnectionMap.has(windowId)) {
    state.windowConnectionMap.set(windowId, new Set<string>());
  }
  state.windowConnectionMap.get(windowId).add(connectionId);
}

export function registerMonitoringHandlers(mainWindow: BrowserWindow) {
  const windowId = mainWindow.id;

  mainWindow.on('closed', async () => {
    await closeAllWindowConnections(windowId);
  });

  mainWindow.webContents.on('did-start-navigation', async (_, url) => {
    const currentURL = mainWindow.webContents.getURL();
    if (url === currentURL) {
      await closeAllWindowConnections(windowId);
    }
  });

  ipcMain.handle(
    'start-live-db-updates',
    async (
      _,
      config: { connectionId: string; dbConnection: MysqlConnection; clearHistory: boolean }
    ) => {
      const { connectionId, dbConnection, clearHistory = false } = config;

      if (state.connections.has(connectionId)) {
        await cleanupMonitoring(connectionId);
      }

      try {
        const connection = await createConnection(dbConnection);
        state.connections.set(connectionId, connection);
        state.monitoredDatabases.set(connectionId, dbConnection.database);
        registerConnectionWithWindow(mainWindow.id, connectionId);

        await connection.query(SQL.CREATE_ACTIVITY_LOG);
        if (clearHistory) {
          await clearActivityLog(connection);
        }

        const [tablesResult] = await connection.query(SQL.GET_TABLES, [
          dbConnection.database,
          ACTIVITY_LOG_TABLE,
        ]);

        if (Array.isArray(tablesResult)) {
          for (const table of tablesResult as TableRow[]) {
            const tableName = table.table_name || table.TABLE_NAME;
            const [primaryKeyResult] = await connection.query(SQL.CHECK_PRIMARY_KEY, [
              dbConnection.database,
              tableName,
            ]);

            const primaryKeyColumn =
              Array.isArray(primaryKeyResult) && primaryKeyResult.length > 0
                ? (primaryKeyResult[0] as ColumnRow).column_name ||
                  (primaryKeyResult[0] as ColumnRow).COLUMN_NAME
                : '';

            await createTableTriggers(
              connection,
              dbConnection.database,
              tableName,
              primaryKeyColumn
            );
          }
        }

        try {
          const [tableExists] = await connection.query(SQL.CHECK_TABLE_EXISTS, [
            dbConnection.database,
            ACTIVITY_LOG_TABLE,
          ]);

          if (Array.isArray(tableExists) && tableExists.length > 0) {
            const [recentActivities] = await connection.query(SQL.GET_RECENT_ACTIVITY, [50]);

            if (Array.isArray(recentActivities) && recentActivities.length > 0) {
              for (const activity of recentActivities as ActivityLogRow[]) {
                mainWindow.webContents.send(`db-operation-${connectionId}`, activity);
              }
              state.lastSeenIds.set(connectionId, (recentActivities as ActivityLogRow[])[0].id);
            } else {
              state.lastSeenIds.set(connectionId, 0);
            }
          } else {
            state.lastSeenIds.set(connectionId, 0);
          }
        } catch (error) {
          state.lastSeenIds.set(connectionId, 0);
        }

        startPolling(connectionId, connection, mainWindow);
        return { success: true, message: 'Monitoring started successfully' };
      } catch (error: any) {
        return { success: false, message: error.message || 'Failed to start monitoring' };
      }
    }
  );

  ipcMain.handle('stop-db-monitoring', async (_, connectionId: string) => {
    try {
      await cleanupMonitoring(connectionId);
      return { success: true, message: 'Monitoring stopped' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to stop monitoring' };
    }
  });

  ipcMain.handle('clear-db-history', async (_, connectionId: string) => {
    try {
      if (!state.connections.has(connectionId)) {
        return { success: false, message: 'No active monitoring connection found' };
      }

      const connection = state.connections.get(connectionId);

      try {
        await connection.query('SELECT 1');
      } catch (pingError) {
        state.connections.delete(connectionId);
        return {
          success: false,
          message: 'Connection lost. Please restart monitoring to clear history.',
          connectionLost: true,
        };
      }

      const success = await clearActivityLog(connection);
      if (success) {
        state.lastSeenIds.set(connectionId, 0);
        mainWindow.webContents.send(`db-operation-clear-${connectionId}`);
        return { success: true, message: 'Activity history cleared' };
      } else {
        return { success: false, message: 'Failed to clear activity history' };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to clear history' };
    }
  });
}
