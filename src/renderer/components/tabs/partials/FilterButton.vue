<template>
  <div class="relative flex items-center gap-2">
    <div class="input-group">
      <input
        v-model="tableDataStore.filterTerm"
        type="text"
        placeholder="Filter..."
        class="input input-sm input-bordered bg-base-300 w-full sm:w-64"
        @keyup.enter="applyFilter"
      />
      <button
        class="btn btn-sm"
        :class="{
          'bg-base-300 border-base-300': !tableDataStore.activeFilter && !tableDataStore.filterTerm,
          'bg-primary border-primary text-white': tableDataStore.activeFilter || tableDataStore.filterTerm
        }"
        @click="toggleAdvancedFilter"
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
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
          />
        </svg>
      </button>
    </div>
    <button
      v-if="tableDataStore.filterTerm || tableDataStore.activeFilter"
      class="btn btn-sm btn-primary"
      @click="clearFilters"
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
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <div
    class="modal z-50"
    :class="{ 'modal-open': showFilterModal }"
  >
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
        Advanced Filter
        <button
          class="btn btn-sm btn-circle"
          @click="showFilterModal = false"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </h3>

      <div class="mb-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-medium">SQL WHERE Clause</span>
          </label>
          <textarea
            v-model="tableDataStore.advancedFilterTerm"
            class="textarea textarea-bordered h-32 font-mono"
            placeholder="id = 1"
          />
          <label class="label">
            <span class="label-text-alt text-xs">
              Examples:
              <code
                class="bg-base-300 p-1 cursor-pointer"
                @click="setExampleFilter('id = 2')"
                >id = 2</code
              >,
              <code
                class="bg-base-300 p-1 cursor-pointer"
                @click="setExampleFilter('email LIKE \'%example%\'')"
                >email LIKE '%example%'</code
              >,
              <code
                class="bg-base-300 p-1 cursor-pointer"
                @click="setExampleFilter('created_at IS NOT NULL')"
                >created_at IS NOT NULL</code
              >,
              <code
                class="bg-base-300 p-1 cursor-pointer"
                @click="setExampleFilter('id > 10 AND id < 20')"
                >id > 10 AND id < 20</code
              >
            </span>
          </label>
        </div>

        <div class="mt-2 text-xs">
          <p class="mb-2">Available columns:</p>
          <div class="flex flex-wrap gap-1 mb-4">
            <span
              v-for="column in tableDataStore.columns"
              :key="column"
              class="badge badge-primary cursor-pointer"
              @click="insertColumnName(column)"
            >
              {{ column }}
            </span>
          </div>

          <p class="mb-2">Common operators:</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="op in ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN', 'AND', 'OR']"
              :key="op"
              class="badge badge-secondary cursor-pointer"
              @click="insertOperator(op)"
            >
              {{ op }}
            </span>
          </div>
        </div>
      </div>

      <div class="form-control mb-4">
        <label class="label cursor-pointer justify-start">
          <input
            v-model="persistFilter"
            type="checkbox"
            class="checkbox checkbox-primary"
          />
          <span class="label-text ml-2">Persist filter (remember after reload)</span>
        </label>
      </div>

      <div class="modal-action">
        <button
          class="btn btn-error"
          @click="cancelAdvancedFilter"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="applyAdvancedFilter"
        >
          Apply Filter
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="showFilterModal = false"
    />
  </div>

  <select
    v-model="tableDataStore.rowsPerPage"
    class="select select-sm select-bordered bg-base-300 w-24 sm:w-32"
  >
    <option value="10">10 rows</option>
    <option value="25">25 rows</option>
    <option value="50">50 rows</option>
    <option value="100">100 rows</option>
  </select>
</template>

<script setup>
import { useTableDataStore } from "@/store/table-data";
import { inject, ref } from "vue";
import { useDatabaseStore } from "@/store/database";

const showAlert = inject("showAlert");

const showFilterModal = ref(false);
const persistFilter = ref(true);
const originalFilterTerm = ref("");

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const databaseStore = useDatabaseStore();
const tableDataStore = useTableDataStore(props.storeId);

async function applyAdvancedFilter() {
  tableDataStore.activeFilter = tableDataStore.advancedFilterTerm;

  if (persistFilter.value && tableDataStore.activeFilter) {
    localStorage.setItem(
      `filter:${tableDataStore.connectionId}:${tableDataStore.tableName}`,
      JSON.stringify({
        active: true,
        value: tableDataStore.activeFilter
      })
    );
  }

  showFilterModal.value = false;

  tableDataStore.currentPage = 1;

  const useServerFilter = shouldUseServerFilter(tableDataStore.activeFilter);

  if (useServerFilter) {
    try {
      await loadFilteredData();
    } catch (error) {
      console.error("Error to get filtered data:", error);
      showAlert(`Error to apply filter: ${error.message}`, "error");
    }
  }
}

function shouldUseServerFilter(filter) {
  if (!filter) return false;

  const cleanFilter = filter.trim();
  if (!cleanFilter) return false;

  const idMatch = cleanFilter.match(/^\s*id\s*=\s*(\d+)\s*$/i);
  if (idMatch) {
    const idValue = parseInt(idMatch[1], 10);
    if (!isNaN(idValue)) {
      return true;
    }
  }

  if (/\bLIKE\b/i.test(cleanFilter)) {
    return true;
  }

  if (/\bAND\b|\bOR\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b/i.test(cleanFilter)) {
    return true;
  }

  return /^\s*\w+_id\s*=\s*\d+\s*$/i.test(cleanFilter);
}

function toggleAdvancedFilter() {
  originalFilterTerm.value = tableDataStore.advancedFilterTerm;
  showFilterModal.value = true;
}

function insertColumnName(column) {
  tableDataStore.advancedFilterTerm += column + " ";
}

function insertOperator(op) {
  tableDataStore.advancedFilterTerm += " " + op + " ";
}

function cancelAdvancedFilter() {
  tableDataStore.advancedFilterTerm = originalFilterTerm.value;
  showFilterModal.value = false;
}

function clearFilters() {
  const hadActiveFilter = tableDataStore.activeFilter || tableDataStore.filterTerm;

  tableDataStore.filterTerm = "";
  tableDataStore.advancedFilterTerm = "";
  tableDataStore.activeFilter = "";

  localStorage.removeItem(`filter:${tableDataStore.connectionId}:${tableDataStore.tableName}`);

  const url = new URL(window.location.href);

  url.searchParams.delete("filter");
  window.history.replaceState({}, "", url.toString());

  if (hadActiveFilter) {
    tableDataStore.currentPage = 1;
    tableDataStore.loadTableData();
  }
}

async function loadFilteredData() {
  if (!tableDataStore.activeFilter) {
    return tableDataStore.loadTableData();
  }

  tableDataStore.isLoading = true;
  tableDataStore.loadError = null;
  tableDataStore.selectedRows = [];

  try {
    const sortParams = tableDataStore.currentSortColumn
      ? {
          sortColumn: tableDataStore.currentSortColumn,
          sortDirection: tableDataStore.currentSortDirection
        }
      : {};

    const result = await databaseStore.loadFilteredTableData(
      tableDataStore.connectionId,
      tableDataStore.tableName,
      tableDataStore.activeFilter,
      tableDataStore.rowsPerPage,
      tableDataStore.currentPage,
      sortParams
    );

    if (!result.data || result.data.length === 0) {
      if (result.totalRecords > 0) {
        showAlert(`No records found on page ${tableDataStore.currentPage}. Total: ${result.totalRecords}`, "info");
      } else {
        showAlert("No records match the applied filter", "info");
      }
    } else {
      showAlert(`Found ${result.totalRecords} record(s) matching the filter`, "success");
    }

    // Keep previous data structure if new data is empty
    if (result.data && result.data.length > 0) {
      tableDataStore.tableData = result.data;
    } else {
      // If no records match the filter, preserve the column structure
      // but clear the row data
      const previousData = tableDataStore.tableData;
      if (previousData.length > 0) {
        // Create an empty version of the first row to maintain structure
        const emptyRow = Object.fromEntries(
          Object.keys(previousData[0]).map(key => [key, null])
        );
        // Set empty data but with structure preserved
        tableDataStore.tableData = [emptyRow];
        // Then immediately clear it to show empty state
        setTimeout(() => {
          tableDataStore.tableData = [];
        }, 0);
      } else {
        tableDataStore.tableData = [];
      }
    }

    tableDataStore.totalRecordsCount = result.totalRecords || 0;

    tableDataStore.onLoad({
      columns: tableDataStore.columns,
      rowCount: result.totalRecords || 0
    });
  } catch (error) {
    console.error("Error applying filter:", error);
    tableDataStore.loadError = error.message;
    showAlert(`Error applying filter: ${error.message}`, "error");
    tableDataStore.tableData = [];
    tableDataStore.totalRecordsCount = 0;
  } finally {
    tableDataStore.isLoading = false;
  }
}

function setExampleFilter(example) {
  tableDataStore.advancedFilterTerm = example;

  applyAdvancedFilter();
}

function applyFilter() {
  tableDataStore.currentPage = 1;
}

defineExpose({ loadFilteredData, clearFilters });
</script>
