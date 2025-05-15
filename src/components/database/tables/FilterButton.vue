<script setup lang="ts">
import { inject, ref, watch, onMounted } from 'vue';
import Modal from '@/components/Modal.vue';
import { useDataTableStore } from '@/store/dataTable';
import { useTabsStore } from '@/store/tabs';
import debounce from 'lodash/debounce';

const props = defineProps<{ tableName: string }>();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const emit = defineEmits(['refresh']);

const showFilterModal = ref(false);
const originalFilterTerm = ref('');

const dataTableStore = useDataTableStore(props.tableName);
const tabsStore = useTabsStore();

onMounted(() => {
	if (tabsStore.tabFilter) {
		dataTableStore.advancedFilterTerm = tabsStore.tabFilter;
		dataTableStore.activeFilter = tabsStore.tabFilter;

		setTimeout(() => {
			tabsStore.tabFilter = null;
		}, 100);

		emit('refresh');
	}
});

async function applyAdvancedFilter() {
	dataTableStore.activeFilter = dataTableStore.advancedFilterTerm;

	showFilterModal.value = false;

	dataTableStore.currentPage = 1;

	try {
		emit('refresh');
	} catch (error: any) {
		console.error('Error to get filtered data:', error);
		showAlert(`Error to apply filter: ${error.message}`, 'error');
	}
}

function toggleAdvancedFilter() {
	originalFilterTerm.value = dataTableStore.advancedFilterTerm;
	showFilterModal.value = true;
}

function insertColumnName(column: string) {
	dataTableStore.advancedFilterTerm += column + ' ';
}

function insertOperator(op: string) {
	dataTableStore.advancedFilterTerm += ' ' + op + ' ';
}

function cancelAdvancedFilter() {
	dataTableStore.advancedFilterTerm = originalFilterTerm.value;
	showFilterModal.value = false;
}

function clearFilters() {
	const hadActiveFilter =
		dataTableStore.activeFilter || dataTableStore.filterTerm;

	dataTableStore.filterTerm = '';
	dataTableStore.advancedFilterTerm = '';
	dataTableStore.activeFilter = '';

	if (hadActiveFilter) {
		dataTableStore.currentPage = 1;

		emit('refresh');
	}
}

function setExampleFilter(example: string) {
	dataTableStore.advancedFilterTerm = example;
}

const applyFilter = debounce(() => {
	if (dataTableStore.filterTerm.trim() === '') {
		dataTableStore.activeFilter = '';
	} else {
		const searchTerm = dataTableStore.filterTerm.trim();
		const likeConditions = dataTableStore.columns
			.map((column) => `\`${column.field}\` LIKE '%${searchTerm}%'`)
			.join(' OR ');
		dataTableStore.activeFilter = `(${likeConditions})`;
	}
	dataTableStore.currentPage = 1;
	emit('refresh');
}, 300);

watch(
	() => dataTableStore.filterTerm,
	(newValue) => {
		if (newValue !== undefined) {
			applyFilter();
		}
	}
);
</script>

<template>
	<div class="relative flex items-center gap-2">
		<div class="input-group flex gap-2">
			<input
				v-model="dataTableStore.filterTerm"
				type="text"
				placeholder="Filter..."
				class="input input-sm input-bordered w-full sm:w-64"
			/>
			<button
				class="btn btn-sm"
				:class="{
					'btn-base-300':
						!dataTableStore.activeFilter &&
						!dataTableStore.filterTerm,
					'btn-primary border-primary':
						dataTableStore.activeFilter || dataTableStore.filterTerm
				}"
				@click="toggleAdvancedFilter"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
					/>
				</svg>
			</button>
		</div>
		<button
			v-if="dataTableStore.filterTerm || dataTableStore.activeFilter"
			class="btn btn-sm btn-primary"
			@click="clearFilters"
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
					d="M6 18 18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>

	<Modal
		:show="showFilterModal"
		title="Advanced Filter"
		@close="cancelAdvancedFilter"
		@action="applyAdvancedFilter"
		:show-action-button="true"
		:action-button-text="'Apply Filter'"
	>
		<div class="mb-4">
			<fieldset class="fieldset">
				<label class="label">
					<span class="label-text font-medium">SQL WHERE Clause</span>
				</label>
				<textarea
					v-model="dataTableStore.advancedFilterTerm"
					class="textarea textarea-bordered h-32 w-full font-mono"
					placeholder="id = 1"
				/>
				<label class="label">
					<span class="label-text-alt text-xs">
						Examples:
						<code
							class="bg-base-300 cursor-pointer p-1"
							@click="setExampleFilter('id = 2')"
							>id = 2</code
						>,
						<code
							class="bg-base-300 cursor-pointer p-1"
							@click="
								setExampleFilter('email LIKE \'%example%\'')
							"
							>email LIKE '%example%'</code
						>,
						<code
							class="bg-base-300 cursor-pointer p-1"
							@click="setExampleFilter('created_at IS NOT NULL')"
							>created_at IS NOT NULL</code
						>,
						<code
							class="bg-base-300 cursor-pointer p-1"
							@click="setExampleFilter('id > 10 AND id < 20')"
							>id > 10 AND id < 20</code
						>
					</span>
				</label>
			</fieldset>

			<div class="mt-2 text-xs">
				<p class="mb-2">Available columns:</p>
				<div class="mb-4 flex flex-wrap gap-1">
					<span
						v-for="column in dataTableStore.columns"
						:key="column.field"
						class="badge badge-primary badge-sm cursor-pointer"
						@click="insertColumnName(column.field)"
					>
						{{ column.field }}
					</span>
				</div>

				<p class="mb-2">Common operators:</p>
				<div class="flex flex-wrap gap-1">
					<span
						v-for="op in [
							'=',
							'!=',
							'>',
							'<',
							'>=',
							'<=',
							'LIKE',
							'IN',
							'IS NULL',
							'IS NOT NULL',
							'BETWEEN',
							'AND',
							'OR'
						]"
						:key="op"
						class="badge badge-secondary badge-sm cursor-pointer"
						@click="insertOperator(op)"
					>
						{{ op }}
					</span>
				</div>
			</div>
		</div>
	</Modal>

	<select
		v-model="dataTableStore.rowsPerPage"
		class="select select-sm select-bordered w-24 sm:w-32"
	>
		<option value="10">10 rows</option>
		<option value="25">25 rows</option>
		<option value="50">50 rows</option>
		<option value="100">100 rows</option>
	</select>
</template>
