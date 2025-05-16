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
	for (const tunnel of Array.from(activeTunnels.values())) {
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
	const result = await window.ipcRenderer.ssh.createTunnel(
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
		const result = await window.ipcRenderer.ssh.closeTunnel(
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
			await window.ipcRenderer.ssh.closeTunnel(tunnel.tunnelId);
			activeTunnels.delete(key);
		}
	}
}

/**
 * Close all active SSH tunnels
 */
export async function closeAllTunnels(): Promise<void> {
	for (const tunnel of Array.from(activeTunnels.values())) {
		await window.ipcRenderer.ssh.closeTunnel(tunnel.tunnelId);
	}

	activeTunnels.clear();
}
