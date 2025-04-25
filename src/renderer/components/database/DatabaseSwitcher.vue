<template>
  <div>
    <Modal
      width="w-lg"
      :show="showConfirmation"
      title="Delete Database"
      @close="showConfirmation = false"
      @action="deleteDatabase"
      :show-footer="true"
      :showActionButton="true"
      :is-loading-action="deletingDatabase"
    >
      <p class="py-4">
        Are you sure you want to delete database <span class="font-bold">{{ databaseToDelete }}</span
        >? This action cannot be undone.
      </p>
    </Modal>

    <Modal
      width="w-lg"
      :show="showDatabaseSwitcher"
      title="Switch Database"
      @close="showDatabaseSwitcher = false"
    >
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
        <ul class="menu bg-base-200 rounded-box w-full flex gap-2">
          <li
            v-for="db in availableDatabases"
            :key="db"
            class="rounded-lg"
            :class="{
              'bg-primary text-neutral': db === connection?.database
            }"
          >
            <a
              class="flex items-center justify-between"
              @click="switchDatabase(db)"
            >
              <span>{{ db }}</span>
              <div class="w-4 flex justify-end">
                <button
                  v-if="db !== connection?.database"
                  class="btn btn-ghost btn-xs text-error p-0"
                  @click.stop="confirmDelete(db)"
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
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
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
              </div>
            </a>
          </li>
        </ul>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { useConnectionsStore } from "@/store/connections";
import { useTabsStore } from "@/store/tabs";
import { useDatabaseStore } from "@/store/database";
import Modal from "@/components/Modal.vue";

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
const showConfirmation = ref(false);
const databaseToDelete = ref("");
const deletingDatabase = ref(false);

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

    //window.location.reload();
  } catch (error) {
    console.error(`Failed to switch database: ${error.message}`, "error");
  }
}

function confirmDelete(databaseName) {
  databaseToDelete.value = databaseName;
  showDatabaseSwitcher.value = false;
  showConfirmation.value = true;
}

async function deleteDatabase() {
  if (!connection.value || !databaseToDelete.value) {
    showConfirmation.value = false;
    return;
  }

  deletingDatabase.value = true;

  try {
    const result = await window.api.dropDatabase({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password,
      database: databaseToDelete.value
    });

    if (result.success) {
      showAlert(`Database ${databaseToDelete.value} deleted successfully`, "success");

      // Remove the database from the list
      availableDatabases.value = availableDatabases.value.filter((db) => db !== databaseToDelete.value);
    } else {
      showAlert(`Failed to delete database: ${result.message}`, "error");
    }
  } catch (error) {
    showAlert(`Error deleting database: ${error.message}`, "error");
  } finally {
    deletingDatabase.value = false;
    showConfirmation.value = false;
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

defineExpose({ openDatabaseSwitcher });
</script>
