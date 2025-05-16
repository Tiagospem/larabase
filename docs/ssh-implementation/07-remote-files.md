# Step 7: Handle Remote File Operations

In this step, we'll implement functionality to handle file operations on remote servers via SSH. This will allow users to view, edit, and manage files in their remote Laravel projects.

## Tasks

- [ ] Create a file service for remote operations
- [ ] Implement file listing functionality
- [ ] Implement file reading and writing
- [ ] Update environment file editor to work with remote files
- [ ] Create a remote file browser component

## Implementation Details

### 1. Create a Remote File Service

Create a new file `src/services/remote-file-service.ts` to handle remote file operations:

```typescript
import { SshConnection } from '../types/ssh-connection';

/**
 * List files in a directory on the remote server
 */
export async function listRemoteFiles(
	sshConfig: SshConnection,
	directoryPath: string
): Promise<
	Array<{
		name: string;
		type: 'file' | 'directory';
		size: number;
		modifyTime: Date;
	}>
> {
	try {
		const result = await window.electronAPI.ssh.listFiles(
			sshConfig,
			directoryPath
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to list remote files');
		}

		return result.files.map((file: any) => ({
			name: file.filename,
			type: file.longname.startsWith('d') ? 'directory' : 'file',
			size: parseInt(file.attrs.size),
			modifyTime: new Date(file.attrs.mtime * 1000)
		}));
	} catch (error) {
		console.error('Error listing remote files:', error);
		throw error;
	}
}

/**
 * Read a file from the remote server
 */
export async function readRemoteFile(
	sshConfig: SshConnection,
	filePath: string
): Promise<string> {
	try {
		const result = await window.electronAPI.ssh.readFile(
			sshConfig,
			filePath
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to read remote file');
		}

		return result.content;
	} catch (error) {
		console.error('Error reading remote file:', error);
		throw error;
	}
}

/**
 * Write to a file on the remote server
 */
export async function writeRemoteFile(
	sshConfig: SshConnection,
	filePath: string,
	content: string
): Promise<void> {
	try {
		const result = await window.electronAPI.ssh.writeFile(
			sshConfig,
			filePath,
			content
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to write remote file');
		}
	} catch (error) {
		console.error('Error writing remote file:', error);
		throw error;
	}
}

/**
 * Check if a file exists on the remote server
 */
export async function checkRemoteFileExists(
	sshConfig: SshConnection,
	filePath: string
): Promise<boolean> {
	try {
		const command = `test -f "${filePath}" && echo "exists" || echo "not exists"`;
		const result = await window.electronAPI.ssh.executeCommand(
			sshConfig,
			command
		);

		return result.stdout.trim() === 'exists';
	} catch (error) {
		console.error('Error checking if remote file exists:', error);
		return false;
	}
}

/**
 * Get Laravel environment variables from a remote server
 */
export async function getRemoteEnvVariables(
	sshConfig: SshConnection
): Promise<string> {
	try {
		const envPath = `${sshConfig.remotePath}/.env`;
		return await readRemoteFile(sshConfig, envPath);
	} catch (error) {
		console.error('Error getting remote env variables:', error);
		throw error;
	}
}

/**
 * Update Laravel environment variables on a remote server
 */
export async function updateRemoteEnvVariables(
	sshConfig: SshConnection,
	content: string
): Promise<void> {
	try {
		const envPath = `${sshConfig.remotePath}/.env`;
		await writeRemoteFile(sshConfig, envPath, content);
	} catch (error) {
		console.error('Error updating remote env variables:', error);
		throw error;
	}
}
```

### 2. Create a Remote File Browser Component

Create a new file `src/components/project/RemoteFileBrowser.vue` to provide a UI for browsing remote files:

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
							d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
						/>
					</svg>
					Remote Files
				</h2>
				<div>
					<button
						@click="refreshFiles"
						class="btn btn-sm btn-ghost"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="w-5 h-5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Current Path -->
			<div class="flex items-center mb-4 overflow-x-auto">
				<button
					@click="navigateToPath('')"
					class="btn btn-sm btn-ghost"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-5 h-5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
						/>
					</svg>
				</button>

				<div class="breadcrumbs text-sm">
					<ul>
						<li
							v-for="(part, index) in pathParts"
							:key="index"
						>
							<button
								@click="navigateToPathPart(index)"
								class="hover:underline"
							>
								{{ part || 'root' }}
							</button>
						</li>
					</ul>
				</div>
			</div>

			<!-- Loading State -->
			<div
				v-if="loading"
				class="py-12 flex justify-center"
			>
				<span class="loading loading-spinner loading-lg"></span>
			</div>

			<!-- Error State -->
			<div
				v-else-if="error"
				class="alert alert-error"
			>
				{{ error }}
			</div>

			<!-- Empty Directory -->
			<div
				v-else-if="files.length === 0"
				class="py-12 text-center text-gray-500"
			>
				This directory is empty
			</div>

			<!-- File List -->
			<div
				v-else
				class="overflow-x-auto"
			>
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
							<th>Size</th>
							<th>Modified</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="file in files"
							:key="file.name"
						>
							<td>
								<!-- If it's a directory, make it clickable -->
								<button
									v-if="file.type === 'directory'"
									@click="navigateToDirectory(file.name)"
									class="flex items-center text-left hover:underline"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="w-5 h-5 mr-2 text-yellow-500"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
										/>
									</svg>
									{{ file.name }}
								</button>

								<!-- If it's a file, show it normally -->
								<div
									v-else
									class="flex items-center"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="w-5 h-5 mr-2 text-blue-500"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
										/>
									</svg>
									{{ file.name }}
								</div>
							</td>
							<td>{{ file.type }}</td>
							<td>{{ formatFileSize(file.size) }}</td>
							<td>{{ formatDate(file.modifyTime) }}</td>
							<td>
								<div class="flex space-x-2">
									<button
										v-if="file.type === 'file'"
										@click="viewFile(file.name)"
										class="btn btn-xs btn-ghost"
										title="View file"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
									</button>
									<button
										v-if="
											file.type === 'file' &&
											isEditable(file.name)
										"
										@click="editFile(file.name)"
										class="btn btn-xs btn-ghost"
										title="Edit file"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21h-9.5A2.25 2.25 0 014 18.75V8.25A2.25 2.25 0 016.25 6H11"
											/>
										</svg>
									</button>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- File View Modal -->
	<dialog
		:open="!!viewingFile"
		class="modal"
	>
		<div class="modal-box w-11/12 max-w-5xl">
			<div class="flex justify-between items-center mb-4">
				<h3 class="font-bold text-lg">{{ viewingFile }}</h3>
				<button
					@click="closeFileViewer"
					class="btn btn-sm btn-circle"
				>
					✕
				</button>
			</div>

			<div
				v-if="fileLoading"
				class="py-4 flex justify-center"
			>
				<span class="loading loading-spinner loading-md"></span>
			</div>

			<div
				v-else-if="fileError"
				class="alert alert-error"
			>
				{{ fileError }}
			</div>

			<div
				v-else
				class="overflow-auto bg-base-300 p-4 rounded"
			>
				<pre class="whitespace-pre-wrap">{{ fileContent }}</pre>
			</div>

			<div class="modal-action">
				<button
					@click="closeFileViewer"
					class="btn"
				>
					Close
				</button>
			</div>
		</div>
	</dialog>

	<!-- File Edit Modal -->
	<dialog
		:open="!!editingFile"
		class="modal"
	>
		<div class="modal-box w-11/12 max-w-5xl">
			<div class="flex justify-between items-center mb-4">
				<h3 class="font-bold text-lg">Edit: {{ editingFile }}</h3>
				<button
					@click="closeFileEditor"
					class="btn btn-sm btn-circle"
				>
					✕
				</button>
			</div>

			<div
				v-if="fileLoading"
				class="py-4 flex justify-center"
			>
				<span class="loading loading-spinner loading-md"></span>
			</div>

			<div
				v-else-if="fileError"
				class="alert alert-error"
			>
				{{ fileError }}
			</div>

			<div
				v-else
				class="form-control mb-4"
			>
				<textarea
					v-model="fileContent"
					class="textarea textarea-bordered h-96 font-mono"
					placeholder="File content"
				></textarea>
			</div>

			<div class="modal-action">
				<button
					@click="saveFile"
					class="btn btn-primary"
					:disabled="fileSaving"
				>
					<span
						v-if="fileSaving"
						class="loading loading-spinner loading-sm"
					></span>
					Save
				</button>
				<button
					@click="closeFileEditor"
					class="btn"
				>
					Cancel
				</button>
			</div>
		</div>
	</dialog>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import { SshConnection } from '../../types/ssh-connection';
import {
	listRemoteFiles,
	readRemoteFile,
	writeRemoteFile
} from '../../services/remote-file-service';

const props = defineProps<{
	sshConfig: SshConnection;
}>();

// File browser state
const currentPath = ref('');
const files = ref<
	Array<{
		name: string;
		type: 'file' | 'directory';
		size: number;
		modifyTime: Date;
	}>
>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// File viewer/editor state
const viewingFile = ref<string | null>(null);
const editingFile = ref<string | null>(null);
const fileContent = ref('');
const fileLoading = ref(false);
const fileError = ref<string | null>(null);
const fileSaving = ref(false);

// Computed path parts for breadcrumbs
const pathParts = computed(() => {
	if (!currentPath.value) return [];
	return currentPath.value.split('/').filter(Boolean);
});

// Watch for changes in SSH config
watch(
	() => props.sshConfig,
	() => {
		if (props.sshConfig) {
			loadFiles();
		}
	},
	{ immediate: true }
);

// Format file size for display
function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date for display
function formatDate(date: Date): string {
	return date.toLocaleString();
}

// Check if a file is editable based on extension
function isEditable(filename: string): boolean {
	const editableExtensions = [
		'.php',
		'.js',
		'.ts',
		'.vue',
		'.css',
		'.scss',
		'.html',
		'.blade.php',
		'.json',
		'.md',
		'.txt',
		'.env',
		'.gitignore',
		'.yml',
		'.yaml',
		'.sh'
	];

	return editableExtensions.some((ext) => filename.endsWith(ext));
}

// Load files from the current directory
async function loadFiles() {
	loading.value = true;
	error.value = null;

	try {
		const path = currentPath.value
			? `${props.sshConfig.remotePath}/${currentPath.value}`
			: props.sshConfig.remotePath;
		files.value = await listRemoteFiles(props.sshConfig, path);
	} catch (err) {
		error.value =
			err instanceof Error ? err.message : 'Error loading files';
		console.error('Error loading files:', err);
	} finally {
		loading.value = false;
	}
}

// Navigate to a specific directory
function navigateToDirectory(dirName: string) {
	currentPath.value = currentPath.value
		? `${currentPath.value}/${dirName}`
		: dirName;
	loadFiles();
}

// Navigate to a specific path
function navigateToPath(path: string) {
	currentPath.value = path;
	loadFiles();
}

// Navigate to a specific part of the current path
function navigateToPathPart(index: number) {
	currentPath.value = pathParts.value.slice(0, index + 1).join('/');
	loadFiles();
}

// Refresh the current directory
function refreshFiles() {
	loadFiles();
}

// View a file
async function viewFile(fileName: string) {
	viewingFile.value = fileName;
	fileLoading.value = true;
	fileError.value = null;

	try {
		const filePath = currentPath.value
			? `${props.sshConfig.remotePath}/${currentPath.value}/${fileName}`
			: `${props.sshConfig.remotePath}/${fileName}`;

		fileContent.value = await readRemoteFile(props.sshConfig, filePath);
	} catch (err) {
		fileError.value =
			err instanceof Error ? err.message : 'Error loading file';
		console.error('Error loading file:', err);
	} finally {
		fileLoading.value = false;
	}
}

// Edit a file
async function editFile(fileName: string) {
	editingFile.value = fileName;
	fileLoading.value = true;
	fileError.value = null;

	try {
		const filePath = currentPath.value
			? `${props.sshConfig.remotePath}/${currentPath.value}/${fileName}`
			: `${props.sshConfig.remotePath}/${fileName}`;

		fileContent.value = await readRemoteFile(props.sshConfig, filePath);
	} catch (err) {
		fileError.value =
			err instanceof Error ? err.message : 'Error loading file';
		console.error('Error loading file:', err);
	} finally {
		fileLoading.value = false;
	}
}

// Save edited file
async function saveFile() {
	if (!editingFile.value) return;

	fileSaving.value = true;
	fileError.value = null;

	try {
		const filePath = currentPath.value
			? `${props.sshConfig.remotePath}/${currentPath.value}/${editingFile.value}`
			: `${props.sshConfig.remotePath}/${editingFile.value}`;

		await writeRemoteFile(props.sshConfig, filePath, fileContent.value);
		closeFileEditor();
	} catch (err) {
		fileError.value =
			err instanceof Error ? err.message : 'Error saving file';
		console.error('Error saving file:', err);
	} finally {
		fileSaving.value = false;
	}
}

// Close file viewer
function closeFileViewer() {
	viewingFile.value = null;
	fileContent.value = '';
	fileError.value = null;
}

// Close file editor
function closeFileEditor() {
	editingFile.value = null;
	fileContent.value = '';
	fileError.value = null;
}
</script>
```

### 3. Update Environment File Editor for Remote Files

Update the environment file editor in `src/components/environment/EnvEditor.vue` to support remote environment files:

```vue
<template>
	<!-- ... existing template ... -->
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getConnection } from '../../store/connections';
import { readEnvFile, writeEnvFile } from '../../services/env-service';
import {
	getRemoteEnvVariables,
	updateRemoteEnvVariables
} from '../../services/remote-file-service';

// ... existing setup code ...

// Modified loadEnvFile function to handle remote files
async function loadEnvFile() {
	loading.value = true;
	error.value = null;

	try {
		if (!connection.value) {
			throw new Error('No connection selected');
		}

		// Check if it's a remote connection
		if (connection.value.isRemote && connection.value.ssh_config) {
			// Load environment variables from remote server
			env.value = await getRemoteEnvVariables(
				connection.value.ssh_config
			);
		} else {
			// Load environment variables from local file
			env.value = await readEnvFile(connection.value.projectPath);
		}

		// Process environment variables into key-value pairs
		// ... existing code ...
	} catch (err) {
		error.value =
			err instanceof Error
				? err.message
				: 'Unknown error loading environment file';
		console.error('Error loading environment file:', err);
	} finally {
		loading.value = false;
	}
}

// Modified saveEnvFile function to handle remote files
async function saveEnvFile() {
	saving.value = true;
	saveError.value = null;

	try {
		if (!connection.value) {
			throw new Error('No connection selected');
		}

		// Convert environment variables back to file format
		// ... existing code ...

		// Check if it's a remote connection
		if (connection.value.isRemote && connection.value.ssh_config) {
			// Update environment variables on remote server
			await updateRemoteEnvVariables(
				connection.value.ssh_config,
				envFileContent
			);
		} else {
			// Update environment variables in local file
			await writeEnvFile(connection.value.projectPath, envFileContent);
		}

		saveSuccess.value = true;
		setTimeout(() => {
			saveSuccess.value = false;
		}, 3000);
	} catch (err) {
		saveError.value =
			err instanceof Error
				? err.message
				: 'Unknown error saving environment file';
		console.error('Error saving environment file:', err);
	} finally {
		saving.value = false;
	}
}

// ... rest of existing code ...
</script>
```

### 4. Add Remote File Browser to Project Dashboard

Update the project dashboard in `src/views/project/Dashboard.vue` to include the remote file browser component:

```vue
<template>
	<!-- ... existing template ... -->

	<!-- Add Remote File Browser for SSH connections -->
	<div
		v-if="project?.isRemote && project?.ssh_config"
		class="mb-6"
	>
		<RemoteFileBrowser :ssh-config="project.ssh_config" />
	</div>

	<!-- ... rest of template ... -->
</template>

<script lang="ts" setup>
// ... existing imports ...
import RemoteFileBrowser from '../../components/project/RemoteFileBrowser.vue';

// ... rest of existing code ...
</script>
```

## Verification

- Ensure remote file operations work correctly
- Test listing files from remote servers
- Verify reading and writing files works reliably
- Check that the environment file editor properly handles remote files
- Test the remote file browser component functionality

## Next Steps

After completing these tasks, proceed to [Step 8: Execute Remote Commands](./08-remote-commands.md).
