# Step 4: Implement SSH Tunneling

In this step, we'll implement SSH tunneling to allow the application to connect to database servers on the remote machine. This is essential for accessing remote database servers through the SSH connection.

## Tasks

- [ ] Extend SSH helper module with tunneling functions
- [ ] Create tunnel management system
- [ ] Add IPC handlers for tunnel operations
- [ ] Implement database connection through SSH tunnels

## Implementation Details

### 1. Extend SSH Helper Module

Update the `electron/helpers/ssh.ts` file to add tunneling functionality:

```typescript
import { Client, SFTPWrapper, ClientChannel, ForwardedTcpip } from 'ssh2';
import * as net from 'net';
import * as crypto from 'crypto';

// Add to existing imports and code

// Map to keep track of active tunnels
const activeTunnels = new Map<
	string,
	{
		server: net.Server;
		localPort: number;
		remoteHost: string;
		remotePort: number;
		sshClient: Client;
	}
>();

// Generate a unique ID for each tunnel
function generateTunnelId(): string {
	return crypto.randomBytes(16).toString('hex');
}

// Create an SSH tunnel
async function createTunnel(
	config: SshConnection,
	remoteHost: string,
	remotePort: number,
	localPort: number = 0 // 0 means use a random available port
): Promise<{ tunnelId: string; localPort: number }> {
	const sshClient = await getConnection(config);

	return new Promise((resolve, reject) => {
		// Create a local server
		const server = net.createServer((socket) => {
			// When a connection is made to the local server
			sshClient.forwardOut(
				'127.0.0.1', // srcIP
				socket.localPort || 0, // srcPort
				remoteHost, // dstIP
				remotePort, // dstPort
				(err, stream) => {
					if (err) {
						socket.end();
						console.error('SSH tunnel error:', err);
						return;
					}

					// Pipe the SSH stream to the local socket and vice versa
					socket.pipe(stream);
					stream.pipe(socket);

					stream.on('close', () => {
						socket.end();
					});

					socket.on('close', () => {
						stream.end();
					});
				}
			);
		});

		// Handle server errors
		server.on('error', (err) => {
			reject(err);
		});

		// Listen on the specified local port or a random available port
		server.listen(localPort, '127.0.0.1', () => {
			const serverAddress = server.address() as net.AddressInfo;
			const tunnelId = generateTunnelId();

			// Store the tunnel information
			activeTunnels.set(tunnelId, {
				server,
				localPort: serverAddress.port,
				remoteHost,
				remotePort,
				sshClient
			});

			// Resolve with the tunnel ID and local port
			resolve({
				tunnelId,
				localPort: serverAddress.port
			});
		});
	});
}

// Close an SSH tunnel
function closeTunnel(tunnelId: string): boolean {
	if (activeTunnels.has(tunnelId)) {
		const tunnel = activeTunnels.get(tunnelId)!;

		// Close the local server
		tunnel.server.close();
		activeTunnels.delete(tunnelId);

		return true;
	}

	return false;
}

// Close all SSH tunnels
function closeAllTunnels(): void {
	for (const tunnel of activeTunnels.values()) {
		tunnel.server.close();
	}

	activeTunnels.clear();
}

// Update the cleanup function
function closeAllConnections(): void {
	// Close all tunnels first
	closeAllTunnels();

	// Then close all SSH connections
	for (const conn of sshConnections.values()) {
		try {
			conn.end();
		} catch (e) {
			/* ignore */
		}
	}

	sshConnections.clear();
}

// Export the new functions
export {
	// Existing exports
	createConnection,
	getConnection,
	getSftpSession,
	executeCommand,
	readRemoteFile,
	writeRemoteFile,
	listRemoteFiles,
	closeConnection,
	closeAllConnections,
	testConnection,

	// New tunnel functions
	createTunnel,
	closeTunnel,
	closeAllTunnels
};
```

### 2. Add IPC Handlers for Tunnel Operations

Update the `electron/modules/ssh.ts` file to add handlers for tunnel operations:

```typescript
import {
	// Existing imports
	testConnection,
	createConnection,
	closeConnection,
	executeCommand,
	readRemoteFile,
	writeRemoteFile,
	listRemoteFiles,

	// New tunnel functions
	createTunnel,
	closeTunnel
} from '../helpers/ssh';

// Inside the registerSshHandlers function, add these handlers:

// Create an SSH tunnel
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

// Close an SSH tunnel
ipcMain.handle('ssh:close-tunnel', (_, tunnelId: string) => {
	const success = closeTunnel(tunnelId);
	return { success };
});
```

### 3. Update Preload Script

Update the preload script at `electron/preload/index.ts` to expose the tunnel API:

```typescript
// Inside the ssh object in contextBridge.exposeInMainWorld
ssh: {
    // Existing functions
    testConnection: (config: any) => ipcRenderer.invoke('ssh:test-connection', config),
    executeCommand: (config: any, command: string) => ipcRenderer.invoke('ssh:execute-command', config, command),
    // ... other existing functions

    // New tunnel functions
    createTunnel: (config: any, remoteHost: string, remotePort: number, localPort?: number) =>
        ipcRenderer.invoke('ssh:create-tunnel', config, remoteHost, remotePort, localPort),
    closeTunnel: (tunnelId: string) => ipcRenderer.invoke('ssh:close-tunnel', tunnelId)
}
```

### 4. Update Type Definitions

Update the type definitions in `src/types/electron-api.d.ts`:

```typescript
// Inside the ssh object in the ElectronAPI interface
ssh: {
	// Existing function types
	testConnection: (config: SshConnection) =>
		Promise<{ success: boolean; message: string }>;
	// ... other existing function types

	// New tunnel function types
	createTunnel: (
		config: SshConnection,
		remoteHost: string,
		remotePort: number,
		localPort?: number
	) =>
		Promise<{
			success: boolean;
			tunnelId?: string;
			localPort?: number;
			error?: string;
		}>;
	closeTunnel: (tunnelId: string) => Promise<{ success: boolean }>;
}
```

### 5. Create a Tunnel Service

Create a new file `src/services/tunnel-service.ts` to manage SSH tunnels:

```typescript
import { SshConnection } from '../types/ssh-connection';

// Store active tunnels
const activeTunnels = new Map<
	string,
	{
		tunnelId: string;
		localPort: number;
		remoteHost: string;
		remotePort: number;
		connectionId: string;
	}
>();

/**
 * Create an SSH tunnel to a remote database server
 */
export async function createDatabaseTunnel(
	connectionId: string,
	sshConfig: SshConnection,
	remoteHost: string,
	remotePort: number
): Promise<{ tunnelId: string; localPort: number }> {
	// Check if a tunnel already exists for this connection
	for (const tunnel of activeTunnels.values()) {
		if (
			tunnel.connectionId === connectionId &&
			tunnel.remoteHost === remoteHost &&
			tunnel.remotePort === remotePort
		) {
			return {
				tunnelId: tunnel.tunnelId,
				localPort: tunnel.localPort
			};
		}
	}

	// Create a new tunnel
	const result = await window.electronAPI.ssh.createTunnel(
		sshConfig,
		remoteHost,
		remotePort
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create SSH tunnel');
	}

	// Store the tunnel information
	const tunnelKey = `${connectionId}:${remoteHost}:${remotePort}`;
	activeTunnels.set(tunnelKey, {
		tunnelId: result.tunnelId!,
		localPort: result.localPort!,
		remoteHost,
		remotePort,
		connectionId
	});

	return {
		tunnelId: result.tunnelId!,
		localPort: result.localPort!
	};
}

/**
 * Close an SSH tunnel
 */
export async function closeDatabaseTunnel(
	connectionId: string,
	remoteHost: string,
	remotePort: number
): Promise<boolean> {
	const tunnelKey = `${connectionId}:${remoteHost}:${remotePort}`;

	if (activeTunnels.has(tunnelKey)) {
		const tunnel = activeTunnels.get(tunnelKey)!;
		const result = await window.electronAPI.ssh.closeTunnel(
			tunnel.tunnelId
		);

		if (result.success) {
			activeTunnels.delete(tunnelKey);
		}

		return result.success;
	}

	return false;
}

/**
 * Close all SSH tunnels for a specific connection
 */
export async function closeAllConnectionTunnels(
	connectionId: string
): Promise<void> {
	// Find all tunnels for this connection
	for (const [key, tunnel] of activeTunnels.entries()) {
		if (tunnel.connectionId === connectionId) {
			await window.electronAPI.ssh.closeTunnel(tunnel.tunnelId);
			activeTunnels.delete(key);
		}
	}
}

/**
 * Close all active SSH tunnels
 */
export async function closeAllTunnels(): Promise<void> {
	for (const tunnel of activeTunnels.values()) {
		await window.electronAPI.ssh.closeTunnel(tunnel.tunnelId);
	}

	activeTunnels.clear();
}
```

## Verification

- Ensure the SSH tunneling functions work correctly
- Test creating tunnels to remote database servers
- Verify that tunnels are properly cleaned up when no longer needed
- Confirm that connections through tunnels work as expected

## Next Steps

After completing these tasks, proceed to [Step 5: Update UI Components for SSH](./05-ui-components.md).
