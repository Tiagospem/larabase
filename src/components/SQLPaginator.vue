<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SQLExportDataModal from '@/components/SQLExportDataModal.vue';

const props = defineProps<{
	totalRecords: number;
	currentPage: number;
	rowsPerPage: number;
	queryTime?: number | null;
}>();

const emit = defineEmits(['update:currentPage', 'update:rowsPerPage']);

const pageInput = ref(props.currentPage);
const showExportModal = ref(false);

const totalPages = computed(() => {
	if (props.rowsPerPage === 0) return 1;
	return Math.ceil(props.totalRecords / props.rowsPerPage);
});

const executionTimeDisplay = computed(() => {
	if (!props.queryTime) return null;
	const seconds = (props.queryTime / 1000).toFixed(2);
	return `${seconds}s`;
});

function prevPage() {
	if (props.currentPage > 1) {
		emit('update:currentPage', props.currentPage - 1);
	}
}

function nextPage() {
	if (props.currentPage < totalPages.value) {
		emit('update:currentPage', props.currentPage + 1);
	}
}

function goToFirstPage() {
	if (props.currentPage !== 1) {
		emit('update:currentPage', 1);
	}
}

function goToLastPage() {
	const lastPage = totalPages.value;

	if (props.currentPage !== lastPage) {
		emit('update:currentPage', lastPage);
	}
}

function goToPage() {
	const page = pageInput.value;
	const maxPage = totalPages.value;

	if (
		!isNaN(page) &&
		page >= 1 &&
		page <= maxPage &&
		page !== props.currentPage
	) {
		emit('update:currentPage', page);
	} else {
		pageInput.value = props.currentPage;
	}
}

function updateRowsPerPage(event: Event) {
	const value = parseInt((event.target as HTMLSelectElement).value);
	emit('update:rowsPerPage', value);
	emit('update:currentPage', 1);
}

watch(
	() => props.currentPage,
	(newPage) => {
		pageInput.value = newPage;
	}
);
</script>

<template>
	<div
		v-if="totalRecords > 0"
		class="bg-base-300 sticky right-0 bottom-0 left-0 z-10 flex min-h-[56px] flex-col items-center justify-between border-t border-black/10 px-4 py-3 text-xs sm:flex-row"
	>
		<div class="mb-2 flex items-center sm:mb-0">
			<span>
				{{ totalRecords }}
				{{ totalRecords === 1 ? 'record' : 'records' }}
				<span
					v-if="executionTimeDisplay"
					class="ml-2 opacity-75"
				>
					(execution time: {{ executionTimeDisplay }})
				</span>
			</span>
			<div class="ml-4 flex space-x-2">
				<div
					class="tooltip tooltip-top"
					data-tip="Export"
				>
					<button
						v-if="totalRecords > 0"
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
						'btn-disabled': currentPage === 1
					}"
					:disabled="currentPage === 1"
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
						'btn-disabled': currentPage === 1
					}"
					:disabled="currentPage === 1"
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
						{{ currentPage }} / {{ totalPages }}
					</span>
				</div>

				<button
					class="join-item btn btn-xs"
					:class="{
						'btn-disabled': currentPage === totalPages
					}"
					:disabled="currentPage === totalPages"
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
						'btn-disabled': currentPage === totalPages
					}"
					:disabled="currentPage === totalPages"
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
					:value="rowsPerPage"
					class="select select-xs select-bordered w-22"
					@change="updateRowsPerPage"
				>
					<option value="10">10 rows</option>
					<option value="25">25 rows</option>
					<option value="50">50 rows</option>
					<option value="100">100 rows</option>
					<option value="500">500 rows</option>
				</select>
			</div>

			<div class="hidden items-center space-x-2 md:flex">
				<span>Go to page:</span>
				<input
					v-model="pageInput"
					type="number"
					min="1"
					:max="totalPages"
					class="input input-xs input-bordered w-14"
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

	<SQLExportDataModal
		v-if="showExportModal"
		:show="showExportModal"
		@close="showExportModal = false"
	/>
</template>
