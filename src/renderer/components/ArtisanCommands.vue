<template>
  <div class="modal modal-open z-30">
    <div class="modal-box w-11/12 max-w-3xl bg-base-300 max-h-[90vh]">
      <h3 class="font-bold text-lg mb-4">Laravel Migrations Manager</h3>

      <div class="space-y-4">
        <!-- Migration Commands Section -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-sm">Migration Commands</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                class="btn btn-sm btn-primary"
                :disabled="isLoading || !projectPath"
                @click="runMigration('migrate')"
              >
                <span
                  v-if="isLoading"
                  class="loading loading-spinner loading-xs mr-1"
                />
                Run Migrations
              </button>

              <button
                class="btn btn-sm btn-primary"
                :disabled="isLoading || !projectPath"
                @click="runMigration('migrate:fresh')"
              >
                <span
                  v-if="isLoading"
                  class="loading loading-spinner loading-xs mr-1"
                />
                Fresh Migration
              </button>

              <button
                class="btn btn-sm btn-primary"
                :disabled="isLoading || !projectPath"
                @click="runMigration('migrate:fresh --seed')"
              >
                <span
                  v-if="isLoading"
                  class="loading loading-spinner loading-xs mr-1"
                />
                Fresh Migration with Seeds
              </button>

              <button
                class="btn btn-sm btn-primary"
                :disabled="isLoading || !projectPath"
                @click="runMigration('migrate:status')"
              >
                <span
                  v-if="isLoading"
                  class="loading loading-spinner loading-xs mr-1"
                />
                Check Migration Status
              </button>
            </div>
            <!-- <div
              v-if="hasSail"
              class="form-control"
            >
              <label class="label cursor-pointer">
                <span class="label-text">Use Laravel Sail</span>
                <input
                  v-model="useSail"
                  type="checkbox"
                  class="toggle toggle-primary"
                  @change="refreshMigrationStatus"
                />
              </label>
            </div> -->
          </div>
        </div>

        <!-- Pending Migrations Section -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="card-title text-sm">Pending Migrations</h3>
              <button
                class="btn btn-xs btn-ghost"
                :disabled="isLoading"
                @click="refreshMigrationStatus"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                  :class="{ 'animate-spin': isLoading }"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
            </div>

            <div
              v-if="isLoading"
              class="flex justify-center py-4"
            >
              <span class="loading loading-spinner loading-md" />
            </div>

            <div
              v-else-if="pendingMigrations.length === 0"
              class="text-center py-2 text-gray-400"
            >
              <p>No pending migrations</p>
            </div>

            <div
              v-else
              class="overflow-x-auto"
            >
              <table class="table table-compact w-full">
                <thead>
                  <tr>
                    <th>Migration</th>
                    <th class="w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="migration in pendingMigrations"
                    :key="migration"
                  >
                    <td class="font-mono text-xs">
                      {{ formatMigrationName(migration) }}
                    </td>
                    <td>
                      <button
                        class="btn btn-xs btn-outline"
                        :disabled="isLoading"
                        @click="runSingleMigration(migration)"
                      >
                        <span
                          v-if="isLoading"
                          class="loading loading-spinner loading-xs mr-1"
                        />
                        Run
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="flex justify-end mt-4">
                <button
                  class="btn btn-sm btn-primary"
                  :disabled="isLoading || !projectPath"
                  @click="runMigration('migrate')"
                >
                  <span
                    v-if="isLoading"
                    class="loading loading-spinner loading-xs mr-1"
                  />
                  Run All Pending
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Migration Batches for Rollback -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-sm">Rollback Migrations</h3>

            <div
              v-if="isLoading"
              class="flex justify-center py-4"
            >
              <span class="loading loading-spinner loading-md" />
            </div>

            <div
              v-else-if="batches.length === 0"
              class="text-center py-2 text-gray-400"
            >
              <p>No migrations to rollback</p>
            </div>

            <div
              v-else
              class="space-y-4"
            >
              <fieldset class="fieldset w-full">
                <label class="label">
                  <span class="label-text">Rollback Strategy</span>
                </label>
                <select
                  v-model="selectedRollbackOption"
                  class="select select-bordered w-full"
                >
                  <option value="steps">Rollback by number of steps</option>
                  <option value="batch">Rollback specific batch</option>
                </select>
              </fieldset>

              <!-- Rollback por steps -->
              <div
                v-if="selectedRollbackOption === 'steps'"
                class="space-y-4"
              >
                <fieldset class="fieldset w-full">
                  <label class="label">
                    <span class="label-text">Number of steps to rollback</span>
                  </label>

                  <div class="flex gap-2 items-center">
                    <input
                      v-model.number="rollbackSteps"
                      type="range"
                      min="1"
                      max="20"
                      class="range range-primary range-sm flex-1"
                    />
                  </div>
                </fieldset>

                <div
                  v-if="rollbackSteps > 0"
                  class="p-2 bg-base-100 rounded-md"
                >
                  <div class="text-sm font-medium mb-2">
                    Migrations to be rolled back ({{ stepMigrations.length }}
                    migrations):
                  </div>
                  <div class="relative">
                    <ul
                      class="text-xs space-y-1 ml-2"
                      :class="{
                        'max-h-24 overflow-hidden': stepMigrations.length > 5 && !expandStepsMigrations
                      }"
                    >
                      <li
                        v-for="(migration, index) in stepMigrations"
                        :key="index"
                        class="font-mono"
                      >
                        {{ formatMigrationName(migration) }}
                      </li>
                    </ul>
                    <div
                      v-if="stepMigrations.length > 5 && !expandStepsMigrations"
                      class="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-base-100 to-transparent pointer-events-none"
                    />
                  </div>
                  <div
                    v-if="stepMigrations.length > 5"
                    class="mt-1"
                  >
                    <button
                      class="btn btn-xs btn-ghost w-full"
                      @click="expandStepsMigrations = !expandStepsMigrations"
                    >
                      {{ expandStepsMigrations ? "Show less" : `Show all (${stepMigrations.length})` }}
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-if="selectedRollbackOption === 'batch'"
                class="space-y-4"
              >
                <fieldset class="fieldset w-full">
                  <label class="label">
                    <span class="label-text">Select batch to rollback</span>
                  </label>
                  <select
                    v-model="selectedBatch"
                    class="select select-bordered w-full"
                  >
                    <option
                      v-for="batch in batches"
                      :key="batch.batch"
                      :value="batch.batch"
                    >
                      Batch #{{ batch.batch }} ({{ batch.migrations.length }}
                      migrations)
                    </option>
                  </select>
                </fieldset>

                <div
                  v-if="selectedBatch"
                  class="p-2 bg-base-100 rounded-md"
                >
                  <div class="text-sm font-medium mb-2">Migrations to be rolled back (Batch #{{ selectedBatch }}):</div>
                  <div class="relative">
                    <ul
                      class="text-xs space-y-1 ml-2"
                      :class="{
                        'max-h-24 overflow-hidden': batchMigrations.length > 5 && !expandBatchMigrations
                      }"
                    >
                      <li
                        v-for="(migration, index) in batchMigrations"
                        :key="index"
                        class="font-mono"
                      >
                        {{ formatMigrationName(migration) }}
                      </li>
                    </ul>
                    <div
                      v-if="batchMigrations.length > 5 && !expandBatchMigrations"
                      class="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-base-100 to-transparent pointer-events-none"
                    />
                  </div>
                  <div
                    v-if="batchMigrations.length > 5"
                    class="mt-1"
                  >
                    <button
                      class="btn btn-xs btn-ghost w-full"
                      @click="expandBatchMigrations = !expandBatchMigrations"
                    >
                      {{ expandBatchMigrations ? "Show less" : `Show all (${batchMigrations.length})` }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  class="btn btn-sm btn-error"
                  :disabled="isLoading || !projectPath"
                  @click="runRollback"
                >
                  <span
                    v-if="isLoading"
                    class="loading loading-spinner loading-xs mr-1"
                  />
                  Execute Rollback
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="projectPath"
          class="text-xs text-gray-400"
        >
          <span>Project: {{ projectPath }}</span>
        </div>
        <div
          v-else
          class="text-xs text-red-400"
        >
          <span>No Laravel project path configured. Please set a project path in the connection settings.</span>
        </div>
      </div>

      <div class="modal-action mt-6">
        <button
          class="btn"
          @click="close"
        >
          Close
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="close"
    />
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted } from "vue";
import { useConnectionsStore } from "@/store/connections";
import { useCommandsStore } from "@/store/commands";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  projectPath: {
    type: String,
    default: ""
  }
});

const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const emit = defineEmits(["close"]);

const showAlert = inject("showAlert");
const commandsStore = useCommandsStore();

const hasSail = ref(false);
const useSail = ref(false);
const isLoading = ref(false);
const pendingMigrations = ref([]);
const batches = ref([]);
const selectedRollbackOption = ref("steps");
const rollbackSteps = ref(1);
const selectedBatch = ref(null);
const expandStepsMigrations = ref(false);
const expandBatchMigrations = ref(false);

const stepMigrations = computed(() => {
  const migrationsWithMetadata = [];

  batches.value.forEach((batch) => {
    if (batch.migrations && Array.isArray(batch.migrations)) {
      batch.migrations.forEach((migration) => {
        migrationsWithMetadata.push({
          name: migration,

          timestamp: migration.substring(0, 14),
          batch: batch.batch
        });
      });
    }
  });

  migrationsWithMetadata.sort((a, b) => {
    if (a.batch !== b.batch) {
      return b.batch - a.batch;
    }

    return b.timestamp.localeCompare(a.timestamp);
  });

  const orderedMigrations = migrationsWithMetadata.map((item) => item.name);

  console.log("All migrations ordered by recency:", orderedMigrations);

  return orderedMigrations.slice(0, rollbackSteps.value);
});

const batchMigrations = computed(() => {
  if (!selectedBatch.value) return [];

  const batch = batches.value.find((b) => b.batch === selectedBatch.value);
  return batch ? batch.migrations : [];
});

function formatMigrationName(migration) {
  let name = migration.replace(/\.php$/, "");

  // Format timestamp_name to a more readable format
  const parts = name.split("_");
  if (parts.length >= 4 && parts[0].length === 4) {
    const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const restOfName = parts.slice(3).join("_");
    return `${dateStr} ${restOfName}`;
  }

  return name;
}

async function init() {
  if (!props.projectPath) return;

  useSail.value = connection.value.usingSail;

  try {
    await refreshMigrationStatus();
  } catch (error) {
    console.error("Error checking migration status:", error);
    showAlert("Error checking migration status", "error");
  }
}

async function refreshMigrationStatus() {
  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  isLoading.value = true;

  try {
    const result = await window.api.getMigrationStatus({
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    if (result.success) {
      console.log("Migration status result:", result);
      pendingMigrations.value = result.pendingMigrations || [];
      batches.value = result.batches || [];

      console.log("Batches receiveed:", batches.value);

      hasSail.value = result.hasSail || false;

      if (pendingMigrations.value.length === 0 && batches.value.length === 0) {
        console.log("No migrations found in the status output");
        if (result.output) {
          console.log("Raw output:", result.output);
        }
      }
    } else {
      console.error("Failed to get migration status:", result.message);
      showAlert(result.message || "Failed to get migration status", "error");
    }
  } catch (error) {
    console.error("Error getting migration status:", error);
    showAlert("Failed to get migration status", "error");
  } finally {
    isLoading.value = false;
  }
}

async function runMigration(command) {
  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  isLoading.value = true;

  try {
    await commandsStore.runArtisanCommand({
      command: command,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    await refreshMigrationStatus();

    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error("Error running migration command:", error);
    showAlert(`Failed to run migration: ${error.message}`, "error");
    isLoading.value = false;
  }
}

async function runSingleMigration(migration) {
  const migrationFileName = migration.includes(".php") ? migration : `${migration}.php`;

  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  isLoading.value = true;

  try {
    await commandsStore.runArtisanCommand({
      command: `migrate --path=database/migrations/${migrationFileName}`,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    await refreshMigrationStatus();

    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error("Error running migration command:", error);
    showAlert(`Failed to run migration: ${error.message}`, "error");
    isLoading.value = false;
  }
}

async function runRollback() {
  let command = "migrate:rollback";

  if (selectedRollbackOption.value === "steps" && rollbackSteps.value > 0) {
    command += ` --step=${rollbackSteps.value}`;
  } else if (selectedRollbackOption.value === "batch" && selectedBatch.value) {
    command = `migrate:rollback --batch=${selectedBatch.value}`;
  }

  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  isLoading.value = true;

  try {
    await commandsStore.runArtisanCommand({
      command: command,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    await refreshMigrationStatus();

    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error("Error running migration command:", error);
    showAlert(`Failed to run migration: ${error.message}`, "error");
    isLoading.value = false;
  }
}

function close() {
  emit("close");
}

onMounted(() => {
  init();
});

watch(
  () => props.projectPath,
  () => {
    init();
  }
);

watch(
  () => useSail.value,
  () => {
    refreshMigrationStatus();
  }
);

watch(
  () => selectedRollbackOption.value,
  () => {
    expandStepsMigrations.value = false;
    expandBatchMigrations.value = false;

    if (selectedRollbackOption.value === "batch" && batches.value.length > 0) {
      selectedBatch.value = batches.value[0].batch;
    } else if (selectedRollbackOption.value === "steps") {
      rollbackSteps.value = 1;
    }
  }
);

watch(
  () => batches.value,
  () => {
    expandStepsMigrations.value = false;
    expandBatchMigrations.value = false;

    if (selectedRollbackOption.value === "batch" && batches.value.length > 0) {
      selectedBatch.value = batches.value[0].batch;
    }
  },
  { immediate: true }
);
</script>
