<template>
  <div class="flex flex-col h-full relative">
    <BaseHeader
      @goBack="goBack"
      title="SQL Editor"
    >
      <template #actions>
        <button
          v-if="hasOpenAIConfig"
          class="btn btn-accent btn-sm mr-2"
          title="AI SQL Generator"
          @click="showAIModal = true"
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
          AI Assistant
        </button>
        <button
          class="btn btn-primary btn-sm mr-2"
          @click="runQuery"
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
              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
            />
          </svg>
          Run Query
        </button>
        <button
          class="btn btn-sm btn-error"
          @click="clearQuery"
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
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
          Clear
        </button>
      </template>
    </BaseHeader>

    <div class="flex flex-col flex-1 overflow-hidden">
      <div
        class="bg-base-100 overflow-hidden flex flex-col"
        :style="{ height: `${editorHeight}px` }"
      >
        <div class="p-2 text-sm font-semibold border-b border-black/10 flex justify-between">
          <span>SQL Query Editor</span>
          <div class="flex items-center">
            <button
              class="btn btn-xs btn-ghost"
              @click="toggleEditorFullscreen"
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
                  v-if="isEditorFullscreen"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 9V4.5M9 9H4.5M15 9H19.5M15 9V4.5M15 14.5V19.5M15 14.5H19.5M9 14.5H4.5M9 14.5V19.5"
                />
                <path
                  v-else
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
            </button>
          </div>
        </div>
        <textarea
          v-model="sqlQuery"
          class="w-full h-full p-4 resize-none bg-base-100 font-mono text-sm focus:outline-hidden"
          placeholder="Enter your SQL query here..."
          @keydown.tab.prevent="handleTab"
        />
      </div>

      <div
        class="h-1 bg-base-300 cursor-row-resize hover:bg-primary"
        @mousedown="startResize"
      />

      <div class="flex-1 bg-base-100 overflow-hidden flex flex-col">
        <div class="p-2 text-sm font-semibold border-b border-black/10 flex justify-between items-center">
          <span>Query Results</span>
          <div class="flex items-center">
            <div
              v-if="isLoading"
              class="loading loading-spinner loading-xs mr-2"
            />
            <span
              v-if="results.length && !isLoading"
              class="text-xs mr-2"
            >
              {{ rowCount }} rows returned in {{ queryTime }}ms
            </span>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          <div
            v-if="errorMessage"
            class="p-4 text-error"
          >
            <div class="font-semibold mb-2">Error:</div>
            <pre class="whitespace-pre-wrap text-sm">{{ errorMessage }}</pre>
          </div>

          <div
            v-else-if="!results.length && !isLoading"
            class="flex items-center justify-center h-full"
          >
            <div class="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-12 h-12 mx-auto mb-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <p class="text-sm">Run a query to see results</p>
            </div>
          </div>

          <div
            v-else-if="results.length && !isLoading"
            class="p-0"
          >
            <div class="relative overflow-x-auto">
              <table class="w-full text-sm text-left border-collapse">
                <thead class="sticky">
                  <tr>
                    <th
                      v-for="(column, index) in columns"
                      :key="index"
                      class="px-4 py-2 font-semibold sticky top-0 bg-base-300"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in results"
                    :key="rowIndex"
                    class="border-b border-black/10 hover:bg-base-300"
                  >
                    <td
                      v-for="(column, colIndex) in columns"
                      :key="colIndex"
                      class="px-4 py-2 whitespace-nowrap"
                    >
                      <span v-if="row[column] === null">
                        <span class="text-gray-500 italic">NULL</span>
                      </span>
                      <span v-else-if="typeof row[column] === 'object'">
                        {{ JSON.stringify(row[column]) }}
                      </span>
                      <span v-else>
                        {{ row[column] }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <SQLAIModal
      v-if="showAIModal"
      :database-structure="databaseStructure"
      @close="showAIModal = false"
      @apply-sql="applySQLFromAI"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onErrorCaptured, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";
import { useDatabaseStore } from "@/store/database";
import { useSettingsStore } from "@/store/settings";
import SQLAIModal from "../components/SQLAIModal.vue";
import BaseHeader from "@/components/ui/BaseHeader.vue";

const route = useRoute();
const router = useRouter();
const connectionId = computed(() => route.params.id);
const connectionsStore = useConnectionsStore();
const databaseStore = useDatabaseStore();
const settingsStore = useSettingsStore();
const showAlert = inject("showAlert");

const sqlQuery = ref("");
const results = ref([]);
const columns = ref([]);
const rowCount = ref(0);
const queryTime = ref(0);
const isLoading = ref(false);
const errorMessage = ref("");
const editorHeight = ref(window.innerHeight * 0.4); // 40% of window height by default
const isResizing = ref(false);
const isEditorFullscreen = ref(false);
const showAIModal = ref(false);
const databaseStructure = ref("");
const hasRenderError = ref(false);
const renderErrorMessage = ref("");

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

const hasOpenAIConfig = computed(() => {
  return settingsStore.isAIConfigured;
});

onErrorCaptured((error, instance, info) => {
  console.error("Error captured:", error, info);
  hasRenderError.value = true;
  renderErrorMessage.value = `${error.message}\n\nInfo: ${info}`;
  return false;
});

onMounted(async () => {
  if (connectionId.value) {
    localStorage.setItem("sqlEditorConnectionId", connectionId.value);
  }

  let currentConnectionId = connectionId.value;
  if (!currentConnectionId) {
    currentConnectionId = localStorage.getItem("sqlEditorConnectionId");
  }

  if (!connection.value && currentConnectionId) {
    try {
      await connectionsStore.loadConnections();
    } catch (error) {
      console.error("Error loading connections:", error);
    }
  }

  if (!connectionsStore.getConnection(currentConnectionId)) {
    await router.push("/");
    return;
  }

  if (connection.value) {
    sqlQuery.value = `SELECT * FROM ${connection.value.database}.users LIMIT 10;`;
  }

  window.addEventListener("resize", handleWindowResize);

  await settingsStore.loadSettings();

  await loadDatabaseStructure();
});

function goBack() {
  router.push(`/database/${connectionId.value || localStorage.getItem("sqlEditorConnectionId")}`);
}

function toggleEditorFullscreen() {
  isEditorFullscreen.value = !isEditorFullscreen.value;

  if (isEditorFullscreen.value) {
    editorHeight.value = window.innerHeight - 100;
  } else {
    editorHeight.value = window.innerHeight * 0.4;
  }
}

function handleWindowResize() {
  if (isEditorFullscreen.value) {
    editorHeight.value = window.innerHeight - 100;
  }
}

async function runQuery() {
  if (!sqlQuery.value.trim()) {
    showAlert("Please enter a SQL query", "error");
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const startTime = performance.now();
    const currentConnectionId = connectionId.value || localStorage.getItem("sqlEditorConnectionId");

    if (!currentConnectionId) {
      throw new Error("No connection ID found. Please return to the home page and try again.");
    }

    const response = await window.api.executeSQLQuery({
      connectionId: currentConnectionId,
      query: sqlQuery.value
    });

    const endTime = performance.now();
    queryTime.value = Math.round(endTime - startTime);

    if (!response.success) {
      errorMessage.value = response.error;
      results.value = [];
      columns.value = [];
      rowCount.value = 0;
    } else {
      results.value = response.results || [];
      columns.value = response.results && response.results.length > 0 ? Object.keys(response.results[0]) : [];
      rowCount.value = response.results ? response.results.length : 0;
    }
  } catch (error) {
    console.error("Error executing query:", error);
    errorMessage.value = error.message || "An error occurred while executing the query";
  } finally {
    isLoading.value = false;
  }
}

function clearQuery() {
  sqlQuery.value = "";
  results.value = [];
  columns.value = [];
  rowCount.value = 0;
  queryTime.value = 0;
  errorMessage.value = "";
}

function handleTab(e) {
  const start = e.target.selectionStart;
  const end = e.target.selectionEnd;

  sqlQuery.value = sqlQuery.value.substring(0, start) + "  " + sqlQuery.value.substring(end);

  nextTick(() => {
    e.target.selectionStart = e.target.selectionEnd = start + 2;
  });
}

function startResize(e) {
  isResizing.value = true;
  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);
}

function onResize(e) {
  if (isResizing.value) {
    const minHeight = 100;
    const maxHeight = window.innerHeight - 200;

    editorHeight.value = Math.max(minHeight, Math.min(maxHeight, e.clientY - 60));
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
}

function applySQLFromAI(sql) {
  sqlQuery.value = sql;
  showAIModal.value = false;
}

async function loadDatabaseStructure() {
  try {
    databaseStructure.value = JSON.stringify({ loading: true });

    const currentConnectionId = connectionId.value || localStorage.getItem("sqlEditorConnectionId");

    if (!currentConnectionId) {
      throw new Error("No connection ID found for loading database structure");
    }

    databaseStructure.value = await databaseStore.getAllTablesModelsJson(currentConnectionId);
  } catch (error) {
    console.error("Error loading database structure:", error);
    databaseStructure.value = '{"tables": []}';
  }
}
</script>

<style scoped>
table {
  border-spacing: 0;
}

th,
td {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.5);
  border-radius: 4px;
  transition: background 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(200, 200, 200, 0.7);
}
</style>
