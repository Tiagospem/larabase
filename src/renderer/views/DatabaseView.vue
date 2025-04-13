<template>
  <div class="flex flex-col h-full">
    <header class="bg-neutral px-4 py-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center">
        <button class="btn btn-ghost btn-sm mr-2" @click="goBack">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        
        <div class="w-8 h-8 rounded-full flex items-center justify-center mr-2" 
          :class="getConnectionColor(connection?.type)">
          <span class="text-white font-bold text-sm">{{ connection?.icon }}</span>
        </div>
        
        <div>
          <h1 class="text-lg font-semibold">{{ connection?.name }}</h1>
          <p class="text-xs text-gray-400">{{ connection?.host || connection?.path }}</p>
        </div>
      </div>
      
      <div>
        <button class="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
        <button class="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="openTabs.length > 0" class="bg-base-300 px-2 pt-1 border-b border-gray-800 flex items-center overflow-x-auto no-scrollbar">
      <div class="flex">
        <div v-for="tab in openTabs" :key="tab.id" 
          :class="['tab', 'tab-bordered', 'px-4', 'py-2', 'rounded-t-md', 'mr-1', 'flex', 'items-center', 'justify-center', 'min-h-[2.5rem]', 'gap-2',
                 { 'tab-active bg-base-100': tab.id === activeTabId }]"
          @click="activateTab(tab.id)">
          <span class="truncate max-w-xs">{{ tab.title }}</span>
          <button class="btn btn-ghost btn-xs btn-circle" @click.stop="closeTab(tab.id)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
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

      <div class="flex-1 bg-base-100 overflow-hidden">
        <div v-if="!activeTab" class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.125-3.75H3.375m0 0h1.125m0 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25h7.5c.621 0 1.125.504 1.125 1.125m-9.75 0v1.5m0-1.5h18.75m0 1.5c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5m0 0h-1.5m-16.5-3.75v-1.5m0 0c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125v1.5m-16.5 0h16.5m-16.5 0h1.5m-1.5 0h-1.5m-12 3.75H15m-12.75 0h1.5m-1.5 0H1.5m3.75 0h16.5" />
            </svg>
            <p>Select a table</p>
          </div>
        </div>
        
        <keep-alive>
          <component 
            v-if="activeTab"
            :is="TableContentComponent"
            :key="activeTab.id"
            :connection-id="activeTab.connectionId"
            :table-name="activeTab.tableName"
            @update-tab-data="handleUpdateTabData" />
        </keep-alive>
      </div>
    </div>

    <footer class="bg-neutral px-4 py-1 text-xs text-gray-400 border-t border-gray-800">
      <div class="flex justify-between">
        <div>{{ connection?.type.toUpperCase() }} | {{ connection?.host || connection?.path }}</div>
        <div>Total tables: {{ totalTables }}</div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import {computed, inject, onMounted, ref, markRaw} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useConnectionsStore} from '@/store/connections';
import {useDatabaseStore} from '@/store/database';
import {useTabsStore} from '@/store/tabs';
import TableContent from '../components/TableContent.vue';

const TableContentComponent = markRaw(TableContent);

const route = useRoute();
const router = useRouter();
const connectionId = computed(() => parseInt(route.params.id, 10));

const showAlert = inject('showAlert');

const connectionsStore = useConnectionsStore();
const databaseStore = useDatabaseStore();
const tabsStore = useTabsStore();

const searchTerm = ref('');
const sidebarWidth = ref(240);
const isResizing = ref(false);

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

const isLoading = computed(() => databaseStore.isLoading);
const tables = computed(() => databaseStore.tablesList);
const totalTables = computed(() => tables.value.length);

const filteredTables = computed(() => {
  if (!searchTerm.value) return tables.value;
  const term = searchTerm.value.toLowerCase();
  return tables.value.filter(table => table.name.toLowerCase().includes(term));
});

const openTabs = computed(() => tabsStore.openTabs);
const activeTabId = computed(() => tabsStore.activeTabId);
const activeTab = computed(() => tabsStore.activeTab);

function isTableActive(tableName) {
  return activeTab.value && activeTab.value.tableName === tableName;
}

function openTable(table) {
  try {
    tabsStore.addTab({
      connectionId: connectionId.value,
      tableName: table.name,
      columnCount: table.columnCount
    });
  } catch (error) {
    console.error(error);
  }
}

function activateTab(tabId) {
  tabsStore.activateTab(tabId);
}

function closeTab(tabId) {
  tabsStore.removeTab(tabId);
}

function handleUpdateTabData(tabName, data) {
  const tab = openTabs.value.find(t => t.tableName === tabName);
  if (tab) {
    tabsStore.updateTabData(tab.id, data);
  }
}

function goBack() {
  router.push('/');
}

function startResize(e) {
  isResizing.value = true;
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e) {
  if (isResizing.value) {
    sidebarWidth.value = Math.max(160, Math.min(500, e.clientX));
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

onMounted(async () => {
  try {
    await tabsStore.loadSavedTabs();

    if (!connection.value) {
      showAlert('Connection not found', 'error');
      await router.push('/');
      return;
    }
    
    showAlert(`Connected to ${connection.value.name}`, 'success');
    await databaseStore.loadTables(connectionId.value);
    
  } catch (error) {
    console.error(error);
    showAlert(error.message, 'error');
  }
});

function getConnectionColor(type) {
  switch (type) {
    case 'mysql':
      return 'bg-orange-500';
    case 'redis':
      return 'bg-red-600';
    case 'sqlite':
      return 'bg-purple-600';
    case 'postgresql':
      return 'bg-blue-600';
    default:
      return 'bg-gray-600';
  }
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

.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style> 