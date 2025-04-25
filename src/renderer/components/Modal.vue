<template>
  <div
    class="modal"
    :class="{ 'modal-open': show }"
    :style="{ 'z-index': zIndex }"
  >
    <div
      class="modal-box bg-base-300 relative max-h-[90vh] overflow-auto"
      :class="width"
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">{{ title }}</h3>
        <button
          v-if="!hideCloseButton"
          class="btn btn-sm btn-circle"
          @click="handleClose"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-content">
        <slot></slot>
      </div>

      <div
        v-if="showFooter"
        class="modal-action mt-6"
      >
        <slot name="footer">
          <button
            v-if="showCancelButton"
            class="btn btn-ghost"
            @click="handleClose"
          >
            {{ cancelButtonText }}
          </button>
          <button
            v-if="showActionButton"
            :disabled="isLoadingAction"
            class="btn btn-primary"
            @click="$emit('action')"
          >
            <span
              v-if="isLoadingAction"
              class="loading loading-spinner loading-xs mr-2"
            />
            {{ actionButtonText }}
          </button>
        </slot>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="allowCloseOnBackdrop ? handleClose() : null"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: "Modal"
  },
  hideCloseButton: {
    type: Boolean,
    default: false
  },
  allowCloseOnBackdrop: {
    type: Boolean,
    default: true
  },
  allowCloseOnEsc: {
    type: Boolean,
    default: true
  },
  showFooter: {
    type: Boolean,
    default: true
  },
  showCancelButton: {
    type: Boolean,
    default: true
  },
  cancelButtonText: {
    type: String,
    default: "Close"
  },
  showActionButton: {
    type: Boolean,
    default: false
  },
  actionButtonText: {
    type: String,
    default: "Confirm"
  },
  isLoadingAction: {
    type: Boolean,
    default: false
  },
  width: {
    type: String,
    default: "max-w-4xl"
  },
  zIndex: {
    type: [Number, String],
    default: 40
  }
});

const emit = defineEmits(["close", "action"]);

const handleClose = () => {
  emit("close");
};

const handleKeyDown = (event) => {
  if (event.key === "Escape" && props.show && props.allowCloseOnEsc) {
    handleClose();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>
