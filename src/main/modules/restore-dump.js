const { dialog, ipcMain } = require("electron");
const { getMainWindow } = require("../modules/window");
const fs = require("fs");
const { spawn, exec } = require("child_process");
const mysql = require("mysql2/promise");
const { validateDatabaseConnection } = require("./connections");
const docker = require("./docker");

// Destructure needed functions from docker module for easier access
const { executeMysqlFileInContainer, createDockerClient } = docker;

// Add restore process tracking variable
let activeRestoreProcess = null;

// Declare a global variable for tracking ongoing operations
// This will persist even if the process reference is lost
global.ongoingRestoreOperation = false;

function cancelDatabaseRestoreHandler() {
  ipcMain.handle("cancel-database-restore", async () => {
    console.log("Cancelling database restore process");

    // Set global flags for cancellation
    global.cancelRestoreRequested = true;

    // Force immediate termination of any ongoing operation
    if (global.ongoingRestoreOperation) {
      console.log("Force terminating ongoing restore operation");
      global.ongoingRestoreOperation = false;

      // Directly trigger restoration event with cancellation status
      if (global.mainWindow) {
        global.mainWindow.webContents.send("restoration-progress", {
          status: "cancelled",
          progress: 0,
          message: "Operation cancelled by user"
        });
      }
    }

    if (activeRestoreProcess) {
      try {
        // Kill the process more aggressively
        if (activeRestoreProcess.kill) {
          // For child_process instances
          console.log("Killing process with SIGKILL");
          activeRestoreProcess.kill("SIGKILL");
        } else if (activeRestoreProcess.destroy) {
          // For streams
          console.log("Destroying stream");
          activeRestoreProcess.destroy();
        } else if (activeRestoreProcess.stdin) {
          // Try closing stdin if available
          console.log("Closing stdin");
          activeRestoreProcess.stdin.end();
          if (activeRestoreProcess.kill) {
            activeRestoreProcess.kill("SIGKILL");
          }
        }

        // For Docker container executions that might still be running
        if (activeRestoreProcess.dockerExecId && activeRestoreProcess.dockerContainer) {
          try {
            console.log("Attempting to kill Docker exec process");
            const docker = createDockerClient();
            const container = docker.getContainer(activeRestoreProcess.dockerContainer);
            const exec = container.getExec(activeRestoreProcess.dockerExecId);

            // Try to stop the exec instance
            exec.stop().catch((err) => console.error("Error stopping Docker exec:", err));
          } catch (dockerErr) {
            console.error("Error terminating Docker exec:", dockerErr);
          }
        }

        console.log("Database restore process cancelled");
        activeRestoreProcess = null;

        return { success: true, message: "Restoration cancelled" };
      } catch (error) {
        console.error("Error cancelling restore process:", error);
        return { success: false, error: error.message };
      }
    } else {
      console.log("No active restore process to cancel");

      // Even if there's no active process handle, we can check the current progress
      // and notify the frontend about cancellation
      if (global.currentRestoreProgress) {
        console.log("Cancellation requested while operation is in progress");

        // For emergency Docker termination
        if (global.currentRestoreConfig && global.currentRestoreConfig.container) {
          try {
            console.log("Attempting emergency kill of Docker processes");
            const docker = createDockerClient();
            const container = docker.getContainer(global.currentRestoreConfig.container);

            // Force stop MySQL process in the container using a new exec
            const execOptions = {
              Cmd: ["pkill", "-9", "mysql"],
              AttachStdout: true,
              AttachStderr: true
            };

            container
              .exec(execOptions)
              .then((exec) => exec.start())
              .then(() => console.log("Emergency MySQL process termination sent to container"))
              .catch((err) => console.error("Failed to send kill command to container:", err));

            // Alternative approach: send a mysql kill query
            const killOptions = {
              Cmd: ["mysql", "-e", "KILL CONNECTION_ID()"],
              AttachStdout: true,
              AttachStderr: true
            };

            container
              .exec(killOptions)
              .then((exec) => exec.start())
              .then(() => console.log("MySQL kill query sent to container"))
              .catch((err) => console.log("Failed to send MySQL kill command (expected if MySQL is already down)"));
          } catch (err) {
            console.error("Error in emergency Docker termination:", err);
          }
        }

        return { success: true, message: "Cancellation requested" };
      }

      return { success: true, message: "No active process" };
    }
  });
}

function ensureConfig(config, type) {
  if (!config || !config.connection) {
    throw new Error(`Missing connection configuration for ${type} restore command`);
  }
}

function getFileSizeOrThrow(filePath) {
  let size = 0;
  try {
    const stats = fs.statSync(filePath);

    size = stats.size;
  } catch (err) {
    throw new Error(`Error accessing SQL file: ${err.message}`);
  }

  if (size === 0) {
    throw new Error("SQL file is empty (0 bytes)");
  }

  return size;
}

function buildSedFilters(ignoredTables = []) {
  if (!Array.isArray(ignoredTables) || ignoredTables.length === 0) {
    return "";
  }
  // Only filter INSERT statements, not table creation
  const sedCommands = ignoredTables.map((table) => `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`);
  return ` | sed '${sedCommands.join("; ")}'`;
}

function buildBaseCommand(sqlFilePath, sedFilters, useGunzip) {
  const reader = useGunzip ? `gunzip -c "${sqlFilePath}"` : `cat "${sqlFilePath}"`;
  return `set -o pipefail && ${reader}${sedFilters}`;
}

function buildCredentialFlags({ user, password, host, port }) {
  let flags = ` -u${user || "root"}`;
  if (password) flags += ` -p${password}`;
  if (host && host !== "localhost") flags += ` -h${host}`;
  if (port) flags += ` -P${port}`;
  return flags;
}

function buildInitCommand(database) {
  return ` --init-command="CREATE DATABASE IF NOT EXISTS \\\`${database}\\\`; USE \\\`${database}\\\`;"`;
}

async function extractTables(filePath, isGzipped, maxLinesToProcess = 50000) {
  return new Promise((resolve, reject) => {
    try {
      let inputStream;
      if (isGzipped) {
        const gunzip = spawn("gunzip", ["-c", filePath], {
          timeout: 30000
        });
        inputStream = gunzip.stdout;

        gunzip.on("error", (error) => {
          reject(new Error(`Error decompressing file: ${error.message}`));
        });
      } else {
        inputStream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024
        });
      }

      const lineReader = require("readline").createInterface({
        input: inputStream,
        crlfDelay: Infinity
      });

      const tableNames = new Set();
      const tableStats = new Map();

      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const dropTableRegex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const alterTableRegex = /ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;

      let linesProcessed = 0;
      let currentTable = null;
      let currentInsertSize = 0;

      lineReader.on("line", (line) => {
        linesProcessed++;

        if (linesProcessed > maxLinesToProcess) {
          lineReader.close();
          return;
        }

        if (line.trim().startsWith("--") || line.trim().startsWith("#") || line.trim() === "") {
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
        if (currentTable && line.includes("),(")) {
          const rowsInLine = (line.match(/\),\(/g) || []).length;
          if (rowsInLine > 0) {
            const stats = tableStats.get(currentTable);
            if (stats) {
              stats.totalEstimatedRows += rowsInLine;
              tableStats.set(currentTable, stats);
            }
          }
        }

        if (currentTable && line.trim().endsWith(";")) {
          currentTable = null;
          currentInsertSize = 0;
        }

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

      const timeout = setTimeout(() => {
        lineReader.close();
        console.log(`Extraction timed out after processing ${linesProcessed} lines`);
      }, 60000);

      lineReader.on("close", () => {
        clearTimeout(timeout);

        const systemTables = ["mysql", "information_schema", "performance_schema", "sys"];

        const tableResults = [];

        for (const tableName of tableNames) {
          if (systemTables.includes(tableName.toLowerCase())) {
            continue;
          }

          const stats = tableStats.get(tableName) || {
            insertCount: 0,
            maxRowsPerInsert: 0,
            totalEstimatedRows: 0
          };

          let sizeCategory;
          if (stats.totalEstimatedRows === 0) {
            sizeCategory = "empty";
          } else if (stats.totalEstimatedRows < 1000) {
            sizeCategory = "small";
          } else if (stats.totalEstimatedRows < 100000) {
            sizeCategory = "medium";
          } else {
            sizeCategory = "large";
          }

          tableResults.push({
            name: tableName,
            size: sizeCategory,
            estimatedRows: stats.totalEstimatedRows
          });
        }

        tableResults.sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Found ${tableResults.length} tables after processing ${linesProcessed} lines`);
        console.log(
          `Tables by size: ${tableResults.filter((t) => t.size === "empty").length} empty, ` +
            `${tableResults.filter((t) => t.size === "small").length} small, ` +
            `${tableResults.filter((t) => t.size === "medium").length} medium, ` +
            `${tableResults.filter((t) => t.size === "large").length} large`
        );

        resolve(tableResults);
      });

      inputStream.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Error reading SQL file: ${error.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function _buildDockerRestoreCommand(config) {
  ensureConfig(config, "Docker");

  const { connection, sqlFilePath, ignoredTables } = config;
  const { container, database } = connection;

  if (!container) {
    throw new Error("Docker container name is missing or invalid");
  }

  getFileSizeOrThrow(sqlFilePath);

  // Instead of building a shell command, return the configuration
  // that will be used with docker.executeMysqlFileInContainer
  return {
    container,
    connection,
    database,
    sqlFilePath,
    ignoredTables: ignoredTables || [],
    useDockerApi: true
  };
}

function _buildLocalRestoreCommand(config) {
  ensureConfig(config, "local");
  const { connection, sqlFilePath, ignoredTables } = config;
  const { database } = connection;

  getFileSizeOrThrow(sqlFilePath);

  const sedFilters = buildSedFilters(ignoredTables);
  const useGunzip = sqlFilePath.toLowerCase().endsWith(".gz");

  let command = buildBaseCommand(sqlFilePath, sedFilters, useGunzip);

  command += " | mysql";
  command += buildCredentialFlags(connection);
  command += " --binary-mode=1 --force";
  command += buildInitCommand(database);

  return {
    command,
    useShell: true
  };
}

async function _validateDatabaseHasContent(connection) {
  try {
    if (!connection || !connection.host || !connection.database) {
      return { hasContent: false, error: "Invalid connection" };
    }

    const dbConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      user: connection.username || connection.user || "root",
      password: connection.password || "",
      database: connection.database,
      connectTimeout: 10000
    });

    try {
      const [rows] = await dbConnection.query(`SHOW TABLES`);

      if (!rows || rows.length === 0) {
        return { hasContent: false, tableCount: 0 };
      }

      const tableCount = rows.length;

      return { hasContent: tableCount > 0, tableCount };
    } finally {
      await dbConnection.end();
    }
  } catch (error) {
    console.error("Error validating database content:", error);

    return { hasContent: false, error: error.message };
  }
}

async function restoreDatabase(event, config) {
  const sender = event.sender;
  const sendProgress = (status, progress, message) => {
    sender.send("restore:progress", { status, progress, message });
    sender.send("restoration-progress", { status, progress, message });
  };

  // Set global tracking variables
  global.ongoingRestoreOperation = true;
  global.cancelRestoreRequested = false;
  global.currentRestoreProgress = { status: "starting", progress: 0, message: "Starting database restoration process" };

  // Save main window reference for emergency cancellation
  global.mainWindow = getMainWindow();

  sendProgress("starting", 0, "Starting database restoration process");

  try {
    await validateDatabaseConnection(config.connection);
    global.currentRestoreProgress = { status: "validating", progress: 10, message: "Database connection validated" };
    sendProgress("validating", 10, "Database connection validated");
  } catch (err) {
    global.currentRestoreProgress = { status: "error", progress: 0, message: `Connection validation failed: ${err.message}` };
    sendProgress("error", 0, `Connection validation failed: ${err.message}`);
    global.ongoingRestoreOperation = false;
    return { success: false, error: err.message };
  }

  let commandConfig;

  try {
    if (config.connection.docker) {
      commandConfig = await _buildDockerRestoreCommand(config);
      // Store for emergency cancellation
      global.currentRestoreConfig = commandConfig;
    } else {
      commandConfig = _buildLocalRestoreCommand(config);
      global.currentRestoreConfig = commandConfig;
    }
  } catch (err) {
    console.error("Error building restore command:", err);
    global.currentRestoreProgress = { status: "error", progress: 0, message: `Command error: ${err.message}` };
    sendProgress("error", 0, `Command error: ${err.message}`);
    global.ongoingRestoreOperation = false;
    return { success: false, error: err.message };
  }

  global.currentRestoreProgress = { status: "preparing", progress: 20, message: "Starting restoration process" };
  sendProgress("preparing", 20, "Starting restoration process");

  let stdoutData = "";
  let stderrData = "";

  // Flag to track if the operation was cancelled
  let wasCancelled = false;

  try {
    await new Promise((resolve, reject) => {
      // Early cancellation check
      if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
        wasCancelled = true;
        reject(new Error("Operation cancelled by user"));
        return;
      }

      if (commandConfig.useDockerApi) {
        // Use dockerode API for Docker operations
        global.currentRestoreProgress = { status: "restoring", progress: 30, message: "Executing SQL restore in Docker container" };
        sendProgress("restoring", 30, "Executing SQL restore in Docker container");

        // Progress tracking callback
        const progressCallback = (progress) => {
          // Check for cancellation during progress updates
          if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
            console.log("Cancellation detected during progress update");
            return;
          }

          const adjustedProgress = 30 + progress * 0.6; // Scale to 30-90% range
          global.currentRestoreProgress = {
            status: "restoring",
            progress: adjustedProgress,
            message: `Restoring database: ${progress}% complete`
          };
          sendProgress("restoring", adjustedProgress, `Restoring database: ${progress}% complete`);
        };

        executeMysqlFileInContainer(commandConfig.container, commandConfig.connection, commandConfig.database, commandConfig.sqlFilePath, commandConfig.ignoredTables, progressCallback)
          .then((stream) => {
            // Check for cancellation
            if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
              console.log("Cancellation detected after Docker execution");
              wasCancelled = true;

              // Try to terminate the stream
              if (stream && typeof stream === "object" && stream.destroy) {
                stream.destroy();
              }

              reject(new Error("Operation cancelled by user"));
              return;
            }

            // If the function returns a stream, track it for cancellation
            if (stream && typeof stream === "object") {
              activeRestoreProcess = stream;

              // Create an interval to check if the process was cancelled
              const checkCancelInterval = setInterval(() => {
                if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
                  console.log("Cancel request detected, terminating Docker stream");
                  wasCancelled = true;
                  global.cancelRestoreRequested = false;

                  // Attempt to destroy the stream
                  try {
                    if (activeRestoreProcess) {
                      if (activeRestoreProcess.destroy) {
                        activeRestoreProcess.destroy();
                      }

                      // Handle Docker-specific cancellation
                      if (activeRestoreProcess.dockerExecId && activeRestoreProcess.dockerContainer) {
                        try {
                          console.log("Attempting to kill Docker exec process");
                          const docker = createDockerClient();
                          const container = docker.getContainer(activeRestoreProcess.dockerContainer);
                          const exec = container.getExec(activeRestoreProcess.dockerExecId);

                          // Try to stop the exec instance
                          exec.stop().catch((err) => console.error("Error stopping Docker exec:", err));
                        } catch (dockerErr) {
                          console.error("Error terminating Docker exec:", dockerErr);
                        }
                      }
                    }

                    activeRestoreProcess = null;
                    clearInterval(checkCancelInterval);
                    reject(new Error("Operation cancelled by user"));
                  } catch (cancelErr) {
                    console.error("Error during cancellation:", cancelErr);
                  }
                }
              }, 500);

              // Clean up interval on stream end
              stream.on("end", () => {
                clearInterval(checkCancelInterval);
              });

              stream.on("error", () => {
                clearInterval(checkCancelInterval);
              });
            }

            global.currentRestoreProgress = { status: "restoring", progress: 90, message: "Database restored successfully" };
            sendProgress("restoring", 90, "Database restored successfully");
            resolve();
          })
          .catch((err) => {
            console.error("Docker execution error:", err);
            global.currentRestoreProgress = { status: "error", progress: 0, message: `Docker execution error: ${err.message}` };
            sendProgress("error", 0, `Docker execution error: ${err.message}`);
            reject(err);
          });
      } else if (commandConfig.useShell) {
        // Use shell execution with piping for complex commands (local MySQL)
        const child = exec(commandConfig.command, { shell: "/bin/bash" });

        // Keep track of the child process for cancellation
        activeRestoreProcess = child;

        // Create an interval to check if the process was cancelled
        const checkCancelInterval = setInterval(() => {
          if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
            console.log("Cancel request detected, terminating shell process");
            wasCancelled = true;
            global.cancelRestoreRequested = false;

            try {
              if (activeRestoreProcess && activeRestoreProcess.kill) {
                activeRestoreProcess.kill("SIGKILL");
              }

              activeRestoreProcess = null;
              clearInterval(checkCancelInterval);
              reject(new Error("Operation cancelled by user"));
            } catch (cancelErr) {
              console.error("Error during cancellation:", cancelErr);
            }
          }
        }, 500);

        child.stdout.on("data", (chunk) => {
          const text = chunk.toString();
          stdoutData += text;
          const m = text.match(/(\d+)%/);
          if (m) {
            const pct = parseInt(m[1], 10);
            const calc = 20 + pct * 0.8;
            global.currentRestoreProgress = {
              status: "restoring",
              progress: calc,
              message: `Restoring database: ${pct}% complete`
            };
            sendProgress("restoring", calc, `Restoring database: ${pct}% complete`);
          }
        });

        child.stderr.on("data", (chunk) => {
          const text = chunk.toString();
          stderrData += text;
        });

        child.on("error", (err) => {
          clearInterval(checkCancelInterval);
          console.error("Failed to start process:", err);
          global.currentRestoreProgress = { status: "error", progress: 0, message: `Process error: ${err.message}` };
          sendProgress("error", 0, `Process error: ${err.message}`);
          reject(err);
        });

        child.on("close", (code) => {
          // Clear the active process reference
          clearInterval(checkCancelInterval);
          activeRestoreProcess = null;

          if (code === 0) {
            resolve();
          } else if (wasCancelled || !global.ongoingRestoreOperation) {
            reject(new Error("Operation cancelled by user"));
          } else {
            console.error("Restore failed with code", code, stderrData);
            global.currentRestoreProgress = {
              status: "error",
              progress: 0,
              message: `Restoration failed: ${stderrData || `exit code ${code}`}`
            };
            sendProgress("error", 0, `Restoration failed: ${stderrData || `exit code ${code}`}`);
            reject(new Error(stderrData || `Exit code ${code}`));
          }
        });
      }
    });
  } catch (err) {
    // Clear active process reference if error occurs
    activeRestoreProcess = null;

    if (wasCancelled || err.message === "Operation cancelled by user" || !global.ongoingRestoreOperation) {
      global.currentRestoreProgress = { status: "cancelled", progress: 0, message: "Operation cancelled by user" };
      sendProgress("cancelled", 0, "Operation cancelled by user");
      global.ongoingRestoreOperation = false;
      global.currentRestoreConfig = null;
      return { success: false, error: "Operation cancelled by user" };
    }

    global.ongoingRestoreOperation = false;
    global.currentRestoreConfig = null;
    return { success: false, error: err.message };
  }

  // Clear active process reference after completion
  activeRestoreProcess = null;

  // Clear global tracking
  global.currentRestoreProgress = null;
  global.cancelRestoreRequested = false;
  global.ongoingRestoreOperation = false;
  global.currentRestoreConfig = null;

  try {
    const result = await _validateDatabaseHasContent(config.connection);

    if (result.hasContent) {
      sendProgress("completed", 100, `Database restored successfully with ${result.tableCount} tables`);

      return { success: true, tables: result.tableCount };
    } else {
      const warnMsg = "Database restoration seemed to succeed, but no tables were found";
      sendProgress("warning", 100, warnMsg);
      return { success: true, warning: warnMsg };
    }
  } catch (err) {
    console.error("Error validating database content:", err);
    sendProgress("completed", 100, "Database restoration completed");
    return {
      success: true,
      warning: "Could not validate content"
    };
  }
}

function registerRestoreDumpHandlers(store) {
  ipcMain.handle("select-sql-dump-file", async () => {
    try {
      const mainWindow = getMainWindow();

      return await dialog.showOpenDialog(mainWindow, {
        title: "Select SQL Dump File",
        buttonLabel: "Select",
        filters: [{ name: "SQL Dump Files", extensions: ["sql", "gz"] }],
        properties: ["openFile"]
      });
    } catch (error) {
      console.error("Error selecting SQL dump file:", error);
      throw error;
    }
  });

  ipcMain.handle("get-file-stats", async (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return {
          success: false,
          message: "File not found",
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
      console.error("Error getting file stats:", error);

      return {
        success: false,
        message: error.message,
        size: 0
      };
    }
  });

  ipcMain.handle("extract-tables-from-sql", async (event, filePath) => {
    try {
      if (!filePath) {
        return {
          success: false,
          message: "Missing file path",
          tables: []
        };
      }

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: "File not found",
          tables: []
        };
      }

      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      let isGzipped = filePath.toLowerCase().endsWith(".gz");
      let maxLines = 100000;

      if (fileSizeMB > 500) {
        maxLines = 20000;
      } else if (fileSizeMB > 100) {
        maxLines = 50000;
      }

      if (isGzipped) {
        maxLines = Math.min(maxLines, 30000);
      }

      console.log(`Extracting tables from SQL file (${fileSizeMB.toFixed(2)}MB), scanning up to ${maxLines} lines`);

      try {
        const tables = await extractTables(filePath, isGzipped, maxLines);

        if (tables.length === 0) {
          return {
            success: true,
            message: "No tables found in the SQL file. It may be corrupted or not a valid dump file.",
            tables: []
          };
        }

        return {
          success: true,
          tables: tables,
          message: `Found ${tables.length} tables in the SQL file`
        };
      } catch (extractError) {
        console.error("Error during table extraction:", extractError);

        if (extractError.message.includes("decompressing file")) {
          return {
            success: false,
            message: "Error decompressing file. Make sure it is a valid .gz file.",
            tables: []
          };
        }

        return {
          success: false,
          message: extractError.message || "Failed to extract tables from SQL file",
          tables: []
        };
      }
    } catch (error) {
      console.error("Error extracting tables from SQL dump:", error);

      return {
        success: false,
        message: error.message || "Failed to extract tables",
        tables: []
      };
    }
  });

  ipcMain.handle("simple-database-restore-unified", async (event, config) => {
    try {
      if (!config || !config.connectionId || !config.filePath) {
        return {
          success: false,
          message: "Missing required parameters (connectionId or filePath)"
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

      if (!fs.existsSync(config.filePath)) {
        return {
          success: false,
          message: "SQL dump file not found"
        };
      }

      const targetDatabase = config.database || connection.database;

      if (!targetDatabase) {
        return {
          success: false,
          message: "No target database specified"
        };
      }

      const isNewDatabase = targetDatabase !== connection.database;

      if (isNewDatabase) {
        try {
          const tempConn = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password || "",
            connectTimeout: 10000
          });

          try {
            const [existingDbs] = await tempConn.query("SHOW DATABASES");
            const dbExists = existingDbs.some((db) => db.Database === targetDatabase || db.database === targetDatabase);

            if (!dbExists) {
              await tempConn.query(`CREATE DATABASE \`${targetDatabase}\``);
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

      const restoreConfig = {
        connection: {
          ...connection,
          database: targetDatabase,
          user: connection.username,
          docker: connection.usingSail || (connection.dockerInfo && connection.dockerInfo.isDocker),
          container: connection.dockerInfo?.dockerContainerName
        },
        sqlFilePath: config.filePath,
        ignoredTables: config.ignoredTables || []
      };

      if (config.ignoredTables && config.ignoredTables.length > 0) {
        console.log(`Will ignore these tables: ${config.ignoredTables.join(", ")}`);
      }

      const sender = {
        send: (channel, data) => {
          console.log(`Progress update: ${data.progress}% - ${data.status}`);
          if (event && event.sender) {
            event.sender.send("restoration-progress", {
              progress: data.progress
            });
          }
        }
      };

      try {
        const isGzipped = config.filePath.toLowerCase().endsWith(".gz");
        const useDocker = connection.usingSail || (connection.dockerInfo && connection.dockerInfo.isDocker);

        console.log(`Restoring database: ${targetDatabase}`);
        console.log(`Original connection database: ${connection.database}`);
        console.log(`Docker mode: ${useDocker ? "Yes" : "No"}`);
        console.log(`Gzipped file: ${isGzipped ? "Yes" : "No"}`);
        console.log(`Ignored tables: ${restoreConfig.ignoredTables.length}`);

        const restore = await restoreDatabase({ sender }, restoreConfig);

        if (!restore.success) {
          return {
            success: false,
            message: restore.error || "Failed to restore database"
          };
        }

        if (config.setAsDefault && targetDatabase !== connection.database) {
          const updatedConnections = store.get("connections") || [];
          const connectionIndex = updatedConnections.findIndex((conn) => conn.id === config.connectionId);

          if (connectionIndex !== -1) {
            updatedConnections[connectionIndex].database = targetDatabase;
            store.set("connections", updatedConnections);
            console.log(`Updated connection to use database ${targetDatabase} as default`);
          }
        }

        return {
          success: true,
          message: "Database restored successfully",
          database: targetDatabase
        };
      } catch (restoreError) {
        console.error("Error during database restoration:", restoreError);
        return {
          success: false,
          message: restoreError.message || "Failed to restore database"
        };
      }
    } catch (error) {
      console.error("Error in simple-database-restore-unified handler:", error);
      return {
        success: false,
        message: error.message || "Failed to process restore request"
      };
    }
  });

  cancelDatabaseRestoreHandler();
}

module.exports = {
  registerRestoreDumpHandlers
};
