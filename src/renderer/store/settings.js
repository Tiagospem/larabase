import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({
    openai: {
      apiKey: '',
      model: 'gpt-3.5-turbo'
    },
    language: 'en', // en, pt, es
    devMode: false
  });
  
  const isLoading = ref(true);

  async function loadSettings() {
    isLoading.value = true;
    
    try {
      if (window.api) {
        try {
          const savedSettings = await window.api.getSettings();
          
          if (savedSettings) {
            settings.value = savedSettings;
          }
        } catch (err) {
          console.error('Error loading settings from API:', err);
        }
      } else {
        console.warn('API not available, unable to load settings');
      }
      
      return settings.value;
    } catch (error) {
      console.error('Error in loadSettings:', error);
      return settings.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings() {
    try {
      if (window.api) {
        // Create a clean serializable copy of the settings object
        const serializableSettings = JSON.parse(JSON.stringify(settings.value));
        await window.api.saveSettings(serializableSettings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async function updateSettings(newSettings) {
    settings.value = { ...settings.value, ...newSettings };
    await saveSettings();
  }

  const languageOptions = computed(() => {
    return [
      { value: 'en', label: 'English' },
      { value: 'pt', label: 'Portuguese' },
      { value: 'es', label: 'Spanish' }
    ];
  });

  const getLanguageLabel = computed(() => {
    return (code) => {
      const option = languageOptions.value.find(opt => opt.value === code);
      return option ? option.label : code;
    };
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
    getLanguageLabel
  };
}); 