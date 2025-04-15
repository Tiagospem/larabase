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
          class="btn btn-sm btn-ghost text-error"
          :disabled="totalRecords === 0"
          @click="confirmTruncateTable">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>Truncate</span>
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
        <div class="relative flex items-center space-x-2">
          <div class="input-group">
            <input 
              type="text" 
              placeholder="Filter..." 
              class="input input-sm input-bordered bg-base-300 w-64" 
              v-model="filterTerm"
              @keyup.enter="applyFilter" />
            <button 
              class="btn btn-sm" 
              :class="{ 'bg-base-300 border-base-300': !activeFilter && !filterTerm, 'bg-error border-error text-white': activeFilter || filterTerm }"
              @click="toggleAdvancedFilter">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
            </button>
          </div>
          <button v-if="filterTerm || activeFilter" class="btn btn-sm btn-error" @click="clearFilters">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
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
      
      <div v-else-if="(filterTerm || activeFilter) && filteredData.length === 0" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          <p>No records match your filter</p>
          <div class="flex justify-center space-x-2 mt-4">
            <button class="btn btn-sm btn-error" @click="clearFilters">Clear Filters</button>
            <button class="btn btn-sm btn-primary" @click="loadTableData">Reload Data</button>
          </div>
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
                    :class="{ 'bg-base-300': !expandedColumns.includes(column), 'bg-base-200': expandedColumns.includes(column) }"
                    :style="{ width: columnWidths[column] || defaultColumnWidth(column), maxWidth: expandedColumns.includes(column) ? 'none' : (columnWidths[column] || defaultColumnWidth(column)) }">
                  <div class="flex items-center justify-between">
                    <span class="truncate">{{ column }}</span>
                    <span v-if="expandedColumns.includes(column)" class="text-primary text-xs ml-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 inline-block">
                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <!-- Enhanced resize handle with visual indicator -->
                  <div v-if="index < columns.length - 1"
                       class="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                       @mousedown.stop="startColumnResize($event, column)"
                       @dblclick.stop="toggleColumnExpansion(column)" 
                       title="Double-click to expand/collapse column">
                    <div class="absolute right-0 top-0 w-[1px] h-full"
                         :class="expandedColumns.includes(column) ? 'expanded-resize-handle' : 'bg-transparent group-hover:bg-primary group-hover:w-[2px] transition-all'"></div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody @dblclick.stop.prevent>
              <tr v-for="(row, rowIndex) in paginatedData" 
                  :key="rowIndex"
                  :class="getRowClasses(rowIndex)"
                  @click.stop="handleRowClick($event, rowIndex)"
                  @dblclick.stop="handleRowDoubleClick(row)"
                  @mousedown.stop="handleMouseDown($event, rowIndex)"
                  @mouseenter.stop="handleMouseEnter(rowIndex)"
                  class="border-b border-neutral hover:bg-base-200 cursor-pointer">
                <td v-for="column in columns" 
                    :key="`${rowIndex}-${column}`" 
                    class="px-4 py-2 border-r border-neutral last:border-r-0 truncate whitespace-nowrap overflow-hidden"
                    :class="{ 'expanded': expandedColumns.includes(column) }"
                    :style="{ width: columnWidths[column] || defaultColumnWidth(column), maxWidth: expandedColumns.includes(column) ? 'none' : (columnWidths[column] || defaultColumnWidth(column)) }"
                    @dblclick.stop="openEditModal(row)">
                  <div class="flex items-center justify-between w-full">
                    <!-- Conteúdo da célula -->
                    <span :class="{'text-gray-500 italic': row[column] === null && isForeignKeyColumn(column)}">
                      {{ row[column] === null && isForeignKeyColumn(column) ? 'Não relacionado' : formatCellValue(row[column]) }}
                    </span>
                    
                    <!-- Ícone de chave estrangeira, quando aplicável (agora no final da célula) -->
                    <button 
                      v-if="isForeignKeyColumn(column) && row[column] !== null" 
                      class="ml-1 text-white hover:text-primary-focus transition-colors cursor-pointer flex-shrink-0"
                      @click.stop="navigateToForeignKey(column, row[column])"
                      title="Navegar para registro relacionado">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </button>
                    
                    <!-- Ícone para chaves estrangeiras nulas (agora no final da célula) -->
                    <span 
                      v-else-if="isForeignKeyColumn(column) && row[column] === null" 
                      class="ml-1 text-gray-500 flex-shrink-0"
                      title="Relação nula">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </span>
                  </div>
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
          <p>Records not found</p>
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

    <div class="modal" :class="{ 'modal-open': showEditModal }">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
          Edit Record
          <button class="btn btn-sm btn-circle" @click="closeEditModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </h3>
        
        <div v-if="editingRecord" class="overflow-y-auto max-h-[60vh]">
          <div v-for="column in getEditableColumns()" :key="column" class="form-control mb-4">
            <label class="label">
              <span class="label-text font-medium">{{ column }}</span>
              <span class="label-text-alt text-xs bg-base-300 px-2 py-1 rounded-md">
                {{ getFieldTypeLabel(column) }}
              </span>
            </label>
            
            <!-- Different input types based on column type -->
            <textarea 
              v-if="isLongTextField(column)" 
              v-model="editingRecord[column]" 
              class="textarea textarea-bordered h-24"
              :placeholder="column"></textarea>
              
            <input 
              v-else-if="isDateField(column)" 
              type="datetime-local" 
              v-model="editingRecord[column]" 
              class="input input-bordered w-full"
              :max="'9999-12-31T23:59'" />
              
            <input 
              v-else-if="isNumberField(column)" 
              type="number" 
              v-model.number="editingRecord[column]" 
              class="input input-bordered w-full" 
              step="any" />
              
            <select 
              v-else-if="isBooleanField(column)" 
              v-model="editingRecord[column]" 
              class="select select-bordered w-full">
              <option :value="true">True</option>
              <option :value="false">False</option>
              <option v-if="editingRecord[column] === null" :value="null">NULL</option>
            </select>
              
            <input 
              v-else 
              type="text" 
              v-model="editingRecord[column]" 
              class="input input-bordered w-full" />
          </div>
        </div>
        
        <div class="modal-action">
          <button class="btn btn-error" @click="closeEditModal">Cancel</button>
          <button class="btn btn-primary" @click="saveRecord">Save Changes</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeEditModal"></div>
    </div>

    <div class="modal" :class="{ 'modal-open': showFilterModal }">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
          Advanced Filter
          <button class="btn btn-sm btn-circle" @click="showFilterModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </h3>
        
        <div class="mb-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">SQL WHERE Clause</span>
            </label>
            <textarea 
              v-model="advancedFilterTerm" 
              class="textarea textarea-bordered h-32 font-mono"
              placeholder="id = 1"></textarea>
            <label class="label">
              <span class="label-text-alt text-xs">
                Examples: 
                <code class="bg-base-300 p-1 cursor-pointer" @click="setExampleFilter('id = 2')">id = 2</code>, 
                <code class="bg-base-300 p-1 cursor-pointer" @click="setExampleFilter('email LIKE \'%example%\'')">email LIKE '%example%'</code>,
                <code class="bg-base-300 p-1 cursor-pointer" @click="setExampleFilter('created_at IS NOT NULL')">created_at IS NOT NULL</code>,
                <code class="bg-base-300 p-1 cursor-pointer" @click="setExampleFilter('id > 10 AND id < 20')">id > 10 AND id < 20</code>
              </span>
            </label>
          </div>
          
          <div class="mt-2 text-xs">
            <p class="mb-2">Available columns:</p>
            <div class="flex flex-wrap gap-1 mb-4">
              <span 
                v-for="column in columns" 
                :key="column" 
                class="badge badge-primary cursor-pointer"
                @click="insertColumnName(column)">
                {{ column }}
              </span>
            </div>
            
            <p class="mb-2">Common operators:</p>
            <div class="flex flex-wrap gap-1">
              <span 
                v-for="op in ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN', 'AND', 'OR']" 
                :key="op" 
                class="badge badge-secondary cursor-pointer"
                @click="insertOperator(op)">
                {{ op }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start">
            <input type="checkbox" class="checkbox checkbox-primary" v-model="persistFilter" />
            <span class="label-text ml-2">Persist filter (remember after reload)</span>
          </label>
        </div>
        
        <div class="modal-action">
          <button class="btn btn-error" @click="cancelAdvancedFilter">Cancel</button>
          <button class="btn btn-primary" @click="applyAdvancedFilter">Apply Filter</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showFilterModal = false"></div>
    </div>
    
    <!-- Confirm truncate modal -->
    <div class="modal" :class="{ 'modal-open': showTruncateConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error">⚠️ Truncate Table</h3>
        <p class="py-4">Are you sure you want to truncate the <strong>{{ tableName }}</strong> table? This will delete ALL records and cannot be undone.</p>
        <div class="modal-action">
          <button class="btn" @click="showTruncateConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="truncateTable">Truncate Table</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showTruncateConfirm = false"></div>
    </div>
    
    <!-- Confirm delete modal -->
    <div class="modal" :class="{ 'modal-open': showDeleteConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error">Delete Records</h3>
        <p class="py-4">Are you sure you want to delete {{ selectedRows.length }} record(s)? This action cannot be undone.</p>
        <div class="modal-action">
          <button class="btn" @click="showDeleteConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showDeleteConfirm = false"></div>
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
  },
  initialFilter: {
    type: String,
    default: ''
  },
  onOpenTab: {
    type: Function,
    required: false,
    default: () => {}
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

const expandedColumns = ref([]);

const pageInput = ref(1);
const totalRecordsCount = ref(0);
const totalPages = computed(() => {
  if (rowsPerPage.value === 0) return 1;
  return Math.ceil(totalRecords.value / rowsPerPage.value);
});

const showEditModal = ref(false);
const editingRecord = ref(null);
const originalRecord = ref(null);

const showFilterModal = ref(false);
const advancedFilterTerm = ref('');
const persistFilter = ref(true);
const activeFilter = ref('');
const originalFilterTerm = ref('');

const showDeleteConfirm = ref(false);
const showTruncateConfirm = ref(false);
const deletingIds = ref([]);

const databaseStore = useDatabaseStore();

const columns = computed(() => {
  if (tableData.value.length === 0) {
    return [];
  }
  return Object.keys(tableData.value[0]);
});

const filteredData = computed(() => {
  let data = tableData.value;
  
  // First apply the advanced SQL filter if present
  if (activeFilter.value) {
    try {
      data = applySqlFilter(data, activeFilter.value);
    } catch (error) {
      console.error('Error applying SQL filter:', error);
    }
  }
  
  // Then apply the simple text filter if present
  if (filterTerm.value) {
    const term = filterTerm.value.toLowerCase();
    data = data.filter(row => {
      return Object.values(row).some(value => {
        if (value === null) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }
  
  return data;
});

const paginatedData = computed(() => {
  // Se houver filtro, precisamos paginar os dados filtrados localmente
  if (filterTerm.value || activeFilter.value) {
    // Aplicar paginação local nos dados filtrados
    if (rowsPerPage.value === 0) {
      return filteredData.value;
    }
    
    const start = (currentPage.value - 1) * parseInt(rowsPerPage.value);
    const end = start + parseInt(rowsPerPage.value);
    
    console.log(`Paginação local: página ${currentPage.value}, início ${start}, fim ${end}, total ${filteredData.value.length}`);
    
    return filteredData.value.slice(start, end);
  } else {
    // Sem filtro, já temos os dados paginados do servidor
    console.log(`Usando dados paginados do servidor: ${tableData.value.length} registros na página ${currentPage.value}`);
    return tableData.value;
  }
});

const totalRecords = computed(() => {
  if (filterTerm.value || activeFilter.value) {
    return filteredData.value.length;
  }
  return totalRecordsCount.value;
});

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object' && value instanceof Date) {
    return value.toLocaleString();
  }
  
  // Se for uma string no formato de data ISO
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch (e) {
      // Se falhar, retorna o valor original
    }
  }
  
  // Se for uma string no formato de data MySQL (YYYY-MM-DD HH:MM:SS)
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
    try {
      const date = new Date(value.replace(' ', 'T') + 'Z');
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch (e) {
      // Se falhar, retorna o valor original
    }
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
  expandedColumns.value = [];
  
  try {
    // Clear the table cache before loading to ensure fresh data 
    const cacheKey = `${props.connectionId}:${props.tableName}`;
    databaseStore.clearTableCache(cacheKey);
    
    // Carregar apenas a página atual de dados com paginação
    const result = await databaseStore.loadTableData(
      props.connectionId, 
      props.tableName, 
      rowsPerPage.value, 
      currentPage.value
    );
    
    if (!result.data || result.data.length === 0) {
      showAlert('No data found for this page', 'warning');
    }
    
    // Atualizar os dados da tabela
    tableData.value = result.data || [];
    
    // Atualizar a contagem total de registros para paginação
    totalRecordsCount.value = result.totalRecords || 0;

    // Analyze columns after data is loaded
    nextTick(() => {
      analyzeColumns();
    });

    // Load foreign key information
    await loadForeignKeyInfo();

    // Notify parent about the loaded data
    props.onLoad({
      columns: columns.value,
      rowCount: result.totalRecords || 0
    });
  } catch (error) {
    loadError.value = error.message;
    showAlert(`Error loading data: ${error.message}`, 'error');
    tableData.value = [];
    totalRecordsCount.value = 0;
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
  // Sempre pare a propagação do evento para evitar bugs
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Não processar o clique se estiver arrastando (isso é tratado pelo mouseup)
  if (isDragging.value) {
    return;
  }
  
  // Se foi um duplo clique, não alteramos a seleção
  if (event && event.detail === 2) {
    return;
  }
  
  // Comportamento com Ctrl pressionado: alternar seleção
  if (ctrlKeyPressed.value) {
    const index = selectedRows.value.indexOf(rowIndex);
    if (index !== -1) {
      // Se já está selecionada, remove
      selectedRows.value.splice(index, 1);
    } else {
      // Se não está selecionada, adiciona
      selectedRows.value.push(rowIndex);
    }
    
    // Atualiza o lastSelectedId
    lastSelectedId.value = rowIndex;
    return;
  }
  
  // Comportamento com Shift pressionado: selecionar intervalo
  if (shiftKeyPressed.value && lastSelectedId.value !== null) {
    const start = Math.min(lastSelectedId.value, rowIndex);
    const end = Math.max(lastSelectedId.value, rowIndex);
    
    const rangeIds = [];
    for (let i = start; i <= end; i++) {
      rangeIds.push(i);
    }
    
    selectedRows.value = rangeIds;
    return;
  }
  
  // Comportamento padrão: clicar em linha já selecionada a desseleciona,
  // caso contrário seleciona apenas esta linha
  if (selectedRows.value.length === 1 && selectedRows.value[0] === rowIndex) {
    // Se está clicando na única linha selecionada, desseleciona
    selectedRows.value = [];
    lastSelectedId.value = null;
  } else {
    // Senão, seleciona apenas esta linha
    selectedRows.value = [rowIndex];
    lastSelectedId.value = rowIndex;
  }
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

function toggleColumnExpansion(column) {
  const index = expandedColumns.value.indexOf(column);
  
  if (index !== -1) {
    expandedColumns.value.splice(index, 1);
    showAlert(`Column "${column}" collapsed`, 'info');
  } else {
    expandedColumns.value.push(column);
    showAlert(`Column "${column}" expanded - double-click resize handle to collapse`, 'info');
  }
}

function deleteSelected() {
  if (selectedRows.length === 0) return;
  
  // Get the IDs of the selected rows - send only the IDs as primitives
  deletingIds.value = selectedRows.value.map(index => {
    // Ensure we're only sending the numeric or string ID
    const id = paginatedData.value[index].id;
    // Convert to primitive if needed
    return typeof id === 'object' ? String(id) : id;
  });
  
  // Show confirmation dialog
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  showDeleteConfirm.value = false;
  
  try {
    // Make sure we're only sending an array of primitive IDs
    const idsToDelete = [...deletingIds.value];
    
    console.log("Deleting IDs:", idsToDelete);
    
    const result = await databaseStore.deleteRecords(
      props.connectionId, 
      props.tableName, 
      idsToDelete
    );
    
    showAlert(result.message, 'success');
    
    // Clear selection and reload data
    selectedRows.value = [];
    await loadTableData();
  } catch (error) {
    console.error("Error in confirmDelete:", error);
    if (error.message.includes('referenced by other tables')) {
      showAlert('Cannot delete records because they are referenced by other tables. Remove the related records first or use CASCADE constraints.', 'error');
    } else {
      showAlert(`Error deleting records: ${error.message}`, 'error');
    }
  }
}

function confirmTruncateTable() {
  showTruncateConfirm.value = true;
}

async function truncateTable() {
  showTruncateConfirm.value = false;
  
  try {
    const result = await databaseStore.truncateTable(
      props.connectionId, 
      props.tableName
    );
    
    showAlert(result.message, 'success');
    
    // Clear selection and reload data
    selectedRows.value = [];
    await loadTableData();
  } catch (error) {
    showAlert(`Error truncating table: ${error.message}`, 'error');
  }
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
  if (currentPage.value !== 1) {
    currentPage.value = 1;
    scrollToTop();
  }
}

function goToLastPage() {
  if (currentPage.value !== totalPages.value) {
    currentPage.value = totalPages.value;
    scrollToTop();
  }
}

function goToPage() {
  const page = parseInt(pageInput.value);
  if (!isNaN(page) && page >= 1 && page <= totalPages.value && page !== currentPage.value) {
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

watch(() => currentPage.value, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    // Atualizar o pageInput
    pageInput.value = newPage;
    
    // Recarregar dados do servidor apenas se não houver filtro ativo
    if (!filterTerm.value && !activeFilter.value) {
      loadTableData();
    }
  }
});

function openEditModal(row) {
  // Create a deep copy of the row to edit
  originalRecord.value = { ...row };
  
  // Processar datas para o formato compatível com inputs datetime-local
  const processedRecord = JSON.parse(JSON.stringify(row));
  
  // Converter campos de data para o formato correto
  for (const key in processedRecord) {
    if (isDateField(key) && processedRecord[key]) {
      // Se for uma string no formato de data
      if (typeof processedRecord[key] === 'string') {
        try {
          // Para formato MySQL (YYYY-MM-DD HH:MM:SS)
          if (processedRecord[key].includes(' ')) {
            processedRecord[key] = processedRecord[key].replace(' ', 'T');
          }
          
          // Garantir que a data seja válida e formatada corretamente
          const date = new Date(processedRecord[key]);
          if (!isNaN(date.getTime())) {
            // Formato para input datetime-local (YYYY-MM-DDTHH:MM)
            processedRecord[key] = date.toISOString().slice(0, 16);
          }
        } catch (e) {
          console.warn(`Failed to process date for ${key}:`, e);
        }
      }
    }
  }
  
  editingRecord.value = processedRecord;
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingRecord.value = null;
  originalRecord.value = null;
}

async function saveRecord() {
  if (!editingRecord.value) {
    showAlert('No record to save', 'error');
    return;
  }
  
  try {
    // Criar uma cópia do registro para evitar problemas de serialização
    const recordToSave = {};
    
    // Processar cada campo, formatando datas corretamente
    for (const key in editingRecord.value) {
      let value = editingRecord.value[key];
      
      // Se for um campo de data e não for null
      if (value && isDateField(key)) {
        // Se for um string de data ISO
        if (typeof value === 'string' && value.includes('T')) {
          // Converter para formato yyyy-MM-ddThh:mm:ss
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            // Formato correto para input datetime-local
            value = date.toISOString().slice(0, 19).replace('Z', '');
          }
        }
      }
      
      // Armazenar o valor processado
      recordToSave[key] = value;
    }
    
    console.log('Saving record:', recordToSave);
    
    if (!recordToSave.id) {
      showAlert('Record must have an ID field to update', 'error');
      return;
    }
    
    // Para melhor comparação, compara baseado na chave primária (id)
    // ou como fallback, na estrutura completa do registro
    const index = tableData.value.findIndex(row => {
      if (row.id && originalRecord.value.id) {
        return row.id === originalRecord.value.id;
      }
      return JSON.stringify(row) === JSON.stringify(originalRecord.value);
    });
    
    if (index === -1) {
      showAlert('Could not find record to update', 'error');
      return;
    }
    
    // Atualiza o registro no banco de dados
    const result = await databaseStore.updateRecord(
      props.connectionId, 
      props.tableName, 
      recordToSave
    );
    
    if (result) {
      // Atualiza o registro nos dados locais
      tableData.value[index] = { ...recordToSave };
      showAlert('Record updated successfully', 'success');
      closeEditModal();
    } else {
      showAlert('Failed to update record. Unknown error.', 'error');
    }
  } catch (error) {
    console.error('Error saving record:', error);
    showAlert(`Error updating record: ${error.message}`, 'error');
  }
}

function getEditableColumns() {
  if (!editingRecord.value) return [];
  return Object.keys(editingRecord.value).filter(column => {
    // Skip columns that shouldn't be edited directly
    return !['id', 'created_at', 'updated_at'].includes(column);
  });
}

function isLongTextField(column) {
  return /(description|content|text|body|comment|note|message|summary|details|html|json|xml)$/i.test(column) ||
         (editingRecord.value && 
          typeof editingRecord.value[column] === 'string' && 
          editingRecord.value[column]?.length > 100);
}

function isDateField(column) {
  return /(date|time|at$|created_at|updated_at|deleted_at)/i.test(column);
}

function isNumberField(column) {
  if (!editingRecord.value) return false;
  const value = editingRecord.value[column];
  return typeof value === 'number' || 
         (column.includes('id') && column !== 'uuid') || 
         /(amount|price|cost|total|sum|count|number|qty|quantity|height|width|depth|size|order|position)/i.test(column);
}

function isBooleanField(column) {
  if (!editingRecord.value) return false;
  const value = editingRecord.value[column];
  return typeof value === 'boolean' || 
         /(active|enabled|visible|published|featured|is_|has_)/i.test(column);
}

function getFieldTypeLabel(column) {
  if (!editingRecord.value) return 'Unknown';
  
  const value = editingRecord.value[column];
  
  if (isLongTextField(column)) return 'Text';
  if (isDateField(column)) return 'Date';
  if (isNumberField(column)) return 'Number';
  if (isBooleanField(column)) return 'Boolean';
  
  if (value === null) return 'NULL';
  
  return typeof value === 'object' ? 'Object' : 
         typeof value === 'string' ? 'String' : 
         typeof value === 'number' ? 'Number' : 
         typeof value === 'boolean' ? 'Boolean' : 
         typeof value;
}

function handleRowDoubleClick(row) {
  // Prevent any selection on double click
  // Find the row index
  const rowIndex = paginatedData.value.findIndex(r => r === row);
  
  // If the row is in the selected rows, leave it
  // If not, clear selection
  if (!selectedRows.value.includes(rowIndex)) {
    selectedRows.value = [];
  }
  
  // Open the edit modal
  openEditModal(row);
}

function handleMouseDown(event, rowIndex) {
  // Para clicar com Ctrl/Shift, deixar o onClick cuidar disso
  if (ctrlKeyPressed.value || shiftKeyPressed.value) {
    return;
  }
  
  // Para clicar normal, iniciar o arrastar
  isDragging.value = true;
  selectionStartId.value = rowIndex;
  
  // Selecionar a linha atual (agora será feito pelo handleRowClick)
  // selectedRows.value = [rowIndex];
  // lastSelectedId.value = rowIndex;
  
  window.addEventListener('mouseup', handleMouseUp, { once: true });
}

function handleMouseEnter(rowIndex) {
  // Se não estamos arrastando ou não temos ponto de início, não fazer nada
  if (!isDragging.value || selectionStartId.value === null) {
    return;
  }
  
  // Selecionar intervalo entre o ponto inicial e atual
  const start = Math.min(selectionStartId.value, rowIndex);
  const end = Math.max(selectionStartId.value, rowIndex);
  
  const rangeIds = [];
  for (let i = start; i <= end; i++) {
    rangeIds.push(i);
  }
  
  selectedRows.value = rangeIds;
}

function handleMouseUp(event) {
  // Se não estava arrastando, é um clique simples - deixe o handleRowClick tratar
  if (!isDragging.value || !selectionStartId.value) {
    isDragging.value = false;
    selectionStartId.value = null;
    return;
  }
  
  // Se foi um arrasto real (não apenas um clique), mantenha a seleção
  // mas marque o último item selecionado
  if (selectedRows.value.length > 0) {
    lastSelectedId.value = selectedRows.value[selectedRows.value.length - 1];
  }
  
  isDragging.value = false;
  selectionStartId.value = null;
}

onMounted(() => {
  // Verificar se temos filtro inicial e definir antes de carregar os dados
  if (props.initialFilter) {
    console.log("Configurando filtro inicial:", props.initialFilter);
    advancedFilterTerm.value = props.initialFilter;
    activeFilter.value = props.initialFilter;
  }
  
  // Carregar os dados da tabela
  loadTableData();
  
  // Verificar filtros na URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get('filter');
  
  if (urlFilter) {
    try {
      const decodedFilter = decodeURIComponent(urlFilter);
      advancedFilterTerm.value = decodedFilter;
      activeFilter.value = decodedFilter;
    } catch (e) {
      console.error('Erro ao processar filtro da URL:', e);
    }
  } else if (!props.initialFilter) {
    // Se não tem filtro inicial ou da URL, verificar armazenamento local
    const savedFilter = localStorage.getItem(`filter:${props.connectionId}:${props.tableName}`);
    if (savedFilter) {
      try {
        const parsedFilter = JSON.parse(savedFilter);
        if (parsedFilter.active && parsedFilter.value) {
          advancedFilterTerm.value = parsedFilter.value;
          activeFilter.value = parsedFilter.value;
        }
      } catch (e) {
        console.error('Erro ao processar filtro salvo:', e);
      }
    }
  }
  
  // Adicionar event listeners
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

function toggleAdvancedFilter() {
  originalFilterTerm.value = advancedFilterTerm.value;
  showFilterModal.value = true;
}

function applyFilter() {
  // Reiniciar para a página 1 ao aplicar um filtro
  currentPage.value = 1;
  // A propriedade computada filteredData já aplica o filtro automaticamente
}

// Melhorar a função applyAdvancedFilter para aplicar filtros no servidor
async function applyAdvancedFilter() {
  // Atualizar o filtro ativo
  activeFilter.value = advancedFilterTerm.value;
  
  // Se a persistência estiver ativada, salvar o filtro
  if (persistFilter.value && activeFilter.value) {
    localStorage.setItem(`filter:${props.connectionId}:${props.tableName}`, JSON.stringify({
      active: true,
      value: activeFilter.value
    }));
  }
  
  showFilterModal.value = false;
  
  // Voltar para a primeira página ao aplicar um novo filtro
  currentPage.value = 1;
  
  // Para filtros de ID e filtros SQL que precisam ser processados no servidor
  const useServerFilter = shouldUseServerFilter(activeFilter.value);
  
  if (useServerFilter) {
    console.log("Aplicando filtro diretamente no servidor");
    try {
      await loadFilteredData();
    } catch (error) {
      console.error("Erro ao carregar dados filtrados:", error);
      showAlert(`Erro ao aplicar filtro: ${error.message}`, 'error');
    }
  } else {
    console.log("Aplicando filtro localmente");
    // O filtro será aplicado automaticamente pelo computed filteredData
  }
}

function cancelAdvancedFilter() {
  advancedFilterTerm.value = originalFilterTerm.value;
  showFilterModal.value = false;
}

function clearFilters() {
  const hadActiveFilter = activeFilter.value || filterTerm.value;
  
  filterTerm.value = '';
  advancedFilterTerm.value = '';
  activeFilter.value = '';
  
  // Limpar filtro salvo
  localStorage.removeItem(`filter:${props.connectionId}:${props.tableName}`);
  
  // Remover filtro da URL
  const url = new URL(window.location.href);
  url.searchParams.delete('filter');
  window.history.replaceState({}, '', url.toString());
  
  // Se tínhamos um filtro ativo, recarregar dados sem filtro
  if (hadActiveFilter) {
    currentPage.value = 1; // Voltar para a primeira página
    loadTableData();
  }
}

function insertColumnName(column) {
  advancedFilterTerm.value += column + ' ';
}

function insertOperator(op) {
  advancedFilterTerm.value += ' ' + op + ' ';
}

function applySqlFilter(data, filter) {
  if (!filter || !data || data.length === 0) return data;
  
  // Limpar o filtro
  const cleanFilter = filter.trim();
  if (!cleanFilter) return data;
  
  console.log(`Aplicando filtro: "${cleanFilter}" em ${data.length} linhas`);
  
  try {
    // Convert the filter to a JavaScript function
    const filterCode = convertFilterToJs(cleanFilter);
    console.log('Filtro convertido para JS:', filterCode);
    
    // Criar uma cópia profunda dos dados para não modificar os originais
    const dataCopy = JSON.parse(JSON.stringify(data));
    
    // Create a function from the generated code with tratamento de erros
    let filterFn;
    try {
      filterFn = new Function('row', `
        try {
          return ${filterCode};
        } catch (e) {
          console.error('Erro de execução do filtro:', e);
          return false;
        }
      `);
    } catch (e) {
      console.error("Erro ao criar função de filtro:", e);
      // Retornar dados originais em caso de erro
      return data;
    }
    
    // Apply the filter function to each row
    const filteredResults = dataCopy.filter(row => {
      try {
        const result = filterFn(row);
        return result;
      } catch (e) {
        console.error('Erro aplicando filtro à linha:', e, row);
        return false;
      }
    });
    
    console.log(`Filtro resultou em ${filteredResults.length} de ${data.length} linhas`);
    return filteredResults;
  } catch (error) {
    console.error('Erro analisando filtro SQL:', error, filter);
    return data;
  }
}

// Corrigir a função convertFilterToJs para lidar corretamente com filtros de ID
function convertFilterToJs(filter) {
  if (!filter) return 'true';
  
  try {
    // Caso especial para ID (já que é uma operação muito comum)
    const idEqualityRegex = /^\s*id\s*=\s*(\d+)\s*$/i;
    const idMatch = filter.match(idEqualityRegex);
    
    if (idMatch) {
      const idValue = parseInt(idMatch[1], 10);
      if (!isNaN(idValue)) {
        // Usar operador de igualdade não-estrita para comparar número com string
        return `row['id'] == ${idValue} || String(row['id']) == '${idValue}'`;
      }
    }
    
    // Filtro LIKE
    const likeMatcher = /^\s*(\w+)\s+LIKE\s+['"](.*)['"]$/i;
    const likeMatch = filter.match(likeMatcher);
    
    if (likeMatch) {
      const [_, column, pattern] = likeMatch;
      // Remover caracteres % para usar com includes
      const cleanPattern = pattern.replace(/%/g, '');
      return `row['${column}'] != null && String(row['${column}'] || '').toLowerCase().includes('${cleanPattern.toLowerCase()}')`;
    }
    
    // Filtro de igualdade simples
    const simpleEqualityRegex = /^\s*(\w+)\s*=\s*(\d+|\w+|'[^']*'|"[^"]*")\s*$/i;
    const simpleMatch = filter.match(simpleEqualityRegex);
    
    if (simpleMatch) {
      const [_, column, value] = simpleMatch;
      
      // Verificar se o valor é uma string ou número
      if (value.startsWith("'") || value.startsWith('"')) {
        // É uma string literal
        const strValue = value.substring(1, value.length - 1);
        return `row['${column}'] === '${strValue}'`;
      } else if (!isNaN(Number(value))) {
        // É um número - criar uma condição que funcione com números e strings numéricas
        const numValue = Number(value);
        return `row['${column}'] == ${numValue} || String(row['${column}']) == '${numValue}'`;
      } else {
        // É um identificador
        return `row['${column}'] === row['${value}']`;
      }
    }
    
    // Para filtros mais complexos
    if (filter.toLowerCase().match(/^where\s+/)) {
      // Remove a palavra WHERE do início, se existir
      filter = filter.replace(/^where\s+/i, '');
    }
    
    console.log("Processando filtro complexo:", filter);
    
    // Proteger as strings antes do processamento
    const stringLiterals = [];
    let stringReplacedFilter = filter.replace(/'([^']*)'/g, (match, content) => {
      const placeholder = `__STRING_${stringLiterals.length}__`;
      stringLiterals.push(match);
      return placeholder;
    });
    
    // Tratar o LIKE
    stringReplacedFilter = stringReplacedFilter.replace(/(\w+)\s+LIKE\s+(__STRING_\d+__)/gi, (match, column, placeholder) => {
      const placeholderIndex = parseInt(placeholder.match(/__STRING_(\d+)__/)[1]);
      const originalStr = stringLiterals[placeholderIndex].substring(1, stringLiterals[placeholderIndex].length - 1);
      const cleanPattern = originalStr.replace(/%/g, '');
      
      return `(row['${column}'] != null && String(row['${column}'] || '').toLowerCase().includes('${cleanPattern.toLowerCase()}'))`;
    });
    
    // Tratar operadores de comparação
    stringReplacedFilter = stringReplacedFilter
      .replace(/([<>!=]+)/g, ' $1 ')
      .replace(/\s+/g, ' ');
    
    // Tratar o operador IN
    const inRegex = /(\w+|\[\w+\])\s+IN\s*\(\s*([^)]+)\s*\)/gi;
    stringReplacedFilter = stringReplacedFilter.replace(inRegex, (match, col, values) => {
      return `[${values}].includes(row['${col}'])`;
    });
    
    // Substituir operadores SQL para JS
    stringReplacedFilter = stringReplacedFilter
      .replace(/\bAND\b/gi, ' && ')
      .replace(/\bOR\b/gi, ' || ')
      .replace(/\bNOT\b/gi, '!')
      .replace(/\bIS NULL\b/gi, '=== null')
      .replace(/\bIS NOT NULL\b/gi, '!== null')
      .replace(/\s+=\s+/g, ' == '); // Usar == em vez de === para permitir comparação de tipos similares
    
    // Substituir nomes de colunas por acesso ao objeto row
    const keywords = [
      'AND', 'OR', 'NOT', 'NULL', 'IN', 'LIKE', 'BETWEEN', 'IS', 'AS', 
      'TRUE', 'FALSE', 'true', 'false', 'null', 'undefined',
      'return', 'if', 'else', 'for', 'while', 'function'
    ];
    
    stringReplacedFilter = stringReplacedFilter.replace(/\b([a-zA-Z_]\w*)\b(?!\s*\()/g, (match, column) => {
      // Não substituir os placeholders de string
      if (match.startsWith('__STRING_')) {
        return match;
      }
      
      if (keywords.includes(match) || keywords.includes(match.toUpperCase())) {
        return match.toUpperCase();
      }
      
      // Não substituir números
      if (!isNaN(Number(match))) {
        return match;
      }
      
      return `row['${column}']`;
    });
    
    // Restaurar strings literais
    stringLiterals.forEach((str, index) => {
      const placeholder = `__STRING_${index}__`;
      const cleanStr = str.substring(1, str.length - 1)
                         .replace(/'/g, "\\'"); // Escape aspas simples para JS
      
      stringReplacedFilter = stringReplacedFilter.replace(placeholder, `'${cleanStr}'`);
    });
    
    // Limpar espaços extras
    stringReplacedFilter = stringReplacedFilter.trim();
    
    console.log("Filtro convertido final:", stringReplacedFilter);
    
    return stringReplacedFilter;
  } catch (e) {
    console.error('Erro ao converter filtro SQL para JS:', e, 'Filtro original:', filter);
    return 'true'; // Fallback para não filtrar nada
  }
}

// Melhorar a função para determinar quando usar filtro no servidor
function shouldUseServerFilter(filter) {
  if (!filter) return false;
  
  // Limpar o filtro
  const cleanFilter = filter.trim();
  if (!cleanFilter) return false;

  console.log("Verificando se deve usar filtro do servidor para:", cleanFilter);
  
  // 1. Filtro de ID - SEMPRE usar o servidor para buscas diretas por ID
  const idMatch = cleanFilter.match(/^\s*id\s*=\s*(\d+)\s*$/i);
  if (idMatch) {
    const idValue = parseInt(idMatch[1], 10);
    if (!isNaN(idValue)) {
      console.log(`Detectado filtro de ID: ${idValue} - Usando o servidor`);
      return true;
    }
  }
  
  // 2. Filtro com operador LIKE (pode envolver muitos registros)
  if (/\bLIKE\b/i.test(cleanFilter)) {
    console.log("Detectado filtro LIKE - Usando o servidor");
    return true;
  }
  
  // 3. Filtros complexos com múltiplas condições
  if (/\bAND\b|\bOR\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b/i.test(cleanFilter)) {
    console.log("Detectado filtro complexo com operadores lógicos - Usando o servidor");
    return true;
  }
  
  // 4. Filtros de igualdade simples para qualquer coluna chave primária ou estrangeira
  if (/^\s*\w+_id\s*=\s*\d+\s*$/i.test(cleanFilter)) {
    console.log("Detectado filtro de chave estrangeira - Usando o servidor");
    return true;
  }
  
  console.log("Usando filtro local para:", cleanFilter);
  return false;
}

// Função para carregar dados filtrados diretamente do servidor
async function loadFilteredData() {
  if (!activeFilter.value) {
    // Se não há filtro ativo, carregamos normalmente
    return loadTableData();
  }
  
  isLoading.value = true;
  loadError.value = null;
  selectedRows.value = [];
  
  try {
    console.log(`Aplicando filtro no servidor: "${activeFilter.value}"`);
    
    // Verificar se o filtro inclui "id = X" para facilitar a depuração
    const idMatch = activeFilter.value.match(/^\s*id\s*=\s*(\d+)\s*$/i);
    if (idMatch) {
      const idValue = parseInt(idMatch[1], 10);
      console.log(`Buscando registro com ID: ${idValue}`);
    }
    
    // Carregar dados com filtro SQL diretamente do servidor
    const result = await databaseStore.loadFilteredTableData(
      props.connectionId,
      props.tableName,
      activeFilter.value,
      rowsPerPage.value,
      currentPage.value
    );
    
    console.log(`Resultado da busca filtrada: ${result.data?.length || 0} registros de ${result.totalRecords || 0} total`);
    
    if (!result.data || result.data.length === 0) {
      if (result.totalRecords > 0) {
        // Se temos registros no total, mas não nesta página
        showAlert(`Nenhum registro encontrado na página ${currentPage.value}. Total: ${result.totalRecords}`, 'info');
      } else {
        // Se não há registros em nenhuma página
        showAlert('Nenhum registro corresponde ao filtro aplicado', 'info');
      }
    } else {
      showAlert(`Encontrado ${result.totalRecords} registro(s) correspondente(s) ao filtro`, 'success');
      
      if (idMatch && result.data.length === 1) {
        // Se estamos buscando por ID e encontramos exatamente um resultado, destacar na UI
        console.log(`Encontrado registro com ID: ${idMatch[1]}`, result.data[0]);
      }
    }
    
    // Atualizar os dados da tabela com o resultado filtrado
    tableData.value = result.data || [];
    
    // Atualizar a contagem total baseada nos resultados filtrados
    totalRecordsCount.value = result.totalRecords || 0;
    
    // Notificar o pai sobre os dados carregados
    props.onLoad({
      columns: columns.value,
      rowCount: result.totalRecords || 0
    });
  } catch (error) {
    console.error('Erro ao aplicar filtro:', error);
    loadError.value = error.message;
    showAlert(`Erro ao aplicar filtro: ${error.message}`, 'error');
    tableData.value = [];
    totalRecordsCount.value = 0;
  } finally {
    isLoading.value = false;
  }
}

// Melhorar a função de navegação para chave estrangeira
async function navigateToForeignKey(column, value) {
  if (value === null || value === undefined) {
    showAlert("Valor nulo ou indefinido. Impossível navegar para o registro relacionado.", "error");
    return;
  }
  
  try {
    // Primeiro, determine se esta é uma chave estrangeira
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    const columnInfo = structure.find(col => col.name === column);
    
    // Se não for chave estrangeira, retornar
    if (!columnInfo || !columnInfo.foreign_key) {
      console.log(`A coluna "${column}" não é uma chave estrangeira`);
      return;
    }
    
    // Obter as relações de chave estrangeira
    const foreignKeys = await databaseStore.getTableForeignKeys(props.connectionId, props.tableName);
    const foreignKey = foreignKeys.find(fk => fk.column === column);
    
    if (!foreignKey) {
      console.error(`Informação de chave estrangeira não encontrada para a coluna "${column}"`);
      return;
    }
    
    console.log("Navegando para chave estrangeira:", foreignKey);
    
    // Tabela alvo e coluna referenciada
    const targetTable = foreignKey.referenced_table;
    const targetColumn = foreignKey.referenced_column;
    
    if (!targetTable || !targetColumn) {
      console.error("Tabela ou coluna de referência não encontrada na chave estrangeira");
      return;
    }
    
    // Formatar valor corretamente dependendo do tipo
    let filterValue = value;
    if (typeof value === 'string') {
      // Escape single quotes in strings and wrap in quotes
      filterValue = `'${value.replace(/'/g, "''")}'`;
    }
    
    // Criar o filtro SQL
    const filter = `${targetColumn} = ${filterValue}`;
    
    // Criar título para a nova aba
    const tabTitle = `${targetTable} (Filtrado)`;
    
    console.log(`Navegando para ${targetTable} onde ${filter}`);
    
    // Dados para a nova aba
    const newTab = {
      id: `data-${props.connectionId}-${targetTable}-${Date.now()}`,
      title: tabTitle,
      type: 'data',
      data: {
        connectionId: props.connectionId,
        tableName: targetTable,
        filter: filter
      },
      icon: 'table'
    };
    
    console.log("Abrindo nova aba com filtro:", filter);
    
    // Chamar a função passada via props para abrir a nova aba
    props.onOpenTab(newTab);
  } catch (error) {
    console.error('Erro ao navegar para chave estrangeira:', error);
    showAlert('Falha ao navegar para registro relacionado: ' + error.message, 'error');
  }
}

// Adicionar a função para verificar se uma coluna é chave estrangeira
const foreignKeyColumns = ref([]);

async function loadForeignKeyInfo() {
  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    if (structure && Array.isArray(structure)) {
      foreignKeyColumns.value = structure
        .filter(col => col.foreign_key)
        .map(col => col.name);
    }
  } catch (error) {
    console.error('Error loading foreign key info:', error);
  }
}

function isForeignKeyColumn(column) {
  return foreignKeyColumns.value.includes(column);
}

// Adicionar a função para definir exemplos de filtro
function setExampleFilter(example) {
  advancedFilterTerm.value = example;
  // Aplicar o filtro imediatamente se for clicado em um exemplo
  applyAdvancedFilter();
}

// Modificar a função watch para paginatedData para depurar quando os dados são filtrados
watch(() => paginatedData.value.length, (newLength, oldLength) => {
  console.log(`Dados paginados mudaram: ${oldLength} -> ${newLength} linhas`);
});

// Modificar o watch para reagir a mudanças no filtro ativo
watch(() => activeFilter.value, (newFilter, oldFilter) => {
  if (newFilter !== oldFilter) {
    console.log(`Filtro ativo mudou: "${oldFilter}" -> "${newFilter}"`);
  }
});

// Adicionar um evento para quando rowsPerPage mudar
watch(rowsPerPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    currentPage.value = 1; // Voltar para a primeira página
    loadTableData(); // Sempre recarregar os dados ao mudar o número de linhas por página
  }
});

// Adicionar log quando o total de registros mudar
watch(() => totalRecordsCount.value, (newCount) => {
  console.log(`Total de registros atualizado: ${newCount}`);
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
  min-width: 200px !important;
  max-width: none !important;
}

/* Add some styles to indicate which columns are expanded */
th:has(+ tr td.expanded) {
  min-width: 200px !important;
  max-width: none !important;
}

/* Style for resize handle when column is expanded */
.expanded-resize-handle {
  background-color: theme('colors.primary') !important;
  width: 2px !important;
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