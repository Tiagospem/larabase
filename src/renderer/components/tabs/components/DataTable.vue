<template>
  <div
    ref="tableContainer"
    tabindex="0"
    class="h-full relative flex flex-col"
    @keydown.prevent="handleKeyDown"
  >
    <div class="overflow-x-scroll overflow-y-auto flex-grow" style="max-height: calc(100% - 45px)">
      <table class="table table-sm w-[110%] table-fixed min-w-full">
        <thead class="bg-base-300 sticky top-0 z-15">
          <tr class="text-xs select-none">
            <th class="w-10 px-2 py-2 border-r border-neutral bg-base-300 sticky left-0 z-10">
              <span class="sr-only">Preview</span>
            </th>
            <th
              v-for="(column, index) in tableDataStore.columns"
              :key="column"
              class="px-4 py-2 border-r border-neutral last:border-r-0 relative whitespace-nowrap top-0 cursor-pointer bg-base-300"
              :style="{
                width:
                  tableDataStore.columnWidths[column] || tableDataStore.defaultColumnWidth(column),
                maxWidth:
                  tableDataStore.columnWidths[column] || tableDataStore.defaultColumnWidth(column)
              }"
            >
              <div class="flex items-center justify-between">
                <span class="truncate">{{ column }}</span>
                <div class="flex items-center">
                  <span
                    v-if="tableDataStore.currentSortColumn === column"
                    class="ml-1"
                    @click.stop="handleSortClick(column, $event)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                      :class="{ 'rotate-180': tableDataStore.currentSortDirection === 'desc' }"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4.5 15.75l7.5-7.5 7.5 7.5"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="ml-1 opacity-0 hover:opacity-100"
                    @click.stop="handleSortClick(column, $event)"
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
                        d="M4.5 15.75l7.5-7.5 7.5 7.5"
                      />
                    </svg>
                  </span>
                </div>
              </div>
              <div
                v-if="index < tableDataStore.columns.length - 1"
                class="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                @mousedown.stop="startColumnResize($event, column)"
              >
                <div
                  class="absolute right-0 top-0 w-[1px] h-full bg-transparent group-hover:bg-primary group-hover:w-[2px] transition-all"
                />
              </div>
            </th>
          </tr>
        </thead>

        <tbody @dblclick.stop.prevent>
          <tr
            v-for="(row, rowIndex) in tableDataStore.paginatedData"
            :key="rowIndex"
            :class="getRowClasses(rowIndex)"
            class="border-b border-neutral hover:bg-base-200 cursor-pointer"
            @click.stop="handleRowClick($event, rowIndex)"
            @mousedown.stop="handleMouseDown($event, rowIndex)"
            @mouseenter.stop="handleMouseEnter(rowIndex)"
          >
            <td
              class="w-10 px-1 border-r border-neutral text-center sticky left-0 z-10"
              :class="getRowBackgroundClass(rowIndex)"
            >
              <button
                class="btn btn-xs btn-circle btn-ghost"
                title="Preview data"
                @click.stop="openPreviewModal(row)"
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
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </button>
            </td>
            <td
              v-for="(column, colIndex) in tableDataStore.columns"
              :key="`${rowIndex}-${column}-${colIndex}`"
              class="px-4 py-2 border-r border-neutral last:border-r-0 truncate whitespace-nowrap overflow-hidden z-[1]"
              :style="{
                width:
                  tableDataStore.columnWidths[column] || tableDataStore.defaultColumnWidth(column),
                maxWidth:
                  tableDataStore.columnWidths[column] || tableDataStore.defaultColumnWidth(column)
              }"
              @dblclick.stop="editRecordRef.openEditModal(row)"
            >
              <div class="flex items-center justify-between w-full">
                <span
                  :class="{
                    'text-gray-500 italic':
                      row[column] === null && tableDataStore.isForeignKeyColumn(column)
                  }"
                >
                  {{
                    row[column] === null && tableDataStore.isForeignKeyColumn(column)
                      ? 'Not related'
                      : Helpers.formatCellValue(column, row[column])
                  }}
                </span>

                <button
                  v-if="tableDataStore.isForeignKeyColumn(column) && row[column] !== null"
                  class="ml-1 text-white hover:text-primary-focus transition-colors cursor-pointer flex-shrink-0"
                  @click.stop="emit('navigateToForeignKey', column, row[column])"
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
                      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                    />
                  </svg>
                </button>

                <span
                  v-else-if="tableDataStore.isForeignKeyColumn(column) && row[column] === null"
                  class="ml-1 text-gray-500 flex-shrink-0"
                  title="Relação nula"
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
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <EditRecord ref="editRecordRef" :store-id="storeId" />

  <DataPreviewModal
    v-if="tableDataStore.previewingRecord"
    :show="tableDataStore.showPreviewModal"
    :record="tableDataStore.previewingRecord"
    :columns="tableDataStore.columns"
    @close="closePreviewModal"
  />
</template>

<script setup>
import { useTableDataStore } from '@/store/table-data';
import { Helpers } from '@/utils/helpers';
import { onMounted, onUnmounted, ref } from 'vue';
import { useDatabaseStore } from '@/store/database';
import EditRecord from '@/components/tabs/components/EditRecord.vue';
import DataPreviewModal from '@/components/tabs/components/DataPreviewModal.vue';

const databaseStore = useDatabaseStore();

const props = defineProps({
  storeId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['navigateToForeignKey']);

const tableContainer = ref(null);
const shiftKeyPressed = ref(false);
const ctrlKeyPressed = ref(false);
const isDragging = ref(false);
const selectionStartId = ref(null);
const resizingColumn = ref(null);
const recentlyResized = ref(false);
const startX = ref(0);
const startWidth = ref(0);
const editRecordRef = ref(null);

const tableDataStore = useTableDataStore(props.storeId);

function startColumnResize (event, column) {
  event.preventDefault();
  event.stopPropagation();
  resizingColumn.value = column;
  startX.value = event.clientX;

  if (!tableDataStore.columnWidths[column] || !tableDataStore.columnWidths[column].endsWith('px')) {
    const headerCells = document.querySelectorAll('th');
    const columnIndex = tableDataStore.columns.indexOf(column);

    if (columnIndex >= 0 && headerCells[columnIndex]) {
      tableDataStore.columnWidths[column] = `${headerCells[columnIndex].offsetWidth}px`;
    } else {
      tableDataStore.columnWidths[column] = tableDataStore.defaultColumnWidth(column);
    }
  }

  startWidth.value = parseInt(tableDataStore.columnWidths[column]) || 100;

  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', stopColumnResize);
}

function stopColumnResize () {
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);

  resizingColumn.value = null;

  recentlyResized.value = true;

  setTimeout(() => {
    recentlyResized.value = false;
  }, 500);
}

function handleColumnResize (event) {
  if (!resizingColumn.value) return;

  const column = resizingColumn.value;
  const width = Math.max(60, startWidth.value + (event.clientX - startX.value));
  tableDataStore.columnWidths[column] = `${width}px`;
}

function handleSortClick (column) {
  if (tableDataStore.currentSortColumn === column) {
    tableDataStore.currentSortDirection =
      tableDataStore.currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    tableDataStore.currentSortColumn = column;
    tableDataStore.currentSortDirection = 'asc';
  }

  tableDataStore.currentPage = 1;

  if (tableDataStore.activeFilter) {
    emit('loadFilteredData');
  } else {
    tableDataStore.loadTableData();
  }
}

function scrollToTop () {
  if (tableContainer.value) {
    tableContainer.value.scrollTop = 0;
  }
}

const handleKeyDown = e => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;

  const isCtrlOrMeta = e.ctrlKey || e.metaKey;
  const hasSelection = tableDataStore.selectedRows.length > 0;

  switch (e.key) {
    case 'Escape':
      clearSelection();
      tableDataStore.showDeleteConfirm = false;
      break;

    case 'a':
      if (isCtrlOrMeta) {
        e.preventDefault();
        tableDataStore.selectedRows = tableDataStore.paginatedData.map((_, index) => index);
      }
      break;

    case 'Delete':
    case 'Backspace':
      if (hasSelection) {
        e.preventDefault();
        tableDataStore.deleteSelected();
      }
      break;
  }
};

function clearSelection () {
  tableDataStore.selectedRows = [];
  tableDataStore.lastSelectedId = null;
}

function handleMouseDown (event, rowIndex) {
  if (ctrlKeyPressed.value || shiftKeyPressed.value) {
    return;
  }

  isDragging.value = true;
  selectionStartId.value = rowIndex;

  window.addEventListener('mouseup', handleMouseUp, { once: true });
}

function handleMouseEnter (rowIndex) {
  if (!isDragging.value || selectionStartId.value === null) {
    return;
  }

  const start = Math.min(selectionStartId.value, rowIndex);
  const end = Math.max(selectionStartId.value, rowIndex);

  const rangeIds = [];

  for (let i = start; i <= end; i++) {
    rangeIds.push(i);
  }

  tableDataStore.selectedRows = rangeIds;
}

function handleMouseUp () {
  stopColumnResize();

  if (!isDragging.value || !selectionStartId.value) {
    isDragging.value = false;
    selectionStartId.value = null;
    return;
  }

  if (tableDataStore.selectedRows.length > 0) {
    tableDataStore.lastSelectedId =
      tableDataStore.selectedRows[tableDataStore.selectedRows.length - 1];
  }

  isDragging.value = false;
  selectionStartId.value = null;
}

function handleRowClick (event, rowIndex) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (isDragging.value) {
    return;
  }

  if (event && event.detail === 2) {
    return;
  }

  if (ctrlKeyPressed.value) {
    const index = tableDataStore.selectedRows.indexOf(rowIndex);
    if (index !== -1) {
      tableDataStore.selectedRows.splice(index, 1);
    } else {
      tableDataStore.selectedRows.push(rowIndex);
    }

    tableDataStore.lastSelectedId = rowIndex;
    return;
  }

  if (shiftKeyPressed.value && tableDataStore.lastSelectedId !== null) {
    const start = Math.min(tableDataStore.lastSelectedId, rowIndex);
    const end = Math.max(tableDataStore.lastSelectedId, rowIndex);

    const rangeIds = [];

    for (let i = start; i <= end; i++) {
      rangeIds.push(i);
    }

    tableDataStore.selectedRows = rangeIds;
    return;
  }

  if (tableDataStore.selectedRows.length === 1 && tableDataStore.selectedRows[0] === rowIndex) {
    tableDataStore.selectedRows = [];
    tableDataStore.lastSelectedId = null;
  } else {
    tableDataStore.selectedRows = [rowIndex];
    tableDataStore.lastSelectedId = rowIndex;
  }
}

function getRowClasses (rowIndex) {
  const isSelected = tableDataStore.selectedRows?.includes?.(rowIndex) ?? false;
  const isUpdated =
    tableDataStore.highlightChanges && (tableDataStore.updatedRows?.includes?.(rowIndex) ?? false);

  return {
    'selected-row': isSelected,
    'updated-row': isUpdated && !isSelected,
    'hover:bg-base-200': !isSelected
  };
}

function getRowBackgroundClass (rowIndex) {
  const isSelected = tableDataStore.selectedRows?.includes?.(rowIndex) ?? false;
  const isUpdated =
    tableDataStore.highlightChanges && (tableDataStore.updatedRows?.includes?.(rowIndex) ?? false);

  if (isSelected) {
    return 'bg-[#ea4331] text-white';
  }

  if (isUpdated) {
    return 'bg-[rgba(234,67,49,0.1)]';
  }

  return 'bg-base-100';
}

function closePreviewModal () {
  tableDataStore.showPreviewModal = false;
  setTimeout(() => {
    tableDataStore.previewingRecord = null;
  }, 300);
}

function openPreviewModal (row) {
  tableDataStore.previewingRecord = JSON.parse(JSON.stringify(row));
  tableDataStore.showPreviewModal = true;
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyDown);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyDown);
  window.removeEventListener('mouseup', handleMouseUp);
});

defineExpose({ scrollToTop });
</script>

<style scoped>
.table tbody tr {
  user-select: none;
}

[tabindex='0']:focus {
  outline: none;
}

.selected-row {
  background-color: #ea4331 !important;
  color: white !important;
}

.updated-row {
  background-color: rgba(234, 67, 49, 0.1) !important;
  position: relative;
  transition: background-color 0.5s ease;
}

@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0px rgba(234, 67, 49, 0.4);
  }
  100% {
    box-shadow: 0 0 0 0.25px rgba(234, 67, 49, 0);
  }
}

.updated-row td {
  animation: pulse-border 2s ease-out;
}

.table tr.selected-row:nth-child(odd),
.table tr.selected-row:nth-child(even) {
  background-color: #ea4331 !important;
  color: white !important;
}

th:has(+ tr td.expanded) {
  min-width: 200px !important;
  max-width: none !important;
}

.table-fixed {
  table-layout: fixed;
}

.group:hover .bg-gray-500 {
  background-color: theme('colors.primary');
}

.h-full.flex.flex-col {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.flex-1.overflow-auto {
  min-height: 0;
}

.table {
  border-collapse: separate;
  border-spacing: 0;
}

.table th,
.table td {
  border: 0.5px solid #333 !important;
}

thead {
  z-index: 15 !important;
}

.table > thead.bg-base-300 > tr > th {
  border: 0.5px solid #000 !important;
}

tbody tr:not(.selected-row):hover td.sticky,
tbody tr:not(.selected-row):hover td[class*='sticky'],
tbody tr:not(.selected-row).hover td.sticky,
tbody tr:not(.selected-row).hover td[class*='sticky'] {
  background-color: hsl(var(--b2)) !important;
}

tbody tr:not(.selected-row):hover td[class*='left-10'],
tbody tr:not(.selected-row).hover td[class*='left-10'] {
  background-color: hsl(var(--b2)) !important;
}

tbody tr.selected-row:hover td.sticky,
tbody tr.selected-row:hover td[class*='sticky'],
tbody tr.selected-row:hover td[class*='left-10'] {
  background-color: #ea4331 !important;
  color: white !important;
}
</style>
