import * as monaco from 'monaco-editor';
import { configureMonaco } from '@/utils/monaco-config';
import { format } from 'sql-formatter';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

configureMonaco();
import { useConnectionsStore } from '@/store/connections';
import { useSqlResultsStore } from '@/store/sqlResults';
import { AIService } from '@/services/aiService';
import { toRaw } from 'vue';
import { useDatabaseSchema } from '@/services/databaseSchema';
import { AppConnection } from '@/types/ssh-connection';
import { ProjectConnection } from '@/types/project';

type EmitEvents = {
	'update:modelValue': [string];
	'processing-state': [boolean];
	'explain-sql': [ExplainResult];
};

type EmitFn = <E extends keyof EmitEvents>(
	event: E,
	...args: EmitEvents[E]
) => void;

interface ExplainRow {
	id: number;
	select_type?: string;
	table?: string;
	partitions?: string | null;
	type?: string;
	possible_keys?: string | null;
	key?: string | null;
	key_len?: string | null;
	ref?: string | null;
	rows?: number;
	filtered?: number;
	Extra?: string;
	[key: string]: unknown;
}

interface JsonExplainPlan {
	query_block?: Record<string, unknown>;
	steps?: Array<Record<string, unknown>>;
	[key: string]: unknown;
}

export interface ExplainResult {
	rawExplain: ExplainRow[];
	queryToExplain: string;
	isExplaining: boolean;
	aiAnalysis?: string;
	jsonExplain?: JsonExplainPlan;
	error?: string;
}

export function useSQLEditor(
	props: { modelValue: string; isRemoteConnection: boolean },
	emit: EmitFn
) {
	const container = ref<HTMLDivElement | null>(null);
	let editor: monaco.editor.IStandaloneCodeEditor | null = null;
	let isUpdating = false;

	const connectionsStore = useConnectionsStore();
	const sqlResultsStore = useSqlResultsStore();
	const aiService = AIService.getInstance();
	const { databaseSchema, initializeSchema } = useDatabaseSchema(
		props.isRemoteConnection
	);

	const isFixingSQL = ref(false);
	const showProcessingOverlay = ref(false);
	const explainResult = ref<ExplainResult>({
		rawExplain: [],
		queryToExplain: '',
		isExplaining: false
	});

	const getSchemaForAutocompletion = () => {
		if (!databaseSchema.value || !databaseSchema.value.tables) {
			return { tables: [], columnsByTable: {}, columnMetadata: {} };
		}

		const tables = databaseSchema.value.tables.map((table) => table.name);
		const columnsByTable: Record<string, string[]> = {};
		const columnMetadata: Record<
			string,
			Record<
				string,
				{
					type: string;
					isPrimary: boolean;
					isForeign: boolean;
				}
			>
		> = {};

		databaseSchema.value.tables.forEach((table) => {
			if (table.columns && table.columns.length > 0) {
				columnsByTable[table.name] = table.columns.map(
					(col) => col.name
				);

				columnMetadata[table.name] = {};
				table.columns.forEach((col) => {
					columnMetadata[table.name][col.name] = {
						type: col.type,
						isPrimary: col.primary_key,
						isForeign: col.foreign_key
					};
				});
			}
		});

		return { tables, columnsByTable, columnMetadata };
	};

	const registerSQLCompletionProvider = () => {
		const { tables, columnsByTable, columnMetadata } =
			getSchemaForAutocompletion();

		monaco.languages.registerCompletionItemProvider('sql', {
			triggerCharacters: [' ', '.', '`'],
			provideCompletionItems: (model, position) => {
				const textUntilPosition = model.getValueInRange({
					startLineNumber: position.lineNumber,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column
				});

				const suggestions: monaco.languages.CompletionItem[] = [];

				const fromMatch = textUntilPosition.match(
					/\b(FROM|JOIN)\s+(\w*)$/i
				);
				if (fromMatch) {
					tables.forEach((table) => {
						const tableInfo = databaseSchema.value?.tables.find(
							(t) => t.name === table
						);
						const rowCount = tableInfo?.columns?.length || 0;

						suggestions.push({
							label: table,
							kind: monaco.languages.CompletionItemKind.Class,
							insertText: table,
							detail: `Table (${rowCount} columns)`,
							documentation: tableInfo?.model?.fullName
								? `Model: ${tableInfo.model.fullName}`
								: undefined,
							sortText: '0' + table,
							range: {
								startLineNumber: position.lineNumber,
								endLineNumber: position.lineNumber,
								startColumn:
									position.column -
									(fromMatch[2]?.length || 0),
								endColumn: position.column
							}
						});
					});
					return { suggestions };
				}

				const tableColumnMatch = textUntilPosition.match(/([\w_]+)\.$/);
				if (tableColumnMatch) {
					const tableName = tableColumnMatch[1];
					const columns = columnsByTable[tableName] || [];

					columns.forEach((column) => {
						const metadata = columnMetadata[tableName]?.[column];
						const keyInfo = [];

						if (metadata?.isPrimary) keyInfo.push('PK');
						if (metadata?.isForeign) keyInfo.push('FK');

						const keyText = keyInfo.length
							? ` [${keyInfo.join(', ')}]`
							: '';

						suggestions.push({
							label: column,
							kind: monaco.languages.CompletionItemKind.Field,
							insertText: column,
							detail: `${tableName}.${column}${keyText} (${metadata?.type || 'unknown'})`,
							sortText: metadata?.isPrimary
								? '0' + column
								: metadata?.isForeign
									? '1' + column
									: '2' + column,
							range: {
								startLineNumber: position.lineNumber,
								endLineNumber: position.lineNumber,
								startColumn: position.column,
								endColumn: position.column
							}
						});
					});
					return { suggestions };
				}

				if (textUntilPosition.trim().length > 0) {
					const lastWordMatch = textUntilPosition.match(/\b(\w*)$/);
					const startColumn = lastWordMatch
						? position.column - lastWordMatch[1].length
						: position.column;

					[
						'SELECT',
						'FROM',
						'WHERE',
						'JOIN',
						'LEFT JOIN',
						'RIGHT JOIN',
						'INNER JOIN',
						'GROUP BY',
						'ORDER BY',
						'LIMIT',
						'UPDATE',
						'INSERT INTO',
						'DELETE FROM',
						'HAVING',
						'DISTINCT',
						'AND',
						'OR',
						'IN',
						'NOT IN',
						'IS NULL',
						'IS NOT NULL',
						'LIKE',
						'AS',
						'COUNT',
						'SUM',
						'AVG',
						'MIN',
						'MAX'
					].forEach((keyword) => {
						suggestions.push({
							label: keyword,
							kind: monaco.languages.CompletionItemKind.Keyword,
							insertText: keyword,
							detail: 'Keyword',
							sortText: '9' + keyword,
							range: {
								startLineNumber: position.lineNumber,
								endLineNumber: position.lineNumber,
								startColumn: startColumn,
								endColumn: position.column
							}
						});
					});
				}

				if (
					textUntilPosition.match(/\bSELECT\s+\w*$/i) ||
					textUntilPosition.match(/,\s*\w*$/i) ||
					textUntilPosition.match(/\bWHERE\s+\w*$/i) ||
					textUntilPosition.match(/\bGROUP\s+BY\s+\w*$/i) ||
					textUntilPosition.match(/\bORDER\s+BY\s+\w*$/i)
				) {
					const lastWordMatch = textUntilPosition.match(/\b(\w*)$/);
					const startColumn = lastWordMatch
						? position.column - lastWordMatch[1].length
						: position.column;

					Object.entries(columnsByTable).forEach(
						([table, columns]) => {
							columns.forEach((column) => {
								const metadata =
									columnMetadata[table]?.[column];
								const keyInfo = [];

								if (metadata?.isPrimary) keyInfo.push('PK');
								if (metadata?.isForeign) keyInfo.push('FK');

								const keyText = keyInfo.length
									? ` [${keyInfo.join(', ')}]`
									: '';

								suggestions.push({
									label: `${table}.${column}`,
									kind: monaco.languages.CompletionItemKind
										.Field,
									insertText: `${table}.${column}`,
									detail: `${table}.${column}${keyText} (${metadata?.type || 'unknown'})`,
									sortText: metadata?.isPrimary
										? '3' + table + column
										: metadata?.isForeign
											? '4' + table + column
											: '5' + table + column,
									range: {
										startLineNumber: position.lineNumber,
										endLineNumber: position.lineNumber,
										startColumn: startColumn,
										endColumn: position.column
									}
								});

								suggestions.push({
									label: column,
									kind: monaco.languages.CompletionItemKind
										.Field,
									insertText: column,
									detail: `Column ${keyText} (${metadata?.type || 'unknown'}) - Table: ${table}`,
									sortText: metadata?.isPrimary
										? '6' + column
										: metadata?.isForeign
											? '7' + column
											: '8' + column,
									range: {
										startLineNumber: position.lineNumber,
										endLineNumber: position.lineNumber,
										startColumn: startColumn,
										endColumn: position.column
									}
								});
							});
						}
					);
				}

				return { suggestions };
			}
		});
	};

	const getEditorSelectedText = (ed: monaco.editor.ICodeEditor): string => {
		const selection = ed.getSelection();
		let selectedText = '';

		if (selection && !selection.isEmpty()) {
			selectedText = ed.getModel()?.getValueInRange(selection) || '';
		} else {
			const position = ed.getPosition();
			if (position) {
				const lineNumber = position.lineNumber;
				selectedText = ed.getModel()?.getLineContent(lineNumber) || '';
			}
		}

		return selectedText;
	};

	const createAppConnection = (project: ProjectConnection): AppConnection => {
		return {
			localDbConfig: toRaw(project.dbConfig),
			remote: toRaw(project.sshConfig)
		} as AppConnection;
	};

	const handleError = (error: unknown, prefix: string): string => {
		console.error(`${prefix}:`, error);
		return error instanceof Error ? error.message : String(error);
	};

	const createEditor = () => {
		if (!container.value) return;
		if (editor) return;

		editor = monaco.editor.create(container.value, {
			value: props.modelValue,
			language: 'sql',
			theme: 'vs-dark',
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			automaticLayout: true,
			wordWrap: 'on',
			lineNumbers: 'on',
			tabSize: 2,
			fontSize: 12,
			suggestOnTriggerCharacters: true,
			contextmenu: true,
			scrollbar: {
				vertical: 'auto',
				horizontal: 'auto',
				verticalSliderSize: 12,
				horizontalSliderSize: 12,
				verticalScrollbarSize: 12,
				horizontalScrollbarSize: 12,
				useShadows: true,
				alwaysConsumeMouseWheel: false
			}
		});

		registerSQLCompletionProvider();

		editor.addAction({
			id: 'run-sql',
			label: 'Run SQL',
			keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
			contextMenuGroupId: 'navigation',
			contextMenuOrder: 1.5,
			run: async function (ed) {
				const selectedText = getEditorSelectedText(ed);

				if (selectedText.trim()) {
					const projects = connectionsStore.getSelectedProject;
					if (projects) {
						sqlResultsStore.isLoading = true;
						const startTime = Date.now();
						try {
							const AppConnection = createAppConnection(projects);

							const result =
								await window.ipcRenderer.executeSqlQuery(
									AppConnection,
									selectedText.trim()
								);

							const executionTime = Date.now() - startTime;
							console.log('SQL query result:', result);

							if (result && result.success) {
								sqlResultsStore.setResults(
									result.results,
									selectedText.trim()
								);
								sqlResultsStore.lastQueryTime = executionTime;
							} else {
								const errorMsg =
									result && result.error
										? result.error
										: 'Unknown SQL error occurred';
								console.error('SQL Error:', errorMsg);
								sqlResultsStore.setError(
									`Error executing query: ${errorMsg}`
								);
							}
						} catch (error) {
							const errorMessage = handleError(
								error,
								'Exception executing SQL'
							);
							sqlResultsStore.setError(errorMessage);
						} finally {
							sqlResultsStore.isLoading = false;
						}
					}
				}
			}
		});

		if (!props.isRemoteConnection) {
			editor.addAction({
				id: 'explain-sql',
				label: 'Explain SQL',
				keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE],
				contextMenuGroupId: 'navigation',
				contextMenuOrder: 1.3,
				run: async function (ed) {
					const selectedText = getEditorSelectedText(ed);

					if (selectedText.trim()) {
						const query = selectedText.trim();
						const project = connectionsStore.getSelectedProject;

						if (project) {
							explainResult.value = {
								rawExplain: [],
								queryToExplain: query,
								isExplaining: true
							};

							emit('explain-sql', { ...explainResult.value });

							try {
								const AppConnection =
									createAppConnection(project);

								const result =
									await window.ipcRenderer.executeExplainSql(
										AppConnection,
										query
									);

								if (result && result.success) {
									explainResult.value = {
										rawExplain:
											result.explainResults as ExplainRow[],
										queryToExplain: query,
										isExplaining: false,
										jsonExplain:
											result.jsonExplain as JsonExplainPlan
									};

									emit('explain-sql', {
										...explainResult.value
									});
								} else {
									const errorMsg =
										result && result.error
											? result.error
											: 'Unknown SQL error occurred';
									console.error(
										'Explain SQL Error:',
										errorMsg
									);
									explainResult.value.isExplaining = false;
									emit('explain-sql', {
										...explainResult.value,
										error: `Error executing EXPLAIN: ${errorMsg}`
									});
								}
							} catch (error) {
								const errorMessage = handleError(
									error,
									'Exception explaining SQL'
								);
								explainResult.value.isExplaining = false;
								emit('explain-sql', {
									...explainResult.value,
									error: `Error: ${errorMessage}`
								});
							}
						}
					}
				}
			});
		}

		editor.addAction({
			id: 'beautify-sql',
			label: 'Beautify SQL',
			keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
			contextMenuGroupId: 'modification',
			contextMenuOrder: 1.5,
			run: function (ed) {
				try {
					const selection = ed.getSelection();
					let text: string;
					let formattedText = '';
					let range;

					if (selection && !selection.isEmpty()) {
						text = ed.getModel()?.getValueInRange(selection) || '';
						range = selection;
					} else {
						text = ed.getValue();
						const model = ed.getModel();
						if (model) {
							const lastLineNumber = model.getLineCount();
							const lastLineLength =
								model.getLineLength(lastLineNumber);
							range = new monaco.Range(
								1,
								1,
								lastLineNumber,
								lastLineLength + 1
							);
						} else {
							return;
						}
					}

					if (text.trim()) {
						formattedText = format(text, {
							language: 'sql',
							keywordCase: 'upper',
							indentStyle: 'standard',
							linesBetweenQueries: 2
						});

						ed.executeEdits('beautify-sql', [
							{
								range: range,
								text: formattedText,
								forceMoveMarkers: true
							}
						]);
					}
				} catch (error: unknown) {
					const errorMessage = handleError(
						error,
						'Error beautifying SQL'
					);
					alert('Error beautifying SQL: ' + errorMessage);
				}
			}
		});

		if (aiService.isAIConfigured()) {
			editor.addAction({
				id: 'fix-sql',
				label: 'Fix SQL',
				keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
				contextMenuGroupId: 'modification',
				contextMenuOrder: 1.4,
				run: async function (ed) {
					if (isFixingSQL.value) return;

					const selection = ed.getSelection();
					if (!selection || selection.isEmpty()) return;

					const selectedText =
						ed.getModel()?.getValueInRange(selection) || '';
					if (!selectedText.trim()) return;

					isFixingSQL.value = true;
					showProcessingOverlay.value = true;
					emit('processing-state', true);

					try {
						const settings = JSON.parse(
							localStorage.getItem('settings') || '{}'
						);
						const language = settings.language || 'en';

						const result = await aiService.fixSQLQuery(
							selectedText,
							language
						);

						if (result.error) {
							console.error('Error fixing SQL:', result.error);
							alert(`Error fixing SQL: ${result.error}`);
						} else if (result.content) {
							ed.executeEdits('fix-sql', [
								{
									range: selection,
									text: result.content,
									forceMoveMarkers: true
								}
							]);
						}
					} catch (error: unknown) {
						const errorMessage = handleError(
							error,
							'Exception fixing SQL'
						);
						alert('Error fixing SQL: ' + errorMessage);
					} finally {
						isFixingSQL.value = false;
						showProcessingOverlay.value = false;
						emit('processing-state', false);
					}
				}
			});
		}

		editor.addAction({
			id: 'save-as-scratch',
			label: 'Save as Scratch',
			keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
			contextMenuGroupId: 'modification',
			contextMenuOrder: 1.6,
			run: function () {
				saveAsScratch();
			}
		});

		let timeout: ReturnType<typeof setTimeout> | null = null;
		editor.onDidChangeModelContent(() => {
			if (isUpdating) return;

			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(() => {
				const value: string = editor!.getValue();
				emit('update:modelValue', value);
			}, 300);
		});
	};

	const disposeEditor = () => {
		if (editor) {
			editor.dispose();
			editor = null;
		}
	};

	watch(
		() => props.modelValue,
		(newValue: string) => {
			if (editor && editor.getValue() !== newValue) {
				isUpdating = true;
				editor.setValue(newValue);
				isUpdating = false;
			}
		}
	);

	const handleResize = () => {
		if (editor) {
			requestAnimationFrame(() => {
				if (editor) {
					editor.layout();
				}
			});
		}
	};

	const layout = () => {
		if (editor) {
			requestAnimationFrame(() => {
				if (editor) {
					editor.layout();
				}
			});
		}
	};

	const getSelectedText = (): string => {
		if (!editor) return '';
		return getEditorSelectedText(editor);
	};

	const saveAsScratch = () => {
		if (!editor) return;

		const textToSave = getSelectedText();

		if (textToSave.trim()) {
			const event = new CustomEvent('save-as-scratch', {
				detail: { content: textToSave.trim() },
				bubbles: true,
				composed: true
			});
			container.value?.dispatchEvent(event);
		}
	};

	onMounted(() => {
		setTimeout(async () => {
			if (!props.isRemoteConnection) {
				await initializeSchema();
			}

			createEditor();
		}, 50);
		window.addEventListener('resize', handleResize);
	});

	watch(
		() => databaseSchema.value,
		() => {
			if (editor) {
				registerSQLCompletionProvider();
			}
		}
	);

	onBeforeUnmount(() => {
		window.removeEventListener('resize', handleResize);
		disposeEditor();
	});

	return {
		container,
		layout,
		getSelectedText,
		saveAsScratch,
		isFixingSQL,
		showProcessingOverlay,
		explainResult
	};
}
