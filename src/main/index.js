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
const { initializeMemoryOptimizer, cleanupMemoryOptimizer, attemptGarbageCollection } = require("./modules/memory-optimizer");

require("./handlers");

const store = new Store();
const dbMonitoringConnections = new Map();
const dbActivityConnections = new Map();

let mainWindow;

const enableGarbageCollection = () => {
  try {
    if (!global.gc) {
      console.log("Garbage collection not exposed. For optimal performance, run with --expose-gc flag");
    } else {
      console.log("Garbage collection available - memory optimization enabled");
    }
  } catch (e) {
    console.error("Failed to check garbage collection status:", e);
  }
};

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

  console.log(`Electron running on platform: ${platform}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Electron version: ${process.versions.electron}`);
}

app.whenReady().then(async () => {
  enhancePath();
  enableGarbageCollection();

  registerConnectionHandlers(store);
  registerTableHandlers(store, dbMonitoringConnections);

  registerMonitoringHandlers(store, dbMonitoringConnections);

  registerRestoreDumpHandlers(store);
  registerTabsHandlers(store);
  registerSettingsHandlers(store);
  registerProjectHandlers();
  registerRedisHandlers();

  await createWindow();

  mainWindow = getMainWindow();

  registerUpdaterHandlers(mainWindow);

  // Initialize memory optimization after everything is set up
  initializeMemoryOptimizer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", async () => {
  cleanup();
  cleanupMemoryOptimizer();

  await clearMonitoringConnections(dbMonitoringConnections, dbActivityConnections);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (global.gc) {
    try {
      attemptGarbageCollection(true);
    } catch (e) {
      console.error("Error running garbage collection before quit:", e);
    }
  }

  cleanupMemoryOptimizer();
  await clearMonitoringConnections(dbMonitoringConnections, dbActivityConnections);
});

ipcMain.handle("trigger-garbage-collection", async () => {
  if (global.gc) {
    try {
      attemptGarbageCollection(true);
      return { success: true };
    } catch (error) {
      console.error("Error triggering garbage collection:", error);
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: "Garbage collection not available" };
  }
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
