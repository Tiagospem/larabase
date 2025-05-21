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
			toRaw(props.connection),
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

	return new Intl.DateTimeFormat('default', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(date);
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
		width="max-w-[95vw]"
		height="h-[95vh]"
		:show="show"
		:title="'Remote File Explorer'"
		:show-footer="false"
		:prevent-scroll-content="true"
		:custom-style="{ display: 'flex', flexDirection: 'column', overflowY: 'hidden' }"
		@close="$emit('close')"
		class="file-explorer-modal"
	>
		<div class="flex flex-col h-full overflow-hidden">
			<div class="mb-2 flex items-center overflow-x-auto py-1 px-2 bg-base-200 rounded-md sticky top-0 z-10">
				<div class="flex items-center text-xs font-medium">
					<button
						class="btn btn-ghost btn-xs flex items-center h-6 min-h-6"
						@click="navigateToPath(projectRoot)"
						:disabled="currentPath === projectRoot"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-3 w-3 mr-1"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
							/>
						</svg>
						root
					</button>

					<template v-if="relativePath">
						<span class="mx-1 text-xs text-gray-500">/</span>
						<template
							v-for="(part, index) in pathParts"
							:key="index"
						>
							<button
								class="btn btn-ghost btn-xs h-6 min-h-6"
								@click="navigateToPathPart(index)"
							>
								{{ part }}
							</button>
							<span
								v-if="index < pathParts.length - 1"
								class="mx-1 text-xs text-gray-500"
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
				class="flex-1 overflow-hidden border rounded-lg shadow-inner bg-base-100"
			>
				<div class="overflow-y-auto h-full">
					<table class="table table-zebra table-compact w-full text-xs divide-y divide-base-200">
						<thead class="text-xs sticky top-0 bg-base-200 z-10">
							<tr>
								<th class="w-[55%] py-1.5 px-2 text-left font-medium">Name</th>
								<th class="w-[15%] py-1.5 px-2 text-left font-medium">Size</th>
								<th class="w-[15%] py-1.5 px-2 text-left font-medium">Type</th>
								<th class="w-[15%] py-1.5 px-2 text-left font-medium">Modified</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-if="currentPath !== projectRoot"
								class="hover cursor-pointer"
								@click="navigateUp()"
							>
								<td class="flex items-center py-1 px-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="h-4 w-4 mr-2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
										/>
									</svg>
									<span class="text-xs">..</span>
								</td>
								<td class="py-1 px-2"></td>
								<td class="py-1 px-2 text-xs">Directory</td>
								<td class="py-1 px-2"></td>
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
									<td class="flex items-center py-1 px-2">
										<svg
											v-if="item.type === 'directory'"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="h-4 w-4 mr-2 text-primary"
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
											class="h-4 w-4 mr-2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
											/>
										</svg>
										<span class="text-xs truncate">{{ item.name }}</span>
									</td>
									<td class="py-1 px-2 text-xs">{{ formatFileSize(item.size) }}</td>
									<td class="py-1 px-2 text-xs">
										<span :class="{'text-primary font-medium': item.type === 'directory'}">
											{{
												item.type === 'directory'
													? 'Directory'
													: getFileType(item.name)
											}}
										</span>
									</td>
									<td class="py-1 px-2 text-xs">{{ formatDate(item.modTime) }}</td>
								</tr>
							</template>
						</tbody>
					</table>
				</div>
			</div>

			<div
				v-if="error"
				class="mt-2 text-error text-xs"
			>
				{{ error }}
			</div>

			<div
				v-if="selectedFile && selectedFile.content"
				class="mt-2 border-t pt-2 bg-base-200 rounded-b-lg"
			>
				<div class="flex justify-between items-center mb-1 px-2">
					<div class="flex items-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
							stroke="currentColor" class="h-4 w-4 mr-2">
							<path stroke-linecap="round" stroke-linejoin="round" 
								d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
						</svg>
						<h3 class="text-xs font-semibold">
							{{ selectedFile.name }}
						</h3>
					</div>
					<button
						class="btn btn-ghost btn-xs h-6 min-h-6 text-xs"
						@click="selectedFile = null"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
							stroke="currentColor" class="h-3 w-3 mr-1">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
						Close
					</button>
				</div>
				<div
					class="border border-base-300 rounded-lg p-2 mx-2 mb-2 bg-base-100 overflow-auto shadow-inner"
					style="max-height: 20vh"
				>
					<pre class="text-xs font-mono leading-relaxed"><code>{{ selectedFile.content }}</code></pre>
				</div>
			</div>
		</div>
	</Modal>
</template>