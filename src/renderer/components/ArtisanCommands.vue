<template>
  <div class="modal modal-open z-30">
    <div class="modal-box w-11/12 max-w-3xl bg-base-300">
      <h3 class="font-bold text-lg mb-4">Laravel Migrations Manager</h3>
      
      <div class="space-y-4">
        <!-- Migration Commands Section -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <h3 class="card-title text-sm">Migration Commands</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button 
                @click="runMigration('migrate')" 
                class="btn btn-sm btn-outline"
                :disabled="isLoading || !projectPath">
                <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                Run Migrations
              </button>
              
              <button 
                @click="runMigration('migrate:fresh')" 
                class="btn btn-sm btn-outline"
                :disabled="isLoading || !projectPath">
                <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                Fresh Migration
              </button>
              
              <button 
                @click="runMigration('migrate:fresh --seed')" 
                class="btn btn-sm btn-outline"
                :disabled="isLoading || !projectPath">
                <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                Fresh Migration with Seeds
              </button>
              
              <button 
                @click="runMigration('migrate:status')" 
                class="btn btn-sm btn-outline"
                :disabled="isLoading || !projectPath">
                <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                Check Migration Status
              </button>
            </div>
            
            <div class="form-control" v-if="hasSail">
              <label class="label cursor-pointer">
                <span class="label-text">Use Laravel Sail</span>
                <input type="checkbox" v-model="useSail" class="toggle toggle-primary" @change="refreshMigrationStatus"/>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Pending Migrations Section -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="card-title text-sm">Pending Migrations</h3>
              <button 
                @click="refreshMigrationStatus" 
                class="btn btn-xs btn-ghost" 
                :disabled="isLoading">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                  stroke="currentColor" class="w-4 h-4" :class="{ 'animate-spin': isLoading }">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
            
            <div v-if="isLoading" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-md"></span>
            </div>
            
            <div v-else-if="pendingMigrations.length === 0" class="text-center py-2 text-gray-400">
              <p>No pending migrations</p>
            </div>
            
            <div v-else class="overflow-x-auto">
              <table class="table table-compact w-full">
                <thead>
                  <tr>
                    <th>Migration</th>
                    <th class="w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="migration in pendingMigrations" :key="migration">
                    <td class="font-mono text-xs">{{ formatMigrationName(migration) }}</td>
                    <td>
                      <button 
                        @click="runSingleMigration(migration)" 
                        class="btn btn-xs btn-outline"
                        :disabled="isLoading">
                        <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                        Run
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div class="flex justify-end mt-4">
                <button 
                  @click="runMigration('migrate')" 
                  class="btn btn-sm btn-primary"
                  :disabled="isLoading || !projectPath">
                  <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
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
            
            <div v-if="isLoading" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-md"></span>
            </div>
            
            <div v-else-if="batches.length === 0" class="text-center py-2 text-gray-400">
              <p>No migrations to rollback</p>
            </div>
            
            <div v-else class="space-y-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">Rollback Options</span>
                </label>
                <select class="select select-bordered w-full" v-model="selectedRollbackOption">
                  <option value="last">Rollback last batch</option>
                  <option value="steps">Rollback specific steps</option>
                </select>
              </div>
              
              <div v-if="selectedRollbackOption === 'steps'" class="form-control w-full">
                <label class="label">
                  <span class="label-text">Number of steps to rollback</span>
                </label>
                <select class="select select-bordered w-full" v-model="rollbackSteps">
                  <option v-for="i in Math.min(5, batches.length)" :key="i" :value="i">
                    {{ i }} {{ i === 1 ? 'step' : 'steps' }}
                  </option>
                </select>
              </div>
              
              <div class="collapse collapse-arrow bg-base-200">
                <input type="checkbox" /> 
                <div class="collapse-title text-sm font-medium">
                  Batches ({{ batches.length }} total)
                </div>
                <div class="collapse-content"> 
                  <div class="overflow-x-auto">
                    <table class="table table-compact w-full">
                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Migrations</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="batch in batches" :key="batch.batch">
                          <td class="font-semibold">{{ batch.batch }}</td>
                          <td class="font-mono text-xs">
                            {{ formatMigrationsList(batch.migrations) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div class="flex justify-end">
                <button 
                  @click="runRollback" 
                  class="btn btn-sm btn-error"
                  :disabled="isLoading || !projectPath">
                  <span v-if="isLoading" class="loading loading-spinner loading-xs mr-1"></span>
                  Execute Rollback
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="projectPath" class="text-xs text-gray-400">
          <span>Project: {{ projectPath }}</span>
        </div>
        <div v-else class="text-xs text-red-400">
          <span>No Laravel project path configured. Please set a project path in the connection settings.</span>
        </div>
      </div>
      
      <div class="modal-action mt-6">
        <button class="btn" @click="close">Close</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="close"></div>
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted } from 'vue';
import { useCommandsStore } from '@/store/commands';

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  projectPath: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

const showAlert = inject('showAlert');
const commandsStore = useCommandsStore();

const hasSail = ref(false);
const useSail = ref(false);
const isLoading = ref(false);
const pendingMigrations = ref([]);
const batches = ref([]);
const selectedRollbackOption = ref('last');
const rollbackSteps = ref(1);

// Helper to format migration names for display
function formatMigrationName(migration) {
  // Remove .php extension if present
  let name = migration.replace(/\.php$/, '');
  
  // Format timestamp_name to a more readable format
  const parts = name.split('_');
  if (parts.length >= 4 && parts[0].length === 4) {
    // Assuming the first 4 parts form a timestamp (YYYY_MM_DD_HHMMSS)
    const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const restOfName = parts.slice(3).join('_');
    return `${dateStr} ${restOfName}`;
  }
  
  return name;
}

// Helper to format a list of migrations
function formatMigrationsList(migrations) {
  if (!migrations || migrations.length === 0) return '';
  
  return migrations
    .map(formatMigrationName)
    .join(', ');
}

async function checkForSail() {
  if (!props.projectPath) return;
  
  try {
    await refreshMigrationStatus();
  } catch (error) {
    console.error('Error checking migration status:', error);
    showAlert('Error checking migration status', 'error');
  }
}

async function refreshMigrationStatus() {
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
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
      pendingMigrations.value = result.pendingMigrations || [];
      batches.value = result.batches || [];
      hasSail.value = result.hasSail || false;
    } else {
      showAlert(result.message || 'Failed to get migration status', 'error');
    }
  } catch (error) {
    console.error('Error getting migration status:', error);
    showAlert('Failed to get migration status', 'error');
  } finally {
    isLoading.value = false;
  }
}

async function runMigration(command) {
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
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
    
    // Close the modal after a short delay to ensure the output panel is shown first
    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error('Error running migration command:', error);
    showAlert(`Failed to run migration: ${error.message}`, 'error');
    isLoading.value = false;
  }
}

async function runSingleMigration(migration) {
  // For single migrations, don't append .php as it's likely already included
  // in the migration name from the status output
  const migrationPath = `database/migrations/${migration}`;
  
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
    return;
  }
  
  isLoading.value = true;
  
  try {
    await commandsStore.runArtisanCommand({
      command: `migrate --path=${migrationPath}`,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });
    
    // Close the modal after a short delay to ensure the output panel is shown first
    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error('Error running migration command:', error);
    showAlert(`Failed to run migration: ${error.message}`, 'error');
    isLoading.value = false;
  }
}

async function runRollback() {
  let command = 'migrate:rollback';
  
  if (selectedRollbackOption.value === 'steps' && rollbackSteps.value > 0) {
    command += ` --step=${rollbackSteps.value}`;
  }
  
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
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
    
    // Close the modal after a short delay to ensure the output panel is shown first
    setTimeout(() => {
      close();
    }, 300);
  } catch (error) {
    console.error('Error running migration command:', error);
    showAlert(`Failed to run migration: ${error.message}`, 'error');
    isLoading.value = false;
  }
}

function close() {
  emit('close');
}

// Check for migration status when component is mounted
onMounted(() => {
  checkForSail();
});

// Watch for project path changes
watch(() => props.projectPath, () => {
  checkForSail();
});

// Watch for sail option changes
watch(() => useSail.value, () => {
  refreshMigrationStatus();
});
</script> 