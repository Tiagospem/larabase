<template>
  <button
    class="btn btn-sm btn-ghost"
    :disabled="tableDataStore.selectedRows.length === 0"
    @click="tableDataStore.deleteSelected"
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
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
    <span class="hidden sm:inline">Delete{{ tableDataStore.selectedRows.length > 0 ? ` (${tableDataStore.selectedRows.length})` : "" }}</span>
  </button>

  <div
    class="modal z-50"
    :class="{ 'modal-open': tableDataStore.showDeleteConfirm }"
  >
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error">Delete Records</h3>
      <p class="py-4">
        Are you sure you want to delete
        {{ tableDataStore.selectedRows.length }} record(s)? This action cannot be undone.
      </p>

      <fieldset class="fieldset mt-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            v-model="ignoreForeignKeys"
            class="checkbox checkbox-sm"
          />
          <span class="label-text">Ignore foreign key constraints (use with caution)</span>
        </label>
        <p
          v-if="ignoreForeignKeys"
          class="text-xs text-warning mt-1"
        >
          Warning: This may cause data inconsistency if related records exist in other tables.
        </p>
      </fieldset>

      <div class="modal-action">
        <button
          class="btn"
          @click="closeModal"
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          @click="confirmDelete"
        >
          Delete
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="closeModal"
    />
  </div>
</template>

<script setup>
import { useTableDataStore } from "@/store/table-data";
import { inject, ref } from "vue";
import { useDatabaseStore } from "@/store/database";
import { useTablesStore } from "@/store/tables";

const showAlert = inject("showAlert");
const ignoreForeignKeys = ref(false);

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const tableDataStore = useTableDataStore(props.storeId);
const databaseStore = useDatabaseStore();
const tablesStore = useTablesStore();

async function confirmDelete() {
  tableDataStore.showDeleteConfirm = false;

  try {
    const idsToDelete = [...tableDataStore.deletingIds];
    const countBeforeDeletion = tableDataStore.totalRecords;

    const options = {
      ignoreForeignKeys: ignoreForeignKeys.value === true
    };

    const result = await databaseStore.deleteRecords(tableDataStore.connectionId, tableDataStore.tableName, idsToDelete, options);

    if (!result.success) {
      if (result.constraintError || result.message.includes("referenced by other tables")) {
        showAlert("Cannot delete records because they are referenced by other tables. Try checking 'Ignore foreign key constraints' or remove the related records first.", "error");
      } else {
        showAlert(`Error deleting records: ${result.message}`, "error");
      }
      return;
    }

    showAlert(result.message, "success");

    tableDataStore.selectedRows = [];
    ignoreForeignKeys.value = false;

    const deletedCount = result.affectedRows || idsToDelete.length;
    const newCount = Math.max(0, countBeforeDeletion - deletedCount);
    tableDataStore.totalRecordsCount = newCount;

    tablesStore.updateTableRecordCount(tableDataStore.tableName, newCount);

    await tableDataStore.loadTableData();
  } catch (error) {
    console.error("Error in confirmDelete:", error);
    showAlert(`Error deleting records: ${error.message}`, "error");
  }
}

function closeModal() {
  tableDataStore.showDeleteConfirm = false;
  ignoreForeignKeys.value = false;
}
</script>
