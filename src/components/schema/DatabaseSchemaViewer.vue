<script setup lang="ts">
  import { ref, computed } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { DatabaseSchema, TableSchema, TableColumn } from '@/services/databaseSchema';

  const props = defineProps({
    show: {
      type: Boolean,
      default: false,
    },
    schemaData: {
      type: Object as () => DatabaseSchema,
      required: true,
    },
  });

  const emit = defineEmits(['close']);

  const activeTab = ref('tables');
  const searchQuery = ref('');
  const expandedTables = ref<string[]>([]);

  const filteredTables = computed(() => {
    if (!props.schemaData?.tables || !Array.isArray(props.schemaData.tables)) {
      console.warn('No tables found in schema data or tables is not an array');
      return [];
    }

    if (!searchQuery.value) {
      return props.schemaData.tables;
    }

    const query = searchQuery.value.toLowerCase();
    return props.schemaData.tables.filter(
      (table: TableSchema) =>
        table.name.toLowerCase().includes(query) ||
        (table.model && table.model.name.toLowerCase().includes(query))
    );
  });

  function toggleExpandTable(tableName: string) {
    if (expandedTables.value.includes(tableName)) {
      expandedTables.value = expandedTables.value.filter(name => name !== tableName);
    } else {
      expandedTables.value.push(tableName);
    }
  }

  function expandAllTables() {
    if (props.schemaData?.tables) {
      expandedTables.value = props.schemaData.tables.map((table: TableSchema) => table.name);
    }
  }

  function collapseAllTables() {
    expandedTables.value = [];
  }

  function copySchemaToClipboard() {
    const schemaString = JSON.stringify(props.schemaData, null, 2);
    navigator.clipboard.writeText(schemaString);
    alert('Schema copied to clipboard');
  }

  function formatDataType(type: string) {
    if (!type) return '';

    const match = type.match(/([a-z]+)(?:\(([^)]+)\))?/i);
    if (!match) return type;

    const baseType = match[1];
    const params = match[2] || '';

    return `${baseType}${params ? `(${params})` : ''}`;
  }

  function getColumnClass(column: TableColumn) {
    const classes = ['text-sm'];

    if (column.primary_key) {
      classes.push('font-bold text-primary');
    } else if (column.foreign_key) {
      classes.push('text-info');
    }

    return classes.join(' ');
  }

  function getTypeClass(type: string) {
    if (!type) return '';

    if (type.includes('int')) {
      return 'text-info';
    } else if (type.includes('varchar') || type.includes('text') || type.includes('char')) {
      return 'text-success';
    } else if (type.includes('date') || type.includes('time')) {
      return 'text-warning';
    } else if (type.includes('json')) {
      return 'text-secondary';
    } else if (type.includes('bool')) {
      return 'text-accent';
    }

    return '';
  }
</script>

<template>
  <Modal
    :show="show"
    title="Database Schema"
    width="max-w-5xl"
    :show-footer="false"
    :z-index="50"
    @close="emit('close')"
  >
    <div class="mb-4 flex items-center justify-between">
      <div class="join">
        <button
          class="join-item btn btn-sm"
          :class="{ 'btn-active': activeTab === 'tables' }"
          @click="activeTab = 'tables'"
        >
          Tables
        </button>
        <button
          class="join-item btn btn-sm"
          :class="{ 'btn-active': activeTab === 'json' }"
          @click="activeTab = 'json'"
        >
          JSON
        </button>
      </div>

      <div class="flex gap-2">
        <input
          v-if="activeTab === 'tables'"
          v-model="searchQuery"
          type="text"
          placeholder="Search tables..."
          class="input input-sm input-bordered w-64"
        />
        <div class="join" v-if="activeTab === 'tables'">
          <button class="join-item btn btn-sm" @click="expandAllTables">Expand All</button>
          <button class="join-item btn btn-sm" @click="collapseAllTables">Collapse All</button>
        </div>
        <button v-if="activeTab === 'json'" class="btn btn-sm" @click="copySchemaToClipboard">
          Copy JSON
        </button>
      </div>
    </div>

    <div class="max-h-[70vh] overflow-auto">
      <div v-if="activeTab === 'tables'" class="space-y-4">
        <div v-if="filteredTables.length === 0" class="p-4 text-center">No tables found</div>

        <div
          v-for="table in filteredTables"
          :key="table.name"
          class="bg-base-200 border-base-300 overflow-hidden rounded-lg border shadow-sm"
        >
          <div
            class="flex cursor-pointer items-center justify-between p-3"
            @click="toggleExpandTable(table.name)"
          >
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-90': expandedTables.includes(table.name) }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span class="font-bold">{{ table.name }}</span>
              <span v-if="table.model" class="badge badge-primary ml-2" title="Model">
                {{ table.model.name }}
              </span>
            </div>
            <div class="text-sm opacity-60">
              {{ table.columns ? table.columns.length : 0 }} columns
            </div>
          </div>

          <div v-if="expandedTables.includes(table.name)" class="border-base-300 border-t">
            <div class="overflow-x-auto">
              <table class="table-sm table-zebra table w-full text-xs">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Nullable</th>
                    <th>Default</th>
                    <th>Extra</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="column in table.columns" :key="column.name">
                    <td :class="getColumnClass(column)">
                      {{ column.name }}
                      <span v-if="column.primary_key" class="badge badge-xs badge-primary ml-1"
                        >PK</span
                      >
                      <span v-else-if="column.foreign_key" class="badge badge-xs badge-info ml-1"
                        >FK</span
                      >
                    </td>
                    <td :class="getTypeClass(column.type)">{{ formatDataType(column.type) }}</td>
                    <td>{{ column.nullable ? 'Yes' : 'No' }}</td>
                    <td>{{ column.default !== null ? column.default : '' }}</td>
                    <td>{{ column.extra }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="table.foreignKeys && table.foreignKeys.length > 0"
              class="border-base-300 border-t p-3"
            >
              <div class="mb-1 text-sm font-semibold">Foreign Keys</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(fk, idx) in table.foreignKeys"
                  :key="idx"
                  class="bg-base-100 flex items-center gap-1 rounded p-2 text-xs"
                >
                  <span v-if="fk.type === 'outgoing'">
                    {{ fk.column }} → {{ fk.referenced_table }}.{{ fk.referenced_column }}
                  </span>
                  <span v-else> {{ fk.table }}.{{ fk.column }} → {{ fk.referenced_column }} </span>
                </div>
              </div>
            </div>

            <div
              v-if="table.indexes && table.indexes.length > 0"
              class="border-base-300 border-t p-3"
            >
              <div class="mb-1 text-sm font-semibold">Indexes</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="idx in table.indexes"
                  :key="idx.name"
                  class="bg-base-100 rounded p-2 text-xs"
                  :class="{
                    'border-primary border': idx.type === 'PRIMARY',
                    'border-success border': idx.type === 'UNIQUE',
                  }"
                >
                  <span class="font-semibold">{{ idx.name }}</span>
                  <span
                    class="badge badge-xs ml-1"
                    :class="{
                      'badge-primary': idx.type === 'PRIMARY',
                      'badge-success': idx.type === 'UNIQUE',
                      'badge-info': idx.type === 'INDEX',
                    }"
                  >
                    {{ idx.type }}
                  </span>
                  <div class="mt-1">Columns: {{ idx.columns.join(', ') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'json'" class="bg-base-200 rounded-lg p-4">
        <pre class="max-h-[65vh] overflow-auto text-xs">{{
          JSON.stringify(props.schemaData, null, 2)
        }}</pre>
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="emit('close')">Close</button>
    </template>
  </Modal>
</template>
