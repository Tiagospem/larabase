<template>
  <Modal
    :show="true"
    title="Settings"
    @close="close"
    @action="saveAndClose"
    :show-action-button="true"
    :action-button-text="'Save'"
  >
    <div class="space-y-4 max-h-[500px] overflow-auto">
      <div class="card bg-base-100">
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">AI Provider</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">Select AI Provider</span>
            </label>
            <select
              v-model="settingsData.aiProvider"
              class="select select-bordered w-full"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div
        v-if="settingsData.aiProvider === 'openai'"
        class="card bg-base-100"
      >
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">OpenAI API</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">API Key</span>
            </label>
            <input
              v-model="settingsData.openai.apiKey"
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
              v-model="settingsData.openai.model"
              class="select select-bordered w-full"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div
        v-if="settingsData.aiProvider === 'gemini'"
        class="card bg-base-100"
      >
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">Google Gemini API</h3>

          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">API Key</span>
            </label>
            <input
              v-model="settingsData.gemini.apiKey"
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
              v-model="settingsData.gemini.model"
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
            <select
              v-model="settingsData.language"
              class="select select-bordered w-full"
            >
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
              v-model="settingsData.theme"
              class="select select-bordered w-full"
              @change="applyTheme"
            >
              <option value="dim">Larabase</option>
              <option value="dark">Laradumps</option>
              <option value="light">Symfony</option>
              <option value="cupcake">Bootstrap</option>
              <option value="bumblebee">JavaScript</option>
              <option value="emerald">NodeJS</option>
              <option value="corporate">TypeScript</option>
              <option value="synthwave">VueJS</option>
              <option value="retro">ReactJS</option>
              <option value="cyberpunk">TailwindCSS</option>
              <option value="valentine">Ruby</option>
              <option value="halloween">Python</option>
              <option value="garden">Django</option>
              <option value="forest">MongoDB</option>
              <option value="aqua">Docker</option>
              <option value="lofi">Redis</option>
              <option value="pastel">MySQL</option>
              <option value="fantasy">PostgreSQL</option>
              <option value="wireframe">ElasticSearch</option>
              <option value="black">Git</option>
              <option value="luxury">GitHub</option>
              <option value="dracula">Artisan</option>
              <option value="cmyk">Blade</option>
              <option value="autumn">Eloquent</option>
              <option value="business">Tinker</option>
              <option value="acid">Vite</option>
              <option value="lemonade">Livewire</option>
              <option value="night">AlpineJS</option>
              <option value="coffee">Inertia</option>
              <option value="winter">Breeze</option>
              <option value="dim">Larabase</option>
              <option value="nord">Jetstream</option>
              <option value="sunset">Sanctum</option>
              <option value="caramellatte">Horizon</option>
              <option value="abyss">Forge</option>
            </select>
          </fieldset>
        </div>
      </div>

      <div
        v-if="isDevelopment"
        class="card bg-base-100"
      >
        <div class="card-body space-y-4">
          <h3 class="card-title text-md">Developer Options</h3>

          <fieldset class="fieldset">
            <label class="label cursor-pointer">
              <span class="label-text">Developer Mode</span>
              <input
                v-model="settingsData.devMode"
                type="checkbox"
                class="toggle toggle-primary"
              />
            </label>
          </fieldset>

          <fieldset
            v-if="settingsData.devMode"
            class="fieldset"
          >
            <label class="label cursor-pointer">
              <span class="label-text">Performance Monitor</span>
              <input
                v-model="settingsData.performanceMonitor"
                type="checkbox"
                class="toggle toggle-warning"
              />
            </label>
            <p class="text-xs text-opacity-70 mt-1">Display memory and event listeners statistics in the database view footer</p>
          </fieldset>

          <div
            v-if="settingsData.devMode"
            class="mt-4"
          >
            <button
              class="btn btn-sm btn-outline"
              @click="showStorageData = true"
            >
              View Electron Storage Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </Modal>

  <Modal
    :show="showStorageData"
    title="Electron Storage Data"
    @close="showStorageData = false"
  >
    <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
      <pre><code>{{ JSON.stringify(storageData, null, 2) }}</code></pre>
    </div>
  </Modal>
</template>
<script setup>
import { ref, inject, onMounted, computed, watch } from "vue";
import { useSettingsStore } from "@/store/settings";
import { useConnectionsStore } from "@/store/connections";
import Modal from "@/components/Modal.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close"]);

const showAlert = inject("showAlert");
const settingsStore = useSettingsStore();
const connectionsStore = useConnectionsStore();

const settingsData = ref({
  aiProvider: "openai",
  openai: {
    apiKey: "",
    model: "gpt-3.5-turbo"
  },
  gemini: {
    apiKey: "",
    model: "gemini-pro"
  },
  language: "en",
  devMode: false,
  performanceMonitor: false,
  theme: "dim"
});

const showStorageData = ref(false);
const storageData = ref({});
const isDevelopment = computed(() => process.env.NODE_ENV === "development");

onMounted(async () => {
  await settingsStore.loadSettings();

  if (!settingsStore.settings.gemini) {
    settingsStore.settings.gemini = {
      apiKey: "",
      model: "gemini-pro"
    };
  }

  if (!settingsStore.settings.aiProvider) {
    settingsStore.settings.aiProvider = "openai";
  }

  if (!settingsStore.settings.theme) {
    settingsStore.settings.theme = "dim";
  } else {
    // Apply saved theme on component mount
    document.documentElement.setAttribute("data-theme", settingsStore.settings.theme);
  }

  Object.assign(settingsData.value, settingsStore.settings);
});

function applyTheme() {
  const selectedTheme = settingsData.value.theme;
  document.documentElement.setAttribute("data-theme", selectedTheme);
}

async function saveAndClose() {
  try {
    const cleanSettings = JSON.parse(JSON.stringify(settingsData.value));
    await settingsStore.updateSettings(cleanSettings);
    showAlert("Settings saved successfully", "success");
    close();
  } catch (error) {
    console.error("Error saving settings:", error);
    showAlert("Failed to save settings", "error");
  }
}

function close() {
  emit("close");
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
    console.error("Error loading storage data:", error);
    showAlert("Failed to load storage data", "error");
  }
}

watch(showStorageData, (newValue) => {
  if (newValue) {
    loadStorageData();
  }
});
</script>
