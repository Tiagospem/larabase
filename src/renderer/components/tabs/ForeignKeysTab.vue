<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadForeignKeys">
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
          <button class="btn btn-sm btn-primary mt-4" @click="loadForeignKeys">Try again</button>
        </div>
      </div>
      
      <div v-else class="p-4">
        <div v-if="foreignKeys.length === 0" class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            <p>No foreign keys found in this table</p>
            <button class="btn btn-sm btn-ghost mt-4" @click="loadForeignKeys">Reload</button>
          </div>
        </div>
        
        <div v-else>
          <!-- Outgoing Foreign Keys -->
          <div v-if="outgoingRelations.length > 0" class="mb-6">
            <h3 class="text-lg font-bold mb-3">References to Other Tables</h3>
            <table class="table table-sm w-full">
              <thead class="bg-base-300 sticky top-0">
                <tr class="text-xs">
                  <th class="px-4 py-2 text-left">Name</th>
                  <th class="px-4 py-2 text-left">Local Column</th>
                  <th class="px-4 py-2 text-left">Referenced Table</th>
                  <th class="px-4 py-2 text-left">Referenced Column</th>
                  <th class="px-4 py-2 text-left">On Update</th>
                  <th class="px-4 py-2 text-left">On Delete</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fk in outgoingRelations" :key="fk.name" 
                    class="border-b border-gray-700 hover:bg-base-200">
                  <td class="px-4 py-3 font-medium">{{ fk.name }}</td>
                  <td class="px-4 py-3">{{ fk.column }}</td>
                  <td class="px-4 py-3">{{ fk.referenced_table }}</td>
                  <td class="px-4 py-3">{{ fk.referenced_column }}</td>
                  <td class="px-4 py-3">
                    <span class="badge badge-ghost badge-sm">{{ fk.on_update }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge badge-ghost badge-sm">{{ fk.on_delete }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Incoming Foreign Keys -->
          <div v-if="incomingRelations.length > 0">
            <h3 class="text-lg font-bold mb-3">References from Other Tables</h3>
            <table class="table table-sm w-full">
              <thead class="bg-base-300 sticky top-0">
                <tr class="text-xs">
                  <th class="px-4 py-2 text-left">Name</th>
                  <th class="px-4 py-2 text-left">Table</th>
                  <th class="px-4 py-2 text-left">Column</th>
                  <th class="px-4 py-2 text-left">Referenced Column</th>
                  <th class="px-4 py-2 text-left">On Update</th>
                  <th class="px-4 py-2 text-left">On Delete</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fk in incomingRelations" :key="fk.name" 
                    class="border-b border-gray-700 hover:bg-base-200">
                  <td class="px-4 py-3 font-medium">{{ fk.name }}</td>
                  <td class="px-4 py-3">{{ fk.table }}</td>
                  <td class="px-4 py-3">{{ fk.column }}</td>
                  <td class="px-4 py-3">{{ fk.referenced_column }}</td>
                  <td class="px-4 py-3">
                    <span class="badge badge-ghost badge-sm">{{ fk.on_update }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge badge-ghost badge-sm">{{ fk.on_delete }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div v-if="foreignKeys.length > 0" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ outgoingRelations.length }} outgoing | {{ incomingRelations.length }} incoming</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useDatabaseStore } from '@/store/database';

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
const foreignKeys = ref([]);
const loadError = ref(null);

const databaseStore = useDatabaseStore();

// Computed properties
const outgoingRelations = computed(() => {
  return foreignKeys.value.filter(fk => fk.type === 'outgoing');
});

const incomingRelations = computed(() => {
  return foreignKeys.value.filter(fk => fk.type === 'incoming');
});

// Methods
function getConstraintBadgeClass(action) {
  switch (action) {
    case 'CASCADE':
      return 'badge-warning';
    case 'RESTRICT':
      return 'badge-error';
    case 'SET NULL':
      return 'badge-info';
    case 'NO ACTION':
      return 'badge-ghost';
    default:
      return 'badge-neutral';
  }
}

async function loadForeignKeys() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    // In a real application, implement this method in the database store
    // For now, we'll use mock data since we don't have the actual implementation
    
    // Mock data - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
    
    // This would be the actual API call in a real application:
    // const foreignKeys = await databaseStore.getTableForeignKeys(props.connectionId, props.tableName);
    
    // Mock foreign key data
    const mockForeignKeys = [
      {
        name: 'users_user_type_id_foreign',
        type: 'outgoing',
        column: 'user_type_id',
        referenced_table: 'user_types',
        referenced_column: 'id',
        on_update: 'CASCADE',
        on_delete: 'SET NULL'
      },
      {
        name: 'orders_user_id_foreign',
        type: 'incoming',
        table: 'orders',
        column: 'user_id',
        referenced_column: 'id',
        on_update: 'CASCADE',
        on_delete: 'RESTRICT'
      },
      {
        name: 'posts_author_id_foreign',
        type: 'incoming',
        table: 'posts',
        column: 'author_id',
        referenced_column: 'id',
        on_update: 'CASCADE',
        on_delete: 'CASCADE'
      }
    ];
    
    foreignKeys.value = mockForeignKeys;
    
    // Notify parent component
    props.onLoad({
      outgoingCount: outgoingRelations.value.length,
      incomingCount: incomingRelations.value.length
    });
    
  } catch (error) {
    loadError.value = 'Failed to load foreign keys: ' + (error.message || 'Unknown error');
    showAlert(`Error loading foreign keys: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(() => {
  loadForeignKeys();
});
</script> 