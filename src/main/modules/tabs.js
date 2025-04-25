const { ipcMain } = require("electron");

function registerTabsHandlers(store) {
  ipcMain.handle("get-open-tabs", () => {
    return store.get("openTabs") || { tabs: [], activeTabId: null };
  });

  ipcMain.handle("save-open-tabs", (event, tabData) => {
    store.set("openTabs", tabData);
    return true;
  });
}

module.exports = {
  registerTabsHandlers
};
