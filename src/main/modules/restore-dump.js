const { dialog, ipcMain } = require("electron");
const { getMainWindow } = require("../modules/window");
const fs = require("fs");
const { spawn, exec } = require("child_process");
const mysql = require("mysql2/promise");
const { validateDatabaseConnection } = require("./connections");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const docker = require("./docker");

const { executeMysqlFileInContainer, createDockerClient } = docker;

let activeRestoreProcess = null;

global.ongoingRestoreOperation = false;

function cancelDatabaseRestoreHandler() {
  ipcMain.handle("cancel-database-restore", async () => {
    console.log("Cancelling database restore process");

    global.cancelRestoreRequested = true;

    if (global.ongoingRestoreOperation) {
      console.log("Force terminating ongoing restore operation");
      global.ongoingRestoreOperation = false;

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
        if (activeRestoreProcess.kill) {
          console.log("Killing process with SIGKILL");
          activeRestoreProcess.kill("SIGKILL");
        } else if (activeRestoreProcess.destroy) {
          console.log("Destroying stream");
          activeRestoreProcess.destroy();
        } else if (activeRestoreProcess.stdin) {
          console.log("Closing stdin");
          activeRestoreProcess.stdin.end();
          if (activeRestoreProcess.kill) {
            activeRestoreProcess.kill("SIGKILL");
          }
        }

        if (activeRestoreProcess.dockerExecId && activeRestoreProcess.dockerContainer) {
          try {
            console.log("Attempting to kill Docker exec process");
            const docker = createDockerClient();
            const container = docker.getContainer(activeRestoreProcess.dockerContainer);
            const exec = container.getExec(activeRestoreProcess.dockerExecId);

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

      if (global.currentRestoreProgress) {
        console.log("Cancellation requested while operation is in progress");

        if (global.currentRestoreConfig && global.currentRestoreConfig.container) {
          try {
            console.log("Attempting emergency kill of Docker processes");
            const docker = createDockerClient();
            const container = docker.getContainer(global.currentRestoreConfig.container);

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

  const sedCommands = ignoredTables.map((table) => `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`);
  return ` | sed '${sedCommands.join("; ")}'`;
}

function buildBaseCommand(sqlFilePath, sedFilters, useGunzip, ignoreCreateDatabase = false) {
  const reader = useGunzip ? `gunzip -c "${sqlFilePath}"` : `cat "${sqlFilePath}"`;
  let command = `${reader}${sedFilters}`;

  if (ignoreCreateDatabase) {
    command += ` | sed '/CREATE DATABASE/d; /USE \`/d'`;
  }

  return `set -o pipefail && ${command}`;
}

function buildCredentialFlags({ user, password, host, port }) {
  let flags = ` -u${user || "root"}`;
  if (password) flags += ` -p${password}`;
  if (host && host !== "localhost") flags += ` -h${host}`;
  if (port) flags += ` -P${port}`;
  return flags;
}

function buildInitCommand(database, overwriteCurrentDb = false) {
  if (overwriteCurrentDb) {
    return ` --init-command="USE \\\`${database}\\\`;"`;
  }
  return ` --init-command="CREATE DATABASE IF NOT EXISTS \\\`${database}\\\`; USE \\\`${database}\\\`;"`;
}

function formatCount(n) {
  if (n >= 1_000_000) return `~${Math.round(n / 1_000_000)}m`;
  if (n >= 1_000) return `~${Math.round(n / 1_000)}k`;
  return `${n}`;
}

async function extractTables(filePath, isGzipped) {
  return new Promise((resolve, reject) => {
    let stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    if (isGzipped) {
      const gunzip = zlib.createGunzip();
      stream = stream.pipe(gunzip);
      gunzip.on("error", (e) => reject(new Error(`Decompression error: ${e.message}`)));
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const tableNames = new Set();
    const tableStats = new Map();

    const patterns = {
      create: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i,
      insert: /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?(?:\s*\([^)]+\))?\s+VALUES/i,
      values: /VALUES\s*\(([^)]+)\)/i,
      drop: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i,
      alter: /ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i
    };

    let currentTable = null;
    let insertBuffer = "";
    let lineCounter = 0;
    const maxLines = 100000;

    function countValues(text) {
      const valuesSets = text.match(/\([^)]+\)/g) || [];
      return valuesSets.length;
    }

    function countLargeInsert(buffer) {
      const valueMatches = buffer.match(/\),\s*\(/g) || [];
      const rowCount = valueMatches.length + 1;

      const multipleInserts = buffer.match(/INSERT\s+INTO/gi) || [];
      const insertCount = multipleInserts.length;

      return insertCount > 1 ? rowCount * insertCount : rowCount;
    }

    rl.on("line", (line) => {
      lineCounter++;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("#")) return;

      ["create", "drop", "alter"].forEach((key) => {
        const m = patterns[key].exec(line);
        if (m) {
          tableNames.add(m[1]);
          if (!tableStats.has(m[1])) {
            tableStats.set(m[1], { estimatedRows: 0 });
          }
        }
      });

      const ins = patterns.insert.exec(line);
      if (ins) {
        currentTable = ins[1];
        tableNames.add(currentTable);
        insertBuffer = line;

        if (trimmed.endsWith(";")) {
          const stats = tableStats.get(currentTable) || { estimatedRows: 0 };

          const valueMatches = line.match(/\),\s*\(/g) || [];
          if (valueMatches.length > 0) {
            stats.estimatedRows += valueMatches.length + 1;
          } else if (patterns.values.test(line)) {
            stats.estimatedRows += 1;
          } else {
            stats.estimatedRows += 1;
          }

          tableStats.set(currentTable, stats);
          currentTable = null;
          insertBuffer = "";
        }
        return;
      }

      if (currentTable) {
        insertBuffer += "\n" + line;
        if (trimmed.endsWith(";") || insertBuffer.length > 1000000) {
          processInsert();
        }
      }

      if (lineCounter % maxLines === 0) {
        insertBuffer = "";
        currentTable = null;
      }
    });

    function processInsert() {
      if (!currentTable) return;

      try {
        const largeRowCount = countLargeInsert(insertBuffer);

        const stats = tableStats.get(currentTable) || { estimatedRows: 0 };

        if (largeRowCount > 1) {
          stats.estimatedRows += largeRowCount;
        } else {
          const valuesCount = countValues(insertBuffer);
          if (valuesCount > 0) {
            stats.estimatedRows += valuesCount;
          } else {
            stats.estimatedRows += 1;
          }
        }

        tableStats.set(currentTable, stats);
      } catch (e) {
        const stats = tableStats.get(currentTable) || { estimatedRows: 0 };

        const roughEstimate = Math.ceil(insertBuffer.length / 100);
        if (roughEstimate > 0) {
          stats.estimatedRows += roughEstimate;
        } else {
          stats.estimatedRows += 1;
        }

        tableStats.set(currentTable, stats);
      }

      currentTable = null;
      insertBuffer = "";
    }

    rl.on("close", () => {
      if (currentTable && insertBuffer) {
        processInsert();
      }

      for (const tableName of tableNames) {
        const stats = tableStats.get(tableName);
        if (stats && stats.estimatedRows === 0) {
          let fileHasContent = false;
          try {
            const fileSize = fs.statSync(filePath).size;
            fileHasContent = fileSize > 1000;
          } catch (err) {
            console.error("Error checking file size:", err);
          }

          if (fileHasContent) {
            stats.estimatedRows = 1;
          }
        }
      }

      const system = ["mysql", "information_schema", "performance_schema", "sys"];
      const result = Array.from(tableNames)
        .filter((t) => !system.includes(t.toLowerCase()))
        .sort()
        .map((name) => {
          const rows = tableStats.get(name)?.estimatedRows || 0;
          let size;
          if (rows === 0) size = "empty";
          else if (rows < 1_000) size = "small";
          else if (rows < 100_000) size = "medium";
          else size = "large";
          return {
            name,
            size,
            estimatedRows: rows,
            formattedRows: formatCount(rows)
          };
        });
      resolve(result);
    });

    stream.on("error", (e) => reject(new Error(`Read error: ${e.message}`)));
  });
}

async function _buildDockerRestoreCommand(config) {
  ensureConfig(config, "Docker");

  const { connection, sqlFilePath, ignoredTables, overwriteCurrentDb } = config;
  const { container, database } = connection;

  if (!container) {
    throw new Error("Docker container name is missing or invalid");
  }

  getFileSizeOrThrow(sqlFilePath);

  return {
    container,
    connection,
    database,
    sqlFilePath,
    ignoredTables: ignoredTables || [],
    overwriteCurrentDb: overwriteCurrentDb === true,
    useDockerApi: true,
    ignoreCreateDatabase: overwriteCurrentDb === true
  };
}

function _buildLocalRestoreCommand(config) {
  ensureConfig(config, "local");
  const { connection, sqlFilePath, ignoredTables, overwriteCurrentDb } = config;
  const { database } = connection;

  getFileSizeOrThrow(sqlFilePath);

  const sedFilters = buildSedFilters(ignoredTables);
  const useGunzip = sqlFilePath.toLowerCase().endsWith(".gz");

  let command = buildBaseCommand(sqlFilePath, sedFilters, useGunzip, overwriteCurrentDb);

  command += " | mysql";
  command += buildCredentialFlags(connection);
  command += " --binary-mode=1 --force";
  command += buildInitCommand(database, overwriteCurrentDb);

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

  global.ongoingRestoreOperation = true;
  global.cancelRestoreRequested = false;
  global.currentRestoreProgress = { status: "starting", progress: 0, message: "Starting database restoration process" };

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

  let wasCancelled = false;

  try {
    await new Promise((resolve, reject) => {
      if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
        wasCancelled = true;
        reject(new Error("Operation cancelled by user"));
        return;
      }

      if (commandConfig.useDockerApi) {
        global.currentRestoreProgress = { status: "restoring", progress: 30, message: "Executing SQL restore in Docker container" };
        sendProgress("restoring", 30, "Executing SQL restore in Docker container");

        const progressCallback = (progress) => {
          if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
            console.log("Cancellation detected during progress update");
            return;
          }

          const adjustedProgress = 30 + progress * 0.6;
          global.currentRestoreProgress = {
            status: "restoring",
            progress: adjustedProgress,
            message: `Restoring database: ${progress}% complete`
          };
          sendProgress("restoring", adjustedProgress, `Restoring database: ${progress}% complete`);
        };

        executeMysqlFileInContainer(
          commandConfig.container,
          commandConfig.connection,
          commandConfig.database,
          commandConfig.sqlFilePath,
          commandConfig.ignoredTables,
          progressCallback,
          commandConfig.overwriteCurrentDb,
          commandConfig.ignoreCreateDatabase
        )
          .then((stream) => {
            if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
              console.log("Cancellation detected after Docker execution");
              wasCancelled = true;

              if (stream && typeof stream === "object" && stream.destroy) {
                stream.destroy();
              }

              reject(new Error("Operation cancelled by user"));
              return;
            }

            if (stream && typeof stream === "object") {
              activeRestoreProcess = stream;

              const checkCancelInterval = setInterval(() => {
                if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
                  console.log("Cancel request detected, terminating Docker stream");
                  wasCancelled = true;
                  global.cancelRestoreRequested = false;

                  try {
                    if (activeRestoreProcess) {
                      if (activeRestoreProcess.destroy) {
                        activeRestoreProcess.destroy();
                      }

                      if (activeRestoreProcess.dockerExecId && activeRestoreProcess.dockerContainer) {
                        try {
                          console.log("Attempting to kill Docker exec process");
                          const docker = createDockerClient();
                          const container = docker.getContainer(activeRestoreProcess.dockerContainer);
                          const exec = container.getExec(activeRestoreProcess.dockerExecId);

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
        const child = exec(commandConfig.command, { shell: "/bin/bash" });

        activeRestoreProcess = child;

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

  activeRestoreProcess = null;

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
        return { success: false, message: "Missing file path", tables: [] };
      }

      if (!fs.existsSync(filePath)) {
        return { success: false, message: "File not found", tables: [] };
      }

      const isGzipped = filePath.toLowerCase().endsWith(".gz");
      console.log(`Scanning SQL dump for tables: ${filePath}`);

      const tables = await extractTables(filePath, isGzipped);
      if (tables.length === 0) {
        return {
          success: true,
          message: "No tables found in the SQL file. It may be corrupted or not a valid dump file.",
          tables: []
        };
      }

      return {
        success: true,
        tables,
        message: `Found ${tables.length} tables in the SQL dump.`
      };
    } catch (err) {
      console.error("Error extracting tables:", err);
      return { success: false, message: err.message || "Extraction failed", tables: [] };
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
      const isOverwritingCurrentDb = config.overwriteCurrentDb === true;

      if (isNewDatabase && !isOverwritingCurrentDb) {
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
        ignoredTables: config.ignoredTables || [],
        overwriteCurrentDb: isOverwritingCurrentDb
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
        console.log(`Overwrite current DB: ${isOverwritingCurrentDb ? "Yes" : "No"}`);
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
