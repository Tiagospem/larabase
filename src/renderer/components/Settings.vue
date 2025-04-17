<template>
  <div class="modal modal-open z-30">
    <div class="modal-box w-11/12 max-w-2xl bg-base-300">
      <h3 class="font-bold text-lg mb-4">Settings</h3>

      <div class="space-y-4">
        <!-- AI Provider Selection -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-md">AI Provider</h3>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Select AI Provider</span>
              </label>
              <select v-model="settingsData.aiProvider" class="select select-bordered w-full">
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
          </div>
        </div>

        <!-- OpenAI Settings -->
        <div v-if="settingsData.aiProvider === 'openai'" class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-md">OpenAI API</h3>

            <div class="form-control">
              <label class="label">
                <span class="label-text">API Key</span>
              </label>
              <input
                v-model="settingsData.openai.apiKey"
                type="password"
                placeholder="Enter your OpenAI API key"
                class="input input-bordered w-full"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">AI Model</span>
              </label>
              <select v-model="settingsData.openai.model" class="select select-bordered w-full">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Gemini Settings -->
        <div v-if="settingsData.aiProvider === 'gemini'" class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-md">Google Gemini API</h3>

            <div class="form-control">
              <label class="label">
                <span class="label-text">API Key</span>
              </label>
              <input
                v-model="settingsData.gemini.apiKey"
                type="password"
                placeholder="Enter your Google Gemini API key"
                class="input input-bordered w-full"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">AI Model</span>
              </label>
              <select v-model="settingsData.gemini.model" class="select select-bordered w-full">
                <option value="gemini-2.5-pro-preview-03-25">Gemini 2.5 Pro (Preview)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Language Settings -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-md">Language</h3>

            <div class="form-control">
              <label class="label">
                <span class="label-text">AI Response Language</span>
              </label>
              <select v-model="settingsData.language" class="select select-bordered w-full">
                <option
                  v-for="option in settingsStore.languageOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Developer Mode (only in development) -->
        <div v-if="isDevelopment" class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-md">Developer Options</h3>

            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Developer Mode</span>
                <input
                  v-model="settingsData.devMode"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </label>
            </div>

            <div v-if="settingsData.devMode" class="mt-4">
              <button class="btn btn-sm btn-outline" @click="showStorageData = true">
                View Electron Storage Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action mt-6">
        <button class="btn btn-primary" @click="saveAndClose">Save</button>
        <button class="btn" @click="close">Cancel</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="close" />
  </div>

  <!-- Storage Data Modal (for developer mode) -->
  <div v-if="showStorageData" class="modal modal-open z-40">
    <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] bg-base-300">
      <h3 class="font-bold text-lg mb-4">Electron Storage Data</h3>
      <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
        <pre><code>{{ JSON.stringify(storageData, null, 2) }}</code></pre>
      </div>
      <div class="modal-action">
        <button class="btn btn-sm btn-primary" @click="copyStorageDataToClipboard">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 mr-1"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
            />
          </svg>
          Copy to Clipboard
        </button>
        <button class="btn" @click="showStorageData = false">Close</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="showStorageData = false" />
  </div>
</template>

<script setup>
import { ref, inject, onMounted, computed, watch } from 'vue';
import { useSettingsStore } from '@/store/settings';
import { useConnectionsStore } from '@/store/connections';
import { useTabsStore } from '@/store/tabs';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const showAlert = inject('showAlert');
const settingsStore = useSettingsStore();
const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();

const settingsData = ref({
  aiProvider: 'openai', // Default to OpenAI
  openai: {
    apiKey: '',
    model: 'gpt-3.5-turbo'
  },
  gemini: {
    apiKey: '',
    model: 'gemini-pro'
  },
  language: 'en',
  devMode: false
});

const showStorageData = ref(false);
const storageData = ref({});
const isDevelopment = computed(() => process.env.NODE_ENV === 'development');

onMounted(async () => {
  await settingsStore.loadSettings();

  // Initialize gemini settings if they don't exist
  if (!settingsStore.settings.gemini) {
    settingsStore.settings.gemini = {
      apiKey: '',
      model: 'gemini-pro'
    };
  }

  // Initialize aiProvider if it doesn't exist
  if (!settingsStore.settings.aiProvider) {
    settingsStore.settings.aiProvider = 'openai';
  }

  Object.assign(settingsData.value, settingsStore.settings);
});

async function saveAndClose() {
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settingsData.value));
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

async function loadStorageData() {
  try {
    const connections = await window.api.getConnections();
    const tabs = await window.api.getOpenTabs();
    const settings = await window.api.getSettings();

    storageData.value = {
      connections,
      tabs,
      settings
    };
  } catch (error) {
    console.error('Error loading storage data:', error);
    showAlert('Failed to load storage data', 'error');
  }
}

async function copyStorageDataToClipboard() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(storageData.value, null, 2));
    showAlert('Storage data copied to clipboard', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showAlert('Failed to copy to clipboard', 'error');
  }
}

watch(showStorageData, newValue => {
  if (newValue) {
    loadStorageData();
  }
});
</script>
