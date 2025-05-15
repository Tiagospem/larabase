import { useSettingsStore } from '@/store/settings';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIResponse {
	content: string;
	error?: string;
}

export class AIService {
	private static instance: AIService;
	private openaiClient: OpenAI | null = null;
	private googleAIClient: GoogleGenerativeAI | null = null;
	private settingsStore = useSettingsStore();

	private constructor() {}

	public static getInstance(): AIService {
		if (!AIService.instance) {
			AIService.instance = new AIService();
		}
		return AIService.instance;
	}

	private initializeClients() {
		const settings = this.settingsStore.settings;

		if (settings.aiProvider === 'openai' && settings.openai.apiKey) {
			this.openaiClient = new OpenAI({
				apiKey: settings.openai.apiKey,
				dangerouslyAllowBrowser: true
			});
		} else {
			this.openaiClient = null;
		}

		if (settings.aiProvider === 'gemini' && settings.gemini.apiKey) {
			this.googleAIClient = new GoogleGenerativeAI(
				settings.gemini.apiKey
			);
		} else {
			this.googleAIClient = null;
		}
	}

	public async generateSQLFromPrompt(
		prompt: string,
		databaseSchema: string,
		language: string = 'en'
	): Promise<AIResponse> {
		this.initializeClients();
		const settings = this.settingsStore.settings;

		const systemPrompt = this.createSystemPrompt(databaseSchema, language);

		try {
			if (settings.aiProvider === 'openai' && this.openaiClient) {
				return await this.generateWithOpenAI(
					systemPrompt,
					prompt,
					settings.openai.model
				);
			} else if (
				settings.aiProvider === 'gemini' &&
				this.googleAIClient
			) {
				return await this.generateWithGemini(
					systemPrompt,
					prompt,
					settings.gemini.model
				);
			} else {
				return {
					content: '',
					error: 'No AI provider configured. Please check your settings.'
				};
			}
		} catch (error) {
			console.error('Error generating SQL:', error);
			return {
				content: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	public async analyzeSQLExplain(
		explainData: string,
		language: string = 'en'
	): Promise<AIResponse> {
		this.initializeClients();
		const settings = this.settingsStore.settings;

		const systemPrompt = this.createExplainAnalysisPrompt(language);

		try {
			if (settings.aiProvider === 'openai' && this.openaiClient) {
				return await this.generateWithOpenAI(
					systemPrompt,
					explainData,
					settings.openai.model
				);
			} else if (
				settings.aiProvider === 'gemini' &&
				this.googleAIClient
			) {
				return await this.generateWithGemini(
					systemPrompt,
					explainData,
					settings.gemini.model
				);
			} else {
				return {
					content: '',
					error: 'No AI provider configured. Please check your settings.'
				};
			}
		} catch (error) {
			console.error('Error analyzing SQL EXPLAIN:', error);
			return {
				content: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	public async fixSQLQuery(
		sqlQuery: string,
		language: string = 'en'
	): Promise<AIResponse> {
		this.initializeClients();
		const settings = this.settingsStore.settings;

		const systemPrompt = this.createFixSQLPrompt(language);

		try {
			if (settings.aiProvider === 'openai' && this.openaiClient) {
				const response = await this.generateWithOpenAI(
					systemPrompt,
					sqlQuery,
					settings.openai.model
				);
				if (response.content) {
					response.content = this.cleanSQLResponse(response.content);
				}
				return response;
			} else if (
				settings.aiProvider === 'gemini' &&
				this.googleAIClient
			) {
				const response = await this.generateWithGemini(
					systemPrompt,
					sqlQuery,
					settings.gemini.model
				);
				if (response.content) {
					response.content = this.cleanSQLResponse(response.content);
				}
				return response;
			} else {
				return {
					content: '',
					error: 'No AI provider configured. Please check your settings.'
				};
			}
		} catch (error) {
			console.error('Error fixing SQL query:', error);
			return {
				content: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	private cleanSQLResponse(content: string): string {
		let cleaned = content.replace(/```sql\s*([\s\S]*?)\s*```/g, '$1');
		cleaned = cleaned.replace(/```\s*([\s\S]*?)\s*```/g, '$1');

		cleaned = cleaned.replace(/^`([\s\S]*)`$/, '$1');

		cleaned = cleaned.replace(/^(SQL|sql):\s*/i, '');

		return cleaned.trim();
	}

	private createSystemPrompt(
		databaseSchema: string,
		language: string
	): string {
		const languageInstructions =
			language === 'en'
				? 'Respond in English.'
				: language === 'pt'
					? 'Responda em Português.'
					: language === 'es'
						? 'Responde en Español.'
						: 'Respond in English.';

		return `You are an expert SQL assistant that helps users create SQL queries for their Laravel application.
Your task is to generate SQL queries based on the user's natural language request and the provided database schema.

Here is the database schema in compact format:
${databaseSchema}

Important rules:
- Only respond with SQL queries that can be executed directly in the database
- If the user asks for something outside of SQL queries or database information, politely decline and stay focused on SQL
- When appropriate, also provide the Laravel Eloquent query equivalent
- Format your response with SQL first, followed by the Eloquent version if applicable
- Be concise and to the point
- ${languageInstructions}`;
	}

	private createExplainAnalysisPrompt(language: string): string {
		const languageInstructions =
			language === 'en'
				? 'Respond in English.'
				: language === 'pt'
					? 'Responda em Português.'
					: language === 'es'
						? 'Responde en Español.'
						: 'Respond in English.';

		let prompt = `You are an expert SQL performance analyst specializing in optimizing database queries.
Your task is to analyze the provided SQL EXPLAIN output and provide concrete optimization suggestions.

When analyzing the EXPLAIN output:
1. Identify any table scans, large sorts, temporary tables, or other performance concerns
2. Suggest specific indexes that could improve the query
3. Identify inefficient joins or filtering conditions
4. Recommend query rewrites that could improve performance
5. Explain the reasoning behind each recommendation

Format your response as a clear analysis with sections for:
- Summary of performance issues
- Specific recommendations (with code examples where helpful)
- Expected improvements

${languageInstructions}`;

		return prompt;
	}

	private createFixSQLPrompt(language: string): string {
		const languageInstructions =
			language === 'en'
				? 'Respond in English.'
				: language === 'pt'
					? 'Responda em Português.'
					: language === 'es'
						? 'Responde en Español.'
						: 'Respond in English.';

		return `You are an expert SQL fixer for a database application. 
Your task is to analyze the provided SQL query, identify any errors or issues, and provide a corrected version.

Important rules:
- Only respond with the corrected SQL query - do not include explanations
- Do not wrap the SQL in backticks or markdown code blocks
- Maintain the original intent of the query, but fix any syntax errors, logical problems, or inefficiencies
- Make sure your corrected SQL follows best practices for SQL
- Format the SQL properly with appropriate indentation and capitalization of SQL keywords
- Do not change the core purpose of the query
- Return only the fixed SQL code, nothing else
- ${languageInstructions}`;
	}

	private async generateWithOpenAI(
		systemPrompt: string,
		userPrompt: string,
		model: string
	): Promise<AIResponse> {
		if (!this.openaiClient) {
			return {
				content: '',
				error: 'OpenAI client not initialized. Please check your API key.'
			};
		}

		try {
			const response = await this.openaiClient.chat.completions.create({
				model: model,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.1,
				max_tokens: 2000
			});

			return {
				content:
					response.choices[0]?.message?.content ||
					'No response generated'
			};
		} catch (error) {
			console.error('OpenAI API error:', error);
			return {
				content: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	private async generateWithGemini(
		systemPrompt: string,
		userPrompt: string,
		model: string
	): Promise<AIResponse> {
		if (!this.googleAIClient) {
			return {
				content: '',
				error: 'Google AI client not initialized. Please check your API key.'
			};
		}

		try {
			const genModel = this.googleAIClient.getGenerativeModel({ model });

			const combinedPrompt = `${systemPrompt}\n\nUser query: ${userPrompt}`;

			const result = await genModel.generateContent({
				contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
				generationConfig: {
					temperature: 0.1,
					maxOutputTokens: 2000
				}
			});

			const response = result.response;
			return {
				content: response.text() || 'No response generated'
			};
		} catch (error) {
			console.error('Google AI API error:', error);
			return {
				content: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	public isAIConfigured(): boolean {
		const settings = this.settingsStore.settings;

		if (settings.aiProvider === 'openai') {
			return !!settings.openai.apiKey;
		} else if (settings.aiProvider === 'gemini') {
			return !!settings.gemini.apiKey;
		}

		return false;
	}
}
