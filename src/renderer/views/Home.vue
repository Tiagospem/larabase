<template>
  <div class="flex flex-col h-full">
    <!-- Header com logo -->
    <header class="bg-neutral p-4 flex items-center justify-center">
      <div class="flex flex-col items-center">
        <img src="../assets/larabase-logo.png" alt="Larabase" class="h-32 w-32 mb-2" />
        <h1 class="text-3xl font-bold text-white">Larabase</h1>
        <p class="text-sm text-gray-400">Version 1.0.0</p>
        <p class="text-xs text-gray-500 mt-2">You are using the free trial</p>
        <div class="mt-2 flex gap-2">
          <button class="btn btn-sm btn-outline">Purchase</button>
          <button class="btn btn-sm btn-outline">Activate</button>
        </div>
        <p class="text-xs text-green-500 mt-4">You're up to date</p>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="isLoading" class="flex justify-center items-center h-full">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else class="grid grid-cols-1 gap-3 max-w-3xl mx-auto">
        <!-- Conexões disponíveis -->
        <div v-for="connection in connectionsStore.connections" :key="connection.id" 
          class="card bg-neutral shadow-xl hover:bg-base-300 cursor-pointer transition-colors"
          @click="openConnection(connection.id)">
          <div class="card-body py-3 px-4">
            <div class="flex items-center space-x-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" 
                :class="getConnectionColor(connection.type)">
                <span class="text-white font-bold">{{ connection.icon }}</span>
              </div>
              <div>
                <h2 class="card-title text-base">{{ connection.name }} 
                  <span class="text-xs text-green-500 ml-1">({{ connection.status }})</span>
                </h2>
                <p class="text-xs text-gray-400">{{ connection.host || connection.path }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="connectionsStore.connections.length === 0" class="text-center p-8 text-gray-500">
          <p>Nenhuma conexão encontrada</p>
          <button class="btn btn-primary btn-sm mt-4">Adicionar Conexão</button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="bg-neutral p-4 border-t border-gray-800">
      <div class="flex justify-center space-x-4">
        <button class="btn btn-ghost btn-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25-2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          Backup database...
        </button>
        <button class="btn btn-ghost btn-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
          Restore database...
        </button>
        <button class="btn btn-ghost btn-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create connection...
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useConnectionsStore } from '../store/connections';

const router = useRouter();
const connectionsStore = useConnectionsStore();

// Funções de alerta
const showAlert = inject('showAlert');

// Status de carregamento
const isLoading = computed(() => connectionsStore.isLoading);

// Carregar conexões ao montar o componente
onMounted(async () => {
  try {
    // Forçar recarregamento das conexões
    await connectionsStore.loadConnections();
    
    console.log('Conexões carregadas:', connectionsStore.connections);
    
    if (connectionsStore.connections.length > 0) {
      showAlert(`${connectionsStore.connections.length} conexões carregadas`, 'success');
    } else {
      showAlert('Nenhuma conexão encontrada', 'warning');
    }
  } catch (error) {
    console.error('Erro ao carregar conexões:', error);
    showAlert('Erro ao carregar conexões', 'error');
  }
});

// Abrir uma conexão
function openConnection(connectionId) {
  router.push(`/database/${connectionId}`);
}

// Definir cores para os tipos de conexão
function getConnectionColor(type) {
  switch (type) {
    case 'mysql':
      return 'bg-orange-500';
    case 'redis':
      return 'bg-red-600';
    case 'sqlite':
      return 'bg-purple-600';
    case 'postgresql':
      return 'bg-blue-600';
    default:
      return 'bg-gray-600';
  }
}
</script> 