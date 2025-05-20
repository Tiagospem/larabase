<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDataTableStore } from '@/store/dataTable';
import ExportDataModal from '@/components/database/tables/ExportDataModal.vue';

const props = defineProps<{ tableName: string }>();

const showExportModal = ref(false);

const pageInput = ref(1);

const dataTableStore = useDataTableStore(props.tableName);

const rowsPerPage = computed(() => dataTableStore.rowsPerPage);

const totalPages = computed(() => {
	if (dataTableStore.rowsPerPage === 0) return 1;
	return Math.ceil(dataTableStore.totalRecords / dataTableStore.rowsPerPage);
});

function prevPage() {
	if (dataTableStore.currentPage > 1) {
		dataTableStore.currentPage--;
	}
}

function nextPage() {
	if (dataTableStore.currentPage < totalPages.value) {
		dataTableStore.currentPage++;
	}
}

function goToFirstPage() {
	if (dataTableStore.currentPage !== 1) {
		dataTableStore.currentPage = 1;
	}
}

function goToLastPage() {
	const lastPage = totalPages.value;

	if (dataTableStore.currentPage !== lastPage) {
		dataTableStore.currentPage = lastPage;
	}
}

function goToPage() {
	const page = pageInput.value;
	const maxPage = totalPages.value;

	if (
		!isNaN(page) &&
		page >= 1 &&
		page <= maxPage &&
		page !== dataTableStore.currentPage
	) {
		dataTableStore.currentPage = page;
	} else {
		pageInput.value = dataTableStore.currentPage;
	}
}

watch(
	() => dataTableStore.currentPage,
	(newPage, oldPage) => {
		if (newPage !== oldPage) {
			pageInput.value = newPage;

			dataTableStore.getTableData(props.tableName);
		}
	}
);

watch(rowsPerPage, (newValue, oldValue) => {
	if (newValue !== oldValue) {
		dataTableStore.currentPage = 1;

		dataTableStore.getTableData(props.tableName);
	}
});
</script>

<template>
	<div
		v-if="dataTableStore.tableData.length > 0"
		class="bg-base-300 sticky right-0 bottom-0 left-0 z-10 flex min-h-[56px] flex-col items-center justify-between border-t border-black/10 px-4 py-3 text-xs sm:flex-row"
	>
		<div class="mb-2 flex items-center sm:mb-0">
			<span>
				{{ dataTableStore.totalRecords }} records |
				<span>{{ dataTableStore.columns.length }} columns</span>
			</span>
			<div class="ml-4 flex space-x-2">
				<div
					class="tooltip tooltip-top"
					data-tip="Export"
				>
					<button
						v-if="dataTableStore.tableData.length > 0"
						class="btn btn-ghost btn-xs"
						@click="showExportModal = true"
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
								d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<div class="flex items-center space-x-2">
			<div class="join">
				<button
					class="join-item btn btn-xs"
					:class="{
						'btn-disabled': dataTableStore.currentPage === 1
					}"
					:disabled="dataTableStore.currentPage === 1"
					@click="goToFirstPage"
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
							d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
						/>
					</svg>
				</button>
				<button
					class="join-item btn btn-xs"
					:class="{
						'btn-disabled': dataTableStore.currentPage === 1
					}"
					:disabled="dataTableStore.currentPage === 1"
					@click="prevPage"
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
							d="M15.75 19.5L8.25 12l7.5-7.5"
						/>
					</svg>
				</button>

				<div class="join-item btn btn-xs btn-disabled">
					<span class="text-xs">
						{{ dataTableStore.currentPage }} / {{ totalPages }}
					</span>
				</div>

				<button
					class="join-item btn btn-xs"
					:class="{
						'btn-disabled':
							dataTableStore.currentPage === totalPages
					}"
					:disabled="dataTableStore.currentPage === totalPages"
					@click="nextPage"
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
							d="M8.25 4.5l7.5 7.5-7.5 7.5"
						/>
					</svg>
				</button>
				<button
					class="join-item btn btn-xs"
					:class="{
						'btn-disabled':
							dataTableStore.currentPage === totalPages
					}"
					:disabled="dataTableStore.currentPage === totalPages"
					@click="goToLastPage"
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
							d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
						/>
					</svg>
				</button>
			</div>

			<div class="flex items-center space-x-2">
				<select
					v-model="dataTableStore.rowsPerPage"
					class="select select-xs select-bordered w-22"
					@change="dataTableStore.currentPage = 1"
				>
					<option value="10">10 rows</option>
					<option value="25">25 rows</option>
					<option value="50">50 rows</option>
					<option value="100">100 rows</option>
					<option value="500">500 rows</option>
					<option value="1000">1k rows</option>
				</select>
			</div>

			<div class="hidden items-center space-x-2 md:flex">
				<span>Go to page:</span>
				<input
					v-model="pageInput"
					type="number"
					min="1"
					:max="totalPages"
					class="input input-xs input-bordered w-24"
					@keyup.enter="goToPage"
				/>
				<button
					class="btn btn-xs btn-ghost"
					@click="goToPage"
				>
					Go
				</button>
			</div>
		</div>
	</div>
	<ExportDataModal
		v-if="showExportModal"
		:show="showExportModal"
		:table-name="tableName"
		@close="showExportModal = false"
	/>
</template>
