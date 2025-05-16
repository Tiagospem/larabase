# Step 4: Update Database Schema Services

In this step, we'll extend the database schema services to support PostgreSQL. This includes creating functions to retrieve the database schema, tables, columns, and relationships.

## Tasks

- [ ] Add PostgreSQL schema retrieval functions to tables module
- [ ] Update database schema service to support PostgreSQL
- [ ] Add IPC handlers for PostgreSQL schema operations

## Implementation Details

### 1. Add PostgreSQL Schema Retrieval Functions

Add the following code to `electron/modules/tables.ts`:

```typescript
// Import additional required modules
import {
	createConnection as createPgConnection,
	safeEndConnection as safePgEndConnection
} from '../helpers/postgresql';
import { PostgresqlConnection } from '../../src/types/postgresql-connection';

// Add this function to retrieve PostgreSQL database schema
async function getPostgresqlDatabaseSchemaForAIHandler(
	_: any,
	config: PostgresqlConnection
) {
	let client: any;

	try {
		client = await createPgConnection(config);

		// Get all tables in the database and schema
		const schema = config.schema || 'public';
		const tablesQuery = `
            SELECT table_name as name
            FROM information_schema.tables
            WHERE table_schema = $1
            AND table_type = 'BASE TABLE'
        `;

		const tablesResult = await client.query(tablesQuery, [schema]);
		const tables = tablesResult.rows;

		if (tables.length === 0) {
			return { success: true, databaseSchema: { tables: [] } };
		}

		const databaseSchema: { tables: any[] } = { tables: [] };

		for (const table of tables) {
			const tableName = table.name;

			// Get column information
			const columnsQuery = `
                SELECT 
                    column_name as name,
                    data_type as type,
                    is_nullable = 'YES' as nullable,
                    column_default as default,
                    '' as extra,
                    EXISTS (
                        SELECT 1 FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.constraint_type = 'PRIMARY KEY'
                        AND tc.table_schema = $1
                        AND tc.table_name = $2
                        AND kcu.column_name = columns.column_name
                    ) as primary_key,
                    EXISTS (
                        SELECT 1 FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema = $1
                        AND tc.table_name = $2
                        AND kcu.column_name = columns.column_name
                    ) as foreign_key
                FROM information_schema.columns
                WHERE table_schema = $1
                AND table_name = $2
                ORDER BY ordinal_position
            `;

			const columnsResult = await client.query(columnsQuery, [
				schema,
				tableName
			]);
			const structure = columnsResult.rows;

			// Get foreign key information
			const foreignKeysQuery = `
                SELECT
                    tc.constraint_name as name,
                    kcu.column_name as column,
                    ccu.table_name as referenced_table,
                    ccu.column_name as referenced_column,
                    'outgoing' as type
                FROM
                    information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE
                    tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            `;

			const incomingFKQuery = `
                SELECT
                    tc.constraint_name as name,
                    kcu.column_name as column,
                    kcu.table_name as referenced_table,
                    ccu.column_name as referenced_column,
                    'incoming' as type
                FROM
                    information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE
                    tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
                    AND ccu.table_name = $2
            `;

			const outgoingResult = await client.query(foreignKeysQuery, [
				schema,
				tableName
			]);
			const incomingResult = await client.query(incomingFKQuery, [
				schema,
				tableName
			]);

			const foreignKeys = [
				...outgoingResult.rows,
				...incomingResult.rows
			];

			// Get index information
			const indexesQuery = `
                SELECT
                    i.relname as name,
                    CASE
                        WHEN ix.indisprimary THEN 'PRIMARY'
                        WHEN ix.indisunique THEN 'UNIQUE'
                        ELSE 'INDEX'
                    END as type,
                    array_to_string(array_agg(a.attname), ',') as columns
                FROM
                    pg_class t,
                    pg_class i,
                    pg_index ix,
                    pg_attribute a,
                    pg_namespace n
                WHERE
                    t.oid = ix.indrelid
                    AND i.oid = ix.indexrelid
                    AND a.attrelid = t.oid
                    AND a.attnum = ANY(ix.indkey)
                    AND t.relkind = 'r'
                    AND t.relname = $2
                    AND n.nspname = $1
                    AND t.relnamespace = n.oid
                GROUP BY
                    i.relname, ix.indisprimary, ix.indisunique
            `;

			const indexesResult = await client.query(indexesQuery, [
				schema,
				tableName
			]);
			const indexes = indexesResult.rows.map((idx: any) => {
				return {
					...idx,
					columns: idx.columns.split(',')
				};
			});

			databaseSchema.tables.push({
				name: tableName,
				columns: structure,
				foreignKeys,
				indexes
			});
		}

		return {
			success: true,
			databaseSchema
		};
	} catch (err: any) {
		return {
			success: false,
			message: err.message || 'Error fetching PostgreSQL database schema',
			databaseSchema: { tables: [] }
		};
	} finally {
		await safePgEndConnection(client);
	}
}

// At the end of the registerTablesHandlers function, add this handler
export function registerTablesHandlers() {
	// Existing handlers...

	// Add PostgreSQL schema handler
	ipcMain.handle(
		'get-postgresql-database-schema-for-ai',
		getPostgresqlDatabaseSchemaForAIHandler
	);
}
```

### 2. Update Database Schema Service

Update `src/services/databaseSchema.ts` to support PostgreSQL:

```typescript
// Add type imports if needed
import { PostgresqlConnection } from '@/types/postgresql-connection';

// In the fetchDatabaseSchema function, modify it to handle PostgreSQL:
const fetchDatabaseSchema = async (
	force = false
): Promise<DatabaseSchema | null> => {
	if (databaseSchema.value && !force) {
		return databaseSchema.value;
	}

	const selectedProject = connectionsStore.getSelectedProject;
	if (!selectedProject) {
		error.value = 'No project selected';
		return null;
	}

	isLoading.value = true;
	error.value = null;

	try {
		let result;

		if (selectedProject.type === 'postgresql') {
			result = await window.ipcRenderer.getPostgresqlDatabaseSchemaForAI(
				toRaw(selectedProject.db_config)
			);
		} else {
			// Default to MySQL
			result = await window.ipcRenderer.getDatabaseSchemaForAI(
				toRaw(selectedProject.db_config)
			);
		}

		if (result.success) {
			const modelsResult =
				await projectStore.getModelsForTables(selectedProject);
			const models = modelsResult?.models || [];

			if (result.databaseSchema && result.databaseSchema.tables) {
				result.databaseSchema.tables.forEach((table: TableSchema) => {
					const model = models.find((m) => m.table === table.name);
					if (model) {
						table.model = {
							name: model.name,
							namespace: model.namespace,
							fullName: model.fullName
						};
					}
				});
			}

			databaseSchema.value = result.databaseSchema;
			return databaseSchema.value;
		} else {
			error.value = result.message || 'Failed to get database schema';
			console.error('Failed to get database schema:', result.message);
			return null;
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : String(err);
		console.error('Error fetching database schema:', err);
		return null;
	} finally {
		isLoading.value = false;
	}
};
```

### 3. Update Preload Script for Schema Functions

Add this to the preload script (`electron/preload/index.ts`):

```typescript
// Add this to the existing handlers
getPostgresqlDatabaseSchemaForAI: (config: any) => {
    return ipcRenderer.invoke('get-postgresql-database-schema-for-ai', config);
},
```

## Verification

- Ensure PostgreSQL schema retrieval functions work correctly
- Test schema retrieval with both MySQL and PostgreSQL databases
- Verify foreign key relationships are properly detected
- Check that indexes are correctly displayed

## Next Steps

After completing these tasks, proceed to [Step 5: Update SQL Executor](./05-sql-executor.md).
