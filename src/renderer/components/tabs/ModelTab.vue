<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadModel">
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
          <span>Refresh</span>
        </button>
      </div>
      
      <div v-if="!isLoading" class="flex items-center space-x-2">
        <span class="text-xs text-gray-400">{{ modelFound ? 'Model found' : 'No model found' }}</span>
        
        <button
          v-if="!connection?.projectPath" 
          class="btn btn-sm btn-ghost" 
          title="Select Laravel project" 
          @click="selectProjectPath"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg" />
      </div>
      
      <div v-else-if="!connection?.projectPath" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
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
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          <p>No Laravel project path is associated with this connection</p>
          <button class="btn btn-sm btn-primary mt-4" @click="selectProjectPath">
            Select Project
          </button>
        </div>
      </div>
      
      <div v-else-if="!modelFound" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
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
              d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
            />
          </svg>
          <p>No Laravel model found for {{ tableName }} table</p>
          <p class="text-xs mt-2 text-gray-500">
            Models are typically named using singular form or with different naming conventions
          </p>
          <button v-if="connection?.projectPath" class="btn btn-sm btn-ghost mt-4" @click="loadModel">
            Reload
          </button>
        </div>
      </div>
      
      <div v-else class="p-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5" 
                stroke="currentColor"
                class="w-6 h-6 text-primary"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round" 
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                />
              </svg>
              {{ model.name }}
            </h3>
            
            <div class="mt-2">
              <div class="flex flex-col space-y-3">
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">
                    Namespace
                  </div>
                  <div class="flex-1">
                    {{ model.namespace || 'Not specified' }}
                  </div>
                </div>
                
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">
                    Full Name
                  </div>
                  <div class="flex-1 font-mono text-sm bg-base-300 p-1 rounded">
                    {{ model.fullName }}
                  </div>
                </div>
                
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">
                    File Path
                  </div>
                  <div class="flex-1 flex items-center gap-2">
                    <span class="truncate">{{ model.relativePath }}</span>
                    <button class="btn btn-xs btn-ghost" title="Open in editor" @click="openFileInEditor(model.path)">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">
                    Table Name
                  </div>
                  <div class="flex-1">
                    {{ tableName }}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="divider" />
            
            <div v-if="modelContent" class="mb-4">
              <h4 class="text-sm font-medium text-gray-400 mb-2">
                Model Code
              </h4>
              <div class="mockup-code bg-neutral h-64 overflow-auto text-xs">
                <pre><code>{{ modelContent }}</code></pre>
              </div>
            </div>
            
            <div class="flex justify-between">
              <button class="btn btn-sm btn-primary" @click="viewModelJson">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5" 
                  stroke="currentColor"
                  class="w-4 h-4 mr-1"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round" 
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
                View Model JSON
              </button>
              
              <button class="btn btn-sm btn-ghost" @click="openFileInEditor(model.path)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5" 
                  stroke="currentColor"
                  class="w-4 h-4 mr-1"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round" 
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Open File
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modelFound" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ model.fullName }}</div>
      <div>Model Path: {{ model.relativePath }}</div>
    </div>
    
    <!-- Model JSON Modal -->
    <div v-if="showJsonModal" class="modal modal-open">
      <div class="modal-box w-11/12 max-w-5xl max-h-[90vh]">
        <h3 class="font-bold text-lg mb-4">
          Model JSON for {{ tableName }}
        </h3>
        <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
          <pre><code>{{ modelJson }}</code></pre>
        </div>
        <div class="modal-action">
          <button class="btn btn-sm btn-primary" @click="copyJsonToClipboard">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4 mr-1"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
            Copy to Clipboard
          </button>
          <button class="btn" @click="showJsonModal = false">
            Close
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showJsonModal = false" />
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
const model = ref(null);
const modelJson = ref('');
const modelContent = ref('');
const showJsonModal = ref(false);

const databaseStore = useDatabaseStore();
const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const modelFound = computed(() => {
  return model.value !== null;
});

// Methods
async function loadModel () {
  isLoading.value = true;
  
  try {
    if (!connection.value?.projectPath) {
      model.value = null;
      return;
    }
    
    // Check if we need to load models first
    await databaseStore.loadModelsForTables(props.connectionId, connection.value.projectPath);
    
    // Get the model for this table
    model.value = databaseStore.getModelForTable(props.connectionId, props.tableName);
    
    // Generate model JSON
    modelJson.value = databaseStore.getTableModelJson(props.connectionId, props.tableName);
    
    // Load model content if found
    if (model.value && model.value.path) {
      await loadModelContent(model.value.path);
    }
    
    // Notify parent component
    props.onLoad({
      modelFound: model.value !== null
    });
    
  } catch (error) {
    console.error('Failed to load model:', error);
    showAlert(`Error loading model: ${error.message}`, 'error');
    model.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Load model file content
async function loadModelContent (filePath) {
  try {
    // Use the IPC method to read the model file
    const result = await window.api.readModelFile(filePath);
    
    if (result.success) {
      modelContent.value = result.content;
    } else {
      console.error('Error loading model content:', result.message);
      modelContent.value = '// Unable to load model content: ' + result.message;
    }
  } catch (error) {
    console.error('Error reading model file:', error);
    modelContent.value = '// Unable to load model content';
  }
}

async function selectProjectPath () {
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
      await loadModel();
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
    showAlert('Failed to select project directory', 'error');
  }
}

async function openFileInEditor (filePath) {
  try {
    await window.api.openFile(filePath);
  } catch (error) {
    console.error('Error opening file:', error);
    showAlert('Failed to open file', 'error');
  }
}

function viewModelJson () {
  showJsonModal.value = true;
}

async function copyJsonToClipboard () {
  try {
    await navigator.clipboard.writeText(modelJson.value);
    showAlert('JSON copied to clipboard', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showAlert('Failed to copy to clipboard', 'error');
  }
}

// Lifecycle
onMounted(() => {
  loadModel();
});
</script> 