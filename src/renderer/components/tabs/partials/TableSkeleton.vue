<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-auto p-2">
      <div
        v-for="i in 12"
        :key="i"
        class="w-full flex mb-1 border-b border-neutral p-1"
      >
        <div class="bg-neutral w-10 h-6 rounded-sm animate-pulse mr-4 border border-neutral"></div>
        <div class="bg-neutral flex-1 h-6 rounded-sm animate-pulse mr-4 border border-neutral"></div>
        <div class="bg-neutral flex-1 h-6 rounded-sm animate-pulse mr-4 border border-neutral"></div>
        <div class="bg-neutral flex-1 h-6 rounded-sm animate-pulse mr-4 border border-neutral"></div>
        <div class="bg-neutral flex-1 h-6 rounded-sm animate-pulse mr-4 border border-neutral"></div>
      </div>
    </div>

    <div class="bg-base-200 p-2 border-t border-neutral flex justify-between items-center">
      <div class="flex gap-2">
        <div class="bg-neutral w-20 h-6 rounded-sm animate-pulse"></div>
        <div class="bg-neutral w-24 h-6 rounded-sm animate-pulse"></div>
      </div>
      <div class="flex gap-2">
        <div class="bg-neutral w-8 h-8 rounded-full animate-pulse"></div>
        <div class="bg-neutral w-8 h-8 rounded-full animate-pulse"></div>
        <div class="bg-neutral w-8 h-8 rounded-full animate-pulse"></div>
      </div>
    </div>
  </div>
</template>
