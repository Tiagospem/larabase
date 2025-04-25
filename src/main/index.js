const { app, BrowserWindow, ipcMain } = require("electron");
const Store = require("electron-store");

const { createWindow, getMainWindow } = require("./modules/window");
const { registerRestoreDumpHandlers } = require("./modules/restore-dump");
const { registerConnectionHandlers } = require("./modules/connections");
const { registerProjectHandlers } = require("./modules/project");
const { registerTableHandlers } = require("./modules/tables");
const { registerRedisHandlers } = require("./modules/redis");
const { registerUpdaterHandlers, cleanup } = require("./modules/updater");
const { registerSettingsHandlers } = require("./modules/settings");
const { registerTabsHandlers } = require("./modules/tabs");
const { registerMonitoringHandlers } = require("./modules/monitoring");

const store = new Store();
const dbMonitoringConnections = new Map();
const dbActivityConnections = new Map();

let mainWindow;

app.whenReady().then(async () => {
  registerConnectionHandlers(store);
  registerTableHandlers(store, dbMonitoringConnections);
  registerMonitoringHandlers(store, dbMonitoringConnections, null);
  registerRestoreDumpHandlers(store);
  registerTabsHandlers(store);
  registerSettingsHandlers(store);
  registerProjectHandlers();
  registerRedisHandlers();

  await createWindow();

  mainWindow = getMainWindow();

  registerUpdaterHandlers(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// if (process.env.NODE_ENV === "development") {
//   try {
//     const electronReloadPath = path.join(__dirname, "../../node_modules/electron-reload");
//     if (fs.existsSync(electronReloadPath)) {
//       const electronReload = require(electronReloadPath);
//       const rendererPath = path.resolve(__dirname, "../renderer");
//
//       if (fs.existsSync(rendererPath)) {
//         electronReload(rendererPath, {
//           electron: path.join(__dirname, "../../node_modules", ".bin", "electron"),
//           hardResetMethod: "exit"
//         });
//       } else {
//         console.log(`Renderer path not found: ${rendererPath}`);
//       }
//     } else {
//       console.log("electron-reload module not found, skipping hot reload setup");
//     }
//   } catch (err) {
//     console.error("electron-reload setup error:", err.message);
//   }
// }

app.on("will-quit", async () => {
  cleanup();

  for (const [connectionId, connection] of dbMonitoringConnections.entries()) {
    try {
      await connection.end();
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
    } catch (error) {
      console.error(`Error closing trigger-based monitoring connections for ${connectionId}:`, error);
    }
  }

  dbActivityConnections.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
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
