# Step 3: Create IPC Handlers

In this step, we'll create IPC handlers for PostgreSQL operations, allowing the renderer process (UI) to communicate with the main process for database operations.

## Tasks

- [ ] Create PostgreSQL module for IPC handlers
- [ ] Update main process to register PostgreSQL handlers
- [ ] Update preload script to expose PostgreSQL functions

## Implementation Details

### 1. Create PostgreSQL IPC Handlers Module

Create a new file `electron/modules/postgresql.ts` with the following content:

```typescript
import { ipcMain } from 'electron';
import {
	testConnection,
	createConnection,
	safeEndConnection
} from '../helpers/postgresql';
import { PostgresqlConnection } from '../../src/types/postgresql-connection';

function registerPostgresqlHandlers() {
	ipcMain.handle(
		'test-postgresql-connection',
		async (_, config: PostgresqlConnection) => {
			return await testConnection(config);
		}
	);

	ipcMain.handle(
		'create-postgresql-database',
		async (_, config: PostgresqlConnection, databaseName: string) => {
			if (
				!config.host ||
				!config.port ||
				!config.user ||
				!config.database
			) {
				return {
					success: false,
					message: 'Missing connection parameters'
				};
			}

			let client: any;

			try {
				// Connect to the 'postgres' database to create a new database
				const tempConfig = { ...config };
				tempConfig.database = 'postgres';
				client = await createConnection(tempConfig);

				// PostgreSQL requires quoted identifiers for database names with special characters
				await client.query(`CREATE DATABASE "${databaseName}"`);

				return {
					success: true,
					message: `Database ${databaseName} created successfully`
				};
			} catch (err) {
				console.error('Error creating PostgreSQL database:', err);
				let msg = err.message;
				if (err.code === '28P01') {
					msg = 'Authentication failed with the provided credentials';
				} else if (err.code === 'ECONNREFUSED') {
					msg = 'Connection refused - check host and port';
				} else if (err.code === '42P04') {
					msg = `Database ${databaseName} already exists`;
				}
				return {
					success: false,
					message: msg
				};
			} finally {
				await safeEndConnection(client);
			}
		}
	);

	ipcMain.handle(
		'list-postgresql-databases',
		async (_, config: PostgresqlConnection) => {
			if (!config.host || !config.port || !config.user) {
				return {
					success: false,
					message: 'Missing connection parameters',
					databases: []
				};
			}

			let client: any;

			try {
				// Connect to the 'postgres' database to list all databases
				const tempConfig = { ...config };
				tempConfig.database = 'postgres';
				client = await createConnection(tempConfig);

				const result = await client.query(
					"SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1')"
				);

				const databases = result.rows.map((row: any) => row.datname);

				return { success: true, databases };
			} catch (err) {
				let msg = err.message;
				if (err.code === '28P01') {
					msg = 'Authentication failed with the provided credentials';
				} else if (err.code === 'ECONNREFUSED') {
					msg = 'Connection refused - check host and port';
				}
				return {
					success: false,
					message: msg,
					databases: []
				};
			} finally {
				await safeEndConnection(client);
			}
		}
	);
}

export { registerPostgresqlHandlers };
```

### 2. Update Main Process to Register PostgreSQL Handlers

Update `electron/main/index.ts` to register the PostgreSQL handlers:

```typescript
// Add this import
import { registerPostgresqlHandlers } from '../modules/postgresql';

// In the registerHandlers function
function registerHandlers(win: BrowserWindow) {
	if (handlersRegistered) return;

	registerDatabaseRestoreHandlers(win);
	registerMonitoringHandlers(win);
	registerProjectHandlers(win);
	registerSettingsHandlers(store);
	registerTablesHandlers();
	registerMysqlHandlers();
	registerPostgresqlHandlers(); // Add this line
	registerRedisHandlers();
	registerPasswordHandlers();
	registerTerminalHandlers();
	registerMigrationHandlers();
	registerSqlExecutorHandlers();
	registerUpdaterHandlers(win);

	handlersRegistered = true;
}
```

### 3. Update Preload Script to Expose PostgreSQL Functions

Update `electron/preload/index.ts` to expose PostgreSQL functions to the renderer process:

```typescript
// Add new handlers to the exposed IPC functions
contextBridge.exposeInMainWorld('ipcRenderer', {
	// Existing handlers...

	// PostgreSQL handlers
	testPostgreSQLConnection: (config: any) => {
		return ipcRenderer.invoke('test-postgresql-connection', config);
	},
	createPostgreSQLDatabase: (config: any, dbName: string) => {
		return ipcRenderer.invoke('create-postgresql-database', config, dbName);
	},
	listPostgreSQLDatabases: (config: any) => {
		return ipcRenderer.invoke('list-postgresql-databases', config);
	}

	// Other handlers...
});
```

## Verification

- Ensure all IPC handlers are properly registered
- Test the PostgreSQL connection function from the UI
- Verify database listing works correctly
- Check error handling for invalid connection parameters

## Next Steps

After completing these tasks, proceed to [Step 4: Update Database Schema Services](./04-schema-services.md).
