<template>
  <div class="h-full flex flex-col">
    <div
      class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-sm btn-ghost" @click="loadTableData">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span class="hidden sm:inline">Refresh</span>
        </button>

        <!-- Live Table Toggle Button -->
        <div class="flex items-center gap-1">
          <div class="dropdown dropdown-end">
            <button
              class="btn btn-sm"
              :class="isLiveTableActive ? 'btn-primary' : 'btn-ghost'"
              @click="toggleLiveTable"
            >
              <div class="flex items-center gap-1">
                <span class="relative flex h-2 w-2">
                  <span
                    class="absolute inline-flex h-full w-full rounded-full opacity-75"
                    :class="isLiveTableActive ? 'animate-ping bg-success' : 'bg-transparent'"
                  ></span>
                  <span
                    class="relative inline-flex rounded-full h-2 w-2"
                    :class="isLiveTableActive ? 'bg-success' : 'bg-transparent'"
                  ></span>
                </span>
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
                    d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79"
                  />
                </svg>
                <span class="hidden sm:inline">Live</span>
                <span v-if="updateCounter > 0" class="badge badge-sm badge-accent">{{
                  updateCounter
                }}</span>
              </div>
            </button>
            <div
              tabindex="0"
              class="dropdown-content z-[40] menu p-2 shadow bg-base-200 rounded-box w-52"
            >
              <div class="p-2">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Update interval</span>
                  </label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="liveUpdateDelaySeconds"
                      type="range"
                      min="1"
                      max="30"
                      class="range range-primary range-xs"
                      @change="updateLiveDelay"
                    />
                    <span>{{ liveUpdateDelaySeconds }}s</span>
                  </div>
                </div>
                <div class="form-control mt-2">
                  <label class="label cursor-pointer">
                    <span class="label-text">Highlight changes</span>
                    <input
                      v-model="highlightChanges"
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                    />
                  </label>
                </div>
                <button
                  v-if="updateCounter > 0"
                  class="btn btn-xs btn-ghost mt-2 w-full"
                  @click="clearUpdateCounter"
                >
                  Clear counter ({{ updateCounter }})
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          class="btn btn-sm btn-ghost text-error"
          :disabled="totalRecords === 0"
          @click="confirmTruncateTable"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          <span class="hidden sm:inline">Truncate</span>
        </button>
        <button
          class="btn btn-sm btn-ghost"
          :disabled="selectedRows.length === 0"
          @click="deleteSelected"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
          <span class="hidden sm:inline"
            >Delete{{ selectedRows.length > 0 ? ` (${selectedRows.length})` : '' }}</span
          >
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex items-center gap-2">
          <div class="input-group">
            <input
              v-model="filterTerm"
              type="text"
              placeholder="Filter..."
              class="input input-sm input-bordered bg-base-300 w-full sm:w-64"
              @keyup.enter="applyFilter"
            />
            <button
              class="btn btn-sm"
              :class="{
                'bg-base-300 border-base-300': !activeFilter && !filterTerm,
                'bg-primary border-primary text-white': activeFilter || filterTerm
              }"
              @click="toggleAdvancedFilter"
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
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                />
              </svg>
            </button>
          </div>
          <button
            v-if="filterTerm || activeFilter"
            class="btn btn-sm btn-primary"
            @click="clearFilters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <select
          v-model="rowsPerPage"
          class="select select-sm select-bordered bg-base-300 w-24 sm:w-32"
        >
          <option value="10">10 rows</option>
          <option value="25">25 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading && !isLiveUpdating" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div v-else-if="loadError" class="flex items-center justify-center h-full text-error">
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-12 h-12 mx-auto mb-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p>{{ loadError }}</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Try again</button>
        </div>
      </div>

      <div
        v-else-if="(filterTerm || activeFilter) && filteredData.length === 0"
        class="flex items-center justify-center h-full text-gray-500"
      >
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-12 h-12 mx-auto mb-4 text-gray-400"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
            />
          </svg>
          <p>No records match your filter</p>
          <div class="flex justify-center space-x-2 mt-4">
            <button class="btn btn-sm btn-error" @click="clearFilters">Clear Filters</button>
            <button class="btn btn-sm btn-primary" @click="loadTableData">Reload Data</button>
          </div>
        </div>
      </div>

      <div
        v-else-if="tableData.length > 0"
        ref="tableContainer"
        tabindex="0"
        class="h-full overflow-auto relative pb-3"
        @click="handleOutsideClick"
        @keydown.prevent="handleTableKeyDown"
      >
        <div class="overflow-x-auto">
          <table class="table table-sm w-full table-fixed min-w-full">
            <thead class="bg-base-300 sticky top-0 z-10">
              <tr class="text-xs select-none">
                <th class="w-10 px-2 py-2 border-r border-neutral bg-base-300">
                  <span class="sr-only">Preview</span>
                </th>
                <th
                  v-for="(column, index) in columns"
                  :key="column"
                  class="px-4 py-2 border-r border-neutral last:border-r-0 relative whitespace-nowrap"
                  :class="{
                    'bg-base-300': !expandedColumns.includes(column),
                    'bg-base-200': expandedColumns.includes(column)
                  }"
                  :style="{
                    width: columnWidths[column] || defaultColumnWidth(column),
                    maxWidth: expandedColumns.includes(column)
                      ? 'none'
                      : columnWidths[column] || defaultColumnWidth(column)
                  }"
                >
                  <div class="flex items-center justify-between">
                    <span class="truncate">{{ column }}</span>
                    <span v-if="expandedColumns.includes(column)" class="text-primary text-xs ml-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="w-4 h-4 inline-block"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                  </div>
                  <!-- Enhanced resize handle with visual indicator -->
                  <div
                    v-if="index < columns.length - 1"
                    class="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                    title="Double-click to expand/collapse column"
                    @mousedown.stop="startColumnResize($event, column)"
                    @dblclick.stop="toggleColumnExpansion(column)"
                  >
                    <div
                      class="absolute right-0 top-0 w-[1px] h-full"
                      :class="
                        expandedColumns.includes(column)
                          ? 'expanded-resize-handle'
                          : 'bg-transparent group-hover:bg-primary group-hover:w-[2px] transition-all'
                      "
                    />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody @dblclick.stop.prevent>
              <tr
                v-for="(row, rowIndex) in paginatedData"
                :key="rowIndex"
                :class="getRowClasses(rowIndex)"
                class="border-b border-neutral hover:bg-base-200 cursor-pointer"
                @click.stop="handleRowClick($event, rowIndex)"
                @dblclick.stop="handleRowDoubleClick(row)"
                @mousedown.stop="handleMouseDown($event, rowIndex)"
                @mouseenter.stop="handleMouseEnter(rowIndex)"
              >
                <td class="w-10 px-1 border-r border-neutral text-center">
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
                  v-for="column in columns"
                  :key="`${rowIndex}-${column}`"
                  class="px-4 py-2 border-r border-neutral last:border-r-0 truncate whitespace-nowrap overflow-hidden"
                  :class="{ expanded: expandedColumns.includes(column) }"
                  :style="{
                    width: columnWidths[column] || defaultColumnWidth(column),
                    maxWidth: expandedColumns.includes(column)
                      ? 'none'
                      : columnWidths[column] || defaultColumnWidth(column)
                  }"
                  @dblclick.stop="openEditModal(row)"
                >
                  <div class="flex items-center justify-between w-full">
                    <!-- Conteúdo da célula -->
                    <span
                      :class="{
                        'text-gray-500 italic': row[column] === null && isForeignKeyColumn(column)
                      }"
                    >
                      {{
                        row[column] === null && isForeignKeyColumn(column)
                          ? 'Não relacionado'
                          : formatCellValue(row[column])
                      }}
                    </span>

                    <!-- Ícone de chave estrangeira, quando aplicável (agora no final da célula) -->
                    <button
                      v-if="isForeignKeyColumn(column) && row[column] !== null"
                      class="ml-1 text-white hover:text-primary-focus transition-colors cursor-pointer flex-shrink-0"
                      title="Navegar para registro relacionado"
                      @click.stop="navigateToForeignKey(column, row[column])"
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

                    <!-- Ícone para chaves estrangeiras nulas (agora no final da célula) -->
                    <span
                      v-else-if="isForeignKeyColumn(column) && row[column] === null"
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

      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-12 h-12 mx-auto mb-4 text-gray-400"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          <p>Records not found</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadTableData">Reload</button>
        </div>
      </div>
    </div>

    <div
      v-if="tableData.length > 0"
      class="bg-base-200 px-4 py-3 border-t border-neutral flex flex-col sm:flex-row justify-between items-center text-xs sticky bottom-0 left-0 right-0 min-h-[56px] z-20"
    >
      <div class="flex items-center mb-2 sm:mb-0">
        <span class="text-gray-400">
          {{ tableName }} | {{ totalRecords }} records{{
            selectedRows.length > 0 ? ` | ${selectedRows.length} selected` : ''
          }}
          | <span>{{ columns.length }} columns</span>
        </span>
        <div class="ml-4 flex space-x-2">
          <button class="btn btn-ghost btn-xs">
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
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
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
            :disabled="currentPage === 1"
            @click="goToFirstPage"
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
                d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': currentPage === 1 }"
            :disabled="currentPage === 1"
            @click="prevPage"
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

          <div class="join-item btn btn-xs btn-disabled">
            <span class="text-xs"> {{ currentPage }} / {{ totalPages }} </span>
          </div>

          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': currentPage === totalPages }"
            :disabled="currentPage === totalPages"
            @click="nextPage"
          >
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
          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': currentPage === totalPages }"
            :disabled="currentPage === totalPages"
            @click="goToLastPage"
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
                d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <span class="text-gray-400 hidden sm:inline-block">Rows per page:</span>
          <select
            v-model="rowsPerPage"
            class="select select-xs select-bordered bg-base-300 w-16"
            @change="currentPage = 1"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div class="hidden md:flex items-center space-x-2">
          <span class="text-gray-400">Go to page:</span>
          <input
            v-model="pageInput"
            type="number"
            min="1"
            :max="totalPages"
            class="input input-xs input-bordered bg-base-300 w-14"
            @keyup.enter="goToPage"
          />
          <button class="btn btn-xs btn-ghost" @click="goToPage">Go</button>
        </div>
      </div>
    </div>

    <div class="modal z-50" :class="{ 'modal-open': showEditModal }">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
          Edit Record
          <button class="btn btn-sm btn-circle" @click="closeEditModal">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
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
              :placeholder="column"
            />

            <input
              v-else-if="isDateField(column)"
              v-model="editingRecord[column]"
              type="datetime-local"
              class="input input-bordered w-full"
              :max="'9999-12-31T23:59'"
            />

            <input
              v-else-if="isNumberField(column)"
              v-model.number="editingRecord[column]"
              type="number"
              class="input input-bordered w-full"
              step="any"
            />

            <select
              v-else-if="isBooleanField(column)"
              v-model="editingRecord[column]"
              class="select select-bordered w-full"
            >
              <option :value="true">True</option>
              <option :value="false">False</option>
              <option v-if="editingRecord[column] === null" :value="null">NULL</option>
            </select>

            <input
              v-else
              v-model="editingRecord[column]"
              type="text"
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-error" @click="closeEditModal">Cancel</button>
          <button class="btn btn-primary" @click="saveRecord">Save Changes</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeEditModal" />
    </div>

    <div class="modal z-50" :class="{ 'modal-open': showFilterModal }">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
          Advanced Filter
          <button class="btn btn-sm btn-circle" @click="showFilterModal = false">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
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
              placeholder="id = 1"
            />
            <label class="label">
              <span class="label-text-alt text-xs">
                Examples:
                <code class="bg-base-300 p-1 cursor-pointer" @click="setExampleFilter('id = 2')"
                  >id = 2</code
                >,
                <code
                  class="bg-base-300 p-1 cursor-pointer"
                  @click="setExampleFilter('email LIKE \'%example%\'')"
                  >email LIKE '%example%'</code
                >,
                <code
                  class="bg-base-300 p-1 cursor-pointer"
                  @click="setExampleFilter('created_at IS NOT NULL')"
                  >created_at IS NOT NULL</code
                >,
                <code
                  class="bg-base-300 p-1 cursor-pointer"
                  @click="setExampleFilter('id > 10 AND id < 20')"
                  >id > 10 AND id < 20</code
                >
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
                @click="insertColumnName(column)"
              >
                {{ column }}
              </span>
            </div>

            <p class="mb-2">Common operators:</p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="op in [
                  '=',
                  '!=',
                  '>',
                  '<',
                  '>=',
                  '<=',
                  'LIKE',
                  'IN',
                  'IS NULL',
                  'IS NOT NULL',
                  'BETWEEN',
                  'AND',
                  'OR'
                ]"
                :key="op"
                class="badge badge-secondary cursor-pointer"
                @click="insertOperator(op)"
              >
                {{ op }}
              </span>
            </div>
          </div>
        </div>

        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start">
            <input v-model="persistFilter" type="checkbox" class="checkbox checkbox-primary" />
            <span class="label-text ml-2">Persist filter (remember after reload)</span>
          </label>
        </div>

        <div class="modal-action">
          <button class="btn btn-error" @click="cancelAdvancedFilter">Cancel</button>
          <button class="btn btn-primary" @click="applyAdvancedFilter">Apply Filter</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showFilterModal = false" />
    </div>

    <!-- Confirm truncate modal -->
    <div class="modal z-50" :class="{ 'modal-open': showTruncateConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error">⚠️ Truncate Table</h3>
        <p class="py-4">
          Are you sure you want to truncate the <strong>{{ tableName }}</strong> table? This will
          delete ALL records and cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn" @click="showTruncateConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="truncateTable">Truncate Table</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showTruncateConfirm = false" />
    </div>

    <!-- Confirm delete modal -->
    <div class="modal z-50" :class="{ 'modal-open': showDeleteConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error">Delete Records</h3>
        <p class="py-4">
          Are you sure you want to delete {{ selectedRows.length }} record(s)? This action cannot be
          undone.
        </p>
        <div class="modal-action">
          <button class="btn" @click="showDeleteConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showDeleteConfirm = false" />
    </div>

    <!-- Use the separate preview modal component -->
    <DataPreviewModal
      v-if="previewingRecord"
      :show="showPreviewModal"
      :record="previewingRecord"
      :columns="columns"
      @close="closePreviewModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick, watch } from 'vue';
import { useDatabaseStore } from '@/store/database';
import DataPreviewModal from '@/components/database/DataPreviewModal.vue';

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

    console.log(
      `Paginação local: página ${currentPage.value}, início ${start}, fim ${end}, total ${filteredData.value.length}`
    );

    return filteredData.value.slice(start, end);
  } else {
    // Sem filtro, já temos os dados paginados do servidor
    console.log(
      `Usando dados paginados do servidor: ${tableData.value.length} registros na página ${currentPage.value}`
    );
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

  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch (e) {}
  }

  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
    try {
      const date = new Date(value.replace(' ', 'T') + 'Z');
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch (e) {}
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
  const wasLoading = isLoading.value;

  if (!isLiveUpdating.value) {
    isLoading.value = true;
  }

  if (!loadStartTime.value) {
    loadStartTime.value = Date.now();
  }

  const loadingTimer = setTimeout(() => {
    if (isLoading.value) {
    }
  }, 100);

  loadError.value = null;

  const selectedRowIds = [];
  if (isLiveTableActive.value && selectedRows.value.length > 0) {
    selectedRows.value.forEach(rowIndex => {
      const row = paginatedData.value[rowIndex];
      if (row && row.id) {
        selectedRowIds.push(row.id);
      }
    });
  } else {
    selectedRows.value = [];
    expandedColumns.value = [];
  }

  try {
    const cacheKey = `${props.connectionId}:${props.tableName}`;
    databaseStore.clearTableCache(cacheKey);

    const result = await databaseStore.loadTableData(
      props.connectionId,
      props.tableName,
      rowsPerPage.value,
      currentPage.value
    );

    if (!result.data || result.data.length === 0) {
      showAlert('No data found for this page', 'warning');
    }

    tableData.value = result.data || [];
    totalRecordsCount.value = result.totalRecords || 0;

    if (isLiveTableActive.value && selectedRowIds.length > 0) {
      selectedRows.value = [];
      paginatedData.value.forEach((row, index) => {
        if (row && row.id && selectedRowIds.includes(row.id)) {
          selectedRows.value.push(index);
        }
      });

      if (selectedRows.value.length > 0) {
        lastSelectedId.value = selectedRows.value[selectedRows.value.length - 1];
      }
    }

    nextTick(() => {
      analyzeColumns();
    });

    await loadForeignKeyInfo();

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
    clearTimeout(loadingTimer);

    if (Date.now() - loadStartTime.value < 100 && wasLoading === false) {
      isLoading.value = false;
    } else {
      setTimeout(() => {
        isLoading.value = false;
      }, 50);
    }

    loadStartTime.value = 0;
  }

  return Promise.resolve();
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
  const isUpdated = highlightChanges.value && updatedRows.value.includes(rowIndex);

  return {
    'selected-row': isSelected,
    'updated-row': isUpdated && !isSelected,
    'hover:bg-base-200': !isSelected
  };
}

function handleRowClick(event, rowIndex) {
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
    const index = selectedRows.value.indexOf(rowIndex);
    if (index !== -1) {
      selectedRows.value.splice(index, 1);
    } else {
      selectedRows.value.push(rowIndex);
    }

    lastSelectedId.value = rowIndex;
    return;
  }

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

  if (selectedRows.value.length === 1 && selectedRows.value[0] === rowIndex) {
    selectedRows.value = [];
    lastSelectedId.value = null;
  } else {
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
  } else if (e.key === 'Delete' && selectedRows.value.length > 0) {
    e.preventDefault();
    deleteSelected();
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
  if (selectedRows.value.length === 0) return;

  deletingIds.value = selectedRows.value.map(index => {
    const id = paginatedData.value[index].id;

    return typeof id === 'object' ? String(id) : id;
  });

  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  showDeleteConfirm.value = false;

  try {
    const idsToDelete = [...deletingIds.value];

    console.log('Deleting IDs:', idsToDelete);

    const result = await databaseStore.deleteRecords(
      props.connectionId,
      props.tableName,
      idsToDelete
    );

    showAlert(result.message, 'success');

    selectedRows.value = [];
    await loadTableData();
  } catch (error) {
    console.error('Error in confirmDelete:', error);
    if (error.message.includes('referenced by other tables')) {
      showAlert(
        'Cannot delete records because they are referenced by other tables. Remove the related records first or use CASCADE constraints.',
        'error'
      );
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
    const result = await databaseStore.truncateTable(props.connectionId, props.tableName);

    showAlert(result.message, 'success');

    selectedRows.value = [];
    await loadTableData();
  } catch (error) {
    showAlert(`Error truncating table: ${error.message}`, 'error');
  }
}

const handleKeyDown = e => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    selectedRows.value = [];
    lastSelectedId.value = null;
  }
};

const handleKeyUp = e => {
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

watch(
  () => currentPage.value,
  (newPage, oldPage) => {
    if (newPage !== oldPage) {
      pageInput.value = newPage;

      if (!filterTerm.value && !activeFilter.value) {
        loadTableData();
      }
    }
  }
);

function openEditModal(row) {
  originalRecord.value = { ...row };

  const processedRecord = JSON.parse(JSON.stringify(row));

  for (const key in processedRecord) {
    if (isDateField(key) && processedRecord[key]) {
      if (typeof processedRecord[key] === 'string') {
        try {
          if (processedRecord[key].includes(' ')) {
            processedRecord[key] = processedRecord[key].replace(' ', 'T');
          }

          const date = new Date(processedRecord[key]);
          if (!isNaN(date.getTime())) {
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
    const recordToSave = {};

    for (const key in editingRecord.value) {
      let value = editingRecord.value[key];

      if (value && isDateField(key)) {
        if (typeof value === 'string' && value.includes('T')) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
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

    const result = await databaseStore.updateRecord(
      props.connectionId,
      props.tableName,
      recordToSave
    );

    if (result) {
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
    return !['id', 'created_at', 'updated_at'].includes(column);
  });
}

function isLongTextField(column) {
  return (
    /(description|content|text|body|comment|note|message|summary|details|html|json|xml)$/i.test(
      column
    ) ||
    (editingRecord.value &&
      typeof editingRecord.value[column] === 'string' &&
      editingRecord.value[column]?.length > 100)
  );
}

function isDateField(column) {
  return /(date|time|at$|created_at|updated_at|deleted_at)/i.test(column);
}

function isNumberField(column) {
  if (!editingRecord.value) return false;
  const value = editingRecord.value[column];
  return (
    typeof value === 'number' ||
    (column.includes('id') && column !== 'uuid') ||
    /(amount|price|cost|total|sum|count|number|qty|quantity|height|width|depth|size|order|position)/i.test(
      column
    )
  );
}

function isBooleanField(column) {
  if (!editingRecord.value) return false;
  const value = editingRecord.value[column];
  return (
    typeof value === 'boolean' ||
    /(active|enabled|visible|published|featured|is_|has_)/i.test(column)
  );
}

function getFieldTypeLabel(column) {
  if (!editingRecord.value) return 'Unknown';

  const value = editingRecord.value[column];

  if (isLongTextField(column)) return 'Text';
  if (isDateField(column)) return 'Date';
  if (isNumberField(column)) return 'Number';
  if (isBooleanField(column)) return 'Boolean';

  if (value === null) return 'NULL';

  return typeof value === 'object'
    ? 'Object'
    : typeof value === 'string'
      ? 'String'
      : typeof value === 'number'
        ? 'Number'
        : typeof value === 'boolean'
          ? 'Boolean'
          : typeof value;
}

function handleRowDoubleClick(row) {
  const rowIndex = paginatedData.value.findIndex(r => r === row);

  if (!selectedRows.value.includes(rowIndex)) {
    selectedRows.value = [];
  }

  openEditModal(row);
}

function handleMouseDown(event, rowIndex) {
  if (ctrlKeyPressed.value || shiftKeyPressed.value) {
    return;
  }

  isDragging.value = true;
  selectionStartId.value = rowIndex;

  window.addEventListener('mouseup', handleMouseUp, { once: true });
}

function handleMouseEnter(rowIndex) {
  if (!isDragging.value || selectionStartId.value === null) {
    return;
  }

  const start = Math.min(selectionStartId.value, rowIndex);
  const end = Math.max(selectionStartId.value, rowIndex);

  const rangeIds = [];
  for (let i = start; i <= end; i++) {
    rangeIds.push(i);
  }

  selectedRows.value = rangeIds;
}

function handleMouseUp(event) {
  if (!isDragging.value || !selectionStartId.value) {
    isDragging.value = false;
    selectionStartId.value = null;
    return;
  }

  if (selectedRows.value.length > 0) {
    lastSelectedId.value = selectedRows.value[selectedRows.value.length - 1];
  }

  isDragging.value = false;
  selectionStartId.value = null;
}

// Handle localStorage changes from other tabs/windows
function handleStorageChange(event) {
  if (!event.key) return;
  
  // Check if our specific live table setting was changed from another window
  const ourKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
  if (event.key === ourKey) {
    const newValue = event.newValue === 'true';
    if (newValue !== isLiveTableActive.value) {
      isLiveTableActive.value = newValue;
      if (newValue) {
        startLiveUpdates();
      } else {
        stopLiveUpdates();
      }
    }
  }
  
  // Check if another table was activated
  if (event.key.startsWith('liveTable.enabled.') && 
      event.key !== ourKey && 
      event.newValue === 'true' &&
      isLiveTableActive.value) {
    // Another table was activated, deactivate this one
    isLiveTableActive.value = false;
    stopLiveUpdates();
    localStorage.setItem(ourKey, 'false');
  }
}

onMounted(() => {
  if (props.initialFilter) {
    console.log('Configurando filtro inicial:', props.initialFilter);
    advancedFilterTerm.value = props.initialFilter;
    activeFilter.value = props.initialFilter;
  }

  // Function to force refresh the Live Table button state
  const refreshLiveTableState = () => {
    try {
      // Get current state from localStorage
      const liveTableKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
      const storedState = localStorage.getItem(liveTableKey) === 'true';
      
      // Update UI state if it doesn't match localStorage
      if (isLiveTableActive.value !== storedState) {
        console.log(`Forcing Live Table button update: ${isLiveTableActive.value} -> ${storedState}`);
        isLiveTableActive.value = storedState;
        
        // Start or stop updates as needed
        if (isLiveTableActive.value && !liveTableInterval.value) {
          startLiveUpdates();
        } else if (!isLiveTableActive.value && liveTableInterval.value) {
          stopLiveUpdates();
        }
      }
    } catch (e) {
      console.error('Error refreshing Live Table state:', e);
    }
  };

  // Listen for tab activation events
  const handleTabActivation = (event) => {
    // Refresh state immediately and again after a short delay to ensure UI is updated
    refreshLiveTableState();
    setTimeout(refreshLiveTableState, 100);
  };
  
  window.addEventListener('tab-activated', handleTabActivation);

  try {
    // Check for table-specific Live Table state first
    const tableSpecificLiveEnabled = localStorage.getItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`);
    
    // Check if any other table has Live Table active
    let otherTableLiveActive = false;
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('liveTable.enabled.') && 
          key !== `liveTable.enabled.${props.connectionId}.${props.tableName}` &&
          localStorage.getItem(key) === 'true') {
        otherTableLiveActive = true;
      }
    });
    
    // Only activate if this table has it enabled AND no other table has it active
    if (tableSpecificLiveEnabled === 'true' && !otherTableLiveActive) {
      isLiveTableActive.value = true;
    } else {
      // If another table has Live Table active, make sure this one is inactive
      isLiveTableActive.value = false;
      // Update localStorage to match current state
      if (tableSpecificLiveEnabled === 'true') {
        localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
      }
    }

    const savedLiveDelay = localStorage.getItem('liveTable.delay');
    if (savedLiveDelay) {
      liveUpdateDelaySeconds.value = parseInt(savedLiveDelay, 10) || 3;
      liveUpdateDelay.value = liveUpdateDelaySeconds.value * 1000;
    }

    const savedHighlightChanges = localStorage.getItem('liveTable.highlight');
    if (savedHighlightChanges !== null) {
      highlightChanges.value = savedHighlightChanges === 'true';
    }
  } catch (e) {
    console.error('Failed to load live table preferences', e);
  }

  loadTableData();

  if (isLiveTableActive.value) {
    startLiveUpdates();
  }

  // Initial refresh to ensure correct state
  refreshLiveTableState();

  // Add storage event listener to detect changes from other tabs/windows
  window.addEventListener('storage', handleStorageChange);

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

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Also refresh when window receives focus
  const handleWindowFocus = () => {
    windowInFocus.value = true;
    // Refresh the live table state when window gets focus
    refreshLiveTableState();
  };

  const handleWindowBlur = () => {
    windowInFocus.value = false;
  };

  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
  
  // Remove event listeners
  window.removeEventListener('tab-activated', handleTabActivation);
  window.removeEventListener('storage', handleStorageChange);

  // Always stop live updates when component is unmounted
  if (isLiveTableActive.value) {
    // Also update localStorage to match our state
    try {
      localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
    } catch (e) {
      console.error('Failed to update localStorage during component unmount', e);
    }
    isLiveTableActive.value = false;
    stopLiveUpdates();
  }

  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
});

function toggleAdvancedFilter() {
  originalFilterTerm.value = advancedFilterTerm.value;
  showFilterModal.value = true;
}

function applyFilter() {
  currentPage.value = 1;
}

async function applyAdvancedFilter() {
  activeFilter.value = advancedFilterTerm.value;

  if (persistFilter.value && activeFilter.value) {
    localStorage.setItem(
      `filter:${props.connectionId}:${props.tableName}`,
      JSON.stringify({
        active: true,
        value: activeFilter.value
      })
    );
  }

  showFilterModal.value = false;

  currentPage.value = 1;

  const useServerFilter = shouldUseServerFilter(activeFilter.value);

  if (useServerFilter) {
    console.log('Aplicando filtro diretamente no servidor');
    try {
      await loadFilteredData();
    } catch (error) {
      console.error('Erro ao carregar dados filtrados:', error);
      showAlert(`Erro ao aplicar filtro: ${error.message}`, 'error');
    }
  } else {
    console.log('Aplicando filtro localmente');
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
      filterFn = new Function(
        'row',
        `
        try {
          return ${filterCode};
        } catch (e) {
          console.error('Erro de execução do filtro:', e);
          return false;
        }
      `
      );
    } catch (e) {
      console.error('Erro ao criar função de filtro:', e);

      return data;
    }

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

function convertFilterToJs(filter) {
  if (!filter) return 'true';

  try {
    const idEqualityRegex = /^\s*id\s*=\s*(\d+)\s*$/i;
    const idMatch = filter.match(idEqualityRegex);

    if (idMatch) {
      const idValue = parseInt(idMatch[1], 10);
      if (!isNaN(idValue)) {
        return `row['id'] == ${idValue} || String(row['id']) == '${idValue}'`;
      }
    }

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

      if (value.startsWith("'") || value.startsWith('"')) {
        const strValue = value.substring(1, value.length - 1);
        return `row['${column}'] === '${strValue}'`;
      } else if (!isNaN(Number(value))) {
        const numValue = Number(value);
        return `row['${column}'] == ${numValue} || String(row['${column}']) == '${numValue}'`;
      } else {
        return `row['${column}'] === row['${value}']`;
      }
    }

    if (filter.toLowerCase().match(/^where\s+/)) {
      filter = filter.replace(/^where\s+/i, '');
    }

    console.log('Processando filtro complexo:', filter);

    // Proteger as strings antes do processamento
    const stringLiterals = [];
    let stringReplacedFilter = filter.replace(/'([^']*)'/g, (match, content) => {
      const placeholder = `__STRING_${stringLiterals.length}__`;
      stringLiterals.push(match);
      return placeholder;
    });

    stringReplacedFilter = stringReplacedFilter.replace(
      /(\w+)\s+LIKE\s+(__STRING_\d+__)/gi,
      (match, column, placeholder) => {
        const placeholderIndex = parseInt(placeholder.match(/__STRING_(\d+)__/)[1]);
        const originalStr = stringLiterals[placeholderIndex].substring(
          1,
          stringLiterals[placeholderIndex].length - 1
        );
        const cleanPattern = originalStr.replace(/%/g, '');

        return `(row['${column}'] != null && String(row['${column}'] || '').toLowerCase().includes('${cleanPattern.toLowerCase()}'))`;
      }
    );

    // Tratar operadores de comparação
    stringReplacedFilter = stringReplacedFilter.replace(/([<>!=]+)/g, ' $1 ').replace(/\s+/g, ' ');

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
      .replace(/\s+=\s+/g, ' == ');

    const keywords = [
      'AND',
      'OR',
      'NOT',
      'NULL',
      'IN',
      'LIKE',
      'BETWEEN',
      'IS',
      'AS',
      'TRUE',
      'FALSE',
      'true',
      'false',
      'null',
      'undefined',
      'return',
      'if',
      'else',
      'for',
      'while',
      'function'
    ];

    stringReplacedFilter = stringReplacedFilter.replace(
      /\b([a-zA-Z_]\w*)\b(?!\s*\()/g,
      (match, column) => {
        if (match.startsWith('__STRING_')) {
          return match;
        }

        if (keywords.includes(match) || keywords.includes(match.toUpperCase())) {
          return match.toUpperCase();
        }

        if (!isNaN(Number(match))) {
          return match;
        }

        return `row['${column}']`;
      }
    );

    stringLiterals.forEach((str, index) => {
      const placeholder = `__STRING_${index}__`;
      const cleanStr = str.substring(1, str.length - 1).replace(/'/g, "\\'"); // Escape aspas simples para JS

      stringReplacedFilter = stringReplacedFilter.replace(placeholder, `'${cleanStr}'`);
    });

    // Limpar espaços extras
    stringReplacedFilter = stringReplacedFilter.trim();

    console.log('Filtro convertido final:', stringReplacedFilter);

    return stringReplacedFilter;
  } catch (e) {
    console.error('Error converting SQL filter to JS:', e, 'Original filter:', filter);
    return 'true'; // Fallback to not filter anything
  }
}

// Melhorar a função para determinar quando usar filtro no servidor
function shouldUseServerFilter(filter) {
  if (!filter) return false;

  // Clean the filter
  const cleanFilter = filter.trim();
  if (!cleanFilter) return false;

  console.log('Checking if server filter should be used for:', cleanFilter);

  // 1. ID Filter - ALWAYS use server for direct ID searches
  const idMatch = cleanFilter.match(/^\s*id\s*=\s*(\d+)\s*$/i);
  if (idMatch) {
    const idValue = parseInt(idMatch[1], 10);
    if (!isNaN(idValue)) {
      console.log(`Detected ID filter: ${idValue} - Using server`);
      return true;
    }
  }

  // 2. Filter with LIKE operator (may involve many records)
  if (/\bLIKE\b/i.test(cleanFilter)) {
    console.log('Detected LIKE filter - Using server');
    return true;
  }

  if (/\bAND\b|\bOR\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b/i.test(cleanFilter)) {
    console.log('Detected complex filter with logical operators - Using server');
    return true;
  }

  if (/^\s*\w+_id\s*=\s*\d+\s*$/i.test(cleanFilter)) {
    console.log('Detected foreign key filter - Using server');
    return true;
  }

  console.log('Using local filter for:', cleanFilter);
  return false;
}

async function loadFilteredData() {
  if (!activeFilter.value) {
    return loadTableData();
  }

  isLoading.value = true;
  loadError.value = null;
  selectedRows.value = [];

  try {
    console.log(`Applying filter on server: "${activeFilter.value}"`);

    const idMatch = activeFilter.value.match(/^\s*id\s*=\s*(\d+)\s*$/i);
    if (idMatch) {
      const idValue = parseInt(idMatch[1], 10);
      console.log(`Searching for record with ID: ${idValue}`);
    }

    const result = await databaseStore.loadFilteredTableData(
      props.connectionId,
      props.tableName,
      activeFilter.value,
      rowsPerPage.value,
      currentPage.value
    );

    console.log(
      `Resultado da busca filtrada: ${result.data?.length || 0} registros de ${result.totalRecords || 0} total`
    );

    if (!result.data || result.data.length === 0) {
      if (result.totalRecords > 0) {
        showAlert(
          `No records found on page ${currentPage.value}. Total: ${result.totalRecords}`,
          'info'
        );
      } else {
        showAlert('No records match the applied filter', 'info');
      }
    } else {
      showAlert(`Found ${result.totalRecords} record(s) matching the filter`, 'success');

      if (idMatch && result.data.length === 1) {
        console.log(`Found record with ID: ${idMatch[1]}`, result.data[0]);
      }
    }

    tableData.value = result.data || [];

    totalRecordsCount.value = result.totalRecords || 0;

    props.onLoad({
      columns: columns.value,
      rowCount: result.totalRecords || 0
    });
  } catch (error) {
    console.error('Error applying filter:', error);
    loadError.value = error.message;
    showAlert(`Error applying filter: ${error.message}`, 'error');
    tableData.value = [];
    totalRecordsCount.value = 0;
  } finally {
    isLoading.value = false;
  }
}

async function navigateToForeignKey(column, value) {
  if (value === null || value === undefined) {
    showAlert('Null or undefined value. Unable to navigate to the related record.', 'error');
    return;
  }

  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    const columnInfo = structure.find(col => col.name === column);

    if (!columnInfo || !columnInfo.foreign_key) {
      console.log(`Column "${column}" is not a foreign key`);
      return;
    }

    const foreignKeys = await databaseStore.getTableForeignKeys(
      props.connectionId,
      props.tableName
    );
    const foreignKey = foreignKeys.find(fk => fk.column === column);

    if (!foreignKey) {
      console.error(`Foreign key information not found for column "${column}"`);
      return;
    }

    console.log('Navigating to foreign key:', foreignKey);

    const targetTable = foreignKey.referenced_table;
    const targetColumn = foreignKey.referenced_column;

    if (!targetTable || !targetColumn) {
      console.error('Referenced table or column not found in foreign key');
      return;
    }

    let filterValue = value;
    if (typeof value === 'string') {
      filterValue = `'${value.replace(/'/g, "''")}'`;
    }

    const filter = `${targetColumn} = ${filterValue}`;

    const tabTitle = `${targetTable} (Filtered)`;

    console.log(`Navigating to ${targetTable} where ${filter}`);

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

    console.log('Opening new tab with filter:', filter);

    props.onOpenTab(newTab);
  } catch (error) {
    console.error('Error navigating to foreign key:', error);
    showAlert('Failed to navigate to related record: ' + error.message, 'error');
  }
}

const foreignKeyColumns = ref([]);

async function loadForeignKeyInfo() {
  try {
    const structure = await databaseStore.getTableStructure(props.connectionId, props.tableName);
    if (structure && Array.isArray(structure)) {
      foreignKeyColumns.value = structure.filter(col => col.foreign_key).map(col => col.name);
    }
  } catch (error) {
    console.error('Error loading foreign key info:', error);
  }
}

function isForeignKeyColumn(column) {
  return foreignKeyColumns.value.includes(column);
}

function setExampleFilter(example) {
  advancedFilterTerm.value = example;

  applyAdvancedFilter();
}

watch(
  () => paginatedData.value.length,
  (newLength, oldLength) => {
    console.log(`Dados paginados mudaram: ${oldLength} -> ${newLength} linhas`);
  }
);

watch(
  () => activeFilter.value,
  (newFilter, oldFilter) => {
    if (newFilter !== oldFilter) {
      console.log(`Filtro ativo mudou: "${oldFilter}" -> "${newFilter}"`);
    }
  }
);

watch(rowsPerPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    currentPage.value = 1;
    loadTableData();
  }
});

watch(
  () => totalRecordsCount.value,
  newCount => {
    console.log(`Total de registros atualizado: ${newCount}`);
  }
);

const isLiveTableActive = ref(false);
const liveTableInterval = ref(null);
const liveUpdateDelay = ref(3000);
const liveUpdateDelaySeconds = ref(3);
const previousDataSnapshot = ref([]);
const updatedRows = ref([]);
const highlightChanges = ref(true);
const loadStartTime = ref(0);
const isLiveUpdating = ref(false);
const updateCounter = ref(0);
const windowInFocus = ref(true);

function updateLiveDelay() {
  liveUpdateDelay.value = liveUpdateDelaySeconds.value * 1000;

  try {
    localStorage.setItem('liveTable.delay', String(liveUpdateDelaySeconds.value));
  } catch (e) {
    console.error('Failed to save live table delay preference', e);
  }

  if (isLiveTableActive.value) {
    stopLiveUpdates();
    startLiveUpdates();
    showAlert(`Live update interval changed to ${liveUpdateDelaySeconds.value} seconds`, 'info');
  }
}

function deactivateAllOtherLiveTables() {
  try {
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    const currentLiveTableKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
    
    // Collect all active live table keys
    const activeLiveTableKeys = allKeys.filter(key => 
      key.startsWith('liveTable.enabled.') && 
      key !== currentLiveTableKey &&
      localStorage.getItem(key) === 'true'
    );
    
    // Deactivate all other live tables
    if (activeLiveTableKeys.length > 0) {
      console.log(`Deactivating ${activeLiveTableKeys.length} other live tables`);
      activeLiveTableKeys.forEach(key => {
        localStorage.setItem(key, 'false');
      });
      
      // Notify about deactivated tables (if debugging)
      // console.log('Deactivated tables:', activeLiveTableKeys);
    }
  } catch (e) {
    console.error('Failed to deactivate other live tables', e);
  }
}

function toggleLiveTable() {
  try {
    if (!isLiveTableActive.value) {
      // If currently inactive, activate it
      startLiveUpdates();
      clearUpdateCounter();
      showAlert(
        `Live table updates activated for ${props.tableName} - refreshing every ${liveUpdateDelaySeconds.value}s`,
        'success'
      );
    } else {
      // If currently active, deactivate it
      stopLiveUpdates(true);
      clearUpdateCounter();
      showAlert('Live table updates stopped', 'info');
    }
  } catch (e) {
    console.error('Failed to toggle live table:', e);
    showAlert('Failed to toggle live table updates', 'error');
  }
}

function startLiveUpdates() {
  // First stop any existing updates
  stopLiveUpdates();

  // Update UI state
  isLiveTableActive.value = true;
  
  // Update localStorage to match
  try {
    localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'true');
    
    // Deactivate all other live tables
    deactivateAllOtherLiveTables();
  } catch (e) {
    console.error('Failed to update localStorage during live table start', e);
  }

  previousDataSnapshot.value = JSON.parse(JSON.stringify(tableData.value));

  liveTableInterval.value = setInterval(() => {
    if (!isLoading.value) {
      loadStartTime.value = Date.now();
      isLiveUpdating.value = true;

      loadTableData()
        .then(() => {
          if (highlightChanges.value) {
            detectChangedRows();
          }

          if (showPreviewModal.value && previewingRecord.value) {
            updatePreviewData();
          }

          previousDataSnapshot.value = JSON.parse(JSON.stringify(tableData.value));
        })
        .catch(error => {
          console.error('Error during live update:', error);
        })
        .finally(() => {
          isLiveUpdating.value = false;
        });
    }
  }, liveUpdateDelay.value);
}

function updatePreviewData() {
  if (!previewingRecord.value || !previewingRecord.value.id) return;

  const updatedRow = tableData.value.find(row => row.id === previewingRecord.value.id);

  if (updatedRow) {
    previewingRecord.value = JSON.parse(JSON.stringify(updatedRow));
  }
}

function detectChangedRows() {
  updatedRows.value = [];

  if (!previousDataSnapshot.value.length) return;

  let changesDetected = 0;

  paginatedData.value.forEach((currentRow, index) => {
    const previousRow = previousDataSnapshot.value.find(row => {
      if (row.id !== undefined && currentRow.id !== undefined) {
        return row.id === currentRow.id;
      }
      return false;
    });

    if (!previousRow || JSON.stringify(currentRow) !== JSON.stringify(previousRow)) {
      updatedRows.value.push(index);
      changesDetected++;
    }
  });

  if (changesDetected > 0 && !windowInFocus.value) {
    updateCounter.value += changesDetected;
    updateAppIcon(updateCounter.value);
  }

  if (updatedRows.value.length > 0) {
    setTimeout(() => {
      updatedRows.value = [];
    }, 2000);
  }
}

function stopLiveUpdates(updateLocalStorage = false) {
  if (liveTableInterval.value !== null) {
    clearInterval(liveTableInterval.value);
    liveTableInterval.value = null;
  }
  
  // Update UI state
  isLiveTableActive.value = false;
  
  // Optionally update localStorage to match our state
  if (updateLocalStorage) {
    try {
      localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
    } catch (e) {
      console.error('Failed to update localStorage during live table stop', e);
    }
  }
}

watch(highlightChanges, newValue => {
  try {
    localStorage.setItem('liveTable.highlight', String(newValue));
  } catch (e) {
    console.error('Failed to save highlight preference', e);
  }
});

const showPreviewModal = ref(false);
const previewingRecord = ref(null);

function openPreviewModal(row) {
  previewingRecord.value = JSON.parse(JSON.stringify(row));
  showPreviewModal.value = true;
}

function closePreviewModal() {
  showPreviewModal.value = false;
  setTimeout(() => {
    previewingRecord.value = null;
  }, 300);
}

function clearUpdateCounter() {
  updateCounter.value = 0;
  updateAppIcon(0);
}

function updateAppIcon(count) {
  if (window.api && window.api.setAppBadge) {
    window.api.setAppBadge(count);
  }
}

// Watch for tab changes (when switching between tabs)
watch(
  [() => props.tableName, () => props.connectionId],
  ([newTableName, newConnectionId], [oldTableName, oldConnectionId]) => {
    if (newTableName !== oldTableName || newConnectionId !== oldConnectionId) {
      console.log(`Tab changed: ${oldTableName || 'none'} -> ${newTableName}`);
      
      // First, let's handle the old tab we're switching from
      if (oldTableName && oldConnectionId) {
        const oldLiveTableKey = `liveTable.enabled.${oldConnectionId}.${oldTableName}`;
        try {
          // Always deactivate Live Table for the tab we're switching from
          localStorage.setItem(oldLiveTableKey, 'false');
        } catch (e) {
          console.error('Error deactivating previous tab live table:', e);
        }
      }
      
      // Always stop current live updates
      if (isLiveTableActive.value) {
        stopLiveUpdates();
        isLiveTableActive.value = false;
      }
      
      // Check if the new tab should have live table enabled
      try {
        const newLiveTableKey = `liveTable.enabled.${newConnectionId}.${newTableName}`;
        const isLiveEnabled = localStorage.getItem(newLiveTableKey) === 'true';
        
        // Clean up any inconsistent state
        // 1. Get all live table keys and ensure only one (at most) is active
        const activeLiveTableKeys = [];
        const allKeys = Object.keys(localStorage);
        for (const key of allKeys) {
          if (key.startsWith('liveTable.enabled.') && localStorage.getItem(key) === 'true') {
            activeLiveTableKeys.push(key);
          }
        }
        
        // 2. If multiple keys are active, deactivate all except the current one (if it should be active)
        if (activeLiveTableKeys.length > 1 || (activeLiveTableKeys.length === 1 && !isLiveEnabled)) {
          activeLiveTableKeys.forEach(key => {
            if (key !== newLiveTableKey || !isLiveEnabled) {
              localStorage.setItem(key, 'false');
            }
          });
        }
        
        // Set the current tab's Live Table state
        isLiveTableActive.value = isLiveEnabled;
        
        // Start live updates if needed
        if (isLiveTableActive.value) {
          startLiveUpdates();
        }
      } catch (e) {
        console.error('Error updating live table state during tab switch:', e);
        isLiveTableActive.value = false;
      }
    }
  }
);
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

.selected-row:hover {
  background-color: #ea4331 !important;
}

.expanded {
  white-space: normal !important;
  overflow: visible !important;
  min-width: 200px !important;
  max-width: none !important;
}

th:has(+ tr td.expanded) {
  min-width: 200px !important;
  max-width: none !important;
}

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

.line-clamp-5 {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
