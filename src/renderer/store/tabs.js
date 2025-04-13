import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTabsStore = defineStore('tabs', () => {
  // Abas abertas
  const openTabs = ref([]);
  // Aba ativa atual
  const activeTabId = ref(null);

  // Adicionar uma nova aba
  function addTab(tableData) {
    // Verificar se a tabela já está aberta
    const existingTab = openTabs.value.find(tab => 
      tab.connectionId === tableData.connectionId && 
      tab.tableName === tableData.tableName
    );

    if (existingTab) {
      // Se já estiver aberta, apenas ativa essa aba
      activeTabId.value = existingTab.id;
      return existingTab;
    }

    // Se não estiver aberta, cria uma nova aba
    const newTab = {
      id: Date.now(), // Usa timestamp como ID único
      connectionId: tableData.connectionId,
      tableName: tableData.tableName,
      title: tableData.tableName,
      data: null, // Dados da tabela virão depois
      isLoading: true,
      columnCount: tableData.columnCount || 0,
    };

    openTabs.value.push(newTab);
    activeTabId.value = newTab.id;
    
    // Persistir no Electron Store
    saveOpenTabs();
    
    return newTab;
  }

  // Remover uma aba
  function removeTab(tabId) {
    const index = openTabs.value.findIndex(tab => tab.id === tabId);
    
    if (index !== -1) {
      openTabs.value.splice(index, 1);
      
      // Se a aba atual for removida, selecionar outra aba
      if (activeTabId.value === tabId) {
        activeTabId.value = openTabs.value.length > 0 
          ? openTabs.value[Math.min(index, openTabs.value.length - 1)].id 
          : null;
      }
      
      saveOpenTabs();
    }
  }

  // Atualizar dados de uma aba
  function updateTabData(tabId, data) {
    const tab = openTabs.value.find(tab => tab.id === tabId);
    if (tab) {
      tab.data = data;
      tab.isLoading = false;
      saveOpenTabs();
    }
  }

  // Ativar uma aba
  function activateTab(tabId) {
    if (openTabs.value.some(tab => tab.id === tabId)) {
      activeTabId.value = tabId;
    }
  }

  // Salvar abas abertas no electron-store
  function saveOpenTabs() {
    try {
      // Em ambiente real, isso seria via Electron IPC
      if (window.api) {
        window.api.saveOpenTabs({
          tabs: openTabs.value,
          activeTabId: activeTabId.value
        });
      }
      console.log('Abas salvas', openTabs.value);
      // Fallback usando localStorage
      localStorage.setItem('openTabs', JSON.stringify({
        tabs: openTabs.value,
        activeTabId: activeTabId.value
      }));
    } catch (error) {
      console.error('Erro ao salvar abas:', error);
    }
  }

  // Carregar abas salvas
  async function loadSavedTabs() {
    try {
      // Em ambiente real, isso seria via Electron IPC
      if (window.api) {
        const savedTabs = await window.api.getOpenTabs();
        if (savedTabs && savedTabs.tabs) {
          openTabs.value = savedTabs.tabs || [];
          activeTabId.value = savedTabs.activeTabId || null;
          return;
        }
      }
      
      // Fallback usando localStorage
      const savedTabsStr = localStorage.getItem('openTabs');
      if (savedTabsStr) {
        const savedTabsData = JSON.parse(savedTabsStr);
        openTabs.value = savedTabsData.tabs || [];
        activeTabId.value = savedTabsData.activeTabId || null;
      }
    } catch (error) {
      console.error('Erro ao carregar abas salvas:', error);
    }
  }

  // Getters
  const activeTab = computed(() => {
    return openTabs.value.find(tab => tab.id === activeTabId.value) || null;
  });

  return {
    openTabs,
    activeTabId,
    activeTab,
    addTab,
    removeTab,
    updateTabData,
    activateTab,
    loadSavedTabs
  };
}); 