<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { SqlScratchService } from '@/services/sqlScratchService';
  import type { SqlScratch } from '@/store/sqlScratches';

  declare global {
    interface Window {
      sqlEditorContent?: {
        value: string;
      };
    }
  }

  const props = defineProps<{
    projectId: string;
  }>();

  const scratchService = SqlScratchService.getInstance();
  const newScratchName = ref('');
  const editingScratchId = ref<string | null>(null);
  const editingScratchName = ref('');
  const searchQuery = ref('');

  const filteredScratches = computed(() => {
    if (!searchQuery.value.trim()) {
      return scratchService.scratches;
    }

    const query = searchQuery.value.toLowerCase();
    return scratchService.scratches.filter(scratch => scratch.name.toLowerCase().includes(query));
  });

  const activeScratch = computed(() => {
    return scratchService.getActiveScratch();
  });

  function loadScratch(scratchId: string) {
    const scratch = scratchService.getScratchById(scratchId);
    if (scratch) {
      if (window.sqlEditorContent) {
        window.sqlEditorContent.value = scratch.content;
      } else {
        localStorage.setItem(`sql-editor-content-${props.projectId}`, scratch.content);
      }

      scratchService.setActiveScratch(scratchId);
    }
  }

  function createNewScratch() {
    if (newScratchName.value.trim()) {
      let editorContent = '';
      if (window.sqlEditorContent) {
        editorContent = window.sqlEditorContent.value;
      } else {
        editorContent = localStorage.getItem(`sql-editor-content-${props.projectId}`) || '';
      }

      scratchService.saveScratch({
        content: editorContent,
        projectId: props.projectId,
        name: newScratchName.value.trim(),
      });

      newScratchName.value = '';
    } else {
      let editorContent = '';
      if (window.sqlEditorContent) {
        editorContent = window.sqlEditorContent.value;
      } else {
        editorContent = localStorage.getItem(`sql-editor-content-${props.projectId}`) || '';
      }

      scratchService.saveScratch({
        content: editorContent,
        projectId: props.projectId,
      });
    }
  }

  function startEditScratch(scratch: SqlScratch) {
    if (scratch.isDefault) return;

    editingScratchId.value = scratch.id;
    editingScratchName.value = scratch.name;
  }

  function saveEditScratch() {
    if (editingScratchId.value && editingScratchName.value.trim()) {
      scratchService.updateScratch(
        editingScratchId.value,
        { name: editingScratchName.value.trim() },
        props.projectId
      );
      cancelEditScratch();
    }
  }

  function cancelEditScratch() {
    editingScratchId.value = null;
    editingScratchName.value = '';
  }

  function deleteScratch(scratchId: string) {
    const scratch = scratchService.getScratchById(scratchId);
    if (scratch?.isDefault) return;

    scratchService.deleteScratch(scratchId, props.projectId);
  }

  onMounted(() => {
    scratchService.loadScratches(props.projectId);
  });

  watch(
    () => scratchService.isOpen,
    isOpen => {
      if (isOpen) {
        cancelEditScratch();
      }
    }
  );
</script>

<template>
  <div
    class="bg-base-200 border-base-300 flex h-full w-[400px] flex-col overflow-hidden border-l shadow-lg"
  >
    <div class="border-base-300 flex items-center justify-between border-b p-4">
      <h3 class="text-xl font-bold">SQL Scratches</h3>
      <button
        @click="scratchService.toggleSidePanel()"
        class="btn btn-ghost btn-sm hover:bg-base-300 p-1"
        title="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
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
    </div>

    <div class="border-base-300 border-b p-4">
      <div class="mb-4">
        <label class="text-base-content/70 mb-1 block text-xs font-medium"
          >Create New Scratch</label
        >
        <div class="flex gap-2">
          <input
            v-model="newScratchName"
            type="text"
            placeholder="New scratch name"
            class="input input-bordered input-sm flex-1"
            @keyup.enter="createNewScratch"
          />
          <button
            @click="createNewScratch"
            class="btn btn-sm btn-primary"
            title="Create New Scratch"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label class="text-base-content/70 mb-1 block text-xs font-medium">Search</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search scratches..."
          class="input input-bordered input-sm w-full"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto p-2">
      <div v-if="filteredScratches.length === 0" class="mt-4 text-center text-sm opacity-70">
        <p>No scratches found</p>
      </div>

      <div class="mt-2 space-y-2">
        <div
          v-for="scratch in filteredScratches"
          :key="scratch.id"
          class="bg-base-100 hover:bg-base-300 border-base-300 rounded-md border transition-colors"
          :class="{
            'border-primary border-2': scratch.id === activeScratch?.id,
            'opacity-70': scratch.isDefault,
          }"
        >
          <div v-if="editingScratchId === scratch.id" class="flex flex-col gap-2 p-3">
            <input
              v-model="editingScratchName"
              class="input input-bordered input-sm w-full"
              @keyup.enter="saveEditScratch"
            />
            <div class="flex justify-end gap-1">
              <button @click="cancelEditScratch" class="btn btn-ghost btn-xs">Cancel</button>
              <button @click="saveEditScratch" class="btn btn-primary btn-xs">Save</button>
            </div>
          </div>

          <div v-else class="p-3">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <button
                  @click="loadScratch(scratch.id)"
                  class="hover:text-primary flex cursor-pointer items-center text-left font-medium"
                >
                  <span
                    v-if="scratch.id === activeScratch?.id"
                    class="bg-primary mr-2 h-2 w-2 rounded-full"
                  ></span>
                  <span>{{ scratch.name }}</span>
                  <span v-if="scratch.isDefault" class="badge badge-sm badge-outline ml-2">
                    Default
                  </span>
                </button>
                <div class="mt-1 text-xs opacity-50">
                  Updated: {{ new Date(scratch.updatedAt).toLocaleString() }}
                </div>
              </div>

              <div class="ml-2 flex gap-1" v-if="!scratch.isDefault">
                <button
                  @click="startEditScratch(scratch)"
                  class="text-base-content/70 hover:text-primary p-1"
                  title="Rename"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  @click="deleteScratch(scratch.id)"
                  class="text-base-content/70 hover:text-error p-1"
                  title="Delete"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
