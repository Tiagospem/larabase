<template>
  <div class="relative h-full flex flex-col">
    <div
      class="sidebar-container bg-base-200 border-r border-black/10 flex flex-col h-full w-full"
      :style="{ width: sidebarWidth + 'px' }"
    >
      <div class="p-3 border-b border-black/10 shrink-0">
        <div class="relative mb-2">
          <label class="input input-sm">
            <svg
              class="h-[1em] opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <g
                stroke-linejoin="round"
                stroke-linecap="round"
                stroke-width="2.5"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                ></circle>
                <path d="m21 21-4.3-4.3"></path>
              </g>
            </svg>
            <input
              :value="tablesStore.searchTerm"
              @input="(e) => tablesStore.setSearchTerm(props.connectionId, e.target.value)"
              type="search"
              class="input-sm"
              placeholder="Search"
            />
          </label>
        </div>

        <div class="flex justify-between items-center">
          <div class="text-xs truncate">{{ tablesStore.filteredTables.length }} tables</div>
          <div class="flex items-center gap-1">
            <div
              class="tooltip tooltip-right"
              data-tip="Sort by name"
            >
              <button
                class="btn btn-xs btn-ghost"
                :class="{
                  'bg-base-100': tablesStore.sortBy === 'name'
                }"
                @click="tablesStore.setSortBy('name')"
              >
                <svg
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                >
                  <g
                    id="SVGRepo_bgCarrier"
                    stroke-width="0"
                  />
                  <g
                    id="SVGRepo_tracerCarrier"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <g id="SVGRepo_iconCarrier">
                    <path
                      d="M19.707 14.707A1 1 0 0 0 19 13h-7v2h4.586l-4.293 4.293A1 1 0 0 0 13 21h7v-2h-4.586l4.293-4.293zM7 3.99H5v12H2l4 4 4-4H7zM17 3h-2c-.417 0-.79.259-.937.649l-2.75 7.333h2.137L14.193 9h3.613l.743 1.981h2.137l-2.75-7.333A1 1 0 0 0 17 3zm-2.057 4 .75-2h.613l.75 2h-2.113z"
                    />
                  </g>
                </svg>
              </button>
            </div>
            <div
              class="tooltip tooltip-right"
              data-tip="Sort by records"
            >
              <button
                class="btn btn-xs btn-ghost"
                :class="{
                  'bg-base-100': tablesStore.sortBy === 'records'
                }"
                @click="tablesStore.setSortBy('records')"
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
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                </svg>
              </button>
            </div>
            <div
              class="tooltip tooltip-right"
              data-tip="Toggle sort order"
            >
              <button
                class="btn btn-xs btn-ghost"
                @click="tablesStore.toggleSortOrder"
              >
                <svg
                  v-if="tablesStore.sortOrder === 'asc'"
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
                    d="m4.5 15.75 7.5-7.5 7.5 7.5"
                  />
                </svg>
                <svg
                  v-else
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
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
            </div>
            <div
              class="tooltip tooltip-right"
              :data-tip="isDeleteMode ? 'Cancel deletion' : 'Delete tables'"
            >
              <button
                class="btn btn-xs btn-ghost"
                :class="{
                  'bg-base-100': isDeleteMode
                }"
                @click="toggleDeleteMode"
              >
                <svg
                  v-if="!isDeleteMode"
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
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
                <svg
                  v-else
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="isDeleteMode"
          class="flex justify-between items-center mt-2 text-sm"
        >
          <div class="flex items-center">
            <input
              type="checkbox"
              class="checkbox checkbox-xs mr-2"
              :checked="isAllSelected"
              @change="toggleSelectAll"
            />
            <span class="text-xs">Select All</span>
          </div>
          <button
            class="btn btn-xs btn-success"
            :disabled="selectedTables.length === 0"
            @click="confirmDelete"
          >
            Delete ({{ selectedTables.length }})
          </button>
        </div>
      </div>

      <div class="scrollable-container flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div
          v-if="tablesStore.isLoading"
          class="p-2"
        >
          <div
            v-for="i in 10"
            :key="i"
            class="skeleton-item flex items-center gap-2 p-2 mb-1 rounded-sm bg-base-100 animate-pulse"
          >
            <div class="w-4 h-4 bg-base-300 rounded-sm" />
            <div class="h-4 bg-base-300 rounded-sm w-4/5" />
            <div class="w-8 h-4 bg-base-300 rounded-sm" />
          </div>
        </div>

        <ul
          v-else
          class="w-full"
        >
          <li
            v-for="table in tablesStore.sortedTables"
            :key="table.name"
            class="p-0.5"
          >
            <a
              :class="{ 'bg-base-100': isTableActive(table.name) }"
              class="rounded-md hover:bg-base-100 flex items-center gap-2 px-2 py-1 cursor-pointer"
              @click="isDeleteMode ? toggleTableSelection(table.name) : openTable(table)"
            >
              <div
                v-if="isDeleteMode"
                class="flex items-center mr-1"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  :checked="isTableSelected(table.name)"
                  @click.stop="toggleTableSelection(table.name)"
                />
              </div>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                />
              </svg>
              <div class="flex flex-1 flex-col table-name-container">
                <span class="table-name text-sm font-semibold">{{ table.name }}</span>
                <span
                  v-if="getTableModel(table.name)"
                  class="text-xs table-model opacity-60"
                >
                  {{ getTableModel(table.name)?.namespace }}\{{ getTableModel(table.name)?.name }}</span
                >
              </div>
              <span
                class="badge badge-xs"
                :class="{
                  'badge-accent': table.rowCount > 0,
                  'animate-pulse': table.isApproximate
                }"
                :key="`count-${table.name}-${table.isApproximate}-${table.rowCount}`"
              >
                {{ table.isApproximate ? "--" : tablesStore.formatRecordCount(table.rowCount) }}
              </span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div
      class="resize-handle cursor-col-resize absolute right-0 top-0 h-full"
      @mousedown="startResize"
    />

    <Modal
      :show="showDeleteConfirmation"
      title="Delete Tables"
      @close="showDeleteConfirmation = false"
      @action="deleteTables"
      :is-loading-action="isDeleting"
      :show-action-button="true"
      width="w-lg"
    >
      <p>
        <span class="font-bold"> Are you sure you want to delete {{ selectedTables.length }} table(s)? </span>
        <br />
        <span class="text-error text-sm">This action cannot be undone.</span>
      </p>
      <div class="py-2">
        <fieldset class="fieldset">
          <label class="label cursor-pointer justify-start">
            <input
              v-model="ignoreForeignKeys"
              type="checkbox"
              class="checkbox checkbox-sm checkbox-error mr-2"
              @change="handleIgnoreForeignKeysChange"
            />
            <span class="label-text">Ignore foreign key constraints</span>
          </label>
        </fieldset>
        <fieldset class="fieldset">
          <label class="label cursor-pointer justify-start">
            <input
              v-model="cascadeDelete"
              type="checkbox"
              class="checkbox checkbox-sm checkbox-error mr-2"
              @change="handleCascadeDeleteChange"
            />
            <span class="label-text">Cascade delete (drop dependent objects)</span>
          </label>
        </fieldset>
      </div>
      <div class="mt-2 text-sm">
        <div class="font-semibold mb-1">Selected tables:</div>
        <div class="max-h-32 overflow-y-auto bg-base-200 p-2 rounded-sm">
          <ul class="list-disc pl-4 space-y-1">
            <li
              v-for="table in selectedTables"
              :key="table"
            >
              {{ table }}
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch, onMounted } from "vue";
import { useDatabaseStore } from "@/store/database";
import { useTablesStore } from "@/store/tables";
import Modal from "@/components/Modal.vue";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  activeTabName: {
    type: String,
    default: null
  },
  sidebarWidth: {
    type: Number,
    default: 240
  }
});

const emit = defineEmits(["resize-start", "table-open", "update:sidebarWidth", "close-tabs"]);
const showAlert = inject("showAlert");

const databaseStore = useDatabaseStore();
const tablesStore = useTablesStore();
const lastConnectionId = ref(null);

const isDeleteMode = ref(false);
const selectedTables = ref([]);
const showDeleteConfirmation = ref(false);
const ignoreForeignKeys = ref(false);
const cascadeDelete = ref(false);
const isDeleting = ref(false);

watch(
  () => props.connectionId,
  async (newConnectionId) => {
    if (newConnectionId) {
      try {
        const savedSearchTerm = localStorage.getItem(`tableSearch_${newConnectionId}`) || "";
        tablesStore.setSearchTerm(newConnectionId, savedSearchTerm);
        await tablesStore.initializeTables(newConnectionId);

        let connection = null;
        try {
          connection = databaseStore.getConnection(newConnectionId);
          if (connection && connection.projectPath) {
            await databaseStore.loadModelsForTables(newConnectionId, connection.projectPath);
          }
        } catch (connError) {
          console.debug("Connection not available yet for models", connError);
        }

        lastConnectionId.value = newConnectionId;
        updateApproximateTableCounts();
      } catch (error) {
        console.error("Error initializing tables:", error);
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.connectionId) {
    updateApproximateTableCounts();
  }
});

async function updateApproximateTableCounts() {
  if (!props.connectionId || tablesStore.isLoading) return;

  const approximateTables = tablesStore.sortedTables.filter((table) => table.isApproximate);

  if (approximateTables.length === 0) return;

  const tablesToProcess = getTableUpdatePriority(approximateTables);

  const batchSize = 3;
  for (let i = 0; i < tablesToProcess.length; i += batchSize) {
    const batch = tablesToProcess.slice(i, i + batchSize);

    await Promise.all(batch.map((table) => updateTableCount(table)));

    if (i + batchSize < tablesToProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

async function updateTableCount(table) {
  try {
    const conn = databaseStore.getConnection(props.connectionId);
    const countResult = await window.api.getTableRecordCount({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      database: conn.database,
      tableName: table.name
    });

    if (countResult && countResult.success) {
      const exactCount = parseInt(countResult.count, 10);

      table.rowCount = exactCount;
      table.isApproximate = false;

      databaseStore.updateLocalStorageTables(props.connectionId, table.name, exactCount, false);
    } else {
      table.isApproximate = false;
      databaseStore.updateLocalStorageTables(props.connectionId, table.name, table.rowCount, false);
    }

    return true;
  } catch (error) {
    console.error(`Error updating count for table ${table.name}:`, error);

    table.isApproximate = false;
    databaseStore.updateLocalStorageTables(props.connectionId, table.name, table.rowCount, false);

    return false;
  }
}

function getTableUpdatePriority(tables) {
  const maxTablesToProcess = 20;

  if (tables.length <= maxTablesToProcess) {
    return tables;
  }

  return tables.slice(0, maxTablesToProcess);
}

watch(
  () => tablesStore.sortedTables,
  (newTables) => {
    if (newTables.length > 0 && props.connectionId) {
      const approximateTables = newTables.filter((table) => table.isApproximate);

      if (approximateTables.length > 0) {
        const tablesToUpdate = getTableUpdatePriority(approximateTables);

        const skippedTables = approximateTables.filter((t) => !tablesToUpdate.includes(t));

        if (skippedTables.length > 0) {
          skippedTables.forEach((table) => {
            databaseStore.updateLocalStorageTables(props.connectionId, table.name, table.rowCount, false);
            table.isApproximate = false;
          });
        }

        if (tablesToUpdate.length > 0) {
          setTimeout(() => updateApproximateTableCounts(), 500);
        }
      }
    }
  },
  { deep: true }
);

watch(
  () => tablesStore.searchTerm,
  (newSearchTerm) => {
    if (props.connectionId) {
      localStorage.setItem(`tableSearch_${props.connectionId}`, newSearchTerm);
    }
  }
);

function isTableActive(tableName) {
  return props.activeTabName === tableName;
}

function openTable(table) {
  emit("table-open", table);
}

function startResize(e) {
  emit("resize-start", e);
}

function toggleDeleteMode() {
  isDeleteMode.value = !isDeleteMode.value;

  if (!isDeleteMode.value) {
    selectedTables.value = [];
  }
}

function isTableSelected(tableName) {
  return selectedTables.value.includes(tableName);
}

function toggleTableSelection(tableName) {
  if (isTableSelected(tableName)) {
    selectedTables.value = selectedTables.value.filter((t) => t !== tableName);
  } else {
    selectedTables.value.push(tableName);
  }
}

const isAllSelected = computed(() => {
  return selectedTables.value.length === tablesStore.sortedTables.length && tablesStore.sortedTables.length > 0;
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedTables.value = [];
  } else {
    selectedTables.value = tablesStore.sortedTables.map((t) => t.name);
  }
}

function confirmDelete() {
  if (selectedTables.value.length === 0) return;

  showDeleteConfirmation.value = true;
}

async function deleteTables() {
  if (selectedTables.value.length === 0) return;

  isDeleting.value = true;

  const tablesToDelete = JSON.parse(JSON.stringify(selectedTables.value));

  try {
    const params = {
      connectionId: props.connectionId,
      tables: tablesToDelete,
      ignoreForeignKeys: Boolean(ignoreForeignKeys.value),
      cascade: Boolean(cascadeDelete.value)
    };

    const result = await window.api.dropTables(params);

    if (result && result.success) {
      showAlert(`Successfully deleted tables`, "success");

      emit("close-tabs", tablesToDelete);

      await databaseStore.loadTables(props.connectionId);
      selectedTables.value = [];
      isDeleteMode.value = false;
      showDeleteConfirmation.value = false;
    } else {
      const errorMessage = result ? result.message : "Unknown error";
      showAlert(`Error deleting tables: ${errorMessage}`, "error");
    }
  } catch (error) {
    console.error("Tables deletion error:", error);
    showAlert(`Error deleting tables: ${error.message || "Unknown error"}`, "error");
  } finally {
    isDeleting.value = false;
  }
}

function getTableModel(tableName) {
  return databaseStore.getModelForTable(props.connectionId, tableName);
}

function handleIgnoreForeignKeysChange() {
  if (ignoreForeignKeys.value) {
    cascadeDelete.value = false;
  }
}

function handleCascadeDeleteChange() {
  if (cascadeDelete.value) {
    ignoreForeignKeys.value = false;
  }
}
</script>

<style scoped>
.resize-handle {
  width: 5px;
  cursor: col-resize;
  z-index: 10;
  opacity: 0;
}

.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.scrollable-container {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.table-name-container {
  max-width: calc(100% - 5px);
  overflow: hidden;
}

.table-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}

.table-model {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}
</style>
