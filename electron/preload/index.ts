import { ipcRenderer, contextBridge } from 'electron';
import { Settings } from '../../src/types/settings';
import { MysqlConnection } from '../../src/types/mysql-connection';
import { RestoreConfig } from '../../src/types/project';
import { RedisConnection } from '../../src/types/redis';
import {
	DeleteRowsConfig,
	DropTableParams,
	Table,
	TableRecord,
	UpdateTableRecord
} from '../../src/types/table';
import { SshConnection } from '../../src/types/ssh-connection';

contextBridge.exposeInMainWorld('ipcRenderer', {
	on(...args: Parameters<typeof ipcRenderer.on>) {
		const [channel, listener] = args;
		return ipcRenderer.on(channel, (event, ...args) =>
			listener(event, ...args)
		);
	},
	off(...args: Parameters<typeof ipcRenderer.off>) {
		const [channel, ...omit] = args;
		return ipcRenderer.off(channel, ...omit);
	},
	send(...args: Parameters<typeof ipcRenderer.send>) {
		const [channel, ...omit] = args;
		return ipcRenderer.send(channel, ...omit);
	},
	invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
		const [channel, ...omit] = args;
		return ipcRenderer.invoke(channel, ...omit);
	},
	removeAllListeners(
		...args: Parameters<typeof ipcRenderer.removeAllListeners>
	) {
		const [channel] = args;
		return ipcRenderer.removeAllListeners(channel);
	},
	/**
	 * DB monitoring
	 */
	startLiveDbUpdate: (config: {
		connectionId: string;
		dbConnection: MysqlConnection;
		clearHistory?: boolean;
	}) => ipcRenderer.invoke('start-live-db-updates', config),
	stopDbMonitoring: (connectionId: string) =>
		ipcRenderer.invoke('stop-db-monitoring', connectionId),
	clearDbHistory: (connectionId: string) =>
		ipcRenderer.invoke('clear-db-history', connectionId),
	/**
	 * Terminal
	 */
	start_terminal_process: (command: string, projectPath?: string) =>
		ipcRenderer.invoke('start-terminal-process', command, projectPath),
	cancel_terminal_process: () =>
		ipcRenderer.invoke('cancel-terminal-process'),
	/**
	 * Redis
	 */
	checkRedisStatus: (config: RedisConnection) =>
		ipcRenderer.invoke('check-redis-status', config),
	getRedisDBs: (config: RedisConnection) =>
		ipcRenderer.invoke('get-redis-databases', config),
	getRedisKeys: (
		config: RedisConnection,
		db: number,
		pattern?: string,
		cursor?: string,
		count?: number
	) =>
		ipcRenderer.invoke(
			'get-redis-keys',
			config,
			db,
			pattern,
			cursor,
			count
		),
	getRedisKeyValue: (
		config: RedisConnection,
		db: number,
		key: string,
		type: string
	) => ipcRenderer.invoke('get-redis-key-value', config, db, key, type),
	flushRedisDB: (config: RedisConnection, db: number) =>
		ipcRenderer.invoke('flush-redis-db', config, db),
	deleteRedisKey: (config: RedisConnection, db: number, key: string) =>
		ipcRenderer.invoke('delete-redis-key', config, db, key),
	/**
	 * MySQL
	 */
	testMySQLConnection: (config: MysqlConnection) =>
		ipcRenderer.invoke('test-mysql-connection', config),
	listDatabases: (config: MysqlConnection) =>
		ipcRenderer.invoke('list-databases', config),
	dropDatabase: (config: MysqlConnection, databaseName: string) =>
		ipcRenderer.invoke('drop-database', config, databaseName),
	createDatabase: (config: MysqlConnection, databaseName: string) =>
		ipcRenderer.invoke('create-database', config, databaseName),
	/**
	 * Tables
	 */
	dropTables: (params: DropTableParams) =>
		ipcRenderer.invoke('drop-tables', params),
	listTables: (config: MysqlConnection) =>
		ipcRenderer.invoke('list-tables', config),
	getTableRecordCount: (config: MysqlConnection, table: Table) =>
		ipcRenderer.invoke('get-table-record-count', config, table),
	truncateTable: (config: MysqlConnection, tableName: string) =>
		ipcRenderer.invoke('truncate-table', config, tableName),
	getTableRecords: (config: TableRecord) =>
		ipcRenderer.invoke('get-table-records', config),
	deleteRecords: (config: DeleteRowsConfig) =>
		ipcRenderer.invoke('delete-table-records', config),
	getTableStructure: (config: MysqlConnection, tableName: string) =>
		ipcRenderer.invoke('get-table-structure', config, tableName),
	getTableForeignKeys: (config: MysqlConnection, tableName: string) =>
		ipcRenderer.invoke('get-table-foreign-keys', config, tableName),
	getTableIndexes: (config: MysqlConnection, tableName: string) =>
		ipcRenderer.invoke('get-table-indexes', config, tableName),
	getDatabaseSchemaForAI: (config: MysqlConnection) =>
		ipcRenderer.invoke('get-database-schema-for-ai', config),
	updateTableRecord: (config: UpdateTableRecord) =>
		ipcRenderer.invoke('update-table-record', config),
	hashPassword: (password: string, rounds: number = 10) =>
		ipcRenderer.invoke('hash-password', password, rounds),
	/**
	 * Migrations
	 */
	getMigrationStatus: (config: {
		projectPath: string;
		usingSail: boolean;
		db_config: MysqlConnection;
	}) => ipcRenderer.invoke('get-migration-status', config),
	/**
	 * Files
	 */
	readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
	saveFile: (filePath: string, content: any) =>
		ipcRenderer.invoke('save-file', filePath, content),
	/**
	 * Project
	 */
	saveSettings: (config: Settings) =>
		ipcRenderer.invoke('save-settings', config),
	getSettings: () => ipcRenderer.invoke('get-settings'),
	compareProjectDatabase: (config: {
		projectPath: string;
		database: string;
	}) => ipcRenderer.invoke('compare-project-database', config),
	updateEnvDatabase: (config: { projectPath: string; database: string }) =>
		ipcRenderer.invoke('update-env-database', config),
	findModelsForTables: (projectPath: string) =>
		ipcRenderer.invoke('find-models-for-tables', projectPath),
	selectDirectory: () => ipcRenderer.invoke('select-directory'),
	validateLaravelProject: (projectPath: string) =>
		ipcRenderer.invoke('validate-laravel-project', projectPath),
	readEnvFile: (projectPath: string) =>
		ipcRenderer.invoke('read-env-file', projectPath),
	openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
	findTableMigrations: (projectPath: string, tableName: string) =>
		ipcRenderer.invoke('find-table-migrations', projectPath, tableName),
	readModelFile: (filePath: string) =>
		ipcRenderer.invoke('read-model-file', filePath),
	findFactoryFiles: (projectPath: string, modelName: string) =>
		ipcRenderer.invoke('find-factory-files', projectPath, modelName),
	findLaravelCommands: (projectPath: string) =>
		ipcRenderer.invoke('find-laravel-commands', projectPath),
	/**
	 * Database Restore
	 */
	getFileStats: (filePath: string) =>
		ipcRenderer.invoke('get-file-stats', filePath),
	selectSqlDumpFile: () => ipcRenderer.invoke('select-sql-dump-file'),
	extractTablesFromSql: (filePath: string) =>
		ipcRenderer.invoke('extract-tables-from-sql', filePath),
	restoreDatabase: (restorationConfig: RestoreConfig) =>
		ipcRenderer.invoke('restore-database', restorationConfig),
	cancelDatabaseRestore: () => ipcRenderer.invoke('cancel-database-restore'),
	/**
	 * Project Logs
	 */
	getProjectLogs: (projectPath: string) =>
		ipcRenderer.invoke('get-project-logs', projectPath),
	readLogFile: (filePath: string, searchTerm?: string, logType?: string) =>
		ipcRenderer.invoke('read-log-file', filePath, searchTerm, logType),
	deleteLogEntry: (filePath: string, timestamp: string) =>
		ipcRenderer.invoke('delete-log-entry', filePath, timestamp),
	deleteLogFile: (filePath: string) =>
		ipcRenderer.invoke('delete-log-file', filePath),
	deleteAllLogs: (projectPath: string) =>
		ipcRenderer.invoke('delete-all-logs', projectPath),
	clearAllLogs: (projectPath: string) =>
		ipcRenderer.invoke('clear-all-logs', projectPath),
	/**
	 * SQL Executor
	 */
	executeSqlQuery: (config: MysqlConnection, query: string) =>
		ipcRenderer.invoke('executeSqlQuery', config, query),
	executeExplainSql: (config: MysqlConnection, query: string) =>
		ipcRenderer.invoke('executeExplainSql', config, query),
	/**
	 * Auto-updater
	 */
	onUpdateStatus: (callback: Function) => {
		const subscription = (_event: any, ...args: any[]) => callback(...args);
		ipcRenderer.on('update-status', subscription);
		return () => {
			ipcRenderer.removeListener('update-status', subscription);
		};
	},
	checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
	downloadUpdate: () => ipcRenderer.invoke('download-update'),
	quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
	getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
	openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

	/**
	 * SSH Operations
	 */
	ssh: {
		testConnection: (config: SshConnection) =>
			ipcRenderer.invoke('ssh:test-connection', config),
		executeCommand: (config: SshConnection, command: string) =>
			ipcRenderer.invoke('ssh:execute-command', config, command),
		readFile: (config: SshConnection, filePath: string) =>
			ipcRenderer.invoke('ssh:read-file', config, filePath),
		writeFile: (config: SshConnection, filePath: string, content: string) =>
			ipcRenderer.invoke('ssh:write-file', config, filePath, content),
		listFiles: (config: SshConnection, dirPath: string) =>
			ipcRenderer.invoke('ssh:list-files', config, dirPath),
		getEnv: (config: SshConnection) =>
			ipcRenderer.invoke('ssh:get-env', config),
		updateEnv: (config: SshConnection, content: string) =>
			ipcRenderer.invoke('ssh:update-env', config, content),
		closeConnection: (config: SshConnection) =>
			ipcRenderer.invoke('ssh:close-connection', config)
	}
});

function domReady(
	condition: DocumentReadyState[] = ['complete', 'interactive']
) {
	return new Promise((resolve) => {
		if (condition.includes(document.readyState)) {
			resolve(true);
		} else {
			document.addEventListener('readystatechange', () => {
				if (condition.includes(document.readyState)) {
					resolve(true);
				}
			});
		}
	});
}

const safeDOM = {
	append(parent: HTMLElement, child: HTMLElement) {
		if (!Array.from(parent.children).find((e) => e === child)) {
			return parent.appendChild(child);
		}
	},
	remove(parent: HTMLElement, child: HTMLElement) {
		if (Array.from(parent.children).find((e) => e === child)) {
			return parent.removeChild(child);
		}
	}
};

function useLoading() {
	const className = `loaders-css__square-spin`;
	const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `;
	const oStyle = document.createElement('style');
	const oDiv = document.createElement('div');

	oStyle.id = 'app-loading-style';
	oStyle.innerHTML = styleContent;
	oDiv.className = 'app-loading-wrap';
	oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

	return {
		appendLoading() {
			safeDOM.append(document.head, oStyle);
			safeDOM.append(document.body, oDiv);
		},
		removeLoading() {
			safeDOM.remove(document.head, oStyle);
			safeDOM.remove(document.body, oDiv);
		}
	};
}

const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

window.onmessage = (ev) => {
	ev.data.payload === 'removeLoading' && removeLoading();
};

setTimeout(removeLoading, 4999);
