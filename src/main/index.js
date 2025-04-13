const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

// Em desenvolvimento, configurar o hot-reload
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(path.join(__dirname, '../renderer'), {
      electron: path.join(__dirname, '../../node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
    console.log('Electron reload configurado!');
  } catch (err) {
    console.error('Erro ao configurar electron-reload:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true, // Garantir que o DevTools esteja habilitado
    },
    icon: path.join(__dirname, '../renderer/assets/larabase-logo.svg')
  });

  // In production, load the bundled app
  // In development, load from the dev server
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('Loading from dev server...');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    
    // Adicionar evento para verificar erros de carregamento
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load URL', errorCode, errorDescription);
      setTimeout(() => {
        console.log('Retrying to connect to dev server...');
        mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    console.log('Loading from file...');
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Registrar eventos de navegação para depuração
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Page started loading');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
  });

  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('Navigated to:', url);
  });

  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('Navigated in page to:', url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Registrar atalhos de teclado globais
  // F12 ou Ctrl+Shift+I para abrir o DevTools
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Ctrl+R ou Command+R para recarregar
  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) {
      mainWindow.reload();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  // Desregistrar todos os atalhos quando a aplicação for fechada
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-connections', () => {
  console.log('IPC: get-connections chamado');
  const connections = store.get('connections') || [];
  console.log('Conexões retornadas:', connections);
  return connections;
});

ipcMain.handle('save-connections', (event, connections) => {
  console.log('IPC: save-connections chamado', connections);
  store.set('connections', connections);
  return true;
});

ipcMain.handle('get-open-tabs', () => {
  console.log('IPC: get-open-tabs chamado');
  const tabs = store.get('openTabs') || { tabs: [], activeTabId: null };
  console.log('Abas retornadas:', tabs);
  return tabs;
});

ipcMain.handle('save-open-tabs', (event, tabData) => {
  console.log('IPC: save-open-tabs chamado', tabData);
  store.set('openTabs', tabData);
  return true;
}); 