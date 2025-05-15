<script setup lang="ts">
  import { inject, onMounted } from 'vue';
  import { useSettingsStore } from '@/store/settings';

  import Modal from '@/components/Modal.vue';

  const emit = defineEmits(['close']);

  const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

  const settingsStore = useSettingsStore();

  onMounted(async () => {
    await settingsStore.loadSettings();

    if (!settingsStore.settings.gemini) {
      settingsStore.settings.gemini = {
        apiKey: '',
        model: 'gemini-pro',
      };
    }

    if (!settingsStore.settings.aiProvider) {
      settingsStore.settings.aiProvider = 'openai';
    }

    if (!settingsStore.settings.theme) {
      settingsStore.settings.theme = 'dim';
    } else {
      document.documentElement.setAttribute('data-theme', settingsStore.settings.theme);
    }
  });

  function applyTheme() {
    const selectedTheme = settingsStore.settings.theme;

    document.documentElement.setAttribute('data-theme', selectedTheme);
  }

  async function saveAndClose() {
    try {
      const cleanSettings = JSON.parse(JSON.stringify(settingsStore.settings));

      await settingsStore.updateSettings(cleanSettings);

      showAlert('Settings saved successfully', 'success');

      close();
    } catch (error) {
      console.error('Error saving settings:', error);

      showAlert('Failed to save settings', 'error');
    }
  }

  function close() {
    emit('close');
  }
</script>

<template>
  <Modal
    :show="true"
    title="Settings"
    @close="close"
    @action="saveAndClose"
    :show-action-button="true"
    :action-button-text="'Save'"
  >
    <div class="max-h-[500px] space-y-4 overflow-auto">
      <div class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">AI Provider</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">Select AI Provider</span>
            </label>
            <select
              v-model="settingsStore.settings.aiProvider"
              class="select select-bordered w-full"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div v-if="settingsStore.settings.aiProvider === 'openai'" class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">OpenAI API</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">API Key</span>
            </label>
            <input
              v-model="settingsStore.settings.openai.apiKey"
              type="password"
              placeholder="Enter your OpenAI API key"
              class="input input-bordered w-full"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">AI Model</span>
            </label>
            <select
              v-model="settingsStore.settings.openai.model"
              class="select select-bordered w-full"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div v-if="settingsStore.settings.aiProvider === 'gemini'" class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">Google Gemini API</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">API Key</span>
            </label>
            <input
              v-model="settingsStore.settings.gemini.apiKey"
              type="password"
              placeholder="Enter your Google Gemini API key"
              class="input input-bordered w-full"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">AI Model</span>
            </label>
            <select
              v-model="settingsStore.settings.gemini.model"
              class="select select-bordered w-full"
            >
              <option value="gemini-2.5-pro-preview-03-25">Gemini 2.5 Pro (Preview)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">Language</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">AI Response Language</span>
            </label>
            <select v-model="settingsStore.settings.language" class="select select-bordered w-full">
              <option
                v-for="option in settingsStore.languageOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </fieldset>
        </div>
      </div>

      <div class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">Theme</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">Select Theme</span>
            </label>
            <select
              v-model="settingsStore.settings.theme"
              class="select select-bordered w-full"
              @change="applyTheme"
            >
              <option value="dim">Dim</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="cupcake">Cupcake</option>
              <option value="bumblebee">Bumblebee</option>
              <option value="emerald">Emerald</option>
              <option value="corporate">Corporate</option>
              <option value="synthwave">Synthwave</option>
              <option value="retro">Retro</option>
              <option value="cyberpunk">Cyberpunk</option>
              <option value="valentine">Valentine</option>
              <option value="halloween">Halloween</option>
              <option value="garden">Garden</option>
              <option value="forest">Forest</option>
              <option value="aqua">Aqua</option>
              <option value="lofi">Lofi</option>
              <option value="pastel">Pastel</option>
              <option value="fantasy">Fantasy</option>
              <option value="wireframe">Wireframe</option>
              <option value="black">Black</option>
              <option value="luxury">Luxury</option>
              <option value="dracula">Dracula</option>
              <option value="cmyk">Cmyk</option>
              <option value="autumn">Autumn</option>
              <option value="business">Business</option>
              <option value="acid">Acid</option>
              <option value="lemonade">Lemonade</option>
              <option value="night">Night</option>
              <option value="coffee">Coffee</option>
              <option value="winter">Winter</option>
              <option value="nord">Nord</option>
              <option value="sunset">Sunset</option>
              <option value="caramellatte">Caramellatte</option>
              <option value="abyss">Abyss</option>
            </select>
          </fieldset>
        </div>
      </div>
    </div>
  </Modal>
</template>
