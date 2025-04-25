<template>
  <div class="modal modal-open z-30">
    <div class="modal-box w-11/12 max-w-3xl bg-base-300">
      <h3 class="font-bold text-lg mb-4">SQL-to-Eloquent Converter</h3>

      <!-- User Input Section -->
      <fieldset class="fieldset mb-4">
        <label class="label">
          <span class="label-text">Describe the query you want to generate (e.g., "Show all users with their orders")</span>
        </label>
        <textarea
          v-model="userQuery"
          class="textarea textarea-bordered h-32 text-white font-mono"
          placeholder="Example: Show all podcast episodes with their series"
          :disabled="isLoading"
        />
      </fieldset>

      <!-- Response Section -->
      <div
        v-if="isLoading"
        class="flex justify-center items-center my-4 py-8"
      >
        <div class="loading loading-spinner text-primary" />
        <span class="ml-3">Generating your SQL/Eloquent code...</span>
      </div>

      <div
        v-if="aiResponse && !isLoading"
        class="space-y-6"
      >
        <!-- SQL Response -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body">
            <div class="flex justify-between items-center mb-2">
              <h3 class="card-title text-md">SQL Code</h3>
              <button
                class="btn btn-xs btn-ghost"
                title="Copy to clipboard"
                @click="copySQLToClipboard"
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
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                  />
                </svg>
              </button>
            </div>
            <div class="mockup-code bg-base-300 text-sm overflow-auto max-h-60">
              <pre><code>{{ sqlCode }}</code></pre>
            </div>
            <button
              class="btn btn-primary btn-sm mt-2 w-full"
              @click="applyToEditor"
            >
              Apply to Editor
            </button>
          </div>
        </div>

        <!-- Eloquent Response -->
        <div class="card bg-neutral shadow-md">
          <div class="card-body">
            <div class="flex justify-between items-center mb-2">
              <h3 class="card-title text-md">Eloquent Equivalent</h3>
              <button
                class="btn btn-xs btn-ghost"
                title="Copy to clipboard"
                @click="copyEloquentToClipboard"
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
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                  />
                </svg>
              </button>
            </div>
            <div class="mockup-code bg-base-300 text-sm overflow-auto max-h-80">
              <pre class="language-php"><code>{{ eloquentCode }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action mt-6">
        <button
          class="btn btn-primary"
          :disabled="isLoading || !userQuery.trim()"
          @click="generateCode"
        >
          <span
            v-if="isLoading"
            class="loading loading-spinner loading-xs mr-2"
          />
          Generate
        </button>
        <button
          class="btn"
          @click="close"
        >
          Close
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="close"
    />
  </div>
</template>

<script setup>
import { ref, inject, onMounted, computed } from "vue";
import { useSettingsStore } from "@/store/settings";

const props = defineProps({
  databaseStructure: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["close", "apply-sql"]);

const settingsStore = useSettingsStore();
const showAlert = inject("showAlert");

const userQuery = ref("");
const isLoading = ref(false);
const aiResponse = ref(null);
const sqlCode = computed(() => aiResponse.value?.sql || "");
const eloquentCode = computed(() => aiResponse.value?.eloquent || "");

// Process database structure to minimize its size
const optimizedDatabaseStructure = computed(() => {
  try {
    // Parse the original structure
    const dbStructure = JSON.parse(props.databaseStructure);

    // Create a simplified version with only essential information
    const simplified = {
      connectionName: dbStructure.connectionName,
      database: dbStructure.database,
      tables: []
    };

    // Process each table to keep only essential data
    if (dbStructure.tables && Array.isArray(dbStructure.tables)) {
      dbStructure.tables.forEach((table) => {
        const tableInfo = {
          tableName: table.tableName
        };

        // Include column information if available
        if (table.columns && Array.isArray(table.columns)) {
          tableInfo.columns = table.columns;
        }

        // Only include model info if it exists
        if (table.model) {
          tableInfo.model = {
            name: table.model.name,
            namespace: table.model.namespace
          };
        }

        simplified.tables.push(tableInfo);
      });
    }

    // Return the stringified simplified version
    return JSON.stringify(simplified, null, 2);
  } catch (error) {
    console.warn("Failed to optimize database structure:", error);
    // Return a truncated version of the original if parsing fails
    return props.databaseStructure.length > 4000 ? props.databaseStructure.substring(0, 4000) + "..." : props.databaseStructure;
  }
});

async function generateCode() {
  if (!userQuery.value.trim()) {
    showAlert("Please enter a query first", "warning");
    return;
  }

  if (!settingsStore.isAIConfigured) {
    showAlert("AI API key is not configured. Please set it in the Settings.", "error");
    return;
  }

  isLoading.value = true;

  try {
    const language = settingsStore.settings.language || "en";
    const systemPrompt = `
You are a SQL-to-Eloquent converter for Laravel applications.
Your task is to convert raw SQL queries to their equivalent Laravel Eloquent Query Builder syntax.

Your response MUST contain exactly two code blocks:

<sql>
[The original or optimized SQL query]
</sql>

<eloquent>
[The direct Eloquent/Query Builder equivalent of the SQL]
</eloquent>

For the Eloquent block:
1. DO NOT create controllers, methods, or views - ONLY show the actual query code
2. Include ONLY the necessary namespace imports at the top (do not import base classes like Model, Collection, etc.)
3. Show ONLY the code needed to execute the exact same query as the SQL
4. PREFER using Eloquent relationships over manual joins when appropriate
5. Include full namespaces for all models (e.g., use App\\Models\\User)

The database structure provided includes:
- Table names
- Column information (name, type, primary/foreign keys)
- Associated model names and namespaces

Use the column information to:
- Ensure correct column names and types in your queries
- Identify primary keys for proper model usage
- Detect foreign key relationships for choosing appropriate Eloquent relationships
- Determine the correct field types for any type casting or conditions

Guidelines for choosing between relationships and joins:
- If the SQL uses a simple JOIN that matches a belongsTo/hasMany relationship, use the relationship method
- If the SQL uses complex JOIN conditions or multiple JOINs, use the join() method
- Only import the model classes that are directly used in the query

Example of a typical Eloquent relationship schema:
- Model class name is typically the singular of the table name and PascalCase 
- Relationship method names are camelCase 
- Foreign keys usually follow the pattern {singular_model_name}_id

Example of expected Eloquent response format for a simple query:

<eloquent>
use App\\Models\\PodcastEpisode;

PodcastEpisode::with('podcastSeries')->get();
</eloquent>

Example for a complex query:

<eloquent>
use App\\Models\\PodcastEpisode;

PodcastEpisode::select('podcast_episodes.*', 'podcast_series.title')
    ->join('podcast_series', 'podcast_episodes.podcast_series_id', '=', 'podcast_series.id')
    ->where('podcast_series.active', true)
    ->get();
</eloquent>

Use the database structure info provided to ensure correct table names, column names, relationships, and data types.
All responses must be in ${language === "en" ? "English" : language === "pt" ? "Portuguese" : "Spanish"}.
Be precise and generate production-ready code.`;

    const userContent = `Database Structure:
${optimizedDatabaseStructure.value}

For my request, please convert the resulting SQL query directly to Eloquent syntax.
Do NOT create controller methods or full classes - I only need the direct query conversion.

Important notes:
- Include ONLY the necessary namespace imports (no Laravel base classes)
- Use the column information to identify relationships and ensure correct field names
- Pay special attention to primary and foreign keys to detect relationships
- Use the proper column types for any type casting or conditions
- The model name is typically the singular form of the table name in PascalCase
- If the tables have a foreign key relationship, prefer using Eloquent relationships

Request: ${userQuery.value}`;

    let content;

    if (settingsStore.settings.aiProvider === "openai") {
      // Call OpenAI API
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settingsStore.settings.openai.apiKey}`
        },
        body: JSON.stringify({
          model: settingsStore.settings.openai.model || "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.2,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Error calling OpenAI API");
      }

      const data = await response.json();
      content = data.choices[0]?.message?.content || "";
    } else if (settingsStore.settings.aiProvider === "gemini") {
      // Call Gemini API
      const prompt = `${systemPrompt}
      
${userContent}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settingsStore.settings.gemini.model}:generateContent?key=${settingsStore.settings.gemini.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Error calling Gemini API");
      }

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      throw new Error("No AI provider selected");
    }

    // Parse the response to extract SQL and Eloquent parts
    const sqlMatch = content.match(/<sql>([\s\S]*?)<\/sql>/);
    const eloquentMatch = content.match(/<eloquent>([\s\S]*?)<\/eloquent>/);

    // Process the matched content
    let sqlCode = sqlMatch ? sqlMatch[1].trim() : "No SQL code generated";
    let eloquentCode = eloquentMatch ? eloquentMatch[1].trim() : "No Eloquent code generated";

    eloquentCode = cleanEloquentCode(eloquentCode);

    aiResponse.value = {
      sql: sqlCode,
      eloquent: eloquentCode
    };
  } catch (error) {
    console.error("Error generating code:", error);
    showAlert(`Failed to generate code: ${error.message}`, "error");
    aiResponse.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function copySQLToClipboard() {
  try {
    await navigator.clipboard.writeText(sqlCode.value);
    showAlert("SQL code copied to clipboard", "success");
  } catch (error) {
    showAlert("Failed to copy to clipboard", "error");
  }
}

async function copyEloquentToClipboard() {
  try {
    await navigator.clipboard.writeText(eloquentCode.value);
    showAlert("Eloquent code copied to clipboard", "success");
  } catch (error) {
    showAlert("Failed to copy to clipboard", "error");
  }
}

function applyToEditor() {
  emit("apply-sql", sqlCode.value);
}

function close() {
  emit("close");
}

function cleanEloquentCode(code) {
  let cleanCode = code.replace(/^<\?php\s*/i, "").replace(/\s*\?>$/i, "");

  // Remove unnecessary imports
  const importLines = [];
  const codeLines = [];
  const lines = cleanCode.split("\n");

  let importSection = true;

  for (const line of lines) {
    if (importSection) {
      if (line.trim().startsWith("use ")) {
        if (
          !line.includes("Illuminate\\Database\\Eloquent\\") &&
          !line.includes("Illuminate\\Support\\") &&
          !line.includes("Illuminate\\Database\\Query\\") &&
          !line.includes("Illuminate\\Database\\Relations\\")
        ) {
          importLines.push(line);
        }
      } else if (line.trim() !== "") {
        importSection = false;
        codeLines.push(line);
      }
    } else {
      codeLines.push(line);
    }
  }

  // Combine imports and code with proper spacing
  return [...importLines, "", ...codeLines].join("\n").trim();
}
</script>

<style scoped>
.mockup-code {
  position: relative;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
}

.language-php .keyword {
  color: #c678dd;
}

.language-php .string {
  color: #98c379;
}

.language-php .function {
  color: #61afef;
}

.language-php .comment {
  color: #5c6370;
  font-style: italic;
}
</style>
