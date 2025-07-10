<script lang="ts">
import { defineComponent, PropType, ref, computed, watch } from 'vue';
import { TableColumn } from '@/types/table';

export default defineComponent({
	name: 'ColumnVisibilityModal',
	props: {
		columns: {
			type: Array as PropType<TableColumn[]>,
			required: true
		},
		visibleColumns: {
			type: Array as PropType<string[]>,
			required: true
		},
		isOpen: {
			type: Boolean,
			default: false
		}
	},
	emits: ['close', 'update:visibleColumns', 'clear-filters'],
	setup(props, { emit }) {
		const localVisibleColumns = ref<string[]>(
			props.visibleColumns.length > 0
				? [...props.visibleColumns]
				: props.columns.map((col) => col.field)
		);

		watch(
			() => props.visibleColumns,
			(newVisibleColumns) => {
				localVisibleColumns.value =
					newVisibleColumns.length > 0
						? [...newVisibleColumns]
						: props.columns.map((col) => col.field);
			},
			{ deep: true }
		);

		const toggleColumn = (columnField: string) => {
			const index = localVisibleColumns.value.indexOf(columnField);
			if (index === -1) {
				localVisibleColumns.value.push(columnField);
			} else {
				localVisibleColumns.value.splice(index, 1);
			}
			emit('update:visibleColumns', localVisibleColumns.value);
		};

		const isColumnVisible = (columnField: string) => {
			return localVisibleColumns.value.includes(columnField);
		};

		const clearFilters = () => {
			localVisibleColumns.value = props.columns.map((col) => col.field);
			emit('update:visibleColumns', localVisibleColumns.value);
			emit('clear-filters');
		};

		const closeModal = () => {
			emit('close');
		};

		const allColumnsVisible = computed(() => {
			return localVisibleColumns.value.length === props.columns.length;
		});

		const toggleAllColumns = () => {
			if (allColumnsVisible.value) {
				localVisibleColumns.value = [];
			} else {
				localVisibleColumns.value = props.columns.map(
					(col) => col.field
				);
			}
			emit('update:visibleColumns', localVisibleColumns.value);
		};

		return {
			localVisibleColumns,
			toggleColumn,
			isColumnVisible,
			clearFilters,
			closeModal,
			allColumnsVisible,
			toggleAllColumns
		};
	}
});
</script>

<template>
	<div
		v-if="isOpen"
		class="modal modal-open"
	>
		<div class="modal-box w-11/12 max-w-md max-h-[80vh] flex flex-col">
			<!-- Header - Fixed -->
			<div class="flex items-center justify-between mb-4 flex-shrink-0">
				<h3 class="font-bold text-lg">Column Visibility</h3>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					@click="closeModal"
				>
					<svg
						class="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Select All Section - Fixed -->
			<div class="mb-4 flex-shrink-0">
				<div class="form-control">
					<label class="label cursor-pointer justify-between px-0">
						<input
							type="checkbox"
							class="checkbox checkbox-primary checkbox-xs"
							:checked="allColumnsVisible"
							@change="toggleAllColumns"
						/>
						<span class="label-text font-semibold">Select All</span>
					</label>
				</div>
			</div>

			<div class="divider my-0 flex-shrink-0"></div>

			<!-- Scrollable Column List -->
			<div class="flex-1 overflow-y-auto min-h-0">
				<div>
					<div
						v-for="column in columns"
						:key="column.field"
						class="form-control"
					>
						<label
							class="label cursor-pointer justify-between px-0 py-2"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-primary checkbox-xs"
								:checked="isColumnVisible(column.field)"
								@change="toggleColumn(column.field)"
							/>
							<span class="label-text text-sm">{{
								column.field
							}}</span>
						</label>
					</div>
				</div>
			</div>

			<div class="divider my-4 flex-shrink-0"></div>

			<!-- Footer - Fixed -->
			<div class="modal-action flex-shrink-0 mt-0">
				<button
					class="btn btn-outline btn-sm"
					@click="clearFilters"
				>
					Clear Filters
				</button>
				<button
					class="btn btn-primary btn-sm"
					@click="closeModal"
				>
					Done
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop"
			@click="closeModal"
		></div>
	</div>
</template>
