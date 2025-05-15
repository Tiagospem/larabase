<script setup lang="ts">
import { computed, onMounted, ref, inject } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import DotEnvEditor from '@/components/DotEnvEditor.vue';
import Modal from '@/components/Modal.vue';

const emit = defineEmits<{
	close: [];
}>();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;
const connectionsStore = useConnectionsStore();

const projectPath = computed(
	() => connectionsStore.getSelectedProject?.projectPath
);
const envFilePath = computed(() =>
	projectPath.value ? `${projectPath.value}/.env` : ''
);

const envContent = ref('');
const originalContent = ref('');
const isLoading = ref(false);
let isSaving = ref(false);

const hasChanges = computed(() => {
	return envContent.value !== originalContent.value;
});

function handleClose() {
	emit('close');
}

async function loadEnvFile() {
	if (!envFilePath.value) return;

	isLoading.value = true;

	try {
		const result = await window.ipcRenderer.readFile(envFilePath.value);

		if (result.success) {
			envContent.value = result.content;
			originalContent.value = result.content;
			showAlert('File loaded successfully', 'success');
		} else {
			envContent.value = '';
			originalContent.value = '';
			showAlert(`Error: ${result.message || result.error}`, 'error');
		}
	} catch (error: any) {
		console.error('Error loading .env file:', error);
		showAlert(`Error: ${error.message || 'Unknown error'}`, 'error');
		envContent.value = '';
		originalContent.value = '';
	} finally {
		isLoading.value = false;
	}
}

async function saveEnvFile() {
	if (
		!envContent.value ||
		!hasChanges.value ||
		isSaving.value ||
		!envFilePath.value
	)
		return;

	isSaving.value = true;
	showAlert('Saving...', 'info');

	try {
		const result = await window.ipcRenderer.saveFile(
			envFilePath.value,
			envContent.value
		);

		if (result.success) {
			originalContent.value = envContent.value;
			showAlert('File saved successfully', 'success');
		} else {
			showAlert(`Error saving: ${result.message}`, 'error');
		}
	} catch (error: any) {
		console.error('Error saving .env file:', error);
		showAlert(`Error saving: ${error.message || 'Unknown error'}`, 'error');
	} finally {
		isSaving.value = false;
	}
}

onMounted(() => {
	loadEnvFile();
});
</script>

<template>
	<Modal
		:show="true"
		title=".env Editor"
		width="max-w-5xl"
		:show-footer="true"
		@close="handleClose"
	>
		<div class="mb-4 flex items-center gap-2">
			<div class="flex-1 text-sm opacity-75">
				<span v-if="envFilePath">{{ envFilePath }}</span>
			</div>
		</div>

		<div
			v-if="!projectPath"
			class="flex h-64 items-center justify-center"
		>
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="mx-auto mb-4 h-12 w-12"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v .776"
					/>
				</svg>
				<p>No Laravel project path selected</p>
			</div>
		</div>

		<div
			v-else-if="isLoading"
			class="flex h-64 items-center justify-center"
		>
			<span class="loading loading-spinner loading-lg"></span>
		</div>

		<div
			v-else-if="!envContent && !isLoading"
			class="flex h-64 items-center justify-center"
		>
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="text-warning mx-auto mb-4 h-12 w-12"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
					/>
				</svg>
				<p>Could not load .env file</p>
				<button
					class="btn btn-sm mt-4"
					@click="loadEnvFile"
				>
					Retry
				</button>
			</div>
		</div>

		<div
			v-else
			class="h-[60vh]"
		>
			<DotEnvEditor v-model="envContent" />
		</div>

		<template #footer>
			<button
				class="btn btn-ghost"
				@click="handleClose"
			>
				Close
			</button>
			<button
				class="btn btn-primary"
				:disabled="isLoading || !envContent || !hasChanges || isSaving"
				@click="saveEnvFile"
			>
				<span
					v-if="isSaving"
					class="loading loading-spinner loading-xs mr-2"
				></span>
				<svg
					v-else
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="mr-1 h-4 w-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"
					/>
				</svg>
				Save
			</button>
		</template>
	</Modal>
</template>
