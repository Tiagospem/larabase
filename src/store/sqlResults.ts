import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TableColumn } from '@/types/table';

export interface SqlResultRow {
  id: string | number;
  [key: string]: any;
}

export interface ResultSetHeader {
  fieldCount: number;
  affectedRows: number;
  insertId: number;
  info: string;
  serverStatus: number;
  warningStatus: number;
  changedRows: number;
  [key: string]: any;
}

export const useSqlResultsStore = defineStore('sqlResults', () => {
  const results = ref<any[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const affectedRows = ref<number | null>(null);
  const lastQuery = ref<string>('');
  const lastQueryTime = ref<number | null>(null);
  const success = ref(false);

  const columns = computed<TableColumn[]>(() => {
    if (results.value.length === 0) {
      return [];
    }

    const firstRow = results.value[0];
    return Object.keys(firstRow).map(key => ({
      field: key,
      width: 150,
    }));
  });

  const tableData = computed<SqlResultRow[]>(() => {
    return results.value.map((row, index) => {
      if (row.id === undefined) {
        return { id: `row-${index}`, ...row };
      }
      return row;
    });
  });

  function setResults(data: any[] | ResultSetHeader, query: string) {
    if (data && typeof data === 'object' && !Array.isArray(data) && 'affectedRows' in data) {
      results.value = [data];
      affectedRows.value = data.affectedRows;
    } else {
      results.value = Array.isArray(data) ? data : [];
      affectedRows.value = Array.isArray(data) ? data.length : null;
    }

    lastQuery.value = query;
    error.value = null;
    success.value = true;
  }

  function setError(errorMessage: string) {
    error.value = errorMessage;
    results.value = [];
    affectedRows.value = null;
    lastQueryTime.value = null;
    success.value = false;
  }

  function clearResults() {
    results.value = [];
    error.value = null;
    affectedRows.value = null;
    lastQuery.value = '';
    lastQueryTime.value = null;
    success.value = false;
  }

  return {
    results,
    columns,
    tableData,
    isLoading,
    error,
    affectedRows,
    lastQuery,
    lastQueryTime,
    success,
    setResults,
    setError,
    clearResults,
  };
});
