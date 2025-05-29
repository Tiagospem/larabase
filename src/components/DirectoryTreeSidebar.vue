<script setup lang="ts">
import DirectoryTreeNode from './DirectoryTreeNode.vue';
import { useFileExplorerStore } from '@/store/fileExplorer';

const fileExplorerStore = useFileExplorerStore();

const emit = defineEmits<{
	navigate: [path: string];
	openFile: [path: string, name: string];
}>();

async function handleNodeSelect(path: string) {
	fileExplorerStore.setCurrentPath(path);
	emit('navigate', path);
}

async function handleNodeExpand(path: string) {
	await fileExplorerStore.expandDirectory(path);
}

function handleOpenFile(path: string, name: string) {
	emit('openFile', path, name);
}
</script>

<template>
	<div
		class="directory-tree-sidebar bg-base-200 border-r border-base-300 h-full overflow-hidden flex flex-col max-h-[500px] rounded-b-lg"
	>
		<div class="p-3 border-b border-base-300">
			<div class="flex items-center text-sm font-medium">
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
						d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
					/>
				</svg>
				Directory Tree
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-2">
			<div
				v-if="fileExplorerStore.isLoading"
				class="flex items-center justify-center py-4"
			>
				<span class="loading loading-spinner loading-sm"></span>
				<span class="ml-2 text-xs">Loading...</span>
			</div>

			<div
				v-else-if="fileExplorerStore.error"
				class="text-error text-xs p-2"
			>
				{{ fileExplorerStore.error }}
			</div>

			<div v-else>
				<DirectoryTreeNode
					v-for="node in fileExplorerStore.getDirectoryTree()"
					:key="node.path"
					:node="node"
					:current-path="fileExplorerStore.state.currentPath"
					@select="handleNodeSelect"
					@expand="handleNodeExpand"
					@open-file="handleOpenFile"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.directory-tree-sidebar {
	min-width: 250px;
	max-width: 400px;
	width: 300px;
}
</style>
