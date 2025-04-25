const { ipcMain } = require("electron");

function registerSettingsHandlers(store) {
  ipcMain.handle("get-settings", () => {
    try {
      return (
        store.get("settings") || {
          aiProvider: "openai",
          openai: {
            apiKey: "",
            model: "gpt-3.5-turbo"
          },
          gemini: {
            apiKey: "",
            model: "gemini-2.0-flash" // Ensure this matches the v1beta API endpoint
          },
          language: "en"
        }
      );
    } catch (error) {
      console.error("Error retrieving settings:", error);
      return {
        aiProvider: "openai",
        openai: { apiKey: "", model: "gpt-3.5-turbo" },
        gemini: { apiKey: "", model: "gemini-2.0-flash" }, // Ensure this matches the v1beta API endpoint
        language: "en"
      };
    }
  });

  ipcMain.handle("save-settings", (event, settings) => {
    try {
      store.set("settings", settings);
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  });
}

module.exports = {
  registerSettingsHandlers
};
