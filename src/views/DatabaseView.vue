<script setup lang="ts">
import {
	computed,
	markRaw,
	onMounted,
	onUnmounted,
	ref,
	provide,
	toRaw,
	watch
} from 'vue';
import { useRoute } from 'vue-router';

import MainHeader from '@/components/MainHeader.vue';
import Sidebar from '@/components/database/Sidebar.vue';
import MainTabs from '@/components/database/MainTabs.vue';
import TableContent from '@/components/TableContent.vue';
import Terminal from '@/components/Terminal.vue';
import ConnectionGuard from '@/components/ConnectionGuard.vue';

import { useConnectionsStore } from '@/store/connections';
import { useTabsStore } from '@/store/tabs';
import { useSplitPane } from '@/composables/useSplitPane';
import { ConnectionType } from '@/types/connection-types';
import { AppConnection } from '@/types/ssh-connection';

const route = useRoute();
const connectionsStore = useConnectionsStore();
const tabsStore = useTabsStore();

const isContentReady = ref(false);
const pendingMigrationsCount = ref(0);

const isRemoteConnection = computed(() => {
	return route.params.isRemote === 'true';
});

let migrationCheckIntervalId = ref<number | null>(null);

async function checkPendingMigrations() {
	if (!connectionsStore.getSelectedProject) return;

	try {
		const project = connectionsStore.getSelectedProject;

		const AppConnection = {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;

		const config = {
			projectPath: project.projectPath,
			usingSail: project.usingSail,
			appConnection: AppConnection
		};

		const result = await window.ipcRenderer.invoke(
			'get-migration-status',
			config
		);

		if (result.success) {
			pendingMigrationsCount.value = result.pendingMigrations.length;
			window.ipcRenderer.updateMigrationsBadge(
				pendingMigrationsCount.value
			);
		}
	} catch (error) {
		console.error('Error checking pending migrations:', error);
	}
}

function startMigrationChecking() {
	if (migrationCheckIntervalId.value) {
		clearInterval(migrationCheckIntervalId.value);
	}

	checkPendingMigrations();

	migrationCheckIntervalId.value = window.setInterval(() => {
		checkPendingMigrations();
	}, 3000);
}

function stopMigrationChecking() {
	if (migrationCheckIntervalId.value && !isRemoteConnection.value) {
		clearInterval(migrationCheckIntervalId.value);
		migrationCheckIntervalId.value = null;
	}
}

const TableContentComponent = markRaw(TableContent);

const projectId = computed(() => route.params.id as string);

const { sidebarWidth, sidebarRef, startResize } = useSplitPane(180, 480);

const databaseName = computed(() => {
	const project = connectionsStore.getSelectedProject;
	if (!project) return '';

	return project.type === ConnectionType.SSH
		? project.sshConfig?.remoteDbConfig?.database
		: project.dbConfig?.database;
});

function showAlert(message: string, type: string) {
	window.dispatchEvent(
		new CustomEvent('show-alert', {
			detail: { message, type }
		})
	);
}

provide('showAlert', showAlert);

function handleConnectionValid() {
	isContentReady.value = true;
}

function handleMigrationsUpdated() {
	checkPendingMigrations();
}

async function initializeData() {
	if (projectId.value) {
		await connectionsStore.loadConnections(projectId.value);

		if (isRemoteConnection.value) {
			isContentReady.value = true;
		} else {
			stopMigrationChecking();
			startMigrationChecking();
		}
	}
}

onMounted(async () => {
	await initializeData();
});

watch(
	() => route.params.id,
	async (newId) => {
		if (newId) {
			await initializeData();
		}
	},
	{ immediate: false }
);

onUnmounted(() => {
	stopMigrationChecking();
});
</script>

<template>
	<div
		v-cloak
		class="relative flex h-full flex-col"
		tabindex="0"
	>
		<ConnectionGuard
			v-if="
				!connectionsStore.getSelectedProject?.type ||
				connectionsStore.getSelectedProject.type !== 'ssh'
			"
			:projectId="projectId"
			:key="projectId"
			@connection-valid="handleConnectionValid"
		/>

		<div
			class="bg-base-300 draggable absolute top-0 z-10 h-10 w-full"
		></div>

		<MainHeader
			:is-remote-connection="isRemoteConnection"
			:pending-migrations="pendingMigrationsCount"
			@migrations-updated="handleMigrationsUpdated"
		>
		</MainHeader>

		<MainTabs />

		<div class="flex flex-1 overflow-hidden">
			<div
				ref="sidebarRef"
				class="h-full shrink-0"
				:style="{ width: `${sidebarWidth}px` }"
			>
				<Sidebar />
			</div>

			<div
				class="bg-base-300 hover:bg-primary active:bg-primary w-0.5 shrink-0 cursor-col-resize transition-colors"
				@mousedown="startResize"
			></div>

			<div class="flex h-full flex-1 flex-col overflow-hidden">
				<div class="h-full w-full flex-1 overflow-auto">
					<div
						v-if="!tabsStore.activeTableName"
						class="flex h-full items-center justify-center"
					>
						<div class="text-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="currentColor"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="mx-auto mb-4 h-12 w-12"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
								/>
							</svg>
							<p>No tables open.</p>
						</div>
					</div>

					<keep-alive :include="'TableContent'">
						<component
							:is="TableContentComponent"
							v-if="tabsStore.activeTableName"
							:key="tabsStore.activeTableName"
							:tableName="tabsStore.activeTableName"
						/>
					</keep-alive>
				</div>
			</div>
		</div>

		<footer class="bg-base-300 border-t border-black/10 px-4 py-1 text-xs">
			<div class="flex justify-between">
				<div>
					Database:
					{{ databaseName }}
				</div>
				<Terminal />
			</div>
		</footer>
	</div>
</template>
