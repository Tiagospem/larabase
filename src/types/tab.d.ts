export interface Tab {
	id: string | number;
	projectId: string;
	tableName: string;
	title: string;
	filter: string;
	rowCount: number;
	data: any;
	columnCount: number;
}
