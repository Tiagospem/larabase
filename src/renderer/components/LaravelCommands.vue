<template>
  <Modal
    :show="true"
    title="Laravel Commands"
    @close="close"
  >
    <div class="space-y-4 flex-1 flex flex-col">
      <div class="flex gap-2 items-center">
        <fieldset class="fieldset flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search commands..."
              class="input input-sm w-full pr-10 focus:outline-hidden"
            />
          </div>
        </fieldset>
        <button
          class="btn btn-sm btn-primary"
          :disabled="isLoading"
          @click="loadCommands"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 mr-1"
            :class="{ 'animate-spin': isLoading }"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div class="flex-1 flex flex-col">
        <div class="text-sm font-medium mb-2">Available Commands</div>

        <div
          v-if="isLoading"
          class="flex justify-center py-4 items-center flex-1"
        >
          <span class="loading loading-spinner loading-md" />
        </div>

        <div
          v-else-if="filteredCommands.length === 0"
          class="text-center py-6 flex-1 flex flex-col justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-10 h-10 mx-auto mb-2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <p v-if="searchQuery">No commands match your search: "{{ searchQuery }}"</p>
          <p v-else>No Laravel commands found</p>
          <button
            v-if="!projectPath"
            class="btn btn-sm btn-primary mt-4 mx-auto"
            @click="selectProjectPath"
          >
            Select Laravel Project
          </button>
        </div>

        <div
          v-else
          class="bg-base-100 rounded-md flex-1 mb-2"
        >
          <ul>
            <li
              v-for="command in filteredCommands"
              :key="command.name"
              class="border-b border-base-200 last:border-0"
            >
              <div class="p-3 hover:bg-base-200">
                <div class="flex gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-col gap-1 mb-1">
                      <div class="text-primary font-semibold text-sm truncate">
                        {{ command.name }}
                      </div>
                      <div class="text-xs rounded-sm whitespace-nowrap">
                        {{ getFilename(command.relativePath) || "Built-in" }}
                      </div>
                    </div>

                    <div class="font-mono text-xs my-1 truncate">
                      {{ command.signature }}
                    </div>

                    <div
                      v-if="command.description"
                      class="text-xs text-base-content mt-1"
                    >
                      {{ command.description }}
                    </div>
                  </div>

                  <div class="flex gap-1 shrink-0">
                    <button
                      v-if="command.path"
                      class="btn btn-xs btn-ghost"
                      title="Open in editor"
                      @click.stop="openFileInEditor(command.path)"
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
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </button>

                    <button
                      class="btn btn-xs btn-ghost"
                      title="View command details"
                      @click="previewCommand(command)"
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

                    <div class="dropdown dropdown-end">
                      <button
                        tabindex="0"
                        class="btn btn-xs btn-primary"
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
                            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                          />
                        </svg>
                      </button>
                      <ul
                        tabindex="0"
                        class="dropdown-content z-[100] menu shadow-sm bg-base-300 rounded-box w-48 mt-1"
                      >
                        <li>
                          <button
                            @click="!isLoading && executeCommand(command)"
                            :disabled="isLoading"
                            class="text-sm"
                          >
                            Run Now
                          </button>
                        </li>
                        <li>
                          <button
                            @click="!isLoading && showRunWithFlagsModal(command)"
                            :disabled="isLoading"
                            class="text-sm"
                          >
                            Run with Flags
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div
          v-if="!isLoading && filteredCommands.length > 0"
          class="text-xs text-base-content"
        >
          Showing {{ filteredCommands.length }} of {{ commands.length }} commands
        </div>
      </div>

      <div
        v-if="projectPath"
        class="text-xs text-base-content"
      >
        <span>Project: {{ projectPath }}</span>
      </div>
      <div
        v-else
        class="text-xs text-error"
      >
        <span>No Laravel project path configured. Please set a project path in the connection settings.</span>
      </div>
    </div>
  </Modal>

  <Modal
    :show="showCommandPreview"
    :title="currentCommand?.name"
    @close="showCommandPreview = false"
  >
    <div class="max-h-[400px] overflow-auto">
      <PhpViewer
        :code="commandFileContent"
        language="php"
        height="100%"
      />
    </div>
  </Modal>

  <Modal
    :show="showFlagsModal"
    title="Run Command with Flags"
    @close="showFlagsModal = false"
    @action="runWithFlags"
    actionButtonText="Execute"
    :showActionButton="true"
    width="max-w-lg"
  >
    <div class="mb-4">
      <div class="font-medium text-primary mb-2">Command:</div>
      <div class="bg-base-100 p-3 rounded-md font-mono text-sm mb-4">
        {{ currentCommand?.signature }}
      </div>

      <fieldset class="fieldset w-full">
        <label class="label">
          <span class="label-text">Flags</span>
        </label>
        <input
          v-model="commandFlags"
          type="text"
          placeholder="--flag=value --option"
          class="input input-bordered w-full font-mono"
        />
        <label class="label">
          <span class="label-text-alt text-base-content">Add any additional flags for this command</span>
        </label>
      </fieldset>
    </div>
  </Modal>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted } from "vue";
import { useCommandsStore } from "@/store/commands";
import PhpViewer from "@/components/PhpViewer.vue";
import Modal from "@/components/Modal.vue";

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  projectPath: {
    type: String,
    default: ""
  },
  connection: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["close", "update-project-path"]);

const showAlert = inject("showAlert");
const commandsStore = useCommandsStore();

const commands = ref([]);
const isLoading = ref(false);
const searchQuery = ref("");
const hasSail = ref(false);
const useSail = computed(() => props.connection?.usingSail || false);
const showCommandPreview = ref(false);
const currentCommand = ref(null);
const commandInput = ref("");
const commandFileContent = ref("");
const commandFlags = ref("");
const showFlagsModal = ref(false);

const filteredCommands = computed(() => {
  if (!searchQuery.value) {
    return commands.value;
  }

  const search = searchQuery.value.toLowerCase();
  return commands.value.filter((cmd) => {
    return cmd.name.toLowerCase().includes(search) || cmd.signature.toLowerCase().includes(search) || (cmd.description && cmd.description.toLowerCase().includes(search));
  });
});

async function loadCommands() {
  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  isLoading.value = true;
  commands.value = [];

  try {
    const result = await window.api.findLaravelCommands(props.projectPath);

    if (result.success) {
      commands.value = result.commands || [];

      await checkForSail();
    } else {
      console.error("Failed to get Laravel commands:", result.message);
      showAlert(result.message || "Failed to get Laravel commands", "error");
    }
  } catch (error) {
    console.error("Error getting Laravel commands:", error);
    showAlert("Failed to get Laravel commands", "error");
  } finally {
    isLoading.value = false;
  }
}

async function checkForSail() {
  if (!props.projectPath) return;

  try {
    const envConfig = await window.api.readEnvFile(props.projectPath);
    hasSail.value = envConfig?.dockerInfo?.dockerAvailable || false;
  } catch (error) {
    console.error("Error checking for Sail:", error);
  }
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();
    if (result.canceled) return;

    const selectedPath = result.filePaths[0];
    const isLaravelProject = await window.api.validateLaravelProject(selectedPath);

    if (!isLaravelProject) {
      showAlert("Selected directory is not a valid Laravel project", "error");
      return;
    }

    emit("update-project-path", selectedPath);

    await loadCommands();
  } catch (error) {
    console.error("Error selecting project path:", error);
    showAlert("Failed to select project path", "error");
  }
}

async function loadCommandContent(filePath) {
  try {
    commandFileContent.value = "Loading...";

    const result = await window.api.readModelFile(filePath);

    if (result.success) {
      commandFileContent.value = result.content;
    } else {
      console.error("Error loading command content:", result.message);
      commandFileContent.value = "Error loading command content: " + result.message;
    }
  } catch (error) {
    console.error("Error reading command file:", error);
    commandFileContent.value = "Unable to load command content";
  }
}

function previewCommand(command) {
  currentCommand.value = command;
  commandInput.value = command.signature;
  commandFlags.value = "";
  commandFileContent.value = "";
  showCommandPreview.value = true;

  if (command.path && !command.isBuiltIn) {
    loadCommandContent(command.path);
  }
}

async function executeCommand(command) {
  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  try {
    commandsStore.openCommandOutput();

    const commandText = command.signature + (commandFlags.value ? " " + commandFlags.value : "");

    await commandsStore.runArtisanCommand({
      command: commandText,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    showAlert(`Command "${command.name}" executed successfully`, "success");

    close();
  } catch (error) {
    console.error("Error executing command:", error);
    showAlert(`Failed to execute command: ${error.message}`, "error");
  }
}

async function openFileInEditor(filePath) {
  if (!filePath) return;

  try {
    await window.api.openFile(filePath);
  } catch (error) {
    console.error("Error opening file:", error);
    showAlert("Failed to open file", "error");
  }
}

function close() {
  emit("close");
}

function getFilename(path) {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function showRunWithFlagsModal(command) {
  currentCommand.value = command;
  commandInput.value = command.signature;
  commandFlags.value = "";
  commandFileContent.value = "";
  showFlagsModal.value = true;

  if (command.path && !command.isBuiltIn) {
    loadCommandContent(command.path);
  }
}

async function runWithFlags() {
  if (!props.projectPath) {
    showAlert("No Laravel project path configured", "error");
    return;
  }

  try {
    commandsStore.openCommandOutput();

    const commandText = commandInput.value + (commandFlags.value ? " " + commandFlags.value : "");

    await commandsStore.runArtisanCommand({
      command: commandText,
      projectPath: props.projectPath,
      useSail: useSail.value,
      connectionId: props.connectionId
    });

    showAlert(`Command "${currentCommand.value.name}" executed successfully`, "success");

    showFlagsModal.value = false;
  } catch (error) {
    console.error("Error executing command:", error);
    showAlert(`Failed to execute command: ${error.message}`, "error");
  }
}

onMounted(() => {
  if (props.projectPath) {
    loadCommands();
  }
});

watch(
  () => props.projectPath,
  (newValue) => {
    if (newValue) {
      loadCommands();
    }
  }
);
</script>
