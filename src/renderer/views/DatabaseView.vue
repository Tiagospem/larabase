<template>
  <div class="flex flex-col h-full">
    <header class="bg-neutral px-4 py-2 border-b border-neutral flex items-center justify-between">
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
          <div class="text-xs text-gray-400 flex items-center">
            <span>{{ connection?.database || connection?.path }}</span>
            <button @click="showConnectionInfo = true" class="ml-1 text-gray-400 hover:text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div class="flex">
        <!-- Database Tools Section -->
        <div class="border-r border-neutral-700 pr-2 mr-2">
          <button class="btn btn-ghost btn-sm" @click="showTablesModelsModal = true" title="Tables Models JSON">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
            </svg>
          </button>
          
          <button class="btn btn-ghost btn-sm" @click="showLiveUpdates = true" title="Live Updates">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
          
          <button class="btn btn-ghost btn-sm" @click="showDatabaseDiagram = true" title="Database Diagram">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M7.875 14.25l1.214 1.942a2.25 2.25 0 001.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 011.872 1.002l.164.246a2.25 2.25 0 001.872 1.002h2.092a2.25 2.25 0 001.872-1.002l.164-.246A2.25 2.25 0 0116.954 9h4.636M2.41 9a2.25 2.25 0 00-.16.832V12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 01.382-.632l3.285-3.832a2.25 2.25 0 011.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0021.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
          
          <button class="btn btn-ghost btn-sm" @click="showProjectLogs = true" title="Project Logs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </button>
        </div>
        
        <!-- System Actions Section -->
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

    <div v-if="openTabs.length > 0" class="tabs-container border-b border-neutral bg-base-300">
      <button 
        v-if="hasScrollLeft" 
        @click="scrollLeft" 
        class="tab-scroll-button tab-scroll-left">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      
      <div class="tabs-scroll" ref="tabsScrollRef" @scroll="checkScrollPosition">
        <div v-for="tab in openTabs" :key="tab.id" 
          :class="['tab', { 'active': tab.id === activeTabId }]"
          @click="activateTab(tab.id)"
          draggable="true"
          @dragstart="handleDragStart($event, tab.id)"
          @dragover.prevent
          @drop="handleDrop($event, tab.id)">
          <span class="tab-title">{{ tab.title }}</span>
          <button class="close-icon" @click.stop="closeTab(tab.id)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <button 
        v-if="hasScrollRight" 
        @click="scrollRight" 
        class="tab-scroll-button tab-scroll-right">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <TablesSidebar 
        :connectionId="connectionId"
        :activeTabName="activeTab?.tableName"
        :sidebarWidth="sidebarWidth"
        @resize-start="startResize"
        @table-open="openTable"
        @update:sidebarWidth="sidebarWidth = $event"
      />

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

    <footer class="bg-neutral px-4 py-1 text-xs text-gray-400 border-t border-black/20">
      <div class="flex justify-between">
        <div>{{ connection?.type.toUpperCase() }} | {{ connection?.host || connection?.path }}</div>
        <div>Total tables: {{ databaseStore.tablesList.length }}</div>
      </div>
    </footer>
  </div>

  <div class="modal" :class="{ 'modal-open': connectionError }">
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Connection Error</h3>
      <p class="py-4">{{ connectionErrorMessage }}</p>
      <div class="modal-action">
        <button class="btn btn-primary" @click="goBack">Back to Home</button>
      </div>
    </div>
  </div>

  <div class="modal" :class="{ 'modal-open': showConnectionInfo }">
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Connection Details</h3>
      <div class="py-4">
        <div v-if="connection" class="space-y-2">
          <p><span class="font-semibold">Name:</span> {{ connection.name }}</p>
          <p><span class="font-semibold">Type:</span> {{ connection.type }}</p>
          <p v-if="connection.host"><span class="font-semibold">Host:</span> {{ connection.host }}</p>
          <p v-if="connection.port"><span class="font-semibold">Port:</span> {{ connection.port }}</p>
          <p v-if="connection.database"><span class="font-semibold">Database:</span> {{ connection.database }}</p>
          <p v-if="connection.username"><span class="font-semibold">Username:</span> {{ connection.username }}</p>
          <p v-if="connection.path"><span class="font-semibold">Path:</span> {{ connection.path }}</p>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn btn-primary" @click="showConnectionInfo = false">Close</button>
      </div>
    </div>
  </div>
  
  <!-- Project Logs Modal -->
  <ProjectLogs
    :is-open="showProjectLogs"
    :connection-id="connectionId"
    :project-path="connection?.projectPath"
    @close="showProjectLogs = false"
    @select-project="handleSelectProject"
  />
  
  <!-- Live Database Updates Modal -->
  <LiveUpdates
    :is-open="showLiveUpdates"
    :connection-id="connectionId"
    @close="showLiveUpdates = false"
    @goto-table="handleGotoTable"
  />

  <!-- Database Diagram Modal -->
  <DatabaseDiagram
    :is-open="showDatabaseDiagram"
    :connection-id="connectionId"
    @close="showDatabaseDiagram = false"
  />

  <!-- Tables Models JSON Modal -->
  <div v-if="showTablesModelsModal" class="modal modal-open">
    <div class="modal-box w-11/12 max-w-5xl max-h-[90vh]">
      <h3 class="font-bold text-lg mb-4">All Tables Models Data</h3>
      <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
        <pre><code>{{ allTablesModelsJson }}</code></pre>
      </div>
      <div class="modal-action">
        <button class="btn btn-sm btn-primary" @click="copyAllTablesJsonToClipboard">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
          Copy to Clipboard
        </button>
        <button class="btn" @click="showTablesModelsModal = false">Close</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="showTablesModelsModal = false"></div>
  </div>
</template>

<script setup>
import {computed, inject, onMounted, ref, markRaw, nextTick, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useConnectionsStore} from '@/store/connections';
import {useDatabaseStore} from '@/store/database';
import {useTabsStore} from '@/store/tabs';
import TableContent from '../components/TableContent.vue';
import TablesSidebar from '../components/TablesSidebar.vue';
import ProjectLogs from '../components/ProjectLogs.vue';
import LiveUpdates from '../components/LiveUpdates.vue';
import DatabaseDiagram from '../components/DatabaseDiagram.vue';

const TableContentComponent = markRaw(TableContent);

const route = useRoute();
const router = useRouter();
const connectionId = computed(() => route.params.id);

const showAlert = inject('showAlert');

const connectionsStore = useConnectionsStore();
const databaseStore = useDatabaseStore();
const tabsStore = useTabsStore();

const sidebarWidth = ref(240);
const isResizing = ref(false);
const connectionError = ref(false);
const connectionErrorMessage = ref('');
const showConnectionInfo = ref(false);
const showProjectLogs = ref(false);
const showLiveUpdates = ref(false);
const showDatabaseDiagram = ref(false);
const draggingTabId = ref(null);
const tabsScrollRef = ref(null);
const hasScrollLeft = ref(false);
const hasScrollRight = ref(false);
const showTablesModelsModal = ref(false);
const allTablesModelsJson = ref('');

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

const openTabs = computed(() => tabsStore.openTabs);
const activeTabId = computed(() => tabsStore.activeTabId);
const activeTab = computed(() => tabsStore.activeTab);

function openTable(table) {
  try {
    tabsStore.addTab({
      connectionId: connectionId.value,
      tableName: table.name,
      columnCount: table.columnCount
    });
    nextTick(() => {
      scrollToActiveTab();
    });
  } catch (error) {
    console.error(error);
  }
}

function activateTab(tabId) {
  tabsStore.activateTab(tabId);
  nextTick(() => {
    scrollToActiveTab();
  });
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

// Global function to expose table model info for AI integration
window.getTableModelJson = (tableName) => {
  if (!tableName || !connectionId.value) return null;
  return databaseStore.getTableModelJson(connectionId.value, tableName);
}

// Global function to get all tables models data
window.getAllTablesModelsJson = () => {
  if (!connectionId.value) return null;
  return databaseStore.getAllTablesModelsJson(connectionId.value);
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
    sidebarWidth.value = Math.max(200, Math.min(500, e.clientX));
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

function handleDragStart(event, tabId) {
  draggingTabId.value = tabId;
  event.dataTransfer.effectAllowed = 'move';
}

function handleDrop(event, targetTabId) {
  if (draggingTabId.value === null) return;
  
  const draggedTabIndex = openTabs.value.findIndex(tab => tab.id === draggingTabId.value);
  const targetTabIndex = openTabs.value.findIndex(tab => tab.id === targetTabId);
  
  if (draggedTabIndex === -1 || targetTabIndex === -1) return;

  // Reorder tabs
  const tabs = [...openTabs.value];
  const [removed] = tabs.splice(draggedTabIndex, 1);
  tabs.splice(targetTabIndex, 0, removed);
  
  // Update tabs order in store
  tabsStore.reorderTabs(tabs);
  draggingTabId.value = null;
}

function scrollToActiveTab() {
  if (!tabsScrollRef.value) return;
  
  const activeTabElement = tabsScrollRef.value.querySelector('.tab.active');
  if (!activeTabElement) return;
  
  const scrollContainer = tabsScrollRef.value;
  const containerWidth = scrollContainer.offsetWidth;
  const tabLeft = activeTabElement.offsetLeft;
  const tabWidth = activeTabElement.offsetWidth;

  if (tabLeft + tabWidth > scrollContainer.scrollLeft + containerWidth) {
    scrollContainer.scrollTo({
      left: tabLeft + tabWidth - containerWidth + 20,
      behavior: 'smooth'
    });
  }

  else if (tabLeft < scrollContainer.scrollLeft) {
    scrollContainer.scrollTo({
      left: tabLeft - 20,
      behavior: 'smooth'
    });
  }

  checkScrollPosition();
}

function checkScrollPosition() {
  if (!tabsScrollRef.value) return;
  
  const container = tabsScrollRef.value;
  hasScrollLeft.value = container.scrollLeft > 0;
  hasScrollRight.value = container.scrollLeft < (container.scrollWidth - container.clientWidth);
}

function scrollLeft() {
  if (!tabsScrollRef.value) return;
  
  const container = tabsScrollRef.value;
  const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
  container.scrollBy({
    left: -scrollAmount,
    behavior: 'smooth'
  });
}

function scrollRight() {
  if (!tabsScrollRef.value) return;
  
  const container = tabsScrollRef.value;
  const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
  container.scrollBy({
    left: scrollAmount,
    behavior: 'smooth'
  });
}

watch(() => tabsStore.activeTabId, () => {
  nextTick(() => {
    scrollToActiveTab();
  });
});

watch(() => openTabs.value.length, () => {
  nextTick(() => {
    checkScrollPosition();
  });
});

async function testConnection() {
  if (!connection.value) {
    connectionError.value = true;
    connectionErrorMessage.value = 'Connection not found';
    return false;
  }

  try {
    const testResult = await window.api.testMySQLConnection({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password,
      database: connection.value.database
    });

    if (!testResult.success) {
      connectionError.value = true;
      connectionErrorMessage.value = `Failed to connect to database: ${testResult.message}`;
      return false;
    }

    return true;
  } catch (error) {
    connectionError.value = true;
    connectionErrorMessage.value = `Error testing connection: ${error.message}`;
    return false;
  }
}

onMounted(async () => {
  try {
    await tabsStore.loadSavedTabs();

    if (!connection.value) {
      connectionError.value = true;
      connectionErrorMessage.value = 'Connection not found';
      return;
    }
    
    const connectionValid = await testConnection();
    if (!connectionValid) {
      return;
    }

    showAlert(`Connected to ${connection.value.name}`, 'success');
    await databaseStore.loadTables(connectionId.value);
    
    window.addEventListener('resize', checkScrollPosition);
    
    await nextTick(() => {
      scrollToActiveTab();
      checkScrollPosition();
    });
    
  } catch (error) {
    console.error(error);
    connectionError.value = true;
    connectionErrorMessage.value = error.message || 'Unknown error occurred';
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

function handleGotoTable(tableName) {
  const tableData = databaseStore.tablesList.find(t => t.name === tableName);
  if (tableData) {
    openTable(tableData);
  } else {
    showAlert(`Table "${tableName}" not found`, 'error');
  }
}

function handleSelectProject() {
  selectProjectPath();
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();
    if (result.canceled) return;
    
    const selectedPath = result.filePaths[0];
    const isLaravelProject = await window.api.validateLaravelProject(selectedPath);
    
    if (!isLaravelProject) {
      showAlert('Selected directory is not a valid Laravel project', 'error');
      return;
    }
    
    await connectionsStore.updateConnection(connectionId.value, {
      projectPath: selectedPath
    });
    
    showAlert('Laravel project path set successfully', 'success');
  } catch (error) {
    console.error('Error selecting project path:', error);
    showAlert('Failed to select project path: ' + error.message, 'error');
  }
}

async function copyAllTablesJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(allTablesModelsJson.value);
    showAlert('JSON copied to clipboard', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showAlert('Failed to copy to clipboard', 'error');
  }
}

watch(showTablesModelsModal, (isOpen) => {
  if (isOpen) {
    allTablesModelsJson.value = databaseStore.getAllTablesModelsJson(connectionId.value);
  }
});
</script>

<style scoped>
.tabs-container {
  position: relative;
  width: 100%;
  height: 40px;
  overflow: hidden;
  display: flex;
}

.tabs-scroll {
  display: flex;
  overflow-x: auto;
  height: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  min-width: 150px;
  max-width: 150px;
  padding: 0 10px;
  border-right: 1px solid rgb(24, 24, 27);
  background-color: rgb(24, 24, 27);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.tab.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.close-icon {
  opacity: 0.7;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 6px;
  flex-shrink: 0;
}

.tab:hover {
  background-color:  rgba(255, 255, 255, 0.1);
}

.tab:hover .close-icon {
  opacity: 1;
}

.close-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tab-scroll-button {
  width: 28px;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bbb;
  flex-shrink: 0;
  transition: background-color 0.2s;
  z-index: 1;
}

.tab-scroll-button:hover {
  background-color: rgb(24, 24, 27);
  color: white;
}

.tab-scroll-left {
  border-right: 1px solid rgb(24, 24, 27);
}

.tab-scroll-right {
  border-left: 1px solid rgb(24, 24, 27);
}
</style> 