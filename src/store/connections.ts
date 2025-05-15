import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ProjectConnection } from '@/types/project';

export const useConnectionsStore = defineStore('connections', () => {
	const connections = ref<ProjectConnection[]>([]);
	const isLoading = ref(true);
	const currentProjectId = ref<string | null>(null);

	const projectId = computed(() => getSelectedProject.value?.id);

	async function loadConnections(id: string | null = null) {
		isLoading.value = true;

		currentProjectId.value = id;

		try {
			if (window.ipcRenderer) {
				try {
					const savedProjects: ProjectConnection[] = JSON.parse(
						localStorage.getItem('connections') || '[]'
					);

					if (
						savedProjects &&
						Array.isArray(savedProjects) &&
						savedProjects.length > 0
					) {
						for (const project of savedProjects) {
							const check =
								await window.ipcRenderer.testMySQLConnection(
									project.db_config
								);

							project.isValid = check.success;
						}

						connections.value = savedProjects;
					} else {
						connections.value = [];
					}
				} catch (err) {
					console.error('Error loading connections from API:', err);
					connections.value = [];
				}
			} else {
				console.warn('API not available, unable to load connections');
				connections.value = [];
			}

			return connections.value;
		} catch (error) {
			console.error('Error in loadConnections:', error);

			connections.value = [];

			return connections.value;
		} finally {
			isLoading.value = false;
		}
	}

	async function saveConnections() {
		try {
			const serializableConnections = connections.value.map((conn) => {
				return JSON.parse(JSON.stringify(conn));
			});

			localStorage.setItem(
				'connections',
				JSON.stringify(serializableConnections)
			);
		} catch (error) {
			console.error('Error saving connections:', error);
		}
	}

	async function addConnection(connection: ProjectConnection) {
		connections.value.push(connection);

		await saveConnections();

		return connection;
	}

	async function removeConnection(projectId: string) {
		const localStorageConnections = JSON.parse(
			localStorage.getItem('connections') || '[]'
		);

		const updatedConnections = localStorageConnections.filter(
			(p: ProjectConnection) => p.id !== projectId.trim()
		);

		localStorage.setItem('connections', JSON.stringify(updatedConnections));

		const tablesKey = `tables-${projectId}`;
		const openTablesKey = `open-tables-${projectId}`;

		localStorage.removeItem(tablesKey);
		localStorage.removeItem(openTablesKey);

		if (connections) {
			connections.value = updatedConnections;
		}

		await saveConnections();
	}

	async function updateConnection(id: string, data: ProjectConnection) {
		const index = connections.value.findIndex((c) => c.id === id);
		if (index !== -1) {
			connections.value[index] = { ...connections.value[index], ...data };
			await saveConnections();
		}
	}

	const getSelectedProject = computed(
		() =>
			connections.value.find((c) => c.id === currentProjectId.value) ||
			null
	);

	function getProjectById(id: string) {
		return connections.value.find((c) => c.id === id) || null;
	}

	return {
		connections,
		isLoading,
		projectId,
		loadConnections,
		addConnection,
		removeConnection,
		updateConnection,
		getProjectById,
		getSelectedProject
	};
});
