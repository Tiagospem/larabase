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
                  <span class="label-text">Rollback Strategy</span>
                </label>
                <select class="select select-bordered w-full" v-model="selectedRollbackOption">
                  <option value="steps">Rollback by number of steps</option>
                  <option value="batch">Rollback specific batch</option>
                </select>
              </div>
              
              <!-- Rollback por steps -->
              <div v-if="selectedRollbackOption === 'steps'" class="space-y-4">
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text">Number of steps to rollback</span>
                  </label>
                  
                  <!-- Exibir um slider e input para escolher qualquer número de steps -->
                  <div class="flex gap-2 items-center">
                    <input 
                      type="range" 
                      min="1" 
                      max="20" 
                      v-model.number="rollbackSteps" 
                      class="range range-primary range-sm flex-1"
                    />
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      v-model.number="rollbackSteps" 
                      class="input input-bordered w-20 text-center"
                    />
                  </div>
                  
                  <div class="text-xs text-gray-500 mt-1">
                    O Laravel executará o rollback das últimas {{ rollbackSteps }} migrações, independente dos batches.
                  </div>
                </div>
                
                <!-- Preview das migrações afetadas pelo rollback de steps -->
                <div v-if="rollbackSteps > 0" class="p-2 bg-base-100 rounded-md">
                  <div class="text-sm font-medium mb-2">
                    Migrations to be rolled back ({{ stepMigrations.length }} migrations):
                  </div>
                  <div class="relative">
                    <ul class="text-xs space-y-1 ml-2"
                        :class="{ 'max-h-24 overflow-hidden': stepMigrations.length > 5 && !expandStepsMigrations }">
                      <li v-for="(migration, index) in stepMigrations" :key="index" class="font-mono">
                        {{ formatMigrationName(migration) }}
                      </li>
                    </ul>
                    <div v-if="stepMigrations.length > 5 && !expandStepsMigrations" 
                         class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-base-100 to-transparent pointer-events-none"></div>
                  </div>
                  <div class="mt-1" v-if="stepMigrations.length > 5">
                    <button @click="expandStepsMigrations = !expandStepsMigrations"
                            class="btn btn-xs btn-ghost w-full">
                      {{ expandStepsMigrations ? 'Show less' : `Show all (${stepMigrations.length})` }}
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Rollback por batch específico -->
              <div v-if="selectedRollbackOption === 'batch'" class="space-y-4">
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text">Select batch to rollback</span>
                  </label>
                  <select class="select select-bordered w-full" v-model="selectedBatch">
                    <option v-for="batch in batches" :key="batch.batch" :value="batch.batch">
                      Batch #{{ batch.batch }} ({{ batch.migrations.length }} migrations)
                    </option>
                  </select>
                </div>
                
                <!-- Preview das migrações afetadas pelo rollback de batch -->
                <div v-if="selectedBatch" class="p-2 bg-base-100 rounded-md">
                  <div class="text-sm font-medium mb-2">
                    Migrations to be rolled back (Batch #{{ selectedBatch }}):
                  </div>
                  <div class="relative">
                    <ul class="text-xs space-y-1 ml-2"
                        :class="{ 'max-h-24 overflow-hidden': batchMigrations.length > 5 && !expandBatchMigrations }">
                      <li v-for="(migration, index) in batchMigrations" :key="index" class="font-mono">
                        {{ formatMigrationName(migration) }}
                      </li>
                    </ul>
                    <div v-if="batchMigrations.length > 5 && !expandBatchMigrations" 
                         class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-base-100 to-transparent pointer-events-none"></div>
                  </div>
                  <div class="mt-1" v-if="batchMigrations.length > 5">
                    <button @click="expandBatchMigrations = !expandBatchMigrations"
                            class="btn btn-xs btn-ghost w-full">
                      {{ expandBatchMigrations ? 'Show less' : `Show all (${batchMigrations.length})` }}
                    </button>
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
const selectedRollbackOption = ref('steps');
const rollbackSteps = ref(1);
const selectedBatch = ref(null);
const expandLastMigrations = ref(false);
const expandStepsMigrations = ref(false);
const expandBatchMigrations = ref(false);

// Computed property para mostrar as migrações afetadas pelo rollback por steps
const stepMigrations = computed(() => {
  // Vamos obter todas as migrações de todos os batches e ordená-las por data/timestamp
  // Este método garante que peguemos as migrações mais recentes independente do batch
  
  // 1. Coletar todas as migrações de todos os batches com seus metadados
  const migrationsWithMetadata = [];
  
  batches.value.forEach(batch => {
    if (batch.migrations && Array.isArray(batch.migrations)) {
      batch.migrations.forEach(migration => {
        // Para cada migração, armazenamos o nome e também dados para ordenação
        migrationsWithMetadata.push({
          name: migration,
          // Extrair o timestamp da migração (normalmente nos primeiros caracteres)
          timestamp: migration.substring(0, 14), // formato: YYYY_MM_DD_HHmmss
          batch: batch.batch
        });
      });
    }
  });
  
  // 2. Ordenar todas as migrações pelo timestamp (mais recente primeiro)
  migrationsWithMetadata.sort((a, b) => {
    // Primeiro tentar ordenar pelo batch (mais recente primeiro)
    if (a.batch !== b.batch) {
      return b.batch - a.batch;
    }
    // Se mesmo batch, ordenar pelo timestamp (mais recente primeiro)
    return b.timestamp.localeCompare(a.timestamp);
  });
  
  // 3. Obter apenas os nomes das migrações, já na ordem correta
  const orderedMigrations = migrationsWithMetadata.map(item => item.name);
  
  // Log para debug
  console.log('All migrations ordered by recency:', orderedMigrations);
  
  // 4. Retornar apenas o número desejado de migrações
  return orderedMigrations.slice(0, rollbackSteps.value);
});

// Computed property para mostrar as migrações afetadas pelo rollback por batch
const batchMigrations = computed(() => {
  if (!selectedBatch.value) return [];
  
  const batch = batches.value.find(b => b.batch === selectedBatch.value);
  return batch ? batch.migrations : [];
});

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

// Helper to get a description of what will be included in each step
function getStepDescription(steps) {
  if (!batches.value || batches.value.length === 0) return 'No batches';
  
  const totalBatches = Math.min(steps, batches.value.length);
  let totalMigrations = 0;
  
  for (let i = 0; i < totalBatches; i++) {
    if (batches.value[i] && batches.value[i].migrations) {
      totalMigrations += batches.value[i].migrations.length;
    }
  }
  
  if (steps > batches.value.length) {
    return `${totalMigrations} migrations (limited to ${batches.value.length} available batches)`;
  }
  
  return `${totalMigrations} migrations`;
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
      console.log('Migration status result:', result);
      pendingMigrations.value = result.pendingMigrations || [];
      batches.value = result.batches || [];
      
      console.log('Batches receiveed:', batches.value);
      
      hasSail.value = result.hasSail || false;
      
      // Verificar se temos dados de migrações
      if (pendingMigrations.value.length === 0 && batches.value.length === 0) {
        console.log('No migrations found in the status output');
        if (result.output) {
          console.log('Raw output:', result.output);
        }
      }
    } else {
      console.error('Failed to get migration status:', result.message);
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
    
    // Atualizar o status das migrações após executar o comando
    await refreshMigrationStatus();
    
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
  // O arquivo migration já pode conter a extensão .php
  // Vamos garantir que estamos usando apenas o nome do arquivo, sem o caminho
  const migrationFileName = migration.includes('.php') 
    ? migration 
    : `${migration}.php`;
  
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
    return;
  }
  
  isLoading.value = true;
  
  try {
    // Usar o migration diretamente no comando, sem especificar o path
    // Laravel identificará a migration pelo seu nome
    await commandsStore.runArtisanCommand({
      command: `migrate --path=database/migrations/${migrationFileName}`,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });
    
    // Atualizar o status das migrações após executar o comando
    await refreshMigrationStatus();
    
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

// Função para executar o rollback
async function runRollback() {
  let command = 'migrate:rollback';
  
  if (selectedRollbackOption.value === 'steps' && rollbackSteps.value > 0) {
    command += ` --step=${rollbackSteps.value}`;
  } else if (selectedRollbackOption.value === 'batch' && selectedBatch.value) {
    command = `migrate:rollback --batch=${selectedBatch.value}`;
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
    
    // Atualizar o status das migrações após executar o comando
    await refreshMigrationStatus();
    
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

// Watch para opções de rollback
watch(() => selectedRollbackOption.value, () => {
  // Resetar estados de expansão
  expandStepsMigrations.value = false;
  expandBatchMigrations.value = false;
  
  // Definir valores padrão quando mudar de opção
  if (selectedRollbackOption.value === 'batch' && batches.value.length > 0) {
    selectedBatch.value = batches.value[0].batch;
  } else if (selectedRollbackOption.value === 'steps') {
    rollbackSteps.value = 1;
  }
});

// Watch para quando os batches são carregados
watch(() => batches.value, () => {
  // Resetar estados de expansão
  expandStepsMigrations.value = false;
  expandBatchMigrations.value = false;
  
  // Definir o batch padrão quando os batches são carregados
  if (selectedRollbackOption.value === 'batch' && batches.value.length > 0) {
    selectedBatch.value = batches.value[0].batch;
  }
}, { immediate: true });
</script> 