<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadFactory">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span>Refresh</span>
        </button>

        <button
          v-if="factoryFound"
          class="btn btn-sm btn-primary"
          @click="showGenerateDataModal = true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 mr-1"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          Factory Data
        </button>
      </div>

      <div v-if="!isLoading" class="flex items-center space-x-2">
        <span class="text-xs text-gray-400">{{
          factoryFound ? 'Factory found' : 'No factory found'
        }}</span>

        <button
          v-if="!connection?.projectPath"
          class="btn btn-sm btn-ghost"
          title="Select Laravel project"
          @click="selectProjectPath"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v .776"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div
        v-else-if="!connection?.projectPath"
        class="flex items-center justify-center h-full text-gray-500"
      >
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-12 h-12 mx-auto mb-4 text-gray-400"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          <p>No Laravel project path is associated with this connection</p>
          <button class="btn btn-sm btn-primary mt-4" @click="selectProjectPath">
            Select Project
          </button>
        </div>
      </div>

      <div v-else-if="!factoryFound" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-12 h-12 mx-auto mb-4 text-gray-400"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
            />
          </svg>
          <p>No Laravel factory found for {{ tableName }} table</p>
          <p class="text-xs mt-2 text-gray-500">
            Factories are typically named using singular form and located in database/factories
            directory
          </p>
          <button
            v-if="connection?.projectPath"
            class="btn btn-sm btn-ghost mt-4"
            @click="loadFactory"
          >
            Reload
          </button>
        </div>
      </div>

      <div v-else class="p-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-6 h-6 text-primary"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                />
              </svg>
              {{ factory.name }}
            </h3>

            <div class="mt-2">
              <div class="flex flex-col space-y-3">
                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">File Path</div>
                  <div class="flex-1 flex items-center gap-2">
                    <span class="truncate">{{ factory.relativePath }}</span>
                    <button
                      class="btn btn-xs btn-ghost"
                      title="Open in editor"
                      @click="openFileInEditor(factory.path)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="flex items-start">
                  <div class="w-28 font-medium text-gray-400">Table Name</div>
                  <div class="flex-1">
                    {{ tableName }}
                  </div>
                </div>
              </div>
            </div>

            <div class="divider" />

            <div v-if="factoryContent" class="mb-4">
              <h4 class="text-sm font-medium text-gray-400 mb-2">Factory Code</h4>
              <div class="mockup-code bg-neutral h-64 overflow-auto text-xs">
                <pre><code>{{ factoryContent }}</code></pre>
              </div>
            </div>

            <div class="flex justify-end">
              <button class="btn btn-sm btn-ghost" @click="openFileInEditor(factory.path)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4 mr-1"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Open File
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="factoryFound"
      class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400"
    >
      <div>{{ tableName }} | Factory</div>
      <div>Factory Path: {{ factory.relativePath }}</div>
    </div>

    <!-- Factory Data Generation Modal -->
    <div v-if="showGenerateDataModal" class="modal modal-open">
      <div class="modal-box bg-base-100 max-w-md">
        <h3 class="font-bold text-lg mb-3 text-center">Generate Factory Data</h3>

        <p class="text-center mb-4">Create test records for {{ tableName }}</p>

        <div class="bg-primary bg-opacity-10 p-4 rounded-lg mb-5">
          <p class="font-medium mb-2">Number of records:</p>

          <div class="form-control">
            <input
              v-model="recordCount"
              type="number"
              min="1"
              max="1000"
              class="input input-bordered w-full"
              :class="{ 'input-error': recordCount < 1 || recordCount > 1000 }"
            />
            <label v-if="recordCount < 1 || recordCount > 1000" class="label">
              <span class="label-text-alt text-error"
                >Please enter a number between 1 and 1000</span
              >
            </label>
          </div>
        </div>

        <div class="bg-neutral-content bg-opacity-10 p-4 rounded-lg mb-6">
          <p class="text-sm font-medium mb-2">Command preview:</p>
          <div class="mockup-code text-xs">
            <pre><code>{{ generateCommandPreview() }}</code></pre>
          </div>
        </div>

        <div class="flex gap-2 justify-end">
          <button class="btn" @click="showGenerateDataModal = false">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="isGenerating || recordCount < 1 || recordCount > 1000"
            @click="generateFactoryData"
          >
            <span v-if="isGenerating" class="loading loading-spinner loading-xs mr-1" />
            Generate
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showGenerateDataModal = false" />
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


async function loadFactory () {
  isLoading.value = true;

  try {
    if (!connection.value?.projectPath) {
      factory.value = null;
      return;
    }


    await databaseStore.loadModelsForTables(props.connectionId, connection.value.projectPath);
    const model = databaseStore.getModelForTable(props.connectionId, props.tableName);


    const foundFactory = await findFactoryFile(connection.value.projectPath, props.tableName, model);

    if (foundFactory) {
      factory.value = foundFactory;
      await loadFactoryContent(foundFactory.path);
    } else {
      factory.value = null;
    }


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


async function findFactoryFile (projectPath, tableName, model) {
  try {

    const pluralize = await window.api.getPluralizeFunction();


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


    const allFactoryFiles = [];

    for (const dirPath of factoryDirs) {
      const fullDirPath = `${projectPath}/${dirPath}`;

      try {
        const result = await window.api.listFiles(fullDirPath);


        if (!result.success || !result.files || !Array.isArray(result.files)) {
          console.log(`No files found or invalid response for ${fullDirPath}`);
          continue;
        }


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

      }
    }


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

        filename.includes(tableName.toLowerCase()) &&
        filename.includes('factory')
      );
    });

    if (partialMatches.length > 0) {

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
async function loadFileContent (filePath) {
  try {
    const result = await window.api.readModelFile(filePath);
    return result.success ? result.content : '';
  } catch (error) {
    console.error('Error reading file:', error);
    return '';
  }
}

// Load factory file content
async function loadFactoryContent (filePath) {
  try {
    // Use the IPC method to read the file
    const result = await window.api.readModelFile(filePath);

    if (result.success) {
      factoryContent.value = result.content;
    } else {
      console.error('Error loading factory content:', result.message);
      factoryContent.value = 'Error loading factory content: ' + result.message;
    }
  } catch (error) {
    console.error('Error reading factory file:', error);
    factoryContent.value = 'Unable to load factory content';
  }
}

async function selectProjectPath () {
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

async function openFileInEditor (filePath) {
  try {
    await window.api.openFile(filePath);
  } catch (error) {
    console.error('Error opening file:', error);
    showAlert('Failed to open file', 'error');
  }
}


function generateCommandPreview () {
  const model = databaseStore.getModelForTable(props.connectionId, props.tableName);
  if (!model || !factory.value) return 'No model or factory found';

  const modelName = model.fullName;
  const count = recordCount.value || 10;
  const usingSail = !!connection.value?.usingSail;


  const escapedModelName = modelName.replace(/\\/g, '\\\\');


  return `${usingSail ? 'sail' : 'php'} artisan tinker --execute="${escapedModelName}::factory(${count})->create();"`;
}


async function showDatabaseMismatchDialog (projectDb, connectionDb) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal modal-open z-50';
    modal.innerHTML = `
      <div class="modal-box bg-base-100 w-11/12 max-w-md">
        <h3 class="font-bold text-lg mb-3 text-center">Database Mismatch</h3>

        <p class="text-center mb-4">The factory needs to use the same database as your connection to view the created data</p>

        <div class="flex flex-col gap-3 mb-6">
          <div class="flex items-center justify-between bg-neutral-content bg-opacity-10 p-3 rounded-lg">
            <span class="text-sm font-medium">Project .env</span>
            <span class="font-mono text-sm bg-base-200 px-2 py-1 rounded">${projectDb}</span>
          </div>

          <div class="flex items-center justify-between bg-primary bg-opacity-10 p-3 rounded-lg">
            <span class="text-sm font-medium">Your connection</span>
            <span class="font-mono text-sm bg-base-200 px-2 py-1 rounded">${connectionDb}</span>
          </div>
        </div>

        <div class="space-y-2">
          <button id="useConnection" class="btn btn-primary w-full">
            <div class="flex flex-col items-start text-left">
              <span class="font-semibold">Modify project's .env file with "${connectionDb}"</span>
            </div>
          </button>

          <button id="switchDatabase" class="btn btn-outline w-full">
            <div class="flex flex-col items-start text-left">
              <span class="font-semibold">Switch database</span>
            </div>
          </button>
        </div>

        <div class="modal-action mt-4">
          <button id="cancel" class="btn btn-sm btn-ghost">Cancel</button>
        </div>
      </div>
      <div class="modal-backdrop"></div>
    `;

    document.body.appendChild(modal);

    const useConnectionBtn = modal.querySelector('#useConnection');
    const switchDatabaseBtn = modal.querySelector('#switchDatabase');
    const cancelBtn = modal.querySelector('#cancel');
    const backdrop = modal.querySelector('.modal-backdrop');

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


async function generateFactoryData () {
  isGenerating.value = true;
  showGenerateDataModal.value = false;

  try {

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


    const envConfig = await window.api.readEnvFile(projectPath);

    if (envConfig && envConfig.DB_DATABASE !== connection.value.database) {

      const confirmResult = await showDatabaseMismatchDialog(envConfig.DB_DATABASE, connection.value.database);

      if (confirmResult === 'cancel') {
        isGenerating.value = false;
        return;
      }

      if (confirmResult === 'useConnection') {

        showAlert(`Modifying .env to use database: ${connection.value.database}`, 'info');

        const updateResult = await updateEnvDatabase(projectPath, connection.value.database);
        if (!updateResult) {
          showAlert('Failed to modify .env file, operation aborted', 'error');
          isGenerating.value = false;
          return;
        }

        showAlert(`Successfully updated .env file to use database: ${connection.value.database}`, 'success');
      } else if (confirmResult === 'switchDatabase') {

        isGenerating.value = false;
        openDatabaseSwitcher();
        return;
      }
    }


    const usingSail = !!connection.value.usingSail;


    const tinkerCommand = `tinker --execute="${modelName}::factory(${count})->create();"`;


    commandsStore.openCommandOutput();


    const commandResult = await commandsStore.runArtisanCommand({
      projectPath: projectPath,
      command: tinkerCommand,
      useSail: usingSail,
      displayCommand: `Factory Data: ${usingSail ? 'sail' : 'php'} artisan tinker --execute="${modelName}::factory(${count})->create();"`
    });

    if (commandResult && commandResult.success) {
      showAlert(`Generating ${count} records for ${props.tableName} table`, 'success');


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


async function updateEnvDatabase (projectPath, database) {
  try {
    console.log('Updating .env database at path:', projectPath, 'to database:', database);


    const result = await window.api.updateEnvDatabase(projectPath, database);

    if (!result.success) {
      throw new Error(result.message || 'Failed to update .env file');
    }

    console.log('Update .env result:', result);



    showAlert(`Successfully updated project's .env file to use database: ${database}`, 'success');
    return true;
  } catch (error) {
    console.error('Error updating .env database:', error);
    showAlert('Failed to update project database configuration: ' + error.message, 'error');
    return false;
  }
}


async function openDatabaseSwitcher () {
  try {

    emit('open-database-switcher', props.connectionId);
    showAlert('Opening database switcher...', 'info');
  } catch (error) {
    console.error('Error opening database switcher:', error);
    showAlert('Failed to open database switcher: ' + error.message, 'error');
  }
}


async function refreshData () {
  try {
    await loadFactory();
  } catch (error) {
    console.error('Error refreshing data:', error);
    showAlert('Failed to refresh factory data', 'error');
  }
}


onMounted(() => {
  loadFactory();
});
</script>
