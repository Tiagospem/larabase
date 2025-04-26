<template>
  <div class="p-4">
    <button
      class="btn btn-primary"
      @click="showModal = true"
    >
      Open Modal
    </button>

    <Modal
      :show="showModal"
      title="Example Modal"
      @close="showModal = false"
      @action="handleAction"
    >
      <!-- Custom footer buttons example -->
      <template #footer> </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref } from "vue";
import Modal from "./Modal.vue";

const showModal = ref(false);
const exampleInput = ref("");

const handleAction = () => {
  console.log("Action button clicked!", exampleInput.value);
  showModal.value = false;
};
</script>
