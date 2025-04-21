<template>
  <div class="flex h-full">
    <div class="w-1/3 bg-[#e82b25] flex flex-col items-center justify-between p-6 border-r border-gray-800">
      <div class="flex flex-col items-center">
        <img
          src="../assets/icons/png/512x512.png"
          alt="Larabase"
          class="h-32 w-32 mb-2"
        />
        <h1 class="text-3xl font-bold text-white">Larabase</h1>
        <p class="text-sm text-white">An opinionated MySQL GUI for Laravel developers</p>
      </div>

      <button
        class="btn btn-neutral w-full flex items-center gap-2 mt-8"
        @click="openCreateConnectionModal"
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
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Create Connection
      </button>
    </div>

    <div class="w-2/3 flex flex-col">
      <div class="flex-1 overflow-auto p-6">
        <h2 class="text-xl font-bold mb-4 text-white">Your Connections</h2>

        <div
          v-if="isLoading"
          class="flex justify-center items-center h-[calc(100vh-150px)]"
        >
          <span class="loading loading-spinner loading-lg" />
        </div>

        <div
          v-else-if="connectionsStore.connections.length === 0"
          class="flex flex-col items-center justify-center h-[calc(100vh-150px)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-16 h-16 mb-6 text-gray-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          <p class="text-xl font-medium text-gray-400">No connections found</p>
          <p class="text-gray-500 mt-3">Create a new connection to get started</p>
        </div>

        <div
          v-else
          class="grid grid-cols-1 gap-3"
        >
          <div
            v-for="connection in connectionsStore.connections"
            :key="connection.id"
            class="card bg-base-200 shadow-xl transition-colors border border-neutral hover:border-gray-500"
          >
            <div class="card-body py-4 px-5">
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  :class="getConnectionColor(connection.type)"
                >
                  <span class="text-white font-bold">{{ connection.icon }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h2 class="card-title text-base overflow-hidden whitespace-nowrap text-ellipsis">
                    {{ connection.name }}
                    <span
                      v-if="connection.isValid"
                      class="text-xs text-green-500 ml-1"
                      >{{ connection.status }}</span
                    >
                    <span
                      v-else
                      class="text-xs text-red-500 ml-1"
                      >Invalid</span
                    >
                  </h2>
                  <p class="text-xs text-gray-400 overflow-hidden whitespace-nowrap text-ellipsis">
                    {{ connection.host || connection.path }}
                  </p>
                  <p class="text-xs font-medium text-white mt-1 overflow-hidden whitespace-nowrap text-ellipsis">
                    {{ connection.database }}
                  </p>
                </div>
                <div class="flex gap-2 self-end sm:self-center mt-2 sm:mt-0">
                  <button
                    v-tooltip.bottom="'Edit connection'"
                    class="btn btn-sm btn-ghost text-white"
                    @click.stop="editConnection(connection)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="size-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                      />
                    </svg>
                  </button>
                  <button
                    v-tooltip.bottom="'Restore database'"
                    class="btn btn-sm btn-ghost text-white"
                    @click.stop="restoreDump(connection)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="size-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                      />
                    </svg>
                  </button>
                  <button
                    v-tooltip.bottom="'Remove connection'"
                    class="btn btn-sm btn-ghost text-white"
                    @click.stop="removeConnection(connection.id)"
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
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                  <button
                    v-tooltip.bottom="'Open connection'"
                    :disabled="!connection.isValid"
                    class="btn btn-sm btn-ghost"
                    @click.stop="openConnection(connection.id)"
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
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <RestoreDatabase ref="restoreDatabase" />
    <ManageConnection
      ref="manageConnection"
      :is-loading="isLoading"
    />
  </div>
</template>

<script setup>
import { onMounted, computed, inject, ref } from "vue";
import { useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";

import RestoreDatabase from "@/components/home/RestoreDatabase.vue";
import ManageConnection from "@/components/home/ManageConnection.vue";

const router = useRouter();
const connectionsStore = useConnectionsStore();

const showAlert = inject("showAlert");

const restoreDatabase = ref(null);
const manageConnection = ref(null);

const isLoading = computed(() => connectionsStore.isLoading);

function restoreDump(connection) {
  restoreDatabase.value.restoreDatabase(connection);
}

function openCreateConnectionModal() {
  manageConnection.value.openCreateConnectionModal();
}

function editConnection(connection) {
  manageConnection.value.editConnection(connection);
}

function removeConnection(connectionId) {
  manageConnection.value.removeConnection(connectionId);
}

onMounted(async () => {
  setTimeout(async () => {
    await loadConnectionsWithRetry();
  }, 300);
});

async function loadConnectionsWithRetry(retries = 3) {
  try {
    await connectionsStore.loadConnections();
  } catch (error) {
    console.error("Error loading connections:", error);

    if (retries > 0) {
      setTimeout(() => loadConnectionsWithRetry(retries - 1), 500);
    } else {
      showAlert("Failed to load connections. Please try reloading the application.", "error");
    }
  }
}

function openConnection(connectionId) {
  router.push(`/database/${connectionId}`);
}

function getConnectionColor(type) {
  switch (type) {
    case "mysql":
      return "bg-orange-500";
    case "redis":
      return "bg-red-600";
    case "sqlite":
      return "bg-purple-600";
    case "postgresql":
      return "bg-blue-600";
    default:
      return "bg-gray-600";
  }
}
</script>
