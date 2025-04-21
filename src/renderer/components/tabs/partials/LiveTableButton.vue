<template>
  <div class="flex items-center gap-1">
    <div class="dropdown dropdown-end">
      <button
        class="btn btn-sm"
        :class="tableDataStore.isLiveTableActive ? 'btn-primary' : 'btn-ghost'"
        @click="toggleLiveTable"
      >
        <div class="flex items-center gap-1">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full rounded-full opacity-75"
              :class="
                tableDataStore.isLiveTableActive ? 'animate-ping bg-success' : 'bg-transparent'
              "
            />
            <span
              class="relative inline-flex rounded-full h-2 w-2"
              :class="tableDataStore.isLiveTableActive ? 'bg-success' : 'bg-transparent'"
            />
          </span>
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
              d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79"
            />
          </svg>
          <span class="hidden sm:inline">Live</span>
          <span v-if="tableDataStore.updateCounter > 0" class="badge badge-sm badge-accent">{{
            tableDataStore.updateCounter
          }}</span>
        </div>
      </button>
      <div
        tabindex="0"
        class="dropdown-content z-[40] menu p-2 shadow bg-base-200 rounded-box w-52"
      >
        <div class="p-2">
          <div class="form-control">
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
          </div>
          <div class="form-control mt-2">
            <label class="label cursor-pointer">
              <span class="label-text">Highlight changes</span>
              <input
                v-model="tableDataStore.highlightChanges"
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
              />
            </label>
          </div>
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
import { inject } from 'vue';

import { useTableDataStore } from '@/store/table-data';

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const showAlert = inject('showAlert');

const tableDataStore = useTableDataStore(props.storeId);

function toggleLiveTable() {
  try {
    if (!tableDataStore.isLiveTableActive) {
      tableDataStore.startLiveUpdates();
      clearUpdateCounter();
      showAlert(
        `Live table updates activated for ${tableDataStore.tableName} - refreshing every ${tableDataStore.liveUpdateDelaySeconds}s`,
        'success'
      );
    } else {
      tableDataStore.stopLiveUpdates(true);
      clearUpdateCounter();
      showAlert('Live table updates stopped', 'info');
    }
  } catch (e) {
    console.error('Failed to toggle live table:', e);
    showAlert('Failed to toggle live table updates', 'error');
  }
}

function updateLiveDelay() {
  tableDataStore.liveUpdateDelay = tableDataStore.liveUpdateDelaySeconds * 1000;

  try {
    localStorage.setItem('liveTable.delay', String(tableDataStore.liveUpdateDelaySeconds));
  } catch (e) {
    console.error('Failed to save live table delay preference', e);
  }

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.stopLiveUpdates();
    tableDataStore.startLiveUpdates();
    showAlert(
      `Live update interval changed to ${tableDataStore.liveUpdateDelaySeconds} seconds`,
      'info'
    );
  }
}

function clearUpdateCounter() {
  tableDataStore.updateCounter = 0;
  tableDataStore.updateAppIcon(0);
}
</script>
