<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-black/10 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button
          class="btn btn-sm btn-ghost"
          @click="loadModel"
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
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      <div
        v-if="!isLoading"
        class="flex items-center space-x-2"
      >
        <span class="text-xs">{{ modelFound ? "Model found" : "No model found" }}</span>

        <button
          v-if="!connection?.projectPath"
          class="btn btn-sm btn-ghost"
          title="Select Laravel project"
          @click="selectProjectPath"
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
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-if="isLoading"
        class="flex items-center justify-center h-full"
      >
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div
        v-else-if="!connection?.projectPath"
        class="flex items-center justify-center h-full"
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
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          <p>No Laravel project path is associated with this connection</p>
          <button
            class="btn btn-sm btn-primary mt-4"
            @click="selectProjectPath"
          >
            Select Project
          </button>
        </div>
      </div>

      <div
        v-else-if="!modelFound"
        class="flex items-center justify-center h-full"
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
              d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
            />
          </svg>
          <p class="text-sm">No Laravel model found for {{ tableName }} table</p>
          <p class="text-xs mt-2 text-base-content">Models are typically named using singular form or with different naming conventions</p>
          <button
            v-if="connection?.projectPath"
            class="btn btn-sm mt-4"
            @click="loadModel"
          >
            Reload
          </button>
        </div>
      </div>

      <div
        v-else
        class="p-4"
      >
        <div class="card bg-base-100">
          <div class="card-body">
            <h3 class="card-title flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-6 h-6 text-primary"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                />
              </svg>
              {{ model.name }}
            </h3>

            <div class="mt-2">
              <div class="flex flex-col space-y-3">
                <div class="flex items-start">
                  <div class="w-28 font-medium">Namespace</div>
                  <div class="flex-1">
                    {{ model.namespace || "Not specified" }}
                  </div>
                </div>

                <div class="flex items-start">
                  <div class="w-28 font-medium">Full Name</div>
                  <div class="flex-1 font-mono text-sm bg-base-200 p-1 rounded-sm">
                    {{ model.fullName }}
                  </div>
                </div>

                <div class="flex items-start">
                  <div class="w-28 font-medium">File Path</div>
                  <div class="flex-1 flex items-center gap-2">
                    <span class="truncate">{{ model.relativePath }}</span>
                    <button
                      class="btn btn-xs btn-ghost"
                      title="Open in editor"
                      @click="openFileInEditor(model.path)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="flex items-start">
                  <div class="w-28 font-medium">Table Name</div>
                  <div class="flex-1">
                    {{ tableName }}
                  </div>
                </div>
              </div>
            </div>

            <div class="divider" />

            <div
              v-if="relationships.length > 0"
              class="mb-4"
            >
              <h4 class="text-sm font-medium mb-2">Relationships</h4>
              <div class="overflow-x-auto">
                <table class="table table-compact w-full">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Related Model</th>
                      <th>Method</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(rel, index) in relationships"
                      :key="index"
                      class="hover"
                    >
                      <td>
                        <span
                          class="badge-sm"
                          :class="getRelationshipBadgeClass(rel.type)"
                        >
                          {{ rel.type }}
                        </span>
                      </td>
                      <td class="font-mono text-xs">{{ rel.relatedModel }}</td>
                      <td>{{ rel.methodName }}</td>
                      <td class="text-xs">{{ rel.details }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              v-if="modelContent"
              class="mb-4"
            >
              <div class="flex justify-between items-center mb-2">
                <h4 class="text-sm font-medium">Model Code</h4>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="toggleCodeVisibility"
                >
                  <svg
                    v-if="!showCode"
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
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                  <svg
                    v-else
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
                      d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                    />
                  </svg>
                  <span class="ml-1">{{ showCode ? "Collapse" : "Expand" }} Code</span>
                </button>
              </div>
              <div v-if="showCode">
                <PhpViewer
                  :code="modelContent"
                  language="php"
                  height="500px"
                />
              </div>
              <div
                v-else
                class="bg-base-100 p-3 rounded border border-base-300 text-center"
              >
                <p class="text-sm opacity-70">Code is hidden. Click Expand Code to view.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="modelFound"
      class="bg-base-200 px-4 py-2 border-t border-black/10 flex justify-between items-center text-xs"
    >
      <div>{{ tableName }} | {{ model.fullName }}</div>
      <div>Model Path: {{ model.relativePath }}</div>
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, ref, computed, watch } from "vue";
import { useDatabaseStore } from "@/store/database";
import { useConnectionsStore } from "@/store/connections";
import PhpViewer from "@/components/PhpViewer.vue";

const showAlert = inject("showAlert");

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
  }
});

const isLoading = ref(true);
const model = ref(null);
const modelJson = ref("");
const modelContent = ref("");
const showJsonModal = ref(false);
const relationships = ref([]);
const showCode = ref(false);

const databaseStore = useDatabaseStore();
const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const modelFound = computed(() => {
  return model.value !== null;
});

const formattedJson = computed(() => {
  try {
    if (!modelJson.value) return "";

    return typeof modelJson.value === "string" ? JSON.stringify(JSON.parse(modelJson.value), null, 2) : JSON.stringify(modelJson.value, null, 2);
  } catch (error) {
    console.error("Error formatting JSON:", error);
    return String(modelJson.value);
  }
});

async function loadModel() {
  isLoading.value = true;

  try {
    if (!connection.value?.projectPath) {
      model.value = null;
      return;
    }

    await databaseStore.loadModelsForTables(props.connectionId, connection.value.projectPath);

    model.value = databaseStore.getModelForTable(props.connectionId, props.tableName);

    modelJson.value = databaseStore.getTableModelJson(props.connectionId, props.tableName);

    if (model.value && model.value.path) {
      await loadModelContent(model.value.path);
      extractRelationships();
    }

    props.onLoad({
      modelFound: model.value !== null
    });
  } catch (error) {
    console.error("Failed to load model:", error);
    showAlert(`Error loading model: ${error.message}`, "error");
    model.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function loadModelContent(filePath) {
  try {
    const result = await window.api.readModelFile(filePath);

    if (result.success) {
      modelContent.value = result.content;
    } else {
      console.error("Error loading model content:", result.message);
      modelContent.value = "// Unable to load model content: " + result.message;
    }
  } catch (error) {
    console.error("Error reading model file:", error);
    modelContent.value = "// Unable to load model content";
  }
}

function extractRelationships() {
  if (!modelContent.value) {
    relationships.value = [];
    return;
  }

  const content = modelContent.value;
  const foundRelationships = [];

  try {
    const relationshipMethods = ["hasOne", "hasMany", "belongsTo", "belongsToMany", "morphTo", "morphOne", "morphMany", "morphToMany", "morphedByMany", "hasManyThrough", "hasOneThrough"];

    relationshipMethods.forEach((relType) => {
      console.log(`Searching for ${relType} relationships`);
      const pattern = new RegExp(`function\\s+(\\w+)[^{]*{[^}]*\\$this->\\s*${relType}\\s*\\(`, "gi");
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const methodName = match[1];

        const startPos = match.index;
        const relTypePos = content.indexOf(`$this->${relType}`, startPos);
        const paramStart = content.indexOf("(", relTypePos) + 1;
        let paramEnd = paramStart;

        for (let i = paramStart; i < content.length; i++) {
          if (content[i] === "," || content[i] === ")") {
            paramEnd = i;
            break;
          }
        }

        let relatedModel = content.substring(paramStart, paramEnd).trim();
        relatedModel = relatedModel.replace(/['"]/g, "").replace(/::class/g, "");

        foundRelationships.push({
          type: relType,
          methodName,
          relatedModel,
          details: "Method-based relationship"
        });
      }
    });

    relationshipMethods.forEach((relType) => {
      const propPattern = new RegExp(`\\$(${relType})\\s*=\\s*\\[([^\\]]+)\\]`, "i");
      const propMatch = content.match(propPattern);

      if (propMatch) {
        const modelNames = propMatch[2].match(/['"]([^'"]+)['"]/g);

        if (modelNames) {
          modelNames.forEach((modelNameQuoted) => {
            const modelName = modelNameQuoted.replace(/['"]/g, "");
            foundRelationships.push({
              type: relType,
              methodName: modelName.toLowerCase(),
              relatedModel: modelName,
              details: `Property-based relationship ($${relType})`
            });
          });
        }
      }
    });

    const stringPattern = /->(hasOne|hasMany|belongsTo|belongsToMany|morphTo|morphOne|morphMany|morphToMany|morphedByMany|hasManyThrough|hasOneThrough)\s*\(\s*['"]([^'"]+)['"]/gi;
    let stringMatch;

    while ((stringMatch = stringPattern.exec(content)) !== null) {
      const relType = stringMatch[1];
      const relatedModel = stringMatch[2];

      const beforeMatch = content.substring(0, stringMatch.index);
      const methodMatch = beforeMatch.match(/function\s+(\w+)[^{]*\{[^{]*$/);

      if (methodMatch) {
        const methodName = methodMatch[1];

        foundRelationships.push({
          type: relType,
          methodName,
          relatedModel,
          details: "String-based relationship"
        });
      }
    }

    relationships.value = [...foundRelationships];
  } catch (error) {
    console.error("Error extracting relationships:", error);
    relationships.value = [];
  }
}

function getRelationshipBadgeClass(type) {
  const classes = {
    hasOne: "badge badge-primary",
    hasMany: "badge badge-secondary",
    belongsTo: "badge badge-accent",
    belongsToMany: "badge badge-info",
    morphTo: "badge badge-warning",
    morphOne: "badge badge-warning",
    morphMany: "badge badge-warning",
    hasManyThrough: "badge badge-error",
    hasOneThrough: "badge badge-error"
  };

  return classes[type] || "badge";
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();

    if (result.canceled) {
      return;
    }

    const projectPath = result.filePaths[0];

    const isLaravel = await window.api.validateLaravelProject(projectPath);

    if (!isLaravel) {
      showAlert("Selected directory is not a valid Laravel project", "error");
      return;
    }

    if (connection.value) {
      const updatedConnections = connectionsStore.connections.map((conn) => {
        if (conn.id === connection.value.id) {
          return { ...conn, projectPath };
        }
        return conn;
      });

      await connectionsStore.saveConnections(updatedConnections);
      showAlert("Laravel project path set successfully", "success");
      await loadModel();
    }
  } catch (error) {
    console.error("Error selecting directory:", error);
    showAlert("Failed to select project directory", "error");
  }
}

async function openFileInEditor(filePath) {
  try {
    await window.api.openFile(filePath);
  } catch (error) {
    console.error("Error opening file:", error);
    showAlert("Failed to open file", "error");
  }
}

function viewModelJson() {
  showJsonModal.value = true;
}

async function copyJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(formattedJson.value);
    showAlert("JSON copied to clipboard", "success");
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    showAlert("Failed to copy to clipboard", "error");
  }
}

function toggleCodeVisibility() {
  showCode.value = !showCode.value;
}

onMounted(() => {
  loadModel();
});
</script>

<style scoped></style>
