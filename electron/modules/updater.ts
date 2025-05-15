import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import fs from 'fs';
import { download } from 'electron-dl';

const CONFIG = {
	updateCheckIntervalMs: 3600000,
	initialCheckDelayMs: 30000,
	quitDelayMs: 1000,
	debugMode: false
};

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow;
let updateCheckInterval: NodeJS.Timeout | null = null;
let globalUpdateInfo: any;

function setupAutoUpdater() {
	if (isDev && !CONFIG.debugMode) return;

	autoUpdater.forceDevUpdateConfig = true;
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.allowDowngrade = true;
	autoUpdater.allowPrerelease = false;
	autoUpdater.disableWebInstaller = false;
	autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache' };
	autoUpdater.logger = console;
}

function setupAutoUpdaterEvents() {
	if (isDev && !CONFIG.debugMode) return;

	autoUpdater.on('checking-for-update', () =>
		sendStatusToWindow('checking-for-update')
	);
	autoUpdater.on('update-available', (info) => handleUpdateAvailable(info));
	autoUpdater.on('update-not-available', () =>
		sendStatusToWindow('update-not-available')
	);
	autoUpdater.on('error', (err) => {
		sendStatusToWindow('update-error', err);
	});

	autoUpdater.on('download-progress', (progress) => {
		const normalized = normalizePercentage(progress.percent || 0);
		sendStatusToWindow('download-progress', { percent: normalized });
		mainWindow?.webContents.send('autoUpdater:download-progress', {
			percent: normalized
		});
	});

	autoUpdater.on('update-downloaded', (info) => handleUpdateDownloaded(info));
}

function handleUpdateAvailable(updateInfo: any) {
	setTimeout(async () => {
		globalUpdateInfo = updateInfo;

		if (process.platform === 'darwin') {
			sendStatusToWindow('update-available', updateInfo);
			mainWindow?.webContents.send('update-available', updateInfo);
		} else {
			const { response } = await dialog.showMessageBox({
				type: 'info',
				title: 'Update Available',
				message: `A new version (${updateInfo.version}) is available. Update now?`,
				buttons: ['Yes', 'No']
			});
			if (response === 0) {
				mainWindow?.webContents.send('update-info', updateInfo);
				await autoUpdater.downloadUpdate();
			}
		}
	}, 2000);
}

function handleUpdateDownloaded(info: any) {
	setTimeout(async () => {
		mainWindow?.show();
		sendStatusToWindow('update-downloaded', info);

		await dialog.showMessageBox(
			new BrowserWindow({ show: false, alwaysOnTop: true }),
			{
				title: 'Install Updates',
				message: 'Update completed! Restarting...'
			}
		);

		autoUpdater.quitAndInstall();
	}, 1000);
}

function normalizePercentage(value: number): number {
	if (value > 0 && value < 1) return Math.round(value * 100);
	return Math.min(100, Math.round(value));
}

function handleDownloadUpdate() {
	setTimeout(async () => {
		if (!globalUpdateInfo || !globalUpdateInfo.files) {
			return sendStatusToWindow('update-error', {
				message: 'No update info available'
			});
		}

		if (process.platform === 'darwin') {
			const downloadPath = app.getPath('downloads');
			const files = globalUpdateInfo.files || [];
			const dmg = files.find((f: any) => f.url.includes('dmg'));

			if (!dmg) {
				return sendStatusToWindow('update-error', {
					message: 'No DMG file'
				});
			}

			const fileName = dmg.url.split('/').pop();
			const fullPath = `${downloadPath}/${fileName}`;

			if (fs.existsSync(fullPath)) {
				await shell.openPath(fullPath);
				app.quit();
			} else {
				let downloadUrl;
				if (dmg.url.startsWith('http')) {
					downloadUrl = dmg.url;
				} else {
					const tag =
						globalUpdateInfo.tag || `v${globalUpdateInfo.version}`;
					downloadUrl = `https://github.com/Tiagospem/larabase/releases/download/${tag}/${dmg.url}`;
				}

				const props = {
					onProgress: (p: any) => {
						const pct = normalizePercentage(
							typeof p === 'number'
								? p
								: p.percent || p.transferredBytes / p.totalBytes
						);
						if (pct > 0) {
							mainWindow?.webContents.send(
								'autoUpdater:download-progress',
								{ percent: pct }
							);
							sendStatusToWindow('download-progress', {
								percent: pct
							});
						}
					},
					onCompleted: (item) => {
						mainWindow?.webContents.send(
							'autoUpdater:download-progress',
							{ percent: 100 }
						);
						mainWindow?.webContents.send(
							'autoUpdater:download-complete',
							item
						);
						sendStatusToWindow(
							'update-downloaded',
							globalUpdateInfo
						);
					},
					showBadge: true,
					directory: downloadPath
				};

				try {
					await download(mainWindow, downloadUrl, props);
				} catch (err: any) {
					sendStatusToWindow('update-error', {
						message: err.message
					});
				}
			}
		} else {
			mainWindow?.webContents.send('update-info', globalUpdateInfo);
			await autoUpdater.downloadUpdate();
		}
	}, 1000);
}

function sendStatusToWindow(status: string, data: any = null) {
	mainWindow?.webContents.send('update-status', { status, data });
}

function setupAutoUpdateCheck() {
	if (isDev && !CONFIG.debugMode) return;

	setTimeout(
		() => autoUpdater.checkForUpdates().catch(() => {}),
		CONFIG.initialCheckDelayMs
	);
	updateCheckInterval = setInterval(
		() => autoUpdater.checkForUpdates().catch(() => {}),
		CONFIG.updateCheckIntervalMs
	);
}

export function registerUpdaterHandlers(window: BrowserWindow) {
	mainWindow = window;

	setupAutoUpdater();
	setupAutoUpdaterEvents();

	ipcMain.on('main:download-update', handleDownloadUpdate);

	ipcMain.on('main:download-progress-info', async (event, url) => {
		mainWindow?.webContents.send('autoUpdater:download-progress', {
			percent: 0
		});

		const props = {
			onProgress: (p: any) => {
				const pct = normalizePercentage(
					typeof p === 'number'
						? p
						: p.percent || p.transferredBytes / p.totalBytes
				);
				if (pct > 0) {
					mainWindow?.webContents.send(
						'autoUpdater:download-progress',
						{ percent: pct }
					);
				}
			},
			onCompleted: (item) => {
				mainWindow?.webContents.send('autoUpdater:download-progress', {
					percent: 100
				});
				mainWindow?.webContents.send(
					'autoUpdater:download-complete',
					item
				);
			},
			showBadge: true,
			directory: app.getPath('downloads')
		};

		try {
			await download(mainWindow, url, props);
		} catch (err: any) {
			sendStatusToWindow('update-error', { message: err.message });
		}
	});

	ipcMain.on('main:download-complete', async (event, filePath) => {
		const { response } = await dialog.showMessageBox({
			type: 'info',
			title: 'Update Completed',
			message: 'Download finished. Install now?',
			buttons: ['Yes', 'No']
		});
		if (response === 0) {
			await shell.openPath(filePath);
			setTimeout(() => app.quit(), CONFIG.quitDelayMs);
		}
	});

	ipcMain.handle('check-for-updates', async () => {
		if (isDev && !CONFIG.debugMode) return { updateAvailable: false };
		try {
			return await autoUpdater.checkForUpdates();
		} catch (e: any) {
			return { error: e.message };
		}
	});

	ipcMain.handle('download-update', async () => {
		if (isDev && !CONFIG.debugMode)
			return { success: false, skipped: true };
		handleDownloadUpdate();
		return { success: true };
	});

	ipcMain.handle('quit-and-install', async () => {
		try {
			if (isDev) {
				if (globalUpdateInfo && globalUpdateInfo.files) {
					const files = globalUpdateInfo.files || [];
					const dmg = files.find((f: any) => f.url.includes('dmg'));

					if (dmg) {
						const downloadPath = app.getPath('downloads');
						const fileName = dmg.url.split('/').pop();
						const fullPath = `${downloadPath}/${fileName}`;

						if (fs.existsSync(fullPath)) {
							await shell.openPath(fullPath);
							setTimeout(() => app.exit(0), 1000);
							return { success: true, dev: true, opened: true };
						}
					}
				}

				const { response } = await dialog.showMessageBox({
					type: 'info',
					title: 'Development Mode',
					message:
						'No installation file found. In production, the app would now install the update.',
					buttons: ['OK']
				});

				return { success: true, dev: true, opened: false };
			} else {
				autoUpdater.quitAndInstall(false, true);
				return { success: true };
			}
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	});

	ipcMain.handle('get-current-version', () => app.getVersion());
	ipcMain.handle('open-external', (evt, url: string) =>
		shell.openExternal(url)
	);

	if (!isDev || CONFIG.debugMode) {
		setupAutoUpdateCheck();
	}
}

export function cleanup() {
	if (updateCheckInterval) {
		clearInterval(updateCheckInterval);
		updateCheckInterval = null;
	}
}
