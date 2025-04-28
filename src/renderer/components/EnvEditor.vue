<template>
  <Modal
    :show="isOpen"
    title=".env Editor"
    width="max-w-5xl"
    :show-footer="false"
    @close="handleClose"
  >
    <div class="flex items-center gap-2 mb-4">
      <div class="flex-1 text-sm opacity-75">
        <span
          v-if="fileStatus"
          :class="fileStatus.class"
          >{{ fileStatus.text }}</span
        >
        <span v-else-if="connection?.projectPath">{{ connection.projectPath }}</span>
      </div>

      <button
        class="btn btn-sm btn-primary"
        :disabled="isLoading || !envContent || !hasChanges"
        @click="saveEnvFile"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-4 h-4 mr-1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"
          />
        </svg>
        Save
      </button>
    </div>

    <div
      v-if="!projectPath"
      class="flex items-center justify-center h-64"
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
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v .776"
          />
        </svg>
        <p>No Laravel project path selected</p>
        <button
          class="btn btn-sm btn-primary mt-4"
          @click="selectProjectPath"
        >
          Select Project
        </button>
      </div>
    </div>

    <div
      v-else-if="isLoading"
      class="flex items-center justify-center h-64"
    >
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div
      v-else-if="!envContent && !isLoading"
      class="flex items-center justify-center h-64"
    >
      <div class="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto mb-4 text-warning"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p>Could not load .env file</p>
        <button
          class="btn btn-sm mt-4"
          @click="loadEnvFile"
        >
          Retry
        </button>
      </div>
    </div>

    <div
      v-else
      class="h-[60vh]"
    >
      <EnvCodeEditor v-model="envContent" />
    </div>
  </Modal>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useConnectionsStore } from "@/store/connections";
import EnvCodeEditor from "./EnvCodeEditor.vue";
import Modal from "./Modal.vue";

export default {
  name: "EnvEditor",
  components: {
    EnvCodeEditor,
    Modal
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    connectionId: {
      type: String,
      required: true
    }
  },
  emits: ["close"],
  setup(props, { emit }) {
    const connectionsStore = useConnectionsStore();
    const connection = computed(() => {
      return connectionsStore.getConnection(props.connectionId);
    });

    const projectPath = computed(() => connection.value?.projectPath || null);
    const envContent = ref("");
    const originalContent = ref("");
    const isLoading = ref(false);
    const fileStatus = ref(null);
    let isSaving = false;

    const hasChanges = computed(() => {
      return envContent.value !== originalContent.value;
    });

    function handleClose() {
      emit("close");
    }

    watch(
      () => props.isOpen,
      (newValue) => {
        if (newValue && projectPath.value) {
          loadEnvFile();
        }
      }
    );

    watch(
      () => projectPath.value,
      (newValue) => {
        if (newValue && props.isOpen) {
          loadEnvFile();
        }
      }
    );

    async function loadEnvFile() {
      if (!projectPath.value) return;

      isLoading.value = true;
      fileStatus.value = null;

      try {
        const result = await window.api.readEnvFileRaw(projectPath.value);

        if (result.success) {
          envContent.value = result.content;
          originalContent.value = result.content;
          fileStatus.value = { text: "File loaded successfully", class: "text-success" };
        } else {
          envContent.value = "";
          originalContent.value = "";
          fileStatus.value = { text: `Error: ${result.message}`, class: "text-error" };
        }
      } catch (error) {
        console.error("Error loading .env file:", error);
        fileStatus.value = { text: `Error: ${error.message}`, class: "text-error" };
        envContent.value = "";
        originalContent.value = "";
      } finally {
        isLoading.value = false;
      }
    }

    async function saveEnvFile() {
      if (!projectPath.value || !envContent.value || !hasChanges.value || isSaving) return;

      isSaving = true;
      fileStatus.value = { text: "Saving...", class: "text-base-content" };

      try {
        const result = await window.api.saveEnvFile(projectPath.value, envContent.value);

        if (result.success) {
          originalContent.value = envContent.value;
          fileStatus.value = { text: "File saved successfully", class: "text-success" };

          setTimeout(() => {
            if (fileStatus.value && fileStatus.value.text === "File saved successfully") {
              fileStatus.value = null;
            }
          }, 3000);
        } else {
          fileStatus.value = { text: `Error saving: ${result.message}`, class: "text-error" };
        }
      } catch (error) {
        console.error("Error saving .env file:", error);
        fileStatus.value = { text: `Error saving: ${error.message}`, class: "text-error" };
      } finally {
        isSaving = false;
      }
    }

    async function selectProjectPath() {
      try {
        const result = await window.api.selectDirectory();

        if (result.canceled) {
          return;
        }

        const selectedPath = result.filePaths[0];
        const isLaravel = await window.api.validateLaravelProject(selectedPath);

        if (!isLaravel) {
          fileStatus.value = { text: "Selected directory is not a valid Laravel project", class: "text-error" };
          return;
        }

        await connectionsStore.updateConnection(props.connectionId, {
          projectPath: selectedPath
        });

        fileStatus.value = { text: "Laravel project path set successfully", class: "text-success" };
        await loadEnvFile();
      } catch (error) {
        console.error("Error selecting project path:", error);
        fileStatus.value = { text: `Failed to select project path: ${error.message}`, class: "text-error" };
      }
    }

    onMounted(() => {
      if (props.isOpen && projectPath.value) {
        loadEnvFile();
      }
    });

    return {
      connection,
      envContent,
      fileStatus,
      hasChanges,
      isLoading,
      projectPath,
      handleClose,
      loadEnvFile,
      saveEnvFile,
      selectProjectPath
    };
  }
};
</script>
