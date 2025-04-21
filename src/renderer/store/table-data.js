import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import { useDatabaseStore } from '@/store/database';

export const createTableDataStoreId = (connectionId, tableName) => {
  return `tableData-${connectionId}-${tableName}`;
};

export const useTableDataStore = id => {
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
    const filterTerm = ref('');
    const activeFilter = ref('');
    const rowsPerPage = ref(25);
    const currentPage = ref(1);
    const currentSortColumn = ref(null);
    const currentSortDirection = ref('asc');
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
    const advancedFilterTerm = ref('');

    const databaseStore = useDatabaseStore();

    const columns = computed(() => {
      if (tableData.value.length === 0) {
        return [];
      }
      return Object.keys(tableData.value[0]);
    });

    const totalRecords = computed(() => {
      if (filterTerm.value || activeFilter.value) {
        return filteredData.value.length;
      }
      return totalRecordsCount.value;
    });

    const paginatedData = computed(() => {
      if (filterTerm.value || activeFilter.value) {
        if (rowsPerPage.value === 0) {
          return filteredData.value;
        }

        const start = (currentPage.value - 1) * parseInt(rowsPerPage.value);
        const end = start + parseInt(rowsPerPage.value);

        return filteredData.value.slice(start, end);
      } else {
        return tableData.value;
      }
    });

    const filteredData = computed(() => {
      let data = tableData.value;

      if (activeFilter.value) {
        try {
          data = applySqlFilter(data, activeFilter.value);
        } catch (error) {
          console.error('Error applying SQL filter:', error);
        }
      }

      if (filterTerm.value) {
        const term = filterTerm.value.toLowerCase();
        data = data.filter(row => {
          return Object.values(row).some(value => {
            if (value === null) return false;
            return String(value).toLowerCase().includes(term);
          });
        });
      }

      if (currentSortColumn.value && (activeFilter.value || filterTerm.value)) {
        data = [...data].sort((a, b) => {
          const valA = a[currentSortColumn.value];
          const valB = b[currentSortColumn.value];

          if (valA === null && valB === null) return 0;
          if (valA === null) return currentSortDirection.value === 'asc' ? -1 : 1;
          if (valB === null) return currentSortDirection.value === 'asc' ? 1 : -1;

          if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSortDirection.value === 'asc' ? valA - valB : valB - valA;
          }

          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();

          if (currentSortDirection.value === 'asc') {
            return strA.localeCompare(strB);
          } else {
            return strB.localeCompare(strA);
          }
        });
      }

      return data;
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

      const updatedRow = tableData.value.find(row => row.id === previewingRecord.value.id);

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

      columns.value.forEach(column => {
        if (columnWidths.value[column]) return;

        const sampleValue = tableData.value.find(row => row[column] !== null)?.[column];
        if (sampleValue !== undefined) {
          columnTypes.value[column] = typeof sampleValue;

          if (!columnWidths.value[column]) {
            columnWidths.value[column] = defaultColumnWidth(column);
          }
        }
      });
    }

    function convertFilterToJs(filter) {
      if (!filter) return 'true';

      try {
        const idEqualityRegex = /^\s*id\s*=\s*(\d+)\s*$/i;
        const idMatch = filter.match(idEqualityRegex);

        if (idMatch) {
          const idValue = parseInt(idMatch[1], 10);
          if (!isNaN(idValue)) {
            return `row['id'] == ${idValue} || String(row['id']) == '${idValue}'`;
          }
        }

        const likeMatcher = /^\s*(\w+)\s+LIKE\s+['"](.*)['"]$/i;
        const likeMatch = filter.match(likeMatcher);

        if (likeMatch) {
          const [_, column, pattern] = likeMatch;
          const cleanPattern = pattern.replace(/%/g, '');
          return `row['${column}'] != null && String(row['${column}'] || '').toLowerCase().includes('${cleanPattern.toLowerCase()}')`;
        }

        const simpleEqualityRegex = /^\s*(\w+)\s*=\s*(\d+|\w+|'[^']*'|"[^"]*")\s*$/i;
        const simpleMatch = filter.match(simpleEqualityRegex);

        if (simpleMatch) {
          const [_, column, value] = simpleMatch;

          if (value.startsWith("'") || value.startsWith('"')) {
            const strValue = value.substring(1, value.length - 1);
            return `row['${column}'] === '${strValue}'`;
          } else if (!isNaN(Number(value))) {
            const numValue = Number(value);
            return `row['${column}'] == ${numValue} || String(row['${column}']) == '${numValue}'`;
          } else {
            return `row['${column}'] === row['${value}']`;
          }
        }

        if (filter.toLowerCase().match(/^where\s+/)) {
          filter = filter.replace(/^where\s+/i, '');
        }

        const stringLiterals = [];

        let stringReplacedFilter = filter.replace(/'([^']*)'/g, (match, content) => {
          const placeholder = `__STRING_${stringLiterals.length}__`;
          stringLiterals.push(match);
          return placeholder;
        });

        stringReplacedFilter = stringReplacedFilter.replace(
          /(\w+)\s+LIKE\s+(__STRING_\d+__)/gi,
          (match, column, placeholder) => {
            const placeholderIndex = parseInt(placeholder.match(/__STRING_(\d+)__/)[1]);
            const originalStr = stringLiterals[placeholderIndex].substring(
              1,
              stringLiterals[placeholderIndex].length - 1
            );
            const cleanPattern = originalStr.replace(/%/g, '');

            return `(row['${column}'] != null && String(row['${column}'] || '').toLowerCase().includes('${cleanPattern.toLowerCase()}'))`;
          }
        );

        stringReplacedFilter = stringReplacedFilter
          .replace(/([<>!=]+)/g, ' $1 ')
          .replace(/\s+/g, ' ');

        const inRegex = /(\w+|\[\w+\])\s+IN\s*\(\s*([^)]+)\s*\)/gi;
        stringReplacedFilter = stringReplacedFilter.replace(inRegex, (match, col, values) => {
          return `[${values}].includes(row['${col}'])`;
        });

        stringReplacedFilter = stringReplacedFilter
          .replace(/\bAND\b/gi, ' && ')
          .replace(/\bOR\b/gi, ' || ')
          .replace(/\bNOT\b/gi, '!')
          .replace(/\bIS NULL\b/gi, '=== null')
          .replace(/\bIS NOT NULL\b/gi, '!== null')
          .replace(/\s+=\s+/g, ' == ');

        const keywords = [
          'AND',
          'OR',
          'NOT',
          'NULL',
          'IN',
          'LIKE',
          'BETWEEN',
          'IS',
          'AS',
          'TRUE',
          'FALSE',
          'true',
          'false',
          'null',
          'undefined',
          'return',
          'if',
          'else',
          'for',
          'while',
          'function'
        ];

        stringReplacedFilter = stringReplacedFilter.replace(
          /\b([a-zA-Z_]\w*)\b(?!\s*\()/g,
          (match, column) => {
            if (match.startsWith('__STRING_')) {
              return match;
            }

            if (keywords.includes(match) || keywords.includes(match.toUpperCase())) {
              return match.toUpperCase();
            }

            if (!isNaN(Number(match))) {
              return match;
            }

            return `row['${column}']`;
          }
        );

        stringLiterals.forEach((str, index) => {
          const placeholder = `__STRING_${index}__`;
          const cleanStr = str.substring(1, str.length - 1).replace(/'/g, "\\'");

          stringReplacedFilter = stringReplacedFilter.replace(placeholder, `'${cleanStr}'`);
        });

        stringReplacedFilter = stringReplacedFilter.trim();

        return stringReplacedFilter;
      } catch (e) {
        console.error('Error converting SQL filter to JS:', e, 'Original filter:', filter);
        return 'true';
      }
    }

    function applySqlFilter(data, filter) {
      if (!filter || !data || data.length === 0) return data;

      const cleanFilter = filter.trim();

      if (!cleanFilter) return data;

      try {
        const filterCode = convertFilterToJs(cleanFilter);

        const dataCopy = JSON.parse(JSON.stringify(data));

        let filterFn;
        try {
          filterFn = new Function(
            'row',
            `
                    try {
                      return ${filterCode};
                    } catch (e) {
                      console.error('Execution Error:', e);
                      return false;
                    }`
          );
        } catch (e) {
          console.error('Error to create function filter:', e);

          return data;
        }

        return dataCopy.filter(row => {
          try {
            return filterFn(row);
          } catch (e) {
            console.error('Error to apply filter:', e, row);
            return false;
          }
        });
      } catch (error) {
        console.error('Error SQL filter:', error, filter);
        return data;
      }
    }

    async function loadForeignKeyInfo() {
      try {
        const structure = await databaseStore.getTableStructure(
          connectionId.value,
          tableName.value
        );
        if (structure && Array.isArray(structure)) {
          foreignKeyColumns.value = structure.filter(col => col.foreign_key).map(col => col.name);
        }
      } catch (error) {
        console.error('Error loading foreign key info:', error);
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

      const loadingTimer = setTimeout(() => {
        if (isLoading.value) {
        }
      }, 100);

      loadError.value = null;

      const selectedRowIds = [];

      if (isLiveTableActive.value && selectedRows.value.length > 0) {
        selectedRows.value.forEach(rowIndex => {
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

        const result = await databaseStore.loadTableData(
          connectionId.value,
          tableName.value,
          rowsPerPage.value,
          currentPage.value,
          sortParams
        );

        if (!result.data || result.data.length === 0) {
          console.error('No data found for this page');
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

        onLoad.value({
          columns: columns.value,
          rowCount: result.totalRecords || 0
        });
      } catch (error) {
        loadError.value = error.message;
        console.error(`Error loading data: ${error.message}`);
        tableData.value = [];
        totalRecordsCount.value = 0;
      } finally {
        clearTimeout(loadingTimer);

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

    function stopLiveUpdates(updateLocalStorage = false) {
      if (liveTableInterval.value !== null) {
        clearInterval(liveTableInterval.value);
        liveTableInterval.value = null;
      }

      isLiveTableActive.value = false;

      if (updateLocalStorage) {
        try {
          localStorage.setItem(
            `liveTable.enabled.${connectionId.value}.${tableName.value}`,
            'false'
          );
        } catch (e) {
          console.error('Failed to update localStorage during live table stop', e);
        }
      }
    }

    function detectChangedRows() {
      updatedRows.value = [];

      if (!previousDataSnapshot.value.length) return;

      let changesDetected = 0;

      paginatedData.value.forEach((currentRow, index) => {
        const previousRow = previousDataSnapshot.value.find(row => {
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

        const activeLiveTableKeys = allKeys.filter(
          key =>
            key.startsWith('liveTable.enabled.') &&
            key !== currentLiveTableKey &&
            localStorage.getItem(key) === 'true'
        );

        if (activeLiveTableKeys.length > 0) {
          activeLiveTableKeys.forEach(key => {
            localStorage.setItem(key, 'false');
          });
        }
      } catch (e) {
        console.error('Failed to deactivate other live tables', e);
      }
    }

    function startLiveUpdates() {
      stopLiveUpdates();

      isLiveTableActive.value = true;

      try {
        localStorage.setItem(`liveTable.enabled.${connectionId.value}.${tableName.value}`, 'true');

        deactivateAllOtherLiveTables();
      } catch (e) {
        console.error('Failed to update localStorage during live table start', e);
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
            .catch(error => {
              console.error('Error during live update:', error);
            })
            .finally(() => {
              isLiveUpdating.value = false;
            });
        }
      }, liveUpdateDelay.value);
    }

    function deleteSelected() {
      if (selectedRows.value.length === 0) return;

      deletingIds.value = selectedRows.value.map(index => {
        const id = paginatedData.value[index].id;

        return typeof id === 'object' ? String(id) : id;
      });

      showDeleteConfirm.value = true;
    }

    return {
      loadTableData,
      updateAppIcon,
      updatePreviewData,
      defaultColumnWidth,
      isForeignKeyColumn,
      startLiveUpdates,
      stopLiveUpdates,
      setConnectionId,
      setTableName,
      setOnLoad,
      deleteSelected,
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
      advancedFilterTerm
    };
  })();
};
