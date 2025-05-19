import { defineStore } from 'pinia';
import { useConnectionsStore } from '@/store/connections';
import { computed, ref, toRaw } from 'vue';
import { TableColumn, TableRecord } from '@/types/table';
import { AppConnection } from '@/types/ssh-connection';

export interface TableRow {
	id: string | number;
	[key: string]: string | number | boolean | null | Date | Buffer | undefined;
}

interface TableStructure {
	name: string;
	foreign_key?: boolean;
	type?: string;
	nullable?: boolean;
	default?: string | null;
	key?: string;
	extra?: string;
}

export const useDataTableStore = (table: string) => {
	return defineStore(table, () => {
		const connectionStore = useConnectionsStore();

		const foreignKeyColumns = ref<string[]>([]);
		const lastKnownColumns = ref<TableColumn[]>([]);
		const tableData = ref<TableRow[]>([]);
		const tableStructure = ref<TableStructure[]>([]);
		const isFirstLoad = ref(true);
		const isLoading = ref(true);
		const filterTerm = ref('');
		const advancedFilterTerm = ref('');
		const activeFilter = ref('');
		const rowsPerPage = ref(25);
		const currentPage = ref(1);
		const currentSortColumn = ref<string | null>(null);
		const currentSortDirection = ref<string>('asc');
		const totalRecords = ref(0);
		const selectedRows = ref<(string | number)[]>([]);

		const columns = computed<TableColumn[]>(() => {
			if (tableStructure.value.length > 0) {
				const newColumns = tableStructure.value.map(
					(col: TableStructure) => ({
						field: col.name,
						width: 150
					})
				);

				const idIndex = newColumns.findIndex(
					(col: TableColumn) => col.field === 'id'
				);

				if (idIndex > 0) {
					const idColumn = newColumns.splice(idIndex, 1)[0];
					newColumns.unshift(idColumn);
				}

				lastKnownColumns.value = newColumns;
				return newColumns;
			}

			if (tableData.value.length === 0) {
				return lastKnownColumns.value;
			}

			const firstRow = tableData.value[0];
			const keys = Object.keys(firstRow);

			if (keys.length > 0) {
				const newColumns = keys.map((key) => ({
					field: key,
					width: 150
				}));

				const idIndex = newColumns.findIndex(
					(col) => col.field === 'id'
				);

				if (idIndex > 0) {
					const idColumn = newColumns.splice(idIndex, 1)[0];
					newColumns.unshift(idColumn);
				}

				lastKnownColumns.value = newColumns;
				return newColumns;
			}

			return lastKnownColumns.value;
		});

		function setForeignKeys() {
			foreignKeyColumns.value = tableStructure.value
				.filter((col) => col.foreign_key)
				.map((col) => col.name);
		}

		function isForeignKeyColumn(column: string) {
			return foreignKeyColumns.value.includes(column);
		}

		async function getTableForeignKeys(tableName: string) {
			const project = connectionStore.getSelectedProject;
			if (!project) return [];

			try {
				const AppConnection = {
					localDbConfig: toRaw(project.dbConfig),
					remote: toRaw(project.sshConfig)
				} as AppConnection;

				const { success, foreignKeys, message } =
					await window.ipcRenderer.getTableForeignKeys(
						AppConnection,
						tableName
					);

				if (!success) {
					console.error(
						'Error getting foreign keys for table:',
						tableName,
						message
					);
					return [];
				}

				return foreignKeys || [];
			} catch {
				return [];
			}
		}

		async function getTableStructure(tableName: string) {
			const project = connectionStore.getSelectedProject;

			if (!project) {
				throw new Error('No project selected');
			}

			try {
				const AppConnection = {
					localDbConfig: toRaw(project.dbConfig),
					remote: toRaw(project.sshConfig)
				} as AppConnection;

				return await window.ipcRenderer.getTableStructure(
					AppConnection,
					tableName
				);
			} catch (err) {
				console.error('Error getting table structure:', err);
				throw err;
			}
		}

		async function getTableData(tableName: string) {
			const selectedProject = connectionStore.getSelectedProject;

			if (!selectedProject) {
				throw new Error('No project selected');
			}

			try {
				isLoading.value = true;

				const AppConnection = {
					localDbConfig: toRaw(selectedProject.dbConfig),
					remote: toRaw(selectedProject.sshConfig)
				} as AppConnection;

				const params = {
					limit: rowsPerPage.value,
					page: currentPage.value,
					sortColumn: currentSortColumn.value,
					sortDirection: currentSortDirection.value,
					filter: activeFilter.value,
					tableName: tableName,
					appConnection: AppConnection
				} as TableRecord;

				const response =
					await window.ipcRenderer.getTableRecords(params);

				if (response.success) {
					if (response.structure) {
						tableStructure.value = response.structure;
						setForeignKeys();
					}

					tableData.value = response.data.map(
						(row: Record<string, unknown>, index: number) => {
							if (row.id === undefined) {
								return { id: `row-${index}`, ...row };
							}
							return row;
						}
					);

					totalRecords.value = response.totalRecords;
				} else {
					console.error(
						'Failed to get table records:',
						response.message
					);
					tableData.value = [];
				}
			} catch (err) {
				console.error('Error getting table data:', err);
				tableData.value = [];
				throw err;
			} finally {
				isLoading.value = false;
				isFirstLoad.value = false;
			}
		}

		return {
			getTableData,
			foreignKeyColumns,
			columns,
			tableData,
			tableStructure,
			isLoading,
			isFirstLoad,
			totalRecords,
			rowsPerPage,
			currentPage,
			selectedRows,
			filterTerm,
			advancedFilterTerm,
			activeFilter,
			currentSortColumn,
			currentSortDirection,
			isForeignKeyColumn,
			getTableForeignKeys,
			getTableStructure,
			setSortColumn: (column: string | null) => {
				currentSortColumn.value = column;
			},
			setSortDirection: (direction: 'asc' | 'desc') => {
				currentSortDirection.value = direction;
			}
		};
	})();
};
