<script setup lang="ts">
  import Modal from '@/components/Modal.vue';
  import { ref, onMounted, onBeforeUnmount, toRaw } from 'vue';
  import { useConnectionsStore } from '@/store/connections';
  import { useTabsStore } from '@/store/tabs';
  import { useSidebarStore } from '@/store/sidebar';

  const emit = defineEmits(['close']);

  const connectionsStore = useConnectionsStore();
  const tabsStore = useTabsStore();
  const sidebarStore = useSidebarStore();

  const isLoading = ref(true);
  const logs = ref<any[]>([]);
  const maxLogs = 500;
  const error = ref<string | null>(null);
  const isMonitoring = ref(false);
  const selectedLog = ref<any | null>(null);
  const showDetailsModal = ref(false);

  function formatDetails(details: string): string {
    if (!details) return '';

    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return details;
    }
  }

  function viewLogDetails(log: any) {
    selectedLog.value = log;
    showDetailsModal.value = true;
  }

  async function startMonitoring(clearHistory = false) {
    const projectId = connectionsStore.projectId;
    if (!projectId) return;

    try {
      isLoading.value = true;
      error.value = null;

      if (clearHistory) {
        logs.value = [];
      }

      const project = connectionsStore.connections.find(p => p.id === projectId);

      if (!project) {
        error.value = 'Project not found';
        isLoading.value = false;
        return;
      }

      const result = await window.ipcRenderer.startLiveDbUpdate({
        connectionId: projectId,
        dbConnection: toRaw(project.db_config),
        clearHistory,
      });

      if (!result.success) {
        error.value = result.message;
        isLoading.value = false;
        return;
      }

      isMonitoring.value = true;
    } catch (err: any) {
      error.value = err.message || 'Failed to start monitoring';
    } finally {
      isLoading.value = false;
    }
  }

  async function clearHistory() {
    const projectId = connectionsStore.projectId;
    if (!projectId) return;

    try {
      isLoading.value = true;
      error.value = null;

      const result = await window.ipcRenderer.invoke('clear-db-history', projectId);

      if (!result.success) {
        error.value = result.message;

        if (result.connectionLost) {
          isMonitoring.value = false;
          const shouldRestart = confirm(
            'Database connection was lost. Would you like to restart monitoring?'
          );
          if (shouldRestart) {
            await startMonitoring(true);
          }
        }

        isLoading.value = false;
        return;
      }

      logs.value = [];
    } catch (err: any) {
      error.value = err.message || 'Failed to clear history';
    } finally {
      isLoading.value = false;
    }
  }

  function formatTimestamp(timestamp: string) {
    if (!timestamp) return '';

    const date = new Date(timestamp);

    return date.toLocaleTimeString();
  }

  function formatFullDate(timestamp: string) {
    if (!timestamp) return '';

    const date = new Date(timestamp);

    return date.toLocaleString();
  }

  function getActionBadgeClass(action: string) {
    switch (action) {
      case 'INSERT':
        return 'badge-success';
      case 'UPDATE':
        return 'badge-info';
      case 'DELETE':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  }

  async function openTableWithFilter(tableName: string, recordId: string) {
    if (!recordId || recordId === 'no-id') return;

    const table = sidebarStore.sortedTables.find(t => t.name === tableName);

    if (table) {
      await tabsStore.openTable(table, `id = '${recordId}'`);
    }
  }

  function setupListeners() {
    const projectId = connectionsStore.projectId;
    if (!projectId) return;

    window.ipcRenderer.on(`db-operation-${projectId}`, (_, record) => {
      logs.value.unshift(record);

      if (logs.value.length > maxLogs) {
        logs.value = logs.value.slice(0, maxLogs);
      }
    });

    window.ipcRenderer.on(`db-operation-clear-${projectId}`, () => {
      logs.value = [];
    });
  }

  function cleanupListeners() {
    const projectId = connectionsStore.projectId;
    if (!projectId) return;

    window.ipcRenderer.removeAllListeners(`db-operation-${projectId}`);
    window.ipcRenderer.removeAllListeners(`db-operation-clear-${projectId}`);
  }

  function handleClose() {
    emit('close');
    cleanupAndReset();
  }

  async function cleanupAndReset() {
    try {
      cleanupListeners();

      const projectId = connectionsStore.projectId;
      if (projectId) {
        await window.ipcRenderer.invoke('stop-db-monitoring', projectId);
      }

      isMonitoring.value = false;
      isLoading.value = true;
      error.value = null;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  onMounted(() => {
    isMonitoring.value = false;
    isLoading.value = true;
    error.value = null;

    setupListeners();
    startMonitoring(false);
  });

  onBeforeUnmount(() => {
    cleanupAndReset();
  });
</script>

<template>
  <Modal :show="true" title="Database Activity Monitor" @close="handleClose" :show-footer="false">
    <div class="database-monitor">
      <div class="mb-4 flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <div
            class="badge-xs badge"
            :class="isLoading ? 'badge-warning' : isMonitoring ? 'badge-success' : 'badge-error'"
          >
            <span v-if="isLoading">Loading</span>
            <span v-else-if="isMonitoring">Monitoring</span>
            <span v-else>Inactive</span>
          </div>
          <span class="text-sm opacity-70">{{ logs.length }} events recorded</span>
        </div>

        <div class="flex gap-2">
          <button
            @click="clearHistory"
            class="btn btn-sm btn-ghost btn-outline"
            :disabled="isLoading || logs.length === 0"
          >
            Clear history
          </button>
        </div>
      </div>

      <div v-if="error" class="alert alert-error mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ error }}</span>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center p-10">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <div v-else-if="logs.length === 0" class="card bg-base-200">
        <div class="card-body items-center text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-12 w-12 opacity-50"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <h2 class="card-title">No database activity yet</h2>
          <p>Perform database operations to see them appear here</p>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table-compact table-zebra table w-full text-sm">
          <thead>
            <tr>
              <th>Action</th>
              <th>Table</th>
              <th>Record ID</th>
              <th>Time</th>
              <th>View</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, index) in logs" :key="log.id || index" class="hover">
              <td>
                <div class="badge badge-xs" :class="getActionBadgeClass(log.action_type)">
                  {{ log.action_type }}
                </div>
              </td>
              <td>
                <div class="font-medium">{{ log.table_name }}</div>
              </td>
              <td>
                <div class="flex items-center justify-between">
                  <span v-if="log.record_id && log.record_id !== 'no-id'" class="font-medium">
                    {{ log.record_id }}
                  </span>
                  <span v-else class="opacity-50">{{ log.record_id }}</span>
                </div>
              </td>
              <td class="whitespace-nowrap">
                <span :title="formatFullDate(log.created_at)">{{
                  formatTimestamp(log.created_at)
                }}</span>
              </td>
              <td>
                <button
                  class="btn btn-xs btn-ghost btn-circle"
                  @click="viewLogDetails(log)"
                  title="View details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </td>
              <td>
                <button
                  v-if="log.record_id && log.record_id !== 'no-id'"
                  @click.stop="openTableWithFilter(log.table_name, log.record_id)"
                  class="shrink-0 cursor-pointer"
                >
                  <svg
                    class="h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Modal>

  <Modal
    v-if="showDetailsModal"
    :show="showDetailsModal"
    title="Database Operation Details"
    @close="showDetailsModal = false"
  >
    <div v-if="selectedLog" class="p-1">
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="card-title flex items-center gap-2 text-base">
              <div class="badge badge-xs" :class="getActionBadgeClass(selectedLog.action_type)">
                {{ selectedLog.action_type }}
              </div>
              Operation
            </h3>
            <div class="text-sm">
              <p><span class="font-medium">Table:</span> {{ selectedLog.table_name }}</p>
              <p><span class="font-medium">Record ID:</span> {{ selectedLog.record_id }}</p>
              <p>
                <span class="font-medium">Time:</span> {{ formatFullDate(selectedLog.created_at) }}
              </p>
            </div>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="card-title text-base">Actions</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="selectedLog.record_id && selectedLog.record_id !== 'no-id'"
                @click="
                  openTableWithFilter(selectedLog.table_name, selectedLog.record_id);
                  showDetailsModal = false;
                "
                class="btn btn-sm btn-primary gap-1"
              >
                <svg
                  class="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Open in Table
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body p-4">
          <h3 class="card-title text-base">Details</h3>
          <div class="bg-base-300 rounded-lg p-3 text-sm">
            <pre class="break-words whitespace-pre-wrap">{{
              formatDetails(selectedLog.details)
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  .database-monitor {
    min-height: 300px;
  }
</style>
