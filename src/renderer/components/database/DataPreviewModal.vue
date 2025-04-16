<template>
  <div class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
        Data Preview
        <button class="btn btn-sm btn-circle" @click="$emit('close')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
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
      </h3>

      <div v-if="record" class="overflow-y-auto max-h-[60vh] divide-y divide-base-300">
        <div v-for="column in columns" :key="column" class="py-3">
          <div class="flex items-start mb-2">
            <div class="font-medium text-sm w-1/4 truncate">{{ column }}</div>
            <div class="w-3/4">
              <!-- Null/undefined values -->
              <div
                v-if="record[column] === null || record[column] === undefined"
                class="text-gray-500 italic"
              >
                NULL
              </div>

              <!-- JSON/Object data -->
              <div v-else-if="isJsonObject(record[column])" class="font-mono text-xs">
                <div class="bg-base-300 p-2 rounded-md overflow-x-auto">
                  <pre class="whitespace-pre-wrap">{{ formatJson(record[column]) }}</pre>
                </div>
              </div>

              <!-- Array data -->
              <div v-else-if="isArray(record[column])" class="font-mono text-xs">
                <div class="bg-base-300 p-2 rounded-md">
                  <div class="mb-1 text-primary">Array ({{ record[column].length }} items)</div>
                  <div
                    v-for="(item, i) in record[column].slice(0, 5)"
                    :key="i"
                    class="mb-1 pl-2 border-l-2 border-base-content"
                  >
                    <span class="text-gray-500">[{{ i }}]</span> {{ formatPreviewValue(item) }}
                  </div>
                  <div v-if="record[column].length > 5" class="text-gray-500 italic">
                    ...and {{ record[column].length - 5 }} more items
                  </div>
                </div>
              </div>

              <!-- Long text data -->
              <div v-else-if="isLongText(record[column])" class="relative">
                <div class="text-sm" :class="{ 'line-clamp-5': !expandedFields[column] }">
                  {{ record[column] }}
                </div>
                <button class="btn btn-xs mt-1" @click="toggleFieldExpansion(column)">
                  {{ expandedFields[column] ? 'Show less' : 'Show more' }}
                </button>
              </div>

              <!-- Date data -->
              <div v-else-if="isDateField(column) && record[column]" class="text-sm">
                <div class="text-primary">{{ formatDateForDisplay(record[column]) }}</div>
                <div class="text-xs text-gray-500">{{ formatDateAgo(record[column]) }}</div>
              </div>

              <!-- Boolean data -->
              <div v-else-if="typeof record[column] === 'boolean'" class="text-sm">
                <div class="badge" :class="record[column] ? 'badge-success' : 'badge-error'">
                  {{ record[column] ? 'true' : 'false' }}
                </div>
              </div>

              <!-- Number data -->
              <div v-else-if="typeof record[column] === 'number'" class="text-sm font-mono">
                {{ record[column].toLocaleString() }}
              </div>

              <!-- Default/string data -->
              <div v-else class="text-sm">
                {{ record[column] }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('close')">Close</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="$emit('close')" />
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  record: {
    type: Object,
    required: true
  },
  columns: {
    type: Array,
    required: true
  }
});

defineEmits(['close']);

const expandedFields = ref({});

function formatPreviewValue(value) {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  } else if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else if (typeof value === 'function') {
    return 'function';
  } else if (typeof value === 'symbol') {
    return value.toString();
  } else if (typeof value === 'undefined') {
    return 'undefined';
  } else {
    return 'unknown';
  }
}

function isJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value) {
  return Array.isArray(value);
}

function isLongText(value) {
  return typeof value === 'string' && value.length > 100;
}

function isDateField(column) {
  return /(date|time|at$|created_at|updated_at|deleted_at)/i.test(column);
}

function formatDateForDisplay(date) {
  return new Date(date).toLocaleString();
}

function formatDateAgo(date) {
  const now = new Date();
  const diff = Math.abs(now - new Date(date));
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const diffSeconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffSeconds > 0) return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} ago`;
  return 'just now';
}

function toggleFieldExpansion(column) {
  expandedFields.value[column] = !expandedFields.value[column];
}

function formatJson(value) {
  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } else {
      return JSON.stringify(value, null, 2);
    }
  } catch (e) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

watch(
  () => props.record,
  () => {
    expandedFields.value = {};
  },
  { deep: true }
);
</script>

<style scoped>
.line-clamp-5 {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
