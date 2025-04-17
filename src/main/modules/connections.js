const { ipcMain } = require('electron');
const mysql = require('mysql2/promise');

const ERROR_MESSAGES = {
  ER_ACCESS_DENIED_ERROR: 'Access denied with the provided credentials',
  ECONNREFUSED: 'Connection refused - check host and port',
  ER_BAD_DB_ERROR: dbName => `Database '${dbName}' does not exist`
};

function validateParams(config) {
  const { host, port, username, database } = config;
  if (!host || !port || !username || !database) {
    throw new Error('Missing required connection parameters');
  }
}

async function testConnection(config, { selectDb = true } = {}) {
  validateParams(config);

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password || '',
    database: selectDb ? config.database : undefined,
    connectTimeout: 10000
  });

  try {
    const [rows] = await connection.query('SELECT 1 AS connection_test');
    if (!rows?.length) {
      throw new Error('Connection established but query failed');
    }
  } finally {
    await connection.end();
  }
}

function testMysqlConnectionHandler() {
  ipcMain.handle('test-mysql-connection', async (_event, config) => {
    try {
      await testConnection(config, { selectDb: true });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('Error testing MySQL connection:', error);

      const custom = ERROR_MESSAGES[error.code];
      const message =
        typeof custom === 'function' ? custom(config.database) : custom || error.message;

      return { success: false, message };
    }
  });
}

async function validateDatabaseConnection(config) {
  try {
    await testConnection(config, { selectDb: false });
    return true;
  } catch (error) {
    throw new Error(`Connection validation failed: ${error.message}`);
  }
}

function updateConnectionDatabaseHandler(store) {
  ipcMain.handle('update-connection-database', async (event, connectionId, newDatabase) => {
    try {
      if (!connectionId || !newDatabase) {
        return {
          success: false,
          message: 'Connection ID and new database name are required'
        };
      }

      const connections = store.get('connections') || [];
      const connectionIndex = connections.findIndex(conn => conn.id === connectionId);

      if (connectionIndex === -1) {
        return {
          success: false,
          message: 'Connection not found'
        };
      }

      connections[connectionIndex].database = newDatabase;

      store.set('connections', connections);

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
}

function registerConnectionHandlers(store) {
  updateConnectionDatabaseHandler(store);
  testMysqlConnectionHandler();
}

module.exports = {
  registerConnectionHandlers,
  validateDatabaseConnection
};
