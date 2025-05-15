<script setup lang="ts">
import { inject, ref } from 'vue';
import { useDataTableStore } from '@/store/dataTable';
import { useDatabaseStore } from '@/store/database';

const props = defineProps<{ tableName: string }>();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const emit = defineEmits(['refresh']);

const databaseStore = useDatabaseStore();
const dataTableStore = useDataTableStore(props.tableName);

const showTruncateConfirm = ref(false);

function confirmTruncateTable() {
	showTruncateConfirm.value = true;
}

const truncateTable = async () => {
	showTruncateConfirm.value = false;

	try {
		const truncate = await databaseStore.truncateTables([props.tableName]);

		if (truncate.success) {
			showAlert(truncate.message, 'success');

			emit('refresh');
		} else {
			showAlert(truncate.message, 'error');
		}
	} catch (error: any) {
		showAlert(error.message || 'Failed to truncate table', 'error');
	}
};
</script>

<template>
	<button
		class="btn btn-sm btn-ghost"
		:disabled="dataTableStore.totalRecords === 0"
		@click="confirmTruncateTable"
	>
		<svg
			class="h-4 w-4"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 576 512"
		>
			<path
				d="M566.6 54.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192-34.7-34.7c-4.2-4.2-10-6.6-16-6.6c-12.5 0-22.6 10.1-22.6 22.6l0 29.1L364.3 320l29.1 0c12.5 0 22.6-10.1 22.6-22.6c0-6-2.4-11.8-6.6-16l-34.7-34.7 192-192zM341.1 353.4L222.6 234.9c-42.7-3.7-85.2 11.7-115.8 42.3l-8 8C76.5 307.5 64 337.7 64 369.2c0 6.8 7.1 11.2 13.2 8.2l51.1-25.5c5-2.5 9.5 4.1 5.4 7.9L7.3 473.4C2.7 477.6 0 483.6 0 489.9C0 502.1 9.9 512 22.1 512l173.3 0c38.8 0 75.9-15.4 103.4-42.8c30.6-30.6 45.9-73.1 42.3-115.8z"
			/>
		</svg>
		<span class="hidden sm:inline">Truncate</span>
	</button>

	<div
		class="modal z-50"
		:class="{ 'modal-open': showTruncateConfirm }"
	>
		<div class="modal-box">
			<h3 class="text-error text-lg font-bold">Truncate Table</h3>
			<p class="py-4">
				Are you sure you want to truncate the
				<strong>{{ props.tableName }}</strong> table? This will delete
				ALL records and cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn"
					@click="showTruncateConfirm = false"
				>
					Cancel
				</button>
				<button
					class="btn btn-error"
					@click="truncateTable"
				>
					Truncate Table
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop"
			@click="showTruncateConfirm = false"
		/>
	</div>
</template>
