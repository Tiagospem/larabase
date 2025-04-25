import { defineStore } from "pinia";
import { computed, nextTick, ref } from "vue";
import { useDatabaseStore } from "@/store/database";

export const createTableDataStoreId = (connectionId, tableName) => {
  return `tableData-${connectionId}-${tableName}`;
};

export const useTableDataStore = (id) => {
  return defineStore(id, () => {
    const tableData = ref([]);
    const deletingIds = ref([]);
    const isLoading = ref(true);
    const isLiveUpdating = ref(false);
    const highlightChanges = ref(true);
    const previewingRecord = ref(null);
    const loadStartTime = ref(0);
    const totalRecordsCount = ref(0);
    const loadError = ref(null);
    const isLiveTableActive = ref(false);
    const selectedRows = ref([]);
    const filterTerm = ref("");
    const activeFilter = ref("");
    const rowsPerPage = ref(25);
    const currentPage = ref(1);
    const currentSortColumn = ref(null);
    const currentSortDirection = ref("asc");
    const lastSelectedId = ref(null);
    const columnWidths = ref({});
    const columnTypes = ref({});
    const foreignKeyColumns = ref([]);
    const updatedRows = ref([]);
    const liveTableInterval = ref(null);
    const liveUpdateDelaySeconds = ref(3);
    const liveUpdateDelay = ref(3000);
    const previousDataSnapshot = ref([]);
    const updateCounter = ref(0);
    const connectionId = ref(null);
    const tableName = ref(null);
    const onLoad = ref(null);
    const showPreviewModal = ref(false);
    const showDeleteConfirm = ref(false);
    const showEditModal = ref(false);
    const advancedFilterTerm = ref("");
    const lastKnownColumns = ref([]);

    const databaseStore = useDatabaseStore();

    const columns = computed(() => {
      if (tableData.value.length === 0) {
        return lastKnownColumns.value;
      }
      const currentColumns = Object.keys(tableData.value[0]);
      if (currentColumns.length > 0) {
        lastKnownColumns.value = currentColumns;
      }
      return currentColumns;
    });

    const totalRecords = computed(() => {
      return totalRecordsCount.value;
    });

    const paginatedData = computed(() => {
      if (activeFilter.value) {
        return tableData.value;
      }

      if (filterTerm.value) {
        if (rowsPerPage.value === 0) {
          return filteredData.value;
        }

        const start = (currentPage.value - 1) * parseInt(rowsPerPage.value);
        const end = start + parseInt(rowsPerPage.value);

        return filteredData.value.slice(start, end);
      }

      return tableData.value;
    });

    const filteredData = computed(() => {
      if (activeFilter.value) {
        return tableData.value;
      }

      let data = tableData.value;

      if (filterTerm.value) {
        const term = filterTerm.value.toLowerCase();

        data = data.filter((row) => {
          return Object.values(row).some((value) => {
            if (value === null) return false;
            return String(value).toLowerCase().includes(term);
          });
        });
      }

      if (currentSortColumn.value && filterTerm.value) {
        data = [...data].sort((a, b) => {
          const valA = a[currentSortColumn.value];
          const valB = b[currentSortColumn.value];

          if (valA === null && valB === null) return 0;
          if (valA === null) return currentSortDirection.value === "asc" ? -1 : 1;
          if (valB === null) return currentSortDirection.value === "asc" ? 1 : -1;

          if (typeof valA === "number" && typeof valB === "number") {
            return currentSortDirection.value === "asc" ? valA - valB : valB - valA;
          }

          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();

          if (currentSortDirection.value === "asc") {
            return strA.localeCompare(strB);
          } else {
            return strB.localeCompare(strA);
          }
        });
      }

      return data;
    });

    const connectionHost = computed(() => {
      const conn = databaseStore.getConnection(connectionId.value);
      return conn?.host || "";
    });

    const connectionPort = computed(() => {
      const conn = databaseStore.getConnection(connectionId.value);
      return conn?.port || 3306;
    });

    const connectionUsername = computed(() => {
      const conn = databaseStore.getConnection(connectionId.value);
      return conn?.username || "";
    });

    const connectionPassword = computed(() => {
      const conn = databaseStore.getConnection(connectionId.value);
      return conn?.password || "";
    });

    const connectionDatabase = computed(() => {
      const conn = databaseStore.getConnection(connectionId.value);
      return conn?.database || "";
    });

    function setConnectionId(id) {
      connectionId.value = id;
    }

    function setTableName(name) {
      tableName.value = name;
    }

    function setOnLoad(callback) {
      onLoad.value = callback;
    }

    function isForeignKeyColumn(column) {
      return foreignKeyColumns.value.includes(column);
    }

    function updatePreviewData() {
      if (!previewingRecord.value || !previewingRecord.value.id) return;

      const updatedRow = tableData.value.find((row) => row.id === previewingRecord.value.id);

      if (updatedRow) {
        previewingRecord.value = JSON.parse(JSON.stringify(updatedRow));
      }
    }

    function defaultColumnWidth(column) {
      const baseWidth = Math.max(120, column.length * 10);

      if (/^id$/i.test(column)) return `${Math.max(90, column.length * 12)}px`;

      return `${baseWidth}px`;
    }

    function analyzeColumns() {
      if (tableData.value.length === 0 || columns.value.length === 0) return;

      columns.value.forEach((column) => {
        if (columnWidths.value[column]) return;

        const sampleValue = tableData.value.find((row) => row[column] !== null)?.[column];
        if (sampleValue !== undefined) {
          columnTypes.value[column] = typeof sampleValue;

          if (!columnWidths.value[column]) {
            columnWidths.value[column] = defaultColumnWidth(column);
          }
        }
      });
    }

    async function loadForeignKeyInfo() {
      try {
        const structure = await databaseStore.getTableStructure(connectionId.value, tableName.value);
        if (structure && Array.isArray(structure)) {
          foreignKeyColumns.value = structure.filter((col) => col.foreign_key).map((col) => col.name);
        }
      } catch (error) {
        console.error("Error loading foreign key info:", error);
      }
    }

    async function loadTableData() {
      const wasLoading = isLoading.value;

      if (!isLiveUpdating.value) {
        isLoading.value = true;
      }

      if (!loadStartTime.value) {
        loadStartTime.value = Date.now();
      }

      loadError.value = null;

      const selectedRowIds = [];

      if (isLiveTableActive.value && selectedRows.value.length > 0) {
        selectedRows.value.forEach((rowIndex) => {
          const row = paginatedData.value[rowIndex];
          if (row && row.id) {
            selectedRowIds.push(row.id);
          }
        });
      } else {
        selectedRows.value = [];
      }

      try {
        const cacheKey = `${connectionId.value}:${tableName.value}`;
        databaseStore.clearTableCache(cacheKey);

        const sortParams = currentSortColumn.value
          ? {
              sortColumn: currentSortColumn.value,
              sortDirection: currentSortDirection.value
            }
          : {};

        const result = await databaseStore.loadTableData(connectionId.value, tableName.value, rowsPerPage.value, currentPage.value, sortParams);

        if (!result || typeof result !== 'object') {
          console.error("Invalid data response format");
          return Promise.reject(new Error("Invalid data response format"));
        }

        if (!Array.isArray(result.data)) {
          result.data = [];
        }

        tableData.value = result.data || [];
        totalRecordsCount.value = result.totalRecords || 0;

        if (isLiveTableActive.value && selectedRowIds.length > 0) {
          selectedRows.value = [];
          paginatedData.value.forEach((row, index) => {
            if (row && row.id && selectedRowIds.includes(row.id)) {
              selectedRows.value.push(index);
            }
          });

          if (selectedRows.value.length > 0) {
            lastSelectedId.value = selectedRows.value[selectedRows.value.length - 1];
          }
        }

        await nextTick(() => {
          analyzeColumns();
        });

        await loadForeignKeyInfo();

        if (onLoad.value && typeof onLoad.value === 'function') {
          try {
            onLoad.value({
              columns: columns.value,
              rowCount: result.totalRecords || 0
            });
          } catch (e) {
            console.error("Error calling onLoad callback:", e);
          }
        }
      } catch (error) {
        loadError.value = error.message;
        console.error(`Error loading data: ${error.message}`);

        if (tableData.value.length > 0 && tableData.value[0]) {
          lastKnownColumns.value = Object.keys(tableData.value[0]);
        }

        return Promise.reject(error);
      } finally {
        if (Date.now() - loadStartTime.value < 100 && wasLoading === false) {
          isLoading.value = false;
        } else {
          setTimeout(() => {
            isLoading.value = false;
          }, 50);
        }

        loadStartTime.value = 0;
      }

      return Promise.resolve();
    }

    async function loadFilteredData() {
      if (!activeFilter.value && !filterTerm.value) {
        return loadTableData();
      }

      const wasLoading = isLoading.value;

      if (!isLiveUpdating.value) {
        isLoading.value = true;
      }

      loadStartTime.value = Date.now();

      loadError.value = null;
      selectedRows.value = [];

      try {
        let filter = activeFilter.value;

        if (!filter && filterTerm.value) {
          const searchTerm = filterTerm.value.trim();

          if (/^\d+$/.test(searchTerm)) {
            filter = `id = ${searchTerm}`;
          } else {
            const columnsToSearch = columns.value.length > 0 ? columns.value : lastKnownColumns.value;

            if (columnsToSearch.length > 0) {
              const likeFilters = columnsToSearch.map((column) => `${column} LIKE '%${searchTerm.replace(/'/g, "''")}%'`);
              filter = likeFilters.join(" OR ");
            }
          }
        }

        if (!filter) {
          return loadTableData();
        }

        const sortParams = currentSortColumn.value
          ? {
              sortColumn: currentSortColumn.value,
              sortDirection: currentSortDirection.value
            }
          : {};

        const conn = databaseStore.getConnection(connectionId.value);
        if (!conn) {
          throw new Error("Connection not found");
        }

        const payload = {
          host: conn.host,
          port: conn.port,
          username: conn.username,
          password: conn.password,
          database: conn.database,
          tableName: tableName.value,
          filter,
          limit: rowsPerPage.value,
          page: currentPage.value,
          sortColumn: sortParams.sortColumn,
          sortDirection: sortParams.sortDirection
        };

        const result = await window.api.getFilteredTableData(payload);

        if (!result || typeof result !== 'object') {
          console.error("Invalid filtered data response format");
          return Promise.reject(new Error("Invalid filtered data response format"));
        }

        if (!Array.isArray(result.data)) {
          result.data = [];
        }

        tableData.value = result.data || [];
        totalRecordsCount.value = result.totalRecords || 0;

        await nextTick(() => {
          analyzeColumns();
        });

        await loadForeignKeyInfo();

        if (onLoad.value && typeof onLoad.value === 'function') {
          try {
            onLoad.value({
              columns: columns.value,
              rowCount: result.totalRecords || 0
            });
          } catch (e) {
            console.error("Error calling onLoad callback:", e);
          }
        }
      } catch (error) {
        loadError.value = error.message;
        console.error(`Erro to load filtered data: ${error.message}`);
        return Promise.reject(error);
      } finally {
        if (Date.now() - loadStartTime.value < 100 && wasLoading === false) {
          isLoading.value = false;
        } else {
          setTimeout(() => {
            isLoading.value = false;
          }, 50);
        }

        loadStartTime.value = 0;
      }

      return Promise.resolve();
    }

    function updateAppIcon(count) {
      if (window.api && window.api.setAppBadge) {
        window.api.setAppBadge(count);
      }
    }

    function stopLiveUpdates(updateLocalStorage = true) {
      if (liveTableInterval.value !== null) {
        clearInterval(liveTableInterval.value);
        liveTableInterval.value = null;
      }

      isLiveTableActive.value = false;

      if (updateLocalStorage) {
        try {
          localStorage.setItem(`liveTable.enabled.${connectionId.value}.${tableName.value}`, "false");
        } catch (e) {
          console.error("Failed to update localStorage during live table stop", e);
        }
      }
    }

    function detectChangedRows() {
      updatedRows.value = [];

      if (!previousDataSnapshot.value.length) return;

      let changesDetected = 0;

      paginatedData.value.forEach((currentRow, index) => {
        const previousRow = previousDataSnapshot.value.find((row) => {
          if (row.id !== undefined && currentRow.id !== undefined) {
            return row.id === currentRow.id;
          }
          return false;
        });

        if (!previousRow || JSON.stringify(currentRow) !== JSON.stringify(previousRow)) {
          updatedRows.value.push(index);
          changesDetected++;
        }
      });

      if (changesDetected > 0) {
        updateCounter.value += changesDetected;
        updateAppIcon(updateCounter.value);
      }

      if (updatedRows.value.length > 0) {
        setTimeout(() => {
          updatedRows.value = [];
        }, 2000);
      }
    }

    function deactivateAllOtherLiveTables() {
      try {
        const allKeys = Object.keys(localStorage);
        const currentLiveTableKey = `liveTable.enabled.${connectionId.value}.${tableName.value}`;

        const activeLiveTableKeys = allKeys.filter((key) => key.startsWith("liveTable.enabled.") && key !== currentLiveTableKey && localStorage.getItem(key) === "true");

        if (activeLiveTableKeys.length > 0) {
          activeLiveTableKeys.forEach((key) => {
            localStorage.setItem(key, "false");
          });
        }
      } catch (e) {
        console.error("Failed to deactivate other live tables", e);
      }
    }

    function resetData() {
      tableData.value = [];
      selectedRows.value = [];
      updatedRows.value = [];
      previousDataSnapshot.value = [];
      updateCounter.value = 0;
    }

    function startLiveUpdates() {
      stopLiveUpdates();

      isLiveTableActive.value = true;

      try {
        localStorage.setItem(`liveTable.enabled.${connectionId.value}.${tableName.value}`, "true");

        deactivateAllOtherLiveTables();
      } catch (e) {
        console.error("Failed to update localStorage during live table start", e);
      }

      previousDataSnapshot.value = JSON.parse(JSON.stringify(tableData.value));

      liveTableInterval.value = setInterval(() => {
        if (!isLoading.value) {
          loadStartTime.value = Date.now();
          isLiveUpdating.value = true;

          loadTableData()
            .then(() => {
              if (highlightChanges.value) {
                detectChangedRows();
              }

              if (showPreviewModal.value && previewingRecord.value) {
                updatePreviewData();
              }

              previousDataSnapshot.value = JSON.parse(JSON.stringify(tableData.value));
            })
            .catch((error) => {
              console.error("Error during live update:", error);
            })
            .finally(() => {
              isLiveUpdating.value = false;
            });
        }
      }, liveUpdateDelay.value);
    }

    function deleteSelected() {
      if (selectedRows.value.length === 0) return;

      deletingIds.value = selectedRows.value.map((index) => {
        const id = paginatedData.value[index].id;

        return typeof id === "object" ? String(id) : id;
      });

      showDeleteConfirm.value = true;
    }

    return {
      loadTableData,
      loadFilteredData,
      updateAppIcon,
      defaultColumnWidth,
      isForeignKeyColumn,
      startLiveUpdates,
      stopLiveUpdates,
      setConnectionId,
      setTableName,
      setOnLoad,
      deleteSelected,
      resetData,
      onLoad,
      tableData,
      filteredData,
      isLiveUpdating,
      highlightChanges,
      previewingRecord,
      loadStartTime,
      totalRecordsCount,
      loadError,
      isLiveTableActive,
      selectedRows,
      paginatedData,
      filterTerm,
      activeFilter,
      rowsPerPage,
      currentPage,
      currentSortColumn,
      currentSortDirection,
      lastSelectedId,
      columns,
      columnWidths,
      updatedRows,
      liveTableInterval,
      liveUpdateDelaySeconds,
      liveUpdateDelay,
      previousDataSnapshot,
      updateCounter,
      showPreviewModal,
      isLoading,
      connectionId,
      tableName,
      totalRecords,
      deletingIds,
      showDeleteConfirm,
      showEditModal,
      advancedFilterTerm,
      lastKnownColumns,
      connectionHost,
      connectionPort,
      connectionUsername,
      connectionPassword,
      connectionDatabase
    };
  })();
};
