const { contextBridge, ipcRenderer } = require('electron');

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
  contextBridge.exposeInMainWorld('api', {
    getConnections: () => safeIpcRenderer.invoke('get-connections'),
    saveConnections: connections => safeIpcRenderer.invoke('save-connections', connections),
    getOpenTabs: () => safeIpcRenderer.invoke('get-open-tabs'),
    saveOpenTabs: tabs => safeIpcRenderer.invoke('save-open-tabs', tabs),
    selectDirectory: () => safeIpcRenderer.invoke('select-directory'),
    validateLaravelProject: projectPath =>
      safeIpcRenderer.invoke('validate-laravel-project', projectPath),
    readEnvFile: projectPath => safeIpcRenderer.invoke('read-env-file', projectPath),
    testMySQLConnection: config => safeIpcRenderer.invoke('test-mysql-connection', config),
    listTables: config => safeIpcRenderer.invoke('list-tables', config),
    listDatabases: config => safeIpcRenderer.invoke('list-databases', config),
    getTableRecordCount: config => safeIpcRenderer.invoke('getTableRecordCount', config),
    getTableData: config => safeIpcRenderer.invoke('getTableData', config),
    getFilteredTableData: config => safeIpcRenderer.invoke('getFilteredTableData', config),
    getTableStructure: config => safeIpcRenderer.invoke('getTableStructure', config),
    getTableForeignKeys: config => safeIpcRenderer.invoke('getTableForeignKeys', config),
    findTableMigrations: config => safeIpcRenderer.invoke('findTableMigrations', config),
    updateRecord: config => safeIpcRenderer.invoke('updateRecord', config),
    deleteRecords: config => safeIpcRenderer.invoke('deleteRecords', config),
    truncateTable: config => safeIpcRenderer.invoke('truncateTable', config),
    openFile: filePath => safeIpcRenderer.invoke('openFile', filePath),
    getDatabaseRelationships: connectionId =>
      safeIpcRenderer.invoke('get-database-relationships', { connectionId }),
    findModelsForTables: config => safeIpcRenderer.invoke('find-models-for-tables', config),
    readModelFile: filePath => safeIpcRenderer.invoke('read-model-file', filePath),
    listFiles: dirPath => safeIpcRenderer.invoke('list-files', dirPath),

    getProjectLogs: config => safeIpcRenderer.invoke('get-project-logs', config),
    deleteProjectLog: logId => safeIpcRenderer.invoke('delete-project-log', logId),
    clearAllProjectLogs: config => safeIpcRenderer.invoke('clear-all-project-logs', config),

    runArtisanCommand: config => safeIpcRenderer.invoke('run-artisan-command', config),
    listenCommandOutput: (commandId, callback) => {
      const channel = `command-output-${commandId}`;
      ipcRenderer.on(channel, (_, data) => callback(data));
      return channel;
    },
    stopCommandListener: channel => {
      ipcRenderer.removeAllListeners(channel);
    },
    getMigrationStatus: config => safeIpcRenderer.invoke('get-migration-status', config),

    getSettings: () => safeIpcRenderer.invoke('get-settings'),
    saveSettings: settings => safeIpcRenderer.invoke('save-settings', settings),

    monitorDatabaseOperations: (connectionId, callback) => {
      try {
        const channel = `db-operation-${connectionId}`;
        console.log(`Configurando listener IPC no canal: ${channel}`);

        ipcRenderer.removeAllListeners(channel);

        ipcRenderer.on(channel, (_, data) => {
          callback(data);
        });

        console.log(`Calling start-db-monitoring with connectionId: ${connectionId}`);
        return ipcRenderer.invoke('start-db-monitoring', connectionId).then(result => {
          console.log('Result of monitoring initialization:', result);
          return channel;
        });
      } catch (error) {
        console.error('Error in monitorDatabaseOperations:', error);
        throw error;
      }
    },
    stopMonitoringDatabaseOperations: channel => {
      console.log(`Stopping monitoring on channel: ${channel}`);

      ipcRenderer.removeAllListeners(channel);

      const connectionId = channel.replace('db-operation-', '');

      // Stop monitoring on the main process
      return ipcRenderer
        .invoke('stop-db-monitoring', connectionId)
        .then(result => {
          console.log('Monitoring stop result:', result);
          return result;
        })
        .catch(err => {
          console.error('Error stopping monitoring:', err);
          throw err;
        });
    },

    monitorDatabaseChanges: (connectionDetails, callback) => {
      const connectionId = connectionDetails.id || connectionDetails.connectionId;
      if (!connectionId) return Promise.reject('Connection ID is required');

      const channel = `db-activity-${connectionId}`;

      ipcRenderer.on(channel, (event, data) => callback(data));

      return ipcRenderer.invoke('monitor-database-changes', connectionDetails).then(result => {
        if (result.success) {
          return {
            success: true,
            channelId: channel,
            connectionId: connectionId,
            activities: result.activities || []
          };
        } else {
          throw new Error(result.message || 'Failed to start monitoring');
        }
      });
    },

    getDatabaseChanges: (connectionId, lastId = 0) => {
      if (!connectionId) return Promise.reject('Connection ID is required');
      return ipcRenderer.invoke('get-database-changes', connectionId, lastId);
    },

    stopTriggerMonitoring: connectionId => {
      if (!connectionId) return Promise.reject('Connection ID is required');

      const channel = `db-activity-${connectionId}`;
      ipcRenderer.removeAllListeners(channel);

      return ipcRenderer.invoke('stop-trigger-monitoring', connectionId);
    },

    executeSQLQuery: config => safeIpcRenderer.invoke('execute-sql-query', config),

    getPluralizeFunction: () => safeIpcRenderer.invoke('get-pluralize-function'),
    getSingularForm: word => safeIpcRenderer.invoke('get-singular-form', word),
    getPluralForm: word => safeIpcRenderer.invoke('get-plural-form', word),

    updateEnvDatabase: (projectPath, database) =>
      safeIpcRenderer.invoke('update-env-database', projectPath, database),
    removeConnection: connectionId => safeIpcRenderer.invoke('remove-connection', connectionId),

    selectSqlDumpFile: () => safeIpcRenderer.invoke('select-sql-dump-file'),
    startDatabaseRestore: config => {
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
            reject(new Error(initialResponse.message || 'Failed to start restoration'));
          }
        };

        ipcRenderer.once(`${channelId}-init`, initHandler);

        ipcRenderer.send('start-database-restore', {
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
    stopRestoreListener: channelId => {
      if (channelId) {
        ipcRenderer.removeAllListeners(channelId);
      }
    },
    extractTablesFromSql: filePath => safeIpcRenderer.invoke('extract-tables-from-sql', filePath),

    send: (channel, data) => {
      if (typeof channel !== 'string') return;

      const allowedSendChannels = ['start-database-restore'];

      if (allowedSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },

    simpleDatabaseRestore: config =>
      safeIpcRenderer.invoke('simple-database-restore-unified', config),

    cancelDatabaseRestore: connectionId =>
      safeIpcRenderer.invoke('cancel-database-restore', connectionId),

    updateConnectionDatabase: (connectionId, newDatabase) =>
      safeIpcRenderer.invoke('update-connection-database', connectionId, newDatabase),

    getFileStats: filePath => ipcRenderer.invoke('get-file-stats', filePath),
    
    // App badge functionality
    setAppBadge: count => safeIpcRenderer.invoke('set-app-badge', count)
  });
} catch (error) {
  console.error(error);
}
