<template>
  <div class="bg-base-200 rounded-lg p-2 h-[400px] overflow-auto md:col-span-1">
    <div
      v-if="loading"
      class="flex justify-center items-center h-full"
    >
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div
      v-else-if="keys.length === 0"
      class="flex justify-center items-center h-full text-gray-500"
    >
      No keys found
    </div>
    <div
      v-else
      class="space-y-1"
    >
      <div
        v-for="key in keys"
        :key="key"
        class="cursor-pointer p-2 rounded-sm hover:bg-base-300 text-sm break-all"
        :class="{ 'bg-base-300': selectedKey === key }"
        @click="$emit('select-key', key)"
      >
        {{ key }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  keys: {
    type: Array,
    required: true,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedKey: {
    type: String,
    default: null
  }
});

defineEmits(["select-key"]);
</script>

<style scoped>
.break-all {
  word-break: break-all;
}
</style>
