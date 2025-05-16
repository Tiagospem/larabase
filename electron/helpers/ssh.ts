import { Client, SFTPWrapper, ClientChannel } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as crypto from 'crypto';
import { SshConnection } from '../../src/types/ssh-connection';

// Map to store active SSH connections
const sshConnections = new Map<string, Client>();

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

// Flag to determine if native modules are working
let nativeModulesWorking = true;

// In ESM context, we already have the Client class imported
// We'll just check if we can instantiate it properly
try {
	// Try to instantiate the Client class
	const testClient = new Client();
	// If we get here without error, native modules are working
} catch (error) {
	console.error(
		'SSH native modules not working, using fallback mode:',
		error
	);
	nativeModulesWorking = false;
}

// Get a unique key for a connection
function getConnectionKey(config: SshConnection): string {
	return `${config.username}@${config.host}:${config.port}:${config.remotePath}`;
}

// Generate a unique ID for each tunnel
function generateTunnelId(): string {
	return crypto.randomBytes(16).toString('hex');
}

// Create a new SSH connection
async function createConnection(config: SshConnection): Promise<Client> {
	return new Promise((resolve, reject) => {
		const conn = new Client();

		// Configure SSH connection
		const connectConfig: any = {
			host: config.host,
			port: config.port,
			username: config.username,
			debug: true, // Enable debug logs
			readyTimeout: 10000 // 10 second timeout
		};

		// Use private key or password for authentication
		if (config.privateKey) {
			try {
				console.log(`Reading private key from: ${config.privateKey}`);
				const keyData = fs.readFileSync(config.privateKey, 'utf8');

				// Check if the key starts with BEGIN - typical of PEM format
				if (keyData.includes('BEGIN')) {
					console.log('Key appears to be in PEM format');
					connectConfig.privateKey = keyData;
				} else {
					console.log('Key appears to be in binary format');
					connectConfig.privateKey = fs.readFileSync(
						config.privateKey
					);
				}

				if (config.passphrase) {
					connectConfig.passphrase = config.passphrase;
				}
			} catch (error) {
				console.error('Error reading private key:', error);
				reject(
					new Error(`Failed to read private key: ${error.message}`)
				);
				return;
			}
		} else if (config.password) {
			connectConfig.password = config.password;
		} else {
			reject(new Error('No authentication method provided'));
			return;
		}

		// Set up connection events
		conn.on('ready', () => {
			console.log(`SSH connection established to ${config.host}`);
			// Store connection in the pool
			const key = getConnectionKey(config);
			sshConnections.set(key, conn);
			resolve(conn);
		});

		conn.on('error', (err) => {
			console.error(`SSH connection error to ${config.host}:`, err);
			reject(err);
		});

		// Connect to SSH server
		console.log(
			`Connecting to SSH server ${config.host}:${config.port} as ${config.username}`
		);
		conn.connect(connectConfig);
	});
}

// Get an existing connection or create a new one
async function getConnection(config: SshConnection): Promise<Client> {
	const key = getConnectionKey(config);

	if (sshConnections.has(key)) {
		const conn = sshConnections.get(key)!;

		// Check if connection is still active
		// Using any type assertion as 'state' is not in the type definitions but exists in the actual object
		if ((conn as any).state === 'authenticated') {
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
	// Close all tunnels first
	closeAllTunnels();

	// Then close all SSH connections
	for (const conn of Array.from(sshConnections.values())) {
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
		console.log('Testing SSH connection to:', config.host);

		// Configure SSH connection
		const connectConfig: any = {
			host: config.host,
			port: config.port,
			username: config.username,
			// Enable debug logs for connection issues
			debug: true,
			readyTimeout: 10000,
			// Try all authentication methods
			tryKeyboard: true
		};

		// Use private key or password for authentication
		if (config.privateKey) {
			try {
				console.log(
					'Using private key authentication:',
					config.privateKey
				);
				connectConfig.privateKey = fs.readFileSync(config.privateKey);

				if (config.passphrase) {
					connectConfig.passphrase = config.passphrase;
				}
			} catch (error) {
				return {
					success: false,
					message: `Error reading private key file: ${error.message}`
				};
			}
		} else if (config.password) {
			console.log('Using password authentication');
			connectConfig.password = config.password;
		} else {
			return {
				success: false,
				message:
					'No authentication method provided. Please provide either a password or a private key.'
			};
		}

		client = new Client();

		return new Promise((resolve) => {
			// Handle connection errors
			client.on('error', (err) => {
				console.error('SSH connection error:', err);
				resolve({
					success: false,
					message: `Connection error: ${err.message}`
				});
			});

			// Handle keyboard interactive authentication
			client.on(
				'keyboard-interactive',
				(name, instructions, lang, prompts, finish) => {
					console.log('Keyboard interactive auth requested');
					if (config.password && prompts.length > 0) {
						finish([config.password]);
					} else {
						finish([]);
					}
				}
			);

			// Handle ready event
			client.on('ready', async () => {
				console.log(
					'SSH connection established, testing remote path access'
				);
				try {
					// Verify we can access the remote path
					const testResult = await executeCommand(
						config,
						`cd ${config.remotePath} && ls -la`
					);

					if (testResult.code !== 0) {
						resolve({
							success: false,
							message: `Error accessing remote path: ${testResult.stderr || testResult.stdout}`
						});
						return;
					}

					// Check if it's a Laravel project
					const laravelCheckResult = await executeCommand(
						config,
						`cd ${config.remotePath} && [ -f artisan ] && echo "Laravel" || echo "Not Laravel"`
					);

					if (laravelCheckResult.stdout.trim() !== 'Laravel') {
						resolve({
							success: false,
							message:
								'The remote path does not appear to be a Laravel project (no artisan file found)'
						});
						return;
					}

					resolve({
						success: true,
						message:
							'Successfully connected to remote Laravel project'
					});
				} catch (innerError) {
					resolve({
						success: false,
						message: `Connected to SSH server but failed to verify Laravel project: ${innerError.message}`
					});
				} finally {
					client.end();
				}
			});

			// Handle timeout
			setTimeout(() => {
				if (client) {
					client.end();
					resolve({
						success: false,
						message: 'Connection timed out'
					});
				}
			}, 15000);

			// Connect to SSH server
			console.log('Attempting to connect to SSH server');
			client.connect(connectConfig);
		});
	} catch (error) {
		console.error('SSH test connection error:', error);
		return {
			success: false,
			message:
				error instanceof Error
					? `SSH connection error: ${error.message}`
					: 'Unknown error connecting to SSH server'
		};
	} finally {
		if (client && (client as any).state === 'authenticated') {
			client.end();
		}
	}
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
	// Convert the values iterator to an array before iterating
	for (const tunnel of Array.from(activeTunnels.values())) {
		tunnel.server.close();
	}

	activeTunnels.clear();
}

/**
 * Test an SSH connection
 */
export async function testSshConnection(
	config: SshConnection
): Promise<{ success: boolean; message: string }> {
	return new Promise((resolve) => {
		testConnection(config).then((result) => {
			resolve(result);
		});
	});
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
	testConnection,

	// New tunnel functions
	createTunnel,
	closeTunnel,
	closeAllTunnels
};
