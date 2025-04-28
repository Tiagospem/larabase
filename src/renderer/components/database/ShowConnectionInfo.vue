<template>
  <div>
    <h1 class="text-lg font-semibold">
      {{ connection?.name }}
    </h1>
    <div class="text-xs flex items-center">
      <span>{{ connection?.database || connection?.path }}</span>
      <button
        class="ml-1"
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

      <div
        v-if="!databaseMatch && connection?.projectPath && !isLoading"
        class="ml-2 flex items-center text-amber-400"
      >
        <div
          class="tooltip tooltip-bottom"
          :data-tip="comparisonTooltip"
        >
          <span class="text-error">Mismatch project database</span>
        </div>
        <div
          class="tooltip tooltip-bottom"
          data-tip="Update database in .env file"
        >
          <button
            class="ml-1 text-error"
            @click="updateProjectEnv"
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
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </div>
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
          <p v-if="connection.projectPath">
            <span class="font-semibold">Project Path:</span>
            {{ connection.projectPath }}
          </p>
          <p v-if="projectDatabase && connection.database">
            <span class="font-semibold">Project Database: </span>
            <span :class="{ 'text-warning': !databaseMatch, 'text-success': databaseMatch }">
              {{ projectDatabase }}
            </span>
          </p>
        </div>
      </div>
      <div class="modal-action">
        <button
          v-if="!databaseMatch && connection?.projectPath"
          class="btn btn-warning"
          @click="updateProjectEnv"
        >
          Update Database in .env
        </button>
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
import { computed, ref, onMounted, watch, inject } from "vue";
import { useConnectionsStore } from "@/store/connections";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
});

const showAlert = inject("showAlert");

const connectionsStore = useConnectionsStore();
const showConnectionInfo = ref(false);
const isLoading = ref(false);
const databaseMatch = ref(true);
const projectDatabase = ref(null);
const comparisonResult = ref(null);

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const comparisonTooltip = computed(() => {
  if (!connection.value || !connection.value.projectPath || !connection.value.database) {
    return "Error checking project database";
  }

  if (!projectDatabase.value) {
    return "Project database not found";
  }

  return `Project database: ${projectDatabase.value}`;
});

async function checkProjectDatabase() {
  if (!connection.value || !connection.value.projectPath || !connection.value.database) {
    databaseMatch.value = true;
    return;
  }

  isLoading.value = true;

  try {
    const result = await window.api.compareProjectDatabase({
      projectPath: connection.value.projectPath,
      connectionDatabase: connection.value.database
    });

    comparisonResult.value = result;

    if (result.success) {
      databaseMatch.value = result.isMatch;
      projectDatabase.value = result.projectDatabase;
    } else {
      databaseMatch.value = true;
      projectDatabase.value = null;
    }
  } catch (error) {
    console.error("Error checking project database:", error);
    databaseMatch.value = true;
  } finally {
    isLoading.value = false;
  }
}

async function updateProjectEnv() {
  if (!connection.value || !connection.value.projectPath || !connection.value.database) {
    return;
  }

  try {
    const result = await window.api.updateEnvDatabase(connection.value.projectPath, connection.value.database);

    if (result.success) {
      databaseMatch.value = true;
      projectDatabase.value = connection.value.database;
      showAlert("Database updated in .env file successfully!", "success");
    } else {
      showAlert(`Error updating database: ${result.message}`, "error");
    }
  } catch (error) {
    console.error("Error updating project database:", error);
    showAlert(`Error updating database: ${error.message}`, "error");
  }
}

watch(
  () => props.connectionId,
  () => {
    checkProjectDatabase();
  }
);

watch(
  () => connection.value?.projectPath,
  () => {
    checkProjectDatabase();
  }
);

watch(
  () => connection.value?.database,
  () => {
    checkProjectDatabase();
  }
);

onMounted(() => {
  checkProjectDatabase();
});
</script>
