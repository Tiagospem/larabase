<template>
  <div
    class="w-full h-full"
    ref="container"
  ></div>
</template>

<script>
import * as monaco from "monaco-editor";
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from "vue";

export default defineComponent({
  name: "EnvCodeEditor",
  props: {
    modelValue: {
      type: String,
      default: ""
    }
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const container = ref(null);
    let editor = null;
    let isUpdating = false;

    const initMonacoLanguage = () => {
      if (!monaco.languages.getLanguages().some((lang) => lang.id === "dotenv")) {
        monaco.languages.register({ id: "dotenv" });
        monaco.languages.setMonarchTokensProvider("dotenv", {
          tokenizer: {
            root: [
              [/#.*$/, "comment"],
              [/([A-Za-z0-9_]+)(=)/, ["key", "operator"]],
              [/"[^"]*"/, "string"],
              [/'[^']*'/, "string"]
            ]
          }
        });
      }
    };

    const createEditor = () => {
      if (!container.value) return;

      if (editor) return;

      initMonacoLanguage();

      editor = monaco.editor.create(container.value, {
        value: props.modelValue,
        language: "dotenv",
        theme: "vs-dark",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: false,
        wordWrap: "on",
        lineNumbers: "on",
        tabSize: 2,
        fontSize: 14
      });

      let timeout = null;
      editor.onDidChangeModelContent(() => {
        if (isUpdating) return;

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const value = editor.getValue();
          emit("update:modelValue", value);
        }, 300);
      });

      setTimeout(() => {
        if (editor) {
          editor.layout();
        }
      }, 100);
    };

    const disposeEditor = () => {
      if (editor) {
        editor.dispose();
        editor = null;
      }
    };

    watch(
      () => props.modelValue,
      (newValue) => {
        if (editor && editor.getValue() !== newValue) {
          isUpdating = true;
          editor.setValue(newValue);
          isUpdating = false;
        }
      }
    );

    const handleResize = () => {
      if (editor) {
        editor.layout();
      }
    };

    onMounted(() => {
      setTimeout(createEditor, 50);
      window.addEventListener("resize", handleResize);
    });

    onBeforeUnmount(() => {
      window.removeEventListener("resize", handleResize);
      disposeEditor();
    });

    return {
      container
    };
  }
});
</script>

<style scoped>
:deep(.monaco-editor) {
  border-radius: 0.25rem;
  overflow: hidden;
}
</style>
