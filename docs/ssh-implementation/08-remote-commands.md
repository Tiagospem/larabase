# Step 8: Execute Remote Commands

In this step, we'll implement the ability to execute commands on the remote server. This will allow users to run Laravel artisan commands, migrations, and other CLI tasks on the remote project.

## Tasks

- [ ] Create a remote command service
- [ ] Implement artisan command execution
- [ ] Create a command execution UI component
- [ ] Add composer package management
- [ ] Integrate remote commands with database migrations

## Implementation Details

### 1. Create a Remote Command Service

Create a new file `src/services/remote-command-service.ts` to handle command execution:

```typescript
import { SshConnection } from '../types/ssh-connection';

/**
 * Execute a command on the remote server
 */
export async function executeRemoteCommand(
	sshConfig: SshConnection,
	command: string
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	try {
		return await window.electronAPI.ssh.executeCommand(sshConfig, command);
	} catch (error) {
		console.error('Error executing remote command:', error);
		throw error;
	}
}

/**
 * Execute an artisan command on the remote server
 */
export async function executeArtisanCommand(
	sshConfig: SshConnection,
	command: string
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	const fullCommand = `cd ${sshConfig.remotePath} && php artisan ${command}`;
	return await executeRemoteCommand(sshConfig, fullCommand);
}

/**
 * Execute a composer command on the remote server
 */
export async function executeComposerCommand(
	sshConfig: SshConnection,
	command: string
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	const fullCommand = `cd ${sshConfig.remotePath} && composer ${command}`;
	return await executeRemoteCommand(sshConfig, fullCommand);
}

/**
 * Get a list of available artisan commands
 */
export async function getArtisanCommandList(
	sshConfig: SshConnection
): Promise<string[]> {
	try {
		const result = await executeArtisanCommand(sshConfig, 'list --raw');

		if (result.code !== 0) {
			throw new Error(
				`Error getting artisan command list: ${result.stderr}`
			);
		}

		// Parse the command list
		return result.stdout
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	} catch (error) {
		console.error('Error getting artisan command list:', error);
		throw error;
	}
}

/**
 * Run migrations on the remote server
 */
export async function runMigrations(
	sshConfig: SshConnection,
	options: {
		fresh?: boolean;
		seed?: boolean;
		force?: boolean;
		step?: number;
	} = {}
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	let command = 'migrate';

	if (options.fresh) {
		command = 'migrate:fresh';
	}

	if (options.seed) {
		command += ' --seed';
	}

	if (options.force) {
		command += ' --force';
	}

	if (options.step && options.step > 0) {
		command += ` --step=${options.step}`;
	}

	return await executeArtisanCommand(sshConfig, command);
}

/**
 * Get the status of migrations
 */
export async function getMigrationStatus(sshConfig: SshConnection): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	return await executeArtisanCommand(sshConfig, 'migrate:status');
}
```

### 2. Create a Remote Command Execution Component

Create a new file `src/components/project/RemoteCommandExecutor.vue` for the UI to execute commands:

```vue
<template>
	<div class="card bg-base-100 shadow-md">
		<div class="card-body">
			<div class="flex justify-between items-center mb-4">
				<h2 class="card-title">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-6 h-6 mr-2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
						/>
					</svg>
					Remote Commands
				</h2>
			</div>

			<!-- Command Type Tabs -->
			<div class="tabs tabs-boxed mb-4">
				<button
					class="tab"
					:class="{ 'tab-active': activeTab === 'artisan' }"
					@click="activeTab = 'artisan'"
				>
					Artisan
				</button>
				<button
					class="tab"
					:class="{ 'tab-active': activeTab === 'composer' }"
					@click="activeTab = 'composer'"
				>
					Composer
				</button>
				<button
					class="tab"
					:class="{ 'tab-active': activeTab === 'custom' }"
					@click="activeTab = 'custom'"
				>
					Custom Command
				</button>
			</div>

			<!-- Artisan Command Tab -->
			<div
				v-if="activeTab === 'artisan'"
				class="space-y-4"
			>
				<div class="space-y-2">
					<h3 class="font-medium">Common Commands</h3>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="cmd in commonArtisanCommands"
							:key="cmd.command"
							@click="runCommand('artisan', cmd.command)"
							class="btn btn-sm"
						>
							{{ cmd.label }}
						</button>
					</div>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Artisan Command</span>
					</label>
					<div class="join w-full">
						<span
							class="join-item input input-bordered flex items-center px-3 bg-base-200"
							>php artisan</span
						>
						<input
							v-model="artisanCommand"
							type="text"
							placeholder="command:name [options]"
							class="input input-bordered join-item flex-1"
							@keyup.enter="runCommand('artisan', artisanCommand)"
						/>
						<button
							@click="runCommand('artisan', artisanCommand)"
							class="btn join-item"
							:disabled="!artisanCommand.trim() || isExecuting"
						>
							<span
								v-if="
									isExecuting &&
									activeCommandType === 'artisan'
								"
								class="loading loading-spinner loading-sm"
							></span>
							Execute
						</button>
					</div>
				</div>

				<div
					v-if="artisanCommands.length > 0"
					class="space-y-2"
				>
					<h3 class="font-medium">Available Commands</h3>
					<div
						class="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-base-300 rounded"
					>
						<button
							v-for="cmd in artisanCommands"
							:key="cmd"
							@click="selectArtisanCommand(cmd)"
							class="btn btn-xs btn-ghost"
						>
							{{ cmd }}
						</button>
					</div>
				</div>
			</div>

			<!-- Composer Command Tab -->
			<div
				v-if="activeTab === 'composer'"
				class="space-y-4"
			>
				<div class="space-y-2">
					<h3 class="font-medium">Common Commands</h3>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="cmd in commonComposerCommands"
							:key="cmd.command"
							@click="runCommand('composer', cmd.command)"
							class="btn btn-sm"
						>
							{{ cmd.label }}
						</button>
					</div>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Composer Command</span>
					</label>
					<div class="join w-full">
						<span
							class="join-item input input-bordered flex items-center px-3 bg-base-200"
							>composer</span
						>
						<input
							v-model="composerCommand"
							type="text"
							placeholder="require package/name"
							class="input input-bordered join-item flex-1"
							@keyup.enter="
								runCommand('composer', composerCommand)
							"
						/>
						<button
							@click="runCommand('composer', composerCommand)"
							class="btn join-item"
							:disabled="!composerCommand.trim() || isExecuting"
						>
							<span
								v-if="
									isExecuting &&
									activeCommandType === 'composer'
								"
								class="loading loading-spinner loading-sm"
							></span>
							Execute
						</button>
					</div>
				</div>
			</div>

			<!-- Custom Command Tab -->
			<div
				v-if="activeTab === 'custom'"
				class="space-y-4"
			>
				<div class="form-control">
					<label class="label">
						<span class="label-text">Custom Shell Command</span>
					</label>
					<div class="join w-full">
						<input
							v-model="customCommand"
							type="text"
							placeholder="ls -la"
							class="input input-bordered join-item flex-1"
							@keyup.enter="runCommand('custom', customCommand)"
						/>
						<button
							@click="runCommand('custom', customCommand)"
							class="btn join-item"
							:disabled="!customCommand.trim() || isExecuting"
						>
							<span
								v-if="
									isExecuting &&
									activeCommandType === 'custom'
								"
								class="loading loading-spinner loading-sm"
							></span>
							Execute
						</button>
					</div>
				</div>
			</div>

			<!-- Command Output -->
			<div
				v-if="commandOutput"
				class="mt-4"
			>
				<div class="collapse collapse-arrow bg-base-200">
					<input
						type="checkbox"
						:checked="true"
					/>
					<div class="collapse-title font-medium">Command Output</div>
					<div class="collapse-content">
						<div class="tabs tabs-boxed mb-2">
							<button
								class="tab"
								:class="{
									'tab-active': outputTab === 'stdout'
								}"
								@click="outputTab = 'stdout'"
							>
								Standard Output
							</button>
							<button
								class="tab"
								:class="{
									'tab-active': outputTab === 'stderr'
								}"
								@click="outputTab = 'stderr'"
							>
								Standard Error
							</button>
						</div>

						<div
							v-if="outputTab === 'stdout'"
							class="bg-base-300 p-4 rounded"
						>
							<pre class="whitespace-pre-wrap text-sm">{{
								commandOutput.stdout || 'No output'
							}}</pre>
						</div>

						<div
							v-if="outputTab === 'stderr'"
							class="bg-base-300 p-4 rounded"
						>
							<pre
								class="whitespace-pre-wrap text-sm text-error"
								>{{ commandOutput.stderr || 'No errors' }}</pre
							>
						</div>

						<div class="mt-2">
							<span class="font-semibold">Exit Code:</span>
							<span
								:class="
									commandOutput.code === 0
										? 'text-success'
										: 'text-error'
								"
							>
								{{ commandOutput.code }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { SshConnection } from '../../types/ssh-connection';
import {
	executeArtisanCommand,
	executeComposerCommand,
	executeRemoteCommand,
	getArtisanCommandList
} from '../../services/remote-command-service';

const props = defineProps<{
	sshConfig: SshConnection;
}>();

// Command state
const activeTab = ref<'artisan' | 'composer' | 'custom'>('artisan');
const artisanCommand = ref('');
const composerCommand = ref('');
const customCommand = ref('');
const isExecuting = ref(false);
const activeCommandType = ref<'artisan' | 'composer' | 'custom' | null>(null);

// Output state
const commandOutput = ref<{
	stdout: string;
	stderr: string;
	code: number | null;
} | null>(null);
const outputTab = ref<'stdout' | 'stderr'>('stdout');

// Available commands
const artisanCommands = ref<string[]>([]);

// Common commands for quick access
const commonArtisanCommands = [
	{ label: 'List Routes', command: 'route:list' },
	{ label: 'Clear Cache', command: 'cache:clear' },
	{ label: 'Clear Config', command: 'config:clear' },
	{ label: 'Clear Views', command: 'view:clear' },
	{ label: 'Run Migrations', command: 'migrate' },
	{ label: 'Migration Status', command: 'migrate:status' },
	{ label: 'Seeds List', command: 'db:seed --list' }
];

const commonComposerCommands = [
	{ label: 'Install', command: 'install' },
	{ label: 'Update', command: 'update' },
	{ label: 'Dump Autoload', command: 'dump-autoload' },
	{ label: 'Show Outdated', command: 'outdated' },
	{ label: 'Validate', command: 'validate' }
];

// Watch for changes in SSH config
watch(
	() => props.sshConfig,
	() => {
		if (props.sshConfig) {
			loadArtisanCommands();
		}
	},
	{ immediate: true }
);

// Load available artisan commands
async function loadArtisanCommands() {
	try {
		artisanCommands.value = await getArtisanCommandList(props.sshConfig);
	} catch (error) {
		console.error('Error loading artisan commands:', error);
		artisanCommands.value = [];
	}
}

// Select an artisan command
function selectArtisanCommand(command: string) {
	artisanCommand.value = command;
}

// Run a command based on the active tab
async function runCommand(
	type: 'artisan' | 'composer' | 'custom',
	command: string
) {
	if (!command.trim() || isExecuting.value) return;

	isExecuting.value = true;
	activeCommandType.value = type;
	commandOutput.value = null;

	try {
		let result;

		switch (type) {
			case 'artisan':
				result = await executeArtisanCommand(props.sshConfig, command);
				break;
			case 'composer':
				result = await executeComposerCommand(props.sshConfig, command);
				break;
			case 'custom':
				result = await executeRemoteCommand(props.sshConfig, command);
				break;
		}

		commandOutput.value = result;

		// Clear command if successful
		if (result.code === 0) {
			if (type === 'artisan') {
				// Reload artisan commands if we might have changed them
				if (
					command.includes('make:') ||
					command.includes('install') ||
					command.includes('app:name')
				) {
					loadArtisanCommands();
				}
			}
		}
	} catch (error) {
		console.error(`Error executing ${type} command:`, error);
		commandOutput.value = {
			stdout: '',
			stderr:
				error instanceof Error
					? error.message
					: 'Unknown error executing command',
			code: 1
		};
	} finally {
		isExecuting.value = false;
		activeCommandType.value = null;
	}
}
</script>
```

### 3. Update Project Dashboard for Remote Commands

Update the project dashboard in `src/views/project/Dashboard.vue` to include the remote command executor:

```vue
<template>
	<!-- ... existing template ... -->

	<!-- Add Remote Command Executor for SSH connections -->
	<div
		v-if="project?.isRemote && project?.ssh_config"
		class="mb-6"
	>
		<RemoteCommandExecutor :ssh-config="project.ssh_config" />
	</div>

	<!-- ... rest of template ... -->
</template>

<script lang="ts" setup>
// ... existing imports ...
import RemoteFileBrowser from '../../components/project/RemoteFileBrowser.vue';
import RemoteCommandExecutor from '../../components/project/RemoteCommandExecutor.vue';

// ... rest of existing code ...
</script>
```

### 4. Integrate with Database Migration UI

If you have an existing migration management UI, update it to handle remote migrations. For example, in `src/components/database/MigrationManager.vue`:

```vue
<template>
	<!-- ... existing template ... -->
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getConnection } from '../../store/connections';
import {
	runMigration,
	getMigrationStatus
} from '../../services/migration-service';
import {
	runMigrations as runRemoteMigrations,
	getMigrationStatus as getRemoteMigrationStatus
} from '../../services/remote-command-service';

// ... existing setup code ...

// Modified runMigration function to handle remote migrations
async function runMigration(options = {}) {
	loading.value = true;
	error.value = null;

	try {
		if (!connection.value) {
			throw new Error('No connection selected');
		}

		let result;

		// Check if it's a remote connection
		if (connection.value.isRemote && connection.value.ssh_config) {
			// Run migrations on remote server
			result = await runRemoteMigrations(
				connection.value.ssh_config,
				options
			);

			// Check for errors
			if (result.code !== 0) {
				throw new Error(`Migration failed: ${result.stderr}`);
			}

			// Parse output - implementation depends on how you want to display
			// migration results to the user
		} else {
			// Run migrations locally
			result = await runLocalMigration(
				connection.value.projectPath,
				options
			);
		}

		// Success message or refresh migration status
		await loadMigrationStatus();
	} catch (err) {
		error.value =
			err instanceof Error
				? err.message
				: 'Unknown error running migrations';
		console.error('Error running migrations:', err);
	} finally {
		loading.value = false;
	}
}

// Modified loadMigrationStatus function to handle remote status
async function loadMigrationStatus() {
	statusLoading.value = true;
	statusError.value = null;

	try {
		if (!connection.value) {
			throw new Error('No connection selected');
		}

		let result;

		// Check if it's a remote connection
		if (connection.value.isRemote && connection.value.ssh_config) {
			// Get migration status from remote server
			result = await getRemoteMigrationStatus(
				connection.value.ssh_config
			);

			// Check for errors
			if (result.code !== 0) {
				throw new Error(
					`Failed to get migration status: ${result.stderr}`
				);
			}

			// Parse the output to extract migration status
			// This depends on how Laravel formats the migration status output
			// and how you want to display it to the user
		} else {
			// Get migration status locally
			result = await getLocalMigrationStatus(
				connection.value.projectPath
			);
		}

		// Update status in the UI
		// ... existing code ...
	} catch (err) {
		statusError.value =
			err instanceof Error
				? err.message
				: 'Unknown error loading migration status';
		console.error('Error loading migration status:', err);
	} finally {
		statusLoading.value = false;
	}
}

// ... rest of existing code ...
</script>
```

## Verification

- Ensure remote commands execute correctly
- Test running artisan commands on the remote server
- Verify composer commands work properly
- Test handling of command outputs and error states
- Confirm that migrations can be run on the remote server

## Next Steps

After completing these tasks, proceed to [Step 9: Install Dependencies](./09-dependencies.md).
