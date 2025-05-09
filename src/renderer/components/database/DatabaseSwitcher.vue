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
      width="max-w-4xl"
      :show="showDatabaseSwitcher"
      title="Switch Database"
      @close="showDatabaseSwitcher = false"
      :show-cancel-button="true"
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
      <div v-else>
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm flex items-center gap-2">
            <div><span class="badge badge-sm badge-primary mr-1">Active</span> Current connection</div>
            <div v-if="connection?.projectPath"><span class="badge badge-sm badge-accent mr-1">ENV</span> Project .env file</div>
          </div>
          <button
            class="btn btn-xs btn-neutral"
            @click="showCreateDatabaseForm = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4 mr-1"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New Database
          </button>
        </div>

        <div
          v-if="showCreateDatabaseForm"
          class="bg-base-200 p-3 rounded-md mb-4"
        >
          <fieldset class="fieldset w-full">
            <label class="label">
              <span class="label-text">New Database Name</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="newDatabaseName"
                type="text"
                placeholder="Enter database name"
                class="input input-sm input-bordered w-full"
                :class="{ 'input-error': databaseNameError }"
                @keyup.enter="createDatabase"
              />
              <button
                class="btn btn-sm btn-primary"
                :disabled="!newDatabaseName || isCreatingDatabase"
                @click="createDatabase"
              >
                <span
                  v-if="isCreatingDatabase"
                  class="loading loading-spinner loading-xs"
                ></span>
                <span v-else>Create</span>
              </button>
              <button
                class="btn btn-sm btn-ghost"
                @click="showCreateDatabaseForm = false"
              >
                Cancel
              </button>
            </div>
            <label
              v-if="databaseNameError"
              class="label"
            >
              <span class="label-text-alt text-error">{{ databaseNameError }}</span>
            </label>
          </fieldset>
        </div>

        <div class="max-h-80 overflow-y-auto overflow-x-hidden mb-4">
          <div class="grid gap-2">
            <div
              v-for="db in availableDatabases"
              :key="db"
              class="bg-base-100 rounded border border-base-300 p-3"
              :class="{
                'bg-base-200': db === connection?.database,
                'border-l-4 border-l-accent': db === projectDatabase
              }"
            >
              <div class="flex items-center justify-between">
                <!-- Database name and badges -->
                <div class="flex items-center">
                  <span class="font-medium">{{ db }}</span>
                  <span
                    v-if="db === projectDatabase && db !== connection?.database"
                    class="ml-2 badge badge-sm badge-accent"
                    >ENV</span
                  >
                  <span
                    v-if="db === connection?.database && db === projectDatabase"
                    class="ml-2 badge badge-sm badge-success"
                    >ENV + Active</span
                  >
                  <span
                    v-else-if="db === connection?.database"
                    class="ml-2 badge badge-sm badge-primary"
                    >Active</span
                  >
                </div>

                <div class="flex gap-3">
                  <div
                    v-if="db !== connection?.database"
                    class="tooltip tooltip-left"
                    data-tip="Switch to this database"
                  >
                    <button
                      class="btn btn-circle btn-ghost btn-xs text-primary"
                      @click="switchDatabase(db, false)"
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
                          d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z"
                        />
                      </svg>
                    </button>
                  </div>
                  <div
                    v-if="connection?.projectPath && (db !== projectDatabase || db !== connection?.database)"
                    class="tooltip tooltip-left"
                    data-tip="Switch and update .env file"
                  >
                    <button
                      class="btn btn-circle btn-ghost btn-xs text-accent"
                      @click="switchDatabase(db, true)"
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
                          d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3"
                        />
                      </svg>
                    </button>
                  </div>
                  <div
                    v-if="db !== connection?.database"
                    class="tooltip tooltip-left"
                    data-tip="Delete database"
                  >
                    <button
                      class="btn btn-circle btn-ghost btn-xs text-error"
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
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
const projectDatabase = ref(null);
const showCreateDatabaseForm = ref(false);
const newDatabaseName = ref("");
const databaseNameError = ref("");
const isCreatingDatabase = ref(false);

async function switchDatabase(databaseName, shouldUpdateEnv) {
  if (!connection.value || (databaseName === connection.value.database && (!shouldUpdateEnv || databaseName === projectDatabase.value))) {
    return;
  }

  try {
    if (databaseName !== connection.value.database) {
      await connectionsStore.updateConnection(props.connectionId, {
        database: databaseName
      });

      await tabsStore.closeAllTabs();
      await databaseStore.loadTables(props.connectionId);
      databaseStore.clearTableRecordCounts();
    }

    if (shouldUpdateEnv && connection.value.projectPath && databaseName !== projectDatabase.value) {
      const result = await window.api.updateEnvDatabase(connection.value.projectPath, databaseName);

      if (result.success) {
        projectDatabase.value = databaseName;
        showAlert("Database updated in connection and .env file", "success");
      } else {
        showAlert(`Updated connection, but failed to update .env: ${result.message}`, "warning");
      }
    } else if (databaseName !== connection.value.database) {
      showAlert("Database connection updated successfully", "success");
    }

    showDatabaseSwitcher.value = false;
  } catch (error) {
    console.error(`Failed to switch database: ${error.message}`);
    showAlert(`Failed to switch database: ${error.message}`, "error");
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

  const hasExistingData = availableDatabases.value.length > 0;
  if (!hasExistingData) {
    loadingDatabases.value = true;
  }

  try {
    const result = await window.api.listDatabases({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password
    });

    if (result.success) {
      availableDatabases.value = result.databases;

      if (connection.value.projectPath) {
        await checkProjectDatabase();
      }
    } else {
      showAlert(`Failed to load databases: ${result.message}`, "error");
      if (!hasExistingData) {
        availableDatabases.value = [];
      }
    }
  } catch (error) {
    showAlert(`Error loading databases: ${error.message}`, "error");
    if (!hasExistingData) {
      availableDatabases.value = [];
    }
  } finally {
    loadingDatabases.value = false;
  }
}

async function checkProjectDatabase() {
  if (!connection.value || !connection.value.projectPath) {
    return;
  }

  try {
    const result = await window.api.compareProjectDatabase({
      projectPath: connection.value.projectPath,
      connectionDatabase: connection.value.database || ""
    });

    if (result.success) {
      projectDatabase.value = result.projectDatabase;
    } else {
      projectDatabase.value = null;
    }
  } catch (error) {
    console.error("Error checking project database:", error);
    projectDatabase.value = null;
  }
}

function handleGlobalKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openDatabaseSwitcher();
  }

  if (event.key === "Escape" && showCreateDatabaseForm.value) {
    showCreateDatabaseForm.value = false;
    newDatabaseName.value = "";
    databaseNameError.value = "";
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});

watch(
  () => connection.value?.projectPath,
  () => {
    if (connection.value?.projectPath) {
      checkProjectDatabase();
    } else {
      projectDatabase.value = null;
    }
  }
);

watch(showDatabaseSwitcher, (isOpen) => {
  if (!isOpen) {
    showCreateDatabaseForm.value = false;
    newDatabaseName.value = "";
    databaseNameError.value = "";
  }
});

async function openDatabaseSwitcher() {
  if (showDatabaseSwitcher.value) {
    if (connection.value) {
      await loadAvailableDatabases();
    }
  } else {
    showDatabaseSwitcher.value = true;
    if (connection.value) {
      await loadAvailableDatabases();
    }
  }
}

async function createDatabase() {
  if (!connection.value) return;

  if (!newDatabaseName.value.trim()) {
    databaseNameError.value = "Database name is required";
    return;
  }

  const nameRegex = /^[a-zA-Z0-9_]+$/;
  if (!nameRegex.test(newDatabaseName.value)) {
    databaseNameError.value = "Database name can only contain letters, numbers, and underscores";
    return;
  }

  if (availableDatabases.value.includes(newDatabaseName.value)) {
    databaseNameError.value = "Database already exists";
    return;
  }

  isCreatingDatabase.value = true;
  databaseNameError.value = "";

  try {
    const result = await window.api.createDatabase({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password,
      database: newDatabaseName.value
    });

    if (result.success) {
      await loadAvailableDatabases();
      showAlert(`Database ${newDatabaseName.value} created successfully`, "success");

      newDatabaseName.value = "";
      showCreateDatabaseForm.value = false;
    } else {
      databaseNameError.value = result.message || "Failed to create database";
    }
  } catch (error) {
    if (!databaseNameError.value) {
      databaseNameError.value = error.message || "An error occurred while creating the database";
    }
  } finally {
    isCreatingDatabase.value = false;
  }
}

defineExpose({ openDatabaseSwitcher });
</script>
