<template>
  <div v-if="showCommandOutput" class="command-output-panel">
    <div class="command-output-header">
      <div class="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5" 
          stroke="currentColor"
          class="w-5 h-5 mr-2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round" 
            d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <span class="font-mono text-sm">{{ command }}</span>
        <div v-if="!commandResult?.isComplete" class="ml-2">
          <span class="loading loading-spinner loading-xs" />
        </div>
      </div>
      <div class="flex">
        <button class="btn btn-xs btn-ghost" :title="isExpanded ? 'Collapse' : 'Expand'" @click="toggleHeight">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5" 
            stroke="currentColor"
            class="w-4 h-4"
            :class="{ 'transform rotate-180': !isExpanded }"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <button class="btn btn-xs btn-ghost" title="Clear output" @click="clearOutput">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <div class="command-output-content" :class="{ 'expanded': isExpanded }">
      <div v-if="commandResult" ref="outputContainer" class="mockup-code bg-neutral h-full overflow-auto">
        <pre class="whitespace-pre-wrap" :class="{ 'text-green-400': commandResult.success, 'text-red-400': !commandResult.success }"><code>{{ sanitizedOutput }}</code></pre>
      </div>
      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <p>No command output</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useCommandsStore } from '@/store/commands';

const commandsStore = useCommandsStore();
const outputContainer = ref(null);

const isExpanded = ref(true);
const showCommandOutput = computed(() => commandsStore.showCommandOutput);
const commandResult = computed(() => commandsStore.lastCommand);
const command = computed(() => {
  const cmd = commandResult.value?.command || '';
  if (cmd.length > 80) {
    return cmd.substring(0, 77) + '...';
  }
  return cmd;
});

// Function to remove ANSI color codes and formatting
const sanitizedOutput = computed(() => {
  if (!commandResult.value?.output) {
    return commandResult.value?.message || 'No output';
  }
  
  
  return commandResult.value.output
    .replace(/\u001b\[\d+(;\d+)?m/g, '') // Remove all ANSI color codes
    .replace(/\[90m|\[39m|\[32;1m|\[39;22m|\[1m|\[22m/g, '') // Remove specific color format codes
    .replace(/\u001b/g, ''); 
});

function toggleHeight () {
  isExpanded.value = !isExpanded.value;
}

function clearOutput () {
  commandsStore.closeCommandOutput();
}


watch(() => commandsStore.lastCommand, () => {
  isExpanded.value = true;
});


watch(() => sanitizedOutput.value, () => {
  
  nextTick(() => {
    scrollToBottom();
  });
}, { immediate: true });


function scrollToBottom () {
  if (outputContainer.value) {
    outputContainer.value.scrollTop = outputContainer.value.scrollHeight;
  }
}
</script>

<style scoped>
.command-output-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgb(24, 24, 27);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 20;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
}

.command-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.2);
}

.command-output-content {
  height: 200px;
  transition: height 0.3s ease;
  overflow: hidden;
}

.command-output-content.expanded {
  height: 400px;
}
</style> 