<template>
  <div v-if="updateAvailable" class="fixed bottom-4 right-4 z-50">
    <div class="bg-base-200 rounded-lg shadow-lg p-4 max-w-md border border-primary">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-semibold text-base-content">Update Available: v{{ updateInfo.version }}</h3>
        <button @click="dismissUpdate" class="btn btn-sm btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div class="mb-3 text-base-content">
        <p v-if="updateStatus === 'update-available'">A new version of Larabase is available. Would you like to download it now?</p>
        <p v-else-if="updateStatus === 'download-progress'">
          Downloading update: {{ Math.round(updateInfo.percent) }}%
          <progress class="progress progress-primary w-full" :value="updateInfo.percent" max="100"></progress>
        </p>
        <p v-else-if="updateStatus === 'update-downloaded'">Update downloaded and ready to install. Restart to apply the update.</p>
        <p v-else-if="updateStatus === 'update-error'">Error updating: {{ updateInfo.message || 'Unknown error' }}</p>
      </div>
      
      <div class="flex justify-end space-x-2">
        <button 
          v-if="updateStatus === 'update-available'" 
          @click="downloadUpdate" 
          class="btn btn-sm btn-primary">
          Download Update
        </button>
        <button 
          v-if="updateStatus === 'update-downloaded'" 
          @click="installUpdate" 
          class="btn btn-sm btn-primary">
          Restart & Install
        </button>
        <button 
          v-if="updateStatus === 'update-error'" 
          @click="checkForUpdates" 
          class="btn btn-sm btn-outline">
          Try Again
        </button>
      </div>
    </div>
  </div>
  
  <div class="fixed bottom-4 left-4 z-40 text-xs text-opacity-70" v-if="currentVersion">
    v{{ currentVersion }}
    <button 
      @click="checkForUpdates" 
      class="btn btn-xs btn-ghost btn-circle ml-1" 
      title="Check for updates">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const updateAvailable = ref(false);
const updateStatus = ref('');
const updateInfo = ref({});
const currentVersion = ref('');
let removeUpdateListener = null;

onMounted(async () => {
  try {
    // Wait a moment to ensure electron API is fully available
    setTimeout(async () => {
      try {
        // Try to get current version
        if (window.api && window.api.getCurrentVersion) {
          currentVersion.value = await window.api.getCurrentVersion();
        }
        
        // Set up the update status listener if API is available
        if (window.api && window.api.onUpdateStatus) {
          removeUpdateListener = window.api.onUpdateStatus((data) => {
            updateStatus.value = data.status;
            
            if (data.data) {
              updateInfo.value = data.data;
            }
            
            if (data.status === 'update-available') {
              updateAvailable.value = true;
            } else if (data.status === 'update-not-available') {
              updateAvailable.value = false;
            } else if (data.status === 'update-downloaded') {
              updateAvailable.value = true;
            } else if (data.status === 'update-error') {
              updateAvailable.value = true;
            }
          });
          
          // Check for updates initially if the API is available
          await checkForUpdates();
        }
      } catch (innerError) {
        console.error('Error initializing update checker:', innerError);
      }
    }, 2000); // Give the API some time to initialize
  } catch (error) {
    console.error('Error setting up update checker:', error);
  }
});

onUnmounted(() => {
  if (removeUpdateListener) {
    removeUpdateListener();
  }
});

async function checkForUpdates() {
  try {
    if (window.api && window.api.checkForUpdates) {
      await window.api.checkForUpdates();
    } else {
      console.log('Update API not available yet');
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

async function downloadUpdate() {
  try {
    await window.api.downloadUpdate();
  } catch (error) {
    console.error('Error downloading update:', error);
  }
}

function installUpdate() {
  try {
    window.api.quitAndInstall();
  } catch (error) {
    console.error('Error installing update:', error);
  }
}

function dismissUpdate() {
  updateAvailable.value = false;
}
</script> 