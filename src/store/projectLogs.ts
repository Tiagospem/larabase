import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { LogEntry, LogFile } from '@/types/project';
import { useProjectStore } from '@/store/project';

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
  const totalPages = computed(() => Math.ceil(logEntries.value.length / itemsPerPage.value));

  const paginatedEntries = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return logEntries.value.slice(start, end);
  });

  const projectStore = useProjectStore();

  const availableLogTypes = computed(() => {
    return ['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'];
  });

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

        if (logFiles.value.length > 0 && !selectedLogFile.value) {
          selectedLogFile.value = logFiles.value[0];
          await loadLogFileContent(selectedLogFile.value.path);
        }
      } else {
        error.value = result.message || 'Failed to load log files';
        logFiles.value = [];
      }
    } catch (err: any) {
      console.error('Error loading log files:', err);
      error.value = err.message || 'An error occurred while loading log files';
      logFiles.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshLogs() {
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
          const sameFile = logFiles.value.find(file => file.path === previousFile.path);
          if (sameFile) {
            selectedLogFile.value = sameFile;
            await loadLogFileContent(sameFile.path, searchTerm.value, selectedLogType.value, false);
          } else if (logFiles.value.length > 0) {
            selectedLogFile.value = logFiles.value[0];
            await loadLogFileContent(selectedLogFile.value.path, '', 'ALL', false);
          }
        } else if (logFiles.value.length > 0 && !selectedLogFile.value) {
          selectedLogFile.value = logFiles.value[0];
          await loadLogFileContent(selectedLogFile.value.path, '', 'ALL', false);
        }
      } else {
        error.value = result.message || 'Failed to load log files';
      }
    } catch (err: any) {
      console.error('Error refreshing log files:', err);
      error.value = err.message || 'An error occurred while refreshing log files';
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
      const result = await window.ipcRenderer.readLogFile(filePath, term, type);

      if (result.success) {
        logEntries.value = result.entries || [];
        currentPage.value = 1;
      } else {
        error.value = result.message || 'Failed to load log content';
        logEntries.value = [];
      }
    } catch (err: any) {
      console.error('Error loading log content:', err);
      error.value = err.message || 'An error occurred while loading log content';
      logEntries.value = [];
    } finally {
      if (setLoadingState) {
        isLoading.value = false;
      }
    }
  }

  async function filterLogs(setLoadingState: boolean = true) {
    if (selectedLogFile.value) {
      if (setLoadingState) {
        isLoading.value = true;
      }
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
      } catch (err: any) {
        console.error('Error filtering logs:', err);
        error.value = err.message || 'An error occurred while filtering logs';
      } finally {
        if (setLoadingState) {
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
    } catch (err: any) {
      console.error('Error deleting log entry:', err);
      error.value = err.message || 'An error occurred while deleting the log entry';
      return {
        success: false,
        message: err.message || 'An error occurred while deleting the log entry',
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
    } catch (err: any) {
      console.error('Error clearing log files:', err);
      error.value = err.message || 'An error occurred while clearing log files';
      return {
        success: false,
        message: err.message || 'An error occurred while clearing log files',
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
    } catch (err: any) {
      console.error('Error deleting log files:', err);
      error.value = err.message || 'An error occurred while deleting log files';
      return {
        success: false,
        message: err.message || 'An error occurred while deleting log files',
      };
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
    filterLogs,
    nextPage,
    prevPage,
    refreshLogs,
    deleteLogEntry,
    deleteAllLogs,
    clearAllLogs,
    loadLogFileContent,
  };
});
