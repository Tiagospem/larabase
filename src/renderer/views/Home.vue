<template>
  <div class="flex h-full">
    <!-- Coluna da esquerda - Logo e Create Connection -->
    <div class="w-1/3 bg-neutral flex flex-col items-center justify-between p-6 border-r border-gray-800">
      <div class="flex flex-col items-center">
        <img src="../assets/larabase-logo.png" alt="Larabase" class="h-32 w-32 mb-2" />
        <h1 class="text-3xl font-bold text-white">Larabase</h1>
        <p class="text-sm text-gray-400">Version 1.0.0</p>
      </div>
      
      <button 
        class="btn btn-primary w-full flex items-center gap-2 mt-8"
        @click="openCreateConnectionModal"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" 
            d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create Connection
      </button>
    </div>

    <!-- Coluna da direita - Lista de conexões -->
    <div class="w-2/3 flex flex-col">
      <div class="flex-1 overflow-auto p-6">
        <h2 class="text-xl font-bold mb-4 text-white">Your Connections</h2>
        
        <div v-if="isLoading" class="flex justify-center items-center h-64">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
        
        <div v-else-if="connectionsStore.connections.length === 0" class="text-center p-8 text-gray-500 h-64 flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mb-4 text-gray-500">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <p>No connections found</p>
          <p class="text-sm mt-2">Create a new connection to get started</p>
        </div>
        
        <div v-else class="grid grid-cols-1 gap-3">
          <!-- Conexões disponíveis -->
          <div v-for="connection in connectionsStore.connections" :key="connection.id" 
            class="card bg-base-200 shadow-xl transition-colors border border-gray-700 hover:border-gray-500">
            <div class="card-body py-4 px-5">
              <div class="flex items-center space-x-4">
                <div class="w-10 h-10 rounded-full flex items-center justify-center" 
                  :class="getConnectionColor(connection.type)">
                  <span class="text-white font-bold">{{ connection.icon }}</span>
                </div>
                <div class="flex-1">
                  <h2 class="card-title text-base">{{ connection.name }} 
                    <span class="text-xs text-green-500 ml-1">({{ connection.status }})</span>
                  </h2>
                  <p class="text-xs text-gray-400">{{ connection.host || connection.path }}</p>
                </div>
                <div class="flex gap-2">
                  <button 
                    class="btn btn-sm btn-ghost" 
                    @click="openConnection(connection.id)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                      stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                  <button 
                    class="btn btn-sm btn-ghost text-error" 
                    @click="removeConnection(connection.id)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                      stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Modal para criar conexão -->
    <div class="modal" :class="{ 'modal-open': isCreateModalOpen }">
      <div class="modal-box w-11/12 max-w-4xl">
        <h3 class="font-bold text-lg mb-4">Create New Connection</h3>
        
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Laravel Project Path</span>
          </label>
          <div class="flex gap-2">
            <input type="text" v-model="newConnection.path" placeholder="Select Laravel project directory" 
              class="input input-bordered w-full" readonly />
            <button class="btn btn-primary" @click="selectDirectory">
              Browse
            </button>
          </div>
          <label class="label" v-if="pathError">
            <span class="label-text-alt text-error">{{ pathError }}</span>
          </label>
        </div>
        
        <div class="form-control w-full mb-4">
          <label class="label cursor-pointer">
            <span class="label-text">Using Laravel Sail?</span>
            <input type="checkbox" v-model="newConnection.usingSail" class="toggle toggle-primary" />
          </label>
          <p class="text-xs text-gray-500 mt-1">Enable if your project uses Laravel Sail (Docker)</p>
        </div>
        
        <div class="divider">Database Connection</div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Connection Name</span>
            </label>
            <input type="text" v-model="newConnection.name" placeholder="My Project" 
              class="input input-bordered w-full" required />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Database Type</span>
            </label>
            <select class="select select-bordered w-full" v-model="newConnection.type" disabled>
              <option value="mysql">MySQL</option>
            </select>
            <label class="label">
              <span class="label-text-alt">Only MySQL is supported at the moment</span>
            </label>
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Host</span>
            </label>
            <input type="text" v-model="newConnection.host" placeholder="localhost" 
              class="input input-bordered w-full" required />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Port</span>
            </label>
            <input type="text" v-model="newConnection.port" placeholder="3306" 
              class="input input-bordered w-full" required />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Database</span>
            </label>
            <input type="text" v-model="newConnection.database" placeholder="mydatabase" 
              class="input input-bordered w-full" required />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input type="text" v-model="newConnection.username" placeholder="root" 
              class="input input-bordered w-full" required />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input type="password" v-model="newConnection.password" placeholder="password" 
              class="input input-bordered w-full" />
          </div>
        </div>
        
        <div class="divider">Redis Connection (Optional)</div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Host</span>
            </label>
            <input type="text" v-model="newConnection.redisHost" placeholder="127.0.0.1" 
              class="input input-bordered w-full" />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Port</span>
            </label>
            <input type="text" v-model="newConnection.redisPort" placeholder="6379" 
              class="input input-bordered w-full" />
          </div>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Redis Password</span>
            </label>
            <input type="password" v-model="newConnection.redisPassword" placeholder="Leave empty if none" 
              class="input input-bordered w-full" />
          </div>
        </div>
        
        <div class="modal-action">
          <button class="btn" @click="isCreateModalOpen = false">Cancel</button>
          <button class="btn btn-primary" @click="saveNewConnection" :disabled="isLoading || !newConnection.path">
            <span v-if="isSaving" class="loading loading-spinner loading-xs mr-2"></span>
            Save Connection
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="isCreateModalOpen = false"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useConnectionsStore } from '../store/connections';

const router = useRouter();
const connectionsStore = useConnectionsStore();

// Funções de alerta
const showAlert = inject('showAlert');

// Status de carregamento
const isLoading = computed(() => connectionsStore.isLoading);
const isSaving = ref(false);

// Estado do modal
const isCreateModalOpen = ref(false);
const pathError = ref('');

// Dados da nova conexão
const newConnection = ref({
  path: '',
  name: '',
  type: 'mysql',
  host: '',
  port: '3306',
  database: '',
  username: '',
  password: '',
  usingSail: false,
  redisHost: '',
  redisPort: '6379',
  redisPassword: ''
});

// Carregar conexões ao montar o componente
onMounted(async () => {
  try {
    // Forçar recarregamento das conexões
    await connectionsStore.loadConnections();
    
    console.log('Conexões carregadas:', connectionsStore.connections);
    
    if (connectionsStore.connections.length > 0) {
      showAlert(`${connectionsStore.connections.length} conexões carregadas`, 'success');
    }
  } catch (error) {
    console.error('Erro ao carregar conexões:', error);
    showAlert('Erro ao carregar conexões', 'error');
  }
});

// Abrir modal para criar conexão
function openCreateConnectionModal() {
  // Resetar form
  newConnection.value = {
    path: '',
    name: '',
    type: 'mysql',
    host: '',
    port: '3306',
    database: '',
    username: '',
    password: '',
    usingSail: false,
    redisHost: '',
    redisPort: '6379',
    redisPassword: ''
  };
  pathError.value = '';
  isCreateModalOpen.value = true;
}

// Selecionar diretório do projeto Laravel
async function selectDirectory() {
  try {
    // Chamar método IPC para abrir o diálogo de seleção de diretório
    const result = await window.api.selectDirectory();
    
    if (result.canceled) {
      return;
    }
    
    const selectedPath = result.filePaths[0];
    newConnection.value.path = selectedPath;
    pathError.value = '';
    
    // Verificar se é um projeto Laravel válido
    const isLaravelProject = await window.api.validateLaravelProject(selectedPath);
    
    if (!isLaravelProject) {
      pathError.value = 'Selected directory does not appear to be a valid Laravel project';
      return;
    }
    
    // Ler arquivo .env para extrair configurações
    const envConfig = await window.api.readEnvFile(selectedPath);
    
    if (envConfig) {
      // Preencher dados da conexão com base no .env
      newConnection.value.name = envConfig.APP_NAME || selectedPath.split('/').pop();
      newConnection.value.host = envConfig.DB_HOST || 'localhost';
      newConnection.value.port = envConfig.DB_PORT || '3306';
      newConnection.value.database = envConfig.DB_DATABASE || '';
      newConnection.value.username = envConfig.DB_USERNAME || 'root';
      newConnection.value.password = envConfig.DB_PASSWORD || '';
      
      // Configurações do Redis
      newConnection.value.redisHost = envConfig.REDIS_HOST || '127.0.0.1';
      newConnection.value.redisPort = envConfig.REDIS_PORT || '6379';
      newConnection.value.redisPassword = envConfig.REDIS_PASSWORD || '';
      
      showAlert('Projeto Laravel detectado. Configurações importadas com sucesso.', 'success');
    }
  } catch (error) {
    console.error('Erro ao selecionar diretório:', error);
    showAlert('Erro ao selecionar diretório', 'error');
  }
}

// Salvar nova conexão
async function saveNewConnection() {
  // Validar dados
  if (!newConnection.value.path) {
    pathError.value = 'Project path is required';
    return;
  }
  
  if (!newConnection.value.name || !newConnection.value.host || !newConnection.value.database) {
    showAlert('Please fill all required fields', 'error');
    return;
  }
  
  // Verificar se já existe uma conexão com o mesmo nome ou caminho
  const exists = connectionsStore.connections.some(conn => 
    conn.path === newConnection.value.path || conn.name === newConnection.value.name
  );
  
  if (exists) {
    showAlert('A connection with this name or path already exists', 'error');
    return;
  }
  
  try {
    isSaving.value = true;
    
    // Criar nova conexão
    await connectionsStore.addConnection({
      id: Date.now(), // ID único baseado em timestamp
      name: newConnection.value.name,
      type: newConnection.value.type,
      icon: newConnection.value.type.charAt(0).toUpperCase(), // Primeira letra como ícone
      host: newConnection.value.host,
      port: parseInt(newConnection.value.port),
      database: newConnection.value.database,
      username: newConnection.value.username,
      password: newConnection.value.password,
      path: newConnection.value.path,
      usingSail: newConnection.value.usingSail,
      status: 'ready',
      redis: {
        host: newConnection.value.redisHost,
        port: parseInt(newConnection.value.redisPort),
        password: newConnection.value.redisPassword
      }
    });
    
    showAlert('Connection created successfully', 'success');
    isCreateModalOpen.value = false;
  } catch (error) {
    console.error('Error creating connection:', error);
    showAlert('Error creating connection', 'error');
  } finally {
    isSaving.value = false;
  }
}

// Remover conexão
async function removeConnection(connectionId) {
  if (confirm('Are you sure you want to delete this connection? All related data will be lost.')) {
    try {
      await connectionsStore.removeConnection(connectionId);
      showAlert('Connection removed successfully', 'success');
    } catch (error) {
      console.error('Error removing connection:', error);
      showAlert('Error removing connection', 'error');
    }
  }
}

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