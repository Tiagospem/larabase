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
