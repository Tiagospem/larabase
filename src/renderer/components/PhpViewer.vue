<template>
  <div
    class="code-viewer"
    :style="{ height: heightStyle }"
  >
    <div class="mockup-code bg-neutral h-full w-full overflow-auto text-xs">
      <pre class="w-full"><code v-html="highlightedCode"/></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from "vue";
import hljs from "highlight.js/lib/core";
import php from "highlight.js/lib/languages/php";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("php", php);
hljs.registerLanguage("json", json);

const props = defineProps({
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: "php",
    validator: (value) => ["php", "json"].includes(value)
  },
  height: {
    type: String,
    default: "64"
  }
});

const highlightedCode = ref("");

// Compute the proper CSS height value based on the height prop
const heightStyle = computed(() => {
  if (props.height.endsWith("rem") || props.height.endsWith("px") || props.height.endsWith("%") || props.height.endsWith("vh")) {
    return props.height;
  }
  return props.height + "rem";
});

function highlightCode() {
  try {
    if (props.code) {
      // First highlight the code
      const highlighted = hljs.highlight(props.code, {
        language: props.language,
        ignoreIllegals: true
      }).value;

      // Add line numbers to the highlighted code
      const lines = highlighted.split("\n");
      let processedCode = "";

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const lineNumberPadded = String(lineNumber).padStart(3, " ");
        processedCode += `<span class="line-number">${lineNumberPadded}</span>${line}\n`;
      });

      highlightedCode.value = processedCode;
    } else {
      highlightedCode.value = "";
    }
  } catch (error) {
    console.error("Error highlighting code:", error);
    // Fallback to plain code with line numbers if highlighting fails
    if (props.code) {
      const lines = props.code.split("\n");
      let processedCode = "";

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const lineNumberPadded = String(lineNumber).padStart(3, " ");
        // Escape HTML entities
        const escapedLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        processedCode += `<span class="line-number">${lineNumberPadded}</span>${escapedLine}\n`;
      });

      highlightedCode.value = processedCode;
    } else {
      highlightedCode.value = "";
    }
  }
}

// Process code on initial render
onMounted(() => {
  highlightCode();
});

// Watch for changes in the code prop
watch(() => props.code, highlightCode, { immediate: true });
</script>

<style scoped>
.code-viewer {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mockup-code {
  flex: 1;
  display: block;
  min-height: 100%;
}

/* Base syntax highlighting styles */
:deep(.hljs) {
  background: transparent;
  padding: 0;
  display: block;
  width: auto;
}

:deep(.hljs-keyword) {
  color: #c678dd;
}

:deep(.hljs-string) {
  color: #98c379;
}

:deep(.hljs-function) {
  color: #61afef;
}

:deep(.hljs-comment) {
  color: #5c6370;
  font-style: italic;
}

:deep(.hljs-variable) {
  color: #e06c75;
}

:deep(.hljs-title) {
  color: #61aeee;
}

/* Line number styling */
:deep(.line-number) {
  display: inline-block;
  width: 2.5em;
  color: #606366;
  font-family: Consolas, Monaco, "Andale Mono", monospace;
  text-align: right;
  padding-right: 0.5em;
  margin-right: 0.5em;
  user-select: none;
  border-right: 1px solid #444;
  position: sticky;
  left: 0;
  background-color: rgba(42, 42, 46, 0.8);
}

:deep(pre) {
  margin: 0;
  font-family: Consolas, Monaco, "Andale Mono", monospace;
  line-height: 1.5;
}

:deep(code) {
  font-family: Consolas, Monaco, "Andale Mono", monospace;
  white-space: pre;
  display: inline-block;
  min-width: 100%;
}
</style>
