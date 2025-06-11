import { computed, watch } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { toRaw } from 'vue';
import { AppConnection } from '@/types/ssh-connection';

export function useDockMenu() {
	const connectionStore = useConnectionsStore();

	const project = computed(() => {
		return connectionStore.getSelectedProject;
	});

	async function setDockMenuConnection() {
		if (!project.value) {
			await window.ipcRenderer.dockMenu.clearConnection();
			return;
		}

		const appConnection = {
			localDbConfig: toRaw(project.value.dbConfig),
			remote: toRaw(project.value.sshConfig)
		} as AppConnection;

		try {
			await window.ipcRenderer.dockMenu.setConnection(
				project.value.id as string,
				appConnection,
				project.value.projectPath
			);
		} catch (error) {
			console.error('Error setting dock menu connection:', error);
		}
	}

	async function updateDockMenuDatabases(
		databases: string[],
		currentDb: string,
		projectDb?: string
	) {
		try {
			await window.ipcRenderer.dockMenu.updateDatabases(
				databases,
				currentDb,
				projectDb
			);
		} catch (error) {
			console.error('Error updating dock menu databases:', error);
		}
	}

	async function clearDockMenuConnection() {
		try {
			await window.ipcRenderer.dockMenu.clearConnection();
		} catch (error) {
			console.error('Error clearing dock menu connection:', error);
		}
	}

	watch(
		() => project.value,
		async (newProject) => {
			if (newProject) {
				await setDockMenuConnection();
			} else {
				await clearDockMenuConnection();
			}
		},
		{ immediate: true }
	);

	window.ipcRenderer.on('database-switched', async (_event, data) => {
		if (
			data.success &&
			project.value &&
			data.connectionId === project.value.id
		) {
			try {
				const updatedProject = { ...project.value };
				if (updatedProject.dbConfig) {
					updatedProject.dbConfig.database = data.database;
				}

				await connectionStore.updateConnection(
					project.value.id as string,
					updatedProject
				);

				window.location.reload();
			} catch (error) {
				console.error(
					'Error handling database switch from dock menu:',
					error
				);
			}
		}
	});

	return {
		updateDockMenuDatabases
	};
}
