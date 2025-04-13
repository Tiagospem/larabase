<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadStructure">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      
      <div class="flex items-center space-x-2">
        <div class="relative">
          <input type="text" placeholder="Filter columns..." 
            class="input input-sm input-bordered bg-base-300 w-40" 
            v-model="filterTerm" />
        </div>
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
          <button class="btn btn-sm btn-primary mt-4" @click="loadStructure">Try again</button>
        </div>
      </div>
      
      <table v-else-if="columns.length > 0" class="table table-sm w-full">
        <thead class="bg-base-300 sticky top-0">
          <tr class="text-xs">
            <th class="px-4 py-2 text-left">Column Name</th>
            <th class="px-4 py-2 text-left">Type</th>
            <th class="px-4 py-2 text-center">Nullable</th>
            <th class="px-4 py-2 text-center">Key</th>
            <th class="px-4 py-2 text-left">Default</th>
            <th class="px-4 py-2 text-left">Extra</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="column in filteredColumns" :key="column.name" 
              class="border-b border-gray-700 hover:bg-base-200">
            <td class="px-4 py-2 font-medium">
              <div class="flex items-center">
                <span v-if="column.primary_key" class="mr-2 text-yellow-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                    <path fill-rule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0
                    01 9 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0
                    01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5
                    1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clip-rule="evenodd" />
                  </svg>
                </span>
                {{ column.name }}
              </div>
            </td>
            <td class="px-4 py-2">
              <span class="text-gray-400">{{ column.type }}</span>
            </td>
            <td class="px-4 py-2 text-center">
              <svg v-if="column.nullable" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
                   stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mx-auto text-gray-400">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
                   stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mx-auto text-gray-400">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </td>
            <td class="px-4 py-2 text-center">
              <span v-if="column.primary_key" class="badge badge-ghost badge-sm">PRI</span>
              <span v-else-if="column.foreign_key" class="badge badge-ghost badge-sm">FOR</span>
              <span v-else-if="column.unique" class="badge badge-ghost badge-sm">UNI</span>
            </td>
            <td class="px-4 py-2">
              <span v-if="column.default !== null">{{ column.default }}</span>
              <span v-else class="text-gray-500">NULL</span>
            </td>
            <td class="px-4 py-2 text-gray-400">
              {{ column.extra }}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
          <p>No structure information available</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadStructure">Reload</button>
        </div>
      </div>
    </div>

    <div v-if="columns.length > 0" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ columns.length }} columns</div>
      <div>
        <span>{{ primaryKeys.length > 0 ? `Primary key: ${primaryKeys.join(', ')}` : 'No primary key' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, inject, onMounted, ref} from 'vue';
import {useDatabaseStore} from '@/store/database';

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
const columns = ref([]);
const filterTerm = ref('');
const loadError = ref(null);

const databaseStore = useDatabaseStore();

// Computed
const filteredColumns = computed(() => {
  if (!filterTerm.value) {
    return columns.value;
  }
  
  const term = filterTerm.value.toLowerCase();
  return columns.value.filter(column => {
    return column.name.toLowerCase().includes(term) ||
           column.type.toLowerCase().includes(term);
  });
});

const primaryKeys = computed(() => {
  return columns.value
    .filter(column => column.primary_key)
    .map(column => column.name);
});

// Methods
async function loadStructure() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    // Use the store's getTableStructure method
    columns.value = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    
    // Notify parent component
    props.onLoad({
      columnCount: columns.value.length,
      primaryKeys: primaryKeys.value
    });
    
  } catch (error) {
    loadError.value = 'Failed to load table structure: ' + (error.message || 'Unknown error');
    showAlert(`Error loading structure: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(() => {
  loadStructure();
});
</script> 