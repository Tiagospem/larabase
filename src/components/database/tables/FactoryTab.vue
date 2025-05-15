<script setup lang="ts">
  import { onMounted, inject, ref, computed } from 'vue';
  import { useFactoryStore } from '@/store/factory';
  import { useConnectionsStore } from '@/store/connections';
  import PhpViewer from '@/components/PhpViewer.vue';
  import Modal from '@/components/Modal.vue';
  import terminalService from '@/services/terminal';

  const props = defineProps<{ tableName: string }>();
  const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

  const factoryStore = useFactoryStore(props.tableName);
  const connectionStore = useConnectionsStore();

  const showCodeModal = ref(false);
  const isExecutingCommand = ref(false);

  const project = computed(() => connectionStore.getSelectedProject);

  function formatFactoryValue(value: string) {
    if (value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }

  function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedSetRecordCount = debounce((value: string) => {
    const count = parseInt(value, 10);
    if (!isNaN(count)) {
      factoryStore.setRecordCount(count);
    }
  }, 300);

  const debouncedSetAttributeValue = debounce((attrName: string, value: string) => {
    factoryStore.setAttributeCustomValue(attrName, value);
  }, 300);

  async function loadFactory() {
    try {
      await factoryStore.loadFactory();
    } catch (error: any) {
      showAlert(`Failed to load factory: ${error.message}`, 'error');
    }
  }

  function openFactoryInEditor() {
    if (!factoryStore.factory?.path) return;
    window.ipcRenderer.openFile(factoryStore.factory.path);
  }

  function viewFactoryCode() {
    showCodeModal.value = true;
  }

  async function executeSeedCommand() {
    if (!factoryStore.generateSeedCommand) {
      showAlert('Unable to generate seed command', 'error');
      return;
    }

    try {
      isExecutingCommand.value = true;
      factoryStore.closeSeedModal();

      const command = factoryStore.generateSeedCommand;
      const success = await terminalService.executeCommand(command, project.value?.projectPath);

      if (!success) {
        showAlert('Failed to seed data, check terminal for details', 'error');
      }
    } catch (error: any) {
      showAlert(`Error executing command: ${error.message}`, 'error');
    } finally {
      isExecutingCommand.value = false;
    }
  }

  onMounted(() => {
    loadFactory();
  });
</script>

<template>
  <div class="flex h-full flex-col overflow-auto">
    <div class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadFactory">
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

        <div v-if="factoryStore.factory" class="flex space-x-2">
          <button
            class="btn btn-sm btn-primary"
            @click="factoryStore.openSeedModal"
            title="Seed data using this factory"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3" />
            </svg>
            <span>Seed Data</span>
          </button>

          <button
            v-if="factoryStore.factory.path"
            class="btn btn-sm btn-ghost"
            @click="openFactoryInEditor"
            title="Open in editor"
          >
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
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
            <span>Open in Editor</span>
          </button>

          <button class="btn btn-sm btn-ghost" @click="viewFactoryCode" title="View Code">
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
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
            <span>View Code</span>
          </button>
        </div>
      </div>

      <div v-if="factoryStore.factory" class="text-xs font-medium">
        <span>{{ factoryStore.factory.name }}</span>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="factoryStore.isLoading" class="flex h-full w-full items-center justify-center">
        <div class="loading loading-spinner loading-lg text-primary"></div>
      </div>

      <div v-else-if="factoryStore.error" class="flex h-full w-full items-center justify-center">
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="mx-auto mb-4 h-12 w-12"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p class="text-sm">{{ factoryStore.error }}</p>
          <p class="text-base-content mt-2 text-xs">
            Factory files are typically located in database/factories directory
          </p>
          <button class="btn btn-sm mt-4" @click="loadFactory">Reload</button>
        </div>
      </div>

      <div
        v-else-if="factoryStore.factory && factoryStore.factory.attributes?.length > 0"
        class="overflow-x-auto"
      >
        <table class="table-pin-rows table-compact table w-full text-sm">
          <thead class="bg-base-100 sticky top-0 z-10 shadow-md">
            <tr>
              <th>Attribute</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="attr in factoryStore.factory.attributes"
              :key="attr.name"
              class="hover:bg-base-200"
            >
              <td class="font-mono text-xs">{{ attr.name }}</td>
              <td class="font-mono text-xs">{{ formatFactoryValue(attr.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="factoryStore.factory" class="flex h-full w-full items-center justify-center">
        <div class="text-center">
          <p class="text-sm">
            No factory attributes were detected for {{ factoryStore.modelName }}
          </p>
          <p class="text-base-content mt-2 text-xs">
            The factory might be using a non-standard format
          </p>
          <div class="mt-4 flex justify-center space-x-2">
            <button class="btn btn-sm" @click="viewFactoryCode">View Code</button>
            <button class="btn btn-sm" @click="openFactoryInEditor">Open in Editor</button>
          </div>
        </div>
      </div>

      <div v-else class="flex h-full w-full items-center justify-center">
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="mx-auto mb-4 h-12 w-12"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p class="text-sm">No Laravel factory found for {{ props.tableName }} table</p>
          <p class="text-base-content mt-2 text-xs">
            Factory files are typically named ModelNameFactory.php
          </p>
          <button
            v-if="connectionStore.getSelectedProject?.projectPath"
            class="btn btn-sm mt-4"
            @click="loadFactory"
          >
            Reload
          </button>
        </div>
      </div>
    </div>

    <div v-if="factoryStore.factory" class="bg-base-300 border-base-300 border-t p-2 text-xs">
      <span
        >{{ props.tableName }} | {{ factoryStore.factory.attributes?.length || 0 }} factory
        attributes</span
      >
    </div>

    <Modal
      v-if="factoryStore.factory?.content"
      :show="showCodeModal"
      :title="`Factory Code: ${factoryStore.factory.name}`"
      width="max-w-5xl"
      @close="showCodeModal = false"
    >
      <PhpViewer :code="factoryStore.factory.content" language="php" height="500px" />
    </Modal>

    <Modal
      v-if="factoryStore.factory"
      :show="factoryStore.showSeedModal"
      title="Seed Data with Factory"
      @close="factoryStore.closeSeedModal"
      :showActionButton="true"
      actionButtonText="Execute"
      @action="executeSeedCommand"
      :isLoadingAction="isExecutingCommand"
    >
      <div class="space-y-4">
        <div>
          <fieldset class="fieldset">
            <div class="label">
              <span class="label-text">Number of records to create</span>
            </div>
            <input
              type="number"
              :value="factoryStore.recordCount"
              @input="e => debouncedSetRecordCount((e.target as HTMLInputElement).value)"
              min="1"
              max="100"
              class="input input-bordered w-full"
            />
          </fieldset>
        </div>

        <div v-if="factoryStore.factory.attributes?.length > 0">
          <fieldset class="fieldset">
            <div class="label">
              <span class="label-text">Override attributes (optional)</span>
            </div>
            <div class="max-h-60 overflow-y-auto">
              <table class="table-compact table w-full table-fixed">
                <colgroup>
                  <col class="w-14" />
                  <col class="w-1/4" />
                  <col class="w-1/3" />
                  <col />
                </colgroup>
                <thead class="bg-base-200 sticky top-0 z-10 shadow-md">
                  <tr>
                    <th class="text-center">Use</th>
                    <th>Attribute</th>
                    <th>Factory Value</th>
                    <th>Override Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="attr in factoryStore.factory.attributes"
                    :key="attr.name"
                    class="hover:bg-base-100"
                    style="height: 40px"
                  >
                    <td class="text-center align-middle">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        :checked="attr.selected"
                        @change="() => factoryStore.toggleAttributeSelection(attr.name)"
                      />
                    </td>
                    <td class="align-middle font-mono text-xs">{{ attr.name }}</td>
                    <td class="truncate align-middle font-mono text-xs" :title="attr.value">
                      {{ formatFactoryValue(attr.value) }}
                    </td>
                    <td class="relative align-middle" style="min-height: 40px">
                      <div v-if="!attr.selected" style="height: 32px"></div>
                      <input
                        v-else
                        type="text"
                        class="input input-bordered input-sm w-full"
                        :placeholder="attr.value"
                        :value="attr.customValue"
                        @input="
                          e =>
                            debouncedSetAttributeValue(
                              attr.name,
                              (e.target as HTMLInputElement).value
                            )
                        "
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </fieldset>
        </div>

        <div class="bg-base-300 rounded-lg p-3">
          <fieldset class="fieldset">
            <div class="label">
              <span class="label-text">Command to execute</span>
            </div>
            <pre class="bg-base-100 overflow-x-auto rounded-lg p-2 font-mono text-xs">{{
              factoryStore.generateSeedCommand
            }}</pre>
          </fieldset>
        </div>
      </div>
    </Modal>
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

  .table-pin-rows thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  tbody {
    height: 100%;
    overflow: hidden;
  }

  .input[type='number']::-webkit-inner-spin-button,
  .input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .modal td {
    vertical-align: middle;
    height: 40px !important;
  }

  .input-sm {
    height: 32px !important;
    min-height: 32px !important;
  }

  .modal td.align-middle {
    position: relative;
  }

  .modal .overflow-y-auto {
    contain: content;
  }
</style>
