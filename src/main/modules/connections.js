const { ipcMain } = require("electron");
const mysql = require("mysql2/promise");

const ERROR_MESSAGES = {
  ER_ACCESS_DENIED_ERROR: "Access denied with the provided credentials",
  ECONNREFUSED: "Connection refused - check host and port",
  ER_BAD_DB_ERROR: (db) => `Database '${db}' does not exist`
};

const SELECT_TEST_SQL = "SELECT 1 AS connection_test";

function _validateParams({ host, port, username, database }) {
  if (!host || !port || !username || !database) {
    throw new Error("Missing required connection parameters");
  }
}

async function _createConnection(config, { selectDb = true } = {}) {
  _validateParams(config);
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password || "",
    database: selectDb ? config.database : undefined,
    connectTimeout: 10000
  });
}

async function _testConnection(config, options) {
  const conn = await _createConnection(config, options);
  try {
    const [rows] = await conn.query(SELECT_TEST_SQL);
    if (!rows.length) {
      throw new Error("Connection established but query failed");
    }
  } finally {
    await conn.end();
  }
}

function registerConnectionHandlers(store) {
  ipcMain.handle("test-mysql-connection", async (_e, config) => {
    try {
      await _testConnection(config, { selectDb: true });
      return { success: true, message: "Connection successful" };
    } catch (err) {
      console.error("Error testing MySQL connection:", err);
      const custom = ERROR_MESSAGES[err.code];
      const message = typeof custom === "function" ? custom(config.database) : custom || err.message;
      return { success: false, message };
    }
  });

  ipcMain.handle("get-connections", () => {
    try {
      return store.get("connections") || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle("update-connection-database", (_e, id, newDb) => {
    if (!id || !newDb) {
      return {
        success: false,
        message: "Connection ID and new database name are required"
      };
    }
    const all = store.get("connections") || [];
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) {
      return { success: false, message: "Connection not found" };
    }
    all[idx].database = newDb;
    store.set("connections", all);
    return {
      success: true,
      message: `Connection database updated to ${newDb}`
    };
  });
}

module.exports = {
  registerConnectionHandlers,
  validateDatabaseConnection: async (config) => {
    try {
      await _testConnection(config, { selectDb: false });
      return true;
    } catch (err) {
      throw new Error(`Connection validation failed: ${err.message}`);
    }
  }
};
