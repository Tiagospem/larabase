<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { toRaw } from 'vue';

const props = defineProps<{ tableName: string }>();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const connectionsStore = useConnectionsStore();
const tableIndexes = ref<any[]>([]);
const isLoading = ref(true);

function getBadgeClass(indexType: string) {
	switch (indexType.toUpperCase()) {
		case 'PRIMARY':
			return 'badge-primary';
		case 'UNIQUE':
			return 'badge-accent';
		case 'FULLTEXT':
			return 'badge-secondary';
		case 'SPATIAL':
			return 'badge-info';
		default:
			return 'badge-neutral';
	}
}

async function loadTableIndexes() {
	try {
		isLoading.value = true;
		const dbConfig = toRaw(connectionsStore.getSelectedProject?.db_config);

		const response = await window.ipcRenderer.getTableIndexes(
			dbConfig,
			props.tableName
		);

		if (response.success) {
			tableIndexes.value = response.indexes;
		} else {
			showAlert(
				`Failed to load table indexes: ${response.message}`,
				'error'
			);
		}
	} catch (error) {
		showAlert(`Failed to load table indexes: ${error}`, 'error');
	} finally {
		isLoading.value = false;
	}
}

onMounted(loadTableIndexes);
</script>

<template>
	<div class="flex h-full flex-col overflow-auto">
		<div
			class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2"
		>
			<button
				class="btn btn-sm btn-ghost"
				@click="loadTableIndexes"
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
				v-if="isLoading"
				class="flex h-full w-full items-center justify-center"
			>
				<div
					class="loading loading-spinner loading-lg text-primary"
				></div>
			</div>

			<div
				v-else-if="!tableIndexes || tableIndexes.length === 0"
				class="flex h-full w-full items-center justify-center"
			>
				<div class="text-center">
					<h3 class="text-lg font-medium">No indexes available</h3>
					<p class="text-base-content/70 mt-2">
						This table doesn't have any indexes
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
							<th class="w-12">#</th>
							<th>Index Name</th>
							<th>Type</th>
							<th>Columns</th>
							<th>Algorithm</th>
							<th>Cardinality</th>
							<th>Comment</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(index, i) in tableIndexes"
							:key="index.name"
							class="hover:bg-base-200"
						>
							<td class="text-right">{{ i + 1 }}</td>
							<td class="font-mono text-xs">{{ index.name }}</td>
							<td>
								<span
									:class="[
										'badge badge-xs',
										getBadgeClass(index.type)
									]"
									>{{ index.type }}</span
								>
							</td>
							<td class="font-mono text-xs">
								{{ index.columns.join(', ') }}
							</td>
							<td class="font-mono text-xs">
								{{ index.algorithm }}
							</td>
							<td class="font-mono text-xs">
								{{ index.cardinality }}
							</td>
							<td class="font-mono text-xs">
								{{ index.comment || '-' }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div
			v-if="tableIndexes && tableIndexes.length > 0"
			class="bg-base-300 border-base-300 border-t p-2 text-xs"
		>
			<span
				>{{ props.tableName }} | {{ tableIndexes.length }} indexes</span
			>
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
	width: 100%;
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
</style>
