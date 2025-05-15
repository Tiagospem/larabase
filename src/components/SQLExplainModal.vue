<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { AIService } from '@/services/aiService';
  import type { ExplainResult } from '@/composables/useSQLEditor';

  const props = defineProps<{
    show: boolean;
    explainData: ExplainResult;
  }>();

  const emit = defineEmits(['close']);

  const aiService = AIService.getInstance();
  const aiAnalysis = ref<string>('');
  const isLoadingAIAnalysis = ref(false);
  const isQueryExpanded = ref(false);
  const showExplainHelp = ref(false);

  const handleClose = () => {
    emit('close');
  };

  const hasExplainResults = computed(() => {
    return (
      props.explainData && props.explainData.rawExplain && props.explainData.rawExplain.length > 0
    );
  });

  const queryPreview = computed(() => {
    if (!props.explainData?.queryToExplain) return '';

    const query = props.explainData.queryToExplain;
    if (isQueryExpanded.value || query.length <= 150) return query;

    return query.substring(0, 150) + '...';
  });

  const generateAIAnalysis = async () => {
    if (!aiService.isAIConfigured() || !hasExplainResults.value || isLoadingAIAnalysis.value)
      return;

    isLoadingAIAnalysis.value = true;

    try {
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      const language = settings.language || 'en';

      const explainText = JSON.stringify(props.explainData.rawExplain, null, 2);
      const query = props.explainData.queryToExplain;

      const analyzePrompt = `
Query: ${query}

EXPLAIN Results:
${explainText}

Analyze this SQL query execution plan and provide optimization suggestions. Focus on:
1. Potential performance bottlenecks
2. Missing indexes
3. Inefficient joins or filtering
4. Any other improvements that could make this query faster
`;

      const result = await aiService.analyzeSQLExplain(analyzePrompt, language);
      aiAnalysis.value = result.content;
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      aiAnalysis.value =
        'Failed to generate AI analysis. Error: ' +
        (error instanceof Error ? error.message : String(error));
    } finally {
      isLoadingAIAnalysis.value = false;
    }
  };

  watch(
    () => props.show,
    newVal => {
      if (!newVal) {
        aiAnalysis.value = '';
        isQueryExpanded.value = false;
      }
    }
  );

  const formatExecutionStepValue = (value: any): string => {
    if (value === null) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatAIAnalysis = (text: string): string => {
    if (!text) return '';

    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockContent = '';
    let formattedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          formattedLines.push(
            `<pre class="mt-2 mb-3 p-2 bg-base-100 rounded overflow-x-auto text-xs">${codeBlockContent}</pre>`
          );
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }

      if (line.trim().startsWith('#')) {
        const match = line.match(/^#+/);
        const level = match ? match[0].length : 1;
        const title = line.replace(/^#+\s*/, '');
        if (level === 1) {
          formattedLines.push(`<h2 class="text-md font-bold mt-4 mb-3">${title}</h2>`);
        } else if (level === 2) {
          formattedLines.push(`<h3 class="text-sm font-semibold mt-3 mb-2">${title}</h3>`);
        } else {
          formattedLines.push(`<h4 class="text-sm font-medium mt-2 mb-1">${title}</h4>`);
        }
        continue;
      }

      const numberedListMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numberedListMatch) {
        const number = numberedListMatch[1];
        let content = numberedListMatch[2];
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(
          /`([^`]+)`/g,
          '<code class="px-1 py-0.5 bg-base-100 rounded text-xs">$1</code>'
        );
        formattedLines.push(
          `<div class="mb-1 text-sm"><span class="font-bold">${number}.</span> ${content}</div>`
        );
        continue;
      }

      // For empty lines, only add paragraph break if we have multiple consecutive empty lines
      // or it's after a header/list item
      if (line.trim() === '') {
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

        // Only add paragraph breaks for double empty lines or after headers/lists
        const isPrevSpecial = prevLine.startsWith('#') || prevLine.match(/^\d+\.\s/);
        const isDoubleBreak = nextLine === '' || prevLine === '';

        if (isPrevSpecial || isDoubleBreak) {
          if (
            formattedLines.length > 0 &&
            !formattedLines[formattedLines.length - 1].endsWith('</p>')
          ) {
            formattedLines.push('<p class="mb-2 text-sm"></p>');
          }
        }
        continue;
      }

      let formattedLine = line;
      formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedLine = formattedLine.replace(
        /`([^`]+)`/g,
        '<code class="px-1 py-0.5 bg-base-100 rounded text-xs">$1</code>'
      );

      if (
        formattedLines.length === 0 ||
        formattedLines[formattedLines.length - 1].endsWith('</p>')
      ) {
        formattedLines.push(`<p class="mb-2 text-sm">${formattedLine}`);
      } else if (
        !formattedLines[formattedLines.length - 1].startsWith('<h') &&
        !formattedLines[formattedLines.length - 1].startsWith('<div') &&
        !formattedLines[formattedLines.length - 1].startsWith('<pre')
      ) {
        // Append to existing paragraph instead of creating new one
        formattedLines[formattedLines.length - 1] += ' ' + formattedLine;
      } else {
        formattedLines.push(`<p class="mb-2 text-sm">${formattedLine}`);
      }
    }

    if (
      formattedLines.length > 0 &&
      !formattedLines[formattedLines.length - 1].endsWith('</p>') &&
      formattedLines[formattedLines.length - 1].startsWith('<p')
    ) {
      formattedLines[formattedLines.length - 1] += '</p>';
    }

    return formattedLines.join('\n');
  };

  const isProblematicRow = (row: any): boolean => {
    if (row.type === 'ALL') {
      return true;
    }

    if (row.Extra && typeof row.Extra === 'string') {
      if (row.Extra.includes('Using filesort') || row.Extra.includes('Using temporary')) {
        return true;
      }
    }

    if (row.rows && parseInt(row.rows) > 1000) {
      return true;
    }

    return false;
  };

  const isProblematicValue = (key: any, value: any): boolean => {
    if (value === null) return false;

    const stringValue = String(value);
    const keyString = String(key);

    switch (keyString.toLowerCase()) {
      case 'type':
        return ['all'].includes(stringValue.toLowerCase());

      case 'key':
        return stringValue === 'NULL' || stringValue === '';

      case 'extra':
        return stringValue.includes('Using filesort') || stringValue.includes('Using temporary');

      case 'rows':
        return parseInt(stringValue, 10) > 1000;

      default:
        return false;
    }
  };
</script>

<template>
  <Modal
    :show="show"
    title="SQL Query Execution Plan"
    width="max-w-[90%]"
    :z-index="50"
    @close="handleClose"
    :show-action-button="false"
    :show-footer="false"
  >
    <div class="space-y-6">
      <div class="bg-base-100 border-base-300 rounded-md border p-4 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Original Query</h3>
          <button
            v-if="explainData?.queryToExplain?.length > 150"
            @click="isQueryExpanded = !isQueryExpanded"
            class="btn btn-xs"
          >
            {{ isQueryExpanded ? 'Collapse' : 'Expand' }}
          </button>
        </div>
        <div class="bg-base-300 relative rounded-md p-3">
          <pre
            class="overflow-x-auto text-sm"
            :class="{ 'max-h-40': !isQueryExpanded && explainData?.queryToExplain?.length > 150 }"
            >{{ queryPreview }}</pre
          >
        </div>
      </div>

      <div
        v-if="explainData.isExplaining"
        class="bg-base-100 border-base-300 flex flex-col items-center justify-center rounded-md border p-4 py-6"
      >
        <span class="loading loading-spinner loading-md mb-2"></span>
        <p class="text-sm opacity-80">Analyzing query execution plan...</p>
      </div>

      <div v-else-if="explainData.error" class="bg-base-100 alert alert-error rounded-md p-4">
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
        <span>{{ explainData.error }}</span>
      </div>

      <div
        v-else-if="hasExplainResults"
        class="bg-base-100 border-base-300 rounded-md border p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Execution Plan</h3>
          <button @click="showExplainHelp = !showExplainHelp" class="btn btn-xs">
            {{ showExplainHelp ? 'Hide Help' : 'Understanding EXPLAIN' }}
          </button>
        </div>

        <div v-if="showExplainHelp" class="bg-base-200 mb-4 rounded-md p-3 text-sm">
          <div class="mb-2 font-semibold">Key column explanations:</div>
          <ul class="list-disc space-y-1 pl-5">
            <li>
              <strong>type</strong>: Join type, ordered from best to worst: system, const, eq_ref,
              ref, range, index, ALL
            </li>
            <li><strong>key</strong>: The index MySQL actually decided to use</li>
            <li><strong>rows</strong>: Estimated number of rows that need to be examined</li>
            <li>
              <strong>filtered</strong>: Estimated percentage of rows that will be filtered by
              conditions
            </li>
            <li>
              <strong>Extra</strong>: Additional information about how MySQL executes the query
            </li>
          </ul>

          <div class="mt-3 mb-2 font-semibold">Common issues to watch for:</div>
          <ul class="list-disc space-y-1 pl-5">
            <li>
              <strong>Using filesort</strong>: MySQL needs an extra pass to sort results,
              potentially slow
            </li>
            <li>
              <strong>Using temporary</strong>: MySQL needs to create a temporary table to hold
              results
            </li>
            <li><strong>Using where</strong>: A WHERE clause is used to filter results</li>
            <li><strong>ALL</strong> in type column: Full table scan, usually inefficient</li>
            <li>Large numbers in <strong>rows</strong> column: Many rows need to be examined</li>
          </ul>

          <div class="mt-3 mb-2 font-semibold">Optimization tips:</div>
          <ul class="list-disc space-y-1 pl-5">
            <li>Add indexes for columns used in JOIN, WHERE, ORDER BY, and GROUP BY clauses</li>
            <li>Use ANALYZE TABLE to update table statistics</li>
            <li>Ensure columns being compared have the same type and size</li>
            <li>Avoid full table scans (type: ALL) when possible</li>
          </ul>
        </div>

        <div class="border-base-300 overflow-hidden rounded-md border">
          <div class="h-[400px] overflow-auto">
            <table class="table-compact table-xs w-full border-collapse">
              <thead class="bg-base-300 sticky top-0 z-10 shadow-md">
                <tr>
                  <th
                    v-for="(_, key) in explainData.rawExplain[0]"
                    :key="key"
                    class="px-2 py-1 text-left text-xs font-medium whitespace-nowrap"
                  >
                    {{ key }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in explainData.rawExplain"
                  :key="index"
                  :class="{ 'bg-error bg-opacity-20 text-white': isProblematicRow(row) }"
                  class="border-base-200 border-b"
                >
                  <td
                    v-for="(value, key) in row"
                    :key="key"
                    class="overflow-hidden px-2 py-1 text-xs whitespace-nowrap"
                    :class="{
                      'text-error font-bold':
                        !isProblematicRow(row) && isProblematicValue(key, String(value)),
                      'font-bold': isProblematicRow(row) && isProblematicValue(key, String(value)),
                    }"
                    :title="value !== null ? String(value) : 'NULL'"
                  >
                    {{ value !== null ? value : 'NULL' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="bg-base-300 flex items-center px-2 py-1 text-xs opacity-80">
            <div class="bg-error mr-1 h-3 w-3 rounded-full"></div>
            <span>Highlighted items indicate potential performance issues</span>
          </div>
        </div>
      </div>

      <div v-else class="bg-base-100 alert alert-info border-base-300 rounded-md border p-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="h-6 w-6 shrink-0 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>No execution plan data available</span>
      </div>

      <div class="bg-base-100 border-base-300 rounded-md border p-4 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">AI Analysis</h3>
          <div class="flex items-center gap-2">
            <div v-if="!aiService.isAIConfigured()" class="badge badge-warning badge-sm">
              AI not configured
            </div>
            <button
              v-if="hasExplainResults && !aiAnalysis && !isLoadingAIAnalysis"
              @click="generateAIAnalysis"
              class="btn btn-sm"
              :disabled="!aiService.isAIConfigured()"
            >
              Request AI Analysis
            </button>
          </div>
        </div>

        <div v-if="isLoadingAIAnalysis" class="flex flex-col items-center justify-center py-6">
          <span class="loading loading-spinner loading-md mb-2"></span>
          <p class="text-sm opacity-80">Generating AI analysis...</p>
        </div>

        <div v-else-if="aiAnalysis" class="bg-base-300 prose prose-sm max-w-none rounded-md p-4">
          <div v-html="formatAIAnalysis(aiAnalysis)" class="ai-analysis-content"></div>
        </div>

        <div
          v-else-if="!aiService.isAIConfigured() && hasExplainResults"
          class="bg-base-300 rounded-md p-4 text-sm opacity-80"
        >
          <p>
            Configure an AI provider in settings to get intelligent optimization suggestions for
            your query.
          </p>
        </div>

        <div
          v-else-if="hasExplainResults && !isLoadingAIAnalysis && !aiAnalysis"
          class="bg-base-300 rounded-md p-4 text-sm"
        >
          <p>Click "Request AI Analysis" to get optimization suggestions for your query.</p>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  .ai-analysis-content :deep(p) {
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }

  .ai-analysis-content :deep(h2),
  .ai-analysis-content :deep(h3),
  .ai-analysis-content :deep(h4) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .ai-analysis-content :deep(code) {
    white-space: nowrap;
  }

  .prose :deep(br) {
    content: '';
    margin-top: 0.25em;
    display: block;
  }
</style>
