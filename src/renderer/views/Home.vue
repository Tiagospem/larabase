<template>
  <div class="flex h-full">
    <div
      class="w-1/3 bg-[#e82b25] flex flex-col items-center justify-between p-6 border-r border-gray-800"
    >
      <div class="flex flex-col items-center">
        <img
          src="../assets/larabase-logo.png"
          alt="Larabase"
          class="h-32 w-32 mb-2"
        />
        <h1 class="text-3xl font-bold text-white">Larabase</h1>
        <p class="text-sm text-white">Version 1.0.0</p>
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
          <span class="loading loading-spinner loading-lg"></span>
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
          <p class="text-gray-500 mt-3">
            Create a new connection to get started
          </p>
        </div>

        <div v-else class="grid grid-cols-1 gap-3">
          <div
            v-for="connection in connectionsStore.connections"
            :key="connection.id"
            class="card bg-base-200 shadow-xl transition-colors border border-neutral hover:border-gray-500"
          >
            <div class="card-body py-4 px-5">
              <div class="flex items-center space-x-4">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center"
                  :class="getConnectionColor(connection.type)"
                >
                  <span class="text-white font-bold">{{
                    connection.icon
                  }}</span>
                </div>
                <div class="flex-1">
                  <h2 class="card-title text-base">
                    {{ connection.name }}
                    <span class="text-xs text-green-500 ml-1"
                      >{{ connection.status }}</span
                    >
                  </h2>
                  <p class="text-xs text-gray-400">
                    {{ connection.host || connection.path }}
                  </p>
                  <p class="text-xs font-medium text-white mt-1">
                    {{ connection.database }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm btn-ghost text-blue-400"
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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                      />
                    </svg>
                  </button>
                  <button
                    class="btn btn-sm btn-ghost text-green-500"
                    @click.stop="restoreDatabase(connection)"
                    title="Restore Database"
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
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                  </button>
                  <button
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
                  <button
                    class="btn btn-sm btn-ghost text-error"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal" :class="{ 'modal-open': isCreateModalOpen }">
      <div class="modal-box w-11/12 max-w-4xl">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Edit Connection" : "Create New Connection" }}
        </h3>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Laravel Project Path</span>
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              v-model="newConnection.projectPath"
              placeholder="Select Laravel project directory"
              class="input input-bordered w-full"
              :readonly="true"
            />
            <button class="btn btn-primary" @click="selectProjectDirectory">
              Browse
            </button>
          </div>
          <label class="label" v-if="projectPathError">
            <span class="label-text-alt text-error">{{
              projectPathError
            }}</span>
          </label>
          <p class="text-xs text-gray-500 mt-1">
            Path to your Laravel project (.env file will be read from this
            location)
          </p>
        </div>

        <div class="form-control w-full mb-4">
          <label class="label cursor-pointer">
            <span class="label-text">Using Laravel Sail?</span>
            <input
              type="checkbox"
              v-model="newConnection.usingSail"
              class="toggle toggle-primary"
            />
          </label>
          <p class="text-xs text-gray-500 mt-1">
            Enable if your project uses Laravel Sail (Docker)
          </p>
        </div>

        <div
          v-if="dockerInfo"
          :class="[
            'alert mb-4',
            dockerInfo.isDocker
              ? 'alert-success'
              : !dockerInfo.isDocker && dockerInfo.dockerAvailable
              ? 'alert-warning'
              : 'alert-info',
          ]"
        >
          <div>
            <svg
              v-if="dockerInfo.isDocker"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <svg
              v-else-if="dockerInfo.dockerAvailable"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="stroke-current shrink-0 w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <span class="font-medium">Docker Detection:</span>
              <p>{{ dockerInfo.message }}</p>
              <p v-if="dockerInfo.isDocker" class="text-sm mt-1">
                <span class="font-medium">Container: </span
                >{{ dockerInfo.dockerContainerName }}
              </p>
              <p class="text-sm mt-1">
                <span v-if="dockerInfo.isDocker">
                  The system detected a MySQL Docker container. Configuration
                  has been automatically adjusted.
                </span>
                <span v-else-if="dockerInfo.dockerAvailable">
                  Docker is available, but no MySQL container was found running
                  on port {{ newConnection.value.port }}. A local connection
                  will be used.
                </span>
                <span v-else>
                  Docker was not detected. A local connection will be used.
                </span>
              </p>
            </div>
          </div>
        </div>

        <div class="divider">Database Connection</div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Connection Name</span>
            </label>
            <input
              type="text"
              v-model="newConnection.name"
              placeholder="My Project"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Database Type</span>
            </label>
            <select
              class="select select-bordered w-full"
              v-model="newConnection.type"
              disabled
            >
              <option value="mysql">MySQL</option>
            </select>
            <label class="label">
              <span class="label-text-alt"
                >Only MySQL is supported at the moment</span
              >
            </label>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Host</span>
            </label>
            <input
              type="text"
              v-model="newConnection.host"
              placeholder="localhost"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Port</span>
            </label>
            <input
              type="text"
              v-model="newConnection.port"
              placeholder="3306"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Database</span>
            </label>
            <input
              type="text"
              v-model="newConnection.database"
              placeholder="mydatabase"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              type="text"
              v-model="newConnection.username"
              placeholder="root"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              type="password"
              v-model="newConnection.password"
              placeholder="password"
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <div class="divider">Redis Connection (Optional)</div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Host</span>
            </label>
            <input
              type="text"
              v-model="newConnection.redisHost"
              placeholder="127.0.0.1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Port</span>
            </label>
            <input
              type="text"
              v-model="newConnection.redisPort"
              placeholder="6379"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Password</span>
            </label>
            <input
              type="password"
              v-model="newConnection.redisPassword"
              placeholder="Leave empty if none"
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <div class="modal-action">
          <button class="btn" @click="isCreateModalOpen = false">Cancel</button>
          <button
            class="btn btn-primary"
            @click="saveNewConnection"
            :disabled="isLoading || !newConnection.projectPath"
          >
            <span
              v-if="isSaving"
              class="loading loading-spinner loading-xs mr-2"
            ></span>
            {{ isEditMode ? "Update Connection" : "Save Connection" }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="isCreateModalOpen = false"></div>
    </div>

    <div class="modal" :class="{ 'modal-open': isRestoreModalOpen }">
      <div class="modal-box w-11/12 max-w-4xl">
        <h3 class="font-bold text-lg mb-4">
          Restore Database: {{ restoreConfig.connection?.name }}
        </h3>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">SQL Dump File (.sql or .sql.gz)</span>
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              v-model="restoreConfig.filePath"
              placeholder="Select SQL dump file"
              class="input input-bordered w-full"
              :readonly="true"
            />
            <button
              class="btn btn-primary"
              @click="selectDumpFile"
              :disabled="isProcessingSql || isRestoring"
            >
              <span
                v-if="isProcessingSql"
                class="loading loading-spinner loading-xs mr-2"
              ></span>
              Browse
            </button>
          </div>
          <label class="label" v-if="restoreFileError">
            <span class="label-text-alt text-error">{{
              restoreFileError
            }}</span>
          </label>
          <p class="text-xs text-gray-500 mt-1">
            Select a .sql or .sql.gz file to restore
          </p>
        </div>

        <div
          v-if="isProcessingSql"
          class="my-4 flex items-center gap-2 text-info bg-base-300 p-3 rounded-md"
        >
          <span class="loading loading-spinner loading-sm"></span>
          <div>
            <p class="text-sm font-medium">{{ restoreStatus }}</p>
            <p class="text-xs mt-1">
              Please wait until the SQL file analysis is complete
            </p>
          </div>
        </div>

        <div
          v-else-if="restoreStatus && !isRestoring"
          class="my-4 text-sm text-info"
        >
          <p>{{ restoreStatus }}</p>
        </div>

        <div v-if="isRestoring" class="mb-4">
          <div class="w-full bg-gray-700 rounded-md h-2 mb-2">
            <div
              class="bg-primary h-2 rounded-md"
              :style="{ width: restoreProgress + '%' }"
            ></div>
          </div>
          <p class="text-sm">{{ restoreStatus }}</p>
        </div>

        <div class="form-control w-full mb-4">
          <label class="label cursor-pointer justify-start">
            <input
              type="checkbox"
              v-model="overwriteCurrentDb"
              class="checkbox checkbox-sm mr-2"
              :disabled="isRestoring || isProcessingSql"
            />
            <span class="label-text"
              >Restore to current database ({{
                restoreConfig.connection?.database
              }})</span
            >
          </label>
          <p class="text-xs text-gray-500 mt-1">
            The backup will overwrite your current database
          </p>
        </div>

        <div class="form-control w-full mb-4" v-if="!overwriteCurrentDb">
          <label class="label">
            <span class="label-text">Target Database Name</span>
          </label>
          <input
            type="text"
            v-model="restoreConfig.database"
            placeholder="Enter target database name"
            class="input input-bordered w-full"
            :disabled="isRestoring || isProcessingSql"
          />
          <label class="label">
            <span class="label-text-alt"
              >The backup will be restored to this new database</span
            >
          </label>
        </div>

        <div class="form-control w-full mb-4" v-if="!overwriteCurrentDb">
          <label class="label cursor-pointer justify-start">
            <input
              type="checkbox"
              v-model="restoreConfig.setAsDefault"
              class="checkbox checkbox-sm mr-2"
              :disabled="isRestoring || isProcessingSql"
            />
            <span class="label-text"
              >Set as default database for this connection</span
            >
          </label>
          <label class="label">
            <span class="label-text-alt"
              >If enabled, this database will be set as the default for future
              connections</span
            >
          </label>
        </div>

        <div
          v-if="restoreConfig.tables.length > 0"
          class="form-control w-full mb-4"
        >
          <label class="label">
            <span class="label-text">Tables to Ignore (Optional)</span>
          </label>

          <div class="mb-2">
            <input
              type="text"
              v-model="tableSearchQuery"
              placeholder="Search tables..."
              class="input input-bordered w-full input-sm"
              :disabled="isRestoring || isProcessingSql"
            />
          </div>

          <div
            class="h-48 overflow-y-auto bg-base-300 rounded-md p-2"
            :class="{ 'opacity-50': isRestoring || isProcessingSql }"
          >
            <div
              v-for="table in filteredTables"
              :key="table.name"
              class="form-control"
            >
              <label
                class="label cursor-pointer justify-start gap-2"
                :class="{ 'opacity-50': isRestoring || isProcessingSql }"
              >
                <input
                  type="checkbox"
                  v-model="restoreConfig.ignoredTables"
                  :value="table.name"
                  class="checkbox checkbox-sm"
                  :disabled="isRestoring || isProcessingSql"
                />
                <div class="flex items-center justify-between w-full">
                  <span class="label-text">{{ table.name }}</span>
                  <span
                    v-if="table.size"
                    class="text-xs px-2 py-0.5 rounded"
                    :class="getTableSizeClass(table.size)"
                  >
                    {{ table.size }}
                  </span>
                </div>
              </label>
            </div>
            <div
              v-if="filteredTables.length === 0"
              class="p-2 text-sm text-gray-400"
            >
              No tables match your search
            </div>
          </div>
          <label class="label">
            <span class="label-text-alt"
              >Select tables to ignore during restore</span
            >
          </label>
        </div>

        <div class="modal-action">
          <button class="btn" @click="closeRestoreModal">Cancel</button>
          <button class="btn btn-primary" @click="startRestore" 
            :disabled="isRestoring || isProcessingSql || !restoreConfig.filePath">
            <span v-if="isRestoring" class="loading loading-spinner loading-xs mr-2"></span>
            <span v-else-if="isProcessingSql" class="loading loading-spinner loading-xs mr-2"></span>
            Restore Database
          </button>
        </div>
      </div>
      <div class="modal-backdrop"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, inject, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";
import { useTabsStore } from "@/store/tabs";
import { v4 as uuidv4 } from "uuid";

const router = useRouter();
const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();

const showAlert = inject("showAlert");

const isLoading = computed(() => connectionsStore.isLoading);
const isSaving = ref(false);

const isCreateModalOpen = ref(false);
const isEditMode = ref(false);
const editConnectionId = ref(null);
const projectPathError = ref("");
const dockerInfo = ref(null);

const newConnection = ref({
  projectPath: "",
  name: "",
  type: "mysql",
  host: "",
  port: "3306",
  database: "",
  username: "",
  password: "",
  usingSail: false,
  redisHost: "",
  redisPort: "6379",
  redisPassword: "",
});

// Restore database modal state
const isRestoreModalOpen = ref(false);
const restoreFileError = ref("");
const isRestoring = ref(false);
const restoreProgress = ref(0);
const restoreStatus = ref("");
const restoreConfig = ref({
  connection: null,
  filePath: "",
  tables: [],
  ignoredTables: [],
  database: "",
  setAsDefault: false,
});

// Add loading state for SQL file processing
const isProcessingSql = ref(false);

// Table search functionality
const tableSearchQuery = ref("");
const filteredTables = computed(() => {
  if (!tableSearchQuery.value) {
    return restoreConfig.value.tables;
  }

  const query = tableSearchQuery.value.toLowerCase();
  return restoreConfig.value.tables.filter((table) => {
    if (typeof table === "string") {
      return table.toLowerCase().includes(query);
    } else if (table.name) {
      return table.name.toLowerCase().includes(query);
    }
    return false;
  });
});

const overwriteCurrentDb = ref(true); // Por padrão, restaurar no banco atual

onMounted(async () => {
  try {
    await connectionsStore.loadConnections();
  } catch (error) {
    console.error(error);
    showAlert(error, "error");
  }
});

function openCreateConnectionModal() {
  isEditMode.value = false;
  editConnectionId.value = null;
  newConnection.value = {
    projectPath: "",
    name: "",
    type: "mysql",
    host: "",
    port: "3306",
    database: "",
    username: "",
    password: "",
    usingSail: false,
    redisHost: "",
    redisPort: "6379",
    redisPassword: "",
  };

  // Limpar todas as mensagens de erro
  projectPathError.value = "";
  dockerInfo.value = null;

  // Abrir o modal
  isCreateModalOpen.value = true;
}

function editConnection(connection) {
  isEditMode.value = true;
  editConnectionId.value = connection.id;

  newConnection.value = {
    projectPath: connection.projectPath || "",
    name: connection.name || "",
    type: connection.type || "mysql",
    host: connection.host || "",
    port: connection.port ? connection.port.toString() : "3306",
    database: connection.database || "",
    username: connection.username || "",
    password: connection.password || "",
    usingSail: connection.usingSail || false,
    redisHost: connection.redis?.host || "",
    redisPort: connection.redis?.port
      ? connection.redis.port.toString()
      : "6379",
    redisPassword: connection.redis?.password || "",
  };

  projectPathError.value = "";
  dockerInfo.value = connection.dockerInfo || null;
  isCreateModalOpen.value = true;
}

async function selectProjectDirectory() {
  try {
    const result = await window.api.selectDirectory();

    if (result.canceled) {
      return;
    }

    const selectedPath = result.filePaths[0];
    newConnection.value.projectPath = selectedPath;
    projectPathError.value = "";
    dockerInfo.value = null;

    const isLaravelProject = await window.api.validateLaravelProject(
      selectedPath
    );

    if (!isLaravelProject) {
      projectPathError.value =
        "The selected directory does not appear to be a valid Laravel project";
      return;
    }

    const envConfig = await window.api.readEnvFile(selectedPath);

    if (envConfig) {
      if (!newConnection.value.name || newConnection.value.name === "") {
        newConnection.value.name =
          envConfig.APP_NAME || selectedPath.split("/").pop();
      }

      if (!newConnection.value.host || newConnection.value.host === "") {
        newConnection.value.host = envConfig.DB_HOST || "localhost";
      }

      if (!newConnection.value.port || newConnection.value.port === "") {
        newConnection.value.port = envConfig.DB_PORT || "3306";
      }

      if (
        !newConnection.value.database ||
        newConnection.value.database === ""
      ) {
        newConnection.value.database = envConfig.DB_DATABASE || "";
      }

      if (
        !newConnection.value.username ||
        newConnection.value.username === ""
      ) {
        newConnection.value.username = envConfig.DB_USERNAME || "root";
      }

      if (
        !newConnection.value.password ||
        newConnection.value.password === ""
      ) {
        newConnection.value.password = envConfig.DB_PASSWORD || "";
      }

      if (
        !newConnection.value.redisHost ||
        newConnection.value.redisHost === ""
      ) {
        newConnection.value.redisHost = envConfig.REDIS_HOST || "127.0.0.1";
      }

      if (
        !newConnection.value.redisPort ||
        newConnection.value.redisPort === ""
      ) {
        newConnection.value.redisPort = envConfig.REDIS_PORT || "6379";
      }

      if (
        !newConnection.value.redisPassword ||
        newConnection.value.redisPassword === ""
      ) {
        newConnection.value.redisPassword = envConfig.REDIS_PASSWORD || "";
      }

      // Definir o estado do Docker baseado na informação retornada
      if (envConfig.dockerInfo) {
        dockerInfo.value = envConfig.dockerInfo;
        newConnection.value.usingSail = envConfig.dockerInfo.isDocker;

        // Se for Docker, atualiza o host para o padrão do Docker
        if (envConfig.dockerInfo.isDocker) {
          newConnection.value.host =
            envConfig.DB_HOST === "localhost"
              ? "host.docker.internal"
              : envConfig.DB_HOST;
        }
      }
    }
  } catch (error) {
    console.error(error);
    showAlert("Error selecting project directory", "error");
  }
}

async function saveNewConnection() {
  try {
    // Verificar se o caminho do projeto está preenchido
    if (!newConnection.value.projectPath) {
      projectPathError.value = "Project path is required";
      return;
    }

    // Verificar campos obrigatórios
    if (
      !newConnection.value.name ||
      !newConnection.value.host ||
      !newConnection.value.database ||
      !newConnection.value.username
    ) {
      showAlert("Please fill all required fields", "error");
      return;
    }

    // Verificar se já existe uma conexão com o mesmo nome ou caminho
    const exists = connectionsStore.connections.some(
      (conn) =>
        (conn.projectPath === newConnection.value.projectPath ||
          conn.name === newConnection.value.name) &&
        conn.id !== editConnectionId.value
    );

    if (exists) {
      showAlert(
        "A connection with this name or project path already exists",
        "error"
      );
      return;
    }

    isSaving.value = true;
    showAlert("Testing database connection...", "info");

    const testResult = await window.api.testMySQLConnection({
      host: newConnection.value.host,
      port: parseInt(newConnection.value.port),
      username: newConnection.value.username,
      password: newConnection.value.password,
      database: newConnection.value.database,
    });

    if (!testResult.success) {
      showAlert(`Connection failed: ${testResult.message}`, "error");
      isSaving.value = false;
      return;
    }

    showAlert("Connection successful! Saving configuration...", "success");

    const connectionData = {
      id: isEditMode.value ? editConnectionId.value : uuidv4(),
      name: newConnection.value.name,
      type: newConnection.value.type,
      icon: newConnection.value.type.charAt(0).toUpperCase(),
      host: newConnection.value.host,
      port: parseInt(newConnection.value.port),
      database: newConnection.value.database,
      username: newConnection.value.username,
      password: newConnection.value.password,
      projectPath: newConnection.value.projectPath,
      usingSail: newConnection.value.usingSail,
      status: "ready",
      // Salvar informações do Docker se disponíveis
      dockerInfo: dockerInfo.value || null,
      redis: {
        host: newConnection.value.redisHost || "",
        port: parseInt(newConnection.value.redisPort || "6379"),
        password: newConnection.value.redisPassword || "",
      },
    };

    if (isEditMode.value) {
      await connectionsStore.updateConnection(
        editConnectionId.value,
        connectionData
      );
      showAlert("Connection updated successfully", "success");
    } else {
      await connectionsStore.addConnection(connectionData);
      showAlert("Connection saved successfully", "success");
    }

    isCreateModalOpen.value = false;
  } catch (error) {
    console.error("Error saving connection:", error);
    showAlert(`Error saving connection: ${error.message}`, "error");
  } finally {
    isSaving.value = false;
  }
}

async function removeConnection(connectionId) {
  if (
    confirm(
      "Are you sure you want to delete this connection? All related data will be lost."
    )
  ) {
    try {
      // Close tabs associated with this connection
      await tabsStore.closeTabsByConnectionId(connectionId);

      // Use the new remove-connection handler instead of directly modifying the store
      const result = await window.api.removeConnection(connectionId);

      if (result.success) {
        // Refresh the connections list
        await connectionsStore.loadConnections();
        showAlert(
          "Connection and related data removed successfully",
          "success"
        );
      } else {
        showAlert(`Error removing connection: ${result.message}`, "error");
      }
    } catch (error) {
      console.error("Error removing connection:", error);
      showAlert("Error removing connection", "error");
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

// Function to open restore modal
function restoreDatabase(connection) {
  restoreConfig.value = {
    connection: connection,
    filePath: "",
    tables: [],
    ignoredTables: [],
    database: "",
    setAsDefault: false,
  };

  restoreFileError.value = "";
  isRestoring.value = false;
  restoreProgress.value = 0;
  restoreStatus.value = "";
  isRestoreModalOpen.value = true;
  overwriteCurrentDb.value = true; // Reset para o valor padrão

  // We won't fetch tables from the database anymore
  // as we'll extract them from the SQL file when selected
}

// Function to select SQL dump file
async function selectDumpFile() {
  try {
    const result = await window.api.selectSqlDumpFile();

    if (result.canceled) {
      return;
    }

    const selectedPath = result.filePaths[0];

    // Validate file extension (.sql or .sql.gz)
    if (
      !selectedPath.toLowerCase().endsWith(".sql") &&
      !selectedPath.toLowerCase().endsWith(".gz") &&
      !selectedPath.toLowerCase().endsWith(".sql.gz")
    ) {
      restoreFileError.value =
        "Invalid file type. Please select a .sql or .sql.gz file";
      return;
    }

    restoreConfig.value.filePath = selectedPath;
    restoreFileError.value = "";

    // Extract tables from the SQL file
    isProcessingSql.value = true;
    restoreStatus.value = "Analyzing SQL file...";

    try {
      // Show message for large files
      const fileStats = await window.api.getFileStats(selectedPath);
      if (fileStats && fileStats.size) {
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
        if (fileSizeMB > 100) {
          restoreStatus.value = `Analyzing large SQL file (${fileSizeMB} MB). This may take a few minutes...`;
        } else {
          restoreStatus.value = `Analyzing SQL file (${fileSizeMB} MB)...`;
        }
      }

      // Extract tables from SQL file
      const tableResult = await window.api.extractTablesFromSql(selectedPath);

      if (
        tableResult.success &&
        tableResult.tables &&
        tableResult.tables.length > 0
      ) {
        restoreConfig.value.tables = tableResult.tables;
        restoreStatus.value = `${tableResult.tables.length} tables found in SQL file`;
      } else {
        restoreConfig.value.tables = [];
        restoreStatus.value =
          tableResult.message || "No tables found in SQL file";
      }
    } catch (extractError) {
      console.error("Error extracting tables:", extractError);
      restoreStatus.value = "Error extracting tables from file";
      restoreConfig.value.tables = [];
    } finally {
      isProcessingSql.value = false;
    }
  } catch (error) {
    isProcessingSql.value = false;
    console.error(error);
    showAlert("Error selecting SQL dump file", "error");
  }
}

// Function to start the restore process
async function startRestore() {
  if (!restoreConfig.value.filePath || !restoreConfig.value.connection) {
    showAlert("Please select a SQL dump file", "error");
    return;
  }

  // Verificar se um nome de banco foi informado quando não está usando o banco atual
  if (!overwriteCurrentDb.value && !restoreConfig.value.database) {
    showAlert("Please enter a target database name", "error");
    return;
  }

  try {
    isRestoring.value = true;
    restoreStatus.value = "Starting database restoration...";
    restoreProgress.value = 10;

    // First update status in UI
    const updateStatus = (status, progress) => {
      restoreStatus.value = status;
      if (progress) restoreProgress.value = progress;
    };

    // Simple manual progress updates at key steps
    updateStatus("Preparing restoration...", 20);

    // Determinar qual banco de dados usar
    let targetDatabase;
    if (overwriteCurrentDb.value) {
      // Usar o banco atual da conexão
      targetDatabase = restoreConfig.value.connection.database;
    } else {
      // Usar o banco informado pelo usuário
      targetDatabase = restoreConfig.value.database;
    }

    // Use simple parameters without complex objects, functions or circular references
    const simpleConfig = {
      connectionId: restoreConfig.value.connection.id,
      filePath: restoreConfig.value.filePath,
      ignoredTables: [...restoreConfig.value.ignoredTables], // Make a copy to avoid references
      database: targetDatabase,
      setAsDefault:
        !overwriteCurrentDb.value && restoreConfig.value.setAsDefault, // Somente quando não usa o banco atual
    };

    // Wait 300ms to let UI update
    await new Promise((resolve) => setTimeout(resolve, 300));
    updateStatus("Analyzing database configuration...", 30);

    // Use timeout to simulate progress (since we can't easily get real progress)
    let timeoutIds = [];

    timeoutIds.push(
      setTimeout(() => {
        if (isRestoring.value) updateStatus("Reading SQL file...", 40);
      }, 1000)
    );

    timeoutIds.push(
      setTimeout(() => {
        if (isRestoring.value)
          updateStatus("Executing restore commands...", 50);
      }, 3000)
    );

    timeoutIds.push(
      setTimeout(() => {
        if (isRestoring.value) updateStatus("Processing SQL statements...", 70);
      }, 6000)
    );

    // Call a very simple API method without callbacks
    const result = await window.api.simpleDatabaseRestore(simpleConfig);

    // Clear any remaining timeouts
    timeoutIds.forEach((id) => clearTimeout(id));

    if (result.success) {
      updateStatus("Database restored successfully!", 100);
      showAlert("Database restored successfully", "success");
      isRestoring.value = false;
      isRestoreModalOpen.value = false;

      // Update the connection with the new database if necessary
      if (
        !overwriteCurrentDb.value &&
        restoreConfig.value.setAsDefault &&
        targetDatabase !== restoreConfig.value.connection.database
      ) {
        await updateConnectionDatabase(
          restoreConfig.value.connection.id,
          targetDatabase
        );
      }
    } else {
      throw new Error(result.message || "Unknown error during restoration");
    }
  } catch (error) {
    console.error("Error restoring database:", error);
    restoreStatus.value = `Error: ${error.message}`;
    restoreProgress.value = 0;
    isRestoring.value = false;
    showAlert(`Error restoring database: ${error.message}`, "error");
  }
}

// Helper function to update the connection's database name
async function updateConnectionDatabase(connectionId, newDatabase) {
  try {
    const result = await window.api.updateConnectionDatabase(
      connectionId,
      newDatabase
    );
    if (result.success) {
      // Reload connections list to reflect the change
      await connectionsStore.loadConnections();
      showAlert(`Connection database updated to ${newDatabase}`, "success");
    }
  } catch (error) {
    console.error("Failed to update connection database:", error);
    showAlert(
      "Database restored, but failed to update connection settings",
      "warning"
    );
  }
}

// Function to close modal and kill any running process
function closeRestoreModal() {
  if (isRestoring.value) {
    // Always confirm when canceling an active restoration
    if (confirm('Are you sure you want to cancel the database restoration?')) {
      // Cancel restoration process and cleanup
      window.api.cancelDatabaseRestore(restoreConfig.value.connection.id);
      isRestoring.value = false;
      restoreProgress.value = 0;
      showAlert('Database restoration cancelled', 'info');
      
      // Close the modal and reset state
      isRestoreModalOpen.value = false;
      tableSearchQuery.value = '';
    }
    // If user cancels confirmation, don't close modal or stop restoration
    return;
  }
  
  // If not restoring, just close the modal
  isRestoreModalOpen.value = false;
  tableSearchQuery.value = '';
}

// Function to get CSS class based on table size
function getTableSizeClass(size) {
  switch (size) {
    case "empty":
      return "bg-gray-500 text-white";
    case "small":
      return "bg-green-500 text-white";
    case "medium":
      return "bg-yellow-500 text-white";
    case "large":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-700 text-white";
  }
}
</script>
