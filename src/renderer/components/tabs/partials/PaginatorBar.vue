<template>
  <div
    v-if="tableDataStore.tableData.length > 0"
    class="bg-base-200 px-4 py-3 border-t border-neutral flex flex-col sm:flex-row justify-between items-center text-xs sticky bottom-0 left-0 right-0 min-h-[56px] z-20"
  >
    <div class="flex items-center mb-2 sm:mb-0">
      <span class="text-gray-400">
        {{ tableDataStore.tableName }} | {{ tableDataStore.totalRecords }} records{{ tableDataStore.selectedRows.length > 0 ? ` | ${tableDataStore.selectedRows.length} selected` : "" }} |
        <span>{{ tableDataStore.columns.length }} columns</span>
      </span>
      <div class="ml-4 flex space-x-2">
        <button
          v-if="tableDataStore.tableData.length > 0"
          class="btn btn-ghost btn-xs"
          @click="showExportModal = true"
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
          :class="{
            'btn-disabled': tableDataStore.currentPage === 1
          }"
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
          :class="{
            'btn-disabled': tableDataStore.currentPage === 1
          }"
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
          :class="{
            'btn-disabled': tableDataStore.currentPage === totalPages
          }"
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
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
        <button
          class="join-item btn btn-xs"
          :class="{
            'btn-disabled': tableDataStore.currentPage === totalPages
          }"
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
        <button
          class="btn btn-xs btn-ghost"
          @click="goToPage"
        >
          Go
        </button>
      </div>
    </div>
  </div>

  <ExportDataModal
    v-if="showExportModal"
    :show="showExportModal"
    :store-id="storeId"
    @close="showExportModal = false"
  />
</template>

<script setup>
import { useDatabaseStore } from "@/store/database";
import { useTableDataStore } from "@/store/table-data";
import { computed, ref, watch } from "vue";
import ExportDataModal from "./ExportDataModal.vue";

const showExportModal = ref(false);

const pageInput = ref(1);

const emit = defineEmits(["scrollToTop"]);

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const databaseStore = useDatabaseStore();

const tableDataStore = useTableDataStore(props.storeId);

const rowsPerPage = computed(() => tableDataStore.rowsPerPage);

const totalPages = computed(() => {
  if (tableDataStore.rowsPerPage === 0) return 1;
  return Math.ceil(tableDataStore.totalRecords / tableDataStore.rowsPerPage);
});

function prevPage() {
  if (tableDataStore.currentPage > 1) {
    tableDataStore.currentPage--;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    }

    emit("scrollToTop");
  }
}

function nextPage() {
  if (tableDataStore.currentPage < totalPages.value) {
    tableDataStore.currentPage++;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    }

    emit("scrollToTop");
  }
}

function goToFirstPage() {
  if (tableDataStore.currentPage !== 1) {
    tableDataStore.currentPage = 1;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    }

    emit("scrollToTop");
  }
}

function goToLastPage() {
  const lastPage = totalPages.value;

  if (tableDataStore.currentPage !== lastPage) {
    tableDataStore.currentPage = lastPage;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    }

    emit("scrollToTop");
  }
}

function goToPage() {
  const page = parseInt(pageInput.value);
  const maxPage = totalPages.value;

  if (!isNaN(page) && page >= 1 && page <= maxPage && page !== tableDataStore.currentPage) {
    tableDataStore.currentPage = page;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    }

    emit("scrollToTop");
  } else {
    pageInput.value = tableDataStore.currentPage;
  }
}

watch(
  () => tableDataStore.currentPage,
  (newPage, oldPage) => {
    if (newPage !== oldPage) {
      pageInput.value = newPage;

      if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
        tableDataStore.loadFilteredData();
      } else {
        tableDataStore.loadTableData();
      }
    }
  }
);

watch(rowsPerPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    tableDataStore.currentPage = 1;

    if (tableDataStore.filterTerm || tableDataStore.activeFilter) {
      tableDataStore.loadFilteredData();
    } else {
      tableDataStore.loadTableData();
    }
  }
});
</script>
