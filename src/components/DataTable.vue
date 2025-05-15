<script lang="ts">
  import {
    computed,
    defineComponent,
    nextTick,
    onBeforeUnmount,
    onMounted,
    PropType,
    ref,
    watch,
  } from 'vue';
  import { TableColumn } from '@/types/table';
  import SortIcon from '@/components/database/tables/SortIcon.vue';
  import { useTableStructure } from '@/composables/useTableStructure';

  interface TableRow {
    id: string | number;
    [key: string]: any;
  }

  export default defineComponent({
    name: 'DataTable',
    components: { SortIcon },
    props: {
      columns: {
        type: Array as PropType<TableColumn[]>,
        required: true,
      },
      foreignKeyColumns: {
        type: Array as PropType<string[]>,
        required: false,
        default: () => [],
      },
      data: {
        type: Array as PropType<TableRow[]>,
        required: false,
        default: () => [],
      },
      initialColumnWidth: {
        type: Number,
        default: 150,
      },
      minColumnWidth: {
        type: Number,
        default: 80,
      },
      selectedTableSort: {
        type: [String, null],
        default: null,
      },
      sortDirection: {
        type: String,
        default: 'asc',
      },
      isLoading: {
        type: Boolean,
        default: false,
      },
      tableName: {
        type: String,
        required: true,
      },
      tableStructureData: {
        type: Array as PropType<any[]>,
        default: () => [],
      },
      disableSelection: {
        type: Boolean,
        default: false,
      },
    },
    emits: [
      'row-selected',
      'row-preview',
      'row-dblclick',
      'selected-action',
      'sort',
      'navigateToForeignKey',
    ],

    setup(props, { emit }) {
      const resizingColumnIndex = ref<number | null>(null);
      const startX = ref<number>(0);
      const startWidth = ref<number>(0);
      const columnWidths = ref<number[]>([]);
      const tableContainerRef = ref<HTMLElement | null>(null);
      const tableStructure = useTableStructure();

      const selectedRows = ref<(string | number)[]>([]);
      const isSelecting = ref<boolean>(false);
      const selectionStartRow = ref<number | null>(null);
      const selectionStartId = ref<string | number | null>(null);

      onMounted(() => {
        columnWidths.value = props.columns.map(col => col.width || props.initialColumnWidth);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('mouseup', stopRowSelection);
        window.addEventListener('resize', handleWindowResize);
        document.addEventListener('keydown', handleKeyDown);

        if (props.tableStructureData && props.tableStructureData.length > 0) {
          tableStructure.initializeWithStructure(props.tableStructureData);
        }
      });

      onBeforeUnmount(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('mouseup', stopRowSelection);
        window.removeEventListener('resize', handleWindowResize);
        document.removeEventListener('keydown', handleKeyDown);
      });

      const handleWindowResize = () => {
        if (tableContainerRef.value) {
          tableContainerRef.value.style.height = '100%';
        }
      };

      const formatCellValue = (column: string, value: any) => {
        return tableStructure.formatColumnValue(column, value);
      };

      const startResize = (e: MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        resizingColumnIndex.value = index;
        startX.value = e.clientX;
        startWidth.value = columnWidths.value[index];
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (resizingColumnIndex.value !== null) {
          const diff = e.clientX - startX.value;
          columnWidths.value[resizingColumnIndex.value] = Math.max(
            props.minColumnWidth,
            startWidth.value + diff
          );
        }
      };

      const stopResize = () => {
        resizingColumnIndex.value = null;
      };

      const isRowSelected = (id: string | number) => {
        return selectedRows.value.includes(id);
      };

      const toggleRowSelection = (id: string | number, append = false) => {
        if (!append) {
          if (selectedRows.value.includes(id)) {
            selectedRows.value = [];
          } else {
            selectedRows.value = [id];
          }
        } else {
          const index = selectedRows.value.indexOf(id);
          if (index === -1) {
            selectedRows.value.push(id);
          } else {
            selectedRows.value.splice(index, 1);
          }
        }

        emit('row-selected', selectedRows.value);
      };

      const startRowSelection = (e: MouseEvent, id: string | number, rowIndex: number) => {
        e.preventDefault();

        const isCtrlPressed = e.ctrlKey || e.metaKey;
        const isShiftPressed = e.shiftKey;

        if (isCtrlPressed) {
          const index = selectedRows.value.indexOf(id);
          if (index === -1) {
            selectedRows.value.push(id);
          } else {
            selectedRows.value.splice(index, 1);
          }
        } else if (isShiftPressed && selectedRows.value.length > 0) {
          const lastSelectedId = selectedRows.value[selectedRows.value.length - 1];
          const lastSelectedIndex = (props.data || []).findIndex(
            (row: TableRow) => row.id === lastSelectedId
          );

          if (lastSelectedIndex !== -1) {
            const start = Math.min(lastSelectedIndex, rowIndex);
            const end = Math.max(lastSelectedIndex, rowIndex);

            selectedRows.value = [];
            for (let i = start; i <= end; i++) {
              const dataArray = props.data || [];
              if (i < dataArray.length) {
                selectedRows.value.push(dataArray[i].id);
              }
            }
          }
        } else {
          selectedRows.value = [id];
          isSelecting.value = true;
          selectionStartRow.value = rowIndex;
          selectionStartId.value = id;
        }

        emit('row-selected', selectedRows.value);
      };

      const handleMouseEnter = (rowIndex: number) => {
        if (isSelecting.value && selectionStartRow.value !== null) {
          const start = Math.min(selectionStartRow.value, rowIndex);
          const end = Math.max(selectionStartRow.value, rowIndex);

          selectedRows.value = [];
          for (let i = start; i <= end; i++) {
            const dataArray = props.data || [];
            if (i < dataArray.length) {
              selectedRows.value.push(dataArray[i].id);
            }
          }

          emit('row-selected', selectedRows.value);
        }
      };

      const stopRowSelection = () => {
        isSelecting.value = false;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
          e.preventDefault();
          selectedRows.value = (props.data || []).map((row: TableRow) => row.id);
          emit('row-selected', selectedRows.value);
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          selectedRows.value = [];
          emit('row-selected', selectedRows.value);
        }
      };

      const isAllSelected = computed(() => {
        const dataLength = (props.data || []).length;
        return dataLength > 0 && selectedRows.value.length === dataLength;
      });

      const hasSelection = computed(() => {
        return selectedRows.value.length > 0;
      });

      const toggleSelectAll = () => {
        if (isAllSelected.value) {
          selectedRows.value = [];
        } else {
          selectedRows.value = (props.data || []).map((row: TableRow) => row.id);
        }

        emit('row-selected', selectedRows.value);
      };

      const handleRowDoubleClick = (row: TableRow) => {
        emit('row-dblclick', row);
      };

      const previewRow = (row: TableRow) => {
        emit('row-preview', row);
      };

      const handleActionOnSelected = () => {
        emit('selected-action', selectedRows.value);
      };

      const handleSort = (field: string) => {
        emit('sort', field);
      };

      watch(
        () => props.data,
        () => {
          nextTick(() => {
            handleWindowResize();
          });
        }
      );

      watch(
        () => props.columns,
        newColumns => {
          columnWidths.value = newColumns.map(col => col.width || props.initialColumnWidth);
        }
      );

      watch(
        () => props.tableStructureData,
        newStructure => {
          if (newStructure && newStructure.length > 0) {
            tableStructure.initializeWithStructure(newStructure);
          }
        }
      );

      return {
        columnWidths,
        selectedRows,
        isSelecting,
        selectionStartRow,
        tableContainerRef,
        isRowSelected,
        toggleRowSelection,
        startRowSelection,
        handleMouseEnter,
        stopRowSelection,
        handleKeyDown,
        isAllSelected,
        hasSelection,
        toggleSelectAll,
        handleRowDoubleClick,
        previewRow,
        handleActionOnSelected,
        handleSort,
        startResize,
        handleWindowResize,
        formatCellValue,
        props,
      };
    },
  });
</script>

<template>
  <div
    v-if="!props.isLoading"
    class="data-table-container flex h-full w-full flex-col overflow-hidden"
    ref="tableContainerRef"
  >
    <div class="relative h-full flex-1 overflow-auto">
      <table
        class="table-pin-rows table-compact table w-full text-sm"
        :class="{ 'table-pin-cols': !props.disableSelection }"
      >
        <thead class="bg-base-100 sticky top-0 z-10 shadow-md">
          <tr>
            <th
              v-if="!props.disableSelection"
              class="bg-base-100 sticky left-0 z-20 w-12 shadow-md"
            >
              <input
                type="checkbox"
                class="checkbox checkbox-xs"
                :checked="isAllSelected"
                :disabled="data.length === 0"
                @change="toggleSelectAll"
              />
            </th>

            <th
              v-for="(column, index) in columns"
              :key="column.field"
              class="group relative overflow-hidden whitespace-nowrap"
              :style="{
                minWidth: `${columnWidths[index]}px`,
                width: `${columnWidths[index]}px`,
                maxWidth: `${columnWidths[index]}px`,
              }"
            >
              <div class="flex h-6 items-center justify-between overflow-hidden">
                <span class="truncate text-xs font-medium">{{ column.field }}</span>
                <button
                  v-if="data.length > 0"
                  :class="{ 'hidden group-hover:block': props.selectedTableSort !== column.field }"
                  class="btn btn-ghost btn-xs flex-shrink-0 p-0.5"
                  @click="handleSort(column.field)"
                >
                  <SortIcon
                    :show-default-sort-icon="props.selectedTableSort !== column.field"
                    :sort-direction="props.sortDirection"
                  />
                </button>
              </div>
              <div
                class="hover:bg-primary group absolute top-0 right-0 bottom-0 w-1 cursor-col-resize bg-transparent"
                @mousedown="startResize($event, index)"
              >
                <div
                  class="group-hover:bg-primary-focus h-full w-1 opacity-0 group-hover:opacity-100"
                ></div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(row, rowIndex) in data"
            :key="rowIndex"
            class="group"
            :class="{
              'bg-opacity-10 bg-accent text-base-100': isRowSelected(row.id),
              'hover:bg-base-200': !isRowSelected(row.id),
            }"
            @mousedown.stop="!props.disableSelection && startRowSelection($event, row.id, rowIndex)"
            @mouseenter.stop="!props.disableSelection && handleMouseEnter(rowIndex)"
            @dblclick.stop="!props.disableSelection && handleRowDoubleClick(row)"
          >
            <td
              v-if="!props.disableSelection"
              class="sticky left-0 z-10 shadow-md"
              :class="{
                'bg-opacity-10 bg-accent text-base-100': isRowSelected(row.id),
                'bg-base-100 group-hover:bg-base-200': !isRowSelected(row.id),
              }"
            >
              <button class="btn btn-xs btn-ghost btn-circle" @click.stop="previewRow(row)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </td>

            <td
              v-for="(column, colIndex) in columns"
              :key="`${colIndex}-${rowIndex}-${column.field}`"
              class="z-10 overflow-hidden p-1 whitespace-nowrap"
              :style="{
                maxWidth: `${columnWidths[colIndex]}px`,
                width: `${columnWidths[colIndex]}px`,
              }"
            >
              <div class="flex w-full items-center justify-between text-xs">
                {{ formatCellValue(column.field, row[column.field]) }}

                <button
                  v-if="
                    row[column.field] !== null && props.foreignKeyColumns.includes(column.field)
                  "
                  @click.stop="$emit('navigateToForeignKey', column.field, row[column.field])"
                  class="shrink-0 cursor-pointer"
                >
                  <svg
                    class="h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
  .data-table-container {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .table-pin-rows thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .table-pin-cols th:first-child,
  .table-pin-cols td:first-child {
    position: sticky;
    left: 0;
    z-index: 1;
  }

  .table-pin-cols th:first-child {
    z-index: 20;
  }

  .data-table-container > div.relative {
    flex: 1;
    min-height: 0;
    overflow: auto;
    contain: strict;
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  tbody {
    height: 100%;
    overflow: hidden;
  }

  td,
  th {
    padding: 0.25rem 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
  }
</style>
