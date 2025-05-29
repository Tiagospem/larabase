import { defineStore } from 'pinia';
import { Models, ProjectConnection } from '@/types/project';
import { computed, reactive, ref } from 'vue';
import { useConnectionsStore } from '@/store/connections';

export const useProjectStore = defineStore('project', () => {
	const models = ref<Models>({ models: [], success: false });

	const targetDatabase = computed(
		() => selectedProject.value?.dbConfig?.database
	);

	const state = reactive({
		showConnectionInfo: false,
		projectDatabase: null as string | null,
		isLoading: false,
		databaseMatch: true
	});

	const connectionsStore = useConnectionsStore();

	const selectedProject = computed<ProjectConnection | null>(
		() => connectionsStore.getSelectedProject || null
	);

	async function getModelsForTables(project: ProjectConnection) {
		if (!project.id || !project.projectPath) return;

		try {
			models.value = await window.ipcRenderer.findModelsForTables(
				project.projectPath
			);

			return models.value;
		} catch (err) {
			console.error('Error loading models for tables:', err);
			throw err;
		}
	}

	async function checkProjectDatabase() {
		const path = selectedProject.value?.projectPath;

		state.isLoading = true;

		try {
			const { success, isMatch, projectDatabase } =
				await window.ipcRenderer.compareProjectDatabase({
					projectPath: path,
					database: targetDatabase.value
				});

			state.databaseMatch = success ? isMatch : true;
			state.projectDatabase = success ? projectDatabase : null;
		} catch {
			state.databaseMatch = true;
		} finally {
			state.isLoading = false;
		}
	}

	return {
		getModelsForTables,
		state,
		targetDatabase,
		checkProjectDatabase,
		models,
		selectedProject
	};
});
