<script setup lang="ts">
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDataTableStore } from '@/store/dataTable';
import DataTable from '@/components/DataTable.vue';
import Paginator from '@/components/database/tables/Paginator.vue';
import RefreshButton from '@/components/database/tables/RefreshButton.vue';
import LiveTableButton from '@/components/database/tables/LiveTableButton.vue';
import TruncateButton from '@/components/database/tables/TruncateButton.vue';
import DeleteButton from '@/components/database/tables/DeleteButton.vue';
import FilterButton from '@/components/database/tables/FilterButton.vue';
import TableSkeleton from '@/components/database/tables/TableSkeleton.vue';
import { useForeignKeyNavigation } from '@/composables/useForeignKeyNavigation';
import EditRecordModal from '@/components/database/tables/EditRecordModal.vue';
import RecordPreviewModal from '@/components/database/tables/RecordPreviewModal.vue';

const props = defineProps<{ tableName: string }>();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const dataTableStore = useDataTableStore(props.tableName);

const { navigateToForeignKey } = useForeignKeyNavigation();

const showEditModal = ref(false);
const showPreviewModal = ref(false);
const selectedRecord = ref<any>(null);

type TableFilterDetail = {
	tableName: string;
	filter: string;
};

const handleFilterEvent = (event: Event) => {
	const customEvent = event as CustomEvent<TableFilterDetail>;
	const { tableName, filter } = customEvent.detail;

	if (tableName === props.tableName && filter) {
		dataTableStore.advancedFilterTerm = filter;
		dataTableStore.activeFilter = filter;
		dataTableStore.currentPage = 1;
		handleRefresh();
	}
};

onMounted(async () => {
	await nextTick();
	await dataTableStore.getTableData(props.tableName);

	window.addEventListener('refresh-table', () => handleRefresh());
	window.addEventListener('refresh-table-with-filter', handleFilterEvent);
});

onUnmounted(() => {
	window.removeEventListener('refresh-table', () => handleRefresh());
	window.removeEventListener('refresh-table-with-filter', handleFilterEvent);
});

watch(
	() => props.tableName,
	async (newName) => {
		await dataTableStore.getTableData(newName);
	}
);

async function handleForeignKeyNavigation(column: string, value: any) {
	await navigateToForeignKey(props.tableName, column, value, (message) => {
		showAlert(message, 'error');
	});
}

const handleRowSelected = (selectedIds: (string | number)[]) => {
	dataTableStore.selectedRows = selectedIds;
};

const handleRowPreview = (row: any) => {
	selectedRecord.value = row;
	showPreviewModal.value = true;
};

const handleRowDoubleClick = (row: any) => {
	selectedRecord.value = row;
	showEditModal.value = true;
};

const handleSort = (field: string) => {
	dataTableStore.setSortColumn(field);
	dataTableStore.setSortDirection(
		dataTableStore.currentSortDirection === 'asc' ? 'desc' : 'asc'
	);
	handleRefresh();
};

const handleRefresh = () => {
	dataTableStore.getTableData(props.tableName);
};
</script>

<template>
	<div
		class="bg-base-200 border-b-base-300 flex flex-wrap items-center justify-between gap-2 border-b p-2"
	>
		<div class="flex flex-wrap items-center gap-0.5">
			<RefreshButton @refresh="handleRefresh" />
			<TruncateButton
				@refresh="handleRefresh"
				:table-name="props.tableName"
			/>
			<DeleteButton
				@refresh="handleRefresh"
				:table-name="props.tableName"
			/>
			<LiveTableButton @refresh="handleRefresh" />
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<FilterButton
				@refresh="handleRefresh"
				:table-name="props.tableName"
			/>
		</div>
	</div>

	<TableSkeleton v-if="dataTableStore.isFirstLoad" />

	<DataTable
		:foreign-key-columns="dataTableStore.foreignKeyColumns"
		:is-loading="dataTableStore.isFirstLoad"
		:columns="dataTableStore.columns"
		:data="dataTableStore.tableData"
		:selected-table-sort="dataTableStore.currentSortColumn"
		:sort-direction="dataTableStore.currentSortDirection"
		:table-name="props.tableName"
		:table-structure-data="dataTableStore.tableStructure"
		@row-selected="handleRowSelected"
		@row-preview="handleRowPreview"
		@row-dblclick="handleRowDoubleClick"
		@sort="handleSort"
		@navigate-to-foreign-key="handleForeignKeyNavigation"
	/>

	<Paginator :table-name="props.tableName" />

	<EditRecordModal
		v-if="showEditModal"
		:show="showEditModal"
		:record="selectedRecord"
		:table-name="props.tableName"
		:table-structure="dataTableStore.tableStructure"
		@close="showEditModal = false"
		@refresh="handleRefresh"
	/>

	<RecordPreviewModal
		v-if="showPreviewModal"
		:show="showPreviewModal"
		:record="selectedRecord"
		:table-name="props.tableName"
		:table-structure="dataTableStore.tableStructure"
		@close="showPreviewModal = false"
	/>
</template>
