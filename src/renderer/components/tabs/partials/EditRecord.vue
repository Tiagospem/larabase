<template>
  <div
    class="modal z-50"
    :class="{ 'modal-open': tableDataStore.showEditModal }"
  >
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
        Edit Record
        <button
          class="btn btn-sm btn-circle"
          @click="closeEditModal"
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

      <div
        v-if="editingRecord"
        class="overflow-y-auto max-h-[60vh]"
      >
        <div
          v-for="column in getEditableColumns()"
          :key="column"
          class="form-control mb-4"
        >
          <label class="label">
            <span class="label-text font-medium">{{ column }}</span>
            <span class="label-text-alt text-xs bg-base-300 px-2 py-1 rounded-md">
              {{ Helpers.getFieldTypeLabel(column) }}
            </span>
          </label>

          <textarea
            v-if="Helpers.isLongTextField(column)"
            v-model="editingRecord[column]"
            class="textarea textarea-bordered h-24"
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
        </div>
      </div>

      <div class="modal-action">
        <button
          class="btn btn-error"
          @click="closeEditModal"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="saveRecord"
        >
          Save Changes
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="closeEditModal"
    />
  </div>
</template>

<script setup>
import { Helpers } from "@/utils/helpers";
import { useTableDataStore } from "@/store/table-data";
import { inject, ref, nextTick } from "vue";
import { useDatabaseStore } from "@/store/database";

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
    // Store a copy of the original record for comparison
    originalRecord.value = JSON.parse(JSON.stringify(row));
    
    // Create a deep copy to work with
    const processedRecord = JSON.parse(JSON.stringify(row));
    
    // Process all fields systematically
    for (const key in processedRecord) {
      const value = processedRecord[key];
      
      // 1. Handle null values first
      if (value === null) {
        continue;
      }
      
      // 2. Handle object values (convert to JSON string)
      if (typeof value === 'object') {
        try {
          processedRecord[key] = JSON.stringify(value, null, 2);
        } catch (e) {
          console.warn(`Failed to stringify object for ${key}:`, e);
          processedRecord[key] = String(value);
        }
        continue;
      }
      
      // 3. Handle date fields
      if (Helpers.isDateField(key) && typeof value === "string") {
        try {
          let dateStr = value;
          
          // Standardize format replacing space with T if needed
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
    
    // Set the processed record and open the modal
    editingRecord.value = processedRecord;
    tableDataStore.showEditModal = true;
  });
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

      // 1. Process JSON strings back to objects
      if (typeof value === 'string') {
        // Try to parse JSON strings
        if (value.trim() && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object') {
              value = parsed;
            }
          } catch (e) {
            // Not valid JSON, keep as string
          }
        }
        
        // 2. Process date fields
        if (Helpers.isDateField(key) && value.includes("T")) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = date.toISOString().slice(0, 19).replace("T", " ");
            }
          } catch (e) {
            console.warn(`Failed to format date for ${key}:`, e);
          }
        }
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

<style scoped></style>
