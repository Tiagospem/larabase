import { useSettingsStore } from "@/store/settings";

/**
 * Analyzes EXPLAIN query data using AI (OpenAI or Gemini) based on user settings
 * @param {Object} explainData The EXPLAIN data to analyze
 * @returns {Promise<string>} The analysis result
 */
export async function analyzeExplainWithAI(explainData) {
  const settingsStore = useSettingsStore();

  // Check if AI provider is configured
  if (settingsStore.settings.aiProvider === "openai") {
    if (!settingsStore.settings.openai.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    return analyzeWithOpenAI(explainData, settingsStore);
  } else if (settingsStore.settings.aiProvider === "gemini") {
    if (!settingsStore.settings.gemini.apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    return analyzeWithGemini(explainData, settingsStore);
  } else {
    throw new Error("No AI provider selected");
  }
}

/**
 * Analyzes EXPLAIN data using OpenAI
 * @param {Object} explainData The EXPLAIN data to analyze
 * @param {Object} settingsStore The settings store
 * @returns {Promise<string>} The analysis result
 */
async function analyzeWithOpenAI(explainData, settingsStore) {
  const language = settingsStore.settings.language || "en";

  // Format EXPLAIN results for better readability
  const explainResultsFormatted = explainData.results
    .map((row, index) => {
      return explainData.columns.map((column) => `${column}: ${row[column] || "N/A"}`).join("\n  ");
    })
    .join("\n\n");

  // Format insights
  const insightsFormatted = explainData.insights
    .map((insight) => `- ${insight.title}: ${insight.description}${insight.recommendation ? `\n  Recommendation: ${insight.recommendation}` : ""}`)
    .join("\n");

  // Prepare messages for OpenAI API
  const messages = [
    { role: "system", content: getExplainAnalysisPrompt() },
    {
      role: "user",
      content: `Please analyze this SQL query execution plan:
      
SQL Query:
\`\`\`sql
${explainData.query}
\`\`\`

Execution Plan:
\`\`\`
${explainResultsFormatted}
\`\`\`

Detected Performance Insights:
${insightsFormatted || "None detected"}
      
Analyze this execution plan in depth. Explain what's happening, identify performance bottlenecks, and provide detailed optimization suggestions.
Please reply in ${language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"}.`
    }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settingsStore.settings.openai.apiKey}`
      },
      body: JSON.stringify({
        model: settingsStore.settings.openai.model || "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.3,
        max_tokens: 3000 // Increased from 1000 to allow for more complete responses
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Error calling OpenAI API");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "No analysis could be generated";

    return content;
  } catch (error) {
    console.error("Error analyzing EXPLAIN with OpenAI:", error);
    throw error;
  }
}

/**
 * Analyzes EXPLAIN data using Gemini API
 * @param {Object} explainData The EXPLAIN data to analyze
 * @param {Object} settingsStore The settings store
 * @returns {Promise<string>} The analysis result
 */
async function analyzeWithGemini(explainData, settingsStore) {
  const language = settingsStore.settings.language || "en";

  // Format EXPLAIN results for better readability
  const explainResultsFormatted = explainData.results
    .map((row, index) => {
      return explainData.columns.map((column) => `${column}: ${row[column] || "N/A"}`).join("\n  ");
    })
    .join("\n\n");

  // Format insights
  const insightsFormatted = explainData.insights
    .map((insight) => `- ${insight.title}: ${insight.description}${insight.recommendation ? `\n  Recommendation: ${insight.recommendation}` : ""}`)
    .join("\n");

  // Prepare messages for Gemini API
  const prompt = `${getExplainAnalysisPrompt()}

Please analyze this SQL query execution plan:

SQL Query:
\`\`\`sql
${explainData.query}
\`\`\`

Execution Plan:
\`\`\`
${explainResultsFormatted}
\`\`\`

Detected Performance Insights:
${insightsFormatted || "None detected"}

Analyze this execution plan in depth. Explain what's happening, identify performance bottlenecks, and provide detailed optimization suggestions.
Please reply in ${language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"}.`;

  try {
    // Gemini API endpoint
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
          temperature: 0.3,
          maxOutputTokens: 2500 // Increased from 1000 to allow for more complete responses
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis could be generated";

    return content;
  } catch (error) {
    console.error("Error analyzing EXPLAIN with Gemini:", error);
    throw error;
  }
}

/**
 * Get the prompt template for SQL EXPLAIN analysis
 * @returns {string} The prompt template
 */
function getExplainAnalysisPrompt() {
  return `You are an expert SQL performance analyzer specialized in interpreting database execution plans.
Your task is to analyze SQL EXPLAIN command results and provide clear, CONCISE explanations of critical performance issues and their solutions.

IMPORTANT CONSTRAINTS:
- Be extremely concise and to the point
- Focus only on critical performance issues
- Limit your analysis to what can fit in the token limit
- Omit obvious or trivial information
- Prioritize actionable insights over explanations

When analyzing a query execution plan, identify and focus on:
1. The most severe performance bottlenecks
2. Inefficient table access methods (especially full scans of large tables)
3. Problematic join operations
4. Missing or inefficient indexes
5. The single most impactful optimization that could be made

Your analysis should be structured as follows:

## Summary
One or two sentences describing the overall performance characteristics of the query.

## Critical Issues
Bullet points of the most severe performance problems, ordered by impact:
- Issue: [Brief description]
  Impact: [High/Medium/Low]
  Solution: [Concise action item]

## Recommended Optimizations
The 1-3 most impactful changes that would improve performance, in order of priority:
1. [Specific, actionable recommendation]

Prioritize solutions that would have the greatest impact on performance.
Skip detailed explanations unless absolutely necessary.
If suggesting an index, be specific about columns and order.
If recommending a query rewrite, provide a brief example.

REMEMBER: End users need clear, actionable guidance they can implement immediately. Focus on WHAT to fix and HOW to fix it, not lengthy explanations of WHY. DOT NOT EXCEED 3000 TOKENS.`;
}
