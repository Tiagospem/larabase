<template>
  <div class="w-64 bg-sidebar border-r border-gray-800 flex flex-col" :style="{ width: sidebarWidth + 'px' }">
    <div class="p-3 border-b border-gray-800">
      <div class="relative">
        <input type="text" placeholder="Search tables..." 
          class="input input-sm input-bordered w-full bg-base-300 pl-9" 
          v-model="searchTerm" />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-5 h-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
          <path stroke-linecap="round" stroke-linejoin="round" 
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
    </div>

    <div class="overflow-y-auto flex-1">
      <div v-if="isLoading" class="p-4 text-center">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      
      <ul v-else class="menu menu-sm">
        <li v-for="table in filteredTables" :key="table.name" class="hover:bg-base-300">
          <a @click="openTable(table)" :class="{ 'bg-base-300': isTableActive(table.name) }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.125-3.75H3.375m0 0h1.125m0 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25h7.5c.621 0 1.125.504 1.125 1.125m-9.75 0v1.5m0-1.5h18.75m0 1.5c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5m0 0h-1.5m-16.5-3.75v-1.5m0 0c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125v1.5m-16.5 0h16.5m-16.5 0h1.5m-1.5 0h-1.5m-12 3.75H15m-12.75 0h1.5m-1.5 0H1.5m3.75 0h16.5" />
            </svg>
            <span class="truncate">{{ table.name }}</span>
            <span class="badge badge-sm">{{ table.columnCount }}</span>
          </a>
        </li>
      </ul>
    </div>
  </div>

  <div class="resize-handle cursor-col-resize" @mousedown="startResize" />
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDatabaseStore } from '@/store/database';

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

const isLoading = computed(() => databaseStore.isLoading);
const tables = computed(() => databaseStore.tablesList);

const filteredTables = computed(() => {
  if (!searchTerm.value) return tables.value;
  const term = searchTerm.value.toLowerCase();
  return tables.value.filter(table => table.name.toLowerCase().includes(term));
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
</style> 