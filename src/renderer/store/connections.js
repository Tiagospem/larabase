import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';

export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref([]);
  const isLoading = ref(true);

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

  connections.value = [...mockConnections];

  async function loadConnections() {
    isLoading.value = true;
    
    try {
      if (window.api) {
        try {
          const savedConnections = await window.api.getConnections();
          if (savedConnections && savedConnections.length) {
            connections.value = savedConnections;
          } else {
            connections.value = [...mockConnections];
          }
        } catch (err) {
          connections.value = [...mockConnections];
        }
      } else {
        connections.value = [...mockConnections];
      }
      
      return connections.value;
    } catch (error) {
      console.error(error);
      connections.value = [...mockConnections];
      return connections.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveConnections() {
    try {
      if (window.api) {
        await window.api.saveConnections(connections.value);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function addConnection(connection) {
    const newId = connections.value.length 
      ? Math.max(...connections.value.map(c => c.id)) + 1 
      : 1;
    
    connections.value.push({
      id: newId,
      ...connection
    });
    
    await saveConnections();
  }

  async function removeConnection(id) {
    connections.value = connections.value.filter(c => c.id !== id);
    await saveConnections();
  }

  async function updateConnection(id, data) {
    const index = connections.value.findIndex(c => c.id === id);
    if (index !== -1) {
      connections.value[index] = { ...connections.value[index], ...data };
      await saveConnections();
    }
  }

  const getConnection = computed(() => {
    return (id) => connections.value.find(c => c.id === parseInt(id));
  });

  onMounted(async () => {
    await loadConnections();
  });

  return {
    connections,
    isLoading,
    loadConnections,
    // addConnection,
    // removeConnection,
    // updateConnection,
    getConnection
  };
}); 