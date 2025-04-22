<template>
  <div
    class="modal"
    :class="{ 'modal-open': isOpen }"
  >
    <div class="modal-box max-w-4xl bg-base-300">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Live Database Updates</h3>
        <div class="flex gap-2">
          <div
            v-if="connected"
            class="badge badge-success"
          >
            <span class="mr-1">●</span> Connected
          </div>
          <div
            v-else
            class="badge badge-error"
          >
            <span class="mr-1">●</span> Disconnected
          </div>

          <button
            class="btn btn-sm btn-ghost"
            @click="clearUpdates"
          >
            Clear
          </button>
        </div>
      </div>

      <div class="flex mb-4 gap-2">
        <select
          v-model="operationTypeFilter"
          class="select select-sm select-bordered"
        >
          <option value="all">All Operations</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="SELECT">Select</option>
        </select>
        <input
          v-model="tableFilter"
          type="text"
          placeholder="Filter by table name..."
          class="input input-sm input-bordered flex-1"
        />
      </div>

      <!-- Loading indicator -->
      <div
        v-if="loading"
        class="flex justify-center items-center py-8"
      >
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        <span class="ml-3 text-sm">Initializing monitoring...</span>
      </div>

      <!-- No data message -->
      <div
        v-else-if="!loading && filteredUpdates.length === 0"
        class="alert alert-info mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current shrink-0 w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>No database operations detected yet. Any changes to the database will appear here automatically.</span>
      </div>

      <!-- Data table -->
      <div
        v-else
        class="overflow-x-auto max-h-[60vh]"
      >
        <table class="table table-xs w-full">
          <thead>
            <tr>
              <th class="w-28">Timestamp</th>
              <th class="w-20">Operation</th>
              <th>Table</th>
              <th class="w-20">Record ID</th>
              <th>Details</th>
              <th class="w-16 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(update, index) in filteredUpdates"
              :key="index"
              class="hover:bg-base-200"
            >
              <td class="text-xs">
                {{ formatTimestamp(update.timestamp) }}
              </td>
              <td>
                <span
                  class="badge"
                  :class="getOperationBadgeClass(update.operation || update.type)"
                >
                  {{ update.operation || update.type }}
                </span>
              </td>
              <td>{{ update.table }}</td>
              <td>{{ update.recordId || "-" }}</td>
              <td class="text-xs truncate max-w-[20rem]">
                {{ update.details || update.message || (update.sql ? "SQL Query" : "-") }}
              </td>
              <td class="text-right flex">
                <button
                  class="btn btn-xs btn-ghost"
                  @click="viewDetails(update)"
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
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                </button>
                <button
                  v-if="update.table && update.table !== 'system'"
                  class="btn btn-xs"
                  @click="goToTable(update.table)"
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
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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

  <div
    class="modal"
    :class="{ 'modal-open': showSqlDetails }"
  >
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">
        <span
          class="badge mr-2"
          :class="getOperationBadgeClass(selectedUpdate?.operation || selectedUpdate?.type)"
        >
          {{ selectedUpdate?.operation || selectedUpdate?.type }}
        </span>
        {{ selectedUpdate?.table }}
      </h3>

      <div
        v-if="selectedUpdate"
        class="py-4"
      >
        <div class="mb-4 text-xs flex justify-between">
          <span class="badge badge-neutral">ID: {{ selectedUpdate.recordId || "N/A" }}</span>
          <span>{{ formatTimestamp(selectedUpdate.timestamp, true) }}</span>
        </div>

        <div
          v-if="selectedUpdate.sql"
          class="mt-4"
        >
          <h4 class="font-semibold text-sm mb-1">SQL Query:</h4>
          <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap font-mono text-sm">
            {{ formatSql(selectedUpdate.sql) }}
          </div>
        </div>

        <div
          v-if="selectedUpdate.details"
          class="mt-4"
        >
          <h4 class="font-semibold text-sm mb-1">Details:</h4>
          <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-60 font-mono text-sm whitespace-pre-wrap">
            {{ selectedUpdate.details }}
          </div>
        </div>

        <!-- System Message -->
        <div
          v-if="selectedUpdate.message"
          class="mt-4"
        >
          <h4 class="font-semibold text-sm mb-1">Message:</h4>
          <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-60 text-sm">
            {{ selectedUpdate.message }}
          </div>
        </div>

        <!-- Additional info: Affected Rows, etc. -->
        <div
          v-if="selectedUpdate.affectedRows"
          class="mt-4"
        >
          <h4 class="font-semibold text-sm mb-1">Affected Rows:</h4>
          <div class="bg-base-200 p-2 rounded-lg text-sm">
            {{ selectedUpdate.affectedRows }}
          </div>
        </div>

        <!-- Raw Update Data -->
        <div class="mt-4">
          <h4 class="font-semibold text-sm mb-1">Raw Data:</h4>
          <div class="bg-base-200 p-3 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap font-mono text-xs">
            {{ JSON.stringify(selectedUpdate, null, 2) }}
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button
          class="btn btn-primary"
          @click="showSqlDetails = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  connectionId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["close", "goto-table"]);

const updates = ref([]);
const connected = ref(false);
const loading = ref(false);
const operationTypeFilter = ref("all");
const tableFilter = ref("");
const showSqlDetails = ref(false);
const selectedUpdate = ref(null);

let monitoringChannel = null;
let initTimeout = null;

const filteredUpdates = computed(() => {
  let filtered = updates.value.filter((update) => {
    if (update.table === "system" && (update.operation === "INFO" || update.type === "INFO")) {
      return true;
    }

    if ((update.table === "information_schema" || update.table === "performance_schema" || update.table === "mysql") && update.table !== "system") {
      return false;
    }

    return true;
  });

  if (operationTypeFilter.value !== "all") {
    filtered = filtered.filter((update) => {
      const op = update.operation || update.type;
      return op === operationTypeFilter.value;
    });
  }

  if (tableFilter.value) {
    const query = tableFilter.value.toLowerCase();
    filtered = filtered.filter((update) => update.table.toLowerCase().includes(query));
  }

  return filtered.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
});

function formatTimestamp(timestamp, detailed = false) {
  if (!timestamp) return "N/A";

  const date = new Date(timestamp);
  if (detailed) {
    return date.toLocaleString();
  }
  return date.toLocaleTimeString();
}

function getOperationBadgeClass(operation) {
  switch (operation) {
    case "INSERT":
      return "badge-success";
    case "UPDATE":
      return "badge-warning";
    case "DELETE":
      return "badge-error";
    case "SELECT":
      return "badge-info";
    case "INFO":
      return "badge-info";
    default:
      return "badge-secondary";
  }
}

function viewDetails(update) {
  selectedUpdate.value = update;
  showSqlDetails.value = true;
}

function goToTable(tableName) {
  emit("goto-table", tableName);
  close();
}

function clearUpdates() {
  updates.value = [];
  if (connected.value && monitoringChannel) {
    stopMonitoring();

    setTimeout(() => {
      startMonitoring(true);
    }, 300);
  }
}

function startMonitoring(clearHistory = false) {
  if (connected.value) {
    return;
  }

  if (!window.api || !window.api.monitorDatabaseOperations) {
    console.error("API for monitoring not available");
    return;
  }

  loading.value = true;

  updates.value = [];

  window.api
    .monitorDatabaseOperations(
      props.connectionId,
      (data) => {
        if (data && data.table) {
          updates.value.unshift(data);

          if (loading.value) {
            loading.value = false;
            clearTimeout(initTimeout);
          }

          if (updates.value.length > 1000) {
            updates.value = updates.value.slice(0, 500);
          }
        }
      },
      clearHistory
    )
    .then((channel) => {
      monitoringChannel = channel;
      connected.value = true;

      initTimeout = setTimeout(() => {
        loading.value = false;
      }, 5000);
    })
    .catch((error) => {
      console.error("Error starting monitoring:", error);
      loading.value = false;
    });
}

function stopMonitoring() {
  if (!connected.value || !monitoringChannel) {
    return;
  }

  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }

  if (!window.api || !window.api.stopMonitoringDatabaseOperations) {
    console.error("API for stopping monitoring not available");
    connected.value = false;
    monitoringChannel = null;
    loading.value = false;
    return;
  }

  window.api
    .stopMonitoringDatabaseOperations(monitoringChannel)
    .then(() => {
      connected.value = false;
      monitoringChannel = null;
    })
    .catch((error) => {
      console.error("Error stopping monitoring:", error);
      connected.value = false;
      monitoringChannel = null;
    })
    .finally(() => {
      loading.value = false;
    });
}

function close() {
  emit("close");
}

watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      startMonitoring();
    } else {
      if (connected.value) {
        stopMonitoring();
      }
    }
  }
);

onUnmounted(() => {
  if (connected.value) {
    stopMonitoring();
  }

  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }
});

function formatSql(sql) {
  if (!sql) return "";

  // Simple formatting to make SQL more readable
  return sql
    .replace(/SELECT/gi, "SELECT\n  ")
    .replace(/FROM/gi, "\nFROM\n  ")
    .replace(/WHERE/gi, "\nWHERE\n  ")
    .replace(/ORDER BY/gi, "\nORDER BY\n  ")
    .replace(/GROUP BY/gi, "\nGROUP BY\n  ")
    .replace(/LIMIT/gi, "\nLIMIT ");
}
</script>

<style scoped>
.modal-box {
  width: 90%;
  max-width: 900px;
}
</style>
