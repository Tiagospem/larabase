<script setup lang="ts">
  import { computed, watch, inject } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { useProjectStore } from '@/store/project';

  const showAlert = inject<(msg: string, type: string) => void>('showAlert')!;

  const projectStore = useProjectStore();

  const comparisonTooltip = computed(() => {
    if (!projectStore.targetDatabase) return 'Error checking project database';
    if (!projectStore.state.projectDatabase) return 'Project database not found';
    return `Project database: ${projectStore.state.projectDatabase}`;
  });

  async function updateProjectEnv() {
    const path = projectStore.selectedProject?.projectPath;
    if (!path || !projectStore.targetDatabase) return;

    try {
      const { success, message } = await window.ipcRenderer.updateEnvDatabase({
        projectPath: path,
        database: projectStore.targetDatabase,
      });

      if (success) {
        projectStore.state.databaseMatch = true;
        projectStore.state.projectDatabase = projectStore.targetDatabase;
        showAlert('Database updated in .env file successfully!', 'success');
      } else {
        showAlert(`Error updating database: ${message}`, 'error');
      }
    } catch (err: any) {
      showAlert(`Error updating database: ${err.message}`, 'error');
    }
  }

  watch(
    () => projectStore.selectedProject,
    proj => {
      if (proj) projectStore.checkProjectDatabase();
    },
    { immediate: true }
  );
</script>

<template>
  <div v-if="projectStore.selectedProject">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">{{ projectStore.selectedProject.name }}</h1>
    </div>

    <div class="mt-1 flex items-center gap-1 text-xs">
      <div>{{ projectStore.targetDatabase }}</div>
      <button
        @click="projectStore.state.showConnectionInfo = true"
        class="text-sm opacity-70 hover:opacity-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-3"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
      </button>
      <div
        v-if="!projectStore.state.databaseMatch && !projectStore.state.isLoading"
        class="flex items-center text-amber-400"
      >
        <div class="tooltip tooltip-bottom" :data-tip="comparisonTooltip">
          <span class="text-error">Mismatch DB </span>
        </div>
        <button
          class="tooltip tooltip-bottom ml-1"
          :data-tip="'Update .env'"
          @click="updateProjectEnv"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-3"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <Modal
    :show="projectStore.state.showConnectionInfo"
    @close="projectStore.state.showConnectionInfo = false"
    width="md"
    z-index="99999"
    title="Connection Details"
    @action="updateProjectEnv"
    :show-action-button="!projectStore.state.databaseMatch"
    action-button-text="Update .env"
  >
    <div class="space-y-2 py-4 text-sm">
      <p><strong>Name:</strong> {{ projectStore.selectedProject?.name }}</p>
      <p><strong>Project Path:</strong> {{ projectStore.selectedProject?.projectPath }}</p>
      <p><strong>Database:</strong> {{ projectStore.targetDatabase }}</p>
      <p>
        <strong>Project Database:</strong> {{ projectStore.state.projectDatabase || 'Not found' }}
      </p>
    </div>
  </Modal>
</template>
