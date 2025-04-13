const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const mysql = require('mysql2/promise');

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

async function createWindow() {
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

app.whenReady().then(async () => {
  await createWindow();

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

    return envConfig;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return null;
  }
});

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

  try {
    if (!config.host || !config.port || !config.username || !config.database) {
      return { 
        success: false, 
        message: 'Missing connection parameters',
        tables: []
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
    if (connection) {
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
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        count: 0
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

  try {
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        data: []
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

    // Escape table name to prevent SQL injection
    const tableName = connection.escapeId(config.tableName);
    const limit = config.limit || 100;
    
    const [rows] = await connection.query(`SELECT * FROM ${tableName} LIMIT ?`, [limit]);
    
    return { 
      success: true, 
      data: rows || []
    };
  } catch (error) {
    console.error('Error fetching table data:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch table data',
      data: []
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

  try {
    if (!config.host || !config.port || !config.username || !config.database || !config.tableName) {
      return { 
        success: false, 
        message: 'Missing parameters',
        columns: []
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

    // Escape table name to prevent SQL injection
    const tableName = connection.escapeId(config.tableName);
    const database = connection.escapeId(config.database);
    
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
    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error('Error closing MySQL connection:', err);
      }
    }
  }
}); 