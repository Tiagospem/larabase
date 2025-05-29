import { Client, ConnectConfig } from 'ssh2';
import * as fs from 'fs';
import { SshConnection } from '../../src/types/ssh-connection';

interface ConnectionPool {
	client: Client;
	lastUsed: number;
	config: SshConnection;
}

class OptimizedSshManager {
	private connections = new Map<string, ConnectionPool>();
	private readonly CONNECTION_TIMEOUT = 300000; // 5 minutes
	private readonly MAX_CONNECTIONS = 10;
	private readonly cleanupInterval: NodeJS.Timeout;

	constructor() {
		this.cleanupInterval = setInterval(() => {
			this.cleanupConnections();
		}, 60000);
	}

	private getConnectionKey(config: SshConnection): string {
		return `${config.user}@${config.host}:${config.port}:${config.remotePath}`;
	}

	private cleanupConnections(): void {
		const now = Date.now();
		const keysToDelete: string[] = [];

		for (const [key, pool] of this.connections) {
			if (now - pool.lastUsed > this.CONNECTION_TIMEOUT) {
				try {
					pool.client.end();
				} catch (error) {
					console.error('Error closing SSH connection:', error);
				}
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach((key) => this.connections.delete(key));
		console.log(
			`SSH cleanup: removed ${keysToDelete.length} unused connections`
		);
	}

	private async createOptimizedConnection(
		config: SshConnection
	): Promise<Client> {
		return new Promise((resolve, reject) => {
			const conn = new Client();

			const connectConfig: ConnectConfig = {
				host: config.host,
				port: config.port,
				username: config.user,
				compress: true,
				algorithms: {
					kex: [
						'diffie-hellman-group14-sha256',
						'diffie-hellman-group16-sha512',
						'diffie-hellman-group18-sha512',
						'diffie-hellman-group-exchange-sha256'
					],
					cipher: [
						'aes128-ctr',
						'aes192-ctr',
						'aes256-ctr',
						'aes128-gcm',
						'aes256-gcm'
					],
					hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
					compress: ['zlib@openssh.com', 'zlib', 'none']
				},
				readyTimeout: 10000,
				keepaliveInterval: 30000, // Keep connection alive
				keepaliveCountMax: 3
			};

			if (config.privateKey) {
				try {
					connectConfig.privateKey = fs.readFileSync(
						config.privateKey,
						'utf8'
					);
					if (config.passphrase) {
						connectConfig.passphrase = config.passphrase;
					}
				} catch (error) {
					reject(
						new Error(
							`Failed to read private key: ${error instanceof Error ? error.message : String(error)}`
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
				console.log(
					`Optimized SSH connection established to ${config.host} with compression`
				);
				resolve(conn);
			});

			conn.on('error', (err) => {
				console.error(`SSH connection error to ${config.host}:`, err);
				reject(err);
			});

			conn.on('close', () => {
				console.log(`SSH connection closed to ${config.host}`);
			});

			conn.connect(connectConfig);
		});
	}

	async getConnection(config: SshConnection): Promise<Client> {
		const key = this.getConnectionKey(config);
		const existing = this.connections.get(key);

		if (existing) {
			console.log('Reusing existing connection');
			existing.lastUsed = Date.now();
			return existing.client;
		}

		if (this.connections.size < this.MAX_CONNECTIONS) {
			console.log('Creating new connection');
			const client = await this.createOptimizedConnection(config);

			this.connections.set(key, {
				client,
				lastUsed: Date.now(),
				config
			});

			return client;
		}

		throw new Error(
			'Maximum SSH connections reached. Please wait and try again.'
		);
	}

	releaseConnection(config: SshConnection): void {
		const key = this.getConnectionKey(config);
		const pool = this.connections.get(key);

		if (pool) {
			pool.lastUsed = Date.now();
		}
	}

	async executeCommand(
		config: SshConnection,
		command: string
	): Promise<{ stdout: string; stderr: string; code: number | null }> {
		const client = await this.getConnection(config);

		try {
			return new Promise((resolve, reject) => {
				client.exec(command, (err, stream) => {
					if (err) {
						console.log(
							'Command exec failed, removing connection from pool'
						);
						this.closeConnection(config);
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
						this.releaseConnection(config);
						resolve({ stdout, stderr, code });
					});

					stream.on('error', (err: Error) => {
						console.log(
							'Stream error, removing connection from pool'
						);
						this.closeConnection(config);
						reject(err);
					});
				});
			});
		} catch (error) {
			this.closeConnection(config);
			throw error;
		}
	}

	closeConnection(config: SshConnection): void {
		const key = this.getConnectionKey(config);
		const pool = this.connections.get(key);

		if (pool) {
			try {
				pool.client.end();
			} catch (error) {
				console.error('Error closing SSH connection:', error);
			}
			this.connections.delete(key);
		}
	}

	closeAllConnections(): void {
		for (const pool of this.connections.values()) {
			try {
				pool.client.end();
			} catch (error) {
				console.error('Error closing SSH connection:', error);
			}
		}
		this.connections.clear();
		clearInterval(this.cleanupInterval);
	}

	getConnectionStats(): { total: number; available: number } {
		return {
			total: this.connections.size,
			available: this.connections.size
		};
	}
}

export const optimizedSshManager = new OptimizedSshManager();
export default optimizedSshManager;
