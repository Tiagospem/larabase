# Step 2: Set Up SSH Helper Module

In this step, we'll create a helper module to manage SSH connections. This will handle establishing SSH connections, executing commands, and transferring files via SFTP.

## Tasks

- [ ] Install SSH2 client library
- [ ] Create SSH connection helper module
- [ ] Implement connection management functions
- [ ] Implement remote command execution
- [ ] Implement SFTP file operations

## Implementation Details

### 1. Install SSH2 Client Library

First, install the required SSH client library:

```bash
npm install ssh2
npm install @types/ssh2 --save-dev
```

### 2. Create SSH Helper Module

Create a new file `electron/helpers/ssh.ts` with the following content:

```typescript
import { Client, SFTPWrapper, ClientChannel } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import { SshConnection } from '../../src/types/ssh-connection';

// Map to store active SSH connections
const sshConnections = new Map<string, Client>();

// Get a unique key for a connection
function getConnectionKey(config: SshConnection): string {
	return `${config.username}@${config.host}:${config.port}:${config.remotePath}`;
}

// Create a new SSH connection
async function createConnection(config: SshConnection): Promise<Client> {
	return new Promise((resolve, reject) => {
		const conn = new Client();

		// Configure SSH connection
		const connectConfig: any = {
			host: config.host,
			port: config.port,
			username: config.username
		};

		// Use private key or password for authentication
		if (config.privateKey) {
			connectConfig.privateKey = fs.readFileSync(config.privateKey);
			if (config.passphrase) {
				connectConfig.passphrase = config.passphrase;
			}
		} else if (config.password) {
			connectConfig.password = config.password;
		}

		// Set up connection events
		conn.on('ready', () => {
			// Store connection in the pool
			const key = getConnectionKey(config);
			sshConnections.set(key, conn);
			resolve(conn);
		});

		conn.on('error', (err) => {
			reject(err);
		});

		// Connect to SSH server
		conn.connect(connectConfig);
	});
}

// Get an existing connection or create a new one
async function getConnection(config: SshConnection): Promise<Client> {
	const key = getConnectionKey(config);

	if (sshConnections.has(key)) {
		const conn = sshConnections.get(key)!;

		// Check if connection is still active
		if (conn.state === 'authenticated') {
			return conn;
		} else {
			// Close the stale connection
			sshConnections.delete(key);
			try {
				conn.end();
			} catch (e) {
				/* ignore */
			}
		}
	}

	// Create a new connection
	return await createConnection(config);
}

// Get an SFTP session
async function getSftpSession(client: Client): Promise<SFTPWrapper> {
	return new Promise((resolve, reject) => {
		client.sftp((err, sftp) => {
			if (err) reject(err);
			else resolve(sftp);
		});
	});
}

// Execute a command on the remote server
async function executeCommand(
	config: SshConnection,
	command: string
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	const client = await getConnection(config);

	return new Promise((resolve, reject) => {
		client.exec(command, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}

			let stdout = '';
			let stderr = '';

			stream.on('data', (data) => {
				stdout += data.toString();
			});

			stream.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			stream.on('close', (code) => {
				resolve({ stdout, stderr, code });
			});

			stream.on('error', (err) => {
				reject(err);
			});
		});
	});
}

// Read a file from the remote server
async function readRemoteFile(
	config: SshConnection,
	filePath: string
): Promise<Buffer> {
	const client = await getConnection(config);
	const sftp = await getSftpSession(client);

	return new Promise((resolve, reject) => {
		sftp.readFile(filePath, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

// Write a file to the remote server
async function writeRemoteFile(
	config: SshConnection,
	filePath: string,
	data: Buffer | string
): Promise<void> {
	const client = await getConnection(config);
	const sftp = await getSftpSession(client);

	return new Promise((resolve, reject) => {
		sftp.writeFile(filePath, data, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

// List files in a remote directory
async function listRemoteFiles(
	config: SshConnection,
	dirPath: string
): Promise<any[]> {
	const client = await getConnection(config);
	const sftp = await getSftpSession(client);

	return new Promise((resolve, reject) => {
		sftp.readdir(dirPath, (err, list) => {
			if (err) reject(err);
			else resolve(list);
		});
	});
}

// Close an SSH connection
function closeConnection(config: SshConnection): void {
	const key = getConnectionKey(config);

	if (sshConnections.has(key)) {
		const conn = sshConnections.get(key)!;
		conn.end();
		sshConnections.delete(key);
	}
}

// Close all SSH connections
function closeAllConnections(): void {
	for (const conn of sshConnections.values()) {
		try {
			conn.end();
		} catch (e) {
			/* ignore */
		}
	}
	sshConnections.clear();
}

// Test SSH connection
async function testConnection(
	config: SshConnection
): Promise<{ success: boolean; message: string }> {
	let client: Client | null = null;

	try {
		client = await createConnection(config);

		// Verify we can access the remote path
		const testResult = await executeCommand(
			config,
			`cd ${config.remotePath} && ls -la`
		);

		if (testResult.code !== 0) {
			return {
				success: false,
				message: `Error accessing remote path: ${testResult.stderr}`
			};
		}

		// Check if it's a Laravel project
		const laravelCheckResult = await executeCommand(
			config,
			`cd ${config.remotePath} && [ -f artisan ] && echo "Laravel" || echo "Not Laravel"`
		);

		if (laravelCheckResult.stdout.trim() !== 'Laravel') {
			return {
				success: false,
				message:
					'The remote path does not appear to be a Laravel project (no artisan file found)'
			};
		}

		return {
			success: true,
			message: 'Successfully connected to remote Laravel project'
		};
	} catch (error) {
		return {
			success: false,
			message:
				error instanceof Error
					? error.message
					: 'Unknown error connecting to SSH server'
		};
	} finally {
		if (client) {
			closeConnection(config);
		}
	}
}

export {
	createConnection,
	getConnection,
	getSftpSession,
	executeCommand,
	readRemoteFile,
	writeRemoteFile,
	listRemoteFiles,
	closeConnection,
	closeAllConnections,
	testConnection
};
```

### 3. Update Electron's Main Process Cleanup

In `electron/main/index.ts`, update the cleanup function to close SSH connections:

```typescript
// Import SSH helper
import { closeAllConnections } from '../helpers/ssh';

// In app.on('window-all-closed') handler:
app.on('window-all-closed', () => {
	win = null;

	cleanup();

	// Close all database connection pools
	closeAllPools()
		.catch((err) => {
			console.error('Error closing database pools:', err);
		})
		.finally(() => {
			// Close all SSH connections
			closeAllConnections();

			if (process.platform === 'darwin') app.quit();
		});
});
```

## Verification

- Ensure SSH2 client library is installed correctly
- Verify the helper module compiles without errors
- Check that the connection management functions work as expected
- Verify that command execution and file operations are properly implemented

## Next Steps

After completing these tasks, proceed to [Step 3: Create IPC Handlers for SSH](./03-ipc-handlers.md).
