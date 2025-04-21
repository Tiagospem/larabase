const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");
const mysql = require("mysql2/promise");
const { spawn, execSync, exec } = require("child_process");
const pluralize = require("pluralize");

const { createWindow, getMainWindow } = require("./modules/window");
const { registerRestoreDumpHandlers } = require("./modules/restore-dump");
const { registerConnectionHandlers } = require("./modules/connections");
const { registerProjectHandlers } = require("./modules/project");
const { registerTableHandlers } = require("./modules/tables");
const { registerRedisHandlers } = require("./modules/redis");

const store = new Store();
const dbMonitoringConnections = new Map();
const dbActivityConnections = new Map();

let mainWindow;

const originalCreateConnection = mysql.createConnection;

app.whenReady().then(async () => {
  await createWindow();

  mainWindow = getMainWindow();

  enhancePath();

  registerTableHandlers(store, dbMonitoringConnections);
  registerRestoreDumpHandlers(store);
  registerConnectionHandlers(store);
  registerProjectHandlers();
  registerRedisHandlers();

  setupGlobalMonitoring();

  if (mainWindow) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (!mainWindow.isFocused()) {
        return;
      }

      if (input.key === "F12" && !input.alt && !input.control && !input.meta && !input.shift) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      if (input.key === "I" && !input.alt && input.shift && (input.control || input.meta)) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      if (input.key === "r" && !input.alt && !input.shift && (input.control || input.meta)) {
        mainWindow.reload();
      }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function enhancePath() {
  const platform = process.platform;
  const sep = platform === "win32" ? ";" : ":";
  const envPath = process.env.PATH || "";

  const config = {
    darwin: {
      additional: ["/usr/local/bin", "/opt/homebrew/bin", "/Applications/Docker.app/Contents/Resources/bin"],
      defaults: ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", "/opt/homebrew/bin", "/Applications/Docker.app/Contents/Resources/bin"]
    },
    linux: {
      additional: ["/usr/bin", "/usr/local/bin", "/snap/bin"],
      defaults: ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", "/snap/bin"]
    },
    win32: {
      additional: ["C:\\Program Files\\Docker\\Docker\\resources\\bin", "C:\\Program Files\\Docker Desktop\\resources\\bin"],
      defaults: ["C:\\Windows\\System32", "C:\\Windows", "C:\\Program Files\\Docker\\Docker\\resources\\bin", "C:\\Program Files\\Docker Desktop\\resources\\bin"]
    }
  };

  const { additional, defaults } = config[platform] || config.linux;
  let parts = envPath ? envPath.split(sep) : [];

  if (envPath) {
    additional.forEach((p) => {
      if (!parts.includes(p)) parts.unshift(p);
    });

    process.env.PATH = parts.join(sep);

    console.log(`Enhanced PATH for Docker detection: ${process.env.PATH}`);
  } else {
    process.env.PATH = defaults.join(sep);

    console.warn(`PATH environment variable not found, some features might not work correctly`);

    console.log(`Set default PATH for ${platform}: ${process.env.PATH}`);
  }

  const whichCmd = platform === "win32" ? "where docker" : "which docker";

  try {
    const dockerPath = execSync(whichCmd, {
      timeout: 2000,
      shell: true,
      windowsHide: true,
      encoding: "utf8"
    }).trim();
    console.log(`Docker binary found at: ${dockerPath}`);
  } catch (err) {
    console.log(`Docker binary not found in PATH: ${err.message}`);
  }

  console.log(`Electron running on platform: ${platform}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Electron version: ${process.versions.electron}`);
}

function setupGlobalMonitoring() {
  mysql.createConnection = async function (config, ...rest) {
    const connection = await originalCreateConnection.call(this, config, ...rest);
    const { host, database } = config;

    const match = [...dbMonitoringConnections.entries()].find(([, monitored]) => monitored._config?.host === host && monitored._config?.database === database);

    if (match) {
      const [connectionId] = match;
      console.log(`Auto-monitoring new connection to ${database} (from monitored connection ${connectionId})`);
      setupMonitoring(connection, database);
    }

    return connection;
  };

  console.log("Global MySQL monitoring configured");
}
// function setupGlobalMonitoring() {
//   mysql.createConnection = async function (...args) {
//     const connection = await originalCreateConnection.apply(this, args);
//
//     const config = args[0];
//     console.log('New database connection created:', config.host, config.database);
//
//     for (const [connectionId, monitoredConn] of dbMonitoringConnections.entries()) {
//       if (
//         monitoredConn._config &&
//         monitoredConn._config.host === config.host &&
//         monitoredConn._config.database === config.database
//       ) {
//         console.log(
//           `Auto-monitoring new connection to ${config.database} (from monitored connection ${connectionId})`
//         );
//
//         setupMonitoring(connection, config.database);
//         break;
//       }
//     }
//
//     return connection;
//   };
//
//   console.log('Global MySQL monitoring configured');
// }

if (process.env.NODE_ENV === "development") {
  try {
    require("electron-reload")(path.join(__dirname, "../renderer"), {
      electron: path.join(__dirname, "../../node_modules", ".bin", "electron"),
      hardResetMethod: "exit"
    });
  } catch (err) {
    console.error("electron-reload:", err);
  }
}

app.on("will-quit", () => {
  console.log("Application is quitting, performing cleanup...");

  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      if (connection) connection.end();
    } catch (e) {
      console.error(`Error closing connection ${connectionId}:`, e);
    }
  }
  dbMonitoringConnections.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("save-connections", (event, connections) => {
  try {
    store.set("connections", connections);
    return true;
  } catch (error) {
    console.error("Error saving connections:", error);
    throw error;
  }
});

ipcMain.handle("get-open-tabs", () => {
  return store.get("openTabs") || { tabs: [], activeTabId: null };
});

ipcMain.handle("save-open-tabs", (event, tabData) => {
  store.set("openTabs", tabData);
  return true;
});

ipcMain.handle("get-settings", () => {
  try {
    return (
      store.get("settings") || {
        aiProvider: "openai",
        openai: {
          apiKey: "",
          model: "gpt-3.5-turbo"
        },
        gemini: {
          apiKey: "",
          model: "gemini-2.0-flash" // Ensure this matches the v1beta API endpoint
        },
        language: "en"
      }
    );
  } catch (error) {
    console.error("Error retrieving settings:", error);
    return {
      aiProvider: "openai",
      openai: { apiKey: "", model: "gpt-3.5-turbo" },
      gemini: { apiKey: "", model: "gemini-2.0-flash" }, // Ensure this matches the v1beta API endpoint
      language: "en"
    };
  }
});

ipcMain.handle("save-settings", (event, settings) => {
  try {
    store.set("settings", settings);
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
});

// getTableData and getFilteredTableData handlers moved to tables.js module

ipcMain.handle("openFile", async (event, filePath) => {
  try {
    const editors = [
      {
        name: "PHPStorm",
        paths: [
          "/Applications/PhpStorm.app/Contents/MacOS/phpstorm",
          "/usr/local/bin/phpstorm",
          "C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe",
          "C:\\Program Files (x86)\\JetBrains\\PhpStorm\\bin\\phpstorm.exe"
        ]
      },
      {
        name: "VSCode",
        paths: [
          "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
          "/usr/bin/code",
          "/usr/local/bin/code",
          "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
          "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
          "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd"
        ]
      },
      {
        name: "Sublime Text",
        paths: ["/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl", "/usr/local/bin/subl", "C:\\Program Files\\Sublime Text\\subl.exe", "C:\\Program Files (x86)\\Sublime Text\\subl.exe"]
      }
    ];

    for (const editor of editors) {
      for (const editorPath of editor.paths) {
        try {
          if (fs.existsSync(editorPath)) {
            console.log(`Opening file with ${editor.name} at ${editorPath}`);
            const child = require("child_process").spawn(editorPath, [filePath], {
              detached: true,
              stdio: "ignore"
            });
            child.unref();
            return { success: true, editor: editor.name };
          }
        } catch (e) {
          console.log(`Failed to open with ${editor.name} at ${editorPath}: ${e.message}`);
        }
      }
    }

    console.log("No specific IDE found, using default application");
    await shell.openPath(filePath);
    return { success: true, editor: "default" };
  } catch (error) {
    console.error("Failed to open file:", error);
    return { success: false, error: error.message };
  }
});

// Project logs handlers
ipcMain.handle("get-project-logs", async (event, config) => {
  try {
    console.log("Getting project logs with config:", config);

    if (!config || !config.projectPath) {
      console.log("No project path provided");
      return [];
    }

    const logsPath = path.join(config.projectPath, "storage", "logs");
    console.log("Looking for logs in:", logsPath);

    if (!fs.existsSync(logsPath)) {
      console.error("Logs directory not found at:", logsPath);
      return [];
    }

    // Get all files
    const allFiles = fs.readdirSync(logsPath);
    console.log("All files in logs directory:", allFiles);

    const logFiles = allFiles.filter((file) => file.endsWith(".log"));
    console.log("Log files found:", logFiles);

    if (logFiles.length === 0) {
      console.log("No log files found");
      return [];
    }

    // Determine which log file to read
    let logFilePath;
    let logFileName;

    if (logFiles.includes("laravel.log")) {
      logFileName = "laravel.log";
      logFilePath = path.join(logsPath, logFileName);
      console.log("Using laravel.log file");
    } else {
      // Check for daily log files (Laravel can be configured to use daily logs)
      const dailyLogPattern = /laravel-\d{4}-\d{2}-\d{2}\.log/;
      const dailyLogFiles = logFiles.filter((file) => dailyLogPattern.test(file));

      if (dailyLogFiles.length > 0) {
        // Sort by date descending to get the most recent
        dailyLogFiles.sort().reverse();
        logFileName = dailyLogFiles[0];
        logFilePath = path.join(logsPath, logFileName);
        console.log("Using daily log file:", logFileName);
      } else {
        // Fallback to any log file
        logFileName = logFiles[0];
        logFilePath = path.join(logsPath, logFileName);
        console.log("Using first available log file:", logFileName);
      }
    }

    console.log("Reading log file from:", logFilePath);
    const logContent = fs.readFileSync(logFilePath, "utf8");

    if (!logContent || logContent.trim() === "") {
      console.log("Log file is empty");
      return [];
    }

    console.log("Log content length:", logContent.length);

    // Very simple parsing approach - just split by lines and parse each line
    const lines = logContent.split("\n");
    console.log(`Found ${lines.length} lines in log file`);

    console.log("First 5 lines of log:");
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i + 1}: "${lines[i]}"`);
    }

    const logEntries = [];
    let currentEntry = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}\.?\d*(?:[\+-]\d{4})?)\]/);

      if (timestampMatch) {
        if (currentEntry) {
          logEntries.push(currentEntry);
        }

        let type = "info";
        if (line.toLowerCase().includes("error") || line.toLowerCase().includes("exception")) {
          type = "error";
        } else if (line.toLowerCase().includes("warning")) {
          type = "warning";
        } else if (line.toLowerCase().includes("debug")) {
          type = "debug";
        } else if (line.toLowerCase().includes("info")) {
          type = "info";
        }

        currentEntry = {
          id: `log_${Date.now()}_${i}`,
          timestamp: new Date(timestampMatch[1]).getTime(),
          type: type.toLowerCase(),
          message: line,
          stack: null,
          file: logFileName
        };
      } else if (currentEntry) {
        if (line.includes("Stack trace:")) {
          currentEntry.stack = "";
        } else if (currentEntry.stack !== null) {
          currentEntry.stack += line + "\n";
        } else {
          currentEntry.message += "\n" + line;
        }
      }
    }

    if (currentEntry) {
      logEntries.push(currentEntry);
    }

    console.log(`Parsed ${logEntries.length} log entries`);

    if (logEntries.length === 0) {
      console.log("No parsable log entries found, providing raw sample");

      const sampleContent = logContent.substring(0, Math.min(500, logContent.length));
      return [
        {
          id: `log_raw_${Date.now()}`,
          timestamp: Date.now(),
          type: "info",
          message: "Raw log content sample:\n\n" + sampleContent,
          stack: null,
          file: logFileName
        }
      ];
    }

    return logEntries;
  } catch (error) {
    console.error("Error reading project logs:", error);
    return [
      {
        id: `log_error_${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        message: `Error reading logs: ${error.message}`,
        stack: error.stack,
        file: "error"
      }
    ];
  }
});

ipcMain.handle("delete-project-log", async (event, logId) => {
  console.log("Delete log requested for:", logId);
  return { success: true };
});

ipcMain.handle("clear-all-project-logs", async (event, config) => {
  try {
    if (!config || !config.projectPath) {
      return { success: false, message: "No project path provided" };
    }

    const logsPath = path.join(config.projectPath, "storage", "logs");

    if (!fs.existsSync(logsPath)) {
      return { success: false, message: "Logs directory not found" };
    }

    const logFiles = fs.readdirSync(logsPath).filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
      return { success: true, message: "No log files found" };
    }

    console.log(`Clearing ${logFiles.length} log files in ${logsPath}`);

    let clearedCount = 0;
    for (const logFile of logFiles) {
      try {
        const logFilePath = path.join(logsPath, logFile);
        console.log(`Clearing log file: ${logFilePath}`);
        fs.writeFileSync(logFilePath, "", "utf8");
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
    console.error("Error clearing project logs:", error);
    return { success: false, message: error.message };
  }
});

function setupMonitoring(connection, monitoredTables) {
  if (!connection) return false;

  if (connection._isMonitored) {
    console.log("[MONITOR] This connection is already being monitored");
    return true;
  }

  startProcessListPolling(connection);

  connection._isMonitored = true;

  return true;
}

async function startProcessListPolling(connection) {
  if (!connection || !connection._config) {
    console.error("[MONITOR] Invalid connection for process list polling");
    return false;
  }

  const connectionId = connection._config.connectionId;

  console.log(`[MONITOR] Starting process list polling for connection ${connectionId}`);

  connection._processedQueries = new Set();

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

      for (const process of processList) {
        if (!process.info) continue;

        const sql = process.info;

        const queryHash = require("crypto").createHash("md5").update(`${process.id}-${sql}`).digest("hex");

        if (connection._processedQueries.has(queryHash)) {
          continue;
        }

        connection._processedQueries.add(queryHash);

        if (connection._processedQueries.size > 100) {
          const itemsToDelete = Array.from(connection._processedQueries).slice(0, 30);
          for (const item of itemsToDelete) {
            connection._processedQueries.delete(item);
          }
        }

        let operation = "QUERY";
        let tableName = "unknown";

        const firstWord = sql.trim().split(" ")[0].toUpperCase();

        if (["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE"].includes(firstWord)) {
          operation = firstWord;

          if (operation === "SELECT") {
            const match = sql.match(/FROM\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, "");
            }
          } else if (operation === "INSERT") {
            // INSERT INTO table
            const match = sql.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, "");
            }
          } else if (operation === "UPDATE") {
            const match = sql.match(/UPDATE\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, "");
            }
          } else if (operation === "DELETE") {
            // DELETE FROM table
            const match = sql.match(/DELETE\s+FROM\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[1]) {
              tableName = match[1].replace(/`/g, "");
            }
          } else if (["CREATE", "ALTER", "DROP", "TRUNCATE"].includes(operation)) {
            const match = sql.match(/(CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/i);
            if (match && match[2]) {
              tableName = match[2].replace(/`/g, "");
            }
          }
        }

        // Verificar se devemos ignorar esta tabela (tabelas do sistema)
        const systemTables = ["information_schema", "performance_schema", "mysql"];
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
      console.error("[MONITOR] Error polling process list:", error);
    }
  };

  // Executar imediatamente para testar
  try {
    await pollProcessList();
  } catch (error) {
    console.error("[MONITOR] Error during initial process list polling:", error);
  }

  // Configurar intervalo de polling (a cada 1 segundo)
  const pollingInterval = setInterval(pollProcessList, 1000);
  connection._pollingInterval = pollingInterval;

  return true;
}

ipcMain.handle("start-db-monitoring", async (event, connectionId) => {
  let connection = null;
  const activityLogTable = "larabase_db_activity_log";

  try {
    console.log(`Starting database monitoring for connection ${connectionId}`);

    // Validate connectionId
    if (!connectionId) {
      console.error("Invalid connectionId or not provided");
      return { success: false, message: "Invalid connection ID" };
    }

    // Clear previous connection if it exists
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

    // Get connection details
    const connections = store.get("connections") || [];
    const connection = connections.find((conn) => conn.id === connectionId);

    if (!connection) {
      console.error(`Connection ID ${connectionId} not found`);
      return { success: false, message: "Connection not found" };
    }

    console.log(`Connection found: ${connection.name}`);
    console.log(`Details: ${connection.host}:${connection.port}/${connection.database}`);

    if (!connection.host || !connection.port || !connection.username || !connection.database) {
      return {
        success: false,
        message: "Incomplete connection information"
      };
    }

    const dbConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: connection.password || "",
      database: connection.database,
      dateStrings: true,
      multipleStatements: true // Enable multiple statements for creating complex triggers
    });

    console.log(`Connection established to ${connection.database}`);

    // Testar a conexão
    console.log("Testing connection...");
    await dbConnection.query("SELECT 1");
    console.log("Connection test successful");

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

    const [tables] = await dbConnection.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_name != '${activityLogTable}'
        AND table_type = 'BASE TABLE'
    `,
      [connection.database]
    );

    console.log(`Found ${tables.length} tables to monitor in ${connection.database}`);

    let triggersCreated = 0;
    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;

      try {
        console.log(`Setting up triggers for table ${tableName}`);

        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_insert`);
        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_update`);
        await dbConnection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_delete`);

        const [columns] = await dbConnection.query(
          `
          SELECT COLUMN_NAME, COLUMN_KEY
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `,
          [connection.database, tableName]
        );

        const columnNames = columns.map((col) => col.COLUMN_NAME || col.column_name);

        const primaryKeyColumn = columns.find((col) => col.COLUMN_KEY === "PRI" || ["id", "uuid", "key"].includes(col.COLUMN_NAME.toLowerCase()));

        let idRef, oldIdRef;

        if (primaryKeyColumn) {
          const idColumn = primaryKeyColumn.COLUMN_NAME;
          idRef = `COALESCE(NEW.\`${idColumn}\`, 'unknown')`;
          oldIdRef = `COALESCE(OLD.\`${idColumn}\`, 'unknown')`;
          console.log(`Using primary key column: ${idColumn} for table ${tableName}`);
        } else if (columnNames.length > 0) {
          idRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(NEW.\`${columnNames[0]}\`, 'null'))`;
          oldIdRef = `CONCAT('Row with ${columnNames[0]}=', COALESCE(OLD.\`${columnNames[0]}\`, 'null'))`;
          console.log(`Using first column: ${columnNames[0]} for table ${tableName}`);
        } else {
          idRef = "'unknown'";
          oldIdRef = "'unknown'";
          console.log(`No suitable identifier column found for table ${tableName}`);
        }

        const previewColumns = columnNames.slice(0, 5);

        const insertPreview = previewColumns.map((col) => `'${col}: ', COALESCE(NEW.\`${col}\`, 'null')`).join(", ' | ', ");

        const updatePreviewParts = previewColumns.map(
          (col) =>
            `IF(
            (OLD.\`${col}\` IS NULL AND NEW.\`${col}\` IS NOT NULL) OR 
            (OLD.\`${col}\` IS NOT NULL AND NEW.\`${col}\` IS NULL) OR 
            (OLD.\`${col}\` <> NEW.\`${col}\`), 
            CONCAT('${col}: ', COALESCE(OLD.\`${col}\`, 'null'), ' → ', COALESCE(NEW.\`${col}\`, 'null')), 
            NULL
          )`
        );
        const updatePreview = `CONCAT_WS(', ', ${updatePreviewParts.join(", ")})`;

        const deletePreview = previewColumns.map((col) => `'${col}: ', COALESCE(OLD.\`${col}\`, 'null')`).join(", ' | ', ");

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

    dbMonitoringConnections.set(connectionId, dbConnection);

    if (mainWindow) {
      initialActivities.forEach((activity) => {
        mainWindow.webContents.send(`db-operation-${connectionId}`, activity);
      });

      mainWindow.webContents.send(`db-operation-${connectionId}`, {
        timestamp: Date.now(),
        type: "INFO",
        table: "system",
        message: "Database monitoring started successfully"
      });
    }

    const lastId = initialActivities.length > 0 ? initialActivities[0].id : 0;
    startActivityPolling(connectionId, dbConnection, activityLogTable, lastId);

    return { success: true, message: "Monitoring started successfully" };
  } catch (error) {
    console.error("Error setting up database monitoring:", error);

    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }

    return {
      success: false,
      message: error.message || "Unknown error setting up monitoring"
    };
  }
});

function startActivityPolling(connectionId, connection, activityLogTable, lastId) {
  console.log(`Starting activity polling for connection ${connectionId}, last ID: ${lastId}`);

  connection._lastActivityId = lastId;

  const pollActivities = async () => {
    if (!dbMonitoringConnections.has(connectionId)) {
      console.log(`Polling stopped for connection ${connectionId}`);
      if (connection._pollingInterval) {
        clearInterval(connection._pollingInterval);
        connection._pollingInterval = null;
      }
      return;
    }

    try {
      const [activities] = await connection.query(
        `
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
      `,
        [connection._lastActivityId]
      );

      if (activities.length > 0) {
        console.log(`Found ${activities.length} new activities, types: ${activities.map((a) => a.type).join(", ")}`);

        connection._lastActivityId = activities[activities.length - 1].id;

        if (mainWindow) {
          activities.forEach((activity) => {
            const formattedActivity = {
              ...activity,
              timestamp: activity.timestamp || new Date().toISOString(),
              recordId: activity.recordId || "unknown",
              details: activity.details || "No details available"
            };

            mainWindow.webContents.send(`db-operation-${connectionId}`, formattedActivity);
          });
        }
      }
    } catch (error) {
      console.error("Error polling activities:", error);
    }
  };

  pollActivities();
  connection._pollingInterval = setInterval(pollActivities, 1000);
}

ipcMain.handle("stop-db-monitoring", async (event, connectionId) => {
  try {
    console.log(`Stopping database monitoring for ${connectionId}`);

    const connection = dbMonitoringConnections.get(connectionId);

    if (!connection) {
      return {
        success: false,
        message: "Not monitoring this connection"
      };
    }

    if (connection._pollingInterval) {
      clearInterval(connection._pollingInterval);
      connection._pollingInterval = null;
    }

    await connection.end();

    dbMonitoringConnections.delete(connectionId);

    return { success: true, message: "Monitoring stopped" };
  } catch (error) {
    console.error("Error stopping database monitoring:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle("monitor-database-changes", async (event, connectionDetails) => {
  let connection = null;
  let triggerConnection = null;
  const activityLogTable = "larabase_db_activity_log";
  const connectionId = connectionDetails.id || connectionDetails.connectionId;

  try {
    console.log(`Setting up trigger-based monitoring for connection ${connectionId}`);

    if (!connectionDetails || !connectionDetails.database) {
      console.error("Database name is required for monitoring");
      return { success: false, message: "Database name is required" };
    }

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

    let host, port, user, password;

    if (connectionDetails.host) {
      host = String(connectionDetails.host || "");
      port = Number(connectionDetails.port || 3306);
      user = String(connectionDetails.username || connectionDetails.user || "");
      password = String(connectionDetails.password || "");
    } else {
      // Se apenas o ID foi fornecido, buscar os detalhes do store
      const connections = store.get("connections") || [];
      const storedConnection = connections.find((conn) => conn.id === connectionId);

      if (!storedConnection) {
        console.error(`Connection ID ${connectionId} not found in stored connections`);
        return { success: false, message: "Connection not found" };
      }

      host = String(storedConnection.host || "");
      port = Number(storedConnection.port || 3306);
      user = String(storedConnection.username || "");
      password = String(storedConnection.password || "");
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
    const [tables] = await connection.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_name != '${activityLogTable}'
        AND table_type = 'BASE TABLE'
    `,
      [database]
    );

    console.log(`Found ${tables.length} tables to monitor`);

    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;

      try {
        console.log(`Setting up triggers for table ${tableName}`);

        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_insert`).catch(() => {});
        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_update`).catch(() => {});
        await connection.query(`DROP TRIGGER IF EXISTS ${tableName}_after_delete`).catch(() => {});

        const [columns] = await connection.query(
          `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `,
          [database, tableName]
        );

        const columnNames = columns.map((col) => col.COLUMN_NAME || col.column_name);
        const hasId = columnNames.some((name) => name.toLowerCase() === "id" || name.toLowerCase() === "uuid" || name.toLowerCase() === "key");

        let idRef = "";
        if (hasId) {
          idRef = `CONCAT_WS('', 
            ${columnNames
              .filter((c) => ["id", "uuid", "key"].includes(c.toLowerCase()))
              .map((c) => `NEW.${c}`)
              .join(", ")}
          )`;
        } else if (columnNames.length > 0) {
          idRef = `CONCAT('Row with ${columnNames[0]}=', NEW.${columnNames[0]})`;
        } else {
          idRef = "'unknown'";
        }

        // Referência para OLD em operações DELETE
        let oldIdRef = "";
        if (hasId) {
          oldIdRef = `CONCAT_WS('', 
            ${columnNames
              .filter((c) => ["id", "uuid", "key"].includes(c.toLowerCase()))
              .map((c) => `OLD.${c}`)
              .join(", ")}
          )`;
        } else if (columnNames.length > 0) {
          oldIdRef = `CONCAT('Row with ${columnNames[0]}=', OLD.${columnNames[0]})`;
        } else {
          oldIdRef = "'unknown'";
        }

        // Selecionar as primeiras colunas para previsualização
        const previewColumns = columnNames.slice(0, 4);

        // Preview strings para inserções
        const insertPreview = previewColumns.map((col) => `'${col}: ', NEW.\`${col}\``).join(", ', | ', ");

        // Preview strings para atualizações
        const updatePreviewParts = previewColumns.map((col) => `IF(OLD.\`${col}\` <> NEW.\`${col}\`, CONCAT('${col}: ', OLD.\`${col}\`, ' → ', NEW.\`${col}\`), NULL)`);
        const updatePreview = `CONCAT_WS(', ', ${updatePreviewParts.join(", ")})`;

        // Preview strings para exclusões
        const deletePreview = previewColumns.map((col) => `'${col}: ', OLD.\`${col}\``).join(", ', | ', ");

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

    console.log("Creating secondary connection for polling");

    // Criar uma conexão secundária para consultar mudanças
    triggerConnection = await mysql.createConnection(connOptions);

    // Obter atividades iniciais
    console.log("Fetching initial activities");
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

    dbActivityConnections.set(connectionId, {
      connection: connection,
      triggerConnection: triggerConnection,
      activityLogTable: activityLogTable,
      lastId: initialActivities.length > 0 ? initialActivities[0].id : 0
    });

    if (mainWindow) {
      mainWindow.webContents.send(`db-activity-${connectionId}`, {
        connectionId: connectionId,
        success: true,
        message: "Trigger-based monitoring started",
        activities: initialActivities || []
      });
    }

    return {
      success: true,
      message: "Monitoring setup successfully",
      activityLogTable,
      activities: initialActivities || []
    };
  } catch (error) {
    console.error("Error setting up database monitoring:", error);

    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error("Error closing monitoring setup connection:", err);
      }
    }

    if (triggerConnection) {
      try {
        await triggerConnection.end();
      } catch (err) {
        console.error("Error closing trigger connection:", err);
      }
    }

    return {
      success: false,
      message: error.message || "Unknown error setting up monitoring"
    };
  }
});

ipcMain.handle("get-database-changes", async (event, connectionId, lastId = 0) => {
  try {
    console.log(`Getting database changes for connection ${connectionId}, lastId: ${lastId}`);

    const connectionData = dbActivityConnections.get(connectionId);

    if (!connectionData || !connectionData.triggerConnection) {
      console.error(`No active monitoring connection found for ${connectionId}`);
      return {
        success: false,
        message: "No active monitoring for this connection"
      };
    }

    const { triggerConnection, activityLogTable } = connectionData;

    if (!lastId) {
      lastId = connectionData.lastId || 0;
    }

    console.log(`Querying for activities with ID > ${lastId}`);

    const [activities] = await triggerConnection.query(
      `
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
    `,
      [lastId]
    );

    console.log(`Found ${activities.length} new activities`);

    if (activities.length > 0) {
      connectionData.lastId = Math.max(...activities.map((a) => a.id));
      console.log(`Updated lastId to ${connectionData.lastId}`);
    }

    return {
      success: true,
      activities: activities || []
    };
  } catch (error) {
    console.error("Error getting database changes:", error);
    return {
      success: false,
      message: error.message || "Unknown error getting changes"
    };
  }
});

ipcMain.handle("stop-trigger-monitoring", async (event, connectionId) => {
  try {
    console.log(`Stopping trigger-based monitoring for connection ${connectionId}`);

    const connectionData = dbActivityConnections.get(connectionId);

    if (!connectionData) {
      console.log(`No monitoring data found for connection ${connectionId}`);
      return {
        success: false,
        message: "Not monitoring this connection"
      };
    }

    if (connectionData.connection) {
      await connectionData.connection.end();
    }

    if (connectionData.triggerConnection) {
      await connectionData.triggerConnection.end();
    }

    dbActivityConnections.delete(connectionId);

    console.log(`Trigger-based monitoring stopped for ${connectionId}`);

    return { success: true, message: "Monitoring stopped" };
  } catch (error) {
    console.error(`Error stopping trigger-based monitoring for ${connectionId}:`, error);
    return { success: false, message: error.message };
  }
});

app.on("before-quit", async () => {
  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      await connection.end();
      console.log(`Closed monitoring connection for ${connectionId}`);
    } catch (error) {
      console.error(`Error closing monitoring connection for ${connectionId}:`, error);
    }
  }

  dbMonitoringConnections.clear();

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

  dbActivityConnections.clear();
});

ipcMain.handle("execute-test-operations", async (event, connectionId) => {
  try {
    console.log(`Executing test operations for connection ${connectionId}`);

    if (!connectionId) {
      return { success: false, message: "Connection ID is required" };
    }

    if (!dbMonitoringConnections.has(connectionId)) {
      console.error(`No active monitoring connection for ${connectionId}`);
      return {
        success: false,
        message: "No active monitoring connection"
      };
    }

    const connection = dbMonitoringConnections.get(connectionId);

    console.log("Creating temporary test table");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _larabase_test_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Executing INSERT test");
    const [insertResult] = await connection.query(`
      INSERT INTO _larabase_test_table (title, description)
      VALUES ('Test Title', 'This is a test description')
    `);

    const insertId = insertResult.insertId;
    console.log(`Inserted record with ID ${insertId}`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Executing UPDATE test");
    await connection.query(
      `
      UPDATE _larabase_test_table
      SET title = 'Updated Title', 
          description = 'Updated description',
          status = 'inactive'
      WHERE id = ?
    `,
      [insertId]
    );

    console.log(`Updated record with ID ${insertId}`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Executing DELETE test");
    await connection.query(
      `
      DELETE FROM _larabase_test_table
      WHERE id = ?
    `,
      [insertId]
    );

    console.log(`Deleted record with ID ${insertId}`);

    const [activityLogs] = await connection.query(`
      SELECT action_type, table_name, record_id, details 
      FROM larabase_db_activity_log 
      WHERE table_name = '_larabase_test_table'
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log("Activity logs:", activityLogs);

    return {
      success: true,
      message: "Test operations executed successfully",
      operations: {
        insertId,
        activities: activityLogs.length,
        activityTypes: activityLogs.map((log) => log.action_type)
      }
    };
  } catch (error) {
    console.error("Error executing test operations:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle("get-database-relationships", async (event, config) => {
  let connection;
  try {
    function getConnectionDetails(connectionId) {
      console.log(`Getting connection details for diagram, ID: ${connectionId}`);
      const connections = store.get("connections") || [];
      return connections.find((conn) => conn.id === connectionId);
    }

    if (config.connectionId && (!config.host || !config.port || !config.username || !config.database)) {
      const connectionDetails = getConnectionDetails(config.connectionId);
      if (!connectionDetails) {
        console.error(`Connection details not found for ID: ${config.connectionId}`);
        return {
          success: false,
          message: "Connection details not found"
        };
      }
      config.host = connectionDetails.host;
      config.port = connectionDetails.port;
      config.username = connectionDetails.username;
      config.password = connectionDetails.password;
      config.database = connectionDetails.database;
    }

    if (!config.host || !config.port || !config.username || !config.database) {
      console.error("Missing connection parameters for diagram:", config);
      return {
        success: false,
        message: "Missing required connection parameters"
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

    console.log("Connected to database successfully");

    const [rows] = await connection.query(
      `
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
    `,
      [config.database]
    );

    console.log(`Found ${rows.length} table relationships in ${config.database}`);

    if (rows.length === 0) {
      console.log("No explicit relationships found. Attempting to infer relationships from naming patterns...");

      const [tables] = await connection.query(
        `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? 
          AND table_type = 'BASE TABLE'
      `,
        [config.database]
      );

      const inferredRelationships = [];

      for (const table of tables) {
        const tableName = table.table_name || table.TABLE_NAME;

        const [columns] = await connection.query(
          `
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
        `,
          [config.database, tableName]
        );

        for (const column of columns) {
          const columnName = column.name;

          if (columnName.endsWith("_id") || columnName.endsWith("_fk") || (columnName.startsWith("id_") && columnName !== "id")) {
            let targetTable = null;

            if (columnName.endsWith("_id")) {
              targetTable = columnName.substring(0, columnName.length - 3);
            } else if (columnName.endsWith("_fk")) {
              targetTable = columnName.substring(0, columnName.length - 3);
            } else if (columnName.startsWith("id_")) {
              targetTable = columnName.substring(3);
            }

            const targetExists = tables.some((t) => (t.table_name || t.TABLE_NAME).toLowerCase() === targetTable.toLowerCase());

            if (targetExists) {
              inferredRelationships.push({
                sourceTable: tableName,
                sourceColumn: columnName,
                targetTable: targetTable,
                targetColumn: "id",
                constraintName: `inferred_${tableName}_${columnName}`,
                inferred: true
              });

              console.log(`Inferred relationship: ${tableName}.${columnName} -> ${targetTable}.id`);
            }
          }
        }
      }

      if (inferredRelationships.length > 0) {
        console.log(`Generated ${inferredRelationships.length} inferred relationships`);
        await connection.end();
        return inferredRelationships;
      }
    }

    if (connection) {
      await connection.end();
    }

    return rows;
  } catch (error) {
    console.error("Error getting database relationships:", error);

    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        console.error("Error closing MySQL connection:", err);
      }
    }

    return {
      success: false,
      message: error.message || "Failed to get database relationships",
      error: error.toString()
    };
  }
});

// Handler to read model file content
ipcMain.handle("read-model-file", async (event, filePath) => {
  try {
    if (!filePath) {
      return {
        success: false,
        message: "Missing file path",
        content: null
      };
    }

    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: "File not found",
        content: null
      };
    }

    const content = fs.readFileSync(filePath, "utf8");

    return {
      success: true,
      content: content
    };
  } catch (error) {
    console.error("Error reading model file:", error);
    return {
      success: false,
      message: error.message,
      content: null
    };
  }
});

// Handler to list files in a directory
ipcMain.handle("list-files", async (event, dirPath) => {
  try {
    if (!dirPath) {
      return {
        success: false,
        message: "Missing directory path",
        files: []
      };
    }

    if (!fs.existsSync(dirPath)) {
      return {
        success: false,
        message: "Directory not found",
        files: []
      };
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));

    return {
      success: true,
      files: files
    };
  } catch (error) {
    console.error("Error listing files:", error);
    return {
      success: false,
      message: error.message,
      files: []
    };
  }
});

// Add the handler for running artisan commands at an appropriate location
ipcMain.handle("run-artisan-command", async (event, config) => {
  try {
    if (!config.projectPath) {
      return {
        success: false,
        message: "Project path is required",
        output: ""
      };
    }

    if (!config.command) {
      return {
        success: false,
        message: "Command is required",
        output: ""
      };
    }

    const artisanPath = path.join(config.projectPath, "artisan");
    if (!fs.existsSync(artisanPath)) {
      return {
        success: false,
        message: "Artisan file not found in project path",
        output: ""
      };
    }

    // Generate a unique ID for this command execution
    const commandId = Date.now().toString();

    // Determine if we're using PHP directly or Sail
    let commandArgs = [];
    const hasSail = fs.existsSync(path.join(config.projectPath, "vendor/bin/sail"));

    if (config.useSail && hasSail) {
      // Using Laravel Sail
      commandArgs = ["vendor/bin/sail", "artisan", ...config.command.split(" ")];
    } else {
      // Using PHP directly
      commandArgs = ["php", "artisan", ...config.command.split(" ")];
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
      command: commandArgs.join(" "),
      output: "",
      isComplete: false
    };

    // Set up event channel for streaming output
    const outputChannel = `command-output-${commandId}`;

    // Stream stdout data
    process.stdout.on("data", (data) => {
      const output = data.toString();
      // Send real-time updates to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output,
          type: "stdout",
          isComplete: false
        });
      }
    });

    // Stream stderr data
    process.stderr.on("data", (data) => {
      const output = data.toString();
      // Send real-time updates to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output,
          type: "stderr",
          isComplete: false
        });
      }
    });

    // Handle process completion
    process.on("close", (code) => {
      const success = code === 0;
      // Send completion notification to the renderer
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output: success ? "Command completed successfully." : `Command exited with code ${code}`,
          type: success ? "stdout" : "stderr",
          isComplete: true,
          success
        });
      }
    });

    // Handle errors
    process.on("error", (err) => {
      if (event.sender) {
        event.sender.send(outputChannel, {
          commandId,
          output: `Error: ${err.message}`,
          type: "stderr",
          isComplete: true,
          success: false
        });
      }
    });

    return response;
  } catch (error) {
    console.error("Error running artisan command:", error);
    return {
      success: false,
      message: error.message,
      pendingMigrations: [],
      batches: []
    };
  }
});

// Add the handler for getting migration status
ipcMain.handle("get-migration-status", async (event, config) => {
  try {
    if (!config.projectPath) {
      return {
        success: false,
        message: "Project path is required",
        pendingMigrations: [],
        batches: []
      };
    }

    const artisanPath = path.join(config.projectPath, "artisan");
    if (!fs.existsSync(artisanPath)) {
      return {
        success: false,
        message: "Artisan file not found in project path",
        pendingMigrations: [],
        batches: []
      };
    }

    // Determine if we're using PHP directly or Sail
    const hasSail = fs.existsSync(path.join(config.projectPath, "vendor/bin/sail"));
    const useSail = config.useSail && hasSail;

    // Command to get migration status
    const statusCommand = useSail ? ["vendor/bin/sail", "artisan", "migrate:status", "--no-ansi"] : ["php", "artisan", "migrate:status", "--no-ansi"];

    // Run migration status command
    const statusProcess = spawn(statusCommand[0], statusCommand.slice(1), {
      cwd: config.projectPath,
      shell: true
    });

    let statusOutput = "";
    statusProcess.stdout.on("data", (data) => {
      statusOutput += data.toString();
    });

    let errorOutput = "";
    statusProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve) => {
      statusProcess.on("close", resolve);
    });

    if (errorOutput && !statusOutput) {
      console.error("Migration status command error:", errorOutput);
      return {
        success: false,
        message: "Error running migration status command: " + errorOutput.split("\n")[0],
        pendingMigrations: [],
        batches: []
      };
    }

    // Parse the migration status output
    const pendingMigrations = [];
    const batches = new Map();

    // Split by lines and process
    const lines = statusOutput.split("\n");

    // Debug: Log the output for troubleshooting
    console.log("Migration status output:", statusOutput);

    // Primeiro passo: Obter todas as migrações executadas com seus batches
    for (const line of lines) {
      // Check for new Laravel format (Laravel 10+):
      // "2014_10_12_000000_create_users_table ............................... [1] Ran"

      if (line.includes("Pending")) {
        const match = line.match(/^\s*([^\s].*?)\s+\.+\s+Pending\s*$/);
        if (match && match[1]) {
          const migrationName = match[1].trim();
          pendingMigrations.push(migrationName);
          console.log(`Found pending migration: ${migrationName}`);
        }
      }

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

      if (line.includes("| No ")) {
        const match = line.match(/\|\s*No\s*\|\s*(.*?)\s*\|/);
        if (match && match[1]) {
          const migrationName = match[1].trim();
          if (migrationName && !migrationName.includes("Migration") && !pendingMigrations.includes(migrationName)) {
            pendingMigrations.push(migrationName);
            console.log(`Found pending migration (old format): ${migrationName}`);
          }
        }
      }

      if (line.includes("| Yes ")) {
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

    if (batches.size === 0) {
      console.log("No batches found from migrate:status, trying to get from migration table...");

      try {
        const envFilePath = path.join(config.projectPath, ".env");
        const envContent = fs.readFileSync(envFilePath, "utf8");
        const dbConfig = {
          host: extractEnvValue(envContent, "DB_HOST") || "localhost",
          port: parseInt(extractEnvValue(envContent, "DB_PORT") || "3306", 10),
          user: extractEnvValue(envContent, "DB_USERNAME") || "root",
          password: extractEnvValue(envContent, "DB_PASSWORD") || "",
          database: extractEnvValue(envContent, "DB_DATABASE") || "laravel"
        };

        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.query("SELECT * FROM migrations ORDER BY batch DESC, id DESC");

        if (rows && rows.length > 0) {
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
        console.error("Error getting migrations from database:", dbError);

        if (batches.size === 0) {
          batches.set(1, ["Example migration in batch 1"]);
        }
      }
    }

    if (batches.size === 0) {
      console.log("Creating a sample batch for UI...");
      batches.set(1, ["No migrations found in batch 1"]);
    }

    const batchesArray = Array.from(batches.entries()).map(([batchNumber, migrations]) => {
      const sortedMigrations = [...migrations].sort((a, b) => {
        const timestampA = a.substring(0, 17);
        const timestampB = b.substring(0, 17);

        return timestampB.localeCompare(timestampA);
      });

      return {
        batch: batchNumber,
        migrations: sortedMigrations
      };
    });

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
    console.error("Error getting migration status:", error);
    return {
      success: false,
      message: error.message,
      pendingMigrations: [],
      batches: []
    };
  }
});

function extractEnvValue(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  if (match && match[1]) {
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// SQL Editor query execution handler
ipcMain.handle("execute-sql-query", async (event, config) => {
  let connection;
  let monitoredConnection = null;

  try {
    if (!config.connectionId || !config.query) {
      return {
        success: false,
        error: "Missing connectionId or query",
        results: []
      };
    }

    const connections = store.get("connections") || [];
    const connectionDetails = connections.find((conn) => conn.id === config.connectionId);

    if (!connectionDetails) {
      return {
        success: false,
        error: "Connection not found",
        results: []
      };
    }

    monitoredConnection = dbMonitoringConnections.get(config.connectionId);

    if (monitoredConnection) {
      console.log(`Using existing monitored connection for SQL query: ${config.connectionId}`);
      connection = monitoredConnection;
    } else {
      connection = await mysql.createConnection({
        host: connectionDetails.host,
        port: connectionDetails.port,
        user: connectionDetails.username,
        password: connectionDetails.password || "",
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
    console.error("Error executing SQL query:", error);
    return {
      success: false,
      error: error.message || "Failed to execute SQL query",
      results: []
    };
  } finally {
    if (connection && !monitoredConnection) {
      try {
        await connection.end();
      } catch (err) {
        console.error("Error closing MySQL connection:", err);
      }
    }
  }
});

ipcMain.handle("get-pluralize-function", () => {
  return true;
});

ipcMain.handle("get-singular-form", (event, word) => {
  return pluralize.singular(word);
});

ipcMain.handle("get-plural-form", (event, word) => {
  return pluralize.plural(word);
});

ipcMain.handle("update-env-database", async (event, projectPath, database) => {
  try {
    if (!projectPath || !database) {
      return {
        success: false,
        message: "Missing project path or database name"
      };
    }

    const envPath = path.join(projectPath, ".env");
    if (!fs.existsSync(envPath)) {
      return {
        success: false,
        message: ".env file not found in project"
      };
    }

    let envContent = fs.readFileSync(envPath, "utf8");

    const lines = envContent.split("\n");
    let dbLineFound = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("#")) {
        continue;
      }

      if (line.trim().startsWith("DB_DATABASE=")) {
        console.log(`Found active DB_DATABASE line: "${line}"`);
        lines[i] = `DB_DATABASE=${database}`;
        dbLineFound = true;
        break;
      }
    }

    if (!dbLineFound) {
      console.log("No active DB_DATABASE line found, adding a new one");
      lines.push(`DB_DATABASE=${database}`);
    }

    const updatedContent = lines.join("\n");

    fs.writeFileSync(envPath, updatedContent);

    console.log(`Successfully updated .env file with database: ${database}`);

    return {
      success: true,
      message: `Updated database to ${database} in .env file`
    };
  } catch (error) {
    console.error("Error updating .env database:", error);
    return {
      success: false,
      message: error.message || "Failed to update database in .env file"
    };
  }
});

ipcMain.handle("remove-connection", async (event, connectionId) => {
  try {
    if (!connectionId) {
      return {
        success: false,
        message: "Connection ID is required"
      };
    }

    const connections = store.get("connections") || [];
    const connectionIndex = connections.findIndex((conn) => conn.id === connectionId);

    if (connectionIndex === -1) {
      return {
        success: false,
        message: "Connection not found"
      };
    }

    connections.splice(connectionIndex, 1);

    store.set("connections", connections);

    const openTabs = store.get("openTabs") || {
      tabs: [],
      activeTabId: null
    };
    const updatedTabs = {
      tabs: openTabs.tabs.filter((tab) => tab.connectionId !== connectionId),
      activeTabId: openTabs.activeTabId
    };

    if (updatedTabs.tabs.length === 0 || !updatedTabs.tabs.find((tab) => tab.id === updatedTabs.activeTabId)) {
      updatedTabs.activeTabId = updatedTabs.tabs.length > 0 ? updatedTabs.tabs[0].id : null;
    }

    store.set("openTabs", updatedTabs);

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
    }

    return {
      success: true,
      message: "Connection and related data removed successfully"
    };
  } catch (error) {
    console.error("Error removing connection:", error);
    return {
      success: false,
      message: error.message || "Failed to remove connection"
    };
  }
});

// ipcMain.handle('select-sql-dump-file', async () => {
//   try {
//     return await dialog.showOpenDialog(mainWindow, {
//       title: 'Select SQL Dump File',
//       buttonLabel: 'Select',
//       filters: [{ name: 'SQL Dump Files', extensions: ['sql', 'gz'] }],
//       properties: ['openFile']
//     });
//   } catch (error) {
//     console.error('Error selecting SQL dump file:', error);
//     throw error;
//   }
// });

ipcMain.handle("restore-database", async (event, config) => {
  try {
    if (!config.connectionId || !config.filePath) {
      return {
        success: false,
        message: "Missing connection ID or file path"
      };
    }

    const connections = store.get("connections") || [];
    const connection = connections.find((conn) => conn.id === config.connectionId);

    if (!connection) {
      return {
        success: false,
        message: "Connection not found"
      };
    }

    const channelId = `restore-progress-${Date.now()}`;

    startDatabaseRestoration(event, connection, config, channelId).catch((error) => {
      console.error("Database restoration failed:", error);
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
      message: "Restoration process started",
      channelId: channelId
    };
  } catch (error) {
    console.error("Error starting database restoration:", error);
    return {
      success: false,
      message: error.message || "Failed to start restoration process"
    };
  }
});

async function startDatabaseRestoration(event, connection, config, channelId, customSendProgress = null) {
  const sendProgress = (data) => {
    console.log(`Restoration progress: ${data.progress}% - ${data.status}`);

    if (typeof customSendProgress === "function") {
      customSendProgress(data);
      return;
    }

    if (event && event.sender) {
      event.sender.send(channelId, data);
    }
  };

  try {
    sendProgress({
      progress: 10,
      status: "Preparing to restore database...",
      complete: false
    });

    if (!config.connection && connection) {
      console.log("Moving connection object from parameter to config.connection");
      config.connection = connection;
    }

    let { filePath, ignoredTables = [] } = config;

    if (!filePath && config.sqlFilePath) {
      filePath = config.sqlFilePath;
      config.filePath = config.sqlFilePath;
    }

    let isGzipped = filePath.toLowerCase().endsWith(".gz");

    const useDocker = connection.usingSail || (connection.dockerInfo && connection.dockerInfo.isDocker);
    const containerName = useDocker ? connection.dockerInfo && connection.dockerInfo.dockerContainerName : null;

    try {
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`SQL dump file size: ${fileSizeMB}MB, gzipped: ${isGzipped}`);

      sendProgress({
        progress: 15,
        status: `Processing ${fileSizeMB}MB SQL ${isGzipped ? "gzipped " : ""}file...`,
        complete: false
      });
    } catch (statError) {
      console.error("Error getting file stats:", statError);
    }

    sendProgress({
      progress: 20,
      status: `Detected ${useDocker ? "Docker" : "local"} MySQL environment...`,
      complete: false
    });

    let command = "";
    let commandArgs = [];

    // Create a temporary file for filtered SQL if there are tables to ignore
    let tempFilePath = "";
    if (ignoredTables.length > 0) {
      sendProgress({
        progress: 30,
        status: `Preparing to filter out ${ignoredTables.length} tables...`,
        complete: false
      });

      // Create temp file for filtered content
      tempFilePath = path.join(app.getPath("temp"), `filtered_dump_${Date.now()}.sql`);

      await filterSqlDump(filePath, tempFilePath, ignoredTables, isGzipped, sendProgress);

      sendProgress({
        progress: 50,
        status: "SQL dump filtered successfully, starting restoration...",
        complete: false
      });

      filePath = tempFilePath;
      isGzipped = false;
    } else {
      sendProgress({
        progress: 40,
        status: "Preparing SQL dump file for restoration...",
        complete: false
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      sendProgress({
        progress: 50,
        status: "SQL dump ready, starting restoration...",
        complete: false
      });
    }

    if (useDocker && containerName) {
      config.connection.container = containerName;
      const dockerCmd = buildDockerRestoreCommand(config);
      command = dockerCmd.command;
      commandArgs = dockerCmd.args || [];
    } else {
      const localCmd = buildLocalRestoreCommand(config);
      command = localCmd.command;
      commandArgs = localCmd.args || [];
    }

    sendProgress({
      progress: 60,
      status: "Executing database restoration...",
      complete: false
    });

    try {
      const result = await executeRestoreCommand({ command, args: commandArgs }, filePath, sendProgress);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file ${tempFilePath} deleted successfully`);
      }

      sendProgress({
        progress: 100,
        status: "Database restored successfully",
        complete: true,
        success: true
      });

      return result;
    } catch (execError) {
      console.error("Error executing restore command:", execError);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`Temporary file ${tempFilePath} deleted successfully`);
        } catch (cleanupError) {
          console.error("Error cleaning up temporary file:", cleanupError);
        }
      }

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
    console.error("Error during database restoration:", error);

    if (config.tempFilePath && fs.existsSync(config.tempFilePath)) {
      try {
        fs.unlinkSync(config.tempFilePath);
      } catch (cleanupError) {
        console.error("Error cleaning up temporary file:", cleanupError);
      }
    }

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

async function executeRestoreCommand(commandObj, sqlFilePath, progress) {
  console.log(`Executing restore command with object:`, JSON.stringify(commandObj));

  try {
    const fileSize = fs.statSync(sqlFilePath).size;
    console.log(`SQL file size: ${fileSize} bytes`);

    progress(0.6);
    console.log("Starting database restore process");

    let command, args;

    if (typeof commandObj === "string") {
      command = commandObj;
    } else {
      ({ command, args } = commandObj);
    }

    if (args && args.length > 0) {
      console.log(`Executing using spawn with command: ${command} and args:`, args);
      return new Promise((resolve, reject) => {
        const proc = spawn(command, args);
        let stderr = "";
        let stdout = "";

        proc.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          console.log(`Restore stdout: ${chunk}`);
        });

        proc.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          console.log(`Restore stderr: ${chunk}`);
        });

        proc.on("close", (code) => {
          console.log(`Restore process exited with code ${code}`);
          progress(0.9);

          if (code !== 0) {
            console.error(`Restore failed with code ${code}`);
            console.error(`Error output: ${stderr}`);
            return reject(new Error(`Restore failed with code ${code}: ${stderr}`));
          }

          console.log("Restore completed successfully");
          resolve();
        });

        proc.on("error", (error) => {
          console.error(`Restore error: ${error.message}`);
          reject(new Error(`Failed to execute restore command: ${error.message}`));
        });
      });
    } else {
      console.log("Executing with exec method:", command);
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

          console.log("Restore command completed successfully");
          progress(0.9);
          resolve();
        });
      });
    }
  } catch (error) {
    console.error(`Error executing restore command: ${error.message}`);
    throw error;
  }
}

async function filterSqlDump(inputFile, outputFile, ignoredTables, isGzipped, sendProgress) {
  return new Promise((resolve, reject) => {
    try {
      if (!ignoredTables || ignoredTables.length === 0) {
        if (isGzipped) {
          const gunzip = spawn("gunzip", ["-c", inputFile]);
          const writeStream = fs.createWriteStream(outputFile);

          gunzip.stdout.pipe(writeStream);

          gunzip.on("error", (error) => {
            reject(new Error(`Error decompressing file: ${error.message}`));
          });

          writeStream.on("finish", () => {
            resolve();
          });

          writeStream.on("error", (error) => {
            reject(new Error(`Error writing decompressed file: ${error.message}`));
          });
        } else {
          fs.copyFileSync(inputFile, outputFile);
          resolve();
        }
        return;
      }

      sendProgress({
        progress: 35,
        status: "Reading and filtering SQL dump...",
        complete: false
      });

      let inputStream;
      if (isGzipped) {
        const gunzip = spawn("gunzip", ["-c", inputFile]);
        inputStream = gunzip.stdout;

        gunzip.on("error", (error) => {
          reject(new Error(`Error decompressing file: ${error.message}`));
        });
      } else {
        inputStream = fs.createReadStream(inputFile);
      }

      const writeStream = fs.createWriteStream(outputFile);
      const lineReader = require("readline").createInterface({
        input: inputStream,
        crlfDelay: Infinity
      });

      const patterns = ignoredTables.map((table) => new RegExp(`^(INSERT INTO|CREATE TABLE|DROP TABLE|ALTER TABLE)\\s+\`?${table}\`?`, "i"));

      let skipSection = false;
      let linesProcessed = 0;
      const totalLines = 100000;

      lineReader.on("line", (line) => {
        linesProcessed++;

        if (linesProcessed % 5000 === 0) {
          const estimatedProgress = Math.min(45, 35 + (linesProcessed / totalLines) * 10);
          sendProgress({
            progress: estimatedProgress,
            status: `Processed ${linesProcessed} lines...`,
            complete: false
          });
        }

        if (!skipSection) {
          for (const pattern of patterns) {
            if (pattern.test(line)) {
              skipSection = true;
              break;
            }
          }
        }

        if (skipSection && /;(\s*)$/.test(line)) {
          skipSection = false;
          return;
        }

        if (!skipSection) {
          writeStream.write(line + "\n");
        }
      });

      lineReader.on("close", () => {
        writeStream.end();
      });

      writeStream.on("finish", () => {
        resolve();
      });

      writeStream.on("error", (error) => {
        reject(new Error(`Error writing filtered SQL: ${error.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

ipcMain.handle("set-app-badge", async (_, count) => {
  try {
    if (process.platform === "darwin" || process.platform === "linux") {
      app.setBadgeCount(count || 0);
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting app badge:", error);
    return { success: false, error: error.message };
  }
});
