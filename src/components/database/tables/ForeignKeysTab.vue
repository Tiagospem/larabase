<script setup lang="ts">
  import { ref, onMounted, inject, computed } from 'vue';
  import { useDataTableStore } from '@/store/dataTable';
  import { useTabsStore } from '@/store/tabs';
  import { useSidebarStore } from '@/store/sidebar';
  import { Table } from '@/types/table';

  const props = defineProps<{
    tableName: string;
  }>();

  const showAlert = inject<(message: string, type: string) => void>('showAlert')!;
  const dataTableStore = useDataTableStore(props.tableName);
  const tabsStore = useTabsStore();
  const sidebarStore = useSidebarStore();
  const isLoading = ref(true);
  const foreignKeys = ref<any[]>([]);

  const outgoingRelations = computed(() => {
    return foreignKeys.value.filter(fk => fk.type === 'outgoing');
  });

  const incomingRelations = computed(() => {
    return foreignKeys.value.filter(fk => fk.type === 'incoming');
  });

  async function loadForeignKeys() {
    try {
      isLoading.value = true;
      foreignKeys.value = await dataTableStore.getTableForeignKeys(props.tableName);
    } catch (error: any) {
      showAlert(`Failed to load foreign keys: ${error.message || error}`, 'error');
    } finally {
      isLoading.value = false;
    }
  }

  async function navigateToTable(tableName: string) {
    const table = sidebarStore.localTables.find((t: Table) => t.name === tableName);
    if (table) {
      await tabsStore.openTable(table);
    } else {
      showAlert(`Table '${tableName}' not found`, 'error');
    }
  }

  onMounted(() => {
    loadForeignKeys();
  });
</script>

<template>
  <div class="flex h-full flex-col overflow-auto">
    <div class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2">
      <button class="btn btn-sm btn-ghost" @click="loadForeignKeys">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-4 w-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        <span>Refresh</span>
      </button>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex h-full w-full items-center justify-center">
        <div class="loading loading-spinner loading-lg text-primary"></div>
      </div>

      <div
        v-else-if="foreignKeys.length === 0"
        class="flex h-full w-full items-center justify-center"
      >
        <div class="text-center">
          <h3 class="text-lg font-medium">No Foreign Keys</h3>
          <p class="text-base-content/70 mt-2">This table has no foreign key relationships.</p>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <div v-if="outgoingRelations.length > 0">
          <h4 class="bg-base-100 px-2 py-1 font-medium">This Table → Other Tables</h4>
          <table class="table-compact table w-full text-sm">
            <thead class="bg-base-100 sticky top-0 z-10 shadow-md">
              <tr>
                <th>Constraint Name</th>
                <th>Column</th>
                <th>Referenced Table</th>
                <th>Referenced Column</th>
                <th>On Update</th>
                <th>On Delete</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="fk in outgoingRelations"
                :key="fk.name"
                class="hover:bg-base-200 bg-base-100 border-b border-black/10"
              >
                <td>{{ fk.name }}</td>
                <td>{{ fk.column }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    {{ fk.referenced_table }}
                    <button
                      @click="navigateToTable(fk.referenced_table)"
                      class="btn btn-ghost btn-xs"
                      title="Open table"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-3 w-3"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
                <td>{{ fk.referenced_column }}</td>
                <td>
                  <span class="badge badge-ghost badge-xs">{{ fk.on_update }}</span>
                </td>
                <td>
                  <span class="badge badge-ghost badge-xs">{{ fk.on_delete }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="incomingRelations.length > 0" class="mt-4">
          <h4 class="text-md bg-base-100 px-2 py-1 font-medium">Other Tables → This Table</h4>
          <table class="table-compact table w-full text-sm">
            <thead class="bg-base-100 sticky top-0 z-10 shadow-md">
              <tr>
                <th>Constraint Name</th>
                <th>Table</th>
                <th>Column</th>
                <th>Referenced Column</th>
                <th>On Update</th>
                <th>On Delete</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="fk in incomingRelations"
                :key="fk.name"
                class="hover:bg-base-200 bg-base-100 border-b border-black/10"
              >
                <td>{{ fk.name }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    {{ fk.table }}
                    <button
                      @click="navigateToTable(fk.table)"
                      class="btn btn-ghost btn-xs"
                      title="Open table"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-3 w-3"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
                <td>{{ fk.column }}</td>
                <td>{{ fk.referenced_column }}</td>
                <td>
                  <span class="badge badge-ghost badge-xs">{{ fk.on_update }}</span>
                </td>
                <td>
                  <span class="badge badge-ghost badge-xs">{{ fk.on_delete }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="foreignKeys.length > 0" class="bg-base-300 border-base-300 border-t p-2 text-xs">
      <span>{{ props.tableName }} | {{ foreignKeys.length }} relationships</span>
    </div>
  </div>
</template>

<style scoped>
  th,
  td {
    white-space: nowrap;
    padding: 0.25rem 0.5rem;
    box-sizing: border-box;
  }

  .table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
  }

  .overflow-x-auto {
    width: 100%;
    overflow-x: auto;
  }

  .flex-1.overflow-auto {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .table thead th {
    position: sticky;
    top: 0;
    z-index: 10;
    font-weight: normal;
  }

  .flex.h-full.flex-col.overflow-auto {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .table-compact thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  tbody {
    height: 100%;
    overflow: hidden;
  }
</style>
