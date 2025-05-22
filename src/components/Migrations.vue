<script setup lang="ts">
import { ref, onMounted, computed, toRaw, inject } from 'vue';
import Modal from '@/components/Modal.vue';
import PhpViewer from '@/components/PhpViewer.vue';
import { useConnectionsStore } from '@/store/connections';
import terminalService from '@/services/terminal';
import { AppConnection } from '@/types/ssh-connection';

const emit = defineEmits(['close', 'migrations-updated']);
const connectionsStore = useConnectionsStore();
const selectedProject = computed(() => connectionsStore.getSelectedProject);
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const isLoading = ref(true);
const isRunning = ref(false);
const errorMessage = ref('');
const pendingMigrations = ref<string[]>([]);
const migrationsHistory = ref<string[]>([]);
const selectedMigration = ref<{ name: string; code: string } | null>(null);
const showMigrationModal = ref(false);
const showRollbackModal = ref(false);
const rollbackStep = ref(1);
const maxRollbackSteps = computed(() => migrationsHistory.value.length);

const migrationsToRollback = computed(() => {
	return migrationsHistory.value.slice(0, rollbackStep.value);
});

function handleClose() {
	emit('close');
	emit('migrations-updated');
}

function clearSelectedMigration() {
	selectedMigration.value = null;
	showMigrationModal.value = false;
}

function openRollbackModal() {
	if (migrationsHistory.value.length > 0) {
		rollbackStep.value = 1;
		showRollbackModal.value = true;
	} else {
		showAlert('No applied migrations found to roll back', 'warning');
	}
}

function closeRollbackModal() {
	showRollbackModal.value = false;
}

async function executeRollback() {
	if (!selectedProject.value || rollbackStep.value < 1) {
		return;
	}

	try {
		const projectPath = selectedProject.value.projectPath;
		const usingSail = selectedProject.value.usingSail;

		const command = usingSail
			? `vendor/bin/sail artisan migrate:rollback --step=${rollbackStep.value}`
			: `php artisan migrate:rollback --step=${rollbackStep.value}`;

		closeRollbackModal();
		handleClose();

		await terminalService.executeCommand(command, projectPath);
		emit('migrations-updated');
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: 'An unknown error occurred';
		showAlert(`An error occurred: ${errorMessage}`, 'error');
	}
}

async function openMigrationFile(migrationName: string) {
	if (!selectedProject.value) return;

	try {
		const projectPath = selectedProject.value.projectPath;
		await window.ipcRenderer.invoke(
			'open-file',
			`${projectPath}/database/migrations/${migrationName}.php`
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: 'An unknown error occurred';
		showAlert(`Failed to open migration file: ${errorMessage}`, 'error');
	}
}

async function viewMigrationCode(migrationName: string) {
	if (!selectedProject.value) return;

	try {
		const projectPath = selectedProject.value.projectPath;
		const filePath = `${projectPath}/database/migrations/${migrationName}.php`;

		const result = await window.ipcRenderer.readFile(filePath);

		if (result.success) {
			selectedMigration.value = {
				name: migrationName,
				code: result.content
			};
			showMigrationModal.value = true;
		} else {
			showAlert(
				`Failed to read migration file: ${result.error}`,
				'error'
			);
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: 'An unknown error occurred';
		showAlert(`Failed to read migration file: ${errorMessage}`, 'error');
	}
}

async function runMigrations() {
	if (pendingMigrations.value.length === 0 || !selectedProject.value) {
		return;
	}

	try {
		const projectPath = selectedProject.value.projectPath;
		const usingSail = selectedProject.value.usingSail;

		const command = usingSail
			? 'vendor/bin/sail artisan migrate'
			: 'php artisan migrate';

		handleClose();

		await terminalService.executeCommand(command, projectPath);
		emit('migrations-updated');
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: 'An unknown error occurred';
		showAlert(`An error occurred: ${errorMessage}`, 'error');
	}
}

async function runMigrateCommand(command: string) {
	if (!selectedProject.value) {
		return;
	}

	try {
		const projectPath = selectedProject.value.projectPath;
		const usingSail = selectedProject.value.usingSail;

		const fullCommand = usingSail
			? `vendor/bin/sail artisan ${command}`
			: `php artisan ${command}`;

		handleClose();

		await terminalService.executeCommand(fullCommand, projectPath);
		emit('migrations-updated');
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: 'An unknown error occurred';
		showAlert(`An error occurred: ${errorMessage}`, 'error');
	}
}

onMounted(async () => {
	if (!selectedProject.value) {
		errorMessage.value = 'No project selected.';
		isLoading.value = false;
		return;
	}

	try {
		const project = selectedProject.value;

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const config = {
			projectPath: project.projectPath,
			usingSail: project.usingSail,
			appConnection: AppConnection
		};

		const result = await window.ipcRenderer.invoke(
			'get-migration-status',
			config
		);

		if (result.success) {
			pendingMigrations.value = result.pendingMigrations;
			migrationsHistory.value = result.migrationsHistory || [];
		} else {
			errorMessage.value =
				result.message || 'Failed to retrieve migration status.';
		}
	} catch (error) {
		errorMessage.value =
			error instanceof Error
				? error.message
				: 'An unknown error occurred.';
	} finally {
		isLoading.value = false;
	}
});
</script>

<template>
	<Modal
		title="Migrations"
		:show="true"
		:show-cancel-button="false"
		@close="handleClose"
		:allowCloseOnBackdrop="true"
	>
		<div>
			<div class="mb-4 flex justify-end gap-2">
				<button
					class="btn btn-sm"
					@click="runMigrateCommand('migrate:fresh')"
					:disabled="isRunning"
				>
					Fresh
				</button>

				<button
					class="btn btn-sm"
					@click="runMigrateCommand('migrate:fresh --seed')"
					:disabled="isRunning"
				>
					Fresh & Seed
				</button>

				<button
					class="btn btn-sm"
					@click="runMigrateCommand('migrate:refresh')"
					:disabled="isRunning"
				>
					Refresh
				</button>

				<button
					class="btn btn-sm"
					@click="runMigrateCommand('migrate:reset')"
					:disabled="isRunning"
				>
					Reset
				</button>

				<button
					class="btn btn-sm"
					@click="openRollbackModal"
					:disabled="isRunning || migrationsHistory.length === 0"
				>
					Rollback UI
				</button>

				<button
					class="btn btn-sm"
					@click="runMigrateCommand('migrate:status')"
					:disabled="isRunning"
				>
					Status
				</button>

				<button
					class="btn btn-sm"
					@click="runMigrations"
					:disabled="pendingMigrations.length === 0 || isRunning"
				>
					<span
						v-if="isRunning"
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
							d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062A1.125 1.125 0 0 1 3 16.81V8.688ZM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 0 1 0 1.953l-7.108 4.062a1.125 1.125 0 0 1-1.683-.977V8.688Z"
						/>
					</svg>
					Run
				</button>
			</div>

			<div
				v-if="isLoading"
				class="flex h-40 items-center justify-center"
			>
				<div class="loading loading-spinner loading-sm"></div>
			</div>

			<div
				v-else-if="errorMessage"
				class="alert alert-error mb-2 text-sm"
			>
				<div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 shrink-0 stroke-current"
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
					<span>{{ errorMessage }}</span>
				</div>
			</div>

			<div v-else>
				<div>
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-xs font-semibold uppercase">
							Pending Migrations
						</h3>
						<span class="badge badge-sm">{{
							pendingMigrations.length
						}}</span>
					</div>

					<div
						v-if="pendingMigrations.length === 0"
						class="bg-base-200 rounded-box p-3 text-center"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-primary mx-auto mb-1 h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<h4 class="text-xs font-medium">All caught up!</h4>
						<p class="text-xs opacity-70">
							No pending migrations found.
						</p>
					</div>

					<div
						v-else
						class="border-base-300 mb-4 max-h-[200px] overflow-y-auto rounded-lg border"
					>
						<table
							class="table-pin-rows table-compact table w-full text-sm"
						>
							<thead
								class="bg-base-100 sticky top-0 z-10 shadow-md"
							>
								<tr>
									<th class="w-12 text-center">#</th>
									<th>Migration Name</th>
									<th class="w-24 text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(
										migration, index
									) in pendingMigrations"
									:key="migration"
									class="hover:bg-primary hover:text-base-100 bg-base-200"
								>
									<td class="text-center">{{ index + 1 }}</td>
									<td class="font-mono text-xs">
										{{ migration }}
									</td>
									<td class="text-center">
										<div
											class="flex justify-center space-x-2"
										>
											<button
												@click="
													viewMigrationCode(migration)
												"
												class="btn btn-ghost btn-xs"
												title="View Code"
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
														d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
													/>
												</svg>
											</button>
											<button
												@click="
													openMigrationFile(migration)
												"
												class="btn btn-ghost btn-xs"
												title="Open migration file"
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

					<div class="mt-4">
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-xs font-semibold uppercase">
								Applied Migrations
							</h3>
							<span class="badge badge-sm">{{
								migrationsHistory.length
							}}</span>
						</div>

						<div
							v-if="migrationsHistory.length === 0"
							class="bg-base-200 rounded-box p-3 text-center"
						>
							<p class="text-xs opacity-70">
								No applied migrations found.
							</p>
						</div>

						<div
							v-else
							class="border-base-300 max-h-[200px] overflow-y-auto rounded-lg border"
						>
							<table
								class="table-pin-rows table-compact table w-full text-sm"
							>
								<thead
									class="bg-base-100 sticky top-0 z-10 shadow-md"
								>
									<tr>
										<th class="w-12 text-center">#</th>
										<th>Migration Name</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="(
											migration, index
										) in migrationsHistory"
										:key="migration"
										class="hover:bg-primary hover:text-base-100 bg-base-200"
									>
										<td class="text-center">
											{{ index + 1 }}
										</td>
										<td class="font-mono text-xs">
											{{ migration }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Modal>

	<Modal
		v-if="selectedMigration"
		:title="`Migration: ${selectedMigration.name}`"
		:show="showMigrationModal"
		@close="clearSelectedMigration"
		:show-cancel-button="false"
		:show-footer="false"
	>
		<div class="h-[70vh] overflow-auto">
			<PhpViewer
				:code="selectedMigration.code"
				language="php"
				height="100%"
			/>
		</div>
	</Modal>

	<Modal
		v-if="migrationsHistory.length > 0"
		title="Rollback Migrations"
		:show="showRollbackModal"
		@close="closeRollbackModal"
		:show-action-button="rollbackStep > 0"
		action-button-text="Execute Rollback"
		@action="executeRollback"
	>
		<div class="p-2">
			<div class="bg-base-200 mb-4 rounded-lg p-3">
				<div class="mb-2">
					<span class="text-sm font-medium"
						>Select number of migrations to rollback</span
					>
				</div>
				<input
					type="range"
					min="0"
					:max="maxRollbackSteps"
					v-model="rollbackStep"
					class="range range-sm range-primary w-full outline-none"
					step="1"
				/>
				<div class="flex justify-between px-2 text-xs opacity-70">
					<span></span>
					<span>{{ maxRollbackSteps }}</span>
				</div>
				<div class="label mt-1">
					<span class="label-text-alt">
						Command:
						<code
							class="bg-base-300 rounded px-2 py-1 font-mono text-xs"
						>
							{{ selectedProject?.usingSail ? 'sail' : 'php' }}
							artisan migrate:rollback --step={{ rollbackStep }}
						</code>
					</span>
				</div>
			</div>

			<div
				v-if="rollbackStep > 0"
				class="border-base-300 flex h-[300px] flex-col overflow-hidden rounded-lg border"
			>
				<div class="bg-base-200 border-base-300 border-b px-3 py-2">
					<h3 class="text-xs font-semibold uppercase">
						Applied Migrations to Roll Back ({{
							migrationsToRollback.length
						}})
					</h3>
				</div>
				<div class="flex-1 overflow-auto">
					<table class="table-compact table w-full text-sm">
						<thead class="bg-base-100 sticky top-0 z-10 shadow-sm">
							<tr>
								<th class="w-12">#</th>
								<th>Migration Name</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="(
									migration, index
								) in migrationsToRollback"
								:key="migration"
								class="hover:bg-primary hover:text-base-100 bg-base-200"
							>
								<td class="text-center">{{ index + 1 }}</td>
								<td class="font-mono text-xs">
									{{ migration }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<div
				v-else
				class="bg-base-200 flex h-[300px] items-center justify-center rounded-lg p-4 text-center"
			>
				<div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="text-base-content/50 mx-auto mb-3 h-12 w-12"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
						/>
					</svg>
					<p class="text-sm font-medium">
						Move the slider to select migrations to roll back
					</p>
					<p class="mt-1 text-xs opacity-70">
						Select at least one migration to enable rollback
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
