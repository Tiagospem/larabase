const { contextBridge, ipcRenderer } = require('electron');

// Log para depuração
console.log('Preload script executando...');

// Adicionar tratamento de erros para IPC
const safeIpcRenderer = {
  invoke: async (channel, ...args) => {
    try {
      console.log(`Chamando IPC ${channel}...`);
      const result = await ipcRenderer.invoke(channel, ...args);
      console.log(`IPC ${channel} resultado:`, result);
      return result;
    } catch (error) {
      console.error(`Erro na chamada IPC ${channel}:`, error);
      throw error;
    }
  }
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld(
    'api', {
      getConnections: () => safeIpcRenderer.invoke('get-connections'),
      saveConnections: (connections) => safeIpcRenderer.invoke('save-connections', connections),
      getOpenTabs: () => safeIpcRenderer.invoke('get-open-tabs'),
      saveOpenTabs: (tabs) => safeIpcRenderer.invoke('save-open-tabs', tabs)
    }
  );
  console.log('API exposta com sucesso!');
} catch (error) {
  console.error('Erro ao expor API:', error);
} 