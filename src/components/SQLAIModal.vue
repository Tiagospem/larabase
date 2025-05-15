<script setup lang="ts">
import { ref, computed } from 'vue';
import Modal from '@/components/Modal.vue';
import { AIService } from '@/services/aiService';

const props = defineProps<{
	show: boolean;
	databaseSchema: string;
}>();

const emit = defineEmits(['close', 'apply-sql']);

const prompt = ref('');
const response = ref('');
const isLoading = ref(false);
const error = ref('');

const aiService = AIService.getInstance();

const isDisabled = computed(() => {
	return !prompt.value.trim() || isLoading.value;
});

const handleClose = () => {
	emit('close');
};

const applySql = () => {
	const sqlCode = extractSqlCode(response.value);

	if (sqlCode) {
		emit('apply-sql', sqlCode);
		handleClose();
	}
};

const extractSqlCode = (text: string): string => {
	const sqlCodeBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/);
	if (sqlCodeBlockMatch && sqlCodeBlockMatch[1]) {
		return sqlCodeBlockMatch[1].trim();
	}

	const sqlPatterns = [
		/SELECT[\s\S]*?FROM[\s\S]*?;/i,
		/INSERT INTO[\s\S]*?;/i,
		/UPDATE[\s\S]*?SET[\s\S]*?;/i,
		/DELETE FROM[\s\S]*?;/i,
		/CREATE TABLE[\s\S]*?;/i,
		/ALTER TABLE[\s\S]*?;/i
	];

	for (const pattern of sqlPatterns) {
		const match = text.match(pattern);
		if (match) {
			return match[0].trim();
		}
	}

	return text;
};

const generateSql = async () => {
	if (isDisabled.value) return;

	isLoading.value = true;
	error.value = '';
	response.value = '';

	try {
		const settings = JSON.parse(localStorage.getItem('settings') || '{}');
		const language = settings.language || 'en';

		const result = await aiService.generateSQLFromPrompt(
			prompt.value,
			props.databaseSchema,
			language
		);

		if (result.error) {
			error.value = result.error;
		} else {
			response.value = result.content;
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : String(err);
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<Modal
		:show="show"
		title="SQL AI Assistant"
		width="max-w-3xl"
		:z-index="50"
		@close="handleClose"
		:show-action-button="false"
		:show-footer="false"
	>
		<div class="space-y-4">
			<div>
				<label class="label">
					<span class="label-text"
						>What SQL query would you like to generate?</span
					>
				</label>
				<textarea
					v-model="prompt"
					class="textarea textarea-bordered mt-2 h-24 w-full"
					placeholder="e.g., 'Show me all users who have placed more than 5 orders in the last month'"
					@keydown.ctrl.enter="generateSql"
				></textarea>
			</div>

			<div class="flex justify-end">
				<button
					class="btn btn-primary"
					@click="generateSql"
					:disabled="isDisabled"
				>
					<span
						v-if="isLoading"
						class="loading loading-spinner loading-xs mr-2"
					></span>
					Generate SQL
				</button>
			</div>

			<div
				v-if="error"
				class="alert alert-error"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{{ error }}</span>
			</div>

			<div
				v-if="response"
				class="space-y-2"
			>
				<div class="font-semibold">Generated SQL:</div>
				<div
					class="bg-base-300 max-h-96 overflow-auto rounded-lg p-4 text-sm"
				>
					<pre
						class="break-words whitespace-pre-wrap"
					><code>{{ response }}</code></pre>
				</div>
				<div class="mt-2 flex justify-end">
					<button
						class="btn btn-primary"
						@click="applySql"
					>
						Apply SQL
					</button>
				</div>
			</div>
		</div>
	</Modal>
</template>
