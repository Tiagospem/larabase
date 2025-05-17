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
        v-model="newConnection.dbConfig.port"
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
        v-model="newConnection.dbConfig.schema"
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
            v-model="newConnection.dbConfig.ssl"
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
				host: newConnection.value.dbConfig.host,
				port: newConnection.value.dbConfig.port,
				user: newConnection.value.dbConfig.user,
				password: newConnection.value.dbConfig.password,
				database: newConnection.value.dbConfig.database,
				schema: newConnection.value.dbConfig.schema || 'public',
				ssl: newConnection.value.dbConfig.ssl || false
			});
		} else {
			// Use MySQL connection test
			testResult = await window.ipcRenderer.testMySQLConnection({
				host: newConnection.value.dbConfig.host,
				port: newConnection.value.dbConfig.port,
				user: newConnection.value.dbConfig.user,
				password: newConnection.value.dbConfig.password,
				database: newConnection.value.dbConfig.database
			});
		}

		if (!testResult.success) {
			showAlert(`Connection failed: ${testResult.message}`, 'error');
			isSaving.value = false;
			return;
		}

		showAlert('Connection successful! Saving configuration...', 'success');

		// Create the dbConfig object based on the database type
		let dbConfig;
		if (newConnection.value.type === 'postgresql') {
			dbConfig = {
				database: newConnection.value.dbConfig.database,
				host: newConnection.value.dbConfig.host,
				port: newConnection.value.dbConfig.port,
				user: newConnection.value.dbConfig.user,
				password: newConnection.value.dbConfig.password,
				schema: newConnection.value.dbConfig.schema || 'public',
				ssl: newConnection.value.dbConfig.ssl || false,
				connectTimeout: 10000
			};
		} else {
			dbConfig = {
				database: newConnection.value.dbConfig.database,
				host: newConnection.value.dbConfig.host,
				port: newConnection.value.dbConfig.port,
				user: newConnection.value.dbConfig.user,
				password: newConnection.value.dbConfig.password,
				connectTimeout: 10000
			};
		}

		const connectionData = {
			id: isEditMode.value ? editConnectionId.value : uuid(),
			projectPath: newConnection.value.projectPath,
			name: newConnection.value.name,
			type: newConnection.value.type,
			icon: newConnection.value.type.charAt(0).toUpperCase(),
			dbConfig: dbConfig,
			redisConfig: {
				port: newConnection.value.redisConfig.port,
				host: newConnection.value.redisConfig.host,
				password: newConnection.value.redisConfig.password
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
                                toRaw(project.dbConfig)
                            );
                        } else {
                            check = await window.ipcRenderer.testMySQLConnection(
                                toRaw(project.dbConfig)
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
					if (!newConnection.value.dbConfig.port) {
						newConnection.value.dbConfig.port = 5432;
					}
				} else {
					newConnection.value.type = 'mysql';
					// Set default MySQL port
					if (!newConnection.value.dbConfig.port) {
						newConnection.value.dbConfig.port = 3306;
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
	dbConfig: {
		database: '',
		host: 'localhost',
		port: type === 'postgresql' ? 5432 : 3306,
		user: '',
		password: '',
		schema: type === 'postgresql' ? 'public' : undefined,
		ssl: type === 'postgresql' ? false : undefined,
		connectTimeout: 10000
	},
	redisConfig: {
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
			newConnection.value.dbConfig.port = 5432;
			newConnection.value.dbConfig.schema = 'public';
			newConnection.value.dbConfig.ssl = false;
		} else {
			newConnection.value.dbConfig.port = 3306;
			delete newConnection.value.dbConfig.schema;
			delete newConnection.value.dbConfig.ssl;
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
