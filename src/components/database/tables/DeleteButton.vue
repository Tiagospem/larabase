<script setup lang="ts">
import { useDataTableStore } from '@/store/dataTable';
import { inject, ref } from 'vue';
import { useDatabaseStore } from '@/store/database';

const props = defineProps<{ tableName: string }>();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const emit = defineEmits(['refresh']);

const ignoreForeignKeys = ref(false);

const confirmDelete = ref(false);

const dataTableStore = useDataTableStore(props.tableName);
const databaseStore = useDatabaseStore();

async function deleteRows() {
	try {
		const result = await databaseStore.deleteTableRecords(
			props.tableName,
			dataTableStore.selectedRows,
			ignoreForeignKeys.value === true
		);

		if (!result.success) {
			if (
				result.constraintError ||
				result.message.includes('referenced by other tables')
			) {
				showAlert(
					"Cannot delete records because they are referenced by other tables. Try checking 'Ignore foreign key constraints' or remove the related records first.",
					'error'
				);
			} else {
				showAlert(`Error deleting records: ${result.message}`, 'error');
			}
		} else {
			showAlert(result.message, 'success');

			dataTableStore.selectedRows = [];

			ignoreForeignKeys.value = false;

			emit('refresh');
		}

		confirmDelete.value = false;
	} catch (error: any) {
		console.error('Error in confirmDelete:', error);
		showAlert(`Error deleting records: ${error.message}`, 'error');
	}
}
</script>

<template>
	<button
		class="btn btn-sm btn-ghost"
		:disabled="dataTableStore.selectedRows.length === 0"
		@click="confirmDelete = true"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="h-5 w-5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
			/>
		</svg>
		<span class="hidden sm:inline"
			>Delete{{
				dataTableStore.selectedRows.length > 0
					? ` (${dataTableStore.selectedRows.length})`
					: ''
			}}</span
		>
	</button>

	<div
		class="modal z-50"
		:class="{ 'modal-open': confirmDelete }"
	>
		<div class="modal-box">
			<h3 class="text-error text-lg font-bold">Delete Records</h3>
			<p class="py-4">
				Are you sure you want to delete
				{{ dataTableStore.selectedRows.length }} record(s)? This action
				cannot be undone.
			</p>

			<fieldset class="fieldset mt-2">
				<label class="label cursor-pointer justify-start gap-2">
					<input
						type="checkbox"
						v-model="ignoreForeignKeys"
						class="checkbox checkbox-sm"
					/>
					<span class="label-text"
						>Ignore foreign key constraints (use with caution)</span
					>
				</label>
				<p
					v-if="ignoreForeignKeys"
					class="text-warning mt-1 text-xs"
				>
					Warning: This may cause data inconsistency if related
					records exist in other tables.
				</p>
			</fieldset>

			<div class="modal-action">
				<button
					:disabled="databaseStore.isDeletingRows"
					class="btn"
					@click="confirmDelete = false"
				>
					Cancel
				</button>
				<button
					:disabled="databaseStore.isDeletingRows"
					class="btn btn-error"
					@click="deleteRows"
				>
					Delete
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop"
			@click="confirmDelete = false"
		/>
	</div>
</template>
