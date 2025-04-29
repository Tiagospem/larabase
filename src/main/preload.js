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

const listenerManager = {
  listeners: new Map(),
  dynamicChannels: new Set(),
  activeMonitoringConnections: new Set(),

  historicalCounts: [],
  maxHistoryLength: 10,

  addListener: (channel, listener, isDynamic = false) => {
    if (!listenerManager.listeners.has(channel)) {
      listenerManager.listeners.set(channel, []);
    }

    listenerManager.listeners.get(channel).push(listener);

    if (isDynamic) {
      listenerManager.dynamicChannels.add(channel);
    }

    return listener;
  },

  removeListener: (channel, listener) => {
    if (!listenerManager.listeners.has(channel)) return;

    const listeners = listenerManager.listeners.get(channel);
    const idx = listeners.indexOf(listener);

    if (idx > -1) {
      listeners.splice(idx, 1);

      if (listeners.length === 0) {
        listenerManager.listeners.delete(channel);
        listenerManager.dynamicChannels.delete(channel);
      }
    }
  },

  removeAllListeners: (channel) => {
    if (!channel) {
      for (const [ch, listeners] of listenerManager.listeners.entries()) {
        for (const listener of listeners) {
          ipcRenderer.removeListener(ch, listener);
        }
      }
      listenerManager.listeners.clear();
      listenerManager.dynamicChannels.clear();
      listenerManager.activeMonitoringConnections.clear();
      return;
    }

    if (listenerManager.listeners.has(channel)) {
      const listeners = listenerManager.listeners.get(channel);
      for (const listener of listeners) {
        ipcRenderer.removeListener(channel, listener);
      }
      listenerManager.listeners.delete(channel);
      listenerManager.dynamicChannels.delete(channel);

      if (channel.startsWith("db-operation-")) {
        const connectionId = channel.replace("db-operation-", "");
        listenerManager.activeMonitoringConnections.delete(connectionId);
      }
    }
  },

  addMonitoringConnection: (connectionId) => {
    listenerManager.activeMonitoringConnections.add(connectionId);
  },

  removeMonitoringConnection: (connectionId) => {
    listenerManager.activeMonitoringConnections.delete(connectionId);
  },

  getStats: () => {
    const channelBreakdown = {};
    for (const [channel, listeners] of listenerManager.listeners.entries()) {
      channelBreakdown[channel] = listeners.length;
    }

    const eventEmitterStats = [];

    try {
      if (ipcRenderer && ipcRenderer.eventNames) {
        const events = ipcRenderer.eventNames();
        events.forEach((eventName) => {
          const count = ipcRenderer.listenerCount(eventName);
          eventEmitterStats.push({
            name: `ipcRenderer:${eventName}`,
            count
          });
        });
      }

      if (process && process.eventNames) {
        const events = process.eventNames();
        events.forEach((eventName) => {
          const count = process.listenerCount(eventName);
          if (count > 0) {
            eventEmitterStats.push({
              name: `process:${eventName}`,
              count
            });
          }
        });
      }
    } catch (error) {
      console.error("Error getting EventEmitter stats:", error);
    }

    const totalListeners = Array.from(listenerManager.listeners.values()).reduce((acc, val) => acc + val.length, 0);

    const timestamp = Date.now();
    listenerManager.historicalCounts.push({
      timestamp,
      count: totalListeners,
      channelCount: listenerManager.listeners.size
    });

    if (listenerManager.historicalCounts.length > listenerManager.maxHistoryLength) {
      listenerManager.historicalCounts.shift();
    }

    let potentialLeaks = [];
    if (listenerManager.historicalCounts.length >= 3) {
      const current = listenerManager.historicalCounts[listenerManager.historicalCounts.length - 1];
      const previous = listenerManager.historicalCounts[listenerManager.historicalCounts.length - 3];

      current.channelBreakdown = { ...channelBreakdown };

      for (const [channel, listeners] of listenerManager.listeners.entries()) {
        const currentCount = current.channelBreakdown[channel] || listeners.length;
        const previousCount = previous.channelBreakdown?.[channel] || 0;

        if (previous && currentCount > 3 && listeners.length > 0) {
          potentialLeaks.push({
            channel,
            currentCount,
            previousCount,
            increased: currentCount > previousCount
          });
        }
      }
    }

    return {
      totalChannels: listenerManager.listeners.size,
      totalListeners,
      dynamicChannels: Array.from(listenerManager.dynamicChannels),
      activeMonitoringConnections: Array.from(listenerManager.activeMonitoringConnections),
      channelBreakdown,
      eventEmitterStats,
      history: listenerManager.historicalCounts,
      potentialLeaks
    };
  },

  cleanup: () => {
    for (const [channel, listeners] of listenerManager.listeners.entries()) {
      for (const listener of listeners) {
        ipcRenderer.removeListener(channel, listener);
      }
    }
    listenerManager.listeners.clear();
    listenerManager.dynamicChannels.clear();
    listenerManager.activeMonitoringConnections.clear();
  },

  fixMaxListenersWarning: () => {
    try {
      if (process && process.setMaxListeners) {
        process.setMaxListeners(50);
        console.log("Process max listeners increased to 50");
      }

      if (ipcRenderer && ipcRenderer.setMaxListeners) {
        ipcRenderer.setMaxListeners(50);
        console.log("IpcRenderer max listeners increased to 50");
      }

      return true;
    } catch (error) {
      console.error("Error fixing max listeners warning:", error);
      return false;
    }
  }
};

function relayEventToDom(channel, data) {
  try {
    const event = new CustomEvent(channel, {
      detail: data
    });
    window.dispatchEvent(event);

    if (channel.includes("progress")) {
      console.log(`[Preload] Relayed ${channel}:`, typeof data === "object" && data?.percent !== undefined ? data.percent : data);
    }
  } catch (error) {
    console.error(`[Preload] Error relaying event ${channel}:`, error);
  }
}

const validChannels = ["update-status", "update-available", "update-info", "autoUpdater:update-info", "autoUpdater:download-progress", "autoUpdater:download-complete", "restoration-progress"];

validChannels.forEach((channel) => {
  const relayer = (_, data) => {
    relayEventToDom(channel, data);
  };
  ipcRenderer.on(channel, relayer);
  listenerManager.addListener(channel, relayer);
});

try {
  contextBridge.exposeInMainWorld("electron", {
    ipcRenderer: {
      on: (channel, func) => {
        if (validChannels.includes(channel)) {
          const wrappedFunc = (event, ...args) => func(event, ...args);
          ipcRenderer.on(channel, wrappedFunc);

          return listenerManager.addListener(channel, wrappedFunc);
        }
      },
      removeListener: (channel, func) => {
        if (validChannels.includes(channel)) {
          ipcRenderer.removeListener(channel, func);
          listenerManager.removeListener(channel, func);
        }
      },
      send: (channel, data) => {
        const validSendChannels = ["main:download-update", "main:download-progress-info", "main:download-complete"];
        if (validSendChannels.includes(channel)) {
          ipcRenderer.send(channel, data);
        }
      }
    }
  });

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
    readEnvFileRaw: (projectPath) => safeIpcRenderer.invoke("read-env-file-raw", projectPath),
    saveEnvFile: (projectPath, content) => safeIpcRenderer.invoke("save-env-file", projectPath, content),
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
    createDatabase: (config) => safeIpcRenderer.invoke("create-database", config),
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
    clearAllProjectLogs: (config) => safeIpcRenderer.invoke("clear-all-project-logs", config),
    openFile: (filePath) => safeIpcRenderer.invoke("open-file", filePath),
    getProjectLogs: (config) => safeIpcRenderer.invoke("get-project-logs", config),
    getMigrationStatus: (config) => safeIpcRenderer.invoke("get-migration-status", config),
    readModelFile: (filePath) => safeIpcRenderer.invoke("read-model-file", filePath),
    saveConnections: (connections) => safeIpcRenderer.invoke("save-connections", connections),
    getOpenTabs: () => safeIpcRenderer.invoke("get-open-tabs"),
    saveOpenTabs: (tabs) => safeIpcRenderer.invoke("save-open-tabs", tabs),
    stopMonitoringDatabaseOperations: (channel, clearDataOnStop = false) => {
      listenerManager.removeAllListeners(channel);

      ipcRenderer.removeAllListeners(channel);

      const connectionId = channel.replace("db-operation-", "");

      listenerManager.removeMonitoringConnection(connectionId);

      return ipcRenderer
        .invoke("stop-db-monitoring", connectionId, clearDataOnStop)
        .then((result) => {
          return result;
        })
        .catch((err) => {
          console.error("Error stopping monitoring:", err);
          throw err;
        });
    },
    removeConnection: (connectionId) => safeIpcRenderer.invoke("remove-connection", connectionId),
    updateEnvDatabase: (projectPath, database) => safeIpcRenderer.invoke("update-env-database", projectPath, database),
    listFiles: (dirPath) => safeIpcRenderer.invoke("list-files", dirPath),
    setAppBadge: (count) => safeIpcRenderer.invoke("set-app-badge", count),
    checkForUpdates: () => safeIpcRenderer.invoke("check-for-updates"),
    downloadUpdate: () => {
      ipcRenderer.send("main:download-update");
      return Promise.resolve(true);
    },
    quitAndInstall: () => safeIpcRenderer.invoke("quit-and-install"),
    getCurrentVersion: () => safeIpcRenderer.invoke("get-current-version"),
    openExternal: (url) => safeIpcRenderer.invoke("open-external", url),
    onUpdateStatus: (callback) => {
      const updateStatusListener = (_, data) => callback(data);
      ipcRenderer.on("update-status", updateStatusListener);

      listenerManager.addListener("update-status", updateStatusListener);

      return () => {
        ipcRenderer.removeListener("update-status", updateStatusListener);
        listenerManager.removeListener("update-status", updateStatusListener);
      };
    },
    getDatabaseRelationships: (connectionId) =>
      safeIpcRenderer.invoke("get-database-relationships", {
        connectionId
      }),
    executeSQLQuery: (config) => safeIpcRenderer.invoke("execute-sql-query", config),
    runArtisanCommand: (config) => safeIpcRenderer.invoke("run-artisan-command", config),
    getSingularForm: (word) => safeIpcRenderer.invoke("get-singular-form", word),
    triggerGarbageCollection: () => {
      try {
        // See if we can directly access the GC
        if (global.gc) {
          global.gc();
          return Promise.resolve({ success: true });
        }
        // If not, try to use the main process GC
        return safeIpcRenderer.invoke("trigger-garbage-collection");
      } catch (error) {
        console.error("Error in triggering garbage collection:", error);
        return Promise.resolve({ success: false, error: error.message });
      }
    },

    listenCommandOutput: (commandId, callback) => {
      const channel = `command-output-${commandId}`;
      const listener = (_, data) => callback(data);

      ipcRenderer.on(channel, listener);
      listenerManager.addListener(channel, listener, true);

      return channel;
    },
    stopCommandListener: (channel) => {
      listenerManager.removeAllListeners(channel);
      ipcRenderer.removeAllListeners(channel);
    },
    getSettings: () => safeIpcRenderer.invoke("get-settings"),
    saveSettings: (settings) => safeIpcRenderer.invoke("save-settings", settings),
    monitorDatabaseOperations: (connectionId, callback, clearHistory = false) => {
      try {
        const channel = `db-operation-${connectionId}`;

        listenerManager.removeAllListeners(channel);
        ipcRenderer.removeAllListeners(channel);

        const listener = (_, data) => callback(data);
        ipcRenderer.on(channel, listener);
        listenerManager.addListener(channel, listener, true);

        listenerManager.addMonitoringConnection(connectionId);

        return ipcRenderer.invoke("start-db-monitoring", connectionId, clearHistory).then((result) => {
          return channel;
        });
      } catch (error) {
        console.error("Error in monitorDatabaseOperations:", error);
        throw error;
      }
    },

    send: (channel, data) => {
      if (typeof channel !== "string") return;

      const allowedSendChannels = ["start-database-restore", "main:download-update", "main:download-progress-info", "main:download-complete"];

      if (allowedSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    onEvent: (channel, callback) => {
      if (validChannels.includes(channel)) {
        const listener = (_, data) => callback(data);
        ipcRenderer.on(channel, listener);

        listenerManager.addListener(channel, listener);

        return () => {
          ipcRenderer.removeListener(channel, listener);
          listenerManager.removeListener(channel, listener);
        };
      }
    },
    onRestorationProgress: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on("restoration-progress", listener);

      listenerManager.addListener("restoration-progress", listener);

      return () => {
        ipcRenderer.removeListener("restoration-progress", listener);
        listenerManager.removeListener("restoration-progress", listener);
      };
    },
    getListenerStats: () => {
      return listenerManager.getStats();
    },
    fixMaxListenersWarning: () => {
      try {
        const result = listenerManager.fixMaxListenersWarning();
        return Promise.resolve(result);
      } catch (error) {
        console.error("Error in fixMaxListenersWarning:", error);
        return Promise.resolve(false);
      }
    },
    hashPassword: (password) => ipcRenderer.invoke("hashPassword", password),
    updatePassword: (config) => safeIpcRenderer.invoke("update-password", config)
  });

  window.addEventListener("beforeunload", () => {
    listenerManager.cleanup();
  });

  if (process.env.NODE_ENV === "development") {
    window.__cleanupListeners = () => {
      try {
        // First cleanup managed listeners
        listenerManager.cleanup();

        // Try to clean up any database monitoring connections
        const dbConnectionPattern = /^db-operation-/;
        const channels = ipcRenderer.eventNames ? ipcRenderer.eventNames() : [];

        for (const channel of channels) {
          if (typeof channel === "string" && dbConnectionPattern.test(channel)) {
            console.log(`Cleaning up untracked channel: ${channel}`);
            ipcRenderer.removeAllListeners(channel);
          }
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        return "Listeners cleaned up successfully";
      } catch (err) {
        console.error("Error in cleanup:", err);
        return "Error cleaning up listeners: " + err.message;
      }
    };
  }
} catch (error) {
  console.error(error);
}
