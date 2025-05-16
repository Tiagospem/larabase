<script setup lang="ts">
import { ref, onMounted, inject, watch } from 'vue';
import { useCommandsStore, LaravelCommand } from '@/store/commands';
import { useConnectionsStore } from '@/store/connections';
import Modal from '@/components/Modal.vue';
import terminalService from '@/services/terminal';

const props = defineProps({
	show: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['close']);
const commandsStore = useCommandsStore();
const connectionsStore = useConnectionsStore();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const searchTerm = ref('');
const searchTimeout = ref<number | null>(null);
const refreshing = ref(false);
const showFlagsModal = ref(false);
const selectedCommand = ref<LaravelCommand | null>(null);
const commandFlags = ref('');

function handleClose() {
	emit('close');
}

async function refreshCommands() {
	refreshing.value = true;
	try {
		await commandsStore.fetchCommands();
		updateFilteredCommands();
	} catch (error: any) {
		showAlert(`Failed to refresh commands: ${error.message}`, 'error');
	} finally {
		refreshing.value = false;
	}
}

function openFileInEditor(path: string) {
	try {
		window.ipcRenderer.openFile(path);
	} catch (error: any) {
		console.error('Error opening file:', error);
		showAlert('Failed to open file', 'error');
	}
}

function runCommand(command: LaravelCommand) {
	selectedCommand.value = command;

	let signature = command.signature || '';
	let fullSignature = signature;

	const hasParameters =
		signature.includes('{') ||
		signature.includes('[') ||
		signature.includes('--') ||
		signature.includes('-');

	if (hasParameters) {
		selectedCommand.value = {
			...command,
			signature: fullSignature
		};
		showFlagsModal.value = true;
	} else {
		if (signature.includes(' ')) {
			signature = signature.split(' ')[0];
		}
		executeCommand(signature);
	}
}

async function executeCommand(commandSignature: string) {
	const projectPath = connectionsStore.getSelectedProject?.projectPath;

	if (!projectPath) {
		showAlert('No project selected', 'error');
		return;
	}

	let cleanSignature = commandSignature
		.replace(/{[^}]+}/g, '')
		.replace(/\[[^\]]+\]/g, '')
		.trim();

	const artisanCommand =
		`php artisan ${cleanSignature} ${commandFlags.value}`.trim();

	try {
		const success = await terminalService.executeCommand(
			artisanCommand,
			projectPath
		);

		if (success) {
			showAlert(`Command executed successfully`, 'success');
		} else {
			showAlert(`Command execution failed`, 'error');
		}
	} catch (error: any) {
		showAlert(`Error executing command: ${error.message}`, 'error');
	} finally {
		closeFlagsModal();
	}
}

function closeFlagsModal() {
	showFlagsModal.value = false;
	commandFlags.value = '';
	selectedCommand.value = null;
}

function confirmRunWithFlags() {
	if (selectedCommand.value && selectedCommand.value.signature) {
		executeCommand(selectedCommand.value.signature);
	}
}

function getCleanSignature(command: LaravelCommand | null): string {
	if (!command || !command.signature) return '';

	let baseCommand = command.signature;
	if (baseCommand.includes(' ')) {
		baseCommand = baseCommand.split(' ')[0];
	}

	return baseCommand
		.replace(/{[^}]+}/g, '')
		.replace(/\[[^\]]+]/g, '')
		.trim();
}

function debounceSearch() {
	if (searchTimeout.value) {
		clearTimeout(searchTimeout.value);
	}

	searchTimeout.value = window.setTimeout(() => {
		updateFilteredCommands();
		searchTimeout.value = null;
	}, 300);
}

const filteredCommands = ref<LaravelCommand[]>([]);

function updateFilteredCommands() {
	if (!searchTerm.value) {
		filteredCommands.value = [...commandsStore.commands];
		return;
	}

	const search = searchTerm.value.toLowerCase();
	filteredCommands.value = commandsStore.commands.filter(
		(command) =>
			command.name.toLowerCase().includes(search) ||
			(command.signature &&
				command.signature.toLowerCase().includes(search)) ||
			command.relativePath.toLowerCase().includes(search)
	);
}

watch(
	() => commandsStore.commands,
	() => {
		updateFilteredCommands();
	},
	{ deep: true }
);

watch(
	() => props.show,
	(newVal) => {
		if (newVal && connectionsStore.getSelectedProject?.projectPath) {
			refreshCommands();
		}
	}
);

onMounted(async () => {
	if (props.show && connectionsStore.getSelectedProject?.projectPath) {
		try {
			await commandsStore.fetchCommands();
			updateFilteredCommands();
		} catch (error: any) {
			showAlert(`Failed to load commands: ${error.message}`, 'error');
		}
	}
});

function getParameterList(
	signature: string,
	startChar: string,
	endChar: string
): string {
	const regex = new RegExp(`\\${startChar}[^${endChar}]+\\${endChar}`, 'g');
	const parameters = signature.match(regex) || [];
	return parameters
		.map((param) =>
			param
				.replace(new RegExp(`\\${startChar}|\\${endChar}`, 'g'), '')
				.trim()
		)
		.join(', ');
}
</script>

<template>
	<Modal
		title="Laravel Commands"
		:show="show"
		:allowCloseOnBackdrop="true"
		:showFooter="true"
		:show-cancel-button="false"
		@close="handleClose"
	>
		<div class="flex flex-col">
			<div class="flex justify-end px-4 py-2">
				<button
					class="btn btn-sm mr-2"
					@click="refreshCommands"
					:disabled="refreshing"
				>
					<span
						v-if="refreshing"
						class="loading loading-spinner loading-xs mr-1"
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
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
					Refresh
				</button>
			</div>

			<div class="bg-base-200 m-2 grid grid-cols-1 gap-4 rounded-md p-4">
				<div class="flex flex-col gap-1">
					<label class="label">
						<span class="label-text text-xs">Search Commands</span>
					</label>
					<div class="relative">
						<input
							v-model="searchTerm"
							type="search"
							placeholder="Type to search..."
							class="input input-bordered w-full"
							@input="debounceSearch"
						/>
					</div>
				</div>
			</div>

			<div class="overflow-y-hidden">
				<div
					v-if="commandsStore.isLoading"
					class="flex h-full w-full items-center justify-center"
				>
					<div
						class="loading loading-spinner loading-lg text-primary"
					></div>
				</div>

				<div
					v-else-if="commandsStore.error"
					class="flex h-full w-full items-center justify-center"
				>
					<div class="text-center">
						<h3 class="text-error text-lg font-medium">
							{{ commandsStore.error }}
						</h3>
					</div>
				</div>

				<div
					v-else-if="
						!commandsStore.commands ||
						commandsStore.commands.length === 0
					"
					class="flex h-full w-full items-center justify-center"
				>
					<div class="text-center">
						<h3 class="text-sm font-medium">No commands found</h3>
						<p class="text-base-content/70 mt-2 text-xs">
							Custom Laravel commands should be in
							app/Console/Commands directory
						</p>
					</div>
				</div>

				<div
					v-else
					class="h-[300px]"
				>
					<div class="max-h-full overflow-x-auto">
						<table
							class="table-pin-rows table-compact table w-full text-sm"
						>
							<thead
								class="bg-base-100 sticky top-0 z-10 shadow-md"
							>
								<tr>
									<th class="w-12 text-center">#</th>
									<th>Class</th>
									<th>Command Signature</th>
									<th class="text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(command, index) in filteredCommands"
									:key="index"
									class="hover:bg-base-200"
								>
									<td class="text-center text-xs">
										{{ index + 1 }}
									</td>
									<td class="font-mono text-xs">
										{{ command.name }}
									</td>
									<td class="font-mono text-xs">
										{{ command.signature || '-' }}
									</td>
									<td class="text-center">
										<div
											class="flex justify-center space-x-2"
										>
											<button
												v-if="command.signature"
												class="btn btn-xs btn-success"
												@click="runCommand(command)"
												title="Run Command"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="h-3 w-3"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
													/>
												</svg>
											</button>
											<button
												class="btn btn-xs btn-ghost"
												@click="
													openFileInEditor(
														command.path
													)
												"
												title="Open File"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="h-3 w-3"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
													/>
												</svg>
											</button>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div
				class="bg-base-300 border-base-300 flex items-center justify-between border-t p-4"
			>
				<div class="text-xs">
					{{ commandsStore.commands.length }} Commands found
					<span v-if="searchTerm">(filtered)</span>
				</div>
			</div>
		</div>
	</Modal>

	<Modal
		v-if="showFlagsModal && selectedCommand"
		title="Run Command With Options"
		:show="showFlagsModal"
		:allowCloseOnBackdrop="true"
		:showFooter="true"
		:show-cancel-button="true"
		action-button-text="Run Command"
		:show-action-button="true"
		@close="closeFlagsModal"
		@action="confirmRunWithFlags"
	>
		<div class="">
			<div class="mb-4">
				<p class="font-bold mb-2">Command:</p>
				<div class="bg-base-200 p-2 rounded font-mono text-sm">
					php artisan {{ getCleanSignature(selectedCommand) }}
					<span class="text-primary">{{ commandFlags }}</span>
				</div>
			</div>

			<div class="mb-4">
				<label class="block mb-2 text-sm">
					Command Flags/Options (optional):
				</label>
				<input
					v-model="commandFlags"
					type="text"
					class="input input-bordered w-full"
					placeholder="--option=value --flag"
					@keydown.enter="confirmRunWithFlags"
				/>
			</div>

			<div class="text-xs text-base-content/70 mt-4">
				<p>
					This command will be executed within your Laravel project
					directory.
				</p>

				<div v-if="selectedCommand.signature">
					<p class="font-semibold my-2">Command Information:</p>
					<p v-if="selectedCommand.signature.includes('{')">
						<span class="text-warning">Required parameters:</span>
						{{
							getParameterList(
								selectedCommand.signature,
								'{',
								'}'
							)
						}}
					</p>
					<p v-if="selectedCommand.signature.includes('[')">
						<span class="text-success">Optional parameters:</span>
						{{
							getParameterList(
								selectedCommand.signature,
								'[',
								']'
							)
						}}
					</p>
				</div>
			</div>
		</div>
	</Modal>
</template>

<style scoped>
th,
td {
	white-space: nowrap;
	padding: 0.25rem 0.5rem;
	box-sizing: border-box;
}

.table {
	border-collapse: separate;
	border-spacing: 0;
	width: max-content;
	min-width: 100%;
}

.overflow-x-auto {
	width: 100%;
	overflow-x: auto;
}

.table thead th {
	position: sticky;
	top: 0;
	z-index: 10;
	font-weight: normal;
}

.table-pin-rows thead {
	position: sticky;
	top: 0;
	z-index: 10;
}

tbody {
	overflow: hidden;
}
</style>
