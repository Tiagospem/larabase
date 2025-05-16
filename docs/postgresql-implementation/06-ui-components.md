# Step 6: Update UI Components

In this step, we'll update the UI components to support PostgreSQL connections and databases. This includes modifying the connection management UI, database view, and other components.

## Tasks

- [ ] Update database connection UI to support PostgreSQL
- [ ] Update connection store to handle PostgreSQL connections
- [ ] Add PostgreSQL-specific UI elements and icons
- [ ] Update environment file detection for PostgreSQL

## Implementation Details

### 1. Update Connection Management UI

Modify the `src/components/home/ManageConnection.vue` file to allow selecting PostgreSQL:

```vue
<!-- Update the database type select to include PostgreSQL -->
<fieldset class="fieldset w-full">
    <label class="label">
        <span class="label-text">Database Type</span>
    </label>
    <select
        v-model="newConnection.type"
        class="select select-bordered w-full"
    >
        <option value="mysql">MySQL</option>
        <option value="postgresql">PostgreSQL</option>
    </select>
</fieldset>

<!-- Update port input with dynamic default based on type -->
<fieldset class="fieldset w-full">
    <label class="label">
        <span class="label-text">Port</span>
    </label>
    <input
        v-model="newConnection.db_config.port"
        type="text"
        :placeholder="newConnection.type === 'postgresql' ? '5432' : '3306'"
        class="input w-full"
        required
    />
</fieldset>

<!-- Add PostgreSQL-specific fields when PostgreSQL is selected -->
<fieldset v-if="newConnection.type === 'postgresql'" class="fieldset w-full">
    <label class="label">
        <span class="label-text">Schema</span>
    </label>
    <input
        v-model="newConnection.db_config.schema"
        type="text"
        placeholder="public"
        class="input w-full"
    />
    <label class="label">
        <span class="label-text-alt">Default is 'public'</span>
    </label>
</fieldset>

<!-- Add SSL option for PostgreSQL -->
<fieldset v-if="newConnection.type === 'postgresql'" class="fieldset w-full">
    <label class="label cursor-pointer">
        <span class="label-text">Use SSL Connection?</span>
        <input
            v-model="newConnection.db_config.ssl"
            type="checkbox"
            class="toggle toggle-primary"
        />
    </label>
</fieldset>
```

### 2. Update the saveNewConnection Method

Update the `saveNewConnection` method in `src/components/home/ManageConnection.vue`:

```typescript
async function saveNewConnection() {
	try {
		// Existing validation code...

		isSaving.value = true;

		showAlert('Testing database connection...', 'info');

		let testResult;

		if (newConnection.value.type === 'postgresql') {
			// Use PostgreSQL connection test
			testResult = await window.ipcRenderer.testPostgreSQLConnection({
				host: newConnection.value.db_config.host,
				port: newConnection.value.db_config.port,
				user: newConnection.value.db_config.user,
				password: newConnection.value.db_config.password,
				database: newConnection.value.db_config.database,
				schema: newConnection.value.db_config.schema || 'public',
				ssl: newConnection.value.db_config.ssl || false
			});
		} else {
			// Use MySQL connection test
			testResult = await window.ipcRenderer.testMySQLConnection({
				host: newConnection.value.db_config.host,
				port: newConnection.value.db_config.port,
				user: newConnection.value.db_config.user,
				password: newConnection.value.db_config.password,
				database: newConnection.value.db_config.database
			});
		}

		if (!testResult.success) {
			showAlert(`Connection failed: ${testResult.message}`, 'error');
			isSaving.value = false;
			return;
		}

		showAlert('Connection successful! Saving configuration...', 'success');

		// Create the db_config object based on the database type
		let dbConfig;
		if (newConnection.value.type === 'postgresql') {
			dbConfig = {
				database: newConnection.value.db_config.database,
				host: newConnection.value.db_config.host,
				port: newConnection.value.db_config.port,
				user: newConnection.value.db_config.user,
				password: newConnection.value.db_config.password,
				schema: newConnection.value.db_config.schema || 'public',
				ssl: newConnection.value.db_config.ssl || false,
				connectTimeout: 10000
			};
		} else {
			dbConfig = {
				database: newConnection.value.db_config.database,
				host: newConnection.value.db_config.host,
				port: newConnection.value.db_config.port,
				user: newConnection.value.db_config.user,
				password: newConnection.value.db_config.password,
				connectTimeout: 10000
			};
		}

		const connectionData = {
			id: isEditMode.value ? editConnectionId.value : uuid(),
			projectPath: newConnection.value.projectPath,
			name: newConnection.value.name,
			type: newConnection.value.type,
			icon: newConnection.value.type.charAt(0).toUpperCase(),
			db_config: dbConfig,
			redis_config: {
				port: newConnection.value.redis_config.port,
				host: newConnection.value.redis_config.host,
				password: newConnection.value.redis_config.password
			},
			usingSail: newConnection.value.usingSail,
			status: 'ready',
			isValid: true,
			dockerInfo: dockerInfo.value || null
		};

		// Existing save logic...
	} catch (error: any) {
		console.error('Error saving connection:', error);
		showAlert(`Error saving connection: ${error.message}`, 'error');
	} finally {
		isSaving.value = false;
	}
}
```

### 3. Update the Connections Store

Modify `src/store/connections.ts` to handle PostgreSQL connections:

```typescript
async function loadConnections(id: string | null = null) {
    isLoading.value = true;

    // ...existing code...

    try {
        if (window.ipcRenderer) {
            try {
                const savedProjects: ProjectConnection[] = JSON.parse(
                    localStorage.getItem('connections') || '[]'
                );

                if (
                    savedProjects &&
                    Array.isArray(savedProjects) &&
                    savedProjects.length > 0
                ) {
                    for (const project of savedProjects) {
                        let check;

                        if (project.type === 'postgresql') {
                            check = await window.ipcRenderer.testPostgreSQLConnection(
                                toRaw(project.db_config)
                            );
                        } else {
                            check = await window.ipcRenderer.testMySQLConnection(
                                toRaw(project.db_config)
                            );
                        }

                        project.isValid = check.success;
                        project.status = check.success
                            ? 'connected'
                            : 'disconnected';
                    }

                    connections.value = savedProjects;
                } else {
                    connections.value = [];
                }
            } catch (err) {
                // ...error handling...
            }
        }
        // ...rest of the function...
    }
}
```

### 4. Update Database Connection Colors

Update the connection color function in `src/views/Home.vue` and `src/components/BaseHeader.vue`:

```typescript
function getConnectionColor(type: string) {
	switch (type) {
		case 'mysql':
			return 'bg-orange-500';
		case 'postgresql':
			return 'bg-blue-600';
		default:
			return 'bg-gray-600';
	}
}
```

### 5. Update Environment File Detection

Modify the `selectProjectDirectory` function in `src/components/home/ManageConnection.vue` to detect PostgreSQL connections from the Laravel .env file:

```typescript
async function selectProjectDirectory() {
	try {
		// ...existing code...

		const envConfig: Env =
			await window.ipcRenderer.readEnvFile(selectedPath);

		if (envConfig) {
			// Set connection type based on DB_CONNECTION
			if (envConfig.DB_CONNECTION) {
				if (
					envConfig.DB_CONNECTION.toLowerCase() === 'pgsql' ||
					envConfig.DB_CONNECTION.toLowerCase() === 'postgres' ||
					envConfig.DB_CONNECTION.toLowerCase() === 'postgresql'
				) {
					newConnection.value.type = 'postgresql';
					// Set default PostgreSQL port
					if (!newConnection.value.db_config.port) {
						newConnection.value.db_config.port = 5432;
					}
				} else {
					newConnection.value.type = 'mysql';
					// Set default MySQL port
					if (!newConnection.value.db_config.port) {
						newConnection.value.db_config.port = 3306;
					}
				}
			}

			// ...existing code for setting other connection properties...
		}
	} catch (error) {
		console.error(error);
		showAlert('Error selecting project directory', 'error');
	}
}
```

### 6. Add PostgreSQL Default Values

Update the default connection values in `src/components/home/ManageConnection.vue`:

```typescript
// Update this based on the selected type
const getDefaultValues = (type = 'mysql') => ({
	id: '',
	projectPath: '',
	name: '',
	type: type,
	icon: '',
	db_config: {
		database: '',
		host: 'localhost',
		port: type === 'postgresql' ? 5432 : 3306,
		user: '',
		password: '',
		schema: type === 'postgresql' ? 'public' : undefined,
		ssl: type === 'postgresql' ? false : undefined,
		connectTimeout: 10000
	},
	redis_config: {
		port: 6379,
		host: 'localhost',
		password: ''
	},
	usingSail: false,
	status: 'ready',
	isValid: true,
	dockerInfo: null
});

// Update when type changes
watch(
	() => newConnection.value.type,
	(newType) => {
		// Update default port when database type changes
		if (newType === 'postgresql') {
			newConnection.value.db_config.port = 5432;
			newConnection.value.db_config.schema = 'public';
			newConnection.value.db_config.ssl = false;
		} else {
			newConnection.value.db_config.port = 3306;
			delete newConnection.value.db_config.schema;
			delete newConnection.value.db_config.ssl;
		}
	}
);
```

## Verification

- Test creating new PostgreSQL connections with different settings
- Verify that connection test works correctly with PostgreSQL
- Test loading connections from environment files
- Check that PostgreSQL-specific fields appear and disappear appropriately
- Verify that the UI displays PostgreSQL connections with the correct color

## Next Steps

After completing these tasks, proceed to [Step 7: Install Dependencies](./07-dependencies.md).
