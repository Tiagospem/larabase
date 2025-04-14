import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTabsStore = defineStore('tabs', () => {
  const openTabs = ref([]);
  const activeTabId = ref(null);

  async function addTab(tableData) {
    // Verificar se deve buscar pela combinação tabela+filtro
    const isFiltered = tableData.filter && tableData.filter.trim() !== '';
    
    let existingTab;
    
    if (isFiltered) {
      // Se tem filtro, precisamos verificar se existe uma aba exatamente igual (tabela e filtro)
      existingTab = openTabs.value.find(tab =>
        tab.connectionId === tableData.connectionId &&
        tab.tableName === tableData.tableName &&
        tab.filter === tableData.filter
      );
    } else {
      // Sem filtro, verificamos apenas a tabela
      existingTab = openTabs.value.find(tab =>
        tab.connectionId === tableData.connectionId &&
        tab.tableName === tableData.tableName &&
        (!tab.filter || tab.filter.trim() === '')
      );
    }

    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }

    // Construir o título da aba
    let tabTitle = tableData.tableName;
    if (isFiltered) {
      // Adicionar uma versão resumida do filtro ao título
      const shortFilter = tableData.filter.length > 20 
        ? tableData.filter.substring(0, 20) + '...' 
        : tableData.filter;
      tabTitle = `${tableData.tableName} (${shortFilter})`;
    }

    const newTab = {
      id: tableData.id || Date.now(),
      connectionId: tableData.connectionId,
      tableName: tableData.tableName,
      title: tableData.title || tabTitle,
      filter: tableData.filter || '',
      data: null,
      isLoading: true,
      columnCount: tableData.columnCount || 0,
    };

    console.log("Criando nova aba com filtro:", newTab.filter);

    openTabs.value.push(newTab);
    activeTabId.value = newTab.id;

    await saveOpenTabs();

    return newTab;
  }

  async function removeTab(tabId) {
    const index = openTabs.value.findIndex(tab => tab.id === tabId);

    if (index !== -1) {
      openTabs.value.splice(index, 1);

      if (activeTabId.value === tabId) {
        activeTabId.value = openTabs.value.length > 0
            ? openTabs.value[Math.min(index, openTabs.value.length - 1)].id
            : null;
      }

      await saveOpenTabs();
    }
  }

  async function updateTabData(tabId, data) {
    const tab = openTabs.value.find(tab => tab.id === tabId);
    if (tab) {
      tab.data = data;
      tab.isLoading = false;
      await saveOpenTabs();
    }
  }

  function activateTab(tabId) {
    if (openTabs.value.some(tab => tab.id === tabId)) {
      activeTabId.value = tabId;
    }
  }

  async function reorderTabs(newTabsOrder) {
    openTabs.value = newTabsOrder;
    await saveOpenTabs();
  }

  async function saveOpenTabs() {
    try {
      if (window.api) {
        const simplifiedTabs = openTabs.value.map(tab => ({
          id: tab.id,
          connectionId: tab.connectionId,
          tableName: tab.tableName,
          title: tab.title,
          filter: tab.filter || '',
          rowCount: tab.data?.rowCount || 0,
          columnCount: tab.data?.columns?.length || 0,
        }));

        await window.api.saveOpenTabs({
          tabs: simplifiedTabs,
          activeTabId: activeTabId.value
        });
      }

      const simplifiedTabs = openTabs.value.map(tab => ({
        id: tab.id,
        connectionId: tab.connectionId,
        tableName: tab.tableName,
        title: tab.title,
        filter: tab.filter || '',
        columnCount: tab.columnCount || 0,
        rowCount: tab.data?.rowCount || 0,
      }));

      localStorage.setItem('openTabs', JSON.stringify({
        tabs: simplifiedTabs,
        activeTabId: activeTabId.value
      }));
    } catch (error) {
      console.error(error);
    }
  }

  async function loadSavedTabs() {
    try {
      if (window.api) {
        const savedTabs = await window.api.getOpenTabs();
        if (savedTabs && savedTabs.tabs) {
          openTabs.value = savedTabs.tabs || [];
          activeTabId.value = savedTabs.activeTabId || null;
          return;
        }
      }

      const savedTabsStr = localStorage.getItem('openTabs');
      if (savedTabsStr) {
        const savedTabsData = JSON.parse(savedTabsStr);
        openTabs.value = savedTabsData.tabs || [];
        activeTabId.value = savedTabsData.activeTabId || null;
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function closeAllTabs() {
    openTabs.value = [];
    activeTabId.value = null;
    await saveOpenTabs();
  }

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
    reorderTabs,
    loadSavedTabs,
    closeAllTabs
  };
}); 