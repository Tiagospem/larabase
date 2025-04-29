const { ipcMain } = require("electron");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

function setupHandlers() {
  ipcMain.handle("hashPassword", async (_, password) => {
    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      return {
        success: true,
        hash
      };
    } catch (error) {
      console.error("Error hashing password:", error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  ipcMain.handle("update-password", async (_, config) => {
    try {
      const { connectionId, query, params = [] } = config;

      if (!connectionId) {
        throw new Error("Connection ID is required");
      }

      if (!query) {
        throw new Error("SQL query is required");
      }

      const Store = require("electron-store");
      const store = new Store();
      const connections = store.get("connections") || [];
      const connection = connections.find((conn) => conn.id === connectionId);

      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} not found`);
      }

      const conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password || "",
        database: connection.database,
        connectTimeout: 10000
      });

      try {
        const [result] = await conn.execute(query, params);
        return {
          success: true,
          result
        };
      } finally {
        if (conn) {
          try {
            await conn.end();
          } catch (e) {
            console.error("Error closing connection:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error executing SQL:", error);
      return {
        success: false,
        message: error.message
      };
    }
  });
}

setupHandlers();

module.exports = { setupHandlers };
