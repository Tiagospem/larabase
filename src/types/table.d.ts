import { AppConnection } from './ssh-connection';

export interface Table {
	name: string;
	rowCount: number;
	columnCount: number;
	isApproximate?: boolean;
	filter?: string;
	isHotReload?: boolean;
	isPinned?: boolean;
}

export interface TableList {
	tables: Table[];
	timestamp: number;
}

export interface DropTableParams {
	projectId: string;
	appConnection: AppConnection;
	tables: string[];
	ignoreForeignKeys: boolean;
	cascade: boolean;
}

export interface TableRecord {
	page: number;
	limit: number;
	sortColumn?: string | null;
	sortDirection?: string | null;
	filter?: string;
	tableName: string;
	appConnection: AppConnection;
}

export interface TableColumn {
	field: string;
	width?: number;
}

export interface DeleteRowsConfig {
	appConnection: AppConnection;
	tableName: string;
	ids: (string | number)[];
	ignoreForeignKeys: boolean;
}

export interface UpdateTableRecord {
	appConnection: AppConnection;
	tableName: string;
	data: Record<string, any>;
	id: string | number;
}
