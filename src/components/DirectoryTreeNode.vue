<script setup lang="ts">
import { computed } from 'vue';
import type { DirectoryTreeNode as TreeNode } from '@/types/file-explorer';

interface Props {
	node: TreeNode;
	currentPath: string;
	depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
	depth: 0
});

const emit = defineEmits<{
	select: [path: string];
	expand: [path: string];
	openFile: [path: string, name: string];
}>();

const isSelected = computed(() => props.currentPath === props.node.path);
const isExpanded = computed(() => props.node.expanded);

function handleSelect() {
	if (props.node.type === 'directory') {
		emit('select', props.node.path);
	} else if (props.node.type === 'file') {
		emit('openFile', props.node.path, props.node.name);
	}
}

function handleToggleExpand() {
	if (props.node.type === 'directory') {
		emit('expand', props.node.path);
	}
}
</script>

<template>
	<div class="directory-tree-node">
		<div
			class="node-content flex items-center py-1 px-2 text-xs cursor-pointer hover:bg-base-300 rounded"
			:class="{
				'bg-primary/20 text-primary': isSelected,
				'text-base-content/70': !isSelected
			}"
			:style="{ paddingLeft: `${depth * 12 + 8}px` }"
			@click="handleSelect"
		>
			<button
				v-if="node.type === 'directory'"
				class="mr-1 w-4 h-4 flex items-center justify-center hover:bg-base-300 rounded"
				@click.stop="handleToggleExpand"
			>
				<svg
					v-if="isExpanded"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-3 h-3"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 8.25l-7.5 7.5-7.5-7.5"
					/>
				</svg>
				<svg
					v-else
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-3 h-3"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.25 4.5l7.5 7.5-7.5 7.5"
					/>
				</svg>
			</button>
			<div
				v-else
				class="w-4 mr-1"
			></div>

			<svg
				v-if="node.type === 'directory'"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-3 h-3 mr-2 text-blue-500"
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
				class="w-3 h-3 mr-2 text-gray-400"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>

			<span
				class="truncate flex-1"
				:title="node.name"
				>{{ node.name }}</span
			>
		</div>

		<div v-if="isExpanded && node.children && node.children.length > 0">
			<DirectoryTreeNode
				v-for="child in node.children"
				:key="child.path"
				:node="child"
				:current-path="currentPath"
				:depth="depth + 1"
				@select="$emit('select', $event)"
				@expand="$emit('expand', $event)"
				@open-file="(...args) => $emit('openFile', ...args)"
			/>
		</div>
	</div>
</template>

<style scoped>
.directory-tree-node {
	user-select: none;
}

.node-content {
	transition: background-color 0.15s ease;
}
</style>
