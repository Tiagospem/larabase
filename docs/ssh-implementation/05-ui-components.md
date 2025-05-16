# Step 5: Update UI Components for SSH

In this step, we'll update the UI components to support SSH remote connections. This includes modifying the connection management UI to allow creating and editing SSH connections.

## Tasks

- [ ] Update connection management UI for SSH
- [ ] Create a dedicated SSH connection form
- [ ] Update connection store to handle SSH connections
- [ ] Add connection type selector
- [ ] Update project connection list to display SSH connections

## Implementation Details

### 1. Update Connection Type Selector

First, update the connection type selector in `src/components/home/ManageConnection.vue` to include SSH as an option:

```vue
<template>
	<!-- ... existing code ... -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Connection Type</span>
		</label>
		<select
			v-model="connection.type"
			class="select select-bordered w-full"
			@change="handleConnectionTypeChange"
		>
			<option :value="ConnectionType.MySQL">MySQL</option>
			<option :value="ConnectionType.PostgreSQL">PostgreSQL</option>
			<option :value="ConnectionType.SSH">SSH Remote</option>
		</select>
	</div>
	<!-- ... existing code ... -->
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ConnectionType } from '../../types/connection-types';
import type { ProjectConnection } from '../../types/project';
import type { SshConnection } from '../../types/ssh-connection';

// ... existing code ...

// Connection type handling
function handleConnectionTypeChange() {
	if (connection.value.type === ConnectionType.SSH) {
		// Initialize SSH connection if not already set
		if (!connection.value.ssh_config) {
			connection.value.ssh_config = {
				host: '',
				port: 22,
				username: '',
				remotePath: '',
				remoteDbType: 'mysql',
				remoteDbConfig: {
					host: 'localhost',
					port: 3306,
					database: '',
					username: '',
					password: ''
				}
			};
		}

		// Set isRemote flag
		connection.value.isRemote = true;
	} else {
		// Clear SSH connection settings when switching to local
		connection.value.ssh_config = undefined;

		// Set isRemote flag
		connection.value.isRemote = false;
	}
}

// ... existing code ...
</script>
```

### 2. Create SSH Connection Form

Create a new file `src/components/home/SshConnectionForm.vue` with the following content:

```vue
<template>
	<div class="w-full grid gap-4">
		<h3 class="text-lg font-semibold mb-2">SSH Connection Settings</h3>

		<!-- SSH Server Details -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control">
				<label class="label">
					<span class="label-text">SSH Host</span>
				</label>
				<input
					v-model="sshConfig.host"
					type="text"
					placeholder="e.g., example.com or 192.168.1.100"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">SSH Port</span>
				</label>
				<input
					v-model.number="sshConfig.port"
					type="number"
					placeholder="22"
					class="input input-bordered w-full"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control">
				<label class="label">
					<span class="label-text">Username</span>
				</label>
				<input
					v-model="sshConfig.username"
					type="text"
					placeholder="SSH username"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Authentication Method</span>
				</label>
				<select
					v-model="authMethod"
					class="select select-bordered w-full"
				>
					<option value="password">Password</option>
					<option value="privateKey">Private Key</option>
				</select>
			</div>
		</div>

		<!-- Authentication Method Specific Fields -->
		<div
			v-if="authMethod === 'password'"
			class="form-control"
		>
			<label class="label">
				<span class="label-text">Password</span>
			</label>
			<input
				v-model="sshConfig.password"
				type="password"
				placeholder="SSH password"
				class="input input-bordered w-full"
			/>
		</div>

		<div
			v-if="authMethod === 'privateKey'"
			class="space-y-4"
		>
			<div class="form-control">
				<label class="label">
					<span class="label-text">Private Key Path</span>
				</label>
				<div class="join w-full">
					<input
						v-model="sshConfig.privateKey"
						type="text"
						placeholder="/path/to/private_key"
						class="input input-bordered join-item flex-1"
					/>
					<button
						@click="selectPrivateKeyFile"
						class="btn join-item"
					>
						Browse
					</button>
				</div>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Passphrase (if needed)</span>
				</label>
				<input
					v-model="sshConfig.passphrase"
					type="password"
					placeholder="Private key passphrase"
					class="input input-bordered w-full"
				/>
			</div>
		</div>

		<!-- Project Path on Remote Server -->
		<div class="form-control">
			<label class="label">
				<span class="label-text"
					>Laravel Project Path on Remote Server</span
				>
			</label>
			<input
				v-model="sshConfig.remotePath"
				type="text"
				placeholder="/path/to/laravel/project"
				class="input input-bordered w-full"
			/>
		</div>

		<div class="divider">Remote Database Configuration</div>

		<!-- Remote Database Type -->
		<div class="form-control">
			<label class="label">
				<span class="label-text">Remote Database Type</span>
			</label>
			<select
				v-model="sshConfig.remoteDbType"
				class="select select-bordered w-full"
			>
				<option value="mysql">MySQL</option>
				<option value="postgresql">PostgreSQL</option>
			</select>
		</div>

		<!-- Remote Database Configuration -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control">
				<label class="label">
					<span class="label-text">Database Host</span>
				</label>
				<input
					v-model="sshConfig.remoteDbConfig.host"
					type="text"
					placeholder="localhost"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Database Port</span>
				</label>
				<input
					v-model.number="sshConfig.remoteDbConfig.port"
					type="number"
					:placeholder="
						sshConfig.remoteDbType === 'mysql' ? '3306' : '5432'
					"
					class="input input-bordered w-full"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control">
				<label class="label">
					<span class="label-text">Database Name</span>
				</label>
				<input
					v-model="sshConfig.remoteDbConfig.database"
					type="text"
					placeholder="database_name"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Username</span>
				</label>
				<input
					v-model="sshConfig.remoteDbConfig.username"
					type="text"
					placeholder="database_user"
					class="input input-bordered w-full"
				/>
			</div>
		</div>

		<div class="form-control">
			<label class="label">
				<span class="label-text">Password</span>
			</label>
			<input
				v-model="sshConfig.remoteDbConfig.password"
				type="password"
				placeholder="database_password"
				class="input input-bordered w-full"
			/>
		</div>

		<!-- PostgreSQL Schema -->
		<div
			v-if="sshConfig.remoteDbType === 'postgresql'"
			class="form-control"
		>
			<label class="label">
				<span class="label-text">Schema (PostgreSQL Only)</span>
			</label>
			<input
				v-model="sshConfig.remoteDbConfig.schema"
				type="text"
				placeholder="public"
				class="input input-bordered w-full"
			/>
		</div>

		<!-- Test Connection Button -->
		<div class="mt-4">
			<button
				@click="testSshConnection"
				class="btn btn-primary"
				:disabled="isTestingConnection"
			>
				<span
					v-if="isTestingConnection"
					class="loading loading-spinner"
				></span>
				{{ isTestingConnection ? 'Testing...' : 'Test SSH Connection' }}
			</button>
			<div
				v-if="testResult"
				class="mt-2"
			>
				<div
					v-if="testResult.success"
					class="alert alert-success"
				>
					{{ testResult.message }}
				</div>
				<div
					v-else
					class="alert alert-error"
				>
					{{ testResult.message }}
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import type { SshConnection } from '../../types/ssh-connection';

const props = defineProps<{
	modelValue: SshConnection;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: SshConnection): void;
}>();

// Local copy of SSH config
const sshConfig = ref<SshConnection>({ ...props.modelValue });

// Authentication method
const authMethod = ref<'password' | 'privateKey'>(
	props.modelValue.privateKey ? 'privateKey' : 'password'
);

// Testing connection state
const isTestingConnection = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// Watch for changes and emit updates
watch(
	sshConfig,
	(newValue) => {
		emit('update:modelValue', { ...newValue });
	},
	{ deep: true }
);

// Watch for auth method changes
watch(authMethod, (newValue) => {
	if (newValue === 'password') {
		// Clear private key settings
		sshConfig.value.privateKey = undefined;
		sshConfig.value.passphrase = undefined;
	} else {
		// Clear password
		sshConfig.value.password = undefined;
	}
});

// Update local config when props change
watch(
	() => props.modelValue,
	(newValue) => {
		sshConfig.value = { ...newValue };
		authMethod.value = newValue.privateKey ? 'privateKey' : 'password';
	},
	{ deep: true }
);

// Select private key file
async function selectPrivateKeyFile() {
	try {
		const result = await window.electronAPI.dialog.openFile({
			title: 'Select Private Key File',
			defaultPath: sshConfig.value.privateKey || undefined,
			filters: [
				{ name: 'All Files', extensions: ['*'] },
				{ name: 'Private Key', extensions: ['pem', 'key', 'ppk'] }
			],
			properties: ['openFile']
		});

		if (result && result.filePaths && result.filePaths.length > 0) {
			sshConfig.value.privateKey = result.filePaths[0];
		}
	} catch (error) {
		console.error('Error selecting private key file:', error);
	}
}

// Test SSH connection
async function testSshConnection() {
	isTestingConnection.value = true;
	testResult.value = null;

	try {
		const result = await window.electronAPI.ssh.testConnection(
			sshConfig.value
		);
		testResult.value = result;
	} catch (error) {
		testResult.value = {
			success: false,
			message:
				error instanceof Error
					? error.message
					: 'Unknown error testing connection'
		};
	} finally {
		isTestingConnection.value = false;
	}
}
</script>
```

### 3. Update ManageConnection.vue to Include SSH Form

Update the main connection form in `src/components/home/ManageConnection.vue` to conditionally show the SSH form:

```vue
<template>
	<!-- ... existing code ... -->

	<!-- Database Connection Form -->
	<div
		v-if="connection.type !== ConnectionType.SSH"
		class="w-full"
	>
		<!-- MySQL or PostgreSQL form (existing code) -->
		<MySQLConnectionForm
			v-if="connection.type === ConnectionType.MySQL"
			v-model="connection.db_config"
		/>
		<PostgreSQLConnectionForm
			v-if="connection.type === ConnectionType.PostgreSQL"
			v-model="connection.db_config"
		/>
	</div>

	<!-- SSH Connection Form -->
	<div
		v-else
		class="w-full"
	>
		<SshConnectionForm v-model="connection.ssh_config" />
	</div>

	<!-- ... existing code ... -->
</template>

<script lang="ts" setup>
// ... existing imports ...
import SshConnectionForm from './SshConnectionForm.vue';

// ... rest of the existing code ...
</script>
```

### 4. Update Project List Item to Show Connection Type Badge

Modify the `src/components/home/ProjectItem.vue` component to show a badge indicating the connection type:

```vue
<template>
	<div
		class="card card-compact bg-base-100 shadow-md hover:shadow-lg transition-shadow duration-300 h-full"
	>
		<div class="card-body">
			<div class="flex justify-between items-start">
				<h2 class="card-title text-lg truncate">
					{{ project.name }}

					<!-- Connection Type Badge -->
					<div class="flex items-center ml-2">
						<div
							class="badge badge-sm"
							:class="getConnectionTypeBadgeClass(project.type)"
						>
							{{ getConnectionTypeLabel(project.type) }}
						</div>

						<!-- Remote Badge -->
						<div
							v-if="project.isRemote"
							class="badge badge-sm bg-green-600 text-white ml-1"
						>
							REMOTE
						</div>
					</div>
				</h2>

				<!-- ... rest of template ... -->
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {
	ConnectionType,
	getConnectionTypeLabel,
	getConnectionTypeColor
} from '../../types/connection-types';

// ... existing code ...

// Return the appropriate badge class for the connection type
function getConnectionTypeBadgeClass(type: ConnectionType): string {
	return `${getConnectionTypeColor(type)} text-white`;
}
</script>
```

### 5. Update Connection Store

Update the connection store at `src/store/connections.ts` to handle SSH connections:

```typescript
// ... existing imports ...
import { ConnectionType } from '../types/connection-types';
import type { SshConnection } from '../types/ssh-connection';

// ... existing code ...

// Save a connection to IndexedDB
export async function saveConnection(
	connection: ProjectConnection
): Promise<void> {
	try {
		connection.status = 'saved';

		// Handle special cases for SSH connections
		if (connection.type === ConnectionType.SSH) {
			// Ensure isRemote is set
			connection.isRemote = true;

			// Validate SSH config
			if (!connection.ssh_config) {
				throw new Error(
					'SSH configuration is required for SSH connections'
				);
			}
		} else {
			// Non-SSH connections should not have SSH config
			connection.ssh_config = undefined;

			// Ensure isRemote is false for non-SSH connections
			connection.isRemote = false;
		}

		// ... rest of existing code ...
	} catch (error) {
		console.error('Error saving connection:', error);
		throw error;
	}
}

// ... rest of existing code ...
```

## Verification

- Ensure the SSH connection form displays all necessary fields
- Verify that the connection type selector works correctly
- Test creating and editing SSH connections
- Confirm that the connection badge displays correctly
- Check that the connection type is properly stored and retrieved

## Next Steps

After completing these tasks, proceed to [Step 6: Add Remote Indication Badges](./06-remote-badges.md).
