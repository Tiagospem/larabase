import { dialog, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import pluralize from 'pluralize';
import Store from 'electron-store';

import { Env } from '../../src/types/env';
import { Settings } from '../../src/types/settings';

import { detectDockerMysql } from '../helpers/docker';
import { ModelInfo, ModelWithContent } from '../../src/types/project';

function extractEnvValue(content: string, key: string) {
	const regex = new RegExp(`^${key}=(.*)$`, 'm');
	const match = content.match(regex);
	if (match && match[1]) {
		return match[1].trim().replace(/^["']|["']$/g, '');
	}
	return null;
}

function registerProjectHandlers(mainWindow: Electron.BrowserWindow) {
	ipcMain.handle('select-directory', async () => {
		try {
			return await dialog.showOpenDialog(mainWindow, {
				properties: ['openDirectory']
			});
		} catch (error) {
			console.error('Error selecting directory:', error);
			throw error;
		}
	});

	ipcMain.handle('select-file', async (_, options) => {
		try {
			return await dialog.showOpenDialog(mainWindow, options);
		} catch (error) {
			console.error('Error selecting file:', error);
			throw error;
		}
	});

	ipcMain.handle('validate-laravel-project', async (_, projectPath) => {
		try {
			const hasEnv = fs.existsSync(path.join(projectPath, '.env'));
			const hasArtisan = fs.existsSync(path.join(projectPath, 'artisan'));
			const hasComposerJson = fs.existsSync(
				path.join(projectPath, 'composer.json')
			);

			return hasEnv && hasArtisan && hasComposerJson;
		} catch (error) {
			console.error('Error validating Laravel project:', error);
			return false;
		}
	});

	ipcMain.handle('read-env-file', async (_, projectPath) => {
		try {
			const envPath = path.join(projectPath, '.env');

			if (!fs.existsSync(envPath)) {
				console.error('.env file not found at:', envPath);
				return null;
			}

			const envContent = fs.readFileSync(envPath, 'utf8');

			const envConfig: Env = {};

			envContent.split('\n').forEach((line) => {
				if (line.startsWith('#') || line.trim() === '') {
					return;
				}

				const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
				if (match) {
					const key = match[1];
					let value = match[2] || '';

					if (value.startsWith('"') && value.endsWith('"')) {
						value = value.slice(1, -1);
					}

					envConfig[key] = value;
				}
			});

			if (envConfig.DB_PORT) {
				envConfig.DOCKER_INFO = await detectDockerMysql(
					envConfig.DB_PORT
				);
			}

			return envConfig;
		} catch (error) {
			console.error('Error reading .env file:', error);
			return null;
		}
	});

	ipcMain.handle('read-file', async (_, filePath) => {
		try {
			if (!fs.existsSync(filePath)) {
				return {
					success: false,
					error: `File not found: ${filePath}`
				};
			}

			const content = fs.readFileSync(filePath, 'utf8');

			return {
				success: true,
				content
			};
		} catch (error) {
			console.error('Error reading file:', error);
			return {
				success: false,
				error: error.message
			};
		}
	});

	ipcMain.handle('save-file', async (_, filePath, content) => {
		try {
			if (fs.existsSync(filePath)) {
				const backupPath = `${filePath}.backup`;
				fs.copyFileSync(filePath, backupPath);
			}

			fs.writeFileSync(filePath, content, 'utf8');

			return {
				success: true,
				message: 'File saved successfully'
			};
		} catch (error) {
			console.error('Error saving file:', error);
			return {
				success: false,
				message: error.message || 'Failed to save file'
			};
		}
	});

	ipcMain.handle('save-env-file', async (_, projectPath, content) => {
		try {
			const envPath = path.join(projectPath, '.env');

			if (fs.existsSync(envPath)) {
				const backupPath = path.join(projectPath, '.env.backup');
				fs.copyFileSync(envPath, backupPath);
			}

			fs.writeFileSync(envPath, content, 'utf8');

			return {
				success: true,
				message: '.env file saved successfully'
			};
		} catch (error) {
			console.error('Error saving .env file:', error);
			return {
				success: false,
				message: error.message || 'Failed to save .env file'
			};
		}
	});

	ipcMain.handle(
		'compare-project-database',
		async (_, { projectPath, database }) => {
			try {
				const envPath = path.join(projectPath, '.env');

				if (!fs.existsSync(envPath)) {
					return {
						success: false,
						message: '.env file not found',
						isMatch: false
					};
				}

				const envContent = fs.readFileSync(envPath, 'utf8');
				const projectDatabase = extractEnvValue(
					envContent,
					'DB_DATABASE'
				);

				if (!projectDatabase) {
					return {
						success: false,
						message: 'DB_DATABASE not found in .env file',
						isMatch: false
					};
				}

				return {
					success: true,
					isMatch: projectDatabase === database,
					projectDatabase
				};
			} catch (error) {
				return {
					success: false,
					message:
						error.message || 'Failed to compare project database',
					isMatch: false
				};
			}
		}
	);

	ipcMain.handle(
		'update-env-database',
		async (_, { projectPath, database }) => {
			try {
				if (!projectPath || !database) {
					return {
						success: false,
						message: 'Missing project path or database name'
					};
				}

				const envPath = path.join(projectPath, '.env');

				if (!fs.existsSync(envPath)) {
					return {
						success: false,
						message: '.env file not found in project'
					};
				}

				let envContent = fs.readFileSync(envPath, 'utf8');

				const lines = envContent.split('\n');

				let dbLineFound = false;

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];

					if (line.trim().startsWith('#')) {
						continue;
					}

					if (line.trim().startsWith('DB_DATABASE=')) {
						lines[i] = `DB_DATABASE=${database}`;
						dbLineFound = true;
						break;
					}
				}

				if (!dbLineFound) {
					lines.push(`DB_DATABASE=${database}`);
				}

				const updatedContent = lines.join('\n');

				fs.writeFileSync(envPath, updatedContent);

				return {
					success: true,
					message: `Updated database to ${database} in .env file`
				};
			} catch (error) {
				console.error('Error updating .env database:', error);

				return {
					success: false,
					message:
						error.message ||
						'Failed to update database in .env file'
				};
			}
		}
	);

	ipcMain.handle('find-models-for-tables', async (_, projectPath: string) => {
		try {
			if (!projectPath) {
				return {
					success: false,
					message: 'Missing project path',
					models: []
				};
			}

			const dirs = [
				path.join(projectPath, 'app', 'Models'),
				path.join(projectPath, 'app')
			];

			const collectModels = () => {
				const models = [];

				const traverse = (dir: string) => {
					if (!fs.existsSync(dir)) return;
					for (const entry of fs.readdirSync(dir, {
						withFileTypes: true
					})) {
						const fullPath = path.join(dir, entry.name);
						if (entry.isDirectory()) {
							traverse(fullPath);
						} else if (
							entry.isFile() &&
							entry.name.endsWith('.php')
						) {
							try {
								const content = fs.readFileSync(
									fullPath,
									'utf8'
								);
								const isModel = [
									'extends Model',
									'Illuminate\\Database\\Eloquent\\Model',
									'extends Authenticatable',
									'Illuminate\\Foundation\\Auth\\User',
									'Illuminate\\Contracts\\Auth\\Authenticatable'
								].some((keyword) => content.includes(keyword));
								if (!isModel) continue;

								const nsMatch =
									content.match(/namespace\s+([^;]+);/);
								const classMatch =
									content.match(/class\s+(\w+)/);
								if (!classMatch) continue;

								const name = classMatch[1];
								const namespace = nsMatch?.[1] || null;
								const fullName = namespace
									? `${namespace}\\${name}`
									: name;
								const relPath = path.relative(
									projectPath,
									fullPath
								);

								models.push({
									name,
									namespace,
									fullName,
									path: fullPath,
									relativePath: relPath,
									content
								});
							} catch (err) {
								console.error(
									`Error parsing model file ${fullPath}:`,
									err
								);
							}
						}
					}
				};

				dirs.forEach(traverse);
				return models;
			};

			const models = collectModels();
			const mapping: Record<string, ModelInfo> = {};

			const getTableNames = (model: ModelWithContent) => {
				const names = new Set();

				const match = model.content.match(
					/protected\s+\$table\s*=\s*['"](.*?)['"]/
				);
				if (match) names.add(match[1]);

				const snake = model.name
					.replace(/([a-z])([A-Z])/g, '$1_$2')
					.toLowerCase();
				names.add(pluralize.plural(snake));
				names.add(pluralize.singular(snake));

				const regex = /\$table\s*=\s*['"]([^'"]+)['"]/g;
				const extra = Array.from(model.content.matchAll(regex));

				extra.forEach((m) => names.add(m[1]));

				return Array.from(names);
			};

			models.forEach((model) => {
				const info = {
					name: model.name,
					namespace: model.namespace,
					fullName: model.fullName,
					path: model.path,
					relativePath: model.relativePath
				};

				getTableNames(model).forEach((table: string) => {
					if (!mapping[table]) {
						mapping[table] = <ModelInfo>info;
					}
				});
			});

			const resultArray = Object.entries(mapping).map(
				([table, info]) => ({ table, ...info })
			);

			return { success: true, models: resultArray };
		} catch (error) {
			console.error('Error finding models for tables:', error);
			return { success: false, message: error.message, models: {} };
		}
	});

	ipcMain.handle(
		'find-factory-files',
		async (_, projectPath: string, modelName: string) => {
			try {
				if (!projectPath || !modelName) {
					return {
						success: false,
						message: 'Missing project path or model name',
						factory: null
					};
				}

				const factoryDirs = [
					path.join(projectPath, 'database', 'factories'),
					path.join(projectPath, 'database', 'Factories')
				];

				const expectedFactoryNames = [
					`${modelName}Factory.php`,
					`${modelName}Factory`
				];

				let matchedFactory = null;

				for (const dir of factoryDirs) {
					if (!fs.existsSync(dir)) continue;

					const factoryFiles = fs
						.readdirSync(dir, { withFileTypes: true })
						.filter(
							(entry) =>
								entry.isFile() && entry.name.endsWith('.php')
						)
						.map((entry) => {
							return {
								path: path.join(dir, entry.name),
								name: entry.name
							};
						});

					const exactFileMatch = factoryFiles.find(
						(file) =>
							expectedFactoryNames.includes(file.name) ||
							expectedFactoryNames.some(
								(name) =>
									file.name.toLowerCase() ===
									name.toLowerCase()
							)
					);

					if (exactFileMatch) {
						const content = fs.readFileSync(
							exactFileMatch.path,
							'utf8'
						);
						const classNameMatch = content.match(/class\s+(\w+)/);

						if (classNameMatch) {
							matchedFactory = {
								filePath: exactFileMatch.path,
								content: content,
								className: classNameMatch[1]
							};
							break;
						}
					}

					if (!matchedFactory) {
						for (const file of factoryFiles) {
							const content = fs.readFileSync(file.path, 'utf8');
							const classNameMatch =
								content.match(/class\s+(\w+)/);

							if (
								classNameMatch &&
								expectedFactoryNames.includes(classNameMatch[1])
							) {
								matchedFactory = {
									filePath: file.path,
									content: content,
									className: classNameMatch[1]
								};
								break;
							}
						}
					}
				}

				if (matchedFactory) {
					const { filePath, content, className } = matchedFactory;
					const definitionMatch = content.match(
						/public\s+function\s+definition\s*\(\s*\)\s*:?\s*[^{]*{([\s\S]*?)}/
					);

					const definition = definitionMatch
						? definitionMatch[1].trim()
						: null;

					let attributes = [];

					if (definition) {
						const attributesMatch = definition.match(
							/return\s*\[\s*([\s\S]*?)\s*];/
						);

						if (attributesMatch) {
							const attributesCode = attributesMatch[1].trim();
							const attributeLines = attributesCode
								.split('\n')
								.map((line: string) => line.trim())
								.filter(
									(line: string) =>
										line && !line.startsWith('//')
								);

							attributes = attributeLines
								.map((line: string) => {
									const parts = line
										.split('=>')
										.map((part: string) => part.trim());
									if (parts.length >= 2) {
										const name = parts[0]
											.replace(/['"]/g, '')
											.replace(/,$/, '');
										const value = parts[1].replace(
											/,$/,
											''
										);
										return { name, value };
									}
									return null;
								})
								.filter((attr: string) => attr !== null);
						}
					}

					return {
						success: true,
						factory: {
							path: filePath,
							name: className,
							content: content,
							definition: definition,
							attributes: attributes
						}
					};
				}

				return {
					success: false,
					message: `No factory found for model ${modelName}. Expected ${expectedFactoryNames.join(' or ')}`,
					factory: null
				};
			} catch (error) {
				console.error('Error finding factory files:', error);
				return {
					success: false,
					message: error.message,
					factory: null
				};
			}
		}
	);

	ipcMain.handle('open-file', async (_, filePath) => {
		try {
			const store = new Store();
			const settings = store.get('settings') || ({} as Settings);

			const preferredEditor = settings.preferredEditor || 'default';

			const editors = [
				{
					name: 'PHPStorm',
					id: 'phpstorm',
					paths: [
						'/Applications/PhpStorm.app/Contents/MacOS/phpstorm',
						'/usr/local/bin/phpstorm',
						'C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe',
						'C:\\Program Files (x86)\\JetBrains\\PhpStorm\\bin\\phpstorm.exe'
					]
				},
				{
					name: 'VSCode',
					id: 'vscode',
					paths: [
						'/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
						'/usr/bin/code',
						'/usr/local/bin/code',
						'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
						'C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd',
						'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'
					]
				},
				{
					name: 'Sublime Text',
					id: 'sublime',
					paths: [
						'/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
						'/usr/local/bin/subl',
						'C:\\Program Files\\Sublime Text\\subl.exe',
						'C:\\Program Files (x86)\\Sublime Text\\subl.exe'
					]
				},
				{
					name: 'Cursor',
					id: 'cursor',
					paths: [
						'/Applications/Cursor.app/Contents/MacOS/Cursor',
						'/usr/local/bin/cursor',
						'C:\\Program Files\\Cursor\\Cursor.exe',
						'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Cursor\\Cursor.exe'
					]
				},
				{
					name: 'Atom',
					id: 'atom',
					paths: [
						'/Applications/Atom.app/Contents/MacOS/Atom',
						'/usr/local/bin/atom',
						'C:\\Program Files\\Atom\\atom.exe',
						'C:\\Users\\%USERNAME%\\AppData\\Local\\atom\\atom.exe'
					]
				},
				{
					name: 'Vim',
					id: 'vim',
					paths: [
						'/usr/bin/vim',
						'/usr/local/bin/vim',
						'C:\\Program Files\\Vim\\vim.exe'
					]
				}
			];

			const childProcess = await import('child_process');

			if (preferredEditor !== 'default') {
				const selectedEditor = editors.find(
					(editor) => editor.id === preferredEditor
				);

				if (selectedEditor) {
					for (const editorPath of selectedEditor.paths) {
						try {
							if (fs.existsSync(editorPath)) {
								const child = childProcess.spawn(
									editorPath,
									[filePath],
									{
										detached: true,
										stdio: 'ignore'
									}
								);
								child.unref();
								return {
									success: true,
									editor: selectedEditor.name
								};
							}
						} catch (e) {
							console.error(
								`Error using preferred editor ${editorPath}:`,
								e
							);
						}
					}
					console.warn(
						`Preferred editor ${preferredEditor} not found, falling back to defaults`
					);
				}
			} else {
				for (const editor of editors) {
					for (const editorPath of editor.paths) {
						try {
							if (fs.existsSync(editorPath)) {
								const child = childProcess.spawn(
									editorPath,
									[filePath],
									{
										detached: true,
										stdio: 'ignore'
									}
								);
								child.unref();
								return { success: true, editor: editor.name };
							}
						} catch (e) {
							console.error(
								`Error checking editor path ${editorPath}:`,
								e
							);
						}
					}
				}
			}

			await shell.openPath(filePath);
			return { success: true, editor: 'default' };
		} catch (error) {
			console.error('Failed to open file:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(
		'find-table-migrations',
		async (_, projectPath: string, tableName: string) => {
			try {
				if (!projectPath || !tableName) {
					return {
						success: false,
						message: 'Missing project path or table name',
						migrations: []
					};
				}

				const migrationsPath = path.join(
					projectPath,
					'database',
					'migrations'
				);

				if (!fs.existsSync(migrationsPath)) {
					return {
						success: false,
						message: 'Migrations directory not found',
						migrations: []
					};
				}

				const migrationFiles = fs
					.readdirSync(migrationsPath)
					.filter((file) => file.endsWith('.php'));

				const relevantMigrations = [];

				for (const file of migrationFiles) {
					const filePath = path.join(migrationsPath, file);
					const content = fs.readFileSync(filePath, 'utf8');

					const isMainTable = new RegExp(
						`Schema::create\\(['"]${tableName}['"]|` +
							`Schema::table\\(['"]${tableName}['"]|` +
							`Schema::drop\\(['"]${tableName}['"]|` +
							`Schema::dropIfExists\\(['"]${tableName}['"]`,
						'i'
					).test(content);

					const isRenameOperation = new RegExp(
						`Schema::rename\\(['"]${tableName}['"]|` +
							`rename\\(['"]\\w+['"],\\s*['"]${tableName}['"]\\)|` +
							`rename\\(['"]${tableName}['"],\\s*['"]\\w+['"]\\)`,
						'i'
					).test(content);

					if (isMainTable || isRenameOperation) {
						const nameParts = file.split('_');
						const timestamp = nameParts[0];

						const year = timestamp.substring(0, 4);
						const month = timestamp.substring(4, 6);
						const day = timestamp.substring(6, 8);

						const dateString = `${year}-${month}-${day}`;

						const date = new Date(dateString);

						let migrationName = file
							.replace(/^\d+_/, '')
							.replace('.php', '');

						migrationName = migrationName
							.split('_')
							.map(
								(word) =>
									word.charAt(0).toUpperCase() + word.slice(1)
							)
							.join(' ');

						const actions = [];

						if (
							content.includes(`Schema::create('${tableName}'`) ||
							content.includes(`Schema::create("${tableName}"`)
						) {
							actions.push({
								type: 'CREATE',
								description: `Created ${tableName} table`
							});
						} else if (
							content.includes(`Schema::table('${tableName}'`) ||
							content.includes(`Schema::table("${tableName}"`)
						) {
							actions.push({
								type: 'ALTER',
								description: `Modified ${tableName} table`
							});

							if (
								content.includes('->add') ||
								content.match(/\$table->\w+\(/g)
							) {
								actions.push({
									type: 'ADD',
									description: 'Added columns'
								});
							}

							if (
								content.includes('->drop') ||
								content.includes('dropColumn')
							) {
								actions.push({
									type: 'DROP',
									description: 'Removed columns'
								});
							}

							if (
								content.includes('foreign') ||
								content.includes('references')
							) {
								actions.push({
									type: 'FOREIGN KEY',
									description: 'Modified foreign keys'
								});
							}
						}

						if (
							content.includes(`Schema::drop('${tableName}'`) ||
							content.includes(`Schema::drop("${tableName}"`) ||
							content.includes(
								`Schema::dropIfExists('${tableName}'`
							) ||
							content.includes(
								`Schema::dropIfExists("${tableName}"`
							)
						) {
							actions.push({
								type: 'DROP',
								description: `Dropped table`
							});
						}

						if (isRenameOperation) {
							actions.push({
								type: 'RENAME',
								description: `Renamed table`
							});
						}

						const status = 'APPLIED';

						relevantMigrations.push({
							id: file,
							name: file,
							displayName: migrationName,
							status: status,
							created_at: date.toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							}),
							table: tableName,
							actions: actions,
							code: content,
							path: filePath
						});
					}
				}

				relevantMigrations.sort((a, b) => {
					const aTimestamp = parseInt(a.name.split('_')[0]);
					const bTimestamp = parseInt(b.name.split('_')[0]);
					return bTimestamp - aTimestamp;
				});

				return {
					success: true,
					migrations: relevantMigrations
				};
			} catch (error) {
				console.error('Error finding table migrations:', error);
				return {
					success: false,
					message: error.message || 'Failed to find table migrations',
					migrations: []
				};
			}
		}
	);

	ipcMain.handle('read-model-file', async (_, filePath) => {
		try {
			if (!filePath) {
				return {
					success: false,
					message: 'Missing file path',
					content: null
				};
			}

			if (!fs.existsSync(filePath)) {
				return {
					success: false,
					message: 'File not found',
					content: null
				};
			}

			const content = fs.readFileSync(filePath, 'utf8');

			return {
				success: true,
				content: content
			};
		} catch (error) {
			console.error('Error reading model file:', error);
			return {
				success: false,
				message: error.message,
				content: null
			};
		}
	});

	ipcMain.handle('get-project-logs', async (_, projectPath) => {
		try {
			if (!projectPath) {
				return {
					success: false,
					message: 'Missing project path',
					logs: []
				};
			}

			const logsPath = path.join(projectPath, 'storage', 'logs');

			if (!fs.existsSync(logsPath)) {
				return {
					success: false,
					message: 'Logs directory not found',
					logs: []
				};
			}

			const logFiles = fs
				.readdirSync(logsPath)
				.filter((file) => file.endsWith('.log'))
				.map((file) => ({
					name: file,
					path: path.join(logsPath, file),
					size: fs.statSync(path.join(logsPath, file)).size,
					modified: fs.statSync(path.join(logsPath, file)).mtime
				}))
				.sort((a, b) => b.modified.getTime() - a.modified.getTime());

			return {
				success: true,
				logs: logFiles
			};
		} catch (error) {
			console.error('Error reading project logs:', error);
			return {
				success: false,
				message: error.message,
				logs: []
			};
		}
	});

	ipcMain.handle(
		'read-log-file',
		async (_, filePath, searchTerm = '', logType = '') => {
			try {
				if (!filePath) {
					return {
						success: false,
						message: 'Missing file path',
						content: []
					};
				}

				if (!fs.existsSync(filePath)) {
					return {
						success: false,
						message: 'File not found',
						content: []
					};
				}

				const content = fs.readFileSync(filePath, 'utf8');
				const lines = content.split('\n');

				const logEntries = [];
				let currentEntry = null;

				for (const line of lines) {
					const dateMatch = line.match(
						/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}.*?)]/
					);

					if (dateMatch) {
						if (currentEntry) {
							logEntries.push(currentEntry);
						}

						let level = 'INFO';

						const standardLevelMatch =
							line.match(/]\s+(\w+)\.([A-Z]+):/);
						const simpleLevelMatch = line.match(/]\s+([A-Z]+):/);
						const bracketLevelMatch =
							line.match(/\[(.*?)].*?\[(.*?)]/);

						if (standardLevelMatch && standardLevelMatch[2]) {
							level = standardLevelMatch[2];
						} else if (simpleLevelMatch && simpleLevelMatch[1]) {
							level = simpleLevelMatch[1];
						} else if (bracketLevelMatch && bracketLevelMatch[2]) {
							level = bracketLevelMatch[2];
						}

						const uppercaseLevel = level.toUpperCase();

						if (
							uppercaseLevel === 'ERROR' ||
							uppercaseLevel === 'ERR' ||
							uppercaseLevel === 'CRITICAL' ||
							uppercaseLevel === 'ALERT' ||
							uppercaseLevel === 'EMERGENCY' ||
							uppercaseLevel === 'FATAL'
						) {
							level = 'ERROR';
						} else if (
							uppercaseLevel === 'WARNING' ||
							uppercaseLevel === 'WARN'
						) {
							level = 'WARNING';
						} else if (
							uppercaseLevel === 'INFO' ||
							uppercaseLevel === 'INFORMATION' ||
							uppercaseLevel === 'NOTICE'
						) {
							level = 'INFO';
						} else if (
							uppercaseLevel === 'DEBUG' ||
							uppercaseLevel === 'TRACE' ||
							uppercaseLevel === 'VERBOSE'
						) {
							level = 'DEBUG';
						} else if (
							/\bERROR\b|\bERR\b|\bCRIT\b|\bALERT\b|\bEMERG\b|\bFATAL\b/i.test(
								level
							)
						) {
							level = 'ERROR';
						} else if (/\bWARN/i.test(level)) {
							level = 'WARNING';
						} else if (/\bINFO\b|\bNOTICE\b/i.test(level)) {
							level = 'INFO';
						} else {
							level = 'DEBUG';
						}

						currentEntry = {
							timestamp: dateMatch[1],
							level: level,
							message: line,
							content: [line]
						};
					} else if (currentEntry) {
						currentEntry.content.push(line);
					}
				}

				if (currentEntry) {
					logEntries.push(currentEntry);
				}

				let filteredEntries = logEntries;

				if (searchTerm) {
					const searchLower = searchTerm.toLowerCase();
					filteredEntries = filteredEntries.filter((entry) =>
						entry.content.some((line: string) =>
							line.toLowerCase().includes(searchLower)
						)
					);
				}

				if (logType && logType !== 'ALL') {
					filteredEntries = filteredEntries.filter(
						(entry) => entry.level === logType
					);
				}

				return {
					success: true,
					entries: filteredEntries
				};
			} catch (error) {
				console.error('Error reading log file:', error);
				return {
					success: false,
					message: error.message,
					entries: []
				};
			}
		}
	);

	ipcMain.handle('delete-log-entry', async (_, filePath, timestamp) => {
		try {
			if (!filePath || !timestamp) {
				return {
					success: false,
					message: 'Missing file path or log entry timestamp'
				};
			}

			if (!fs.existsSync(filePath)) {
				return {
					success: false,
					message: 'File not found'
				};
			}

			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split('\n');

			let newLines = [];
			let entryFound = false;
			let targetEntry = null;
			let targetEntryStartIndex = -1;
			let targetEntryEndIndex = -1;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const dateMatch = line.match(
					/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}.*?)]/
				);

				if (dateMatch) {
					if (dateMatch[1] === timestamp && targetEntry === null) {
						targetEntry = line;
						targetEntryStartIndex = i;
					} else if (
						targetEntryStartIndex >= 0 &&
						targetEntry !== null
					) {
						targetEntryEndIndex = i - 1;
						break;
					}
				}
			}

			if (targetEntryStartIndex >= 0 && targetEntryEndIndex === -1) {
				targetEntryEndIndex = lines.length - 1;
			}

			if (
				targetEntryStartIndex >= 0 &&
				targetEntryEndIndex >= targetEntryStartIndex
			) {
				entryFound = true;
				for (let i = 0; i < lines.length; i++) {
					if (i < targetEntryStartIndex || i > targetEntryEndIndex) {
						newLines.push(lines[i]);
					}
				}
			} else {
				newLines = lines;
			}

			if (!entryFound) {
				return {
					success: false,
					message: 'Log entry not found'
				};
			}

			fs.writeFileSync(filePath, newLines.join('\n'));

			return {
				success: true,
				message: 'Log entry deleted successfully'
			};
		} catch (error) {
			console.error('Error deleting log entry:', error);
			return {
				success: false,
				message: error.message
			};
		}
	});

	ipcMain.handle('delete-log-file', async (_, filePath) => {
		try {
			if (!filePath) {
				return {
					success: false,
					message: 'Missing file path'
				};
			}

			if (!fs.existsSync(filePath)) {
				return {
					success: false,
					message: 'File not found'
				};
			}

			fs.unlinkSync(filePath);

			return {
				success: true,
				message: 'Log file deleted successfully'
			};
		} catch (error) {
			console.error('Error deleting log file:', error);
			return {
				success: false,
				message: error.message
			};
		}
	});

	ipcMain.handle('delete-all-logs', async (_, projectPath) => {
		try {
			if (!projectPath) {
				return {
					success: false,
					message: 'Missing project path'
				};
			}

			const logsPath = path.join(projectPath, 'storage', 'logs');

			if (!fs.existsSync(logsPath)) {
				return {
					success: false,
					message: 'Logs directory not found'
				};
			}

			const logFiles = fs
				.readdirSync(logsPath)
				.filter((file) => file.endsWith('.log'));

			for (const file of logFiles) {
				fs.unlinkSync(path.join(logsPath, file));
			}

			return {
				success: true,
				message: `Deleted ${logFiles.length} log files`
			};
		} catch (error) {
			console.error('Error deleting all log files:', error);
			return {
				success: false,
				message: error.message
			};
		}
	});

	ipcMain.handle('clear-all-logs', async (_, projectPath) => {
		try {
			if (!projectPath) {
				return {
					success: false,
					message: 'Missing project path'
				};
			}

			const logsPath = path.join(projectPath, 'storage', 'logs');

			if (!fs.existsSync(logsPath)) {
				return {
					success: false,
					message: 'Logs directory not found'
				};
			}

			const logFiles = fs
				.readdirSync(logsPath)
				.filter((file) => file.endsWith('.log'));

			for (const file of logFiles) {
				fs.writeFileSync(path.join(logsPath, file), '');
			}

			return {
				success: true,
				message: `Cleared ${logFiles.length} log files`
			};
		} catch (error) {
			console.error('Error clearing all log files:', error);
			return {
				success: false,
				message: error.message
			};
		}
	});

	ipcMain.handle('find-laravel-commands', async (_, projectPath) => {
		try {
			if (!projectPath) {
				return {
					success: false,
					message: 'Missing project path',
					commands: []
				};
			}

			const commandPaths = [
				path.join(projectPath, 'app', 'Console', 'Commands'),
				path.join(projectPath, 'app', 'Console', 'commands')
			];

			const commandsMap = new Map();

			const findCommands = (dirPath) => {
				if (!fs.existsSync(dirPath)) return;

				const entries = fs.readdirSync(dirPath, {
					withFileTypes: true
				});

				for (const entry of entries) {
					const fullPath = path.join(dirPath, entry.name);

					if (entry.isDirectory()) {
						findCommands(fullPath);
						continue;
					}

					if (entry.isFile() && entry.name.endsWith('.php')) {
						try {
							const content = fs.readFileSync(fullPath, 'utf8');
							const isCommand = [
								'extends Command',
								'Illuminate\\Console\\Command'
							].some((keyword) => content.includes(keyword));

							if (!isCommand) continue;

							const nsMatch =
								content.match(/namespace\s+([^;]+);/);
							const classMatch = content.match(/class\s+(\w+)/);

							if (!classMatch) continue;

							const name = classMatch[1];
							const namespace = nsMatch?.[1] || null;
							const relativePath = path.relative(
								projectPath,
								fullPath
							);

							let signature = null;

							const signatureMatch = content.match(
								/protected\s+\$signature\s*=\s*['"]([^'"]+)['"]/
							);
							if (signatureMatch && signatureMatch[1]) {
								signature = signatureMatch[1];
							}

							if (!signature) {
								const nameMatch = content.match(
									/protected\s+\$name\s*=\s*['"]([^'"]+)['"]/
								);
								if (nameMatch && nameMatch[1]) {
									signature = nameMatch[1];
								}
							}

							commandsMap.set(name, {
								name,
								namespace,
								signature,
								path: fullPath,
								relativePath
							});
						} catch (err) {
							console.error(
								`Error parsing command file ${fullPath}:`,
								err
							);
						}
					}
				}
			};

			commandPaths.forEach((dirPath) => findCommands(dirPath));

			return {
				success: true,
				commands: Array.from(commandsMap.values())
			};
		} catch (error) {
			console.error('Error finding Laravel commands:', error);
			return {
				success: false,
				message: error.message || 'Failed to find Laravel commands',
				commands: []
			};
		}
	});
}

export { registerProjectHandlers };
