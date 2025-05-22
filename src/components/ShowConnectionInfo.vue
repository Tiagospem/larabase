<script setup lang="ts">
import { computed, watch, inject, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import RemoteBadge from '@/components/ui/RemoteBadge.vue';
import GitBranchWidget from '@/components/GitBranchWidget.vue';
import { useProjectStore } from '@/store/project';
import type { ProjectConnection } from '@/types/project';
import { ConnectionType } from '@/types/connection-types';

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

interface Props {
	connection: ProjectConnection;
	isRemoteConnection: boolean;
}
const props = defineProps<Props>();

const projectStore = useProjectStore();

const isDetailsOpen = ref<boolean>(false);
const isDatabaseMismatch = ref<boolean>(false);

const connectionDetails = computed(() => {
	const { connection, isRemoteConnection } = props;

	if (isRemoteConnection && connection.sshConfig) {
		const { sshConfig } = connection;
		return {
			name: sshConfig.name,
			host: sshConfig.remoteDbConfig.host,
			port: sshConfig.port,
			user: sshConfig.user,
			database: sshConfig.remoteDbConfig.database,
			path: sshConfig.remotePath,
			remotePort: sshConfig.port,
			remoteUser: sshConfig.user,
			dbType: sshConfig.remoteDbType,
			remoteHost: sshConfig.host
		};
	}

	return {
		name: connection.name,
		host: connection.dbConfig?.host ?? null,
		port: connection.dbConfig?.port ?? null,
		user: connection.dbConfig?.user ?? null,
		database: connection.dbConfig?.database ?? null,
		path: connection.projectPath,
		remotePort: null,
		remoteUser: null,
		dbType: ConnectionType.MySQL,
		remoteHost: null
	};
});

async function updateProjectEnv(): Promise<void> {
	const projectPath = projectStore.selectedProject?.projectPath;
	const targetDb = projectStore.targetDatabase;

	if (!projectPath || !targetDb) {
		return;
	}

	try {
		const result = await window.ipcRenderer.updateEnvDatabase({
			projectPath,
			database: targetDb
		});

		if (result.success) {
			isDatabaseMismatch.value = true;
			projectStore.state.projectDatabase = targetDb;
			showAlert('Database updated in .env file successfully!', 'success');
		} else {
			showAlert(`Error updating database: ${result.message}`, 'error');
		}
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		showAlert(`Error updating database: ${msg}`, 'error');
	}
}

watch(
	() => projectStore.selectedProject,
	(proj) => {
		if (proj) {
			projectStore.checkProjectDatabase();
		}
	},
	{ immediate: true }
);
</script>

<template>
	<div v-if="projectStore.selectedProject">
		<div class="flex flex-col">
			<h1 class="flex items-center">
				<span class="text-sm font-semibold">{{
					connectionDetails.name
				}}</span>
				<RemoteBadge
					v-if="props.isRemoteConnection"
					class="ml-2"
				/>
			</h1>
			<GitBranchWidget
				v-if="projectStore.selectedProject && !props.isRemoteConnection"
				:project="projectStore.selectedProject"
			/>
		</div>

		<div class="mt-1 flex items-center gap-1 text-xs">
			<div>
				{{ connectionDetails.database }} ({{ connectionDetails.host }})
			</div>
			<button
				@click="isDetailsOpen = true"
				class="text-sm opacity-70 hover:opacity-100"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-3"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
					/>
				</svg>
			</button>
			<div
				v-if="isDatabaseMismatch && !projectStore.state.isLoading"
				class="flex items-center text-amber-400"
			>
				<div class="tooltip tooltip-bottom">
					<span class="text-error">Mismatch DB </span>
				</div>
				<button
					class="tooltip tooltip-bottom ml-1"
					:data-tip="'Update .env'"
					@click="updateProjectEnv"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="size-3"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
				</button>
			</div>
		</div>

		<Modal
			:show="isDetailsOpen"
			@close="isDetailsOpen = false"
			width="md"
			z-index="99999"
			title="Connection Details"
			@action="updateProjectEnv"
			:show-action-button="isDatabaseMismatch"
			action-button-text="Update .env"
		>
			<div class="space-y-2 py-4 text-sm">
				<p class="flex items-center">
					<strong>Name:</strong> {{ connectionDetails.name }}
					<RemoteBadge
						v-if="props.isRemoteConnection"
						class="ml-2"
					/>
				</p>
				<p>
					<strong>Project Path:</strong> {{ connectionDetails.path }}
				</p>
				<p>
					<strong>Database:</strong> {{ connectionDetails.database }}
				</p>
				<p><strong>Host:</strong> {{ connectionDetails.host }}</p>
				<p>
					<strong>Project Database:</strong>
					{{ connectionDetails.database || 'Not found' }}
				</p>

				<div v-if="props.isRemoteConnection">
					<div class="divider">SSH Information</div>
					<p>
						<strong>SSH Host:</strong>
						{{ connectionDetails.remoteHost }}:{{
							connectionDetails.remotePort
						}}
					</p>
					<p>
						<strong>SSH User:</strong> {{ connectionDetails.user }}
					</p>
					<p>
						<strong>Remote Path:</strong>
						{{ connectionDetails.path }}
					</p>
					<p>
						<strong>Remote DB Type:</strong>
						{{ connectionDetails.dbType }}
					</p>
				</div>
			</div>
		</Modal>
	</div>
</template>
