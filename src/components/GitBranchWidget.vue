<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ProjectConnection } from '@/types/project';

const props = defineProps({
	project: {
		type: Object as () => ProjectConnection,
		required: true
	}
});

interface GitStatus {
	isGitInstalled: boolean;
	hasRepository: boolean;
	currentBranch: string;
	errorMessage?: string;
}

const gitStatus = ref<GitStatus>({
	isGitInstalled: false,
	hasRepository: false,
	currentBranch: '',
	errorMessage: ''
});

const initialLoading = ref(true);
const refreshInterval = ref<number | null>(null);

async function checkGitStatus(showLoading = false) {
	if (showLoading) {
		initialLoading.value = true;
	}

	try {
		if (props.project && props.project.projectPath) {
			gitStatus.value = await window.ipcRenderer.git.getStatus(
				props.project.projectPath
			);
		}
	} catch (error) {
		console.error('Error checking git status:', error);
		gitStatus.value = {
			isGitInstalled: false,
			hasRepository: false,
			currentBranch: '',
			errorMessage: error instanceof Error ? error.message : String(error)
		};
	} finally {
		initialLoading.value = false;
	}
}

async function initializeRepository() {
	if (!props.project || !props.project.projectPath) return;

	initialLoading.value = true;
	try {
		const result = await window.ipcRenderer.git.initRepository(
			props.project.projectPath
		);
		if (result) {
			await checkGitStatus();
		}
	} catch (error) {
		console.error('Error initializing git repository:', error);
	} finally {
		initialLoading.value = false;
	}
}

async function runTerminalCommand() {
	if (!props.project || !props.project.projectPath) return;

	try {
		await window.ipcRenderer.start_terminal_process(
			'git init && git add . && git commit -m "first commit" && git checkout -b develop',
			props.project.projectPath
		);
	} catch (error) {
		console.error('Error running terminal command:', error);
	}
}

function startAutoRefresh() {
	if (refreshInterval.value) return;

	refreshInterval.value = window.setInterval(() => {
		checkGitStatus(false);
	}, 5000);
}

function stopAutoRefresh() {
	if (refreshInterval.value) {
		window.clearInterval(refreshInterval.value);
		refreshInterval.value = null;
	}
}

onMounted(async () => {
	await checkGitStatus(true);
	startAutoRefresh();
});

onUnmounted(() => {
	stopAutoRefresh();
});
</script>

<template>
	<div class="git-branch-widget text-xs opacity-70">
		<div
			v-if="initialLoading"
			class="flex items-center"
		>
			<span class="loading loading-spinner loading-xs mr-1"></span>
			<span>Checking git status...</span>
		</div>

		<div
			v-else-if="!gitStatus.isGitInstalled"
			class="text-warning"
		>
			Git not installed
		</div>

		<div
			v-else-if="!gitStatus.hasRepository"
			class="flex items-center"
		>
			<span class="text-warning mr-2">No git repository</span>
			<button
				@click="initializeRepository"
				class="btn btn-xs btn-outline btn-accent"
			>
				Create repo
			</button>
		</div>

		<div
			v-else-if="gitStatus.currentBranch"
			class="flex items-center gap-1"
		>
			<svg
				class="h-3 w-3"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 448 512"
			>
				<path
					d="M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3l0 87.8c18.8-10.9 40.7-17.1 64-17.1l96 0c35.3 0 64-28.7 64-64l0-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3l0 6.7c0 70.7-57.3 128-128 128l-96 0c-35.3 0-64 28.7-64 64l0 6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3l0-6.7 0-198.7C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"
				/>
			</svg>
			<p class="line-clamp-1">{{ gitStatus.currentBranch }}</p>
		</div>

		<div
			v-else
			class="text-error"
		>
			{{ gitStatus.errorMessage || 'Unknown error' }}
		</div>
	</div>
</template>
