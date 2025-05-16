import { MysqlConnection } from './mysql-connection';

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
	dbConnection: MysqlConnection;
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
	dbConnection: MysqlConnection;
}

export interface TableColumn {
	field: string;
	width?: number;
}

export interface DeleteRowsConfig {
	dbConnection: MysqlConnection;
	tableName: string;
	ids: (string | number)[];
	ignoreForeignKeys: boolean;
}

export interface UpdateTableRecord {
	dbConnection: MysqlConnection;
	tableName: string;
	data: Record<string, any>;
	id: string | number;
}
