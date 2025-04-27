<template>
  <div class="env-editor h-full w-full">
    <textarea
      ref="textarea"
      v-model="localContent"
      class="w-full h-full outline-none px-4 py-2 font-mono text-sm resize-none bg-base-200 rounded-lg text-base-content"
      spellcheck="false"
      @keydown="handleKeyDown"
      @scroll="onScroll"
    ></textarea>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "scroll"]);

const textarea = ref(null);
const localContent = ref(props.modelValue);

defineExpose({
  textarea
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (localContent.value !== newValue) {
      localContent.value = newValue;
    }
  }
);

watch(
  () => localContent.value,
  (newValue) => {
    if (props.modelValue !== newValue) {
      emit("update:modelValue", newValue);
    }
  }
);

function handleKeyDown(event) {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = event.target.selectionStart;
    const end = event.target.selectionEnd;

    localContent.value = localContent.value.substring(0, start) + "  " + localContent.value.substring(end);

    nextTick(() => {
      event.target.selectionStart = event.target.selectionEnd = start + 2;
    });

    emit("update:modelValue", localContent.value);
  }
}

function onScroll(event) {
  emit("scroll", {
    scrollTop: event.target.scrollTop,
    scrollLeft: event.target.scrollLeft
  });
}
</script>

<style>
.env-editor {
  position: relative;
  z-index: 1;
}

.env-editor textarea {
  tab-size: 4;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
}
</style>
