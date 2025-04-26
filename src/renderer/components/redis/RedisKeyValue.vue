<template>
  <div class="bg-base-200 rounded-lg p-4 md:col-span-2">
    <div
      v-if="loading"
      class="flex justify-center items-center h-full"
    >
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div
      v-else-if="!selectedKey"
      class="flex justify-center items-center h-full text-gray-500"
    >
      Select a key to view its value
    </div>
    <div
      v-else-if="error"
      class="alert alert-error"
    >
      {{ error }}
    </div>
    <div v-else>
      <!-- Key info -->
      <div class="mb-4">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-medium text-primary break-all">{{ selectedKey }}</h4>
            <div class="flex gap-2 mt-1 flex-wrap">
              <span class="badge badge-sm">Type: {{ keyData.type }}</span>
              <span
                v-if="keyData.ttl !== null"
                class="badge badge-sm"
                >TTL: {{ keyData.ttl }} seconds</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Value based on type -->
      <div class="bg-base-300 p-3 rounded-lg overflow-auto max-h-[320px]">
        <!-- String type -->
        <div
          v-if="keyData.type === 'string'"
          class="whitespace-pre-wrap break-all text-sm"
        >
          {{ keyData.value }}
        </div>

        <!-- List type -->
        <div
          v-else-if="keyData.type === 'list'"
          class="space-y-1"
        >
          <div
            v-for="(item, index) in keyData.value"
            :key="index"
            class="p-1 text-sm break-all"
          >
            <span class="font-medium inline-block w-8">{{ index }}.</span> {{ item }}
          </div>
        </div>

        <!-- Set type -->
        <div
          v-else-if="keyData.type === 'set'"
          class="space-y-1"
        >
          <div
            v-for="(item, index) in keyData.value"
            :key="index"
            class="p-1 text-sm break-all"
          >
            {{ item }}
          </div>
        </div>

        <!-- Sorted Set type -->
        <div
          v-else-if="keyData.type === 'zset'"
          class="space-y-1"
        >
          <div
            v-for="(item, index) in keyData.value"
            :key="index"
            class="p-1 text-sm"
          >
            <span class="badge badge-neutral mr-2">{{ item.score }}</span>
            <span class="break-all">{{ item.value }}</span>
          </div>
        </div>

        <!-- Hash type -->
        <div
          v-else-if="keyData.type === 'hash'"
          class="space-y-1"
        >
          <div
            v-for="(value, key) in keyData.value"
            :key="key"
            class="p-1 text-sm"
          >
            <span class="font-medium break-all">{{ key }}:</span>
            <span class="break-all">{{ value }}</span>
          </div>
        </div>

        <!-- Unknown type -->
        <div
          v-else
          class="text-gray-500"
        >
          {{ keyData.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selectedKey: {
    type: String,
    default: null
  },
  keyData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
});
</script>
