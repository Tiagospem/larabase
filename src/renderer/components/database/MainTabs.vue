<template>
  <div v-if="openTabs.length > 0" class="tabs-container border-b border-neutral bg-base-300">
    <button v-if="hasScrollLeft" class="tab-scroll-button tab-scroll-left" @click="scrollLeft">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>

    <div ref="tabsScrollRef" class="tabs-scroll" @scroll="checkScrollPosition">
      <div
        v-for="tab in openTabs"
        :key="tab.id"
        :class="['tab', { active: tab.id === activeTabId }]"
        draggable="true"
        @click="activateTab(tab.id)"
        @dragstart="handleDragStart($event, tab.id)"
        @dragover.prevent
        @drop="handleDrop($event, tab.id)"
      >
        <span class="tab-title">{{ tab.title }}</span>
        <button class="close-icon" @click.stop="closeTab(tab.id)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <button v-if="hasScrollRight" class="tab-scroll-button tab-scroll-right" @click="scrollRight">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useTabsStore } from '@/store/tabs';
import { useDatabaseStore } from '@/store/database';

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
});

const tabsStore = useTabsStore();
const databaseStore = useDatabaseStore();

const draggingTabId = ref(null);

/**
 * @type {import('vue').Ref<HTMLElement>}
 */
const tabsScrollRef = ref(null);

const hasScrollRight = ref(false);
const hasScrollLeft = ref(false);

const activeTabId = computed(() => tabsStore.activeTabId);

const openTabs = computed(() => tabsStore.openTabs);

function scrollLeft() {
  if (!tabsScrollRef.value) return;

  /**
   * @type {HTMLElement}
   */
  const container = tabsScrollRef.value;

  const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
  container.scrollBy({
    left: -scrollAmount,
    behavior: 'smooth'
  });
}

function scrollRight() {
  if (!tabsScrollRef.value) return;

  /**
   * @type {HTMLElement}
   */
  const container = tabsScrollRef.value;

  const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
  container.scrollBy({
    left: scrollAmount,
    behavior: 'smooth'
  });
}

function handleDragStart(event, tabId) {
  draggingTabId.value = tabId;
  event.dataTransfer.effectAllowed = 'move';
}

function handleDrop(event, targetTabId) {
  if (draggingTabId.value === null) return;

  const draggedTabIndex = openTabs.value.findIndex(tab => tab.id === draggingTabId.value);
  const targetTabIndex = openTabs.value.findIndex(tab => tab.id === targetTabId);

  if (draggedTabIndex === -1 || targetTabIndex === -1) return;

  const tabs = [...openTabs.value];
  const [removed] = tabs.splice(draggedTabIndex, 1);
  tabs.splice(targetTabIndex, 0, removed);

  tabsStore.reorderTabs(tabs);
  draggingTabId.value = null;
}

function checkScrollPosition() {
  if (!tabsScrollRef.value) return;

  /**
   * @type {HTMLElement}
   */
  const container = tabsScrollRef.value;

  hasScrollLeft.value = container.scrollLeft > 0;
  hasScrollRight.value = container.scrollLeft < container.scrollWidth - container.clientWidth;
}

function activateTab(tabId) {
  tabsStore.activateTab(tabId);

  nextTick(() => {
    window.dispatchEvent(
      new CustomEvent('tab-activated', {
        detail: { tabId }
      })
    );

    scrollToActiveTab();
  });
}

function closeTab(tabId) {
  tabsStore.removeTab(tabId);
}

function scrollToActiveTab() {
  if (!tabsScrollRef.value) return;

  /**
   * @type {HTMLElement}
   */
  const activeTabElement = tabsScrollRef.value.querySelector('.tab.active');

  if (!activeTabElement) return;

  /**
   * @type {HTMLElement}
   */
  const scrollContainer = tabsScrollRef.value;

  const containerWidth = scrollContainer.offsetWidth;
  const tabLeft = activeTabElement.offsetLeft;
  const tabWidth = activeTabElement.offsetWidth;

  if (tabLeft + tabWidth > scrollContainer.scrollLeft + containerWidth) {
    scrollContainer.scrollTo({
      left: tabLeft + tabWidth - containerWidth + 20,
      behavior: 'smooth'
    });
  } else if (tabLeft < scrollContainer.scrollLeft) {
    scrollContainer.scrollTo({
      left: tabLeft - 20,
      behavior: 'smooth'
    });
  }

  checkScrollPosition();
}

function handleOpenTab(tabData) {
  try {
    if (!tabData.data || !tabData.data.connectionId || !tabData.data.tableName) {
      showAlert('Failed to open tabs', 'error');
      return;
    }

    const targetTable = databaseStore.tablesList.find(t => t.name === tabData.data.tableName);

    if (!targetTable) {
      showAlert(`Table "${tabData.data.tableName}" not found`, 'error');

      return;
    }

    const filter = tabData.data.filter || '';

    const newTab = {
      id: tabData.id || `data-${tabData.data.connectionId}-${tabData.data.tableName}-${Date.now()}`,
      title: tabData.title || tabData.data.tableName,
      type: 'data',
      connectionId: tabData.data.connectionId,
      tableName: tabData.data.tableName,
      filter: filter,
      columnCount: targetTable.columnCount || 0
    };

    tabsStore.addTab(newTab);

    nextTick(() => {
      scrollToActiveTab();
    });
  } catch (error) {
    showAlert(`Failed to open tab: ${error.message}`, 'error');
  }
}

function handleUpdateTabData(tabName, data) {
  const tab = openTabs.value.find(t => t.tableName === tabName);
  if (tab) {
    tabsStore.updateTabData(tab.id, data);
  }
}

function openTable(table, filter) {
  try {
    tabsStore.addTab({
      connectionId: props.connectionId,
      tableName: table.name,
      columnCount: table.columnCount,
      filter: filter || ''
    });
    nextTick(() => {
      scrollToActiveTab();
    });
  } catch (error) {
    console.error(error);
  }
}

watch(
  () => openTabs.value.length,
  () => {
    nextTick(() => {
      checkScrollPosition();
    });
  }
);

watch(
  () => tabsStore.activeTabId,
  () => {
    nextTick(() => {
      scrollToActiveTab();
    });
  }
);

defineExpose({
  scrollToActiveTab,
  checkScrollPosition,
  handleOpenTab,
  handleUpdateTabData,
  openTable
});
</script>

<style scoped>
.tabs-container {
  position: relative;
  width: 100%;
  height: 35px;
  overflow: hidden;
  display: flex;
}

.tabs-scroll {
  display: flex;
  overflow-x: auto;
  height: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  min-width: 180px;
  max-width: 180px;
  padding: 0 10px;
  border-right: 1px solid rgb(24, 24, 27);
  background-color: rgb(24, 24, 27);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.tab.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.close-icon {
  opacity: 0.7;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 6px;
  flex-shrink: 0;
}

.tab:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tab:hover .close-icon {
  opacity: 1;
}

.close-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tab-scroll-button {
  width: 28px;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bbb;
  flex-shrink: 0;
  transition: background-color 0.2s;
  z-index: 1;
}

.tab-scroll-button:hover {
  background-color: rgb(24, 24, 27);
  color: white;
}

.tab-scroll-left {
  border-right: 1px solid rgb(24, 24, 27);
}

.tab-scroll-right {
  border-left: 1px solid rgb(24, 24, 27);
}
</style>
