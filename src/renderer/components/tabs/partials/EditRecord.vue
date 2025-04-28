<template>
  <Modal
    :show="tableDataStore.showEditModal"
    title="Edit Record"
    @close="closeEditModal"
    @action="saveRecord"
    :show-action-button="true"
    :action-button-text="'Save Changes'"
  >
    <div
      v-if="editingRecord"
      class="overflow-y-auto max-h-[60vh] px-2"
    >
      <fieldset
        v-for="column in getEditableColumns()"
        :key="column"
        class="fieldset mb-4"
      >
        <label class="label w-full flex justify-between items-center">
          <span class="label-text font-medium">{{ column }}</span>
          <span class="label-text-alt text-xs bg-base-200 px-2 py-1 rounded-md">
            {{ Helpers.getFieldTypeLabel(column) }}
          </span>
        </label>

        <textarea
          v-if="Helpers.isLongTextField(column)"
          v-model="editingRecord[column]"
          class="textarea textarea-bordered h-24 w-full"
          :placeholder="column"
        />

        <input
          v-else-if="Helpers.isDateField(column)"
          v-model="editingRecord[column]"
          type="datetime-local"
          class="input input-bordered w-full"
          :max="'9999-12-31T23:59'"
        />

        <input
          v-else-if="Helpers.isNumberField(column)"
          v-model.number="editingRecord[column]"
          type="number"
          class="input input-bordered w-full"
          step="any"
        />

        <select
          v-else-if="Helpers.isBooleanField(column)"
          v-model="editingRecord[column]"
          class="select select-bordered w-full"
        >
          <option :value="true">True</option>
          <option :value="false">False</option>
          <option
            v-if="editingRecord[column] === null"
            :value="null"
          >
            NULL
          </option>
        </select>

        <input
          v-else
          v-model="editingRecord[column]"
          type="text"
          class="input input-bordered w-full"
        />
      </fieldset>
    </div>
  </Modal>
</template>

<script setup>
import { Helpers } from "@/utils/helpers";
import { useTableDataStore } from "@/store/table-data";
import { inject, ref, nextTick } from "vue";
import { useDatabaseStore } from "@/store/database";
import Modal from "@/components/Modal.vue";

const showAlert = inject("showAlert");

const originalRecord = ref(null);
const editingRecord = ref(null);

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const databaseStore = useDatabaseStore();

const tableDataStore = useTableDataStore(props.storeId);

function openEditModal(row) {
  // Reset state first to avoid any stale data
  closeEditModal();

  // Wait for the next tick to ensure the modal is fully closed
  nextTick(() => {
    // Make sure we have column structure data before proceeding
    if (Helpers.columnStructure.length === 0) {
      // Try to recover the column structure from localStorage
      if (!Helpers.recoverColumnStructure()) {
        // If recovery failed, try to load table structure
        loadTableStructure().then(() => {
          processEditRecord(row);
        });
        return;
      }
    }

    processEditRecord(row);
  });
}

async function loadTableStructure() {
  try {
    const structure = await databaseStore.getTableStructure(tableDataStore.connectionId, tableDataStore.tableName, true);

    if (structure && Array.isArray(structure) && structure.length > 0) {
      Helpers.setColumnStructure(structure);

      localStorage.setItem(`table_structure:${tableDataStore.connectionId}:${tableDataStore.tableName}`, JSON.stringify(structure));
    }
  } catch (error) {
    console.error("Error loading table structure:", error);
  }
}

function processEditRecord(row) {
  originalRecord.value = JSON.parse(JSON.stringify(row));

  const processedRecord = JSON.parse(JSON.stringify(row));

  for (const key in processedRecord) {
    const value = processedRecord[key];

    if (value === null) {
      continue;
    }

    if (typeof value === "object") {
      try {
        processedRecord[key] = JSON.stringify(value, null, 2);
      } catch (e) {
        console.warn(`Failed to stringify object for ${key}:`, e);
        processedRecord[key] = String(value);
      }
      continue;
    }

    if (Helpers.isDateField(key) && typeof value === "string") {
      try {
        let dateStr = value;

        if (dateStr.includes(" ")) {
          dateStr = dateStr.replace(" ", "T");
        }

        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          processedRecord[key] = date.toISOString().slice(0, 16);
        }
      } catch (e) {
        console.warn(`Failed to process date for ${key}:`, e);
      }
    }
  }

  editingRecord.value = processedRecord;
  tableDataStore.showEditModal = true;
}

function closeEditModal() {
  tableDataStore.showEditModal = false;
  editingRecord.value = null;
  originalRecord.value = null;
}

async function saveRecord() {
  if (!editingRecord.value) {
    showAlert("No record to save", "error");
    return;
  }

  try {
    const recordToSave = {};

    for (const key in editingRecord.value) {
      let value = editingRecord.value[key];
      if (value && Helpers.isDateField(key)) {
        if (typeof value === "string") {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              const pad = (n) => String(n).padStart(2, "0");
              const Y = date.getFullYear();
              const m = pad(date.getMonth() + 1);
              const d = pad(date.getDate());
              const H = pad(date.getHours());
              const i = pad(date.getMinutes());
              const s = pad(date.getSeconds());
              value = `${Y}-${m}-${d} ${H}:${i}:${s}`;
            }
          } catch (e) {
            console.warn(`Failed to process date for ${key}:`, e);
          }
        }
      }

      if (typeof value === "object" && value !== null) {
        try {
          value = JSON.parse(editingRecord.value["_json_" + key]);
        } catch (e) {}
      } else if (typeof value === "string") {
        try {
          if ((value.trim().startsWith("{") && value.trim().endsWith("}")) || (value.trim().startsWith("[") && value.trim().endsWith("]"))) {
            const parsed = JSON.parse(value);
            if (typeof parsed === "object") {
              value = parsed;
            }
          }
        } catch (e) {}
      }

      recordToSave[key] = value;
    }

    if (!recordToSave.id) {
      showAlert("Record must have an ID field to update", "error");
      return;
    }

    const index = tableDataStore.tableData.findIndex((row) => {
      if (row.id && originalRecord.value.id) {
        return row.id === originalRecord.value.id;
      }
      return false;
    });

    if (index === -1) {
      showAlert("Could not find record to update", "error");
      return;
    }

    const result = await databaseStore.updateRecord(tableDataStore.connectionId, tableDataStore.tableName, recordToSave);

    if (result) {
      tableDataStore.tableData[index] = { ...recordToSave };
      showAlert("Record updated successfully", "success");
      closeEditModal();
    } else {
      showAlert("Failed to update record. Unknown error.", "error");
    }
  } catch (error) {
    console.error("Error saving record:", error);
    showAlert(`Error updating record: ${error.message}`, "error");
  }
}

function getEditableColumns() {
  if (!editingRecord.value) return [];
  return Object.keys(editingRecord.value).filter((column) => {
    return !["id"].includes(column);
  });
}

defineExpose({ openEditModal });
</script>
