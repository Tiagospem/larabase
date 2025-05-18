<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import Modal from './Modal.vue';

interface UpdateData {
	status: string;
	data?: Record<string, any>;
}

interface UpdateInfo {
	version?: string;
	releaseDate?: string;
	releaseNotes?: string;
	files?: Array<{ url: string }>;
	downloadedPath?: string;
	[key: string]: any;
}

const updateAvailable = ref(false);
const updateStatus = ref('');
const updateInfo = ref<UpdateInfo>({});
const originalUpdateInfo = ref<UpdateInfo>({});
const currentVersion = ref('');
const showModal = ref(false);
const progress = ref(0);
const loading = ref(false);
const downloading = ref(false);
const updateComplete = ref(false);
const updateError = ref('');

let removeUpdateListener: (() => void) | null = null;
let eventListeners: Array<{ event: string; handler: EventListener }> = [];

const RELEASES_URL = 'https://github.com/Tiagospem/larabase/releases/latest';

const progressPercentage = computed(() => {
	const value = Number(progress.value);
	return isNaN(value) ? 0 : Math.round(value);
});

const downloadStatusMessage = computed(() => {
	if (progressPercentage.value === 0) return 'Preparing download...';
	if (progressPercentage.value < 20) return 'Starting download...';
	if (progressPercentage.value < 80) return 'Downloading update...';
	if (progressPercentage.value < 100) return 'Almost done...';
	return 'Download complete!';
});

onMounted(async () => {
	try {
		setTimeout(async () => {
			try {
				if (window.ipcRenderer) {
					try {
						currentVersion.value =
							await window.ipcRenderer.getCurrentVersion();
					} catch (error) {}

					try {
						removeUpdateListener =
							window.ipcRenderer.onUpdateStatus(
								(data: UpdateData) => {
									updateStatus.value = data.status;

									if (data.data) {
										if (
											data.status === 'update-error' &&
											data.data.message &&
											data.data.message.includes(
												'code signature'
											) &&
											data.data.message.includes(
												'did not pass validation'
											)
										) {
											data.data.message =
												'Code signature validation failed. The update cannot be installed automatically. ' +
												'Please download the latest version manually from GitHub.';
										}

										updateInfo.value = data.data;
										originalUpdateInfo.value = {
											...data.data
										};

										if (data.status === 'update-error') {
											updateError.value =
												data.data.message ||
												'Unknown error occurred';
											downloading.value = false;
										}

										if (
											data.status ===
												'download-progress' &&
											data.data &&
											typeof data.data.percent !==
												'undefined'
										) {
											const newProgress = Number(
												data.data.percent
											);
											if (!isNaN(newProgress)) {
												progress.value = newProgress;
											}
										}
									}

									if (data.status === 'update-available') {
										updateAvailable.value = true;
										updateError.value = '';
										showModal.value = true;
									} else if (
										data.status === 'update-not-available'
									) {
										updateAvailable.value = false;
									} else if (
										data.status === 'update-downloaded'
									) {
										updateAvailable.value = true;
										updateComplete.value = true;
										downloading.value = false;
										showModal.value = true;
									} else if (data.status === 'update-error') {
										updateAvailable.value = true;
										updateError.value =
											data.data?.message ||
											'Error updating application';
										downloading.value = false;
										showModal.value = true;
									}
								}
							);
					} catch (error) {}

					setupListeners();

					try {
						await checkForUpdates();
					} catch (error) {
						updateError.value =
							'Failed to check for updates: ' +
							(error as Error).message;
					}
				}
			} catch (innerError) {
				updateError.value =
					'Failed to initialize update checker: ' +
					(innerError as Error).message;
			}
		}, 2000);
	} catch (error) {
		updateError.value =
			'Failed to setup update checker: ' + (error as Error).message;
	}
});

onUnmounted(() => {
	removeAllListeners();
});

function addEventListener(event: string, handler: EventListener) {
	window.addEventListener(event, handler);
	eventListeners.push({ event, handler });
}

function setupListeners() {
	if (!window || !document) {
		return;
	}

	addEventListener('update-available', ((event: CustomEvent) => {
		updateInfo.value = event.detail;
		updateAvailable.value = true;
		updateError.value = '';
		showModal.value = true;
	}) as EventListener);

	addEventListener('autoUpdater:update-info', ((event: CustomEvent) => {
		const args = event.detail;

		updateInfo.value = {
			...updateInfo.value,
			...args
		};

		const downloadUrl = args.downloadUrl || getDownloadUrl(args);
		startDownload(downloadUrl);
	}) as EventListener);

	addEventListener('autoUpdater:download-progress', ((event: CustomEvent) => {
		loading.value = true;
		downloading.value = true;

		if (Object.keys(originalUpdateInfo.value).length > 0) {
			updateInfo.value = { ...originalUpdateInfo.value };
		}

		if (event.detail && typeof event.detail.percent !== 'undefined') {
			const newProgress = Number(event.detail.percent);
			if (!isNaN(newProgress)) {
				if (newProgress > progress.value || newProgress >= 99) {
					progress.value = newProgress;
				}
			}
		}
	}) as EventListener);

	addEventListener('autoUpdater:download-complete', ((event: CustomEvent) => {
		loading.value = false;
		downloading.value = false;
		updateComplete.value = true;
		progress.value = 100;

		updateInfo.value.downloadedPath = event.detail?.path || '';

		if (event.detail && event.detail.path) {
			originalUpdateInfo.value = {
				...originalUpdateInfo.value,
				downloadedPath: event.detail.path
			};

			updateStatus.value = 'Installing update...';

			installUpdate();
		}
	}) as EventListener);

	if (window.ipcRenderer) {
		try {
			const directEventHandler = (eventName: string) => (data: any) => {
				if (
					eventName === 'autoUpdater:download-progress' &&
					data &&
					typeof data.percent !== 'undefined'
				) {
					progress.value = Number(data.percent);
				}
			};

			if (window.ipcRenderer.onEvent) {
				window.ipcRenderer.onEvent(
					'autoUpdater:download-progress',
					directEventHandler('autoUpdater:download-progress')
				);
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

function getDownloadUrl(info: any): string {
	if (!info || !info.files || !info.files.length) {
		return RELEASES_URL;
	}

	const dmgFile = info.files.find((file: any) => file.url.includes('dmg'));
	if (!dmgFile) {
		return RELEASES_URL;
	}

	if (dmgFile.url.startsWith('http')) {
		return dmgFile.url;
	}

	const tag = info.tag || `v${info.version}`;

	return `https://github.com/Tiagospem/larabase/releases/download/${tag}/${dmgFile.url}`;
}

function startDownload(downloadUrl: string) {
	originalUpdateInfo.value = { ...updateInfo.value };

	updateError.value = '';
	loading.value = true;
	downloading.value = true;
	progress.value = 0;

	setTimeout(() => {
		if (window.ipcRenderer && window.ipcRenderer.send) {
			window.ipcRenderer.send('main:download-progress-info', downloadUrl);
		} else {
			updateError.value = 'Download mechanism not available';
		}
	}, 100);
}

function formatDate(dateString: string | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

async function checkForUpdates() {
	if (window.ipcRenderer && window.ipcRenderer.checkForUpdates) {
		await window.ipcRenderer.checkForUpdates();
	}
}

async function downloadUpdate() {
	try {
		originalUpdateInfo.value = { ...updateInfo.value };

		updateError.value = '';
		downloading.value = true;
		progress.value = 0;
		updateStatus.value = 'Downloading update...';

		await new Promise((resolve) => setTimeout(resolve, 200));

		if (window.ipcRenderer && window.ipcRenderer.send) {
			window.ipcRenderer.send('main:download-update');
		} else {
			updateError.value = 'Update mechanism not available';
		}
	} catch (error) {
		downloading.value = false;
		updateError.value =
			(error as Error).message || 'Unknown error during download';
		updateStatus.value = 'update-error';
	}
}

function dismissUpdate() {
	if (!downloading.value || updateComplete.value || updateError.value) {
		updateAvailable.value = false;
		showModal.value = false;
	}
}

function openReleases() {
	if (window.ipcRenderer && window.ipcRenderer.openExternal) {
		window.ipcRenderer.openExternal(RELEASES_URL);
	} else {
		window.open(RELEASES_URL, '_blank');
	}
}

function installUpdate() {
	const downloadedPath =
		originalUpdateInfo.value.downloadedPath ||
		updateInfo.value.downloadedPath;

	updateError.value = '';

	if (
		downloadedPath &&
		window.ipcRenderer &&
		window.ipcRenderer.openExternal
	) {
		try {
			window.ipcRenderer.openExternal(`file://${downloadedPath}`);
			setTimeout(() => {
				if (window.ipcRenderer) {
					window.ipcRenderer
						.invoke('quit-and-install')
						.catch((err) => {
							updateError.value = `Failed to quit application: ${err.message || 'Unknown error'}`;
						});
				}
			}, 500);
			return;
		} catch (error) {
			updateError.value = `Failed to open installer: ${(error as Error).message}`;
		}
	}

	if (window.ipcRenderer) {
		loading.value = true;
		if (window.ipcRenderer.invoke) {
			window.ipcRenderer
				.invoke('quit-and-install')
				.then((result) => {
					loading.value = false;
					if (result?.error) {
						updateError.value = `Installation failed: ${result.error}`;
					} else if (result?.dev && !result?.opened) {
						updateError.value =
							'No installation file found. You may need to download manually.';
					}
				})
				.catch((err) => {
					loading.value = false;
					updateError.value = `Installation failed: ${err.message || 'Unknown error'}`;
				});
		} else if (window.ipcRenderer.quitAndInstall) {
			try {
				window.ipcRenderer.quitAndInstall();
			} catch (error) {
				loading.value = false;
				updateError.value = `Installation failed: ${(error as Error).message || 'Unknown error'}`;
			}
		} else {
			loading.value = false;
			updateError.value =
				'Update installation not available on this platform';
		}
	} else {
		updateError.value = 'Update installation not available';
	}
}
</script>

<template>
	<div class="text-sm space-y-3 text-base-content">
		<Modal
			:show="showModal"
			:allow-close-on-backdrop="false"
			:allow-close-on-esc="false"
			title="Update Available"
			:hide-close-button="downloading && !updateComplete && !updateError"
			@close="dismissUpdate"
			width="max-w-5xl"
		>
			<div class="mt-2 space-y-3">
				<div
					class="card card-side bg-neutral shadow-xl"
					v-if="!downloading"
				>
					<div
						class="select-none space-y-3 card-body text-neutral-content/80"
					>
						<div class="flex justify-between">
							<div>
								<h2 class="card-title">New Version</h2>
								<p>
									{{
										originalUpdateInfo.version ||
										updateInfo.version
									}}
								</p>
							</div>
							<div
								v-if="
									originalUpdateInfo.releaseDate ||
									updateInfo.releaseDate
								"
							>
								<h2 class="card-title">Release Date</h2>
								<p>
									{{
										formatDate(
											originalUpdateInfo.releaseDate ||
												updateInfo.releaseDate
										)
									}}
								</p>
							</div>
						</div>

						<div
							id="releaseNotes"
							v-html="
								originalUpdateInfo.releaseNotes ||
								updateInfo.releaseNotes
							"
						></div>
					</div>
				</div>

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
					<div class="text-center text-sm opacity-70">
						{{ progressPercentage }}% Complete
					</div>
				</div>

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

			<template #footer>
				<button
					class="btn btn-secondary"
					:disabled="downloading && !updateComplete && !updateError"
					@click="dismissUpdate"
				>
					{{ updateComplete ? 'Close' : 'Not Now' }}
				</button>
				<button
					v-if="updateComplete"
					class="btn btn-primary"
					@click="installUpdate"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5 mr-2"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
						></path>
						<polyline points="17 8 12 3 7 8"></polyline>
						<line
							x1="12"
							y1="3"
							x2="12"
							y2="15"
						></line>
					</svg>
					Install Now
				</button>
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
						<path
							d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
						></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line
							x1="12"
							y1="15"
							x2="12"
							y2="3"
						></line>
					</svg>
					Download Update
				</button>
				<button
					v-if="updateError"
					class="btn btn-primary"
					@click="openReleases"
				>
					Download Manually
				</button>
			</template>
		</Modal>
	</div>
</template>

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
