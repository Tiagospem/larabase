import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCommandsStore = defineStore('commands', () => {
  const isLoading = ref(false);
  const lastCommand = ref(null);
  const commandHistory = ref([]);
  const showCommandOutput = ref(false);
  const activeListenerChannel = ref(null);
  
  async function runArtisanCommand (config) {
    isLoading.value = true;
    
    try {
      const result = await window.api.runArtisanCommand(config);
      
      // Create a command result object
      const commandResult = {
        id: result.commandId || Date.now().toString(),
        command: config.displayCommand || result.command || config.command,
        output: result.output || '',
        success: result.success,
        isComplete: false,
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
      
      // Set up command output listener if we have a command ID
      if (result.commandId) {
        // Clean up any existing listener
        if (activeListenerChannel.value) {
          window.api.stopCommandListener(activeListenerChannel.value);
        }
        
        // Set up the new listener
        const channel = window.api.listenCommandOutput(result.commandId, (data) => {
          // Append to output
          if (lastCommand.value && lastCommand.value.id === data.commandId) {
            // If the command is not complete, append to the output
            if (!lastCommand.value.isComplete) {
              lastCommand.value.output += data.output;
            }
            
            // Update the completion status
            if (data.isComplete) {
              lastCommand.value.isComplete = true;
              lastCommand.value.success = data.success;
              isLoading.value = false;
            }
          }
        });
        
        activeListenerChannel.value = channel;
      }
      
      return commandResult;
    } catch (error) {
      console.error('Error running artisan command:', error);
      
      // Create an error result
      const errorResult = {
        id: Date.now().toString(),
        command: config.command,
        output: '',
        success: false,
        isComplete: true,
        message: error.message || 'Failed to run command',
        timestamp: new Date().toISOString(),
        projectPath: config.projectPath
      };
      
      lastCommand.value = errorResult;
      commandHistory.value.unshift(errorResult);
      showCommandOutput.value = true;
      isLoading.value = false;
      
      return errorResult;
    }
  }
  
  function clearCommandHistory () {
    commandHistory.value = [];
  }
  
  function toggleCommandOutput () {
    showCommandOutput.value = !showCommandOutput.value;
  }
  
  function closeCommandOutput () {
    showCommandOutput.value = false;
    // Also clean up any active listeners
    if (activeListenerChannel.value) {
      window.api.stopCommandListener(activeListenerChannel.value);
      activeListenerChannel.value = null;
    }
  }
  
  function openCommandOutput () {
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