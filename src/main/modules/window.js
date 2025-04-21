const { BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

async function createWindow() {
  const isDev = process.env.NODE_ENV === "development";

  const shouldOpenDevTools = false;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
      devTools: isDev
    },
    icon: path.join(__dirname, "../../renderer/assets/icons/png/512x512.png")
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");

    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
      console.error("Failed to load URL", errorCode, errorDescription);

      setTimeout(() => {
        mainWindow.loadURL("http://localhost:5173");
      }, 1000);
    });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../../dist/renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createWindow, getMainWindow };
