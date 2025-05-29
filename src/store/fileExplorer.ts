import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { optimizedSshService } from '@/services/optimized-ssh-service';
import type { SshConnection } from '@/types/ssh-connection';

export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	size: number;
	modTime: number;
	permissions: string;
	owner: string;
	group: string;
}

export interface DirectoryTreeNode {
	name: string;
	path: string;
	type: 'directory' | 'file';
	expanded?: boolean;
	children?: DirectoryTreeNode[];
}

export interface DirectoryNode {
	name: string;
	path: string;
	isExpanded: boolean;
	isLoading: boolean;
	children: DirectoryNode[];
	files: FileEntry[];
	isLoaded: boolean;
}

interface FileExplorerState {
	currentPath: string;
	projectRoot: string;
	directoryTree: DirectoryNode[];
	expandedPaths: Set<string>;
	lastConnection: SshConnection | null;
}

export const useFileExplorerStore = defineStore('fileExplorer', () => {
	const state = reactive<FileExplorerState>({
		currentPath: '',
		projectRoot: '',
		directoryTree: [],
		expandedPaths: new Set(),
		lastConnection: null
	});

	const isLoading = ref(false);
	const error = ref('');

	const getCurrentDirectoryFiles = () => {
		const node = findNodeByPath(state.currentPath);
		return node?.files || [];
	};

	const getDirectoryTree = (): DirectoryTreeNode[] => {
		return state.directoryTree.map(convertToTreeNode);
	};

	function convertToTreeNode(node: DirectoryNode): DirectoryTreeNode {
		let displayName = node.name;
		if (node.path === state.projectRoot) {
			displayName = 'root';
		}

		const allChildren: DirectoryTreeNode[] = [
			...node.children.map(convertToTreeNode),
			...node.files
				.filter((file) => file.type === 'file')
				.map((file) => {
					const filePath = node.path.endsWith('/')
						? `${node.path}${file.name}`
						: `${node.path}/${file.name}`;
					return {
						name: file.name,
						path: filePath,
						type: 'file' as const,
						expanded: undefined,
						children: []
					};
				})
		];

		return {
			name: displayName,
			path: node.path,
			type: 'directory',
			expanded: node.isExpanded,
			children: allChildren
		};
	}
	async function initializeForConnection(
		connection: SshConnection,
		rootPath: string
	) {
		state.lastConnection = connection;
		state.projectRoot = rootPath;

		if (!state.currentPath || !state.currentPath.startsWith(rootPath)) {
			state.currentPath = rootPath;
		}

		if (state.directoryTree.length === 0) {
			await initializeRoot();
		}
	}

	function setCurrentPath(path: string) {
		state.currentPath = path;
	}

	function addToExpandedPaths(path: string) {
		state.expandedPaths.add(path);
	}

	function removeFromExpandedPaths(path: string) {
		state.expandedPaths.delete(path);
	}

	function findNodeByPath(path: string): DirectoryNode | null {
		function searchTree(nodes: DirectoryNode[]): DirectoryNode | null {
			for (const node of nodes) {
				if (node.path === path) {
					return node;
				}
				const found = searchTree(node.children);
				if (found) return found;
			}
			return null;
		}
		return searchTree(state.directoryTree);
	}

	async function expandDirectory(path: string): Promise<void> {
		if (!state.lastConnection) return;

		const node = findNodeByPath(path);
		if (!node) return;

		if (node.isLoaded && node.isExpanded) {
			node.isExpanded = false;
			removeFromExpandedPaths(path);
			return;
		}

		node.isLoading = true;

		try {
			const files = await optimizedSshService.list(
				state.lastConnection,
				path
			);

			const directories = files.filter((f) => f.type === 'directory');
			const fileList = files.filter((f) => f.type === 'file');

			node.children = directories.map((dir) => {
				const childPath = path.endsWith('/')
					? `${path}${dir.name}`
					: `${path}/${dir.name}`;
				return {
					name: dir.name,
					path: childPath,
					isExpanded: false,
					isLoading: false,
					children: [],
					files: [],
					isLoaded: false
				};
			});

			node.files = fileList;
			node.isLoaded = true;
			node.isExpanded = true;
			addToExpandedPaths(path);
		} catch (err) {
			error.value =
				(err as Error).message || 'Failed to expand directory';
		} finally {
			node.isLoading = false;
		}
	}

	async function initializeRoot(): Promise<void> {
		if (!state.lastConnection || !state.projectRoot) return;

		if (state.directoryTree.length === 0) {
			const rootNode: DirectoryNode = {
				name: 'root',
				path: state.projectRoot,
				isExpanded: false,
				isLoading: false,
				children: [],
				files: [],
				isLoaded: false
			};

			state.directoryTree = [rootNode];
		}

		await expandDirectory(state.projectRoot);
	}

	function reset() {
		state.currentPath = '';
		state.projectRoot = '';
		state.directoryTree = [];
		state.expandedPaths.clear();
		state.lastConnection = null;
		isLoading.value = false;
		error.value = '';
	}

	return {
		state,
		isLoading,
		error,
		getCurrentDirectoryFiles,
		getDirectoryTree,
		initializeForConnection,
		setCurrentPath,
		expandDirectory,
		reset
	};
});
