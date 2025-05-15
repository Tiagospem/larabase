<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useConnectionsStore } from '@/store/connections';
import terminalService from '@/services/terminal';

const connectionsStore = useConnectionsStore();
const projectPath = computed(() => {
	const selectedProject = connectionsStore.getSelectedProject;
	return selectedProject?.projectPath || '';
});

const terminalElement = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const terminal = ref<Terminal | null>(null);
const fitAddon = ref<FitAddon | null>(null);
const commandInput = ref<string>('');
const isCommandRunning = ref(false);

const larabaseAscii = `
   __                     __                    
  / /   ____ __________ _/ /_  ____ __________ 
 / /   / __ \`/ ___/ __ \`/ __ \\/ __ \`/ ___/ _ \\
/ /___/ /_/ / /  / /_/ / /_/ / /_/ (__  )  __/
\\____/\\__,_/_/   \\__,_/_.___/\\__,_/____/\\___/ 
                                              
`;

const toggleTerminal = () => {
	isVisible.value = !isVisible.value;
	if (isVisible.value) {
		setTimeout(() => {
			document.getElementById('command-input')?.focus();
			fitTerminal();
		}, 0);
	}
};

const fitTerminal = () => {
	if (fitAddon.value && isVisible.value) {
		try {
			fitAddon.value.fit();
		} catch (e) {
			console.error('Error fitting terminal:', e);
		}
	}
};

const executeCommand = async () => {
	if (!commandInput.value.trim() || isCommandRunning.value) return;

	if (commandInput.value.trim().startsWith('cd ')) {
		if (terminal.value) {
			terminal.value.writeln(`$ ${commandInput.value}`);
			terminal.value.writeln(
				'\x1b[31mChanging directories is restricted. All commands run from the project root.\x1b[0m'
			);
			commandInput.value = '';
		}
		return;
	}

	if (terminal.value) {
		isCommandRunning.value = true;

		terminal.value.writeln(`$ ${commandInput.value}`);

		const savedCommand = commandInput.value;
		commandInput.value = '';

		try {
			if (window.ipcRenderer) {
				window.ipcRenderer.on('terminal-stdout', (_event, data) => {
					if (terminal.value && data) {
						terminal.value.write(data);
						scrollToBottomOfTerminal();
					}
				});

				window.ipcRenderer.on('terminal-stderr', (_event, data) => {
					if (terminal.value && data) {
						terminal.value.write(`\x1b[31m${data}\x1b[0m`);
						scrollToBottomOfTerminal();
					}
				});

				window.ipcRenderer.on('terminal-exit', (_event) => {
					if (terminal.value) {
						isCommandRunning.value = false;
						scrollToBottomOfTerminal();

						window.ipcRenderer.removeAllListeners(
							'terminal-stdout'
						);
						window.ipcRenderer.removeAllListeners(
							'terminal-stderr'
						);
						window.ipcRenderer.removeAllListeners('terminal-exit');
						window.ipcRenderer.removeAllListeners('terminal-error');
					}
				});

				window.ipcRenderer.on('terminal-error', (_event, error) => {
					if (terminal.value) {
						terminal.value.writeln(
							`\r\n\x1b[31mError: ${error}\x1b[0m`
						);
						isCommandRunning.value = false;
						scrollToBottomOfTerminal();

						window.ipcRenderer.removeAllListeners(
							'terminal-stdout'
						);
						window.ipcRenderer.removeAllListeners(
							'terminal-stderr'
						);
						window.ipcRenderer.removeAllListeners('terminal-exit');
						window.ipcRenderer.removeAllListeners('terminal-error');
					}
				});

				window.ipcRenderer.start_terminal_process(
					savedCommand,
					projectPath.value
				);
			} else {
				terminal.value.writeln(
					'\r\n\x1b[31mError: Terminal API not available\x1b[0m'
				);
				isCommandRunning.value = false;
			}
		} catch (error) {
			terminal.value.writeln(
				`\r\n\x1b[31mCommand execution error: ${error}\x1b[0m`
			);
			isCommandRunning.value = false;
		}
	}
};

const cancelCurrentCommand = () => {
	if (isCommandRunning.value && window.ipcRenderer) {
		window.ipcRenderer.cancel_terminal_process();
		if (terminal.value) {
			terminal.value.writeln(
				'\r\n\x1b[33mCommand canceled by user\x1b[0m'
			);
		}
	}
};

const handleKeyDown = (e: KeyboardEvent) => {
	if (e.key === 'Enter') {
		executeCommand();
	} else if (e.key === 'c' && e.ctrlKey && isCommandRunning.value) {
		cancelCurrentCommand();
	}
};

const clearTerminal = () => {
	if (terminal.value) {
		terminal.value.clear();
	}
};

const scrollToBottomOfTerminal = () => {
	if (terminal.value) {
		terminal.value.scrollToBottom();
	}
};

onMounted(() => {
	fitAddon.value = new FitAddon();

	const term = new Terminal({
		cursorBlink: false,
		disableStdin: true,
		fontFamily: 'Menlo, Monaco, "Courier New", monospace',
		fontSize: 14,
		lineHeight: 1.4,
		convertEol: true,
		scrollback: 10000,
		allowTransparency: true,
		theme: {
			background: '#000',
			foreground: '#f8f8f2'
		}
	});

	term.loadAddon(fitAddon.value);

	if (terminalElement.value) {
		term.open(terminalElement.value);
		term.writeln(larabaseAscii);
		term.writeln(
			'Terminal started. Type commands in the input field below.'
		);
		term.writeln(
			`Working directory: ${projectPath.value || 'Application Root'}`
		);
		term.writeln(
			'Commands will be displayed in real-time as they execute.'
		);
		term.writeln('');

		setTimeout(() => fitTerminal(), 50);
	}

	terminal.value = term;

	window.addEventListener('resize', fitTerminal);

	window.addEventListener('keydown', (e) => {
		if (e.key === 'c' && e.ctrlKey && isCommandRunning.value) {
			cancelCurrentCommand();
		}
	});

	const terminalApi = {
		toggleTerminal,
		executeCommand,
		cancelCurrentCommand,
		isVisible: isVisible.value,
		get commandInput() {
			return commandInput.value;
		},
		set commandInput(value) {
			commandInput.value = value;
		},
		writeln: (text: string) => {
			if (terminal.value) {
				terminal.value.writeln(text);
			}
		}
	};

	terminalService.setTerminal(terminalApi);
});

onUnmounted(() => {
	if (terminal.value) {
		terminal.value.dispose();
	}

	window.removeEventListener('resize', fitTerminal);

	if (window.ipcRenderer) {
		window.ipcRenderer.removeAllListeners('terminal-stdout');
		window.ipcRenderer.removeAllListeners('terminal-stderr');
		window.ipcRenderer.removeAllListeners('terminal-exit');
		window.ipcRenderer.removeAllListeners('terminal-error');
	}

	if (isCommandRunning.value) {
		cancelCurrentCommand();
	}

	window.removeEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'c' && e.ctrlKey) {
			cancelCurrentCommand();
		}
	});
});
</script>

<template>
	<div class="terminal-container">
		<div
			class="terminal-button"
			@click="toggleTerminal"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="4 17 10 11 4 5"></polyline>
				<line
					x1="12"
					y1="19"
					x2="20"
					y2="19"
				></line>
			</svg>
		</div>
		<div
			class="terminal-panel text-base-content"
			:class="{ visible: isVisible }"
		>
			<div class="terminal-header bg-base-200">
				<span>Terminal ({{ projectPath || 'Application Root' }})</span>
				<div class="terminal-actions">
					<button
						v-if="isCommandRunning"
						class="action-button text-error"
						@click="cancelCurrentCommand"
						title="Cancel running command (Ctrl+C)"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
							/>
						</svg>
					</button>
					<button
						class="action-button"
						@click="clearTerminal"
						title="Clear terminal"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
							/>
						</svg>
					</button>
					<button
						class="close-button"
						@click="toggleTerminal"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M5 12h14"
							/>
						</svg>
					</button>
				</div>
			</div>
			<div class="terminal-body">
				<div
					ref="terminalElement"
					class="terminal-output"
				></div>
				<div
					class="command-input-container bg-base-200 border-base-content/20 border-t"
				>
					<span
						class="prompt text-primary"
						:class="{ loading: isCommandRunning }"
					>
						{{ isCommandRunning ? '⟳' : '$' }}
					</span>
					<input
						id="command-input"
						v-model="commandInput"
						@keydown="handleKeyDown"
						type="text"
						placeholder="Type a command"
						class="command-input text-base-content"
						:disabled="isCommandRunning"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.terminal-container {
	position: relative;
}

.terminal-button {
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	opacity: 0.7;
	transition: opacity 0.2s;
}

.terminal-button:hover {
	opacity: 1;
}

.terminal-panel {
	position: absolute;
	bottom: 35px;
	right: 0;
	width: 1000px;
	height: 450px;
	border-radius: 8px;
	box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	visibility: hidden;
	transform: translateY(10px);
	transition:
		opacity 0.2s,
		transform 0.2s,
		visibility 0.2s;
	z-index: 50;
}

.terminal-panel.visible {
	visibility: visible;
	transform: translateY(0);
}

.terminal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	font-size: 14px;
}

.terminal-actions {
	display: flex;
	align-items: center;
}

.action-button,
.close-button {
	background: none;
	border: none;
	cursor: pointer;
	transition: opacity 0.2s;
	padding: 4px;
	margin-left: 8px;
}

.close-button {
	font-size: 18px;
}

.terminal-body {
	display: flex;
	flex-direction: column;
	height: calc(100% - 37px);
	overflow: hidden;
	position: relative;
}

.terminal-output {
	flex: 1;
	position: relative;
	overflow: hidden;
}

.command-input-container {
	display: flex;
	align-items: center;
	padding: 12px 16px;
}

.prompt {
	margin-right: 8px;
	font-weight: bold;
}

.prompt.loading {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.command-input {
	flex: 1;
	background: transparent;
	border: none;
	font-family: Menlo, Monaco, 'Courier New', monospace;
	font-size: 14px;
	padding: 4px 0;
	outline: none;
}

.command-input:disabled {
	opacity: 0.7;
	cursor: not-allowed;
}

:deep(.xterm) {
	height: 100%;
	padding: 8px;
}

:deep(.xterm-viewport) {
	width: 100% !important;
	height: 100% !important;
	overflow-y: auto !important;
}

:deep(.xterm-screen) {
	width: 100% !important;
}
</style>
