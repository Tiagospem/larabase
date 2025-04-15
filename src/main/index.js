const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { spawn, execSync, exec } = require('child_process');
const pluralize = require('pluralize');

const store = new Store();

let mainWindow;

const originalCreateConnection = mysql.createConnection;

function setupGlobalMonitoring() {
  mysql.createConnection = async function (...args) {
    // Chama a função original para criar a conexão
    const connection = await originalCreateConnection.apply(this, args);
    
    // Verifica se estamos conectando a um banco que já está sendo monitorado
    const config = args[0];
    console.log("New database connection created:", config.host, config.database);
    
    // Procura em todas as conexões monitoradas
    for (const [connectionId, monitoredConn] of dbMonitoringConnections.entries()) {
      // Se já temos uma conexão monitorando esse mesmo banco
      if (monitoredConn._config && 
          monitoredConn._config.host === config.host && 
          monitoredConn._config.database === config.database) {
        
        console.log(`Auto-monitoring new connection to ${config.database} (from monitored connection ${connectionId})`);
        // Setup do monitoramento nesta nova conexão
        setupMonitoring(connection, config.database);
        break;
      }
    }
    
    return connection;
  };
  
  console.log("Global MySQL monitoring configured");
}

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

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
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
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load URL', errorCode, errorDescription);
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Add system diagnostics function to get information about Docker availability
async function getSystemDiagnostics() {
  const diagnostics = {
    platform: process.platform,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    arch: process.arch,
    env: {
      path: process.env.PATH,
      home: process.env.HOME || process.env.USERPROFILE,
      shell: process.env.SHELL || process.env.ComSpec
    },
    docker: {
      available: false,
      version: null,
      error: null
    }
  };
  
  // Check Docker with timeout to prevent blocking
  try {
    const dockerCheckPromise = new Promise((resolve) => {
      try {
        if (isDockerCliAvailable()) {
          // Try to get Docker version
          try {
            const dockerVersion = execSync('docker --version', { 
              timeout: 3000,
              shell: true,
              windowsHide: true
            }).toString().trim();
            resolve({
              available: true,
              version: dockerVersion,
              error: null
            });
          } catch (versionError) {
            resolve({
              available: true,
              version: null,
              error: `Docker detected but version check failed: ${versionError.message}`
            });
          }
        } else {
          resolve({
            available: false,
            version: null,
            error: 'Docker CLI not available'
          });
        }
      } catch (error) {
        resolve({
          available: false,
          version: null,
          error: `Docker check failed: ${error.message}`
        });
      }
    });
    
    // Apply timeout to prevent blocking
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          available: false,
          version: null,
          error: 'Docker check timed out after 5 seconds'
        });
      }, 5000);
    });
    
    // Use first promise to resolve (Docker check or timeout)
    diagnostics.docker = await Promise.race([dockerCheckPromise, timeoutPromise]);
  } catch (error) {
    diagnostics.docker = {
      available: false,
      version: null,
      error: `Docker diagnostics failed: ${error.message}`
    };
  }
  
  return diagnostics;
}

// Implement OS-specific Docker check
function checkDockerByOS() {
  console.log(`Checking Docker specifically for: ${process.platform}`);
  
  try {
    // OS-specific checks
    if (process.platform === 'darwin') { // macOS
      // On macOS, check Docker socket and processes
      const socketExists = fs.existsSync('/var/run/docker.sock');
      console.log(`Docker socket exists on macOS: ${socketExists}`);
      
      if (socketExists) {
        try {
          // Check for Docker Desktop or Docker Engine process
          const psOutput = execSync('ps aux | grep -v grep | grep -E "Docker(Desktop|.app)"', {
            timeout: 2000,
            shell: true
          }).toString();
          
          return psOutput.length > 0;
        } catch (e) {
          // Use socket existence as indication
          return socketExists;
        }
      }
      return false;
    } 
    else if (process.platform === 'linux') { // Linux
      // On Linux, check socket and service status
      const socketExists = fs.existsSync('/var/run/docker.sock');
      console.log(`Docker socket exists on Linux: ${socketExists}`);
      
      if (socketExists) {
        return true; // Socket is usually sufficient on Linux
      }
      
      // Check Docker service status (systemd)
      try {
        execSync('systemctl is-active --quiet docker', {
          timeout: 2000,
          shell: true
        });
        return true;
      } catch (e) {
        // Service not active or not using systemd
        return false;
      }
    } 
    else if (process.platform === 'win32') { // Windows
      // On Windows, check Docker Desktop and service
      try {
        // Check Docker Desktop in task manager
        const tasklistOutput = execSync('tasklist /FI "IMAGENAME eq Docker Desktop.exe" /NH', {
          timeout: 2000,
          shell: true
        }).toString();
        
        if (tasklistOutput.includes('Docker Desktop.exe')) {
          return true;
        }
        
        // Check Docker service
        const serviceOutput = execSync('sc query docker', {
          timeout: 2000,
          shell: true
        }).toString();
        
        return serviceOutput.includes('RUNNING');
      } catch (e) {
        console.log(`Error checking Docker on Windows: ${e.message}`);
        return false;
      }
    }
    
    // For other systems, use generic method
    return false;
  } catch (error) {
    console.error(`Error in OS-specific Docker check: ${error.message}`);
    return false;
  }
}

// Modify app initialization to preserve environment variables
app.whenReady().then(async () => {
  // Ensure system PATH is available and preserved
  if (process.env.PATH) {
    console.log(`Original system PATH: ${process.env.PATH}`);
    
    // For production builds, ensure Docker paths are included
    if (process.platform === 'darwin') { // macOS
      const additionalPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin', // For Apple Silicon Macs using Homebrew
        '/Applications/Docker.app/Contents/Resources/bin'
      ];
      
      // Add Docker paths if not already in PATH
      for (const dockerPath of additionalPaths) {
        if (!process.env.PATH.includes(dockerPath)) {
          process.env.PATH = `${dockerPath}:${process.env.PATH}`;
          console.log(`Added ${dockerPath} to PATH`);
        }
      }
    } else if (process.platform === 'linux') { // Linux
      const additionalPaths = [
        '/usr/bin',
        '/usr/local/bin',
        '/snap/bin' // For snap-installed Docker
      ];
      
      // Add Docker paths if not already in PATH
      for (const dockerPath of additionalPaths) {
        if (!process.env.PATH.includes(dockerPath)) {
          process.env.PATH = `${dockerPath}:${process.env.PATH}`;
          console.log(`Added ${dockerPath} to PATH`);
        }
      }
    } else if (process.platform === 'win32') { // Windows
      const additionalPaths = [
        'C:\\Program Files\\Docker\\Docker\\resources\\bin',
        'C:\\Program Files\\Docker Desktop\\resources\\bin'
      ];
      
      // Add Docker paths if not already in PATH
      for (const dockerPath of additionalPaths) {
        if (!process.env.PATH.includes(dockerPath)) {
          process.env.PATH = `${dockerPath};${process.env.PATH}`;
          console.log(`Added ${dockerPath} to PATH`);
        }
      }
    }
    
    console.log(`Enhanced PATH for Docker detection: ${process.env.PATH}`);
  } else {
    console.warn(`PATH environment variable not found, some features might not work correctly`);
    // Set minimum PATH for Unix/macOS
    if (process.platform === 'darwin' || process.platform === 'linux') {
      process.env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin';
      console.log(`Set default PATH for ${process.platform}: ${process.env.PATH}`);
    } else if (process.platform === 'win32') {
      // Default Windows paths
      process.env.PATH = 'C:\\Windows\\System32;C:\\Windows;C:\\Program Files\\Docker\\Docker\\resources\\bin;C:\\Program Files\\Docker Desktop\\resources\\bin';
      console.log(`Set default PATH for Windows: ${process.env.PATH}`);
    }
  }

  // Try to locate Docker binary on disk
  try {
    const whichCommand = process.platform === 'win32' ? 'where docker' : 'which docker';
    const dockerPath = execSync(whichCommand, { 
      timeout: 2000, 
      shell: true, 
      windowsHide: true,
      encoding: 'utf8'
    }).trim();
    console.log(`Docker binary found at: ${dockerPath}`);
  } catch (e) {
    console.log(`Docker binary not found in PATH: ${e.message}`);
  }

  // Log environment information
  console.log(`Electron running on platform: ${process.platform}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Electron version: ${process.versions.electron}`);
  
  // Get and log system diagnostics
  const diagnostics = await getSystemDiagnostics();
  console.log('System diagnostics:', JSON.stringify(diagnostics, null, 2));

  await createWindow();

  // Configure global MySQL monitoring
  setupGlobalMonitoring();

  // Replace global shortcuts with more focused approach
  // Only respond to shortcuts when the app window is focused
  if (mainWindow) {
    // Use webContents.on('before-input-event') to handle keyboard events only when the window is focused
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Check if the window is focused
      if (!mainWindow.isFocused()) {
        return;
      }

      // F12 - Toggle DevTools
      if (input.key === 'F12' && !input.alt && !input.control && !input.meta && !input.shift) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      // Ctrl+Shift+I or Cmd+Shift+I - Toggle DevTools
      if (input.key === 'I' && !input.alt && input.shift && (input.control || input.meta)) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      // Ctrl+R or Cmd+R - Reload window
      if (input.key === 'r' && !input.alt && !input.shift && (input.control || input.meta)) {
        mainWindow.reload();
      }
    });
  }

  // Remove global shortcut registration
  // globalShortcut.register('F12', () => {
  //   if (mainWindow) {
  //     if (mainWindow.webContents.isDevToolsOpened()) {
  //       mainWindow.webContents.closeDevTools();
  //     } else {
  //       mainWindow.webContents.openDevTools();
  //     }
  //   }
  // });

  // globalShortcut.register('CommandOrControl+Shift+I', () => {
  //   if (mainWindow) {
  //     if (mainWindow.webContents.isDevToolsOpened()) {
  //       mainWindow.webContents.closeDevTools();
  //     } else {
  //       mainWindow.webContents.openDevTools();
  //     }
  //   }
  // });

  // globalShortcut.register('CommandOrControl+R', () => {
  //   if (mainWindow) {
  //     mainWindow.reload();
  //   }
  // });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  // Perform any necessary cleanup before app quits
  console.log('Application is quitting, performing cleanup...');
  
  // Clean up database connections
  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      if (connection) connection.end();
    } catch (e) {
      console.error(`Error closing connection ${connectionId}:`, e);
    }
  }
  dbMonitoringConnections.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-connections', () => {
  try {
    return store.get('connections') || [];
  } catch (error) {
    console.error('Error retrieving connections:', error);
    return [];
  }
});

ipcMain.handle('save-connections', (event, connections) => {
  try {
    store.set('connections', connections);
    return true;
  } catch (error) {
    console.error('Error saving connections:', error);
    throw error;
  }
});

ipcMain.handle('get-open-tabs', () => {
  return store.get('openTabs') || {tabs: [], activeTabId: null};
});

ipcMain.handle('save-open-tabs', (event, tabData) => {
  store.set('openTabs', tabData);
  return true;
});

ipcMain.handle('get-settings', () => {
  try {
    return store.get('settings') || {
      openai: {
        apiKey: '',
        model: 'gpt-3.5-turbo'
      },
      language: 'en' // default to English
    };
  } catch (error) {
    console.error('Error retrieving settings:', error);
    return {
      openai: { apiKey: '', model: 'gpt-3.5-turbo' },
      language: 'en'
    };
  }
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    store.set('settings', settings);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

ipcMain.handle('select-directory', async () => {
  try {
    return await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw error;
  }
});

ipcMain.handle('validate-laravel-project', async (event, projectPath) => {
  try {
    const hasEnv = fs.existsSync(path.join(projectPath, '.env'));
    const hasArtisan = fs.existsSync(path.join(projectPath, 'artisan'));
    const hasComposerJson = fs.existsSync(path.join(projectPath, 'composer.json'));

    return hasEnv && hasArtisan && hasComposerJson;
  } catch (error) {
    console.error('Error validating Laravel project:', error);
    return false;
  }
});

ipcMain.handle('read-env-file', async (event, projectPath) => {
  try {
    const envPath = path.join(projectPath, '.env');
    
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found at:', envPath);
      return null;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envConfig = {};

    envContent.split('\n').forEach(line => {
      if (line.startsWith('#') || line.trim() === '') {
        return;
      }

      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        envConfig[key] = value;
      }
    });
    
    // Verificar se Docker está disponível e se algum container MySQL está usando a porta configurada
    if (envConfig.DB_PORT) {
      const dockerInfo = detectDockerMysql(envConfig.DB_PORT);
      envConfig.dockerInfo = dockerInfo;
    }

    return envConfig;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return null;
  }
});

// Função para verificar se Docker CLI está disponível
function isDockerCliAvailable() {
  try {
    // First approach: direct Docker CLI check with enhanced options
    try {
      console.log('Attempting direct Docker CLI check...');
      execSync('docker --version', { 
        timeout: 3000,
        shell: true,
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env } // Make sure to pass all environment variables
      });
      console.log('Docker CLI is available (direct check)');
      return true;
    } catch (directCheckError) {
      console.log('Direct Docker CLI check failed:', directCheckError.message);
      
      // Second approach: try platform-specific detection
      console.log('Falling back to OS-specific Docker detection...');
      const osCheckResult = checkDockerByOS();
      if (osCheckResult) {
        console.log('Docker detected through OS-specific check');
        return true;
      }
      
      // Third approach: check for Docker socket (works on macOS/Linux)
      if (process.platform !== 'win32') {
        try {
          const socketExists = fs.existsSync('/var/run/docker.sock');
          if (socketExists) {
            console.log('Docker socket found, Docker is likely available');
            return true;
          }
        } catch (socketError) {
          console.log('Error checking Docker socket:', socketError.message);
        }
      }
      
      // For Windows, check Docker Desktop installation location
      if (process.platform === 'win32') {
        try {
          const desktopExists = fs.existsSync('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe');
          if (desktopExists) {
            console.log('Docker Desktop installation found on Windows');
            return true;
          }
        } catch (desktopError) {
          console.log('Error checking Docker Desktop installation:', desktopError.message);
        }
      }
      
      // All checks failed
      console.log('All Docker detection methods failed');
      return false;
    }
  } catch (e) {
    console.log('Docker availability check error:', e.message);
    return false;
  }
}

// Função para detectar container MySQL usando a porta especificada
function detectDockerMysql(port) {
  const result = {
    dockerAvailable: false,
    isDocker: false,
    dockerContainerName: null,
    message: ''
  };

  try {
    // Verificar se Docker CLI está disponível
    if (!isDockerCliAvailable()) {
      result.message = 'Docker CLI is not available';
      return result;
    }
    
    result.dockerAvailable = true;
    
    try {
      // Obter lista de containers Docker with enhanced options
      console.log('Attempting to list Docker containers...');
      const containers = execSync('docker ps --format "{{.Names}} {{.Ports}}"', { 
        timeout: 5000,
        shell: true,
        windowsHide: true,
        env: { ...process.env } // Ensure all environment variables are passed
      }).toString().split('\n');
      
      console.log('Active Docker containers:', containers);
      
      // Procurar por containers MySQL que expõem a porta especificada
      for (const container of containers) {
        if (container.includes(`:${port}->3306`) || container.includes(`${port}:3306`)) {
          const containerName = container.split(' ')[0];
          result.isDocker = true;
          result.dockerContainerName = containerName;
          result.message = `MySQL Docker container found: ${containerName}`;
          break;
        }
      }
      
      // Alternative check: Try detecting MySQL containers regardless of port
      if (!result.isDocker && containers.length > 0) {
        console.log('No container found on specific port, checking for any MySQL containers...');
        for (const container of containers) {
          if (container.toLowerCase().includes('mysql') || container.toLowerCase().includes('mariadb')) {
            const containerName = container.split(' ')[0];
            result.isDocker = true;
            result.dockerContainerName = containerName;
            result.message = `MySQL-like container found: ${containerName} (not on port ${port})`;
            console.log(`Found MySQL-like container: ${containerName}`);
            break;
          }
        }
      }
    } catch (containerError) {
      console.error('Error listing Docker containers:', containerError.message);
      
      // Fallback: Docker is available but container listing failed
      // This can happen in production builds with permission issues
      result.message = 'Docker detected but container listing failed. Check permissions.';
      
      // Try alternative method for macOS/Linux - check for running MySQL containers using grep
      if (process.platform !== 'win32') {
        try {
          console.log('Trying alternative container detection...');
          const grepCommand = `ps aux | grep -v grep | grep -E "mysql|mariadb"`;
          const psOutput = execSync(grepCommand, { 
            timeout: 2000, 
            shell: true,
            windowsHide: true
          }).toString();
          
          if (psOutput.length > 0) {
            console.log('Found MySQL process using ps aux:', psOutput.substring(0, 100) + '...');
            result.isDocker = true;
            result.dockerContainerName = 'mysql-container'; // Generic name, can't determine actual name
            result.message = 'MySQL process detected, assuming Docker container';
          }
        } catch (psError) {
          console.log('Alternative container detection failed:', psError.message);
        }
      }
    }
    
    if (!result.isDocker) {
      result.message = 'No MySQL Docker container found using this port';
    }
    
    return result;
  } catch (error) {
    console.error('Error detecting Docker MySQL:', error);
    result.message = `Error checking Docker containers: ${error.message}`;
    return result;
  }
}

ipcMain.handle('test-mysql-connection', async (event, config) => {
  let connection;
  
  try {
    if (!config.host || !config.port || !config.username || !config.database) {
      return { 
        success: false, 
        message: 'Missing connection parameters'
      };
    }

    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      database: config.database,
      connectTimeout: 10000
    });

    const [rows] = await connection.query('SELECT 1 as connection_test');
    
    if (rows && rows.length > 0) {
      return { success: true, message: 'Connection successful' };
    } else {
      return { 
        success: false, 
        message: 'Connection established but query failed'
      };
    }
  } catch (error) {
    console.error('Error testing MySQL connection:', error);
    let errorMessage = 'Failed to connect to MySQL database';
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Access denied with the provided credentials';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - check host and port';
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = `Database '${config.database}' does not exist`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, message: errorMessage };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('list-tables', async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    // Se recebermos apenas o connectionId, precisamos buscar os detalhes da conexão
    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      console.log(`Getting connection details for list tables, ID: ${config.connectionId}`);
      const connections = store.get('connections') || [];
      const connectionDetails = connections.find(conn => conn.id === config.connectionId);
      
      if (!connectionDetails) {
        return { 
          success: false, 
          message: 'Connection not found',
          tables: []
        };
      }
      
      // Preencher os dados da conexão
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }
    
    if (!config.host || !config.port || !config.username || !config.database) {
      return { 
        success: false, 
        message: 'Missing connection parameters',
        tables: []
      };
    }

    // Tentar usar uma conexão monitorada já existente
    let useMonitoredConnection = false;
    
    if (config.connectionId) {
      monitoredConnection = dbMonitoringConnections.get(config.connectionId);
      if (monitoredConnection) {
        console.log(`Using existing monitored connection for list tables: ${config.connectionId}`);
        connection = monitoredConnection;
        useMonitoredConnection = true;
      }
    }
    
    // Se não temos uma conexão monitorada, criamos uma nova
    if (!useMonitoredConnection) {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || '',
        database: config.database,
        connectTimeout: 10000
      });
    }

    console.log(`Listing tables from ${config.database}`);
    
    const [rows] = await connection.query(`
      SELECT 
        table_name as name, 
        COUNT(*) as columnCount
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = ? 
      GROUP BY 
        table_name
      ORDER BY 
        table_name ASC
    `, [config.database]);
    
    console.log(`Found ${rows.length} tables in ${config.database}`);
    
    return { 
      success: true, 
      tables: rows
    };
  } catch (error) {
    console.error('Error listing tables:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to list tables from database',
      tables: []
    };
  } finally {
    // Apenas fechamos a conexão se NÃO for uma conexão monitorada
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('getTableRecordCount', async (event, config) => {
  let connection;

  try {
    // Se recebermos apenas o connectionId, precisamos buscar os detalhes da conexão
    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      console.log(`Getting connection details for ID: ${config.connectionId}`);
      const connections = store.get('connections') || [];
      const connectionDetails = connections.find(conn => conn.id === config.connectionId);
      
      if (!connectionDetails) {
        return { 
          success: false, 
          message: 'Connection not found',
          count: 0
        };
      }
      
      // Preencher os dados da conexão
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }
    
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        count: 0
      };
    }

    console.log(`Counting records in ${config.database}.${config.tableName}`);
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      database: config.database,
      connectTimeout: 10000
    });

    // Escape table name to prevent SQL injection
    const tableName = connection.escapeId(config.tableName);
    
    const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    
    if (rows && rows.length > 0) {
      return { 
        success: true, 
        count: rows[0].count || 0
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to count records',
        count: 0
      };
    }
  } catch (error) {
    console.error('Error counting table records:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to count records',
      count: 0
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('getTableData', async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    // Se recebermos apenas o connectionId, precisamos buscar os detalhes da conexão
    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      console.log(`Getting connection details for table data, ID: ${config.connectionId}`);
      const connections = store.get('connections') || [];
      const connectionDetails = connections.find(conn => conn.id === config.connectionId);
      
      if (!connectionDetails) {
        return { 
          success: false, 
          message: 'Connection not found',
          data: [],
          totalRecords: 0
        };
      }
      
      // Preencher os dados da conexão
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }
    
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        data: [],
        totalRecords: 0
      };
    }

    // Tentar usar uma conexão monitorada já existente
    let useMonitoredConnection = false;
    
    if (config.connectionId) {
      monitoredConnection = dbMonitoringConnections.get(config.connectionId);
      if (monitoredConnection) {
        console.log(`Using existing monitored connection for ${config.connectionId}`);
        connection = monitoredConnection;
        useMonitoredConnection = true;
      }
    }
    
    // Se não temos uma conexão monitorada, criamos uma nova
    if (!useMonitoredConnection) {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || '',
        database: config.database,
        connectTimeout: 10000
      });
    }

    // Escapar nome da tabela para prevenir SQL injection
    const tableName = connection.escapeId(config.tableName);
    
    // Configurações de paginação
    const page = config.page || 1;
    const limit = config.limit || 100;
    const offset = (page - 1) * limit;
    
    console.log(`Fetching data from ${config.database}.${config.tableName} (page: ${page}, limit: ${limit}, offset: ${offset})`);
    
    // Primeiro, obter a contagem total de registros
    const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM ${tableName}`);
    const totalRecords = countResult[0].total;
    
    console.log(`Total records in ${config.tableName}: ${totalRecords}`);
    
    // Obter os dados da página atual
    const [rows] = await connection.query(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [limit, offset]);
    
    console.log(`Fetched ${rows?.length || 0} rows from ${config.tableName} for page ${page}`);
    
    return { 
      success: true, 
      data: rows || [],
      totalRecords: totalRecords,
      page: page,
      limit: limit
    };
  } catch (error) {
    console.error('Error fetching table data:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch table data',
      data: [],
      totalRecords: 0
    };
  } finally {
    // Apenas fechamos a conexão se NÃO for uma conexão monitorada
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('findTableMigrations', async (event, config) => {
  try {
    if (!config.projectPath || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing project path or table name',
        migrations: []
      };
    }

    const tableName = config.tableName;
    const migrationsPath = path.join(config.projectPath, 'database', 'migrations');
    
    // Verificar se o diretório de migrations existe
    if (!fs.existsSync(migrationsPath)) {
      return { 
        success: false, 
        message: 'Migrations directory not found',
        migrations: []
      };
    }

    // Ler todos os arquivos do diretório de migrations
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.php'));  // Filtra apenas arquivos PHP
    
    const relevantMigrations = [];
    
    // Para cada arquivo, verificar se contém referências à tabela
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Procurar referências à tabela no conteúdo do arquivo
      const tablePattern = new RegExp(`['"](${tableName})['"]|Schema::create\\(['"]${tableName}['"]|Schema::table\\(['"]${tableName}['"]`, 'i');
      
      if (tablePattern.test(content)) {
        // Extrair informações da migração do nome do arquivo
        const nameParts = file.split('_');
        const timestamp = nameParts[0];
        
        // Data formatada baseada no timestamp da migração (formato YYYY_MM_DD)
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        
        const dateString = `${year}-${month}-${day}`;
        const date = new Date(dateString);
        
        // Tenta extrair o nome da migração do arquivo
        let migrationName = file.replace(/^\d+_/, '').replace('.php', '');
        
        // Dessnakify o nome (converter create_users_table para Create Users Table)
        migrationName = migrationName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Determinar o tipo de ação com base no nome e conteúdo
        const actions = [];
        
        if (content.includes(`Schema::create('${tableName}'`) || content.includes(`Schema::create("${tableName}"`)) {
          actions.push({ type: 'CREATE', description: `Created ${tableName} table` });
        } else if (content.includes(`Schema::table('${tableName}'`) || content.includes(`Schema::table("${tableName}"`)) {
          actions.push({ type: 'ALTER', description: `Modified ${tableName} table` });
          
          // Checar se adiciona colunas
          if (content.includes('->add') || content.match(/\$table->\w+\(/g)) {
            actions.push({ type: 'ADD', description: 'Added columns' });
          }
          
          // Checar se remove colunas
          if (content.includes('->drop') || content.includes('dropColumn')) {
            actions.push({ type: 'DROP', description: 'Removed columns' });
          }
          
          // Checar chaves estrangeiras
          if (content.includes('foreign') || content.includes('references')) {
            actions.push({ type: 'FOREIGN KEY', description: 'Modified foreign keys' });
          }
        }
        
        if (content.includes(`Schema::drop`) || content.includes('dropIfExists')) {
          actions.push({ type: 'DROP', description: `Dropped table` });
        }
        
        // Status da migração (assumimos que está aplicada se o arquivo existe)
        const status = 'APPLIED';
        
        // Adicionar à lista de migrações relevantes
        relevantMigrations.push({
          id: file,
          name: file,
          displayName: migrationName,
          status: status,
          created_at: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          table: tableName,
          actions: actions,
          code: content,
          path: filePath
        });
      }
    }
    
    // Ordenar migrações por data (mais recente primeiro)
    relevantMigrations.sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return { 
      success: true, 
      migrations: relevantMigrations
    };
  } catch (error) {
    console.error('Error finding table migrations:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to find table migrations',
      migrations: []
    };
  }
});

ipcMain.handle('openFile', async (event, filePath) => {
  try {
    // Lista de possíveis caminhos de IDEs populares
    const editors = [
      { name: 'PHPStorm', paths: [
        '/Applications/PhpStorm.app/Contents/MacOS/phpstorm',
        '/usr/local/bin/phpstorm',
        'C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe',
        'C:\\Program Files (x86)\\JetBrains\\PhpStorm\\bin\\phpstorm.exe'
      ]},
      { name: 'VSCode', paths: [
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
        '/usr/bin/code',
        '/usr/local/bin/code',
        'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
        'C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd',
        'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'
      ]},
      { name: 'Sublime Text', paths: [
        '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
        '/usr/local/bin/subl',
        'C:\\Program Files\\Sublime Text\\subl.exe',
        'C:\\Program Files (x86)\\Sublime Text\\subl.exe'
      ]}
    ];
    
    // Verificar se algum dos editores está disponível
    for (const editor of editors) {
      for (const editorPath of editor.paths) {
        try {
          if (fs.existsSync(editorPath)) {
            console.log(`Opening file with ${editor.name} at ${editorPath}`);
            const child = require('child_process').spawn(editorPath, [filePath], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            return { success: true, editor: editor.name };
          }
        } catch (e) {
          // Ignorar e tentar o próximo caminho
          console.log(`Failed to open with ${editor.name} at ${editorPath}: ${e.message}`);
        }
      }
    }
    
    // Se nenhum editor específico for encontrado, use o aplicativo padrão
    console.log('No specific IDE found, using default application');
    await shell.openPath(filePath);
    return { success: true, editor: 'default' };
  } catch (error) {
    console.error('Failed to open file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getTableStructure', async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    // Se recebermos apenas o connectionId, precisamos buscar os detalhes da conexão
    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      console.log(`Getting connection details for table structure, ID: ${config.connectionId}`);
      const connections = store.get('connections') || [];
      const connectionDetails = connections.find(conn => conn.id === config.connectionId);
      
      if (!connectionDetails) {
        return { 
          success: false, 
          message: 'Connection not found',
          columns: []
        };
      }
      
      // Preencher os dados da conexão
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }
    
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        columns: []
      };
    }

    // Tentar usar uma conexão monitorada já existente
    let useMonitoredConnection = false;
    
    if (config.connectionId) {
      monitoredConnection = dbMonitoringConnections.get(config.connectionId);
      if (monitoredConnection) {
        console.log(`Using existing monitored connection for table structure: ${config.connectionId}`);
        connection = monitoredConnection;
        useMonitoredConnection = true;
      }
    }
    
    // Se não temos uma conexão monitorada, criamos uma nova
    if (!useMonitoredConnection) {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || '',
        database: config.database,
        connectTimeout: 10000
      });
    }

    // Escape table name to prevent SQL injection
    const tableName = connection.escapeId(config.tableName);
    const database = connection.escapeId(config.database);
    
    console.log(`Getting structure for ${config.database}.${config.tableName}`);
    
    // Get real table structure from information_schema
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME as name,
        COLUMN_TYPE as type,
        IS_NULLABLE = 'YES' as nullable,
        COLUMN_DEFAULT as \`default\`,
        COLUMN_KEY = 'PRI' as primary_key,
        COLUMN_KEY = 'UNI' as unique_key,
        EXTRA as extra
      FROM 
        information_schema.COLUMNS 
      WHERE 
        TABLE_SCHEMA = ? 
        AND TABLE_NAME = ?
      ORDER BY 
        ORDINAL_POSITION
    `, [config.database, config.tableName]);
    
    // Enhance columns with additional info about foreign keys
    const [foreignKeys] = await connection.query(`
      SELECT 
        COLUMN_NAME as column_name
      FROM 
        information_schema.KEY_COLUMN_USAGE
      WHERE 
        TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [config.database, config.tableName]);
    
    // Mark foreign key columns
    const foreignKeyColumns = new Set(foreignKeys.map(fk => fk.column_name));
    const enhancedColumns = columns.map(column => ({
      ...column,
      foreign_key: foreignKeyColumns.has(column.name)
    }));
    
    console.log(`Found ${enhancedColumns.length} columns for ${config.tableName}`);
    
    return { 
      success: true, 
      columns: enhancedColumns || []
    };
  } catch (error) {
    console.error('Error fetching table structure:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch table structure',
      columns: []
    };
  } finally {
    // Apenas fechamos a conexão se NÃO for uma conexão monitorada
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('getTableForeignKeys', async (event, config) => {
  try {
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        foreignKeys: []
      };
    }

    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      database: config.database,
      connectTimeout: 10000
    });

    // Get outgoing foreign keys (where this table references others)
    const [outgoingFKs] = await connection.query(`
      SELECT 
        k.CONSTRAINT_NAME as name,
        k.COLUMN_NAME as \`column\`,
        k.REFERENCED_TABLE_NAME as referenced_table,
        k.REFERENCED_COLUMN_NAME as referenced_column,
        rc.UPDATE_RULE as on_update,
        rc.DELETE_RULE as on_delete
      FROM 
        information_schema.KEY_COLUMN_USAGE k
      JOIN 
        information_schema.REFERENTIAL_CONSTRAINTS rc
        ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE 
        k.TABLE_SCHEMA = ? 
        AND k.TABLE_NAME = ?
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
    `, [config.database, config.tableName]);
    
    // Get incoming foreign keys (where other tables reference this table)
    const [incomingFKs] = await connection.query(`
      SELECT 
        k.CONSTRAINT_NAME as name,
        k.TABLE_NAME as \`table\`,
        k.COLUMN_NAME as \`column\`,
        k.REFERENCED_COLUMN_NAME as referenced_column,
        rc.UPDATE_RULE as on_update,
        rc.DELETE_RULE as on_delete
      FROM 
        information_schema.KEY_COLUMN_USAGE k
      JOIN 
        information_schema.REFERENTIAL_CONSTRAINTS rc
        ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE 
        k.TABLE_SCHEMA = ? 
        AND k.REFERENCED_TABLE_NAME = ?
    `, [config.database, config.tableName]);
    
    // Format outgoing FKs
    const outgoing = outgoingFKs.map(fk => ({
      ...fk,
      type: 'outgoing'
    }));
    
    // Format incoming FKs
    const incoming = incomingFKs.map(fk => ({
      ...fk,
      type: 'incoming'
    }));
    
    // Combine both types
    const allForeignKeys = [...outgoing, ...incoming];
    
    console.log(`Found ${outgoing.length} outgoing and ${incoming.length} incoming foreign keys for ${config.tableName}`);
    
    return { 
      success: true, 
      foreignKeys: allForeignKeys
    };
  } catch (error) {
    console.error('Error fetching foreign keys:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch foreign keys',
      foreignKeys: []
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

// Project logs handlers
ipcMain.handle('get-project-logs', async (event, config) => {
  try {
    console.log('Getting project logs with config:', config);
    
    if (!config || !config.projectPath) {
      console.log('No project path provided');
      return [];
    }

    const logsPath = path.join(config.projectPath, 'storage', 'logs');
    console.log('Looking for logs in:', logsPath);
    
    if (!fs.existsSync(logsPath)) {
      console.error('Logs directory not found at:', logsPath);
      return [];
    }

    // Get all files
    const allFiles = fs.readdirSync(logsPath);
    console.log('All files in logs directory:', allFiles);
    
    const logFiles = allFiles.filter(file => file.endsWith('.log'));
    console.log('Log files found:', logFiles);
    
    if (logFiles.length === 0) {
      console.log('No log files found');
      return [];
    }

    // Determine which log file to read
    let logFilePath;
    let logFileName;
    
    if (logFiles.includes('laravel.log')) {
      logFileName = 'laravel.log';
      logFilePath = path.join(logsPath, logFileName);
      console.log('Using laravel.log file');
    } else {
      // Check for daily log files (Laravel can be configured to use daily logs)
      const dailyLogPattern = /laravel-\d{4}-\d{2}-\d{2}\.log/;
      const dailyLogFiles = logFiles.filter(file => dailyLogPattern.test(file));
      
      if (dailyLogFiles.length > 0) {
        // Sort by date descending to get the most recent
        dailyLogFiles.sort().reverse();
        logFileName = dailyLogFiles[0];
        logFilePath = path.join(logsPath, logFileName);
        console.log('Using daily log file:', logFileName);
      } else {
        // Fallback to any log file
        logFileName = logFiles[0];
        logFilePath = path.join(logsPath, logFileName);
        console.log('Using first available log file:', logFileName);
      }
    }
    
    console.log('Reading log file from:', logFilePath);
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    
    if (!logContent || logContent.trim() === '') {
      console.log('Log file is empty');
      return [];
    }
    
    console.log('Log content length:', logContent.length);
    
    // Very simple parsing approach - just split by lines and parse each line
    const lines = logContent.split('\n');
    console.log(`Found ${lines.length} lines in log file`);
    
    // Display first few lines to help with debugging
    console.log('First 5 lines of log:');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i+1}: "${lines[i]}"`);
    }
    
    // Simple parser that works with various Laravel log formats
    const logEntries = [];
    let currentEntry = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this is a new log entry by looking for the timestamp pattern
      // Laravel logs usually start with a timestamp in brackets
      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}\.?\d*(?:[\+-]\d{4})?)\]/);
      
      if (timestampMatch) {
        // If we have a current entry, add it to the results before starting new one
        if (currentEntry) {
          logEntries.push(currentEntry);
        }
        
        // Try to determine log type from the line
        let type = 'info';
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
          type = 'error';
        } else if (line.toLowerCase().includes('warning')) {
          type = 'warning';
        } else if (line.toLowerCase().includes('debug')) {
          type = 'debug';
        } else if (line.toLowerCase().includes('info')) {
          type = 'info';
        }
        
        // Start a new entry
        currentEntry = {
          id: `log_${Date.now()}_${i}`,
          timestamp: new Date(timestampMatch[1]).getTime(),
          type: type.toLowerCase(),
          message: line, // Store the whole line as message initially
          stack: null,
          file: logFileName
        };
      } else if (currentEntry) {
        // This is a continuation of the previous entry
        if (line.includes('Stack trace:')) {
          currentEntry.stack = '';
        } else if (currentEntry.stack !== null) {
          currentEntry.stack += line + '\n';
        } else {
          // Append to the message
          currentEntry.message += '\n' + line;
        }
      }
    }
    
    // Don't forget the last entry
    if (currentEntry) {
      logEntries.push(currentEntry);
    }
    
    console.log(`Parsed ${logEntries.length} log entries`);
    
    // If no entries were found, provide a single entry with raw file content sample
    if (logEntries.length === 0) {
      console.log('No parsable log entries found, providing raw sample');
      
      const sampleContent = logContent.substring(0, Math.min(500, logContent.length));
      return [{
        id: `log_raw_${Date.now()}`,
        timestamp: Date.now(),
        type: 'info',
        message: 'Raw log content sample:\n\n' + sampleContent,
        stack: null,
        file: logFileName
      }];
    }
    
    return logEntries;
  } catch (error) {
    console.error('Error reading project logs:', error);
    return [{
      id: `log_error_${Date.now()}`,
      timestamp: Date.now(),
      type: 'error',
      message: `Error reading logs: ${error.message}`,
      stack: error.stack,
      file: 'error'
    }];
  }
});

ipcMain.handle('delete-project-log', async (event, logId) => {
  // In a real implementation, this would delete the specific log entry
  // This is a stub as we can't easily delete a specific log from a log file
  // without rewriting the entire file
  console.log('Delete log requested for:', logId);
  return { success: true };
});

ipcMain.handle('clear-all-project-logs', async (event, config) => {
  try {
    if (!config || !config.projectPath) {
      return { success: false, message: 'No project path provided' };
    }

    const logsPath = path.join(config.projectPath, 'storage', 'logs');
    
    if (!fs.existsSync(logsPath)) {
      return { success: false, message: 'Logs directory not found' };
    }

    // Get all log files
    const logFiles = fs.readdirSync(logsPath)
      .filter(file => file.endsWith('.log'));
    
    if (logFiles.length === 0) {
      return { success: true, message: 'No log files found' };
    }

    console.log(`Clearing ${logFiles.length} log files in ${logsPath}`);
    
    // Clear each log file (write an empty string to it)
    let clearedCount = 0;
    for (const logFile of logFiles) {
      try {
        const logFilePath = path.join(logsPath, logFile);
        console.log(`Clearing log file: ${logFilePath}`);
        fs.writeFileSync(logFilePath, '', 'utf8');
        clearedCount++;
      } catch (fileError) {
        console.error(`Error clearing log file ${logFile}:`, fileError);
      }
    }
    
    return { 
      success: true, 
      message: `Cleared ${clearedCount} log files`, 
      clearedFiles: clearedCount 
    };
  } catch (error) {
    console.error('Error clearing project logs:', error);
    return { success: false, message: error.message };
  }
});

// Database monitoring
const dbMonitoringConnections = new Map();
const dbActivityConnections = new Map();  // Nova estrutura para conexões de monitoramento via triggers

function setupMonitoring(connection, monitoredTables) {
  if (!connection) return false;

  // Verificar se a conexão já foi modificada para evitar sobreposição
  if (connection._isMonitored) {
    console.log('[MONITOR] This connection is already being monitored');
    return true;
  }

  // Iniciar monitoramento real-time com polling
  startProcessListPolling(connection);
  
  // Marcar conexão como monitorada
  connection._isMonitored = true;
  
  return true;
}

// Nova função para monitorar o banco por meio de polling do process list
async function startProcessListPolling(connection) {
  if (!connection || !connection._config) {
    console.error('[MONITOR] Invalid connection for process list polling');
    return false;
  }
  
  const connectionId = connection._config.connectionId;
  
  console.log(`[MONITOR] Starting process list polling for connection ${connectionId}`);
  
  // Cache de queries já processadas (para evitar duplicatas)
  connection._processedQueries = new Set();
  
  // Função que executa o polling
  const pollProcessList = async () => {
    if (!dbMonitoringConnections.has(connectionId)) {
      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }
      console.log(`[MONITOR] Polling stopped for connection ${connectionId}`);
      return;
    }
    
    try {
      // Consultar a lista de processos em execução
      const [processList] = await connection.query(`
        SELECT 
          id,
          user,
          host,
          db,
          command,
          time,
          state,
          info
        FROM information_schema.processlist
        WHERE info IS NOT NULL 
          AND info NOT LIKE '%information_schema.processlist%'
          AND command != 'Sleep'
      `);
      
      // Processar cada processo
      for (const process of processList) {
        // Ignorar processos sem informação
        if (!process.info) continue;
        
        // Identificar SQL
        const sql = process.info;
        
        // Criar um hash para identificar a query (para evitar duplicatas)
        const queryHash = require('crypto')
          .createHash('md5')
          .update(`${process.id}-${sql}`)
          .digest('hex');
        
        // Se já processamos esta query recentemente, pular
        if (connection._processedQueries.has(queryHash)) {
          continue;
        }
        
        // Adicionar à lista de queries processadas
        connection._processedQueries.add(queryHash);
        
        // Limitar o tamanho do cache
        if (connection._processedQueries.size > 100) {
          // Limpar primeiro terço do cache para evitar crescimento descontrolado
          const itemsToDelete = Array.from(connection._processedQueries).slice(0, 30);
          for (const item of itemsToDelete) {
            connection._processedQueries.delete(item);
          }
        }
        
        // Extrair informações da query
        let operation = 'QUERY';
        let tableName = 'unknown';
        
        // Identificar a operação e tabela
        const firstWord = sql.trim().split(' ')[0].toUpperCase();
        
        if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'].includes(firstWord)) {
          operation = firstWord;
          
          // Expressões regulares para extrair tabelas de diferentes operações
          if (operation === 'SELECT') {
            // SELECT ... FROM table
            const match = sql.match(/FROM\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, '');
            }
          } else if (operation === 'INSERT') {
            // INSERT INTO table
            const match = sql.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, '');
            }
          } else if (operation === 'UPDATE') {
            // UPDATE table
            const match = sql.match(/UPDATE\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, '');
            }
          } else if (operation === 'DELETE') {
            // DELETE FROM table
            const match = sql.match(/DELETE\s+FROM\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, '');
            }
          } else if (['CREATE', 'ALTER', 'DROP', 'TRUNCATE'].includes(operation)) {
            // CREATE/ALTER/DROP/TRUNCATE TABLE table
            const match = sql.match(/(CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[2]) {
              tableName = match[2].replace(/`/g, '');
            }
          }
        }
        
        // Verificar se devemos ignorar esta tabela (tabelas do sistema)
        const systemTables = ['information_schema', 'performance_schema', 'mysql'];
        if (systemTables.includes(tableName.toLowerCase())) {
          continue;
        }
        
        // Verificar se estamos na base de dados correta
        if (process.db && process.db !== connection._config.database) {
          continue;
        }
        
        // Preparar o objeto da mensagem
        const message = {
          timestamp: Date.now(),
          operation: operation,
          table: tableName,
          sql: sql,
          process_id: process.id,
          user: process.user,
          affectedRows: null, // Não temos esta informação no process list
          execution_time: process.time,
          state: process.state
        };
        
        // Enviar a mensagem para o front-end
        if (mainWindow) {
          console.log(`[MONITOR] Sending operation: ${operation} on ${tableName}`);
          mainWindow.webContents.send(`db-operation-${connectionId}`, message);
        }
      }
    } catch (error) {
      console.error('[MONITOR] Error polling process list:', error);
    }
  };
  
  // Executar imediatamente para testar
  try {
    await pollProcessList();
  } catch (error) {
    console.error('[MONITOR] Error during initial process list polling:', error);
  }
  
  // Configurar intervalo de polling (a cada 1 segundo)
  const pollingInterval = setInterval(pollProcessList, 1000);
  connection._pollingInterval = pollingInterval;
  
  return true;
}

ipcMain.handle('start-db-monitoring', async (event, connectionId) => {
  let connection = null;
  const activityLogTable = 'larabase_db_activity_log';
  
  try {
    console.log(`Starting database monitoring for connection ${connectionId}`);
    
    // Validar connectionId
    if (!connectionId) {
      console.error('ConnectionId inválido ou não fornecido');
      return { success: false, message: 'ID de conexão inválido' };
    }
    
    // Limpar conexão anterior se existir
    if (dbMonitoringConnections.has(connectionId)) {
      try {
        const existingConnection = dbMonitoringConnections.get(connectionId);
        if (existingConnection) {
          console.log(`Closing existing monitoring connection for ${connectionId}`);
          await existingConnection.end();
        }
        dbMonitoringConnections.delete(connectionId);
      } catch (err) {
        console.error(`Error closing previous connection:`, err);
      }
    }
    
    // Obter detalhes da conexão
    const connections = store.get('connections') || [];
    const connection = connections.find(conn => conn.id === connectionId);
    
    if (!connection) {
      console.error(`Connection ID ${connectionId} not found`);
      return { success: false, message: 'Connection not found' };
    }
    
    console.log(`Connection found: ${connection.name}`);
    console.log(`Details: ${connection.host}:${connection.port}/${connection.database}`);
    
    // Verificar se temos todas as informações necessárias
    if (!connection.host || !connection.port || !connection.username || !connection.database) {
      return { success: false, message: 'Incomplete connection information' };
    }
    
    // Criar conexão ao banco de dados
    const dbConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: connection.password || '',
      database: connection.database,
      dateStrings: true,
      multipleStatements: true // Habilitar múltiplas instruções para criar triggers mais complexos
    });
    
    console.log(`Connection established to ${connection.database}`);
    
    // Testar a conexão
    console.log('Testing connection...');
    await dbConnection.query('SELECT 1');
    console.log('Connection test successful');
    
    // Criar tabela de log se não existir - esquema melhorado
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
    
    console.log(`Activity log table created/verified: ${activityLogTable}`);
    
    // Obter lista de tabelas
    const [tables] = await dbConnection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_name != '${activityLogTable}'
        AND table_type = 'BASE TABLE'
    `, [connection.database]);
    
    console.log(`Found ${tables.length} tables to monitor in ${connection.database}`);
    
    // Criar triggers para cada tabela
    let triggersCreated = 0;
    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;
      
      try {
        console.log(`Setting up triggers for table ${tableName}`);
        
        // Remover triggers existentes
        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_insert`);
        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_update`);
        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_delete`);
        
        // Obter colunas da tabela
        const [columns] = await dbConnection.query(`
          SELECT COLUMN_NAME, COLUMN_KEY
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [connection.database, tableName]);
        
        // Extrair nomes das colunas
        const columnNames = columns.map(col => col.COLUMN_NAME || col.column_name);
        
        // Encontrar chave primária ou coluna ID
        const primaryKeyColumn = columns.find(col => 
          (col.COLUMN_KEY === 'PRI') || 
          ['id', 'uuid', 'key'].includes(col.COLUMN_NAME.toLowerCase())
        );
        
        // Determinar como identificar registros
        let idRef, oldIdRef;
        
        if (primaryKeyColumn) {
          const idColumn = primaryKeyColumn.COLUMN_NAME;
          idRef = `COALESCE(NEW.\`${idColumn}\`, 'unknown')`;
          oldIdRef = `COALESCE(OLD.\`${idColumn}\`, 'unknown')`;
          console.log(`Using primary key column: ${idColumn} for table ${tableName}`);
        } else if (columnNames.length > 0) {
          // Usar primeira coluna se não tiver ID
          idRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(NEW.\`${columnNames[0]}\`, 'null'))`;
          oldIdRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(OLD.\`${columnNames[0]}\`, 'null'))`;
          console.log(`Using first column: ${columnNames[0]} for table ${tableName}`);
        } else {
          idRef = "'unknown'";
          oldIdRef = "'unknown'";
          console.log(`No suitable identifier column found for table ${tableName}`);
        }
        
        // Selecionar as primeiras colunas para previsualização (no máximo 5)
        const previewColumns = columnNames.slice(0, 5);
        
        // Preview strings para inserções
        const insertPreview = previewColumns.map(col => 
          `'${col}: ', COALESCE(NEW.\`${col}\`, 'null')`
        ).join(", ' | ', ");
        
        // Preview strings para atualizações
        const updatePreviewParts = previewColumns.map(col => 
          `IF(
            (OLD.\`${col}\` IS NULL AND NEW.\`${col}\` IS NOT NULL) OR 
            (OLD.\`${col}\` IS NOT NULL AND NEW.\`${col}\` IS NULL) OR 
            (OLD.\`${col}\` <> NEW.\`${col}\`), 
            CONCAT('${col}: ', COALESCE(OLD.\`${col}\`, 'null'), ' → ', COALESCE(NEW.\`${col}\`, 'null')), 
            NULL
          )`
        );
        const updatePreview = `CONCAT_WS(', ', ${updatePreviewParts.join(', ')})`;
        
        // Preview strings para exclusões
        const deletePreview = previewColumns.map(col => 
          `'${col}: ', COALESCE(OLD.\`${col}\`, 'null')`
        ).join(", ' | ', ");
        
        // Criar trigger para INSERT
        await dbConnection.query(`
          CREATE TRIGGER ${tableName}_after_insert
          AFTER INSERT ON ${tableName}
          FOR EACH ROW
          BEGIN
            SET @details = CONCAT('New record: ', ${insertPreview});
            
            INSERT INTO ${activityLogTable} (
              action_type, 
              table_name, 
              record_id, 
              details
            )
            VALUES (
              'INSERT', 
              '${tableName}', 
              ${idRef}, 
              @details
            );
          END;
        `);
        
        // Criar trigger para UPDATE
        await dbConnection.query(`
          CREATE TRIGGER ${tableName}_after_update
          AFTER UPDATE ON ${tableName}
          FOR EACH ROW
          BEGIN
            SET @changes = ${updatePreview};
            
            IF @changes IS NOT NULL AND @changes != '' THEN
              INSERT INTO ${activityLogTable} (
                action_type, 
                table_name, 
                record_id, 
                details
              )
              VALUES (
                'UPDATE', 
                '${tableName}', 
                ${idRef}, 
                CONCAT('Changed: ', @changes)
              );
            END IF;
          END;
        `);
        
        // Criar trigger para DELETE
        await dbConnection.query(`
          CREATE TRIGGER ${tableName}_after_delete
          AFTER DELETE ON ${tableName}
          FOR EACH ROW
          BEGIN
            SET @details = CONCAT('Deleted: ', ${deletePreview});
            
            INSERT INTO ${activityLogTable} (
              action_type, 
              table_name, 
              record_id, 
              details
            )
            VALUES (
              'DELETE', 
              '${tableName}', 
              ${oldIdRef}, 
              @details
            );
          END;
        `);
        
        triggersCreated += 3;
        console.log(`Successfully created triggers for table ${tableName}`);
      } catch (triggerError) {
        console.error(`Error creating triggers for table ${tableName}:`, triggerError);
      }
    }
    
    console.log(`Created ${triggersCreated} triggers across ${tables.length} tables`);
    
    // Obter atividades iniciais
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
    
    console.log(`Found ${initialActivities.length} initial activities`);
    
    // Armazenar a conexão para uso posterior
    dbMonitoringConnections.set(connectionId, dbConnection);
    
    // Enviar as atividades iniciais para o frontend
    if (mainWindow) {
      initialActivities.forEach(activity => {
        mainWindow.webContents.send(`db-operation-${connectionId}`, activity);
      });
      
      // Enviar mensagem informativa
      mainWindow.webContents.send(`db-operation-${connectionId}`, {
        timestamp: Date.now(),
        type: 'INFO',
        table: 'system',
        message: 'Database monitoring started successfully'
      });
    }
    
    // Iniciar polling para novas atividades
    const lastId = initialActivities.length > 0 ? initialActivities[0].id : 0;
    startActivityPolling(connectionId, dbConnection, activityLogTable, lastId);
    
    return { success: true, message: 'Monitoring started successfully' };
  } catch (error) {
    console.error('Error setting up database monitoring:', error);
    
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
    
    return { success: false, message: error.message || 'Unknown error setting up monitoring' };
  }
});

// Função para iniciar polling de atividades
function startActivityPolling(connectionId, connection, activityLogTable, lastId) {
  console.log(`Starting activity polling for connection ${connectionId}, last ID: ${lastId}`);
  
  // Armazenar o último ID processado
  connection._lastActivityId = lastId;
  
  // Função para buscar novas atividades
  const pollActivities = async () => {
    // Verificar se a conexão ainda está ativa
    if (!dbMonitoringConnections.has(connectionId)) {
      console.log(`Polling stopped for connection ${connectionId}`);
      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }
      return;
    }
    
    try {
      // Buscar novas atividades
      const [activities] = await connection.query(`
        SELECT 
          id,
          action_type as type,
          table_name as \`table\`,
          record_id as recordId,
          details,
          created_at as timestamp
        FROM ${activityLogTable}
        WHERE id > ?
        ORDER BY id ASC
        LIMIT 50
      `, [connection._lastActivityId]);
      
      if (activities.length > 0) {
        console.log(`Found ${activities.length} new activities, types: ${activities.map(a => a.type).join(', ')}`);
        
        // Atualizar o último ID
        connection._lastActivityId = activities[activities.length - 1].id;
        
        // Enviar atividades para o frontend
        if (mainWindow) {
          activities.forEach(activity => {
            // Garantir que todas as propriedades existam
            const formattedActivity = {
              ...activity,
              timestamp: activity.timestamp || new Date().toISOString(),
              recordId: activity.recordId || 'unknown',
              details: activity.details || 'No details available'
            };
            
            mainWindow.webContents.send(`db-operation-${connectionId}`, formattedActivity);
          });
        }
      }
    } catch (error) {
      console.error('Error polling activities:', error);
    }
  };
  
  // Executar imediatamente e então a cada 1 segundo (mais rápido para melhor responsividade)
  pollActivities();
  connection._pollingInterval = setInterval(pollActivities, 1000);
}

ipcMain.handle('stop-db-monitoring', async (event, connectionId) => {
  try {
    console.log(`Stopping database monitoring for ${connectionId}`);
    
    const connection = dbMonitoringConnections.get(connectionId);
    
    if (!connection) {
      return { success: false, message: 'Not monitoring this connection' };
    }
    
    // Limpar polling
    if (connection._pollingInterval) {
      clearInterval(connection._pollingInterval);
      connection._pollingInterval = null;
    }
    
    // Fechar conexão
    await connection.end();
    
    // Remover do mapa
    dbMonitoringConnections.delete(connectionId);
    
    return { success: true, message: 'Monitoring stopped' };
  } catch (error) {
    console.error('Error stopping database monitoring:', error);
    return { success: false, message: error.message };
  }
});

// Novo método para monitorar mudanças no banco de dados usando triggers
ipcMain.handle('monitor-database-changes', async (event, connectionDetails) => {
  let connection = null;
  let triggerConnection = null;
  const activityLogTable = 'larabase_db_activity_log';
  const connectionId = connectionDetails.id || connectionDetails.connectionId;
  
  try {
    console.log(`Setting up trigger-based monitoring for connection ${connectionId}`);
    
    // Validar parâmetros
    if (!connectionDetails || !connectionDetails.database) {
      console.error('Database name is required for monitoring');
      return { success: false, message: 'Database name is required' };
    }
    
    // Limpar conexão anterior se existir
    if (dbActivityConnections.has(connectionId)) {
      try {
        const existingConnection = dbActivityConnections.get(connectionId);
        if (existingConnection.connection) {
          console.log(`Closing existing activity monitoring connection for ${connectionId}`);
          await existingConnection.connection.end();
        }
        if (existingConnection.triggerConnection) {
          await existingConnection.triggerConnection.end();
        }
        dbActivityConnections.delete(connectionId);
      } catch (err) {
        console.error(`Error closing previous activity monitoring connection:`, err);
      }
    }
    
    const database = String(connectionDetails.database);
    
    console.log(`Creating connection to ${connectionDetails.host}:${connectionDetails.port}/${database}`);
    
    // Obter detalhes da conexão
    let host, port, user, password;
    
    if (connectionDetails.host) {
      // Se os detalhes já estão fornecidos diretamente
      host = String(connectionDetails.host || '');
      port = Number(connectionDetails.port || 3306);
      user = String(connectionDetails.username || connectionDetails.user || '');
      password = String(connectionDetails.password || '');
    } else {
      // Se apenas o ID foi fornecido, buscar os detalhes do store
      const connections = store.get('connections') || [];
      const storedConnection = connections.find(conn => conn.id === connectionId);
      
      if (!storedConnection) {
        console.error(`Connection ID ${connectionId} not found in stored connections`);
        return { success: false, message: 'Connection not found' };
      }
      
      host = String(storedConnection.host || '');
      port = Number(storedConnection.port || 3306);
      user = String(storedConnection.username || '');
      password = String(storedConnection.password || '');
    }
    
    const connOptions = {
      host: host,
      port: port,
      user: user,
      password: password,
      database: database,
      dateStrings: true
    };
    
    console.log(`Connecting to MySQL for activity monitoring: ${host}:${port}/${database}`);
    
    // Criar conexão principal
    connection = await mysql.createConnection(connOptions);
    
    console.log(`Creating activity log table ${activityLogTable}`);
    
    // Criar tabela de log de atividades se não existir
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${activityLogTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        record_id VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(`Getting list of tables in ${database}`);
    
    // Obter lista de tabelas para criar triggers
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_name != '${activityLogTable}'
        AND table_type = 'BASE TABLE'
    `, [database]);
    
    console.log(`Found ${tables.length} tables to monitor`);
    
    // Criar triggers para cada tabela
    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;
      
      try {
        console.log(`Setting up triggers for table ${tableName}`);
        
        // Remover triggers existentes
        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_insert`).catch(() => {});
        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_update`).catch(() => {});
        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_delete`).catch(() => {});
        
        // Obter colunas da tabela
        const [columns] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `, [database, tableName]);
        
        // Extrair nomes das colunas
        const columnNames = columns.map(col => col.COLUMN_NAME || col.column_name);
        const hasId = columnNames.some(name => 
          name.toLowerCase() === 'id' || 
          name.toLowerCase() === 'uuid' || 
          name.toLowerCase() === 'key'
        );
        
        // Determinar como identificar registros
        let idRef = '';
        if (hasId) {
          idRef = `CONCAT_WS('', 
            ${columnNames.filter(c => ['id', 'uuid', 'key'].includes(c.toLowerCase()))
              .map(c => `NEW.${c}`).join(', ')}
          )`;
        } else if (columnNames.length > 0) {
          idRef = `CONCAT('Row with ${columnNames[0]}=', NEW.${columnNames[0]})`;
        } else {
          idRef = "'unknown'";
        }
        
        // Referência para OLD em operações DELETE
        let oldIdRef = '';
        if (hasId) {
          oldIdRef = `CONCAT_WS('', 
            ${columnNames.filter(c => ['id', 'uuid', 'key'].includes(c.toLowerCase()))
              .map(c => `OLD.${c}`).join(', ')}
          )`;
        } else if (columnNames.length > 0) {
          oldIdRef = `CONCAT('Row with ${columnNames[0]}=', OLD.${columnNames[0]})`;
        } else {
          oldIdRef = "'unknown'";
        }
        
        // Selecionar as primeiras colunas para previsualização
        const previewColumns = columnNames.slice(0, 4);
        
        // Preview strings para inserções
        const insertPreview = previewColumns.map(col => 
          `'${col}: ', NEW.\`${col}\``
        ).join(", ', | ', ");
        
        // Preview strings para atualizações
        const updatePreviewParts = previewColumns.map(col => 
          `IF(OLD.\`${col}\` <> NEW.\`${col}\`, CONCAT('${col}: ', OLD.\`${col}\`, ' → ', NEW.\`${col}\`), NULL)`
        );
        const updatePreview = `CONCAT_WS(', ', ${updatePreviewParts.join(', ')})`;
        
        // Preview strings para exclusões
        const deletePreview = previewColumns.map(col => 
          `'${col}: ', OLD.\`${col}\``
        ).join(", ', | ', ");
        
        // Criar trigger para INSERT
        await connection.query(`
          CREATE TRIGGER ${tableName}_after_insert
          AFTER INSERT ON ${tableName}
          FOR EACH ROW
          BEGIN
            INSERT INTO ${activityLogTable} (action_type, table_name, record_id, details)
            VALUES ('INSERT', '${tableName}', ${idRef}, CONCAT('New record: ', ${insertPreview}));
          END;
        `);
        
        // Criar trigger para UPDATE
        await connection.query(`
          CREATE TRIGGER ${tableName}_after_update
          AFTER UPDATE ON ${tableName}
          FOR EACH ROW
          BEGIN
            DECLARE changes TEXT;
            SET changes = ${updatePreview};
            
            -- Only log if there are actual changes
            IF changes IS NOT NULL AND changes != '' THEN
              INSERT INTO ${activityLogTable} (action_type, table_name, record_id, details)
              VALUES ('UPDATE', '${tableName}', ${idRef}, CONCAT('Changed: ', changes));
            END IF;
          END;
        `);
        
        // Criar trigger para DELETE
        await connection.query(`
          CREATE TRIGGER ${tableName}_after_delete
          AFTER DELETE ON ${tableName}
          FOR EACH ROW
          BEGIN
            INSERT INTO ${activityLogTable} (action_type, table_name, record_id, details)
            VALUES ('DELETE', '${tableName}', ${oldIdRef}, CONCAT('Deleted: ', ${deletePreview}));
          END;
        `);
        
        triggersCreated += 3;
        console.log(`Successfully created triggers for table ${tableName}`);
      } catch (triggerError) {
        console.error(`Error creating triggers for table ${tableName}:`, triggerError);
      }
    }
    
    console.log('Creating secondary connection for polling');
    
    // Criar uma conexão secundária para consultar mudanças
    triggerConnection = await mysql.createConnection(connOptions);
    
    // Obter atividades iniciais
    console.log('Fetching initial activities');
    const [initialActivities] = await connection.query(`
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
    
    console.log(`Retrieved ${initialActivities.length} initial activities`);
    
    // Armazenar as conexões para uso posterior
    dbActivityConnections.set(connectionId, {
      connection: connection,
      triggerConnection: triggerConnection,
      activityLogTable: activityLogTable,
      lastId: initialActivities.length > 0 ? initialActivities[0].id : 0
    });
    
    // Enviar notificação de monitoramento iniciado
    if (mainWindow) {
      mainWindow.webContents.send(`db-activity-${connectionId}`, {
        connectionId: connectionId,
        success: true,
        message: 'Trigger-based monitoring started',
        activities: initialActivities || []
      });
    }
    
    return { 
      success: true,
      message: 'Monitoring setup successfully',
      activityLogTable,
      activities: initialActivities || []
    };
  } catch (error) {
    console.error('Error setting up database monitoring:', error);
    
    // Fechar conexões em caso de erro
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing monitoring setup connection:', err);
      }
    }
    
    if (triggerConnection) {
      try {
        await triggerConnection.end();
      } catch (err) {
        console.error('Error closing trigger connection:', err);
      }
    }
    
    return { 
      success: false, 
      message: error.message || 'Unknown error setting up monitoring'
    };
  }
});

// Método para obter mudanças desde a última verificação
ipcMain.handle('get-database-changes', async (event, connectionId, lastId = 0) => {
  try {
    console.log(`Getting database changes for connection ${connectionId}, lastId: ${lastId}`);
    
    // Verificar se temos uma conexão ativa para este ID
    const connectionData = dbActivityConnections.get(connectionId);
    
    if (!connectionData || !connectionData.triggerConnection) {
      console.error(`No active monitoring connection found for ${connectionId}`);
      return { success: false, message: 'No active monitoring for this connection' };
    }
    
    const { triggerConnection, activityLogTable } = connectionData;
    
    // Se não for fornecido um lastId, usar o último ID registrado
    if (!lastId) {
      lastId = connectionData.lastId || 0;
    }
    
    console.log(`Querying for activities with ID > ${lastId}`);
    
    // Consultar atividades novas
    const [activities] = await triggerConnection.query(`
      SELECT 
        id,
        action_type as type,
        table_name as \`table\`,
        record_id as recordId,
        details,
        created_at as timestamp
      FROM ${activityLogTable}
      WHERE id > ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [lastId]);
    
    console.log(`Found ${activities.length} new activities`);
    
    // Atualizar o último ID se houver novos registros
    if (activities.length > 0) {
      connectionData.lastId = Math.max(...activities.map(a => a.id));
      console.log(`Updated lastId to ${connectionData.lastId}`);
    }
    
    return { 
      success: true, 
      activities: activities || [] 
    };
  } catch (error) {
    console.error('Error getting database changes:', error);
    return { 
      success: false, 
      message: error.message || 'Unknown error getting changes'
    };
  }
});

// Método para parar o monitoramento baseado em triggers
ipcMain.handle('stop-trigger-monitoring', async (event, connectionId) => {
  try {
    console.log(`Stopping trigger-based monitoring for connection ${connectionId}`);
    
    const connectionData = dbActivityConnections.get(connectionId);
    
    if (!connectionData) {
      console.log(`No monitoring data found for connection ${connectionId}`);
      return { success: false, message: 'Not monitoring this connection' };
    }
    
    // Fechar conexões
    if (connectionData.connection) {
      await connectionData.connection.end();
    }
    
    if (connectionData.triggerConnection) {
      await connectionData.triggerConnection.end();
    }
    
    // Remover do mapa
    dbActivityConnections.delete(connectionId);
    
    console.log(`Trigger-based monitoring stopped for ${connectionId}`);
    
    return { success: true, message: 'Monitoring stopped' };
  } catch (error) {
    console.error(`Error stopping trigger-based monitoring for ${connectionId}:`, error);
    return { success: false, message: error.message };
  }
});

// Cleanup database monitoring connections when the app is closing
app.on('before-quit', async () => {
  // Close all monitoring connections
  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      await connection.end();
      console.log(`Closed monitoring connection for ${connectionId}`);
    } catch (error) {
      console.error(`Error closing monitoring connection for ${connectionId}:`, error);
    }
  }
  
  // Clear the map
  dbMonitoringConnections.clear();
  
  // Close all trigger-based monitoring connections
  for (const [connectionId, connectionData] of dbActivityConnections.entries()) {
    try {
      if (connectionData.connection) {
        await connectionData.connection.end();
      }
      if (connectionData.triggerConnection) {
        await connectionData.triggerConnection.end();
      }
      console.log(`Closed trigger-based monitoring connections for ${connectionId}`);
    } catch (error) {
      console.error(`Error closing trigger-based monitoring connections for ${connectionId}:`, error);
    }
  }
  
  // Clear the trigger connections map
  dbActivityConnections.clear();
});

// Novo manipulador para executar comandos SQL diretamente (para testes)
ipcMain.handle('execute-test-operations', async (event, connectionId) => {
  try {
    console.log(`Executing test operations for connection ${connectionId}`);
    
    if (!connectionId) {
      return { success: false, message: 'Connection ID is required' };
    }
    
    // Verificar se temos uma conexão ativa
    if (!dbMonitoringConnections.has(connectionId)) {
      console.error(`No active monitoring connection for ${connectionId}`);
      return { success: false, message: 'No active monitoring connection' };
    }
    
    const connection = dbMonitoringConnections.get(connectionId);
    
    // Criar uma tabela temporária para testes
    console.log('Creating temporary test table');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _larabase_test_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 1. INSERT - Inserir um registro
    console.log('Executing INSERT test');
    const [insertResult] = await connection.query(`
      INSERT INTO _larabase_test_table (title, description)
      VALUES ('Test Title', 'This is a test description')
    `);
    
    const insertId = insertResult.insertId;
    console.log(`Inserted record with ID ${insertId}`);
    
    // Pequena pausa para garantir que o trigger seja executado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 2. UPDATE - Atualizar o registro
    console.log('Executing UPDATE test');
    await connection.query(`
      UPDATE _larabase_test_table
      SET title = 'Updated Title', 
          description = 'Updated description',
          status = 'inactive'
      WHERE id = ?
    `, [insertId]);
    
    console.log(`Updated record with ID ${insertId}`);
    
    // Pequena pausa para garantir que o trigger seja executado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. DELETE - Excluir o registro
    console.log('Executing DELETE test');
    await connection.query(`
      DELETE FROM _larabase_test_table
      WHERE id = ?
    `, [insertId]);
    
    console.log(`Deleted record with ID ${insertId}`);
    
    // Verificar eventos capturados
    const [activityLogs] = await connection.query(`
      SELECT action_type, table_name, record_id, details 
      FROM larabase_db_activity_log 
      WHERE table_name = '_larabase_test_table'
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log('Activity logs:', activityLogs);
    
    return { 
      success: true, 
      message: 'Test operations executed successfully',
      operations: {
        insertId,
        activities: activityLogs.length,
        activityTypes: activityLogs.map(log => log.action_type)
      }
    };
  } catch (error) {
    console.error('Error executing test operations:', error);
    return { success: false, message: error.message };
  }
});

// Add this function after the other database-related IPC handlers

// Get database relationships for diagram visualization
ipcMain.handle('get-database-relationships', async (event, config) => {
  let connection;
  try {
    // Helper function to get connection details
    function getConnectionDetails(connectionId) {
      console.log(`Getting connection details for diagram, ID: ${connectionId}`);
      const connections = store.get('connections') || [];
      return connections.find(conn => conn.id === connectionId);
    }

    // Handle the case where only the connectionId is provided
    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      const connectionDetails = getConnectionDetails(config.connectionId);
      if (!connectionDetails) {
        console.error(`Connection details not found for ID: ${config.connectionId}`);
        return {
          success: false,
          message: 'Connection details not found'
        };
      }
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }

    // Validate required parameters
    if (!config.host || !config.port || !config.username || !config.database) {
      console.error('Missing connection parameters for diagram:', config);
      return {
        success: false,
        message: 'Missing required connection parameters'
      };
    }

    console.log(`Getting relationships from ${config.database}`);
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      multipleStatements: true
    });

    console.log('Connected to database successfully');

    // Query to get all foreign key constraints from information_schema
    const [rows] = await connection.query(`
      SELECT 
        TABLE_NAME AS sourceTable,
        COLUMN_NAME AS sourceColumn,
        REFERENCED_TABLE_NAME AS targetTable,
        REFERENCED_COLUMN_NAME AS targetColumn,
        CONSTRAINT_NAME AS constraintName
      FROM
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE
        REFERENCED_TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND REFERENCED_COLUMN_NAME IS NOT NULL
      ORDER BY
        TABLE_NAME, COLUMN_NAME;
    `, [config.database]);

    console.log(`Found ${rows.length} table relationships in ${config.database}`);
    
    // If no relationships were found, try to infer some basic relationships
    if (rows.length === 0) {
      console.log('No explicit relationships found. Attempting to infer relationships from naming patterns...');
      
      // Get all tables
      const [tables] = await connection.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? 
          AND table_type = 'BASE TABLE'
      `, [config.database]);
      
      // Get columns for all tables
      const inferredRelationships = [];
      
      for (const table of tables) {
        const tableName = table.table_name || table.TABLE_NAME;
        
        // Get columns for this table
        const [columns] = await connection.query(`
          SELECT 
            COLUMN_NAME as name,
            COLUMN_TYPE as type,
            COLUMN_KEY as \`key\`
          FROM 
            information_schema.COLUMNS 
          WHERE 
            TABLE_SCHEMA = ? 
            AND TABLE_NAME = ?
          ORDER BY 
            ORDINAL_POSITION
        `, [config.database, tableName]);
        
        // Look for columns that might be foreign keys based on naming patterns
        for (const column of columns) {
          const columnName = column.name;
          
          // Common patterns for foreign keys: id_*, *_id, *_fk
          if (columnName.endsWith('_id') || columnName.endsWith('_fk') || 
              (columnName.startsWith('id_') && columnName !== 'id')) {
              
            // Extract potential table name from column name
            let targetTable = null;
            
            if (columnName.endsWith('_id')) {
              // users_id -> users
              targetTable = columnName.substring(0, columnName.length - 3);
            } else if (columnName.endsWith('_fk')) {
              // users_fk -> users
              targetTable = columnName.substring(0, columnName.length - 3);
            } else if (columnName.startsWith('id_')) {
              // id_users -> users
              targetTable = columnName.substring(3);
            }
            
            // Check if this is a valid table in the database
            const targetExists = tables.some(t => 
              (t.table_name || t.TABLE_NAME).toLowerCase() === targetTable.toLowerCase()
            );
            
            if (targetExists) {
              // Add this as an inferred relationship
              inferredRelationships.push({
                sourceTable: tableName,
                sourceColumn: columnName,
                targetTable: targetTable,
                targetColumn: 'id', // assume the primary key is 'id'
                constraintName: `inferred_${tableName}_${columnName}`,
                inferred: true
              });
              
              console.log(`Inferred relationship: ${tableName}.${columnName} -> ${targetTable}.id`);
            }
          }
        }
      }
      
      // If we found inferred relationships, return those
      if (inferredRelationships.length > 0) {
        console.log(`Generated ${inferredRelationships.length} inferred relationships`);
        await connection.end();
        return inferredRelationships;
      }
    }

    // Close the connection
    if (connection) {
      await connection.end();
    }

    return rows;
  } catch (error) {
    console.error('Error getting database relationships:', error);
    
    // Close the connection if it exists
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
    
    return {
      success: false,
      message: error.message || 'Failed to get database relationships',
      error: error.toString()
    };
  }
}); 

// Handler to find Laravel models for tables
ipcMain.handle('find-models-for-tables', async (event, config) => {
  try {
    if (!config.projectPath) {
      return { 
        success: false, 
        message: 'Missing project path',
        models: {}
      };
    }

    // Common directories where models might be located in Laravel
    const modelDirs = [
      path.join(config.projectPath, 'app', 'Models'),
      path.join(config.projectPath, 'app')
    ];

    const foundModels = {};
    const modelFilesMap = {}; // Map to store all model files
    const allModelClasses = []; // Store all model classes for later matching

    // Scan for all PHP files in model directories
    for (const dir of modelDirs) {
      if (fs.existsSync(dir)) {
        // Function to read directory recursively
        const readDirRecursive = (directory) => {
          try {
            const entries = fs.readdirSync(directory, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(directory, entry.name);
              
              if (entry.isDirectory()) {
                readDirRecursive(fullPath);
              } else if (entry.name.endsWith('.php')) {
                try {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  
                  // Check if this is likely a model file
                  const isModel = content.includes('extends Model') || 
                                  content.includes('Illuminate\\Database\\Eloquent\\Model') ||
                                  content.includes('extends Authenticatable') ||
                                  content.includes('Illuminate\\Foundation\\Auth\\User') ||
                                  content.includes('Illuminate\\Contracts\\Auth\\Authenticatable');
                  
                  if (isModel) {
                    // Extract namespace and class name
                    const namespaceMatch = content.match(/namespace\s+([^;]+);/);
                    const classMatch = content.match(/class\s+(\w+)/);
                    
                    if (classMatch) {
                      const className = classMatch[1];
                      const namespace = namespaceMatch ? namespaceMatch[1] : null;
                      const fullName = namespace ? `${namespace}\\${className}` : className;
                      
                      // Store the model file
                      modelFilesMap[className.toLowerCase()] = {
                        name: className,
                        namespace: namespace,
                        fullName: fullName,
                        path: fullPath,
                        relativePath: path.relative(config.projectPath, fullPath),
                        content: content
                      };
                      
                      // Add to the list of model classes
                      allModelClasses.push({
                        name: className,
                        namespace: namespace,
                        fullName: fullName,
                        path: fullPath,
                        relativePath: path.relative(config.projectPath, fullPath),
                        content: content
                      });
                    }
                  }
                } catch (fileError) {
                  console.error(`Error processing file ${fullPath}:`, fileError);
                }
              }
            }
          } catch (dirError) {
            console.error(`Error reading directory ${directory}:`, dirError);
          }
        };
        
        readDirRecursive(dir);
      }
    }

    // Function to find matching tables through various methods
    const findTableForModel = (model) => {
      const content = model.content;
      const className = model.name;
      
      // Method 1: Check for explicit table declaration
      const tableMatch = content.match(/protected\s+\$table\s*=\s*['"](.*?)['"]/);
      if (tableMatch) {
        console.log(`Found explicit table name for ${className}: ${tableMatch[1]}`);
        return tableMatch[1];
      }
      
      // Method 2: Convert class name to snake_case and pluralize (Laravel convention)
      const snakeCase = className
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();
      
      // Pluralize using the pluralize library
      const tableName = pluralize.plural(snakeCase);
      console.log(`Generated table name for ${className}: ${tableName}`);
      
      return tableName;
    };

    // First pass: Process all models to detect their table names using explicit declarations or conventions
    for (const model of allModelClasses) {
      const tableName = findTableForModel(model);
      if (tableName) {
        foundModels[tableName] = {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          path: model.path,
          relativePath: model.relativePath
        };
      }
    }
    
    // Second pass: Create a reverse mapping for singular forms
    // This helps handle cases where table names don't follow standard pluralization
    for (const model of allModelClasses) {
      const modelObj = {
        name: model.name,
        namespace: model.namespace,
        fullName: model.fullName,
        path: model.path,
        relativePath: model.relativePath
      };
      
      // Convert class name to snake_case
      const snakeCase = model.name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();
      
      // Try both plural and singular forms to catch all possibilities
      const singularTable = pluralize.singular(snakeCase);
      const pluralTable = pluralize.plural(snakeCase);
      
      // Add to foundModels if not already mapped
      if (!foundModels[singularTable]) {
        foundModels[singularTable] = modelObj;
      }
      
      if (!foundModels[pluralTable]) {
        foundModels[pluralTable] = modelObj;
      }
      
      // Check for explicit table references in the content
      const content = model.content;
      const tableNameMatches = content.match(/table\s*=\s*['"]([^'"]+)['"]/g) || [];
      for (const tableNameMatch of tableNameMatches) {
        const extractedName = tableNameMatch.match(/['"]([^'"]+)['"]/);
        if (extractedName && extractedName[1] && !foundModels[extractedName[1]]) {
          foundModels[extractedName[1]] = modelObj;
        }
      }
    }

    // Third pass: Look for any special cases or manually defined mappings
    // This is where we'd handle custom table naming that doesn't follow Laravel conventions
    const specialCases = {
      // Add any manual mappings for edge cases
      // These will only be used if there isn't already a mapping
    };

    for (const [tableName, modelName] of Object.entries(specialCases)) {
      if (!foundModels[tableName] && modelFilesMap[modelName.toLowerCase()]) {
        foundModels[tableName] = modelFilesMap[modelName.toLowerCase()];
      }
    }

    console.log(`Found ${Object.keys(foundModels).length} model-table associations`);
    return { 
      success: true, 
      models: foundModels
    };
  } catch (error) {
    console.error('Error finding models:', error);
    return { success: false, message: error.message, models: {} };
  }
});

// Handler to read model file content
ipcMain.handle('read-model-file', async (event, filePath) => {
  try {
    if (!filePath) {
      return { 
        success: false, 
        message: 'Missing file path',
        content: null
      };
    }

    if (!fs.existsSync(filePath)) {
      return { 
        success: false, 
        message: 'File not found',
        content: null
      };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    return { 
      success: true, 
      content: content
    };
  } catch (error) {
    console.error('Error reading model file:', error);
    return { 
      success: false, 
      message: error.message,
      content: null
    };
  }
});

// Handler to list files in a directory
ipcMain.handle('list-files', async (event, dirPath) => {
  try {
    if (!dirPath) {
      return { 
        success: false, 
        message: 'Missing directory path',
        files: []
      };
    }

    if (!fs.existsSync(dirPath)) {
      return { 
        success: false, 
        message: 'Directory not found',
        files: []
      };
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
    
    return { 
      success: true, 
      files: files
    };
  } catch (error) {
    console.error('Error listing files:', error);
    return { 
      success: false, 
      message: error.message,
      files: []
    };
  }
});

// Add the handler for running artisan commands at an appropriate location
ipcMain.handle('run-artisan-command', async (event, config) => {
  try {
    if (!config.projectPath) {
      return { 
        success: false, 
        message: 'Project path is required',
        output: ''
      };
    }

    if (!config.command) {
      return {
        success: false,
        message: 'Command is required',
        output: ''
      };
    }

    const artisanPath = path.join(config.projectPath, 'artisan');
    if (!fs.existsSync(artisanPath)) {
      return {
        success: false,
        message: 'Artisan file not found in project path',
        output: ''
      };
    }

    // Generate a unique ID for this command execution
    const commandId = Date.now().toString();

    // Determine if we're using PHP directly or Sail
    let commandArgs = [];
    const hasSail = fs.existsSync(path.join(config.projectPath, 'vendor/bin/sail'));
    
    if (config.useSail && hasSail) {
      // Using Laravel Sail
      commandArgs = ['vendor/bin/sail', 'artisan', ...config.command.split(' ')];
    } else {
      // Using PHP directly
      commandArgs = ['php', 'artisan', ...config.command.split(' ')];
    }

    // Start the command process
    const process = spawn(commandArgs[0], commandArgs.slice(1), {
      cwd: config.projectPath,
      shell: true
    });

    // Set up the response with initial information
    const response = {
      success: true,
      commandId: commandId,
      command: commandArgs.join(' '),
      output: '',
      isComplete: false
    };

    // Set up event channel for streaming output
    const outputChannel = `command-output-${commandId}`;

    // Stream stdout data
    process.stdout.on('data', (data) => {
      const output = data.toString();
      // Send real-time updates to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output,
          type: 'stdout',
          isComplete: false
        });
      }
    });

    // Stream stderr data
    process.stderr.on('data', (data) => {
      const output = data.toString();
      // Send real-time updates to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output,
          type: 'stderr',
          isComplete: false
        });
      }
    });

    // Handle process completion
    process.on('close', (code) => {
      const success = code === 0;
      // Send completion notification to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output: success ? 'Command completed successfully.' : `Command exited with code ${code}`,
          type: success ? 'stdout' : 'stderr',
          isComplete: true,
          success
        });
      }
    });

    // Handle errors
    process.on('error', (err) => {
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output: `Error: ${err.message}`,
          type: 'stderr',
          isComplete: true,
          success: false
        });
      }
    });

    return response;
  } catch (error) {
    console.error('Error running artisan command:', error);
    return {
      success: false,
      message: error.message,
      pendingMigrations: [],
      batches: []
    };
  }
});

// Add the handler for getting migration status
ipcMain.handle('get-migration-status', async (event, config) => {
  try {
    if (!config.projectPath) {
      return { 
        success: false, 
        message: 'Project path is required',
        pendingMigrations: [],
        batches: []
      };
    }

    const artisanPath = path.join(config.projectPath, 'artisan');
    if (!fs.existsSync(artisanPath)) {
      return {
        success: false,
        message: 'Artisan file not found in project path',
        pendingMigrations: [],
        batches: []
      };
    }

    // Determine if we're using PHP directly or Sail
    const hasSail = fs.existsSync(path.join(config.projectPath, 'vendor/bin/sail'));
    const useSail = config.useSail && hasSail;
    
    // Command to get migration status
    const statusCommand = useSail ? 
      ['vendor/bin/sail', 'artisan', 'migrate:status', '--no-ansi'] : 
      ['php', 'artisan', 'migrate:status', '--no-ansi'];

    // Run migration status command
    const statusProcess = spawn(statusCommand[0], statusCommand.slice(1), {
      cwd: config.projectPath,
      shell: true
    });

    let statusOutput = '';
    statusProcess.stdout.on('data', (data) => {
      statusOutput += data.toString();
    });

    let errorOutput = '';
    statusProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve) => {
      statusProcess.on('close', resolve);
    });

    if (errorOutput && !statusOutput) {
      console.error('Migration status command error:', errorOutput);
      return {
        success: false,
        message: 'Error running migration status command: ' + errorOutput.split('\n')[0],
        pendingMigrations: [],
        batches: []
      };
    }

    // Parse the migration status output
    const pendingMigrations = [];
    const batches = new Map();
    
    // Split by lines and process
    const lines = statusOutput.split('\n');
    
    // Debug: Log the output for troubleshooting
    console.log('Migration status output:', statusOutput);
    
    // Primeiro passo: Obter todas as migrações executadas com seus batches
    for (const line of lines) {
      // Check for new Laravel format (Laravel 10+):
      // "2014_10_12_000000_create_users_table ............................... [1] Ran"
      // "2025_04_14_120118_test_teste_ssss .................................. Pending"
      
      // Match pending migrations
      if (line.includes('Pending')) {
        const match = line.match(/^\s*([^\s].*?)\s+\.+\s+Pending\s*$/);
        if (match && match[1]) {
          const migrationName = match[1].trim();
          pendingMigrations.push(migrationName);
          console.log(`Found pending migration: ${migrationName}`);
        }
      }
      
      // Match ran migrations with batch number
      const ranMatch = line.match(/^\s*([^\s].*?)\s+\.+\s+\[(\d+)\]\s+Ran\s*$/);
      if (ranMatch && ranMatch[1] && ranMatch[2]) {
        const migrationName = ranMatch[1].trim();
        const batchNumber = parseInt(ranMatch[2], 10);
        
        if (!batches.has(batchNumber)) {
          batches.set(batchNumber, []);
        }
        batches.get(batchNumber).push(migrationName);
        console.log(`Found ran migration: ${migrationName} in batch ${batchNumber}`);
      }
      
      // Also try to match the older format for backward compatibility
      if (line.includes('| No ')) {
        const match = line.match(/\|\s*No\s*\|\s*(.*?)\s*\|/);
        if (match && match[1]) {
          const migrationName = match[1].trim();
          if (migrationName && !migrationName.includes('Migration') && !pendingMigrations.includes(migrationName)) {
            pendingMigrations.push(migrationName);
            console.log(`Found pending migration (old format): ${migrationName}`);
          }
        }
      }
      
      if (line.includes('| Yes ')) {
        const match = line.match(/\|\s*Yes\s*\|\s*(.*?)\s*\|\s*(\d+)\s*\|/);
        if (match && match[1] && match[2]) {
          const migrationName = match[1].trim();
          const batchNumber = parseInt(match[2].trim(), 10);
          
          if (migrationName && !isNaN(batchNumber)) {
            if (!batches.has(batchNumber)) {
              batches.set(batchNumber, []);
            }
            if (!batches.get(batchNumber).includes(migrationName)) {
              batches.get(batchNumber).push(migrationName);
              console.log(`Found ran migration (old format): ${migrationName} in batch ${batchNumber}`);
            }
          }
        }
      }
    }
    
    // Se não encontramos batches no processo acima, vamos tentar um método alternativo
    // Executar o comando "php artisan migrate:status" às vezes retorna um formato diferente
    if (batches.size === 0) {
      console.log('No batches found from migrate:status, trying to get from migration table...');
      
      // Vamos executar uma consulta na tabela migrations para obter os batches
      try {
        // Ler o arquivo .env para obter informações de conexão com o banco
        const envFilePath = path.join(config.projectPath, '.env');
        const envContent = fs.readFileSync(envFilePath, 'utf8');
        const dbConfig = {
          host: extractEnvValue(envContent, 'DB_HOST') || 'localhost',
          port: parseInt(extractEnvValue(envContent, 'DB_PORT') || '3306', 10),
          user: extractEnvValue(envContent, 'DB_USERNAME') || 'root',
          password: extractEnvValue(envContent, 'DB_PASSWORD') || '',
          database: extractEnvValue(envContent, 'DB_DATABASE') || 'laravel'
        };
        
        // Criar uma conexão temporária com o banco
        const connection = await mysql.createConnection(dbConfig);
        
        // Obter todas as migrações do banco
        const [rows] = await connection.query('SELECT * FROM migrations ORDER BY batch DESC, id DESC');
        
        if (rows && rows.length > 0) {
          // Agrupar por batch
          for (const row of rows) {
            const batchNumber = row.batch;
            const migrationName = row.migration;
            
            if (!batches.has(batchNumber)) {
              batches.set(batchNumber, []);
            }
            
            batches.get(batchNumber).push(migrationName);
            console.log(`Found migration from DB: ${migrationName} in batch ${batchNumber}`);
          }
        }
        
        await connection.end();
      } catch (dbError) {
        console.error('Error getting migrations from database:', dbError);
        // Não falhar completamente se não conseguirmos acessar o banco
        // Apenas criar pelo menos uma batch simulada para permitir rollback
        if (batches.size === 0) {
          batches.set(1, ['Example migration in batch 1']);
        }
      }
    }
    
    // Se ainda não temos batches, vamos criar pelo menos uma para não quebrar a UI
    if (batches.size === 0) {
      console.log('Creating a sample batch for UI...');
      batches.set(1, ['No migrations found in batch 1']);
    }
    
    // Convert batches Map to array for JSON serialization
    const batchesArray = Array.from(batches.entries()).map(([batchNumber, migrations]) => {
      // Ordenar as migrações dentro de cada batch pelo timestamp da migração (mais recente primeiro)
      // Formato típico: 2022_01_01_000000_create_users_table
      const sortedMigrations = [...migrations].sort((a, b) => {
        // Extrair o timestamp da migração (primeiros 14 caracteres normalmente)
        const timestampA = a.substring(0, 17);
        const timestampB = b.substring(0, 17);
        // Ordenar do mais recente para o mais antigo
        return timestampB.localeCompare(timestampA);
      });
      
      return {
        batch: batchNumber,
        migrations: sortedMigrations
      };
    });
    
    // Sort batches by batch number descending (newest first)
    batchesArray.sort((a, b) => b.batch - a.batch);

    console.log(`Found ${pendingMigrations.length} pending migrations and ${batchesArray.length} batches`);

    return {
      success: true,
      pendingMigrations,
      batches: batchesArray,
      hasSail,
      output: statusOutput
    };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return {
      success: false,
      message: error.message,
      pendingMigrations: [],
      batches: []
    };
  }
});

// Função auxiliar para extrair valores do arquivo .env
function extractEnvValue(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(regex);
  if (match && match[1]) {
    // Remover aspas, se houver
    return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// SQL Editor query execution handler
ipcMain.handle('execute-sql-query', async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    if (!config.connectionId || !config.query) {
      return { 
        success: false, 
        error: 'Missing connectionId or query',
        results: []
      };
    }

    // Get connection details
    const connections = store.get('connections') || [];
    const connectionDetails = connections.find(conn => conn.id === config.connectionId);
    
    if (!connectionDetails) {
      return { 
        success: false, 
        error: 'Connection not found',
        results: []
      };
    }

    // Try to use an existing monitored connection
    monitoredConnection = dbMonitoringConnections.get(config.connectionId);
    
    if (monitoredConnection) {
      console.log(`Using existing monitored connection for SQL query: ${config.connectionId}`);
      connection = monitoredConnection;
    } else {
      // Create a new connection
      connection = await mysql.createConnection({
        host: connectionDetails.host,
        port: connectionDetails.port,
        user: connectionDetails.username,
        password: connectionDetails.password || '',
        database: connectionDetails.database,
        connectTimeout: 10000,
        multipleStatements: true // Allow multiple statements, but use with caution
      });
    }

    console.log(`Executing SQL query on ${connectionDetails.database}`);
    
    // Execute the SQL query
    const [results] = await connection.query(config.query);
    
    console.log(`SQL query executed successfully`);
    
    return { 
      success: true, 
      results: Array.isArray(results) ? results : [results]
    };
  } catch (error) {
    console.error('Error executing SQL query:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to execute SQL query',
      results: []
    };
  } finally {
    // Only close the connection if it's not a monitored connection
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

// Add this function after other database-related IPC handlers

// List all databases available on a MySQL server
ipcMain.handle('list-databases', async (event, config) => {
  let connection;
  
  try {
    if (!config.host || !config.port || !config.username) {
      return { 
        success: false, 
        message: 'Missing connection parameters',
        databases: []
      };
    }

    // Create a connection without specifying a database
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      connectTimeout: 10000
    });

    // Query to get all databases
    const [rows] = await connection.query('SHOW DATABASES');
    
    if (rows && rows.length > 0) {
      // Extract database names
      const databases = rows.map(row => row.Database || row.DATABASE)
        // Filter out system databases
        .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db));
      
      return { 
        success: true, 
        databases
      };
    } else {
      return { 
        success: false, 
        message: 'No databases found',
        databases: []
      };
    }
  } catch (error) {
    console.error('Error listing databases:', error);
    let errorMessage = 'Failed to list databases';
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Access denied with the provided credentials';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - check host and port';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      message: errorMessage,
      databases: []
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

ipcMain.handle('updateRecord', async (event, config) => {
  try {
    const { connection, tableName, record } = config;
    
    if (!connection) {
      throw new Error('Connection details are required');
    }
    
    if (!tableName) {
      throw new Error('Table name is required');
    }
    
    if (!record || Object.keys(record).length === 0) {
      throw new Error('Record data is required');
    }
    
    // Construct the MySQL connection
    const mysqlConfig = {
      host: connection.host,
      port: connection.port || 3306,
      user: connection.username,
      password: connection.password,
      database: connection.database
    };
    
    let conn;
    
    try {
      // Usar mysql2/promise para consistência
      conn = await mysql.createConnection(mysqlConfig);

      // Check if record has an ID (for UPDATE) or not (for INSERT)
      // In this case, we're focusing on UPDATE
      if (!record.id) {
        throw new Error('Record must have an ID field to update');
      }
      
      // Processar valores especiais - como datas
      const processedRecord = {};
      for (const key in record) {
        let value = record[key];
        
        // Se for uma string de data no formato ISO, converta para o formato MySQL
        if (typeof value === 'string' && 
            (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || 
             value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/))) {
          try {
            // Converter para formato MySQL YYYY-MM-DD HH:MM:SS
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = date.toISOString().slice(0, 19).replace('T', ' ');
            }
          } catch (e) {
            console.warn(`Failed to convert date for field ${key}:`, e);
          }
        }
        
        processedRecord[key] = value;
      }
      
      // Build the SQL UPDATE statement with escaped column names
      const columnUpdates = Object.keys(processedRecord)
        .filter(key => key !== 'id') // Exclude ID from updates
        .map(key => `\`${key}\` = ?`) // Escape column names with backticks
        .join(', ');
      
      const updateValues = Object.keys(processedRecord)
        .filter(key => key !== 'id')
        .map(key => processedRecord[key]);
      
      // Add the WHERE id value at the end
      updateValues.push(processedRecord.id);
      
      // Escape the table name too
      const updateSql = `UPDATE \`${tableName}\` SET ${columnUpdates} WHERE \`id\` = ?`;
      
      // Execute the UPDATE query usando Promise
      const [result] = await conn.execute(updateSql, updateValues);
      
      return {
        success: true,
        message: `Record updated successfully`,
        affectedRows: result.affectedRows
      };
    } finally {
      if (conn) {
        await conn.end();
      }
    }
  } catch (error) {
    console.error('Error updating record:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Adicionar handler para consulta com filtro SQL WHERE
ipcMain.handle('getFilteredTableData', async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    // Verificar parâmetros obrigatórios
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName || !config.filter) {
      return { 
        success: false, 
        message: 'Missing required parameters',
        data: [],
        totalRecords: 0
      };
    }

    // Tentar usar uma conexão monitorada já existente
    if (config.connectionId) {
      monitoredConnection = dbMonitoringConnections.get(config.connectionId);
      if (monitoredConnection) {
        console.log(`Using existing monitored connection for filtered data: ${config.connectionId}`);
        connection = monitoredConnection;
      }
    }
    
    // Se não temos uma conexão monitorada, criamos uma nova
    if (!monitoredConnection) {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password || '',
        database: config.database,
        connectTimeout: 10000
      });
    }

    // Escapar nome da tabela para prevenir SQL injection
    const tableName = connection.escapeId(config.tableName);
    
    // Limpar o filtro - remover 'WHERE' se estiver no início
    let filterClause = config.filter.trim();
    if (filterClause.toLowerCase().startsWith('where')) {
      filterClause = filterClause.substring(5).trim();
    }
    
    // Configurações de paginação
    const page = config.page || 1;
    const limit = config.limit || 100;
    const offset = (page - 1) * limit;
    
    console.log(`Executing filtered query on ${config.database}.${config.tableName}`);
    console.log(`Filter: ${filterClause}`);
    console.log(`Page: ${page}, Limit: ${limit}, Offset: ${offset}`);
    
    // Primeiro, obter a contagem total de registros que correspondem ao filtro
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE ${filterClause}`;
    console.log(`Count query: ${countQuery}`);
    
    let totalRecords = 0;
    try {
      const [countResult] = await connection.query(countQuery);
      totalRecords = countResult[0].total;
      console.log(`Total records matching filter: ${totalRecords}`);
    } catch (countError) {
      console.error('Error executing count query:', countError);
      // Em caso de erro na contagem, continuamos com a consulta principal
      // mas retornamos totalRecords = 0, o que pode causar problemas na paginação
    }
    
    // Consulta principal para obter os dados filtrados com paginação
    const dataQuery = `SELECT * FROM ${tableName} WHERE ${filterClause} LIMIT ? OFFSET ?`;
    console.log(`Data query: ${dataQuery}`);
    
    const [rows] = await connection.query(dataQuery, [limit, offset]);
    
    console.log(`Fetched ${rows?.length || 0} rows from filtered data`);
    
    return { 
      success: true, 
      data: rows || [],
      totalRecords: totalRecords,
      page: page,
      limit: limit
    };
  } catch (error) {
    console.error('Error fetching filtered table data:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch filtered table data',
      data: [],
      totalRecords: 0
    };
  } finally {
    // Apenas fechamos a conexão se NÃO for uma conexão monitorada
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
});

// Add handlers for pluralization functions
ipcMain.handle('get-pluralize-function', () => {
  // We can't return the function directly, so we just acknowledge the call
  return true;
});

ipcMain.handle('get-singular-form', (event, word) => {
  return pluralize.singular(word);
});

ipcMain.handle('get-plural-form', (event, word) => {
  return pluralize.plural(word);
});

// Handler to temporarily update the database in a project's .env file
ipcMain.handle('update-env-database', async (event, projectPath, database) => {
  try {
    if (!projectPath || !database) {
      return { 
        success: false, 
        message: 'Missing project path or database name'
      };
    }

    const envPath = path.join(projectPath, '.env');
    if (!fs.existsSync(envPath)) {
      return {
        success: false,
        message: '.env file not found in project'
      };
    }

    // Read the current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Divide o conteúdo em linhas para processamento linha por linha
    const lines = envContent.split('\n');
    let dbLineFound = false;
    
    // Processa cada linha individualmente para garantir que apenas linha ativa seja substituída
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Ignora linhas comentadas
      if (line.trim().startsWith('#')) {
        continue;
      }
      
      // Procura pela linha DB_DATABASE que não está comentada
      if (line.trim().startsWith('DB_DATABASE=')) {
        console.log(`Found active DB_DATABASE line: "${line}"`);
        lines[i] = `DB_DATABASE=${database}`;
        dbLineFound = true;
        break;
      }
    }
    
    // Se não encontrou nenhuma linha DB_DATABASE ativa, adiciona uma nova
    if (!dbLineFound) {
      console.log('No active DB_DATABASE line found, adding a new one');
      lines.push(`DB_DATABASE=${database}`);
    }
    
    // Junta as linhas novamente em um único conteúdo
    const updatedContent = lines.join('\n');
    
    // Escreve o conteúdo atualizado de volta ao arquivo .env
    fs.writeFileSync(envPath, updatedContent);
    
    console.log(`Successfully updated .env file with database: ${database}`);
    
    return {
      success: true,
      message: `Updated database to ${database} in .env file`
    };
  } catch (error) {
    console.error('Error updating .env database:', error);
    return {
      success: false,
      message: error.message || 'Failed to update database in .env file'
    };
  }
});

// Adicionar handler para remover uma conexão e limpar dados relacionados
ipcMain.handle('remove-connection', async (event, connectionId) => {
  try {
    if (!connectionId) {
      return { 
        success: false, 
        message: 'Connection ID is required'
      };
    }

    // Get current connections list
    const connections = store.get('connections') || [];
    const connectionIndex = connections.findIndex(conn => conn.id === connectionId);
    
    if (connectionIndex === -1) {
      return {
        success: false,
        message: 'Connection not found'
      };
    }

    // Remove the connection from the list
    connections.splice(connectionIndex, 1);
    
    // Save the updated connections list
    store.set('connections', connections);

    // Clean up related tabs
    const openTabs = store.get('openTabs') || { tabs: [], activeTabId: null };
    const updatedTabs = {
      tabs: openTabs.tabs.filter(tab => tab.connectionId !== connectionId),
      activeTabId: openTabs.activeTabId
    };

    // If the active tab was from this connection, reset it
    if (updatedTabs.tabs.length === 0 || 
        !updatedTabs.tabs.find(tab => tab.id === updatedTabs.activeTabId)) {
      updatedTabs.activeTabId = updatedTabs.tabs.length > 0 ? updatedTabs.tabs[0].id : null;
    }

    // Save the updated tabs
    store.set('openTabs', updatedTabs);

    // Stop database monitoring if running for this connection
    try {
      if (dbMonitoringConnections.has(connectionId)) {
        const connection = dbMonitoringConnections.get(connectionId);
        if (connection) {
          if (connection._pollingInterval) {
            clearInterval(connection._pollingInterval);
          }
          await connection.end();
        }
        dbMonitoringConnections.delete(connectionId);
        console.log(`Monitoring stopped for connection ${connectionId}`);
      }

      // Also clean up trigger-based monitoring
      if (dbActivityConnections.has(connectionId)) {
        const connectionData = dbActivityConnections.get(connectionId);
        if (connectionData) {
          if (connectionData.connection) {
            await connectionData.connection.end();
          }
          if (connectionData.triggerConnection) {
            await connectionData.triggerConnection.end();
          }
        }
        dbActivityConnections.delete(connectionId);
        console.log(`Trigger-based monitoring stopped for connection ${connectionId}`);
      }
    } catch (monitoringError) {
      console.error(`Error stopping monitoring for connection ${connectionId}:`, monitoringError);
      // Continue with the operation even if there's an error stopping monitoring
    }

    return {
      success: true,
      message: 'Connection and related data removed successfully'
    };
  } catch (error) {
    console.error('Error removing connection:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove connection'
    };
  }
});

// Add the following handlers for database restoration

// Handler to select SQL dump file
ipcMain.handle('select-sql-dump-file', async () => {
  try {
    return await dialog.showOpenDialog(mainWindow, {
      title: 'Select SQL Dump File',
      buttonLabel: 'Select',
      filters: [
        { name: 'SQL Dump Files', extensions: ['sql', 'gz'] }
      ],
      properties: ['openFile']
    });
  } catch (error) {
    console.error('Error selecting SQL dump file:', error);
    throw error;
  }
});

// Handler to restore database from SQL dump
ipcMain.handle('restore-database', async (event, config) => {
  try {
    if (!config.connectionId || !config.filePath) {
      return { 
        success: false, 
        message: 'Missing connection ID or file path'
      };
    }

    // Get the connection details
    const connections = store.get('connections') || [];
    const connection = connections.find(conn => conn.id === config.connectionId);
    
    if (!connection) {
      return { 
        success: false, 
        message: 'Connection not found'
      };
    }

    // Create a unique channel ID for progress updates
    const channelId = `restore-progress-${Date.now()}`;
    
    // Start the restoration process asynchronously
    // We don't await here because we want to return immediately with the channel ID
    // and let the restoration run in the background
    startDatabaseRestoration(event, connection, config, channelId)
      .catch(error => {
        console.error('Database restoration failed:', error);
        if (event && event.sender) {
          event.sender.send(channelId, {
            progress: 100,
            status: `Error: ${error.message}`,
            complete: true,
            success: false,
            error: error.message
          });
        }
      });
    
    return { 
      success: true, 
      message: 'Restoration process started',
      channelId: channelId
    };
  } catch (error) {
    console.error('Error starting database restoration:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to start restoration process'
    };
  }
});

// Function to handle the database restoration process
async function startDatabaseRestoration(event, connection, config, channelId, customSendProgress = null) {
  const sendProgress = (data) => {
    // Log progress updates for debugging
    console.log(`Restoration progress: ${data.progress}% - ${data.status}`);
    
    // If a custom progress function is provided, use it
    if (typeof customSendProgress === 'function') {
      customSendProgress(data);
      return;
    }
    
    // Otherwise use the default event sender
    if (event && event.sender) {
      event.sender.send(channelId, data);
    }
  };
  
  try {
    // Send initial progress
    sendProgress({ 
      progress: 10, 
      status: 'Preparing to restore database...',
      complete: false
    });
    
    // Make sure we have a proper connection in the config
    // This is to avoid the error when building commands
    if (!config.connection && connection) {
      console.log('Moving connection object from parameter to config.connection');
      config.connection = connection;
    }
    
    // Use let instead of const for variables that will be reassigned later
    let { filePath, ignoredTables = [] } = config;
    
    // Make sure we have a filePath in the config
    if (!filePath && config.sqlFilePath) {
      filePath = config.sqlFilePath;
      config.filePath = config.sqlFilePath;
    }
    
    let isGzipped = filePath.toLowerCase().endsWith('.gz');
    
    // Determine Docker or local execution
    const useDocker = connection.usingSail || 
                     (connection.dockerInfo && connection.dockerInfo.isDocker);
    const containerName = useDocker ? 
                         (connection.dockerInfo && connection.dockerInfo.dockerContainerName) : null;
    
    // Log the file size for debugging
    try {
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`SQL dump file size: ${fileSizeMB}MB, gzipped: ${isGzipped}`);
      
      // Update progress with file size info
      sendProgress({ 
        progress: 15, 
        status: `Processing ${fileSizeMB}MB SQL ${isGzipped ? 'gzipped ' : ''}file...`,
        complete: false
      });
    } catch (statError) {
      console.error('Error getting file stats:', statError);
    }
    
    sendProgress({ 
      progress: 20, 
      status: `Detected ${useDocker ? 'Docker' : 'local'} MySQL environment...`,
      complete: false
    });
    
    // Prepare the command based on environment and file type
    let command = '';
    let commandArgs = [];
    
    // Create a temporary file for filtered SQL if there are tables to ignore
    let tempFilePath = '';
    if (ignoredTables.length > 0) {
      sendProgress({ 
        progress: 30, 
        status: `Preparing to filter out ${ignoredTables.length} tables...`,
        complete: false
      });
      
      // Create temp file for filtered content
      tempFilePath = path.join(
        app.getPath('temp'), 
        `filtered_dump_${Date.now()}.sql`
      );
      
      // Read the SQL dump and filter out ignored tables
      await filterSqlDump(filePath, tempFilePath, ignoredTables, isGzipped, sendProgress);
      
      sendProgress({ 
        progress: 50, 
        status: 'SQL dump filtered successfully, starting restoration...',
        complete: false
      });
      
      // Now use the filtered file for restoration
      filePath = tempFilePath;
      isGzipped = false; // The filtered file is plain SQL
    } else {
      // No tables to filter, just update progress
      sendProgress({ 
        progress: 40, 
        status: 'Preparing SQL dump file for restoration...',
        complete: false
      });
      
      // Artificial delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      sendProgress({ 
        progress: 50, 
        status: 'SQL dump ready, starting restoration...',
        complete: false
      });
    }
    
    // Build the restoration command based on environment
    if (useDocker && containerName) {
      // Docker execution with containerName
      config.connection.container = containerName;
      const dockerCmd = buildDockerRestoreCommand(config);
      command = dockerCmd.command;
      commandArgs = dockerCmd.args || [];
    } else {
      // Local execution
      const localCmd = buildLocalRestoreCommand(config);
      command = localCmd.command;
      commandArgs = localCmd.args || [];
    }
    
    sendProgress({ 
      progress: 60, 
      status: 'Executing database restoration...',
      complete: false
    });
    
    // Execute the command
    try {
      const result = await executeRestoreCommand({ command, args: commandArgs }, filePath, sendProgress);
      
      // Clean up temporary file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file ${tempFilePath} deleted successfully`);
      }
      
      // Send completion status
      sendProgress({ 
        progress: 100, 
        status: 'Database restored successfully',
        complete: true,
        success: true
      });
      
      return result;
    } catch (execError) {
      console.error('Error executing restore command:', execError);
      
      // Clean up temporary file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`Temporary file ${tempFilePath} deleted successfully`);
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }
      
      // Send error status
      sendProgress({ 
        progress: 100, 
        status: `Error: ${execError.message}`,
        complete: true,
        success: false,
        error: execError.message
      });
      
      throw execError;
    }
  } catch (error) {
    console.error('Error during database restoration:', error);
    
    // Clean up temporary file if created
    if (config.tempFilePath && fs.existsSync(config.tempFilePath)) {
      try {
        fs.unlinkSync(config.tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    // Send error status
    sendProgress({ 
      progress: 100, 
      status: `Error: ${error.message}`,
      complete: true,
      success: false,
      error: error.message
    });
    
    throw error;
  }
}

async function restoreDatabase(event, config) {
  console.log('Starting database restoration process');
  const sender = event.sender;
  
  try {
    // Validate the database connection before attempting to restore
    try {
      await validateDatabaseConnection(config.connection);
      sender.send('restore:progress', { status: 'validating', progress: 10, message: 'Database connection validated' });
    } catch (error) {
      sender.send('restore:progress', { status: 'error', progress: 0, message: `Connection validation failed: ${error.message}` });
      return;
    }
    
    // Build the appropriate restore command based on connection type
    let command;
    try {
      if (config.connection && config.connection.docker) {
        command = buildDockerRestoreCommand(config);
      } else {
        command = buildLocalRestoreCommand(config);
      }
    } catch (commandError) {
      console.error('Error building restore command:', commandError);
      sender.send('restore:progress', { status: 'error', progress: 0, message: `Command error: ${commandError.message}` });
      throw commandError;
    }
    
    console.log('Executing restore command:', command);
    sender.send('restore:progress', { status: 'preparing', progress: 20, message: 'Starting restoration process' });
    
    // Log a more detailed message about what's happening
    const logDetails = {
      command: command,
      databaseName: config.connection.database,
      filePath: config.sqlFilePath,
      dockerMode: config.connection.docker ? 'Yes' : 'No',
      isCompressed: config.sqlFilePath?.toLowerCase().endsWith('.gz') ? 'Yes' : 'No'
    };
    console.log('Restore details:', JSON.stringify(logDetails, null, 2));
    
    // Execute the command
    const child = exec(command, { shell: '/bin/bash' }); // Use bash shell for pipefail
    let error = '';
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data;
      console.log(`Restore stdout: ${data.toString().trim()}`);
      
      // Parse the output to estimate progress
      // MySQL dump restoration usually shows progress in percentage
      const progressMatch = data.toString().match(/(\d+)%/);
      if (progressMatch) {
        const progressValue = parseInt(progressMatch[1], 10);
        const calculatedProgress = 20 + (progressValue * 0.8); // Scale from 20% to 100%
        sender.send('restore:progress', { 
          status: 'restoring', 
          progress: calculatedProgress, 
          message: `Restoring database: ${progressValue}% complete` 
        });
      }
    });
    
    child.stderr.on('data', (data) => {
      // Some MySQL tools output progress information to stderr
      const dataStr = data.toString();
      error += dataStr;
      console.log(`Restore stderr: ${dataStr.trim()}`);
      
      // Check if this is actually an error or just informational
      if (!dataStr.includes('Warning') && !dataStr.includes('information_schema')) {
        console.log('Restore progress:', dataStr);
      }
    });
    
    return new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log('Database restoration completed successfully');
          // Verify if output or error contains any meaningful content
          if (output.trim() || error.trim()) {
            console.log('Command output:', output.trim());
            console.log('Command error/info:', error.trim());
          } else {
            console.warn('Warning: Command had no output. This might indicate a silent failure.');
          }
          
          // Check if database has content after restore
          validateDatabaseHasContent(config.connection)
            .then(result => {
              if (result.hasContent) {
                console.log(`Database now has ${result.tableCount} tables with data`);
                sender.send('restore:progress', { 
                  status: 'completed', 
                  progress: 100, 
                  message: `Database restored successfully with ${result.tableCount} tables` 
                });
                resolve({ success: true, message: 'Database restored successfully', tables: result.tableCount });
              } else {
                const warnMsg = 'Database restoration seemed to succeed, but no tables were found';
                console.warn(warnMsg);
                sender.send('restore:progress', { status: 'warning', progress: 100, message: warnMsg });
                resolve({ success: true, warning: warnMsg });
              }
            })
            .catch(err => {
              console.error('Error validating database content:', err);
              sender.send('restore:progress', { status: 'completed', progress: 100, message: 'Database restoration completed' });
              resolve({ success: true, message: 'Database restored successfully', warning: 'Could not validate content' });
            });
        } else {
          console.error('Database restoration failed with code:', code);
          console.error('Error output:', error);
          sender.send('restore:progress', { status: 'error', progress: 0, message: `Restoration failed: ${error}` });
          reject(new Error(`Database restoration failed: ${error}`));
        }
      });
      
      child.on('error', (err) => {
        console.error('Failed to start database restoration process:', err);
        sender.send('restore:progress', { status: 'error', progress: 0, message: `Process error: ${err.message}` });
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error in database restoration process:', error);
    sender.send('restore:progress', { status: 'error', progress: 0, message: `Error: ${error.message}` });
    throw error;
  }
}

// Function to check if database has content after restoration
async function validateDatabaseHasContent(connection) {
  try {
    if (!connection || !connection.host || !connection.database) {
      return { hasContent: false, error: 'Invalid connection' };
    }
    
    console.log(`Validating if database ${connection.database} has content...`);
    
    const dbConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      user: connection.username || connection.user || 'root',
      password: connection.password || '',
      database: connection.database,
      connectTimeout: 10000
    });
    
    try {
      // Get list of tables
      const [rows] = await dbConnection.query(`
        SHOW TABLES
      `);
      
      if (!rows || rows.length === 0) {
        console.log('No tables found in database');
        return { hasContent: false, tableCount: 0 };
      }
      
      // Check for at least one table with data
      const tableCount = rows.length;
      console.log(`Found ${tableCount} tables in database`);
      
      return { hasContent: tableCount > 0, tableCount };
    } finally {
      await dbConnection.end();
    }
  } catch (error) {
    console.error('Error validating database content:', error);
    return { hasContent: false, error: error.message };
  }
}

/**
 * Build a docker command for MySQL database restoration
 * @param {Object} config - The configuration object containing restoration settings
 * @returns {string} - The command to execute for docker restoration
 */
function buildDockerRestoreCommand(config) {
  if (!config || !config.connection) {
    console.error('Invalid config or missing connection in buildDockerRestoreCommand:', config);
    throw new Error('Missing connection configuration for Docker restore command');
  }
  
  const { connection, sqlFilePath, ignoredTables = [] } = config;
  const { host, user, password, database, port, container } = connection;
  
  // Verificar se o arquivo é gzip
  const isGzipped = sqlFilePath.toLowerCase().endsWith('.gz');
  console.log(`Building Docker restore command for ${isGzipped ? 'gzipped' : 'regular'} SQL file`);
  
  // Verificar também se o arquivo não está vazio
  try {
    const stats = fs.statSync(sqlFilePath);
    console.log(`SQL file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    if (stats.size === 0) {
      throw new Error('SQL file is empty (0 bytes)');
    }
  } catch (err) {
    console.error('Error checking SQL file:', err);
    throw new Error(`Error with SQL file: ${err.message}`);
  }
  
  // Verify container exists
  if (!container) {
    console.error('Container name is missing from the Docker configuration');
    throw new Error('Docker container name is missing or invalid');
  }
  
  // Base command for docker exec with error checking
  let command = '';
  
  // Construir os comandos sed para filtrar as tabelas ignoradas
  let sedFilters = '';
  if (ignoredTables && ignoredTables.length > 0) {
    console.log(`Ignoring ${ignoredTables.length} tables: ${ignoredTables.join(', ')}`);
    
    // Cria comandos sed para cada tabela ignorada
    const sedCommands = ignoredTables.map(table => {
      return `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`;
    });
    
    // Combina os comandos sed
    sedFilters = ` | sed '${sedCommands.join('; ')}'`;
    console.log(`Generated sed filters: ${sedFilters}`);
  }
  
  if (isGzipped) {
    // Para arquivos gzip, precisamos descomprimir primeiro e garantir que erros sejam propagados
    command = `set -o pipefail && gunzip -c "${sqlFilePath}"${sedFilters} | docker exec -i ${container} mysql`;
  } else {
    command = `set -o pipefail && cat "${sqlFilePath}"${sedFilters} | docker exec -i ${container} mysql`;
  }
  
  // Add credentials
  command += ` -u${user || 'root'}`;
  if (password) {
    command += ` -p${password}`;
  }
  
  // Add host and port if provided
  if (host && host !== 'localhost') {
    command += ` -h${host}`;
  }
  if (port) {
    command += ` -P${port}`;
  }
  
  // Adicionar a opção binary-mode para lidar com arquivos binários
  // E também force para garantir que erros sejam reportados
  command += ` --binary-mode=1 --force`;
  
  // Adicionar o comando para criar o banco de dados se não existir
  command += ` --init-command="CREATE DATABASE IF NOT EXISTS \\\`${database}\\\`; USE \\\`${database}\\\`;"`;
  
  // Add database name
  command += ` ${database}`;
  
  console.log(`Docker restoration command: ${command}`);
  return command;
}

/**
 * Build a local command for MySQL database restoration
 * @param {Object} config - The configuration object containing restoration settings
 * @returns {string} - The command to execute for local restoration
 */
function buildLocalRestoreCommand(config) {
  if (!config || !config.connection) {
    console.error('Invalid config or missing connection in buildLocalRestoreCommand:', config);
    throw new Error('Missing connection configuration for local restore command');
  }

  const { connection, sqlFilePath, ignoredTables = [] } = config;
  const { host, user, password, database, port } = connection;
  
  // Verificar se o arquivo é gzip
  const isGzipped = sqlFilePath.toLowerCase().endsWith('.gz');
  console.log(`Building local restore command for ${isGzipped ? 'gzipped' : 'regular'} SQL file`);
  
  // Verificar também se o arquivo não está vazio
  try {
    const stats = fs.statSync(sqlFilePath);
    console.log(`SQL file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    if (stats.size === 0) {
      throw new Error('SQL file is empty (0 bytes)');
    }
  } catch (err) {
    console.error('Error checking SQL file:', err);
    throw new Error(`Error with SQL file: ${err.message}`);
  }
  
  // Construir os comandos sed para filtrar as tabelas ignoradas
  let sedFilters = '';
  if (ignoredTables && ignoredTables.length > 0) {
    console.log(`Ignoring ${ignoredTables.length} tables: ${ignoredTables.join(', ')}`);
    
    // Cria comandos sed para cada tabela ignorada
    const sedCommands = ignoredTables.map(table => {
      return `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`;
    });
    
    // Combina os comandos sed
    sedFilters = ` | sed '${sedCommands.join('; ')}'`;
    console.log(`Generated sed filters: ${sedFilters}`);
  }
  
  // Base command with error checking
  let command = '';
  
  if (isGzipped) {
    // Para arquivos gzip, precisamos descomprimir primeiro e garantir que erros sejam propagados
    command = `set -o pipefail && gunzip -c "${sqlFilePath}"${sedFilters} | mysql`;
  } else {
    command = `set -o pipefail && cat "${sqlFilePath}"${sedFilters} | mysql`;
  }
  
  // Add credentials
  command += ` -u${user || 'root'}`;
  if (password) {
    command += ` -p${password}`;
  }
  
  // Add host and port
  command += ` -h${host || 'localhost'}`;
  if (port) {
    command += ` -P${port || '3306'}`;
  }
  
  // Adicionar a opção binary-mode para lidar com arquivos binários
  // E também force para garantir que erros sejam reportados
  command += ` --binary-mode=1 --force`;
  
  // Adicionar o comando para criar o banco de dados se não existir
  command += ` --init-command="CREATE DATABASE IF NOT EXISTS \\\`${database}\\\`; USE \\\`${database}\\\`;"`;
  
  // Add database name
  command += ` ${database}`;
  
  console.log(`Local restoration command: ${command}`);
  return command;
}

// Execute the restore command and process output with better progress monitoring
async function executeRestoreCommand(commandObj, sqlFilePath, progress) {
  console.log(`Executing restore command with object:`, JSON.stringify(commandObj));
  
  try {
    const fileSize = fs.statSync(sqlFilePath).size;
    console.log(`SQL file size: ${fileSize} bytes`);
    
    progress(0.6); // Update progress to 60% - file is ready to be restored
    console.log('Starting database restore process');
    
    // Handle both string command (old format) and object format (new format)
    let command, args;
    
    if (typeof commandObj === 'string') {
      // Old format - just a command string
      command = commandObj;
    } else {
      // New format - object with command and args properties
      ({ command, args } = commandObj);
    }
    
    if (args && args.length > 0) {
      // Method with command and arguments as separate arrays
      console.log(`Executing using spawn with command: ${command} and args:`, args);
      return new Promise((resolve, reject) => {
        const proc = spawn(command, args);
        let stderr = '';
        let stdout = '';
        
        proc.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          console.log(`Restore stdout: ${chunk}`);
        });
        
        proc.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          console.log(`Restore stderr: ${chunk}`);
        });
        
        proc.on('close', (code) => {
          console.log(`Restore process exited with code ${code}`);
          progress(0.9); // Update progress to 90% - command completed
          
          if (code !== 0) {
            console.error(`Restore failed with code ${code}`);
            console.error(`Error output: ${stderr}`);
            return reject(new Error(`Restore failed with code ${code}: ${stderr}`));
          }
          
          console.log('Restore completed successfully');
          resolve();
        });
        
        proc.on('error', (error) => {
          console.error(`Restore error: ${error.message}`);
          reject(new Error(`Failed to execute restore command: ${error.message}`));
        });
      });
    } else {
      // Method with full command string
      console.log('Executing with exec method:', command);
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (stderr) {
            console.log(`Restore stderr: ${stderr}`);
          }
          
          if (stdout) {
            console.log(`Restore stdout: ${stdout}`);
          }
          
          if (error) {
            console.error(`Restore error: ${error.message}`);
            return reject(new Error(`Restore failed: ${error.message}`));
          }
          
          console.log('Restore command completed successfully');
          progress(0.9); // Update progress to 90% - command completed
          resolve();
        });
      });
    }
  } catch (error) {
    console.error(`Error executing restore command: ${error.message}`);
    throw error;
  }
}

// Function to filter out ignored tables from SQL dump
async function filterSqlDump(inputFile, outputFile, ignoredTables, isGzipped, sendProgress) {
  return new Promise((resolve, reject) => {
    try {
      if (!ignoredTables || ignoredTables.length === 0) {
        // No tables to ignore, just copy the file if needed
        if (isGzipped) {
          // Decompress the file
          const gunzip = spawn('gunzip', ['-c', inputFile]);
          const writeStream = fs.createWriteStream(outputFile);
          
          gunzip.stdout.pipe(writeStream);
          
          gunzip.on('error', (error) => {
            reject(new Error(`Error decompressing file: ${error.message}`));
          });
          
          writeStream.on('finish', () => {
            resolve();
          });
          
          writeStream.on('error', (error) => {
            reject(new Error(`Error writing decompressed file: ${error.message}`));
          });
        } else {
          // Just copy the file
          fs.copyFileSync(inputFile, outputFile);
          resolve();
        }
        return;
      }
      
      sendProgress({ 
        progress: 35, 
        status: 'Reading and filtering SQL dump...',
        complete: false
      });
      
      let inputStream;
      if (isGzipped) {
        const gunzip = spawn('gunzip', ['-c', inputFile]);
        inputStream = gunzip.stdout;
        
        gunzip.on('error', (error) => {
          reject(new Error(`Error decompressing file: ${error.message}`));
        });
      } else {
        inputStream = fs.createReadStream(inputFile);
      }
      
      const writeStream = fs.createWriteStream(outputFile);
      const lineReader = require('readline').createInterface({
        input: inputStream,
        crlfDelay: Infinity
      });
      
      // Create patterns for tables to ignore
      const patterns = ignoredTables.map(table => 
        new RegExp(`^(INSERT INTO|CREATE TABLE|DROP TABLE|ALTER TABLE)\\s+\`?${table}\`?`, 'i')
      );
      
      let skipSection = false;
      let linesProcessed = 0;
      const totalLines = 100000; // Estimate for progress calculation
      
      lineReader.on('line', (line) => {
        linesProcessed++;
        
        // Calculate progress periodically
        if (linesProcessed % 5000 === 0) {
          const estimatedProgress = Math.min(45, 35 + (linesProcessed / totalLines) * 10);
          sendProgress({ 
            progress: estimatedProgress, 
            status: `Processed ${linesProcessed} lines...`,
            complete: false
          });
        }
        
        // Check for beginning of INSERT/CREATE/etc. for a table to ignore
        if (!skipSection) {
          for (const pattern of patterns) {
            if (pattern.test(line)) {
              skipSection = true;
              break;
            }
          }
        }
        
        // Check for end of a section to ignore (usually end of an INSERT or end of CREATE TABLE)
        if (skipSection && /;(\s*)$/.test(line)) {
          skipSection = false;
          return; // Skip writing this line
        }
        
        // Write the line if we're not skipping
        if (!skipSection) {
          writeStream.write(line + '\n');
        }
      });
      
      lineReader.on('close', () => {
        writeStream.end();
      });
      
      writeStream.on('finish', () => {
        resolve();
      });
      
      writeStream.on('error', (error) => {
        reject(new Error(`Error writing filtered SQL: ${error.message}`));
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Handler to extract table names from SQL dump file
ipcMain.handle('extract-tables-from-sql', async (event, filePath) => {
  try {
    if (!filePath) {
      return { 
        success: false, 
        message: 'Missing file path',
        tables: []
      };
    }

    if (!fs.existsSync(filePath)) {
      return { 
        success: false, 
        message: 'File not found',
        tables: []
      };
    }

    // Check file size - large files might take long to process
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    let isGzipped = filePath.toLowerCase().endsWith('.gz');
    let maxLines = 100000; // Default limit
    
    // Adjust maxLines based on file size
    if (fileSizeMB > 500) {
      maxLines = 20000;
    } else if (fileSizeMB > 100) {
      maxLines = 50000;
    }
    
    // For gzipped files, we can't accurately guess the uncompressed size
    // so we'll be more conservative
    if (isGzipped) {
      maxLines = Math.min(maxLines, 30000);
    }
    
    console.log(`Extracting tables from SQL file (${fileSizeMB.toFixed(2)}MB), scanning up to ${maxLines} lines`);
    
    try {
      const tables = await extractTablesFromSqlFile(filePath, isGzipped, maxLines);
      
      if (tables.length === 0) {
        return {
          success: true,
          message: 'No tables found in the SQL file. It may be corrupted or not a valid dump file.',
          tables: []
        };
      }
      
      return { 
        success: true, 
        tables: tables,
        message: `Found ${tables.length} tables in the SQL file`
      };
    } catch (extractError) {
      console.error('Error during table extraction:', extractError);
      
      // Special handling for common errors
      if (extractError.message.includes('decompressing file')) {
        return {
          success: false,
          message: 'Error decompressing file. Make sure it is a valid .gz file.',
          tables: []
        };
      }
      
      return {
        success: false,
        message: extractError.message || 'Failed to extract tables from SQL file',
        tables: []
      };
    }
  } catch (error) {
    console.error('Error extracting tables from SQL dump:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to extract tables',
      tables: []
    };
  }
});

// Function to extract table names from SQL dump file
async function extractTablesFromSqlFile(filePath, isGzipped, maxLinesToProcess = 50000) {
  return new Promise((resolve, reject) => {
    try {
      let inputStream;
      if (isGzipped) {
        const gunzip = spawn('gunzip', ['-c', filePath], { timeout: 30000 });
        inputStream = gunzip.stdout;
        
        gunzip.on('error', (error) => {
          reject(new Error(`Error decompressing file: ${error.message}`));
        });
      } else {
        inputStream = fs.createReadStream(filePath, { 
          highWaterMark: 64 * 1024 // 64KB chunks for better performance
        });
      }
      
      const lineReader = require('readline').createInterface({
        input: inputStream,
        crlfDelay: Infinity
      });
      
      const tableNames = new Set();
      const tableStats = new Map(); // To track approximate size of each table
      
      // Regexes to match various table operations in SQL
      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const dropTableRegex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const alterTableRegex = /ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      
      let linesProcessed = 0;
      let currentTable = null;
      let currentInsertSize = 0;
      
      lineReader.on('line', (line) => {
        linesProcessed++;
        
        // Stop processing after reaching limit
        if (linesProcessed > maxLinesToProcess) {
          lineReader.close();
          return;
        }
        
        // Skip comments and empty lines
        if (line.trim().startsWith('--') || line.trim().startsWith('#') || line.trim() === '') {
          return;
        }
        
        // Check if this is the start of an INSERT statement
        const insertMatch = insertRegex.exec(line);
        if (insertMatch) {
          const tableName = insertMatch[1];
          tableNames.add(tableName);
          currentTable = tableName;
          
          // Count values in the INSERT statement to estimate size
          const valueCount = (line.match(/VALUES/gi) || []).length;
          const rowCount = (line.match(/\),\(/g) || []).length + 1; // +1 for the first row
          
          // Accumulate insert size
          currentInsertSize = Math.max(currentInsertSize, rowCount);
          
          // Update table stats
          if (!tableStats.has(tableName)) {
            tableStats.set(tableName, {
              insertCount: 1,
              maxRowsPerInsert: rowCount,
              totalEstimatedRows: rowCount
            });
          } else {
            const stats = tableStats.get(tableName);
            stats.insertCount++;
            stats.maxRowsPerInsert = Math.max(stats.maxRowsPerInsert, rowCount);
            stats.totalEstimatedRows += rowCount;
            tableStats.set(tableName, stats);
          }
          
          return;
        }
        
        // If we're in a multiline INSERT statement, count additional rows
        if (currentTable && line.includes('),(')) {
          const rowsInLine = (line.match(/\),\(/g) || []).length;
          if (rowsInLine > 0) {
            const stats = tableStats.get(currentTable);
            if (stats) {
              stats.totalEstimatedRows += rowsInLine;
              tableStats.set(currentTable, stats);
            }
          }
        }
        
        // Check for end of multiline INSERT
        if (currentTable && line.trim().endsWith(';')) {
          currentTable = null;
          currentInsertSize = 0;
        }
        
        // Check for CREATE TABLE
        let match;
        if ((match = createTableRegex.exec(line)) !== null) {
          tableNames.add(match[1]);
          if (!tableStats.has(match[1])) {
            tableStats.set(match[1], {
              insertCount: 0,
              maxRowsPerInsert: 0,
              totalEstimatedRows: 0
            });
          }
        } else if ((match = dropTableRegex.exec(line)) !== null) {
          tableNames.add(match[1]);
        } else if ((match = alterTableRegex.exec(line)) !== null) {
          tableNames.add(match[1]);
        }
      });
      
      // Add timeout to prevent hanging on very large files
      const timeout = setTimeout(() => {
        lineReader.close();
        console.log(`Extraction timed out after processing ${linesProcessed} lines`);
      }, 60000); // 1 minute timeout
      
      lineReader.on('close', () => {
        clearTimeout(timeout);
        
        // Filter out some common system tables
        const systemTables = ['mysql', 'information_schema', 'performance_schema', 'sys'];
        
        // Build result with table size information
        const tableResults = [];
        
        for (const tableName of tableNames) {
          // Skip system tables
          if (systemTables.includes(tableName.toLowerCase())) {
            continue;
          }
          
          // Get stats for this table
          const stats = tableStats.get(tableName) || { 
            insertCount: 0, 
            maxRowsPerInsert: 0,
            totalEstimatedRows: 0
          };
          
          // Determine table size category
          let sizeCategory;
          if (stats.totalEstimatedRows === 0) {
            sizeCategory = 'empty';
          } else if (stats.totalEstimatedRows < 1000) {
            sizeCategory = 'small';
          } else if (stats.totalEstimatedRows < 100000) {
            sizeCategory = 'medium';
          } else {
            sizeCategory = 'large';
          }
          
          tableResults.push({
            name: tableName,
            size: sizeCategory,
            estimatedRows: stats.totalEstimatedRows
          });
        }
        
        // Sort by name
        tableResults.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`Found ${tableResults.length} tables after processing ${linesProcessed} lines`);
        console.log(`Tables by size: ${tableResults.filter(t => t.size === 'empty').length} empty, ` + 
                   `${tableResults.filter(t => t.size === 'small').length} small, ` +
                   `${tableResults.filter(t => t.size === 'medium').length} medium, ` +
                   `${tableResults.filter(t => t.size === 'large').length} large`);
        
        resolve(tableResults);
      });
      
      inputStream.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Error reading SQL file: ${error.message}`));
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Simple database restore handler - unified approach
ipcMain.handle('simple-database-restore-unified', async (event, config) => {
  try {
    console.log('Starting simple database restore with config:', config);
    console.log('Ignored tables:', config.ignoredTables);
    
    // Basic validation
    if (!config || !config.connectionId || !config.filePath) {
      return { 
        success: false, 
        message: 'Missing required parameters (connectionId or filePath)'
      };
    }

    // Get the connection details
    const connections = store.get('connections') || [];
    const connection = connections.find(conn => conn.id === config.connectionId);
    
    if (!connection) {
      return { 
        success: false, 
        message: 'Connection not found'
      };
    }
    
    // Verify the file exists
    if (!fs.existsSync(config.filePath)) {
      return {
        success: false,
        message: 'SQL dump file not found'
      };
    }

    // Determine which database to use
    const targetDatabase = config.database || connection.database;
    
    if (!targetDatabase) {
      return {
        success: false,
        message: 'No target database specified'
      };
    }

    // Verificar se o banco de destino é diferente do atual
    const isNewDatabase = targetDatabase !== connection.database;
    
    // Se for um novo banco de dados, verificar se ele já existe
    if (isNewDatabase) {
      try {
        console.log(`Checking if database ${targetDatabase} exists`);
        
        // Tentar se conectar ao MySQL sem especificar um banco
        const tempConn = await mysql.createConnection({
          host: connection.host,
          port: connection.port,
          user: connection.username,
          password: connection.password || '',
          connectTimeout: 10000
        });
        
        try {
          // Verificar se o banco existe
          const [existingDbs] = await tempConn.query('SHOW DATABASES');
          const dbExists = existingDbs.some(db => 
            (db.Database === targetDatabase || db.database === targetDatabase)
          );
          
          if (!dbExists) {
            console.log(`Database ${targetDatabase} does not exist, creating it...`);
            // Criar o banco de dados
            await tempConn.query(`CREATE DATABASE \`${targetDatabase}\``);
            console.log(`Database ${targetDatabase} created successfully`);
          } else {
            console.log(`Database ${targetDatabase} already exists`);
          }
        } finally {
          await tempConn.end();
        }
      } catch (dbError) {
        console.error(`Error checking/creating database ${targetDatabase}:`, dbError);
        return {
          success: false,
          message: `Failed to create target database: ${dbError.message}`
        };
      }
    }

    // Build a simple configuration for the restore
    const restoreConfig = {
      connection: {
        ...connection,
        database: targetDatabase,
        user: connection.username,
        docker: connection.usingSail || 
               (connection.dockerInfo && connection.dockerInfo.isDocker),
        container: connection.dockerInfo?.dockerContainerName
      },
      sqlFilePath: config.filePath,
      ignoredTables: config.ignoredTables || []
    };

    // Log ignored tables
    if (config.ignoredTables && config.ignoredTables.length > 0) {
      console.log(`Will ignore these tables: ${config.ignoredTables.join(', ')}`);
    }

    // Create a fake event with a sender for compatibility
    // This simplifies the approach instead of creating a custom progress handler
    const sender = {
      send: (channel, data) => {
        console.log(`Progress update: ${data.progress}% - ${data.status}`);
        if (event && event.sender) {
          event.sender.send('restoration-progress', { 
            progress: data.progress 
          });
        }
      }
    };
    
    // Simply execute the restore function
    try {
      // Log some basic details
      const isGzipped = config.filePath.toLowerCase().endsWith('.gz');
      const useDocker = connection.usingSail || 
                        (connection.dockerInfo && connection.dockerInfo.isDocker);
      
      console.log(`Restoring database: ${targetDatabase}`);
      console.log(`Original connection database: ${connection.database}`);
      console.log(`Docker mode: ${useDocker ? 'Yes' : 'No'}`);
      console.log(`Gzipped file: ${isGzipped ? 'Yes' : 'No'}`);
      console.log(`Ignored tables: ${restoreConfig.ignoredTables.length}`);
      
      // Execute the restore function directly
      await restoreDatabase({ sender }, restoreConfig);
      
      // Update the connection database if needed
      if (config.setAsDefault && targetDatabase !== connection.database) {
        // Get current connections list again (it might have changed)
        const updatedConnections = store.get('connections') || [];
        const connectionIndex = updatedConnections.findIndex(conn => conn.id === config.connectionId);
        
        if (connectionIndex !== -1) {
          updatedConnections[connectionIndex].database = targetDatabase;
          store.set('connections', updatedConnections);
          console.log(`Updated connection to use database ${targetDatabase} as default`);
        }
      }
      
      return {
        success: true,
        message: 'Database restored successfully',
        database: targetDatabase
      };
    } catch (restoreError) {
      console.error('Error during database restoration:', restoreError);
      return {
        success: false,
        message: restoreError.message || 'Failed to restore database'
      };
    }
  } catch (error) {
    console.error('Error in simple-database-restore-unified handler:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to process restore request'
    };
  }
});

// Handler para atualizar o banco de dados de uma conexão
ipcMain.handle('update-connection-database', async (event, connectionId, newDatabase) => {
  try {
    if (!connectionId || !newDatabase) {
      return { 
        success: false, 
        message: 'Connection ID and new database name are required'
      };
    }

    console.log(`Updating database for connection ${connectionId} to ${newDatabase}`);

    // Get current connections list
    const connections = store.get('connections') || [];
    const connectionIndex = connections.findIndex(conn => conn.id === connectionId);
    
    if (connectionIndex === -1) {
      return {
        success: false,
        message: 'Connection not found'
      };
    }

    // Update the database name
    connections[connectionIndex].database = newDatabase;
    
    // Save the updated connections list
    store.set('connections', connections);

    console.log(`Successfully updated connection database to ${newDatabase}`);
    return {
      success: true,
      message: `Connection database updated to ${newDatabase}`
    };
  } catch (error) {
    console.error('Error updating connection database:', error);
    return {
      success: false,
      message: error.message || 'Failed to update connection database'
    };
  }
});

// Function to validate a database connection
async function validateDatabaseConnection(config) {
  try {
    console.log('Validating database connection:', config.database);
    
    if (!config.host || !config.port || !config.username || !config.database) {
      throw new Error('Missing required connection parameters');
    }
    
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      connectTimeout: 10000
    });
    
    try {
      const [rows] = await connection.query('SELECT 1 as connection_test');
      
      if (rows && rows.length > 0) {
        console.log('Database connection validated successfully');
        return true;
      } else {
        throw new Error('Connection established but query failed');
      }
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Database connection validation failed:', error);
    throw new Error(`Connection validation failed: ${error.message}`);
  }
}

// Handler para obter estatísticas de um arquivo
ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { 
        success: false, 
        message: 'File not found',
        size: 0
      };
    }

    const stats = fs.statSync(filePath);
    
    return {
      success: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return { 
      success: false, 
      message: error.message,
      size: 0
    };
  }
});