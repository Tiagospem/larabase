<script setup lang="ts">
import Modal from '@/components/Modal.vue';
import { ref, onMounted, onBeforeUnmount, toRaw } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { useTabsStore } from '@/store/tabs';
import { useSidebarStore } from '@/store/sidebar';
import { AppConnection } from '@/types/ssh-connection';

const emit = defineEmits(['close']);

const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();
const sidebarStore = useSidebarStore();

const isLoading = ref(true);
const logs = ref<any[]>([]);
const maxLogs = 500;
const error = ref<string | null>(null);
const isMonitoring = ref(false);
const selectedLog = ref<any | null>(null);
const showDetailsModal = ref(false);

function formatDetails(details: string): string {
	if (!details) return '';

	try {
		const parsed = JSON.parse(details);
		return JSON.stringify(parsed, null, 2);
	} catch (e) {
		return details;
	}
}

function viewLogDetails(log: any) {
	selectedLog.value = log;
	showDetailsModal.value = true;
}

async function startMonitoring(clearHistory = false) {
	const projectId = connectionsStore.projectId;
	if (!projectId) return;

	try {
		isLoading.value = true;
		error.value = null;

		if (clearHistory) {
			logs.value = [];
		}

		const project = connectionsStore.connections.find(
			(p) => p.id === projectId
		);

		if (!project) {
			error.value = 'Project not found';
			isLoading.value = false;
			return;
		}

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const result = await window.ipcRenderer.startLiveDbUpdate({
			connectionId: projectId,
			appConnection: AppConnection,
			clearHistory
		});

		if (!result.success) {
			error.value = result.message;
			isLoading.value = false;
			return;
		}

		isMonitoring.value = true;
	} catch (err: any) {
		error.value = err.message || 'Failed to start monitoring';
	} finally {
		isLoading.value = false;
	}
}

async function clearHistory() {
	const projectId = connectionsStore.projectId;
	if (!projectId) return;

	try {
		isLoading.value = true;
		error.value = null;

		const result = await window.ipcRenderer.invoke(
			'clear-db-history',
			projectId
		);

		if (!result.success) {
			error.value = result.message;

			if (result.connectionLost) {
				isMonitoring.value = false;
				const shouldRestart = confirm(
					'Database connection was lost. Would you like to restart monitoring?'
				);
				if (shouldRestart) {
					await startMonitoring(true);
				}
			}

			isLoading.value = false;
			return;
		}

		logs.value = [];
	} catch (err: any) {
		error.value = err.message || 'Failed to clear history';
	} finally {
		isLoading.value = false;
	}
}

function formatTimestamp(timestamp: string) {
	if (!timestamp) return '';

	const date = new Date(timestamp);

	return date.toLocaleTimeString();
}

function formatFullDate(timestamp: string) {
	if (!timestamp) return '';

	const date = new Date(timestamp);

	return date.toLocaleString();
}

function getActionBadgeClass(action: string) {
	switch (action) {
		case 'INSERT':
			return 'badge-success';
		case 'UPDATE':
			return 'badge-info';
		case 'DELETE':
			return 'badge-error';
		default:
			return 'badge-ghost';
	}
}

async function openTableWithFilter(tableName: string, recordId: string) {
	if (!recordId || recordId === 'no-id') return;

	const table = sidebarStore.sortedTables.find((t) => t.name === tableName);

	if (table) {
		await tabsStore.openTable(table, `id = '${recordId}'`);
	}
}

function setupListeners() {
	const projectId = connectionsStore.projectId;
	if (!projectId) return;

	window.ipcRenderer.on(`db-operation-${projectId}`, (_, record) => {
		logs.value.unshift(record);

		if (logs.value.length > maxLogs) {
			logs.value = logs.value.slice(0, maxLogs);
		}
	});

	window.ipcRenderer.on(`db-operation-clear-${projectId}`, () => {
		logs.value = [];
	});
}

function cleanupListeners() {
	const projectId = connectionsStore.projectId;
	if (!projectId) return;

	window.ipcRenderer.removeAllListeners(`db-operation-${projectId}`);
	window.ipcRenderer.removeAllListeners(`db-operation-clear-${projectId}`);
}

function handleClose() {
	emit('close');
	cleanupAndReset();
}

async function cleanupAndReset() {
	try {
		cleanupListeners();

		const projectId = connectionsStore.projectId;
		if (projectId) {
			await window.ipcRenderer.invoke('stop-db-monitoring', projectId);
		}

		isMonitoring.value = false;
		isLoading.value = true;
		error.value = null;
	} catch (error) {
		console.error('Error during cleanup:', error);
	}
}

onMounted(() => {
	isMonitoring.value = false;
	isLoading.value = true;
	error.value = null;

	setupListeners();
	startMonitoring(false);
});

onBeforeUnmount(() => {
	cleanupAndReset();
});
</script>

<template>
	<Modal
		title="Database Activity Monitor"
		:show="true"
		:allowCloseOnBackdrop="true"
		:showFooter="true"
		:show-cancel-button="false"
		@close="handleClose"
	>
		<div
			v-if="isLoading"
			class="flex h-[400px] w-full items-center justify-center"
		>
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>

		<div
			v-else
			class="flex flex-col"
		>
			<div class="flex justify-end px-4 py-2">
				<button
					class="btn btn-sm mr-2"
					@click="startMonitoring(true)"
					:disabled="isLoading"
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
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
					Refresh
				</button>

				<button
					v-if="logs.length > 0"
					class="btn btn-sm btn-warning mr-2"
					@click="clearHistory"
					:disabled="isLoading || logs.length === 0"
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
					Clear History
				</button>
			</div>

			<div
				v-if="error"
				class="alert alert-error mb-4 mx-4"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
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
				<span>{{ error }}</span>
			</div>

			<div class="overflow-y-hidden">
				<div
					v-if="logs.length === 0"
					class="flex h-full w-full items-center justify-center"
				>
					<div class="text-center">
						<h3 class="text-sm font-medium">
							No database activity yet
						</h3>
						<p class="text-base-content/70 mt-2 text-xs">
							Perform database operations to see them appear here
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
									<th class="text-center">Action</th>
									<th>Table</th>
									<th>Record ID</th>
									<th class="text-center">Time</th>
									<th
										class="text-center"
										colspan="2"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(log, index) in logs"
									:key="log.id || index"
									class="hover:bg-base-200"
								>
									<td class="text-center">
										<span
											class="badge badge-xs"
											:class="
												getActionBadgeClass(
													log.action_type
												)
											"
										>
											{{ log.action_type }}
										</span>
									</td>
									<td class="text-xs">
										{{ log.table_name }}
									</td>
									<td class="text-xs">
										<span
											v-if="
												log.record_id &&
												log.record_id !== 'no-id'
											"
										>
											{{ log.record_id }}
										</span>
										<span
											v-else
											class="opacity-50"
											>{{ log.record_id }}</span
										>
									</td>
									<td
										class="text-center whitespace-nowrap text-xs"
										:title="formatFullDate(log.created_at)"
									>
										{{ formatTimestamp(log.created_at) }}
									</td>
									<td class="text-center">
										<div
											class="flex justify-center space-x-2"
										>
											<button
												class="btn btn-xs btn-ghost"
												@click="viewLogDetails(log)"
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
										</div>
									</td>
									<td class="text-center">
										<button
											v-if="
												log.record_id &&
												log.record_id !== 'no-id'
											"
											class="btn btn-xs btn-ghost"
											@click="
												openTableWithFilter(
													log.table_name,
													log.record_id
												)
											"
											title="Open in Table"
										>
											<svg
												class="h-3 w-3"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
												/>
											</svg>
										</button>
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
				<div class="text-xs flex items-center gap-2">
					<div
						class="badge badge-xs"
						:class="
							isLoading
								? 'badge-warning'
								: isMonitoring
									? 'badge-success'
									: 'badge-error'
						"
					>
						<span v-if="isLoading">Loading</span>
						<span v-else-if="isMonitoring">Monitoring</span>
						<span v-else>Inactive</span>
					</div>
					<span>{{ logs.length }} events recorded</span>
				</div>
			</div>
		</div>
	</Modal>

	<Modal
		v-if="showDetailsModal && selectedLog"
		title="Database Operation Details"
		:show="showDetailsModal"
		:allowCloseOnBackdrop="true"
		@close="showDetailsModal = false"
	>
		<div class="mb-4 flex justify-between">
			<div>
				<span
					class="badge ml-2"
					:class="getActionBadgeClass(selectedLog.action_type)"
				>
					{{ selectedLog.action_type }}
				</span>
				<span class="ml-2">{{ selectedLog.table_name }}</span>
			</div>
			<div class="text-xs opacity-70">
				{{ formatFullDate(selectedLog.created_at) }}
			</div>
		</div>
		<div
			class="bg-base-100 max-h-[350px] flex-1 overflow-auto rounded-md p-4"
		>
			<div class="mb-3">
				<span class="font-medium text-sm">Record ID:</span>
				<span class="ml-2 font-mono text-sm">{{
					selectedLog.record_id
				}}</span>
			</div>
			<pre class="font-mono text-xs whitespace-pre-wrap">{{
				formatDetails(selectedLog.details)
			}}</pre>
		</div>
		<template #footer>
			<button
				v-if="
					selectedLog.record_id && selectedLog.record_id !== 'no-id'
				"
				class="btn btn-primary"
				@click="
					openTableWithFilter(
						selectedLog.table_name,
						selectedLog.record_id
					);
					showDetailsModal = false;
				"
			>
				<svg
					class="h-4 w-4 mr-2"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
					/>
				</svg>
				Open in Table
			</button>
			<button
				class="btn"
				@click="showDetailsModal = false"
			>
				Close
			</button>
		</template>
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
