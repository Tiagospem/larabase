<template>
  <div
    class="modal"
    :class="{ 'modal-open': isCreateModalOpen }"
  >
    <div class="modal-box w-11/12 max-w-4xl max-h-[90vh]">
      <h3 class="font-bold text-lg mb-4">
        {{ isEditMode ? "Edit Connection" : "Create New Connection" }}
      </h3>

      <fieldset class="fieldset w-full mb-4">
        <label class="label">
          <span class="label-text">Laravel Project Path</span>
        </label>
        <div class="flex gap-2">
          <input
            v-model="newConnection.projectPath"
            type="text"
            placeholder="Select Laravel project directory"
            class="input  w-full"
            :readonly="true"
          />
          <button
            class="btn btn-primary"
            @click="selectProjectDirectory"
          >
            Browse
          </button>
        </div>
        <label
          v-if="projectPathError"
          class="label"
        >
          <span class="label-text-alt text-error">{{ projectPathError }}</span>
        </label>
        <p class="text-xs text-gray-500 mt-1">Path to your Laravel project (.env file will be read from this location)</p>
      </fieldset>

      <fieldset class="fieldset w-full mb-4">
        <label class="label cursor-pointer">
          <span class="label-text">Using Laravel Sail?</span>
          <input
            v-model="newConnection.usingSail"
            type="checkbox"
            class="toggle toggle-primary"
          />
        </label>
        <p class="text-xs text-gray-500 mt-1">Enable if your project uses Laravel Sail (Docker)</p>
      </fieldset>

      <div
        v-if="dockerInfo"
        :class="['alert mb-4', dockerInfo.isDocker ? 'alert-success' : !dockerInfo.isDocker && dockerInfo.dockerAvailable ? 'alert-warning' : 'alert-info']"
      >
        <div>
          <svg
            v-if="dockerInfo.isDocker"
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 w-6 h-6"
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
            class="stroke-current shrink-0 w-6 h-6"
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
            />
          </svg>
          <div>
            <span class="font-medium">Docker Detection:</span>
            <p>{{ dockerInfo.message }}</p>
            <p
              v-if="dockerInfo.isDocker"
              class="text-sm mt-1"
            >
              <span class="font-medium">Container: </span>{{ dockerInfo.dockerContainerName }}
            </p>
            <p class="text-sm mt-1">
              <span v-if="dockerInfo.isDocker"> The system detected a MySQL Docker container. Configuration has been automatically adjusted. </span>
              <span v-else-if="dockerInfo.dockerAvailable">
                Docker is available, but no MySQL container was found running on port
                {{ newConnection.value.port }}. A local connection will be used.
              </span>
              <span v-else> Docker was not detected. A local connection will be used. </span>
            </p>
          </div>
        </div>
      </div>

      <div class="divider">Database Connection</div>

      <div class="grid grid-cols-2 gap-4">
        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Connection Name</span>
          </label>
          <input
            v-model="newConnection.name"
            type="text"
            placeholder="My Project"
            class="input  w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Database Type</span>
          </label>
          <select
            v-model="newConnection.type"
            class="select select-bordered w-full"
            disabled
          >
            <option value="mysql">MySQL</option>
          </select>
          <label class="label">
            <span class="label-text-alt">Only MySQL is supported at the moment</span>
          </label>
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Host</span>
          </label>
          <input
            v-model="newConnection.host"
            type="text"
            placeholder="localhost"
            class="input  w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Port</span>
          </label>
          <input
            v-model="newConnection.port"
            type="text"
            placeholder="3306"
            class="input  w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Database</span>
          </label>
          <input
            v-model="newConnection.database"
            type="text"
            placeholder="mydatabase"
            class="input  w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Username</span>
          </label>
          <input
            v-model="newConnection.username"
            type="text"
            placeholder="root"
            class="input  w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Password</span>
          </label>
          <input
            v-model="newConnection.password"
            type="text"
            placeholder="password"
            class="input  w-full"
          />
        </fieldset>
      </div>

      <div class="divider">Redis Connection (Optional)</div>

      <div class="grid grid-cols-2 gap-4">
        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Redis Host</span>
          </label>
          <input
            v-model="newConnection.redisHost"
            type="text"
            placeholder="127.0.0.1"
            class="input  w-full"
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Redis Port</span>
          </label>
          <input
            v-model="newConnection.redisPort"
            type="text"
            placeholder="6379"
            class="input  w-full"
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Redis Password</span>
          </label>
          <input
            v-model="newConnection.redisPassword"
            type="text"
            placeholder="Leave empty if none"
            class="input  w-full"
          />
        </fieldset>
      </div>

      <div class="modal-action">
        <button
          class="btn"
          @click="isCreateModalOpen = false"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          :disabled="isLoading || !newConnection.projectPath"
          @click="saveNewConnection"
        >
          <span
            v-if="isSaving"
            class="loading loading-spinner loading-xs mr-2"
          />
          {{ isEditMode ? "Update Connection" : "Save Connection" }}
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="isCreateModalOpen = false"
    />
  </div>
</template>

<script setup>
import { inject, ref } from "vue";
import { v4 as uuid } from "uuid";
import { useConnectionsStore } from "@/store/connections";
import { useTabsStore } from "@/store/tabs";

const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();

const showAlert = inject("showAlert");

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  }
});

const isLoading = ref(props.isLoading.value);
const isSaving = ref(false);
const isCreateModalOpen = ref(false);
const isEditMode = ref(false);

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
  redisPassword: ""
});

const editConnectionId = ref(null);
const projectPathError = ref("");
const dockerInfo = ref(null);

async function saveNewConnection() {
  try {
    if (!newConnection.value.projectPath) {
      projectPathError.value = "Project path is required";
      return;
    }

    if (!newConnection.value.name || !newConnection.value.host || !newConnection.value.database || !newConnection.value.username) {
      showAlert("Please fill all required fields", "error");
      return;
    }

    const exists = connectionsStore.connections.some((conn) => (conn.projectPath === newConnection.value.projectPath || conn.name === newConnection.value.name) && conn.id !== editConnectionId.value);

    if (exists) {
      showAlert("A connection with this name or project path already exists", "error");
      return;
    }

    isSaving.value = true;
    showAlert("Testing database connection...", "info");

    const testResult = await window.api.testMySQLConnection({
      host: newConnection.value.host,
      port: parseInt(newConnection.value.port),
      username: newConnection.value.username,
      password: newConnection.value.password,
      database: newConnection.value.database
    });

    if (!testResult.success) {
      showAlert(`Connection failed: ${testResult.message}`, "error");
      isSaving.value = false;
      return;
    }

    showAlert("Connection successful! Saving configuration...", "success");

    const connectionData = {
      id: isEditMode.value ? editConnectionId.value : uuid(),
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
      isValid: true,

      dockerInfo: dockerInfo.value || null,
      redis: {
        host: newConnection.value.redisHost || "",
        port: parseInt(newConnection.value.redisPort || "6379"),
        password: newConnection.value.redisPassword || ""
      }
    };

    if (isEditMode.value) {
      await connectionsStore.updateConnection(editConnectionId.value, connectionData);
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
    redisPort: connection.redis?.port ? connection.redis.port.toString() : "6379",
    redisPassword: connection.redis?.password || ""
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

    const isLaravelProject = await window.api.validateLaravelProject(selectedPath);

    if (!isLaravelProject) {
      projectPathError.value = "The selected directory does not appear to be a valid Laravel project";
      return;
    }

    const envConfig = await window.api.readEnvFile(selectedPath);

    if (envConfig) {
      if (!newConnection.value.name || newConnection.value.name === "") {
        newConnection.value.name = envConfig.APP_NAME || selectedPath.split("/").pop();
      }

      if (!newConnection.value.host || newConnection.value.host === "") {
        newConnection.value.host = envConfig.DB_HOST || "localhost";
      }

      if (!newConnection.value.port || newConnection.value.port === "") {
        newConnection.value.port = envConfig.DB_PORT || "3306";
      }

      if (!newConnection.value.database || newConnection.value.database === "") {
        newConnection.value.database = envConfig.DB_DATABASE || "";
      }

      if (!newConnection.value.username || newConnection.value.username === "") {
        newConnection.value.username = envConfig.DB_USERNAME || "root";
      }

      if (!newConnection.value.password || newConnection.value.password === "") {
        newConnection.value.password = envConfig.DB_PASSWORD || "";
      }

      if (!newConnection.value.redisHost || newConnection.value.redisHost === "") {
        newConnection.value.redisHost = envConfig.REDIS_HOST || "127.0.0.1";
      }

      if (!newConnection.value.redisPort || newConnection.value.redisPort === "") {
        newConnection.value.redisPort = envConfig.REDIS_PORT || "6379";
      }

      if (!newConnection.value.redisPassword || newConnection.value.redisPassword === "") {
        newConnection.value.redisPassword = envConfig.REDIS_PASSWORD || "";
      }

      if (envConfig.dockerInfo) {
        dockerInfo.value = envConfig.dockerInfo;
        newConnection.value.usingSail = envConfig.dockerInfo.isDocker;

        if (envConfig.dockerInfo.isDocker) {
          newConnection.value.host = envConfig.DB_HOST === "localhost" ? "host.docker.internal" : envConfig.DB_HOST;
        }
      }
    }
  } catch (error) {
    console.error(error);
    showAlert("Error selecting project directory", "error");
  }
}

async function removeConnection(connectionId) {
  if (confirm("Are you sure you want to delete this connection? All related data will be lost.")) {
    try {
      await tabsStore.closeTabsByConnectionId(connectionId);

      const result = await window.api.removeConnection(connectionId);

      if (result.success) {
        await connectionsStore.loadConnections();
        showAlert("Connection and related data removed successfully", "success");
      } else {
        showAlert(`Error removing connection: ${result.message}`, "error");
      }
    } catch (error) {
      console.error("Error removing connection:", error);
      showAlert("Error removing connection", "error");
    }
  }
}

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
    redisPassword: ""
  };

  projectPathError.value = "";
  dockerInfo.value = null;

  isCreateModalOpen.value = true;
}

defineExpose({ editConnection, removeConnection, openCreateConnectionModal });
</script>
