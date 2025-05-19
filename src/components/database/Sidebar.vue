<script setup lang="ts">
import { computed, ref, watch, watchEffect, toRaw, inject } from 'vue';
import { useSidebarStore } from '@/store/sidebar';
import { useConnectionsStore } from '@/store/connections';
import { useTabsStore } from '@/store/tabs';
import type { ModelInfo, ProjectConnection } from '@/types/project';
import Modal from '@/components/Modal.vue';
import { MysqlConnection } from '@/types/mysql-connection';
import TableListSkeleton from '@/components/TableListSkeleton.vue';
import { Table } from '@/types/table';
import { AppConnection } from '@/types/ssh-connection';

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const isDeleteMode = ref(false);
const selectedTables = ref<Table[]>([]);
const showDeleteConfirmation = ref(false);
const isDeleting = ref(false);
const ignoreForeignKeys = ref(false);
const cascadeDelete = ref(false);

const sidebarStore = useSidebarStore();
const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();

const isAllSelected = computed(() => {
	return (
		selectedTables.value.length === sidebarStore.sortedTables.length &&
		sidebarStore.sortedTables.length > 0
	);
});

const selectedProject = computed<ProjectConnection | null>(
	() => connectionsStore.getSelectedProject || null
);

function toggleDeleteMode() {
	isDeleteMode.value = !isDeleteMode.value;

	if (!isDeleteMode.value) {
		selectedTables.value = [];
	}
}

function toggleSelectAll() {
	if (isAllSelected.value) {
		selectedTables.value = [];
	} else {
		selectedTables.value = sidebarStore.sortedTables.map((t) => t);
	}
}

function isTableSelected(tableName: string) {
	return selectedTables.value.some((t) => t.name === tableName);
}

function toggleTableSelection(table: Table) {
	if (isTableSelected(table.name)) {
		selectedTables.value = selectedTables.value.filter(
			(t) => t.name !== table.name
		);
	} else {
		selectedTables.value.push(table);
	}
}

function isTableActive(tableName: string) {
	return tabsStore.activeTableName === tableName;
}

function confirmDelete() {
	if (selectedTables.value.length === 0) return;

	showDeleteConfirmation.value = true;
}

function getTableModel(tableName: string) {
	const models = sidebarStore.projectModels as ModelInfo[];

	if (models.length === 0) {
		return null;
	}

	return models.find((model: ModelInfo) => model.table === tableName) || null;
}

async function dropTables() {
	if (selectedTables.value.length === 0) return;

	isDeleting.value = true;

	const tablesToDelete = toRaw(selectedTables.value);

	const mappedTableNames = tablesToDelete.map((table) => table.name);

	try {
		const project = selectedProject.value as ProjectConnection;

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const params = {
			projectId: selectedProject.value?.id as string,
			appConnection: AppConnection,
			tables: mappedTableNames,
			ignoreForeignKeys: Boolean(ignoreForeignKeys.value),
			cascade: Boolean(cascadeDelete.value)
		};

		const result = await window.ipcRenderer.dropTables(params);

		if (result && result.success) {
			showAlert(`Successfully deleted tables`, 'success');

			sidebarStore.removeDroppedTables(tablesToDelete);

			for (const table of tablesToDelete) {
				await tabsStore.removeTab(table);
			}

			selectedTables.value = [];
			isDeleteMode.value = false;
			showDeleteConfirmation.value = false;
		} else {
			const errorMessage = result ? result.message : 'Unknown error';
			showAlert(`Error deleting tables: ${errorMessage}`, 'error');
		}
	} catch (error: any) {
		showAlert(
			`Error deleting tables: ${error.message || 'Unknown error'}`,
			'error'
		);
	} finally {
		isDeleting.value = false;
	}
}

function handleIgnoreForeignKeysChange() {
	if (ignoreForeignKeys.value) {
		cascadeDelete.value = false;
	}
}

function handleCascadeDeleteChange() {
	if (cascadeDelete.value) {
		ignoreForeignKeys.value = false;
	}
}

watch(
	() => selectedProject.value,
	(proj) => {
		if (proj) sidebarStore.initializeTables(proj);
	},
	{ immediate: true }
);

watchEffect(() => {
	const project = selectedProject.value;
	if (project && !project.isRemote) {
		setTimeout(async () => {
			try {
				await sidebarStore.updateApproximateTableCounts(project);
			} catch (error) {
				console.error('Error updating table counts:', error);
			}
		}, 500);
	}
});
</script>

<template>
	<div class="relative z-10 flex h-full flex-col">
		<div
			class="bg-base-200 flex h-full w-full flex-col border-r border-black/10"
		>
			<div class="shrink-0 border-b border-black/10 p-3">
				<div class="relative mb-2">
					<label class="input input-sm">
						<svg
							class="h-[1em] opacity-50"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
						>
							<g
								stroke-linejoin="round"
								stroke-linecap="round"
								stroke-width="2.5"
								fill="none"
								stroke="currentColor"
							>
								<circle
									cx="11"
									cy="11"
									r="8"
								></circle>
								<path d="m21 21-4.3-4.3"></path>
							</g>
						</svg>
						<input
							:value="sidebarStore.searchTerm"
							@input="
								(e: Event) => {
									const target = e.target as HTMLInputElement;
									sidebarStore.setSearchTerm(target.value);
								}
							"
							type="search"
							class="input-sm"
							placeholder="Search"
						/>
					</label>
				</div>

				<div class="flex items-center justify-between">
					<div class="truncate text-xs">
						{{ sidebarStore.filteredTables.length }} tables
					</div>
					<div class="flex items-center gap-1">
						<div
							class="tooltip tooltip-right"
							data-tip="Sort by name"
						>
							<button
								class="btn btn-xs btn-ghost"
								:class="{
									'bg-base-100':
										sidebarStore.sortBy === 'name'
								}"
								@click="sidebarStore.setSortBy('name')"
							>
								<svg
									fill="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
									class="size-4"
								>
									<g
										id="SVGRepo_bgCarrier"
										stroke-width="0"
									/>
									<g
										id="SVGRepo_tracerCarrier"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<g id="SVGRepo_iconCarrier">
										<path
											d="M19.707 14.707A1 1 0 0 0 19 13h-7v2h4.586l-4.293 4.293A1 1 0 0 0 13 21h7v-2h-4.586l4.293-4.293zM7 3.99H5v12H2l4 4 4-4H7zM17 3h-2c-.417 0-.79.259-.937.649l-2.75 7.333h2.137L14.193 9h3.613l.743 1.981h2.137l-2.75-7.333A1 1 0 0 0 17 3zm-2.057 4 .75-2h.613l.75 2h-2.113z"
										/>
									</g>
								</svg>
							</button>
						</div>
						<div
							class="tooltip tooltip-right"
							data-tip="Sort by records"
						>
							<button
								class="btn btn-xs btn-ghost"
								:class="{
									'bg-base-100':
										sidebarStore.sortBy === 'records'
								}"
								@click="sidebarStore.setSortBy('records')"
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
										d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
									/>
								</svg>
							</button>
						</div>
						<div
							class="tooltip tooltip-right"
							data-tip="Toggle sort order"
						>
							<button
								class="btn btn-xs btn-ghost"
								@click="sidebarStore.toggleSortOrder"
							>
								<svg
									v-if="sidebarStore.sortOrder === 'asc'"
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
										d="m4.5 15.75 7.5-7.5 7.5 7.5"
									/>
								</svg>
								<svg
									v-else
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
										d="m19.5 8.25-7.5 7.5-7.5-7.5"
									/>
								</svg>
							</button>
						</div>
						<div
							class="tooltip tooltip-right"
							:data-tip="
								isDeleteMode
									? 'Cancel deletion'
									: 'Delete tables'
							"
						>
							<button
								class="btn btn-xs btn-ghost"
								:class="{
									'bg-base-100': isDeleteMode
								}"
								@click="toggleDeleteMode"
							>
								<svg
									v-if="!isDeleteMode"
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
										d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
									/>
								</svg>
								<svg
									v-else
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
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>

				<div
					v-if="isDeleteMode"
					class="mt-2 flex items-center justify-between text-sm"
				>
					<div class="flex items-center">
						<input
							type="checkbox"
							class="checkbox checkbox-xs mr-2"
							:checked="isAllSelected"
							@change="toggleSelectAll"
						/>
						<span class="text-xs">Select All</span>
					</div>
					<button
						class="btn btn-xs btn-success"
						:disabled="selectedTables.length === 0"
						@click="confirmDelete"
					>
						Delete ({{ selectedTables.length }})
					</button>
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
				<div
					v-if="sidebarStore.isLoading"
					class="p-2"
				>
					<TableListSkeleton :count="22" />
				</div>

				<ul
					v-else
					class="w-full"
				>
					<li
						v-for="table in sidebarStore.sortedTables"
						:key="`${table.name}-${table.rowCount}`"
						class="cursor-pointer p-0.5"
					>
						<a
							@click="
								isDeleteMode
									? toggleTableSelection(table)
									: tabsStore.openTable(table)
							"
							:class="{
								'bg-base-100': isTableActive(table.name)
							}"
							class="hover:bg-base-100 flex items-center gap-2 overflow-hidden rounded-md px-2 py-1"
						>
							<div
								v-if="isDeleteMode"
								class="flex-shrink-0"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-xs"
									:checked="isTableSelected(table.name)"
									@click.stop="toggleTableSelection(table)"
								/>
							</div>

							<svg
								v-else
								xmlns="http://www.w3.org/2000/svg"
								fill="currentColor"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="h-4 w-4 flex-shrink-0"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
								/>
							</svg>

							<div class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-sm font-semibold">{{
									table.name
								}}</span>
								<span
									v-if="getTableModel(table.name)"
									class="truncate text-xs opacity-60"
								>
									{{
										getTableModel(table.name)?.namespace
									}}\{{ getTableModel(table.name)?.name }}
								</span>
							</div>

							<span
								class="badge badge-xs flex-shrink-0"
								:class="{
									'animate-pulse': table.isApproximate,
									'badge-accent':
										table.rowCount > 0 ||
										table.isApproximate
								}"
							>
								{{
									sidebarStore.formatRecordCount(
										table.rowCount
									)
								}}
							</span>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<Modal
		:show="showDeleteConfirmation"
		title="Delete Tables"
		@close="showDeleteConfirmation = false"
		@action="dropTables"
		:is-loading-action="isDeleting"
		:show-action-button="true"
		width="w-lg"
	>
		<p>
			<span class="font-bold">
				Are you sure you want to delete
				{{ selectedTables.length }} table(s)?
			</span>
			<br />
			<span class="text-error text-sm"
				>This action cannot be undone.</span
			>
		</p>
		<div class="py-2">
			<fieldset class="fieldset">
				<label class="label cursor-pointer justify-start">
					<input
						v-model="ignoreForeignKeys"
						type="checkbox"
						class="checkbox checkbox-sm checkbox-error mr-2"
						@change="handleIgnoreForeignKeysChange"
					/>
					<span class="label-text"
						>Ignore foreign key constraints</span
					>
				</label>
			</fieldset>
			<fieldset class="fieldset">
				<label class="label cursor-pointer justify-start">
					<input
						v-model="cascadeDelete"
						type="checkbox"
						class="checkbox checkbox-sm checkbox-error mr-2"
						@change="handleCascadeDeleteChange"
					/>
					<span class="label-text"
						>Cascade delete (drop dependent objects)</span
					>
				</label>
			</fieldset>
		</div>
		<div class="mt-2 text-sm">
			<div class="mb-1 font-semibold">Selected tables:</div>
			<div class="bg-base-200 max-h-32 overflow-y-auto rounded-sm p-2">
				<ul class="list-disc space-y-1 pl-4">
					<li
						v-for="table in selectedTables"
						:key="table.name"
					>
						{{ table.name }}
					</li>
				</ul>
			</div>
		</div>
	</Modal>
</template>

<style scoped></style>
