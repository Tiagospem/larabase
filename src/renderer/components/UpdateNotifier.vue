<template>
  <div class="text-sm space-y-3 text-base-content">
    <dialog
      ref="modal"
      class="modal"
      v-if="updateAvailable"
    >
      <div class="modal-box w-11/12 max-w-5xl">
        <div class="font-bold text-lg text-center mb-4">Update Available</div>
        <div class="mt-2 space-y-3">
          <div class="card card-side bg-neutral shadow-xl">
            <div class="select-none space-y-3 card-body text-neutral-content/80">
              <div class="flex justify-between">
                <div>
                  <h2 class="card-title">Version</h2>
                  <p>{{ updateInfo.version }}</p>
                </div>
                <div v-if="updateInfo.releaseDate">
                  <h2 class="card-title">Release Date</h2>
                  <p>{{ formatDate(updateInfo.releaseDate) }}</p>
                </div>
              </div>

              <div
                id="releaseNotes"
                v-html="updateInfo.releaseNotes"
              ></div>
            </div>
          </div>

          <!-- Download Status Area -->
          <div
            class="card bg-base-200 p-4"
            v-if="downloading"
          >
            <div class="text-center mb-2 font-semibold">
              {{ downloadStatusMessage }}
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div
                class="bg-primary h-2.5 rounded-full transition-all duration-300"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
            </div>
            <div class="text-center text-sm opacity-70">{{ progressPercentage }}% Complete</div>
          </div>

          <!-- Error Message -->
          <div
            class="alert alert-error"
            v-if="updateError"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ updateError }}</span>
          </div>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button
              class="btn btn-secondary"
              :disabled="downloading && !updateComplete && !updateError"
              @click="dismissUpdate"
            >
              {{ updateComplete ? "Close" : "Not Now" }}
            </button>
          </form>
          <button
            v-if="!downloading && !updateComplete"
            class="btn btn-primary"
            @click="downloadUpdate"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line
                x1="12"
                y1="15"
                x2="12"
                y2="3"
              ></line>
            </svg>
            Install
          </button>
          <button
            v-if="updateError"
            class="btn btn-primary"
            @click="openReleases"
          >
            Download Manually
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

const updateAvailable = ref(false);
const updateStatus = ref("");
const updateInfo = ref({});
const currentVersion = ref("");
const modal = ref(null);
const progress = ref(0);
const loading = ref(false);
const downloading = ref(false);
const updateComplete = ref(false);
const updateError = ref("");

let removeUpdateListener = null;
let eventListeners = [];

const RELEASES_URL = "https://github.com/Tiagospem/larabase/releases/latest";

const progressPercentage = computed(() => {
  const value = Number(progress.value);
  return isNaN(value) ? 0 : Math.round(value);
});

const downloadStatusMessage = computed(() => {
  if (progressPercentage.value === 0) return "Preparing download...";
  if (progressPercentage.value < 20) return "Starting download...";
  if (progressPercentage.value < 80) return "Downloading update...";
  if (progressPercentage.value < 100) return "Almost done...";
  return "Download complete!";
});

onMounted(async () => {
  try {
    setTimeout(async () => {
      try {
        if (window.api && window.api.getCurrentVersion) {
          currentVersion.value = await window.api.getCurrentVersion();
        }

        if (window.api && window.api.onUpdateStatus) {
          removeUpdateListener = window.api.onUpdateStatus((data) => {
            updateStatus.value = data.status;

            if (data.data) {
              if (data.status === "update-error" && data.data.message && data.data.message.includes("code signature") && data.data.message.includes("did not pass validation")) {
                data.data.message = "Code signature validation failed. The update cannot be installed automatically. " + "Please download the latest version manually from GitHub.";
              }

              updateInfo.value = data.data;

              if (data.status === "update-error") {
                updateError.value = data.data.message || "Unknown error occurred";
                downloading.value = false;
              }

              if (data.status === "download-progress" && data.data && typeof data.data.percent !== "undefined") {
                const newProgress = Number(data.data.percent);
                if (!isNaN(newProgress)) {
                  progress.value = newProgress;
                }
              }
            }

            if (data.status === "update-available") {
              updateAvailable.value = true;
              updateError.value = "";
              if (modal.value) {
                modal.value.showModal();
              }
            } else if (data.status === "update-not-available") {
              updateAvailable.value = false;
            } else if (data.status === "update-downloaded") {
              updateAvailable.value = true;
              updateComplete.value = true;
              downloading.value = false;
            } else if (data.status === "update-error") {
              updateAvailable.value = true;
              updateError.value = data.data?.message || "Error updating application";
              downloading.value = false;
            }
          });

          setupListeners();

          await checkForUpdates();
        }
      } catch (innerError) {
        console.error("Error initializing update checker:", innerError);
        updateError.value = "Failed to initialize update checker: " + innerError.message;
      }
    }, 2000);
  } catch (error) {
    console.error("Error setting up update checker:", error);
    updateError.value = "Failed to setup update checker: " + error.message;
  }
});

onUnmounted(() => {
  removeAllListeners();
});

function addEventListener(event, handler) {
  window.addEventListener(event, handler);
  eventListeners.push({ event, handler });
}

function setupListeners() {
  if (!window || !document) {
    return;
  }

  addEventListener("update-available", (event) => {
    updateInfo.value = event.detail;
    updateAvailable.value = true;
    updateError.value = "";
    if (modal.value) {
      modal.value.showModal();
    }
  });

  addEventListener("autoUpdater:update-info", (event) => {
    const args = event.detail;
    updateInfo.value = args;
    const downloadUrl = getDownloadUrl(args);
    startDownload(downloadUrl);
  });

  addEventListener("autoUpdater:download-progress", (event) => {
    loading.value = true;
    downloading.value = true;

    if (event.detail && typeof event.detail.percent !== "undefined") {
      const newProgress = Number(event.detail.percent);
      if (!isNaN(newProgress)) {
        if (newProgress > progress.value || newProgress >= 99) {
          progress.value = newProgress;
        }
      }
    }
  });

  addEventListener("autoUpdater:download-complete", (event) => {
    loading.value = false;
    downloading.value = false;
    updateComplete.value = true;
    progress.value = 100;

    if (event.detail && event.detail.path) {
      if (window.api && window.api.send) {
        window.api.send("main:download-complete", event.detail.path);
      }
    }
  });

  if (window.api) {
    try {
      const directEventHandler = (eventName) => (data) => {
        if (eventName === "autoUpdater:download-progress" && data && typeof data.percent !== "undefined") {
          progress.value = Number(data.percent);
        }
      };

      if (window.api.onEvent) {
        window.api.onEvent("autoUpdater:download-progress", directEventHandler("autoUpdater:download-progress"));
      }
    } catch (e) {}
  }
}

function removeAllListeners() {
  if (removeUpdateListener) {
    removeUpdateListener();
  }

  eventListeners.forEach(({ event, handler }) => {
    window.removeEventListener(event, handler);
  });
  eventListeners = [];
}

function getDownloadUrl(info) {
  if (!info || !info.files || !info.files.length) {
    return RELEASES_URL;
  }

  const dmgFile = info.files.find((file) => file.url.includes("dmg"));
  if (!dmgFile) {
    return RELEASES_URL;
  }

  if (dmgFile.url.startsWith("http")) {
    return dmgFile.url;
  }

  const tag = info.tag || `v${info.version}`;

  return `https://github.com/Tiagospem/larabase/releases/download/${tag}/${dmgFile.url}`;
}

function startDownload(downloadUrl) {
  updateError.value = "";
  loading.value = true;
  downloading.value = true;
  progress.value = 0;

  setTimeout(() => {
    if (window.api && window.api.send) {
      window.api.send("main:download-progress-info", downloadUrl);
    } else {
      console.error("API send method not available for download");
      updateError.value = "Download mechanism not available";
    }
  }, 100);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function checkForUpdates() {
  try {
    if (window.api && window.api.checkForUpdates) {
      await window.api.checkForUpdates();
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    updateError.value = "Failed to check for updates: " + error.message;
  }
}

async function downloadUpdate() {
  try {
    updateError.value = "";
    downloading.value = true;
    progress.value = 0;

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (window.api && window.api.downloadUpdate) {
      await window.api.downloadUpdate();
    } else {
      console.error("Download update API not available");
      updateError.value = "Update mechanism not available";
    }
  } catch (error) {
    console.error("Error downloading update:", error);
    downloading.value = false;
    updateError.value = error.message || "Unknown error during download";
    updateStatus.value = "update-error";
  }
}

function dismissUpdate() {
  if (!downloading.value || updateComplete.value || updateError.value) {
    updateAvailable.value = false;
    if (modal.value) {
      modal.value.close();
    }
  }
}

function openReleases() {
  if (window.api && window.api.openExternal) {
    window.api.openExternal(RELEASES_URL);
  } else {
    window.open(RELEASES_URL, "_blank");
  }
}
</script>

<style>
#releaseNotes h2 {
  font-size: 1.125rem !important;
  line-height: 1.75rem !important;
  font-weight: 600 !important;
}

#releaseNotes ul {
  list-style: disc !important;
  margin-left: 36px !important;
  padding: 4px;
}
</style>
