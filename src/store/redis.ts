import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { ProjectConnection } from '@/types/project';
import { RedisConnection } from '@/types/redis';

export interface RedisDatabase {
	id: number;
	keys: number;
	expires: number;
	avgTtl: number;
}

export interface RedisKey {
	key: string;
	type: string;
	ttl: number;
	size: number;
}

export const useRedisStore = defineStore('redis', () => {
	const isRedisAvailable = ref(false);
	const databases = ref<RedisDatabase[]>([]);
	const selectedDb = ref<number | null>(null);
	const keys = ref<RedisKey[]>([]);
	const keysCursor = ref('0');
	const isLoadingDbs = ref(false);
	const isLoadingKeys = ref(false);
	const isLoadingValue = ref(false);
	const keyValue = ref<any>(null);
	const currentKeyInfo = ref<{ key: string; type: string } | null>(null);
	const currentConnection = ref<RedisConnection | null>(null);

	const hasMoreKeys = computed(() => keysCursor.value !== '0');

	async function checkRedisAvailability(project: ProjectConnection) {
		if (!project.redis_config.host || !project.redis_config.port) {
			isRedisAvailable.value = false;
			return;
		}

		try {
			const config = {
				host: project.redis_config.host,
				port: project.redis_config.port,
				password: project.redis_config.password
			};

			const result = await window.ipcRenderer.checkRedisStatus(
				toRaw(config)
			);
			currentConnection.value = config;
			isRedisAvailable.value = result.success;
		} catch (error) {
			console.error('Error checking Redis availability:', error);
			isRedisAvailable.value = false;
		}
	}

	async function fetchDatabases() {
		if (!currentConnection.value) return;

		isLoadingDbs.value = true;

		try {
			const result = await window.ipcRenderer.getRedisDBs(
				toRaw(currentConnection.value)
			);

			if (result.success) {
				databases.value = result.databases;
			} else {
				databases.value = [];
			}
		} catch (error) {
			console.error('Error fetching Redis databases:', error);
			databases.value = [];
		} finally {
			isLoadingDbs.value = false;
		}
	}

	async function selectDatabase(dbId: number) {
		selectedDb.value = dbId;
		keysCursor.value = '0';
		keys.value = [];

		await fetchKeys();
	}

	async function fetchKeys(pattern: string = '*', reset: boolean = false) {
		if (selectedDb.value === null || !currentConnection.value) return;

		isLoadingKeys.value = true;

		try {
			const cursor = reset ? '0' : keysCursor.value;
			const result = await window.ipcRenderer.getRedisKeys(
				toRaw(currentConnection.value),
				selectedDb.value,
				pattern,
				cursor
			);

			if (result.success) {
				keys.value = reset
					? result.keys
					: [...keys.value, ...result.keys];
				keysCursor.value = result.cursor;
			}
		} catch (error) {
			console.error('Error fetching Redis keys:', error);
		} finally {
			isLoadingKeys.value = false;
		}
	}

	async function fetchKeyValue(key: string, type: string) {
		if (selectedDb.value === null || !currentConnection.value) return;

		isLoadingValue.value = true;
		currentKeyInfo.value = { key, type };

		try {
			const result = await window.ipcRenderer.getRedisKeyValue(
				toRaw(currentConnection.value),
				selectedDb.value,
				key,
				type
			);

			if (result.success) {
				keyValue.value = result.value;
			} else {
				keyValue.value = null;
			}
		} catch (error) {
			console.error('Error fetching Redis key value:', error);
			keyValue.value = null;
		} finally {
			isLoadingValue.value = false;
		}
	}

	async function deleteKey(key: string) {
		if (selectedDb.value === null || !currentConnection.value) return false;

		try {
			const result = await window.ipcRenderer.deleteRedisKey(
				toRaw(currentConnection.value),
				selectedDb.value,
				key
			);

			if (result.success) {
				keys.value = keys.value.filter((k) => k.key !== key);

				if (currentKeyInfo.value?.key === key) {
					currentKeyInfo.value = null;
					keyValue.value = null;
				}

				const dbIndex = databases.value.findIndex(
					(db) => db.id === selectedDb.value
				);
				if (dbIndex >= 0 && databases.value[dbIndex].keys > 0) {
					databases.value[dbIndex].keys--;
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error('Error deleting Redis key:', error);
			return false;
		}
	}

	async function flushDb() {
		if (selectedDb.value === null || !currentConnection.value) return false;

		try {
			const result = await window.ipcRenderer.flushRedisDB(
				toRaw(currentConnection.value),
				selectedDb.value
			);

			if (result.success) {
				keys.value = [];
				keysCursor.value = '0';
				keyValue.value = null;
				currentKeyInfo.value = null;

				const dbIndex = databases.value.findIndex(
					(db) => db.id === selectedDb.value
				);
				if (dbIndex >= 0) {
					databases.value[dbIndex].keys = 0;
					databases.value[dbIndex].expires = 0;
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error('Error flushing Redis database:', error);
			return false;
		}
	}

	function resetState() {
		databases.value = [];
		selectedDb.value = null;
		keys.value = [];
		keysCursor.value = '0';
		keyValue.value = null;
		currentKeyInfo.value = null;
	}

	return {
		checkRedisAvailability,
		isRedisAvailable,
		fetchDatabases,
		databases,
		selectedDb,
		selectDatabase,
		fetchKeys,
		keys,
		fetchKeyValue,
		keyValue,
		currentKeyInfo,
		isLoadingDbs,
		isLoadingKeys,
		isLoadingValue,
		hasMoreKeys,
		deleteKey,
		flushDb,
		resetState
	};
});
