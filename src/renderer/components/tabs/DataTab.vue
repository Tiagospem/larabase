<template>
  <div class="h-full flex flex-col">
    <div
      class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2"
      v-if="!tablesStore.isLoading"
    >
      <div class="flex flex-wrap items-center gap-2">
        <RefreshButton
          :store-id="storeId"
          @refresh="handleRefresh"
        />
        <LiveTableButton :store-id="storeId" />
        <TruncateButton :store-id="storeId" />
        <DeleteButton :store-id="storeId" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <FilterButton
          ref="filterButtonRef"
          :store-id="storeId"
        />
      </div>
    </div>
    <div
      class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2"
      v-else
    >
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-sm text-transparent w-36 animate-pulse bg-neutral pointer-events-none"></button>
        <button class="btn btn-sm text-transparent w-36 animate-pulse bg-neutral pointer-events-none"></button>
        <button class="btn btn-sm text-transparent w-36 animate-pulse bg-neutral pointer-events-none"></button>
        <button class="btn btn-sm text-transparent w-36 animate-pulse bg-neutral pointer-events-none"></button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-sm text-transparent w-80 animate-pulse bg-neutral pointer-events-none"></button>
      </div>
    </div>

    <div
      class="flex-1 overflow-auto"
      v-if="!tablesStore.isLoading"
    >
      <ErrorState
        v-if="loadError"
        :message="tableDataStore.loadError"
        @retry="tableDataStore.loadTableData()"
      />
      <EmptyFilterState
        v-else-if="isFilteredEmpty && !isLoading"
        @clear="filterButtonRef.clearFilters()"
        @reload="tableDataStore.loadTableData()"
      />
      <DataTable
        v-else-if="hasData"
        ref="dataTableRef"
        :store-id="storeId"
        :is-loading="isLoading"
        @load-filtered-data="tableDataStore.loadFilteredData()"
        @navigate-to-foreign-key="(column, row) => navigateToForeignKey(column, row)"
      />
      <div v-else-if="isLoading || loadRetries.value > 0">
        <TableSkeleton />
      </div>
      <NoRecordState
        v-else
        @reload="handleRefresh"
      />
    </div>
    <div
      class="flex-1 overflow-auto"
      v-if="tablesStore.isLoading"
    >
      <TableSkeleton />
    </div>

    <template v-if="!tablesStore.isLoading">
      <PaginatorBar
        v-if="hasData"
        :store-id="storeId"
        @scroll-to-top="dataTableRef.scrollToTop()"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch, onActivated, onDeactivated } from "vue";

import {
  RefreshButton,
  LiveTableButton,
  TruncateButton,
  DeleteButton,
  FilterButton,
  ErrorState,
  EmptyFilterState,
  DataTable,
  NoRecordState,
  PaginatorBar,
  TableSkeleton
} from "@/components/tabs/partials";

import { Helpers } from "../../utils/helpers";

import { useTableDataStore, createTableDataStoreId } from "@/store/table-data";
import { useDatabaseStore } from "@/store/database";
import { useTablesStore } from "@/store/tables";

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
    default: ""
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
const tablesStore = useTablesStore();

const showAlert = inject("showAlert");

const isLoading = ref(false);
const loadError = computed(() => !!tableDataStore.loadError);
const isFilteredEmpty = computed(() => (tableDataStore.filterTerm || tableDataStore.activeFilter) && tableDataStore.filteredData.length === 0);
const hasData = computed(() => tableDataStore.tableData.length > 0);
const highlightChanges = computed(() => tableDataStore.highlightChanges);

const filterButtonRef = ref(null);
const dataTableRef = ref(null);
const isActive = ref(true);
const loadRetries = ref(0);
const maxRetries = 3;
const wasReloaded = ref(false);
const wasEmptyChecked = ref(false);

watch(
  () => [tableDataStore.isLoading, tableDataStore.isLiveUpdating],
  ([storeIsLoading, storeIsLiveUpdating]) => {
    isLoading.value = storeIsLoading && !storeIsLiveUpdating;
  },
  { immediate: true }
);

async function safeLoadTableData(forceRetry = false) {
  if (forceRetry) {
    loadRetries.value = 0;
  }

  try {
    const loadFunc = () => {
      if (tableDataStore.activeFilter || tableDataStore.filterTerm) {
        return tableDataStore.loadFilteredData();
      } else {
        return tableDataStore.loadTableData();
      }
    };

    await loadFunc();

    // Se conseguimos carregar com sucesso, mas não há dados, é provável que a tabela esteja vazia
    // Não vamos mais tentar recarregar automaticamente
    if (!hasData.value && !tableDataStore.loadError) {
      if (loadRetries.value < maxRetries && !wasEmptyChecked.value) {
        loadRetries.value++;
        console.log(`Retry loading data attempt ${loadRetries.value}/${maxRetries}`);

        // Esperar um pouco antes de tentar novamente
        setTimeout(() => {
          safeLoadTableData();
        }, 500);
        return;
      } else {
        // Marcamos que já verificamos que esta tabela está vazia
        wasEmptyChecked.value = true;
        console.log("Table appears to be empty, stopping reload attempts");
      }
    }

    // Redefine o contador de tentativas após o sucesso
    loadRetries.value = 0;
  } catch (error) {
    console.error("Failed to load table data:", error);
    tableDataStore.loadError = error.message || "Failed to load table data";

    // Tentar novamente em caso de erro
    if (loadRetries.value < maxRetries) {
      loadRetries.value++;
      console.log(`Error retry attempt ${loadRetries.value}/${maxRetries}`);

      setTimeout(() => {
        safeLoadTableData();
      }, 800);
      return;
    }
  }
}

// Adding event to reload data when the page is reloaded with F5
function handlePageReload() {
  if (document.visibilityState === "visible") {
    wasReloaded.value = true;
    loadRetries.value = 0;
    safeLoadTableData(true);
  }
}

// Adding function to check if there is data and reload if there is no data
function checkAndReloadIfNeeded() {
  if (!hasData.value && !isLoading.value && !loadError.value && !wasEmptyChecked.value) {
    console.log("No data found, attempting to reload");
    safeLoadTableData(true);
  }
}

function handleTableTruncate(event) {
  const { connectionId, tableName, totalRecords, forceReset } = event.detail;

  if (connectionId === props.connectionId && tableName === props.tableName) {
    tableDataStore.resetData();
    tableDataStore.totalRecordsCount = totalRecords !== undefined ? totalRecords : 0;

    if (forceReset) {
      setTimeout(() => {
        safeLoadTableData();
      }, 50);
    } else {
      safeLoadTableData();
    }
  }
}

const refreshLiveTableState = () => {
  try {
    const liveTableKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
    const storedState = localStorage.getItem(liveTableKey) === "true";

    if (tableDataStore.isLiveTableActive !== storedState) {
      tableDataStore.isLiveTableActive = storedState;

      if (tableDataStore.isLiveTableActive && !tableDataStore.liveTableInterval) {
        tableDataStore.startLiveUpdates();
      } else if (!tableDataStore.isLiveTableActive && tableDataStore.liveTableInterval) {
        tableDataStore.stopLiveUpdates();
      }
    }
  } catch (e) {
    console.error("Error refreshing Live Table state:", e);
  }
};

function handleStorageChange(event) {
  if (!event.key) return;

  const ourKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
  if (event.key === ourKey) {
    const newValue = event.newValue === "true";
    if (newValue !== tableDataStore.isLiveTableActive) {
      tableDataStore.isLiveTableActive = newValue;
      if (newValue) {
        tableDataStore.startLiveUpdates();
      } else {
        tableDataStore.stopLiveUpdates();
      }
    }
  }

  if (event.key.startsWith("liveTable.enabled.") && event.key !== ourKey && event.newValue === "true" && tableDataStore.isLiveTableActive) {
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
    localStorage.setItem(ourKey, "false");
  }
}

const handleTabActivation = () => {
  refreshLiveTableState();
  setTimeout(refreshLiveTableState, 100);
};

const handleWindowFocus = () => {
  refreshLiveTableState();
};

async function navigateToForeignKey(column, value) {
  if (value === null || value === undefined) {
    showAlert("Null or undefined value. Unable to navigate to the related record.", "error");
    return;
  }

  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    const columnInfo = structure.find((col) => col.name === column);

    if (!columnInfo || !columnInfo.foreign_key) {
      return;
    }

    const foreignKeys = await databaseStore.getTableForeignKeys(props.connectionId, props.tableName);
    const foreignKey = foreignKeys.find((fk) => fk.column === column);

    if (!foreignKey) {
      console.error(`Foreign key information not found for column "${column}"`);
      return;
    }

    const targetTable = foreignKey.referenced_table;
    const targetColumn = foreignKey.referenced_column;

    if (!targetTable || !targetColumn) {
      console.error("Referenced table or column not found in foreign key");
      return;
    }

    let filterValue = value;
    if (typeof value === "string") {
      filterValue = `'${value.replace(/'/g, "''")}'`;
    }

    const filter = `${targetColumn} = ${filterValue}`;

    const tabTitle = `${targetTable} (Filtered)`;

    const newTab = {
      id: `data-${props.connectionId}-${targetTable}-${Date.now()}`,
      title: tabTitle,
      type: "data",
      data: {
        connectionId: props.connectionId,
        tableName: targetTable,
        filter: filter
      },
      icon: "table"
    };

    props.onOpenTab(newTab);
  } catch (error) {
    console.error("Error navigating to foreign key:", error);
    showAlert("Failed to navigate to related record: " + error.message, "error");
  }
}

async function loadTableStructure() {
  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName, true);

    Helpers.setColumnStructure(structure);

    if (structure && Array.isArray(structure) && structure.length > 0) {
      tableDataStore.lastKnownColumns = structure.map((col) => col.name);
    }
  } catch (error) {
    console.error("Error loading table structure:", error);
    showAlert(`Error loading table structure: ${error.message}`, "error");
  }
}

onActivated(() => {
  isActive.value = true;

  window.addEventListener("tab-activated", handleTabActivation);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("focus", handleWindowFocus);
  window.addEventListener("reload-table-data", handleTableTruncate);
  window.addEventListener("truncate-table", handleTableTruncate);
  window.addEventListener("visibilitychange", handlePageReload);

  refreshLiveTableState();

  // If the table is active but has no data, try to reload
  if (!hasData.value && !isLoading.value) {
    checkAndReloadIfNeeded();
  }
});

onDeactivated(() => {
  isActive.value = false;

  window.removeEventListener("tab-activated", handleTabActivation);
  window.removeEventListener("storage", handleStorageChange);
  window.removeEventListener("focus", handleWindowFocus);
  window.removeEventListener("reload-table-data", handleTableTruncate);
  window.removeEventListener("truncate-table", handleTableTruncate);
  window.removeEventListener("visibilitychange", handlePageReload);

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.stopLiveUpdates(false);
  }
});

onMounted(() => {
  // reset states
  wasEmptyChecked.value = false;

  window.addEventListener("tab-activated", handleTabActivation);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("focus", handleWindowFocus);
  window.addEventListener("reload-table-data", handleTableTruncate);
  window.addEventListener("truncate-table", handleTableTruncate);
  window.addEventListener("visibilitychange", handlePageReload);

  loadTableStructure().then(() => {
    if (props.initialFilter) {
      tableDataStore.advancedFilterTerm = props.initialFilter;
      tableDataStore.activeFilter = props.initialFilter;
    }

    tableDataStore.setConnectionId(props.connectionId);
    tableDataStore.setTableName(props.tableName);
    tableDataStore.setOnLoad(props.onLoad);

    const urlParams = new URLSearchParams(window.location.search);
    const urlFilter = urlParams.get("filter");

    if (urlFilter) {
      try {
        const decodedFilter = decodeURIComponent(urlFilter);
        tableDataStore.advancedFilterTerm = decodedFilter;
        tableDataStore.activeFilter = decodedFilter;
      } catch (e) {
        console.error("Error to process URL filter:", e);
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
          console.error("Error to process saved filter:", e);
        }
      }
    }

    safeLoadTableData();

    // Check again after a short period if we have data
    setTimeout(checkAndReloadIfNeeded, 1000);
  });

  try {
    const tableSpecificLiveEnabled = localStorage.getItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`);

    let otherTableLiveActive = false;

    const allKeys = Object.keys(localStorage);

    allKeys.forEach((key) => {
      if (key.startsWith("liveTable.enabled.") && key !== `liveTable.enabled.${props.connectionId}.${props.tableName}` && localStorage.getItem(key) === "true") {
        otherTableLiveActive = true;
      }
    });

    if (tableSpecificLiveEnabled === "true" && !otherTableLiveActive) {
      tableDataStore.isLiveTableActive = true;
    } else {
      tableDataStore.isLiveTableActive = false;
      if (tableSpecificLiveEnabled === "true") {
        localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, "false");
      }
    }

    const savedLiveDelay = localStorage.getItem("liveTable.delay");

    if (savedLiveDelay) {
      tableDataStore.liveUpdateDelaySeconds = parseInt(savedLiveDelay, 10) || 3;
      tableDataStore.liveUpdateDelay = tableDataStore.liveUpdateDelaySeconds * 1000;
    }

    const savedHighlightChanges = localStorage.getItem("liveTable.highlight");

    if (savedHighlightChanges !== null) {
      tableDataStore.highlightChanges = savedHighlightChanges === "true";
    }
  } catch (e) {
    console.error("Failed to load live table preferences", e);
  }

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.startLiveUpdates();
  }

  refreshLiveTableState();
});

onUnmounted(() => {
  window.removeEventListener("tab-activated", handleTabActivation);
  window.removeEventListener("storage", handleStorageChange);
  window.removeEventListener("focus", handleWindowFocus);
  window.removeEventListener("reload-table-data", handleTableTruncate);
  window.removeEventListener("truncate-table", handleTableTruncate);
  window.removeEventListener("visibilitychange", handlePageReload);

  if (tableDataStore.isLiveTableActive) {
    try {
      localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, "false");
    } catch (e) {
      console.error("Failed to update localStorage during component unmount", e);
    }
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
  }
});

watch(highlightChanges, (newValue) => {
  try {
    localStorage.setItem("liveTable.highlight", String(newValue));
  } catch (e) {
    console.error("Failed to save highlight preference", e);
  }
});

watch([() => props.tableName, () => props.connectionId], async ([newTableName, newConnectionId], [oldTableName, oldConnectionId]) => {
  if (newTableName !== oldTableName || newConnectionId !== oldConnectionId) {
    // Reset states when table changes
    wasEmptyChecked.value = false;
    loadRetries.value = 0;

    await loadTableStructure();

    if (oldTableName && oldConnectionId) {
      const oldLiveTableKey = `liveTable.enabled.${oldConnectionId}.${oldTableName}`;
      try {
        localStorage.setItem(oldLiveTableKey, "false");
      } catch (e) {
        console.error("Error deactivating previous tab live table:", e);
      }
    }

    if (tableDataStore.isLiveTableActive) {
      tableDataStore.stopLiveUpdates();
      tableDataStore.isLiveTableActive = false;
    }

    try {
      const newLiveTableKey = `liveTable.enabled.${newConnectionId}.${newTableName}`;
      const isLiveEnabled = localStorage.getItem(newLiveTableKey) === "true";

      const activeLiveTableKeys = [];
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.startsWith("liveTable.enabled.") && localStorage.getItem(key) === "true") {
          activeLiveTableKeys.push(key);
        }
      }

      if (activeLiveTableKeys.length > 1 || (activeLiveTableKeys.length === 1 && !isLiveEnabled)) {
        activeLiveTableKeys.forEach((key) => {
          if (key !== newLiveTableKey || !isLiveEnabled) {
            localStorage.setItem(key, "false");
          }
        });
      }

      tableDataStore.isLiveTableActive = isLiveEnabled;

      if (tableDataStore.isLiveTableActive) {
        tableDataStore.startLiveUpdates();
      }
    } catch (e) {
      console.error("Error updating live table state during tab switch:", e);
      tableDataStore.isLiveTableActive = false;
    }
  }
});

function handleRefresh() {
  tableDataStore.loadError = null;
  loadRetries.value = 0;
  wasEmptyChecked.value = false;
  safeLoadTableData(true);
}
</script>
