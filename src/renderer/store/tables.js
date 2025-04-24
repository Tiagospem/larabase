import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useDatabaseStore } from "@/store/database";

export const useTablesStore = defineStore("tables", () => {
  const localTables = ref([]);
  const isLoadingCounts = ref(false);
  const allTablesLoaded = ref(false);
  const loadingTimer = ref(null);
  const databaseStore = useDatabaseStore();

  // Table sorting and filtering
  const searchTerm = ref("");
  const sortBy = ref(localStorage.getItem("tableSort") || "name");
  const sortOrder = ref(localStorage.getItem("tableSortOrder") || "asc");

  // Computed properties
  const tables = computed(() => localTables.value);

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

  // Methods
  function setSearchTerm(connectionId, term) {
    searchTerm.value = term;
    localStorage.setItem(`tableSearch_${connectionId}`, term);
  }

  function clearSearch() {
    searchTerm.value = "";
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

  async function loadTableRecordCounts(connectionId) {
    if (isLoadingCounts.value) return;

    isLoadingCounts.value = true;
    allTablesLoaded.value = false;

    if (loadingTimer.value) {
      clearTimeout(loadingTimer.value);
      loadingTimer.value = null;
    }

    try {
      const updatedTables = [...localTables.value];

      const promises = updatedTables.map(async (table, i) => {
        try {
          if (table.recordCount === null || table.recordCount === undefined) {
            return {
              index: i,
              count: await databaseStore.getTableRecordCount(connectionId, table.name)
            };
          }
          return { index: i, count: table.recordCount };
        } catch {
          return { index: i, count: 0 };
        }
      });

      const results = await Promise.all(promises);

      results.forEach(({ index, count }) => {
        updatedTables[index].recordCount = count;
      });

      localTables.value = updatedTables;

      allTablesLoaded.value = true;
    } catch (error) {
      console.error("Error loading record counts:", error);
    } finally {
      isLoadingCounts.value = false;
    }
  }

  function initializeTables(connectionId) {
    allTablesLoaded.value = false;
    localTables.value = databaseStore.tablesList.map((t) => ({ ...t, recordCount: null }));

    loadingTimer.value = setTimeout(() => {
      loadTableRecordCounts(connectionId);
    }, 500);
  }

  return {
    // State
    localTables,
    isLoadingCounts,
    allTablesLoaded,
    searchTerm,
    sortBy,
    sortOrder,
    
    // Computed
    tables,
    filteredTables,
    sortedTables,
    
    // Methods
    setSearchTerm,
    clearSearch,
    setSortBy,
    toggleSortOrder,
    formatRecordCount,
    loadTableRecordCounts,
    initializeTables
  };
}); 