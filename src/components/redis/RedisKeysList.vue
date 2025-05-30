<script setup lang="ts">
import { useRedisStore } from '@/store/redis';
import { ref } from 'vue';

const redisStore = useRedisStore();
const loadingDelete = ref<string | null>(null);

function getTypeIcon(type: string) {
	switch (type) {
		case 'string':
			return 'text-blue-400';
		case 'list':
			return 'text-green-400';
		case 'set':
			return 'text-yellow-400';
		case 'zset':
			return 'text-orange-400';
		case 'hash':
			return 'text-purple-400';
		default:
			return 'text-gray-400';
	}
}

function formatTtl(ttl: number) {
	if (ttl < 0) {
		return 'No expiry';
	}

	if (ttl < 60) {
		return `${ttl}s`;
	}

	if (ttl < 3600) {
		return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
	}

	if (ttl < 86400) {
		const hours = Math.floor(ttl / 3600);
		const minutes = Math.floor((ttl % 3600) / 60);
		return `${hours}h ${minutes}m`;
	}

	const days = Math.floor(ttl / 86400);
	const hours = Math.floor((ttl % 86400) / 3600);
	return `${days}d ${hours}h`;
}

async function deleteKey(key: string, event: Event) {
	event.stopPropagation();

	if (!confirm(`Are you sure you want to delete key "${key}"?`)) {
		return;
	}

	loadingDelete.value = key;
	await redisStore.deleteKey(key);
	loadingDelete.value = null;
}

function showKeyValue(key: string, type: string) {
	redisStore.fetchKeyValue(key, type);
}

function loadMoreKeys() {
	redisStore.fetchKeys();
}
</script>

<template>
	<div class="flex h-full flex-col">
		<h3 class="mb-3 px-1 text-sm font-semibold">
			Keys
			<span v-if="redisStore.keys.length > 0"
				>({{ redisStore.keys.length }})</span
			>
		</h3>

		<div
			v-if="redisStore.isLoadingKeys && redisStore.keys.length === 0"
			class="flex h-full w-full items-center justify-center"
		>
			<span class="loading loading-spinner loading-md"></span>
		</div>

		<div
			v-else-if="redisStore.keys.length === 0"
			class="flex h-full w-full items-center justify-center"
		>
			<p class="text-sm">No keys found</p>
		</div>

		<div
			v-else
			class="flex-1 overflow-y-auto"
		>
			<div class="space-y-1 px-1">
				<div
					v-for="key in redisStore.keys"
					:key="key.key"
					class="border-base-300 bg-base-200 hover:bg-base-100 mb-2 cursor-pointer rounded border p-2 text-sm"
					:class="{
						'!bg-base-100':
							redisStore.currentKeyInfo?.key === key.key
					}"
					@click="showKeyValue(key.key, key.type)"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center overflow-hidden">
							<span
								:class="getTypeIcon(key.type)"
								class="mr-2 shrink-0 font-mono text-xs uppercase"
								>{{ key.type }}</span
							>
							<span
								class="truncate font-mono text-xs"
								:title="key.key"
								>{{ key.key }}</span
							>
						</div>
						<button
							class="btn btn-ghost btn-xs text-error ml-1 shrink-0"
							@click="deleteKey(key.key, $event)"
							title="Delete key"
							:disabled="loadingDelete === key.key"
						>
							<span
								v-if="loadingDelete === key.key"
								class="loading loading-spinner loading-xs"
							></span>
							<svg
								v-else
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					</div>

					<div class="mt-1 flex justify-between text-xs">
						<div>
							<span>Size: {{ key.size }}</span>
						</div>
						<div>
							<span>TTL: {{ formatTtl(key.ttl) }}</span>
						</div>
					</div>
				</div>
			</div>

			<div
				v-if="redisStore.isLoadingKeys && redisStore.keys.length > 0"
				class="mt-4 flex justify-center"
			>
				<span class="loading loading-spinner loading-sm"></span>
			</div>

			<div
				v-if="redisStore.hasMoreKeys && !redisStore.isLoadingKeys"
				class="mt-4 flex justify-center"
			>
				<button
					@click="loadMoreKeys"
					class="btn btn-sm btn-outline"
				>
					Load more
				</button>
			</div>
		</div>
	</div>
</template>
