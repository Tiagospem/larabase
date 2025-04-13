<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadMigrations">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      
      <div v-if="!isLoading" class="flex items-center space-x-2">
        <span class="text-xs text-gray-400">{{ migrations.length }} migrations found</span>
        
        <button v-if="!connection?.projectPath" 
                @click="selectProjectPath" 
                class="btn btn-sm btn-ghost" 
                title="Select Laravel project">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else-if="loadError" class="flex items-center justify-center h-full text-error">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p>{{ loadError }}</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadMigrations">Try again</button>
        </div>
      </div>
      
      <div v-else-if="!connection?.projectPath" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          <p>No Laravel project path is associated with this connection</p>
          <button class="btn btn-sm btn-primary mt-4" @click="selectProjectPath">Select Project</button>
        </div>
      </div>
      
      <div v-else-if="migrations.length === 0" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
          </svg>
          <p>No migrations found for {{ tableName }} table</p>
          <button v-if="connection?.projectPath" class="btn btn-sm btn-ghost mt-4" @click="loadMigrations">Reload</button>
        </div>
      </div>
      
      <div v-else class="p-4">
        <div class="collapse-group">
          <div v-for="migration in migrations" :key="migration.id" 
               class="collapse collapse-arrow bg-base-200 mb-2">
            <input type="checkbox" />
            <div class="collapse-title font-medium flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" :class="getMigrationStatusDotClass(migration.status)"></div>
                <span>{{ migration.displayName || migration.name }}</span>
              </div>
              <div class="badge badge-sm" :class="getMigrationStatusClass(migration.status)">
                {{ migration.status }}
              </div>
            </div>
            <div class="collapse-content">
              <div class="text-sm text-gray-400 mb-2">{{ migration.created_at }}</div>
              <div class="divider my-2"></div>
              <div>
                <h4 class="font-medium mb-2">Changes</h4>
                <div class="space-y-2">
                  <div v-for="(action, actionIndex) in migration.actions" :key="actionIndex" 
                    class="bg-base-300 p-2 rounded-md">
                    <div class="flex items-center space-x-2">
                      <div class="badge badge-sm" :class="getActionTypeClass(action.type)">{{ action.type }}</div>
                      <span class="text-sm">{{ action.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mt-4 flex justify-end space-x-2">
                <button class="btn btn-sm btn-ghost" @click="viewMigrationCode(migration)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                    stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  View Code
                </button>
                <button v-if="migration.path" class="btn btn-sm btn-ghost" @click="openFileInEditor(migration.path)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Open File
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="migrations.length > 0" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ migrations.length }} migrations</div>
      <div>
        <span v-if="migrations.length">Latest: {{ migrations[0].created_at }}</span>
      </div>
    </div>

    <div v-if="selectedMigration" class="modal modal-open">
      <div class="modal-box w-11/12 max-w-5xl max-h-[90vh]">
        <h3 class="font-bold text-lg mb-4">Migration: {{ selectedMigration.displayName || selectedMigration.name }}</h3>
        <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
          <pre><code>{{ selectedMigration.code }}</code></pre>
        </div>
        <div class="modal-action">
          <button class="btn" @click="selectedMigration = null">Close</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="selectedMigration = null"></div>
    </div>
  </div>
</template>

<script setup>
import {inject, onMounted, ref, computed} from 'vue';
import {useDatabaseStore} from '@/store/database';
import {useConnectionsStore} from '@/store/connections';

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  onLoad: {
    type: Function,
    required: true
  }
});

// State
const isLoading = ref(true);
const migrations = ref([]);
const loadError = ref(null);
const selectedMigration = ref(null);

const databaseStore = useDatabaseStore();
const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

// Methods
function getMigrationStatusClass(status) {
  switch(status) {
    case 'APPLIED':
      return 'badge-success';
    case 'PENDING':
      return 'badge-warning';
    case 'FAILED':
      return 'badge-error';
    default:
      return 'badge-ghost';
  }
}

function getMigrationStatusDotClass(status) {
  switch (status) {
    case 'APPLIED':
      return 'bg-success';
    case 'PENDING':
      return 'bg-warning';
    case 'FAILED':
      return 'bg-error';
    default:
      return 'bg-gray-400';
  }
}

function getActionTypeClass(type) {
  switch(type) {
    case 'CREATE':
      return 'badge-success';
    case 'ALTER':
      return 'badge-warning';
    case 'DROP':
      return 'badge-error';
    case 'ADD':
      return 'badge-info';
    case 'FOREIGN KEY':
      return 'badge-primary';
    default:
      return 'badge-ghost';
  }
}

function viewMigrationCode(migration) {
  selectedMigration.value = migration;
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();
    
    if (result.canceled) {
      return;
    }
    
    const projectPath = result.filePaths[0];

    const isLaravel = await window.api.validateLaravelProject(projectPath);
    
    if (!isLaravel) {
      showAlert('Selected directory is not a valid Laravel project', 'error');
      return;
    }

    if (connection.value) {
      const updatedConnections = connectionsStore.connections.map(conn => {
        if (conn.id === connection.value.id) {
          return { ...conn, projectPath };
        }
        return conn;
      });
      
      await connectionsStore.saveConnections(updatedConnections);
      showAlert('Laravel project path set successfully', 'success');
      await loadMigrations();
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
    showAlert('Failed to select project directory', 'error');
  }
}

async function openFileInEditor(path) {
  try {
    await window.api.openFile(path);
  } catch (error) {
    console.error('Error opening file:', error);
    showAlert('Failed to open file', 'error');
  }
}

async function loadMigrations() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    // Use the store's getTableMigrations method
    migrations.value = await databaseStore.getTableMigrations(props.connectionId, props.tableName, true);
    
    // Notify parent component
    props.onLoad({
      migrationCount: migrations.value.length
    });
    
  } catch (error) {
    loadError.value = 'Failed to load migrations: ' + (error.message || 'Unknown error');
    showAlert(`Error loading migrations: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(() => {
  loadMigrations();
});
</script>

<style scoped>
.timeline-box {
  width: 100%;
  max-width: none;
}

/* Custom timeline styling */
.timeline-vertical::before {
  left: 50%;
}

.timeline-start {
  place-items: end;
  grid-column-start: 1;
  grid-column-end: 5;
  text-align: left;
}

.timeline-middle {
  grid-column-start: 5;
  grid-column-end: 7;
}

.timeline-end {
  grid-column-start: 7;
  grid-column-end: 11;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 640px) {
  .timeline-box {
    width: calc(100% - 1rem);
  }
}
</style> 