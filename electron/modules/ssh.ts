import { ipcMain } from 'electron';
import * as path from 'path';
import {
	testConnection,
	closeConnection,
	readRemoteFile,
	writeRemoteFile,
	listRemoteFiles,
	createTunnel,
	closeTunnel
} from '../helpers/ssh';
import { optimizedSshManager } from '../helpers/optimized-ssh';
import { SshConnection } from '../../src/types/ssh-connection';

function registerSshHandlers() {
	ipcMain.handle('ssh:test-connection', async (_, config: SshConnection) => {
		return await testConnection(config);
	});

	ipcMain.handle(
		'ssh:execute-command',
		async (_, config: SshConnection, command: string) => {
			try {
				return await optimizedSshManager.executeCommand(
					config,
					command
				);
			} catch (error) {
				return {
					stdout: '',
					stderr:
						error instanceof Error
							? error.message
							: 'Unknown error',
					code: 1
				};
			}
		}
	);

	ipcMain.handle(
		'ssh:read-file',
		async (_, config: SshConnection, filePath: string) => {
			try {
				const content = await readRemoteFile(config, filePath);
				return { success: true, content: content.toString('utf-8') };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error reading file'
				};
			}
		}
	);

	ipcMain.handle(
		'ssh:write-file',
		async (_, config: SshConnection, filePath: string, content: string) => {
			try {
				await writeRemoteFile(config, filePath, content);
				return { success: true };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error writing file'
				};
			}
		}
	);

	ipcMain.handle(
		'ssh:list-files',
		async (_, config: SshConnection, dirPath: string) => {
			try {
				const files = await listRemoteFiles(config, dirPath);
				return { success: true, files };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error listing files'
				};
			}
		}
	);

	ipcMain.handle('ssh:get-env', async (_, config: SshConnection) => {
		try {
			const envPath = path.join(config.remotePath, '.env');
			const content = await readRemoteFile(config, envPath);

			return { success: true, content: content.toString('utf-8') };
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Unknown error reading .env file'
			};
		}
	});

	ipcMain.handle('ssh:close-connection', (_, config: SshConnection) => {
		closeConnection(config);
		return { success: true };
	});

	ipcMain.handle(
		'ssh:create-tunnel',
		async (
			_,
			config: SshConnection,
			remoteHost: string,
			remotePort: number,
			localPort?: number
		) => {
			try {
				const result = await createTunnel(
					config,
					remoteHost,
					remotePort,
					localPort
				);
				return {
					success: true,
					tunnelId: result.tunnelId,
					localPort: result.localPort
				};
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error creating tunnel'
				};
			}
		}
	);

	ipcMain.handle('ssh:close-tunnel', (_, tunnelId: string) => {
		const success = closeTunnel(tunnelId);
		return { success };
	});

	ipcMain.handle(
		'ssh:optimized-list',
		async (_, config: SshConnection, dirPath: string) => {
			try {
				const command = `cd '${dirPath}' && ls -1F`;

				const result = await optimizedSshManager.executeCommand(
					config,
					command
				);

				if (result.code !== 0) {
					throw new Error(
						result.stderr || 'Failed to list directory'
					);
				}

				const files = parseLsOutput(result.stdout);

				return { success: true, files };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error ? error.message : 'Unknown error'
				};
			}
		}
	);

	ipcMain.handle(
		'ssh:optimized-read',
		async (_, config: SshConnection, filePath: string, length?: number) => {
			try {
				const maxSize = 1024 * 1024; // 1MB limit
				const readSize = length ? Math.min(length, maxSize) : maxSize;
				const command = `head -c ${readSize} "${filePath}"`;

				const result = await optimizedSshManager.executeCommand(
					config,
					command
				);

				if (result.code !== 0) {
					throw new Error(result.stderr || 'Failed to read file');
				}

				return { success: true, content: result.stdout };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error ? error.message : 'Unknown error'
				};
			}
		}
	);

	ipcMain.handle(
		'ssh:optimized-write',
		async (_, config: SshConnection, filePath: string, content: string) => {
			try {
				const command = `cat > "${filePath}" << 'EOF'\n${content}\nEOF`;

				const result = await optimizedSshManager.executeCommand(
					config,
					command
				);

				if (result.code !== 0) {
					throw new Error(result.stderr || 'Failed to write file');
				}

				return { success: true };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error ? error.message : 'Unknown error'
				};
			}
		}
	);
}

function parseLsOutput(output: string): any[] {
	const lines = output.split('\n').filter((line) => line.trim());
	const files: any[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine === '.' || trimmedLine === '..')
			continue;

		let name = trimmedLine;
		let type = 'file';

		if (name.endsWith('/')) {
			name = name.slice(0, -1);
			type = 'directory';
		} else if (name.endsWith('*')) {
			name = name.slice(0, -1);
			type = 'file';
		} else if (name.endsWith('@')) {
			name = name.slice(0, -1);
			type = 'file';
		}

		if (!name || name === '.' || name === '..') continue;

		files.push({
			name,
			type,
			size: 0,
			modTime: Date.now(),
			permissions: type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--',
			owner: 'user',
			group: 'group'
		});
	}

	return files;
}

export { registerSshHandlers };
