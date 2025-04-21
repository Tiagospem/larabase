<template>
  <div
    class="w-64 bg-neutral-800 border-r border-neutral flex flex-col"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="p-3 border-b border-neutral">
      <div class="relative mb-2">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search tables..."
          class="input input-sm input-bordered w-full bg-base-300 pl-9"
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
      </div>

      <div class="flex justify-between items-center">
        <span class="text-xs text-gray-400">{{ filteredTables.length }} tables</span>
        <div class="flex items-center gap-1">
          <button
            v-tooltip.right="'Sort by name'"
            class="btn btn-xs btn-ghost tooltip tooltip-left"
            :class="{
              'text-primary bg-neutral': sortBy === 'name'
            }"
            @click="setSortBy('name')"
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
              'text-primary bg-neutral': sortBy === 'records'
            }"
            @click="setSortBy('records')"
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
            @click="toggleSortOrder"
          >
            <svg
              v-if="sortOrder === 'asc'"
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
      </div>
    </div>

    <div class="overflow-y-auto flex-1">
      <div
        v-if="isLoading || isLoadingCounts || !allTablesLoaded"
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
        class="menu menu-sm"
      >
        <li
          v-for="table in sortedTables"
          :key="table.name"
          class="hover:bg-base-300"
        >
          <a
            :class="{ 'bg-base-300': isTableActive(table.name) }"
            @click="openTable(table)"
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
              :class="{ 'badge-primary': table.recordCount > 0 }"
            >
              {{ formatRecordCount(table.recordCount) }}
            </span>
          </a>
        </li>
      </ul>
    </div>
  </div>

  <div
    class="resize-handle cursor-col-resize"
    @mousedown="startResize"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch, onUnmounted } from "vue";
import { useDatabaseStore } from "@/store/database";

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

const emit = defineEmits(["resize-start", "table-open", "update:sidebarWidth"]);

const databaseStore = useDatabaseStore();

/**
 * @type {import('vue').Ref<string>}
 */
const searchTerm = ref("");

const sortBy = ref(localStorage.getItem("tableSort") || "name");
const sortOrder = ref(localStorage.getItem("tableSortOrder") || "asc");
const isLoadingCounts = ref(false);
const allTablesLoaded = ref(false);

/**
 * @type {import('vue').Ref<number|null>}
 */
const loadingTimer = ref(null);

const isLoading = computed(() => databaseStore.isLoading);
const tables = computed(() => databaseStore.tablesList);

const filteredTables = computed(() => {
  if (!searchTerm.value) return tables.value;
  const term = searchTerm.value.toLowerCase();
  return tables.value.filter((table) => table.name.toLowerCase().includes(term));
});

const sortedTables = computed(() => {
  const tablesCopy = [...filteredTables.value];

  return tablesCopy.sort((a, b) => {
    if (sortBy.value === "name") {
      return sortOrder.value === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else {
      const aCount = a.recordCount || 0;
      const bCount = b.recordCount || 0;
      return sortOrder.value === "asc" ? aCount - bCount : bCount - aCount;
    }
  });
});

function isTableActive(tableName) {
  return props.activeTabName === tableName;
}

function openTable(table) {
  emit("table-open", table);
}

function startResize(e) {
  emit("resize-start", e);
}

function setSortBy(value) {
  if (sortBy.value === value) {
    toggleSortOrder();
  } else {
    sortBy.value = value;
    localStorage.setItem("tableSort", value);
  }
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  localStorage.setItem("tableSortOrder", sortOrder.value);
}

function loadTableRecordCounts() {
  if (isLoadingCounts.value) return;

  isLoadingCounts.value = true;
  allTablesLoaded.value = false;

  if (loadingTimer.value) {
    clearTimeout(loadingTimer.value);
  }

  try {
    const promises = tables.value.map(async (table) => {
      try {
        table.recordCount = await databaseStore.getTableRecordCount(props.connectionId, table.name);
      } catch (error) {
        console.error(`Failed to get record count for ${table.name}:`, error);
        table.recordCount = 0;
      }
    });

    Promise.all(promises).then(() => {
      loadingTimer.value = setTimeout(() => {
        allTablesLoaded.value = true;
        isLoadingCounts.value = false;
      }, 300);
    });
  } catch (error) {
    console.error("Error loading record counts:", error);
    isLoadingCounts.value = false;
    allTablesLoaded.value = true;
  }
}

function formatRecordCount(count) {
  if (count === null || count === undefined) return "0";

  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return count.toString();
}

function getTableModel(tableName) {
  return databaseStore.getModelForTable(props.connectionId, tableName);
}

watch(
  () => props.connectionId,
  () => {
    if (props.connectionId) {
      allTablesLoaded.value = false;

      loadingTimer.value = setTimeout(() => {
        loadTableRecordCounts();
      }, 500);
    }
  },
  { immediate: true }
);

watch(
  () => tables.value.length,
  (newLength) => {
    if (newLength > 0) {
      allTablesLoaded.value = false;

      loadingTimer.value = setTimeout(() => {
        loadTableRecordCounts();
      }, 300);
    }
  }
);

onMounted(() => {
  loadingTimer.value = setTimeout(() => {
    loadTableRecordCounts();
  }, 500);
});

onUnmounted(() => {
  if (loadingTimer.value) {
    clearTimeout(loadingTimer.value);
  }
});
</script>

<style scoped>
.resize-handle {
  width: 5px;
  background-color: #2d2d30;
  cursor: col-resize;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: #4e4e50;
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
</style>
