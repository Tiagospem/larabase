import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';

export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref([]);
  const isLoading = ref(true);
  
  // Mock data
  const mockConnections = [
    {
      id: 1,
      name: 'Redis',
      type: 'redis',
      status: 'local',
      host: '127.0.0.1',
      port: 6379,
      icon: 'Re'
    },
    {
      id: 2,
      name: 'SIM',
      type: 'mysql',
      status: 'local',
      host: '127.0.0.1',
      port: 3306,
      icon: 'Ms'
    },
    {
      id: 3,
      name: 'bootcamp',
      type: 'mysql',
      status: 'local',
      host: '127.0.0.1',
      port: 3306,
      icon: 'Ms'
    },
    {
      id: 4,
      name: 'Demo',
      type: 'sqlite',
      status: 'local',
      path: '/Users/tiago.padilha/Documents/devsquad/video-query-2/database/database.sqlite',
      icon: 'SI'
    },
    {
      id: 5,
      name: 'simple tables',
      type: 'sqlite',
      status: 'local',
      path: '/Users/tiago.padilha/Documents/project/SimpleTablesProject/database.sqlite',
      icon: 'SI'
    },
    {
      id: 6,
      name: 'simon',
      type: 'sqlite',
      status: 'local',
      path: '/Users/tiago.padilha/Documents/SIM/simon-poc/database/database.sqlite',
      icon: 'SI'
    }
  ];

  // Inicializa com dados mockados por padrão
  connections.value = [...mockConnections];

  // Carrega as conexões salvas
  async function loadConnections() {
    isLoading.value = true;
    
    try {
      console.log('Carregando conexões...');
      
      // Em ambiente real, esses dados viriam do Electron IPC
      if (window.api) {
        try {
          const savedConnections = await window.api.getConnections();
          if (savedConnections && savedConnections.length) {
            connections.value = savedConnections;
            console.log('Conexões carregadas do Electron Store:', connections.value);
          } else {
            connections.value = [...mockConnections];
            console.log('Usando conexões mockadas:', connections.value);
          }
        } catch (err) {
          console.error('Erro ao acessar API do Electron:', err);
          connections.value = [...mockConnections];
        }
      } else {
        // Fallback para dados mockados
        connections.value = [...mockConnections];
        console.log('API não disponível. Usando conexões mockadas:', connections.value);
      }
      
      return connections.value;
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      connections.value = [...mockConnections];
      return connections.value;
    } finally {
      isLoading.value = false;
    }
  }

  // Salva as conexões
  async function saveConnections() {
    try {
      // Em ambiente real, esses dados seriam salvos via Electron IPC
      if (window.api) {
        await window.api.saveConnections(connections.value);
      }
      console.log('Conexões salvas');
    } catch (error) {
      console.error('Erro ao salvar conexões:', error);
    }
  }

  // Adiciona uma nova conexão
  function addConnection(connection) {
    const newId = connections.value.length 
      ? Math.max(...connections.value.map(c => c.id)) + 1 
      : 1;
    
    connections.value.push({
      id: newId,
      ...connection
    });
    
    saveConnections();
  }

  // Remove uma conexão
  function removeConnection(id) {
    connections.value = connections.value.filter(c => c.id !== id);
    saveConnections();
  }

  // Atualiza uma conexão
  function updateConnection(id, data) {
    const index = connections.value.findIndex(c => c.id === id);
    if (index !== -1) {
      connections.value[index] = { ...connections.value[index], ...data };
      saveConnections();
    }
  }

  // Getter para obter uma conexão pelo ID
  const getConnection = computed(() => {
    return (id) => connections.value.find(c => c.id === parseInt(id));
  });

  // Carrega as conexões assim que a store for criada
  onMounted(() => {
    loadConnections();
  });

  return {
    connections,
    isLoading,
    loadConnections,
    addConnection,
    removeConnection,
    updateConnection,
    getConnection
  };
}); 