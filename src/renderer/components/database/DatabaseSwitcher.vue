<template>
  <div>
    <div
      v-if="showDatabaseSwitcher"
      class="modal modal-open"
    >
      <div class="modal-box bg-base-300 w-96">
        <h3 class="font-bold text-lg mb-4">Switch Database</h3>
        <div
          v-if="loadingDatabases"
          class="flex justify-center py-4"
        >
          <div class="loading loading-spinner" />
        </div>
        <div
          v-else-if="availableDatabases.length === 0"
          class="text-center py-4"
        >
          No databases found
        </div>
        <div
          v-else
          class="max-h-60 overflow-y-auto"
        >
          <ul class="menu bg-base-200 rounded-box">
            <li
              v-for="db in availableDatabases"
              :key="db"
              :class="{
                'bg-primary bg-opacity-20': db === connection?.database
              }"
            >
              <a
                class="flex items-center justify-between"
                @click="switchDatabase(db)"
              >
                {{ db }}
                <svg
                  v-if="db === connection?.database"
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
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </a>
            </li>
          </ul>
        </div>
        <div class="modal-action">
          <button
            class="btn"
            @click="showDatabaseSwitcher = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { useConnectionsStore } from "@/store/connections";
import { useTabsStore } from "@/store/tabs";
import { useDatabaseStore } from "@/store/database";

const showAlert = inject("showAlert");

const tabsStore = useTabsStore();
const databaseStore = useDatabaseStore();

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
});

const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const showDatabaseSwitcher = ref(false);
const loadingDatabases = ref(false);
const availableDatabases = ref([]);

async function switchDatabase(databaseName) {
  if (!connection.value || databaseName === connection.value.database) {
    showDatabaseSwitcher.value = false;
    return;
  }

  try {
    await connectionsStore.updateConnection(props.connectionId, {
      database: databaseName
    });

    showDatabaseSwitcher.value = false;

    await tabsStore.closeAllTabs();

    await databaseStore.loadTables(props.connectionId);

    databaseStore.clearTableRecordCounts();

    window.location.reload();
  } catch (error) {
    console.error(`Failed to switch database: ${error.message}`, "error");
  }
}

async function loadAvailableDatabases() {
  if (!connection.value) {
    availableDatabases.value = [];
    return;
  }

  loadingDatabases.value = true;

  try {
    const result = await window.api.listDatabases({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password
    });

    if (result.success) {
      availableDatabases.value = result.databases;
    } else {
      showAlert(`Failed to load databases: ${result.message}`, "error");

      availableDatabases.value = [];
    }
  } catch (error) {
    showAlert(`Error loading databases: ${error.message}`, "error");
    availableDatabases.value = [];
  } finally {
    loadingDatabases.value = false;
  }
}

function handleGlobalKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openDatabaseSwitcher();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});

async function openDatabaseSwitcher() {
  showDatabaseSwitcher.value = true;
  await loadAvailableDatabases();
}
</script>
