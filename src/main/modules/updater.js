const { app, ipcMain, dialog, shell, BrowserWindow } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const { download } = require("electron-dl");

const CONFIG = {
  updateCheckIntervalMs: 3600000,
  initialCheckDelayMs: 30000,
  quitDelayMs: 1000,
  debugMode: false
};

const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let updateCheckInterval;
let globalUpdateInfo;

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.requestHeaders = { "Cache-Control": "no-cache" };
}

function setupAutoUpdaterEvents() {
  if (isDev) return;

  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("checking-for-update");
  });

  autoUpdater.on("update-available", (info) => {
    handleUpdateAvailable(info);
  });

  autoUpdater.on("update-not-available", () => {
    sendStatusToWindow("update-not-available");
  });

  autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
    sendStatusToWindow("update-error", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = progressObj.percent || 0;

    const normalizedPercent = normalizePercentage(percent);
    sendStatusToWindow("download-progress", { percent: normalizedPercent });

    if (mainWindow) {
      mainWindow.webContents.send("autoUpdater:download-progress", { percent: normalizedPercent });
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    handleUpdateDownloaded(info);
  });
}

function handleUpdateAvailable(updateInfo) {
  setTimeout(async () => {
    globalUpdateInfo = updateInfo;

    if (process.platform === "darwin") {
      sendStatusToWindow("update-available", updateInfo);
      if (mainWindow) {
        mainWindow.webContents.send("update-available", updateInfo);
      }
    } else {
      const result = await dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: "There is an update available for Larabase. Would you like to update it now?",
        buttons: ["Yes", "No"]
      });

      if (result.response === 0) {
        if (mainWindow) {
          mainWindow.webContents.send("update-info", updateInfo);
        }
        await autoUpdater.downloadUpdate();
      }
    }
  }, 2000);
}

function handleUpdateDownloaded() {
  setTimeout(async () => {
    mainWindow.show();

    await dialog.showMessageBox(
      new BrowserWindow({
        show: false,
        alwaysOnTop: true
      }),
      {
        title: "Install Updates",
        message: "Update completed! Restarting the application..."
      }
    );

    setImmediate(() => autoUpdater.quitAndInstall());
  }, 1000);
}

function normalizePercentage(value) {
  if (typeof value === "number" && value > 0 && value < 1) {
    return Math.round(value * 100);
  }

  if (typeof value === "number") {
    return Math.min(100, Math.round(value));
  }

  return 0;
}

function handleDownloadUpdate() {
  setTimeout(async () => {
    if (process.platform === "darwin") {
      const downloadPath = app.getPath("downloads");

      if (!globalUpdateInfo || !globalUpdateInfo.files) {
        console.error("No update info available");
        sendStatusToWindow("update-error", { message: "No update info available" });
        return;
      }

      const files = globalUpdateInfo.files;

      const dmgFile = files.filter((file) => file.url.includes("dmg"))[0];

      if (!dmgFile) {
        console.error("No DMG file found for macOS");
        sendStatusToWindow("update-error", { message: "No DMG file found for macOS" });
        return;
      }

      const fileName = dmgFile.url;
      const downloadedFile = `${downloadPath}/${fileName}`;

      if (fs.existsSync(downloadedFile)) {
        await shell.openPath(downloadedFile);
        app.quit();
      } else {
        if (mainWindow) {
          mainWindow.webContents.send("autoUpdater:update-info", globalUpdateInfo);
        }
      }
    } else {
      if (mainWindow) {
        mainWindow.webContents.send("update-info", globalUpdateInfo);
      }
      await autoUpdater.downloadUpdate();
    }
  }, 3000);
}

function safeRegisterHandler(channel, handler) {
  try {
    ipcMain._invokeHandlers = ipcMain._invokeHandlers || {};
    if (ipcMain._invokeHandlers[channel]) {
      return;
    }

    ipcMain.handle(channel, handler);
    ipcMain._invokeHandlers[channel] = true;
  } catch (err) {
    console.error(`Error registering handler for ${channel}:`, err);
  }
}

function sendStatusToWindow(status, data = null) {
  if (mainWindow) {
    mainWindow.webContents.send("update-status", { status, data });
  }
}

function setupAutoUpdateCheck() {
  const { updateCheckIntervalMs, initialCheckDelayMs } = CONFIG;

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, initialCheckDelayMs);

  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, updateCheckIntervalMs);
}

function registerUpdaterHandlers(window) {
  mainWindow = window;

  setupAutoUpdater();
  setupAutoUpdaterEvents();

  ipcMain.on("main:download-update", () => {
    handleDownloadUpdate();
  });

  ipcMain.on("main:download-progress-info", async (event, downloadUrl) => {
    if (mainWindow) {
      mainWindow.webContents.send("autoUpdater:download-progress", { percent: 0 });
    }

    const properties = {
      onProgress: (progress) => {
        let percent = 0;

        if (typeof progress === "number") {
          percent = progress;
        } else if (progress && typeof progress.percent === "number") {
          percent = progress.percent;
        } else if (progress && typeof progress.transferredBytes === "number" && typeof progress.totalBytes === "number") {
          percent = progress.transferredBytes / progress.totalBytes;
        }

        const normalizedPercent = normalizePercentage(percent);

        if (mainWindow && normalizedPercent > 0) {
          mainWindow.webContents.send("autoUpdater:download-progress", { percent: normalizedPercent });
        }
      },
      onCompleted: (item) => {
        if (mainWindow) {
          mainWindow.webContents.send("autoUpdater:download-progress", { percent: 100 });
          mainWindow.webContents.send("autoUpdater:download-complete", item);
        }
      },
      showBadge: true,
      directory: app.getPath("downloads")
    };

    try {
      await download(mainWindow, downloadUrl, properties);
    } catch (error) {
      console.error("Download error:", error);
      sendStatusToWindow("update-error", { message: error.message });
    }
  });

  ipcMain.on("main:download-complete", async (event, filePath) => {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update completed!",
      message: "The download was completed successfully! Do you want to install now?",
      buttons: ["Yes", "No"]
    });

    if (result.response === 0) {
      await shell.openPath(filePath);
      setTimeout(() => app.quit(), CONFIG.quitDelayMs);
    }
  });

  safeRegisterHandler("check-for-updates", async () => {
    try {
      if (isDev) {
        return { updateAvailable: false };
      }
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      return { error: error.message };
    }
  });

  safeRegisterHandler("download-update", async () => {
    try {
      if (isDev) {
        return { success: false, skipped: true };
      }
      handleDownloadUpdate();
      return { success: true };
    } catch (error) {
      console.error("Error handling download-update:", error);
      return { error: error.message };
    }
  });

  safeRegisterHandler("quit-and-install", () => {
    if (!isDev) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  safeRegisterHandler("get-current-version", () => {
    const version = app.getVersion();
    return version;
  });

  safeRegisterHandler("open-external", (event, url) => {
    return shell.openExternal(url);
  });

  if (!isDev) {
    setupAutoUpdateCheck();
  }
}

function cleanup() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

module.exports = {
  registerUpdaterHandlers,
  cleanup
};
