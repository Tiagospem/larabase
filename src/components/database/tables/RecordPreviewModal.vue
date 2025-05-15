<script setup lang="ts">
  import { ref, watch } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { useTableStructure } from '@/composables/useTableStructure';

  const props = defineProps({
    show: {
      type: Boolean,
      required: true,
    },
    record: {
      type: Object,
      required: true,
    },
    tableName: {
      type: String,
      required: true,
    },
    tableStructure: {
      type: Array,
      required: true,
    },
  });

  const emit = defineEmits(['close']);

  const tableStructureHelper = useTableStructure();
  const expandedFields = ref<Set<string>>(new Set());
  const htmlPreviewMode = ref<Set<string>>(new Set());

  watch(
    () => props.tableStructure,
    newStructure => {
      if (newStructure && Array.isArray(newStructure) && newStructure.length > 0) {
        tableStructureHelper.initializeWithStructure(newStructure);
      }
    },
    { immediate: true }
  );

  watch(
    () => props.show,
    newValue => {
      if (newValue) {
        expandedFields.value = new Set();
        htmlPreviewMode.value = new Set();
      }
    }
  );

  const isDateTimeColumn = (columnName: string): boolean => {
    return tableStructureHelper.isDateTimeColumn(columnName);
  };

  const isNumberColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType
      ? columnType.includes('int') ||
          columnType.includes('decimal') ||
          columnType.includes('float') ||
          columnType.includes('double')
      : false;
  };

  const isTextColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType.includes('text') || columnType.includes('longtext') : false;
  };

  const isJsonColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType.includes('json') : false;
  };

  const isBooleanColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType === 'tinyint(1)' || columnType === 'boolean' : false;
  };

  const getColumnTypeLabel = (columnName: string): string => {
    if (isJsonColumn(columnName)) return 'JSON';
    if (isTextColumn(columnName)) return 'Text';
    if (isDateTimeColumn(columnName)) return 'DateTime';
    if (isNumberColumn(columnName)) return 'Number';
    if (isBooleanColumn(columnName)) return 'Boolean';
    return tableStructureHelper.getColumnType(columnName) || 'Unknown';
  };

  const toggleExpandField = (fieldName: string) => {
    if (expandedFields.value.has(fieldName)) {
      expandedFields.value.delete(fieldName);
    } else {
      expandedFields.value.add(fieldName);
    }
  };

  const toggleHtmlPreview = (fieldName: string) => {
    if (htmlPreviewMode.value.has(fieldName)) {
      htmlPreviewMode.value.delete(fieldName);
    } else {
      htmlPreviewMode.value.add(fieldName);
    }
  };

  const containsHtmlTags = (text: string): boolean => {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
  };

  const formatJson = (jsonValue: any): string => {
    try {
      if (typeof jsonValue === 'string') {
        jsonValue = JSON.parse(jsonValue);
      }
      return JSON.stringify(jsonValue, null, 2);
    } catch (e) {
      return String(jsonValue);
    }
  };

  const getJsonPreview = (jsonValue: any): string => {
    const formatted = formatJson(jsonValue);
    const lines = formatted.split('\n');
    if (lines.length <= 5) return formatted;
    return lines.slice(0, 5).join('\n') + '\n...';
  };

  const isJsonTruncated = (jsonValue: any): boolean => {
    try {
      const formatted = formatJson(jsonValue);
      return formatted.split('\n').length > 5;
    } catch (e) {
      return false;
    }
  };

  const getLimitedText = (text: string, maxLines = 5) => {
    if (!text) return '';

    const lines = text.split(/\r?\n/);

    if (lines.length <= maxLines) return text;

    return lines.slice(0, maxLines).join('\n') + '\n...';
  };

  const isTextFieldTruncated = (text: string) => {
    if (!text) return false;

    const lines = text.split(/\r?\n/);
    return lines.length > 5;
  };
</script>

<template>
  <Modal
    :show="show"
    :title="`Record Preview - ${tableName}`"
    @close="emit('close')"
    :show-action-button="false"
    :show-footer="false"
    width="max-w-5xl"
  >
    <div class="max-h-[70vh] overflow-y-auto text-sm">
      <div class="flex flex-col gap-6 px-1">
        <div
          v-for="column in tableStructureHelper.structure?.value || []"
          :key="column.name"
          class="preview-item border-base-100 border-b pb-4"
        >
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ column.name }}</span>
              <span v-if="column.isPrimaryKey" class="badge badge-warning badge-xs">Primary</span>
              <span v-else-if="column.isForeignKey" class="badge badge-info badge-xs">Foreign</span>
            </div>
            <span class="badge badge-xs badge-base-200 text-xs opacity-70">{{
              getColumnTypeLabel(column.name)
            }}</span>
          </div>

          <div v-if="isJsonColumn(column.name)" class="mt-2">
            <div v-if="props.record[column.name]" class="relative">
              <pre
                class="selectable bg-base-100 overflow-hidden rounded p-2 font-mono text-xs whitespace-pre-wrap"
                :class="{
                  'max-h-[120px]':
                    !expandedFields.has(column.name) && isJsonTruncated(props.record[column.name]),
                }"
                >{{
                  expandedFields.has(column.name)
                    ? formatJson(props.record[column.name])
                    : getJsonPreview(props.record[column.name])
                }}</pre
              >

              <button
                v-if="isJsonTruncated(props.record[column.name])"
                @click="toggleExpandField(column.name)"
                class="bg-opacity-10 bg-base-100 hover:bg-opacity-20 mt-1 cursor-pointer rounded px-2 py-1 text-xs font-medium"
              >
                {{ expandedFields.has(column.name) ? 'Show less' : 'Show more' }}
              </button>
            </div>
            <div v-else class="text-sm italic opacity-70">null</div>
          </div>

          <div v-else-if="isTextColumn(column.name)" class="mt-2">
            <div v-if="props.record[column.name]" class="relative">
              <div
                v-if="
                  containsHtmlTags(props.record[column.name]) && htmlPreviewMode.has(column.name)
                "
                class="selectable border-base-300 bg-base-200 rounded border p-2"
              >
                <div
                  v-html="
                    expandedFields.has(column.name)
                      ? props.record[column.name]
                      : getLimitedText(props.record[column.name])
                  "
                ></div>
              </div>
              <p
                v-else
                class="selectable overflow-hidden text-sm whitespace-pre-wrap"
                :class="{
                  'max-h-[120px]':
                    !expandedFields.has(column.name) &&
                    isTextFieldTruncated(props.record[column.name]),
                }"
              >
                {{
                  expandedFields.has(column.name)
                    ? props.record[column.name]
                    : getLimitedText(props.record[column.name])
                }}
              </p>

              <div class="mt-1 flex gap-2">
                <button
                  v-if="isTextFieldTruncated(props.record[column.name])"
                  @click="toggleExpandField(column.name)"
                  class="bg-opacity-10 bg-base-100 hover:bg-opacity-20 cursor-pointer rounded px-2 py-1 text-xs font-medium"
                >
                  {{ expandedFields.has(column.name) ? 'Show less' : 'Show more' }}
                </button>

                <button
                  v-if="containsHtmlTags(props.record[column.name])"
                  @click="toggleHtmlPreview(column.name)"
                  class="bg-opacity-10 bg-base-100 hover:bg-opacity-20 cursor-pointer rounded px-2 py-1 text-xs font-medium"
                >
                  {{ htmlPreviewMode.has(column.name) ? 'View as text' : 'View as HTML' }}
                </button>
              </div>
            </div>
            <div v-else class="text-sm italic opacity-70">null</div>
          </div>

          <div v-else-if="isBooleanColumn(column.name)" class="mt-2">
            <div
              class="badge badge-xs"
              :class="props.record[column.name] ? 'badge-success' : 'badge-error'"
            >
              {{ props.record[column.name] ? 'True' : 'False' }}
            </div>
          </div>

          <div v-else-if="isDateTimeColumn(column.name)" class="selectable mt-2">
            <span v-if="props.record[column.name]" class="text-sm">
              {{ new Date(props.record[column.name]).toLocaleString() }}
            </span>
            <span v-else class="text-sm italic opacity-70">null</span>
          </div>

          <div v-else class="selectable mt-2">
            <span
              v-if="props.record[column.name] !== null && props.record[column.name] !== undefined"
              class="text-sm"
            >
              {{ props.record[column.name] }}
            </span>
            <span v-else class="text-sm italic opacity-70">null</span>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  .preview-item {
    padding-bottom: 1.5rem;
  }

  .preview-item:last-child {
    border-bottom: none;
  }

  .selectable {
    user-select: text;
    cursor: text;
  }

  :deep(p) {
    margin-bottom: 0.75em;
  }

  :deep(strong) {
    font-weight: bold;
  }

  :deep(em) {
    font-style: italic;
  }
</style>
