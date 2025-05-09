<template>
  <div class="flex h-full relative">
    <div class="w-3/12 bg-base-300 flex flex-col items-center justify-between p-6">
      <div class="flex flex-col items-center mt-12 w-full text-center">
        <img
          src="../assets/icons/png/512x512.png"
          alt="Larabase"
          class="h-22 mb-2 draggable"
        />
        <h1 class="text-2xl font-bold">Larabase</h1>
        <p class="text-xs mt-2">An opinionated database GUI for Laravel developers</p>
      </div>

      <div class="flex items-center gap-2 mt-8 w-full">
        <button
          class="btn flex-1 flex items-center gap-2"
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

        <button
          class="btn btn-square"
          @click="showSettings = true"
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
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="w-9/12 flex flex-col">
      <div class="flex-1 overflow-auto p-6">
        <h2 class="text-xl font-bold mb-4">Your Connections</h2>

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
            class="w-16 h-16 mb-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          <p class="text-lg font-medium">No connections found</p>
          <p class="mt-1 font-light text-sm">Create a new connection to get started</p>
        </div>

        <div
          v-else
          class="grid grid-cols-1 gap-3"
        >
          <div
            v-for="connection in connectionsStore.connections"
            :key="connection.id"
            class="card bg-base-300 shadow-sm transition-colors border border-base-300 hover:bg-base-200"
          >
            <div class="card-body py-4 px-5">
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  :class="getConnectionColor(connection.type)"
                >
                  <span class="font-bold text-base-100">{{ connection.icon }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h2 class="card-title overflow-hidden whitespace-nowrap text-ellipsis">
                    <span>{{ connection.name }}</span>
                    <span
                      v-if="connection.isValid"
                      class="text-xs text-success ml-1"
                      >{{ connection.status }}</span
                    >
                    <span
                      v-else
                      class="text-xs text-error ml-1"
                      >Invalid</span
                    >
                  </h2>
                  <p class="text-xs overflow-hidden whitespace-nowrap text-ellipsis">
                    {{ connection.host || connection.path }}
                  </p>
                  <p class="text-xs font-medium mt-1 overflow-hidden whitespace-nowrap text-ellipsis">
                    {{ connection.database }}
                  </p>
                </div>
                <div class="flex gap-2 self-end sm:self-center mt-2 sm:mt-0">
                  <div
                    class="tooltip tooltip-bottom"
                    data-tip="Edit connection"
                  >
                    <button
                      class="btn btn-sm btn-ghost"
                      @click.stop="editConnection(connection)"
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
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-bottom"
                    data-tip="Restore database"
                  >
                    <button
                      :disabled="!connection.isValid"
                      class="btn btn-sm btn-ghost"
                      @click.stop="restoreDump(connection)"
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
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                        />
                      </svg>
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-bottom"
                    data-tip="Remove connection"
                  >
                    <button
                      class="btn btn-sm btn-ghost"
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
                  </div>
                  <div
                    class="tooltip tooltip-bottom"
                    data-tip="Open connection"
                  >
                    <button
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
    </div>

    <RestoreDatabase ref="restoreDatabase" />
    <ManageConnection
      ref="manageConnection"
      :is-loading="isLoading"
    />
    <Settings
      v-if="showSettings"
      @close="showSettings = false"
    />

    <div class="absolute w-full h-16 top-0 draggable"></div>
  </div>
</template>

<script setup>
import { onMounted, computed, inject, ref } from "vue";
import { useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";

import RestoreDatabase from "@/components/home/RestoreDatabase.vue";
import ManageConnection from "@/components/home/ManageConnection.vue";
import Settings from "@/components/Settings.vue";

const router = useRouter();
const connectionsStore = useConnectionsStore();

const showAlert = inject("showAlert");

const restoreDatabase = ref(null);
const manageConnection = ref(null);
const showSettings = ref(false);

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
  }, 500);
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
    case "postgresql":
      return "bg-blue-600";
    default:
      return "bg-gray-600";
  }
}
</script>
