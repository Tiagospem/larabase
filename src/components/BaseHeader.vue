<script setup lang="ts">
import { ProjectConnection } from '@/types/project';
import {
	ConnectionType,
	getConnectionTypeColor
} from '@/types/connection-types';

const props = defineProps({
	title: {
		type: String,
		required: true
	},
	project: {
		type: Object as () => ProjectConnection | null,
		default: null
	},
	isRemoteConnection: {
		type: Boolean,
		default: false
	},
	showBackButton: {
		type: Boolean,
		default: true
	}
});

function getConnectionInfo(project: ProjectConnection | null) {
	if (!project) return '';

	if (project.type === ConnectionType.SSH && project.sshConfig) {
		const remoteConfig = project.sshConfig.remoteDbConfig;
		if (remoteConfig) {
			return `${remoteConfig.host}:${remoteConfig.port}/${remoteConfig.database}`;
		}
		return project.sshConfig.host || '';
	}

	return project?.dbConfig?.database || project?.projectPath || '';
}

const emit = defineEmits(['goBack']);

const handleGoBack = () => {
	emit('goBack');
};
</script>

<template>
	<div class="bg-base-300 draggable absolute top-0 z-10 h-10 w-full"></div>

	<header
		class="bg-base-300 z-20 mt-9 flex items-center justify-between border-b border-black/10 px-4 pt-2 pb-2"
	>
		<div class="flex items-center">
			<button
				v-if="showBackButton"
				class="btn btn-ghost btn-sm mr-2"
				@click="handleGoBack"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-5 w-5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
					/>
				</svg>
			</button>

			<div
				class="mr-2 flex h-8 w-8 items-center justify-center rounded-full"
				:class="
					getConnectionTypeColor(
						props.project?.type as ConnectionType
					)
				"
			>
				<span class="text-base-100 text-sm font-bold">{{
					props.project?.icon
				}}</span>
			</div>

			<div>
				<h1 class="text-lg font-semibold flex items-center">
					{{ props.title }}
					<span
						v-if="props.project?.type === 'ssh'"
						class="ml-2 badge badge-sm badge-info"
						>Remote</span
					>
				</h1>
				<div class="text-xs">
					{{ getConnectionInfo(props.project) }}
				</div>
			</div>
		</div>

		<div class="flex">
			<slot name="actions"></slot>
		</div>
	</header>
</template>
