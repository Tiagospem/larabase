import { ipcMain } from 'electron';
import { createConnection, releaseConnection } from '../helpers/mysql';
import { AppConnection } from '../../src/types/ssh-connection';

async function executeSqlQueryHandler(
	_: any,
	config: AppConnection,
	query: string
) {
	let connection: any;

	try {
		connection = await createConnection(config);

		try {
			const [results] = await connection.query(query);

			return { success: true, results };
		} catch (error) {
			console.error('Error executing query:', error.message);
			return { success: false, error: error.message };
		}
	} catch (error) {
		console.error('Error connecting to database:', error.message);
		return { success: false, error: error.message };
	} finally {
		if (connection) {
			await releaseConnection(connection);
		}
	}
}

async function executeExplainSqlHandler(
	_: any,
	config: AppConnection,
	query: string
) {
	let connection: any;

	try {
		connection = await createConnection(config);

		try {
			const explainQuery = `EXPLAIN ${query}`;
			const [explainResults] = await connection.query(explainQuery);

			let jsonExplain = null;
			try {
				const [versionResult] = await connection.query(
					'SELECT VERSION() as version'
				);
				const version = versionResult[0].version;
				const majorVersion = parseInt(version.split('.')[0], 10);

				if (majorVersion >= 5) {
					try {
						const [jsonResults] = await connection.query(
							`EXPLAIN FORMAT=JSON ${query}`
						);
						if (
							jsonResults &&
							jsonResults[0] &&
							jsonResults[0].EXPLAIN
						) {
							jsonExplain = jsonResults[0].EXPLAIN;
						}
					} catch (jsonErr) {
						console.log(
							'JSON EXPLAIN not supported or failed:',
							jsonErr
						);
					}
				}
			} catch (versionErr) {
				console.log('Could not determine MySQL version:', versionErr);
			}

			return {
				success: true,
				explainResults,
				jsonExplain,
				query
			};
		} catch (error) {
			console.error('Error executing EXPLAIN query:', error.message);
			return { success: false, error: error.message };
		}
	} catch (error) {
		console.error('Error connecting to database:', error.message);
		return { success: false, error: error.message };
	} finally {
		if (connection) {
			await releaseConnection(connection);
		}
	}
}

export function registerSqlExecutorHandlers() {
	ipcMain.handle('execute-sql-query', executeSqlQueryHandler);
	ipcMain.handle('execute-explain-sql', executeExplainSqlHandler);
}
