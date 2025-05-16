import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useConnectionsStore } from './connections';

export type LaravelCommand = {
	name: string;
	path: string;
	namespace: string;
	relativePath: string;
	signature?: string;
};

export const useCommandsStore = defineStore('commands', () => {
	const commands = ref<LaravelCommand[]>([]);
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	const connectionsStore = useConnectionsStore();

	async function fetchCommands() {
		const selectedProject = connectionsStore.getSelectedProject;

		if (!selectedProject?.projectPath) {
			error.value = 'No project selected';
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const result = await window.ipcRenderer.invoke(
				'find-laravel-commands',
				selectedProject.projectPath
			);

			if (result.success) {
				const uniqueCommands = new Map<string, LaravelCommand>();

				result.commands.forEach((command: LaravelCommand) => {
					uniqueCommands.set(command.name, command);
				});

				commands.value = Array.from(uniqueCommands.values());
			} else {
				error.value = result.message || 'Failed to fetch commands';
			}
		} catch (err: any) {
			error.value =
				err.message || 'An error occurred while fetching commands';
			console.error('Error fetching commands:', err);
		} finally {
			isLoading.value = false;
		}
	}

	return {
		commands,
		isLoading,
		error,
		fetchCommands
	};
});
