<template>
	<div class="w-full grid gap-4">
		<h3 class="text-lg font-semibold mb-2">SSH Connection Settings</h3>

		<!-- Connection Name -->
		<div class="form-control">
			<label class="label">
				<span class="label-text">Connection Name</span>
			</label>
			<input
				v-model="sshConfig.name"
				type="text"
				placeholder="My Remote Laravel Project"
				class="input input-bordered w-full"
			/>
		</div>

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
				disabled
			>
				<option value="mysql">MySQL</option>
			</select>
			<p class="label text-xs">Only MySQL is supported at the moment</p>
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
import { ref, watch, computed, nextTick } from 'vue';
import { toRaw } from 'vue';
import type { SshConnection } from '../../types/ssh-connection';

const props = defineProps<{
	modelValue: SshConnection;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: SshConnection): void;
}>();

// Create a deep copy of the SSH config to avoid direct mutation
const sshConfig = ref<SshConnection>({
	name: props.modelValue.name || '',
	host: props.modelValue.host || '',
	port: props.modelValue.port || 22,
	username: props.modelValue.username || '',
	remotePath: props.modelValue.remotePath || '',
	remoteDbType: 'mysql',
	remoteDbConfig: {
		host: props.modelValue.remoteDbConfig?.host || 'localhost',
		port: props.modelValue.remoteDbConfig?.port || 3306,
		database: props.modelValue.remoteDbConfig?.database || '',
		username: props.modelValue.remoteDbConfig?.username || '',
		password: props.modelValue.remoteDbConfig?.password || ''
	}
});

// If there are auth properties in the model, copy them
if (props.modelValue.password) {
	sshConfig.value.password = props.modelValue.password;
}
if (props.modelValue.privateKey) {
	sshConfig.value.privateKey = props.modelValue.privateKey;
	if (props.modelValue.passphrase) {
		sshConfig.value.passphrase = props.modelValue.passphrase;
	}
}

// Use a simple ref for the auth method
const authMethod = ref<'password' | 'privateKey'>(
	props.modelValue.privateKey ? 'privateKey' : 'password'
);

// Testing connection state
const isTestingConnection = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// Flag to prevent recursive updates
const isUpdating = ref(false);

// Watch auth method changes and update config accordingly
watch(authMethod, (newValue) => {
	if (isUpdating.value) return;

	isUpdating.value = true;

	try {
		if (newValue === 'password') {
			// Clear private key settings
			delete sshConfig.value.privateKey;
			delete sshConfig.value.passphrase;
			// Make sure password exists
			if (!sshConfig.value.password) {
				sshConfig.value.password = '';
			}
		} else {
			// Clear password
			delete sshConfig.value.password;
			// Make sure privateKey exists
			if (!sshConfig.value.privateKey) {
				sshConfig.value.privateKey = '';
			}
		}

		// Emit the updated value
		emit('update:modelValue', toRaw(sshConfig.value));
	} finally {
		// Reset the updating flag
		setTimeout(() => {
			isUpdating.value = false;
		}, 0);
	}
});

// Emit changes when the SSH config changes
watch(
	sshConfig,
	() => {
		if (isUpdating.value) return;

		isUpdating.value = true;
		try {
			emit('update:modelValue', toRaw(sshConfig.value));
		} finally {
			// Reset the updating flag
			setTimeout(() => {
				isUpdating.value = false;
			}, 0);
		}
	},
	{ deep: true }
);

// Update local config when props change
watch(
	() => props.modelValue,
	(newValue) => {
		if (isUpdating.value) return;

		isUpdating.value = true;
		try {
			// Copy over all properties in a safe way
			sshConfig.value.name = newValue.name || '';
			sshConfig.value.host = newValue.host || '';
			sshConfig.value.port = newValue.port || 22;
			sshConfig.value.username = newValue.username || '';
			sshConfig.value.remotePath = newValue.remotePath || '';
			sshConfig.value.remoteDbType = 'mysql';
			sshConfig.value.remoteDbConfig = {
				host: newValue.remoteDbConfig?.host || 'localhost',
				port: newValue.remoteDbConfig?.port || 3306,
				database: newValue.remoteDbConfig?.database || '',
				username: newValue.remoteDbConfig?.username || '',
				password: newValue.remoteDbConfig?.password || ''
			};
			
			// Handle authentication properties
			if (newValue.password) {
				sshConfig.value.password = newValue.password;
				delete sshConfig.value.privateKey;
				delete sshConfig.value.passphrase;
				authMethod.value = 'password';
			} else if (newValue.privateKey) {
				sshConfig.value.privateKey = newValue.privateKey;
				if (newValue.passphrase) {
					sshConfig.value.passphrase = newValue.passphrase;
				}
				delete sshConfig.value.password;
				authMethod.value = 'privateKey';
			}
		} finally {
			// Reset the updating flag
			setTimeout(() => {
				isUpdating.value = false;
			}, 0);
		}
	},
	{ deep: true }
);

// Select private key file
async function selectPrivateKeyFile() {
	try {
		const result = await window.ipcRenderer.selectFile({
			title: 'Select SSH Private Key',
			filters: [
				{
					name: 'Private Keys',
					extensions: ['pem', 'key', 'ppk', 'id_rsa', '*']
				}
			],
			properties: ['openFile']
		});

		if (result && result.filePaths && result.filePaths.length > 0) {
			isUpdating.value = true;
			try {
				sshConfig.value.privateKey = result.filePaths[0];
				emit('update:modelValue', toRaw(sshConfig.value));
			} finally {
				setTimeout(() => {
					isUpdating.value = false;
				}, 0);
			}
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
		// Create a clean object with only the properties needed for testing
		// This avoids any circular references or non-serializable objects
		const cleanConfig: any = {
			name: sshConfig.value.name || '',
			host: sshConfig.value.host,
			port: sshConfig.value.port,
			username: sshConfig.value.username,
			remotePath: sshConfig.value.remotePath,
			remoteDbType: 'mysql',
			remoteDbConfig: {
				host: sshConfig.value.remoteDbConfig.host,
				port: sshConfig.value.remoteDbConfig.port,
				database: sshConfig.value.remoteDbConfig.database,
				username: sshConfig.value.remoteDbConfig.username,
				password: sshConfig.value.remoteDbConfig.password || ''
			}
		};
		
		// Add auth method specific properties
		if (authMethod.value === 'password') {
			cleanConfig.password = sshConfig.value.password;
		} else {
			cleanConfig.privateKey = sshConfig.value.privateKey;
			if (sshConfig.value.passphrase) {
				cleanConfig.passphrase = sshConfig.value.passphrase;
			}
		}
		
		const result = await window.ipcRenderer.ssh.testConnection(cleanConfig);
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
