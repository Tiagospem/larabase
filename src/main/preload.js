const { contextBridge, ipcRenderer } = require("electron");

const safeIpcRenderer = {
  invoke: async (channel, ...args) => {
    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      throw error;
    }
  }
};

try {
  contextBridge.exposeInMainWorld("api", {
    selectSqlDumpFile: () => safeIpcRenderer.invoke("select-sql-dump-file"),
    cancelDatabaseRestore: (connectionId) => safeIpcRenderer.invoke("cancel-database-restore", connectionId),
    getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),
    extractTablesFromSql: (filePath) => safeIpcRenderer.invoke("extract-tables-from-sql", filePath),
    updateConnectionDatabase: (connectionId, newDatabase) => safeIpcRenderer.invoke("update-connection-database", connectionId, newDatabase),
    simpleDatabaseRestore: (config) => safeIpcRenderer.invoke("simple-database-restore-unified", config),
    testMySQLConnection: (config) => safeIpcRenderer.invoke("test-mysql-connection", config),
    selectDirectory: () => safeIpcRenderer.invoke("select-directory"),
    validateLaravelProject: (projectPath) => safeIpcRenderer.invoke("validate-laravel-project", projectPath),
    readEnvFile: (projectPath) => safeIpcRenderer.invoke("read-env-file", projectPath),
    getConnections: () => safeIpcRenderer.invoke("get-connections"),
    listTables: (config) => safeIpcRenderer.invoke("list-tables", config),
    findModelsForTables: (config) => safeIpcRenderer.invoke("find-models-for-tables", config),
    getTableRecordCount: (config) => safeIpcRenderer.invoke("get-table-record-count", config),
    getTableStructure: (config) => safeIpcRenderer.invoke("get-table-structure", config),
    getTableForeignKeys: (config) => safeIpcRenderer.invoke("get-table-foreign-keys", config),
    findTableMigrations: (config) => safeIpcRenderer.invoke("find-table-migrations", config),
    findLaravelCommands: (projectPath) => safeIpcRenderer.invoke("find-laravel-commands", projectPath),
    updateRecord: (config) => safeIpcRenderer.invoke("update-table-record", config),
    deleteRecords: (config) => safeIpcRenderer.invoke("delete-table-records", config),
    truncateTable: (config) => safeIpcRenderer.invoke("truncate-table", config),
    listDatabases: (config) => safeIpcRenderer.invoke("list-databases", config),
    dropDatabase: (config) => safeIpcRenderer.invoke("drop-database", config),
    dropTables: (config) => safeIpcRenderer.invoke("drop-tables", config),
    getTableData: (config) => safeIpcRenderer.invoke("get-table-data", config),
    getFilteredTableData: (config) => safeIpcRenderer.invoke("get-filtered-table-data", config),
    checkRedisStatus: (config) => safeIpcRenderer.invoke("check-redis-status", config),
    getRedisDatabases: (config) => safeIpcRenderer.invoke("get-redis-databases", config),
    clearRedisDatabase: (config) => safeIpcRenderer.invoke("clear-redis-database", config),
    clearAllRedisDatabases: (config) => safeIpcRenderer.invoke("clear-all-redis-databases", config),
    getRedisKeys: (config) => safeIpcRenderer.invoke("get-redis-keys", config),
    getRedisKeyValue: (config) => safeIpcRenderer.invoke("get-redis-key-value", config),
    compareProjectDatabase: (config) => safeIpcRenderer.invoke("compare-project-database", config),

    saveConnections: (connections) => safeIpcRenderer.invoke("save-connections", connections),
    getOpenTabs: () => safeIpcRenderer.invoke("get-open-tabs"),
    saveOpenTabs: (tabs) => safeIpcRenderer.invoke("save-open-tabs", tabs),

    openFile: (filePath) => safeIpcRenderer.invoke("openFile", filePath),
    getDatabaseRelationships: (connectionId) =>
      safeIpcRenderer.invoke("get-database-relationships", {
        connectionId
      }),
    readModelFile: (filePath) => safeIpcRenderer.invoke("read-model-file", filePath),
    listFiles: (dirPath) => safeIpcRenderer.invoke("list-files", dirPath),
    getProjectLogs: (config) => safeIpcRenderer.invoke("get-project-logs", config),
    deleteProjectLog: (logId) => safeIpcRenderer.invoke("delete-project-log", logId),
    clearAllProjectLogs: (config) => safeIpcRenderer.invoke("clear-all-project-logs", config),
    runArtisanCommand: (config) => safeIpcRenderer.invoke("run-artisan-command", config),
    listenCommandOutput: (commandId, callback) => {
      const channel = `command-output-${commandId}`;
      ipcRenderer.on(channel, (_, data) => callback(data));
      return channel;
    },
    stopCommandListener: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    },
    getMigrationStatus: (config) => safeIpcRenderer.invoke("get-migration-status", config),
    getSettings: () => safeIpcRenderer.invoke("get-settings"),
    saveSettings: (settings) => safeIpcRenderer.invoke("save-settings", settings),
    monitorDatabaseOperations: (connectionId, callback, clearHistory = false) => {
      try {
        const channel = `db-operation-${connectionId}`;

        ipcRenderer.removeAllListeners(channel);

        ipcRenderer.on(channel, (_, data) => {
          callback(data);
        });

        return ipcRenderer.invoke("start-db-monitoring", connectionId, clearHistory).then((result) => {
          return channel;
        });
      } catch (error) {
        console.error("Error in monitorDatabaseOperations:", error);
        throw error;
      }
    },
    stopMonitoringDatabaseOperations: (channel) => {
      ipcRenderer.removeAllListeners(channel);

      const connectionId = channel.replace("db-operation-", "");

      return ipcRenderer
        .invoke("stop-db-monitoring", connectionId)
        .then((result) => {
          return result;
        })
        .catch((err) => {
          console.error("Error stopping monitoring:", err);
          throw err;
        });
    },
    monitorDatabaseChanges: (connectionDetails, callback) => {
      const connectionId = connectionDetails.id || connectionDetails.connectionId;
      if (!connectionId) return Promise.reject("Connection ID is required");

      const channel = `db-activity-${connectionId}`;

      ipcRenderer.on(channel, (event, data) => callback(data));

      return ipcRenderer.invoke("monitor-database-changes", connectionDetails).then((result) => {
        if (result.success) {
          return {
            success: true,
            channelId: channel,
            connectionId: connectionId,
            activities: result.activities || []
          };
        } else {
          throw new Error(result.message || "Failed to start monitoring");
        }
      });
    },
    getDatabaseChanges: (connectionId, lastId = 0) => {
      if (!connectionId) return Promise.reject("Connection ID is required");
      return ipcRenderer.invoke("get-database-changes", connectionId, lastId);
    },
    stopTriggerMonitoring: (connectionId) => {
      if (!connectionId) return Promise.reject("Connection ID is required");

      const channel = `db-activity-${connectionId}`;
      ipcRenderer.removeAllListeners(channel);

      return ipcRenderer.invoke("stop-trigger-monitoring", connectionId);
    },
    executeSQLQuery: (config) => safeIpcRenderer.invoke("execute-sql-query", config),
    getPluralizeFunction: () => safeIpcRenderer.invoke("get-pluralize-function"),
    getSingularForm: (word) => safeIpcRenderer.invoke("get-singular-form", word),
    getPluralForm: (word) => safeIpcRenderer.invoke("get-plural-form", word),
    updateEnvDatabase: (projectPath, database) => safeIpcRenderer.invoke("update-env-database", projectPath, database),
    removeConnection: (connectionId) => safeIpcRenderer.invoke("remove-connection", connectionId),
    startDatabaseRestore: (config) => {
      const channelId = `restore-progress-${Date.now()}`;

      return new Promise((resolve, reject) => {
        const initHandler = (event, initialResponse) => {
          ipcRenderer.removeListener(`${channelId}-init`, initHandler);

          if (initialResponse.success) {
            resolve({
              success: true,
              channelId,
              message: initialResponse.message
            });
          } else {
            reject(new Error(initialResponse.message || "Failed to start restoration"));
          }
        };

        ipcRenderer.once(`${channelId}-init`, initHandler);

        ipcRenderer.send("start-database-restore", {
          ...config,
          channelId
        });
      });
    },
    listenRestoreProgress: (channelId, listener) => {
      if (channelId && listener) {
        ipcRenderer.on(channelId, (_, data) => {
          if (listener) listener(data);
        });
      }
      return true;
    },
    stopRestoreListener: (channelId) => {
      if (channelId) {
        ipcRenderer.removeAllListeners(channelId);
      }
    },
    send: (channel, data) => {
      if (typeof channel !== "string") return;

      const allowedSendChannels = ["start-database-restore"];

      if (allowedSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    setAppBadge: (count) => safeIpcRenderer.invoke("set-app-badge", count),
    checkForUpdates: () => safeIpcRenderer.invoke("check-for-updates"),
    downloadUpdate: () => safeIpcRenderer.invoke("download-update"),
    quitAndInstall: () => safeIpcRenderer.invoke("quit-and-install"),
    getCurrentVersion: () => safeIpcRenderer.invoke("get-current-version"),
    onUpdateStatus: (callback) => {
      const updateStatusListener = (_, data) => callback(data);
      ipcRenderer.on("update-status", updateStatusListener);
      return () => {
        ipcRenderer.removeListener("update-status", updateStatusListener);
      };
    }
  });
} catch (error) {
  console.error(error);
}
