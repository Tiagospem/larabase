<script setup lang="ts">
import { onMounted, inject } from 'vue';
import PhpViewer from '@/components/PhpViewer.vue';
import { useTableMigrationsStore } from '@/store/tableMigrations';

interface Migration {
	id: string | number;
	name: string;
	displayName?: string;
	status: string;
	created_at?: string | null;
	path?: string;
	code?: string;
	actions?: Array<{
		type: string;
		description?: string;
	}>;
}

const props = defineProps<{ tableName: string }>();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const migrationsStore = useTableMigrationsStore(props.tableName);

function getMigrationStatusClass(status: string) {
	switch (status) {
		case 'APPLIED':
			return 'badge-success';
		case 'PENDING':
			return 'badge-warning';
		case 'FAILED':
			return 'badge-error';
		default:
			return 'badge-ghost';
	}
}

function getActionTypeClass(type: string) {
	switch (type) {
		case 'CREATE':
			return 'badge-success';
		case 'ALTER':
			return 'badge-warning';
		case 'DROP':
			return 'badge-error';
		case 'ADD':
			return 'badge-info';
		case 'FOREIGN KEY':
			return 'badge-primary';
		default:
			return 'badge-ghost';
	}
}

function formatDate(
	dateString: string | null | undefined,
	migrationName: string
) {
	if (!dateString || dateString === 'Invalid Date') {
		const matches = migrationName.match(
			/^(\d{4})_(\d{2})_(\d{2})_(\d{6})_/
		);
		if (matches && matches.length > 4) {
			const year = matches[1];
			const month = matches[2];
			const day = matches[3];
			return `${year}-${month}-${day}`;
		}

		const timestampMatch = migrationName.match(
			/^(\d{4})(\d{2})(\d{2})(\d{6})/
		);
		if (timestampMatch && timestampMatch.length > 3) {
			const year = timestampMatch[1];
			const month = timestampMatch[2];
			const day = timestampMatch[3];
			return `${year}-${month}-${day}`;
		}

		return 'Unknown';
	}

	try {
		if (dateString.includes('/')) {
			const parts = dateString.split('/');
			if (parts.length === 3) {
				return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
			}
		}

		if (dateString.includes(',')) {
			const date = new Date(dateString);
			if (!isNaN(date.getTime())) {
				return date.toISOString().split('T')[0];
			}
		}

		return dateString;
	} catch (error) {
		return dateString;
	}
}

async function openFileInEditor(path: string) {
	try {
		await window.ipcRenderer.openFile(path);
	} catch (error) {
		console.error('Error opening file:', error);
		showAlert('Failed to open file', 'error');
	}
}

async function loadMigrations() {
	try {
		await migrationsStore.getTableMigrations();
	} catch (error: any) {
		showAlert(
			`Error loading migrations: ${error.message || 'Unknown error'}`,
			'error'
		);
	}
}

onMounted(() => {
	loadMigrations();
});
</script>

<template>
	<div class="flex h-full flex-col overflow-auto">
		<div
			class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2"
		>
			<button
				class="btn btn-sm btn-ghost"
				@click="loadMigrations"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
					/>
				</svg>
				<span>Refresh</span>
			</button>
		</div>

		<div class="flex-1 overflow-auto">
			<div
				v-if="migrationsStore.isLoading"
				class="flex h-full w-full items-center justify-center"
			>
				<div
					class="loading loading-spinner loading-lg text-primary"
				></div>
			</div>

			<div
				v-else-if="
					!migrationsStore.sortedMigrations ||
					migrationsStore.sortedMigrations.length === 0
				"
				class="flex h-full w-full items-center justify-center"
			>
				<div class="text-center">
					<h3 class="text-lg font-medium">No migrations available</h3>
					<p class="text-base-content/70 mt-2">
						No migrations found for {{ props.tableName }} table
					</p>
				</div>
			</div>

			<div
				v-else
				class="overflow-x-auto"
			>
				<table
					class="table-pin-rows table-compact table w-full text-sm"
				>
					<thead class="bg-base-100 sticky top-0 z-10 shadow-md">
						<tr>
							<th class="w-12">
								#
								<span
									class="ml-1 text-xs opacity-70"
									title="Numbered from highest to lowest"
								>
									↓
								</span>
							</th>
							<th>Name</th>
							<th>Status</th>
							<th>
								Created At
								<span
									class="ml-1 text-xs opacity-70"
									title="Ordered from newest to oldest"
								>
									↓
								</span>
							</th>
							<th>Actions</th>
							<th>Tools</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(
								migration, index
							) in migrationsStore.sortedMigrations"
							:key="migration.id"
							class="hover:bg-base-200"
						>
							<td class="text-right">
								{{
									migrationsStore.sortedMigrations.length -
									index
								}}
							</td>
							<td class="truncate font-mono text-xs">
								{{
									(migration as Migration).displayName ||
									(migration as Migration).name
								}}
							</td>
							<td>
								<span
									class="badge badge-xs"
									:class="
										getMigrationStatusClass(
											migration.status
										)
									"
								>
									{{ migration.status }}
								</span>
							</td>
							<td class="font-mono text-xs">
								{{
									formatDate(
										migration.created_at,
										migration.name
									)
								}}
							</td>
							<td>
								<div
									v-if="
										migration.actions &&
										migration.actions.length
									"
									class="flex flex-wrap gap-1"
								>
									<span
										v-for="(
											action, actionIndex
										) in migration.actions"
										:key="actionIndex"
										class="badge badge-xs"
										:class="getActionTypeClass(action.type)"
										:title="action.description"
									>
										{{ action.type }}
									</span>
								</div>
								<span
									v-else
									class="text-base-content/50 text-xs"
									>No actions</span
								>
							</td>
							<td>
								<div class="flex space-x-2">
									<button
										class="btn btn-xs btn-ghost"
										@click="
											migrationsStore.setSelectedMigration(
												migration
											)
										"
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
										v-if="migration.path"
										class="btn btn-xs btn-ghost"
										@click="
											openFileInEditor(migration.path)
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

		<div
			v-if="
				migrationsStore.sortedMigrations &&
				migrationsStore.sortedMigrations.length > 0
			"
			class="bg-base-300 border-base-300 border-t p-2 text-xs"
		>
			<span
				>{{ props.tableName }} |
				{{ migrationsStore.sortedMigrations.length }} migrations</span
			>
		</div>

		<div
			v-if="migrationsStore.selectedMigration"
			class="modal modal-open"
		>
			<div
				class="modal-box bg-base-300 flex max-h-[90vh] w-11/12 max-w-5xl flex-col"
			>
				<h3 class="mb-4 text-lg font-bold">
					Migration:
					{{
						(migrationsStore.selectedMigration as Migration)
							.displayName ||
						(migrationsStore.selectedMigration as Migration).name
					}}
				</h3>
				<div class="flex-1 overflow-auto">
					<PhpViewer
						:code="
							(migrationsStore.selectedMigration as Migration)
								.code as string
						"
						language="php"
						height="100%"
					/>
				</div>
				<div class="modal-action mt-4">
					<button
						class="btn"
						@click="migrationsStore.clearSelectedMigration"
					>
						Close
					</button>
				</div>
			</div>
			<div
				class="modal-backdrop"
				@click="migrationsStore.clearSelectedMigration"
			/>
		</div>
	</div>
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

.flex-1.overflow-auto {
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.table thead th {
	position: sticky;
	top: 0;
	z-index: 10;
	font-weight: normal;
}

.flex.h-full.flex-col.overflow-auto {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.table-pin-rows thead {
	position: sticky;
	top: 0;
	z-index: 10;
}

tbody {
	height: 100%;
	overflow: hidden;
}

/* Name column needs more width */
.table th:nth-child(2),
.table td:nth-child(2) {
	max-width: 300px;
}

/* Make other columns use appropriate width */
.table th,
.table td {
	width: auto;
}
</style>
