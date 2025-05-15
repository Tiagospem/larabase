<script setup lang="ts">
import { inject, onMounted, ref, computed } from 'vue';
import { useProjectStore } from '@/store/project';
import { useConnectionsStore } from '@/store/connections';
import { useTabsStore } from '@/store/tabs';
import { useSidebarStore } from '@/store/sidebar';
import PhpViewer from '@/components/PhpViewer.vue';
import Modal from '@/components/Modal.vue';
import { ModelInfo } from '@/types/project';
import { Table } from '@/types/table';

const showAlert = inject<(message: string, type: string) => void>('showAlert')!;

const props = defineProps<{
	tableName: string;
}>();

const isLoading = ref(true);
const model = ref<ModelInfo | null>(null);
const modelContent = ref('');
const relationships = ref<any[]>([]);
const showCodeModal = ref(false);

const projectStore = useProjectStore();
const connectionStore = useConnectionsStore();
const tabsStore = useTabsStore();
const sidebarStore = useSidebarStore();

const modelFound = computed(() => {
	return model.value !== null;
});

async function loadModel() {
	isLoading.value = true;

	try {
		const project = connectionStore.getSelectedProject;
		if (!project?.id || !project.projectPath) {
			isLoading.value = false;
			return;
		}

		await projectStore.getModelsForTables(project);
		if (projectStore.models && projectStore.models.models) {
			const matchingModel = projectStore.models.models.find(
				(m) => m.table === props.tableName
			);
			model.value = matchingModel || null;

			if (model.value && model.value.path) {
				await loadModelContent(model.value.path);
				extractRelationships();
			}
		}
	} catch (error: any) {
		console.error('Failed to load model:', error);
		showAlert(`Error loading model: ${error.message}`, 'error');
		model.value = null;
	} finally {
		isLoading.value = false;
	}
}

async function loadModelContent(filePath: string) {
	try {
		const result = await window.ipcRenderer.readModelFile(filePath);

		if (result.success) {
			modelContent.value = result.content;
		} else {
			console.error('Error loading model content:', result.message);
			modelContent.value =
				'// Unable to load model content: ' + result.message;
		}
	} catch (error) {
		console.error('Error reading model file:', error);
		modelContent.value = '// Unable to load model content';
	}
}

function extractRelationships() {
	if (!modelContent.value) {
		relationships.value = [];
		return;
	}

	const content = modelContent.value;
	const foundRelationships = [];

	try {
		const relationshipMethods = [
			'hasOne',
			'hasMany',
			'belongsTo',
			'belongsToMany',
			'morphTo',
			'morphOne',
			'morphMany',
			'morphToMany',
			'morphedByMany',
			'hasManyThrough',
			'hasOneThrough'
		];

		relationshipMethods.forEach((relType) => {
			const pattern = new RegExp(
				`function\\s+(\\w+)[^{]*{[^}]*\\$this->\\s*${relType}\\s*\\(`,
				'gi'
			);
			let match;

			while ((match = pattern.exec(content)) !== null) {
				const methodName = match[1];

				const startPos = match.index;
				const relTypePos = content.indexOf(
					`$this->${relType}`,
					startPos
				);
				const paramStart = content.indexOf('(', relTypePos) + 1;
				let paramEnd = paramStart;

				for (let i = paramStart; i < content.length; i++) {
					if (content[i] === ',' || content[i] === ')') {
						paramEnd = i;
						break;
					}
				}

				let relatedModel = content
					.substring(paramStart, paramEnd)
					.trim();
				relatedModel = relatedModel
					.replace(/['"]/g, '')
					.replace(/::class/g, '');

				foundRelationships.push({
					type: relType,
					methodName,
					relatedModel,
					details: 'Method-based relationship'
				});
			}
		});

		relationshipMethods.forEach((relType) => {
			const propPattern = new RegExp(
				`\\$(${relType})\\s*=\\s*\\[([^\\]]+)\\]`,
				'i'
			);
			const propMatch = content.match(propPattern);

			if (propMatch) {
				const modelNames = propMatch[2].match(/['"]([^'"]+)['"]/g);

				if (modelNames) {
					modelNames.forEach((modelNameQuoted) => {
						const modelName = modelNameQuoted.replace(/['"]/g, '');
						foundRelationships.push({
							type: relType,
							methodName: modelName.toLowerCase(),
							relatedModel: modelName,
							details: `Property-based relationship ($${relType})`
						});
					});
				}
			}
		});

		const stringPattern =
			/->(hasOne|hasMany|belongsTo|belongsToMany|morphTo|morphOne|morphMany|morphToMany|morphedByMany|hasManyThrough|hasOneThrough)\s*\(\s*['"]([^'"]+)['"]/gi;
		let stringMatch;

		while ((stringMatch = stringPattern.exec(content)) !== null) {
			const relType = stringMatch[1];
			const relatedModel = stringMatch[2];

			const beforeMatch = content.substring(0, stringMatch.index);
			const methodMatch = beforeMatch.match(
				/function\s+(\w+)[^{]*\{[^{]*$/
			);

			if (methodMatch) {
				const methodName = methodMatch[1];

				foundRelationships.push({
					type: relType,
					methodName,
					relatedModel,
					details: 'String-based relationship'
				});
			}
		}

		relationships.value = [...foundRelationships];
	} catch (error) {
		console.error('Error extracting relationships:', error);
		relationships.value = [];
	}
}

function getRelationshipBadgeClass(type: string) {
	const classes: Record<string, string> = {
		hasOne: 'badge-primary',
		hasMany: 'badge-secondary',
		belongsTo: 'badge-accent',
		belongsToMany: 'badge-info',
		morphTo: 'badge-warning',
		morphOne: 'badge-warning',
		morphMany: 'badge-warning',
		hasManyThrough: 'badge-error',
		hasOneThrough: 'badge-error'
	};

	return classes[type] || 'badge';
}

async function openFileInEditor(filePath: string) {
	try {
		await window.ipcRenderer.openFile(filePath);
	} catch (error) {
		console.error('Error opening file:', error);
		showAlert('Failed to open file', 'error');
	}
}

function viewModelCode() {
	showCodeModal.value = true;
}

async function navigateToRelatedTable(modelName: string) {
	try {
		if (projectStore.models && projectStore.models.models) {
			const relatedModel = projectStore.models.models.find(
				(m) =>
					m.name === modelName ||
					m.fullName.endsWith(`\\${modelName}`)
			);

			if (relatedModel && relatedModel.table) {
				const table = sidebarStore.localTables.find(
					(t: Table) => t.name === relatedModel.table
				);
				if (table) {
					await tabsStore.openTable(table);
					return;
				}
			}
		}

		showAlert(`Could not find table for model '${modelName}'`, 'warning');
	} catch (error) {
		console.error('Error navigating to related table:', error);
		showAlert(`Error navigating to related table: ${error}`, 'error');
	}
}

onMounted(() => {
	loadModel();
});
</script>

<template>
	<div class="flex h-full flex-col overflow-auto">
		<div
			class="border-b-base-300 bg-base-200 flex items-center justify-between border-b p-2"
		>
			<div class="flex items-center space-x-2">
				<button
					class="btn btn-sm btn-ghost"
					@click="loadModel"
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
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
					<span>Refresh</span>
				</button>

				<div
					v-if="modelFound"
					class="flex space-x-2"
				>
					<button
						v-if="model?.path"
						class="btn btn-sm btn-ghost"
						@click="openFileInEditor(model.path)"
						title="Open in editor"
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
								d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
							/>
						</svg>
						<span>Open in Editor</span>
					</button>

					<button
						class="btn btn-sm btn-ghost"
						@click="viewModelCode()"
						title="View Code"
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
								d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
							/>
						</svg>
						<span>View Code</span>
					</button>
				</div>
			</div>

			<div
				v-if="modelFound"
				class="text-xs font-medium"
			>
				<span>{{ model?.name }}</span>
			</div>
		</div>

		<div class="flex-1 overflow-auto">
			<div
				v-if="isLoading"
				class="flex h-full w-full items-center justify-center"
			>
				<div
					class="loading loading-spinner loading-lg text-primary"
				></div>
			</div>

			<div
				v-else-if="!modelFound"
				class="flex h-full w-full items-center justify-center"
			>
				<div class="text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="mx-auto mb-4 h-12 w-12"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
						/>
					</svg>
					<p class="text-sm">
						No Laravel model found for {{ tableName }} table
					</p>
					<p class="text-base-content mt-2 text-xs">
						Models are typically named using singular form or with
						different naming conventions
					</p>
					<button
						v-if="connectionStore.getSelectedProject?.projectPath"
						class="btn btn-sm mt-4"
						@click="loadModel"
					>
						Reload
					</button>
				</div>
			</div>

			<div
				v-else-if="relationships.length > 0"
				class="overflow-x-auto"
			>
				<h4 class="my-2 px-2 text-sm font-medium">
					{{ model?.name }} Relationships
				</h4>
				<table
					class="table-pin-rows table-compact table w-full text-sm"
				>
					<thead class="bg-base-100 sticky top-0 z-10 shadow-md">
						<tr>
							<th>Type</th>
							<th>Related Model</th>
							<th>Method</th>
							<th>Details</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(rel, index) in relationships"
							:key="index"
							class="hover:bg-base-200"
						>
							<td>
								<span
									class="badge badge-xs"
									:class="getRelationshipBadgeClass(rel.type)"
								>
									{{ rel.type }}
								</span>
							</td>
							<td class="font-mono text-xs">
								<div class="flex items-center gap-1">
									{{ rel.relatedModel }}
									<button
										@click="
											navigateToRelatedTable(
												rel.relatedModel
											)
										"
										class="btn btn-ghost btn-xs"
										title="Open related table"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="h-3 w-3"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
											/>
										</svg>
									</button>
								</div>
							</td>
							<td>{{ rel.methodName }}</td>
							<td class="text-xs">{{ rel.details }}</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-else
				class="flex h-full w-full items-center justify-center"
			>
				<div class="text-center">
					<p class="text-sm">
						No relationships found in {{ model?.name }}
					</p>
				</div>
			</div>
		</div>

		<div
			v-if="modelFound"
			class="bg-base-200 flex items-center justify-between border-t border-black/10 px-4 py-2 text-xs"
		>
			<div>{{ tableName }} | {{ model?.name }}</div>
		</div>

		<Modal
			v-if="modelContent"
			:show="showCodeModal"
			:title="`Model Code: ${model?.name}`"
			width="max-w-5xl"
			@close="showCodeModal = false"
		>
			<PhpViewer
				:code="modelContent"
				language="php"
				height="500px"
			/>
		</Modal>
	</div>
</template>

<style scoped>
th,
td {
	white-space: nowrap;
	padding: 0.25rem 0.5rem;
	box-sizing: border-box;
}

.table {
	border-collapse: separate;
	border-spacing: 0;
	width: 100%;
}

.overflow-x-auto {
	width: 100%;
	overflow-x: auto;
}

.flex-1.overflow-auto {
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.table thead th {
	position: sticky;
	top: 0;
	z-index: 10;
	font-weight: normal;
}

.flex.h-full.flex-col.overflow-auto {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.table-pin-rows thead {
	position: sticky;
	top: 0;
	z-index: 10;
}

tbody {
	height: 100%;
	overflow: hidden;
}

.table th:nth-child(2),
.table td:nth-child(2) {
	max-width: 300px;
}

.table th,
.table td {
	width: auto;
}
</style>
