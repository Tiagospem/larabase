import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { ProjectConnection } from '@/types/project';
import { Table, TableList } from '@/types/table';
import { useConnectionsStore } from '@/store/connections';
import { MysqlConnection } from '@/types/mysql-connection';
import { useSidebarStore } from '@/store/sidebar';

export const useDatabaseStore = defineStore('database', () => {
	const connectionStore = useConnectionsStore();
	const sidebarStore = useSidebarStore();

	const defaultTableValue = {
		tables: [],
		timestamp: 0
	};

	const isLoading = ref(false);
	const tables = ref<TableList>(defaultTableValue);
	const isDeletingRows = ref(false);

	const tablesList = computed(() => tables.value.tables || []);

	function updateLocalStorageTables(
		projectId: string,
		tableName: string,
		newCount: number,
		isApproximate = true
	) {
		const storageKey = `tables-${projectId}`;

		try {
			const storedData = localStorage.getItem(storageKey);
			if (!storedData) return;

			const parsedData = JSON.parse(storedData);
			if (!parsedData || !Array.isArray(parsedData.tables)) return;

			if (tableName) {
				updateSingleTable(
					parsedData.tables,
					tableName,
					newCount,
					isApproximate
				);
			} else {
				markAllTablesApproximate(parsedData.tables, isApproximate);
			}

			parsedData.timestamp = Date.now();
			localStorage.setItem(storageKey, JSON.stringify(parsedData));
		} catch (error) {
			console.error('Error updating localStorage table data:', error);
		}
	}

	function updateSingleTable(
		tables: Table[],
		tableName: string,
		newCount: number,
		isApproximate: boolean
	) {
		const table = tables.find((t) => t.name === tableName);
		if (!table) return;

		if (newCount !== null) {
			table.rowCount = newCount;
		}
		table.isApproximate = isApproximate;
	}

	const sanitizeIds = (ids: any) =>
		ids.map((id: any) => (id && typeof id === 'object' ? String(id) : id));

	function markAllTablesApproximate(tables: Table[], isApproximate: boolean) {
		for (const table of tables) {
			table.isApproximate = isApproximate;
		}
	}

	async function loadTables(project: ProjectConnection) {
		isLoading.value = true;

		try {
			const storageKey = `tables-${project.id}`;

			try {
				const storedData = localStorage.getItem(storageKey);

				if (storedData) {
					const parsedData = JSON.parse(storedData);

					if (parsedData && parsedData.tables) {
						const cacheExpired =
							!parsedData.timestamp ||
							Date.now() - parsedData.timestamp > 10000;

						if (!cacheExpired) {
							tables.value = parsedData;

							isLoading.value = false;
							return;
						} else {
							console.log('Cache expired, fetching fresh data');
						}
					}
				}
			} catch (storageError) {
				console.error(
					'Error reading tables from localStorage:',
					storageError
				);
			}

			const databaseConnection = toRaw(project.db_config);

			const result =
				await window.ipcRenderer.listTables(databaseConnection);

			tables.value =
				result.success && result.tables
					? { tables: result.tables, timestamp: 0 }
					: defaultTableValue;

			tables.value.timestamp = Date.now();

			try {
				localStorage.setItem(storageKey, JSON.stringify(tables.value));
			} catch (saveError) {
				console.error(
					'Error saving tables to localStorage:',
					saveError
				);
			}
		} catch (error) {
			console.error('Error in loadTables:', error);
			tables.value = defaultTableValue;
		} finally {
			isLoading.value = false;
		}
	}

	async function truncateTable(
		connection: MysqlConnection,
		tableName: string
	) {
		const result = await window.ipcRenderer.truncateTable(
			toRaw(connection),
			tableName
		);

		if (!result.success) throw new Error(result.message);

		sidebarStore.updateTableRecordCount(tableName, 0);

		return result;
	}

	async function truncateTables(tableNames: string[]) {
		if (!tableNames.length) {
			return {
				success: false,
				message: 'Missing required parameters'
			};
		}

		const project = connectionStore.getSelectedProject as ProjectConnection;
		const results = await Promise.all(
			tableNames.map(async (tableName) => {
				try {
					const result = await truncateTable(
						project.db_config,
						tableName
					);
					return {
						tableName,
						success: result.success,
						message: result.message
					};
				} catch (error: any) {
					console.error(
						`Error truncating table ${tableName}:`,
						error
					);
					return {
						tableName,
						success: false,
						message: error.message || 'Error truncating table'
					};
				}
			})
		);

		const successCount = results.filter((r) => r.success).length;
		const failCount = results.length - successCount;

		let message = '';

		if (failCount === 0) {
			message = `Successfully truncated ${successCount} table(s)`;
		} else if (successCount === 0) {
			message = `Failed to truncate ${failCount} table(s)`;
		} else {
			message = `Truncated ${successCount} table(s), failed to truncate ${failCount}`;
		}

		return {
			success: successCount > 0,
			results,
			message
		};
	}

	async function deleteTableRecords(
		tableName: string,
		ids: (string | number)[],
		ignoreForeignKeys: boolean
	) {
		isDeletingRows.value = true;

		const project = connectionStore.getSelectedProject as ProjectConnection;

		const deleteConfig = {
			dbConnection: toRaw(project.db_config),
			tableName,
			ids: sanitizeIds(ids),
			ignoreForeignKeys
		};

		const result = await window.ipcRenderer.deleteRecords(deleteConfig);

		const getTable = sidebarStore.localTables.find(
			(t) => t.name === tableName
		);

		if (getTable) {
			const countResult = await window.ipcRenderer.getTableRecordCount(
				toRaw(project.db_config),
				toRaw(getTable)
			);
			if (countResult && countResult.success) {
				sidebarStore.updateTableRecordCount(
					tableName,
					countResult.count
				);
			}
		}

		isDeletingRows.value = false;

		return result;
	}

	return {
		tables,
		tablesList,
		isLoading,
		isDeletingRows,
		loadTables,
		updateLocalStorageTables,
		truncateTables,
		deleteTableRecords
	};
});
