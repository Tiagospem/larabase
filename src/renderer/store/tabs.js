import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useTabsStore = defineStore("tabs", () => {
  const openTabs = ref([]);
  const activeTabId = ref(null);
  const pinnedTabIds = ref([]);

  const tabs = computed(() => openTabs.value);

  const pinnedTabs = computed(() => {
    return openTabs.value.filter((tab) => pinnedTabIds.value.includes(tab.id));
  });

  const hasPinnedTabs = computed(() => pinnedTabIds.value.length > 0);

  function saveTabPinState() {
    try {
      localStorage.setItem("pinnedTabIds", JSON.stringify(pinnedTabIds.value));
    } catch (e) {
      console.error("Error saving tab pin state:", e);
    }
  }

  function loadTabPinState() {
    try {
      const savedPinnedIds = localStorage.getItem("pinnedTabIds");

      if (savedPinnedIds) {
        const loadedIds = JSON.parse(savedPinnedIds);

        if (Array.isArray(loadedIds)) {
          const stringLoadedIds = loadedIds.map((id) => String(id));
          const currentTabIds = openTabs.value.map((tab) => String(tab.id));

          const validPinnedIds = stringLoadedIds.filter((id) => currentTabIds.includes(id));

          pinnedTabIds.value = validPinnedIds.map((id) => {
            const numId = Number(id);
            return !isNaN(numId) ? numId : id;
          });
        }
      }
    } catch (e) {
      console.error("Error loading tab pin state:", e);
      pinnedTabIds.value = [];
    }

    return Promise.resolve();
  }

  function pinTab(tabId) {
    if (!pinnedTabIds.value.includes(tabId)) {
      pinnedTabIds.value.push(tabId);
      saveTabPinState();
    }
  }

  function unpinTab(tabId) {
    pinnedTabIds.value = pinnedTabIds.value.filter((id) => id !== tabId);
    saveTabPinState();
  }

  function toggleTabPin(tabId) {
    if (pinnedTabIds.value.includes(tabId)) {
      unpinTab(tabId);
    } else {
      pinTab(tabId);
    }
  }

  function clearPinnedTabs() {
    pinnedTabIds.value = [];
    saveTabPinState();
  }

  function isTabPinned(tabId) {
    return pinnedTabIds.value.includes(tabId);
  }

  async function addTab(tableData) {
    const isFiltered = tableData.filter && tableData.filter.trim() !== "";

    let existingTab;

    if (isFiltered) {
      existingTab = openTabs.value.find((tab) => tab.connectionId === tableData.connectionId && tab.tableName === tableData.tableName && tab.filter === tableData.filter);
    } else {
      existingTab = openTabs.value.find((tab) => tab.connectionId === tableData.connectionId && tab.tableName === tableData.tableName && (!tab.filter || tab.filter.trim() === ""));
    }

    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }

    let tabTitle = tableData.tableName;
    if (isFiltered) {
      const shortFilter = tableData.filter.length > 20 ? tableData.filter.substring(0, 20) + "..." : tableData.filter;
      tabTitle = `${tableData.tableName} (${shortFilter})`;
    }

    const newTab = {
      id: tableData.id || Date.now(),
      connectionId: tableData.connectionId,
      tableName: tableData.tableName,
      title: tableData.title || tabTitle,
      filter: tableData.filter || "",
      data: null,
      isLoading: true,
      columnCount: tableData.columnCount || 0
    };

    openTabs.value.push(newTab);
    activeTabId.value = newTab.id;

    await saveOpenTabs();

    return newTab;
  }

  async function removeTab(tabId) {
    const index = openTabs.value.findIndex((tab) => tab.id === tabId);

    if (index !== -1) {
      const tabToRemove = openTabs.value[index];

      if (tabToRemove.connectionId && tabToRemove.tableName) {
        try {
          const liveTableKey = `liveTable.enabled.${tabToRemove.connectionId}.${tabToRemove.tableName}`;
          localStorage.setItem(liveTableKey, "false");
        } catch (e) {
          console.error("Error deactivating live table during tab removal:", e);
        }
      }

      openTabs.value.splice(index, 1);

      if (pinnedTabIds.value.includes(tabId)) {
        unpinTab(tabId);
      }

      if (activeTabId.value === tabId) {
        activeTabId.value = openTabs.value.length > 0 ? openTabs.value[Math.min(index, openTabs.value.length - 1)].id : null;
      }

      await saveOpenTabs();
    }
  }

  async function updateTabData(tabId, data) {
    const tab = openTabs.value.find((tab) => tab.id === tabId);
    if (tab) {
      tab.data = data;
      tab.isLoading = false;
      await saveOpenTabs();
    }
  }

  function activateTab(tabId) {
    if (openTabs.value.some((tab) => tab.id === tabId)) {
      const currentActiveTab = openTabs.value.find((tab) => tab.id === activeTabId.value);
      const newActiveTab = openTabs.value.find((tab) => tab.id === tabId);

      if (currentActiveTab && currentActiveTab.id !== tabId) {
        if (currentActiveTab.connectionId && currentActiveTab.tableName) {
          try {
            const currentLiveKey = `liveTable.enabled.${currentActiveTab.connectionId}.${currentActiveTab.tableName}`;
            const currentLiveEnabled = localStorage.getItem(currentLiveKey) === "true";

            if (currentLiveEnabled) {
              localStorage.setItem(currentLiveKey, "false");

              if (newActiveTab && newActiveTab.connectionId && newActiveTab.tableName) {
                const newLiveKey = `liveTable.enabled.${newActiveTab.connectionId}.${newActiveTab.tableName}`;
                const newLiveEnabled = localStorage.getItem(newLiveKey) === "true";

                if (newLiveEnabled) {
                  localStorage.setItem(currentLiveKey, "false");
                }
              }
            }
          } catch (e) {
            console.error("Error handling Live Table state during tab activation:", e);
          }
        }
      }

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
        const simplifiedTabs = openTabs.value.map((tab) => ({
          id: tab.id,
          connectionId: tab.connectionId,
          tableName: tab.tableName,
          title: tab.title,
          filter: tab.filter || "",
          rowCount: tab.data?.rowCount || 0,
          columnCount: tab.data?.columns?.length || 0
        }));

        await window.api.saveOpenTabs({
          tabs: simplifiedTabs,
          activeTabId: activeTabId.value
        });
      }

      const simplifiedTabs = openTabs.value.map((tab) => ({
        id: tab.id,
        connectionId: tab.connectionId,
        tableName: tab.tableName,
        title: tab.title,
        filter: tab.filter || "",
        columnCount: tab.columnCount || 0,
        rowCount: tab.data?.rowCount || 0
      }));

      localStorage.setItem(
        "openTabs",
        JSON.stringify({
          tabs: simplifiedTabs,
          activeTabId: activeTabId.value
        })
      );
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

      const savedTabsStr = localStorage.getItem("openTabs");
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
    openTabs.value.forEach((tab) => {
      try {
        if (tab.connectionId && tab.tableName) {
          const liveTableKey = `liveTable.enabled.${tab.connectionId}.${tab.tableName}`;
          localStorage.setItem(liveTableKey, "false");
        }
      } catch (e) {
        console.error("Error deactivating live table during all tabs removal:", e);
      }
    });

    openTabs.value = [];
    activeTabId.value = null;
    pinnedTabIds.value = [];
    saveTabPinState();
    await saveOpenTabs();
  }

  async function closeTabsByConnectionId(connectionId) {
    if (!connectionId) return;

    const initialTabsCount = openTabs.value.length;

    const tabsToClose = openTabs.value.filter((tab) => tab.connectionId === connectionId);

    tabsToClose.forEach((tab) => {
      try {
        if (tab.tableName) {
          const liveTableKey = `liveTable.enabled.${connectionId}.${tab.tableName}`;
          localStorage.setItem(liveTableKey, "false");
        }

        // Remove tab from pinned tabs if it's pinned
        if (pinnedTabIds.value.includes(tab.id)) {
          unpinTab(tab.id);
        }
      } catch (e) {
        console.error("Error deactivating live table during connection tabs removal:", e);
      }
    });

    openTabs.value = openTabs.value.filter((tab) => tab.connectionId !== connectionId);

    if (initialTabsCount > openTabs.value.length) {
      if (!openTabs.value.some((tab) => tab.id === activeTabId.value)) {
        activeTabId.value = openTabs.value.length > 0 ? openTabs.value[0].id : null;
      }
      await saveOpenTabs();
    }

    return initialTabsCount - openTabs.value.length;
  }

  const activeTab = computed(() => {
    return openTabs.value.find((tab) => tab.id === activeTabId.value) || null;
  });

  return {
    openTabs,
    activeTabId,
    activeTab,
    tabs,
    pinnedTabIds,
    pinnedTabs,
    hasPinnedTabs,
    toggleTabPin,
    clearPinnedTabs,
    isTabPinned,
    addTab,
    removeTab,
    updateTabData,
    activateTab,
    reorderTabs,
    loadSavedTabs,
    loadTabPinState,
    saveOpenTabs,
    saveTabs: saveOpenTabs,
    closeAllTabs,
    closeTabsByConnectionId
  };
});
