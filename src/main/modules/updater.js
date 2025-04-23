const { app, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile, spawn } = require("child_process");

const isDev = process.env.NODE_ENV === "development";

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
  notifiedVersion: null,
  updateInfo: null,
  downloadProgress: 0,
  isDownloading: false
};

let mainWindow;

const updateCheckIntervalMs = 3600000;
let updateCheckInterval;

function registerUpdaterHandlers(window) {
  mainWindow = window;

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
      updateState.updateInfo = info;

      sendStatusToWindow("update-available", info);

      if (!updateState.dialogOpen && !updateState.updateDownloaded && mainWindow) {
        updateState.dialogOpen = true;

        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Available",
            message: `A new version (${info.version}) is available.`,
            detail: "Would you like to download it now?",
            buttons: ["Download", "Later"],
            defaultId: 0
          })
          .then(({ response }) => {
            updateState.dialogOpen = false;
            if (response === 0) {
              handleDownloadUpdate();
            }
          })
          .catch((err) => {
            updateState.dialogOpen = false;
          });
      }
    });

    autoUpdater.on("update-not-available", () => {
      updateState.updateAvailable = false;
      sendStatusToWindow("update-not-available");
    });

    autoUpdater.on("error", (err) => {
      updateState.dialogOpen = false;
      console.error("Update error:", err);

      if (err.message && err.message.includes("code signature") && err.message.includes("did not pass validation")) {
        if (process.platform === "darwin" && mainWindow && updateState.updateInfo) {
          downloadUpdateDirectly();
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

        if (process.platform === "darwin") {
          downloadUpdateDirectly();
        } else {
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
      }
    });
  }

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

      if (process.platform === "darwin") {
        return await downloadUpdateDirectly();
      } else {
        if (!updateState.updateDownloaded) {
          return await autoUpdater.downloadUpdate();
        } else {
          return { alreadyDownloaded: true };
        }
      }
    } catch (error) {
      return { error: error.message };
    }
  });

  safeRegisterHandler("quit-and-install", () => {
    if (!isDev) {
      if (process.platform === "darwin") {
        downloadUpdateDirectly();
      } else {
        autoUpdater.quitAndInstall(false, true);
      }
    }
  });

  safeRegisterHandler("get-current-version", () => {
    return app.getVersion();
  });

  if (!isDev) {
    setupAutoUpdateCheck();
  }
}

function getInstallerExtension() {
  switch (process.platform) {
    case "win32":
      return ".exe";
    case "darwin":
      return ".dmg";
    case "linux":
      return process.arch === "x64" ? ".AppImage" : ".deb";
    default:
      return ".zip";
  }
}

function findInstallerFile(files) {
  if (!files || files.length === 0) return null;

  const extension = getInstallerExtension();

  let installerFile = files.find((file) => file.url && file.url.endsWith(extension));

  if (!installerFile && process.platform === "linux") {
    const altExtensions = [".AppImage", ".deb", ".rpm", ".snap", ".tar.gz"];
    for (const ext of altExtensions) {
      installerFile = files.find((file) => file.url && file.url.endsWith(ext));
      if (installerFile) break;
    }
  }

  if (!installerFile && files.length > 0) {
    installerFile = files[0];
  }

  return installerFile;
}

async function downloadUpdateDirectly() {
  try {
    if (updateState.isDownloading) {
      return { success: false, message: "Download already in progress" };
    }

    if (!updateState.updateInfo || !updateState.updateInfo.files) {
      console.error("No update info available for direct download");
      return { success: false, error: "No update info available" };
    }

    const installerFile = findInstallerFile(updateState.updateInfo.files);

    if (!installerFile) {
      console.error("No appropriate installer file found for this platform");
      return { success: false, error: "No installer file found" };
    }

    const repoOwner = "Tiagospem";
    const repoName = "larabase";
    const version = updateState.updateInfo.version;

    let fileUrl = installerFile.url;
    if (!fileUrl.startsWith("http")) {
      fileUrl = `https://github.com/${repoOwner}/${repoName}/releases/download/v${version}/${installerFile.url}`;
    }

    let extension = path.extname(installerFile.url);
    if (!extension) {
      extension = getInstallerExtension();
    }

    const fileName = `Larabase-${version}${extension}`;
    const downloadPath = path.join(app.getPath("downloads"), fileName);

    sendStatusToWindow("download-progress", { percent: 0 });

    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }

    updateState.isDownloading = true;
    updateState.downloadProgress = 0;

    if (mainWindow) {
      updateState.dialogOpen = true;
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Downloading Update",
        message: `Downloading Larabase ${version}`,
        detail: "The download has started. Please wait...",
        buttons: ["OK"],
        defaultId: 0
      });
    }

    const file = fs.createWriteStream(downloadPath);

    await downloadFile(fileUrl, file, downloadPath);

    if (mainWindow) {
      updateState.dialogOpen = true;
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Downloaded",
        message: "Update has been downloaded successfully",
        detail: "The application will now quit and open the installer. Please follow the installation instructions.",
        buttons: ["Install Now"],
        defaultId: 0
      });
    }

    openInstallerAndQuit(downloadPath);
    return { success: true, path: downloadPath };
  } catch (error) {
    updateState.isDownloading = false;
    console.error("Error in downloadUpdateDirectly:", error);
    return { success: false, error: error.message };
  }
}

async function downloadFile(url, fileStream, downloadPath) {
  return new Promise((resolve, reject) => {
    const handleResponse = (response) => {
      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`Following redirect to: ${response.headers.location}`);

        response.destroy();

        const redirectUrl = new URL(response.headers.location, url).toString();

        const protocol = redirectUrl.startsWith("https") ? https : require("http");
        protocol.get(redirectUrl, handleResponse).on("error", handleError);
        return;
      }

      if (response.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(downloadPath);
        updateState.isDownloading = false;
        reject(new Error(`Server responded with status code ${response.statusCode}`));
        return;
      }

      const totalLength = parseInt(response.headers["content-length"], 10);
      let downloaded = 0;

      response.on("data", (chunk) => {
        if (!updateState.isDownloading) return;

        fileStream.write(chunk);
        downloaded += chunk.length;

        if (totalLength) {
          const percent = Math.round((downloaded / totalLength) * 100);
          if (percent !== updateState.downloadProgress) {
            updateState.downloadProgress = percent;
            sendStatusToWindow("download-progress", { percent });
          }
        }
      });

      response.on("end", () => {
        if (!updateState.isDownloading) return;

        fileStream.end();
        updateState.isDownloading = false;
        console.log(`Download completed: ${downloadPath}`);
        resolve(downloadPath);
      });
    };

    const handleError = (err) => {
      fileStream.close();
      fs.unlink(downloadPath, () => {});
      updateState.isDownloading = false;
      console.error(`Error downloading update: ${err.message}`);
      reject(err);
    };

    const protocol = url.startsWith("https") ? https : require("http");
    protocol.get(url, handleResponse).on("error", handleError);
  }).catch((error) => {
    updateState.isDownloading = false;
    console.error("Download failed:", error);
    sendStatusToWindow("update-error", { message: error.message });
    throw error;
  });
}

function openInstallerAndQuit(filePath) {
  try {
    console.log(`Opening installer at ${filePath} and quitting app`);

    if (process.platform === "darwin") {
      execFile("open", [filePath], (error) => {
        if (error) {
          console.error(`Error opening DMG: ${error.message}`);
          shell.openPath(filePath).then(() => {
            setTimeout(() => app.quit(), 1000);
          });
        } else {
          setTimeout(() => app.quit(), 1000);
        }
      });
    } else if (process.platform === "win32") {
      setTimeout(() => {
        const child = spawn(filePath, [], {
          detached: true,
          stdio: "ignore"
        });
        child.unref();
        app.quit();
      }, 1000);
    } else {
      const extension = path.extname(filePath).toLowerCase();

      if (extension === ".appimage") {
        fs.chmodSync(filePath, "755");
        setTimeout(() => {
          const child = spawn(filePath, [], {
            detached: true,
            stdio: "ignore"
          });
          child.unref();
          app.quit();
        }, 1000);
      } else if (extension === ".deb") {
        shell.openPath(path.dirname(filePath)).then(() => {
          setTimeout(() => app.quit(), 1000);
        });
      } else {
        shell.openPath(filePath).then(() => {
          setTimeout(() => app.quit(), 1000);
        });
      }
    }
  } catch (error) {
    console.error("Error opening installer:", error);
    shell
      .openPath(filePath)
      .then(() => {
        setTimeout(() => app.quit(), 1000);
      })
      .catch(() => {
        shell.showItemInFolder(filePath);
        setTimeout(() => app.quit(), 2000);
      });
  }
}

function handleDownloadUpdate() {
  try {
    downloadUpdateDirectly();
  } catch (error) {
    console.error("Error in handleDownloadUpdate:", error);
    sendStatusToWindow("update-error", { message: error.message });
  }
}

function safeRegisterHandler(channel, handler) {
  try {
    ipcMain._invokeHandlers = ipcMain._invokeHandlers || {};
    if (ipcMain._invokeHandlers[channel]) {
      console.log(`Handler for '${channel}' already registered, skipping duplicate registration`);
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
