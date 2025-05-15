import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useConnectionsStore } from './connections';
import { useProjectStore } from './project';

interface FactoryAttribute {
	name: string;
	value: string;
	selected?: boolean;
	customValue?: string;
}

interface Factory {
	path: string;
	name: string;
	content: string;
	definition: string | null;
	attributes: FactoryAttribute[];
}

export function createFactoryStore(tableName: string) {
	return defineStore(`factory-${tableName}`, () => {
		const connectionStore = useConnectionsStore();
		const projectStore = useProjectStore();

		const isLoading = ref(false);
		const factory = ref<Factory | null>(null);
		const error = ref<string | null>(null);
		const modelName = ref<string | null>(null);
		const recordCount = ref<number>(1);
		const showSeedModal = ref(false);

		const selectedAttributes = computed(() => {
			if (!factory.value?.attributes) return [];
			return factory.value.attributes
				.filter((attr: FactoryAttribute) => attr.selected)
				.map((attr: FactoryAttribute) => {
					return {
						name: attr.name,
						value:
							attr.customValue !== undefined
								? attr.customValue
								: attr.value
					};
				});
		});

		const generateSeedCommand = computed(() => {
			if (!modelName.value) return '';

			const project = connectionStore.getSelectedProject;
			const usingSail = project?.usingSail || false;
			const artisanPrefix = usingSail ? 'sail ' : '';

			const attributes = selectedAttributes.value;
			let command = `${artisanPrefix}php artisan tinker --execute="`;

			if (attributes.length > 0) {
				const stateValues = attributes
					.map((attr) => `'${attr.name}' => ${attr.value}`)
					.join(', ');

				command += `App\\\\Models\\\\${modelName.value}::factory(${recordCount.value})->state([${stateValues}])->create()"`;
			} else {
				command += `App\\\\Models\\\\${modelName.value}::factory(${recordCount.value})->create()"`;
			}

			return command;
		});

		async function loadFactory() {
			if (!tableName) return;

			const project = connectionStore.getSelectedProject;
			if (!project?.id || !project.projectPath) {
				error.value = 'No project selected';
				return;
			}

			isLoading.value = true;
			error.value = null;

			try {
				await projectStore.getModelsForTables(project);

				if (projectStore.models && projectStore.models.models) {
					const matchingModel = projectStore.models.models.find(
						(m) => m.table === tableName
					);

					if (!matchingModel) {
						error.value = `No model found for table "${tableName}"`;
						isLoading.value = false;
						return;
					}

					modelName.value = matchingModel.name;

					const result = await window.ipcRenderer.findFactoryFiles(
						project.projectPath,
						matchingModel.name
					);

					if (result.success && result.factory) {
						const factoryData = result.factory;

						if (factoryData.attributes) {
							factoryData.attributes = factoryData.attributes.map(
								(attr: FactoryAttribute) => ({
									...attr,
									selected: false
								})
							);
						}

						factory.value = factoryData;
					} else {
						error.value = result.message || 'Factory not found';
						factory.value = null;
					}
				}
			} catch (err: any) {
				console.error('Failed to load factory:', err);
				error.value = err.message || 'Error loading factory';
				factory.value = null;
			} finally {
				isLoading.value = false;
			}
		}

		function toggleAttributeSelection(attrName: string) {
			if (!factory.value?.attributes) return;

			const attr = factory.value.attributes.find(
				(a) => a.name === attrName
			);
			if (attr) {
				attr.selected = !attr.selected;
			}
		}

		function setAttributeCustomValue(attrName: string, value: string) {
			if (!factory.value?.attributes) return;

			const attr = factory.value.attributes.find(
				(a) => a.name === attrName
			);
			if (attr) {
				attr.customValue = value || undefined;
			}
		}

		function setRecordCount(count: number) {
			recordCount.value = count > 0 ? count : 1;
		}

		function openSeedModal() {
			showSeedModal.value = true;
		}

		function closeSeedModal() {
			showSeedModal.value = false;
		}

		return {
			isLoading,
			factory,
			error,
			modelName,
			recordCount,
			showSeedModal,
			selectedAttributes,
			generateSeedCommand,
			loadFactory,
			toggleAttributeSelection,
			setAttributeCustomValue,
			setRecordCount,
			openSeedModal,
			closeSeedModal
		};
	})();
}

export function useFactoryStore(tableName: string) {
	return createFactoryStore(tableName);
}
