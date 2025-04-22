<template>
  <button
    class="btn btn-sm btn-ghost text-error"
    :disabled="tableDataStore.totalRecords === 0"
    @click="confirmTruncateTable"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="w-5 h-5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
    <span class="hidden sm:inline">Truncate</span>
  </button>

  <div
    class="modal z-50"
    :class="{ 'modal-open': showTruncateConfirm }"
  >
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error">⚠️ Truncate Table</h3>
      <p class="py-4">
        Are you sure you want to truncate the
        <strong>{{ tableDataStore.tableName }}</strong> table? This will delete ALL records and cannot be undone.
      </p>
      <div class="modal-action">
        <button
          class="btn"
          @click="showTruncateConfirm = false"
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          @click="truncateTable"
        >
          Truncate Table
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="showTruncateConfirm = false"
    />
  </div>
</template>

<script setup>
import { useTableDataStore } from "@/store/table-data";
import { inject, ref } from "vue";
import { useDatabaseStore } from "@/store/database";

const showAlert = inject("showAlert");

const databaseStore = useDatabaseStore();

const showTruncateConfirm = ref(false);

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const tableDataStore = useTableDataStore(props.storeId);

function confirmTruncateTable() {
  showTruncateConfirm.value = true;
}

async function truncateTable() {
  showTruncateConfirm.value = false;

  try {
    const result = await databaseStore.truncateTable(tableDataStore.connectionId, tableDataStore.tableName);

    showAlert(result.message, "success");

    tableDataStore.selectedRows = [];
    await tableDataStore.loadTableData();
  } catch (error) {
    showAlert(`Error truncating table: ${error.message}`, "error");
  }
}
</script>
