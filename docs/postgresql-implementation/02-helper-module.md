# Step 2: Set Up PostgreSQL Helper Module

In this step, we'll create a helper module for PostgreSQL similar to the existing MySQL helper module. This will handle connection pooling, testing connections, and other database operations.

## Tasks

- [ ] Install PostgreSQL client library
- [ ] Create PostgreSQL helper module
- [ ] Implement connection pool management
- [ ] Implement connection testing functions

## Implementation Details

### 1. Install PostgreSQL Client Library

First, install the required PostgreSQL client library:

```bash
npm install pg
npm install @types/pg --save-dev
```

### 2. Create PostgreSQL Helper Module

Create a new file `electron/helpers/postgresql.ts` with the following content:

```typescript
import { Pool, PoolClient, ClientConfig } from 'pg';
import { PostgresqlConnection } from '../../src/types/postgresql-connection';

const ERROR_MESSAGES = {
	'28P01': 'Authentication failed with the provided credentials',
	ECONNREFUSED: 'Connection refused - check host and port',
	'3D000': (db: string) => `Database '${db}' does not exist`
};

const SELECT_TEST_SQL = 'SELECT 1 AS connection_test';

const connectionPools = new Map<string, Pool>();

function validateParams({ host, port, user, database }: PostgresqlConnection) {
	if (!host || !port || !user || !database) {
		throw new Error('Missing required connection parameters');
	}
}

function getPoolKey(
	config: PostgresqlConnection,
	useConnectionDb: boolean,
	targetDatabase: string
): string {
	const dbName = useConnectionDb ? config.database : targetDatabase;
	return `${config.host}:${config.port}:${config.user}:${dbName}:${config.schema || 'public'}`;
}

function getConnectionOptions(
	config: PostgresqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): ClientConfig {
	return {
		host: config.host,
		port: Number(config.port),
		user: config.user,
		password: config.password || '',
		database: useConnectionDb ? config.database : targetDatabase,
		schema: config.schema || 'public',
		ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
		connectionTimeoutMillis: config.connectTimeout || 10000
	};
}

function getConnectionPool(
	config: PostgresqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Pool {
	const poolKey = getPoolKey(config, useConnectionDb, targetDatabase);

	if (!connectionPools.has(poolKey)) {
		const poolConfig = getConnectionOptions(config, {
			useConnectionDb,
			targetDatabase
		});

		connectionPools.set(poolKey, new Pool(poolConfig));
	}

	return connectionPools.get(poolKey) as Pool;
}

async function createConnection(
	config: PostgresqlConnection,
	{ useConnectionDb = true, targetDatabase = '' } = {}
): Promise<PoolClient> {
	validateParams(config);

	const pool = getConnectionPool(config, { useConnectionDb, targetDatabase });

	return pool.connect();
}

async function releaseConnection(client: PoolClient) {
	if (client) {
		client.release();
	}
}

async function safeEndConnection(client: PoolClient) {
	try {
		if (client) {
			client.release();
		}
	} catch (error) {
		console.error('Error releasing PostgreSQL connection:', error);
	}
}

async function closeAllPools() {
	const promises: Promise<void>[] = [];

	for (const pool of connectionPools.values()) {
		promises.push(pool.end());
	}

	connectionPools.clear();

	return Promise.all(promises);
}

async function ping(
	config: PostgresqlConnection,
	options: { useConnectionDb?: boolean; targetDatabase?: string } = {}
) {
	const client = await createConnection(config, options);

	try {
		const res = await client.query(SELECT_TEST_SQL);

		if (!Array.isArray(res.rows) || res.rows.length === 0) {
			throw new Error('Connection established but query failed');
		}
	} finally {
		await releaseConnection(client);
	}
}

async function testConnection(config: PostgresqlConnection) {
	try {
		await ping(config, { useConnectionDb: true });

		return { success: true, message: 'Connection successful' };
	} catch (err) {
		console.error('Error testing PostgreSQL connection:', err);

		const custom = ERROR_MESSAGES[err.code];
		const message =
			typeof custom === 'function'
				? custom(config.database)
				: custom || err.message;

		return { success: false, message };
	}
}

export {
	createConnection,
	releaseConnection,
	safeEndConnection,
	testConnection,
	ping,
	closeAllPools
};
```

### 3. Update Main Module Cleanup

In `electron/main/index.ts`, update the cleanup function to close PostgreSQL pools too:

```typescript
// Import PostgreSQL helper
import { closeAllPools as closeMysqlPools } from '../helpers/mysql';
import { closeAllPools as closePostgresPools } from '../helpers/postgresql';

// In app.on('window-all-closed') handler:
app.on('window-all-closed', () => {
	win = null;

	cleanup();

	// Close all database connection pools
	Promise.all([closeMysqlPools(), closePostgresPools()])
		.catch((err) => {
			console.error('Error closing database pools:', err);
		})
		.finally(() => {
			if (process.platform === 'darwin') app.quit();
		});
});
```

## Verification

- Ensure PostgreSQL client libraries are installed correctly
- Verify the helper module is created with all required functions
- Check that connection pooling works correctly
- Test the connection functions with valid and invalid credentials

## Next Steps

After completing these tasks, proceed to [Step 3: Create IPC Handlers](./03-ipc-handlers.md).
