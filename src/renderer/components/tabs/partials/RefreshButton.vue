<template>
  <button
    class="btn btn-sm btn-ghost"
    @click="refresh"
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
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
    <span class="hidden sm:inline">Refresh</span>
  </button>
</template>

<script setup>
import { useTableDataStore } from "@/store/table-data";

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["refresh"]);

const tableDataStore = useTableDataStore(props.storeId);

function refresh() {
  emit("refresh");
  tableDataStore.loadTableData();
}
</script>
