import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCommandsStore = defineStore('commands', () => {
  const isLoading = ref(false);
  const lastCommand = ref(null);
  const commandHistory = ref([]);
  const showCommandOutput = ref(false);
  
  async function runArtisanCommand(config) {
    isLoading.value = true;
    
    try {
      const result = await window.api.runArtisanCommand(config);
      
      // Create a command result object
      const commandResult = {
        id: Date.now().toString(),
        command: result.command || config.command,
        output: result.output || '',
        success: result.success,
        message: result.message || '',
        timestamp: new Date().toISOString(),
        projectPath: config.projectPath
      };
      
      // Update last command
      lastCommand.value = commandResult;
      
      // Add to history (limit to last 20 commands)
      commandHistory.value.unshift(commandResult);
      if (commandHistory.value.length > 20) {
        commandHistory.value = commandHistory.value.slice(0, 20);
      }
      
      // Auto-show the command output
      showCommandOutput.value = true;
      
      return commandResult;
    } catch (error) {
      console.error('Error running artisan command:', error);
      
      // Create an error result
      const errorResult = {
        id: Date.now().toString(),
        command: config.command,
        output: '',
        success: false,
        message: error.message || 'Failed to run command',
        timestamp: new Date().toISOString(),
        projectPath: config.projectPath
      };
      
      lastCommand.value = errorResult;
      commandHistory.value.unshift(errorResult);
      showCommandOutput.value = true;
      
      return errorResult;
    } finally {
      isLoading.value = false;
    }
  }
  
  function clearCommandHistory() {
    commandHistory.value = [];
  }
  
  function toggleCommandOutput() {
    showCommandOutput.value = !showCommandOutput.value;
  }
  
  function closeCommandOutput() {
    showCommandOutput.value = false;
  }
  
  function openCommandOutput() {
    showCommandOutput.value = true;
  }
  
  return {
    isLoading,
    lastCommand,
    commandHistory,
    showCommandOutput,
    runArtisanCommand,
    clearCommandHistory,
    toggleCommandOutput,
    closeCommandOutput,
    openCommandOutput
  };
}); 