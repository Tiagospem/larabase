const { dialog, ipcMain } = require('electron');
const { getMainWindow } = require('../modules/window');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const mysql = require('mysql2/promise');
const { validateDatabaseConnection } = require('./connections');

function cancelDatabaseRestoreHandler() {
  //to be implemented
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
    throw new Error('SQL file is empty (0 bytes)');
  }

  return size;
}

function buildSedFilters(ignoredTables = []) {
  if (!Array.isArray(ignoredTables) || ignoredTables.length === 0) {
    return '';
  }
  const sedCommands = ignoredTables.map(
    table => `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`
  );
  return ` | sed '${sedCommands.join('; ')}'`;
}

function buildBaseCommand(sqlFilePath, sedFilters, useGunzip) {
  const reader = useGunzip ? `gunzip -c "${sqlFilePath}"` : `cat "${sqlFilePath}"`;
  return `set -o pipefail && ${reader}${sedFilters}`;
}

function buildCredentialFlags({ user, password, host, port }) {
  let flags = ` -u${user || 'root'}`;
  if (password) flags += ` -p${password}`;
  if (host && host !== 'localhost') flags += ` -h${host}`;
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
        const gunzip = spawn('gunzip', ['-c', filePath], { timeout: 30000 });
        inputStream = gunzip.stdout;

        gunzip.on('error', error => {
          reject(new Error(`Error decompressing file: ${error.message}`));
        });
      } else {
        inputStream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024
        });
      }

      const lineReader = require('readline').createInterface({
        input: inputStream,
        crlfDelay: Infinity
      });

      const tableNames = new Set();
      const tableStats = new Map();

      const createTableRegex =
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const dropTableRegex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i;
      const alterTableRegex = /ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;

      let linesProcessed = 0;
      let currentTable = null;
      let currentInsertSize = 0;

      lineReader.on('line', line => {
        linesProcessed++;

        if (linesProcessed > maxLinesToProcess) {
          lineReader.close();
          return;
        }

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

        if (currentTable && line.trim().endsWith(';')) {
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

      lineReader.on('close', () => {
        clearTimeout(timeout);

        const systemTables = ['mysql', 'information_schema', 'performance_schema', 'sys'];

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

        tableResults.sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Found ${tableResults.length} tables after processing ${linesProcessed} lines`);
        console.log(
          `Tables by size: ${tableResults.filter(t => t.size === 'empty').length} empty, ` +
            `${tableResults.filter(t => t.size === 'small').length} small, ` +
            `${tableResults.filter(t => t.size === 'medium').length} medium, ` +
            `${tableResults.filter(t => t.size === 'large').length} large`
        );

        resolve(tableResults);
      });

      inputStream.on('error', error => {
        clearTimeout(timeout);
        reject(new Error(`Error reading SQL file: ${error.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function _buildDockerRestoreCommand(config) {
  ensureConfig(config, 'Docker');

  const { connection, sqlFilePath, ignoredTables } = config;
  const { container, database } = connection;

  if (!container) {
    throw new Error('Docker container name is missing or invalid');
  }

  getFileSizeOrThrow(sqlFilePath);

  const sedFilters = buildSedFilters(ignoredTables);
  const useGunzip = sqlFilePath.toLowerCase().endsWith('.gz');

  let command = buildBaseCommand(sqlFilePath, sedFilters, useGunzip);

  command += ` | docker exec -i ${container} mysql`;
  command += buildCredentialFlags(connection);
  command += ' --binary-mode=1 --force';
  command += buildInitCommand(database);
  //command += ` ${database}`;

  return command;
}

function _buildLocalRestoreCommand(config) {
  ensureConfig(config, 'local');
  const { connection, sqlFilePath, ignoredTables } = config;
  const { database } = connection;

  getFileSizeOrThrow(sqlFilePath);

  const sedFilters = buildSedFilters(ignoredTables);
  const useGunzip = sqlFilePath.toLowerCase().endsWith('.gz');

  let command = buildBaseCommand(sqlFilePath, sedFilters, useGunzip);

  command += ' | mysql';
  command += buildCredentialFlags(connection);
  command += ' --binary-mode=1 --force';
  command += buildInitCommand(database);
  //command += ` ${database}`;

  return command;
}

async function _validateDatabaseHasContent(connection) {
  try {
    if (!connection || !connection.host || !connection.database) {
      return { hasContent: false, error: 'Invalid connection' };
    }

    const dbConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      user: connection.username || connection.user || 'root',
      password: connection.password || '',
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
    console.error('Error validating database content:', error);

    return { hasContent: false, error: error.message };
  }
}

async function restoreDatabase(event, config) {
  const sender = event.sender;
  const sendProgress = (status, progress, message) => {
    sender.send('restore:progress', { status, progress, message });
  };

  sendProgress('starting', 0, 'Starting database restoration process');

  try {
    await validateDatabaseConnection(config.connection);
    sendProgress('validating', 10, 'Database connection validated');
  } catch (err) {
    sendProgress('error', 0, `Connection validation failed: ${err.message}`);
    return { success: false, error: err.message };
  }

  let command;

  try {
    if (config.connection.docker) {
      command = _buildDockerRestoreCommand(config);
    } else {
      command = _buildLocalRestoreCommand(config);
    }
  } catch (err) {
    console.error('Error building restore command:', err);
    sendProgress('error', 0, `Command error: ${err.message}`);
    return { success: false, error: err.message };
  }

  sendProgress('preparing', 20, 'Starting restoration process');

  let stdoutData = '';
  let stderrData = '';

  try {
    await new Promise((resolve, reject) => {
      const child = exec(command, { shell: '/bin/bash' });

      child.stdout.on('data', chunk => {
        const text = chunk.toString();
        stdoutData += text;
        const m = text.match(/(\d+)%/);
        if (m) {
          const pct = parseInt(m[1], 10);
          const calc = 20 + pct * 0.8;
          sendProgress('restoring', calc, `Restoring database: ${pct}% complete`);
        }
      });

      child.stderr.on('data', chunk => {
        const text = chunk.toString();
        stderrData += text;
      });

      child.on('error', err => {
        console.error('Failed to start process:', err);
        sendProgress('error', 0, `Process error: ${err.message}`);
        reject(err);
      });

      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          console.error('Restore failed with code', code, stderrData);
          sendProgress('error', 0, `Restoration failed: ${stderrData || `exit code ${code}`}`);
          reject(new Error(stderrData || `Exit code ${code}`));
        }
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }

  try {
    const result = await _validateDatabaseHasContent(config.connection);

    if (result.hasContent) {
      sendProgress(
        'completed',
        100,
        `Database restored successfully with ${result.tableCount} tables`
      );

      return { success: true, tables: result.tableCount };
    } else {
      const warnMsg = 'Database restoration seemed to succeed, but no tables were found';
      sendProgress('warning', 100, warnMsg);
      return { success: true, warning: warnMsg };
    }
  } catch (err) {
    console.error('Error validating database content:', err);
    sendProgress('completed', 100, 'Database restoration completed');
    return {
      success: true,
      warning: 'Could not validate content'
    };
  }
}

function registerRestoreDumpHandlers(store) {
  ipcMain.handle('select-sql-dump-file', async () => {
    try {
      const mainWindow = getMainWindow();

      return await dialog.showOpenDialog(mainWindow, {
        title: 'Select SQL Dump File',
        buttonLabel: 'Select',
        filters: [{ name: 'SQL Dump Files', extensions: ['sql', 'gz'] }],
        properties: ['openFile']
      });
    } catch (error) {
      console.error('Error selecting SQL dump file:', error);
      throw error;
    }
  });

  ipcMain.handle('cancel-database-restore', async () => {
    console.log('cancel-database-restore, needs to be implemented');
  });

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

      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      let isGzipped = filePath.toLowerCase().endsWith('.gz');
      let maxLines = 100000;

      if (fileSizeMB > 500) {
        maxLines = 20000;
      } else if (fileSizeMB > 100) {
        maxLines = 50000;
      }

      if (isGzipped) {
        maxLines = Math.min(maxLines, 30000);
      }

      console.log(
        `Extracting tables from SQL file (${fileSizeMB.toFixed(2)}MB), scanning up to ${maxLines} lines`
      );

      try {
        const tables = await extractTables(filePath, isGzipped, maxLines);

        if (tables.length === 0) {
          return {
            success: true,
            message:
              'No tables found in the SQL file. It may be corrupted or not a valid dump file.',
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

  ipcMain.handle('simple-database-restore-unified', async (event, config) => {
    try {
      if (!config || !config.connectionId || !config.filePath) {
        return {
          success: false,
          message: 'Missing required parameters (connectionId or filePath)'
        };
      }

      const connections = store.get('connections') || [];
      const connection = connections.find(conn => conn.id === config.connectionId);

      if (!connection) {
        return {
          success: false,
          message: 'Connection not found'
        };
      }

      if (!fs.existsSync(config.filePath)) {
        return {
          success: false,
          message: 'SQL dump file not found'
        };
      }

      const targetDatabase = config.database || connection.database;

      if (!targetDatabase) {
        return {
          success: false,
          message: 'No target database specified'
        };
      }

      const isNewDatabase = targetDatabase !== connection.database;

      if (isNewDatabase) {
        try {
          const tempConn = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password || '',
            connectTimeout: 10000
          });

          try {
            const [existingDbs] = await tempConn.query('SHOW DATABASES');
            const dbExists = existingDbs.some(
              db => db.Database === targetDatabase || db.database === targetDatabase
            );

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
        console.log(`Will ignore these tables: ${config.ignoredTables.join(', ')}`);
      }

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

      try {
        const isGzipped = config.filePath.toLowerCase().endsWith('.gz');
        const useDocker =
          connection.usingSail || (connection.dockerInfo && connection.dockerInfo.isDocker);

        console.log(`Restoring database: ${targetDatabase}`);
        console.log(`Original connection database: ${connection.database}`);
        console.log(`Docker mode: ${useDocker ? 'Yes' : 'No'}`);
        console.log(`Gzipped file: ${isGzipped ? 'Yes' : 'No'}`);
        console.log(`Ignored tables: ${restoreConfig.ignoredTables.length}`);

        const restore = await restoreDatabase({ sender }, restoreConfig);

        if (!restore.success) {
          return {
            success: false,
            message: restore.error || 'Failed to restore database'
          };
        }

        if (config.setAsDefault && targetDatabase !== connection.database) {
          const updatedConnections = store.get('connections') || [];
          const connectionIndex = updatedConnections.findIndex(
            conn => conn.id === config.connectionId
          );

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

  cancelDatabaseRestoreHandler();
}

module.exports = {
  registerRestoreDumpHandlers
};
