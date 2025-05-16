<script setup lang="ts">
import { ref, onMounted, watch, toRaw, onUnmounted } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { useNavigation } from '@/composables/useNavigation';

const props = defineProps({
	projectId: {
		type: String,
		required: true
	},
	checkInterval: {
		type: Number,
		default: 5000
	}
});

const emit = defineEmits(['connection-valid']);
const timeoutId = ref<number | null>(null);
const connectionStore = useConnectionsStore();
const { goToMainPage } = useNavigation();
const showErrorModal = ref(false);
const isRetrying = ref(false);
const connectionResult = ref<{ success: boolean; message?: string } | null>(
	null
);

async function testConnection() {
	const selectedProject = connectionStore.getSelectedProject;

	if (!selectedProject) {
		showErrorModal.value = true;
		return;
	}

	try {
		isRetrying.value = true;
		const result = await window.ipcRenderer.testMySQLConnection(
			toRaw(selectedProject.db_config)
		);

		connectionResult.value = result;

		if (result.success) {
			showErrorModal.value = false;
			emit('connection-valid');
		} else {
			showErrorModal.value = true;
		}
	} catch (error) {
		showErrorModal.value = true;
	} finally {
		isRetrying.value = false;
		scheduleNextCheck();
	}
}

function scheduleNextCheck() {
	if (timeoutId.value) window.clearTimeout(timeoutId.value);
	timeoutId.value = window.setTimeout(testConnection, props.checkInterval);
}

function navigateToHome() {
	if (timeoutId.value) {
		window.clearTimeout(timeoutId.value);
		timeoutId.value = null;
	}
	goToMainPage();
}

watch(
	() => connectionStore.getSelectedProject,
	(project) => project && testConnection(),
	{ immediate: true }
);

onMounted(() => {
	if (connectionStore.getSelectedProject) testConnection();
});

onUnmounted(() => {
	if (timeoutId.value) {
		window.clearTimeout(timeoutId.value);
		timeoutId.value = null;
	}
});
</script>

<template>
	<div
		v-if="showErrorModal"
		class="connection-guard fixed inset-0 z-50"
	>
		<div class="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="card bg-base-300 w-[400px] shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-error">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="w-6 h-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
						Connection Error
					</h2>
					<div class="py-4">
						<p class="mb-4">
							The database connection is not available or has
							failed.
						</p>
						<div class="alert alert-error shadow-lg">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="stroke-current flex-shrink-0 h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<div>
									<h3 class="font-bold">
										Cannot Connect to Database
									</h3>
									<div
										class="text-xs"
										v-if="
											connectionResult &&
											connectionResult.message
										"
									>
										{{ connectionResult.message }}
									</div>
									<div
										class="text-xs"
										v-else
									>
										Please check your database configuration
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="flex gap-2 justify-between">
						<button
							class="btn"
							@click="navigateToHome"
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
							Back to Home
						</button>
						<button
							class="btn"
							@click="testConnection"
							:disabled="isRetrying"
						>
							<span
								v-if="isRetrying"
								class="loading loading-spinner loading-xs"
							></span>
							<svg
								v-else
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
									d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
								/>
							</svg>
							Retry Connection
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.connection-guard {
	pointer-events: all;
	user-select: none;
}
</style>
