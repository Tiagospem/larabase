<template>
  <div
    class="modal"
    :class="{ 'modal-open': isOpen }"
  >
    <div class="modal-box max-w-4xl bg-base-300">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Project Logs</h3>
        <div class="flex gap-2">
          <button
            v-if="props.projectPath"
            class="btn btn-sm"
            @click="refreshLogs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
          <button
            v-if="props.projectPath"
            class="btn btn-sm"
            title="Open log file in editor"
            @click="openLogFile"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </button>
          <button
            v-if="props.projectPath && logs.length > 0"
            class="btn btn-sm btn-primary"
            @click="confirmDeleteAllLogs"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- Project Path Missing Message -->
      <div
        v-if="!props.projectPath"
        class="py-8 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto mb-4 text-gray-400"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p class="text-lg font-semibold mb-2">No Laravel Project Path Set</p>
        <p class="text-gray-400 mb-4">To view logs, you need to set a Laravel project path for this connection.</p>
        <button
          class="btn btn-primary"
          @click="selectProject"
        >
          Select Laravel Project
        </button>
      </div>

      <!-- Debugging Info when file exists but no logs parsed -->
      <div
        v-else-if="props.projectPath && logs.length === 0"
        class="py-8 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto mb-4 text-gray-400"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p class="text-lg font-semibold mb-2">No Logs Found</p>
        <p class="text-gray-400 mb-4">The log file might exist, but no parsable logs were found.</p>
      </div>

      <!-- Log Content when project path is available and logs exist -->
      <div v-else-if="logs.length > 0">
        <!-- Log filters -->
        <div class="flex mb-4 gap-2">
          <select
            v-model="logTypeFilter"
            class="select select-sm select-bordered"
          >
            <option value="all">All Log Types</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search logs..."
            class="input input-sm input-bordered flex-1"
          />
        </div>

        <!-- Logs table -->
        <div class="overflow-x-auto max-h-[60vh]">
          <table class="table table-xs w-full">
            <thead>
              <tr>
                <th class="w-28">Timestamp</th>
                <th class="w-24">Type</th>
                <th>Message</th>
                <th class="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(log, index) in filteredLogs"
                :key="index"
                class="hover:bg-base-200"
              >
                <td class="text-xs">
                  {{ formatTimestamp(log.timestamp) }}
                </td>
                <td>
                  <span
                    class="badge"
                    :class="getLogTypeBadgeClass(log.type)"
                  >
                    {{ log.type }}
                  </span>
                </td>
                <td
                  class="truncate max-w-md"
                  :title="log.message"
                >
                  {{ log.message }}
                </td>
                <td class="text-right">
                  <button
                    class="btn btn-xs btn-ghost"
                    @click="viewLogDetails(log)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="filteredLogs.length === 0">
                <td
                  colspan="4"
                  class="text-center py-4 text-gray-500"
                >
                  No logs found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-action">
        <button
          class="btn btn-primary"
          @click="close"
        >
          Close
        </button>
      </div>
    </div>
  </div>

  <!-- Log details modal -->
  <div
    class="modal"
    :class="{ 'modal-open': showLogDetails }"
  >
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg flex items-center">
        Log Details
        <span
          v-if="selectedLog"
          class="badge ml-2"
          :class="getLogTypeBadgeClass(selectedLog.type)"
        >
          {{ selectedLog?.type }}
        </span>
      </h3>
      <div
        v-if="selectedLog"
        class="py-4"
      >
        <!-- Log details section - collapsible -->
        <div
          v-if="!hideLogDetails || !analysisResult"
          class="mb-4"
        >
          <div class="flex justify-between items-center mb-2">
            <p class="text-sm">
              <span class="font-semibold">Timestamp:</span>
              {{ formatTimestamp(selectedLog.timestamp, true) }}
            </p>
            <p class="text-sm">
              <span class="font-semibold">File:</span>
              {{ selectedLog.file }}
            </p>
          </div>
          <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap font-mono text-sm">
            {{ selectedLog.message }}
          </div>
          <div
            v-if="selectedLog.stack"
            class="mt-4"
          >
            <p class="font-semibold mb-1">Stack Trace:</p>
            <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap font-mono text-xs">
              {{ selectedLog.stack }}
            </div>
          </div>
        </div>

        <!-- Add AI Analysis button and result section -->
        <div
          v-if="hasOpenAIConfig && !isAnalyzing && !analysisResult"
          class="mt-4 flex justify-between items-center"
        >
          <button
            class="btn btn-accent btn-sm"
            @click="performLogAnalysis"
          >
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
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
              />
            </svg>
            Analyze with AI
          </button>
        </div>

        <div
          v-if="isAnalyzing"
          class="flex justify-center items-center mt-4 py-4"
        >
          <div class="loading loading-spinner text-primary" />
          <span class="ml-3">Analyzing log with AI...</span>
        </div>

        <div
          v-if="analysisResult"
          class="mt-4"
        >
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold flex items-center gap-2">
              AI Analysis
              <span
                v-if="loadedFromCache"
                class="badge badge-sm badge-accent"
                >Cached</span
              >
              <button
                class="btn btn-xs btn-outline"
                @click="toggleLogDetails"
              >
                {{ hideLogDetails ? "Show Log" : "Hide Log" }}
              </button>
            </h4>
            <div class="flex gap-2">
              <button
                v-if="loadedFromCache"
                class="btn btn-xs btn-ghost"
                title="Refresh analysis"
                @click="performLogAnalysis"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
              <button
                class="btn btn-xs btn-ghost"
                title="Copy to clipboard"
                @click="copyAnalysisToClipboard"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div class="bg-base-200 p-4 rounded-lg overflow-auto max-h-96 prose prose-sm prose-invert">
            <div v-html="markdownToHtml(analysisResult)" />
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button
          class="btn btn-primary"
          @click="showLogDetails = false"
        >
          Close
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="showLogDetails = false"
    />
  </div>

  <!-- Confirm delete modal -->
  <div
    class="modal"
    :class="{ 'modal-open': showDeleteConfirm }"
  >
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Confirm Action</h3>
      <p class="py-4">Are you sure you want to delete all logs? This action cannot be undone.</p>
      <div class="modal-action">
        <button
          class="btn btn-error"
          @click="deleteAllLogs"
        >
          Delete All
        </button>
        <button
          class="btn"
          @click="showDeleteConfirm = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from "vue";
import { useSettingsStore } from "@/store/settings";
import { analyzeLogWithAI } from "@/services/ai/LogAnalysisService";
import { marked } from "marked";

// Configure marked for security
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  breaks: true,
  sanitize: true, // Sanitize HTML input
  smartLists: true,
  smartypants: false,
  xhtml: false
});

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  connectionId: {
    type: String,
    required: true
  },
  projectPath: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["close", "select-project"]);
const showAlert = inject("showAlert");
const settingsStore = useSettingsStore();

const logs = ref([]);
const searchQuery = ref("");
const logTypeFilter = ref("all");
const showLogDetails = ref(false);
const selectedLog = ref(null);
const showDeleteConfirm = ref(false);

// New refs for AI analysis
const isAnalyzing = ref(false);
const analysisResult = ref("");
const hideLogDetails = ref(false);
const loadedFromCache = ref(false);
const hasOpenAIConfig = computed(() => {
  return settingsStore.isAIConfigured;
});

// Cache de análises para evitar múltiplas chamadas à API
const analysisCache = ref({});

// Carregar análises do localStorage
function loadAnalysisCache() {
  try {
    console.log("Loading analysis cache for connection ID:", props.connectionId);
    const cacheKey = `analysis_cache_${props.connectionId}`;
    const savedCache = localStorage.getItem(cacheKey);

    if (savedCache) {
      try {
        const parsedCache = JSON.parse(savedCache);
        console.log("Loaded analysis cache from localStorage:", Object.keys(parsedCache).length, "entries");
        console.log("Cache contents sample:", Object.keys(parsedCache).slice(0, 3));
        analysisCache.value = parsedCache;
      } catch (parseError) {
        console.error("Error parsing analysis cache:", parseError);
        analysisCache.value = {};
      }
    } else {
      console.log("No cache found with key:", cacheKey);
      analysisCache.value = {};
    }
  } catch (error) {
    console.error("Error loading analysis cache:", error);
    // Em caso de erro, iniciar com um cache vazio
    analysisCache.value = {};
  }
}

// Salvar análises no localStorage
function saveAnalysisCache() {
  try {
    const cacheKey = `analysis_cache_${props.connectionId}`;
    const cacheJson = JSON.stringify(analysisCache.value);
    localStorage.setItem(cacheKey, cacheJson);
    console.log("Saved analysis cache with key:", cacheKey, "entries:", Object.keys(analysisCache.value).length);
  } catch (error) {
    console.error("Error saving analysis cache:", error);
  }
}

const filteredLogs = computed(() => {
  let filtered = [...logs.value];

  if (logTypeFilter.value !== "all") {
    filtered = filtered.filter((log) => log.type === logTypeFilter.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((log) => log.message.toLowerCase().includes(query) || log.type.toLowerCase().includes(query));
  }

  return filtered.sort((a, b) => b.timestamp - a.timestamp);
});

function formatTimestamp(timestamp, detailed = false) {
  const date = new Date(timestamp);
  if (detailed) {
    return date.toLocaleString();
  }
  return date.toLocaleTimeString();
}

function getLogTypeBadgeClass(type) {
  switch (type.toLowerCase()) {
    case "error":
      return "badge-error";
    case "warning":
      return "badge-warning";
    case "info":
      return "badge-info";
    case "debug":
      return "badge-ghost";
    default:
      return "badge-secondary";
  }
}

function viewLogDetails(log) {
  selectedLog.value = log;

  // Debug para entender a estrutura do log
  console.log("Log being viewed:", {
    id: log.id,
    timestamp: log.timestamp,
    type: log.type,
    file: log.file,
    hasStack: !!log.stack
  });

  // Criar uma chave estável para o cache - combinar timestamp, tipo e parte da mensagem
  const stableId = createStableLogId(log);

  // Verificar se já existe uma análise em cache para este log
  if (analysisCache.value[stableId]) {
    console.log("Analysis found in cache for log ID:", stableId);
    analysisResult.value = analysisCache.value[stableId];
    hideLogDetails.value = true; // Auto-hide log details if analysis exists
    loadedFromCache.value = true; // Indica que a análise foi carregada do cache
  } else {
    console.log("No analysis in cache for log ID:", stableId);
    analysisResult.value = "";
    hideLogDetails.value = false; // Show log details if no analysis
    loadedFromCache.value = false;
  }

  showLogDetails.value = true;
}

// Função para criar um ID estável para o log (para uso como chave de cache)
function createStableLogId(log) {
  // Combinamos timestamp, tipo e um hash parcial da mensagem para criar um ID único e estável
  const messageHash = hashString(log.message).substring(0, 10);
  return `${log.timestamp}_${log.type}_${messageHash}`;
}

// Função simples de hash para mensagens
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Conversão para inteiro de 32 bits
  }
  return Math.abs(hash).toString(16); // Retornar como string hexadecimal
}

function confirmDeleteAllLogs() {
  showDeleteConfirm.value = true;
}

async function deleteAllLogs() {
  try {
    if (!props.projectPath) return;

    const result = await window.api.clearAllProjectLogs({
      projectPath: props.projectPath
    });

    if (result.success) {
      logs.value = [];
      // Limpar o cache de análises quando todos os logs forem apagados
      analysisCache.value = {};
      saveAnalysisCache();
      showDeleteConfirm.value = false;
      showAlert(`Cleared ${result.clearedFiles || "all"} log files`, "success");
    } else {
      console.error("Failed to clear log files:", result.message);
      showAlert(`Failed to clear logs: ${result.message}`, "error");
    }
  } catch (error) {
    console.error("Error clearing log files:", error);
  }
}

function selectProject() {
  emit("select-project");
}

async function openLogFile() {
  try {
    if (!props.projectPath) return;

    let logFilePath = `${props.projectPath}/storage/logs/laravel.log`;

    if (logs.value.length > 0 && logs.value[0].file && logs.value[0].file !== "error") {
      logFilePath = `${props.projectPath}/storage/logs/${logs.value[0].file}`;
    }

    console.log("Opening log file:", logFilePath);
    await window.api.openFile(logFilePath);
  } catch (error) {
    console.error("Error opening log file:", error);
  }
}

async function refreshLogs() {
  try {
    if (!props.projectPath) {
      logs.value = [];
      return;
    }

    console.log("Refreshing logs with project path:", props.projectPath);
    const response = await window.api.getProjectLogs({
      projectPath: props.projectPath
    });
    console.log("Got logs response:", response);
    logs.value = response || [];

    // Limpar análises obsoletas - manter apenas para logs existentes
    cleanupObsoleteAnalyses();
  } catch (error) {
    console.error("Failed to load logs:", error);
    logs.value = [];
  }
}

// Função para limpar análises obsoletas
function cleanupObsoleteAnalyses() {
  if (Object.keys(analysisCache.value).length === 0 || logs.value.length === 0) {
    return;
  }

  // Criar um conjunto de IDs estáveis de logs existentes
  const logStableIds = new Set(logs.value.map((log) => createStableLogId(log)));

  // Extrair IDs do cache
  const cachedIds = Object.keys(analysisCache.value);
  console.log(`Checking ${cachedIds.length} cached analyses against ${logStableIds.size} logs`);

  // Filtrar o cache para manter apenas análises de logs existentes
  const obsoleteIds = cachedIds.filter((id) => !logStableIds.has(id));

  if (obsoleteIds.length > 0) {
    console.log(`Removing ${obsoleteIds.length} obsolete analyses from cache:`, obsoleteIds);

    // Remover análises obsoletas
    obsoleteIds.forEach((id) => {
      delete analysisCache.value[id];
    });

    // Salvar o cache atualizado
    saveAnalysisCache();
  } else {
    console.log("No obsolete analyses found in cache");
  }
}

function close() {
  // Reset analysis results when closing
  analysisResult.value = "";
  hideLogDetails.value = false;
  loadedFromCache.value = false;
  emit("close");
}

// Function to convert markdown to HTML
function markdownToHtml(markdown) {
  if (!markdown) return "";
  return marked.parse(markdown);
}

// Function to analyze the log with AI
async function performLogAnalysis() {
  if (!selectedLog.value) return;

  isAnalyzing.value = true;
  analysisResult.value = "";
  loadedFromCache.value = false; // Reset cache indicator

  try {
    await settingsStore.loadSettings();

    if (!settingsStore.settings.openai.apiKey) {
      showAlert("OpenAI API key is not configured. Please set it in the Settings.", "error");
      return;
    }

    const result = await analyzeLogWithAI(selectedLog.value);
    analysisResult.value = result;

    // Salvar a análise no cache usando a chave estável
    if (selectedLog.value) {
      const stableId = createStableLogId(selectedLog.value);
      console.log("Saving analysis to cache with stable ID:", stableId);
      analysisCache.value[stableId] = result;
      saveAnalysisCache();
    }

    hideLogDetails.value = true; // Auto-hide log details when analysis is ready
  } catch (error) {
    console.error("Error analyzing log with AI:", error);
    showAlert(`Failed to analyze log: ${error.message}`, "error");
  } finally {
    isAnalyzing.value = false;
  }
}

// Function to copy analysis to clipboard
async function copyAnalysisToClipboard() {
  try {
    await navigator.clipboard.writeText(analysisResult.value);
    showAlert("Analysis copied to clipboard", "success");
  } catch (error) {
    showAlert("Failed to copy to clipboard", "error");
  }
}

// Function to toggle log details visibility
function toggleLogDetails() {
  hideLogDetails.value = !hideLogDetails.value;
}

watch(
  () => props.projectPath,
  (newPath) => {
    if (newPath) {
      refreshLogs();
    }
  }
);

watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue && props.projectPath) {
      refreshLogs();
    }
  }
);

onMounted(async () => {
  await settingsStore.loadSettings();

  // Verificar se o localStorage está funcionando
  try {
    const testKey = "larabase_storage_test";
    localStorage.setItem(testKey, "test");
    const testValue = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    if (testValue === "test") {
      console.log("localStorage is working correctly");
    } else {
      console.error("localStorage test failed: set value not retrieved");
      showAlert("Warning: Browser storage is not working properly. Analysis cache may not persist.", "warning");
    }
  } catch (storageError) {
    console.error("localStorage test error:", storageError);
    showAlert("Warning: Browser storage is not available. Analysis cache will not persist.", "warning");
  }

  loadAnalysisCache();

  if (props.projectPath) {
    refreshLogs();
  }
});
</script>

<style scoped>
.modal-box {
  width: 90%;
  max-width: 900px;
}

/* Animação de transição para mostrar/ocultar log */
.mb-4 {
  transition: all 0.3s ease;
}

/* Melhorar legibilidade da análise */
.prose-invert h1,
.prose-invert h2,
.prose-invert h3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.prose-invert ul,
.prose-invert ol {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.prose-invert code {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 0.2em;
}

.prose-invert pre {
  margin: 1em 0;
  padding: 1em;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 0.5em;
}
</style>
