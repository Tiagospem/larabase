export interface Settings {
	aiProvider: string;
	openai: {
		apiKey: string;
		model: string;
	};
	gemini: {
		apiKey: string;
		model: string;
	};
	language: string;
	devMode: boolean;
	performanceMonitor: boolean;
	theme: string;
	preferredEditor: string;
}
