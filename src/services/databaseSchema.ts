import { onMounted, ref, toRaw } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { useProjectStore } from '@/store/project';
import { AppConnection } from '@/types/ssh-connection';

export interface TableModel {
	name: string;
	namespace: string;
	fullName: string;
}

export interface TableColumn {
	name: string;
	type: string;
	nullable: boolean;
	default: string | null;
	extra: string;
	primary_key: boolean;
	foreign_key: boolean;
}

export interface TableForeignKey {
	type: string;
	table?: string;
	column: string;
	referenced_table?: string;
	referenced_column: string;
	name?: string;
}

export interface TableIndex {
	name: string;
	type: string;
	columns: string[];
}

export interface TableSchema {
	name: string;
	columns: TableColumn[];
	foreignKeys?: TableForeignKey[];
	indexes?: TableIndex[];
	model?: TableModel;
}

export interface DatabaseSchema {
	tables: TableSchema[];
}

const databaseSchema = ref<DatabaseSchema | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export const useDatabaseSchema = () => {
	const connectionsStore = useConnectionsStore();
	const projectStore = useProjectStore();

	const fetchDatabaseSchema = async (
		force = false
	): Promise<DatabaseSchema | null> => {
		if (databaseSchema.value && !force) {
			return databaseSchema.value;
		}

		const selectedProject = connectionsStore.getSelectedProject;
		if (!selectedProject) {
			error.value = 'No project selected';
			return null;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const AppConnection = {
				localDbConfig: toRaw(selectedProject.dbConfig),
				remote: toRaw(selectedProject.sshConfig)
			} as AppConnection;

			const result =
				await window.ipcRenderer.getDatabaseSchemaForAI(AppConnection);

			if (result.success) {
				const modelsResult =
					await projectStore.getModelsForTables(selectedProject);
				const models = modelsResult?.models || [];

				if (result.databaseSchema && result.databaseSchema.tables) {
					result.databaseSchema.tables.forEach(
						(table: TableSchema) => {
							const model = models.find(
								(m) => m.table === table.name
							);
							if (model) {
								table.model = {
									name: model.name,
									namespace: model.namespace,
									fullName: model.fullName
								};
							}
						}
					);
				}

				databaseSchema.value = result.databaseSchema;
				return databaseSchema.value;
			} else {
				error.value = result.message || 'Failed to get database schema';
				console.error('Failed to get database schema:', result.message);
				return null;
			}
		} catch (err) {
			error.value = err instanceof Error ? err.message : String(err);
			console.error('Error fetching database schema:', err);
			return null;
		} finally {
			isLoading.value = false;
		}
	};

	const getCompactSchema = (): string => {
		if (!databaseSchema.value || !databaseSchema.value.tables) {
			return '';
		}

		const tableStrings = databaseSchema.value.tables.map((table) => {
			let result = `T:${table.name}`;

			if (table.model) {
				result += `;M:${table.model.fullName}`;
			}

			if (table.columns && table.columns.length > 0) {
				const columnStrings = table.columns.map(
					(col) => `C:${col.name}:${col.type}`
				);
				result += `;${columnStrings.join(';')}`;
			}

			if (table.foreignKeys && table.foreignKeys.length > 0) {
				const fkStrings = table.foreignKeys
					.filter((fk) => fk.referenced_table)
					.map(
						(fk) =>
							`FK:${fk.column}:${fk.referenced_table || ''}:${fk.referenced_column}`
					);

				if (fkStrings.length > 0) {
					result += `;${fkStrings.join(';')}`;
				}
			}

			return result;
		});

		return tableStrings.join('|');
	};

	const initializeSchema = async () => {
		const selectedProject = connectionsStore.getSelectedProject;
		if (
			selectedProject &&
			(!databaseSchema.value ||
				!databaseSchema.value.tables ||
				databaseSchema.value.tables.length === 0)
		) {
			try {
				await fetchDatabaseSchema();
			} catch (err) {
				console.error('Error initializing database schema:', err);
			}
		}
	};

	onMounted(async () => {
		await initializeSchema();
	});

	return {
		databaseSchema,
		isLoading,
		error,
		fetchDatabaseSchema,
		initializeSchema,
		getCompactSchema
	};
};
