<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <RefreshButton :store-id="storeId" />
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

    <div class="flex-1 overflow-auto">
      <LoadingState v-if="isLoading" />
      <ErrorState
        v-else-if="loadError"
        :message="tableDataStore.loadError"
        @retry="tableDataStore.loadTableData()"
      />
      <EmptyFilterState
        v-else-if="isFilteredEmpty"
        @clear="filterButtonRef.clearFilters()"
        @reload="tableDataStore.loadTableData()"
      />
      <DataTable
        v-else-if="hasData"
        ref="dataTableRef"
        :store-id="storeId"
        @load-filtered-data="tableDataStore.loadFilteredData()"
        @navigate-to-foreign-key="(column, row) => navigateToForeignKey(column, row)"
      />
      <NoRecordState
        v-else
        @reload="tableDataStore.loadTableData()"
      />
    </div>

    <PaginatorBar
      v-if="hasData"
      :store-id="storeId"
      @scroll-to-top="dataTableRef.scrollToTop()"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from "vue";

import {
  RefreshButton,
  LiveTableButton,
  TruncateButton,
  DeleteButton,
  FilterButton,
  LoadingState,
  ErrorState,
  EmptyFilterState,
  DataTable,
  NoRecordState,
  PaginatorBar
} from "@/components/tabs/partials";

import { Helpers } from "../../utils/helpers";

import { useTableDataStore, createTableDataStoreId } from "@/store/table-data";
import { useDatabaseStore } from "@/store/database";

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

const showAlert = inject("showAlert");

const isLoading = computed(() => tableDataStore.isLoading && !tableDataStore.isLiveUpdating);
const loadError = computed(() => !!tableDataStore.loadError);
const isFilteredEmpty = computed(() => (tableDataStore.filterTerm || tableDataStore.activeFilter) && tableDataStore.filteredData.length === 0);
const hasData = computed(() => tableDataStore.tableData.length > 0);
const highlightChanges = computed(() => tableDataStore.highlightChanges);

const filterButtonRef = ref(null);
const dataTableRef = ref(null);

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

onMounted(() => {
  window.addEventListener("tab-activated", handleTabActivation);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("focus", handleWindowFocus);

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
});

onUnmounted(() => {
  window.removeEventListener("tab-activated", handleTabActivation);
  window.removeEventListener("storage", handleStorageChange);
  window.removeEventListener("focus", handleWindowFocus);

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
</script>
