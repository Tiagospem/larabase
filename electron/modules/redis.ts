import { ipcMain } from 'electron';
import Redis from 'ioredis';
import { RedisConnection } from '../../src/types/redis';

interface RedisDBInfo {
	id: number;
	keys: number;
	expires: number;
	avgTtl: number;
}

function createRedisClient(config: RedisConnection) {
	return new Redis({
		host: config.host,
		port:
			typeof config.port === 'string'
				? parseInt(config.port, 10)
				: (config.port ?? 6379),
		password: config.password || undefined,
		connectTimeout: 5000,
		maxRetriesPerRequest: 1,
		retryStrategy: (times) => {
			if (times > 3) {
				return null;
			}
			return Math.min(times * 100, 2000);
		}
	});
}

function registerRedisHandlers() {
	ipcMain.handle('check-redis-status', async (_, config: RedisConnection) => {
		const client = createRedisClient(config);

		try {
			await client.ping();
			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				success: false,
				message: `Could not connect to Redis: ${message}`
			};
		} finally {
			client.disconnect();
		}
	});

	ipcMain.handle(
		'get-redis-databases',
		async (_, config: RedisConnection) => {
			const client = createRedisClient(config);

			try {
				const info = await client.info('keyspace');
				const databases: RedisDBInfo[] = [];

				const lines = info.split('\n');
				for (const line of lines) {
					if (line.startsWith('db')) {
						const dbId = parseInt(line.split(':')[0].substring(2));
						const details = line.split(':')[1];
						const parts = details.split(',');

						const dbInfo: RedisDBInfo = {
							id: dbId,
							keys: 0,
							expires: 0,
							avgTtl: 0
						};

						for (const part of parts) {
							const [key, value] = part.trim().split('=');
							if (key === 'keys') {
								dbInfo.keys = parseInt(value);
							} else if (key === 'expires') {
								dbInfo.expires = parseInt(value);
							} else if (key === 'avg_ttl') {
								dbInfo.avgTtl = parseInt(value);
							}
						}

						databases.push(dbInfo);
					}
				}

				return { success: true, databases };
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				return {
					success: false,
					message: `Failed to get Redis databases: ${message}`
				};
			} finally {
				client.disconnect();
			}
		}
	);

	ipcMain.handle(
		'get-redis-keys',
		async (
			_,
			config: RedisConnection,
			db: number,
			pattern: string = '*',
			cursor: string = '0',
			count: number = 50
		) => {
			const client = createRedisClient(config);

			try {
				await client.select(db);

				const [newCursor, keys] = await client.scan(
					cursor,
					'MATCH',
					pattern,
					'COUNT',
					count
				);

				const keyDetails = [];

				for (const key of keys) {
					const type = await client.type(key);
					const ttl = await client.ttl(key);

					let size = 0;
					switch (type) {
						case 'string':
							const strValue = await client.get(key);
							size = strValue ? strValue.length : 0;
							break;
						case 'list':
							size = await client.llen(key);
							break;
						case 'set':
							size = await client.scard(key);
							break;
						case 'zset':
							size = await client.zcard(key);
							break;
						case 'hash':
							size = await client.hlen(key);
							break;
					}

					keyDetails.push({
						key,
						type,
						ttl,
						size
					});
				}

				return {
					success: true,
					keys: keyDetails,
					cursor: newCursor
				};
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				return {
					success: false,
					message: `Failed to get Redis keys: ${message}`
				};
			} finally {
				client.disconnect();
			}
		}
	);

	ipcMain.handle(
		'get-redis-key-value',
		async (
			_,
			config: RedisConnection,
			db: number,
			key: string,
			type: string
		) => {
			const client = createRedisClient(config);

			try {
				await client.select(db);

				let value: any;
				switch (type) {
					case 'string':
						value = await client.get(key);
						break;
					case 'list':
						value = await client.lrange(key, 0, -1);
						break;
					case 'set':
						value = await client.smembers(key);
						break;
					case 'zset':
						value = await client.zrange(key, 0, -1, 'WITHSCORES');
						const formattedZset = [];
						for (let i = 0; i < value.length; i += 2) {
							formattedZset.push({
								value: value[i],
								score: parseFloat(value[i + 1])
							});
						}
						value = formattedZset;
						break;
					case 'hash':
						const hashValue = await client.hgetall(key);
						value = hashValue;
						break;
					default:
						value = null;
				}

				return { success: true, value };
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				return {
					success: false,
					message: `Failed to get Redis key value: ${message}`
				};
			} finally {
				client.disconnect();
			}
		}
	);

	ipcMain.handle(
		'flush-redis-db',
		async (_, config: RedisConnection, db: number) => {
			const client = createRedisClient(config);

			try {
				await client.select(db);
				await client.flushdb();

				return { success: true };
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				return {
					success: false,
					message: `Failed to flush Redis database: ${message}`
				};
			} finally {
				client.disconnect();
			}
		}
	);

	ipcMain.handle(
		'delete-redis-key',
		async (_, config: RedisConnection, db: number, key: string) => {
			const client = createRedisClient(config);

			try {
				await client.select(db);
				await client.del(key);

				return { success: true };
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				return {
					success: false,
					message: `Failed to delete Redis key: ${message}`
				};
			} finally {
				client.disconnect();
			}
		}
	);
}

export { registerRedisHandlers };
