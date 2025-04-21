<template>
  <div class="flex items-center justify-center h-full text-error">
    <div class="text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-12 h-12 mx-auto mb-4"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <p>{{ props.message }}</p>
      <button
        class="btn btn-sm btn-primary mt-4"
        @click="emit('retry')"
      >
        Try again
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  message: {
    type: String,
    default: "An error occurred while loading the data."
  }
});

const emit = defineEmits(["retry"]);
</script>
