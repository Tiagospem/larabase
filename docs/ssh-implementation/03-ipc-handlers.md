# Step 3: Create IPC Handlers for SSH

In this step, we'll create IPC handlers to allow the renderer process (UI) to interact with the SSH functionality in the main process. These handlers will expose SSH-related operations to the frontend.

## Tasks

- [ ] Create SSH module for IPC handlers
- [ ] Register SSH IPC handlers in the main process
- [ ] Update preload script to expose SSH API
- [ ] Add type definitions for the SSH API

## Implementation Details

### 1. Create SSH IPC Handlers Module

Create a new file `electron/modules/ssh.ts` with the following content:

```typescript
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
```

### 2. Update Main Process to Register SSH Handlers

Update `electron/main/index.ts` to register the SSH handlers:

```typescript
import { registerSshHandlers } from '../modules/ssh';

// Inside createWindow function, after registering other handlers:
registerSshHandlers();
```

### 3. Update Preload Script

Update the preload script at `electron/preload/index.ts` to expose the SSH API:

```typescript
// Add SSH API to contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
	// ... existing API

	ssh: {
		testConnection: (config: any) =>
			ipcRenderer.invoke('ssh:test-connection', config),
		executeCommand: (config: any, command: string) =>
			ipcRenderer.invoke('ssh:execute-command', config, command),
		readFile: (config: any, filePath: string) =>
			ipcRenderer.invoke('ssh:read-file', config, filePath),
		writeFile: (config: any, filePath: string, content: string) =>
			ipcRenderer.invoke('ssh:write-file', config, filePath, content),
		listFiles: (config: any, dirPath: string) =>
			ipcRenderer.invoke('ssh:list-files', config, dirPath),
		getEnv: (config: any) => ipcRenderer.invoke('ssh:get-env', config),
		updateEnv: (config: any, content: string) =>
			ipcRenderer.invoke('ssh:update-env', config, content),
		closeConnection: (config: any) =>
			ipcRenderer.invoke('ssh:close-connection', config)
	}
});
```

### 4. Add Type Definitions for the SSH API

Update the renderer process type definitions in `src/types/electron-api.d.ts` (create if it doesn't exist):

```typescript
import { SshConnection } from './ssh-connection';

interface ElectronAPI {
	// ... existing API types

	ssh: {
		testConnection: (
			config: SshConnection
		) => Promise<{ success: boolean; message: string }>;
		executeCommand: (
			config: SshConnection,
			command: string
		) => Promise<{
			stdout: string;
			stderr: string;
			code: number | null;
		}>;
		readFile: (
			config: SshConnection,
			filePath: string
		) => Promise<{
			success: boolean;
			content?: string;
			error?: string;
		}>;
		writeFile: (
			config: SshConnection,
			filePath: string,
			content: string
		) => Promise<{
			success: boolean;
			error?: string;
		}>;
		listFiles: (
			config: SshConnection,
			dirPath: string
		) => Promise<{
			success: boolean;
			files?: any[];
			error?: string;
		}>;
		getEnv: (config: SshConnection) => Promise<{
			success: boolean;
			content?: string;
			error?: string;
		}>;
		updateEnv: (
			config: SshConnection,
			content: string
		) => Promise<{
			success: boolean;
			error?: string;
		}>;
		closeConnection: (
			config: SshConnection
		) => Promise<{ success: boolean }>;
	};
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
```

## Verification

- Ensure all IPC handlers are correctly registered
- Verify that the preload script exposes the SSH API correctly
- Check that the type definitions are accurate and provide good intellisense
- Confirm there are no TypeScript errors

## Next Steps

After completing these tasks, proceed to [Step 4: Implement SSH Tunneling](./04-ssh-tunneling.md).
