<template>
  <div class="absolute w-full h-10 bg-base-300 top-0 draggable z-10"></div>

  <header class="bg-base-300 mt-8 z-20 px-4 pb-2 border-b border-black/10 flex items-center justify-between">
    <div class="flex items-center">
      <button
        class="btn btn-ghost btn-sm mr-2"
        @click="handleGoBack"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
      </button>

      <div
        class="w-8 h-8 rounded-full flex items-center justify-center mr-2"
        :class="getConnectionColor(connection?.type)"
      >
        <span class="text-base-100 font-bold text-sm">{{ connection?.icon }}</span>
      </div>

      <div>
        <h1 class="text-lg font-semibold">{{ props.title }} - {{ connection?.name }}</h1>
        <div class="text-xs">
          {{ connection?.database || connection?.path }}
        </div>
      </div>
    </div>

    <div class="flex">
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<script setup>
import { useConnectionsStore } from "@/store/connections";
import { useRoute } from "vue-router";
import { computed } from "vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  }
});

const route = useRoute();
const connectionId = computed(() => route.params.id);
const connectionsStore = useConnectionsStore();

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

function getConnectionColor(type) {
  switch (type) {
    case "mysql":
      return "bg-orange-500";
    case "pgsql":
      return "bg-indigo-600";
    case "sqlite":
      return "bg-green-600";
    default:
      return "bg-gray-600";
  }
}

const emit = defineEmits(["goBack"]);

const handleGoBack = () => {
  emit("goBack");
};
</script>
