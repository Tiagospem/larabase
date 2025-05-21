<script setup lang="ts">
import { ref, computed, onMounted, watch, toRaw } from 'vue';
import Modal from '@/components/Modal.vue';
import { SshConnection } from '@/types/ssh-connection';
import path from 'path-browserify';

const props = defineProps({
	show: {
		type: Boolean,
		default: false
	},
	connection: {
		type: Object as () => SshConnection,
		required: true
	}
});

const emit = defineEmits(['close']);

const isLoading = ref(false);
const error = ref('');
const items = ref<any[]>([]);
const currentPath = ref('');
const projectRoot = ref('');
const selectedFile = ref<{ name: string; content: string } | null>(null);

const relativePath = computed(() => {
	if (
		!currentPath.value ||
		!projectRoot.value ||
		currentPath.value === projectRoot.value
	) {
		return '';
	}
	return currentPath.value.substring(projectRoot.value.length + 1);
});

const pathParts = computed(() => {
	if (!relativePath.value) return [];
	return relativePath.value.split('/');
});

const sortedItems = computed(() => {
	return [...items.value].sort((a, b) => {
		if (a.type === 'directory' && b.type !== 'directory') return -1;
		if (a.type !== 'directory' && b.type === 'directory') return 1;

		return a.name.localeCompare(b.name);
	});
});

async function loadFiles(dirPath: string) {
	if (!props.connection) return;

	isLoading.value = true;
	error.value = '';
	selectedFile.value = null;

	try {
		const result = await window.ipcRenderer.ssh.listFiles(
			toRaw(props.connection),
			dirPath
		);

		if (result.success) {
			items.value = result.files;
			currentPath.value = dirPath;
		} else {
			error.value = result.message || 'Failed to load files';
			items.value = [];
		}
	} catch (err) {
		console.error('Error listing remote files:', err);
		error.value = (err as Error).message || 'Failed to load files';
		items.value = [];
	} finally {
		isLoading.value = false;
	}
}

function navigateToPath(dirPath: string) {
	loadFiles(dirPath);
}

function navigateToPathPart(index: number) {
	const parts = [...pathParts.value];
	const targetPath = parts.slice(0, index + 1).join('/');
	navigateToPath(path.join(projectRoot.value, targetPath));
}

function navigateUp() {
	if (currentPath.value === projectRoot.value) return;

	const parentPath = path.dirname(currentPath.value);

	if (parentPath.startsWith(projectRoot.value)) {
		navigateToPath(parentPath);
	} else {
		navigateToPath(projectRoot.value);
	}
}

async function handleItemClick(item: any) {
	if (item.type === 'file') {
		selectedFile.value = { name: item.name, content: '' };
	}
}

async function handleItemDoubleClick(item: any) {
	if (item.type === 'directory') {
		const newPath = path.join(currentPath.value, item.name);
		navigateToPath(newPath);
	} else if (item.type === 'file') {
		await loadFileContent(item);
	}
}

async function loadFileContent(item: any) {
	if (!props.connection) return;

	isLoading.value = true;
	error.value = '';

	try {
		const filePath = path.join(currentPath.value, item.name);
		const result = await window.ipcRenderer.ssh.readFile(
			props.connection,
			filePath
		);

		if (result.success) {
			selectedFile.value = {
				name: item.name,
				content: result.content
			};
		} else {
			error.value = result.message || 'Failed to read file';
		}
	} catch (err) {
		console.error('Error reading remote file:', err);
		error.value = (err as Error).message || 'Failed to read file';
	} finally {
		isLoading.value = false;
	}
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	if (bytes === undefined || bytes === null) return '';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: string | number): string {
	if (!timestamp) return '';

	const date = new Date(timestamp);
	return date.toLocaleString();
}

function getFileType(filename: string): string {
	const extension = filename.split('.').pop()?.toLowerCase() || '';

	const typeMap: Record<string, string> = {
		php: 'PHP',
		js: 'JavaScript',
		ts: 'TypeScript',
		vue: 'Vue',
		json: 'JSON',
		html: 'HTML',
		css: 'CSS',
		scss: 'SCSS',
		md: 'Markdown',
		yaml: 'YAML',
		yml: 'YAML',
		txt: 'Text',
		env: 'Environment',
		gitignore: 'Git Config',
		htaccess: 'Apache Config'
	};

	return typeMap[extension] || extension.toUpperCase() || 'File';
}

watch(
	() => props.show,
	(newValue) => {
		if (newValue && props.connection) {
			projectRoot.value = props.connection.remotePath || '/';
			navigateToPath(projectRoot.value);
		}
	}
);

onMounted(() => {
	if (props.show && props.connection) {
		projectRoot.value = props.connection.remotePath || '/';
		navigateToPath(projectRoot.value);
	}
});
</script>

<template>
	<Modal
		width="max-w-[95%]"
		:show="show"
		:title="'Remote File Explorer'"
		:show-footer="false"
		@close="$emit('close')"
		class="file-explorer-modal"
	>
		<div class="flex max-h-[90vh] flex-col">
			<div class="mb-4 flex items-center overflow-x-auto">
				<div class="flex items-center text-sm">
					<button
						class="btn btn-ghost btn-xs flex items-center"
						@click="navigateToPath(projectRoot)"
						:disabled="currentPath === projectRoot"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-4 w-4 mr-1"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
							/>
						</svg>
						Project Root
					</button>

					<template v-if="relativePath">
						<span class="mx-1">/</span>
						<template
							v-for="(part, index) in pathParts"
							:key="index"
						>
							<button
								class="btn btn-ghost btn-xs"
								@click="navigateToPathPart(index)"
							>
								{{ part }}
							</button>
							<span
								v-if="index < pathParts.length - 1"
								class="mx-1"
								>/</span
							>
						</template>
					</template>
				</div>
			</div>

			<div
				v-if="isLoading"
				class="flex-1 flex items-center justify-center"
			>
				<span class="loading loading-spinner loading-lg"></span>
			</div>

			<div
				v-else
				class="flex-1 overflow-y-auto border rounded-lg"
			>
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th class="w-1/2">Name</th>
							<th class="w-1/6">Size</th>
							<th class="w-1/6">Type</th>
							<th class="w-1/6">Modified</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-if="currentPath !== projectRoot"
							class="hover cursor-pointer"
							@click="navigateUp()"
						>
							<td class="flex items-center">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="h-5 w-5 mr-2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
									/>
								</svg>
								..
							</td>
							<td></td>
							<td>Directory</td>
							<td></td>
						</tr>

						<template
							v-for="item in sortedItems"
							:key="item.name"
						>
							<tr
								class="hover cursor-pointer"
								@click="handleItemClick(item)"
								@dblclick="handleItemDoubleClick(item)"
							>
								<td class="flex items-center">
									<svg
										v-if="item.type === 'directory'"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="h-5 w-5 mr-2 text-primary"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
										/>
									</svg>
									<svg
										v-else
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="h-5 w-5 mr-2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
										/>
									</svg>
									{{ item.name }}
								</td>
								<td>{{ formatFileSize(item.size) }}</td>
								<td>
									{{
										item.type === 'directory'
											? 'Directory'
											: getFileType(item.name)
									}}
								</td>
								<td>{{ formatDate(item.modTime) }}</td>
							</tr>
						</template>
					</tbody>
				</table>
			</div>

			<div
				v-if="error"
				class="mt-4 text-error text-sm"
			>
				{{ error }}
			</div>

			<div
				v-if="selectedFile && selectedFile.content"
				class="mt-4"
			>
				<div class="flex justify-between items-center mb-2">
					<h3 class="text-lg font-semibold">
						{{ selectedFile.name }}
					</h3>
					<button
						class="btn btn-ghost btn-xs"
						@click="selectedFile = null"
					>
						Close Preview
					</button>
				</div>
				<div
					class="border rounded-lg p-4 bg-base-200 overflow-auto max-h-80"
				>
					<pre><code>{{ selectedFile.content }}</code></pre>
				</div>
			</div>
		</div>
	</Modal>
</template>
