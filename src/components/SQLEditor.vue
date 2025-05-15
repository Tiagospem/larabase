<script setup lang="ts">
  import { useSQLEditor } from '@/composables/useSQLEditor';

  const props = defineProps({
    modelValue: {
      type: String,
      default: '-- Write your SQL query here',
    },
  });

  const emit = defineEmits(['update:modelValue', 'processing-state', 'explain-sql']);

  const {
    container,
    layout,
    getSelectedText,
    saveAsScratch,
    showProcessingOverlay,
    explainResult,
  } = useSQLEditor(props, emit);

  defineExpose({
    layout,
    getSelectedText,
    saveAsScratch,
  });
</script>

<template>
  <div class="sql-editor-container" ref="container">
    <div v-if="showProcessingOverlay" class="sql-processing-overlay">
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <div class="processing-text">Processing SQL...</div>
      </div>
    </div>
  </div>
</template>

<style>
  .sql-editor-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .monaco-editor .scrollbar .slider {
    background: rgba(100, 100, 100, 0.8) !important;
  }

  .monaco-editor .scrollbar.vertical,
  .monaco-editor .scrollbar.horizontal {
    opacity: 0;
    transition: opacity 0.2s;
  }

  .monaco-editor:hover .scrollbar.vertical.visible,
  .monaco-editor:hover .scrollbar.horizontal.visible {
    opacity: 1 !important;
  }

  .sql-processing-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .processing-content {
    background-color: rgba(40, 40, 40, 0.9);
    border-radius: 6px;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .processing-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s linear infinite;
  }

  .processing-text {
    font-size: 14px;
    color: #fff;
    font-weight: 500;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
