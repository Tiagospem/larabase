<template>
  <Modal
    :show="isRestoreModalOpen"
    :title="`Restore Database: ${restoreConfig.connection?.name}`"
    :hideCloseButton="blockCloseModal"
    :allowCloseOnBackdrop="!blockCloseModal"
    :allowCloseOnEsc="!blockCloseModal"
    @close="closeRestoreModal"
  >
    <div>
      <fieldset class="fieldset w-full mb-4">
        <label class="label">
          <span class="label-text">SQL Dump File (.sql or .sql.gz)</span>
        </label>
        <div class="flex gap-2">
          <input
            v-model="restoreConfig.filePath"
            type="text"
            placeholder="Select SQL dump file"
            class="input input-bordered w-full"
            :readonly="true"
          />
          <button
            class="btn btn-primary"
            :disabled="isProcessingSql || isRestoring"
            @click="selectDumpFile"
          >
            <span
              v-if="isProcessingSql"
              class="loading loading-spinner loading-xs mr-2"
            />
            Browse
          </button>
        </div>
        <label
          v-if="restoreFileError"
          class="label"
        >
          <span class="label-text-alt text-error">{{ restoreFileError }}</span>
        </label>
        <p class="text-xs text-base-content mt-1">Select a .sql or .sql.gz file to restore</p>
      </fieldset>

      <div
        v-if="isProcessingSql"
        class="my-4 flex items-center gap-2 text-base-content bg-base-300 p-3 rounded-md"
      >
        <span class="loading loading-spinner loading-sm" />
        <div>
          <p class="text-sm font-medium">
            {{ restoreStatus }}
          </p>
          <p class="text-xs mt-1">Please wait until the SQL file analysis is complete</p>
        </div>
      </div>

      <div
        v-else-if="restoreStatus && !isRestoring"
        class="my-4 text-sm text-base-content"
      >
        <p>{{ restoreStatus }}</p>
      </div>

      <div
        v-if="isRestoring"
        class="mb-4"
      >
        <div class="w-full bg-base-100 rounded-md h-2 mb-2">
          <div
            class="bg-neutral h-2 rounded-md"
            :style="{ width: restoreProgress + '%' }"
          />
        </div>
        <p class="text-xs animate-pulse">{{ restoreStatus }} {{ Math.floor(restoreProgress) }}%</p>
      </div>

      <fieldset class="fieldset w-full mb-4">
        <label class="label cursor-pointer justify-start">
          <input
            v-model="overwriteCurrentDb"
            type="checkbox"
            class="checkbox checkbox-sm mr-2"
            :disabled="isRestoring || isProcessingSql"
          />
          <span class="label-text">Restore to current database ({{ restoreConfig.connection?.database }})</span>
        </label>
        <p class="text-xs text-base-content mt-1">The backup will overwrite your current database</p>
      </fieldset>

      <fieldset
        v-if="!overwriteCurrentDb"
        class="fieldset w-full mb-4"
      >
        <label class="label">
          <span class="label-text">Target Database Name</span>
        </label>
        <input
          v-model="restoreConfig.database"
          type="text"
          placeholder="Enter target database name"
          class="input input-bordered w-full"
          :disabled="isRestoring || isProcessingSql"
        />
        <label class="label">
          <span class="label-text-alt">The backup will be restored to this new database</span>
        </label>
      </fieldset>

      <fieldset
        v-if="!overwriteCurrentDb"
        class="fieldset w-full mb-4"
      >
        <label class="label cursor-pointer justify-start">
          <input
            v-model="restoreConfig.setAsDefault"
            type="checkbox"
            class="checkbox checkbox-sm mr-2"
            :disabled="isRestoring || isProcessingSql"
          />
          <span class="label-text">Set as default database for this connection</span>
        </label>
        <label class="label">
          <span class="label-text-alt">If enabled, this database will be set as the default for future connections</span>
        </label>
      </fieldset>

      <fieldset
        v-if="restoreConfig.tables.length > 0"
        class="fieldset w-full mb-4"
      >
        <label class="label">
          <span class="label-text">Tables to Ignore Records (Optional)</span>
        </label>

        <div class="mb-2">
          <input
            v-model="tableSearchQuery"
            type="text"
            placeholder="Search tables..."
            class="input input-bordered w-full input-sm"
            :disabled="isRestoring || isProcessingSql"
          />
        </div>

        <div
          class="h-48 overflow-auto bg-base-200 rounded-md p-2"
          :class="{ 'opacity-50': isRestoring || isProcessingSql }"
        >
          <div
            v-for="table in filteredTables"
            :key="table.name"
            class="fieldset"
          >
            <label
              class="label cursor-pointer justify-start gap-2"
              :class="{
                'opacity-50': isRestoring || isProcessingSql
              }"
            >
              <input
                v-model="restoreConfig.ignoredTables"
                type="checkbox"
                :value="table.name"
                class="checkbox checkbox-sm"
                :disabled="isRestoring || isProcessingSql"
              />
              <div class="flex items-center justify-between w-full">
                <span class="label-text">{{ table.name }}</span>
                <span
                  v-if="table.size"
                  class="text-xs px-2 py-0.5 rounded-sm"
                  :class="getTableSizeClass(table.size)"
                >
                  {{ table.formattedRows }}
                </span>
              </div>
            </label>
          </div>
          <div
            v-if="filteredTables.length === 0"
            class="text-sm text-base-content"
          >
            No tables match your search
          </div>
        </div>
        <label class="label">
          <span class="label-text-alt text-base-content">Select tables to ignore during restore</span>
        </label>
      </fieldset>
    </div>

    <template #footer>
      <button
        class="btn"
        @click="closeRestoreModal"
      >
        {{ isRestoring ? "Cancel" : "Close" }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="isRestoring || isProcessingSql || !restoreConfig.filePath"
        @click="startRestore"
      >
        <span
          v-if="isRestoring"
          class="loading loading-spinner loading-xs mr-2"
        />
        <span
          v-else-if="isProcessingSql"
          class="loading loading-spinner loading-xs mr-2"
        />
        {{ isRestoring ? "Restoring..." : "Restore Database" }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, inject, ref } from "vue";
import { useConnectionsStore } from "@/store/connections";
import Modal from "@/components/Modal.vue";

const connectionsStore = useConnectionsStore();

const showAlert = inject("showAlert");

const overwriteCurrentDb = ref(true);
const isRestoring = ref(false);
const isProcessingSql = ref(false);
const isRestoreModalOpen = ref(false);

const blockCloseModal = computed(() => {
  return isRestoring.value || isProcessingSql.value;
});

const restoreConfig = ref({
  connection: null,
  filePath: "",
  tables: [],
  ignoredTables: [],
  database: "",
  setAsDefault: false
});

const tableSearchQuery = ref("");
const restoreStatus = ref("");
const restoreFileError = ref("");
const restoreProgress = ref(0);

async function selectDumpFile() {
  try {
    const result = await window.api.selectSqlDumpFile();

    if (result.canceled) {
      return;
    }

    const selectedPath = result.filePaths[0];

    if (!selectedPath.toLowerCase().endsWith(".sql") && !selectedPath.toLowerCase().endsWith(".gz") && !selectedPath.toLowerCase().endsWith(".sql.gz")) {
      restoreFileError.value = "Invalid file type. Please select a .sql or .sql.gz file";
      return;
    }

    restoreConfig.value.filePath = selectedPath;
    restoreFileError.value = "";

    isProcessingSql.value = true;
    restoreStatus.value = "Analyzing SQL file...";

    try {
      const fileStats = await window.api.getFileStats(selectedPath);

      if (fileStats && fileStats.size) {
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
        if (fileSizeMB > 100) {
          restoreStatus.value = `Analyzing large SQL file (${fileSizeMB} MB). This may take a few minutes...`;
        } else {
          restoreStatus.value = `Analyzing SQL file (${fileSizeMB} MB)...`;
        }
      }

      const tableResult = await window.api.extractTablesFromSql(selectedPath);

      if (tableResult.success && tableResult.tables && tableResult.tables.length > 0) {
        restoreConfig.value.tables = tableResult.tables;
        restoreStatus.value = `${tableResult.tables.length} tables found in SQL file`;
      } else {
        restoreConfig.value.tables = [];
        restoreStatus.value = tableResult.message || "No tables found in SQL file";
      }
    } catch (extractError) {
      console.error("Error extracting tables:", extractError);
      restoreStatus.value = "Error extracting tables from file";
      restoreConfig.value.tables = [];
    } finally {
      isProcessingSql.value = false;
    }
  } catch (error) {
    isProcessingSql.value = false;
    console.error(error);
    showAlert("Error selecting SQL dump file", "error");
  }
}

const filteredTables = computed(() => {
  let tables = restoreConfig.value.tables;

  tables = [...tables].sort((a, b) => {
    const sizeOrder = { large: 0, medium: 1, small: 2, empty: 3 };
    const sizeA = a.size ? sizeOrder[a.size] : 4;
    const sizeB = b.size ? sizeOrder[b.size] : 4;
    return sizeA - sizeB;
  });

  if (!tableSearchQuery.value) {
    return tables;
  }

  const query = tableSearchQuery.value.toLowerCase();
  return tables.filter((table) => {
    if (typeof table === "string") {
      return table.toLowerCase().includes(query);
    } else if (table.name) {
      return table.name.toLowerCase().includes(query);
    }
    return false;
  });
});

function closeRestoreModal() {
  if (isRestoring.value) {
    if (confirm("Are you sure you want to cancel the database restoration?")) {
      window.api.cancelDatabaseRestore();

      isRestoring.value = false;
      restoreProgress.value = 0;
      restoreStatus.value = "Restoration cancelled";
      showAlert("Database restoration cancelled", "info");

      setTimeout(() => {
        isRestoreModalOpen.value = false;
        tableSearchQuery.value = "";
      }, 1000);
    }
    return;
  }

  isRestoreModalOpen.value = false;
  tableSearchQuery.value = "";
}

function getTableSizeClass(size) {
  switch (size) {
    case "empty":
      return "bg-gray-500 text-white";
    case "small":
      return "bg-green-500 text-white";
    case "medium":
      return "bg-yellow-500 text-white";
    case "large":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-700 text-white";
  }
}

async function updateConnectionDatabase(connectionId, newDatabase) {
  try {
    const result = await window.api.updateConnectionDatabase(connectionId, newDatabase);
    if (result.success) {
      await connectionsStore.loadConnections();
      showAlert(`Connection database updated to ${newDatabase}`, "success");
    }
  } catch (error) {
    console.error("Failed to update connection database:", error);
    showAlert("Database restored, but failed to update connection settings", "warning");
  }
}

async function startRestore() {
  if (!restoreConfig.value.filePath || !restoreConfig.value.connection) {
    showAlert("Please select a SQL dump file", "error");
    return;
  }

  if (!overwriteCurrentDb.value && !restoreConfig.value.database) {
    showAlert("Please enter a target database name", "error");
    return;
  }

  let hasErrors = false;
  let errorMessage = "";

  try {
    isRestoring.value = true;
    restoreStatus.value = "Starting database restoration...";
    restoreProgress.value = 0;

    let targetDatabase;

    if (overwriteCurrentDb.value) {
      targetDatabase = restoreConfig.value.connection.database;
    } else {
      targetDatabase = restoreConfig.value.database;
    }

    const simpleConfig = {
      connectionId: restoreConfig.value.connection.id,
      filePath: restoreConfig.value.filePath,
      ignoredTables: [...restoreConfig.value.ignoredTables],
      database: targetDatabase,
      setAsDefault: !overwriteCurrentDb.value && restoreConfig.value.setAsDefault,
      overwriteCurrentDb: overwriteCurrentDb.value
    };

    const result = await window.api.simpleDatabaseRestore(simpleConfig);

    if (result.success) {
      restoreProgress.value = 100;
      restoreStatus.value = "Database restored successfully!";

      showAlert("Database restored successfully", "success");

      isRestoring.value = false;
      isRestoreModalOpen.value = false;

      if (!overwriteCurrentDb.value && restoreConfig.value.setAsDefault && targetDatabase !== restoreConfig.value.connection.database) {
        await updateConnectionDatabase(restoreConfig.value.connection.id, targetDatabase);
      }
    } else {
      hasErrors = true;
      errorMessage = result.message || "Unknown error during restoration";
    }
  } catch (error) {
    console.error("Error restoring database:", error);

    restoreStatus.value = `Error: ${error.message}`;
    restoreProgress.value = 0;
    isRestoring.value = false;

    showAlert(`Error restoring database: ${error.message}`, "error");
  }

  if (hasErrors) {
    restoreStatus.value = `Error: ${errorMessage}`;
    restoreProgress.value = 0;
    isRestoring.value = false;

    showAlert(`Error restoring database: ${errorMessage}`, "error");
  }
}

function restoreDatabase(connection) {
  restoreConfig.value = {
    connection: connection,
    filePath: "",
    tables: [],
    ignoredTables: [],
    database: "",
    setAsDefault: false
  };

  restoreFileError.value = "";
  isRestoring.value = false;
  restoreProgress.value = 0;
  restoreStatus.value = "";
  isRestoreModalOpen.value = true;
  overwriteCurrentDb.value = true;
}

window.api.onRestorationProgress((progress) => {
  if (isRestoring.value) {
    if (progress.status === "cancelled") {
      isRestoring.value = false;
      restoreStatus.value = "Restoration cancelled";
      restoreProgress.value = 0;

      setTimeout(() => {
        isRestoreModalOpen.value = false;
        tableSearchQuery.value = "";
      }, 1000);

      return;
    }

    restoreProgress.value = progress.progress || 0;
    if (progress.status) {
      restoreStatus.value = progress.status;
    }
  }
});

defineExpose({ restoreDatabase });
</script>
