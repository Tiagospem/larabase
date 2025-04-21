<template>
  <div>
    <h1 class="text-lg font-semibold">
      {{ connection?.name }}
    </h1>
    <div class="text-xs text-gray-400 flex items-center">
      <span>{{ connection?.database || connection?.path }}</span>
      <button
        class="ml-1 text-gray-400 hover:text-gray-300"
        @click="showConnectionInfo = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-3"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
          />
        </svg>
      </button>
    </div>
  </div>

  <div
    v-if="showConnectionInfo"
    class="modal modal-open"
  >
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Connection Details</h3>
      <div class="py-4 text-sm">
        <div
          v-if="connection"
          class="space-y-2"
        >
          <p>
            <span class="font-semibold">Name:</span>
            {{ connection.name }}
          </p>
          <p>
            <span class="font-semibold">Type:</span>
            {{ connection.type }}
          </p>
          <p v-if="connection.host">
            <span class="font-semibold">Host:</span>
            {{ connection.host }}
          </p>
          <p v-if="connection.port">
            <span class="font-semibold">Port:</span>
            {{ connection.port }}
          </p>
          <p v-if="connection.database">
            <span class="font-semibold">Database:</span>
            {{ connection.database }}
          </p>
          <p v-if="connection.username">
            <span class="font-semibold">Username:</span>
            {{ connection.username }}
          </p>
          <p v-if="connection.path">
            <span class="font-semibold">Path:</span>
            {{ connection.path }}
          </p>
        </div>
      </div>
      <div class="modal-action">
        <button
          class="btn btn-primary"
          @click="showConnectionInfo = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useConnectionsStore } from "@/store/connections";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
});

const connectionsStore = useConnectionsStore();

const showConnectionInfo = ref(false);

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});
</script>
