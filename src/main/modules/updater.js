const { app, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

// Don't initialize autoUpdater in development
const isDev = process.env.NODE_ENV === "development";

// Only configure autoUpdater in production
if (!isDev) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.allowDowngrade = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.requestHeaders = { "Cache-Control": "no-cache" };
}

let updateState = {
  updateAvailable: false,
  updateDownloaded: false,
  dialogOpen: false,
  notifiedVersion: null
};

let mainWindow;

const updateCheckIntervalMs = 3600000;
let updateCheckInterval;

function registerUpdaterHandlers(window) {
  mainWindow = window;

  // Register auto-updater events only in production
  if (!isDev) {
    autoUpdater.on("checking-for-update", () => {
      sendStatusToWindow("checking-for-update");
    });

    autoUpdater.on("update-available", (info) => {
      if (updateState.notifiedVersion === info.version) {
        return;
      }

      updateState.updateAvailable = true;
      updateState.notifiedVersion = info.version;

      sendStatusToWindow("update-available", info);

      if (!updateState.dialogOpen && !updateState.updateDownloaded && mainWindow) {
        updateState.dialogOpen = true;

        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Available",
            message: `A new version (${info.version}) is available.`,
            detail: "Would you like to download it now? The update will be installed when you restart the application.",
            buttons: ["Download", "Later"],
            defaultId: 0
          })
          .then(({ response }) => {
            updateState.dialogOpen = false;
            if (response === 0) {
              autoUpdater.downloadUpdate();
            }
          })
          .catch((err) => {
            updateState.dialogOpen = false;
          });
      }
    });

    autoUpdater.on("update-not-available", (info) => {
      updateState.updateAvailable = false;
      sendStatusToWindow("update-not-available");
    });

    autoUpdater.on("error", (err) => {
      updateState.dialogOpen = false;

      if (err.message && err.message.includes("code signature") && err.message.includes("did not pass validation")) {
        if (process.platform === "darwin" && mainWindow) {
          updateState.dialogOpen = true;

          dialog
            .showMessageBox(mainWindow, {
              type: "info",
              title: "Download Update Manually",
              message: "Auto-update failed due to code signing restrictions",
              detail: "You need to download and install the latest version manually. Would you like to open the download page?",
              buttons: ["Open Download Page", "Cancel"],
              defaultId: 0
            })
            .then(({ response }) => {
              updateState.dialogOpen = false;
              if (response === 0) {
                const { shell } = require("electron");
                shell.openExternal("https://github.com/Tiagospem/larabase/releases/latest");
              }
            });

          return;
        }
      }

      sendStatusToWindow("update-error", err);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      sendStatusToWindow("download-progress", progressObj);
    });

    autoUpdater.on("update-downloaded", (info) => {
      updateState.updateDownloaded = true;
      sendStatusToWindow("update-downloaded", info);

      if (!updateState.dialogOpen && mainWindow) {
        updateState.dialogOpen = true;

        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Ready",
            message: "A new version has been downloaded.",
            detail: "Would you like to restart the application and install the update now?",
            buttons: ["Restart", "Later"],
            defaultId: 0
          })
          .then(({ response }) => {
            updateState.dialogOpen = false;
            if (response === 0) {
              autoUpdater.quitAndInstall(false, true);
            }
          })
          .catch(() => {
            updateState.dialogOpen = false;
          });
      }
    });
  }

  // Always register the required IPC handlers for updater
  // Check if handlers already exist to avoid registration errors
  safeRegisterHandler("check-for-updates", async () => {
    try {
      if (isDev) {
        console.log("Skipping update check in development mode");
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
        console.log("Skipping update download in development mode");
        return { success: false, skipped: true };
      }
      if (!updateState.updateDownloaded) {
        return await autoUpdater.downloadUpdate();
      } else {
        return { alreadyDownloaded: true };
      }
    } catch (error) {
      return { error: error.message };
    }
  });

  safeRegisterHandler("quit-and-install", () => {
    if (!isDev) {
      autoUpdater.quitAndInstall(false, true);
    } else {
      console.log("Skipping quit and install in development mode");
    }
  });

  safeRegisterHandler("get-current-version", () => {
    return app.getVersion();
  });

  if (!isDev) {
    setupAutoUpdateCheck();
  }
}

// Safe registration helper - checks if handler already exists
function safeRegisterHandler(channel, handler) {
  // Check if we already have a handler for this channel
  try {
    ipcMain._invokeHandlers = ipcMain._invokeHandlers || {};
    if (ipcMain._invokeHandlers[channel]) {
      console.log(`Handler for '${channel}' already registered, skipping duplicate registration`);
      return;
    }

    // Register the handler
    ipcMain.handle(channel, handler);

    // Track that we registered this handler
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
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 30000);

  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates();
  }, updateCheckIntervalMs);
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
