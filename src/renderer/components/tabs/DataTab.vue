<template>
  <div class="h-full flex flex-col">
    <div
      class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <RefreshButton :store-id="storeId" />
        <LiveTableButton :store-id="storeId" />
        <TruncateButton :store-id="storeId" />
        <DeleteButton :store-id="storeId" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <FilterButton :store-id="storeId" ref="filterButtonRef" />

        <select
          v-model="tableDataStore.rowsPerPage"
          class="select select-sm select-bordered bg-base-300 w-24 sm:w-32"
        >
          <option value="10">10 rows</option>
          <option value="25">25 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <LoadingState v-if="isLoading" />
      <ErrorState
        v-else-if="loadError"
        :message="tableDataStore.loadError"
        @retry="tableDataStore.loadTableData()"
      />
      <EmptyFilterState
        v-else-if="isFilteredEmpty"
        @clear="filterButtonRef.clearFilters"
        @reload="tableDataStore.loadTableData()"
      />
      <DataTable
        v-else-if="hasData"
        :store-id="storeId"
        ref="dataTableRef"
        @loadFilteredData="filterButtonRef.loadFilteredData()"
        @openPreviewModal="openPreviewModal"
        @openEditModal="row => editRecordRef.openEditModal(row)"
        @navigateToForeignKey="(column, row) => navigateToForeignKey(column, row)"
      />

      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
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
          <p>Records not found</p>
          <button class="btn btn-sm btn-primary mt-4" @click="tableDataStore.loadTableData()">
            Reload
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="tableData.length > 0"
      class="bg-base-200 px-4 py-3 border-t border-neutral flex flex-col sm:flex-row justify-between items-center text-xs sticky bottom-0 left-0 right-0 min-h-[56px] z-20"
    >
      <div class="flex items-center mb-2 sm:mb-0">
        <span class="text-gray-400">
          {{ tableName }} | {{ tableDataStore.totalRecords }} records{{
            tableDataStore.selectedRows.length > 0
              ? ` | ${tableDataStore.selectedRows.length} selected`
              : ''
          }}
          | <span>{{ tableDataStore.columns.length }} columns</span>
        </span>
        <div class="ml-4 flex space-x-2">
          <button class="btn btn-ghost btn-xs">
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
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <div class="join">
          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': tableDataStore.currentPage === 1 }"
            :disabled="tableDataStore.currentPage === 1"
            @click="goToFirstPage"
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
                d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': tableDataStore.currentPage === 1 }"
            :disabled="tableDataStore.currentPage === 1"
            @click="prevPage"
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
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>

          <div class="join-item btn btn-xs btn-disabled">
            <span class="text-xs"> {{ tableDataStore.currentPage }} / {{ totalPages }} </span>
          </div>

          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': tableDataStore.currentPage === totalPages }"
            :disabled="tableDataStore.currentPage === totalPages"
            @click="nextPage"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': tableDataStore.currentPage === totalPages }"
            :disabled="tableDataStore.currentPage === totalPages"
            @click="goToLastPage"
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
                d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <span class="text-gray-400 hidden sm:inline-block">Rows per page:</span>
          <select
            v-model="tableDataStore.rowsPerPage"
            class="select select-xs select-bordered bg-base-300 w-16"
            @change="tableDataStore.currentPage = 1"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div class="hidden md:flex items-center space-x-2">
          <span class="text-gray-400">Go to page:</span>
          <input
            v-model="pageInput"
            type="number"
            min="1"
            :max="totalPages"
            class="input input-xs input-bordered bg-base-300 w-14"
            @keyup.enter="goToPage"
          />
          <button class="btn btn-xs btn-ghost" @click="goToPage">Go</button>
        </div>
      </div>
    </div>

    <DataPreviewModal
      v-if="tableDataStore.previewingRecord"
      :show="tableDataStore.showPreviewModal"
      :record="tableDataStore.previewingRecord"
      :columns="tableDataStore.columns"
      @close="closePreviewModal"
    />

    <EditRecord :store-id="storeId" ref="editRecordRef" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';

import {
  DataPreviewModal,
  RefreshButton,
  LiveTableButton,
  TruncateButton,
  DeleteButton,
  EditRecord,
  FilterButton,
  LoadingState,
  ErrorState,
  EmptyFilterState,
  DataTable
} from '@/components/tabs/components';

import { Helpers } from '../../utils/helpers';

import { useTableDataStore, createTableDataStoreId } from '@/store/table-data';
import { useDatabaseStore } from '@/store/database';

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  onLoad: {
    type: Function,
    required: true
  },
  initialFilter: {
    type: String,
    default: ''
  },
  onOpenTab: {
    type: Function,
    required: false,
    default: () => {}
  }
});

const storeId = createTableDataStoreId(props.connectionId, props.tableName);

const tableDataStore = useTableDataStore(storeId);
const databaseStore = useDatabaseStore();

const showAlert = inject('showAlert');

const isLoading = computed(() => tableDataStore.isLoading && !tableDataStore.isLiveUpdating);
const loadError = computed(() => !!tableDataStore.loadError);
const isFilteredEmpty = computed(
  () =>
    (tableDataStore.filterTerm || tableDataStore.activeFilter) &&
    tableDataStore.filteredData.length === 0
);
const hasData = computed(() => tableDataStore.tableData.length > 0);

const pageInput = ref(1);
const editRecordRef = ref(null);
const filterButtonRef = ref(null);
const dataTableRef = ref(null);

const totalPages = computed(() => {
  if (tableDataStore.rowsPerPage === 0) return 1;
  return Math.ceil(tableDataStore.totalRecords / tableDataStore.rowsPerPage);
});
const tableData = computed(() => tableDataStore.tableData);
const rowsPerPage = computed(() => tableDataStore.rowsPerPage);
const highlightChanges = computed(() => tableDataStore.highlightChanges);

function prevPage() {
  if (tableDataStore.currentPage > 1) {
    tableDataStore.currentPage--;
    dataTableRef.value.scrollToTop();
  }
}

function nextPage() {
  if (tableDataStore.currentPage < totalPages.value) {
    tableDataStore.currentPage++;
    dataTableRef.value.scrollToTop();
  }
}

function goToFirstPage() {
  if (tableDataStore.currentPage !== 1) {
    tableDataStore.currentPage = 1;
    dataTableRef.value.scrollToTop();
  }
}

function goToLastPage() {
  if (tableDataStore.currentPage !== totalPages.value) {
    tableDataStore.currentPage = totalPages.value;
    dataTableRef.value.scrollToTop();
  }
}

function goToPage() {
  const page = parseInt(pageInput.value);
  if (
    !isNaN(page) &&
    page >= 1 &&
    page <= totalPages.value &&
    page !== tableDataStore.currentPage
  ) {
    tableDataStore.currentPage = page;
    dataTableRef.value.scrollToTop();
  } else {
    pageInput.value = tableDataStore.currentPage;
  }
}

const refreshLiveTableState = () => {
  try {
    const liveTableKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
    const storedState = localStorage.getItem(liveTableKey) === 'true';

    if (tableDataStore.isLiveTableActive !== storedState) {
      tableDataStore.isLiveTableActive = storedState;

      if (tableDataStore.isLiveTableActive && !tableDataStore.liveTableInterval) {
        tableDataStore.startLiveUpdates();
      } else if (!tableDataStore.isLiveTableActive && tableDataStore.liveTableInterval) {
        tableDataStore.stopLiveUpdates();
      }
    }
  } catch (e) {
    console.error('Error refreshing Live Table state:', e);
  }
};

async function navigateToForeignKey(column, value) {
  if (value === null || value === undefined) {
    showAlert('Null or undefined value. Unable to navigate to the related record.', 'error');
    return;
  }

  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    const columnInfo = structure.find(col => col.name === column);

    if (!columnInfo || !columnInfo.foreign_key) {
      return;
    }

    const foreignKeys = await databaseStore.getTableForeignKeys(
      props.connectionId,
      props.tableName
    );
    const foreignKey = foreignKeys.find(fk => fk.column === column);

    if (!foreignKey) {
      console.error(`Foreign key information not found for column "${column}"`);
      return;
    }

    const targetTable = foreignKey.referenced_table;
    const targetColumn = foreignKey.referenced_column;

    if (!targetTable || !targetColumn) {
      console.error('Referenced table or column not found in foreign key');
      return;
    }

    let filterValue = value;
    if (typeof value === 'string') {
      filterValue = `'${value.replace(/'/g, "''")}'`;
    }

    const filter = `${targetColumn} = ${filterValue}`;

    const tabTitle = `${targetTable} (Filtered)`;

    const newTab = {
      id: `data-${props.connectionId}-${targetTable}-${Date.now()}`,
      title: tabTitle,
      type: 'data',
      data: {
        connectionId: props.connectionId,
        tableName: targetTable,
        filter: filter
      },
      icon: 'table'
    };

    props.onOpenTab(newTab);
  } catch (error) {
    console.error('Error navigating to foreign key:', error);
    showAlert('Failed to navigate to related record: ' + error.message, 'error');
  }
}

function openPreviewModal(row) {
  tableDataStore.previewingRecord = JSON.parse(JSON.stringify(row));
  tableDataStore.showPreviewModal = true;
}

function closePreviewModal() {
  tableDataStore.showPreviewModal = false;
  setTimeout(() => {
    tableDataStore.previewingRecord = null;
  }, 300);
}

function handleStorageChange(event) {
  if (!event.key) return;

  const ourKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
  if (event.key === ourKey) {
    const newValue = event.newValue === 'true';
    if (newValue !== tableDataStore.isLiveTableActive) {
      tableDataStore.isLiveTableActive = newValue;
      if (newValue) {
        tableDataStore.startLiveUpdates();
      } else {
        tableDataStore.stopLiveUpdates();
      }
    }
  }

  if (
    event.key.startsWith('liveTable.enabled.') &&
    event.key !== ourKey &&
    event.newValue === 'true' &&
    tableDataStore.isLiveTableActive
  ) {
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
    localStorage.setItem(ourKey, 'false');
  }
}

const handleTabActivation = () => {
  refreshLiveTableState();
  setTimeout(refreshLiveTableState, 100);
};

const handleWindowFocus = () => {
  refreshLiveTableState();
};

function addEventListener() {
  window.addEventListener('tab-activated', handleTabActivation);
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('focus', handleWindowFocus);
}

function removeEventListener() {
  window.removeEventListener('tab-activated', handleTabActivation);
  window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('focus', handleWindowFocus);
}

async function loadTableStructure() {
  try {
    const structure = await databaseStore.getTableStructure(
      props.connectionId,
      props.tableName,
      true
    );

    Helpers.setColumnStructure(structure);
  } catch (error) {
    console.error('Error loading table structure:', error);
    showAlert(`Error loading table structure: ${error.message}`, 'error');
  }
}

onMounted(() => {
  addEventListener();

  loadTableStructure().then(() => {
    tableDataStore.loadTableData();
  });

  tableDataStore.setConnectionId(props.connectionId);
  tableDataStore.setTableName(props.tableName);
  tableDataStore.setOnLoad(props.onLoad);

  if (props.initialFilter) {
    tableDataStore.advancedFilterTerm = props.initialFilter;
    tableDataStore.activeFilter = props.initialFilter;
  }

  try {
    const tableSpecificLiveEnabled = localStorage.getItem(
      `liveTable.enabled.${props.connectionId}.${props.tableName}`
    );

    let otherTableLiveActive = false;

    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (
        key.startsWith('liveTable.enabled.') &&
        key !== `liveTable.enabled.${props.connectionId}.${props.tableName}` &&
        localStorage.getItem(key) === 'true'
      ) {
        otherTableLiveActive = true;
      }
    });

    if (tableSpecificLiveEnabled === 'true' && !otherTableLiveActive) {
      tableDataStore.isLiveTableActive = true;
    } else {
      tableDataStore.isLiveTableActive = false;
      if (tableSpecificLiveEnabled === 'true') {
        localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
      }
    }

    const savedLiveDelay = localStorage.getItem('liveTable.delay');

    if (savedLiveDelay) {
      tableDataStore.liveUpdateDelaySeconds = parseInt(savedLiveDelay, 10) || 3;
      tableDataStore.liveUpdateDelay = tableDataStore.liveUpdateDelaySeconds * 1000;
    }

    const savedHighlightChanges = localStorage.getItem('liveTable.highlight');
    if (savedHighlightChanges !== null) {
      tableDataStore.highlightChanges = savedHighlightChanges === 'true';
    }
  } catch (e) {
    console.error('Failed to load live table preferences', e);
  }

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.startLiveUpdates();
  }

  refreshLiveTableState();

  const urlParams = new URLSearchParams(window.location.search);

  const urlFilter = urlParams.get('filter');

  if (urlFilter) {
    try {
      const decodedFilter = decodeURIComponent(urlFilter);
      tableDataStore.advancedFilterTerm = decodedFilter;
      tableDataStore.activeFilter = decodedFilter;
    } catch (e) {
      console.error('Error to process URL filter:', e);
    }
  } else if (!props.initialFilter) {
    const savedFilter = localStorage.getItem(`filter:${props.connectionId}:${props.tableName}`);
    if (savedFilter) {
      try {
        const parsedFilter = JSON.parse(savedFilter);
        if (parsedFilter.active && parsedFilter.value) {
          tableDataStore.advancedFilterTerm = parsedFilter.value;
          tableDataStore.activeFilter = parsedFilter.value;
        }
      } catch (e) {
        console.error('Error to process saved filter:', e);
      }
    }
  }
});

onUnmounted(() => {
  removeEventListener();

  if (tableDataStore.isLiveTableActive) {
    try {
      localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
    } catch (e) {
      console.error('Failed to update localStorage during component unmount', e);
    }
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
  }
});

watch(
  () => tableDataStore.currentPage,
  (newPage, oldPage) => {
    if (newPage !== oldPage) {
      pageInput.value = newPage;

      if (!tableDataStore.filterTerm && !tableDataStore.activeFilter) {
        tableDataStore.loadTableData();
      }
    }
  }
);

watch(rowsPerPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    tableDataStore.currentPage = 1;
    tableDataStore.loadTableData();
  }
});

watch(highlightChanges, newValue => {
  try {
    localStorage.setItem('liveTable.highlight', String(newValue));
  } catch (e) {
    console.error('Failed to save highlight preference', e);
  }
});

watch(
  [() => props.tableName, () => props.connectionId],
  async ([newTableName, newConnectionId], [oldTableName, oldConnectionId]) => {
    if (newTableName !== oldTableName || newConnectionId !== oldConnectionId) {
      await loadTableStructure();

      if (oldTableName && oldConnectionId) {
        const oldLiveTableKey = `liveTable.enabled.${oldConnectionId}.${oldTableName}`;
        try {
          localStorage.setItem(oldLiveTableKey, 'false');
        } catch (e) {
          console.error('Error deactivating previous tab live table:', e);
        }
      }

      if (tableDataStore.isLiveTableActive) {
        tableDataStore.stopLiveUpdates();
        tableDataStore.isLiveTableActive = false;
      }

      try {
        const newLiveTableKey = `liveTable.enabled.${newConnectionId}.${newTableName}`;
        const isLiveEnabled = localStorage.getItem(newLiveTableKey) === 'true';

        const activeLiveTableKeys = [];
        const allKeys = Object.keys(localStorage);
        for (const key of allKeys) {
          if (key.startsWith('liveTable.enabled.') && localStorage.getItem(key) === 'true') {
            activeLiveTableKeys.push(key);
          }
        }

        if (
          activeLiveTableKeys.length > 1 ||
          (activeLiveTableKeys.length === 1 && !isLiveEnabled)
        ) {
          activeLiveTableKeys.forEach(key => {
            if (key !== newLiveTableKey || !isLiveEnabled) {
              localStorage.setItem(key, 'false');
            }
          });
        }

        tableDataStore.isLiveTableActive = isLiveEnabled;

        if (tableDataStore.isLiveTableActive) {
          tableDataStore.startLiveUpdates();
        }
      } catch (e) {
        console.error('Error updating live table state during tab switch:', e);
        tableDataStore.isLiveTableActive = false;
      }
    }
  }
);
</script>
