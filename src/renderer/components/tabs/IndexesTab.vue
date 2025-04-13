<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadIndexes">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
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
          <button class="btn btn-sm btn-primary mt-4" @click="loadIndexes">Try again</button>
        </div>
      </div>
      
      <div v-else-if="indexes.length === 0" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
          <p>No indexes found in this table</p>
          <button class="btn btn-sm btn-ghost mt-4" @click="loadIndexes">Reload</button>
        </div>
      </div>
      
      <div v-else>
        <table class="table table-sm w-full">
          <thead class="bg-base-300 sticky top-0">
            <tr class="text-xs">
              <th class="px-4 py-2 text-left">Name</th>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Columns</th>
              <th class="px-4 py-2 text-left">Algorithm</th>
              <th class="px-4 py-2 text-left">Cardinality</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="index in indexes" :key="index.name" 
                class="border-b border-gray-700 hover:bg-base-200">
              <td class="px-4 py-3 font-medium">{{ index.name }}</td>
              <td class="px-4 py-3">
                <span class="badge badge-ghost badge-sm">{{ index.type }}</span>
              </td>
              <td class="px-4 py-3">{{ index.columns.join(', ') }}</td>
              <td class="px-4 py-3 text-gray-400">{{ index.algorithm }}</td>
              <td class="px-4 py-3 text-gray-400">{{ index.cardinality }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="indexes.length > 0" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ indexes.length }} indexes</div>
      <div>
        <span v-if="primaryIndex">Primary key: {{ primaryIndex.columns.join(', ') }}</span>
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
const indexes = ref([]);
const loadError = ref(null);

const databaseStore = useDatabaseStore();

// Computed
const primaryIndex = computed(() => {
  return indexes.value.find(index => index.type === 'PRIMARY') || null;
});

// Methods
async function loadIndexes() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    // Use the store's getTableIndexes method
    indexes.value = await databaseStore.getTableIndexes(props.connectionId, props.tableName);
    
    // Notify parent component
    props.onLoad({
      indexCount: indexes.value.length,
      hasPrimaryKey: primaryIndex.value !== null
    });
    
  } catch (error) {
    loadError.value = 'Failed to load table indexes: ' + (error.message || 'Unknown error');
    showAlert(`Error loading indexes: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(() => {
  loadIndexes();
});
</script> 