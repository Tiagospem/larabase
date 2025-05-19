import mysql, {
	ConnectionOptions,
	Pool,
	PoolConnection,
	RowDataPacket,
} from 'mysql2/promise';
import { createTunnel, closeTunnel } from './ssh';
import { AppConnection } from '../../src/types/ssh-connection';

const ERROR_MESSAGES: Record<string, string | ((db: string) => string)> = {
	ER_ACCESS_DENIED_ERROR: 'Access denied with the provided credentials',
	ECONNREFUSED: 'Connection refused - check host and port',
	ER_BAD_DB_ERROR: (db: string) => `Database '${db}' does not exist`
};

const SELECT_TEST_SQL = 'SELECT 1 AS connection_test';

const connectionPools = new Map<string, Pool>();
const sshTunnels = new Map<string, { localPort: number; tunnelId: string }>();

function validateParams(config: AppConnection): void {
	if (!config) {
		throw new Error('Connection configuration is missing');
	}

	console.log('Validating config:', JSON.stringify(config, null, 2));

	if (config.remote) {
		const remoteConfig = config.remote.remoteDbConfig;

		if (!remoteConfig) {
			throw new Error('SSH remote database configuration is missing');
		}

		if (!remoteConfig.host) {
			throw new Error('SSH remote database host is missing');
		}

		if (!remoteConfig.port) {
			throw new Error('SSH remote database port is missing');
		}

		if (!remoteConfig.database) {
			throw new Error('SSH remote database name is missing');
		}

		if (!remoteConfig.user) {
			throw new Error('SSH remote database user is missing');
		}

		return;
	}

	const local = config.localDbConfig;

	if (!local.host || !local.port || !local.user || !local.database) {
		throw new Error('Missing required connection parameters');
	}
}

async function getConnectionOptions(
	config: AppConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Promise<ConnectionOptions> {
	if (config.remote) {
		const tunnelKey = `${config.remote.host}:${config.remote.port}:${config.remote.user}`;

		let localPort: number;

		if (sshTunnels.has(tunnelKey)) {
			localPort = sshTunnels.get(tunnelKey)!.localPort;
		} else {
			try {
				const tunnel = await createTunnel(
					config.remote,
					config.remote.remoteDbConfig.host,
					config.remote.remoteDbConfig.port
				);

				localPort = tunnel.localPort;

				sshTunnels.set(tunnelKey, {
					localPort,
					tunnelId: tunnel.tunnelId
				});
			} catch (error) {
				throw new Error(
					`Failed to create SSH tunnel: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		return {
			host: 'localhost',
			port: localPort,
			user: config.remote.remoteDbConfig.user,
			password: config.remote.remoteDbConfig.password,
			database: useConnectionDb
				? config.remote.remoteDbConfig.database
				: targetDatabase,
			connectTimeout: 10000
		};
	}

	return {
		host: config.localDbConfig.host,
		port: Number(config.localDbConfig.port),
		user: config.localDbConfig.user,
		password: config.localDbConfig.password || '',
		database: useConnectionDb
			? config.localDbConfig.database
			: targetDatabase,
		connectTimeout: 10000
	};
}

function getPoolKey(
	config: AppConnection,
	useConnectionDb: boolean,
	targetDatabase: string
): string {
	const hostPart = config.remote ? 'localhost' : config.localDbConfig.host;
	const portPart = config.remote
		? sshTunnels.get(
				`${config.remote.host}:${config.remote.port}:${config.remote.user}`
			)?.localPort
		: config.localDbConfig.port;

	// Para conexões remotas, use as informações do remoteDbConfig
	const userPart = config.remote
		? config.remote.remoteDbConfig.user
		: config.localDbConfig.user;

	const dbPart = useConnectionDb
		? config.remote
			? config.remote.remoteDbConfig.database
			: config.localDbConfig.database
		: targetDatabase;

	return `${hostPart}:${portPart}:${userPart}:${dbPart}`;
}

async function getConnectionPool(
	config: AppConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Promise<Pool> {
	const poolKey = getPoolKey(config, useConnectionDb, targetDatabase);

	if (!connectionPools.has(poolKey)) {
		const poolConfig = {
			...(await getConnectionOptions(config, {
				useConnectionDb,
				targetDatabase
			})),
			connectionLimit: 10,
			waitForConnections: true,
			queueLimit: 0
		};

		connectionPools.set(poolKey, mysql.createPool(poolConfig));
	}

	return connectionPools.get(poolKey) as Pool;
}

async function createConnection(
	config: AppConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Promise<PoolConnection> {
	validateParams(config);

	const pool = await getConnectionPool(config, {
		useConnectionDb,
		targetDatabase
	});

	return pool.getConnection();
}

async function releaseConnection(connection: PoolConnection): Promise<void> {
	if (connection && typeof connection.release === 'function') {
		connection.release();
	}
}

async function ping(
	config: AppConnection,
	options: { useConnectionDb?: boolean; targetDatabase?: string } = {}
): Promise<void> {
	const conn = await createConnection(config, options);

	try {
		// Define a interface para o resultado da consulta de teste
		interface ConnectionTestRow extends RowDataPacket {
			connection_test: number;
		}

		const [rows] = await conn.query<ConnectionTestRow[]>(SELECT_TEST_SQL);

		if (!Array.isArray(rows) || rows.length === 0) {
			throw new Error('Connection established but query failed');
		}
	} finally {
		await releaseConnection(conn);
	}
}

interface MysqlError extends Error {
	code?: string;
}

async function testConnection(
	config: AppConnection
): Promise<{ success: boolean; message: string }> {
	try {
		await ping(config, { useConnectionDb: true });

		return { success: true, message: 'Connection successful' };
	} catch (err) {
		console.error('Error testing MySQL connection:', err);

		// Tratar o erro como um MysqlError para acessar a propriedade code
		const mysqlErr = err as MysqlError;
		const errorCode = mysqlErr.code || '';

		const custom = ERROR_MESSAGES[errorCode];
		const message =
			typeof custom === 'function'
				? custom(config.localDbConfig?.database || '')
				: custom || mysqlErr.message || String(err);

		return { success: false, message };
	}
}

async function closeAllPools(): Promise<void> {
	await Promise.all(
		Array.from(connectionPools.values()).map((pool) => pool.end())
	);

	for (const [key, tunnel] of Array.from(sshTunnels.entries())) {
		closeTunnel(tunnel.tunnelId);
		sshTunnels.delete(key);
	}
}

async function safeEndConnection(connection?: PoolConnection): Promise<void> {
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
