<template>
  <div class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box max-w-4xl bg-base-300">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Project Logs</h3>
        <div class="flex gap-2">
          <button v-if="props.projectPath" class="btn btn-sm" @click="refreshLogs">
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
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
          <button
            v-if="props.projectPath"
            class="btn btn-sm"
            title="Open log file in editor"
            @click="openLogFile"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </button>
          <button
            v-if="props.projectPath && logs.length > 0"
            class="btn btn-sm btn-primary"
            @click="confirmDeleteAllLogs"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- Project Path Missing Message -->
      <div v-if="!props.projectPath" class="py-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto mb-4 text-gray-400"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p class="text-lg font-semibold mb-2">No Laravel Project Path Set</p>
        <p class="text-gray-400 mb-4">
          To view logs, you need to set a Laravel project path for this connection.
        </p>
        <button class="btn btn-primary" @click="selectProject">Select Laravel Project</button>
      </div>

      <!-- Debugging Info when file exists but no logs parsed -->
      <div v-else-if="props.projectPath && logs.length === 0" class="py-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto mb-4 text-gray-400"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p class="text-lg font-semibold mb-2">No Logs Found</p>
        <p class="text-gray-400 mb-4">The log file might exist, but no parsable logs were found.</p>
      </div>

      <!-- Log Content when project path is available and logs exist -->
      <div v-else-if="logs.length > 0">
        <!-- Log filters -->
        <div class="flex mb-4 gap-2">
          <select v-model="logTypeFilter" class="select select-sm select-bordered">
            <option value="all">All Log Types</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search logs..."
            class="input input-sm input-bordered flex-1"
          />
        </div>

        <!-- Logs table -->
        <div class="overflow-x-auto max-h-[60vh]">
          <table class="table table-xs w-full">
            <thead>
              <tr>
                <th class="w-28">Timestamp</th>
                <th class="w-24">Type</th>
                <th>Message</th>
                <th class="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in filteredLogs" :key="index" class="hover:bg-base-200">
                <td class="text-xs">
                  {{ formatTimestamp(log.timestamp) }}
                </td>
                <td>
                  <span class="badge" :class="getLogTypeBadgeClass(log.type)">
                    {{ log.type }}
                  </span>
                </td>
                <td class="truncate max-w-md" :title="log.message">
                  {{ log.message }}
                </td>
                <td class="text-right">
                  <button class="btn btn-xs btn-ghost" @click="viewLogDetails(log)">
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
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="filteredLogs.length === 0">
                <td colspan="4" class="text-center py-4 text-gray-500">No logs found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-primary" @click="close">Close</button>
      </div>
    </div>
  </div>

  <!-- Log details modal -->
  <div class="modal" :class="{ 'modal-open': showLogDetails }">
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg flex items-center">
        Log Details
        <span v-if="selectedLog" class="badge ml-2" :class="getLogTypeBadgeClass(selectedLog.type)">
          {{ selectedLog?.type }}
        </span>
      </h3>
      <div v-if="selectedLog" class="py-4">
        <p class="text-sm mb-2">
          <span class="font-semibold">Timestamp:</span>
          {{ formatTimestamp(selectedLog.timestamp, true) }}
        </p>
        <p class="text-sm mb-2"><span class="font-semibold">File:</span> {{ selectedLog.file }}</p>
        <div
          class="bg-base-200 p-3 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap font-mono text-sm"
        >
          {{ selectedLog.message }}
        </div>
        <div v-if="selectedLog.stack" class="mt-4">
          <p class="font-semibold mb-1">Stack Trace:</p>
          <div
            class="bg-base-200 p-3 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap font-mono text-xs"
          >
            {{ selectedLog.stack }}
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn btn-primary" @click="showLogDetails = false">Close</button>
      </div>
    </div>
  </div>

  <!-- Confirm delete modal -->
  <div class="modal" :class="{ 'modal-open': showDeleteConfirm }">
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Confirm Action</h3>
      <p class="py-4">Are you sure you want to delete all logs? This action cannot be undone.</p>
      <div class="modal-action">
        <button class="btn btn-error" @click="deleteAllLogs">Delete All</button>
        <button class="btn" @click="showDeleteConfirm = false">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  connectionId: {
    type: String,
    required: true
  },
  projectPath: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'select-project']);
const showAlert = inject('showAlert');

const logs = ref([]);
const searchQuery = ref('');
const logTypeFilter = ref('all');
const showLogDetails = ref(false);
const selectedLog = ref(null);
const showDeleteConfirm = ref(false);

const filteredLogs = computed(() => {
  let filtered = [...logs.value];

  if (logTypeFilter.value !== 'all') {
    filtered = filtered.filter(log => log.type === logTypeFilter.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      log => log.message.toLowerCase().includes(query) || log.type.toLowerCase().includes(query)
    );
  }

  return filtered.sort((a, b) => b.timestamp - a.timestamp);
});

function formatTimestamp(timestamp, detailed = false) {
  const date = new Date(timestamp);
  if (detailed) {
    return date.toLocaleString();
  }
  return date.toLocaleTimeString();
}

function getLogTypeBadgeClass(type) {
  switch (type.toLowerCase()) {
    case 'error':
      return 'badge-error';
    case 'warning':
      return 'badge-warning';
    case 'info':
      return 'badge-info';
    case 'debug':
      return 'badge-ghost';
    default:
      return 'badge-secondary';
  }
}

function viewLogDetails(log) {
  selectedLog.value = log;
  showLogDetails.value = true;
}

function confirmDeleteAllLogs() {
  showDeleteConfirm.value = true;
}

async function deleteAllLogs() {
  try {
    if (!props.projectPath) return;

    const result = await window.api.clearAllProjectLogs({ projectPath: props.projectPath });

    if (result.success) {
      logs.value = [];
      showDeleteConfirm.value = false;
      showAlert(`Cleared ${result.clearedFiles || 'all'} log files`, 'success');
    } else {
      console.error('Failed to clear log files:', result.message);
      showAlert(`Failed to clear logs: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error clearing log files:', error);
  }
}

function selectProject() {
  emit('select-project');
}

async function openLogFile() {
  try {
    if (!props.projectPath) return;

    let logFilePath = `${props.projectPath}/storage/logs/laravel.log`;

    if (logs.value.length > 0 && logs.value[0].file && logs.value[0].file !== 'error') {
      logFilePath = `${props.projectPath}/storage/logs/${logs.value[0].file}`;
    }

    console.log('Opening log file:', logFilePath);
    await window.api.openFile(logFilePath);
  } catch (error) {
    console.error('Error opening log file:', error);
  }
}

async function refreshLogs() {
  try {
    if (!props.projectPath) {
      logs.value = [];
      return;
    }

    console.log('Refreshing logs with project path:', props.projectPath);
    const response = await window.api.getProjectLogs({ projectPath: props.projectPath });
    console.log('Got logs response:', response);
    logs.value = response || [];
  } catch (error) {
    console.error('Failed to load logs:', error);
    logs.value = [];
  }
}

function close() {
  emit('close');
}

watch(
  () => props.projectPath,
  newPath => {
    if (newPath) {
      refreshLogs();
    }
  }
);

watch(
  () => props.isOpen,
  newValue => {
    if (newValue && props.projectPath) {
      refreshLogs();
    }
  }
);

onMounted(() => {
  if (props.projectPath) {
    refreshLogs();
  }
});
</script>

<style scoped>
.modal-box {
  width: 90%;
  max-width: 900px;
}
</style>
