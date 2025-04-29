<template>
  <Modal
    :show="show"
    title="Update User Password"
    @close="close"
    @action="updatePassword"
    actionButtonText="Update Password"
    :showActionButton="true"
    :disableActionButton="isLoading"
    :isLoadingAction="isLoading"
  >
    <div class="space-y-4">
      <div>
        <p class="mb-2 font-medium">User: {{ user ? user.name || user.email || `ID: ${user.id}` : "" }}</p>
        <div class="text-xs bg-base-200 p-2 rounded-md mb-4">
          <p>This will update the password for this user and hash it using Laravel's bcrypt hashing.</p>
        </div>
      </div>

      <fieldset class="fieldset w-full">
        <label class="label">
          <span class="label-text">New Password</span>
        </label>
        <div class="flex">
          <input
            v-model="newPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter new password"
            class="input input-bordered w-full"
            autocomplete="new-password"
            :disabled="isLoading"
          />
        </div>
        <label
          v-if="passwordError"
          class="label"
        >
          <span class="label-text-alt text-error">{{ passwordError }}</span>
        </label>
      </fieldset>

      <fieldset class="fieldset w-full">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            v-model="showPassword"
            type="checkbox"
            class="checkbox checkbox-sm"
            :disabled="isLoading"
          />
          <span class="label-text">Show password</span>
        </label>
      </fieldset>
    </div>
  </Modal>
</template>

<script setup>
import { ref, watch } from "vue";
import Modal from "@/components/Modal.vue";
import { inject } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  user: {
    type: Object,
    required: true
  },
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["close"]);

const showAlert = inject("showAlert");

const newPassword = ref("");
const passwordError = ref("");
const showPassword = ref(false);
const isLoading = ref(false);

watch(newPassword, () => {
  passwordError.value = "";
});

function close() {
  if (isLoading.value) return;
  resetForm();
  emit("close");
}

function resetForm() {
  newPassword.value = "";
  passwordError.value = "";
  showPassword.value = false;
  isLoading.value = false;
}

async function updatePassword() {
  if (!props.user || !props.user.id) {
    showAlert("Invalid user data", "error");
    return;
  }

  if (!newPassword.value) {
    passwordError.value = "Password cannot be empty";
    return;
  }

  if (newPassword.value.length < 6) {
    passwordError.value = "Password must be at least 6 characters long";
    return;
  }

  try {
    isLoading.value = true;

    const result = await window.api.hashPassword(newPassword.value);

    if (!result.success) {
      throw new Error(result.message || "Failed to hash password");
    }

    const hashedPassword = result.hash;

    const updateResult = await window.api.updatePassword({
      connectionId: props.connectionId,
      query: `UPDATE ${props.tableName} SET password = ? WHERE id = ?`,
      params: [hashedPassword, props.user.id]
    });

    if (!updateResult.success) {
      throw new Error(updateResult.message || "Failed to update password");
    }

    showAlert("Password updated successfully", "success");
    resetForm();
    emit("close");
  } catch (error) {
    console.error("Error updating password:", error);
    showAlert(`Error updating password: ${error.message}`, "error");
    isLoading.value = false;
  }
}
</script>
