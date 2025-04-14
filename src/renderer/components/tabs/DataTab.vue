<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadTableData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
        <button 
          class="btn btn-sm btn-ghost"
          :disabled="selectedRows.length === 0"
          @click="deleteSelected">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          <span>Delete{{ selectedRows.length > 0 ? ` (${selectedRows.length})` : '' }}</span>
        </button>
      </div>
      
      <div class="flex items-center space-x-2">
        <div class="relative">
          <input type="text" placeholder="Filter..." 
            class="input input-sm input-bordered bg-base-300 w-40" 
            v-model="filterTerm" />
        </div>
        <select class="select select-sm select-bordered bg-base-300 w-32" v-model="rowsPerPage">
          <option value="10">10 rows</option>
          <option value="25">25 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else-if="loadError" class="flex items-center justify-center h-full text-error">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p>{{ loadError }}</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Try again</button>
        </div>
      </div>
      
      <div v-else-if="tableData.length > 0" 
           ref="tableContainer" 
           @click="handleOutsideClick"
           tabindex="0"
           @keydown.prevent="handleTableKeyDown"
           class="h-full overflow-auto relative pb-3">
        <div class="overflow-x-auto">
          <table class="table table-sm w-full table-fixed min-w-full">
            <thead class="bg-base-300 sticky top-0 z-10">
              <tr class="text-xs select-none">
                <th v-for="(column, index) in columns" 
                    :key="column" 
                    class="px-4 py-2 border-r border-neutral last:border-r-0 relative whitespace-nowrap"
                    :style="{ width: columnWidths[column] || defaultColumnWidth(column), maxWidth: columnWidths[column] || defaultColumnWidth(column) }">
                  <div class="flex items-center justify-between">
                    <span class="truncate">{{ column }}</span>
                  </div>
                  <!-- Enhanced resize handle with visual indicator -->
                  <div v-if="index < columns.length - 1"
                       class="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                       @mousedown.stop="startColumnResize($event, column)">
                    <div class="absolute right-0 top-0 w-[1px] h-full bg-transparent group-hover:bg-primary group-hover:w-[2px] transition-all"></div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(row, rowIndex) in paginatedData" 
                  :key="rowIndex"
                  :class="getRowClasses(rowIndex)"
                  @click.stop="handleRowClick($event, rowIndex)"
                  @mousedown.stop="handleMouseDown($event, rowIndex)"
                  @mouseenter.stop="handleMouseEnter(rowIndex)"
                  class="border-b border-neutral hover:bg-base-200 cursor-pointer">
                <td v-for="column in columns" 
                    :key="`${rowIndex}-${column}`" 
                    class="px-4 py-2 border-r border-neutral last:border-r-0 truncate whitespace-nowrap overflow-hidden"
                    :class="{ 'expanded': expandedCells.includes(`${rowIndex}-${column}`) }"
                    :style="{ width: columnWidths[column] || defaultColumnWidth(column), maxWidth: columnWidths[column] || defaultColumnWidth(column) }"
                    @dblclick="toggleExpandCell(rowIndex, column)">
                  {{ formatCellValue(row[column]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <p>No records found in this table.</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Reload</button>
        </div>
      </div>
    </div>

    <div v-if="tableData.length > 0" class="bg-base-200 px-4 py-3 border-t border-neutral flex flex-col sm:flex-row justify-between items-center text-xs sticky bottom-0 left-0 right-0 min-h-[56px] z-20">
      <div class="flex items-center mb-2 sm:mb-0">
        <span class="text-gray-400">
          {{ tableName }} | {{ totalRecords }} records{{ selectedRows.length > 0 ? ` | ${selectedRows.length} selected` : '' }}
          | <span>{{ columns.length }} columns</span>
        </span>
        <div class="ml-4 flex space-x-2">
          <button class="btn btn-ghost btn-xs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>
        </div>
      </div>
      
      <div class="flex items-center space-x-4">
        <div class="join">
          <button 
            class="join-item btn btn-xs" 
            :class="{ 'btn-disabled': currentPage === 1 }"
            @click="goToFirstPage"
            :disabled="currentPage === 1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
          <button 
            class="join-item btn btn-xs" 
            :class="{ 'btn-disabled': currentPage === 1 }"
            @click="prevPage"
            :disabled="currentPage === 1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          <div class="join-item btn btn-xs btn-disabled">
            <span class="text-xs">
              {{ currentPage }} / {{ totalPages }}
            </span>
          </div>
          
          <button 
            class="join-item btn btn-xs" 
            :class="{ 'btn-disabled': currentPage === totalPages }"
            @click="nextPage"
            :disabled="currentPage === totalPages">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button 
            class="join-item btn btn-xs" 
            :class="{ 'btn-disabled': currentPage === totalPages }"
            @click="goToLastPage"
            :disabled="currentPage === totalPages">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        
        <div class="flex items-center space-x-2">
          <span class="text-gray-400 hidden sm:inline-block">Rows per page:</span>
          <select 
            class="select select-xs select-bordered bg-base-300 w-16" 
            v-model="rowsPerPage"
            @change="currentPage = 1">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        
        <div class="hidden md:flex items-center space-x-2">
          <span class="text-gray-400">Go to page:</span>
          <input 
            type="number" 
            min="1" 
            :max="totalPages" 
            v-model="pageInput" 
            @keyup.enter="goToPage"
            class="input input-xs input-bordered bg-base-300 w-14" />
          <button class="btn btn-xs btn-ghost" @click="goToPage">Go</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick, watch } from 'vue';
import { useDatabaseStore } from '@/store/database';

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  onLoad: {
    type: Function,
    required: true
  }
});

const isLoading = ref(true);
const tableData = ref([]);
const filterTerm = ref('');
const loadError = ref(null);
const rowsPerPage = ref(25);
const currentPage = ref(1);
const tableContainer = ref(null);

const columnWidths = ref({});
const resizingColumn = ref(null);
const startX = ref(0);
const startWidth = ref(0);

const columnTypes = ref({});

const selectedRows = ref([]);
const isDragging = ref(false);
const lastSelectedId = ref(null);
const shiftKeyPressed = ref(false);
const ctrlKeyPressed = ref(false);
const selectionStartId = ref(null);

const expandedCells = ref([]);

const pageInput = ref(1);
const totalRecords = computed(() => filteredData.value.length);
const totalPages = computed(() => {
  if (rowsPerPage.value === 0) return 1;
  return Math.ceil(totalRecords.value / rowsPerPage.value);
});

const databaseStore = useDatabaseStore();

const columns = computed(() => {
  if (tableData.value.length === 0) {
    return [];
  }
  return Object.keys(tableData.value[0]);
});

const filteredData = computed(() => {
  if (!filterTerm.value) {
    return tableData.value;
  }
  
  const term = filterTerm.value.toLowerCase();
  return tableData.value.filter(row => {
    return Object.values(row).some(value => {
      if (value === null) return false;
      return String(value).toLowerCase().includes(term);
    });
  });
});

const paginatedData = computed(() => {
  if (rowsPerPage.value === 0) {
    return filteredData.value;
  }
  
  const start = (currentPage.value - 1) * parseInt(rowsPerPage.value);
  return filteredData.value.slice(start, start + parseInt(rowsPerPage.value));
});

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object' && value instanceof Date) {
    return value.toLocaleString();
  }
  
  return String(value);
}

function defaultColumnWidth(column) {
  if (/^id$/i.test(column)) return '80px';
  if (/^(created_at|updated_at|deleted_at)$/i.test(column)) return '150px';
  if (/(email|mail)$/i.test(column)) return '180px';
  if (/(name|title)$/i.test(column)) return '200px';
  if (/(description|content|text)$/i.test(column)) return '200px';
  if (/(status|type|role|category|tag)$/i.test(column)) return '120px';
  if (/(date|time)$/i.test(column)) return '150px';
  if (/(amount|price|cost|total|sum)$/i.test(column)) return '120px';
  if (/(count|number|qty|quantity)$/i.test(column)) return '100px';
  if (/(active|enabled|visible|published|featured)$/i.test(column)) return '100px';
  if (/(image|photo|thumbnail|avatar|icon)$/i.test(column)) return '150px';

  return '150px';
}

function analyzeColumns() {
  if (tableData.value.length === 0 || columns.value.length === 0) return;
  
  columns.value.forEach(column => {
    if (columnWidths.value[column]) return;

    const sampleValue = tableData.value.find(row => row[column] !== null)?.[column];
    if (sampleValue !== undefined) {
      const type = typeof sampleValue;
      columnTypes.value[column] = type;

      if (!columnWidths.value[column]) {
        columnWidths.value[column] = defaultColumnWidth(column);
      }
    }
  });
}

async function loadTableData() {
  isLoading.value = true;
  loadError.value = null;
  selectedRows.value = [];
  expandedCells.value = [];
  
  try {
    // Clear the table cache before loading to ensure fresh data 
    const cacheKey = `${props.connectionId}:${props.tableName}`;
    databaseStore.clearTableCache(cacheKey);
    
    const data = await databaseStore.loadTableData(props.connectionId, props.tableName);
    
    if (!data || data.length === 0) {
      showAlert('No data found in table', 'warning');
    }
    
    tableData.value = data;

    // Analyze columns after data is loaded
    nextTick(() => {
      analyzeColumns();
    });

    // Notify parent about the loaded data
    props.onLoad({
      columns: columns.value,
      rowCount: data.length
    });
  } catch (error) {
    loadError.value = error.message;
    showAlert(`Error loading data: ${error.message}`, 'error');
    tableData.value = [];
  } finally {
    isLoading.value = false;
  }
}

function startColumnResize(event, column) {
  event.preventDefault();
  event.stopPropagation();
  resizingColumn.value = column;
  startX.value = event.clientX;

  if (!columnWidths.value[column] || !columnWidths.value[column].endsWith('px')) {
    const headerCells = document.querySelectorAll('th');
    const columnIndex = columns.value.indexOf(column);
    if (columnIndex >= 0 && headerCells[columnIndex]) {
      columnWidths.value[column] = `${headerCells[columnIndex].offsetWidth}px`;
    } else {
      columnWidths.value[column] = defaultColumnWidth(column);
    }
  }

  startWidth.value = parseInt(columnWidths.value[column]) || 100;

  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', stopColumnResize);
}

function handleColumnResize(event) {
  if (!resizingColumn.value) return;
  
  const column = resizingColumn.value;
  const width = Math.max(60, startWidth.value + (event.clientX - startX.value));
  columnWidths.value[column] = `${width}px`;
}

function stopColumnResize(event) {
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
  resizingColumn.value = null;
}

function getRowClasses(rowIndex) {
  const isSelected = selectedRows.value.includes(rowIndex);
  return {
    'selected-row': isSelected,
    'hover:bg-base-200': !isSelected,
  };
}

function handleRowClick(event, rowIndex) {
  event.stopPropagation();
  
  if (ctrlKeyPressed.value) {
    toggleRowSelection(rowIndex);
  } else if (shiftKeyPressed.value && lastSelectedId.value !== null) {
    selectRange(lastSelectedId.value, rowIndex);
  } else {
    selectedRows.value = [rowIndex];
    lastSelectedId.value = rowIndex;
  }
}

function toggleRowSelection(rowIndex) {
  const index = selectedRows.value.indexOf(rowIndex);
  if (index !== -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(rowIndex);
    lastSelectedId.value = rowIndex;
  }
}

function selectRange(startId, endId) {
  const start = Math.min(startId, endId);
  const end = Math.max(startId, endId);
  
  const rangeIds = [];
  for (let i = start; i <= end; i++) {
    rangeIds.push(i);
  }
  
  if (ctrlKeyPressed.value) {
    selectedRows.value = [...new Set([...selectedRows.value, ...rangeIds])];
  } else {
    selectedRows.value = rangeIds;
  }
  
  lastSelectedId.value = endId;
}

function handleMouseDown(event, rowIndex) {
  event.stopPropagation();
  
  isDragging.value = true;
  selectionStartId.value = rowIndex;
  
  if (!ctrlKeyPressed.value && !shiftKeyPressed.value) {
    selectedRows.value = [rowIndex];
    lastSelectedId.value = rowIndex;
  }
  
  window.addEventListener('mouseup', handleMouseUp, { once: true });
}

function handleMouseEnter(rowIndex) {
  if (isDragging.value && selectionStartId.value !== null) {
    selectRange(selectionStartId.value, rowIndex);
  }
}

function handleMouseUp() {
  isDragging.value = false;
}

function selectAll() {
  selectedRows.value = paginatedData.value.map((_, index) => index);
}

function handleTableKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    selectAll();
  } else if (e.key === 'Escape') {
    selectedRows.value = [];
    lastSelectedId.value = null;
  }
}

function handleOutsideClick(event) {
  if (event.target === tableContainer.value || event.target.closest('thead')) {
    selectedRows.value = [];
    lastSelectedId.value = null;
  }
}

function toggleExpandCell(rowIndex, column) {
  const cellId = `${rowIndex}-${column}`;
  const index = expandedCells.value.indexOf(cellId);
  
  if (index !== -1) {
    expandedCells.value.splice(index, 1);
  } else {
    expandedCells.value.push(cellId);
  }
}

function deleteSelected() {
  if (selectedRows.value.length === 0) return;
  
  // For now, just show an alert since we don't have a real implementation yet
  showAlert(`Would delete ${selectedRows.length} rows`, 'info');
  
  // In the future, implement actual deletion via database connection
  // const idsToDelete = selectedRows.value.map(index => paginatedData.value[index].id);
  // databaseStore.deleteRows(props.connectionId, props.tableName, idsToDelete);
}

const handleKeyDown = (e) => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;
  
  if (e.key === 'Escape') {
    selectedRows.value = [];
    lastSelectedId.value = null;
  }
};

const handleKeyUp = (e) => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;
};

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    scrollToTop();
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    scrollToTop();
  }
}

function goToFirstPage() {
  currentPage.value = 1;
  scrollToTop();
}

function goToLastPage() {
  currentPage.value = totalPages.value;
  scrollToTop();
}

function goToPage() {
  const page = parseInt(pageInput.value);
  if (!isNaN(page) && page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
    scrollToTop();
  } else {
    pageInput.value = currentPage.value;
  }
}

function scrollToTop() {
  if (tableContainer.value) {
    tableContainer.value.scrollTop = 0;
  }
}

watch(() => currentPage.value, (newPage) => {
  pageInput.value = newPage;
});

onMounted(() => {
  loadTableData();
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
});
</script>

<style scoped>
.table tbody tr {
  user-select: none;
}

[tabindex="0"]:focus {
  outline: none;
}

.selected-row {
  background-color: #ea4331 !important;
  color: white !important;
}

.table tr.selected-row:nth-child(odd),
.table tr.selected-row:nth-child(even) {
  background-color: #ea4331 !important;
  color: white !important;
}

.selected-row:hover {
  background-color: #ea4331 !important;
}

.expanded {
  white-space: normal !important;
  overflow: visible !important;
  position: relative;
  z-index: 10;
  background-color: theme('colors.base-200');
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  min-width: 200px !important;
  max-width: 400px !important;
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
  width: max-content;
  min-width: 100%;
}

.overflow-x-auto {
  overflow-x: auto;
  width: 100%;
  max-width: 100%;
}

.pb-3 {
  padding-bottom: 3rem;
}
</style> 