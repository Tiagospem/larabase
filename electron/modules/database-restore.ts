import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import {
	ProjectConnection,
	RestorationProgressConfig,
	RestoreConfig,
	TableInfo
} from '../../src/types/project';
import zlib, { Gunzip } from 'zlib';
import readline from 'readline';
import { Readable } from 'stream';

import {
	createConnection,
	testConnection,
	releaseConnection
} from '../helpers/mysql';
import {
	executeMysqlFileInContainer,
	createDockerClient
} from '../helpers/docker';
import { exec } from 'child_process';

let activeRestoreProcess = null;

global.restoreInProgress = false;

function buildSedFilters(ignoredTables = []) {
	if (!Array.isArray(ignoredTables) || ignoredTables.length === 0) {
		return '';
	}

	const sedCommands = ignoredTables.map(
		(table) => `/INSERT INTO \`${table}\`/d; /INSERT INTO "${table}"/d`
	);
	return ` | sed '${sedCommands.join('; ')}'`;
}

function buildBaseCommand(
	sqlFilePath: string,
	sedFilters: string,
	useGunzip: boolean,
	ignoreCreateDatabase = false
) {
	const reader = useGunzip
		? `gunzip -c "${sqlFilePath}"`
		: `cat "${sqlFilePath}"`;
	let command = `${reader}${sedFilters}`;

	if (ignoreCreateDatabase) {
		command += ` | sed '/CREATE DATABASE/d; /USE \`/d'`;
	}

	return `set -o pipefail && ${command}`;
}

function buildCredentialFlags({ user, password, host, port }) {
	let flags = ` -u${user || 'root'}`;
	if (password) flags += ` -p${password}`;
	if (host && host !== 'localhost') flags += ` -h${host}`;
	if (port) flags += ` -P${port}`;
	return flags;
}

function getFileSizeOrThrow(filePath: string) {
	let size = 0;

	try {
		const stats = fs.statSync(filePath);

		size = stats.size;
	} catch (err) {
		throw new Error(`Error accessing SQL file: ${err.message}`);
	}

	if (size === 0) {
		throw new Error('SQL file is empty (0 bytes)');
	}

	return size;
}

function ensureConfig(projectConnection: ProjectConnection, type: string) {
	if (
		!projectConnection ||
		!projectConnection.db_config.host ||
		!projectConnection.db_config.port ||
		!projectConnection.db_config.user ||
		!projectConnection.db_config.database
	) {
		throw new Error(
			`Missing connection configuration for ${type} restore command`
		);
	}
}

async function validateDatabaseHasContent(restorationObject: RestoreConfig) {
	let dbConnection: any;

	try {
		try {
			dbConnection = await createConnection(
				restorationObject.project.db_config,
				{
					useConnectionDb: false,
					targetDatabase: restorationObject.targetDatabase
				}
			);

			const [rows] = await dbConnection.query(`SHOW TABLES`);

			if (!Array.isArray(rows) || rows.length === 0) {
				return { hasContent: false, tableCount: 0 };
			}

			const tableCount = rows.length;

			return { hasContent: tableCount > 0, tableCount };
		} finally {
			await releaseConnection(dbConnection);
		}
	} catch (error) {
		console.error('Error validating database content:', error);

		return { hasContent: false, error: error.message };
	}
}

function buildLocalRestoreCommand(restorationObject: RestoreConfig) {
	ensureConfig(restorationObject.project, 'local');

	getFileSizeOrThrow(restorationObject.filePath);

	const targetDatabase = restorationObject.targetDatabase;
	const ignoredTables = restorationObject.ignoredTables;
	const filePath = restorationObject.filePath;

	const sedFilters = buildSedFilters(ignoredTables);

	const useGunzip = filePath.toLowerCase().endsWith('.gz');

	let command = buildBaseCommand(filePath, sedFilters, useGunzip, true);

	command += ' | mysql';
	command += buildCredentialFlags(restorationObject.project.db_config);
	command += ' --binary-mode=1 --force';
	command += ` --init-command="DROP DATABASE IF EXISTS \\\`${targetDatabase}\\\`; CREATE DATABASE \\\`${targetDatabase}\\\`; USE \\\`${targetDatabase}\\\`;"`;
	command += ` --database=\`${targetDatabase}\``;

	console.log(`Local restore: Will restore to database "${targetDatabase}"`);

	return {
		command: command,
		container: null,
		connection: restorationObject.project.db_config,
		sqlFilePath: restorationObject.filePath,
		ignoredTables: restorationObject.ignoredTables || [],
		useDockerApi: false,
		ignoreCreateDatabase: true,
		targetDatabase: restorationObject.targetDatabase
	} as RestorationProgressConfig;
}

function buildDockerRestoreCommand(restorationObject: RestoreConfig) {
	ensureConfig(restorationObject.project, 'Docker');

	if (!restorationObject.project.dockerInfo.dockerContainerName) {
		throw new Error('Docker container name is missing or invalid');
	}

	getFileSizeOrThrow(restorationObject.filePath);

	console.log(
		`Docker restore: Will restore to database "${restorationObject.targetDatabase}"`
	);

	return {
		command: null,
		container: restorationObject.project.dockerInfo.dockerContainerName,
		connection: restorationObject.project.db_config,
		sqlFilePath: restorationObject.filePath,
		ignoredTables: restorationObject.ignoredTables || [],
		useDockerApi: true,
		ignoreCreateDatabase: true,
		targetDatabase: restorationObject.targetDatabase
	} as RestorationProgressConfig;
}

function formatCount(n: number) {
	if (n >= 1_000_000) return `~${Math.round(n / 1_000_000)}m`;
	if (n >= 1_000) return `~${Math.round(n / 1_000)}k`;
	return `${n}`;
}

async function restoreDatabase(
	options: { sender: { send: (channel: string, data: any) => void } },
	restorationObject: RestoreConfig
) {
	const sendProgress = (
		status: string,
		progress: number,
		message: string
	) => {
		options.sender.send('restoration-progress', {
			status,
			progress,
			message
		});
	};

	global.restoreInProgress = true;
	global.cancelRestoreRequested = false;

	sendProgress('starting', 0, 'Starting database restoration process');

	try {
		await testConnection(restorationObject.project.db_config);

		sendProgress('validating', 10, 'Database connection validated');
	} catch (err) {
		sendProgress(
			'error',
			0,
			`Connection validation failed: ${err.message}`
		);

		global.restoreInProgress = false;

		return { success: false, error: err.message };
	}

	let commandConfig: RestorationProgressConfig;

	try {
		if (restorationObject.project.dockerInfo.isDocker) {
			commandConfig = buildDockerRestoreCommand(restorationObject);
		} else {
			commandConfig = buildLocalRestoreCommand(restorationObject);
		}

		global.currentRestoreConfig = commandConfig;
	} catch (err) {
		console.error('Error building restore command:', err);

		sendProgress('error', 0, `Command error: ${err.message}`);

		global.restoreInProgress = false;

		return { success: false, error: err.message };
	}

	sendProgress('preparing', 20, 'Starting restoration process');

	let stdoutData = '';
	let stderrData = '';

	let wasCancelled = false;

	try {
		await new Promise<void>((resolve, reject) => {
			if (global.cancelRestoreRequested || !global.restoreInProgress) {
				wasCancelled = true;
				reject(new Error('Operation cancelled by user'));
				return;
			}

			if (commandConfig.useDockerApi) {
				sendProgress(
					'restoring',
					30,
					'Executing SQL restore in Docker container'
				);

				const progressCallback = (progress: number) => {
					if (
						global.cancelRestoreRequested ||
						!global.restoreInProgress
					) {
						console.log(
							'Cancellation detected during progress update'
						);
						return;
					}

					const adjustedProgress = 30 + progress * 0.6;

					sendProgress(
						'restoring',
						adjustedProgress,
						`Restoring database: ${progress}% complete`
					);
				};

				executeMysqlFileInContainer(commandConfig, progressCallback)
					.then((stream: fs.ReadStream) => {
						if (
							global.cancelRestoreRequested ||
							!global.restoreInProgress
						) {
							console.log(
								'Cancellation detected after Docker execution'
							);

							wasCancelled = true;

							if (
								stream &&
								typeof stream === 'object' &&
								stream.destroy
							) {
								stream.destroy();
							}

							reject(new Error('Operation cancelled by user'));
							return;
						}

						if (stream && typeof stream === 'object') {
							activeRestoreProcess = stream;

							const checkCancelInterval = setInterval(() => {
								if (
									global.cancelRestoreRequested ||
									!global.restoreInProgress
								) {
									console.log(
										'Cancel request detected, terminating Docker stream'
									);

									wasCancelled = true;

									global.cancelRestoreRequested = false;

									try {
										if (activeRestoreProcess) {
											if (activeRestoreProcess.destroy) {
												activeRestoreProcess.destroy();
											}

											if (
												activeRestoreProcess.dockerExecId &&
												activeRestoreProcess.dockerContainer
											) {
												try {
													console.log(
														'Attempting to kill Docker exec process'
													);

													const docker =
														createDockerClient();
													const container =
														docker.getContainer(
															activeRestoreProcess.dockerContainer
														);
													const exec =
														container.getExec(
															activeRestoreProcess.dockerExecId
														);

													exec.stop().catch(
														(err: any) =>
															console.error(
																'Error stopping Docker exec:',
																err
															)
													);
												} catch (dockerErr) {
													console.error(
														'Error terminating Docker exec:',
														dockerErr
													);
												}
											}
										}

										activeRestoreProcess = null;
										clearInterval(checkCancelInterval);
										reject(
											new Error(
												'Operation cancelled by user'
											)
										);
									} catch (cancelErr) {
										console.error(
											'Error during cancellation:',
											cancelErr
										);
									}
								}
							}, 500);

							stream.on('end', () => {
								clearInterval(checkCancelInterval);
							});

							stream.on('error', () => {
								clearInterval(checkCancelInterval);
							});
						}

						sendProgress(
							'restoring',
							90,
							'Database restored successfully'
						);
						resolve();
					})
					.catch((err) => {
						console.error('Docker execution error:', err);
						sendProgress(
							'error',
							0,
							`Docker execution error: ${err.message}`
						);
						reject(err);
					});
			} else {
				//this restore command should be validated using a mysql locally like DBngin
				const child = exec(commandConfig.command, {
					shell: '/bin/bash'
				});

				activeRestoreProcess = child;

				const checkCancelInterval = setInterval(() => {
					if (
						global.cancelRestoreRequested ||
						!global.restoreInProgress
					) {
						console.log(
							'Cancel request detected, terminating shell process'
						);

						wasCancelled = true;

						global.cancelRestoreRequested = false;

						try {
							if (
								activeRestoreProcess &&
								activeRestoreProcess.kill
							) {
								activeRestoreProcess.kill('SIGKILL');
							}

							activeRestoreProcess = null;

							clearInterval(checkCancelInterval);

							reject(new Error('Operation cancelled by user'));
						} catch (cancelErr) {
							console.error(
								'Error during cancellation:',
								cancelErr
							);
						}
					}
				}, 500);

				child.stdout.on('data', (chunk) => {
					const text = chunk.toString();
					stdoutData += text;
					const m = text.match(/(\d+)%/);
					if (m) {
						const pct = parseInt(m[1], 10);
						const calc = 20 + pct * 0.8;

						sendProgress(
							'restoring',
							calc,
							`Restoring database: ${pct}% complete`
						);
					}
				});

				child.stderr.on('data', (chunk) => {
					const text = chunk.toString();
					stderrData += text;
				});

				child.on('error', (err) => {
					clearInterval(checkCancelInterval);
					console.error('Failed to start process:', err);
					sendProgress('error', 0, `Process error: ${err.message}`);
					reject(err);
				});

				child.on('close', (code) => {
					clearInterval(checkCancelInterval);
					activeRestoreProcess = null;

					if (code === 0) {
						resolve();
					} else if (wasCancelled || !global.restoreInProgress) {
						reject(new Error('Operation cancelled by user'));
					} else {
						console.error(
							'Restore failed with code',
							code,
							stderrData
						);

						sendProgress(
							'error',
							0,
							`Restoration failed: ${stderrData || `exit code ${code}`}`
						);
						reject(new Error(stderrData || `Exit code ${code}`));
					}
				});
			}
		});
	} catch (err) {
		activeRestoreProcess = null;

		if (
			wasCancelled ||
			err.message === 'Operation cancelled by user' ||
			!global.restoreInProgress
		) {
			sendProgress('cancelled', 0, 'Operation cancelled by user');

			global.restoreInProgress = false;
			global.currentRestoreConfig = null;

			return { success: false, error: 'Operation cancelled by user' };
		}

		global.restoreInProgress = false;
		global.currentRestoreConfig = null;

		return { success: false, error: err.message };
	}

	activeRestoreProcess = null;

	global.cancelRestoreRequested = false;
	global.restoreInProgress = false;
	global.currentRestoreConfig = null;

	try {
		const result = await validateDatabaseHasContent(restorationObject);

		if (result.hasContent) {
			sendProgress(
				'completed',
				100,
				`Database restored successfully with ${result.tableCount} tables`
			);

			return { success: true, tables: result.tableCount };
		} else {
			const warnMsg =
				'Database restoration seemed to succeed, but no tables were found';

			sendProgress('warning', 100, warnMsg);

			return { success: true, warning: warnMsg };
		}
	} catch (err) {
		console.error('Error validating database content:', err);

		sendProgress('completed', 100, 'Database restoration completed');

		return {
			success: true,
			warning: 'Could not validate content'
		};
	}
}

async function extractTables(filePath: string, isGzipped: boolean) {
	return new Promise<TableInfo[]>((resolve, reject) => {
		let stream: Readable = fs.createReadStream(filePath, {
			highWaterMark: 64 * 1024
		});

		if (isGzipped) {
			const gunzip: Gunzip = zlib.createGunzip();
			stream = stream.pipe(gunzip);
			gunzip.on('error', (e) =>
				reject(new Error(`Decompression error: ${e.message}`))
			);
		}

		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity
		});
		const tableNames = new Set<string>();
		const tableStats = new Map<string, { estimatedRows: number }>();

		const patterns = {
			create: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i,
			insert: /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?(?:\s*\([^)]+\))?\s+VALUES/i,
			values: /VALUES\s*\(([^)]+)\)/i,
			drop: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i,
			alter: /ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i
		};

		let currentTable = null;
		let insertBuffer = '';
		let lineCounter = 0;
		const maxLines = 100000;

		function countValues(text: string) {
			const valuesSets = text.match(/\([^)]+\)/g) || [];
			return valuesSets.length;
		}

		function countLargeInsert(buffer: string) {
			const valueMatches = buffer.match(/\),\s*\(/g) || [];
			const rowCount = valueMatches.length + 1;

			const multipleInserts = buffer.match(/INSERT\s+INTO/gi) || [];
			const insertCount = multipleInserts.length;

			return insertCount > 1 ? rowCount * insertCount : rowCount;
		}

		rl.on('line', (line) => {
			lineCounter++;
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('#'))
				return;

			['create', 'drop', 'alter'].forEach((key) => {
				const m = patterns[key].exec(line);
				if (m) {
					tableNames.add(m[1]);
					if (!tableStats.has(m[1])) {
						tableStats.set(m[1], { estimatedRows: 0 });
					}
				}
			});

			const ins = patterns.insert.exec(line);

			if (ins) {
				currentTable = ins[1];
				tableNames.add(currentTable);
				insertBuffer = line;

				if (trimmed.endsWith(';')) {
					const stats = tableStats.get(currentTable) || {
						estimatedRows: 0
					};

					const valueMatches = line.match(/\),\s*\(/g) || [];

					if (valueMatches.length > 0) {
						stats.estimatedRows += valueMatches.length + 1;
					} else if (patterns.values.test(line)) {
						stats.estimatedRows += 1;
					} else {
						stats.estimatedRows += 1;
					}

					tableStats.set(currentTable, stats);
					currentTable = null;
					insertBuffer = '';
				}
				return;
			}

			if (currentTable) {
				insertBuffer += '\n' + line;
				if (trimmed.endsWith(';') || insertBuffer.length > 1000000) {
					processInsert();
				}
			}

			if (lineCounter % maxLines === 0) {
				insertBuffer = '';
				currentTable = null;
			}
		});

		function processInsert() {
			if (!currentTable) return;

			try {
				const largeRowCount = countLargeInsert(insertBuffer);

				const stats = tableStats.get(currentTable) || {
					estimatedRows: 0
				};

				if (largeRowCount > 1) {
					stats.estimatedRows += largeRowCount;
				} else {
					const valuesCount = countValues(insertBuffer);
					if (valuesCount > 0) {
						stats.estimatedRows += valuesCount;
					} else {
						stats.estimatedRows += 1;
					}
				}

				tableStats.set(currentTable, stats);
			} catch (e) {
				const stats = tableStats.get(currentTable) || {
					estimatedRows: 0
				};

				const roughEstimate = Math.ceil(insertBuffer.length / 100);
				if (roughEstimate > 0) {
					stats.estimatedRows += roughEstimate;
				} else {
					stats.estimatedRows += 1;
				}

				tableStats.set(currentTable, stats);
			}

			currentTable = null;
			insertBuffer = '';
		}

		rl.on('close', () => {
			if (currentTable && insertBuffer) {
				processInsert();
			}

			for (const tableName of Array.from(tableNames)) {
				const stats = tableStats.get(tableName);
				if (stats && stats.estimatedRows === 0) {
					let fileHasContent = false;
					try {
						const fileSize = fs.statSync(filePath).size;
						fileHasContent = fileSize > 1000;
					} catch (err) {
						console.error('Error checking file size:', err);
					}

					if (fileHasContent) {
						stats.estimatedRows = 1;
					}
				}
			}

			const system = [
				'mysql',
				'information_schema',
				'performance_schema',
				'sys'
			];

			const result = Array.from(tableNames)
				.filter((t: string) => !system.includes(t.toLowerCase()))
				.sort()
				.map((name) => {
					const rows = tableStats.get(name)?.estimatedRows || 0;

					let size: 'large' | 'medium' | 'small' | 'empty';

					if (rows === 0) size = 'empty';
					else if (rows < 1_000) size = 'small';
					else if (rows < 100_000) size = 'medium';
					else size = 'large';
					return {
						name,
						size,
						estimatedRows: rows,
						formattedRows: formatCount(rows)
					};
				});
			resolve(result as TableInfo[]);
		});

		stream.on('error', (e) =>
			reject(new Error(`Read error: ${e.message}`))
		);
	});
}

function registerDatabaseRestoreHandlers(mainWindow: BrowserWindow) {
	ipcMain.handle('select-sql-dump-file', async () => {
		try {
			return await dialog.showOpenDialog(mainWindow, {
				title: 'Select SQL Dump File',
				buttonLabel: 'Select',
				filters: [
					{ name: 'SQL Dump Files', extensions: ['sql', 'gz'] }
				],
				properties: ['openFile']
			});
		} catch (error) {
			console.error('Error selecting SQL dump file:', error);
			throw error;
		}
	});

	ipcMain.handle('get-file-stats', async (_, filePath) => {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				return {
					success: false,
					message: 'File not found',
					size: 0
				};
			}

			const stats = fs.statSync(filePath);

			return {
				success: true,
				size: stats.size,
				created: stats.birthtime,
				modified: stats.mtime,
				isDirectory: stats.isDirectory()
			};
		} catch (error) {
			console.error('Error getting file stats:', error);

			return {
				success: false,
				message: error.message,
				size: 0
			};
		}
	});

	ipcMain.handle('extract-tables-from-sql', async (_, filePath) => {
		try {
			if (!filePath) {
				return {
					success: false,
					message: 'Missing file path',
					tables: []
				};
			}

			if (!fs.existsSync(filePath)) {
				return {
					success: false,
					message: 'File not found',
					tables: []
				};
			}

			const isGzipped = filePath.toLowerCase().endsWith('.gz');

			console.log(`Scanning SQL dump for tables: ${filePath}`);

			const tables: TableInfo[] = await extractTables(
				filePath,
				isGzipped
			);

			if (tables.length === 0) {
				return {
					success: true,
					message:
						'No tables found in the SQL file. It may be corrupted or not a valid dump file.',
					tables: []
				};
			}

			return {
				success: true,
				tables,
				message: `Found ${tables.length} tables in the SQL dump.`
			};
		} catch (err) {
			console.error('Error extracting tables:', err);

			return {
				success: false,
				message: err.message || 'Extraction failed',
				tables: []
			};
		}
	});

	ipcMain.handle(
		'restore-database',
		async (_, restorationConfig: RestoreConfig) => {
			try {
				if (
					!restorationConfig ||
					!restorationConfig.project.db_config ||
					!restorationConfig.filePath
				) {
					return {
						success: false,
						message:
							'Missing required parameters (connection or filePath)'
					};
				}

				if (!fs.existsSync(restorationConfig.filePath)) {
					return {
						success: false,
						message: 'SQL dump file not found'
					};
				}

				const targetDatabase =
					restorationConfig.targetDatabase ||
					restorationConfig.project.db_config.database;

				if (!targetDatabase) {
					return {
						success: false,
						message: 'No target database specified'
					};
				}

				const project = restorationConfig.project;

				if (
					restorationConfig.ignoredTables &&
					restorationConfig.ignoredTables.length > 0
				) {
					console.log(
						`Will ignore these tables: ${restorationConfig.ignoredTables.join(', ')}`
					);
				}

				try {
					const isGzipped = restorationConfig.filePath
						.toLowerCase()
						.endsWith('.gz');
					const useDocker =
						project.usingSail ||
						(project.dockerInfo && project.dockerInfo.isDocker);

					console.log(`Restoring database: ${targetDatabase}`);
					console.log(
						`Original connection database: ${project.db_config.database}`
					);
					console.log(`Docker mode: ${useDocker ? 'Yes' : 'No'}`);
					console.log(`Gzipped file: ${isGzipped ? 'Yes' : 'No'}`);
					console.log(
						`Ignored tables: ${restorationConfig.ignoredTables.length}`
					);

					const restore = await restoreDatabase(
						{ sender: mainWindow.webContents },
						restorationConfig
					);

					if (!restore.success) {
						return {
							success: false,
							message:
								restore.error || 'Failed to restore database'
						};
					}

					return {
						success: true,
						message: 'Database restored successfully',
						database: targetDatabase
					};
				} catch (restoreError) {
					console.error(
						'Error during database restoration:',
						restoreError
					);

					return {
						success: false,
						message:
							restoreError.message || 'Failed to restore database'
					};
				}
			} catch (error) {
				console.error(
					'Error in simple-database-restore-unified handler:',
					error
				);
				return {
					success: false,
					message:
						error.message || 'Failed to process restore request'
				};
			}
		}
	);

	ipcMain.handle('cancel-database-restore', async () => {
		console.log('Cancelling database restore process');

		global.cancelRestoreRequested = true;

		if (global.restoreInProgress) {
			console.log('Force terminating ongoing restore operation');

			global.restoreInProgress = false;

			if (global.mainWindow) {
				global.mainWindow.webContents.send('restoration-progress', {
					status: 'cancelled',
					progress: 0,
					message: 'Operation cancelled by user'
				});
			}
		}

		if (activeRestoreProcess) {
			try {
				if (activeRestoreProcess.kill) {
					console.log('Killing process with SIGKILL');
					activeRestoreProcess.kill('SIGKILL');
				} else if (activeRestoreProcess.destroy) {
					console.log('Destroying stream');
					activeRestoreProcess.destroy();
				} else if (activeRestoreProcess.stdin) {
					console.log('Closing stdin');
					activeRestoreProcess.stdin.end();
					if (activeRestoreProcess.kill) {
						activeRestoreProcess.kill('SIGKILL');
					}
				}

				if (
					activeRestoreProcess.dockerExecId &&
					activeRestoreProcess.dockerContainer
				) {
					try {
						console.log('Attempting to kill Docker exec process');
						const docker = createDockerClient();
						const container = docker.getContainer(
							activeRestoreProcess.dockerContainer
						);
						const exec = container.getExec(
							activeRestoreProcess.dockerExecId
						);

						exec.stop().catch((err) =>
							console.error('Error stopping Docker exec:', err)
						);
					} catch (dockerErr) {
						console.error(
							'Error terminating Docker exec:',
							dockerErr
						);
					}
				}

				console.log('Database restore process cancelled');
				activeRestoreProcess = null;

				return { success: true, message: 'Restoration cancelled' };
			} catch (error) {
				console.error('Error cancelling restore process:', error);
				return { success: false, error: error.message };
			}
		} else {
			console.log('No active restore process to cancel');

			if (global.restoreInProgress) {
				console.log(
					'Cancellation requested while operation is in progress'
				);

				if (
					global.currentRestoreConfig &&
					global.currentRestoreConfig.container
				) {
					try {
						console.log(
							'Attempting emergency kill of Docker processes'
						);
						const docker = createDockerClient();
						const container = docker.getContainer(
							global.currentRestoreConfig.container
						);

						const execOptions = {
							Cmd: ['pkill', '-9', 'mysql'],
							AttachStdout: true,
							AttachStderr: true
						};

						container
							.exec(execOptions)
							.then((exec) => exec.start({}))
							.then(() =>
								console.log(
									'Emergency MySQL process termination sent to container'
								)
							)
							.catch((err) =>
								console.error(
									'Failed to send kill command to container:',
									err
								)
							);

						const killOptions = {
							Cmd: ['mysql', '-e', 'KILL CONNECTION_ID()'],
							AttachStdout: true,
							AttachStderr: true
						};

						container
							.exec(killOptions)
							.then((exec) => exec.start({}))
							.then(() =>
								console.log(
									'MySQL kill query sent to container'
								)
							)
							.catch(() =>
								console.log(
									'Failed to send MySQL kill command (expected if MySQL is already down)'
								)
							);
					} catch (err) {
						console.error(
							'Error in emergency Docker termination:',
							err
						);
					}
				}

				return { success: true, message: 'Cancellation requested' };
			}

			return { success: true, message: 'No active process' };
		}
	});
}

export { registerDatabaseRestoreHandlers };
