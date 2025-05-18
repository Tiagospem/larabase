<script setup lang="ts">
import { ref, toRaw, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import { inject } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { AppConnection } from '@/types/ssh-connection';

const props = defineProps({
	show: {
		type: Boolean,
		required: true
	},
	record: {
		type: Object,
		required: true
	},
	tableName: {
		type: String,
		required: true
	},
	tableStructure: {
		type: Array,
		required: true
	}
});

const emit = defineEmits(['close', 'refresh']);

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;
const connectionStore = useConnectionsStore();

const newPassword = ref('');
const passwordError = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const rounds = ref(10);

watch(newPassword, () => {
	passwordError.value = '';
});

function close() {
	if (isLoading.value) return;
	resetForm();
	emit('close');
}

function resetForm() {
	newPassword.value = '';
	passwordError.value = '';
	showPassword.value = false;
	isLoading.value = false;
}

async function updatePassword() {
	if (!props.record || !props.record.id) {
		showAlert('Invalid user data', 'error');
		return;
	}

	if (!newPassword.value) {
		passwordError.value = 'Password cannot be empty';
		return;
	}

	if (newPassword.value.length < 6) {
		passwordError.value = 'Password must be at least 6 characters long';
		return;
	}

	const project = connectionStore.getSelectedProject;

	try {
		isLoading.value = true;

		const result = await window.ipcRenderer.hashPassword(
			newPassword.value,
			rounds.value
		);

		if (!result.success) {
			showAlert(result.message || 'Failed to hash password', 'error');

			return;
		}

		const hashedPassword = result.hash;

		if (!project?.dbConfig) {
			showAlert('No database connection available', 'error');

			return;
		}

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const updateResult = await window.ipcRenderer.updateTableRecord({
			appConnection: AppConnection,
			tableName: props.tableName,
			data: { password: hashedPassword },
			id: props.record.id
		});

		if (!updateResult.success) {
			showAlert(
				updateResult.message || 'Failed to update password',
				'error'
			);
			return;
		}

		showAlert('Password updated successfully', 'success');

		resetForm();

		emit('refresh');

		emit('close');
	} catch (error: any) {
		showAlert(`Error updating password: ${error.message}`, 'error');
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<Modal
		width="md"
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
				<p class="mb-2 font-medium">
					User:
					{{
						record
							? record.name || record.email || `ID: ${record.id}`
							: ''
					}}
				</p>
				<div class="bg-base-200 mb-4 rounded-md p-2 text-xs">
					<p>
						This will update the password for this user and hash it
						using Laravel's bcrypt hashing.
					</p>
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
					<span class="label-text-alt text-error">{{
						passwordError
					}}</span>
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

			<fieldset class="fieldset w-full">
				<label class="label">
					<span class="label-text">Encryption Rounds</span>
				</label>
				<div class="flex">
					<input
						v-model.number="rounds"
						type="number"
						min="4"
						max="15"
						class="input input-bordered w-full"
						:disabled="isLoading"
					/>
				</div>
			</fieldset>
		</div>
	</Modal>
</template>
