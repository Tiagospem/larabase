<script setup lang="ts">
import { inject, ref, watch, toRaw } from 'vue';
import { v4 as uuid } from 'uuid';
import { useConnectionsStore } from '@/store/connections';
import Modal from '@/components/Modal.vue';
import { ProjectConnection } from '@/types/project';
import { Env } from '@/types/env';
import { DockerInfo } from '@/types/docker-info';
import {
	ConnectionStatus,
	ConnectionType,
	getConnectionTypeIcon
} from '@/types/connection-types';
import SshConnectionForm from '@/components/home/SshConnectionForm.vue';
import { SshConnection } from '@/types/ssh-connection';

const connectionsStore = useConnectionsStore();

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const isSaving = ref(false);
const isCreateModalOpen = ref(false);
const isEditMode = ref(false);

const defaultValues = {
	id: '',
	projectPath: '',
	name: '',
	type: ConnectionType.MySQL,
	icon: getConnectionTypeIcon(ConnectionType.MySQL),
	dbConfig: {
		database: '',
		host: '127.0.0.1',
		port: 3306,
		user: '',
		password: '',
		connectTimeout: 10000
	},
	redisConfig: {
		port: 6379,
		host: '127.0.0.1',
		password: ''
	},
	usingSail: false,
	status: ConnectionStatus.Connected,
	isValid: true,
	isRemote: false,
	dockerInfo: null
};
const newConnection = ref<ProjectConnection>(defaultValues);
const sshConfig = ref<SshConnection>({
	name: '',
	host: '',
	port: 22,
	user: '',
	remotePath: '',
	remoteDbType: ConnectionType.MySQL,
	remoteDbConfig: {
		host: '127.0.0.1',
		port: 3306,
		database: '',
		user: '',
		password: ''
	}
});

const editConnectionId = ref();
const projectPathError = ref('');
const dockerInfo = ref<DockerInfo | null>(null);

async function saveNewConnection() {
	try {
		if (
			!newConnection.value.projectPath &&
			newConnection.value.type === ConnectionType.MySQL
		) {
			projectPathError.value = 'Project path is required';
			return;
		}

		const plainSshConfig = {
			name: sshConfig.value.name,
			host: sshConfig.value.host,
			port: sshConfig.value.port,
			user: sshConfig.value.user,
			remotePath: sshConfig.value.remotePath,
			remoteDbType: ConnectionType.MySQL,
			remoteDbConfig: {
				host: sshConfig.value.remoteDbConfig.host,
				port: sshConfig.value.remoteDbConfig.port,
				database: sshConfig.value.remoteDbConfig.database,
				user: sshConfig.value.remoteDbConfig.user,
				password: sshConfig.value.remoteDbConfig.password || ''
			}
		} as any;

		const hasName =
			newConnection.value.type === ConnectionType.SSH
				? !!sshConfig.value.name
				: !!newConnection.value.name;

		if (!hasName) {
			showAlert('Connection name is required', 'error');
			return;
		}

		if (newConnection.value.type === ConnectionType.SSH) {
			if (
				!sshConfig.value.host ||
				!sshConfig.value.user ||
				!sshConfig.value.remotePath
			) {
				showAlert('Please fill all required SSH fields', 'error');
				return;
			}

			if (
				!sshConfig.value.remoteDbConfig.database ||
				!sshConfig.value.remoteDbConfig.user
			) {
				showAlert('Please fill all required database fields', 'error');
				return;
			}
		} else {
			if (
				!newConnection.value.dbConfig?.database ||
				!newConnection.value.dbConfig?.user
			) {
				showAlert('Please fill all required fields', 'error');
				return;
			}
		}

		isSaving.value = true;

		let testResult = { success: true, message: '' };

		if (newConnection.value.type === ConnectionType.SSH) {
			showAlert('Testing SSH connection...', 'info');

			if (sshConfig.value.password) {
				plainSshConfig.password = sshConfig.value.password;
			}
			if (sshConfig.value.privateKey) {
				plainSshConfig.privateKey = sshConfig.value.privateKey;
				if (sshConfig.value.passphrase) {
					plainSshConfig.passphrase = sshConfig.value.passphrase;
				}
			}

			testResult = await window.ipcRenderer.ssh.testConnection(
				toRaw(plainSshConfig)
			);
		} else if (newConnection.value.type === ConnectionType.MySQL) {
			showAlert('Testing database connection...', 'info');

			if (newConnection.value.dbConfig) {
				testResult = await window.ipcRenderer.testMySQLConnection({
					host: newConnection.value.dbConfig.host,
					port: newConnection.value.dbConfig.port,
					user: newConnection.value.dbConfig.user,
					password: newConnection.value.dbConfig.password,
					database: newConnection.value.dbConfig.database
				});
			}
		}

		if (!testResult.success) {
			showAlert(`Connection failed: ${testResult.message}`, 'error');

			isSaving.value = false;
			return;
		}

		showAlert('Connection successful! Saving configuration...', 'success');

		const connectionData: ProjectConnection = {
			id: isEditMode.value ? editConnectionId.value : uuid(),
			projectPath:
				newConnection.value.type === ConnectionType.SSH
					? ''
					: newConnection.value.projectPath,
			name:
				newConnection.value.type === ConnectionType.SSH
					? sshConfig.value.name || ''
					: newConnection.value.name || '',
			type: newConnection.value.type,
			icon: getConnectionTypeIcon(newConnection.value.type),
			isRemote: newConnection.value.type === ConnectionType.SSH,
			status: ConnectionStatus.Connected,
			isValid: true,
			usingSail:
				newConnection.value.type !== ConnectionType.SSH
					? newConnection.value.usingSail
					: false,
			dockerInfo:
				newConnection.value.type !== ConnectionType.SSH
					? dockerInfo.value || null
					: null,
			redisConfig: {
				port: newConnection.value.redisConfig.port,
				host: newConnection.value.redisConfig.host,
				password: newConnection.value.redisConfig.password
			}
		};

		if (newConnection.value.type === ConnectionType.SSH) {
			if (sshConfig.value.password) {
				plainSshConfig.password = sshConfig.value.password;
			}
			if (sshConfig.value.privateKey) {
				plainSshConfig.privateKey = sshConfig.value.privateKey;
				if (sshConfig.value.passphrase) {
					plainSshConfig.passphrase = sshConfig.value.passphrase;
				}
			}

			connectionData.sshConfig = toRaw(plainSshConfig);
		} else if (newConnection.value.dbConfig) {
			connectionData.dbConfig = {
				database: newConnection.value.dbConfig.database,
				host: newConnection.value.dbConfig.host,
				port: newConnection.value.dbConfig.port,
				user: newConnection.value.dbConfig.user,
				password: newConnection.value.dbConfig.password
			};
		}

		if (isEditMode.value) {
			await connectionsStore.updateConnection(
				editConnectionId.value,
				connectionData
			);

			showAlert('Connection updated successfully', 'success');
		} else {
			await connectionsStore.addConnection(connectionData);

			showAlert('Connection saved successfully', 'success');
		}

		isCreateModalOpen.value = false;
	} catch (error: any) {
		showAlert(`Error saving connection: ${error.message}`, 'error');
	} finally {
		isSaving.value = false;
	}
}

function editConnection(project: ProjectConnection) {
	isEditMode.value = true;
	editConnectionId.value = project.id;

	newConnection.value = {
		id: project.id,
		projectPath: project.projectPath,
		name: project.name,
		type: project.type,
		icon: project.icon,
		isRemote: project.isRemote || false,
		redisConfig: {
			port: project.redisConfig.port,
			host: project.redisConfig.host,
			password: project.redisConfig.password
		},
		usingSail: project.usingSail,
		status: project.status || ConnectionStatus.Connected,
		isValid: true,
		dockerInfo: project.dockerInfo
	};

	if (project.dbConfig) {
		newConnection.value.dbConfig = { ...project.dbConfig };
	}

	if (project.sshConfig) {
		sshConfig.value = { ...project.sshConfig };
	}

	projectPathError.value = '';
	dockerInfo.value = project.dockerInfo as DockerInfo;
	isCreateModalOpen.value = true;
}

async function selectProjectDirectory() {
	try {
		const result = await window.ipcRenderer.selectDirectory();

		if (result.canceled) {
			return;
		}

		const selectedPath = result.filePaths[0];

		newConnection.value.projectPath = selectedPath;
		projectPathError.value = '';
		dockerInfo.value = {};

		const isLaravelProject =
			await window.ipcRenderer.validateLaravelProject(selectedPath);

		if (!isLaravelProject) {
			projectPathError.value =
				'The selected directory does not appear to be a valid Laravel project';
			return;
		}

		const envConfig: Env =
			await window.ipcRenderer.readEnvFile(selectedPath);

		if (envConfig) {
			if (!newConnection.value.name || newConnection.value.name === '') {
				newConnection.value.name =
					envConfig.APP_NAME || selectedPath.split('/').pop();
			}

			if (
				envConfig.DB_HOST === ConnectionType.MySQL &&
				newConnection.value.dbConfig
			) {
				newConnection.value.dbConfig.host = '0.0.0.0';
			}

			if (
				newConnection.value.dbConfig &&
				(!newConnection.value.dbConfig.host ||
					newConnection.value.dbConfig.host === '')
			) {
				newConnection.value.dbConfig.host =
					envConfig.DB_HOST || '127.0.0.1';
			}

			if (
				newConnection.value.dbConfig &&
				!newConnection.value.dbConfig.port
			) {
				newConnection.value.dbConfig.port = envConfig.DB_PORT || 3306;
			}

			if (
				newConnection.value.dbConfig &&
				(!newConnection.value.dbConfig.database ||
					newConnection.value.dbConfig.database === '')
			) {
				newConnection.value.dbConfig.database =
					envConfig.DB_DATABASE || '';
			}

			if (
				newConnection.value.dbConfig &&
				(!newConnection.value.dbConfig.user ||
					newConnection.value.dbConfig.user === '')
			) {
				newConnection.value.dbConfig.user =
					envConfig.DB_USERNAME || 'root';
			}

			if (
				newConnection.value.dbConfig &&
				(!newConnection.value.dbConfig.password ||
					newConnection.value.dbConfig.password === '')
			) {
				newConnection.value.dbConfig.password =
					envConfig.DB_PASSWORD || '';
			}

			if (envConfig.REDIS_HOST === 'redis') {
				newConnection.value.redisConfig.host = '0.0.0.0';
			}

			if (
				!newConnection.value.redisConfig.host ||
				newConnection.value.redisConfig.host === ''
			) {
				newConnection.value.redisConfig.host =
					envConfig.REDIS_HOST || '127.0.0.1';
			}

			if (
				!newConnection.value.redisConfig.port ||
				newConnection.value.redisConfig.port === ''
			) {
				newConnection.value.redisConfig.port =
					envConfig.REDIS_PORT || '6379';
			}

			if (
				!newConnection.value.redisConfig.password ||
				newConnection.value.redisConfig.password === 'null'
			) {
				newConnection.value.redisConfig.password = '';
			}

			if (envConfig.DOCKER_INFO) {
				dockerInfo.value = envConfig.DOCKER_INFO;
				newConnection.value.usingSail =
					!!envConfig.DOCKER_INFO.isDocker;
			}
		}
	} catch (error) {
		console.error(error);
		showAlert('Error selecting project directory', 'error');
	}
}

async function removeConnection(projectId: string) {
	if (
		confirm(
			'Are you sure you want to delete this connection? All related data will be lost.'
		)
	) {
		try {
			await connectionsStore.removeConnection(projectId);

			showAlert(
				'Connection and related data removed successfully',
				'success'
			);
		} catch (error) {
			console.error('Error removing connection:', error);
			showAlert('Error removing connection', 'error');
		}
	}
}

function openCreateConnectionModal() {
	isEditMode.value = false;
	editConnectionId.value = null;
	newConnection.value = defaultValues;

	projectPathError.value = '';
	dockerInfo.value = null;

	isCreateModalOpen.value = true;
}

watch(
	() => newConnection.value.type,
	(newType) => {
		projectPathError.value = '';

		if (newType === ConnectionType.SSH) {
			if (newConnection.value.name) {
				sshConfig.value.name = newConnection.value.name;
			}
		} else if (sshConfig.value.name) {
			newConnection.value.name = sshConfig.value.name;
		}

		newConnection.value.icon = getConnectionTypeIcon(newType);

		newConnection.value.isRemote = newType === ConnectionType.SSH;
	}
);

watch(
	() => newConnection.value.name,
	(newName) => {
		if (newConnection.value.type === ConnectionType.SSH && newName) {
			sshConfig.value.name = newName;
		}
	}
);

watch(
	() => sshConfig.value.name,
	(newName) => {
		if (newConnection.value.type === ConnectionType.SSH && newName) {
			newConnection.value.name = newName;
		}
	}
);

defineExpose({ editConnection, removeConnection, openCreateConnectionModal });
</script>

<template>
	<Modal
		:show="isCreateModalOpen"
		:title="isEditMode ? 'Edit Connection' : 'Create New Connection'"
		@close="isCreateModalOpen = false"
		:width="'max-w-4xl'"
		:show-cancel-button="false"
	>
		<div class="max-h-[70vh] overflow-hidden flex flex-col">
			<div class="overflow-y-auto px-2 flex-1">
				<fieldset class="fieldset mb-4 w-full">
					<label class="label">
						<span class="label-text">Connection Type</span>
					</label>
					<select
						v-model="newConnection.type"
						class="select select-bordered w-full"
					>
						<option :value="ConnectionType.MySQL">
							MySQL (Local)
						</option>
						<option :value="ConnectionType.SSH">SSH</option>
					</select>
					<p class="text-base-content mt-1 text-xs">
						{{
							newConnection.type === ConnectionType.SSH
								? 'Connect to a remote server via SSH'
								: 'Connect to a local database'
						}}
					</p>
				</fieldset>

				<div v-if="newConnection.type === ConnectionType.SSH">
					<SshConnectionForm v-model="sshConfig" />
				</div>

				<div v-else>
					<fieldset class="fieldset mb-4 w-full">
						<label class="label">
							<span class="label-text">Laravel Project Path</span>
						</label>
						<div class="flex gap-2">
							<input
								v-model="newConnection.projectPath"
								type="text"
								placeholder="Select Laravel project directory"
								class="input w-full"
								:readonly="true"
							/>
							<button
								class="btn btn-primary"
								@click="selectProjectDirectory"
							>
								Browse
							</button>
						</div>
						<label
							v-if="projectPathError"
							class="label"
						>
							<span class="label-text-alt text-error">{{
								projectPathError
							}}</span>
						</label>
						<p class="text-base-content mt-1 text-xs">
							Path to your Laravel project (.env file will be read
							from this location)
						</p>
					</fieldset>

					<fieldset class="fieldset mb-4 w-full">
						<label class="label cursor-pointer">
							<span class="label-text">Using Laravel Sail?</span>
							<input
								v-model="newConnection.usingSail"
								type="checkbox"
								class="toggle toggle-primary"
							/>
						</label>
						<p class="text-base-content mt-1 text-xs">
							Enable if your project uses Laravel Sail (Docker)
						</p>
					</fieldset>

					<div
						v-if="dockerInfo && !isEditMode"
						:class="[
							'alert mb-4',
							dockerInfo.isDocker
								? 'alert-success'
								: !dockerInfo.isDocker &&
									  dockerInfo.dockerAvailable
									? 'alert-warning'
									: 'alert-info'
						]"
					>
						<div>
							<svg
								v-if="dockerInfo.isDocker"
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 shrink-0 stroke-current"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<svg
								v-else-if="dockerInfo.dockerAvailable"
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 shrink-0 stroke-current"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<svg
								v-else
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="h-6 w-6 shrink-0 stroke-current"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<div>
								<span class="font-medium"
									>Docker Detection:</span
								>
								<p>{{ dockerInfo.message }}</p>
								<p
									v-if="dockerInfo.isDocker"
									class="mt-1 text-sm"
								>
									<span class="font-medium">Container: </span
									>{{ dockerInfo.dockerContainerName }}
								</p>
								<p class="mt-1 text-sm">
									<span v-if="dockerInfo.isDocker">
										The system detected a MySQL Docker
										container. Configuration has been
										automatically adjusted.
									</span>
									<span
										v-else-if="dockerInfo.dockerAvailable"
									>
										Docker is available, but no MySQL
										container was found running on port
										{{ newConnection.dbConfig?.port }}. A
										local connection will be used.
									</span>
									<span v-else>
										Docker was not detected. A local
										connection will be used.
									</span>
								</p>
							</div>
						</div>
					</div>

					<div class="divider">Database Connection</div>

					<div class="grid grid-cols-2 gap-4">
						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Connection Name</span>
							</label>
							<input
								v-model="newConnection.name"
								type="text"
								placeholder="My Project"
								class="input w-full"
								required
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Database Type</span>
							</label>
							<select
								v-model="newConnection.type"
								class="select select-bordered w-full"
								disabled
							>
								<option value="mysql">MySQL</option>
							</select>
							<label class="label">
								<span class="label-text-alt"
									>Only MySQL is supported at the moment</span
								>
							</label>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Host</span>
							</label>
							<input
								v-if="newConnection.dbConfig"
								v-model="newConnection.dbConfig.host"
								type="text"
								placeholder="127.0.0.1"
								class="input w-full"
								required
							/>
							<input
								v-else
								type="text"
								placeholder="127.0.0.1"
								class="input w-full"
								disabled
								required
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Port</span>
							</label>
							<input
								v-if="newConnection.dbConfig"
								v-model="newConnection.dbConfig.port"
								type="text"
								placeholder="3306"
								class="input w-full"
								required
							/>
							<input
								v-else
								type="text"
								placeholder="3306"
								class="input w-full"
								disabled
								required
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Database</span>
							</label>
							<input
								v-if="newConnection.dbConfig"
								v-model="newConnection.dbConfig.database"
								type="text"
								placeholder="database"
								class="input w-full"
								required
							/>
							<input
								v-else
								type="text"
								placeholder="database"
								class="input w-full"
								disabled
								required
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Username</span>
							</label>
							<input
								v-if="newConnection.dbConfig"
								v-model="newConnection.dbConfig.user"
								type="text"
								placeholder="root"
								class="input w-full"
								required
							/>
							<input
								v-else
								type="text"
								placeholder="root"
								class="input w-full"
								disabled
								required
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Password</span>
							</label>
							<input
								v-if="newConnection.dbConfig"
								v-model="newConnection.dbConfig.password"
								type="text"
								placeholder="password"
								class="input w-full"
							/>
							<input
								v-else
								type="text"
								placeholder="password"
								class="input w-full"
								disabled
							/>
						</fieldset>
					</div>

					<div class="divider">Redis Connection (Optional)</div>

					<div class="grid grid-cols-2 gap-4">
						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Redis Host</span>
							</label>
							<input
								v-model="newConnection.redisConfig.host"
								type="text"
								placeholder="127.0.0.1"
								class="input w-full"
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Redis Port</span>
							</label>
							<input
								v-model="newConnection.redisConfig.port"
								type="text"
								placeholder="6379"
								class="input w-full"
							/>
						</fieldset>

						<fieldset class="fieldset w-full">
							<label class="label">
								<span class="label-text">Redis Password</span>
							</label>
							<input
								v-model="newConnection.redisConfig.password"
								type="text"
								placeholder="Leave empty if none"
								class="input w-full"
							/>
						</fieldset>
					</div>
				</div>
			</div>

			<div
				class="modal-action mt-4 border-t border-base-200 pt-3 bg-base-300"
			>
				<button
					class="btn"
					@click="isCreateModalOpen = false"
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					:disabled="
						isSaving ||
						(newConnection.type !== ConnectionType.SSH &&
							!newConnection.projectPath)
					"
					@click="saveNewConnection"
				>
					<span
						v-if="isSaving"
						class="loading loading-spinner loading-xs mr-2"
					/>
					{{ isEditMode ? 'Update Connection' : 'Save Connection' }}
				</button>
			</div>
		</div>
	</Modal>
</template>
