const { BrowserWindow, app } = require("electron");
const path = require("path");

let mainWindow;

async function createWindow() {
  const isDev = process.env.NODE_ENV === "development";
  const shouldOpenDevTools = false;

  const appPath = app.getAppPath();

  let preloadPath;
  if (isDev) {
    preloadPath = path.join(appPath, "src/main/preload.js");
  } else {
    preloadPath = path.join(appPath, "dist/preload.cjs");
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 500,
    resizable: true,
    alwaysOnTop: false,
    center: true,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: preloadPath,
      devTools: isDev
    },
    icon: path.join(__dirname, "../../renderer/assets/icons/png/512x512.png")
  });

  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools();
  }

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");

    mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
      console.error("Failed to load URL", errorCode, errorDescription);

      setTimeout(() => {
        mainWindow.loadURL("http://localhost:5173");
      }, 1000);
    });
  } else {
    await mainWindow.loadFile(path.join(process.resourcesPath, "app.asar/dist/renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getMainWindow() {
  if (mainWindow) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (!mainWindow.isFocused()) {
        return;
      }

      if (input.key === "F12" && !input.alt && !input.control && !input.meta && !input.shift) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      if (input.key === "I" && !input.alt && input.shift && (input.control || input.meta)) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }

      if (input.key === "r" && !input.alt && !input.shift && (input.control || input.meta)) {
        mainWindow.reload();
      }
    });
  }

  return mainWindow;
}

module.exports = { createWindow, getMainWindow };
