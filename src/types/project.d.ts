import { MysqlConnection } from './mysql-connection';
import { RedisConnection } from './redis';
import { DockerInfo } from './docker-info';

export interface ProjectConnection {
	id?: string | null;
	name: string;
	projectPath: string;
	type: string;
	icon: string | undefined | null;
	db_config: MysqlConnection;
	redis_config: RedisConnection;
	usingSail: boolean;
	status: string;
	isValid: boolean;
	dockerInfo?: DockerInfo | undefined | null;
}

export interface FileStats {
	success: boolean;
	size: number;
	created: Date;
	modified: Date;
	isDirectory: boolean;
	message?: string;
}

export interface ExtractTablesResponse {
	success: boolean;
	message?: string;
	tables: TableInfo[];
}

export interface TableInfo {
	name: string;
	size?: 'large' | 'medium' | 'small' | 'empty';
	formattedRows?: string;
	estimatedRows?: number;
}

export interface RestoreConfig {
	project: ProjectConnection;
	filePath: string;
	tables: TableInfo[];
	ignoredTables: string[];
	targetDatabase?: string;
	setAsDefault: boolean;
}

export interface RestorationProgressConfig {
	command?: string;
	container?: string;
	targetDatabase: string;
	connection: MysqlConnection;
	sqlFilePath: string;
	ignoredTables: string[];
	useDockerApi: boolean;
	ignoreCreateDatabase: boolean;
}

export interface ModelInfo {
	name: string;
	namespace: string;
	fullName: string;
	path: string;
	relativePath: string;
	table: string;
}

export interface ModelWithContent extends ModelInfo {
	content: string;
}

export interface Models {
	success: boolean;
	message?: string;
	models: ModelInfo[];
}

export interface LogFile {
	name: string;
	path: string;
	size: number;
	modified: Date;
}

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	content: string[];
}

export interface LogResponse {
	success: boolean;
	message?: string;
	entries?: LogEntry[];
	logs?: LogFile[];
}
