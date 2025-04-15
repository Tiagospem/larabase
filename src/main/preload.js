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
  contextBridge.exposeInMainWorld(
    'api', {
      getConnections: () => safeIpcRenderer.invoke('get-connections'),
      saveConnections: (connections) => safeIpcRenderer.invoke('save-connections', connections),
      getOpenTabs: () => safeIpcRenderer.invoke('get-open-tabs'),
      saveOpenTabs: (tabs) => safeIpcRenderer.invoke('save-open-tabs', tabs),
      selectDirectory: () => safeIpcRenderer.invoke('select-directory'),
      validateLaravelProject: (projectPath) => safeIpcRenderer.invoke('validate-laravel-project', projectPath),
      readEnvFile: (projectPath) => safeIpcRenderer.invoke('read-env-file', projectPath),
      testMySQLConnection: (config) => safeIpcRenderer.invoke('test-mysql-connection', config),
      listTables: (config) => safeIpcRenderer.invoke('list-tables', config),
      listDatabases: (config) => safeIpcRenderer.invoke('list-databases', config),
      getTableRecordCount: (config) => safeIpcRenderer.invoke('getTableRecordCount', config),
      getTableData: (config) => safeIpcRenderer.invoke('getTableData', config),
      getFilteredTableData: (config) => safeIpcRenderer.invoke('getFilteredTableData', config),
      getTableStructure: (config) => safeIpcRenderer.invoke('getTableStructure', config),
      getTableForeignKeys: (config) => safeIpcRenderer.invoke('getTableForeignKeys', config),
      findTableMigrations: (config) => safeIpcRenderer.invoke('findTableMigrations', config),
      updateRecord: (config) => safeIpcRenderer.invoke('updateRecord', config),
      deleteRecords: (config) => safeIpcRenderer.invoke('deleteRecords', config),
      truncateTable: (config) => safeIpcRenderer.invoke('truncateTable', config),
      openFile: (filePath) => safeIpcRenderer.invoke('openFile', filePath),
      getDatabaseRelationships: (connectionId) => safeIpcRenderer.invoke('get-database-relationships', { connectionId }),
      findModelsForTables: (config) => safeIpcRenderer.invoke('find-models-for-tables', config),
      readModelFile: (filePath) => safeIpcRenderer.invoke('read-model-file', filePath),
      listFiles: (dirPath) => safeIpcRenderer.invoke('list-files', dirPath),
      
      // Project logs related functions
      getProjectLogs: (config) => safeIpcRenderer.invoke('get-project-logs', config),
      deleteProjectLog: (logId) => safeIpcRenderer.invoke('delete-project-log', logId),
      clearAllProjectLogs: (config) => safeIpcRenderer.invoke('clear-all-project-logs', config),
      
      // Artisan command related function
      runArtisanCommand: (config) => safeIpcRenderer.invoke('run-artisan-command', config),
      listenCommandOutput: (commandId, callback) => {
        const channel = `command-output-${commandId}`;
        ipcRenderer.on(channel, (_, data) => callback(data));
        return channel;
      },
      stopCommandListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
      },
      getMigrationStatus: (config) => safeIpcRenderer.invoke('get-migration-status', config),
      
      // Settings related functions
      getSettings: () => safeIpcRenderer.invoke('get-settings'),
      saveSettings: (settings) => safeIpcRenderer.invoke('save-settings', settings),
      
      // Database monitoring related functions
      monitorDatabaseOperations: (connectionId, callback) => {
        try {
          const channel = `db-operation-${connectionId}`;
          console.log(`Configurando listener IPC no canal: ${channel}`);
          
          // Remove any existing listeners for this channel to avoid duplicates
          ipcRenderer.removeAllListeners(channel);
          
          // Set up the new listener
          ipcRenderer.on(channel, (_, data) => {
            // Passar todos os dados para o callback sem filtragem
            callback(data);
          });
          
          // Start monitoring on the main process
          console.log(`Chamando start-db-monitoring com connectionId: ${connectionId}`);
          return ipcRenderer.invoke('start-db-monitoring', connectionId)
            .then(result => {
              console.log('Resultado do início do monitoramento:', result);
              return channel; // Return channel name for cleanup
            });
        } catch (error) {
          console.error('Erro em monitorDatabaseOperations:', error);
          throw error;
        }
      },
      stopMonitoringDatabaseOperations: (channel) => {
        console.log(`Stopping monitoring on channel: ${channel}`);
        
        // Remove the listener
        ipcRenderer.removeAllListeners(channel);
        
        // Extract the connection ID from the channel name
        const connectionId = channel.replace('db-operation-', '');
        
        // Stop monitoring on the main process
        return ipcRenderer.invoke('stop-db-monitoring', connectionId)
          .then(result => {
            console.log('Monitoring stop result:', result);
            return result;
          })
          .catch(err => {
            console.error('Error stopping monitoring:', err);
            throw err;
          });
      },
      
      // Novo monitoramento baseado em triggers
      monitorDatabaseChanges: (connectionDetails, callback) => {
        const connectionId = connectionDetails.id || connectionDetails.connectionId;
        if (!connectionId) return Promise.reject('Connection ID is required');
        
        const channel = `db-activity-${connectionId}`;
        
        // Configurar listener para receber atualizações de atividade
        ipcRenderer.on(channel, (event, data) => callback(data));
        
        // Iniciar monitoramento via triggers no processo principal
        return ipcRenderer.invoke('monitor-database-changes', connectionDetails)
          .then(result => {
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
      
      // Obter atividades do banco desde o último ID
      getDatabaseChanges: (connectionId, lastId = 0) => {
        if (!connectionId) return Promise.reject('Connection ID is required');
        return ipcRenderer.invoke('get-database-changes', connectionId, lastId);
      },
      
      // Parar monitoramento baseado em triggers
      stopTriggerMonitoring: (connectionId) => {
        if (!connectionId) return Promise.reject('Connection ID is required');
        
        // Remover todos os listeners para este canal
        const channel = `db-activity-${connectionId}`;
        ipcRenderer.removeAllListeners(channel);
        
        // Parar monitoramento no processo principal
        return ipcRenderer.invoke('stop-trigger-monitoring', connectionId);
      },

      // SQL Editor functionality
      executeSQLQuery: (config) => safeIpcRenderer.invoke('execute-sql-query', config),
      
      // Pluralization helpers
      getPluralizeFunction: () => safeIpcRenderer.invoke('get-pluralize-function'),
      getSingularForm: (word) => safeIpcRenderer.invoke('get-singular-form', word),
      getPluralForm: (word) => safeIpcRenderer.invoke('get-plural-form', word),
      
      // Project Database Management
      updateEnvDatabase: (projectPath, database) => safeIpcRenderer.invoke('update-env-database', projectPath, database),
      removeConnection: (connectionId) => safeIpcRenderer.invoke('remove-connection', connectionId),
      
      // Add database restoration related functions to the API
      selectSqlDumpFile: () => safeIpcRenderer.invoke('select-sql-dump-file'),
      startDatabaseRestore: (config) => {
        // Generate a unique channel ID for this restoration process
        const channelId = `restore-progress-${Date.now()}`;
        
        // Return a promise that resolves when the restoration process begins
        return new Promise((resolve, reject) => {
          // Setup a temporary one-time handler for the initial response
          const initHandler = (event, initialResponse) => {
            // Clean up this one-time handler
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
          
          // Register the one-time handler
          ipcRenderer.once(`${channelId}-init`, initHandler);
          
          // Start the restoration process with the generated channel ID
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
      stopRestoreListener: (channelId) => {
        if (channelId) {
          ipcRenderer.removeAllListeners(channelId);
        }
      },
      extractTablesFromSql: (filePath) => safeIpcRenderer.invoke('extract-tables-from-sql', filePath),
      
      // Add method to send direct IPC messages
      send: (channel, data) => {
        if (typeof channel !== 'string') return;
        
        // List of allowed channels for send
        const allowedSendChannels = [
          'start-database-restore'
        ];
        
        if (allowedSendChannels.includes(channel)) {
          ipcRenderer.send(channel, data);
        }
      },
      
      // Simple database restore method without complex parameter passing
      simpleDatabaseRestore: (config) => safeIpcRenderer.invoke('simple-database-restore-unified', config),
      
      // Add method to cancel an active database restore process
      cancelDatabaseRestore: (connectionId) => safeIpcRenderer.invoke('cancel-database-restore', connectionId),

      // Add method to update a connection's database name
      updateConnectionDatabase: (connectionId, newDatabase) => safeIpcRenderer.invoke('update-connection-database', connectionId, newDatabase),

      // Adicionar o método getFileStats ao api exposto pelo preload
      getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
    }
  );
} catch (error) {
  console.error(error);
} 