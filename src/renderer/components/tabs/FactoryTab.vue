<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadFactory">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      
      <div v-if="!isLoading" class="flex items-center space-x-2">
        <span class="text-xs text-gray-400">{{ factoryFound ? 'Factory found' : 'No factory found' }}</span>
        
        <button v-if="!connection?.projectPath" 
                @click="selectProjectPath" 
                class="btn btn-sm btn-ghost" 
                title="Select Laravel project">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v .776" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else-if="!connection?.projectPath" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          <p>No Laravel project path is associated with this connection</p>
          <button class="btn btn-sm btn-primary mt-4" @click="selectProjectPath">Select Project</button>
        </div>
      </div>
      
      <div v-else-if="!factoryFound" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
          </svg>
          <p>No Laravel factory found for {{ tableName }} table</p>
          <p class="text-xs mt-2 text-gray-500">Factories are typically named using singular form and located in database/factories directory</p>
          <button v-if="connection?.projectPath" class="btn btn-sm btn-ghost mt-4" @click="loadFactory">Reload</button>
        </div>
      </div>
      
      <div v-else class="p-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                stroke="currentColor" class="w-6 h-6 text-primary">
                <path stroke-linecap="round" stroke-linejoin="round" 
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
              {{ factory.name }}
            </h3>
            
            <div class="mt-2">
              <div class="flex flex-col space-y-3">                
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">File Path</div>
                  <div class="flex-1 flex items-center gap-2">
                    <span class="truncate">{{ factory.relativePath }}</span>
                    <button class="btn btn-xs btn-ghost" @click="openFileInEditor(factory.path)" title="Open in editor">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">Table Name</div>
                  <div class="flex-1">{{ tableName }}</div>
                </div>
              </div>
            </div>
            
            <div class="divider"></div>
            
            <div v-if="factoryContent" class="mb-4">
              <h4 class="text-sm font-medium text-gray-400 mb-2">Factory Code</h4>
              <div class="mockup-code bg-neutral h-64 overflow-auto text-xs">
                <pre><code>{{ factoryContent }}</code></pre>
              </div>
            </div>
            
            <div class="flex justify-between">
              <button class="btn btn-sm btn-ghost" @click="openFileInEditor(factory.path)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                  stroke="currentColor" class="w-4 h-4 mr-1">
                  <path stroke-linecap="round" stroke-linejoin="round" 
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Open File
              </button>
              
              <button class="btn btn-sm btn-primary" @click="showGenerateDataModal = true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                Factory Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="factoryFound" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | Factory</div>
      <div>Factory Path: {{ factory.relativePath }}</div>
    </div>
    
    <!-- Factory Data Generation Modal -->
    <div v-if="showGenerateDataModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Generate Factory Data</h3>
        <p class="py-4">How many records would you like to generate?</p>
        
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text">Number of records (1-1000)</span>
          </label>
          <input 
            type="number" 
            v-model="recordCount" 
            min="1" 
            max="1000" 
            class="input input-bordered w-full" 
            :class="{'input-error': recordCount < 1 || recordCount > 1000}"
          />
          <label class="label" v-if="recordCount < 1 || recordCount > 1000">
            <span class="label-text-alt text-error">Please enter a number between 1 and 1000</span>
          </label>
        </div>
        
        <div class="mt-4">
          <p class="text-sm">This will run the following command:</p>
          <div class="mockup-code text-xs mt-2">
            <pre><code>{{ generateCommandPreview() }}</code></pre>
          </div>
        </div>
        
        <div class="modal-action">
          <button class="btn" @click="showGenerateDataModal = false">Cancel</button>
          <button 
            class="btn btn-primary" 
            @click="generateFactoryData" 
            :disabled="isGenerating || recordCount < 1 || recordCount > 1000"
          >
            <span class="loading loading-spinner loading-xs" v-if="isGenerating"></span>
            Generate
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showGenerateDataModal = false"></div>
    </div>
  </div>
</template>

<script setup>
import {inject, onMounted, ref, computed} from 'vue';
import {useDatabaseStore} from '@/store/database';
import {useConnectionsStore} from '@/store/connections';
import {useCommandsStore} from '@/store/commands';

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  onLoad: {
    type: Function,
    required: true
  }
});

// State
const isLoading = ref(true);
const factory = ref(null);
const factoryContent = ref('');

// Factory data generation state
const showGenerateDataModal = ref(false);
const isGenerating = ref(false);
const recordCount = ref(10);

const databaseStore = useDatabaseStore();
const connectionsStore = useConnectionsStore();
const commandsStore = useCommandsStore();

const emit = defineEmits(['open-database-switcher']);

const connection = computed(() => {
  return connectionsStore.getConnection(props.connectionId);
});

const factoryFound = computed(() => {
  return factory.value !== null;
});

// Methods
async function loadFactory() {
  isLoading.value = true;
  
  try {
    if (!connection.value?.projectPath) {
      factory.value = null;
      return;
    }
    
    // Get related model info to help find the factory
    await databaseStore.loadModelsForTables(props.connectionId, connection.value.projectPath);
    const model = databaseStore.getModelForTable(props.connectionId, props.tableName);
    
    // Find factory file
    const foundFactory = await findFactoryFile(connection.value.projectPath, props.tableName, model);
    
    if (foundFactory) {
      factory.value = foundFactory;
      await loadFactoryContent(foundFactory.path);
    } else {
      factory.value = null;
    }
    
    // Notify parent component
    props.onLoad({
      factoryFound: factory.value !== null
    });
    
  } catch (error) {
    console.error('Failed to load factory:', error);
    showAlert(`Error loading factory: ${error.message}`, 'error');
    factory.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Find factory file based on table name or model name
async function findFactoryFile(projectPath, tableName, model) {
  try {
    // Get the pluralize function from the main process
    const pluralize = await window.api.getPluralizeFunction();
    
    // Convert table name to likely factory name patterns
    let modelName = '';
    
    if (model) {
      // If we found a model, use its name
      modelName = model.name;
    } else {
      // If no model found, create a singular PascalCase name from the table
      // First get the singular form of the table name
      const singularTableName = await window.api.getSingularForm(tableName);
      
      // Convert to PascalCase
      modelName = singularTableName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    }
    
    // Common patterns for factory filenames
    const factoryPatterns = [
      // With model name
      `${modelName}Factory.php`,
      // Alternative name patterns
      `${modelName.toLowerCase()}Factory.php`,
      `${modelName}factory.php`,
      `${modelName}_factory.php`,
      `${modelName.toLowerCase()}_factory.php`,
      // Try with table name directly
      `${tableName}_factory.php`,
      `${tableName}Factory.php`
    ];
    
    // Common directories for factories in Laravel projects
    const factoryDirs = [
      'database/factories',
      'database/Factory',
      'app/database/factories'
    ];
    
    // First pass: scan all factory directories and collect all PHP files
    const allFactoryFiles = [];
    
    for (const dirPath of factoryDirs) {
      const fullDirPath = `${projectPath}/${dirPath}`;
      
      try {
        const result = await window.api.listFiles(fullDirPath);
        
        // Check if the result was successful and has files
        if (!result.success || !result.files || !Array.isArray(result.files)) {
          console.log(`No files found or invalid response for ${fullDirPath}`);
          continue;
        }
        
        // Add all PHP files to our collection
        const entries = result.files;
        for (const entry of entries) {
          if (entry.name.endsWith('.php')) {
            allFactoryFiles.push({
              name: entry.name,
              path: `${fullDirPath}/${entry.name}`,
              relativePath: `${dirPath}/${entry.name}`
            });
          }
        }
      } catch (dirError) {
        console.error(`Error accessing directory ${fullDirPath}:`, dirError);
        // Continue to the next directory
      }
    }
    
    // Method 1: Try exact name matches first (case insensitive)
    for (const factoryPattern of factoryPatterns) {
      const exactMatch = allFactoryFiles.find(
        file => file.name.toLowerCase() === factoryPattern.toLowerCase()
      );
      
      if (exactMatch) {
        return {
          name: exactMatch.name.replace(/\.php$/, ''),
          path: exactMatch.path,
          relativePath: exactMatch.relativePath
        };
      }
    }
    
    // Method 2: Look for partial name matches
    const partialMatches = allFactoryFiles.filter(file => {
      const filename = file.name.toLowerCase();
      // Check if filename contains both the model name and 'factory'
      return (
        filename.includes(modelName.toLowerCase()) && 
        filename.includes('factory')
      ) || (
        // Or contains the table name and 'factory'
        filename.includes(tableName.toLowerCase()) && 
        filename.includes('factory')
      );
    });
    
    if (partialMatches.length > 0) {
      // Found at least one partial match
      return {
        name: partialMatches[0].name.replace(/\.php$/, ''),
        path: partialMatches[0].path,
        relativePath: partialMatches[0].relativePath
      };
    }
    
    // Method 3: Search file contents for references to the model or table
    for (const file of allFactoryFiles) {
      const content = await loadFileContent(file.path);
      
      // Try with both singular and plural forms of the table name
      const singularTable = await window.api.getSingularForm(tableName);
      
      // Look for patterns indicating this is a factory for our model or table
      if (
        content.includes(`class ${modelName}Factory`) ||
        content.includes(`return ${modelName}::class`) ||
        content.includes(`model(${modelName}::class`) ||
        content.includes(`model('${modelName}'`) ||
        content.includes(`model('App\\\\Models\\\\${modelName}'`) ||
        (model && content.includes(`model('${model.fullName}'`)) ||
        content.includes(`table('${tableName}'`) ||
        content.includes(`'${tableName}'`) ||
        content.includes(`"${tableName}"`) ||
        content.includes(`'${singularTable}'`) ||
        content.includes(`"${singularTable}"`)
      ) {
        return {
          name: file.name.replace(/\.php$/, ''),
          path: file.path,
          relativePath: file.relativePath
        };
      }
    }
    
    // No factory found after all attempts
    return null;
  } catch (error) {
    console.error('Error finding factory file:', error);
    return null;
  }
}

// Helper to load file content
async function loadFileContent(filePath) {
  try {
    const result = await window.api.readModelFile(filePath);
    return result.success ? result.content : '';
  } catch (error) {
    console.error('Error reading file:', error);
    return '';
  }
}

// Load factory file content
async function loadFactoryContent(filePath) {
  try {
    // Use the IPC method to read the file
    const result = await window.api.readModelFile(filePath);
    
    if (result.success) {
      factoryContent.value = result.content;
    } else {
      console.error('Error loading factory content:', result.message);
      factoryContent.value = '// Unable to load factory content: ' + result.message;
    }
  } catch (error) {
    console.error('Error reading factory file:', error);
    factoryContent.value = '// Unable to load factory content';
  }
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();
    
    if (result.canceled) {
      return;
    }
    
    const projectPath = result.filePaths[0];

    const isLaravel = await window.api.validateLaravelProject(projectPath);
    
    if (!isLaravel) {
      showAlert('Selected directory is not a valid Laravel project', 'error');
      return;
    }

    if (connection.value) {
      const updatedConnections = connectionsStore.connections.map(conn => {
        if (conn.id === connection.value.id) {
          return { ...conn, projectPath };
        }
        return conn;
      });
      
      await connectionsStore.saveConnections(updatedConnections);
      showAlert('Laravel project path set successfully', 'success');
      await loadFactory();
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
    showAlert('Failed to select project directory', 'error');
  }
}

async function openFileInEditor(filePath) {
  try {
    await window.api.openFile(filePath);
  } catch (error) {
    console.error('Error opening file:', error);
    showAlert('Failed to open file', 'error');
  }
}

// Generate command preview for display in the modal
function generateCommandPreview() {
  const model = databaseStore.getModelForTable(props.connectionId, props.tableName);
  if (!model || !factory.value) return 'No model or factory found';
  
  const modelName = model.fullName;
  const count = recordCount.value || 10;
  const usingSail = !!connection.value?.usingSail;
  
  // Escape backslashes for command line
  const escapedModelName = modelName.replace(/\\/g, '\\\\');
  
  // Show the full command that will be executed
  return `${usingSail ? 'sail' : 'php'} artisan tinker --execute="${escapedModelName}::factory(${count})->create();"`;
}

// Generate factory data using Artisan Tinker
async function generateFactoryData() {
  isGenerating.value = true;
  showGenerateDataModal.value = false;
  
  try {
    // Validate requirements
    if (!connection.value?.projectPath) {
      throw new Error('No project path is set');
    }
    
    const model = databaseStore.getModelForTable(props.connectionId, props.tableName);
    if (!model) {
      throw new Error('No model found for this table');
    }
    
    const modelName = model.fullName;
    const count = recordCount.value;
    const projectPath = connection.value.projectPath;
    
    // First, check if the database in .env matches our connection
    const envConfig = await window.api.readEnvFile(projectPath);
    
    if (envConfig && envConfig.DB_DATABASE !== connection.value.database) {
      // Show confirmation dialog
      const confirmResult = await showDatabaseMismatchDialog(envConfig.DB_DATABASE, connection.value.database);
      
      if (confirmResult === 'cancel') {
        isGenerating.value = false;
        return;
      }
      
      if (confirmResult === 'useProject') {
        // We'll continue with the project's database
        showAlert(`Using project's database: ${envConfig.DB_DATABASE}`, 'info');
      } else if (confirmResult === 'useConnection') {
        // We'll temporarily modify the .env to use our database
        await updateEnvDatabase(projectPath, connection.value.database);
        showAlert(`Temporarily modifying .env to use: ${connection.value.database}`, 'info');
      } else if (confirmResult === 'switchDatabase') {
        // Show database switcher
        isGenerating.value = false;
        openDatabaseSwitcher();
        return;
      }
    }
    
    // Determine if using Sail (from connection settings)
    const usingSail = !!connection.value.usingSail;
    
    // Construct the tinker command for generating factory data
    const tinkerCommand = `tinker --execute="${modelName}::factory(${count})->create();"`;
    
    // Open the command output panel
    commandsStore.openCommandOutput();
    
    // Execute the command using the commands store
    const commandResult = await commandsStore.runArtisanCommand({
      projectPath: projectPath,
      command: tinkerCommand,
      useSail: usingSail,
      displayCommand: `Factory Data: ${usingSail ? 'sail' : 'php'} artisan tinker --execute="${modelName}::factory(${count})->create();"`
    });
    
    if (commandResult && commandResult.success) {
      showAlert(`Started generating ${count} records for ${props.tableName}`, 'info');
      
      // Reset state
      recordCount.value = 10;
    } else {
      throw new Error((commandResult && commandResult.message) || 'Failed to start command');
    }
  } catch (error) {
    console.error('Error generating factory data:', error);
    showAlert(`Failed to generate factory data: ${error.message}`, 'error');
  } finally {
    isGenerating.value = false;
  }
}

// Update .env database temporarily
async function updateEnvDatabase(projectPath, database) {
  try {
    // Call the IPC function to modify the .env file
    const result = await window.api.updateEnvDatabase(projectPath, database);
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to update .env file');
    }
    
    showAlert(`Successfully updated project's .env file to use database: ${database}`, 'success');
    console.log('Update .env result:', result);
    return true;
  } catch (error) {
    console.error('Error updating .env database:', error);
    showAlert('Failed to update project database configuration: ' + error.message, 'error');
    return false;
  }
}

// Show dialog for database mismatch
async function showDatabaseMismatchDialog(projectDb, connectionDb) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal modal-open z-50';
    modal.innerHTML = `
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-2">Database Configuration Mismatch</h3>
        
        <div class="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span>The database in your project's .env file doesn't match the one in your connection.</span>
        </div>
        
        <div class="bg-base-200 p-4 mb-4 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-1/3 font-semibold">Project Environment:</div>
            <div class="font-mono">${projectDb}</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-1/3 font-semibold">Current Connection:</div>
            <div class="font-mono">${connectionDb}</div>
          </div>
        </div>
        
        <p class="mb-4">Choose how to proceed with factory data generation:</p>
        
        <div class="space-y-2">
          <div class="flex flex-col gap-2">
            <button id="useProject" class="btn btn-outline w-full justify-start">
              <div class="flex flex-col items-start text-left">
                <span class="font-semibold">Use project's database (${projectDb})</span>
                <span class="text-xs opacity-70">Factory data will be generated in the project's configured database</span>
              </div>
            </button>
            
            <button id="useConnection" class="btn btn-outline w-full justify-start">
              <div class="flex flex-col items-start text-left">
                <span class="font-semibold">Temporarily modify project's .env file</span>
                <span class="text-xs opacity-70">Will update the project's .env to use "${connectionDb}" (backup will be created)</span>
              </div>
            </button>
            
            <button id="switchDatabase" class="btn btn-outline w-full justify-start">
              <div class="flex flex-col items-start text-left">
                <span class="font-semibold">Switch database connections</span>
                <span class="text-xs opacity-70">Will run the factory using Laravel's dynamic database connection</span>
              </div>
            </button>
          </div>
        </div>
        
        <div class="modal-action">
          <button id="cancel" class="btn">Cancel</button>
        </div>
      </div>
      <div class="modal-backdrop"></div>
    `;
    
    document.body.appendChild(modal);
    
    const useProjectBtn = modal.querySelector('#useProject');
    const useConnectionBtn = modal.querySelector('#useConnection');
    const switchDatabaseBtn = modal.querySelector('#switchDatabase');
    const cancelBtn = modal.querySelector('#cancel');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    useProjectBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('useProject');
    });
    
    useConnectionBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('useConnection');
    });
    
    switchDatabaseBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('switchDatabase');
    });
    
    [cancelBtn, backdrop].forEach(el => {
      el.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve('cancel');
      });
    });
  });
}

// Function to open database switcher in the parent component
async function openDatabaseSwitcher() {
  try {
    // Emit the event to parent component with the current connection ID
    emit('open-database-switcher', props.connectionId);
    showAlert('Opening database switcher...', 'info');
  } catch (error) {
    console.error('Error opening database switcher:', error);
    showAlert('Failed to open database switcher: ' + error.message, 'error');
  }
}

// Function to refresh data
async function refreshData() {
  try {
    await loadFactory();
  } catch (error) {
    console.error('Error refreshing data:', error);
    showAlert('Failed to refresh factory data', 'error');
  }
}

// Lifecycle
onMounted(() => {
  loadFactory();
});
</script> 