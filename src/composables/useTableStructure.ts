import { ref, computed } from 'vue';

export interface ColumnType {
	name: string;
	type: string;
	isDateTime: boolean;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	isNullable: boolean;
	defaultValue: any;
}

export function useTableStructure() {
	const structure = ref<ColumnType[]>([]);

	const dateTimeColumns = computed(() => {
		return structure.value
			.filter((col) => col.isDateTime)
			.map((col) => col.name);
	});

	const primaryKey = computed(() => {
		const pk = structure.value.find((col) => col.isPrimaryKey);
		return pk ? pk.name : 'id';
	});

	const columnTypes = computed(() => {
		return structure.value.reduce(
			(acc, col) => {
				acc[col.name] = col.type;
				return acc;
			},
			{} as Record<string, string>
		);
	});

	function initializeWithStructure(tableStructure: any[]) {
		if (!tableStructure || !tableStructure.length) return;

		structure.value = tableStructure.map((col: any) => {
			const type = col.type?.toLowerCase() || '';

			return {
				name: col.name,
				type: type,
				isDateTime:
					type.includes('datetime') ||
					type.includes('timestamp') ||
					type.includes('date'),
				isPrimaryKey: col.key === 'PRI',
				isForeignKey: !!col.foreign_key,
				isNullable: col.null === 'YES',
				defaultValue: col.default
			};
		});
	}

	function isDateTimeColumn(columnName: string): boolean {
		return dateTimeColumns.value.includes(columnName);
	}

	function getColumnType(columnName: string): string | undefined {
		return columnTypes.value[columnName];
	}

	function formatColumnValue(columnName: string, value: any): any {
		if (value === null || value === undefined) {
			return value;
		}

		if (isDateTimeColumn(columnName)) {
			try {
				const date = new Date(value);

				if (isNaN(date.getTime())) {
					return value;
				}

				const type = getColumnType(columnName);

				if (type?.toLowerCase() === 'date') {
					return date.toISOString().split('T')[0];
				}

				return date.toISOString().replace('T', ' ').split('.')[0];
			} catch (e) {
				return value;
			}
		}

		return value;
	}

	return {
		structure,
		initializeWithStructure,
		formatColumnValue,
		isDateTimeColumn,
		getColumnType,
		primaryKey
	};
}
