<template>
  <div class="flex flex-col h-full">
    <!-- Componente para capturar erros -->
    <div v-if="hasRenderError" class="p-8 bg-error/10 text-error flex flex-col items-center justify-center h-full">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mb-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h2 class="text-xl font-bold mb-2">Erro de Renderização</h2>
      <p class="mb-4">Ocorreu um erro ao carregar esta página.</p>
      <pre class="bg-base-300 p-3 rounded text-sm mb-4 max-w-full overflow-auto">{{ renderErrorMessage }}</pre>
      <button class="btn btn-primary" @click="resetComponent">Tentar Novamente</button>
    </div>

    <template v-if="!hasRenderError">
      <!-- Header -->
      <header class="bg-neutral px-4 py-2 border-b border-neutral flex items-center justify-between">
        <div class="flex items-center">
          <button
            class="btn btn-ghost btn-sm mr-2"
            @click="goBack"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
          </button>

          <div
            class="w-8 h-8 rounded-full flex items-center justify-center mr-2"
            :class="getConnectionColor(connection?.type)"
          >
            <span class="text-white font-bold text-sm">{{ connection?.icon }}</span>
          </div>

          <div>
            <h1 class="text-lg font-semibold">Query Explain Tool - {{ connection?.name }}</h1>
            <div class="text-xs text-gray-400">
              {{ connection?.database || connection?.path }}
            </div>
          </div>
        </div>

        <div class="flex">
          <button
            v-if="!hasResults"
            class="btn btn-primary btn-sm mr-2"
            @click="analyzeQuery"
            :disabled="!queryToAnalyze.trim() || isLoading"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4 mr-1"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
              />
            </svg>
            Analyze Performance
          </button>
          <button
            v-if="hasResults"
            class="btn btn-primary btn-sm mr-2"
            @click="newAnalysis"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Analysis
          </button>
          <button
            v-if="!hasResults"
            class="btn btn-ghost btn-sm"
            @click="clearQuery"
            :disabled="!queryToAnalyze.trim() || isLoading"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4 mr-1"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
            Clear
          </button>
        </div>
      </header>

      <!-- Main Content Area -->
      <div class="flex flex-col flex-1 overflow-auto p-6">
        <!-- SQL Input Mode -->
        <div v-if="!hasResults" class="flex flex-col">
          <div
            class="bg-base-100 overflow-hidden flex flex-col rounded-lg shadow-md"
            :style="{ height: `${editorHeight}px` }"
          >
            <div class="p-3 text-sm font-semibold border-b border-neutral flex justify-between">
              <span>SQL Query to Analyze</span>
              <div class="flex items-center">
                <button
                  class="btn btn-xs btn-ghost"
                  @click="toggleEditorFullscreen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      v-if="isEditorFullscreen"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 9V4.5M9 9H4.5M15 9H19.5M15 9V4.5M15 14.5V19.5M15 14.5H19.5M9 14.5H4.5M9 14.5V19.5"
                    />
                    <path
                      v-else
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <textarea
              v-model="queryToAnalyze"
              class="w-full h-full p-4 resize-none bg-base-200 text-base-content font-mono text-sm focus:outline-none"
              placeholder="Enter your SQL query here (e.g., SELECT * FROM table WHERE column = value)"
              @keydown.tab.prevent="handleTab"
            />
          </div>
        </div>

        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="flex-1 flex flex-col items-center justify-center"
        >
          <span class="loading loading-spinner loading-lg mb-4"></span>
          <p class="text-base-content">Analyzing query performance...</p>
        </div>

        <!-- Error State -->
        <div
          v-else-if="errorMessage"
          class="flex-1 flex items-center justify-center text-error"
        >
          <div class="text-center p-8 bg-base-100 rounded-lg shadow-md max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-12 h-12 mx-auto mb-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p>{{ errorMessage }}</p>
            <button
              class="btn btn-sm btn-primary mt-4"
              @click="newAnalysis"
            >
              Try Again
            </button>
          </div>
        </div>

        <!-- Results Mode -->
        <div v-else-if="hasResults" class="flex flex-col space-y-6">
          <!-- Formatted Query -->
          <div class="bg-base-100 rounded-lg shadow-md p-4">
            <div class="flex justify-between items-center mb-2">
              <h2 class="text-lg font-semibold text-base-content">SQL Query</h2>
              <button 
                class="btn btn-xs btn-ghost text-base-content" 
                @click="copyToClipboard(queryToAnalyze)"
                title="Copy SQL to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
            <pre class="bg-base-200 p-3 rounded-md overflow-x-auto text-sm"><code class="hljs" v-html="formattedQuery"></code></pre>
          </div>

          <!-- Execution Plan Results -->
          <div ref="resultTableRef" class="bg-base-100 rounded-lg shadow-md p-4">
            <h2 class="text-lg font-semibold text-base-content mb-3">Execution Plan</h2>
            <div class="overflow-x-auto">
              <table class="min-w-full bg-base-100 rounded-lg">
                <thead>
                  <tr class="bg-base-200">
                    <th v-for="column in explainColumns" :key="column" class="p-3 text-left text-xs font-semibold text-base-content uppercase tracking-wider">
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in explainResults" :key="index" class="border-t border-neutral">
                    <td v-for="column in explainColumns" :key="`${index}-${column}`" class="p-3 text-sm text-base-content max-w-xs overflow-hidden overflow-ellipsis whitespace-nowrap">
                      {{ row[column] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Performance Insights -->
          <div v-if="performanceInsights.length > 0" class="bg-base-100 rounded-lg shadow-md p-4">
            <h2 class="text-lg font-semibold text-base-content mb-3">Performance Insights</h2>
            <div class="space-y-4">
              <div v-for="(insight, index) in performanceInsights" :key="index" class="flex items-start">
                <div class="flex-shrink-0">
                  <div v-if="insight.severity === 'high'" class="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
                    <svg class="h-5 w-5 text-error" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div v-else-if="insight.severity === 'medium'" class="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                    <svg class="h-5 w-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div v-else class="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <svg class="h-5 w-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div class="ml-4 flex-1">
                  <h3 class="text-base font-medium text-base-content">{{ insight.title }}</h3>
                  <p class="mt-1 text-sm text-base-content opacity-70">{{ insight.description }}</p>
                  <div v-if="insight.recommendation" class="mt-2 bg-base-300 p-3 rounded-md font-mono text-sm">
                    {{ insight.recommendation }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Analysis -->
          <div v-if="aiEnabled && !isAiLoading && aiAnalysis" class="bg-base-100 rounded-lg shadow-md p-4">
            <div class="flex justify-between items-center mb-3">
              <h2 class="text-lg font-semibold text-base-content">AI Analysis</h2>
              <button 
                class="btn btn-xs btn-ghost text-base-content" 
                @click="copyToClipboard(aiAnalysis)"
                title="Copy analysis to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
            <div v-html="formattedAiAnalysis" class="prose prose-sm max-w-none"></div>
          </div>

          <!-- AI Analysis Loading -->
          <div v-if="aiEnabled && isAiLoading" class="bg-base-100 rounded-lg shadow-md p-6">
            <div class="flex flex-col items-center justify-center">
              <span class="loading loading-spinner loading-md mb-4"></span>
              <p class="text-base-content">Analyzing query execution plan with AI...</p>
            </div>
          </div>

          <!-- AI Analysis Button -->
          <div v-if="aiEnabled && !isAiLoading && !aiAnalysis" class="bg-base-100 rounded-lg shadow-md p-6">
            <div class="text-center">
              <p class="mb-4 text-base-content opacity-70">Get advanced AI analysis of your query execution plan to identify optimization opportunities.</p>
              <button
                class="btn btn-primary"
                @click="analyzeWithAI"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                Analyze with AI
              </button>
            </div>
          </div>
        </div>
        
        <!-- Empty State (when no results and not loading) -->
        <div 
          v-else-if="!hasResults && !isLoading && !errorMessage" 
          class="flex-1 flex items-center justify-center text-base-content opacity-70"
        >
          <div class="text-center p-8 bg-base-100 rounded-lg shadow-md max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-12 h-12 mx-auto mb-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p>Enter a SQL query and click "Analyze Performance" to see the execution plan</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, nextTick, markRaw, onErrorCaptured } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";
import { useDatabaseStore } from "@/store/database";
import { useSettingsStore } from "@/store/settings";
import { analyzeExplainWithAI } from "@/services/ai/ExplainAnalysisService";
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('sql', sql);

const route = useRoute();
const router = useRouter();
const connectionId = computed(() => route.params.id);
const showAlert = inject("showAlert");
const connectionsStore = useConnectionsStore();
const databaseStore = useDatabaseStore();
const settingsStore = useSettingsStore();

const hasRenderError = ref(false);
const renderErrorMessage = ref("");

const queryToAnalyze = ref("");
const explainResults = ref([]);
const explainColumns = ref([]);
const isLoading = ref(false);
const errorMessage = ref("");
const editorHeight = ref(window.innerHeight * 0.35);
const isResizing = ref(false);
const isEditorFullscreen = ref(false);
const performanceInsights = ref([]);
const aiAnalysis = ref("");
const isAiLoading = ref(false);

const resultTableRef = ref(null);

onErrorCaptured((error, instance, info) => {
  console.error("Erro capturado:", error, info);
  hasRenderError.value = true;
  renderErrorMessage.value = `${error.message}\n\nInfo: ${info}`;
  return false;
});

function resetComponent() {
  hasRenderError.value = false;
  renderErrorMessage.value = "";    
  explainResults.value = [];
  explainColumns.value = [];
  performanceInsights.value = [];
  aiAnalysis.value = "";
  errorMessage.value = "";
}

const aiEnabled = computed(() => {
  const settings = settingsStore.settings;
  return (
    (settings.aiProvider === "openai" && settings.openai?.apiKey) ||
    (settings.aiProvider === "gemini" && settings.gemini?.apiKey)
  );
});

const formattedAiAnalysis = computed(() => {
  if (!aiAnalysis.value) return "";
  try {
    return marked(aiAnalysis.value);
  } catch (error) {
    console.error("Error formatting AI analysis:", error);
    return aiAnalysis.value;
  }
});

const hasResults = computed(() => {
  return explainResults.value.length > 0 && explainColumns.value.length > 0;
});

function formatSql(sql) {
  if (!sql) return "";
  
  return sql.replace(/\s+/g, ' ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*=\s*/g, ' = ')
            .replace(/\s*>\s*/g, ' > ')
            .replace(/\s*<\s*/g, ' < ')
            .replace(/\s*(\()\s*/g, ' $1')
            .replace(/\s*(\))\s*/g, '$1 ')
            .replace(/\bSELECT\b/gi, 'SELECT\n  ')
            .replace(/\bFROM\b/gi, '\nFROM\n  ')
            .replace(/\bWHERE\b/gi, '\nWHERE\n  ')
            .replace(/\bAND\b/gi, '\n  AND ')
            .replace(/\bOR\b/gi, '\n  OR ')
            .replace(/\bORDER BY\b/gi, '\nORDER BY\n  ')
            .replace(/\bGROUP BY\b/gi, '\nGROUP BY\n  ')
            .replace(/\bLIMIT\b/gi, '\nLIMIT ');
}

const formattedQuery = computed(() => {
  if (!queryToAnalyze.value) return "";
  
  try {
    const formattedSql = formatSql(queryToAnalyze.value);
    return hljs.highlight(formattedSql, {language: 'sql'}).value;
  } catch (error) {
    console.error("Failed to format SQL:", error);
    return queryToAnalyze.value;
  }
});

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

onMounted(async () => {
  console.log("ExplainView mounted");
  
  if (!route.params.id) {
    console.log("No connection ID, redirecting to home");
    router.push("/");
    return;
  }

  window.addEventListener("resize", handleWindowResize);
});

function goBack() {
  router.push(`/database/${connectionId.value}`);
}

function getConnectionColor(type) {
  switch (type) {
    case "mysql":
      return "bg-orange-500";
    case "pgsql":
      return "bg-indigo-600";
    case "sqlite":
      return "bg-green-600";
    default:
      return "bg-gray-600";
  }
}

function toggleEditorFullscreen() {
  isEditorFullscreen.value = !isEditorFullscreen.value;

  if (isEditorFullscreen.value) {
    editorHeight.value = window.innerHeight - 100;
  } else {
    editorHeight.value = window.innerHeight * 0.35;
  }
}

function handleWindowResize() {
  if (isEditorFullscreen.value) {
    editorHeight.value = window.innerHeight - 100;
  }
}

function handleTab(e) {
  const start = e.target.selectionStart;
  const end = e.target.selectionEnd;

  queryToAnalyze.value = queryToAnalyze.value.substring(0, start) + "  " + queryToAnalyze.value.substring(end);

  nextTick(() => {
    e.target.selectionStart = e.target.selectionEnd = start + 2;
  });
}

function startResize(e) {
  isResizing.value = true;
  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);
}

function onResize(e) {
  if (isResizing.value) {
    const minHeight = 100;
    const maxHeight = window.innerHeight - 200;

    editorHeight.value = Math.max(minHeight, Math.min(maxHeight, e.clientY - 60));
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
}

function clearQuery() {
  queryToAnalyze.value = "";
  explainResults.value = [];
  explainColumns.value = [];
  performanceInsights.value = [];
  errorMessage.value = "";
}

function newAnalysis() {
  clearQuery();
  aiAnalysis.value = "";
}

async function analyzeQuery() {
  if (!queryToAnalyze.value.trim()) {
    showAlert("Please enter a SQL query to analyze", "error");
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  explainResults.value = [];
  performanceInsights.value = [];
  aiAnalysis.value = "";

  try {
    const explainQuery = `EXPLAIN ${queryToAnalyze.value}`;
    const result = await window.api.executeSQLQuery({
      connectionId: connectionId.value,
      query: explainQuery
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to analyze query");
    }

    explainResults.value = result.results;
    
    if (explainResults.value.length > 0) {
      explainColumns.value = Object.keys(explainResults.value[0]);
    }

    generatePerformanceInsights();

    setTimeout(() => {
      if (resultTableRef.value) {
        resultTableRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);

  } catch (error) {
    console.error("Error analyzing query:", error);
    errorMessage.value = error.message || "Failed to analyze query";
  } finally {
    isLoading.value = false;
  }
}

function generatePerformanceInsights() {
  performanceInsights.value = [];
  
  for (const row of explainResults.value) {
    if (row.type === 'ALL') {
      performanceInsights.value.push({
        severity: 'high',
        title: 'Full Table Scan Detected',
        description: `The query is performing a full table scan on table ${row.table}, which can be inefficient for large tables.`,
        recommendation: 'Consider adding an index on columns used in WHERE clauses or JOIN conditions.'
      });
    }
    
    if (row.type === 'ALL' && row.Extra?.includes('Using join buffer')) {
      performanceInsights.value.push({
        severity: 'high',
        title: 'Missing Index for Join',
        description: `The join with table ${row.table} is not using an index, which can slow down the query.`,
        recommendation: 'Add an index on the join columns to improve performance.'
      });
    }
    
    if (row.Extra?.includes('Using temporary')) {
      performanceInsights.value.push({
        severity: 'medium',
        title: 'Temporary Table Created',
        description: 'The query requires a temporary table, which can impact performance.',
        recommendation: 'Consider simplifying the query or adding indexes on sort/group columns.'
      });
    }
    
    if (row.Extra?.includes('Using filesort')) {
      performanceInsights.value.push({
        severity: 'medium',
        title: 'Filesort Detected',
        description: 'The query is using filesort which can be slow for large result sets.',
        recommendation: 'Add an index that covers both your WHERE conditions and ORDER BY clauses.'
      });
    }
  }
  
  if (performanceInsights.value.length === 0) {
    performanceInsights.value.push({
      severity: 'low',
      title: 'Query Appears Efficient',
      description: 'No major performance issues were detected in the execution plan.',
      recommendation: null
    });
  }
}

function getRowClass(row) {
  if (row.type === 'ALL') {
    return 'bg-red-800/10';
  } else if (row.key === null) {
    return 'bg-yellow-800/10';
  }
  return '';
}

function getInsightSeverityClass(severity) {
  switch (severity) {
    case 'high':
      return 'bg-red-600';
    case 'medium':
      return 'bg-yellow-600';
    case 'low':
      return 'bg-green-600';
    default:
      return 'bg-blue-600';
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showAlert('Copied to clipboard', 'success');
    })
    .catch(err => {
      console.error('Failed to copy text: ', err);
      showAlert('Failed to copy to clipboard', 'error');
    });
}

async function analyzeWithAI() {
  if (!explainResults.value.length || !explainColumns.value.length) {
    showAlert("No EXPLAIN results to analyze", "error");
    return;
  }

  isAiLoading.value = true;
  aiAnalysis.value = "";

  try {
    const explainData = {
      query: queryToAnalyze.value,
      results: explainResults.value,
      columns: explainColumns.value,
      insights: performanceInsights.value
    };

    const analysis = await analyzeExplainWithAI(explainData);
    aiAnalysis.value = analysis;
  } catch (error) {
    console.error("Error analyzing with AI:", error);
    showAlert(`AI Analysis error: ${error.message}`, "error");
  } finally {
    isAiLoading.value = false;
  }
}
</script>

<style>
@import 'highlight.js/styles/atom-one-dark.css';
</style>

<style scoped>
table {
  border-spacing: 0;
}

th,
td {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.5);
  border-radius: 4px;
  transition: background 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(200, 200, 200, 0.7);
}

:deep(.prose) {
  max-width: none;
  color: inherit;
}

:deep(.prose pre) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
}

:deep(.prose code) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-weight: normal;
}

:deep(.prose h1, .prose h2, .prose h3, .prose h4) {
  color: inherit;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

:deep(.prose p, .prose ul, .prose ol) {
  margin-top: 1em;
  margin-bottom: 1em;
}

pre {
  margin: 0;
}

code.hljs {
  padding: 0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
}
</style> 