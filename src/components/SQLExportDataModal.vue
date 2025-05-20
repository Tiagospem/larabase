<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSqlResultsStore } from '@/store/sqlResults';
import * as ExcelJS from 'exceljs';

const props = defineProps({
	show: {
		type: Boolean,
		required: true
	}
});

const emit = defineEmits(['close']);

const sqlResultsStore = useSqlResultsStore();

const isExporting = ref(false);
const exportFormat = ref('csv');
const includeHeaders = ref(true);

const totalRecords = computed(() => sqlResultsStore.results.length);

function downloadFile(
	content: string,
	fileName: string,
	mimeType: string
): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

async function exportData(): Promise<void> {
	isExporting.value = true;

	try {
		let data = sqlResultsStore.results;

		let content = '';
		let fileName = `sql_results_export_${new Date().toISOString().split('T')[0]}`;
		let mimeType = 'text/plain';

		switch (exportFormat.value) {
			case 'csv':
				content = generateCSV(data);
				fileName += '.csv';
				mimeType = 'text/csv';
				break;

			case 'json':
				content = JSON.stringify(data, null, 2);
				fileName += '.json';
				mimeType = 'application/json';
				break;

			case 'sql':
				content = generateSQL(data);
				fileName += '.sql';
				mimeType = 'application/sql';
				break;

			case 'excel':
				const buffer = await generateExcel(data);
				downloadExcelFile(buffer, `${fileName}.xlsx`);
				emit('close');
				isExporting.value = false;
				return;
		}

		downloadFile(content, fileName, mimeType);
		emit('close');
	} catch (error) {
		console.error('Error exporting data:', error);
	} finally {
		isExporting.value = false;
	}
}

function generateCSV(data: Record<string, any>[]): string {
	if (!data || data.length === 0) return '';

	const columns = sqlResultsStore.columns.map((column) => column.field);
	let csv = '';

	if (includeHeaders.value) {
		csv += columns.join(',') + '\n';
	}

	data.forEach((row) => {
		const values = columns.map((column) => {
			const value = row[column];
			if (value === null || value === undefined) return '';
			if (typeof value === 'string') {
				let escaped = value.replace(/"/g, '""');
				if (
					escaped.includes(',') ||
					escaped.includes('"') ||
					escaped.includes('\n')
				) {
					escaped = `"${escaped}"`;
				}
				return escaped;
			}
			return String(value);
		});
		csv += values.join(',') + '\n';
	});

	return csv;
}

function generateSQL(data: Record<string, any>[]): string {
	if (!data || data.length === 0) return '';

	const tableName = 'query_results';
	const columns = sqlResultsStore.columns.map((column) => column.field);
	let sql = '';

	data.forEach((row) => {
		const values = columns.map((column) => {
			const value = row[column];
			if (value === null || value === undefined) return 'NULL';
			if (typeof value === 'string')
				return `'${value.replace(/'/g, "''")}'`;
			if (typeof value === 'boolean') return value ? '1' : '0';
			return String(value);
		});

		sql += `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${values.join(', ')});\n`;
	});

	return sql;
}

async function generateExcel(
	data: Record<string, any>[]
): Promise<ArrayBuffer> {
	if (!data || data.length === 0) return new ArrayBuffer(0);

	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'LaraBase';
	workbook.lastModifiedBy = 'LaraBase';
	workbook.created = new Date();
	workbook.modified = new Date();

	const worksheet = workbook.addWorksheet('SQL Results');
	const columns = sqlResultsStore.columns.map((column) => column.field);

	if (includeHeaders.value) {
		worksheet.addRow(columns);

		const headerRow = worksheet.getRow(1);
		headerRow.font = { bold: true };
		headerRow.eachCell((cell) => {
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFE0E0E0' }
			};
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				bottom: { style: 'thin' },
				right: { style: 'thin' }
			};
		});
	}

	data.forEach((record) => {
		const rowValues = columns.map((column) => {
			const value = record[column];
			return value === null || value === undefined ? '' : String(value);
		});
		worksheet.addRow(rowValues);
	});

	for (let i = 1; i <= columns.length; i++) {
		let maxLength = 0;
		worksheet.getColumn(i).eachCell({ includeEmpty: true }, (cell) => {
			const columnLength = cell.value ? cell.value.toString().length : 10;
			maxLength = Math.max(maxLength, columnLength);
		});
		worksheet.getColumn(i).width = Math.min(maxLength + 2, 50);
	}

	return workbook.xlsx.writeBuffer();
}

function downloadExcelFile(buffer: ArrayBuffer, fileName: string): void {
	if (!buffer || buffer.byteLength === 0) return;

	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
</script>

<template>
	<div
		class="modal z-50"
		:class="{ 'modal-open': props.show }"
	>
		<div class="modal-box bg-base-300 relative max-w-lg">
			<div
				v-if="isExporting"
				class="bg-base-100 bg-opacity-80 absolute inset-0 z-10 flex flex-col items-center justify-center"
			>
				<svg
					class="text-primary mb-4 h-10 w-10 animate-spin"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<p class="text-primary font-semibold">Exporting data...</p>
			</div>

			<h3
				class="mb-4 flex items-center justify-between text-lg font-bold"
			>
				Export SQL Results
				<button
					class="btn btn-sm btn-circle"
					@click="emit('close')"
					:disabled="isExporting"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</h3>

			<div class="mb-4">
				<fieldset class="fieldset">
					<label class="label">
						<span class="label-text font-medium"
							>Export Format</span
						>
					</label>
					<select
						v-model="exportFormat"
						class="select select-bordered w-full"
						:disabled="isExporting"
					>
						<option value="csv">
							CSV (Comma Separated Values)
						</option>
						<option value="json">
							JSON (JavaScript Object Notation)
						</option>
						<option value="sql">SQL (INSERT Statements)</option>
						<option value="excel">Excel (.xlsx)</option>
					</select>
				</fieldset>
			</div>

			<div class="mb-4">
				<fieldset class="fieldset">
					<label class="label cursor-pointer justify-start">
						<input
							v-model="includeHeaders"
							type="checkbox"
							class="checkbox checkbox-primary checkbox-sm"
							:disabled="exportFormat === 'sql' || isExporting"
						/>
						<span class="label-text ml-2">Include headers</span>
					</label>
				</fieldset>
			</div>

			<div class="bg-base-200 mb-4 rounded-md p-3">
				<p class="text-sm">
					<span class="font-semibold">Data to export:</span>
					SQL Query Results ({{ totalRecords }} records)
				</p>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					@click="emit('close')"
					:disabled="isExporting"
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					@click="exportData"
					:disabled="isExporting"
				>
					Export
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop"
			@click="emit('close')"
		></div>
	</div>
</template>
