import { SshConnection } from '@/types/ssh-connection';

type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

function sanitizeForIpc(obj: unknown): JsonValue {
	if (obj === null) {
		return null;
	}

	if (obj === undefined) {
		return null;
	}

	if (typeof obj !== 'object' && typeof obj !== 'function') {
		return obj as JsonPrimitive;
	}

	if (obj instanceof Date) {
		return obj.toISOString();
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeForIpc(item));
	}

	const cleanObj: JsonObject = {};

	for (const key in obj as Record<string, unknown>) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const value = (obj as Record<string, unknown>)[key];
			if (
				typeof value !== 'function' &&
				typeof value !== 'symbol' &&
				key !== '__proto__'
			) {
				cleanObj[key] = sanitizeForIpc(value);
			}
		}
	}

	return cleanObj;
}

interface RemoteFileEntry {
	filename: string;
	longname: string;
	attrs: {
		size: number;
		mtime: number;
		atime: number;
		uid: number;
		gid: number;
		mode: number;
		[key: string]: number | bigint | boolean | string;
	};
}

export async function listRemoteFiles(
	sshConfig: SshConnection,
	dirPath: string
): Promise<RemoteFileEntry[]> {
	try {
		const sanitizedConfig = sanitizeForIpc(sshConfig);

		const result = await window.ipcRenderer.ssh.listFiles(
			sanitizedConfig,
			dirPath
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to list remote files');
		}

		return result.files as RemoteFileEntry[];
	} catch (error) {
		console.error('Error listing remote files:', error);
		throw error;
	}
}

export async function readRemoteFile(
	sshConfig: SshConnection,
	filePath: string
): Promise<string> {
	try {
		const sanitizedConfig = sanitizeForIpc(sshConfig);

		const result = await window.ipcRenderer.ssh.readFile(
			sanitizedConfig,
			filePath
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to read remote file');
		}

		return result.content;
	} catch (error) {
		console.error('Error reading remote file:', error);
		throw error;
	}
}

export async function writeRemoteFile(
	sshConfig: SshConnection,
	filePath: string,
	content: string
): Promise<void> {
	try {
		const sanitizedConfig = sanitizeForIpc(sshConfig);

		const result = await window.ipcRenderer.ssh.writeFile(
			sanitizedConfig,
			filePath,
			content
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to write remote file');
		}
	} catch (error) {
		console.error('Error writing remote file:', error);
		throw error;
	}
}

export async function getRemoteEnvVariables(
	sshConfig: SshConnection
): Promise<string> {
	try {
		const remotePath = sshConfig.remotePath?.endsWith('/')
			? sshConfig.remotePath.slice(0, -1)
			: sshConfig.remotePath || '';

		const envPath = `${remotePath}/.env`;
		return await readRemoteFile(sshConfig, envPath);
	} catch (error) {
		console.error('Error getting remote env variables:', error);
		throw error;
	}
}

export async function updateRemoteEnvVariables(
	sshConfig: SshConnection,
	content: string
): Promise<void> {
	try {
		const remotePath = sshConfig.remotePath?.endsWith('/')
			? sshConfig.remotePath.slice(0, -1)
			: sshConfig.remotePath || '';

		const envPath = `${remotePath}/.env`;
		await writeRemoteFile(sshConfig, envPath, content);
	} catch (error) {
		console.error('Error updating remote env variables:', error);
		throw error;
	}
}

export async function findRemoteLogFiles(
	sshConnection: SshConnection,
	basePath: string
): Promise<string[]> {
	try {
		const sanitizedConfig = sanitizeForIpc(sshConnection);

		const command = `find ${basePath} -name "*.log" -type f -not -path "*/vendor/*" 2>/dev/null || echo "No log files found"`;
		const result = await window.ipcRenderer.ssh.executeCommand(
			sanitizedConfig,
			command
		);

		if (result.stderr) {
			console.error('Error finding logs:', result.stderr);
		}

		if (result.stdout.trim() === 'No log files found') {
			return [];
		}
		return result.stdout
			.split('\n')
			.filter((line: string) => line.trim() !== '')
			.map((line: string) => line.trim());
	} catch (error) {
		console.error('Error finding remote log files:', error);
		throw error;
	}
}
