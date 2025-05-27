<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import { SshConnection } from '@/types/ssh-connection';
import { optimizedSshService } from '@/services/optimized-ssh-service';
import path from 'path-browserify';
import * as monaco from 'monaco-editor';
import { configureMonaco } from '@/utils/monaco-config';

configureMonaco();

const props = defineProps({
	show: {
		type: Boolean,
		default: false
	},
	connection: {
		type: Object as () => SshConnection,
		required: true
	},
	filePath: {
		type: String,
		required: true
	},
	fileName: {
		type: String,
		required: true
	}
});

const emit = defineEmits(['close', 'saved']);

const isLoading = ref(false);
const isSaving = ref(false);
const error = ref('');
const fileContent = ref('');
const originalContent = ref('');
const editorContainer = ref<HTMLDivElement | null>(null);

let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let isUpdating = false;

const fullFilePath = computed(() => {
	return path.join(props.filePath, props.fileName);
});

const hasChanges = computed(() => {
	return fileContent.value !== originalContent.value;
});

const fileExtension = computed(() => {
	return props.fileName.split('.').pop()?.toLowerCase() || '';
});

const editorLanguage = computed(() => {
	const extensionMap: Record<string, string> = {
		php: 'php',
		js: 'javascript',
		ts: 'typescript',
		vue: 'html',
		html: 'html',
		css: 'css',
		scss: 'scss',
		json: 'json',
		md: 'markdown',
		yaml: 'yaml',
		yml: 'yaml',
		env: 'dotenv',
		txt: 'plaintext',
		gitignore: 'plaintext',
		htaccess: 'plaintext'
	};

	return extensionMap[fileExtension.value] || 'plaintext';
});

function initMonacoLanguages() {
	if (
		editorLanguage.value === 'dotenv' &&
		!monaco.languages.getLanguages().some((lang) => lang.id === 'dotenv')
	) {
		monaco.languages.register({ id: 'dotenv' });
		monaco.languages.setMonarchTokensProvider('dotenv', {
			tokenizer: {
				root: [
					[/#.*$/, 'comment'],
					[/([A-Za-z0-9_]+)(=)/, ['key', 'operator']],
					[/"[^"]*"/, 'string'],
					[/'[^']*'/, 'string']
				]
			}
		});
	}
}

function forceEditorLayout() {
	if (editor) {
		console.log('Forcing editor layout');
		setTimeout(() => {
			if (editor && editorContainer.value) {
				const containerHeight = editorContainer.value.clientHeight;

				if (containerHeight > 0) {
					editor.layout({
						width: editorContainer.value.clientWidth,
						height: Math.max(containerHeight, 600)
					});
					editor.focus();
				} else {
					setTimeout(forceEditorLayout, 100);
				}
			}
		}, 100);
	}
}

function createEditor() {
	if (!editorContainer.value) return;
	if (editor) return;

	try {
		initMonacoLanguages();

		editor = monaco.editor.create(editorContainer.value, {
			value: fileContent.value,
			language: editorLanguage.value,
			theme: 'vs-dark',
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			automaticLayout: true,
			wordWrap: 'on',
			lineNumbers: 'on',
			tabSize: 2,
			fontSize: 12,
			scrollbar: {
				verticalScrollbarSize: 12,
				horizontalScrollbarSize: 12,
				alwaysConsumeMouseWheel: false,
				useShadows: true
			},
			overviewRulerLanes: 0,
			folding: true,
			glyphMargin: false,
			lineDecorationsWidth: 0,
			lineNumbersMinChars: 3
		});

		let timeout: ReturnType<typeof setTimeout> | null = null;
		editor.onDidChangeModelContent(() => {
			if (isUpdating) return;

			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(() => {
				if (editor) {
					fileContent.value = editor.getValue();
				}
			}, 50);
		});

		setTimeout(forceEditorLayout, 50);

		window.addEventListener('resize', forceEditorLayout);
	} catch (err) {
		console.error('Error creating editor:', err);
		error.value = 'Failed to initialize editor';
	}
}

function disposeEditor() {
	if (editor) {
		editor.dispose();
		editor = null;
	}
}

function handleResize() {
	if (editor) {
		editor.layout();
	}
}

async function loadFile() {
	if (!props.connection || !fullFilePath.value) return;

	isLoading.value = true;
	error.value = '';

	try {
		const content = await optimizedSshService.read(
			props.connection,
			fullFilePath.value
		);
		fileContent.value = content;
		originalContent.value = content;

		setTimeout(() => {
			createEditor();
		}, 50);
	} catch (err) {
		console.error('Error reading remote file:', err);
		error.value = (err as Error).message || 'Failed to read file';
	} finally {
		isLoading.value = false;
	}
}

async function saveFile() {
	if (
		!props.connection ||
		!fullFilePath.value ||
		!hasChanges.value ||
		isSaving.value
	)
		return;

	isSaving.value = true;
	error.value = '';

	try {
		await optimizedSshService.write(
			props.connection,
			fullFilePath.value,
			fileContent.value
		);
		originalContent.value = fileContent.value;
		emit('saved', {
			filePath: fullFilePath.value,
			content: fileContent.value
		});
	} catch (err) {
		console.error('Error saving remote file:', err);
		error.value = (err as Error).message || 'Failed to save file';
	} finally {
		isSaving.value = false;
	}
}

function handleClose() {
	if (hasChanges.value) {
		if (
			confirm('You have unsaved changes. Are you sure you want to close?')
		) {
			disposeEditor();
			emit('close');
		}
	} else {
		disposeEditor();
		emit('close');
	}
}

watch(
	() => fileContent.value,
	(newValue) => {
		if (editor && editor.getValue() !== newValue) {
			isUpdating = true;
			editor.setValue(newValue);
			isUpdating = false;
		}
	}
);

watch(
	() => props.show,
	(newValue) => {
		if (newValue && !editor) {
			loadFile();
		}
	}
);

onMounted(() => {
	if (props.show) {
		loadFile();
	}
	window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
	window.removeEventListener('resize', handleResize);
	window.removeEventListener('resize', forceEditorLayout);
	disposeEditor();
});
</script>

<template>
	<Modal
		:show="show"
		:title="`Edit File: ${fileName}`"
		:show-footer="true"
		:prevent-scroll-content="true"
		@close="handleClose"
		width="max-w-[95vw]"
		z-index="99999"
	>
		<div class="flex flex-col overflow-auto">
			<div
				class="mb-2 flex items-center justify-between bg-base-200 px-3 py-2 rounded-md"
			>
				<div class="flex items-center">
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
							d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
						/>
					</svg>
					<span class="font-semibold text-sm">{{
						fullFilePath
					}}</span>
					<span class="badge badge-sm ml-2">Remote SSH</span>
				</div>
				<div>
					<span
						v-if="hasChanges"
						class="text-warning text-xs mr-2"
						>Unsaved changes</span
					>
					<button
						class="btn btn-xs"
						@click="loadFile"
						:disabled="isLoading"
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
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
							/>
						</svg>
						Refresh
					</button>
				</div>
			</div>

			<div
				v-if="isLoading"
				class="flex-1 flex items-center justify-center"
			>
				<span class="loading loading-spinner loading-lg"></span>
			</div>

			<div
				v-else-if="error"
				class="flex-1 flex items-center justify-center flex-col"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="text-error mx-auto mb-4 h-12 w-12"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
					/>
				</svg>
				<p class="text-error mb-4">{{ error }}</p>
				<button
					class="btn btn-sm"
					@click="loadFile"
				>
					Retry
				</button>
			</div>

			<div
				v-else
				ref="editorContainer"
				class="editor-container"
			></div>
		</div>

		<template #footer>
			<button
				class="btn btn-ghost"
				@click="handleClose"
			>
				Cancel
			</button>
			<button
				class="btn btn-primary"
				:disabled="isLoading || !hasChanges || isSaving"
				@click="saveFile"
			>
				<span
					v-if="isSaving"
					class="loading loading-spinner loading-xs mr-2"
				></span>
				<svg
					v-else
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
						d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"
					/>
				</svg>
				Save Changes
			</button>
		</template>
	</Modal>
</template>

<style scoped>
:deep(.monaco-editor) {
	border-radius: 0.25rem;
	overflow: hidden;
}

.editor-container {
	display: flex;
	flex-direction: column;
	height: 100%;
}
</style>
