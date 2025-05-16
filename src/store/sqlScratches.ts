import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SqlScratch {
	id: string;
	name: string;
	content: string;
	projectId: string;
	createdAt: number;
	updatedAt: number;
	isDefault?: boolean;
}

export const useSqlScratchesStore = defineStore('sqlScratches', () => {
	const scratches = ref<SqlScratch[]>([]);
	const isOpen = ref(false);
	const activeScratchId = ref<string | null>(null);

	function loadScratches(projectId: string) {
		try {
			const savedScratches = localStorage.getItem(
				`sql-scratches-${projectId}`
			);
			if (savedScratches) {
				scratches.value = JSON.parse(savedScratches).filter(
					(scratch: SqlScratch) => scratch.projectId === projectId
				);

				const savedActiveScratchId = localStorage.getItem(
					`sql-active-scratch-${projectId}`
				);

				if (
					savedActiveScratchId &&
					scratches.value.some((s) => s.id === savedActiveScratchId)
				) {
					activeScratchId.value = savedActiveScratchId;
				} else {
					const defaultScratch = scratches.value.find(
						(scratch) =>
							scratch.isDefault && scratch.projectId === projectId
					);

					if (!defaultScratch) {
						createDefaultScratch(projectId);
					} else {
						activeScratchId.value = defaultScratch.id;
					}
				}
			} else {
				createDefaultScratch(projectId);
			}
		} catch (error) {
			console.error('Error loading SQL scratches:', error);
			scratches.value = [];
			createDefaultScratch(projectId);
		}
	}

	function createDefaultScratch(projectId: string) {
		const defaultScratch: SqlScratch = {
			id: `default-${projectId}`,
			name: 'Default',
			content: '-- SELECT * FROM users;',
			projectId,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isDefault: true
		};

		scratches.value.push(defaultScratch);
		activeScratchId.value = defaultScratch.id;
		saveScratches(projectId);
		saveActiveScratchId(projectId);
		return defaultScratch;
	}

	function saveScratches(projectId: string) {
		try {
			const projectScratches = scratches.value.filter(
				(scratch) => scratch.projectId === projectId
			);
			localStorage.setItem(
				`sql-scratches-${projectId}`,
				JSON.stringify(projectScratches)
			);
		} catch (error) {
			console.error('Error saving SQL scratches:', error);
		}
	}

	function saveActiveScratchId(projectId: string) {
		if (activeScratchId.value) {
			localStorage.setItem(
				`sql-active-scratch-${projectId}`,
				activeScratchId.value
			);
		}
	}

	function addScratch(name: string, content: string, projectId: string) {
		const newScratch: SqlScratch = {
			id: Date.now().toString(),
			name,
			content,
			projectId,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};

		scratches.value.push(newScratch);
		activeScratchId.value = newScratch.id;
		saveActiveScratchId(projectId);
		saveScratches(projectId);
		return newScratch;
	}

	function updateScratch(
		id: string,
		data: Partial<SqlScratch>,
		projectId: string
	) {
		const index = scratches.value.findIndex((scratch) => scratch.id === id);
		if (index !== -1) {
			const isDefault = scratches.value[index].isDefault;

			scratches.value[index] = {
				...scratches.value[index],
				...data,
				isDefault,
				updatedAt: Date.now()
			};
			saveScratches(projectId);
			return true;
		}
		return false;
	}

	function updateActiveScratchContent(content: string, projectId: string) {
		if (!activeScratchId.value) return false;

		return updateScratch(activeScratchId.value, { content }, projectId);
	}

	function deleteScratch(id: string, projectId: string) {
		const index = scratches.value.findIndex((scratch) => scratch.id === id);
		if (index !== -1) {
			if (scratches.value[index].isDefault) {
				return false;
			}

			if (activeScratchId.value === id) {
				const defaultScratch = scratches.value.find(
					(s) => s.isDefault && s.projectId === projectId
				);
				if (defaultScratch) {
					activeScratchId.value = defaultScratch.id;
					saveActiveScratchId(projectId);
				}
			}

			scratches.value.splice(index, 1);
			saveScratches(projectId);
			return true;
		}
		return false;
	}

	function getScratchById(id: string) {
		return scratches.value.find((scratch) => scratch.id === id);
	}

	function getActiveScratch() {
		if (!activeScratchId.value) return null;
		return scratches.value.find(
			(scratch) => scratch.id === activeScratchId.value
		);
	}

	function setActiveScratch(id: string) {
		activeScratchId.value = id;

		const scratch = getScratchById(id);
		if (scratch) {
			saveActiveScratchId(scratch.projectId);
		}
	}

	function toggleSidePanel() {
		isOpen.value = !isOpen.value;
	}

	return {
		scratches,
		isOpen,
		activeScratchId,
		loadScratches,
		addScratch,
		updateScratch,
		updateActiveScratchContent,
		deleteScratch,
		getScratchById,
		getActiveScratch,
		setActiveScratch,
		toggleSidePanel
	};
});
