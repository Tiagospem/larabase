# Step 5: Update SQL Executor

In this step, we'll update the SQL execution functionality to support PostgreSQL queries. This involves adding PostgreSQL-specific query execution functions and updating the UI components to use the appropriate functions based on the database type.

## Tasks

- [ ] Update SQL Executor module to handle PostgreSQL queries
- [ ] Add IPC handlers for PostgreSQL query execution
- [ ] Update UI components to use PostgreSQL query handlers

## Implementation Details

### 1. Update SQL Executor Module

Update the `electron/modules/sql-executor.ts` file to support PostgreSQL queries:

```typescript
import { ipcMain } from 'electron';
import {
	createConnection as createMysqlConnection,
	releaseConnection as releaseMysqlConnection
} from '../helpers/mysql';
import {
	createConnection as createPgConnection,
	releaseConnection as releasePgConnection
} from '../helpers/postgresql';
import { MysqlConnection } from '../../src/types/mysql-connection';
import { PostgresqlConnection } from '../../src/types/postgresql-connection';

// Rename the existing function to be MySQL-specific
async function executeMysqlQueryHandler(
	_: any,
	config: MysqlConnection,
	query: string
) {
	let connection: any;

	try {
		connection = await createMysqlConnection(config);

		try {
			const [results] = await connection.query(query);

			return { success: true, results };
		} catch (error) {
			console.error('Error executing MySQL query:', error.message);
			return { success: false, error: error.message };
		}
	} catch (error) {
		console.error('Error connecting to MySQL database:', error.message);
		return { success: false, error: error.message };
	} finally {
		if (connection) {
			await releaseMysqlConnection(connection);
		}
	}
}

// Add a PostgreSQL query executor
async function executePostgresqlQueryHandler(
	_: any,
	config: PostgresqlConnection,
	query: string
) {
	let client: any;

	try {
		client = await createPgConnection(config);

		try {
			const results = await client.query(query);
			return { success: true, results: results.rows };
		} catch (error) {
			console.error('Error executing PostgreSQL query:', error.message);
			return { success: false, error: error.message };
		}
	} catch (error) {
		console.error(
			'Error connecting to PostgreSQL database:',
			error.message
		);
		return { success: false, error: error.message };
	} finally {
		if (client) {
			await releasePgConnection(client);
		}
	}
}

// Update the register function to include both handlers
function registerSqlExecutorHandlers() {
	// Rename this to be MySQL-specific
	ipcMain.handle('execute-mysql-query', executeMysqlQueryHandler);

	// Add PostgreSQL handler
	ipcMain.handle('execute-postgresql-query', executePostgresqlQueryHandler);
}

export { registerSqlExecutorHandlers };
```

### 2. Update Preload Script

In `electron/preload/index.ts`, add the PostgreSQL SQL execution function:

```typescript
// Add new handler for PostgreSQL query execution
executePostgresqlQuery: (config: any, query: string) => {
    return ipcRenderer.invoke('execute-postgresql-query', config, query);
},
```

### 3. Update SQLEditorView Component

Modify the `src/views/SQLEditorView.vue` file to handle PostgreSQL queries:

```typescript
// In the executeQuery function:
async function executeQuery() {
	// ...existing code...

	try {
		isExecuting.value = true;
		errorMessage.value = '';

		let result;

		// Choose the appropriate handler based on database type
		if (project.value.type === 'postgresql') {
			result = await window.ipcRenderer.executePostgresqlQuery(
				toRaw(project.value.db_config),
				query
			);
		} else {
			// Default to MySQL
			result = await window.ipcRenderer.executeMysqlQuery(
				toRaw(project.value.db_config),
				query
			);
		}

		// Process results...
		if (result.success) {
			// ...existing success handling...
		} else {
			// ...existing error handling...
		}
	} catch (error) {
		// ...existing error handling...
	} finally {
		// ...existing cleanup...
	}
}
```

### 4. Update Any Other Components that Execute SQL

Look for any other components that directly execute SQL queries and update them similarly. For example, check:

- Components that display table data
- Components for database operations
- Components for running schema migrations

For each of these, add conditional logic to use the appropriate handler based on the connection type.

## Verification

- Test SQL query execution with both MySQL and PostgreSQL databases
- Verify that query results are properly displayed
- Check that error handling works correctly for both database types
- Test complex queries with joins, aggregations, etc.

## Next Steps

After completing these tasks, proceed to [Step 6: Update UI Components](./06-ui-components.md).
