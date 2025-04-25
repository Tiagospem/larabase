<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button
          class="btn btn-sm btn-ghost"
          @click="loadIndexes"
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
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-if="isLoading"
        class="flex items-center justify-center h-full"
      >
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div
        v-else-if="loadError"
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
          <p>{{ loadError }}</p>
          <button
            class="btn btn-sm btn-primary mt-4"
            @click="loadIndexes"
          >
            Try again
          </button>
        </div>
      </div>

      <div
        v-else-if="indexes.length === 0"
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
              d="M8.25 6.75h7.5a.75.75 0 01.75.75v3.75a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V7.5a.75.75 0 01.75-.75z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 7.5v-3.75A2.25 2.25 0 0012.75 1.5h-1.5A2.25 2.25 0 009 3.75V7.5m6 0v3.75m3 3.75H6A2.25 2.25 0 003.75 15v4.5A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V15a2.25 2.25 0 00-2.25-2.25z"
            />
          </svg>
          <p>No indexes found in this table</p>
          <button
            class="btn btn-sm btn-ghost mt-4"
            @click="loadIndexes"
          >
            Reload
          </button>
        </div>
      </div>

      <div
        v-else
        class="h-full overflow-auto"
      >
        <div class="overflow-x-auto">
          <table class="table table-sm w-full min-w-full">
            <thead class="bg-base-300 sticky top-0 z-10">
              <tr class="text-xs">
                <th class="px-4 py-2 text-left">Name</th>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-left">Columns</th>
                <th class="px-4 py-2 text-left">Algorithm</th>
                <th class="px-4 py-2 text-left">Cardinality</th>
                <th class="px-4 py-2 text-left">Comment</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="index in indexes"
                :key="index.name"
                class="border-b border-neutral hover:bg-base-200"
              >
                <td class="px-4 py-3 font-medium">
                  {{ index.name }}
                </td>
                <td class="px-4 py-3">
                  <span :class="['badge badge-sm', getBadgeClass(index.type)]">{{ index.type }}</span>
                </td>
                <td class="px-4 py-3">
                  {{ index.columns.join(", ") }}
                </td>
                <td class="px-4 py-3">
                  {{ index.algorithm }}
                </td>
                <td class="px-4 py-3">
                  {{ index.cardinality }}
                </td>
                <td class="px-4 py-3">
                  {{ index.comment }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="indexes.length > 0"
      class="bg-base-200 px-4 py-2 border-t border-neutral flex justify-between items-center text-xs text-gray-400 sticky bottom-0 left-0 right-0 min-h-[40px] z-20"
    >
      <div>{{ tableName }} | {{ indexes.length }} indexes</div>
      <div>
        <span v-if="hasPrimaryKey">Primary Key: {{ primaryKeyColumns.join(", ") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from "vue";
import { useDatabaseStore } from "@/store/database";

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
const indexes = ref([]);
const loadError = ref(null);

const databaseStore = useDatabaseStore();

const hasPrimaryKey = computed(() => {
  return indexes.value.some((index) => index.type === "PRIMARY");
});

const primaryKeyColumns = computed(() => {
  const primaryKey = indexes.value.find((index) => index.type === "PRIMARY");
  return primaryKey ? primaryKey.columns : [];
});

function getBadgeClass(type) {
  switch (type) {
    case "PRIMARY":
      return "badge-primary";
    case "UNIQUE":
      return "badge-secondary";
    case "FULLTEXT":
      return "badge-accent";
    case "SPATIAL":
      return "badge-neutral";
    default:
      return "badge-ghost";
  }
}

async function loadIndexes() {
  isLoading.value = true;
  loadError.value = null;

  try {
    const tableIndexes = await databaseStore.getTableIndexes(props.connectionId, props.tableName, true);
    console.log("Loaded indexes:", tableIndexes);

    indexes.value = tableIndexes;

    props.onLoad({
      indexCount: indexes.value.length,
      hasPrimaryKey: hasPrimaryKey.value
    });
  } catch (error) {
    console.error("Error loading indexes:", error);
    loadError.value = "Failed to load indexes: " + (error.message || "Unknown error");
    showAlert(`Error loading indexes: ${error.message}`, "error");
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadIndexes();
});
</script>

<style scoped>
.table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: hsl(var(--b3) / var(--tw-bg-opacity));
  box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.1);
}

.h-full.flex.flex-col {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.flex-1.overflow-auto {
  min-height: 0;
}

.overflow-x-auto {
  overflow-x: auto;
  width: 100%;
}

.pb-16 {
  padding-bottom: 4rem;
}

@media (max-width: 640px) {
  .table thead th {
    padding: 0.5rem 0.25rem;
  }

  .table tbody td {
    padding: 0.5rem 0.25rem;
  }
}
</style>
