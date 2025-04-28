import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useDatabaseStore } from "@/store/database";

export const useTablesStore = defineStore("tables", () => {
  const databaseStore = useDatabaseStore();
  const lastLoadedConnection = ref(null);

  const searchTerm = ref("");
  const sortBy = ref(localStorage.getItem("tableSort") || "name");
  const sortOrder = ref(localStorage.getItem("tableSortOrder") || "asc");

  const localTables = computed(() => databaseStore.tablesList || []);
  const isLoading = computed(() => databaseStore.isLoading);
  const allTablesLoaded = computed(() => !isLoading.value);

  const filteredTables = computed(() => {
    if (!searchTerm.value) return localTables.value;
    const term = searchTerm.value.toLowerCase();
    return localTables.value.filter((table) => table.name.toLowerCase().includes(term));
  });

  const sortedTables = computed(() => {
    const tablesCopy = [...filteredTables.value];

    return tablesCopy.sort((a, b) => {
      if (sortBy.value === "name") {
        return sortOrder.value === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        const aCount = a.rowCount || 0;
        const bCount = b.rowCount || 0;
        return sortOrder.value === "asc" ? aCount - bCount : bCount - aCount;
      }
    });
  });

  function setSearchTerm(connectionId, term) {
    searchTerm.value = term;
    localStorage.setItem(`tableSearch_${connectionId}`, term);
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

  async function initializeTables(connectionId) {
    if (connectionId === lastLoadedConnection.value && !isLoading.value) {
      return;
    }

    lastLoadedConnection.value = connectionId;
    return databaseStore.loadTables(connectionId);
  }

  function updateTableRecordCount(tableName, count) {
    if (!tableName) return;

    const table = databaseStore.tablesList.find((t) => t.name === tableName);
    if (table) {
      table.rowCount = count;
    }
  }

  return {
    localTables,
    lastLoadedConnection,
    searchTerm,
    sortBy,
    sortOrder,
    isLoading,
    allTablesLoaded,
    filteredTables,
    sortedTables,
    setSearchTerm,
    setSortBy,
    toggleSortOrder,
    formatRecordCount,
    initializeTables,
    updateTableRecordCount
  };
});
