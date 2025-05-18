<script setup lang="ts">
import { ref, computed, markRaw, defineAsyncComponent } from 'vue';
import { useSidebarStore } from '@/store/sidebar';
import { useConnectionsStore } from '@/store/connections';
import { ConnectionType } from '@/types/connection-types';

const DataTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/Records.vue'))
);
const IndexesTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/IndexesTab.vue'))
);
const StructureTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/StructureTab.vue'))
);
const ForeignKeysTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/ForeignKeysTab.vue'))
);
const MigrationsTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/MigrationsTab.vue'))
);
const ModelTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/ModelTab.vue'))
);
const FactoryTab = markRaw(
	defineAsyncComponent(() => import('./database/tables/FactoryTab.vue'))
);

const props = defineProps<{ tableName: string }>();

defineOptions({
	name: 'TableContent'
});

const sidebarStore = useSidebarStore();
const connectionsStore = useConnectionsStore();

const activeContentTab = ref('data');

const contentTabs = [
	{ id: 'data', label: 'Data' },
	{ id: 'structure', label: 'Structure' },
	{ id: 'indexes', label: 'Indexes' },
	{ id: 'foreignKeys', label: 'Foreign Keys' },
	{ id: 'migrations', label: 'Migrations' },
	{ id: 'model', label: 'Model' },
	{ id: 'factory', label: 'Factory' }
];

const isSSHConnection = computed(() => {
	const selectedProject = connectionsStore.getSelectedProject;
	return selectedProject?.type === ConnectionType.SSH;
});

const visibleTabs = computed(() => {
	return contentTabs.filter((tab) => {
		return !(
			(tab.id === 'migrations' ||
				tab.id === 'model' ||
				tab.id === 'factory') &&
			isSSHConnection.value
		);
	});
});

if (
	activeContentTab.value === 'migrations' ||
	activeContentTab.value === 'model' ||
	activeContentTab.value === 'factory'
) {
	const shouldResetTab = computed(() => {
		return isSSHConnection.value;
	});

	if (shouldResetTab.value) {
		activeContentTab.value = 'data';
	}
}

const currentTabComponent = computed(() => {
	switch (activeContentTab.value) {
		case 'data':
			return DataTab;
		case 'structure':
			return StructureTab;
		case 'indexes':
			return IndexesTab;
		case 'foreignKeys':
			return ForeignKeysTab;
		case 'migrations':
			return MigrationsTab;
		case 'model':
			return ModelTab;
		case 'factory':
			return FactoryTab;
		default:
			return DataTab;
	}
});

function switchContentTab(tabId: string) {
	activeContentTab.value = tabId;
}
</script>

<template>
	<div class="flex h-full flex-col">
		<div
			class="bg-base-300 flex items-center border-b border-black/10 px-2 py-1"
		>
			<div class="flex gap-1">
				<a
					v-for="tab in visibleTabs"
					:key="tab.id"
					class="flex cursor-pointer items-center gap-1 px-2 py-1 text-sm font-medium tracking-tighter transition-colors"
					:class="{
						'text-primary': activeContentTab === tab.id,
						'hover:text-primary opacity-50':
							activeContentTab !== tab.id,
						'pointer-events-none animate-pulse opacity-20':
							sidebarStore.isLoading
					}"
					@click="switchContentTab(tab.id)"
				>
					{{ tab.label }}
				</a>
			</div>
		</div>

		<keep-alive>
			<component
				:is="currentTabComponent"
				:tableName="props.tableName"
				:key="activeContentTab"
			/>
		</keep-alive>
	</div>
</template>
