import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';

export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref([]);
  const isLoading = ref(true);

  async function loadConnections() {
    isLoading.value = true;
    
    try {
      if (window.api) {
        try {
          const savedConnections = await window.api.getConnections();
          
          if (savedConnections && Array.isArray(savedConnections) && savedConnections.length > 0) {
            connections.value = savedConnections;
          } else {
            connections.value = [];
          }
        } catch (err) {
          console.error('Error loading connections from API:', err);
          connections.value = [];
        }
      } else {
        console.warn('API not available, unable to load connections');
        connections.value = [];
      }
      
      return connections.value;
    } catch (error) {
      console.error('Error in loadConnections:', error);
      connections.value = [];
      return connections.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveConnections() {
    try {
      if (window.api) {
        const serializableConnections = connections.value.map(conn => {

          return JSON.parse(JSON.stringify(conn));
        });
        
        await window.api.saveConnections(serializableConnections);
      }
    } catch (error) {
      console.error('Error saving connections:', error);
    }
  }

  async function addConnection(connection) {
    connections.value.push(connection);
    await saveConnections();
    return connection;
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
    return (id) => connections.value.find(c => c.id === id);
  });

  onMounted(async () => {
    await loadConnections();
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