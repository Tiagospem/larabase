<script setup lang="ts">
  const props = defineProps({
    count: {
      type: Number,
      default: 10,
    },
  });
</script>

<template>
  <div
    v-for="i in props.count"
    :key="i"
    class="bg-base-100 mb-1 flex animate-pulse items-center gap-2 rounded-sm p-2"
  >
    <div class="bg-base-300 h-4 w-4 rounded-sm" />
    <div class="bg-base-300 h-4 w-4/5 rounded-sm" />
    <div class="bg-base-300 h-4 w-8 rounded-sm" />
  </div>
</template>
