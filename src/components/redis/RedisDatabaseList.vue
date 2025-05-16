<script setup lang="ts">
import { useRedisStore } from '@/store/redis';
import { computed, ref } from 'vue';

const emit = defineEmits(['select-database']);
const redisStore = useRedisStore();
const flushingDb = ref<number | null>(null);

const sortedDatabases = computed(() => {
	return [...redisStore.databases].sort((a, b) => a.id - b.id);
});

async function selectDatabase(dbId: number) {
	if (redisStore.selectedDb === dbId) return;

	redisStore.currentKeyInfo = null;
	redisStore.keyValue = null;

	await redisStore.selectDatabase(dbId);
	emit('select-database');
}

async function flushDatabase(dbId: number, event: Event) {
	event.stopPropagation();

	if (
		!confirm(
			`Are you sure you want to flush database ${dbId}? This will delete all keys.`
		)
	) {
		return;
	}

	flushingDb.value = dbId;
	await redisStore.selectDatabase(dbId);
	const success = await redisStore.flushDb();

	if (success) {
		await redisStore.fetchDatabases();
	}
	flushingDb.value = null;
}
</script>

<template>
	<div class="flex h-full flex-col">
		<div
			v-if="redisStore.isLoadingDbs"
			class="flex h-full w-full items-center justify-center"
		>
			<span class="loading loading-spinner loading-md"></span>
		</div>

		<div
			v-else-if="sortedDatabases.length === 0"
			class="flex h-full w-full items-center justify-center"
		>
			<p class="text-sm">No databases found</p>
		</div>

		<div
			v-else
			class="h-full space-y-2 overflow-y-auto"
		>
			<div
				v-for="db in sortedDatabases"
				:key="db.id"
				class="card card-compact bg-base-200 hover:bg-base-100 cursor-pointer shadow-sm transition-all"
				:class="{
					'border-primary border-l-4': redisStore.selectedDb === db.id
				}"
				@click="selectDatabase(db.id)"
			>
				<div class="card-body p-3">
					<div class="flex items-center justify-between">
						<h3 class="card-title text-base">
							Database {{ db.id }}
						</h3>
						<button
							v-if="db.keys > 0"
							class="btn btn-error btn-xs"
							@click="flushDatabase(db.id, $event)"
							title="Flush database"
							:disabled="flushingDb === db.id"
						>
							<span
								v-if="flushingDb === db.id"
								class="loading loading-spinner loading-xs"
							></span>
							<span v-else>Flush</span>
						</button>
					</div>

					<div class="text-sm">
						<div class="mt-1 grid grid-cols-2 gap-2">
							<div>
								<span class="font-semibold">Keys:</span>
								{{ db.keys }}
							</div>
							<div>
								<span class="font-semibold">Expires:</span>
								{{ db.expires }}
							</div>
						</div>

						<div
							v-if="db.avgTtl > 0"
							class="mt-1"
						>
							<span class="font-semibold">Avg TTL:</span>
							{{ Math.round(db.avgTtl / 1000) }}s
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
