<script setup lang="ts">
import BaseHeader from '@/components/BaseHeader.vue';
import SQLEditor from '@/components/SQLEditor.vue';
import DataTable from '@/components/DataTable.vue';
import SQLPaginator from '@/components/SQLPaginator.vue';
import SQLScratchSidebar from '@/components/SQLScratchSidebar.vue';
import DatabaseSchemaViewer from '@/components/schema/DatabaseSchemaViewer.vue';
import { useRoute, useRouter } from 'vue-router';
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue';
import { useConnectionsStore } from '@/store/connections';
import { useSqlResultsStore } from '@/store/sqlResults';
import { SqlScratchService } from '@/services/sqlScratchService';
import { ProjectConnection } from '@/types/project';
import { useDatabaseSchema } from '@/services/databaseSchema';
import { AIService } from '@/services/aiService';
import SQLAIModal from '@/components/SQLAIModal.vue';
import SQLExplainModal from '@/components/SQLExplainModal.vue';
import type { ExplainResult } from '@/composables/useSQLEditor';
import ConnectionGuard from '@/components/ConnectionGuard.vue';

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const isContentReady = ref(false);
const isResizing = ref(false);
const editorContainer = ref<HTMLElement | null>(null);
const editorSection = ref<HTMLElement | null>(null);
const resultSection = ref<HTMLElement | null>(null);
const resizer = ref<HTMLElement | null>(null);
const sqlQuery = ref('-- Write your SQL query here');
const sqlEditorRef = ref<InstanceType<typeof SQLEditor> | null>(null);
const currentSortColumn = ref<string | null>(null);
const currentSortDirection = ref<'asc' | 'desc'>('asc');
const isResizingWindow = ref(false);
const showSchemaModal = ref(false);
const isLoadingSchema = ref(false);
const showAIModal = ref(false);
const showExplainModal = ref(false);
const explainData = ref<ExplainResult>({
	rawExplain: [],
	queryToExplain: '',
	isExplaining: false
});
const isProcessing = ref(false);

const currentPage = ref(1);
const rowsPerPage = ref(25);

const connectionsStore = useConnectionsStore();
const sqlResultsStore = useSqlResultsStore();
const {
	databaseSchema,
	fetchDatabaseSchema,
	initializeSchema,
	getCompactSchema
} = useDatabaseSchema();

const aiService = AIService.getInstance();

const sqlScratchService = SqlScratchService.getInstance();

const activeScratch = computed(() => {
	return sqlScratchService.getActiveScratch();
});

const totalRecords = computed(() => {
	return sqlResultsStore.results.length;
});

const projectId = computed(() => route.params.id as string);

const project = computed<ProjectConnection | null>(() => {
	return connectionsStore.getProjectById(projectId.value);
});

const sortedData = computed(() => {
	if (!currentSortColumn.value || !sqlResultsStore.results.length) {
		return sqlResultsStore.results;
	}

	return [...sqlResultsStore.results].sort((a, b) => {
		const valueA = a[currentSortColumn.value!];
		const valueB = b[currentSortColumn.value!];

		if (valueA === null || valueA === undefined)
			return currentSortDirection.value === 'asc' ? -1 : 1;
		if (valueB === null || valueB === undefined)
			return currentSortDirection.value === 'asc' ? 1 : -1;

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return currentSortDirection.value === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA);
		}

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return currentSortDirection.value === 'asc'
				? valueA - valueB
				: valueB - valueA;
		}

		if (valueA instanceof Date && valueB instanceof Date) {
			return currentSortDirection.value === 'asc'
				? valueA.getTime() - valueB.getTime()
				: valueB.getTime() - valueA.getTime();
		}

		return currentSortDirection.value === 'asc'
			? String(valueA).localeCompare(String(valueB))
			: String(valueB).localeCompare(String(valueA));
	});
});

const tableData = computed(() => {
	const startIndex = (currentPage.value - 1) * rowsPerPage.value;
	const endIndex = startIndex + rowsPerPage.value;
	const paginatedResults = sortedData.value.slice(startIndex, endIndex);

	return paginatedResults.map((row, index) => {
		const formattedRow = { ...row };

		Object.keys(formattedRow).forEach((key) => {
			const value = formattedRow[key];
			if (
				value &&
				((typeof value === 'string' &&
					value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) ||
					(typeof value === 'string' &&
						value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) ||
					value instanceof Date)
			) {
				try {
					const date = new Date(value);
					if (!isNaN(date.getTime())) {
						formattedRow[key] = date
							.toISOString()
							.replace('T', ' ')
							.split('.')[0];
					}
				} catch (e) {}
			}
		});

		if (formattedRow.id === undefined) {
			return { id: `row-${index}`, ...formattedRow };
		}
		return formattedRow;
	});
});

function goBack() {
	router.push(`/database/${projectId.value}/${project.value?.isRemote}`);
}

function loadSavedSql() {
	const savedSql = localStorage.getItem(
		`sql-editor-content-${projectId.value}`
	);
	if (savedSql) {
		sqlQuery.value = savedSql;
	}
}

function saveSqlContent() {
	localStorage.setItem(
		`sql-editor-content-${projectId.value}`,
		sqlQuery.value
	);

	if (sqlScratchService.activeScratchId) {
		sqlScratchService.updateActiveScratchContent(
			sqlQuery.value,
			projectId.value
		);
	}
}

function handleSort(field: string) {
	if (currentSortColumn.value === field) {
		currentSortDirection.value =
			currentSortDirection.value === 'asc' ? 'desc' : 'asc';
	} else {
		currentSortColumn.value = field;
		currentSortDirection.value = 'asc';
	}
}

async function showDatabaseSchema() {
	try {
		isLoadingSchema.value = true;
		await fetchDatabaseSchema(true);

		if (
			databaseSchema.value &&
			databaseSchema.value.tables &&
			databaseSchema.value.tables.length > 0
		) {
			getCompactSchema();
			showSchemaModal.value = true;
		} else {
			alert('No database schema data available. Please try again.');
		}
	} catch (error) {
		console.error('Error getting database schema:', error);
		alert(
			'Error getting database schema: ' +
				(error instanceof Error ? error.message : String(error))
		);
	} finally {
		isLoadingSchema.value = false;
	}
}

function openAIModal() {
	if (!databaseSchema.value) {
		fetchDatabaseSchema(true).then(() => {
			if (databaseSchema.value) {
				showAIModal.value = true;
			} else {
				alert('Could not load database schema. Please try again.');
			}
		});
	} else {
		showAIModal.value = true;
	}
}

function closeAIModal() {
	showAIModal.value = false;
}

function applySqlFromAI(sql: string) {
	if (sql && sql.trim()) {
		sqlQuery.value = sql;
		saveSqlContent();
	}
}

function isAIConfigured() {
	return aiService.isAIConfigured();
}

function updateSectionHeights(editorRatio: number) {
	if (
		!editorContainer.value ||
		!editorSection.value ||
		!resultSection.value ||
		isResizingWindow.value
	)
		return;

	isResizingWindow.value = true;

	localStorage.setItem('sql-editor-ratio', editorRatio.toString());

	const containerHeight = editorContainer.value.clientHeight;
	const editorHeight = Math.floor(containerHeight * editorRatio);
	const resultHeight =
		containerHeight - editorHeight - resizer.value!.clientHeight;

	editorSection.value.style.height = `${editorHeight}px`;
	resultSection.value.style.height = `${resultHeight}px`;

	setTimeout(() => {
		window.dispatchEvent(new Event('resize'));
		isResizingWindow.value = false;
	}, 0);
}

function onResizerMouseDown(event: MouseEvent) {
	event.preventDefault();
	isResizing.value = true;

	const startY = event.clientY;
	const initialEditorHeight = editorSection.value!.clientHeight;
	const containerHeight = editorContainer.value!.clientHeight;

	const onMouseMove = (e: MouseEvent) => {
		if (isResizing.value) {
			const deltaY = e.clientY - startY;
			const newEditorHeight = initialEditorHeight + deltaY;

			if (
				newEditorHeight > 100 &&
				containerHeight -
					newEditorHeight -
					resizer.value!.clientHeight >
					100
			) {
				editorSection.value!.style.height = `${newEditorHeight}px`;

				resultSection.value!.style.height = `${containerHeight - newEditorHeight - resizer.value!.clientHeight}px`;

				if (
					sqlEditorRef.value &&
					typeof sqlEditorRef.value.layout === 'function'
				) {
					sqlEditorRef.value.layout();
				}
			}
		}
	};

	const onMouseUp = () => {
		if (isResizing.value) {
			isResizing.value = false;

			const newRatio =
				editorSection.value!.clientHeight / containerHeight;
			localStorage.setItem('sql-editor-ratio', newRatio.toString());

			if (
				sqlEditorRef.value &&
				typeof sqlEditorRef.value.layout === 'function'
			) {
				sqlEditorRef.value.layout();
			}

			window.dispatchEvent(new Event('resize'));
		}

		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	document.addEventListener('mousemove', onMouseMove);
	document.addEventListener('mouseup', onMouseUp);
}

function toggleScratchPanel() {
	sqlScratchService.toggleSidePanel();
}

function saveSqlAsScratch() {
	const content = sqlEditorRef.value?.getSelectedText() || sqlQuery.value;

	sqlScratchService.saveScratch({
		content,
		projectId: projectId.value
	});
}

function closeExplainModal() {
	showExplainModal.value = false;
}

function handleExplainSQL(data: ExplainResult) {
	explainData.value = data;
	showExplainModal.value = true;
}

function handleConnectionValid() {
	isContentReady.value = true;
}

onMounted(async () => {
	isLoading.value = true;
	await connectionsStore.loadConnections(projectId.value);
	sqlScratchService.loadScratches(projectId.value);
	await initializeSchema();

	const active = sqlScratchService.getActiveScratch();
	if (active) {
		sqlQuery.value = active.content;
	} else {
		loadSavedSql();
	}

	isLoading.value = false;

	window.sqlEditorContent = sqlQuery;

	setTimeout(() => {
		initResize();

		setTimeout(() => {
			const editorElement = document.querySelector(
				'.sql-editor-container'
			);
			if (editorElement) {
				editorElement.addEventListener(
					'save-as-scratch',
					(event: Event) => {
						const customEvent = event as CustomEvent;
						if (customEvent.detail?.content) {
							sqlScratchService.saveScratch({
								content: customEvent.detail.content,
								projectId: projectId.value
							});
						}
					}
				);
			}
		}, 500);
	}, 100);

	window.addEventListener('resize', handleWindowResize);
});

watch(
	() => sqlQuery.value,
	() => {
		saveSqlContent();
	}
);

watch(
	() => activeScratch.value,
	(newScratch) => {
		if (newScratch && sqlQuery.value !== newScratch.content) {
			sqlQuery.value = newScratch.content;
		}
	}
);

function handleWindowResize() {
	if (isResizingWindow.value) return;

	const storedRatio = localStorage.getItem('sql-editor-ratio');
	if (storedRatio) {
		const ratio = parseFloat(storedRatio);
		if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
			updateSectionHeights(ratio);
		}
	}
}

function initResize() {
	if (
		!editorContainer.value ||
		!editorSection.value ||
		!resultSection.value ||
		!resizer.value
	)
		return;

	const storedRatio = localStorage.getItem('sql-editor-ratio');
	if (storedRatio) {
		const ratio = parseFloat(storedRatio);
		if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
			updateSectionHeights(ratio);
		}
	} else {
		updateSectionHeights(0.6);
	}

	resizer.value.addEventListener('mousedown', onResizerMouseDown);
}

onBeforeUnmount(() => {
	window.removeEventListener('resize', handleWindowResize);
	if (resizer.value) {
		resizer.value.removeEventListener('mousedown', onResizerMouseDown);
	}

	delete window.sqlEditorContent;
});
</script>

<template>
	<div class="relative flex h-full flex-col">
		<ConnectionGuard
			:projectId="projectId"
			:key="projectId"
			@connection-valid="handleConnectionValid"
		/>

		<div
			class="bg-base-300 draggable absolute top-0 z-10 h-10 w-full"
		></div>

		<div
			v-if="isLoading && isContentReady"
			class="mt-8 flex h-full items-center justify-center"
		>
			<span class="loading loading-spinner loading-lg"></span>
		</div>
		<template v-else-if="isContentReady">
			<BaseHeader
				@goBack="goBack"
				:title="`SQL Editor - ${activeScratch?.isDefault ? 'Default' : activeScratch?.name}`"
				:project="project"
				class="z-20 mt-8"
			>
				<template #actions>
					<div class="flex items-center gap-2">
						<button
							v-if="sqlResultsStore.results.length > 0"
							@click="sqlResultsStore.clearResults()"
							class="btn btn-ghost btn-sm"
							title="Clear Results"
						>
							<svg
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

						<div
							class="tooltip tooltip-left"
							data-tip="Database Schema"
						>
							<button
								@click="showDatabaseSchema"
								class="btn btn-ghost btn-sm"
								title="Database Schema"
								:disabled="isLoadingSchema"
							>
								<span
									v-if="isLoadingSchema"
									class="loading loading-spinner loading-xs"
								></span>
								<svg
									v-else
									class="h-4 w-4"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 512"
								>
									<path
										d="M64 256l0-96 160 0 0 96L64 256zm0 64l160 0 0 96L64 416l0-96zm224 96l0-96 160 0 0 96-160 0zM448 256l-160 0 0-96 160 0 0 96zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z"
									/>
								</svg>
							</button>
						</div>

						<div
							class="tooltip tooltip-left"
							data-tip="AI SQL Assistant"
						>
							<button
								@click="openAIModal"
								class="btn btn-ghost btn-sm"
								title="AI SQL Assistant"
								:disabled="!isAIConfigured()"
							>
								<svg
									fill="currentColor"
									class="h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 576 512"
								>
									<path
										d="M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z"
									/>
								</svg>
							</button>
						</div>

						<div
							class="tooltip tooltip-left"
							data-tip="Open Scratches"
						>
							<button
								@click="toggleScratchPanel"
								class="btn btn-ghost btn-sm"
								title="SQL Scratches"
								:class="{
									'btn-active': sqlScratchService.isOpen
								}"
							>
								<svg
									fill="currentColor"
									class="h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 576 512"
								>
									<path
										d="M0 96C0 60.7 28.7 32 64 32l448 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96zM128 288a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm32-128a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM128 384a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm96-248c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0z"
									/>
								</svg>
							</button>
						</div>

						<div
							class="tooltip tooltip-left"
							data-tip="Save as Scratch"
						>
							<button
								@click="saveSqlAsScratch"
								class="btn btn-ghost btn-sm"
								title="Save as Scratch"
							>
								<svg
									fill="currentColor"
									class="h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 448 512"
								>
									<path
										d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-242.7c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32L64 32zm0 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-64zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"
									/>
								</svg>
							</button>
						</div>
					</div>
				</template>
			</BaseHeader>

			<div class="flex h-[calc(100%-4rem)] w-full overflow-hidden">
				<div
					ref="editorContainer"
					class="flex h-full w-full flex-col overflow-hidden"
				>
					<div
						ref="editorSection"
						class="bg-base-200 w-full"
					>
						<SQLEditor
							ref="sqlEditorRef"
							v-model="sqlQuery"
							class="h-full w-full"
							@explain-sql="handleExplainSQL"
							@processing-state="
								(state) => (isProcessing = state)
							"
						/>
					</div>

					<div
						ref="resizer"
						class="bg-base-300 hover:bg-primary active:bg-primary flex h-1 w-full cursor-row-resize items-center justify-center"
					>
						<div
							class="bg-base-content h-1 w-32 rounded-full opacity-50"
						></div>
					</div>

					<div
						ref="resultSection"
						class="bg-base-100 w-full overflow-auto"
					>
						<div
							v-if="sqlResultsStore.isLoading"
							class="flex h-full w-full items-center justify-center"
						>
							<span
								class="loading loading-spinner loading-md"
							></span>
						</div>

						<div
							v-else-if="sqlResultsStore.error"
							class="bg-base-200 border-base-300 m-4 rounded-md border p-4 shadow"
						>
							<div class="mb-2 flex items-center">
								<svg
									class="text-error mr-2 h-5 w-5"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
									/>
								</svg>
								<h3 class="text-lg font-bold">SQL Error</h3>
							</div>

							<div
								class="bg-base-100 border-base-300 mt-3 rounded-md border p-3"
							>
								<pre
									class="text-error font-mono text-sm whitespace-pre-wrap"
									>{{ sqlResultsStore.error }}</pre
								>
							</div>
						</div>

						<div
							v-else-if="sqlResultsStore.results.length > 0"
							class="flex h-full w-full flex-col"
						>
							<div class="flex-1 overflow-auto">
								<div
									v-if="
										sqlResultsStore.results.length === 1 &&
										'affectedRows' in
											sqlResultsStore.results[0]
									"
									class="bg-base-200 border-base-300 m-4 rounded-md border p-4 shadow"
								>
									<div class="mb-2 flex items-center">
										<svg
											class="text-success mr-2 h-5 w-5"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										<h3 class="text-lg font-bold">
											Query Executed Successfully
										</h3>
									</div>

									<div class="mt-3 grid grid-cols-2 gap-4">
										<div
											class="bg-base-100 border-base-300 rounded-md border p-3"
										>
											<div
												class="text-base-content/60 mb-1 text-sm"
											>
												Affected Rows
											</div>
											<div class="text-xl font-semibold">
												{{
													sqlResultsStore.results[0]
														.affectedRows
												}}
											</div>
										</div>

										<div
											v-if="
												'changedRows' in
												sqlResultsStore.results[0]
											"
											class="bg-base-100 border-base-300 rounded-md border p-3"
										>
											<div
												class="text-base-content/60 mb-1 text-sm"
											>
												Changed Rows
											</div>
											<div class="text-xl font-semibold">
												{{
													sqlResultsStore.results[0]
														.changedRows
												}}
											</div>
										</div>
									</div>
								</div>
								<div
									v-else-if="
										sqlResultsStore.columns.length > 0 &&
										sqlResultsStore.results.length === 0
									"
									class="bg-base-200 border-base-300 m-4 rounded-md border p-4 shadow"
								>
									<div class="mb-2 flex items-center">
										<svg
											class="text-info mr-2 h-5 w-5"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
											/>
										</svg>
										<h3 class="text-lg font-bold">
											Query Executed Successfully
										</h3>
									</div>
									<p class="mt-2">
										The query executed successfully but
										returned no results.
									</p>
									<p class="mt-1 text-sm opacity-70">
										Your query ran without errors, but no
										records matched the criteria.
									</p>
								</div>
								<DataTable
									v-else
									:columns="sqlResultsStore.columns"
									:data="tableData"
									:tableName="'query-results'"
									:isLoading="false"
									:disableSelection="true"
									:selected-table-sort="currentSortColumn"
									:sort-direction="currentSortDirection"
									@sort="handleSort"
									class="h-full"
								/>
							</div>

							<SQLPaginator
								v-if="
									!(
										sqlResultsStore.results.length === 1 &&
										'affectedRows' in
											sqlResultsStore.results[0]
									) && sqlResultsStore.columns.length > 0
								"
								:total-records="totalRecords"
								v-model:current-page="currentPage"
								v-model:rows-per-page="rowsPerPage"
								:query-time="sqlResultsStore.lastQueryTime"
							/>
						</div>

						<div
							v-else-if="
								sqlResultsStore.success &&
								sqlResultsStore.results.length === 0
							"
							class="bg-base-200 border-base-300 m-4 rounded-md border p-4 shadow"
						>
							<div class="mb-2 flex items-center">
								<svg
									class="text-info mr-2 h-5 w-5"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
									/>
								</svg>
								<h3 class="text-lg font-bold">
									Query Executed Successfully
								</h3>
							</div>
							<p class="mt-2">
								The query executed successfully but returned no
								results.
							</p>
							<p class="mt-1 text-sm opacity-70">
								Your query ran without errors, but no records
								matched the criteria.
							</p>
							<div
								v-if="sqlResultsStore.lastQueryTime"
								class="text-base-content/60 mt-3 text-xs"
							>
								Query time:
								{{ sqlResultsStore.lastQueryTime }}ms
							</div>
						</div>

						<div
							v-else
							class="bg-base-200 flex h-full w-full items-center justify-center rounded-md p-4"
						>
							<p class="text-sm opacity-50">
								Execute a query to see results
							</p>
						</div>
					</div>
				</div>

				<transition name="slide">
					<SQLScratchSidebar
						v-if="sqlScratchService.isOpen"
						:projectId="projectId"
					/>
				</transition>
			</div>

			<DatabaseSchemaViewer
				:show="showSchemaModal"
				:schema-data="databaseSchema || { tables: [] }"
				@close="showSchemaModal = false"
			/>

			<SQLAIModal
				:show="showAIModal"
				:database-schema="getCompactSchema() || ''"
				@close="closeAIModal"
				@apply-sql="applySqlFromAI"
			/>

			<SQLExplainModal
				:show="showExplainModal"
				:explain-data="explainData"
				@close="closeExplainModal"
			/>
		</template>
	</div>
</template>

<style scoped>
#editorSection,
#resultSection {
	transition: height 0.1s ease;
}

:deep(.resize-active) #editorSection,
:deep(.resize-active) #resultSection {
	transition: none;
}

.slide-enter-active,
.slide-leave-active {
	transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
	transform: translateX(100%);
}
</style>
