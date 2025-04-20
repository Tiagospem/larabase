<template>
  <div class="h-full flex flex-col">
    <div
      class="bg-base-200 p-2 border-b border-neutral flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <RefreshButton :store-id="storeId" />
        <LiveTableButton :store-id="storeId" />
        <TruncateButton :store-id="storeId" />
        <DeleteButton :store-id="storeId" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex items-center gap-2">
          <div class="input-group">
            <input
              v-model="tableDataStore.filterTerm"
              type="text"
              placeholder="Filter..."
              class="input input-sm input-bordered bg-base-300 w-full sm:w-64"
              @keyup.enter="applyFilter"
            />
            <button
              class="btn btn-sm"
              :class="{
                'bg-base-300 border-base-300':
                  !tableDataStore.activeFilter && !tableDataStore.filterTerm,
                'bg-primary border-primary text-white':
                  tableDataStore.activeFilter || tableDataStore.filterTerm
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
            v-if="tableDataStore.filterTerm || tableDataStore.activeFilter"
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
          v-model="tableDataStore.rowsPerPage"
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
      <div
        v-if="tableDataStore.isLoading && !tableDataStore.isLiveUpdating"
        class="flex items-center justify-center h-full"
      >
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div
        v-else-if="tableDataStore.loadError"
        class="flex items-center justify-center h-full text-error"
      >
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
          <p>{{ tableDataStore.loadError }}</p>
          <button class="btn btn-sm btn-primary mt-4" @click="tableDataStore.loadTableData()">
            Try again
          </button>
        </div>
      </div>

      <div
        v-else-if="
          (tableDataStore.filterTerm || tableDataStore.activeFilter) &&
          tableDataStore.filteredData.length === 0
        "
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
            <button class="btn btn-sm btn-primary" @click="tableDataStore.loadTableData()">
              Reload Data
            </button>
          </div>
        </div>
      </div>

      <div
        v-else-if="tableData.length > 0"
        ref="tableContainer"
        tabindex="0"
        class="h-full relative flex flex-col"
        @keydown.prevent="handleKeyDown"
      >
        <div
          class="overflow-x-scroll overflow-y-auto flex-grow"
          style="max-height: calc(100% - 45px)"
        >
          <table class="table table-sm w-[150%] table-fixed min-w-full">
            <thead class="bg-base-300 sticky top-0 z-15">
              <tr class="text-xs select-none">
                <th class="w-10 px-2 py-2 border-r border-neutral bg-base-300 sticky left-0 z-10">
                  <span class="sr-only">Preview</span>
                </th>
                <th
                  v-for="(column, index) in tableDataStore.columns"
                  :key="column"
                  class="px-4 py-2 border-r border-neutral last:border-r-0 relative whitespace-nowrap top-0 cursor-pointer"
                  :class="{
                    'bg-base-300': true,
                    'sticky left-10 z-10': index === 0
                  }"
                  :style="{
                    width:
                      tableDataStore.columnWidths[column] ||
                      tableDataStore.defaultColumnWidth(column),
                    maxWidth:
                      tableDataStore.columnWidths[column] ||
                      tableDataStore.defaultColumnWidth(column)
                  }"
                  @click.stop="handleSortClick(column)"
                >
                  <div class="flex items-center justify-between">
                    <span class="truncate">{{ column }}</span>
                    <div class="flex items-center">
                      <span v-if="tableDataStore.currentSortColumn === column" class="ml-1">
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
                @dblclick.stop="handleRowDoubleClick(row)"
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
                  :key="`${rowIndex}-${column}`"
                  class="px-4 py-2 border-r border-neutral last:border-r-0 truncate whitespace-nowrap overflow-hidden"
                  :class="[
                    colIndex === 0 ? `sticky left-10 z-10` : 'z-[1]',
                    colIndex === 0 ? getRowBackgroundClass(rowIndex) : ''
                  ]"
                  :style="{
                    width:
                      tableDataStore.columnWidths[column] ||
                      tableDataStore.defaultColumnWidth(column),
                    maxWidth:
                      tableDataStore.columnWidths[column] ||
                      tableDataStore.defaultColumnWidth(column)
                  }"
                  @dblclick.stop="openEditModal(row)"
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
                          : formatCellValue(row[column])
                      }}
                    </span>

                    <button
                      v-if="tableDataStore.isForeignKeyColumn(column) && row[column] !== null"
                      class="ml-1 text-white hover:text-primary-focus transition-colors cursor-pointer flex-shrink-0"
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
          <button class="btn btn-sm btn-primary mt-4" @click="tableDataStore.loadTableData()">
            Reload
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="tableData.length > 0"
      class="bg-base-200 px-4 py-3 border-t border-neutral flex flex-col sm:flex-row justify-between items-center text-xs sticky bottom-0 left-0 right-0 min-h-[56px] z-20"
    >
      <div class="flex items-center mb-2 sm:mb-0">
        <span class="text-gray-400">
          {{ tableName }} | {{ tableDataStore.totalRecords }} records{{
            tableDataStore.selectedRows.length > 0
              ? ` | ${tableDataStore.selectedRows.length} selected`
              : ''
          }}
          | <span>{{ tableDataStore.columns.length }} columns</span>
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
            :class="{ 'btn-disabled': tableDataStore.currentPage === 1 }"
            :disabled="tableDataStore.currentPage === 1"
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
            :class="{ 'btn-disabled': tableDataStore.currentPage === 1 }"
            :disabled="tableDataStore.currentPage === 1"
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
            <span class="text-xs"> {{ tableDataStore.currentPage }} / {{ totalPages }} </span>
          </div>

          <button
            class="join-item btn btn-xs"
            :class="{ 'btn-disabled': tableDataStore.currentPage === totalPages }"
            :disabled="tableDataStore.currentPage === totalPages"
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
            :class="{ 'btn-disabled': tableDataStore.currentPage === totalPages }"
            :disabled="tableDataStore.currentPage === totalPages"
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
            v-model="tableDataStore.rowsPerPage"
            class="select select-xs select-bordered bg-base-300 w-16"
            @change="tableDataStore.currentPage = 1"
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
                v-for="column in tableDataStore.columns"
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

    <DataPreviewModal
      v-if="tableDataStore.previewingRecord"
      :show="tableDataStore.showPreviewModal"
      :record="tableDataStore.previewingRecord"
      :columns="tableDataStore.columns"
      @close="closePreviewModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import DataPreviewModal from '@/components/database/DataPreviewModal.vue';
import RefreshButton from '@/components/tabs/components/RefreshButton.vue';
import LiveTableButton from '@/components/tabs/components/LiveTableButton.vue';
import TruncateButton from '@/components/tabs/components/TruncateButton.vue';
import DeleteButton from '@/components/tabs/components/DeleteButton.vue';

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

import { useTableDataStore, createTableDataStoreId } from '@/store/table-data';
import { useDatabaseStore } from '@/store/database';

const storeId = createTableDataStoreId(props.connectionId, props.tableName);

const tableDataStore = useTableDataStore(storeId);
const databaseStore = useDatabaseStore();

const showAlert = inject('showAlert');

const tableContainer = ref(null);
const resizingColumn = ref(null);
const startX = ref(0);
const startWidth = ref(0);
const recentlyResized = ref(false);
const isDragging = ref(false);
const shiftKeyPressed = ref(false);
const ctrlKeyPressed = ref(false);
const selectionStartId = ref(null);
const pageInput = ref(1);

const totalPages = computed(() => {
  if (tableDataStore.rowsPerPage === 0) return 1;
  return Math.ceil(tableDataStore.totalRecords / tableDataStore.rowsPerPage);
});

const tableData = computed(() => tableDataStore.tableData);

const rowsPerPage = computed(() => tableDataStore.rowsPerPage);

const highlightChanges = computed(() => tableDataStore.highlightChanges);

const showEditModal = ref(false);
const editingRecord = ref(null);
const originalRecord = ref(null);

const showFilterModal = ref(false);
const advancedFilterTerm = ref('');
const persistFilter = ref(true);
const originalFilterTerm = ref('');

const windowInFocus = ref(true);

onMounted(() => {
  tableDataStore.setConnectionId(props.connectionId);
  tableDataStore.setTableName(props.tableName);
  tableDataStore.setOnLoad(props.onLoad);
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

function startColumnResize(event, column) {
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

function handleColumnResize(event) {
  if (!resizingColumn.value) return;

  const column = resizingColumn.value;
  const width = Math.max(60, startWidth.value + (event.clientX - startX.value));
  tableDataStore.columnWidths[column] = `${width}px`;
}

function stopColumnResize() {
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
  resizingColumn.value = null;

  recentlyResized.value = true;

  setTimeout(() => {
    recentlyResized.value = false;
  }, 500);
}

function getRowClasses(rowIndex) {
  const isSelected =
    tableDataStore.selectedRows &&
    tableDataStore.selectedRows.includes &&
    tableDataStore.selectedRows.includes(rowIndex);
  const isUpdated =
    tableDataStore.highlightChanges &&
    tableDataStore.updatedRows &&
    tableDataStore.updatedRows.includes &&
    tableDataStore.updatedRows.includes(rowIndex);

  return {
    'selected-row': isSelected,
    'updated-row': isUpdated && !isSelected,
    'hover:bg-base-200': !isSelected
  };
}

function getRowBackgroundClass(rowIndex) {
  if (
    tableDataStore.selectedRows &&
    tableDataStore.selectedRows.includes &&
    tableDataStore.selectedRows.includes(rowIndex)
  ) {
    return 'bg-[#ea4331] text-white';
  }

  if (
    tableDataStore.highlightChanges &&
    tableDataStore.updatedRows &&
    tableDataStore.updatedRows.includes &&
    tableDataStore.updatedRows.includes(rowIndex)
  ) {
    return 'bg-[rgba(234,67,49,0.1)]';
  }

  return 'bg-base-100';
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

const handleKeyDown = e => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    tableDataStore.selectedRows = [];
    tableDataStore.lastSelectedId = null;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    tableDataStore.selectedRows = tableDataStore.paginatedData.map((_, index) => index);
  } else if (e.key === 'Escape') {
    tableDataStore.selectedRows = [];
    tableDataStore.lastSelectedId = null;
    tableDataStore.showDeleteConfirm = false;
  } else if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    tableDataStore.selectedRows.length > 0
  ) {
    e.preventDefault();
    tableDataStore.deleteSelected();
  }
};

const handleKeyUp = e => {
  shiftKeyPressed.value = e.shiftKey;
  ctrlKeyPressed.value = e.ctrlKey || e.metaKey;
};

function prevPage() {
  if (tableDataStore.currentPage > 1) {
    tableDataStore.currentPage--;
    scrollToTop();
  }
}

function nextPage() {
  if (tableDataStore.currentPage < totalPages.value) {
    tableDataStore.currentPage++;
    scrollToTop();
  }
}

function goToFirstPage() {
  if (tableDataStore.currentPage !== 1) {
    tableDataStore.currentPage = 1;
    scrollToTop();
  }
}

function goToLastPage() {
  if (tableDataStore.currentPage !== totalPages.value) {
    tableDataStore.currentPage = totalPages.value;
    scrollToTop();
  }
}

function goToPage() {
  const page = parseInt(pageInput.value);
  if (
    !isNaN(page) &&
    page >= 1 &&
    page <= totalPages.value &&
    page !== tableDataStore.currentPage
  ) {
    tableDataStore.currentPage = page;
    scrollToTop();
  } else {
    pageInput.value = tableDataStore.currentPage;
  }
}

function scrollToTop() {
  if (tableContainer.value) {
    tableContainer.value.scrollTop = 0;
  }
}

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

      recordToSave[key] = value;
    }

    if (!recordToSave.id) {
      showAlert('Record must have an ID field to update', 'error');
      return;
    }

    const index = tableData.findIndex(row => {
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
      tableDataStore.tableData[index] = { ...recordToSave };
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
  const rowIndex = tableDataStore.paginatedData.findIndex(r => r === row);

  if (!tableDataStore.selectedRows.includes(rowIndex)) {
    tableDataStore.selectedRows = [];
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

  tableDataStore.selectedRows = rangeIds;
}

function handleMouseUp() {
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

function handleStorageChange(event) {
  if (!event.key) return;

  const ourKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
  if (event.key === ourKey) {
    const newValue = event.newValue === 'true';
    if (newValue !== tableDataStore.isLiveTableActive) {
      tableDataStore.isLiveTableActive = newValue;
      if (newValue) {
        tableDataStore.startLiveUpdates();
      } else {
        tableDataStore.stopLiveUpdates();
      }
    }
  }

  if (
    event.key.startsWith('liveTable.enabled.') &&
    event.key !== ourKey &&
    event.newValue === 'true' &&
    tableDataStore.isLiveTableActive
  ) {
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
    localStorage.setItem(ourKey, 'false');
  }
}

const handleTabActivation = () => {
  refreshLiveTableState();
  setTimeout(refreshLiveTableState, 100);
};

const refreshLiveTableState = () => {
  try {
    const liveTableKey = `liveTable.enabled.${props.connectionId}.${props.tableName}`;
    const storedState = localStorage.getItem(liveTableKey) === 'true';

    if (tableDataStore.isLiveTableActive !== storedState) {
      tableDataStore.isLiveTableActive = storedState;

      if (tableDataStore.isLiveTableActive && !tableDataStore.liveTableInterval) {
        tableDataStore.startLiveUpdates();
      } else if (!tableDataStore.isLiveTableActive && tableDataStore.liveTableInterval) {
        tableDataStore.stopLiveUpdates();
      }
    }
  } catch (e) {
    console.error('Error refreshing Live Table state:', e);
  }
};

const handleWindowFocus = () => {
  windowInFocus.value = true;
  refreshLiveTableState();
};

const handleWindowBlur = () => {
  windowInFocus.value = false;
};

function toggleAdvancedFilter() {
  originalFilterTerm.value = advancedFilterTerm.value;
  showFilterModal.value = true;
}

function applyFilter() {
  tableDataStore.currentPage = 1;
}

async function applyAdvancedFilter() {
  tableDataStore.activeFilter = advancedFilterTerm.value;

  if (persistFilter.value && tableDataStore.activeFilter) {
    localStorage.setItem(
      `filter:${props.connectionId}:${props.tableName}`,
      JSON.stringify({
        active: true,
        value: tableDataStore.activeFilter
      })
    );
  }

  showFilterModal.value = false;

  tableDataStore.currentPage = 1;

  const useServerFilter = shouldUseServerFilter(tableDataStore.activeFilter);

  if (useServerFilter) {
    try {
      await loadFilteredData();
    } catch (error) {
      console.error('Error to get filtered data:', error);
      showAlert(`Error to apply filter: ${error.message}`, 'error');
    }
  }
}

function cancelAdvancedFilter() {
  advancedFilterTerm.value = originalFilterTerm.value;
  showFilterModal.value = false;
}

function clearFilters() {
  const hadActiveFilter = tableDataStore.activeFilter || tableDataStore.filterTerm;

  tableDataStore.filterTerm = '';
  advancedFilterTerm.value = '';
  tableDataStore.activeFilter = '';

  localStorage.removeItem(`filter:${props.connectionId}:${props.tableName}`);

  const url = new URL(window.location.href);
  url.searchParams.delete('filter');
  window.history.replaceState({}, '', url.toString());

  if (hadActiveFilter) {
    tableDataStore.currentPage = 1;
    tableDataStore.loadTableData();
  }
}

function insertColumnName(column) {
  advancedFilterTerm.value += column + ' ';
}

function insertOperator(op) {
  advancedFilterTerm.value += ' ' + op + ' ';
}

function shouldUseServerFilter(filter) {
  if (!filter) return false;

  const cleanFilter = filter.trim();
  if (!cleanFilter) return false;

  const idMatch = cleanFilter.match(/^\s*id\s*=\s*(\d+)\s*$/i);
  if (idMatch) {
    const idValue = parseInt(idMatch[1], 10);
    if (!isNaN(idValue)) {
      return true;
    }
  }

  if (/\bLIKE\b/i.test(cleanFilter)) {
    return true;
  }

  if (/\bAND\b|\bOR\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b/i.test(cleanFilter)) {
    return true;
  }

  return /^\s*\w+_id\s*=\s*\d+\s*$/i.test(cleanFilter);
}

async function loadFilteredData() {
  if (!tableDataStore.activeFilter) {
    return tableDataStore.loadTableData();
  }

  tableDataStore.isLoading = true;
  tableDataStore.loadError = null;
  tableDataStore.selectedRows = [];

  try {
    const idMatch = tableDataStore.activeFilter.match(/^\s*id\s*=\s*(\d+)\s*$/i);
    if (idMatch) {
      const idValue = parseInt(idMatch[1], 10);
    }

    const sortParams = tableDataStore.currentSortColumn
      ? {
          sortColumn: tableDataStore.currentSortColumn,
          sortDirection: tableDataStore.currentSortDirection
        }
      : {};

    const result = await databaseStore.loadFilteredTableData(
      props.connectionId,
      props.tableName,
      tableDataStore.activeFilter,
      tableDataStore.rowsPerPage,
      tableDataStore.currentPage,
      sortParams
    );

    if (!result.data || result.data.length === 0) {
      if (result.totalRecords > 0) {
        showAlert(
          `No records found on page ${tableDataStore.currentPage}. Total: ${result.totalRecords}`,
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

    tableDataStore.tableData = result.data || [];

    tableDataStore.totalRecordsCount = result.totalRecords || 0;

    props.onLoad({
      columns: tableDataStore.columns,
      rowCount: result.totalRecords || 0
    });
  } catch (error) {
    console.error('Error applying filter:', error);
    tableDataStore.loadError = error.message;
    showAlert(`Error applying filter: ${error.message}`, 'error');
    tableDataStore.tableData = [];
    tableDataStore.totalRecordsCount = 0;
  } finally {
    tableDataStore.isLoading = false;
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

    props.onOpenTab(newTab);
  } catch (error) {
    console.error('Error navigating to foreign key:', error);
    showAlert('Failed to navigate to related record: ' + error.message, 'error');
  }
}

function setExampleFilter(example) {
  advancedFilterTerm.value = example;

  applyAdvancedFilter();
}

function openPreviewModal(row) {
  tableDataStore.previewingRecord = JSON.parse(JSON.stringify(row));
  tableDataStore.showPreviewModal = true;
}

function closePreviewModal() {
  tableDataStore.showPreviewModal = false;
  setTimeout(() => {
    tableDataStore.previewingRecord = null;
  }, 300);
}

function handleSortClick(column) {
  if (resizingColumn.value !== null || recentlyResized.value) {
    return;
  }

  if (tableDataStore.currentSortColumn === column) {
    tableDataStore.currentSortDirection =
      tableDataStore.currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    tableDataStore.currentSortColumn = column;
    tableDataStore.currentSortDirection = 'asc';
  }

  tableDataStore.currentPage = 1;

  if (tableDataStore.activeFilter) {
    loadFilteredData(); //not implemented
  } else {
    tableDataStore.loadTableData();
  }
}

function addEventListener() {
  window.addEventListener('tab-activated', handleTabActivation);
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
}

function removeEventListener() {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousemove', handleColumnResize);
  window.removeEventListener('tab-activated', handleTabActivation);
  window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
}

onMounted(() => {
  addEventListener();

  if (props.initialFilter) {
    advancedFilterTerm.value = props.initialFilter;
    tableDataStore.activeFilter = props.initialFilter;
  }

  try {
    const tableSpecificLiveEnabled = localStorage.getItem(
      `liveTable.enabled.${props.connectionId}.${props.tableName}`
    );

    let otherTableLiveActive = false;

    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (
        key.startsWith('liveTable.enabled.') &&
        key !== `liveTable.enabled.${props.connectionId}.${props.tableName}` &&
        localStorage.getItem(key) === 'true'
      ) {
        otherTableLiveActive = true;
      }
    });

    if (tableSpecificLiveEnabled === 'true' && !otherTableLiveActive) {
      tableDataStore.isLiveTableActive = true;
    } else {
      tableDataStore.isLiveTableActive = false;
      if (tableSpecificLiveEnabled === 'true') {
        localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
      }
    }

    const savedLiveDelay = localStorage.getItem('liveTable.delay');

    if (savedLiveDelay) {
      tableDataStore.liveUpdateDelaySeconds = parseInt(savedLiveDelay, 10) || 3;
      tableDataStore.liveUpdateDelay = tableDataStore.liveUpdateDelaySeconds * 1000;
    }

    const savedHighlightChanges = localStorage.getItem('liveTable.highlight');
    if (savedHighlightChanges !== null) {
      tableDataStore.highlightChanges = savedHighlightChanges === 'true';
    }
  } catch (e) {
    console.error('Failed to load live table preferences', e);
  }

  tableDataStore.loadTableData();

  if (tableDataStore.isLiveTableActive) {
    tableDataStore.startLiveUpdates();
  }

  refreshLiveTableState();

  const urlParams = new URLSearchParams(window.location.search);

  const urlFilter = urlParams.get('filter');

  if (urlFilter) {
    try {
      const decodedFilter = decodeURIComponent(urlFilter);
      advancedFilterTerm.value = decodedFilter;
      tableDataStore.activeFilter = decodedFilter;
    } catch (e) {
      console.error('Error to process URL filter:', e);
    }
  } else if (!props.initialFilter) {
    const savedFilter = localStorage.getItem(`filter:${props.connectionId}:${props.tableName}`);
    if (savedFilter) {
      try {
        const parsedFilter = JSON.parse(savedFilter);
        if (parsedFilter.active && parsedFilter.value) {
          advancedFilterTerm.value = parsedFilter.value;
          tableDataStore.activeFilter = parsedFilter.value;
        }
      } catch (e) {
        console.error('Error to process saved filter:', e);
      }
    }
  }
});

onUnmounted(() => {
  removeEventListener();

  if (tableDataStore.isLiveTableActive) {
    try {
      localStorage.setItem(`liveTable.enabled.${props.connectionId}.${props.tableName}`, 'false');
    } catch (e) {
      console.error('Failed to update localStorage during component unmount', e);
    }
    tableDataStore.isLiveTableActive = false;
    tableDataStore.stopLiveUpdates();
  }
});

watch(
  () => tableDataStore.currentPage,
  (newPage, oldPage) => {
    if (newPage !== oldPage) {
      pageInput.value = newPage;

      if (!tableDataStore.filterTerm && !tableDataStore.activeFilter) {
        tableDataStore.loadTableData();
      }
    }
  }
);

watch(rowsPerPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    tableDataStore.currentPage = 1;
    tableDataStore.loadTableData();
  }
});

watch(highlightChanges, newValue => {
  try {
    localStorage.setItem('liveTable.highlight', String(newValue));
  } catch (e) {
    console.error('Failed to save highlight preference', e);
  }
});

watch(
  [() => props.tableName, () => props.connectionId],
  ([newTableName, newConnectionId], [oldTableName, oldConnectionId]) => {
    if (newTableName !== oldTableName || newConnectionId !== oldConnectionId) {
      if (oldTableName && oldConnectionId) {
        const oldLiveTableKey = `liveTable.enabled.${oldConnectionId}.${oldTableName}`;
        try {
          localStorage.setItem(oldLiveTableKey, 'false');
        } catch (e) {
          console.error('Error deactivating previous tab live table:', e);
        }
      }

      if (tableDataStore.isLiveTableActive) {
        tableDataStore.stopLiveUpdates();
        tableDataStore.isLiveTableActive = false;
      }

      try {
        const newLiveTableKey = `liveTable.enabled.${newConnectionId}.${newTableName}`;
        const isLiveEnabled = localStorage.getItem(newLiveTableKey) === 'true';

        const activeLiveTableKeys = [];
        const allKeys = Object.keys(localStorage);
        for (const key of allKeys) {
          if (key.startsWith('liveTable.enabled.') && localStorage.getItem(key) === 'true') {
            activeLiveTableKeys.push(key);
          }
        }

        if (
          activeLiveTableKeys.length > 1 ||
          (activeLiveTableKeys.length === 1 && !isLiveEnabled)
        ) {
          activeLiveTableKeys.forEach(key => {
            if (key !== newLiveTableKey || !isLiveEnabled) {
              localStorage.setItem(key, 'false');
            }
          });
        }

        tableDataStore.isLiveTableActive = isLiveEnabled;

        if (tableDataStore.isLiveTableActive) {
          tableDataStore.startLiveUpdates();
        }
      } catch (e) {
        console.error('Error updating live table state during tab switch:', e);
        tableDataStore.isLiveTableActive = false;
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

/* Fix for sticky columns during horizontal scroll */
.table {
  border-collapse: separate;
  border-spacing: 0;
}

/* Restore all cell borders with direct color values */
.table th,
.table td {
  border: 0.5px solid #333 !important;
}

/* Increase z-index for better layer management */
thead {
  z-index: 15 !important;
}

.table > thead.bg-base-300 > tr > th {
  border: 0.5px solid #000 !important;
}

/* Fix for hover effects on sticky columns - respecting selected rows */
tbody tr:not(.selected-row):hover td.sticky,
tbody tr:not(.selected-row):hover td[class*='sticky'],
tbody tr:not(.selected-row).hover td.sticky,
tbody tr:not(.selected-row).hover td[class*='sticky'] {
  background-color: hsl(var(--b2)) !important; /* base-200 color in tailwind */
}

/* Also apply the hover background to the first data column - respecting selected rows */
tbody tr:not(.selected-row):hover td[class*='left-10'],
tbody tr:not(.selected-row).hover td[class*='left-10'] {
  background-color: hsl(var(--b2)) !important;
}

/* Ensure selected rows' sticky columns maintain selection color on hover */
tbody tr.selected-row:hover td.sticky,
tbody tr.selected-row:hover td[class*='sticky'],
tbody tr.selected-row:hover td[class*='left-10'] {
  background-color: #ea4331 !important;
  color: white !important;
}
</style>
