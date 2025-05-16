import { ipcMain } from 'electron';
import * as path from 'path';
import {
	testConnection,
	createConnection,
	closeConnection,
	executeCommand,
	readRemoteFile,
	writeRemoteFile,
	listRemoteFiles
} from '../helpers/ssh';
import { SshConnection } from '../../src/types/ssh-connection';

function registerSshHandlers() {
	// Test SSH connection
	ipcMain.handle('ssh:test-connection', async (_, config: SshConnection) => {
		return await testConnection(config);
	});

	// Execute a command on the remote server
	ipcMain.handle(
		'ssh:execute-command',
		async (_, config: SshConnection, command: string) => {
			return await executeCommand(config, command);
		}
	);

	// Read a file from the remote server
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

	// Write a file to the remote server
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

	// List files in a directory on the remote server
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

	// Get Laravel environment variables
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

	// Update Laravel environment variables
	ipcMain.handle(
		'ssh:update-env',
		async (_, config: SshConnection, content: string) => {
			try {
				const envPath = path.join(config.remotePath, '.env');
				await writeRemoteFile(config, envPath, content);

				return { success: true };
			} catch (error) {
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error updating .env file'
				};
			}
		}
	);

	// Close SSH connection
	ipcMain.handle('ssh:close-connection', (_, config: SshConnection) => {
		closeConnection(config);
		return { success: true };
	});
}

export { registerSshHandlers };
