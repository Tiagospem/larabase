<script lang="ts">
import * as monaco from 'monaco-editor';
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';

interface Props {
	modelValue: string;
}

export default defineComponent({
	name: 'EnvCodeEditor',
	props: {
		modelValue: {
			type: String,
			default: ''
		}
	},
	emits: ['update:modelValue'],
	setup(
		props: Props,
		{ emit }: { emit: (event: 'update:modelValue', value: string) => void }
	) {
		const container = ref<HTMLDivElement | null>(null);
		let editor: monaco.editor.IStandaloneCodeEditor | null = null;
		let isUpdating: boolean = false;

		const initMonacoLanguage = (): void => {
			if (
				!monaco.languages
					.getLanguages()
					.some((lang) => lang.id === 'dotenv')
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
		};

		const createEditor = () => {
			if (!container.value) return;

			if (editor) return;

			initMonacoLanguage();

			editor = monaco.editor.create(container.value, {
				value: props.modelValue,
				language: 'dotenv',
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
					const value: string = editor!.getValue();
					emit('update:modelValue', value);
				}, 300);
			});

			setTimeout(() => {
				if (editor) {
					editor.layout();
					editor.focus();
				}
			}, 100);
		};

		const disposeEditor = () => {
			if (editor) {
				editor.dispose();
				editor = null;
			}
		};

		watch(
			() => props.modelValue,
			(newValue: string) => {
				if (editor && editor.getValue() !== newValue) {
					isUpdating = true;
					editor.setValue(newValue);
					isUpdating = false;
				}
			}
		);

		const handleResize = () => {
			if (editor) {
				editor.layout();
			}
		};

		onMounted(() => {
			setTimeout(createEditor, 50);
			window.addEventListener('resize', handleResize);
		});

		onBeforeUnmount(() => {
			window.removeEventListener('resize', handleResize);
			disposeEditor();
		});

		return {
			container
		};
	}
});
</script>

<template>
	<div
		class="editor-container h-full w-full"
		ref="container"
	></div>
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
	min-height: 200px;
}
</style>
