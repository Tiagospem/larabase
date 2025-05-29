import { Client, SFTPWrapper, ConnectConfig } from 'ssh2';
import * as fs from 'fs';
import * as net from 'net';
import * as crypto from 'crypto';
import { SshConnection } from '../../src/types/ssh-connection';

interface SshError extends Error {
	code?: string;
}
interface FileExplorerItem {
	name: string;
	type: 'file' | 'directory';
	size: number;
	modTime: number;
	path: string;
}

const sshConnections = new Map<string, Client>();

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

function getConnectionKey(config: SshConnection): string {
	return `${config.user}@${config.host}:${config.port}:${config.remotePath}`;
}

function generateTunnelId(): string {
	return crypto.randomBytes(16).toString('hex');
}

async function createConnection(config: SshConnection): Promise<Client> {
	return new Promise((resolve, reject) => {
		const conn = new Client();

		const connectConfig: ConnectConfig = {
			host: config.host,
			port: config.port,
			username: config.user, // ssh2 uses username, not user
			//debug: (message: string) => console.log(`SSH Debug: ${message}`),
			readyTimeout: 10000
		};

		if (config.privateKey) {
			try {
				console.log(`Reading private key from: ${config.privateKey}`);
				const keyData = fs.readFileSync(config.privateKey, 'utf8');

				if (keyData.includes('BEGIN')) {
					connectConfig.privateKey = keyData;
				} else {
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
					new Error(
						`Failed to read private key: ${
							error instanceof Error
								? error.message
								: String(error)
						}`
					)
				);
				return;
			}
		} else if (config.password) {
			connectConfig.password = config.password;
		} else {
			reject(new Error('No authentication method provided'));
			return;
		}

		conn.on('ready', () => {
			console.log(`SSH connection established to ${config.host}`);
			resolve(conn);
		});

		conn.on('error', (err) => {
			console.error(`SSH connection error to ${config.host}:`, err);
			reject(err);
		});

		console.log(
			`Connecting to SSH server ${config.host}:${config.port} as ${config.user}`
		);
		conn.connect(connectConfig);
	});
}

async function getConnection(config: SshConnection): Promise<Client> {
	return createConnection(config);
}

async function getSftpSession(client: Client): Promise<SFTPWrapper> {
	return new Promise((resolve, reject) => {
		client.sftp((err, sftp) => {
			if (err) reject(err);
			else resolve(sftp);
		});
	});
}

async function executeCommand(
	config: SshConnection,
	command: string
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	const client = await createConnection(config);

	return new Promise((resolve, reject) => {
		client.exec(command, (err, stream) => {
			if (err) {
				client.end();
				reject(err);
				return;
			}

			let stdout = '';
			let stderr = '';

			stream.on('data', (data: Buffer) => {
				stdout += data.toString();
			});

			stream.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			stream.on('close', (code: number | null) => {
				client.end();
				resolve({ stdout, stderr, code });
			});

			stream.on('error', (err: Error) => {
				client.end();
				reject(err);
			});
		});
	});
}

async function readRemoteFile(
	config: SshConnection,
	filePath: string
): Promise<Buffer> {
	const client = await createConnection(config);

	try {
		const sftp = await getSftpSession(client);

		return new Promise((resolve, reject) => {
			sftp.readFile(filePath, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}

				client.end();
			});
		});
	} catch (error) {
		client.end();
		throw error;
	}
}

async function writeRemoteFile(
	config: SshConnection,
	filePath: string,
	data: Buffer | string
): Promise<void> {
	const client = await createConnection(config);

	try {
		const sftp = await getSftpSession(client);

		return new Promise((resolve, reject) => {
			sftp.writeFile(filePath, data, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}

				client.end();
			});
		});
	} catch (error) {
		client.end();
		throw error;
	}
}

async function listRemoteFiles(
	config: SshConnection,
	dirPath: string
): Promise<FileExplorerItem[]> {
	const client = await createConnection(config);

	if (!dirPath.startsWith(config.remotePath)) {
		dirPath = config.remotePath;
	}

	try {
		console.log('SSH connection established, getting SFTP session');
		const sftp = await getSftpSession(client);
		console.log('SFTP session created, attempting to read directory');

		return new Promise((resolve, reject) => {
			sftp.readdir(dirPath, (err, list) => {
				const closeAndReturn = (value: any, isError = false) => {
					try {
						client.end();
						console.log(
							`SSH connection closed after listing files in ${dirPath}`
						);
					} catch (e) {
						console.error('Error closing SSH connection:', e);
					}

					if (isError) {
						reject(value);
					} else {
						resolve(value);
					}
				};

				if (err) {
					console.error(`Error listing files in ${dirPath}:`, err);

					const sshErr = err as SshError;
					if (sshErr.code === 'ENOENT') {
						closeAndReturn(
							new Error(`Directory does not exist: ${dirPath}`),
							true
						);
					} else if (sshErr.code === 'EACCES') {
						closeAndReturn(
							new Error(
								`Permission denied for directory: ${dirPath}`
							),
							true
						);
					} else {
						closeAndReturn(
							new Error(`Failed to list files: ${err.message}`),
							true
						);
					}
				} else {
					console.log(`Listed ${list.length} files in ${dirPath}`);

					const fileExplorerItems = list
						.filter(
							(item) =>
								item.filename !== '.' && item.filename !== '..'
						)
						.map((item) => {
							const isDirectory =
								(item.attrs.mode & 0o40000) !== 0;
							return {
								name: item.filename,
								type: isDirectory ? 'directory' : 'file',
								size: item.attrs.size,
								modTime: item.attrs.mtime * 1000, // Convert to JavaScript timestamp
								path: `${dirPath}/${item.filename}`
							} as FileExplorerItem;
						});

					closeAndReturn(fileExplorerItems);
				}
			});
		});
	} catch (error) {
		console.error('SSH connection error in listRemoteFiles:', error);
		client.end();
		throw error;
	}
}

function closeConnection(config: SshConnection): void {
	const key = getConnectionKey(config);

	if (sshConnections.has(key)) {
		const conn = sshConnections.get(key)!;
		conn.end();
		sshConnections.delete(key);
	}
}

function closeAllConnections(): void {
	closeAllTunnels();

	for (const conn of Array.from(sshConnections.values())) {
		try {
			conn.end();
		} catch (e: unknown) {
			console.error(
				`Failed to close SSH connection: ${
					e instanceof Error ? e.message : String(e)
				}`
			);
		}
	}

	sshConnections.clear();
}

async function testConnection(
	config: SshConnection
): Promise<{ success: boolean; message: string }> {
	let client: Client | null = null;

	try {
		console.log('Testing SSH connection to:', config.host);

		const connectConfig: ConnectConfig = {
			host: config.host,
			port: config.port,
			username: config.user, // ssh2 uses username, not user
			debug: (message: string) => console.log(`SSH Debug: ${message}`),
			readyTimeout: 10000,
			tryKeyboard: true
		};

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
					message: `Error reading private key file: ${
						error instanceof Error ? error.message : String(error)
					}`
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
			client.on('error', (err) => {
				console.error('SSH connection error:', err);
				resolve({
					success: false,
					message: `Connection error: ${err.message}`
				});
			});

			client.on(
				'keyboard-interactive',
				(_name, _instructions, _lang, prompts, finish) => {
					console.log('Keyboard interactive auth requested');
					if (config.password && prompts.length > 0) {
						finish([config.password]);
					} else {
						finish([]);
					}
				}
			);

			client.on('ready', async () => {
				console.log(
					'SSH connection established, testing remote path access'
				);
				try {
					const testResult = await executeCommand(
						config,
						`cd ${config.remotePath} && ls -la`
					);

					if (testResult.code !== 0) {
						resolve({
							success: false,
							message: `Error accessing remote path: ${
								testResult.stderr || testResult.stdout
							}`
						});
						return;
					}

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
						message: `Connected to SSH server but failed to verify Laravel project: ${
							innerError instanceof Error
								? innerError.message
								: String(innerError)
						}`
					});
				} finally {
					client.end();
				}
			});

			setTimeout(() => {
				if (client) {
					client.end();
					resolve({
						success: false,
						message: 'Connection timed out'
					});
				}
			}, 15000);

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
		if (client) {
			const clientState = (client as unknown as { _state?: string })
				._state;
			if (clientState === 'authenticated') {
				client.end();
			}
		}
	}
}

async function createTunnel(
	config: SshConnection,
	remoteHost: string,
	remotePort: number,
	localPort: number = 0
): Promise<{ tunnelId: string; localPort: number }> {
	const sshClient = await createConnection(config);

	return new Promise((resolve, reject) => {
		const server = net.createServer((socket) => {
			sshClient.forwardOut(
				'127.0.0.1',
				socket.localPort || 0,
				remoteHost,
				remotePort,
				(err, stream) => {
					if (err) {
						socket.end();
						console.error('SSH tunnel error:', err);
						return;
					}

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

		server.on('error', (err) => {
			reject(err);
		});

		server.listen(localPort, '127.0.0.1', () => {
			const serverAddress = server.address() as net.AddressInfo;
			const tunnelId = generateTunnelId();

			activeTunnels.set(tunnelId, {
				server,
				localPort: serverAddress.port,
				remoteHost,
				remotePort,
				sshClient
			});

			resolve({
				tunnelId,
				localPort: serverAddress.port
			});
		});
	});
}

function closeTunnel(tunnelId: string): boolean {
	if (activeTunnels.has(tunnelId)) {
		const tunnel = activeTunnels.get(tunnelId)!;

		tunnel.server.close();
		activeTunnels.delete(tunnelId);

		return true;
	}

	return false;
}

function closeAllTunnels(): void {
	for (const tunnel of Array.from(activeTunnels.values())) {
		tunnel.server.close();
	}

	activeTunnels.clear();
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
	createTunnel,
	closeTunnel,
	closeAllTunnels
};
