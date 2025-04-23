<template>
  <div
    v-if="updateAvailable"
    class="fixed bottom-4 right-4 z-50"
  >
    <div class="bg-base-200 rounded-lg shadow-lg p-4 w-96 border border-primary">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-semibold text-base-content">
          Update Available
          <span
            class="font-mono"
            v-if="updateInfo.version"
            >v{{ updateInfo.version }}</span
          >
        </h3>
        <button
          @click="dismissUpdate"
          class="btn btn-sm btn-ghost"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div class="mb-3 text-base-content">
        <p v-if="updateStatus === 'update-available'">A new version of Larabase is available. Would you like to download it now?</p>
        <p v-else-if="updateStatus === 'download-progress'">
          Downloading update: {{ Math.round(updateInfo.percent) }}%
          <progress
            class="progress progress-primary w-full"
            :value="updateInfo.percent"
            max="100"
          ></progress>
        </p>
        <p v-else-if="updateStatus === 'update-downloaded'">Update downloaded and ready to install. Restart to apply the update.</p>
        <p
          v-else-if="updateStatus === 'update-error'"
          class="text-error"
        >
          <span class="font-bold">Error updating:</span>
          <span class="break-words">{{ isCodeSigningError ? "Code signature validation failed." : updateInfo.message || "Unknown error" }}</span>
        </p>
      </div>

      <div class="flex justify-end space-x-2">
        <button
          v-if="updateStatus === 'update-available'"
          @click="downloadUpdate"
          class="btn btn-sm btn-primary"
        >
          Download Update
        </button>
        <button
          v-if="updateStatus === 'update-downloaded'"
          @click="installUpdate"
          class="btn btn-sm btn-primary"
        >
          Restart & Install
        </button>
        <button
          v-if="updateStatus === 'update-error' && !isCodeSigningError"
          @click="checkForUpdates"
          class="btn btn-sm btn-outline"
        >
          Try Again
        </button>
        <button
          v-if="updateStatus === 'update-error'"
          @click="openReleases"
          class="btn btn-sm btn-primary"
        >
          Download Manually
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";

const updateAvailable = ref(false);
const updateStatus = ref("");
const updateInfo = ref({});
const currentVersion = ref("");
let removeUpdateListener = null;
const RELEASES_URL = "https://github.com/Tiagospem/larabase/releases/latest";

const isCodeSigningError = computed(() => {
  if (updateStatus.value === "update-error" && updateInfo.value && updateInfo.value.message) {
    return updateInfo.value.message.includes("code signature") && updateInfo.value.message.includes("did not pass validation");
  }
  return false;
});

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
              if (data.status === "update-error" && data.data.message && data.data.message.includes("code signature") && data.data.message.includes("did not pass validation")) {
                data.data.message = "Code signature validation failed. The update cannot be installed automatically. " + "Please download the latest version manually from GitHub.";
              }

              updateInfo.value = data.data;
            }

            if (data.status === "update-available") {
              updateAvailable.value = true;
            } else if (data.status === "update-not-available") {
              updateAvailable.value = false;
            } else if (data.status === "update-downloaded") {
              updateAvailable.value = true;
            } else if (data.status === "update-error") {
              updateAvailable.value = true;
            }
          });

          // Check for updates initially if the API is available
          await checkForUpdates();
        }
      } catch (innerError) {
        console.error("Error initializing update checker:", innerError);
      }
    }, 2000); // Give the API some time to initialize
  } catch (error) {
    console.error("Error setting up update checker:", error);
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
      console.log("Update API not available yet");
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
}

async function downloadUpdate() {
  try {
    await window.api.downloadUpdate();
  } catch (error) {
    console.error("Error downloading update:", error);

    updateInfo.value = { message: error.message || "Unknown error during download" };
    updateStatus.value = "update-error";
  }
}

function installUpdate() {
  try {
    window.api.quitAndInstall();
  } catch (error) {
    console.error("Error installing update:", error);

    updateInfo.value = { message: error.message || "Failed to install update" };
    updateStatus.value = "update-error";
  }
}

function dismissUpdate() {
  updateAvailable.value = false;
}

function openReleases() {
  if (window.api && window.api.openExternal) {
    window.api.openExternal(RELEASES_URL);
  } else {
    window.open(RELEASES_URL, "_blank");
  }
}
</script>
