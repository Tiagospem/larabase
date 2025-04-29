const { app, Menu, BrowserWindow } = require("electron");
const { autoUpdater } = require("electron-updater");

function createAppMenu() {
  const isMac = process.platform === "darwin";
  const isDev = process.env.NODE_ENV === "development";

  const checkForUpdates = () => {
    if (!isDev) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("Error checking for updates:", err);
      });
    }
  };

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Check for Updates",
                click: checkForUpdates
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        ...(isMac
          ? []
          : [
              {
                label: "Check for Updates",
                click: checkForUpdates
              },
              { type: "separator" }
            ]),
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "forceReload" }, ...(isDev ? [{ role: "toggleDevTools" }] : [])]
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://github.com/Tiagospem/larabase");
          }
        },
        ...(isMac
          ? []
          : [
              { type: "separator" },
              {
                label: "About " + app.name,
                click: () => {
                  const aboutWindow = new BrowserWindow({
                    width: 300,
                    height: 200,
                    resizable: false,
                    minimizable: false,
                    maximizable: false,
                    parent: BrowserWindow.getFocusedWindow(),
                    modal: true,
                    show: false,
                    webPreferences: {
                      nodeIntegration: true
                    }
                  });

                  aboutWindow.loadURL(`data:text/html;charset=utf-8,
                <html>
                  <head>
                    <title>About ${app.name}</title>
                    <style>
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                        background: #f5f5f5;
                        text-align: center;
                      }
                      h2 { margin-top: 0; }
                      p { margin: 5px 0; }
                    </style>
                  </head>
                  <body>
                    <h2>${app.name}</h2>
                    <p>Version: ${app.getVersion()}</p>
                    <p>Electron: ${process.versions.electron}</p>
                    <p>Node: ${process.versions.node}</p>
                  </body>
                </html>
              `);

                  aboutWindow.once("ready-to-show", () => {
                    aboutWindow.show();
                  });
                }
              }
            ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupAppMenu() {
  createAppMenu();
}

module.exports = {
  setupAppMenu
};
