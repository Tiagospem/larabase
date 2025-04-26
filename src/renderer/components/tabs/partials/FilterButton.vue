<template>
  <div class="relative flex items-center gap-2">
    <div class="input-group flex gap-2">
      <input
        v-model="tableDataStore.filterTerm"
        type="text"
        placeholder="Filter..."
        class="input input-sm input-bordered w-full sm:w-64"
        @keyup.enter="applyFilter"
      />
      <button
        class="btn btn-sm"
        :class="{
          'btn-base-300': !tableDataStore.activeFilter && !tableDataStore.filterTerm,
          'btn-primary border-primary': tableDataStore.activeFilter || tableDataStore.filterTerm
        }"
        @click="toggleAdvancedFilter"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
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

  <Modal
    :show="showFilterModal"
    title="Advanced Filter"
    @close="cancelAdvancedFilter"
    @action="applyAdvancedFilter"
    :show-action-button="true"
    :action-button-text="'Apply Filter'"
  >
    <div class="mb-4">
      <fieldset class="fieldset">
        <label class="label">
          <span class="label-text font-medium">SQL WHERE Clause</span>
        </label>
        <textarea
          v-model="tableDataStore.advancedFilterTerm"
          class="textarea textarea-bordered h-32 font-mono w-full"
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
      </fieldset>

      <div class="mt-2 text-xs">
        <p class="mb-2">Available columns:</p>
        <div class="flex flex-wrap gap-1 mb-4">
          <span
            v-for="column in tableDataStore.columns"
            :key="column"
            class="badge badge-primary badge-sm cursor-pointer"
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
            class="badge badge-secondary badge-sm cursor-pointer"
            @click="insertOperator(op)"
          >
            {{ op }}
          </span>
        </div>
      </div>
    </div>

    <fieldset class="fieldset mb-4">
      <label class="label cursor-pointer justify-start">
        <input
          v-model="persistFilter"
          type="checkbox"
          class="checkbox checkbox-primary checkbox-sm"
        />
        <span class="label-text text-primary">Persist filter (remember after reload)</span>
      </label>
    </fieldset>
  </Modal>

  <select
    v-model="tableDataStore.rowsPerPage"
    class="select select-sm select-bordered w-24 sm:w-32"
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
import Modal from "@/components/Modal.vue";

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

  try {
    await tableDataStore.loadFilteredData();
  } catch (error) {
    console.error("Error to get filtered data:", error);
    showAlert(`Error to apply filter: ${error.message}`, "error");
  }
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

function setExampleFilter(example) {
  tableDataStore.advancedFilterTerm = example;
}

function applyFilter() {
  tableDataStore.currentPage = 1;
  tableDataStore.loadFilteredData();
}

defineExpose({ clearFilters });
</script>
