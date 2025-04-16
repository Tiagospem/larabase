const { ipcMain } = require('electron');
const mysql = require('mysql2/promise');

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

async function validateDatabaseConnection(config) {
  console.log('Validating database connection:', config.database);

  if (!config.host || !config.port || !config.username || !config.database) {
    throw new Error('Missing required connection parameters');
  }

  let connection;

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password || '',
      connectTimeout: 10000
    });
  } catch (error) {
    throw new Error(`Connection validation failed: ${error.message}`);
  }

  try {
    const [rows] = await connection.query('SELECT 1 as connection_test');

    if (rows && rows.length > 0) {
      return true;
    } else {
      throw new Error('Connection established but query failed');
    }
  } finally {
    await connection.end();
  }
}

function registerConnectionHandlers(store) {
  updateConnectionDatabaseHandler(store);
}

module.exports = {
  registerConnectionHandlers,
  validateDatabaseConnection
};
