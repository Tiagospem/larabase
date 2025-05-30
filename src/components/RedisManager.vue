<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRedisStore } from '@/store/redis';
import Modal from '@/components/Modal.vue';
import RedisDatabaseList from '@/components/redis/RedisDatabaseList.vue';
import RedisKeysList from '@/components/redis/RedisKeysList.vue';
import RedisKeyValue from '@/components/redis/RedisKeyValue.vue';

const props = defineProps({
	show: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['close']);

const redisStore = useRedisStore();
const activeTab = ref('databases');
const isFlushingAll = ref(false);
const isRefreshingDbs = ref(false);
function closeModal() {
	redisStore.resetState();
	emit('close');
}

watch(
	() => props.show,
	async (newValue) => {
		if (newValue) {
			await loadDatabases();
		}
	}
);

async function loadDatabases() {
	isRefreshingDbs.value = true;
	try {
		await redisStore.fetchDatabases();
	} finally {
		isRefreshingDbs.value = false;
	}
}

function switchTab(tab: string) {
	activeTab.value = tab;
}

async function flushAllDatabases() {
	if (
		!confirm(
			'Are you sure you want to flush ALL Redis databases? This action cannot be undone.'
		)
	) {
		return;
	}

	isFlushingAll.value = true;

	try {
		for (const db of redisStore.databases) {
			await redisStore.selectDatabase(db.id);
			await redisStore.flushDb();
		}

		await redisStore.fetchDatabases();

		redisStore.selectedDb = null;
		redisStore.keys = [];
		redisStore.keyValue = null;
		redisStore.currentKeyInfo = null;
	} catch (error) {
		console.error('Error flushing all databases:', error);
	} finally {
		isFlushingAll.value = false;
	}
}

onMounted(async () => {
	if (props.show) {
		await loadDatabases();
	}
});
</script>

<template>
	<Modal
		:show="show"
		title="Redis Database Manager"
		@close="closeModal"
		width="max-w-6xl"
		@action="flushAllDatabases"
		action-button-text="Flush All"
		:show-action-button="
			redisStore.isRedisAvailable && redisStore.databases.length > 0
		"
		:is-loading-action="isFlushingAll"
		:show-cancel-button="false"
	>
		<div
			v-if="redisStore.isRedisAvailable"
			class="flex h-[50vh] flex-col px-1"
		>
			<div class="flex flex-1 overflow-hidden">
				<div
					class="h-full w-1/4 overflow-hidden border-r border-base-100 pr-3"
				>
					<div class="mb-3 flex items-center justify-between px-1">
						<h3 class="text-sm font-semibold">Databases</h3>
						<button
							@click="loadDatabases"
							class="btn btn-sm btn-ghost"
							title="Refresh Databases"
							:disabled="isRefreshingDbs"
						>
							<span
								v-if="isRefreshingDbs"
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
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
						</button>
					</div>
					<div class="h-[calc(100%-2rem)]">
						<RedisDatabaseList
							@select-database="switchTab('keys')"
						/>
					</div>
				</div>

				<div class="flex h-full w-3/4 flex-col">
					<div class="flex-1 overflow-hidden">
						<div
							v-if="redisStore.selectedDb !== null"
							class="flex h-full"
						>
							<div
								class="h-full w-2/5 overflow-hidden border-r border-base-100 pr-2"
							>
								<RedisKeysList />
							</div>
							<div class="h-full w-3/5 overflow-y-auto pl-4">
								<RedisKeyValue />
							</div>
						</div>
						<div
							v-else
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
								<p class="mt-2">
									Select a database to view keys
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div
			v-else
			class="flex h-40 items-center justify-center"
		>
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mx-auto h-12 w-12"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<p class="mt-2">Redis is not available for this connection.</p>
				<p class="text-sm">
					Check your Redis configuration in the project settings.
				</p>
			</div>
		</div>
	</Modal>
</template>
