<script setup lang="ts">
import { useRedisStore } from '@/store/redis';
import { computed, ref } from 'vue';

const redisStore = useRedisStore();
const showFullJson = ref(false);
const MAX_JSON_LENGTH = 5000;

const keyType = computed(() => redisStore.currentKeyInfo?.type || '');

function formatJson(value: any) {
	try {
		const parsed = JSON.parse(value);
		return JSON.stringify(parsed, null, 2);
	} catch (e) {
		return value;
	}
}

function isPossibleJson(value: string) {
	if (!value || typeof value !== 'string') return false;
	return (
		(value.startsWith('{') && value.endsWith('}')) ||
		(value.startsWith('[') && value.endsWith(']'))
	);
}

function formatValue(value: string) {
	if (!isPossibleJson(value)) return value;

	const formatted = formatJson(value);
	if (formatted.length <= MAX_JSON_LENGTH || showFullJson.value) {
		return formatted;
	}

	return formatted.substring(0, MAX_JSON_LENGTH) + '... (truncated)';
}

function toggleFullJson() {
	showFullJson.value = !showFullJson.value;
}
</script>

<template>
	<div class="flex h-full flex-col">
		<div
			v-if="redisStore.isLoadingValue"
			class="flex h-full w-full items-center justify-center"
		>
			<span class="loading loading-spinner loading-md"></span>
		</div>

		<div
			v-else-if="!redisStore.currentKeyInfo"
			class="flex h-full w-full items-center justify-center"
		>
			<div class="text-center text-sm">
				<svg
					class="mx-auto h-8 w-8"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					fill="currentColor"
				>
					<path
						d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"
					/>
				</svg>
				<p class="mt-2">Select a key to view its value</p>
			</div>
		</div>

		<div
			v-else
			class="flex h-full flex-col"
		>
			<div class="mb-2">
				<div class="flex items-center justify-between">
					<h3
						class="max-w-[300px] truncate font-mono text-sm font-semibold"
						:title="redisStore.currentKeyInfo?.key"
					>
						{{ redisStore.currentKeyInfo?.key }}
					</h3>
					<div class="flex items-center">
						<button
							v-if="
								isPossibleJson(redisStore.keyValue) &&
								redisStore.keyValue?.length > MAX_JSON_LENGTH
							"
							@click="toggleFullJson"
							class="btn btn-xs mr-2"
						>
							{{ showFullJson ? 'Show Less' : 'Show Full JSON' }}
						</button>
						<div class="badge badge-neutral">{{ keyType }}</div>
					</div>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto">
				<div
					v-if="keyType === 'string'"
					class="bg-base-200 h-full overflow-y-auto rounded p-4"
				>
					<pre
						v-if="isPossibleJson(redisStore.keyValue)"
						class="text-xs whitespace-pre-wrap"
						>{{ formatValue(redisStore.keyValue) }}</pre
					>
					<div
						v-else
						class="text-xs break-all"
					>
						{{ redisStore.keyValue }}
					</div>
				</div>

				<div
					v-else-if="keyType === 'list'"
					class="bg-base-200 h-full overflow-y-auto rounded p-4"
				>
					<div class="space-y-2">
						<div
							v-for="(item, index) in redisStore.keyValue"
							:key="index"
							class="bg-base-300 rounded p-2"
						>
							<div class="mb-1 text-xs">{{ index }}</div>
							<pre
								v-if="isPossibleJson(item)"
								class="text-xs whitespace-pre-wrap"
								>{{ formatValue(item) }}</pre
							>
							<div
								v-else
								class="text-xs break-all"
							>
								{{ item }}
							</div>
						</div>
					</div>
				</div>

				<div
					v-else-if="keyType === 'set'"
					class="bg-base-200 h-full overflow-y-auto rounded p-4"
				>
					<div class="space-y-2">
						<div
							v-for="(item, index) in redisStore.keyValue"
							:key="index"
							class="bg-base-300 rounded p-2"
						>
							<pre
								v-if="isPossibleJson(item)"
								class="text-xs whitespace-pre-wrap"
								>{{ formatValue(item) }}</pre
							>
							<div
								v-else
								class="text-xs break-all"
							>
								{{ item }}
							</div>
						</div>
					</div>
				</div>

				<div
					v-else-if="keyType === 'zset'"
					class="bg-base-200 h-full overflow-y-auto rounded p-4"
				>
					<div class="space-y-2">
						<div
							v-for="(item, index) in redisStore.keyValue"
							:key="index"
							class="bg-base-300 rounded p-2"
						>
							<div class="mb-1 text-xs">
								Score: {{ item.score }}
							</div>
							<pre
								v-if="isPossibleJson(item.value)"
								class="text-xs whitespace-pre-wrap"
								>{{ formatValue(item.value) }}</pre
							>
							<div
								v-else
								class="text-xs break-all"
							>
								{{ item.value }}
							</div>
						</div>
					</div>
				</div>

				<div
					v-else-if="keyType === 'hash'"
					class="bg-base-200 h-full overflow-y-auto rounded p-4"
				>
					<div class="space-y-2">
						<div
							v-for="(value, field) in redisStore.keyValue"
							:key="field"
							class="bg-base-300 rounded p-2"
						>
							<div class="mb-1 text-xs font-bold">
								{{ field }}
							</div>
							<pre
								v-if="isPossibleJson(value)"
								class="text-xs whitespace-pre-wrap"
								>{{ formatValue(value) }}</pre
							>
							<div
								v-else
								class="text-xs break-all"
							>
								{{ value }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
