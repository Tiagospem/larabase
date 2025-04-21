import { useSettingsStore } from "@/store/settings";

/**
 * Analyzes log data using AI (OpenAI or Gemini) based on user settings
 * @param {Object} logData The log data to analyze
 * @returns {Promise<string>} The analysis result
 */
export async function analyzeLogWithAI(logData) {
  const settingsStore = useSettingsStore();

  // Check if AI provider is configured
  if (settingsStore.settings.aiProvider === "openai") {
    if (!settingsStore.settings.openai.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    return analyzeWithOpenAI(logData, settingsStore);
  } else if (settingsStore.settings.aiProvider === "gemini") {
    if (!settingsStore.settings.gemini.apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    return analyzeWithGemini(logData, settingsStore);
  } else {
    throw new Error("No AI provider selected");
  }
}

/**
 * Analyzes log data using OpenAI
 * @param {Object} logData The log data to analyze
 * @param {Object} settingsStore The settings store
 * @returns {Promise<string>} The analysis result
 */
async function analyzeWithOpenAI(logData, settingsStore) {
  const language = settingsStore.settings.language || "en";

  // Format the stack trace for better readability
  const formattedStack = logData.stack ? logData.stack.split("\n").slice(0, 15).join("\n") + (logData.stack.split("\n").length > 15 ? "\n..." : "") : "Not available";

  // Prepare messages for OpenAI API
  const messages = [
    { role: "system", content: getLogAnalysisPrompt() },
    {
      role: "user",
      content: `Please analyze this Laravel log:
      
Type: ${logData.type}
Timestamp: ${new Date(logData.timestamp).toISOString()}
File: ${logData.file || "Not specified"}
Message: ${logData.message}

Stack Trace:
\`\`\`
${formattedStack}
\`\`\`
      
Provide an analysis explaining what happened, possible causes, and suggestions for resolution.
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
        max_tokens: 800
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
    console.error("Error analyzing log with OpenAI:", error);
    throw error;
  }
}

/**
 * Analyzes log data using Gemini API
 * @param {Object} logData The log data to analyze
 * @param {Object} settingsStore The settings store
 * @returns {Promise<string>} The analysis result
 */
async function analyzeWithGemini(logData, settingsStore) {
  const language = settingsStore.settings.language || "en";

  // Format the stack trace for better readability
  const formattedStack = logData.stack ? logData.stack.split("\n").slice(0, 15).join("\n") + (logData.stack.split("\n").length > 15 ? "\n..." : "") : "Not available";

  // Prepare messages for Gemini API
  const prompt = `${getLogAnalysisPrompt()}

Please analyze this Laravel log:

Type: ${logData.type}
Timestamp: ${new Date(logData.timestamp).toISOString()}
File: ${logData.file || "Not specified"}
Message: ${logData.message}

Stack Trace:
\`\`\`
${formattedStack}
\`\`\`

Provide an analysis explaining what happened, possible causes, and suggestions for resolution.
Please reply in ${language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"}.`;

  try {
    // Updated Gemini API endpoint format
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
          maxOutputTokens: 800
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
    console.error("Error analyzing log with Gemini:", error);
    throw error;
  }
}

/**
 * Get the single prompt template for log analysis
 * @returns {string} The prompt template
 */
function getLogAnalysisPrompt() {
  return `You are an expert Laravel application log analyzer.
Your task is to analyze Laravel logs and provide clear explanations of what happened, possible causes, and suggestions for fixing the issues.

When analyzing a log, consider the following aspects:
1. The log type (error, warning, info, debug)
2. The timestamp to identify when the issue occurred
3. The specific error message 
4. The stack trace, if available
5. The file where the error occurred

Your analysis should include:
- A clear explanation of what happened in non-technical terms
- The technical details of why this error occurred
- Possible root causes for this issue
- Step-by-step suggestions for resolving the problem
- Any preventative measures to avoid similar issues in the future

IMPORTANT: Format your response using Markdown for better readability. Use headings, bullet points, and code blocks where appropriate.

Structure your response with these sections:
1. ## Summary
   Brief non-technical explanation of the issue
   
2. ## Technical Analysis
   Detailed technical explanation of the error
   
3. ## Possible Causes
   Bullet list of potential causes
   
4. ## Resolution Steps
   Numbered steps to fix the issue
   
5. ## Prevention
   Ways to prevent this error in the future

Keep your analysis concise but thorough. Include relevant Laravel or PHP concepts when they help explain the issue.`;
}
