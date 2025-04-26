import { defineStore } from "pinia";
import { ref, computed, onMounted } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref({
    aiProvider: "openai", // Default to OpenAI
    openai: {
      apiKey: "",
      model: "gpt-3.5-turbo"
    },
    gemini: {
      apiKey: "",
      model: "gemini-2.0-flash" // Make sure this is consistent with the v1beta API
    },
    language: "en",
    devMode: false,
    theme: "dim" // Default theme
  });

  const isLoading = ref(true);

  async function loadSettings() {
    isLoading.value = true;

    try {
      if (window.api) {
        try {
          const savedSettings = await window.api.getSettings();

          if (savedSettings) {
            // Initialize new settings properties if they don't exist
            if (!savedSettings.aiProvider) {
              savedSettings.aiProvider = "openai";
            }

            if (!savedSettings.gemini) {
              savedSettings.gemini = {
                apiKey: "",
                model: "gemini-2.0-flash"
              };
            }

            if (!savedSettings.theme) {
              savedSettings.theme = "dim";
            }

            settings.value = savedSettings;
          }
        } catch (err) {
          console.error("Error loading settings from API:", err);
        }
      } else {
        console.warn("API not available, unable to load settings");
      }

      return settings.value;
    } catch (error) {
      console.error("Error in loadSettings:", error);
      return settings.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings() {
    try {
      if (window.api) {
        const serializableSettings = JSON.parse(JSON.stringify(settings.value));
        await window.api.saveSettings(serializableSettings);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async function updateSettings(newSettings) {
    settings.value = { ...settings.value, ...newSettings };
    await saveSettings();
  }

  const languageOptions = computed(() => {
    return [
      { value: "en", label: "English" },
      { value: "pt", label: "Portuguese" },
      { value: "es", label: "Spanish" }
    ];
  });

  const getLanguageLabel = computed(() => {
    return (code) => {
      const option = languageOptions.value.find((opt) => opt.value === code);
      return option ? option.label : code;
    };
  });

  // Check if AI provider is configured
  const isAIConfigured = computed(() => {
    const provider = settings.value.aiProvider;
    if (provider === "openai") {
      return !!settings.value.openai.apiKey;
    } else if (provider === "gemini") {
      return !!settings.value.gemini.apiKey;
    }
    return false;
  });

  onMounted(async () => {
    await loadSettings();
  });

  return {
    settings,
    isLoading,
    loadSettings,
    saveSettings,
    updateSettings,
    languageOptions,
    getLanguageLabel,
    isAIConfigured
  };
});
