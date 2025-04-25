<template>
  <div
    v-if="openTabs.length > 0"
    class="tabs-container border-b border-neutral bg-base-300"
  >
    <button
      v-if="hasScrollLeft"
      class="tab-scroll-button bg-info-content"
      @click="scrollLeft"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15.75 19.5L8.25 12l7.5-7.5"
        />
      </svg>
    </button>

    <div
      ref="tabsScrollRef"
      class="tabs-scroll"
      @scroll="checkScrollPosition"
    >
      <div
        v-for="tab in openTabs"
        :key="tab.id"
        :class="[
          'tab bg-base-200 hover:bg-base-100',
          {
            '!bg-base-100 !text-white': tab.id === activeTabId,
            'border-t border-primary': isTabPinned(tab.id)
          }
        ]"
        draggable="true"
        @click="activateTab(tab.id)"
        @dragstart="handleDragStart($event, tab.id)"
        @dragover.prevent
        @drop="handleDrop($event, tab.id)"
      >
        <span
          class="pin-indicator"
          @click.stop="toggleTabPin(tab.id)"
        >
          <IconPin
            v-if="!isTabPinned(tab.id)"
            class="opacity-50 hover:opacity-100"
          />
          <IconPinFilled
            v-else
            class="text-primary"
          />
        </span>
        <span class="tab-title">{{ tab.title }}</span>
        <button
          class="close-icon"
          @click.stop="closeTab(tab.id)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <button
      v-if="hasScrollRight"
      class="tab-scroll-button bg-info-content"
      @click="scrollRight"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8.25 4.5l7.5 7.5-7.5 7.5"
        />
      </svg>
    </button>

    <div
      class="tabs-actions flex items-center bg-black"
      v-if="pinnedTabs.length > 0"
    >
      <!-- Pinned tabs actions menu -->
      <div class="dropdown dropdown-end">
        <label
          tabindex="0"
          class="tab-action-button ml-1 flex items-center cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 mr-1"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
            />
          </svg>
          <div class="bg-neutral text-xs rounded-full px-1.5 text-center ml-1 min-w-[20px]">
            {{ pinnedTabs.length }}
          </div>
        </label>

        <ul
          tabindex="0"
          class="dropdown-content menu p-2 shadow-sm bg-base-100 rounded-box w-56"
        >
          <li>
            <a
              @click="confirmTruncatePinnedTables()"
              class="text-error"
            >
              <IconTruncate />
              <span>Truncate tables</span>
            </a>
          </li>
          <li>
            <a @click="clearPinnedTabs()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              <span>Unpin all</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Truncate Confirmation Modal -->
  <div
    class="modal"
    :class="{ 'modal-open': showTruncateConfirm }"
  >
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error">⚠️ Truncate Tables</h3>
      <p class="py-4">
        Are you sure you want to truncate <strong>{{ pinnedTabs.length }}</strong> table(s)? This will delete ALL records and cannot be undone.
      </p>
      <div class="max-h-40 overflow-y-auto bg-base-300 rounded-sm p-2 mb-4">
        <ul class="list-disc pl-4 space-y-1">
          <li
            v-for="tab in pinnedTabs"
            :key="tab.id"
          >
            {{ tab.tableName }}
          </li>
        </ul>
      </div>
      <div class="form-control">
        <label class="label cursor-pointer justify-start">
          <input
            v-model="ignoreForeignKeys"
            type="checkbox"
            class="checkbox checkbox-sm checkbox-error mr-2"
          />
          <span class="label-text">Ignore foreign key constraints</span>
        </label>
      </div>
      <div class="modal-action">
        <button
          class="btn"
          @click="showTruncateConfirm = false"
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          :disabled="isProcessing"
          @click="truncatePinnedTables"
        >
          <span
            v-if="isProcessing"
            class="loading loading-spinner loading-xs mr-2"
          ></span>
          Truncate Tables
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="showTruncateConfirm = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch, onUnmounted } from "vue";
import { useTabsStore } from "@/store/tabs";
import { useDatabaseStore } from "@/store/database";
import { useTablesStore } from "@/store/tables";
import IconPin from "@/components/icons/IconPin.vue";
import IconPinFilled from "@/components/icons/IconPinFilled.vue";
import IconTruncate from "@/components/icons/IconTruncate.vue";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
});

const tabsStore = useTabsStore();
const databaseStore = useDatabaseStore();
const tablesStore = useTablesStore();
const showAlert = inject("showAlert");

const draggingTabId = ref(null);
const showTruncateConfirm = ref(false);
const ignoreForeignKeys = ref(true);
const isProcessing = ref(false);

/**
 * @type {import('vue').Ref<HTMLElement>}
 */
const tabsScrollRef = ref(null);

const hasScrollRight = ref(false);
const hasScrollLeft = ref(false);

const activeTabId = computed(() => tabsStore.activeTabId);
const openTabs = computed(() => tabsStore.openTabs);
const pinnedTabs = computed(() => tabsStore.pinnedTabs);

function isTabPinned(tabId) {
  return tabsStore.isTabPinned(tabId);
}

function toggleTabPin(tabId) {
  tabsStore.toggleTabPin(tabId);
}

function clearPinnedTabs() {
  tabsStore.clearPinnedTabs();
}

function confirmTruncatePinnedTables() {
  if (pinnedTabs.value.length === 0) return;
  showTruncateConfirm.value = true;
}

async function truncatePinnedTables() {
  if (pinnedTabs.value.length === 0) return;

  isProcessing.value = true;

  try {
    const tabsByConnection = {};

    pinnedTabs.value.forEach((tab) => {
      if (!tabsByConnection[tab.connectionId]) {
        tabsByConnection[tab.connectionId] = [];
      }
      tabsByConnection[tab.connectionId].push(tab.tableName);
    });

    const results = [];

    for (const [connectionId, tableNames] of Object.entries(tabsByConnection)) {
      try {
        const result = await databaseStore.truncateTables(connectionId, tableNames, ignoreForeignKeys.value);

        if (result.results) {
          results.push(...result.results);
        }
      } catch (error) {
        console.error(`Error truncating tables for connection ${connectionId}:`, error);

        tableNames.forEach((tableName) => {
          results.push({
            tableName,
            success: false,
            message: error.message
          });
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (failCount === 0) {
      showAlert(`Successfully truncated ${successCount} table(s)`, "success");
    } else if (successCount === 0) {
      showAlert(`Failed to truncate ${failCount} table(s)`, "error");
    } else {
      showAlert(`Truncated ${successCount} table(s), failed to truncate ${failCount}`, "warning");
    }

    // Reload all truncated tables and update record counts
    for (let connectionId in tabsByConnection) {
      const connectionTables = results.filter((r) => r.success && tabsByConnection[connectionId].includes(r.tableName));

      connectionTables.forEach((result) => {
        // Set the record count to zero for successfully truncated tables
        tablesStore.updateTableRecordCount(result.tableName, 0);

        // Dispatch both reload-table-data and truncate-table events
        window.dispatchEvent(
          new CustomEvent("reload-table-data", {
            detail: {
              connectionId: connectionId,
              tableName: result.tableName,
              totalRecords: 0,
              forceReset: true
            }
          })
        );

        // Add a truncate-table event
        window.dispatchEvent(
          new CustomEvent("truncate-table", {
            detail: {
              connectionId: connectionId,
              tableName: result.tableName,
              totalRecords: 0,
              forceReset: true
            }
          })
        );
      });
    }

    showTruncateConfirm.value = false;
  } catch (error) {
    console.error(`Error in truncatePinnedTables:`, error);
    showAlert(`Error truncating tables: ${error.message}`, "error");
  } finally {
    isProcessing.value = false;
  }
}

function scrollLeft() {
  if (!tabsScrollRef.value) return;

  /**
   * @type {HTMLElement}
   */
  const container = tabsScrollRef.value;

  const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
  container.scrollBy({
    left: -scrollAmount,
    behavior: "smooth"
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
    behavior: "smooth"
  });
}

function handleDragStart(event, tabId) {
  draggingTabId.value = tabId;
  event.dataTransfer.effectAllowed = "move";
}

function handleDrop(event, targetTabId) {
  if (draggingTabId.value === null) return;

  const draggedTabIndex = openTabs.value.findIndex((tab) => tab.id === draggingTabId.value);
  const targetTabIndex = openTabs.value.findIndex((tab) => tab.id === targetTabId);

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
      new CustomEvent("tab-activated", {
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
  const activeTabElement = tabsScrollRef.value.querySelector(".tab.active");

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
      behavior: "smooth"
    });
  } else if (tabLeft < scrollContainer.scrollLeft) {
    scrollContainer.scrollTo({
      left: tabLeft - 20,
      behavior: "smooth"
    });
  }

  checkScrollPosition();
}

function handleOpenTab(tabData) {
  try {
    if (!tabData.data || !tabData.data.connectionId || !tabData.data.tableName) {
      showAlert("Failed to open tabs", "error");
      return;
    }

    const targetTable = databaseStore.tablesList.find((t) => t.name === tabData.data.tableName);

    if (!targetTable) {
      showAlert(`Table "${tabData.data.tableName}" not found`, "error");

      return;
    }

    const filter = tabData.data.filter || "";

    const newTab = {
      id: tabData.id || `data-${tabData.data.connectionId}-${tabData.data.tableName}-${Date.now()}`,
      title: tabData.title || tabData.data.tableName,
      type: "data",
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
    showAlert(`Failed to open tab: ${error.message}`, "error");
  }
}

function handleUpdateTabData(tabName, data) {
  const tab = openTabs.value.find((t) => t.tableName === tabName);
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
      filter: filter || ""
    });
    nextTick(() => {
      scrollToActiveTab();
    });
  } catch (error) {
    console.error(error);
  }
}

onMounted(async () => {
  await tabsStore.loadSavedTabs();
  await nextTick();
  await tabsStore.loadTabPinState();
  checkScrollPosition();
});

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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  min-width: 180px;
  max-width: 180px;
  padding: 0 10px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.pin-indicator {
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 3px;
  border-radius: 3px;
  transition: background-color 0.2s ease;
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
  shrink: 0;
}

.tab:hover .close-icon {
  opacity: 1;
}

.tab-scroll-button {
  width: 28px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bbb;
  shrink: 0;
  transition: background-color 0.2s;
  z-index: 1;
}

.tabs-actions {
  padding: 0 8px;
  z-index: 999;
  position: relative;
}

.tab-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  margin: 0 3px;
  padding: 0 6px;
  border-radius: 4px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

/* Fix for dropdown z-index */
.tabs-actions .absolute {
  z-index: 9999 !important;
}

/* Fix for dropdown z-index */
.dropdown-content {
  z-index: 9999 !important;
}
</style>
