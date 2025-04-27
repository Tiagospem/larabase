<template>
  <div class="flex items-center gap-1">
    <div class="dropdown dropdown-start">
      <button
        class="btn btn-sm"
        :class="tableDataStore.isLiveTableActive ? 'btn-primary' : 'btn-ghost'"
        @click="toggleLiveTable"
      >
        <div class="flex items-center gap-1">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full rounded-full opacity-75"
              :class="tableDataStore.isLiveTableActive ? 'animate-ping bg-primary-content' : 'bg-transparent'"
            />
            <span
              class="relative inline-flex rounded-full h-2 w-2"
              :class="tableDataStore.isLiveTableActive ? 'bg-primary-content' : 'bg-transparent'"
            />
          </span>
          <svg
            class="h-4 w-4"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 576 512"
          >
            <path
              d="M80.3 44C69.8 69.9 64 98.2 64 128s5.8 58.1 16.3 84c6.6 16.4-1.3 35-17.7 41.7s-35-1.3-41.7-17.7C7.4 202.6 0 166.1 0 128S7.4 53.4 20.9 20C27.6 3.6 46.2-4.3 62.6 2.3S86.9 27.6 80.3 44zM555.1 20C568.6 53.4 576 89.9 576 128s-7.4 74.6-20.9 108c-6.6 16.4-25.3 24.3-41.7 17.7S489.1 228.4 495.7 212c10.5-25.9 16.3-54.2 16.3-84s-5.8-58.1-16.3-84C489.1 27.6 497 9 513.4 2.3s35 1.3 41.7 17.7zM352 128c0 23.7-12.9 44.4-32 55.4L320 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-296.6c-19.1-11.1-32-31.7-32-55.4c0-35.3 28.7-64 64-64s64 28.7 64 64zM170.6 76.8C163.8 92.4 160 109.7 160 128s3.8 35.6 10.6 51.2c7.1 16.2-.3 35.1-16.5 42.1s-35.1-.3-42.1-16.5c-10.3-23.6-16-49.6-16-76.8s5.7-53.2 16-76.8c7.1-16.2 25.9-23.6 42.1-16.5s23.6 25.9 16.5 42.1zM464 51.2c10.3 23.6 16 49.6 16 76.8s-5.7 53.2-16 76.8c-7.1 16.2-25.9 23.6-42.1 16.5s-23.6-25.9-16.5-42.1c6.8-15.6 10.6-32.9 10.6-51.2s-3.8-35.6-10.6-51.2c-7.1-16.2 .3-35.1 16.5-42.1s35.1 .3 42.1 16.5z"
            />
          </svg>
          <span class="hidden sm:inline">Hot Reload</span>
          <span
            v-if="tableDataStore.updateCounter > 0"
            class="badge badge-sm badge-accent"
            >{{ tableDataStore.updateCounter }}</span
          >
        </div>
      </button>
      <div
        tabindex="0"
        class="dropdown-content z-[9999] p-2 shadow-sm bg-base-200 rounded-box w-52 mt-2"
      >
        <div class="p-2">
          <fieldset class="fieldset">
            <label class="label">
              <span class="label-text">Update interval</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="tableDataStore.liveUpdateDelaySeconds"
                type="range"
                min="1"
                max="30"
                class="range range-primary range-xs"
                @change="updateLiveDelay"
              />
              <span>{{ tableDataStore.liveUpdateDelaySeconds }}s</span>
            </div>
          </fieldset>
          <fieldset class="fieldset mt-2">
            <label class="label cursor-pointer">
              <span class="label-text">Highlight changes</span>
              <input
                v-model="tableDataStore.highlightChanges"
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
              />
            </label>
          </fieldset>
          <button
            v-if="tableDataStore.updateCounter > 0"
            class="btn btn-xs btn-ghost mt-2 w-full"
            @click="clearUpdateCounter"
          >
            Clear counter ({{ tableDataStore.updateCounter }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from "vue";

import { useTableDataStore } from "@/store/table-data";

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const showAlert = inject("showAlert");

const tableDataStore = useTableDataStore(props.storeId);

function toggleLiveTable() {
  try {
    if (!tableDataStore.isLiveTableActive) {
      tableDataStore.startLiveUpdates();
      clearUpdateCounter();
      showAlert(`Live table updates activated for ${tableDataStore.tableName} - refreshing every ${tableDataStore.liveUpdateDelaySeconds}s`, "success");
    } else {
      tableDataStore.stopLiveUpdates(true);
      clearUpdateCounter();
      showAlert("Live table updates stopped", "info");
    }
  } catch (e) {
    console.error("Failed to toggle live table:", e);
    showAlert("Failed to toggle live table updates", "error");
  }
}

function updateLiveDelay() {
  tableDataStore.liveUpdateDelay = tableDataStore.liveUpdateDelaySeconds * 1000;

  try {
    localStorage.setItem("liveTable.delay", String(tableDataStore.liveUpdateDelaySeconds));
  } catch (e) {
    console.error("Failed to save live table delay preference", e);
  }

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.stopLiveUpdates();
    tableDataStore.startLiveUpdates();
    showAlert(`Live update interval changed to ${tableDataStore.liveUpdateDelaySeconds} seconds`, "info");
  }
}

function clearUpdateCounter() {
  tableDataStore.updateCounter = 0;
  tableDataStore.updateAppIcon(0);
}
</script>
