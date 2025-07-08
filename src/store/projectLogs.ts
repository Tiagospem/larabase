import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { LogEntry, LogFile } from '@/types/project.d';
import { useProjectStore } from '@/store/project';
import { SshConnection } from '@/types/ssh-connection.d';
import {
	findRemoteLogFiles,
	listRemoteFiles,
	readRemoteFile
} from '@/services/remote-file-service';

interface GuessedRemoteFileEntry {
	filename?: string;
	name?: string;
	isDirectory?: boolean;
	attrs?: {
		size?: number;
		mtime?: number;
	};
	size?: number;
	mtime?: number;
}

export const useProjectLogsStore = defineStore('projectLogs', () => {
	const logFiles = ref<LogFile[]>([]);
	const logEntries = ref<LogEntry[]>([]);
	const selectedLogFile = ref<LogFile | null>(null);
	const searchTerm = ref('');
	const selectedLogType = ref('ALL');
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	const currentPage = ref(1);
	const itemsPerPage = ref(20);

	const projectStore = useProjectStore();

	const totalPages = computed(() =>
		Math.ceil(logEntries.value.length / itemsPerPage.value)
	);

	const paginatedEntries = computed(() => {
		const start = (currentPage.value - 1) * itemsPerPage.value;
		const end = start + itemsPerPage.value;
		return logEntries.value.slice(start, end);
	});

	const availableLogTypes = computed(() => {
		return ['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'];
	});

	function normalizePath(path: string): string {
		return path.replace(/\/+/g, '/');
	}

	function parseLogContent(
		content: string,
		searchTerm: string,
		logType: string
	): LogEntry[] {
		const entries: LogEntry[] = [];
		const lines = content.split('\n');
		let currentEntry: LogEntry | null = null;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const logMatch = line.match(
				/\[([\d\-\s:]+)]\s+(\w+)\.(\w+):\s+(.*)/
			);

			if (logMatch) {
				if (currentEntry) {
					entries.push(currentEntry);
				}

				currentEntry = {
					timestamp: logMatch[1],
					level: logMatch[3],
					message: logMatch[4],
					content: [line]
				};
			} else if (currentEntry && line.trim() !== '') {
				currentEntry.content.push(line);
			}
		}

		if (currentEntry) {
			entries.push(currentEntry);
		}

		const filteredEntries = entries.filter((entry) => {
			const matchesType = logType === 'ALL' || entry.level === logType;
			const matchesSearch =
				!searchTerm ||
				entry.message
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				entry.content.some((line) =>
					line.toLowerCase().includes(searchTerm.toLowerCase())
				);

			return matchesType && matchesSearch;
		});

		return filteredEntries.reverse();
	}

	function setError(err: unknown, defaultMessage: string): void {
		console.error(defaultMessage, err);
		error.value = err instanceof Error ? err.message : defaultMessage;
	}

	function selectFirstLogFile(): void {
		if (logFiles.value.length > 0 && !selectedLogFile.value) {
			selectedLogFile.value = logFiles.value[0];
		}
	}

	function sanitizeObject<T>(obj: T): T {
		return structuredClone(JSON.parse(JSON.stringify(obj)));
	}

	async function loadLogFiles() {
		if (!projectStore.selectedProject?.projectPath) {
			error.value = 'No project selected';
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const result = await window.ipcRenderer.getProjectLogs(
				projectStore.selectedProject.projectPath
			);

			if (result.success) {
				logFiles.value = result.logs || [];
				selectFirstLogFile();

				if (selectedLogFile.value) {
					await loadLogFileContent(selectedLogFile.value.path);
				}
			} else {
				error.value = result.message || 'Failed to load log files';
				logFiles.value = [];
			}
		} catch (err) {
			setError(err, 'An error occurred while loading log files');
			logFiles.value = [];
		} finally {
			isLoading.value = false;
		}
	}

	async function loadLogFileContent(
		filePath: string,
		term: string = searchTerm.value,
		type: string = selectedLogType.value,
		setLoadingState: boolean = true
	) {
		if (!filePath) {
			error.value = 'No log file selected';
			return;
		}

		if (setLoadingState) {
			isLoading.value = true;
		}
		error.value = null;

		try {
			const result = await window.ipcRenderer.readLogFile(
				filePath,
				term,
				type
			);

			if (result.success) {
				logEntries.value = result.entries || [];
				currentPage.value = 1;
			} else {
				error.value = result.message || 'Failed to load log content';
				logEntries.value = [];
			}
		} catch (err) {
			setError(err, 'An error occurred while loading log content');
			logEntries.value = [];
		} finally {
			if (setLoadingState) {
				isLoading.value = false;
			}
		}
	}

	async function filterLogs(isSSHConnection: boolean = false) {
		if (!selectedLogFile.value) return;

		if (isSSHConnection) {
			if (!projectStore.selectedProject?.sshConfig) {
				error.value = 'No SSH connection configured';
				return;
			}

			await loadRemoteLogFileContent(
				projectStore.selectedProject.sshConfig,
				selectedLogFile.value.path,
				searchTerm.value,
				selectedLogType.value
			);
		} else {
			if (selectedLogFile.value) {
				isLoading.value = true;
				try {
					const result = await window.ipcRenderer.readLogFile(
						selectedLogFile.value.path,
						searchTerm.value,
						selectedLogType.value
					);

					if (result.success) {
						logEntries.value = result.entries || [];
						currentPage.value = 1;
					} else {
						error.value = result.message || 'Failed to filter logs';
					}
				} catch (err) {
					setError(err, 'An error occurred while filtering logs');
				} finally {
					isLoading.value = false;
				}
			}
		}
	}

	async function deleteLogEntry(entry: LogEntry) {
		if (!selectedLogFile.value) {
			error.value = 'No log file selected';
			return { success: false, message: 'No log file selected' };
		}

		try {
			const result = await window.ipcRenderer.deleteLogEntry(
				selectedLogFile.value.path,
				entry.timestamp
			);

			if (!result.success) {
				error.value = result.message || 'Failed to delete log entry';
			}

			return result;
		} catch (err) {
			setError(err, 'An error occurred while deleting the log entry');
			return {
				success: false,
				message: error.value
			};
		}
	}

	async function clearAllLogs() {
		if (!projectStore.selectedProject?.projectPath) {
			error.value = 'No project selected';
			return { success: false, message: 'No project selected' };
		}

		try {
			const result = await window.ipcRenderer.clearAllLogs(
				projectStore.selectedProject.projectPath
			);

			if (result.success) {
				logEntries.value = [];
				await refreshLogs();
			} else {
				error.value = result.message || 'Failed to clear logs';
			}

			return result;
		} catch (err) {
			setError(err, 'An error occurred while clearing log files');
			return {
				success: false,
				message: error.value
			};
		}
	}

	async function deleteAllLogs() {
		if (!projectStore.selectedProject?.projectPath) {
			error.value = 'No project selected';
			return { success: false, message: 'No project selected' };
		}

		try {
			const result = await window.ipcRenderer.deleteAllLogs(
				projectStore.selectedProject.projectPath
			);

			if (result.success) {
				logFiles.value = [];
				logEntries.value = [];
				selectedLogFile.value = null;
			} else {
				error.value = result.message || 'Failed to delete log files';
			}

			return result;
		} catch (err) {
			setError(err, 'An error occurred while deleting log files');
			return {
				success: false,
				message: error.value
			};
		}
	}

	async function loadRemoteLogFiles(sshConfig: SshConnection) {
		isLoading.value = true;
		error.value = null;
		logFiles.value = [];

		try {
			const logsPath = normalizePath(
				`${sshConfig.remotePath}/storage/logs`
			);

			if (await tryLoadLaravelLog(sshConfig, logsPath)) return;

			if (await tryLoadFromDirectory(sshConfig, logsPath)) return;

			const storagePath = normalizePath(
				`${sshConfig.remotePath}/storage`
			);

			if (await tryLoadFromDirectory(sshConfig, storagePath)) return;

			const altPath = normalizePath(
				`${sshConfig.remotePath}/app/storage/logs`
			);
			if (await tryLoadFromDirectory(sshConfig, altPath)) return;

			if (await tryFindLogFilesRecursively(sshConfig)) return;

			error.value =
				'No log files found anywhere in the project. Does your application generate logs?';
		} catch (err) {
			setError(err, 'An error occurred while loading remote log files');
		} finally {
			isLoading.value = false;
		}
	}

	async function tryLoadLaravelLog(
		sshConfig: SshConnection,
		logsPath: string
	): Promise<boolean> {
		try {
			const laravelLogPath = normalizePath(`${logsPath}/laravel.log`);

			const sanitizedConfig = sanitizeObject(sshConfig);

			const fileCheckCommand = `test -f "${laravelLogPath}" && echo "File exists" || echo "File does not exist"`;
			const result = await window.ipcRenderer.ssh.executeCommand(
				sanitizedConfig,
				fileCheckCommand
			);

			if (result.stdout.includes('File exists')) {
				try {
					const content = await readRemoteFile(
						sshConfig,
						laravelLogPath
					);
					if (content) {
						logFiles.value = [
							{
								name: 'laravel.log',
								path: laravelLogPath,
								size: content.length,
								modified: new Date()
							}
						];

						selectedLogFile.value = logFiles.value[0];
						logEntries.value = parseLogContent(
							content,
							searchTerm.value,
							selectedLogType.value
						);
						currentPage.value = 1;
						return true;
					}
				} catch (readError) {
					console.error(
						'Error reading laravel.log directly:',
						readError
					);
				}
			}
		} catch (err) {
			console.error('Error checking for laravel.log directly:', err);
		}
		return false;
	}

	async function tryLoadFromDirectory(
		sshConfig: SshConnection,
		dirPath: string
	): Promise<boolean> {
		try {
			const files = await listRemoteFiles(sshConfig, dirPath);

			if (files && files.length > 0) {
				const logFilesList = files.filter((file) => {
					if (!file) return false;

					const f = file as GuessedRemoteFileEntry;
					const fileName = f.filename || f.name;
					const isDirectory =
						typeof f.isDirectory === 'boolean'
							? f.isDirectory
							: !(fileName && fileName.includes('.'));

					if (!fileName) return false;
					return fileName.endsWith('.log') && !isDirectory;
				});

				if (logFilesList.length > 0) {
					logFiles.value = logFilesList.map((file) => {
						const f = file as GuessedRemoteFileEntry;
						const fileName = f.filename || f.name;
						const fileSize = f.attrs?.size ?? f.size ?? 0;
						const modTimeRaw =
							f.attrs?.mtime ?? f.mtime ?? Date.now() / 1000;
						const modTime =
							modTimeRaw > 1000000000000
								? modTimeRaw
								: modTimeRaw * 1000;

						return {
							name: fileName as string,
							path: normalizePath(`${dirPath}/${fileName}`),
							size: fileSize as number,
							modified: new Date(modTime)
						};
					});

					if (logFiles.value.length > 0) {
						selectedLogFile.value = logFiles.value[0];
						await loadRemoteLogFileContent(
							sshConfig,
							selectedLogFile.value.path
						);
						return true;
					}
				}
			}
		} catch (err) {
			console.error(`Error accessing directory ${dirPath}:`, err);
		}
		return false;
	}

	async function tryFindLogFilesRecursively(
		sshConfig: SshConnection
	): Promise<boolean> {
		try {
			const logFilePaths = await findRemoteLogFiles(
				sshConfig,
				sshConfig.remotePath
			);

			if (logFilePaths && logFilePaths.length > 0) {
				logFiles.value = logFilePaths.map((filePath) => {
					const pathParts = filePath.split('/');
					const fileName = pathParts[pathParts.length - 1];

					return {
						name: fileName,
						path: normalizePath(filePath),
						size: 0,
						modified: new Date()
					};
				});

				if (logFiles.value.length > 0) {
					selectedLogFile.value = logFiles.value[0];
					await loadRemoteLogFileContent(
						sshConfig,
						selectedLogFile.value.path
					);
					return true;
				}
			}
		} catch (err) {
			console.error('Error finding log files recursively:', err);
		}
		return false;
	}

	async function loadRemoteLogFileContent(
		sshConnection: SshConnection,
		filePath: string,
		term: string = searchTerm.value,
		type: string = selectedLogType.value
	) {
		if (!filePath) {
			error.value = 'No log file selected';
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const fileContent = await readRemoteFile(sshConnection, filePath);
			logEntries.value = parseLogContent(fileContent, term, type);
			currentPage.value = 1;
		} catch (err) {
			setError(err, 'An error occurred while loading remote log content');
			logEntries.value = [];
		} finally {
			isLoading.value = false;
		}
	}

	function nextPage() {
		if (currentPage.value < totalPages.value) {
			currentPage.value++;
		}
	}

	function prevPage() {
		if (currentPage.value > 1) {
			currentPage.value--;
		}
	}

	async function refreshLogs(isSSHConnection: boolean = false) {
		if (isSSHConnection) {
			if (!projectStore.selectedProject?.sshConfig) {
				error.value = 'No SSH connection configured';
				return;
			}

			const sshConfig = projectStore.selectedProject.sshConfig;
			await loadRemoteLogFiles(sshConfig);
		} else {
			if (!projectStore.selectedProject?.projectPath) {
				error.value = 'No project selected';
				return;
			}

			error.value = null;
			const previousFile = selectedLogFile.value;

			try {
				const result = await window.ipcRenderer.getProjectLogs(
					projectStore.selectedProject.projectPath
				);

				if (result.success) {
					logFiles.value = result.logs || [];

					if (previousFile) {
						const sameFile = logFiles.value.find(
							(file) => file.path === previousFile.path
						);
						if (sameFile) {
							selectedLogFile.value = sameFile;
							await loadLogFileContent(
								sameFile.path,
								searchTerm.value,
								selectedLogType.value,
								false
							);
						} else if (logFiles.value.length > 0) {
							selectedLogFile.value = logFiles.value[0];
							await loadLogFileContent(
								selectedLogFile.value.path,
								'',
								'ALL',
								false
							);
						}
					} else if (
						logFiles.value.length > 0 &&
						!selectedLogFile.value
					) {
						selectedLogFile.value = logFiles.value[0];
						await loadLogFileContent(
							selectedLogFile.value.path,
							'',
							'ALL',
							false
						);
					}
				} else {
					error.value = result.message || 'Failed to load log files';
				}
			} catch (err) {
				setError(err, 'An error occurred while refreshing log files');
			}
		}
	}

	return {
		logFiles,
		logEntries,
		paginatedEntries,
		selectedLogFile,
		searchTerm,
		selectedLogType,
		isLoading,
		error,
		availableLogTypes,
		currentPage,
		itemsPerPage,
		totalPages,
		loadLogFiles,
		loadRemoteLogFiles,
		filterLogs,
		nextPage,
		prevPage,
		refreshLogs,
		deleteLogEntry,
		deleteAllLogs,
		clearAllLogs,
		loadLogFileContent
	};
});
