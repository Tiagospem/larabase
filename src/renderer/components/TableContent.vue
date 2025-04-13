<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadTableData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
        <button class="btn btn-sm btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Insert</span>
        </button>
      </div>
      
      <div class="flex items-center space-x-2">
        <div class="relative">
          <input type="text" placeholder="Filter..." 
            class="input input-sm input-bordered bg-base-300 w-40" 
            v-model="filterTerm" />
        </div>
        <select class="select select-sm select-bordered bg-base-300 w-32">
          <option>10 rows</option>
          <option>25 rows</option>
          <option>50 rows</option>
          <option>100 rows</option>
        </select>
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
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Tentar novamente</button>
        </div>
      </div>
      
      <table v-else-if="tableData.length > 0" class="table table-sm w-full">
        <thead class="bg-base-300 sticky top-0">
          <tr class="text-xs">
            <th v-for="column in columns" :key="column" class="px-4 py-2 border-r border-gray-700 last:border-r-0">
              {{ column }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(row, index) in filteredData" :key="index" 
            class="border-b border-gray-700 hover:bg-base-200">
            <td v-for="column in columns" :key="`${index}-${column}`" 
              class="px-4 py-2 border-r border-gray-700 last:border-r-0 truncate max-w-xs">
              {{ row[column] }}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <p>Nenhum registro encontrado na tabela.</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Recarregar</button>
        </div>
      </div>
    </div>

    <div class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ tableData.length }} records</div>
      <div class="flex space-x-4">
        <button class="btn btn-ghost btn-xs">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export
        </button>
        <span>{{ columns.length }} columns</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue';
import { useDatabaseStore } from '@/store/database';

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: Number,
    required: true
  },
  tableName: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update-tab-data']);

const isLoading = ref(true);
const tableData = ref([]);
const filterTerm = ref('');
const loadError = ref(null);

const databaseStore = useDatabaseStore();

const columns = computed(() => {
  if (tableData.value.length === 0) {
    return [];
  }
  return Object.keys(tableData.value[0]);
});

const filteredData = computed(() => {
  if (!filterTerm.value) {
    return tableData.value;
  }
  
  const term = filterTerm.value.toLowerCase();
  return tableData.value.filter(row => {
    return Object.values(row).some(value => {
      if (value === null) return false;
      return String(value).toLowerCase().includes(term);
    });
  });
});

async function loadTableData() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    const data = await databaseStore.loadTableData(props.connectionId, props.tableName);
    
    if (!data || data.length === 0) {
      console.warn('Tabela vazia ou dados não encontrados');
      showAlert('Tabela vazia ou dados não encontrados', 'warning');
    }
    
    tableData.value = data;

    emit('update-tab-data', Date.now(), {
      columns: columns.value,
      rowCount: data.length
    });
  } catch (error) {
    console.error(error);
    loadError.value = error.message;
    showAlert(`Erro ao carregar dados: ${error.message}`, 'error');
    tableData.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadTableData();
});

watch(
  () => [props.connectionId, props.tableName],
  () => {
    loadTableData();
  }
);
</script> 