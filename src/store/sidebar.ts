import { defineStore } from 'pinia';
import { computed, ref, toRaw, watch } from 'vue';
import { useDatabaseStore } from '@/store/database';
import { ModelInfo, ProjectConnection } from '@/types/project';
import { useProjectStore } from '@/store/project';
import { Table } from '@/types/table';
import { useConnectionsStore } from '@/store/connections';
import { ConnectionType } from '@/types/connection-types';
import { AppConnection } from '@/types/ssh-connection';

export const useSidebarStore = defineStore('sidebar', () => {
	const databaseStore = useDatabaseStore();
	const projectStore = useProjectStore();
	const connectionsStore = useConnectionsStore();
	const lastLoadedConnection = ref('');
	const projectModels = ref<ModelInfo[]>([]);

	const searchTerm = ref('');
	const sortBy = ref('records');
	const sortOrder = ref('desc');

	const localTables = computed(() => databaseStore.tablesList || []);
	const isLoading = computed(() => {
		return databaseStore.isLoading;
	});
	const allTablesLoaded = computed(() => !isLoading.value);
	const filteredTables = computed(() => {
		if (!searchTerm.value) return localTables.value;
		const term = searchTerm.value.toLowerCase();

		return localTables.value.filter((table: { name: string }) =>
			table.name.toLowerCase().includes(term)
		);
	});
	const sortedTables = computed(() => {
		const tablesCopy = [...filteredTables.value];

		return tablesCopy.sort((a, b) => {
			if (sortBy.value === 'name') {
				return sortOrder.value === 'asc'
					? a.name.localeCompare(b.name)
					: b.name.localeCompare(a.name);
			} else {
				const aCount = a.rowCount || 0;
				const bCount = b.rowCount || 0;
				return sortOrder.value === 'asc'
					? aCount - bCount
					: bCount - aCount;
			}
		});
	});

	function setSearchTerm(term: string) {
		searchTerm.value = term;
		if (connectionsStore.projectId) {
			localStorage.setItem(
				`tableSearch-${connectionsStore.projectId}`,
				term
			);
		}
	}

	function setSortBy(value: string) {
		if (sortBy.value === value) {
			toggleSortOrder();
		} else {
			sortBy.value = value;
			if (connectionsStore.projectId) {
				localStorage.setItem(
					`tableSort-${connectionsStore.projectId}`,
					value
				);
			}
		}
	}

	function toggleSortOrder() {
		sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
		if (connectionsStore.projectId) {
			localStorage.setItem(
				`tableSortOrder-${connectionsStore.projectId}`,
				sortOrder.value
			);
		}
	}

	watch(
		() => connectionsStore.projectId,
		(newProjectId) => {
			if (newProjectId) {
				searchTerm.value =
					localStorage.getItem(`tableSearch-${newProjectId}`) || '';
				sortBy.value =
					localStorage.getItem(`tableSort-${newProjectId}`) ||
					'records';
				sortOrder.value =
					localStorage.getItem(`tableSortOrder-${newProjectId}`) ||
					'desc';
			}
		},
		{ immediate: true }
	);

	function formatRecordCount(count: number) {
		if (count === null || count === undefined) return '0';

		if (count >= 1000000) {
			return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
		}
		if (count >= 1000) {
			return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
		}
		return count.toString();
	}

	function resetLastLoadedConnection() {
		lastLoadedConnection.value = '';
	}

	async function initializeTables(project: ProjectConnection) {
		if (project.id === lastLoadedConnection.value && !isLoading.value) {
			return;
		}

		lastLoadedConnection.value = project.id as string;

		if (project.type === ConnectionType.SSH) {
			projectModels.value = [];
		} else {
			try {
				const modelResponse =
					await projectStore.getModelsForTables(project);

				if (
					modelResponse &&
					modelResponse.success &&
					modelResponse.models &&
					typeof modelResponse.models === 'object'
				) {
					projectModels.value = modelResponse.models;
				}
			} catch (err) {
				console.error('Error loading models for tables:', err);
			}
		}

		await databaseStore.loadTables(project);
	}

	async function forceReloadDatabase(project: ProjectConnection) {
		if (!project) return;

		const storageKey = `tables-${project.id}`;

		localStorage.removeItem(storageKey);

		resetLastLoadedConnection();

		await databaseStore.loadTables(project);

		await initializeTables(project);

		return true;
	}

	async function updateApproximateTableCounts(project: ProjectConnection) {
		const approximateTables = sortedTables.value.filter(
			(table) => table.isApproximate
		);

		if (approximateTables.length === 0) return;

		const batchSize = 5;
		let tablesProcessed = 0;

		for (let i = 0; i < approximateTables.length; i += batchSize) {
			const batch = approximateTables.slice(i, i + batchSize);

			try {
				await Promise.all(
					batch.map((table) => getTableRecordCount(table, project))
				);
				tablesProcessed += batch.length;

				if (i + batchSize < approximateTables.length) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			} catch (error) {
				console.error(`Error processing batch ${i}:`, error);
			}
		}

		return tablesProcessed;
	}

	async function getTableRecordCount(
		table: Table,
		project: ProjectConnection
	) {
		try {
			const AppConnection = {
				localDbConfig: toRaw(project.dbConfig),
				remote: toRaw(project.sshConfig)
			} as AppConnection;

			const countResult = await window.ipcRenderer.getTableRecordCount(
				AppConnection,
				toRaw(table)
			);

			if (countResult && countResult.success) {
				const exactCount = parseInt(countResult.count, 10);

				table.rowCount = exactCount;
				table.isApproximate = false;

				databaseStore.updateLocalStorageTables(
					project.id as string,
					table.name,
					exactCount,
					false
				);
			} else {
				table.isApproximate = false;

				databaseStore.updateLocalStorageTables(
					project.id as string,
					table.name,
					table.rowCount,
					false
				);
			}

			return true;
		} catch (error) {
			console.error(
				`Error updating count for table ${table.name}:`,
				error
			);

			table.isApproximate = false;
			databaseStore.updateLocalStorageTables(
				project.id as string,
				table.name,
				table.rowCount,
				false
			);

			return false;
		}
	}

	function removeDroppedTables(droppedTables: Table[]) {
		const storageKey = `tables-${connectionsStore.projectId}`;

		const storedData = localStorage.getItem(storageKey);

		if (storedData) {
			const parsedData = JSON.parse(storedData);

			if (parsedData && parsedData.tables) {
				droppedTables.forEach((table: Table) => {
					const index = parsedData.tables.findIndex(
						(t: Table) => t.name === table.name
					);
					if (index !== -1) {
						parsedData.tables.splice(index, 1);
					}
				});

				localStorage.setItem(storageKey, JSON.stringify(parsedData));
			}
		}

		databaseStore.tables.tables = databaseStore.tablesList.filter(
			(t: Table) =>
				!droppedTables.some(
					(droppedTable: Table) => droppedTable.name === t.name
				)
		);
	}

	function updateTableRecordCount(tableName: string, count: number) {
		if (!tableName) return;

		const table = databaseStore.tablesList.find(
			(t: { name: string }) => t.name === tableName
		);

		if (table) {
			table.rowCount = count;
		}

		const storageKey = `tables-${connectionsStore.projectId}`;

		try {
			localStorage.removeItem(storageKey);
		} catch (error) {
			console.error('Error removing localStorage item:', error);
		}
	}

	return {
		projectModels,
		localTables,
		lastLoadedConnection: computed({
			get: () => lastLoadedConnection.value,
			set: (value) => {
				lastLoadedConnection.value = value;
			}
		}),
		searchTerm,
		sortBy,
		sortOrder,
		isLoading,
		allTablesLoaded,
		filteredTables,
		sortedTables,
		setSearchTerm,
		setSortBy,
		toggleSortOrder,
		formatRecordCount,
		initializeTables,
		getTableRecordCount,
		updateApproximateTableCounts,
		removeDroppedTables,
		updateTableRecordCount,
		forceReloadDatabase
	};
});
