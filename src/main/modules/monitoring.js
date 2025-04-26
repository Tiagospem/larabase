const { ipcMain } = require("electron");
const mysql = require("mysql2/promise");
const { getMainWindow } = require("../modules/window");

function startActivityPolling(connectionId, connection, activityLogTable, lastId, dbMonitoringConnections) {
  connection._lastActivityId = lastId;
  connection._pollingInterval = setInterval(async () => {
    if (!dbMonitoringConnections.has(connectionId)) {
      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }
      return;
    }

    try {
      const [activities] = await connection.query(
        `SELECT 
          id,
          action_type as type,
          table_name as \`table\`,
          record_id as recordId,
          details,
          created_at as timestamp
        FROM ${activityLogTable}
        WHERE id > ?
        ORDER BY id ASC
        LIMIT 50`,
        [connection._lastActivityId]
      );

      if (activities.length > 0) {
        connection._lastActivityId = activities[activities.length - 1].id;

        const mainWindow = getMainWindow();
        if (mainWindow) {
          activities.forEach((activity) => {
            mainWindow.webContents.send(`db-operation-${connectionId}`, {
              ...activity,
              timestamp: activity.timestamp || new Date().toISOString(),
              recordId: activity.recordId || "unknown",
              details: activity.details || "No details available"
            });
          });
        } else {
          console.error("No mainWindow available to send db operations to");
        }
      }
    } catch (error) {
      console.error("Error polling activities:", error);
    }
  }, 1000);

  connection._pollingInterval._onTimeout();
}

async function clearMonitoringConnections(dbMonitoringConnections, dbActivityConnections) {
  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      const activityLogTable = "lb_db_activity_log";
      await connection.query(`TRUNCATE TABLE ${activityLogTable}`);

      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }

      await connection.end();
    } catch (error) {
      console.error(`Error closing monitoring connection for ${connectionId}:`, error);
    }
  }

  dbMonitoringConnections.clear();

  for (const [connectionId, connectionData] of dbActivityConnections.entries()) {
    try {
      if (connectionData.connection) {
        await connectionData.connection.end();
      }

      if (connectionData.triggerConnection) {
        await connectionData.triggerConnection.end();
      }
    } catch (error) {
      console.error(`Error closing trigger-based monitoring connections for ${connectionId}:`, error);
    }
  }

  dbActivityConnections.clear();
}

function registerMonitoringHandlers(store, dbMonitoringConnections) {
  ipcMain.handle("start-db-monitoring", async (event, connectionId, callbackFn, clearHistory = false) => {
    const activityLogTable = "lb_db_activity_log";

    if (!connectionId) {
      console.error("Invalid connectionId or not provided");
      return { success: false, message: "Invalid connection ID" };
    }

    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(`db-operation-${connectionId}`, {
        timestamp: new Date().toISOString(),
        type: "INFO",
        table: "system",
        message: "Initializing database monitoring..."
      });
    } else {
      console.error("No mainWindow available for IPC communication");
    }

    if (dbMonitoringConnections.has(connectionId)) {
      try {
        const existingConnection = dbMonitoringConnections.get(connectionId);
        if (existingConnection) {
          await existingConnection.end();
        }
        dbMonitoringConnections.delete(connectionId);
      } catch (err) {
        console.error(`Error closing previous connection:`, err);
      }
    }

    const connections = store.get("connections") || [];
    const connection = connections.find((conn) => conn.id === connectionId);

    if (!connection) {
      console.error(`Connection ID ${connectionId} not found`);
      return { success: false, message: "Connection not found" };
    }

    if (!connection.host || !connection.port || !connection.username || !connection.database) {
      return { success: false, message: "Incomplete connection information" };
    }

    try {
      const dbConnection = await mysql.createConnection({
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: connection.password || "",
        database: connection.database,
        dateStrings: true,
        multipleStatements: true
      });

      if (clearHistory) {
        try {
          await dbConnection.query(`TRUNCATE TABLE ${activityLogTable}`);

          const currentWindow = getMainWindow();
          if (currentWindow) {
            currentWindow.webContents.send(`db-operation-${connectionId}`, {
              timestamp: new Date().toISOString(),
              type: "INFO",
              table: "system",
              message: "Activity history cleared successfully"
            });
          }
        } catch (clearError) {
          console.error(`Error clearing activity log:`, clearError);
        }
      }

      await dbConnection.query("SELECT 1");

      await dbConnection.query(`
        CREATE TABLE IF NOT EXISTS ${activityLogTable} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          action_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
          table_name VARCHAR(255) NOT NULL,
          record_id VARCHAR(255),
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_action_type (action_type),
          INDEX idx_table_name (table_name),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB;
      `);

      const [tables] = await dbConnection.query(
        `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? 
          AND table_name != '${activityLogTable}'
          AND table_type = 'BASE TABLE'
      `,
        [connection.database]
      );

      let triggersCreated = 0;
      for (const table of tables) {
        const tableName = table.table_name || table.TABLE_NAME;
        try {
          await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_insert`);
          await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_update`);
          await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_delete`);

          const [columns] = await dbConnection.query(
            `
            SELECT COLUMN_NAME, COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `,
            [connection.database, tableName]
          );

          const columnNames = columns.map((col) => col.COLUMN_NAME || col.column_name);
          const primaryKeyColumn = columns.find((col) => col.COLUMN_KEY === "PRI" || ["id", "uuid", "key"].includes(col.COLUMN_NAME.toLowerCase()));

          let idRef, oldIdRef;
          if (primaryKeyColumn) {
            const idColumn = primaryKeyColumn.COLUMN_NAME;
            idRef = `COALESCE(NEW.\`${idColumn}\`, 'unknown')`;
            oldIdRef = `COALESCE(OLD.\`${idColumn}\`, 'unknown')`;
          } else if (columnNames.length > 0) {
            idRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(NEW.\`${columnNames[0]}\`, 'null'))`;
            oldIdRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(OLD.\`${columnNames[0]}\`, 'null'))`;
          } else {
            idRef = "'unknown'";
            oldIdRef = "'unknown'";
          }

          const previewColumns = columnNames.slice(0, 5);
          const insertPreview = previewColumns.map((col) => `'${col}: ', COALESCE(NEW.\`${col}\`, 'null')`).join(", ' | ', ");

          const updatePreviewParts = previewColumns.map(
            (col) => `IF(
              (OLD.\`${col}\` IS NULL AND NEW.\`${col}\` IS NOT NULL) OR 
              (OLD.\`${col}\` IS NOT NULL AND NEW.\`${col}\` IS NULL) OR 
              (OLD.\`${col}\` <> NEW.\`${col}\`), 
              CONCAT('${col}: ', COALESCE(OLD.\`${col}\`, 'null'), ' → ', COALESCE(NEW.\`${col}\`, 'null')), 
              NULL
            )`
          );
          const updatePreview = `CONCAT_WS(', ', ${updatePreviewParts.join(", ")})`;
          const deletePreview = previewColumns.map((col) => `'${col}: ', COALESCE(OLD.\`${col}\`, 'null')`).join(", ' | ', ");

          await dbConnection.query(`
            CREATE TRIGGER ${tableName}_after_insert
            AFTER INSERT ON ${tableName}
            FOR EACH ROW
            BEGIN
              SET @details = CONCAT('New record: ', ${insertPreview});
              
              INSERT INTO ${activityLogTable} (
                action_type, table_name, record_id, details
              )
              VALUES (
                'INSERT', '${tableName}', ${idRef}, @details
              );
            END;
          `);

          await dbConnection.query(`
            CREATE TRIGGER ${tableName}_after_update
            AFTER UPDATE ON ${tableName}
            FOR EACH ROW
            BEGIN
              SET @changes = ${updatePreview};
              
              IF @changes IS NOT NULL AND @changes != '' THEN
                INSERT INTO ${activityLogTable} (
                  action_type, table_name, record_id, details
                )
                VALUES (
                  'UPDATE', '${tableName}', ${idRef}, CONCAT('Changed: ', @changes)
                );
              END IF;
            END;
          `);

          await dbConnection.query(`
            CREATE TRIGGER ${tableName}_after_delete
            AFTER DELETE ON ${tableName}
            FOR EACH ROW
            BEGIN
              SET @details = CONCAT('Deleted: ', ${deletePreview});
              
              INSERT INTO ${activityLogTable} (
                action_type, table_name, record_id, details
              )
              VALUES (
                'DELETE', '${tableName}', ${oldIdRef}, @details
              );
            END;
          `);

          triggersCreated += 3;
        } catch (triggerError) {
          console.error(`Error creating triggers for table ${tableName}:`, triggerError);
        }
      }

      const [initialActivities] = await dbConnection.query(`
        SELECT 
          id,
          action_type as type,
          table_name as \`table\`,
          record_id as recordId,
          details,
          created_at as timestamp
        FROM ${activityLogTable}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      dbMonitoringConnections.set(connectionId, dbConnection);

      const currentWindow = getMainWindow();
      if (currentWindow) {
        initialActivities.forEach((activity) => {
          currentWindow.webContents.send(`db-operation-${connectionId}`, activity);
        });

        currentWindow.webContents.send(`db-operation-${connectionId}`, {
          timestamp: Date.now(),
          type: "INFO",
          table: "system",
          message: "Database monitoring started successfully"
        });
      }

      const lastId = initialActivities.length > 0 ? initialActivities[0].id : 0;
      startActivityPolling(connectionId, dbConnection, activityLogTable, lastId, dbMonitoringConnections);

      return { success: true, message: "Monitoring started successfully" };
    } catch (error) {
      console.error("Error setting up database monitoring:", error);
      return {
        success: false,
        message: error.message || "Unknown error setting up monitoring"
      };
    }
  });

  ipcMain.handle("stop-db-monitoring", async (event, connectionId, clearDataOnStop = false) => {
    try {
      const connection = dbMonitoringConnections.get(connectionId);

      if (!connection) {
        return {
          success: false,
          message: "Not monitoring this connection"
        };
      }

      if (clearDataOnStop && connection) {
        try {
          const activityLogTable = "lb_db_activity_log";
          await connection.query(`TRUNCATE TABLE ${activityLogTable}`);

          const currentWindow = getMainWindow();
          if (currentWindow) {
            currentWindow.webContents.send(`db-operation-${connectionId}`, {
              timestamp: new Date().toISOString(),
              type: "INFO",
              table: "system",
              message: "Data cleared on monitoring stop"
            });
          }
        } catch (clearError) {
          console.error(`Error clearing activity log on stop:`, clearError);
        }
      }

      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }

      await connection.end();

      dbMonitoringConnections.delete(connectionId);

      return { success: true, message: "Monitoring stopped" };
    } catch (error) {
      console.error("Error stopping database monitoring:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = {
  registerMonitoringHandlers,
  clearMonitoringConnections
};
