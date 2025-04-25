<template>
  <div
    class="modal z-50"
    :class="{ 'modal-open': show }"
  >
    <div class="modal-box bg-base-300 max-w-lg relative">
      <!-- Loading overlay -->
      <div
        v-if="isExporting"
        class="absolute inset-0 bg-base-100 bg-opacity-80 flex flex-col items-center justify-center z-10"
      >
        <svg
          class="animate-spin h-10 w-10 text-primary mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-primary font-semibold">Exporting data...</p>
      </div>

      <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
        Export Data
        <button
          class="btn btn-sm btn-circle"
          @click="$emit('close')"
          :disabled="isExporting"
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
        <fieldset class="fieldset">
          <label class="label">
            <span class="label-text font-medium">Export Format</span>
          </label>
          <select
            v-model="exportFormat"
            class="select select-bordered w-full"
            :disabled="isExporting"
          >
            <option value="csv">CSV (Comma Separated Values)</option>
            <option value="json">JSON (JavaScript Object Notation)</option>
            <option value="sql">SQL (INSERT Statements)</option>
            <option value="excel">Excel (.xlsx)</option>
          </select>
        </fieldset>
      </div>

      <div class="mb-4">
        <fieldset class="fieldset">
          <label class="label cursor-pointer justify-start">
            <input
              v-model="includeHeaders"
              type="checkbox"
              class="checkbox checkbox-primary"
              :disabled="exportFormat === 'sql' || isExporting"
            />
            <span class="label-text ml-2">Include headers</span>
          </label>
        </fieldset>

        <fieldset class="fieldset">
          <label class="label cursor-pointer justify-start">
            <input
              v-model="exportAllRecords"
              type="checkbox"
              class="checkbox checkbox-primary"
              :disabled="isExporting"
            />
            <span class="label-text ml-2">Export all records (uncheck to export only current page)</span>
          </label>
        </fieldset>
      </div>

      <div class="bg-base-200 p-3 rounded-md mb-4">
        <p class="text-sm">
          <span class="font-semibold">Data to export:</span>
          {{ isFiltered ? "Filtered data" : "All data" }}
          ({{ totalRecords }} records{{ !exportAllRecords ? " - current page only" : "" }})
        </p>
      </div>

      <div class="modal-action">
        <button
          class="btn btn-ghost"
          @click="$emit('close')"
          :disabled="isExporting"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="exportData"
          :disabled="isExporting"
        >
          Export
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="$emit('close')"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useTableDataStore } from "@/store/table-data";

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  storeId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["close"]);

const tableDataStore = useTableDataStore(props.storeId);
const isExporting = ref(false);
const exportFormat = ref("csv");
const includeHeaders = ref(true);
const exportAllRecords = ref(true);

const isFiltered = computed(() => tableDataStore.filterTerm || tableDataStore.activeFilter);

const totalRecords = computed(() => tableDataStore.totalRecords);

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportData() {
  isExporting.value = true;

  try {
    let data = [];

    // Get the data to export - either filtered or all data
    if (exportAllRecords.value) {
      // Need to fetch all records
      if (isFiltered.value) {
        // Fetch all filtered records
        data = await fetchAllFilteredData();
      } else {
        // Fetch all records from the table
        data = await fetchAllTableData();
      }
    } else {
      // Just use the current page data
      data = tableDataStore.paginatedData;
    }

    // Format the data according to the selected format
    let content = "";
    let fileName = `${tableDataStore.tableName}_export_${new Date().toISOString().split("T")[0]}`;
    let mimeType = "text/plain";

    switch (exportFormat.value) {
      case "csv":
        content = generateCSV(data);
        fileName += ".csv";
        mimeType = "text/csv";
        break;

      case "json":
        content = JSON.stringify(data, null, 2);
        fileName += ".json";
        mimeType = "application/json";
        break;

      case "sql":
        content = generateSQL(data);
        fileName += ".sql";
        mimeType = "application/sql";
        break;

      case "excel":
        // This would require a library like SheetJS/xlsx
        // For now, we'll just download as CSV
        content = generateCSV(data);
        fileName += ".csv";
        mimeType = "text/csv";
        break;
    }

    // Download the file
    downloadFile(content, fileName, mimeType);
    emit("close");
  } catch (error) {
    console.error("Error exporting data:", error);
    // You could display an error message here
  } finally {
    isExporting.value = false;
  }
}

function generateCSV(data) {
  if (!data || data.length === 0) return "";

  const columns = Object.keys(data[0]);
  let csv = "";

  // Add headers
  if (includeHeaders.value) {
    csv += columns.join(",") + "\n";
  }

  // Add data rows
  data.forEach((row) => {
    const values = columns.map((column) => {
      const value = row[column];
      // Handle null values, quotes, and commas
      if (value === null || value === undefined) return "";
      if (typeof value === "string") {
        // Escape quotes and wrap in quotes if contains comma or quote
        let escaped = value.replace(/"/g, '""');
        if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
          escaped = `"${escaped}"`;
        }
        return escaped;
      }
      return value;
    });
    csv += values.join(",") + "\n";
  });

  return csv;
}

function generateSQL(data) {
  if (!data || data.length === 0) return "";

  const tableName = tableDataStore.tableName;
  const columns = Object.keys(data[0]);
  let sql = "";

  // Add INSERT statements
  data.forEach((row) => {
    const values = columns.map((column) => {
      const value = row[column];
      if (value === null || value === undefined) return "NULL";
      if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === "boolean") return value ? "1" : "0";
      return value;
    });

    sql += `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${values.join(", ")});\n`;
  });

  return sql;
}

async function fetchAllFilteredData() {
  try {
    // Create a connection to fetch all filtered data at once
    const conn = tableDataStore.connectionId;
    const tableName = tableDataStore.tableName;
    const filter = tableDataStore.activeFilter || (tableDataStore.filterTerm ? generateFilterFromTerm(tableDataStore.filterTerm) : null);

    if (!filter) return [];

    // Fetch all records with the filter applied
    const sortParams = tableDataStore.currentSortColumn
      ? {
          sortColumn: tableDataStore.currentSortColumn,
          sortDirection: tableDataStore.currentSortDirection
        }
      : {};

    const result = await window.api.getFilteredTableData({
      host: tableDataStore.connectionHost,
      port: tableDataStore.connectionPort,
      username: tableDataStore.connectionUsername,
      password: tableDataStore.connectionPassword,
      database: tableDataStore.connectionDatabase,
      tableName: tableName,
      filter: filter,
      limit: 999999, // Very large limit to get all records
      page: 1,
      ...sortParams
    });

    if (result.success) {
      return result.data || [];
    }

    // Fallback to current data if API call fails
    return tableDataStore.paginatedData;
  } catch (error) {
    console.error("Error fetching all filtered data:", error);
    // Fallback to current data
    return tableDataStore.paginatedData;
  }
}

function generateFilterFromTerm(term) {
  // Generate a LIKE filter for each column based on the filter term
  if (!term) return null;

  const columns = tableDataStore.columns;
  const searchTerm = term.trim();

  // If it's just a number, look for ID
  if (/^\d+$/.test(searchTerm)) {
    return `id = ${searchTerm}`;
  }

  // Otherwise create a LIKE filter for each column
  if (columns && columns.length > 0) {
    const likeFilters = columns.map((column) => `${column} LIKE '%${searchTerm.replace(/'/g, "''")}%'`);
    return likeFilters.join(" OR ");
  }

  return null;
}

async function fetchAllTableData() {
  try {
    // Create a connection to fetch all table data at once
    const conn = tableDataStore.connectionId;
    const tableName = tableDataStore.tableName;

    // Fetch all records from the table
    const sortParams = tableDataStore.currentSortColumn
      ? {
          sortColumn: tableDataStore.currentSortColumn,
          sortDirection: tableDataStore.currentSortDirection
        }
      : {};

    const result = await window.api.getTableData({
      host: tableDataStore.connectionHost,
      port: tableDataStore.connectionPort,
      username: tableDataStore.connectionUsername,
      password: tableDataStore.connectionPassword,
      database: tableDataStore.connectionDatabase,
      tableName: tableName,
      limit: 100000, // Very large limit to get all records
      page: 1,
      ...sortParams
    });

    if (result.success) {
      return result.data || [];
    }

    // Fallback to current data if API call fails
    return tableDataStore.paginatedData;
  } catch (error) {
    console.error("Error fetching all table data:", error);
    // Fallback to current data
    return tableDataStore.paginatedData;
  }
}
</script>
