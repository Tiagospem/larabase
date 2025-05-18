import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { ProjectConnection } from '@/types/project';
import { Table, TableList } from '@/types/table';
import { useConnectionsStore } from '@/store/connections';
import { useSidebarStore } from '@/store/sidebar';
import { AppConnection } from '@/types/ssh-connection';

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

	function markAllTablesApproximate(tables: Table[], isApproximate: boolean) {
		for (const table of tables) {
			table.isApproximate = isApproximate;
		}
	}

	const sanitizeIds = (
		ids: Array<string | number | Record<string, unknown>>
	) =>
		ids.map((id: string | number | Record<string, unknown>) =>
			id && typeof id === 'object' ? String(id) : id
		);

	async function loadTables(project: ProjectConnection) {
		isLoading.value = true;

		try {
			const storageKey = `tables-${project.id}`;

			const storedData = localStorage.getItem(storageKey);

			if (storedData) {
				try {
					const parsedData = JSON.parse(storedData);

					if (
						parsedData &&
						parsedData.tables &&
						Array.isArray(parsedData.tables) &&
						parsedData.timestamp
					) {
						if (Date.now() - parsedData.timestamp < 10000) {
							tables.value = parsedData;
							isLoading.value = false;
							return parsedData.tables;
						}
					}
				} catch (err) {
					console.error('Error parsing stored tables:', err);
				}
			}

			const AppConnection = {
				localDbConfig: toRaw(project.dbConfig),
				remote: toRaw(project.sshConfig)
			} as AppConnection;

			const result = await window.ipcRenderer.listTables(
				toRaw(AppConnection)
			);

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

		return tables.value.tables;
	}

	async function truncateTable(
		project: ProjectConnection,
		tableName: string
	) {
		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const result = await window.ipcRenderer.truncateTable(
			AppConnection,
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
					const result = await truncateTable(project, tableName);
					return {
						tableName,
						success: result.success,
						message: result.message
					};
				} catch (error: unknown) {
					console.error(
						`Error truncating table ${tableName}:`,
						error
					);
					return {
						tableName,
						success: false,
						message:
							error instanceof Error
								? error.message
								: 'Error truncating table'
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

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const deleteConfig = {
			appConnection: AppConnection,
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
				AppConnection,
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
