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
      getTableRecordCount: (config) => safeIpcRenderer.invoke('getTableRecordCount', config),
      getTableData: (config) => safeIpcRenderer.invoke('getTableData', config),
      getTableStructure: (config) => safeIpcRenderer.invoke('getTableStructure', config),
      getTableForeignKeys: (config) => safeIpcRenderer.invoke('getTableForeignKeys', config),
      findTableMigrations: (config) => safeIpcRenderer.invoke('findTableMigrations', config),
      openFile: (filePath) => safeIpcRenderer.invoke('openFile', filePath),
      getDatabaseRelationships: (connectionId) => safeIpcRenderer.invoke('get-database-relationships', { connectionId }),
      findModelsForTables: (config) => safeIpcRenderer.invoke('find-models-for-tables', config),
      readModelFile: (filePath) => safeIpcRenderer.invoke('read-model-file', filePath),
      
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
      }
    }
  );
} catch (error) {
  console.error(error);
} 