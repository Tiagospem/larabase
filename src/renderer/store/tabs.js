import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTabsStore = defineStore('tabs', () => {
  const openTabs = ref([]);
  const activeTabId = ref(null);

  async function addTab(tableData) {
    const existingTab = openTabs.value.find(tab =>
        tab.connectionId === tableData.connectionId &&
        tab.tableName === tableData.tableName
    );

    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }

    const newTab = {
      id: Date.now(),
      connectionId: tableData.connectionId,
      tableName: tableData.tableName,
      title: tableData.tableName,
      data: null,
      isLoading: true,
      columnCount: tableData.columnCount || 0,
    };

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

  async function saveOpenTabs() {
    try {
      if (window.api) {
        await window.api.saveOpenTabs({
          tabs: openTabs.value,
          activeTabId: activeTabId.value
        });
      }

      localStorage.setItem('openTabs', JSON.stringify({
        tabs: openTabs.value,
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