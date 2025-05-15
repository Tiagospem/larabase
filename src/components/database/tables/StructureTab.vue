<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useDataTableStore } from '@/store/dataTable';

const props = defineProps<{ tableName: string }>();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const dataTableStore = useDataTableStore(props.tableName);
const tableStructure = ref<any[]>([]);
const isLoading = ref(true);

onMounted(async () => {
	try {
		isLoading.value = true;

		const response = await dataTableStore.getTableStructure(
			props.tableName
		);

		if (response.success) {
			tableStructure.value = response.structure;
		}
	} catch (error) {
		showAlert(`Failed to load table structure: ${error}`, 'error');
	} finally {
		isLoading.value = false;
	}
});
</script>

<template>
	<div class="flex h-full flex-col overflow-auto">
		<div
			class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2"
		>
			<button
				class="btn btn-sm btn-ghost"
				@click="dataTableStore.getTableStructure(props.tableName)"
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
				v-else-if="
					!dataTableStore.tableStructure ||
					tableStructure.length === 0
				"
				class="flex h-full w-full items-center justify-center"
			>
				<div class="text-center">
					<h3 class="text-lg font-medium">
						No structure data available
					</h3>
					<p class="text-base-content/70 mt-2">
						Table structure information could not be loaded
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
							<th>column_name</th>
							<th>data_type</th>
							<th>is_nullable</th>
							<th>key</th>
							<th>default</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(column, index) in tableStructure"
							:key="column.name"
							class="hover:bg-base-200"
						>
							<td class="text-right">{{ index + 1 }}</td>
							<td class="font-mono text-xs">{{ column.name }}</td>
							<td class="font-mono text-xs">{{ column.type }}</td>
							<td
								:class="
									column.nullable
										? 'text-success'
										: 'text-error'
								"
							>
								{{ column.nullable ? 'YES' : 'NO' }}
							</td>
							<td>
								<span
									v-if="column.key === 'PRI'"
									class="badge badge-sm"
									>PK</span
								>
								<span
									v-else-if="column.foreign_key"
									class="badge badge-sm badge-secondary"
									>FK</span
								>
								<span
									v-else-if="column.key === 'UNI'"
									class="badge badge-sm badge-accent"
									>UNI</span
								>
								<span
									v-else-if="column.key === 'MUL'"
									class="badge badge-sm badge-accent"
									>MUL</span
								>
							</td>
							<td class="font-mono text-xs">
								{{ column.default ?? 'NULL' }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div
			v-if="
				dataTableStore.tableStructure &&
				dataTableStore.tableStructure.length > 0
			"
			class="bg-base-300 border-base-300 border-t p-2 text-xs"
		>
			<span
				>{{ props.tableName }} |
				{{ dataTableStore.tableStructure.length }} columns</span
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
