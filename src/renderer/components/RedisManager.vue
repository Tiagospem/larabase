<template>
  <div
    class="modal z-50"
    :class="{ 'modal-open': isOpen }"
  >
    <div class="modal-box max-w-3xl">
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
            class="stroke-current flex-shrink-0 h-6 w-6"
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

      <div
        v-else-if="!existingDatabases.length"
        class="py-10 text-center"
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
            d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
          />
        </svg>
        <p class="text-gray-500">No Redis databases found</p>
      </div>

      <div v-else>
        <div class="mb-4 bg-base-300 p-3 rounded-md">
          <p class="text-sm"><strong>Connection Info:</strong> {{ connectionInfo }}</p>
          <p class="text-sm mt-1"><strong>Running On:</strong> {{ redisRunningMode }}</p>
        </div>

        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th>Database</th>
                <th>Keys</th>
                <th>Memory Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="db in existingDatabases"
                :key="db.id"
                class="hover"
              >
                <td>
                  <div class="font-medium">{{ db.name }}</div>
                  <div class="text-xs text-gray-500">{{ db.id }}</div>
                </td>
                <td>{{ db.keys }}</td>
                <td>{{ formatMemory(db.memory) }}</td>
                <td>
                  <button
                    class="btn btn-xs btn-error"
                    @click="confirmClearDatabase(db)"
                    :disabled="db.keys === 0 || clearingDb"
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
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                    Clear
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex justify-between">
          <button
            class="btn btn-sm btn-warning"
            @click="confirmClearAllDatabases"
            :disabled="!hasKeys || clearingDb"
          >
            Clear All Databases
          </button>
          <button
            class="btn btn-sm btn-primary"
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
              class="btn btn-error"
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

// Computed properties
const connectionInfo = computed(() => {
  const conn = props.connection;
  if (!conn.redis) {
    return "No Redis configuration found";
  }

  return conn.redis.path ? conn.redis.path : `${conn.redis.host}:${conn.redis.port}`;
});

const hasKeys = computed(() => {
  return existingDatabases.value.length > 0;
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
    redisDatabases.value = result.databases.filter((db) => db.keys > 0) || [];
  } catch (err) {
    error.value = true;
    errorMessage.value = err.message || "An error occurred while loading Redis databases";
    console.error("Redis databases load error:", err);
  } finally {
    loading.value = false;
  }
}

function formatMemory(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
