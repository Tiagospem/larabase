<script setup lang="ts">
import { ref, onMounted, inject, onUnmounted } from 'vue';
import { useProjectLogsStore } from '@/store/projectLogs';
import { useConnectionsStore } from '@/store/connections';
import Modal from '@/components/Modal.vue';
import { LogEntry } from '@/types/project';

const emit = defineEmits(['close']);
const logsStore = useProjectLogsStore();
const connectionsStore = useConnectionsStore();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const selectedLogEntry = ref<LogEntry | null>(null);
const showLogDetail = ref(false);
const searchTimeout = ref<number | null>(null);
const refreshing = ref(false);
const showDeleteConfirm = ref(false);
const logToDelete = ref<LogEntry | null>(null);
const deleteAllConfirm = ref(false);
const deleteFileConfirm = ref(false);

function handleClose() {
	emit('close');
}

function getLogLevelClass(level: string) {
	switch (level) {
		case 'ERROR':
			return 'badge-error';
		case 'WARNING':
			return 'badge-warning';
		case 'INFO':
			return 'badge-info';
		case 'DEBUG':
			return 'badge-ghost';
		default:
			return 'badge-primary';
	}
}

function viewLogDetail(entry: LogEntry) {
	selectedLogEntry.value = entry;
	showLogDetail.value = true;
}

function formatSize(bytes: number): string {
	if (bytes === 0) return '0 B';

	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));

	return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

async function openFileInEditor(path: string) {
	try {
		await window.ipcRenderer.openFile(path);
	} catch (error: any) {
		console.error('Error opening file:', error);
		showAlert('Failed to open file', 'error');
	}
}

async function refreshLogs() {
	refreshing.value = true;
	try {
		await logsStore.refreshLogs();
	} catch (error: any) {
		showAlert(`Failed to refresh logs: ${error.message}`, 'error');
	} finally {
		refreshing.value = false;
	}
}

async function deleteLogEntry(entry: LogEntry) {
	logToDelete.value = entry;
	showDeleteConfirm.value = true;
}

async function confirmDeleteLog() {
	try {
		if (logToDelete.value) {
			const result = await logsStore.deleteLogEntry(logToDelete.value);

			if (result && result.success) {
				showAlert('Log entry deleted successfully', 'success');

				if (logsStore.selectedLogFile) {
					await logsStore.loadLogFileContent(
						logsStore.selectedLogFile.path
					);
				}
			} else {
				showAlert(
					`Failed to delete log entry: ${result?.message || 'Unknown error'}`,
					'error'
				);
			}
		}
	} catch (error: any) {
		console.error('Error deleting log entry:', error);
		showAlert(`Failed to delete log entry: ${error.message}`, 'error');
	} finally {
		showDeleteConfirm.value = false;
		logToDelete.value = null;
	}
}

async function confirmDeleteAllLogs() {
	try {
		const result = await logsStore.clearAllLogs();

		if (result && result.success) {
			showAlert('All logs cleared successfully', 'success');
		} else {
			showAlert(
				`Failed to clear logs: ${result?.message || 'Unknown error'}`,
				'error'
			);
		}
	} catch (error: any) {
		console.error('Error clearing all logs:', error);
		showAlert(`Failed to clear logs: ${error.message}`, 'error');
	} finally {
		deleteAllConfirm.value = false;
	}
}

async function deleteLogFile() {
	if (!logsStore.selectedLogFile) {
		showAlert('No log file selected', 'error');
		return;
	}

	deleteFileConfirm.value = true;
}

async function confirmDeleteFile() {
	try {
		if (!logsStore.selectedLogFile) {
			showAlert('No log file selected', 'error');
			return;
		}

		const result = await window.ipcRenderer.deleteLogFile(
			logsStore.selectedLogFile.path
		);

		if (result.success) {
			showAlert('Log file deleted successfully', 'success');
			logsStore.selectedLogFile = null;
			logsStore.logEntries = [];
			await logsStore.loadLogFiles();
		} else {
			showAlert(`Failed to delete log file: ${result.message}`, 'error');
		}
	} catch (error: any) {
		console.error('Error deleting log file:', error);
		showAlert(`Failed to delete log file: ${error.message}`, 'error');
	} finally {
		deleteFileConfirm.value = false;
	}
}

function debounceSearch() {
	if (searchTimeout.value) {
		clearTimeout(searchTimeout.value);
	}

	searchTimeout.value = window.setTimeout(() => {
		logsStore.filterLogs(false);
		searchTimeout.value = null;
	}, 300);
}

function closeLogDetail() {
	showLogDetail.value = false;
	showDeleteConfirm.value = false;
	deleteAllConfirm.value = false;
	deleteFileConfirm.value = false;
}

onMounted(async () => {
	if (connectionsStore.getSelectedProject?.projectPath) {
		try {
			await logsStore.loadLogFiles();
		} catch (error: any) {
			showAlert(`Failed to load logs: ${error.message}`, 'error');
		}
	} else {
		showAlert('No project selected', 'error');
	}
});

onUnmounted(() => {
	if (searchTimeout.value) {
		clearTimeout(searchTimeout.value);
	}
});
</script>

<template>
	<Modal
		title="Project Logs"
		:show="true"
		:allowCloseOnBackdrop="true"
		:showFooter="true"
		:show-cancel-button="false"
		@close="handleClose"
	>
		<div class="flex flex-col">
			<div class="flex justify-end px-4 py-2">
				<button
					class="btn btn-sm mr-2"
					@click="refreshLogs"
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

				<button
					v-if="logsStore.selectedLogFile"
					class="btn btn-sm mr-2"
					@click="openFileInEditor(logsStore.selectedLogFile.path)"
				>
					<svg
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
							d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
						/>
					</svg>
					Open File
				</button>

				<button
					v-if="logsStore.selectedLogFile"
					class="btn btn-sm btn-warning mr-2"
					@click="deleteLogFile"
					title="Delete Current Log File"
				>
					<svg
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
							d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
						/>
					</svg>
					Delete File
				</button>

				<button
					class="btn btn-sm btn-error mr-2"
					@click="deleteAllConfirm = true"
					title="Clear All Logs"
					v-if="logsStore.logEntries.length > 0"
				>
					<svg
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
							d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
						/>
					</svg>
					Clear All
				</button>
			</div>

			<div
				class="bg-base-200 m-2 grid grid-cols-1 gap-4 rounded-md p-4 md:grid-cols-3"
			>
				<div class="flex flex-col gap-1">
					<label class="label">
						<span class="label-text text-xs">Log File</span>
					</label>
					<select
						v-model="logsStore.selectedLogFile"
						class="select select-bordered w-full"
						@change="logsStore.filterLogs(false)"
					>
						<option
							v-if="logsStore.logFiles.length === 0"
							disabled
							value=""
						>
							No log files found
						</option>
						<option
							v-for="file in logsStore.logFiles"
							:key="file.path"
							:value="file"
							class="text-sm"
						>
							{{ file.name }} ({{ formatSize(file.size) }})
						</option>
					</select>
				</div>

				<div class="flex flex-col gap-1">
					<label class="label">
						<span class="label-text text-xs">Log Level</span>
					</label>
					<select
						v-model="logsStore.selectedLogType"
						class="select select-bordered w-full"
						@change="logsStore.filterLogs(false)"
					>
						<option
							v-for="type in logsStore.availableLogTypes"
							:key="type"
							:value="type"
						>
							{{ type }}
						</option>
					</select>
				</div>

				<div class="flex flex-col gap-1">
					<label class="label">
						<span class="label-text text-xs">Search</span>
					</label>
					<div class="relative">
						<input
							v-model="logsStore.searchTerm"
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
					v-if="logsStore.isLoading"
					class="flex h-full w-full items-center justify-center"
				>
					<div
						class="loading loading-spinner loading-lg text-primary"
					></div>
				</div>

				<div
					v-else-if="logsStore.error"
					class="flex h-full w-full items-center justify-center"
				>
					<div class="text-center">
						<h3 class="text-error text-lg font-medium">
							{{ logsStore.error }}
						</h3>
					</div>
				</div>

				<div
					v-else-if="
						!logsStore.logEntries ||
						logsStore.logEntries.length === 0
					"
					class="flex h-full w-full items-center justify-center"
				>
					<div class="text-center">
						<h3 class="text-sm font-medium">No logs found</h3>
						<p
							v-if="
								logsStore.searchTerm ||
								logsStore.selectedLogType !== 'ALL'
							"
							class="text-base-content/70 mt-2 text-xs"
						>
							Try changing your search criteria
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
									<th class="text-center">Level</th>
									<th>Message</th>
									<th class="text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(
										entry, index
									) in logsStore.paginatedEntries"
									:key="index"
									class="hover:bg-base-200"
								>
									<td class="text-center">
										{{
											(logsStore.currentPage - 1) *
												logsStore.itemsPerPage +
											index +
											1
										}}
									</td>
									<td class="text-center">
										<span
											class="badge badge-xs"
											:class="
												getLogLevelClass(entry.level)
											"
										>
											{{ entry.level }}
										</span>
									</td>
									<td
										class="max-w-xs truncate font-mono text-xs"
									>
										{{ entry.message }}
									</td>
									<td class="text-center">
										<div
											class="flex justify-center space-x-2"
										>
											<button
												class="btn btn-xs btn-ghost"
												@click="viewLogDetail(entry)"
												title="View Details"
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
														d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
													/>
												</svg>
											</button>
											<button
												class="btn btn-xs btn-ghost"
												@click="deleteLogEntry(entry)"
												title="Delete"
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
														d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
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
					{{ logsStore.selectedLogFile?.name }} |
					{{ logsStore.logEntries.length }} entries
					<span
						v-if="
							logsStore.searchTerm ||
							logsStore.selectedLogType !== 'ALL'
						"
						>(filtered)</span
					>
				</div>

				<div
					class="flex items-center space-x-2"
					v-if="logsStore.totalPages > 1"
				>
					<button
						class="btn btn-sm btn-ghost"
						@click="logsStore.prevPage()"
						:disabled="logsStore.currentPage === 1"
					>
						&laquo;
					</button>

					<span class="text-sm">
						Page {{ logsStore.currentPage }} of
						{{ logsStore.totalPages }}
					</span>

					<button
						class="btn btn-sm btn-ghost"
						@click="logsStore.nextPage()"
						:disabled="
							logsStore.currentPage === logsStore.totalPages
						"
					>
						&raquo;
					</button>
				</div>
			</div>
		</div>
	</Modal>

	<Modal
		v-if="showLogDetail && selectedLogEntry"
		title="Log Entry Details"
		:show="showLogDetail"
		:allowCloseOnBackdrop="true"
		@close="closeLogDetail"
	>
		<div class="mb-4 flex justify-between">
			<div>
				<span
					class="badge ml-2"
					:class="getLogLevelClass(selectedLogEntry.level)"
				>
					{{ selectedLogEntry.level }}
				</span>
			</div>
		</div>
		<div
			class="bg-base-100 max-h-[350px] flex-1 overflow-auto rounded-md p-4"
		>
			<pre class="font-mono text-xs whitespace-pre-wrap">{{
				selectedLogEntry.content.join('\n')
			}}</pre>
		</div>
		<template #footer>
			<button
				class="btn"
				@click="closeLogDetail"
			>
				Close
			</button>
		</template>
	</Modal>

	<Modal
		v-if="showDeleteConfirm && logToDelete"
		title="Delete Log Entry"
		:show="showDeleteConfirm"
		:allowCloseOnBackdrop="true"
		@close="showDeleteConfirm = false"
		action-button-text="Delete"
		@action="confirmDeleteLog"
		:show-action-button="true"
	>
		<div class="mb-4">
			<p>Are you sure you want to delete this specific log entry?</p>
			<div class="bg-base-200 mt-2 rounded p-2">
				<p class="truncate font-mono text-xs">
					{{ logToDelete?.message }}
				</p>
			</div>
		</div>
	</Modal>

	<Modal
		v-if="deleteAllConfirm"
		title="Clear All Logs"
		:show="deleteAllConfirm"
		:allowCloseOnBackdrop="true"
		@close="deleteAllConfirm = false"
		action-button-text="Clear"
		@action="confirmDeleteAllLogs"
		:show-action-button="true"
	>
		<div class="mb-4">
			<p>Are you sure you want to clear the content of all logs?</p>
		</div>
	</Modal>

	<Modal
		v-if="deleteFileConfirm && logsStore.selectedLogFile"
		title="Delete Log File"
		:show="deleteFileConfirm"
		:allowCloseOnBackdrop="true"
		@close="deleteFileConfirm = false"
		action-button-text="Delete File"
		@action="confirmDeleteFile"
		:show-action-button="true"
	>
		<div class="mb-4">
			<p>Are you sure you want to delete the entire log file?</p>
			<div class="bg-base-200 mt-2 rounded p-2">
				<p class="font-mono text-xs">
					{{ logsStore.selectedLogFile.name }}
				</p>
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

.table th:nth-child(3),
.table td:nth-child(3) {
	max-width: 400px;
}
</style>
