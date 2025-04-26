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
const { registerMonitoringHandlers, clearMonitoringConnections } = require("./modules/monitoring");

const store = new Store();
const dbMonitoringConnections = new Map();
const dbActivityConnections = new Map();

let mainWindow;

app.whenReady().then(async () => {
  registerConnectionHandlers(store);
  registerTableHandlers(store, dbMonitoringConnections);

  await createWindow();

  mainWindow = getMainWindow();

  registerMonitoringHandlers(store, dbMonitoringConnections, mainWindow);

  registerRestoreDumpHandlers(store);
  registerTabsHandlers(store);
  registerSettingsHandlers(store);
  registerProjectHandlers();
  registerRedisHandlers();
  registerUpdaterHandlers(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", async () => {
  cleanup();

  await clearMonitoringConnections(dbMonitoringConnections, dbActivityConnections);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await clearMonitoringConnections(dbMonitoringConnections, dbActivityConnections);
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
