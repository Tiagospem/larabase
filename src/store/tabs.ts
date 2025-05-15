import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { Table } from '@/types/table';

export const useTabsStore = defineStore('tabs', () => {
  const connectionStore = useConnectionsStore();
  const openTables = ref<Table[]>([]);
  const activeTableName = ref<string | null>(null);
  const shouldScrollToActiveTab = ref(false);
  const tabFilter = ref<string | null>(null);

  const pinnedTables = computed(() => {
    return openTables.value.filter(table => table.isPinned);
  });

  const isHotReloadActive = computed(() => {
    const activeTable = getActiveTable();

    if (activeTable) {
      return activeTable.isHotReload === true;
    }

    return false;
  });

  async function clearPinnedTables() {
    openTables.value.forEach(table => {
      table.isPinned = false;
    });

    await saveOpenTables();
  }

  async function toggleTablePin(table: Table) {
    table.isPinned = !table?.isPinned;

    await saveOpenTables();
  }

  async function openTable(table: Table, filter: string | null = null) {
    tabFilter.value = filter;

    let existingTab = openTables.value.find(t => t.name === table.name);

    if (existingTab) {
      activeTableName.value = existingTab.name;

      await nextTick();

      shouldScrollToActiveTab.value = true;

      if (filter !== null) {
        window.dispatchEvent(
          new CustomEvent('refresh-table-with-filter', {
            detail: { tableName: table.name, filter: filter },
          })
        );
      }

      return existingTab;
    }

    openTables.value.push(table);

    activeTableName.value = table.name;

    await nextTick();

    shouldScrollToActiveTab.value = true;

    await saveOpenTables();

    return table;
  }

  async function saveOpenTables() {
    try {
      localStorage.setItem(
        `open-tables-${connectionStore.projectId}`,
        JSON.stringify({
          tables: openTables.value,
          activeTableName: activeTableName.value,
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function loadSavedTables() {
    try {
      const savedTables = localStorage.getItem(`open-tables-${connectionStore.projectId}`);

      if (savedTables) {
        const savedTabsData = JSON.parse(savedTables);

        openTables.value = savedTabsData.tables || [];
        activeTableName.value = savedTabsData.activeTableName || null;
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function activateTable(table: Table) {
    if (openTables.value.some(t => t.name === table.name)) {
      const currentActiveTab = openTables.value.find(t => t.name === activeTableName.value);

      if (currentActiveTab && currentActiveTab.name !== table.name) {
        const hotReloadTabs = openTables.value.filter(t => t.isHotReload);

        hotReloadTabs.forEach(tab => {
          tab.isHotReload = false;
        });
      }

      activeTableName.value = table.name;

      setTimeout(() => {
        shouldScrollToActiveTab.value = true;
      }, 50);

      await saveOpenTables();
    }
  }

  async function reorderTables(newTabsOrder: Table[]) {
    openTables.value = newTabsOrder;
    await saveOpenTables();
  }

  async function removeTab(table: Table) {
    const index = openTables.value.findIndex(t => t.name === table.name);

    if (index !== -1) {
      openTables.value.splice(index, 1);

      if (activeTableName.value === table.name) {
        activeTableName.value =
          openTables.value.length > 0
            ? openTables.value[Math.min(index, openTables.value.length - 1)].name
            : null;
      }

      await saveOpenTables();
    }
  }

  function getActiveTable() {
    return openTables.value.find(t => t.name === activeTableName.value) as Table;
  }

  async function toggleHotReload() {
    const activeTable = getActiveTable();

    if (activeTable) {
      activeTable.isHotReload = !activeTable.isHotReload;

      await saveOpenTables();
    }
  }

  async function closeAllTabs() {
    openTables.value = [];
    activeTableName.value = null;
    shouldScrollToActiveTab.value = false;
    tabFilter.value = null;

    localStorage.removeItem(`open-tables-${connectionStore.projectId}`);
  }

  return {
    openTables,
    activeTableName,
    pinnedTables,
    shouldScrollToActiveTab,
    isHotReloadActive,
    tabFilter,
    clearPinnedTables,
    removeTab,
    activateTable,
    reorderTables,
    loadSavedTables,
    toggleTablePin,
    openTable,
    toggleHotReload,
    closeAllTabs,
  };
});
