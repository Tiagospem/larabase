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
      testMySQLConnection: (config) => safeIpcRenderer.invoke('test-mysql-connection', config)
    }
  );
} catch (error) {
  console.error(error);
} 