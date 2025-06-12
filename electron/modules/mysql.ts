import { ipcMain } from 'electron';
import {
	testConnection,
	createConnection,
	safeEndConnection,
	listDatabases
} from '../helpers/mysql';
import { AppConnection } from '../../src/types/ssh-connection';
import { PoolConnection } from 'mysql2/promise';

function registerMysqlHandlers() {
	ipcMain.handle(
		'test-mysql-connection',
		async (_, config: AppConnection) => {
			return await testConnection(config);
		}
	);

	ipcMain.handle(
		'create-database',
		async (_, config: AppConnection, databaseName: string) => {
			let connection: PoolConnection;

			try {
				connection = await createConnection(config);

				const dbName = connection.escapeId(databaseName);

				await connection.query(
					`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
				);

				return {
					success: true,
					message: `Database ${config.localDbConfig} created successfully`
				};
			} catch (err) {
				console.error('Error creating database:', err);
				let msg = err.message;
				if (err.code === 'ER_ACCESS_DENIED_ERROR') {
					msg = 'Access denied with the provided credentials';
				} else if (err.code === 'ECONNREFUSED') {
					msg = 'Connection refused - check host and port';
				} else if (err.code === 'ER_DB_CREATE_EXISTS') {
					msg = `Database already exists`;
				}
				return {
					success: false,
					message: msg
				};
			} finally {
				await safeEndConnection(connection);
			}
		}
	);

	ipcMain.handle('list-databases', async (_, config: AppConnection) => {
		return await listDatabases(config);
	});

	ipcMain.handle(
		'drop-database',
		async (_, config: AppConnection, databaseName: string) => {
			let connection: PoolConnection;

			try {
				connection = await createConnection(config);

				const dbName = connection.escapeId(databaseName);

				await connection.query(`DROP DATABASE ${dbName}`);

				return {
					success: true,
					message: `Database ${databaseName} dropped successfully`
				};
			} catch (err) {
				console.error('Error dropping database:', err);
				let msg = err.message;
				if (err.code === 'ER_ACCESS_DENIED_ERROR') {
					msg = 'Access denied with the provided credentials';
				} else if (err.code === 'ECONNREFUSED') {
					msg = 'Connection refused - check host and port';
				} else if (err.code === 'ER_DB_DROP_EXISTS') {
					msg = `Database ${config.localDbConfig.database || config.remote.remoteDbConfig.database} does not exist`;
				}
				return {
					success: false,
					message: msg
				};
			} finally {
				await safeEndConnection(connection);
			}
		}
	);
}

export { registerMysqlHandlers };
