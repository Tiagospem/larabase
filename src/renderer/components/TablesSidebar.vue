<template>
  <div class="relative h-full flex flex-col">
    <div
      class="sidebar-container bg-neutral-800 border-r border-neutral flex flex-col h-full w-full overflow-hidden"
      :style="{ width: sidebarWidth + 'px' }"
    >
      <div class="p-3 border-b border-black/10 flex-shrink-0">
        <div class="relative mb-2">
          <input
            :value="tablesStore.searchTerm"
            @input="(e) => tablesStore.setSearchTerm(props.connectionId, e.target.value)"
            type="text"
            placeholder="Search tables..."
            class="input input-sm input-bordered w-full bg-base-300 pl-9 pr-8"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <button
            v-if="tablesStore.searchTerm"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
            @click="tablesStore.clearSearch"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-400">{{ tablesStore.filteredTables.length }} tables</span>
          <div class="flex items-center gap-1">
            <button
              v-tooltip.right="'Sort by name'"
              class="btn btn-xs btn-ghost tooltip tooltip-left"
              :class="{
                'text-primary bg-neutral': tablesStore.sortBy === 'name'
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
            <button
              v-tooltip.right="'Sort by records'"
              class="btn btn-xs btn-ghost tooltip tooltip-left"
              :class="{
                'text-primary bg-neutral': tablesStore.sortBy === 'records'
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
            <button
              v-tooltip.right="'Toggle sort order'"
              class="btn btn-xs btn-ghost tooltip tooltip-left"
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
            <button
              v-tooltip.right="isDeleteMode ? 'Cancel deletion' : 'Delete tables'"
              class="btn btn-xs btn-ghost tooltip tooltip-left"
              :class="{
                'text-error bg-neutral': isDeleteMode
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
            class="btn btn-xs btn-error"
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
            class="skeleton-item flex items-center gap-2 p-2 mb-1 rounded bg-base-100 animate-pulse"
          >
            <div class="skeleton-icon w-4 h-4 mr-3 bg-gray-600 rounded" />
            <div class="skeleton-name h-4 bg-gray-600 rounded w-4/5" />
            <div class="skeleton-badge ml-auto w-8 h-4 bg-gray-600 rounded" />
          </div>
        </div>

        <ul
          v-else
          class="menu menu-sm p-2"
        >
          <li
            v-for="table in tablesStore.sortedTables"
            :key="table.name"
            class="table-item"
          >
            <a
              :class="{ 'bg-base-300': isTableActive(table.name) }"
              class="table-link rounded-md"
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
                fill="none"
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
              <div class="flex flex-col table-name-container">
                <span class="table-name">{{ table.name }}</span>
                <span
                  v-if="getTableModel(table.name)"
                  class="text-xs text-gray-500 table-model"
                >
                  {{ getTableModel(table.name)?.namespace }}\{{ getTableModel(table.name)?.name }}</span
                >
              </div>
              <span
                class="badge badge-sm"
                :class="{ 'badge-primary': table.rowCount > 0 }"
              >
                {{ tablesStore.formatRecordCount(table.rowCount) }}
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

    <!-- Delete Tables Confirmation Modal -->
    <div
      v-if="showDeleteConfirmation"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Tables</h3>
        <p class="py-4">
          Are you sure you want to delete {{ selectedTables.length }} table(s)?
          <br />
          <span class="font-bold text-error">This action cannot be undone.</span>
        </p>
        <div class="py-2">
          <div class="form-control">
            <label class="label cursor-pointer justify-start">
              <input
                v-model="ignoreForeignKeys"
                type="checkbox"
                class="checkbox checkbox-sm checkbox-error mr-2"
                @change="handleIgnoreForeignKeysChange"
              />
              <span class="label-text">Ignore foreign key constraints</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start">
              <input
                v-model="cascadeDelete"
                type="checkbox"
                class="checkbox checkbox-sm checkbox-error mr-2"
                @change="handleCascadeDeleteChange"
              />
              <span class="label-text">Cascade delete (drop dependent objects)</span>
            </label>
          </div>
        </div>
        <div class="mt-2 text-sm">
          <div class="font-semibold mb-1">Selected tables:</div>
          <div class="max-h-32 overflow-y-auto bg-base-300 p-2 rounded">
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
        <div class="modal-action">
          <button
            class="btn btn-error"
            :disabled="isDeleting"
            @click="deleteTables"
          >
            <span
              v-if="isDeleting"
              class="loading loading-spinner loading-xs mr-2"
            ></span>
            Delete Tables
          </button>
          <button
            class="btn"
            :disabled="isDeleting"
            @click="showDeleteConfirmation = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onActivated, ref, watch } from "vue";
import { useDatabaseStore } from "@/store/database";
import { useTablesStore } from "@/store/tables";

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

// Table deletion state
const isDeleteMode = ref(false);
const selectedTables = ref([]);
const showDeleteConfirmation = ref(false);
const ignoreForeignKeys = ref(false);
const cascadeDelete = ref(false);
const isDeleting = ref(false);
const lastConnectionId = ref(null);

watch(
  () => props.connectionId,
  (newConnectionId) => {
    if (newConnectionId) {
      const savedSearchTerm = localStorage.getItem(`tableSearch_${newConnectionId}`) || "";
      tablesStore.setSearchTerm(newConnectionId, savedSearchTerm);
      tablesStore.initializeTables(newConnectionId);
      lastConnectionId.value = newConnectionId;
    }
  },
  { immediate: true }
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

  // Convert proxy array to plain JavaScript array using JSON serialization
  const tablesToDelete = JSON.parse(JSON.stringify(selectedTables.value));

  try {
    // Create a clean params object with primitive types
    const params = {
      connectionId: props.connectionId,
      tables: tablesToDelete,
      ignoreForeignKeys: Boolean(ignoreForeignKeys.value),
      cascade: Boolean(cascadeDelete.value)
    };

    console.log("Calling API with params:", JSON.stringify(params));

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
  transition: background-color 0.2s;
  z-index: 10;
  opacity: 0;
}

.resize-handle:hover {
  background-color: #4e4e50;
  opacity: 0.5;
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

/* Custom scrollbar styling */
.scrollable-container::-webkit-scrollbar {
  width: 8px;
}

.scrollable-container::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-radius: 4px;
}

.scrollable-container::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

.scrollable-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.table-name-container {
  max-width: calc(100% - 5px);
  overflow: hidden;
  flex-grow: 1;
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

.table-item {
  margin: 2px 0;
}

.table-link {
  border-radius: 6px !important;
}

.table-link:hover {
  background-color: hsl(var(--b3)) !important;
  border-radius: 6px !important;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-item {
  height: 40px;
  transition: all 0.3s ease;
}

.skeleton-icon {
  opacity: 0.7;
}

.skeleton-name {
  opacity: 0.7;
}

.skeleton-badge {
  opacity: 0.7;
}

.tooltip:before {
  max-width: 200px;
  white-space: normal;
  z-index: 100;
}
</style>
