const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');

const store = new Store();

let mainWindow;

if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(path.join(__dirname, '../renderer'), {
      electron: path.join(__dirname, '../../node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.error('electron-reload:', err);
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
      devTools: true,
    },
    icon: path.join(__dirname, '../renderer/assets/larabase-logo.png')
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('Loading from dev server...');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load URL', errorCode, errorDescription);
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    console.log('Loading from file...');
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

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
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-connections', () => {
  return store.get('connections') || [];
});

ipcMain.handle('save-connections', (event, connections) => {
  store.set('connections', connections);
  return true;
});

ipcMain.handle('get-open-tabs', () => {
  return store.get('openTabs') || {tabs: [], activeTabId: null};
});

ipcMain.handle('save-open-tabs', (event, tabData) => {
  store.set('openTabs', tabData);
  return true;
});

// Selecionar diretório
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result;
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw error;
  }
});

// Validar se é um projeto Laravel
ipcMain.handle('validate-laravel-project', async (event, projectPath) => {
  try {
    // Verificar se existe o .env, artisan e composer.json
    const hasEnv = fs.existsSync(path.join(projectPath, '.env'));
    const hasArtisan = fs.existsSync(path.join(projectPath, 'artisan'));
    const hasComposerJson = fs.existsSync(path.join(projectPath, 'composer.json'));
    
    // Se tiver os três arquivos, é provável que seja um projeto Laravel
    return hasEnv && hasArtisan && hasComposerJson;
  } catch (error) {
    console.error('Error validating Laravel project:', error);
    return false;
  }
});

// Ler arquivo .env e extrair configurações
ipcMain.handle('read-env-file', async (event, projectPath) => {
  try {
    const envPath = path.join(projectPath, '.env');
    
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found at:', envPath);
      return null;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envConfig = {};
    
    // Processar cada linha do arquivo .env
    envContent.split('\n').forEach(line => {
      // Ignorar comentários e linhas vazias
      if (line.startsWith('#') || line.trim() === '') {
        return;
      }
      
      // Extrair chave e valor (format: KEY=VALUE)
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        // Remover aspas se presentes
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        envConfig[key] = value;
      }
    });
    
    console.log('Extracted env config:', JSON.stringify(envConfig, null, 2));
    return envConfig;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return null;
  }
}); 