<template>
  <div class="modal modal-open z-30">
    <div class="modal-box w-11/12 max-w-2xl bg-base-300">
      <h3 class="font-bold text-lg mb-4">Run Artisan Command</h3>
      
      <div class="space-y-4">
        <div class="card bg-neutral shadow-md">
          <div class="card-body space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Command</span>
              </label>
              <div class="input-group">
                <span class="bg-base-300 px-3 flex items-center border border-r-0 border-gray-700 rounded-l-md font-mono text-xs">php artisan</span>
                <input 
                  type="text" 
                  v-model="command" 
                  placeholder="Enter command (e.g. migrate:status)"
                  class="input input-bordered flex-1 font-mono" 
                  @keyup.enter="runCommand"
                />
              </div>
            </div>
            
            <div class="form-control" v-if="hasSail">
              <label class="label cursor-pointer">
                <span class="label-text">Use Laravel Sail</span>
                <input type="checkbox" v-model="useSail" class="toggle toggle-primary" />
              </label>
            </div>
            
            <div class="flex flex-wrap gap-2 mt-2">
              <button 
                v-for="cmd in commonCommands" 
                :key="cmd.command" 
                @click="command = cmd.command"
                class="btn btn-outline btn-xs">
                {{ cmd.label }}
              </button>
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
        <button 
          class="btn btn-primary" 
          @click="runCommand" 
          :disabled="isLoading || !command || !projectPath">
          <span v-if="isLoading" class="loading loading-spinner loading-xs mr-2"></span>
          Run Command
        </button>
        <button class="btn" @click="close">Cancel</button>
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

const command = ref('');
const useSail = ref(false);
const hasSail = ref(false);
const isLoading = computed(() => commandsStore.isLoading);

// Common Laravel artisan commands
const commonCommands = [
  { label: 'Migrate', command: 'migrate' },
  { label: 'Migrate Status', command: 'migrate:status' },
  { label: 'Cache Clear', command: 'cache:clear' },
  { label: 'Route List', command: 'route:list' },
  { label: 'Config Clear', command: 'config:clear' },
  { label: 'View Clear', command: 'view:clear' },
  { label: 'Queue Work', command: 'queue:work' },
  { label: 'Make Controller', command: 'make:controller' },
  { label: 'Make Model', command: 'make:model' }
];

// Check if project has Laravel Sail
async function checkForSail() {
  if (props.projectPath) {
    try {
      // We'll assume Sail exists if vendor/bin/sail exists
      const fs = window.require('fs');
      const path = window.require('path');
      const sailPath = path.join(props.projectPath, 'vendor/bin/sail');
      
      hasSail.value = fs.existsSync(sailPath);
    } catch (error) {
      console.error('Error checking for Sail:', error);
      hasSail.value = false;
    }
  }
}

async function runCommand() {
  if (!command.value.trim()) {
    showAlert('Please enter a command to run', 'error');
    return;
  }
  
  if (!props.projectPath) {
    showAlert('No Laravel project path configured', 'error');
    return;
  }
  
  try {
    await commandsStore.runArtisanCommand({
      command: command.value.trim(),
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });
    
    close();
  } catch (error) {
    console.error('Error running command:', error);
    showAlert(`Failed to run command: ${error.message}`, 'error');
  }
}

function close() {
  emit('close');
}

// Check for Sail when component is mounted
onMounted(() => {
  checkForSail();
});

// Watch for project path changes
watch(() => props.projectPath, () => {
  checkForSail();
});
</script> 