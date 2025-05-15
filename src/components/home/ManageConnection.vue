<script setup lang="ts">
  import { inject, ref } from 'vue';
  import { v4 as uuid } from 'uuid';
  import { useConnectionsStore } from '@/store/connections';
  import Modal from '@/components/Modal.vue';
  import { ProjectConnection } from '@/types/project';
  import { Env } from '@/types/env';
  import { DockerInfo } from '@/types/docker-info';

  const connectionsStore = useConnectionsStore();

  const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

  const isSaving = ref(false);
  const isCreateModalOpen = ref(false);
  const isEditMode = ref(false);

  const defaultValues = {
    id: '',
    projectPath: '',
    name: '',
    type: 'mysql',
    icon: '',
    db_config: {
      database: '',
      host: 'localhost',
      port: 3306,
      user: '',
      password: '',
      connectTimeout: 10000,
    },
    redis_config: {
      port: 6379,
      host: 'localhost',
      password: '',
    },
    usingSail: false,
    status: 'ready',
    isValid: true,
    dockerInfo: null,
  };

  const newConnection = ref<ProjectConnection>(defaultValues);

  const editConnectionId = ref();
  const projectPathError = ref('');
  const dockerInfo = ref<DockerInfo | null>(null);

  async function saveNewConnection() {
    try {
      if (!newConnection.value.projectPath) {
        projectPathError.value = 'Project path is required';
        return;
      }

      if (
        !newConnection.value.name ||
        !newConnection ||
        !newConnection.value.db_config.database ||
        !newConnection.value.db_config.user
      ) {
        showAlert('Please fill all required fields', 'error');
        return;
      }

      const exists = connectionsStore.connections.some(
        conn =>
          (conn.projectPath === newConnection.value.projectPath ||
            conn.name === newConnection.value.name) &&
          conn.id !== editConnectionId.value
      );

      if (exists) {
        showAlert('A connection with this name or project path already exists', 'error');
        return;
      }

      isSaving.value = true;

      showAlert('Testing database connection...', 'info');

      const testResult = await window.ipcRenderer.testMySQLConnection({
        host: newConnection.value.db_config.host,
        port: newConnection.value.db_config.port,
        user: newConnection.value.db_config.user,
        password: newConnection.value.db_config.password,
        database: newConnection.value.db_config.database,
      });

      if (!testResult.success) {
        showAlert(`Connection failed: ${testResult.message}`, 'error');
        isSaving.value = false;
        return;
      }

      showAlert('Connection successful! Saving configuration...', 'success');

      const connectionData = {
        id: isEditMode.value ? editConnectionId.value : uuid(),
        projectPath: newConnection.value.projectPath,
        name: newConnection.value.name,
        type: newConnection.value.type,
        icon: newConnection.value.type.charAt(0).toUpperCase(),
        db_config: {
          database: newConnection.value.db_config.database,
          host: newConnection.value.db_config.host,
          port: newConnection.value.db_config.port,
          user: newConnection.value.db_config.user,
          password: newConnection.value.db_config.password,
          connectTimeout: 10000,
        },
        redis_config: {
          port: newConnection.value.redis_config.port,
          host: newConnection.value.redis_config.host,
          password: newConnection.value.redis_config.password,
        },
        usingSail: newConnection.value.usingSail,
        status: 'ready',
        isValid: true,
        dockerInfo: dockerInfo.value || null,
      };

      if (isEditMode.value) {
        await connectionsStore.updateConnection(editConnectionId.value, connectionData);

        showAlert('Connection updated successfully', 'success');
      } else {
        await connectionsStore.addConnection(connectionData);

        showAlert('Connection saved successfully', 'success');
      }

      isCreateModalOpen.value = false;
    } catch (error: any) {
      console.error('Error saving connection:', error);
      showAlert(`Error saving connection: ${error.message}`, 'error');
    } finally {
      isSaving.value = false;
    }
  }

  function editConnection(project: ProjectConnection) {
    isEditMode.value = true;
    editConnectionId.value = project.id;

    newConnection.value = {
      id: project.id,
      projectPath: project.projectPath,
      name: project.name,
      type: project.type,
      icon: project.type.charAt(0).toUpperCase(),
      db_config: {
        database: project.db_config.database,
        host: project.db_config.host,
        port: project.db_config.port,
        user: project.db_config.user,
        password: project.db_config.password,
        connectTimeout: 10000,
      },
      redis_config: {
        port: project.redis_config.port,
        host: project.redis_config.host,
        password: project.redis_config.password,
      },
      usingSail: project.usingSail,
      status: 'ready',
      isValid: true,
      dockerInfo: project.dockerInfo,
    };

    projectPathError.value = '';
    dockerInfo.value = project.dockerInfo as DockerInfo;
    isCreateModalOpen.value = true;
  }

  async function selectProjectDirectory() {
    try {
      const result = await window.ipcRenderer.selectDirectory();

      if (result.canceled) {
        return;
      }

      const selectedPath = result.filePaths[0];

      newConnection.value.projectPath = selectedPath;
      projectPathError.value = '';
      dockerInfo.value = {};

      const isLaravelProject = await window.ipcRenderer.validateLaravelProject(selectedPath);

      if (!isLaravelProject) {
        projectPathError.value =
          'The selected directory does not appear to be a valid Laravel project';
        return;
      }

      const envConfig: Env = await window.ipcRenderer.readEnvFile(selectedPath);

      if (envConfig) {
        if (!newConnection.value.name || newConnection.value.name === '') {
          newConnection.value.name = envConfig.APP_NAME || selectedPath.split('/').pop();
        }

        if (envConfig.DB_HOST === 'mysql') {
          newConnection.value.db_config.host = '0.0.0.0';
        }

        if (!newConnection.value.db_config.host || newConnection.value.db_config.host === '') {
          newConnection.value.db_config.host = envConfig.DB_HOST || 'localhost';
        }

        if (!newConnection.value.db_config.port) {
          newConnection.value.db_config.port = envConfig.DB_PORT || 3306;
        }

        if (
          !newConnection.value.db_config.database ||
          newConnection.value.db_config.database === ''
        ) {
          newConnection.value.db_config.database = envConfig.DB_DATABASE || '';
        }

        if (!newConnection.value.db_config.user || newConnection.value.db_config.user === '') {
          newConnection.value.db_config.user = envConfig.DB_USERNAME || 'root';
        }

        if (
          !newConnection.value.db_config.password ||
          newConnection.value.db_config.password === ''
        ) {
          newConnection.value.db_config.password = envConfig.DB_PASSWORD || '';
        }

        if (envConfig.REDIS_HOST === 'redis') {
          newConnection.value.redis_config.host = '0.0.0.0';
        }

        if (
          !newConnection.value.redis_config.host ||
          newConnection.value.redis_config.host === ''
        ) {
          newConnection.value.redis_config.host = envConfig.REDIS_HOST || '127.0.0.1';
        }

        if (
          !newConnection.value.redis_config.port ||
          newConnection.value.redis_config.port === ''
        ) {
          newConnection.value.redis_config.port = envConfig.REDIS_PORT || '6379';
        }

        if (
          !newConnection.value.redis_config.password ||
          newConnection.value.redis_config.password === 'null'
        ) {
          newConnection.value.redis_config.password = '';
        }

        if (envConfig.DOCKER_INFO) {
          dockerInfo.value = envConfig.DOCKER_INFO;
          newConnection.value.usingSail = !!envConfig.DOCKER_INFO.isDocker;
        }
      }
    } catch (error) {
      console.error(error);
      showAlert('Error selecting project directory', 'error');
    }
  }

  async function removeConnection(projectId: string) {
    if (
      confirm('Are you sure you want to delete this connection? All related data will be lost.')
    ) {
      try {
        await connectionsStore.removeConnection(projectId);

        showAlert('Connection and related data removed successfully', 'success');
      } catch (error) {
        console.error('Error removing connection:', error);
        showAlert('Error removing connection', 'error');
      }
    }
  }

  function openCreateConnectionModal() {
    isEditMode.value = false;
    editConnectionId.value = null;
    newConnection.value = defaultValues;

    projectPathError.value = '';
    dockerInfo.value = null;

    isCreateModalOpen.value = true;
  }

  defineExpose({ editConnection, removeConnection, openCreateConnectionModal });
</script>

<template>
  <Modal
    :show="isCreateModalOpen"
    :title="isEditMode ? 'Edit Connection' : 'Create New Connection'"
    @close="isCreateModalOpen = false"
  >
    <div>
      <fieldset class="fieldset mb-4 w-full">
        <label class="label">
          <span class="label-text">Laravel Project Path</span>
        </label>
        <div class="flex gap-2">
          <input
            v-model="newConnection.projectPath"
            type="text"
            placeholder="Select Laravel project directory"
            class="input w-full"
            :readonly="true"
          />
          <button class="btn btn-primary" @click="selectProjectDirectory">Browse</button>
        </div>
        <label v-if="projectPathError" class="label">
          <span class="label-text-alt text-error">{{ projectPathError }}</span>
        </label>
        <p class="text-base-content mt-1 text-xs">
          Path to your Laravel project (.env file will be read from this location)
        </p>
      </fieldset>

      <fieldset class="fieldset mb-4 w-full">
        <label class="label cursor-pointer">
          <span class="label-text">Using Laravel Sail?</span>
          <input v-model="newConnection.usingSail" type="checkbox" class="toggle toggle-primary" />
        </label>
        <p class="text-base-content mt-1 text-xs">
          Enable if your project uses Laravel Sail (Docker)
        </p>
      </fieldset>

      <div
        v-if="dockerInfo && !isEditMode"
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
            class="h-6 w-6 shrink-0 stroke-current"
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
            class="h-6 w-6 shrink-0 stroke-current"
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
            class="h-6 w-6 shrink-0 stroke-current"
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
            <p v-if="dockerInfo.isDocker" class="mt-1 text-sm">
              <span class="font-medium">Container: </span>{{ dockerInfo.dockerContainerName }}
            </p>
            <p class="mt-1 text-sm">
              <span v-if="dockerInfo.isDocker">
                The system detected a MySQL Docker container. Configuration has been automatically
                adjusted.
              </span>
              <span v-else-if="dockerInfo.dockerAvailable">
                Docker is available, but no MySQL container was found running on port
                {{ newConnection.db_config.port }}. A local connection will be used.
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
            class="input w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Database Type</span>
          </label>
          <select v-model="newConnection.type" class="select select-bordered w-full" disabled>
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
            v-model="newConnection.db_config.host"
            type="text"
            placeholder="localhost"
            class="input w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Port</span>
          </label>
          <input
            v-model="newConnection.db_config.port"
            type="text"
            placeholder="3306"
            class="input w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Database</span>
          </label>
          <input
            v-model="newConnection.db_config.database"
            type="text"
            placeholder="database"
            class="input w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Username</span>
          </label>
          <input
            v-model="newConnection.db_config.user"
            type="text"
            placeholder="root"
            class="input w-full"
            required
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Password</span>
          </label>
          <input
            v-model="newConnection.db_config.password"
            type="text"
            placeholder="password"
            class="input w-full"
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
            v-model="newConnection.redis_config.host"
            type="text"
            placeholder="127.0.0.1"
            class="input w-full"
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Redis Port</span>
          </label>
          <input
            v-model="newConnection.redis_config.port"
            type="text"
            placeholder="6379"
            class="input w-full"
          />
        </fieldset>

        <fieldset class="fieldset w-full">
          <label class="label">
            <span class="label-text">Redis Password</span>
          </label>
          <input
            v-model="newConnection.redis_config.password"
            type="text"
            placeholder="Leave empty if none"
            class="input w-full"
          />
        </fieldset>
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="isCreateModalOpen = false">Cancel</button>
      <button
        class="btn btn-primary"
        :disabled="isSaving || !newConnection.projectPath"
        @click="saveNewConnection"
      >
        <span v-if="isSaving" class="loading loading-spinner loading-xs mr-2" />
        {{ isEditMode ? 'Update Connection' : 'Save Connection' }}
      </button>
    </template>
  </Modal>
</template>
