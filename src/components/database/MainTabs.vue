<script setup lang="ts">
import { computed, inject, ref, watch, watchEffect, nextTick } from 'vue';
import { useTabsStore } from '@/store/tabs';
import { useDatabaseStore } from '@/store/database';
import IconPin from '@/components/icons/IconPin.vue';
import IconPinFilled from '@/components/icons/IconPinFilled.vue';
import IconTruncate from '@/components/icons/IconTruncate.vue';
import Modal from '@/components/Modal.vue';
import { useConnectionsStore } from '@/store/connections.js';

const tabsStore = useTabsStore();
const databaseStore = useDatabaseStore();
const connectionsStore = useConnectionsStore();
const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const draggingTableName = ref<string | null>(null);
const showTruncateConfirm = ref(false);
const isProcessing = ref(false);

const tabsScrollRef = ref<HTMLElement | null>(null);

const hasScrollRight = ref(false);
const hasScrollLeft = ref(false);
const isHoveringTabs = ref(false);

const activeTableName = computed(() => tabsStore.activeTableName);
const openTables = computed(() => tabsStore.openTables);

function confirmTruncatePinnedTables() {
	if (tabsStore.pinnedTables.length === 0) return;
	showTruncateConfirm.value = true;
}

async function truncatePinnedTables() {
	if (tabsStore.pinnedTables.length === 0) return;

	isProcessing.value = true;

	try {
		const tableNames = tabsStore.pinnedTables.map((table) => table.name);

		const result = await databaseStore.truncateTables(tableNames);

		window.dispatchEvent(new CustomEvent('refresh-table'));

		showAlert(result.message, 'success');
	} catch (error: any) {
		showAlert(`Error truncating tables: ${error.message}`, 'error');
	} finally {
		isProcessing.value = false;
		showTruncateConfirm.value = false;
	}
}

function scrollLeft() {
	if (!tabsScrollRef.value) return;

	const container = tabsScrollRef.value;

	const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
	container.scrollBy({
		left: -scrollAmount,
		behavior: 'smooth'
	});
}

function scrollRight() {
	if (!tabsScrollRef.value) return;

	const container = tabsScrollRef.value;

	const scrollAmount = Math.min(container.clientWidth * 0.75, 300);
	container.scrollBy({
		left: scrollAmount,
		behavior: 'smooth'
	});
}

function handleDragStart(_: DragEvent, tableName: string) {
	draggingTableName.value = tableName;
}

function handleDrop(_: DragEvent, tableName: string) {
	if (draggingTableName.value === null) return;

	const draggedTabIndex = openTables.value.findIndex(
		(table) => table.name === draggingTableName.value
	);
	const targetTabIndex = openTables.value.findIndex(
		(table) => table.name === tableName
	);

	if (draggedTabIndex === -1 || targetTabIndex === -1) return;

	const tabs = [...openTables.value];
	const [removed] = tabs.splice(draggedTabIndex, 1);

	tabs.splice(targetTabIndex, 0, removed);

	tabsStore.reorderTables(tabs);

	draggingTableName.value = null;
}

function checkScrollPosition() {
	if (!tabsScrollRef.value) return;

	const container = tabsScrollRef.value;

	const hasLeftScrollSpace = container.scrollLeft > 2;
	const hasRightScrollSpace =
		Math.abs(
			container.scrollWidth - container.clientWidth - container.scrollLeft
		) > 2;

	hasScrollLeft.value = hasLeftScrollSpace;
	hasScrollRight.value = hasRightScrollSpace;
}

async function scrollToActiveTab() {
	if (!tabsScrollRef.value) return;

	await nextTick();

	if (!tabsScrollRef.value) return;

	const activeTabElement = Array.from(
		tabsScrollRef.value.querySelectorAll('.tab')
	).find((tab) => (tab as HTMLElement).classList.contains('bg-base-100')) as
		| HTMLElement
		| undefined;

	if (!activeTabElement) return;

	const scrollContainer = tabsScrollRef.value;

	const containerWidth = scrollContainer.offsetWidth;
	const tabLeft = activeTabElement.offsetLeft;
	const tabWidth = activeTabElement.offsetWidth;

	if (tabLeft + tabWidth > scrollContainer.scrollLeft + containerWidth) {
		scrollContainer.scrollTo({
			left: tabLeft + tabWidth - containerWidth + 20,
			behavior: 'smooth'
		});
	} else if (tabLeft < scrollContainer.scrollLeft) {
		scrollContainer.scrollTo({
			left: tabLeft - 20,
			behavior: 'smooth'
		});
	}

	await nextTick();

	checkScrollPosition();
}

function handleMouseEnter() {
	isHoveringTabs.value = true;
	checkScrollPosition();
}

function handleMouseLeave() {
	isHoveringTabs.value = false;
}

watch(
	() => tabsStore.activeTableName,
	() => {
		checkScrollPosition();
		scrollToActiveTab();
	}
);

watch(
	() => tabsStore.shouldScrollToActiveTab,
	(newValue) => {
		if (newValue) {
			nextTick();
			scrollToActiveTab();
			tabsStore.shouldScrollToActiveTab = false;
		}
	}
);

watchEffect(async () => {
	if (connectionsStore.projectId) {
		await tabsStore.loadSavedTables();
		await nextTick();
		checkScrollPosition();
	}
});
</script>

<template>
	<div
		v-if="openTables.length > 0"
		class="tabs-container bg-base-200 border-b border-black/10"
		@mouseenter="handleMouseEnter"
		@mouseleave="handleMouseLeave"
	>
		<div class="tabs-content-wrapper">
			<button
				v-if="hasScrollLeft && isHoveringTabs"
				class="tab-scroll-button left-scroll-button bg-primary text-base-100"
				@click="scrollLeft"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.75 19.5L8.25 12l7.5-7.5"
					/>
				</svg>
			</button>

			<div
				ref="tabsScrollRef"
				class="tabs-scroll"
				@scroll="checkScrollPosition"
			>
				<div
					class="border-r border-r-black/10"
					v-for="table in openTables"
					:key="table.name"
					:class="[
						'tab',
						{
							'bg-base-200': table.name !== activeTableName,
							'bg-base-100 border-accent border-t-2':
								table.name === activeTableName,
							'': table.isPinned
						}
					]"
					draggable="true"
					@click="tabsStore.activateTable(table)"
					@dragstart="handleDragStart($event, table.name)"
					@dragover.prevent
					@drop="handleDrop($event, table.name)"
				>
					<span
						class="pin-indicator"
						@click.stop="tabsStore.toggleTablePin(table)"
					>
						<IconPin
							v-if="!table.isPinned"
							class="opacity-20 hover:opacity-100"
						/>
						<IconPinFilled
							v-else
							class="text-accent"
						/>
					</span>
					<span class="tab-title">{{ table.name }}</span>
					<button
						class="close-icon"
						@click.stop="tabsStore.removeTab(table)"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<button
				v-if="hasScrollRight && isHoveringTabs"
				class="tab-scroll-button right-scroll-button bg-primary text-base-100"
				@click="scrollRight"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.25 4.5l7.5 7.5-7.5 7.5"
					/>
				</svg>
			</button>
		</div>

		<div
			class="tabs-actions bg-base-300 flex items-center"
			v-if="tabsStore.pinnedTables.length > 0"
		>
			<div class="dropdown dropdown-end">
				<div
					tabindex="0"
					class="tab-action-button ml-1 flex cursor-pointer items-center"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-4 w-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
						/>
					</svg>
					<div
						class="bg-accent text-base-100 ml-1 min-w-[20px] rounded-full px-1.5 text-center text-xs"
					>
						{{ tabsStore.pinnedTables.length }}
					</div>
				</div>

				<ul
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box w-56 p-2 shadow-sm"
				>
					<li>
						<a
							@click="confirmTruncatePinnedTables()"
							class="text-error"
						>
							<IconTruncate />
							<span>Truncate tables</span>
						</a>
					</li>
					<li>
						<a @click="tabsStore.clearPinnedTables()">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="h-4 w-4"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
								/>
							</svg>
							<span>Unpin all</span>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<Modal
		:show="showTruncateConfirm"
		title="Truncate Tables"
		@close="showTruncateConfirm = false"
		@action="truncatePinnedTables"
		:show-action-button="true"
		:is-loading-action="isProcessing"
		:action-button-text="'Truncate Tables'"
		width="w-lg"
	>
		<p class="py-4">
			<span class="block font-bold"
				>Are you sure you want to truncate
				<strong>{{ tabsStore.pinnedTables.length }}</strong>
			</span>
			<span class="text-error text-sm">
				table(s)? This will delete ALL records and cannot be undone.
			</span>
		</p>
		<div class="bg-base-100 mb-4 max-h-40 overflow-y-auto rounded-sm p-2">
			<ul class="list-disc space-y-1 pl-4">
				<li
					v-for="table in tabsStore.pinnedTables"
					:key="table.name"
				>
					{{ table.name }}
				</li>
			</ul>
		</div>
	</Modal>
</template>

<style scoped>
.tabs-container {
	position: relative;
	width: 100%;
	height: 35px;
	display: flex;
}

.tabs-content-wrapper {
	position: relative;
	display: flex;
	flex: 1;
	overflow: hidden;
}

.tabs-scroll {
	display: flex;
	overflow-x: auto;
	height: 100%;
	scrollbar-width: none;
	-ms-overflow-style: none;
	flex: 1;
	z-index: 1;
}

.tabs-scroll::-webkit-scrollbar {
	display: none;
}

.tab {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 100%;
	min-width: 180px;
	max-width: 180px;
	padding: 0 5px;
	cursor: pointer;
	user-select: none;
}

.pin-indicator {
	display: inline-flex;
	align-items: center;
	cursor: pointer;
	padding: 3px;
	border-radius: 3px;
}

.tab-title {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	flex: 1;
}

.close-icon {
	width: 20px;
	height: 20px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	margin-left: 6px;
}

.tab-scroll-button {
	position: absolute;
	width: 28px;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	z-index: 2;
	box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
}

.left-scroll-button {
	left: 0;
	border-top-right-radius: 4px;
	border-bottom-right-radius: 4px;
}

.right-scroll-button {
	right: 0;
	border-top-left-radius: 4px;
	border-bottom-left-radius: 4px;
}

.tabs-actions {
	padding: 0 3px;
	z-index: 20;
	position: relative;
}

.tab-action-button {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 24px;
	height: 24px;
	margin: 0 3px;
	padding: 0 6px;
	border-radius: 4px;
	transition: all 0.2s;
	border: 1px solid transparent;
}

.tabs-actions .absolute {
	z-index: 9999 !important;
}

.dropdown-content {
	z-index: 9999 !important;
}
</style>
