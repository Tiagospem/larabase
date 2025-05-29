import { SshConnection } from '@/types/ssh-connection';

export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	size: number;
	modTime: number;
	permissions: string;
	owner: string;
	group: string;
}

export interface CachedDirectory {
	files: FileEntry[];
	lastUpdated: number;
	ttl: number;
}

class OptimizedSshService {
	private cache = new Map<string, CachedDirectory>();
	private readonly CACHE_TTL = 30000; // 30 seconds
	private readonly MAX_READ_SIZE = 1024 * 1024; // 1MB max for preview

	private getCacheKey(connection: SshConnection, path: string): string {
		return `${connection.host}:${connection.port}:${connection.user}:${path}`;
	}

	private isValidCache(cached: CachedDirectory): boolean {
		return Date.now() - cached.lastUpdated < cached.ttl;
	}

	private sanitizeForIpc(obj: unknown): any {
		if (obj === null || obj === undefined) {
			return null;
		}

		if (typeof obj !== 'object') {
			return obj;
		}

		if (obj instanceof Date) {
			return obj.toISOString();
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.sanitizeForIpc(item));
		}

		const cleanObj: any = {};
		for (const key in obj as Record<string, unknown>) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				const value = (obj as Record<string, unknown>)[key];
				if (
					typeof value !== 'function' &&
					typeof value !== 'symbol' &&
					key !== '__proto__'
				) {
					cleanObj[key] = this.sanitizeForIpc(value);
				}
			}
		}
		return cleanObj;
	}

	async list(connection: SshConnection, path: string): Promise<FileEntry[]> {
		try {
			const result = await window.ipcRenderer.ssh.optimizedList(
				this.sanitizeForIpc(connection),
				path
			);

			if (!result.success) {
				throw new Error(result.error || 'Failed to list directory');
			}

			return result.files || [];
		} catch (error) {
			console.error('Error listing directory:', error);
			throw error;
		}
	}

	async read(
		connection: SshConnection,
		filePath: string,
		length?: number
	): Promise<string> {
		try {
			let command: string;

			if (length && length > 0) {
				command = `head -c ${Math.min(length, this.MAX_READ_SIZE)} "${filePath}"`;
			} else {
				command = `head -c ${this.MAX_READ_SIZE} "${filePath}"`;
			}

			const result = await window.ipcRenderer.ssh.executeCommand(
				this.sanitizeForIpc(connection),
				command
			);

			if (result.code !== 0) {
				throw new Error(
					`Failed to read file: ${result.stderr || result.stdout}`
				);
			}

			return result.stdout;
		} catch (error) {
			console.error('Error reading file:', error);
			throw error;
		}
	}

	async write(
		connection: SshConnection,
		filePath: string,
		content: string
	): Promise<void> {
		try {
			content.replace(/'/g, "'\"'\"'");
			const command = `cat > "${filePath}" << 'EOF'\n${content}\nEOF`;

			const result = await window.ipcRenderer.ssh.executeCommand(
				this.sanitizeForIpc(connection),
				command
			);

			if (result.code !== 0) {
				throw new Error(
					`Failed to write file: ${result.stderr || result.stdout}`
				);
			}

			const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
			this.invalidateCache(connection, parentDir);
		} catch (error) {
			console.error('Error writing file:', error);
			throw error;
		}
	}

	async exists(connection: SshConnection, path: string): Promise<boolean> {
		try {
			const command = `test -e "${path}" && echo "exists" || echo "not_exists"`;
			const result = await window.ipcRenderer.ssh.executeCommand(
				this.sanitizeForIpc(connection),
				command
			);

			return result.stdout.trim() === 'exists';
		} catch (error) {
			console.error('Error checking path existence:', error);
			return false;
		}
	}

	invalidateCache(connection: SshConnection, path: string): void {
		const cacheKey = this.getCacheKey(connection, path);
		this.cache.delete(cacheKey);
	}

	clearCache(): void {
		this.cache.clear();
	}
}

export const optimizedSshService = new OptimizedSshService();
