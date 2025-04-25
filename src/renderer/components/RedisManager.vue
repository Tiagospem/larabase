<template>
  <div
    class="modal z-50"
    :class="{ 'modal-open': isOpen }"
  >
    <div class="modal-box max-w-5xl">
      <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
        Redis Databases Manager
        <button
          class="btn btn-sm btn-circle"
          @click="$emit('close')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </h3>

      <div
        v-if="loading"
        class="py-10 flex flex-col items-center"
      >
        <span class="loading loading-spinner loading-lg mb-4"></span>
        <p>Loading Redis databases...</p>
      </div>

      <div
        v-else-if="error"
        class="alert alert-error mb-4"
      >
        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Database list view -->
      <template v-else-if="!showDataPreview">
        <div v-if="!existingDatabases.length">
          <RedisEmptyState
            :loading="loading"
            @refresh="refreshDatabases"
          />
        </div>

        <div v-else>
          <!-- Connection info box -->
          <div class="mb-4 bg-base-200 p-4 rounded-lg">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm"><strong>Connection:</strong> {{ connectionInfo }}</p>
                <p class="text-sm mt-1"><strong>Running On:</strong> {{ redisRunningMode }}</p>
              </div>
              <button
                class="btn btn-sm btn-ghost"
                @click="refreshDatabases"
                :disabled="loading || clearingDb"
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
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Database list component -->
          <RedisDatabasesList
            :databases="existingDatabases"
            :loading="clearingDb"
            @preview="previewDatabaseData"
            @clear="confirmClearDatabase"
            @flush="confirmClearAllDatabases"
            @refresh="refreshDatabases"
          />
        </div>
      </template>

      <!-- Data Preview Panel (Integrated) -->
      <template v-else>
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center">
            <button
              class="btn btn-sm btn-ghost mr-3"
              @click="closeDataPreview"
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
                  d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                />
              </svg>
              Back
            </button>
            <h3 class="font-bold">
              {{ selectedDatabase ? `Data Preview - ${selectedDatabase.name}` : "Data Preview" }}
              <span class="ml-2 badge badge-sm">{{ dataKeys.length }} keys</span>
            </h3>
          </div>
          <button
            class="btn btn-sm btn-ghost"
            @click="refreshDataKeys"
            :disabled="loadingDataKeys"
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
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh
          </button>
        </div>

        <!-- Search bar -->
        <div class="flex gap-2 mb-4">
          <div class="flex-1 relative">
            <input
              type="text"
              placeholder="Search keys (e.g. user:*, session:*)"
              class="input input-bordered w-full pr-10"
              v-model="keyPattern"
              @keyup.enter="loadDataKeys"
            />
            <button
              v-if="keyPattern"
              class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              @click="clearSearch"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <button
            class="btn btn-ghost"
            @click="loadDataKeys"
            :disabled="loadingDataKeys"
          >
            <svg
              v-if="loadingDataKeys"
              class="animate-spin h-4 w-4 mr-1"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Search
          </button>
        </div>

        <!-- Keys list and value display -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Keys list component -->
          <RedisKeysList
            :keys="dataKeys"
            :loading="loadingDataKeys"
            :selectedKey="selectedKey"
            @select-key="loadKeyValue"
          />

          <!-- Key value component -->
          <RedisKeyValue
            :selectedKey="selectedKey"
            :keyData="keyData"
            :loading="loadingKeyValue"
            :error="keyValueError"
          />
        </div>
      </template>

      <!-- Confirmation Modal for clearing database -->
      <div
        class="modal"
        :class="{ 'modal-open': showConfirmation }"
      >
        <div class="modal-box">
          <h3 class="font-bold text-lg">Confirm Action</h3>
          <p class="py-4">{{ confirmationMessage }}</p>
          <div class="modal-action">
            <button
              class="btn btn-ghost"
              @click="showConfirmation = false"
            >
              Cancel
            </button>
            <button
              class="btn btn-ghost"
              @click="executeConfirmedAction"
              :disabled="clearingDb"
            >
              <span v-if="clearingDb">
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Clearing...
              </span>
              <span v-else>Yes, Clear</span>
            </button>
          </div>
        </div>
        <div
          class="modal-backdrop"
          @click="showConfirmation = false"
        ></div>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="$emit('close')"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from "vue";
import RedisEmptyState from "./redis/RedisEmptyState.vue";
import RedisDatabasesList from "./redis/RedisDatabasesList.vue";
import RedisKeysList from "./redis/RedisKeysList.vue";
import RedisKeyValue from "./redis/RedisKeyValue.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  connectionId: {
    type: String,
    required: true
  },
  connection: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["close"]);
const showAlert = inject("showAlert");

// State
const loading = ref(true);
const error = ref(false);
const errorMessage = ref("");
const redisDatabases = ref([]);
const showConfirmation = ref(false);
const confirmationMessage = ref("");
const databaseToDelete = ref(null);
const clearAll = ref(false);
const clearingDb = ref(false);
const redisRunningMode = ref("Unknown");
const showDataPreview = ref(false);
const selectedDatabase = ref(null);

// Data preview state
const dataKeys = ref([]);
const loadingDataKeys = ref(false);
const loadingKeyValue = ref(false);
const keyPattern = ref("");
const selectedKey = ref(null);
const keyData = ref(null);
const keyValueError = ref(null);

// Computed properties
const connectionInfo = computed(() => {
  const conn = props.connection;
  if (!conn.redis) {
    return "No Redis configuration found";
  }

  return conn.redis.path ? conn.redis.path : `${conn.redis.host}:${conn.redis.port}`;
});

const existingDatabases = computed(() => {
  return redisDatabases.value.filter((db) => db.keys > 0);
});

// Methods
async function loadRedisDatabases() {
  loading.value = true;
  error.value = false;

  try {
    const conn = props.connection;

    if (!conn.redis) {
      error.value = true;
      errorMessage.value = "No Redis configuration found in connection settings";
      loading.value = false;
      return;
    }

    const payload = {
      host: conn.redis.host,
      port: conn.redis.port,
      password: conn.redis.password,
      path: conn.redis.path
    };

    // First check if Redis is running and where (local or Docker)
    const statusCheck = await window.api.checkRedisStatus(payload);

    if (!statusCheck.success) {
      error.value = true;
      errorMessage.value = statusCheck.message || "Failed to connect to Redis";
      loading.value = false;
      return;
    }

    redisRunningMode.value = statusCheck.runningMode || "Local";

    // Load database information
    const result = await window.api.getRedisDatabases(payload);

    if (!result.success) {
      error.value = true;
      errorMessage.value = result.message || "Failed to load Redis databases";
      loading.value = false;
      return;
    }

    // Only include databases that have keys
    redisDatabases.value = result.databases || [];
  } catch (err) {
    error.value = true;
    errorMessage.value = err.message || "An error occurred while loading Redis databases";
    console.error("Redis databases load error:", err);
  } finally {
    loading.value = false;
  }
}

function previewDatabaseData(db) {
  selectedDatabase.value = db;
  showDataPreview.value = true;
  loadDataKeys();
}

function closeDataPreview() {
  showDataPreview.value = false;
  selectedDatabase.value = null;
  dataKeys.value = [];
  keyPattern.value = "";
  selectedKey.value = null;
  keyData.value = null;
}

async function loadDataKeys() {
  if (!selectedDatabase.value) return;

  loadingDataKeys.value = true;
  keyValueError.value = null;
  selectedKey.value = null;
  keyData.value = null;

  try {
    const payload = {
      host: props.connection.redis.host,
      port: props.connection.redis.port,
      password: props.connection.redis.password,
      path: props.connection.redis.path,
      dbIndex: selectedDatabase.value.id,
      pattern: keyPattern.value || "*",
      limit: 100,
      offset: 0
    };

    const result = await window.api.getRedisKeys(payload);

    if (!result.success) {
      showAlert(`Failed to load Redis keys: ${result.message}`, "error");
      return;
    }

    dataKeys.value = result.keys;
  } catch (err) {
    showAlert(`Error loading Redis keys: ${err.message}`, "error");
    console.error("Redis keys load error:", err);
  } finally {
    loadingDataKeys.value = false;
  }
}

function refreshDataKeys() {
  loadDataKeys();
}

function clearSearch() {
  keyPattern.value = "";
  selectedKey.value = null;
  keyData.value = null;
  loadDataKeys();
}

async function loadKeyValue(key) {
  if (!key) return;

  selectedKey.value = key;
  loadingKeyValue.value = true;
  keyValueError.value = null;
  keyData.value = null;

  try {
    const payload = {
      host: props.connection.redis.host,
      port: props.connection.redis.port,
      password: props.connection.redis.password,
      path: props.connection.redis.path,
      dbIndex: selectedDatabase.value.id,
      key: key
    };

    const result = await window.api.getRedisKeyValue(payload);

    if (!result.success) {
      keyValueError.value = result.message || "Failed to load key value";
      return;
    }

    keyData.value = result;
  } catch (err) {
    keyValueError.value = err.message || "An error occurred while loading key value";
    console.error("Redis key value load error:", err);
  } finally {
    loadingKeyValue.value = false;
  }
}

function confirmClearDatabase(db) {
  databaseToDelete.value = db;
  clearAll.value = false;
  confirmationMessage.value = `Are you sure you want to clear database "${db.name}" (${db.id})? This will remove all ${db.keys} keys.`;
  showConfirmation.value = true;
}

function confirmClearAllDatabases() {
  databaseToDelete.value = null;
  clearAll.value = true;

  const totalKeys = redisDatabases.value.reduce((sum, db) => sum + db.keys, 0);
  confirmationMessage.value = `Are you sure you want to clear ALL Redis databases? This will remove a total of ${totalKeys} keys across all databases.`;

  showConfirmation.value = true;
}

async function executeConfirmedAction() {
  clearingDb.value = true;

  try {
    const conn = props.connection;

    if (!conn.redis) {
      showAlert("No Redis configuration found in connection settings", "error");
      showConfirmation.value = false;
      clearingDb.value = false;
      return;
    }

    const payload = {
      host: conn.redis.host,
      port: conn.redis.port,
      password: conn.redis.password,
      path: conn.redis.path
    };

    if (clearAll.value) {
      // Clear all databases
      const result = await window.api.clearAllRedisDatabases(payload);

      if (result.success) {
        showAlert("All Redis databases have been cleared successfully", "success");
      } else {
        showAlert(`Failed to clear Redis databases: ${result.message}`, "error");
      }
    } else if (databaseToDelete.value) {
      // Clear specific database
      payload.dbIndex = databaseToDelete.value.id;

      const result = await window.api.clearRedisDatabase(payload);

      if (result.success) {
        showAlert(`Database ${databaseToDelete.value.name} cleared successfully`, "success");
      } else {
        showAlert(`Failed to clear database: ${result.message}`, "error");
      }
    }

    // Refresh the database list to show updated counts
    await loadRedisDatabases();
  } catch (err) {
    showAlert(`Error during Redis operation: ${err.message}`, "error");
    console.error("Redis clear operation error:", err);
  } finally {
    showConfirmation.value = false;
    clearingDb.value = false;
  }
}

async function refreshDatabases() {
  await loadRedisDatabases();
}

// Load data when component mounts
onMounted(async () => {
  if (props.isOpen) {
    await loadRedisDatabases();
  }
});

// Watch for changes to isOpen prop and load data when opened
watch(
  () => props.isOpen,
  async (newValue) => {
    if (newValue) {
      await loadRedisDatabases();
    }
  }
);
</script>
