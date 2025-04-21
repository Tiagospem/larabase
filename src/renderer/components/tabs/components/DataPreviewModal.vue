<template>
  <div class="modal z-50" :class="{ 'modal-open': show }">
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

      <!-- Feedback para cópia de texto -->
      <div
        v-if="copyFeedback"
        class="fixed top-4 right-4 bg-primary text-white py-2 px-4 rounded-md shadow-lg z-50 transition-opacity"
      >
        {{ copyFeedback }}
      </div>

      <div v-if="record" class="overflow-y-auto max-h-[60vh] divide-y divide-base-300">
        <div v-for="column in columns" :key="column" class="py-3">
          <div class="flex items-start mb-2">
            <div class="flex items-center gap-2 w-1/4">
              <button
                class="btn btn-xs btn-ghost"
                title="Copy to clipboard"
                @click="copyToClipboard(record[column])"
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
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                  />
                </svg>
              </button>
              <span class="font-medium text-sm truncate">{{ column }}</span>
            </div>
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
                <button
                  v-if="shouldShowExpandButton(record[column])"
                  class="btn btn-xs mt-1"
                  @click="toggleFieldExpansion(column)"
                >
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

const emit = defineEmits(['close']);

const expandedFields = ref({});
const copyFeedback = ref('');

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
  if (typeof value !== 'string') return false;

  const hasMultipleLines = (value.match(/\n/g) || []).length > 2;
  const isVeryLong = value.length > 200;

  const lineCount = value.split('\n').length;
  const wordCount = value.split(/\s+/).length;
  const averageCharsPerLine = 80;
  const estimatedLines = Math.max(lineCount, Math.ceil(value.length / averageCharsPerLine));

  return isVeryLong || hasMultipleLines || estimatedLines > 5 || wordCount > 50;
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

function copyToClipboard(value) {
  let textToCopy = '';

  if (value === null || value === undefined) {
    textToCopy = '';
  } else if (typeof value === 'object') {
    textToCopy = JSON.stringify(value, null, 2);
  } else if (typeof value === 'boolean') {
    textToCopy = value ? 'true' : 'false';
  } else {
    textToCopy = String(value);
  }

  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      copyFeedback.value = 'Copied!';

      setTimeout(() => {
        copyFeedback.value = '';
      }, 2000);
    })
    .catch(err => {
      console.error('Error copying text:', err);
      copyFeedback.value = 'Error!';
      setTimeout(() => {
        copyFeedback.value = '';
      }, 2000);
    });
}

function shouldShowExpandButton(value) {
  if (typeof value !== 'string') return false;

  const hasMultipleLines = (value.match(/\n/g) || []).length > 3;
  const isVeryLong = value.length > 250;

  const lineCount = value.split('\n').length;
  const averageCharsPerLine = 80;
  const estimatedLines = Math.max(lineCount, Math.ceil(value.length / averageCharsPerLine));

  return isVeryLong || hasMultipleLines || estimatedLines > 5;
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

.transition-opacity {
  transition: opacity 0.3s ease-in-out;
}
</style>
