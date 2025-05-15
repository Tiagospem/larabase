import mysql, { ConnectionOptions, Pool } from 'mysql2/promise';
import { MysqlConnection } from '../../src/types/mysql-connection';

const ERROR_MESSAGES = {
	ER_ACCESS_DENIED_ERROR: 'Access denied with the provided credentials',
	ECONNREFUSED: 'Connection refused - check host and port',
	ER_BAD_DB_ERROR: (db: string) => `Database '${db}' does not exist`
};

const SELECT_TEST_SQL = 'SELECT 1 AS connection_test';

const connectionPools = new Map<string, Pool>();

function validateParams({ host, port, user, database }: MysqlConnection) {
	if (!host || !port || !user || !database) {
		throw new Error('Missing required connection parameters');
	}
}

function getConnectionOptions(
	config: MysqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): ConnectionOptions {
	return {
		host: config.host,
		port: Number(config.port),
		user: config.user,
		password: config.password || '',
		database: useConnectionDb ? config.database : targetDatabase,
		connectTimeout: 10000
	};
}

function getPoolKey(
	config: MysqlConnection,
	useConnectionDb: boolean,
	targetDatabase: string
): string {
	return `${config.host}:${config.port}:${config.user}:${useConnectionDb ? config.database : targetDatabase}`;
}

function getConnectionPool(
	config: MysqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Pool {
	const poolKey = getPoolKey(config, useConnectionDb, targetDatabase);

	if (!connectionPools.has(poolKey)) {
		const poolConfig = {
			...getConnectionOptions(config, {
				useConnectionDb,
				targetDatabase
			}),
			connectionLimit: 10,
			waitForConnections: true,
			queueLimit: 0
		};

		connectionPools.set(poolKey, mysql.createPool(poolConfig));
	}

	return connectionPools.get(poolKey) as Pool;
}

async function createConnection(
	config: MysqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
) {
	validateParams(config);

	const pool = getConnectionPool(config, { useConnectionDb, targetDatabase });

	return pool.getConnection();
}

async function releaseConnection(connection: any) {
	if (connection && typeof connection.release === 'function') {
		connection.release();
	}
}

async function ping(
	config: MysqlConnection,
	options: { useConnectionDb?: boolean; targetDatabase?: string } = {}
) {
	const conn = await createConnection(config, options);

	try {
		const [rows] = await conn.query(SELECT_TEST_SQL);

		if (!Array.isArray(rows) || rows.length === 0) {
			throw new Error('Connection established but query failed');
		}
	} finally {
		await releaseConnection(conn);
	}
}

async function testConnection(config: MysqlConnection) {
	try {
		await ping(config, { useConnectionDb: true });

		return { success: true, message: 'Connection successful' };
	} catch (err) {
		console.error('Error testing MySQL connection:', err);

		const custom = ERROR_MESSAGES[err.code];
		const message =
			typeof custom === 'function'
				? custom(config.database)
				: custom || err.message;

		return { success: false, message };
	}
}

function closeAllPools() {
	return Promise.all(
		Array.from(connectionPools.values()).map((pool) => pool.end())
	);
}

async function safeEndConnection(connection?: any) {
	if (connection && typeof connection.end === 'function') {
		try {
			await releaseConnection(connection);
		} catch (e) {
			console.error('Error closing connection:', e);
		}
	}
}

export {
	createConnection,
	testConnection,
	getConnectionOptions,
	closeAllPools,
	releaseConnection,
	safeEndConnection,
	ERROR_MESSAGES
};
