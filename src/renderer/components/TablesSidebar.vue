<template>
  <div class="w-64 bg-sidebar border-r border-gray-800 flex flex-col" :style="{ width: sidebarWidth + 'px' }">
    <div class="p-3 border-b border-gray-800">
      <div class="relative mb-2">
        <input type="text" placeholder="Search tables..." 
          class="input input-sm input-bordered w-full bg-base-300 pl-9" 
          v-model="searchTerm" />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-5 h-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
          <path stroke-linecap="round" stroke-linejoin="round" 
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-xs text-gray-400">{{ filteredTables.length }} tables</span>
        <div class="flex items-center gap-1">
          <button 
            class="btn btn-xs btn-ghost tooltip tooltip-left" 
            data-tip="Sort by name"
            :class="{ 'text-primary': sortBy === 'name' }"
            @click="setSortBy('name')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
            </svg>
          </button>
          <button 
            class="btn btn-xs btn-ghost tooltip tooltip-left" 
            data-tip="Sort by records"
            :class="{ 'text-primary': sortBy === 'records' }"
            @click="setSortBy('records')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </button>
          <button 
            class="btn btn-xs btn-ghost tooltip tooltip-left" 
            data-tip="Toggle sort order"
            @click="toggleSortOrder">
            <svg v-if="sortOrder === 'asc'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-y-auto flex-1">
      <!-- Skeleton loading state -->
      <div v-if="isLoading || isLoadingCounts" class="p-2">
        <div v-for="i in 10" :key="i" class="flex items-center gap-2 p-1 mb-1 rounded bg-base-100 animate-pulse">
          <div class="w-4 h-4 mr-3 bg-gray-600 rounded"></div>
          <div class="h-3 bg-gray-600 rounded w-4/5"></div>
          <div class="ml-auto w-8 h-4 bg-gray-600 rounded"></div>
        </div>
      </div>
      
      <!-- Actual data -->
      <ul v-else class="menu menu-sm">
        <li v-for="table in sortedTables" :key="table.name" class="hover:bg-base-300">
          <a @click="openTable(table)" :class="{ 'bg-base-300': isTableActive(table.name) }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
            </svg>
            <div class="flex flex-col table-name-container">
              <span class="table-name">{{ table.name }}</span>
              <span v-if="getTableModel(table.name)" class="text-xs text-gray-500 table-model">
                {{ getTableModel(table.name)?.namespace }}\{{ getTableModel(table.name)?.name }}</span>
            </div>
            <span class="badge badge-sm" :class="{ 'badge-primary': table.recordCount > 0 }">
              {{ formatRecordCount(table.recordCount) }}
            </span>
          </a>
        </li>
      </ul>
    </div>
  </div>

  <div class="resize-handle cursor-col-resize" @mousedown="startResize" />
</template>

<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useDatabaseStore} from '@/store/database';

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

const emit = defineEmits(['resize-start', 'table-open', 'update:sidebarWidth']);

const databaseStore = useDatabaseStore();
const searchTerm = ref('');
const sortBy = ref(localStorage.getItem('tableSort') || 'name');
const sortOrder = ref(localStorage.getItem('tableSortOrder') || 'asc');
const isLoadingCounts = ref(false);

const isLoading = computed(() => databaseStore.isLoading);
const tables = computed(() => databaseStore.tablesList);

const filteredTables = computed(() => {
  if (!searchTerm.value) return tables.value;
  const term = searchTerm.value.toLowerCase();
  return tables.value.filter(table => table.name.toLowerCase().includes(term));
});

const sortedTables = computed(() => {
  const tablesCopy = [...filteredTables.value];
  
  return tablesCopy.sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } else {
      const aCount = a.recordCount || 0;
      const bCount = b.recordCount || 0;
      return sortOrder.value === 'asc' 
        ? aCount - bCount 
        : bCount - aCount;
    }
  });
});

function isTableActive(tableName) {
  return props.activeTabName === tableName;
}

function openTable(table) {
  emit('table-open', table);
}

function startResize(e) {
  emit('resize-start', e);
}

function setSortBy(value) {
  if (sortBy.value === value) {
    toggleSortOrder();
  } else {
    sortBy.value = value;
    localStorage.setItem('tableSort', value);
  }
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  localStorage.setItem('tableSortOrder', sortOrder.value);
}

async function loadTableRecordCounts() {
  isLoadingCounts.value = true;
  try {
    const promises = tables.value.map(async (table) => {
      if (table.recordCount === undefined) {
        try {
          table.recordCount = await databaseStore.getTableRecordCount(props.connectionId, table.name);
        } catch (error) {
          console.error(`Failed to get record count for ${table.name}:`, error);
          table.recordCount = 0;
        }
      }
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error("Error loading record counts:", error);
  } finally {
    isLoadingCounts.value = false;
  }
}

function formatRecordCount(count) {
  if (count === null || count === undefined) return '0';
  
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

function getTableModel(tableName) {
  return databaseStore.getModelForTable(props.connectionId, tableName);
}

onMounted(() => {
  loadTableRecordCounts();
});

watch(() => tables.value.length, () => {
  loadTableRecordCounts();
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

/* Override tooltip styles to ensure they're visible */
.tooltip:before {
  max-width: 200px;
  white-space: normal;
  z-index: 100;
}

/* Animation for skeleton loading */
@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.3;
  }
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Fix for table names truncation */
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